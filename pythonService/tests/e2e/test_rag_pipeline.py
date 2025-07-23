import pytest
import asyncio
from httpx import AsyncClient
from typing import Dict, Any

pytestmark = pytest.mark.asyncio


class TestRAGPipeline:

    @pytest.fixture(scope="class")
    def event_loop(self):
        """Class-scoped event loop to run all tests in same loop"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        yield loop
        loop.close()

    @pytest.mark.e2e
    async def test_rag_query_full_pipeline(
        self,
        test_client: AsyncClient,
        mock_search_data: Dict[str, Any],
    ):
        """Test the complete RAG pipeline from query to answer generation"""
        org_id = mock_search_data["org_id"]
        test_users = mock_search_data["test_users"]
        admin_user = test_users["admin"]

        rag_request = {
            "query": "What are the project management guidelines?",
            "organization_id": org_id,
            "conversation_id": "test-conversation-1",
            "filters": {
                "permissions": {
                    "userId": admin_user["userId"],
                    "userRole": admin_user["userRole"],
                    "userGroupIds": admin_user["userGroupIds"]
                }
            },
            "max_context_chunks": 3
        }

        response = await test_client.post("/api/search/rag-query", json=rag_request)

        assert response.status_code == 200
        rag_response = response.json()

        assert "query" in rag_response
        assert "answer" in rag_response
        assert "sources" in rag_response
        assert "conversation_id" in rag_response
        assert "processing_time" in rag_response

        assert rag_response["query"] == rag_request["query"]
        assert rag_response["conversation_id"] == rag_request["conversation_id"]
        assert isinstance(rag_response["answer"], str)
        assert len(rag_response["answer"]) > 0
        assert isinstance(rag_response["sources"], list)
        assert rag_response["processing_time"] > 0

        if len(rag_response["sources"]) > 0:
            source = rag_response["sources"][0]
            assert "chunk_id" in source
            assert "document_id" in source
            assert "document_title" in source
            assert "content" in source
            assert "relevance_score" in source

            assert len(source["content"]) > 0
            assert isinstance(source["relevance_score"], (int, float))
            assert source["relevance_score"] > 0

    @pytest.mark.e2e
    async def test_rag_query_with_permission_filtering(
        self,
        test_client: AsyncClient,
        mock_search_data: Dict[str, Any]
    ):
        """Test that RAG respects permission filtering"""
        org_id = mock_search_data["org_id"]
        test_users = mock_search_data["test_users"]

        # Test with public user (limited permissions)
        public_user = test_users["public_user"]
        rag_request = {
            "query": "What are the security protocols?",  # Should be admin-only content
            "organization_id": org_id,
            "filters": {
                "permissions": {
                    "userId": public_user["userId"],
                    "userRole": public_user["userRole"],
                    "userGroupIds": public_user["userGroupIds"]
                }
            },
            "max_context_chunks": 5
        }

        response = await test_client.post("/api/search/rag-query", json=rag_request)
        assert response.status_code == 200
        public_response = response.json()

        # Test with admin user (full permissions)
        admin_user = test_users["admin"]
        rag_request["filters"]["permissions"] = {
            "userId": admin_user["userId"],
            "userRole": admin_user["userRole"],
            "userGroupIds": admin_user["userGroupIds"]
        }

        response = await test_client.post("/api/search/rag-query", json=rag_request)
        assert response.status_code == 200
        admin_response = response.json()

        for source in public_response["sources"]:
            source_metadata = source.get("metadata", {})
            access_level = source_metadata.get("accessLevel")
            group_id = source_metadata.get("groupId")
            restricted_to_users = source_metadata.get("restrictedToUsers")

            public_user = test_users["public_user"]

            if access_level:
                can_access = False

                if access_level == "PUBLIC":
                    can_access = True
                if access_level == "GROUP" and group_id:
                    can_access = group_id in public_user["userGroupIds"]
                elif access_level == "RESTRICTED" and restricted_to_users:
                    can_access = public_user["userId"] in restricted_to_users

                assert can_access, f"Public user received content they cannot access: {access_level}"

        for source in admin_response["sources"]:
            source_metadata = source.get("metadata", {})
            access_level = source_metadata.get("accessLevel")

            if access_level:
                valid_access_levels = ["PUBLIC", "GROUP", "MANAGERS", "ADMINS", "RESTRICTED"]
                assert access_level in valid_access_levels, f"Invalid access level found: {access_level}"

            assert "content" in source, "Source missing content field"
            assert len(source["content"]) > 0, "Source has empty content"

    @pytest.mark.e2e
    async def test_rag_query_no_results_scenario(
        self,
        test_client: AsyncClient,
        mock_search_data: Dict[str, Any]
    ):
        """Test RAG behavior when no relevant documents are found"""
        org_id = mock_search_data["org_id"]
        test_users = mock_search_data["test_users"]
        admin_user = test_users["admin"]

        # Query for something that shouldn't exist in the mock data
        rag_request = {
            "query": "What is the quantum physics theory of relativity in space exploration?",
            "organization_id": org_id,
            "filters": {
                "permissions": {
                    "userId": admin_user["userId"],
                    "userRole": admin_user["userRole"],
                    "userGroupIds": admin_user["userGroupIds"]
                }
            },
            "max_context_chunks": 3
        }

        response = await test_client.post("/api/search/rag-query", json=rag_request)
        assert response.status_code == 200
        rag_response = response.json()

        assert "answer" in rag_response
        assert "sources" in rag_response

        answer_lower = rag_response["answer"].lower()
        assert any(phrase in answer_lower for phrase in [
            "couldn't find", "no information", "don't have", "not found"
        ])

        assert len(rag_response["sources"]) == 0

    @pytest.mark.e2e
    async def test_rag_query_with_different_max_context_chunks(
        self,
        test_client: AsyncClient,
        mock_search_data: Dict[str, Any]
    ):
        org_id = mock_search_data["org_id"]
        test_users = mock_search_data["test_users"]
        admin_user = test_users["admin"]

        base_request = {
            "query": "What are the company policies?",
            "organization_id": org_id,
            "filters": {
                "permissions": {
                    "userId": admin_user["userId"],
                    "userRole": admin_user["userRole"],
                    "userGroupIds": admin_user["userGroupIds"]
                }
            }
        }

        for max_chunks in [1, 3, 5]:
            request = {**base_request, "max_context_chunks": max_chunks}

            response = await test_client.post("/api/search/rag-query", json=request)
            assert response.status_code == 200
            rag_response = response.json()

            assert len(rag_response["sources"]) <= max_chunks
            assert len(rag_response["answer"]) > 0

    @pytest.mark.e2e
    async def test_rag_query_error_handling(
        self,
        test_client: AsyncClient,
        mock_search_data: Dict[str, Any]
    ):
        org_id = mock_search_data["org_id"]
        test_users = mock_search_data["test_users"]
        admin_user = test_users["admin"]

        # Test with invalid organization ID
        invalid_request = {
            "query": "Test query",
            "organization_id": "non-existent-org",
            "filters": {
                "permissions": {
                    "userId": admin_user["userId"],
                    "userRole": admin_user["userRole"],
                    "userGroupIds": admin_user["userGroupIds"]
                }
            }
        }

        response = await test_client.post("/api/search/rag-query", json=invalid_request)
        assert response.status_code == 200  # Should return graceful error response
        rag_response = response.json()

        # Should contain error message in answer
        assert "error" in rag_response["answer"].lower() or "couldn't find" in rag_response["answer"].lower()
        assert len(rag_response["sources"]) == 0

        # Test with missing required fields
        incomplete_request = {
            "query": "Test query"
            # Missing organization_id
        }

        response = await test_client.post("/api/search/rag-query", json=incomplete_request)
        assert response.status_code == 422  # Validation error

    @pytest.mark.e2e
    async def test_rag_query_processing_time_reasonable(
        self,
        test_client: AsyncClient,
        mock_search_data: Dict[str, Any]
    ):
        org_id = mock_search_data["org_id"]
        test_users = mock_search_data["test_users"]
        admin_user = test_users["admin"]

        rag_request = {
            "query": "What are the main topics covered in the documents?",
            "organization_id": org_id,
            "filters": {
                "permissions": {
                    "userId": admin_user["userId"],
                    "userRole": admin_user["userRole"],
                    "userGroupIds": admin_user["userGroupIds"]
                }
            },
            "max_context_chunks": 3
        }

        response = await test_client.post("/api/search/rag-query", json=rag_request)
        assert response.status_code == 200
        rag_response = response.json()

        assert rag_response["processing_time"] < 30.0
        assert rag_response["processing_time"] > 0

    @pytest.mark.e2e
    async def test_rag_query_conversation_id_passthrough(
        self,
        test_client: AsyncClient,
        mock_search_data: Dict[str, Any]
    ):
        org_id = mock_search_data["org_id"]
        test_users = mock_search_data["test_users"]
        admin_user = test_users["admin"]

        conversation_id = "test-conversation-12345"
        rag_request = {
            "query": "Test query for conversation tracking",
            "organization_id": org_id,
            "conversation_id": conversation_id,
            "filters": {
                "permissions": {
                    "userId": admin_user["userId"],
                    "userRole": admin_user["userRole"],
                    "userGroupIds": admin_user["userGroupIds"]
                }
            }
        }

        response = await test_client.post("/api/search/rag-query", json=rag_request)
        assert response.status_code == 200
        rag_response = response.json()

        assert rag_response["conversation_id"] == conversation_id

    @pytest.mark.e2e
    async def test_rag_query_source_attribution(
        self,
        test_client: AsyncClient,
        mock_search_data: Dict[str, Any]
    ):
        org_id = mock_search_data["org_id"]
        test_users = mock_search_data["test_users"]
        admin_user = test_users["admin"]

        rag_request = {
            "query": "What information is available about projects?",
            "organization_id": org_id,
            "filters": {
                "permissions": {
                    "userId": admin_user["userId"],
                    "userRole": admin_user["userRole"],
                    "userGroupIds": admin_user["userGroupIds"]
                }
            },
            "max_context_chunks": 3
        }

        response = await test_client.post("/api/search/rag-query", json=rag_request)
        assert response.status_code == 200
        rag_response = response.json()

        for source in rag_response["sources"]:
            assert isinstance(source["chunk_id"], str)
            assert len(source["chunk_id"]) > 0
            assert isinstance(source["document_id"], str)
            assert len(source["document_id"]) > 0
            assert isinstance(source["document_title"], str)
            assert isinstance(source["content"], str)
            assert len(source["content"]) > 0
            assert isinstance(source["relevance_score"], (int, float))
            assert source["relevance_score"] > 0

            assert "page_number" in source

    @pytest.mark.e2e
    async def test_rag_query_with_index_rebuild(
        self,
        test_client: AsyncClient,
        mock_search_data: Dict[str, Any]
    ):
        org_id = mock_search_data["org_id"]
        test_users = mock_search_data["test_users"]
        admin_user = test_users["admin"]

        rag_request = {
            "query": "What are the organizational guidelines?",
            "organization_id": org_id,
            "filters": {
                "permissions": {
                    "userId": admin_user["userId"],
                    "userRole": admin_user["userRole"],
                    "userGroupIds": admin_user["userGroupIds"]
                }
            }
        }

        response1 = await test_client.post("/api/search/rag-query", json=rag_request)
        assert response1.status_code == 200
        first_response = response1.json()

        rebuild_response = await test_client.post(
            "/api/search/rebuild-index",
            json={"organization_id": org_id}
        )
        assert rebuild_response.status_code == 200

        response2 = await test_client.post("/api/search/rag-query", json=rag_request)
        assert response2.status_code == 200
        second_response = response2.json()

        assert len(second_response["answer"]) > 0
        assert isinstance(second_response["sources"], list)

        assert second_response["query"] == first_response["query"]
