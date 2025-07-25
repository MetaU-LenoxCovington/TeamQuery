import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta

from app.services.heuristic_recommendation_service import HeuristicRecommendationService

pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_service():
    return HeuristicRecommendationService()


@pytest.fixture
def mock_user_groups():
    return [
        {
            "id": "group-1",
            "name": "Engineering",
            "joined_at": datetime.now() - timedelta(days=30),
            "can_upload": True,
            "can_delete": False
        }
    ]


@pytest.fixture
def mock_all_groups():
    return [
        {"id": "group-1", "name": "Engineering", "description": "Dev team"},
        {"id": "group-2", "name": "Product", "description": "Product team"},
        {"id": "group-3", "name": "Marketing", "description": "Marketing team"}
    ]


@pytest.fixture
def mock_buddies():
    return {
        "user-buddy-1": {
            "score": 0.8,
            "name": "John Doe",
            "groups": ["group-2"],
            "shared_group_count": 1,
            "avg_join_time_delta_days": 5
        }
    }


@pytest.fixture
def mock_denials():
    return [
        {
            "group_id": "group-2",
            "document_id": "doc-1",
            "search_query": "product roadmap",
            "denial_reason": "not_in_group",
            "denial_count": 2,
            "last_denial": datetime.now()
        },
        {
            "group_id": "group-3",
            "document_id": "doc-2",
            "search_query": "marketing strategy",
            "denial_reason": "not_in_group",
            "denial_count": 1,
            "last_denial": datetime.now()
        }
    ]


class TestHeuristicRecommendationServiceMock:

    @patch('app.services.heuristic_recommendation_service.database_service')
    async def test_get_recommendations_basic(self, mock_db, mock_service, mock_user_groups,
                                           mock_all_groups, mock_buddies, mock_denials):

        # Mock database calls
        mock_service._get_user_groups = AsyncMock(return_value=mock_user_groups)
        mock_service._get_all_groups = AsyncMock(return_value=mock_all_groups)
        mock_service._find_group_buddies = AsyncMock(return_value=mock_buddies)
        mock_service._get_user_access_denials = AsyncMock(return_value=mock_denials)
        mock_service._calculate_friend_count_score = AsyncMock(return_value=0.3)

        recommendations = await mock_service.get_group_recommendations_for_user(
            user_id="test-user",
            organization_id="test-org",
            top_k=3
        )

        # Should get recommendations for groups user is not in
        assert len(recommendations) == 2

        rec = recommendations[0]
        assert "group_id" in rec
        assert "group_name" in rec
        assert "score" in rec
        assert "reason" in rec
        assert "details" in rec

    @patch('app.services.heuristic_recommendation_service.database_service')
    async def test_denial_resolution_scoring(self, mock_db, mock_service, mock_user_groups,
                                           mock_all_groups, mock_denials):

        mock_service._get_user_groups = AsyncMock(return_value=mock_user_groups)
        mock_service._get_all_groups = AsyncMock(return_value=mock_all_groups)
        mock_service._find_group_buddies = AsyncMock(return_value={})
        mock_service._get_user_access_denials = AsyncMock(return_value=mock_denials)
        mock_service._calculate_friend_count_score = AsyncMock(return_value=0.0)

        recommendations = await mock_service.get_group_recommendations_for_user(
            user_id="test-user",
            organization_id="test-org",
            top_k=3
        )

        group_scores = {rec["group_id"]: rec["score"] for rec in recommendations}
        assert group_scores["group-2"] > group_scores["group-3"]

    async def test_frustration_score_calculation(self, mock_service):

        denials_repeated = [
            {"denial_count": 3, "search_query": "same query"},
            {"denial_count": 2, "search_query": "same query"}
        ]
        frustration_high = mock_service._calculate_frustration_score(denials_repeated)

        denials_unique = [
            {"denial_count": 1, "search_query": "query 1"},
            {"denial_count": 1, "search_query": "query 2"}
        ]
        frustration_low = mock_service._calculate_frustration_score(denials_unique)

        assert frustration_high > frustration_low

    async def test_empty_denials_returns_no_recommendations(self, mock_service, mock_user_groups, mock_all_groups):

        mock_service._get_user_groups = AsyncMock(return_value=mock_user_groups)
        mock_service._get_all_groups = AsyncMock(return_value=mock_all_groups)
        mock_service._find_group_buddies = AsyncMock(return_value={})
        mock_service._get_user_access_denials = AsyncMock(return_value=[])
        mock_service._calculate_friend_count_score = AsyncMock(return_value=0.0)

        recommendations = await mock_service.get_group_recommendations_for_user(
            user_id="test-user",
            organization_id="test-org",
            top_k=3
        )

        assert len(recommendations) == 0

    async def test_recommendation_reason_generation(self, mock_service):
        """Test that recommendation reasons are generated correctly"""

        recommendation = {
            "components": {
                "buddy_score": 0.1,
                "denial_resolution_score": 0.3,  # Above threshold
                "friend_count_score": 0.1,
                "frustration_reduction": 0.1
            },
            "buddies_in_group": [],
            "denials_resolved": 3
        }

        reason = mock_service._generate_recommendation_reason(recommendation)
        assert "access" in reason.lower() or "document" in reason.lower()

    async def test_top_k_limiting(self, mock_service, mock_user_groups, mock_all_groups, mock_denials):

        mock_service._get_user_groups = AsyncMock(return_value=mock_user_groups)
        mock_service._get_all_groups = AsyncMock(return_value=mock_all_groups)
        mock_service._find_group_buddies = AsyncMock(return_value={})
        mock_service._get_user_access_denials = AsyncMock(return_value=mock_denials)
        mock_service._calculate_friend_count_score = AsyncMock(return_value=0.0)

        recommendations = await mock_service.get_group_recommendations_for_user(
            user_id="test-user",
            organization_id="test-org",
            top_k=1
        )

        assert len(recommendations) <= 1

    async def test_score_components_present(self, mock_service, mock_user_groups,
                                          mock_all_groups, mock_buddies, mock_denials):

        mock_service._get_user_groups = AsyncMock(return_value=mock_user_groups)
        mock_service._get_all_groups = AsyncMock(return_value=mock_all_groups)
        mock_service._find_group_buddies = AsyncMock(return_value=mock_buddies)
        mock_service._get_user_access_denials = AsyncMock(return_value=mock_denials)
        mock_service._calculate_friend_count_score = AsyncMock(return_value=0.2)

        recommendations = await mock_service.get_group_recommendations_for_user(
            user_id="test-user",
            organization_id="test-org",
            top_k=3
        )

        if recommendations:
            score_breakdown = recommendations[0]["details"]["score_breakdown"]
            expected_components = ["buddy_score", "denial_resolution_score",
                                 "friend_count_score", "frustration_reduction"]

            for component in expected_components:
                assert component in score_breakdown
                assert score_breakdown[component] >= 0
