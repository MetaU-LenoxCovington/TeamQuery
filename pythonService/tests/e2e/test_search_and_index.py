import pytest
from httpx import AsyncClient
from typing import Dict, Any, List

from app.services.search_index_builder_service import search_index_builder

pytestmark = pytest.mark.asyncio


@pytest.mark.e2e
async def test_search_permission_filtering(
    test_client: AsyncClient,
    mock_search_data: Dict[str, Any]
):
    org_id = mock_search_data["org_id"]
    test_users = mock_search_data["test_users"]

    # Test 1: Search as a Group A member: should see PUBLIC and GROUP_A content
    group_a_user = test_users["group_a_member"]
    response = await test_client.post(
        "/api/search/search",
        json={
            "query": "project",  # Should match Group A content about "Project Alpha"
            "organization_id": org_id,
            "filters": {
                "permissions": {
                    "userId": group_a_user["userId"],
                    "userRole": group_a_user["userRole"],
                    "userGroupIds": group_a_user["userGroupIds"]
                }
            }
        }
    )
    assert response.status_code == 200
    results_group_a = response.json()["results"]

    # Should find results. At least the Group A project content
    assert len(results_group_a) > 0

    # Check access levels in results
    access_levels = {res["metadata"]["accessLevel"] for res in results_group_a}
    assert "PUBLIC" in access_levels or "GROUP" in access_levels
    # Should NOT see ADMINS, MANAGERS, or RESTRICTED content
    assert "ADMINS" not in access_levels
    assert "MANAGERS" not in access_levels
    assert "RESTRICTED" not in access_levels

    # Test 2: Search as public user (no groups) should only see PUBLIC content
    public_user = test_users["public_user"]
    response = await test_client.post(
        "/api/search/search",
        json={
            "query": "company",  # Should match public content about "company policies"
            "organization_id": org_id,
            "filters": {
                "permissions": {
                    "userId": public_user["userId"],
                    "userRole": public_user["userRole"],
                    "userGroupIds": public_user["userGroupIds"]
                }
            }
        }
    )
    assert response.status_code == 200
    results_public = response.json()["results"]

    # Should find public results
    assert len(results_public) > 0

    # Should only see PUBLIC content
    access_levels_public = {res["metadata"]["accessLevel"] for res in results_public}
    assert access_levels_public == {"PUBLIC"}

    # Test 3: Search as admin.Should see everything except user-restricted content
    admin_user = test_users["admin"]
    response = await test_client.post(
        "/api/search/search",
        json={
            "query": "document",
            "organization_id": org_id,
            "filters": {
                "permissions": {
                    "userId": admin_user["userId"],
                    "userRole": admin_user["userRole"],
                    "userGroupIds": admin_user["userGroupIds"]
                }
            }
        }
    )
    assert response.status_code == 200
    results_admin = response.json()["results"]

    # Admin should see more results than public user
    assert len(results_admin) >= len(results_public)

    # Admin should see PUBLIC, GROUP, MANAGERS, ADMINS but not user-RESTRICTED
    access_levels_admin = {res["metadata"]["accessLevel"] for res in results_admin}
    expected_admin_levels = {"PUBLIC", "GROUP", "MANAGERS", "ADMINS"}
    assert expected_admin_levels.issubset(access_levels_admin)


@pytest.mark.e2e
async def test_index_build_and_destroy(
    test_client: AsyncClient,
    mock_search_data: Dict[str, Any]
):
    org_id = mock_search_data["org_id"]

    # 1. Verify index is already in memory from the fixture
    assert search_index_builder.has_indexes(org_id)

    # 2. Get index status
    response = await test_client.get(f"/api/search/index-status/{org_id}")
    assert response.status_code == 200
    status = response.json()
    assert status["has_indexes"] is True
    assert status["total_nodes"] > 0

    # 3. Destroy the index (from memory only)
    response = await test_client.delete(f"/api/search/index/{org_id}?persist=false")
    assert response.status_code == 200
    assert not search_index_builder.has_indexes(org_id)

    # 4. Verify index is gone
    response = await test_client.get(f"/api/search/index-status/{org_id}")
    assert response.status_code == 200
    status = response.json()
    assert status["has_indexes"] is False

    # 5. Rebuild the index from the database
    response = await test_client.post("/api/search/rebuild-index", json={"organization_id": org_id})
    assert response.status_code == 200
    assert search_index_builder.has_indexes(org_id)

    # 6. Verify search still works after rebuild
    response = await test_client.post(
        "/api/search/search",
        json={
            "query": "company",
            "organization_id": org_id,
            "filters": {
                "permissions": {
                    "userId": "test-user-public",
                    "userRole": "MEMBER",
                    "userGroupIds": []
                }
            }
        }
    )
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) > 0


@pytest.mark.e2e
async def test_search_with_different_queries(
    test_client: AsyncClient,
    mock_search_data: Dict[str, Any]
):
    org_id = mock_search_data["org_id"]
    test_users = mock_search_data["test_users"]
    admin_user = test_users["admin"]

    test_queries = [
        ("project management", "Should find project-related content"),
        ("security protocols", "Should find admin/security content"),
        ("marketing strategy", "Should find Group B marketing content"),
        ("company policies", "Should find public policy content"),
        ("performance reviews", "Should find manager-level HR content")
    ]

    for query, description in test_queries:
        response = await test_client.post(
            "/api/search/search",
            json={
                "query": query,
                "organization_id": org_id,
                "filters": {
                    "permissions": {
                        "userId": admin_user["userId"],
                        "userRole": admin_user["userRole"],
                        "userGroupIds": admin_user["userGroupIds"]
                    }
                }
            }
        )
        assert response.status_code == 200, f"Failed for query: {query}"
        results = response.json()["results"]

        # Should get some results for each query (admin can see most content)
        assert len(results) > 0, f"No results for query: {query} - {description}"

        for result in results:
            assert "chunk_id" in result
            assert "content" in result
            assert "metadata" in result
            assert "score" in result
            assert result["score"] > 0
