import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
from collections import defaultdict

from app.services.database_service import database_service

logger = logging.getLogger(__name__)


class HeuristicRecommendationService:


    def __init__(self):
        self.min_buddy_score = 0.1
        self.denial_lookback_days = 30

    async def get_group_recommendations_for_user(
        self,
        user_id: str,
        organization_id: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:

        user_groups = await self._get_user_groups(user_id, organization_id)
        user_group_ids = {g["id"] for g in user_groups}

        buddies = await self._find_group_buddies(user_id, organization_id, user_groups)

        denials = await self._get_user_access_denials(user_id, organization_id)
        denial_groups = {d["group_id"] for d in denials if d["group_id"]}

        group_scores = {}

        all_groups = await self._get_all_groups(organization_id)

        for group in all_groups:
            if group["id"] in user_group_ids:
                continue  # Skip groups user is already in

            score_components = {
                "buddy_score": 0.0,
                "denial_resolution_score": 0.0,
                "friend_count_score": 0.0,
                "frustration_reduction": 0.0
            }

            # how many buddies are in this group
            buddies_in_group = []
            for buddy_id, buddy_info in buddies.items():
                if group["id"] in buddy_info["groups"]:
                    buddies_in_group.append((buddy_id, buddy_info["score"]))

            if buddies_in_group:
                # Weight by buddy relationship strength
                score_components["buddy_score"] = sum(
                    score for _, score in buddies_in_group
                ) / len(buddies_in_group)

            if group["id"] in denial_groups:
                denials_for_group = [d for d in denials if d["group_id"] == group["id"]]
                score_components["denial_resolution_score"] = len(denials_for_group) / 10.0

                frustration = self._calculate_frustration_score(denials_for_group)
                score_components["frustration_reduction"] = frustration

            friend_count_score = await self._calculate_friend_count_score(
                user_id, group["id"], buddies, organization_id
            )
            score_components["friend_count_score"] = friend_count_score

            final_score = (
                score_components["buddy_score"] * 0.3 +
                score_components["denial_resolution_score"] * 0.3 +
                score_components["frustration_reduction"] * 0.2 +
                score_components["friend_count_score"] * 0.2
            )

            if final_score > 0:
                group_scores[group["id"]] = {
                    "group": group,
                    "score": final_score,
                    "components": score_components,
                    "buddies_in_group": [b[0] for b in buddies_in_group],
                    "denials_resolved": len([d for d in denials if d["group_id"] == group["id"]])
                }

        recommendations = sorted(
            group_scores.values(),
            key=lambda x: x["score"],
            reverse=True
        )[:top_k]

        return [
            {
                "group_id": rec["group"]["id"],
                "group_name": rec["group"]["name"],
                "score": rec["score"],
                "reason": self._generate_recommendation_reason(rec),
                "details": {
                    "buddies_in_group": rec["buddies_in_group"],
                    "denials_that_would_be_resolved": rec["denials_resolved"],
                    "score_breakdown": rec["components"]
                }
            }
            for rec in recommendations
        ]

    async def _find_group_buddies(
        self,
        user_id: str,
        organization_id: str,
        user_groups: List[Dict]
    ) -> Dict[str, Dict]:
        if not user_groups:
            return {}

        def create_buddy_info():
            return {
                "shared_groups": [],
                "join_time_deltas": [],
                "permissions_match": 0,
                "total_interactions": 0,
                "buddy_name": ""
            }

        buddies = defaultdict(create_buddy_info)

        group_ids = [g["id"] for g in user_groups]

        query = """
            SELECT
                gm."userId" as buddy_id,
                gm."groupId" as group_id,
                gm."joinedAt",
                gm."canUpload",
                gm."canDelete",
                g.name as group_name,
                u.name as buddy_name
            FROM "GroupMembership" gm
            INNER JOIN "Group" g ON g.id = gm."groupId"
            INNER JOIN "User" u ON u.id = gm."userId"
            WHERE gm."groupId" = ANY($1)
              AND gm."userId" != $2
              AND g."organizationId" = $3
        """

        async with database_service.pool.acquire() as conn:
            rows = await conn.fetch(query, group_ids, user_id, organization_id)

            for row in rows:
                buddy_id = row["buddy_id"]
                group_id = row["group_id"]

                buddies[buddy_id]["shared_groups"].append(group_id)

                user_join_time = next(
                    (g["joined_at"] for g in user_groups if g["id"] == group_id),
                    None
                )
                if user_join_time and row["joinedAt"]:
                    time_delta = abs((user_join_time - row["joinedAt"]).days)
                    buddies[buddy_id]["join_time_deltas"].append(time_delta)

                user_permissions = next(
                    ((g["can_upload"], g["can_delete"]) for g in user_groups if g["id"] == group_id),
                    (False, False)
                )
                buddy_permissions = (row["canUpload"], row["canDelete"])
                if user_permissions == buddy_permissions:
                    buddies[buddy_id]["permissions_match"] += 1

                buddies[buddy_id]["buddy_name"] = row["buddy_name"]

        scored_buddies = {}
        for buddy_id, info in buddies.items():
            if not info["shared_groups"]:
                continue

            # Shared group score
            shared_group_score = len(info["shared_groups"]) / len(user_groups)

            # Time score
            if info["join_time_deltas"]:
                avg_time_delta = sum(info["join_time_deltas"]) / len(info["join_time_deltas"])
                time_score = max(0, 1 - (avg_time_delta / 365))
            else:
                time_score = 0
                avg_time_delta = 0

            # Permission match score
            permission_score = info["permissions_match"] / len(info["shared_groups"])

            buddy_score = (
                shared_group_score * 0.5 +
                time_score * 0.3 +
                permission_score * 0.2
            )

            if buddy_score >= self.min_buddy_score:
                scored_buddies[buddy_id] = {
                    "score": buddy_score,
                    "name": info["buddy_name"],
                    "groups": info["shared_groups"],
                    "shared_group_count": len(info["shared_groups"]),
                    "avg_join_time_delta_days": avg_time_delta
                }

        return scored_buddies

    async def _get_user_access_denials(
        self,
        user_id: str,
        organization_id: str
    ) -> List[Dict]:
        """Get recent access denials for the user"""
        cutoff_date = datetime.now() - timedelta(days=self.denial_lookback_days)

        query = """
            SELECT
                "groupId" as group_id,
                "documentId" as document_id,
                "searchQuery" as search_query,
                "denialReason" as denial_reason,
                COUNT(*) as denial_count,
                MAX("timestamp") as last_denial
            FROM "AccessDenialLog"
            WHERE "userId" = $1
              AND "organizationId" = $2
              AND "timestamp" > $3
              AND "denialReason" = 'not_in_group'
            GROUP BY "groupId", "documentId", "searchQuery", "denialReason"
            ORDER BY denial_count DESC
        """

        async with database_service.pool.acquire() as conn:
            rows = await conn.fetch(query, user_id, organization_id, cutoff_date)
            return [dict(row) for row in rows]

    def _calculate_frustration_score(self, denials: List[Dict]) -> float:
        if not denials:
            return 0.0

        total_attempts = sum(d["denial_count"] for d in denials)
        unique_queries = len(set(d["search_query"] for d in denials))

        repetition_factor = total_attempts / max(unique_queries, 1)
        return min(1.0, repetition_factor / 10.0)

    async def _calculate_friend_count_score(
        self,
        user_id: str,
        group_id: str,
        buddies: Dict[str, Dict],
        organization_id: str
    ) -> float:
        if not buddies:
            return 0.0

        # Get members of the target group
        query = """
            SELECT gm."userId"
            FROM "GroupMembership" gm
            WHERE gm."groupId" = $1
        """

        async with database_service.pool.acquire() as conn:
            rows = await conn.fetch(query, group_id)
            group_members = {row["userId"] for row in rows}

        # Count buddies of buddies in the target group
        fof_connections = 0
        for buddy_id in buddies.keys():
            if buddy_id in group_members:
                fof_connections += buddies[buddy_id]["score"]

        # Normalize by number of buddies
        return min(1.0, fof_connections / max(len(buddies), 1))

    async def _get_user_groups(self, user_id: str, organization_id: str) -> List[Dict]:
        """Get all groups the user is a member of"""
        query = """
            SELECT
                g.id,
                g.name,
                gm."joinedAt" as joined_at,
                gm."canUpload" as can_upload,
                gm."canDelete" as can_delete
            FROM "GroupMembership" gm
            INNER JOIN "Group" g ON g.id = gm."groupId"
            WHERE gm."userId" = $1
              AND g."organizationId" = $2
        """

        async with database_service.pool.acquire() as conn:
            rows = await conn.fetch(query, user_id, organization_id)
            return [dict(row) for row in rows]

    async def _get_all_groups(self, organization_id: str) -> List[Dict]:
        """Get all groups in the organization"""
        query = """
            SELECT id, name, description
            FROM "Group"
            WHERE "organizationId" = $1
        """

        async with database_service.pool.acquire() as conn:
            rows = await conn.fetch(query, organization_id)
            return [dict(row) for row in rows]

    def _generate_recommendation_reason(self, recommendation: Dict) -> str:
        components = recommendation["components"]
        reasons = []

        if components["buddy_score"] > 0.2:
            buddy_count = len(recommendation["buddies_in_group"])
            reasons.append(f"{buddy_count} colleagues you frequently work with are in this group")

        if components["denial_resolution_score"] > 0.05:
            denials = recommendation["denials_resolved"]
            reasons.append(f"would grant access to {denials} documents you've searched for")

        if components["frustration_reduction"] > 0.05:
            reasons.append("you've repeatedly tried to access content from this group")

        if components["friend_count_score"] > 0.2:
            reasons.append("strongly connected through your network")

        return " and ".join(reasons).capitalize() if reasons else "Recommended based on your collaboration patterns"


# Create singleton instance
heuristic_recommendation_service = HeuristicRecommendationService()
