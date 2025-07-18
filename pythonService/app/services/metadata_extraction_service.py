import logging
import json
from typing import Dict, Any, List, Optional
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class MetadataExtractionService:
    """Service for extracting structured metadata from document chunks using LLM"""

    def __init__(self):
        self.extraction_prompt = self._get_extraction_prompt()
        self.batch_extraction_prompt = self._get_batch_extraction_prompt()

    def _get_extraction_prompt(self) -> str:
        """Get the single chunk metadata extraction prompt"""
        return """
You are a metadata extraction specialist. Extract structured metadata from the given document chunk.

<instructions>
    <instruction>Extract 3-5 relevant keywords that capture the main concepts</instruction>
    <instruction>Identify 1-3 high-level topics or themes</instruction>
    <instruction>Extract any named entities (people, organizations, locations, products)</instruction>
    <instruction>Determine the document type (e.g., "technical documentation", "research paper", "business report", "legal document", "email", "presentation", "article", "manual")</instruction>
    <instruction>Return ONLY valid JSON without any markdown formatting or explanation</instruction>
    <instruction>Be concise - keywords should be 1-3 words, topics should be brief phrases</instruction>
</instructions>

Here is the document chunk to analyze:
<chunk>
{chunk}
</chunk>

Return metadata in this exact JSON format:
{{
    "keywords": ["keyword1", "keyword2", ...],
    "topics": ["topic1", "topic2", ...],
    "entities": ["entity1", "entity2", ...],
    "document_type": "type"
}}
""".strip()

    def _get_batch_extraction_prompt(self) -> str:
        """Get the prompt for extracting metadata from the full document"""
        return """
You are analyzing a complete document to extract high-level metadata.

<instructions>
    <instruction>Extract 5-10 keywords that represent the main concepts throughout the document</instruction>
    <instruction>Identify 2-5 major topics or themes covered</instruction>
    <instruction>Extract important named entities mentioned multiple times</instruction>
    <instruction>Determine the overall document type</instruction>
    <instruction>Return ONLY valid JSON</instruction>
</instructions>

Document excerpt:
<document>
{document_excerpt}
</document>

Return metadata in this exact JSON format:
{{
    "keywords": ["keyword1", "keyword2", ...],
    "topics": ["topic1", "topic2", ...],
    "entities": ["entity1", "entity2", ...],
    "document_type": "type"
}}
""".strip()

    async def extract_metadata(self, chunk: str, context: str = "") -> Dict[str, Any]:
        """

        Args:
            chunk: The chunk text to analyze
            context: Optional context from the chunk

        Returns:
            Dictionary containing keywords, topics, entities, and document_type
        """
        try:
            text_to_analyze = f"{context}\n{chunk}" if context else chunk

            # keep it under 1000ish tokens
            max_chars = 4000
            if len(text_to_analyze) > max_chars:
                text_to_analyze = text_to_analyze[:max_chars] + "..."

            prompt = self.extraction_prompt.format(chunk=text_to_analyze)
            response = await llm_service.call_model(prompt)

            metadata = self._parse_json_response(response)
            return metadata

        except Exception as e:
            logger.error(f"Error extracting metadata from chunk: {e}")
            return self._get_default_metadata()

    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """Parse and validate JSON response from LLM"""
        try:
            cleaned = response.strip()

            if "```json" in cleaned:
                start = cleaned.find("```json") + 7
                end = cleaned.find("```", start)
                if end > start:
                    cleaned = cleaned[start:end].strip()
            elif "```" in cleaned:
                start = cleaned.find("```") + 3
                end = cleaned.find("```", start)
                if end > start:
                    cleaned = cleaned[start:end].strip()

            metadata = json.loads(cleaned)

            return self._validate_metadata(metadata)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse metadata JSON: {response[:200]}... Error: {e}")
            return self._get_default_metadata()

    def _validate_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        validated = {}

        validated["keywords"] = metadata.get("keywords", [])
        validated["topics"] = metadata.get("topics", [])
        validated["entities"] = metadata.get("entities", [])
        validated["document_type"] = metadata.get("document_type", "unknown")

        if not isinstance(validated["keywords"], list):
            validated["keywords"] = []
        if not isinstance(validated["topics"], list):
            validated["topics"] = []
        if not isinstance(validated["entities"], list):
            validated["entities"] = []
        if not isinstance(validated["document_type"], str):
            validated["document_type"] = "unknown"

        validated["keywords"] = [str(k).strip() for k in validated["keywords"] if k][:10]
        validated["topics"] = [str(t).strip() for t in validated["topics"] if t][:5]
        validated["entities"] = [str(e).strip() for e in validated["entities"] if e][:20]

        validated["document_type"] = validated["document_type"].lower().strip()

        return validated

    def _get_default_metadata(self) -> Dict[str, Any]:
        return {
            "keywords": [],
            "topics": [],
            "entities": [],
            "document_type": "unknown"
        }

metadata_extraction_service = MetadataExtractionService()
