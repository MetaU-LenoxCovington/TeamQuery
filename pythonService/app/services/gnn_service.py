import torch
import torch.nn as nn
from torch_geometric.data import HeteroData
from torch_geometric.nn import HeteroConv, SAGEConv
import numpy as np
from typing import List, Dict, Optional, Tuple
import logging
from pathlib import Path
from datetime import datetime

from app.services.database_service import database_service

logger = logging.getLogger(__name__)

class GNNRecommendation:
    def __init__(self):
        self.hidden_dim = 64
        self.model = self.build_model()

        # ID mappings
        self.user_to_idx = {}
        self.group_to_idx = {}
        self.org_to_idx = {}

        # Reverse mappings
        self.idx_to_user = {}
        self.idx_to_group = {}
        self.idx_to_org = {}

        self.model_path = Path("data/models")
        self.model_path.mkdir(parents=True, exist_ok=True)

    def build_model(self):

        conv1 = HeteroConv({
            ('user', 'member_of', 'organization'): SAGEConv(-1, self.hidden_dim),
            ('organization', 'has_member', 'user'): SAGEConv(-1, self.hidden_dim),
            ('user', 'belongs_to', 'group'): SAGEConv(-1, self.hidden_dim),
            ('group', 'contains', 'user'): SAGEConv(-1, self.hidden_dim),
            ('group', 'part_of', 'organization'): SAGEConv(-1, self.hidden_dim),
            ('organization', 'contains_group', 'group'): SAGEConv(-1, self.hidden_dim),
        })

        conv2 = HeteroConv({
            ('user', 'member_of', 'organization'): SAGEConv(-1, self.hidden_dim),
            ('organization', 'has_member', 'user'): SAGEConv(-1, self.hidden_dim),
            ('user', 'belongs_to', 'group'): SAGEConv(-1, self.hidden_dim),
            ('group', 'contains', 'user'): SAGEConv(-1, self.hidden_dim),
            ('group', 'part_of', 'organization'): SAGEConv(-1, self.hidden_dim),
            ('organization', 'contains_group', 'group'): SAGEConv(-1, self.hidden_dim),
        })

        return nn.ModuleList([conv1, conv2])

    async def build_graph(self) -> HeteroData:

        graph = HeteroData()

        users_data = await self.fetch_users()
        user_features = []

        if not users_data:
            logger.warning("No users found in database")
            return None

        for i, user in enumerate(users_data):
            self.user_to_idx[user['id']] = i
            self.idx_to_user[i] = user['id']

            features = [
                float(user['org_count']),
                float(user['group_count']),
                float(user['tenure_days']),
                float(user['is_admin_anywhere'])
            ]
            user_features.append(features)

        graph['user'].x = torch.tensor(user_features, dtype=torch.float)

        groups_data = await self.fetch_groups()
        group_features = []

        if not groups_data:
            logger.warning("No groups found in database")
            return None

        for i, group in enumerate(groups_data):
            self.group_to_idx[group['id']] = i
            self.idx_to_group[i] = group['id']

            features = [
                float(group['member_count']),
                float(group['is_default']),
                float(group['age_days'])
            ]
            group_features.append(features)

        graph['group'].x = torch.tensor(group_features, dtype=torch.float)

        orgs_data = await self.fetch_organizations()
        org_features = []

        if not orgs_data:
            logger.warning("No organizations found in database")
            return None

        for i, org in enumerate(orgs_data):
            self.org_to_idx[org['id']] = i
            self.idx_to_org[i] = org['id']

            features = [
                float(org['member_count']),
                float(org['group_count']),
                float(org['age_days'])
            ]
            org_features.append(features)

        graph['organization'].x = torch.tensor(org_features, dtype=torch.float)

        # User-Organization memberships
        user_org_edges = []
        org_user_edges = []
        for membership in await self.fetch_user_org_memberships():
            if membership['user_id'] in self.user_to_idx and membership['org_id'] in self.org_to_idx:
                user_idx = self.user_to_idx[membership['user_id']]
                org_idx = self.org_to_idx[membership['org_id']]
                user_org_edges.append([user_idx, org_idx])
                org_user_edges.append([org_idx, user_idx])

        if user_org_edges:
            graph['user', 'member_of', 'organization'].edge_index = torch.tensor(
                user_org_edges, dtype=torch.long
            ).t()
            graph['organization', 'has_member', 'user'].edge_index = torch.tensor(
                org_user_edges, dtype=torch.long
            ).t()
        else:
            graph['user', 'member_of', 'organization'].edge_index = torch.zeros((2, 0), dtype=torch.long)
            graph['organization', 'has_member', 'user'].edge_index = torch.zeros((2, 0), dtype=torch.long)

        # User-Group memberships
        user_group_edges = []
        group_user_edges = []
        for membership in await self.fetch_user_group_memberships():
            if membership['user_id'] in self.user_to_idx and membership['group_id'] in self.group_to_idx:
                user_idx = self.user_to_idx[membership['user_id']]
                group_idx = self.group_to_idx[membership['group_id']]
                user_group_edges.append([user_idx, group_idx])
                group_user_edges.append([group_idx, user_idx])

        if user_group_edges:
            graph['user', 'belongs_to', 'group'].edge_index = torch.tensor(
                user_group_edges, dtype=torch.long
            ).t()
            graph['group', 'contains', 'user'].edge_index = torch.tensor(
                group_user_edges, dtype=torch.long
            ).t()
        else:
            graph['user', 'belongs_to', 'group'].edge_index = torch.zeros((2, 0), dtype=torch.long)
            graph['group', 'contains', 'user'].edge_index = torch.zeros((2, 0), dtype=torch.long)

        # Group-Organization relationships
        group_org_edges = []
        org_group_edges = []
        for group in groups_data:
            if group['id'] in self.group_to_idx and group['org_id'] in self.org_to_idx:
                group_idx = self.group_to_idx[group['id']]
                org_idx = self.org_to_idx[group['org_id']]
                group_org_edges.append([group_idx, org_idx])
                org_group_edges.append([org_idx, group_idx])

        if group_org_edges:
            graph['group', 'part_of', 'organization'].edge_index = torch.tensor(
                group_org_edges, dtype=torch.long
            ).t()
            graph['organization', 'contains_group', 'group'].edge_index = torch.tensor(
                org_group_edges, dtype=torch.long
            ).t()
        else:
            graph['group', 'part_of', 'organization'].edge_index = torch.zeros((2, 0), dtype=torch.long)
            graph['organization', 'contains_group', 'group'].edge_index = torch.zeros((2, 0), dtype=torch.long)

        return graph

    async def db_fetch(self, query: str, *args) -> List[Dict]:
        if not database_service.pool:
            await database_service.connect()

        async with database_service.pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]

    async def fetch_users(self):
        query = """
        SELECT
            u.id,
            COALESCE(EXTRACT(DAYS FROM NOW() - u."createdAt"), 0) as tenure_days,
            COUNT(DISTINCT om.id) as org_count,
            COUNT(DISTINCT gm.id) as group_count,
            COALESCE(BOOL_OR(om.role = 'ADMIN'), false) as is_admin_anywhere
        FROM "User" u
        LEFT JOIN "OrganizationMembership" om ON u.id = om."userId"
        LEFT JOIN "GroupMembership" gm ON u.id = gm."userId"
        GROUP BY u.id, u."createdAt"
        """
        return await self.db_fetch(query)

    async def fetch_groups(self):
        query = """
        SELECT
            g.id,
            g."organizationId" as org_id,
            g."isDefault" as is_default,
            EXTRACT(DAYS FROM NOW() - g."createdAt") as age_days,
            COUNT(gm.id) as member_count
        FROM "Group" g
        LEFT JOIN "GroupMembership" gm ON g.id = gm."groupId"
        GROUP BY g.id, g."organizationId", g."isDefault", g."createdAt"
        """
        return await self.db_fetch(query)

    async def fetch_organizations(self):
        query = """
        SELECT
            o.id,
            EXTRACT(DAYS FROM NOW() - o."createdAt") as age_days,
            COUNT(DISTINCT om.id) as member_count,
            COUNT(DISTINCT g.id) as group_count
        FROM "Organization" o
        LEFT JOIN "OrganizationMembership" om ON o.id = om."organizationId"
        LEFT JOIN "Group" g ON o.id = g."organizationId"
        GROUP BY o.id, o."createdAt"
        """
        return await self.db_fetch(query)

    async def fetch_user_org_memberships(self):
        query = """
        SELECT "userId" as user_id, "organizationId" as org_id
        FROM "OrganizationMembership"
        """
        return await self.db_fetch(query)

    async def fetch_user_group_memberships(self):
        query = """
        SELECT "userId" as user_id, "groupId" as group_id
        FROM "GroupMembership"
        """
        return await self.db_fetch(query)

    async def train_gnn(self, num_epochs=50):

        positive_examples = await self.get_training_data()

        if not positive_examples:
            logger.warning("No training data found")
            return

        optimizer = torch.optim.Adam(self.model.parameters(), lr=0.01)

        for epoch in range(num_epochs):
            self.model.train()
            total_loss = 0
            valid_examples = 0

            # Build current graph
            graph = await self.build_graph()

            if graph is None:
                logger.warning("Graph building failed - skipping training epoch")
                continue

            if graph['user'].x.size(0) == 0 or graph['group'].x.size(0) == 0 or graph['organization'].x.size(0) == 0:
                logger.warning("Empty graph detected - skipping training epoch")
                continue

            # Forward pass through both layers
            x_dict = {
                'user': graph['user'].x,
                'group': graph['group'].x,
                'organization': graph['organization'].x
            }

            edge_index_dict = {
                ('user', 'member_of', 'organization'): graph['user', 'member_of', 'organization'].edge_index,
                ('organization', 'has_member', 'user'): graph['organization', 'has_member', 'user'].edge_index,
                ('user', 'belongs_to', 'group'): graph['user', 'belongs_to', 'group'].edge_index,
                ('group', 'contains', 'user'): graph['group', 'contains', 'user'].edge_index,
                ('group', 'part_of', 'organization'): graph['group', 'part_of', 'organization'].edge_index,
                ('organization', 'contains_group', 'group'): graph['organization', 'contains_group', 'group'].edge_index,
            }

            # Layer 1
            x_dict = self.model[0](x_dict, edge_index_dict)
            x_dict = {key: torch.relu(x) for key, x in x_dict.items()}

            # Layer 2
            x_dict = self.model[1](x_dict, edge_index_dict)

            # Calculate loss for each training example
            for example in positive_examples:
                user_id = example['userId']
                group_id = example['groupId']
                joined = example['joined']

                if user_id not in self.user_to_idx or group_id not in self.group_to_idx:
                    continue

                user_idx = self.user_to_idx[user_id]
                group_idx = self.group_to_idx[group_id]

                user_emb = x_dict['user'][user_idx]
                group_emb = x_dict['group'][group_idx]

                score = torch.dot(user_emb, group_emb)

                target = torch.tensor(1.0 if joined else 0.0)
                loss = nn.functional.binary_cross_entropy_with_logits(score.unsqueeze(0), target.unsqueeze(0))
                total_loss += loss
                valid_examples += 1

            if valid_examples > 0:
                optimizer.zero_grad()
                total_loss.backward()
                optimizer.step()

                if epoch % 10 == 0:
                    avg_loss = total_loss.item() / valid_examples
                    logger.info(f"Epoch {epoch}: Avg Loss = {avg_loss:.4f}")
            else:
                logger.warning(f"Epoch {epoch}: No valid examples found")

    async def get_training_data(self) -> List[Dict]:

        # recent group joins
        positive_query = """
        SELECT "userId", "groupId", true as joined
        FROM "GroupMembership"
        WHERE "joinedAt" > NOW() - INTERVAL '90 days'
        """

        positives = await self.db_fetch(positive_query)

        # sample users who could join groups but didn't
        negative_query = """
        SELECT u.id as "userId", g.id as "groupId", false as joined
        FROM "User" u
        CROSS JOIN "Group" g
        JOIN "OrganizationMembership" om ON u.id = om."userId" AND g."organizationId" = om."organizationId"
        LEFT JOIN "GroupMembership" gm ON u.id = gm."userId" AND g.id = gm."groupId"
        WHERE gm.id IS NULL  -- User is not in this group
        AND g."isDefault" = false  -- Skip default groups
        ORDER BY RANDOM()
        LIMIT 1000
        """

        negatives = await self.db_fetch(negative_query)

        return positives + negatives

    async def recommend_users_for_group(self, group_id: str, limit: int = 10) -> List[Dict]:

        if group_id not in self.group_to_idx:
            # Rebuild graph to include new groups
            await self.build_graph()

            if group_id not in self.group_to_idx:
                logger.warning(f"Group {group_id} not found")
                return []

        self.model.eval()

        # Build current graph
        graph = await self.build_graph()

        # Forward pass
        with torch.no_grad():
            x_dict = {
                'user': graph['user'].x,
                'group': graph['group'].x,
                'organization': graph['organization'].x
            }

            edge_index_dict = {
                ('user', 'member_of', 'organization'): graph['user', 'member_of', 'organization'].edge_index,
                ('organization', 'has_member', 'user'): graph['organization', 'has_member', 'user'].edge_index,
                ('user', 'belongs_to', 'group'): graph['user', 'belongs_to', 'group'].edge_index,
                ('group', 'contains', 'user'): graph['group', 'contains', 'user'].edge_index,
                ('group', 'part_of', 'organization'): graph['group', 'part_of', 'organization'].edge_index,
                ('organization', 'contains_group', 'group'): graph['organization', 'contains_group', 'group'].edge_index,
            }

            # Forward through model
            x_dict = self.model[0](x_dict, edge_index_dict)
            x_dict = {key: torch.relu(x) for key, x in x_dict.items()}
            x_dict = self.model[1](x_dict, edge_index_dict)

        # Get target group embedding
        group_idx = self.group_to_idx[group_id]
        group_emb = x_dict['group'][group_idx]

        # Calculate scores for all users
        user_embeddings = x_dict['user']
        scores = torch.mm(user_embeddings, group_emb.unsqueeze(1)).squeeze()

        # Get users not already in this group
        current_members = await self.get_current_group_members(group_id)
        current_member_indices = [self.user_to_idx[uid] for uid in current_members if uid in self.user_to_idx]

        # Set current members' scores to -infinity so they don't get recommended
        for idx in current_member_indices:
            scores[idx] = float('-inf')

        # Get top recommendations
        num_users = len(scores)
        top_k = min(limit, num_users)

        if top_k == 0:
            return []

        top_scores, top_indices = torch.topk(scores, top_k)

        # Convert back to user IDs and get user info
        recommendations = []

        for score, user_idx in zip(top_scores, top_indices):
            if score == float('-inf'):
                continue

            user_id = self.idx_to_user[user_idx.item()]
            user_info = await self.get_user_info(user_id)

            if user_info:
                recommendations.append({
                    'userId': user_id,
                    'userName': user_info.get('name', 'Unknown'),
                    'userEmail': user_info.get('email', ''),
                    'score': torch.sigmoid(score).item(),  # Convert to probability
                    'reason': await self.explain_recommendation(user_id, group_id)
                })

        return recommendations

    async def explain_recommendation(self, user_id: str, group_id: str) -> str:

        group_org = await self.get_group_organization(group_id)
        user_orgs = await self.get_user_organizations(user_id)

        if group_org and group_org.get('id') in user_orgs:
            shared_connections = await self.find_shared_group_connections(user_id, group_id)

            if shared_connections:
                return f"Works with {len(shared_connections)} current members in other groups"
            else:
                return f"Member of {group_org.get('name', 'the same')} organization"

        return "Similar profile to current group members"

    async def get_current_group_members(self, group_id: str) -> List[str]:
        query = 'SELECT "userId" FROM "GroupMembership" WHERE "groupId" = $1'
        rows = await self.db_fetch(query, group_id)
        return [row['userId'] for row in rows]

    async def get_user_info(self, user_id: str) -> Dict:

        query = 'SELECT id, name, email FROM "User" WHERE id = $1'
        rows = await self.db_fetch(query, user_id)
        return rows[0] if rows else {}

    async def get_group_organization(self, group_id: str) -> Dict:
        query = '''
        SELECT o.id, o.name
        FROM "Organization" o
        JOIN "Group" g ON o.id = g."organizationId"
        WHERE g.id = $1
        '''
        rows = await self.db_fetch(query, group_id)
        return rows[0] if rows else {}

    async def get_user_organizations(self, user_id: str) -> List[str]:
        query = 'SELECT "organizationId" FROM "OrganizationMembership" WHERE "userId" = $1'
        rows = await self.db_fetch(query, user_id)
        return [row['organizationId'] for row in rows]

    async def find_shared_group_connections(self, user_id: str, group_id: str) -> List[str]:
        query = '''
        WITH user_groups AS (
            SELECT "groupId" FROM "GroupMembership" WHERE "userId" = $1
        ),
        target_group_members AS (
            SELECT "userId" FROM "GroupMembership" WHERE "groupId" = $2
        ),
        shared_connections AS (
            SELECT DISTINCT gm."userId"
            FROM "GroupMembership" gm
            JOIN user_groups ug ON gm."groupId" = ug."groupId"
            JOIN target_group_members tgm ON gm."userId" = tgm."userId"
            WHERE gm."userId" != $1
        )
        SELECT u.name FROM shared_connections sc
        JOIN "User" u ON sc."userId" = u.id
        '''
        rows = await self.db_fetch(query, user_id, group_id)
        return [row['name'] for row in rows]

    def save_model(self, filepath: str = None):
        if filepath is None:
            filepath = self.model_path / "gnn_model.pt"

        checkpoint = {
            'model_state_dict': self.model.state_dict(),
            'user_to_idx': self.user_to_idx,
            'group_to_idx': self.group_to_idx,
            'org_to_idx': self.org_to_idx,
            'idx_to_user': self.idx_to_user,
            'idx_to_group': self.idx_to_group,
            'idx_to_org': self.idx_to_org,
            'hidden_dim': self.hidden_dim
        }

        torch.save(checkpoint, filepath)
        logger.info(f"Model saved to {filepath}")

    def load_model(self, filepath: str = None) -> bool:
        if filepath is None:
            filepath = self.model_path / "simple_gnn_model.pt"

        if not Path(filepath).exists():
            logger.info(f"No saved model found at {filepath}")
            return False

        checkpoint = torch.load(filepath, map_location='cpu')

        self.hidden_dim = checkpoint['hidden_dim']
        self.model = self.build_model()
        self.model.load_state_dict(checkpoint['model_state_dict'])

        self.user_to_idx = checkpoint['user_to_idx']
        self.group_to_idx = checkpoint['group_to_idx']
        self.org_to_idx = checkpoint['org_to_idx']
        self.idx_to_user = checkpoint.get('idx_to_user', {})
        self.idx_to_group = checkpoint.get('idx_to_group', {})
        self.idx_to_org = checkpoint.get('idx_to_org', {})

        logger.info(f"Model loaded from {filepath}")
        return True
