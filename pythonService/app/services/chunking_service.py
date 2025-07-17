import logging
import re
from typing import List

from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class ChunkingService:

    def __init__(self):
        self.split_pattern = "\n"
        self.chunking_prompt = self._get_chunking_prompt()

    def _get_chunking_prompt(self) -> str:
        return """
You are an assistant specialized in splitting text into semantically consistent sections.

<instructions>
    <instruction>The text has been divided into chunks, each marked with <|start_chunk_X|> and <|end_chunk_X|> tags, where X is the chunk number</instruction>
    <instruction>Identify points where splits should occur, such that consecutive chunks of similar themes stay together</instruction>
    <instruction>Each chunk must be between 200 and 1000 words</instruction>
    <instruction>If chunks 1 and 2 belong together but chunk 3 starts a new topic, suggest a split after chunk 2</instruction>
    <instruction>The chunks must be listed in ascending order</instruction>
    <instruction>Provide your response in the form: 'split_after: 3, 5'</instruction>
</instructions>

This is the document text:
<document>
{document_text}
</document>

Respond only with the IDs of the chunks where you believe a split should occur.
YOU MUST RESPOND WITH AT LEAST ONE SPLIT
""".strip()

    def prepare_chunked_text(self, document_text: str) -> str:
        """
        Args:
            document_text: Raw document text

        Returns:
            Text with chunk markers
        """
        chunks = document_text.split(self.split_pattern)

        chunked_text = ""
        for i, chunk in enumerate(chunks):
            if chunk.startswith("#"):
                chunk = f"#{chunk}"
            chunked_text += f"<|start_chunk_{i}>\n{chunk}<|end_chunk_{i}|>"

        return chunked_text

    def get_llm_chunking_suggestions(self, chunked_text: str) -> str:
        """

        Args:
            chunked_text: Text with chunk markers

        Returns:
            LLM response with split suggestions
        """
        prompt = self.chunking_prompt.format(document_text=chunked_text)
        return llm_service.call_model_sync(prompt)

    def split_text_by_llm_suggestions(
        self, chunked_text: str, llm_response: str
    ) -> List[str]:
        """

        Args:
            chunked_text: Text with chunk markers
            llm_response: LLM response with split suggestions

        Returns:
            List of text sections
        """
        split_after = []

        if "split_after:" in llm_response:
            split_points = llm_response.split("split_after:")[1].strip()
            try:
                split_after = [
                    int(x.strip()) for x in split_points.split(",") if x.strip()
                ]
            except ValueError as e:
                logger.warning(f"Failed to parse split points from LLM response: {e}")

        logger.info(f"Split after chunks: {split_after}")

        # Return whole text as one chunk if no splits were suggested
        if not split_after:
            logger.info("No splits suggested, returning whole text as one chunk")
            return [chunked_text]

        # Extract chunks using regex
        chunk_pattern = r"<\|start_chunk_(\d+)\|?>(.*?)<\|end_chunk_\1\|>"
        chunks = re.findall(chunk_pattern, chunked_text, re.DOTALL)

        if not chunks:
            logger.warning("No chunks found in text, returning original")
            return [chunked_text]

        logger.info(f"Found {len(chunks)} chunks")

        sections = []
        current_section = []

        for chunk_id, chunk_text in chunks:
            current_section.append(chunk_text)
            if int(chunk_id) in split_after:
                sections.append("".join(current_section).strip())
                current_section = []

        # Add the last section if it's not empty
        if current_section:
            sections.append("".join(current_section).strip())

        logger.info(f"Created {len(sections)} sections")
        return sections

    def chunk_document(self, document_text: str) -> List[str]:
        """

        Args:
            document_text: Raw document text

        Returns:
            List of text chunks
        """
        try:
            logger.info(
                f"Starting document chunking for text of length {len(document_text)}"
            )

            # set a section at each new line
            chunked_text = self.prepare_chunked_text(document_text)

            # Get LLM suggestions on which sections to turn into chunks
            llm_response = self.get_llm_chunking_suggestions(chunked_text)
            logger.info(f"LLM chunking response: {llm_response}")

            chunks = self.split_text_by_llm_suggestions(chunked_text, llm_response)

            logger.info(f"Successfully chunked document into {len(chunks)} chunks")
            return chunks

        except Exception as e:
            logger.error(f"Error chunking document: {e}")
            return [document_text]


# Singleton instance
chunking_service = ChunkingService()
