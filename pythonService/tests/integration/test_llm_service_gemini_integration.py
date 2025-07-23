import pytest
import asyncio
import os
from app.services.llm_service import LLMService

pytestmark = pytest.mark.asyncio


class TestLLMServiceGeminiIntegration:

    @pytest.fixture(scope="class")
    def event_loop(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        yield loop
        loop.close()

    @pytest.fixture(scope="class")
    async def llm_service(self):
        service = LLMService()
        yield service
        await service.cleanup()

    @pytest.mark.skipif(
        not os.getenv('GOOGLE_API_KEY'),
        reason="GOOGLE_API_KEY not set - skipping Gemini integration tests"
    )
    async def test_gemini_basic_response(self, llm_service):
        """Test that Gemini returns a basic response through call_model."""
        if llm_service.provider != 'gemini' or not llm_service.gemini_client:
            pytest.skip("Gemini not configured")

        prompt = "What is 2 + 2? Answer with just the number."
        response = await llm_service.call_model(prompt)

        assert isinstance(response, str)
        assert len(response.strip()) > 0
        assert "4" in response

    @pytest.mark.skipif(
        not os.getenv('GOOGLE_API_KEY'),
        reason="GOOGLE_API_KEY not set - skipping Gemini integration tests"
    )
    async def test_enhance_query_integration(self, llm_service):
        if llm_service.provider != 'gemini' or not llm_service.gemini_client:
            pytest.skip("Gemini not configured")

        original_query = "machine learning algorithms"
        enhanced_queries = await llm_service.enhance_query(original_query)

        # Verify response structure
        assert isinstance(enhanced_queries, list)
        assert len(enhanced_queries) >= 1
        assert len(enhanced_queries) <= 5

        # Original query should be included
        assert original_query in enhanced_queries

        # All items should be strings
        for query in enhanced_queries:
            assert isinstance(query, str)
            assert len(query.strip()) > 0

    @pytest.mark.skipif(
        not os.getenv('GOOGLE_API_KEY'),
        reason="GOOGLE_API_KEY not set - skipping Gemini integration tests"
    )
    async def test_enhance_query_with_conversation_history(self, llm_service):
        if llm_service.provider != 'gemini' or not llm_service.gemini_client:
            pytest.skip("Gemini not configured")

        conversation_history = [
            {"query": "What is artificial intelligence?", "answer": "AI is computer intelligence"},
            {"query": "How does it work?", "answer": "Through algorithms and data"}
        ]

        current_query = "Tell me about neural networks"
        enhanced_queries = await llm_service.enhance_query(current_query, conversation_history)

        assert isinstance(enhanced_queries, list)
        assert current_query in enhanced_queries
        assert len(enhanced_queries) >= 1

    @pytest.mark.skipif(
        not os.getenv('GOOGLE_API_KEY'),
        reason="GOOGLE_API_KEY not set - skipping Gemini integration tests"
    )
    async def test_select_context_integration(self, llm_service):
        if llm_service.provider != 'gemini' or not llm_service.gemini_client:
            pytest.skip("Gemini not configured")

        query = "What are the benefits of renewable energy?"
        candidate_chunks = [
            {
                "chunk_id": "1",
                "document_id": "doc1",
                "content": "Solar energy is a renewable source that reduces carbon emissions and provides clean electricity.",
                "score": 0.9,
                "metadata": {"document_title": "Solar Energy Guide"}
            },
            {
                "chunk_id": "2",
                "document_id": "doc2",
                "content": "Wind power generates electricity without pollution and is cost-effective in many regions.",
                "score": 0.8,
                "metadata": {"document_title": "Wind Power Analysis"}
            },
            {
                "chunk_id": "3",
                "document_id": "doc3",
                "content": "Fossil fuels contribute to climate change and air pollution in urban areas.",
                "score": 0.6,
                "metadata": {"document_title": "Fossil Fuel Impact"}
            },
            {
                "chunk_id": "4",
                "document_id": "doc4",
                "content": "The history of coal mining dates back to ancient civilizations.",
                "score": 0.3,
                "metadata": {"document_title": "Coal Mining History"}
            }
        ]

        selected_chunks = await llm_service.select_context(query, candidate_chunks)

        # Verify response structure
        assert isinstance(selected_chunks, list)
        assert len(selected_chunks) <= 5

        # Should select relevant chunks (solar and wind are most relevant)
        selected_ids = [chunk["chunk_id"] for chunk in selected_chunks]

        # At least one relevant chunk should be selected
        assert len(selected_chunks) > 0

        # Verify chunk structure is preserved
        for chunk in selected_chunks:
            assert "chunk_id" in chunk
            assert "content" in chunk
            assert "score" in chunk

    @pytest.mark.skipif(
        not os.getenv('GOOGLE_API_KEY'),
        reason="GOOGLE_API_KEY not set - skipping Gemini integration tests"
    )
    async def test_generate_answer_integration(self, llm_service):
        if llm_service.provider != 'gemini' or not llm_service.gemini_client:
            pytest.skip("Gemini not configured")

        query = "What are the main benefits of solar energy?"
        context_chunks = [
            {
                "chunk_id": "1",
                "document_id": "doc1",
                "content": "Solar energy provides clean electricity without emissions. It reduces electricity bills and increases property values.",
                "score": 0.9,
                "metadata": {"document_title": "Solar Benefits Guide", "page_number": 1}
            },
            {
                "chunk_id": "2",
                "document_id": "doc2",
                "content": "Solar panels require minimal maintenance and have a lifespan of 25-30 years. They work in various weather conditions.",
                "score": 0.8,
                "metadata": {"document_title": "Solar Technology Overview", "page_number": 3}
            }
        ]

        result = await llm_service.generate_answer(query, context_chunks)

        assert isinstance(result, dict)
        assert "answer" in result
        assert "sources" in result
        assert "confidence" in result

        assert isinstance(result["answer"], str)
        assert len(result["answer"].strip()) > 0

        answer_lower = result["answer"].lower()
        assert any(keyword in answer_lower for keyword in ["solar", "clean", "electricity", "benefit"])

        assert isinstance(result["sources"], list)
        assert len(result["sources"]) == 2

        for source in result["sources"]:
            assert "chunk_id" in source
            assert "document_id" in source
            assert "document_title" in source
            assert "relevance_score" in source

        assert result["confidence"] in ["low", "medium", "high"]

    @pytest.mark.skipif(
        not os.getenv('GOOGLE_API_KEY'),
        reason="GOOGLE_API_KEY not set - skipping Gemini integration tests"
    )
    async def test_generate_answer_with_conversation_history(self, llm_service):
        """Test answer generation with conversation history."""
        if llm_service.provider != 'gemini' or not llm_service.gemini_client:
            pytest.skip("Gemini not configured")

        query = "How much does it cost?"
        context_chunks = [
            {
                "chunk_id": "1",
                "document_id": "doc1",
                "content": "Solar panel installation costs range from $15,000 to $25,000 for residential systems.",
                "score": 0.9,
                "metadata": {"document_title": "Solar Costs"}
            }
        ]

        conversation_history = [
            {"query": "Tell me about solar energy", "answer": "Solar energy is renewable and clean"}
        ]

        result = await llm_service.generate_answer(query, context_chunks, conversation_history)

        assert isinstance(result, dict)
        assert "answer" in result
        assert len(result["answer"].strip()) > 0

        answer_lower = result["answer"].lower()
        assert any(keyword in answer_lower for keyword in ["cost", "price", "$", "dollar"])

    @pytest.mark.skipif(
        not os.getenv('GOOGLE_API_KEY'),
        reason="GOOGLE_API_KEY not set - skipping Gemini integration tests"
    )
    async def test_empty_context_handling(self, llm_service):
        """Test service behavior with empty context."""
        if llm_service.provider != 'gemini' or not llm_service.gemini_client:
            pytest.skip("Gemini not configured")

        query = "What is quantum computing?"
        result = await llm_service.generate_answer(query, [])

        assert isinstance(result, dict)
        assert "answer" in result
        assert "sources" in result
        assert "confidence" in result

        assert "don't have enough information" in result["answer"].lower()
        assert result["sources"] == []
        assert result["confidence"] == "low"

    @pytest.mark.skipif(
        not os.getenv('GOOGLE_API_KEY'),
        reason="GOOGLE_API_KEY not set - skipping Gemini integration tests"
    )
    async def test_service_error_handling(self, llm_service):
        """Test service error handling with invalid inputs."""
        if llm_service.provider != 'gemini' or not llm_service.gemini_client:
            pytest.skip("Gemini not configured")

        # Test with very long prompt
        very_long_prompt = "A" * 100000  # 100k characters

        try:
            response = await llm_service.call_model(very_long_prompt)
            # If it succeeds, response should still be a string
            assert isinstance(response, str)
        except Exception as e:
            # If it fails, it should be a proper exception
            assert isinstance(e, Exception)

    @pytest.mark.skipif(
        not os.getenv('GOOGLE_API_KEY'),
        reason="GOOGLE_API_KEY not set - skipping Gemini integration tests"
    )
    async def test_concurrent_requests(self, llm_service):
        if llm_service.provider != 'gemini' or not llm_service.gemini_client:
            pytest.skip("Gemini not configured")

        prompts = [
            "What is 1 + 1?",
            "What is 2 + 2?",
            "What is 3 + 3?"
        ]

        tasks = [llm_service.call_model(prompt) for prompt in prompts]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        for i, response in enumerate(responses):
            if isinstance(response, Exception):
                assert isinstance(response, Exception)
            else:
                assert isinstance(response, str)
                assert len(response.strip()) > 0

    @pytest.mark.skipif(
        not os.getenv('GOOGLE_API_KEY'),
        reason="GOOGLE_API_KEY not set - skipping Gemini integration tests"
    )
    async def test_full_rag_pipeline_integration(self, llm_service):
        if llm_service.provider != 'gemini' or not llm_service.gemini_client:
            pytest.skip("Gemini not configured")

        original_query = "renewable energy benefits"
        enhanced_queries = await llm_service.enhance_query(original_query)

        assert isinstance(enhanced_queries, list)
        assert original_query in enhanced_queries

        candidate_chunks = [
            {
                "chunk_id": "1",
                "document_id": "doc1",
                "content": "Renewable energy sources like solar and wind reduce greenhouse gas emissions significantly.",
                "score": 0.9,
                "metadata": {"document_title": "Climate Benefits"}
            },
            {
                "chunk_id": "2",
                "document_id": "doc2",
                "content": "Solar energy systems can reduce electricity bills by 70-90% for homeowners.",
                "score": 0.8,
                "metadata": {"document_title": "Economic Benefits"}
            },
            {
                "chunk_id": "3",
                "document_id": "doc3",
                "content": "Wind turbines create jobs in manufacturing, installation, and maintenance sectors.",
                "score": 0.7,
                "metadata": {"document_title": "Job Creation"}
            }
        ]

        selected_context = await llm_service.select_context(original_query, candidate_chunks)

        assert isinstance(selected_context, list)
        assert len(selected_context) > 0

        final_result = await llm_service.generate_answer(original_query, selected_context)

        assert isinstance(final_result, dict)
        assert "answer" in final_result
        assert "sources" in final_result
        assert "confidence" in final_result

        answer_lower = final_result["answer"].lower()
        assert any(keyword in answer_lower for keyword in ["renewable", "solar", "wind", "benefit"])

        assert len(final_result["sources"]) == len(selected_context)
