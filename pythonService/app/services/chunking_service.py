import logging
import re
from typing import List, Tuple

import nltk

from app.services.llm_service import llm_service
from nltk.tokenize import sent_tokenize

logger = logging.getLogger(__name__)

try:
    nltk.data.find("tokenizers/punkt_tab")
except LookupError:
    nltk.download("punkt_tab")


class ChunkingService:

    def __init__(self):
        self.chunking_prompt = self._get_chunking_prompt()

        self.COMPLEXITY_THRESHOLDS = {"high": 0.7, "medium": 0.4, "low": 0.0}

        # Target chunk sizes based on complexity
        self.SIZE_RANGES = {
            "high_complexity": 300,
            "medium_complexity": 500,
            "low_complexity": 700,
        }

    def _get_chunking_prompt(self) -> str:
        return """
You are an assistant specialized in splitting text into semantically consistent sections.

<instructions>
    <instruction>The text has been divided into chunks, each marked with <|start_chunk_X|> and <|end_chunk_X|> tags, where X is the chunk number</instruction>
    <instruction>Identify points where splits should occur, such that consecutive chunks of similar themes stay together</instruction>
    <instruction>Each chunk must be between 200 and 1000 words</instruction>
    <instruction>If chunks 1 and 2 belong together but chunk 3 starts a new topic, suggest a split after chunk 2</instruction>
    <instruction>The chunks must be listed in ascending order</instruction>
    <instruction>Respond ONLY with the format: split_after: X, Y, Z (where X, Y, Z are chunk numbers)</instruction>
    <instruction>If no splits are needed, respond with: split_after: none</instruction>
    <instruction>Do NOT include any explanatory text, reasoning, or additional commentary</instruction>
</instructions>

This is the document text:
<document>
{document_text}
</document>

Respond ONLY with the split_after format. No other text.
""".strip()

    def calculate_text_complexity(self, text: str) -> float:

        if not text.strip():
            return 0.0

        try:
            # Split into words and sentences
            words = re.findall(r"\b\w+\b", text.lower())
            sentences = sent_tokenize(text)

            if not words or not sentences:
                return 0.0

            # Lexical density (unique words / total words)
            unique_words = set(words)
            lexical_density = len(unique_words) / len(words)

            # Average sentence length
            avg_sentence_length = len(words) / len(sentences)
            # assume 20+ words per sentence is complex
            sentence_complexity = min(1.0, avg_sentence_length / 20.0)

            # Punctuation complexity (semicolons, colons, parentheses)
            complex_punct = len(re.findall(r"[;:(){}[\]]", text))
            punct_density = complex_punct / len(words) if words else 0
            punct_complexity = min(1.0, punct_density * 100)  # Scale up

            # Combine factors (weighted average)
            complexity = (
                lexical_density * 0.4
                + sentence_complexity * 0.4
                + punct_complexity * 0.2
            )

            return min(1.0, complexity)

        except Exception as e:
            logger.warning(f"Error calculating text complexity: {e}")
            return 0.5  # Default to medium complexity

    def get_target_chunk_size(self, complexity_score: float) -> int:
        if complexity_score >= self.COMPLEXITY_THRESHOLDS["high"]:
            return self.SIZE_RANGES["high_complexity"]
        elif complexity_score >= self.COMPLEXITY_THRESHOLDS["medium"]:
            return self.SIZE_RANGES["medium_complexity"]
        else:
            return self.SIZE_RANGES["low_complexity"]

    def split_into_sentences(self, text: str) -> List[str]:
        try:
            sentences = sent_tokenize(text)
            return [s.strip() for s in sentences if s.strip()]
        except Exception as e:
            logger.warning(f"Error splitting into sentences: {e}")
            return [s.strip() for s in text.split(".") if s.strip()]

    def count_words(self, text: str) -> int:
        return len(re.findall(r"\b\w+\b", text))

    def prepare_chunked_text(self, document_text: str) -> str:
        try:
            # Calculate document complexity to determine target chunk size
            complexity_score = self.calculate_text_complexity(document_text)
            target_size = self.get_target_chunk_size(complexity_score)

            logger.info(
                f"Document complexity: {complexity_score:.2f}, target chunk size: {target_size} words"
            )

            # Split document into sentences for better boundary preservation
            sentences = self.split_into_sentences(document_text)

            if not sentences:
                logger.warning("No sentences found, falling back to original text")
                return f"<|start_chunk_0>\n{document_text}<|end_chunk_0|>"

            # Group sentences into chunks based on target size
            chunks = []
            current_chunk = []
            current_word_count = 0

            for sentence in sentences:
                sentence_word_count = self.count_words(sentence)

                # If adding this sentence would exceed target size
                if (
                    current_word_count + sentence_word_count > target_size
                    and current_chunk
                    and current_word_count >= target_size * 0.5
                ):
                    chunks.append(" ".join(current_chunk))
                    current_chunk = [sentence]
                    current_word_count = sentence_word_count
                else:
                    current_chunk.append(sentence)
                    current_word_count += sentence_word_count

            if current_chunk:
                chunks.append(" ".join(current_chunk))

            # If no chunks were created, use the whole document
            if not chunks:
                chunks = [document_text]

            logger.info(
                f"Created {len(chunks)} initial chunks with target size {target_size} words"
            )

            chunked_text = ""
            for i, chunk in enumerate(chunks):
                chunked_text += f"<|start_chunk_{i}>\n{chunk.strip()}<|end_chunk_{i}|>"

            return chunked_text

        except Exception as e:
            logger.error(f"Error in prepare_chunked_text: {e}")
            return f"<|start_chunk_0>\n{document_text}<|end_chunk_0|>"

    async def get_llm_chunking_suggestions(self, chunked_text: str) -> str:
        """

        Args:
            chunked_text: Text with chunk markers

        Returns:
            LLM response with split suggestions
        """
        prompt = self.chunking_prompt.format(document_text=chunked_text)
        return await llm_service.call_model(prompt)

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
            if split_points.lower() != "none":
                try:
                    split_after = [
                        int(x.strip()) for x in split_points.split(",") if x.strip()
                    ]
                except ValueError as e:
                    logger.warning(f"Failed to parse split points from LLM response: {e}")

        logger.info(f"Split after chunks: {split_after}")

        # Extract chunks using regex
        chunk_pattern = r"<\|start_chunk_(\d+)\|?>(.*?)<\|end_chunk_\1\|>"
        chunks = re.findall(chunk_pattern, chunked_text, re.DOTALL)

        if not chunks:
            logger.warning("No chunks found in text, falling back to size-based chunking")
            return self._fallback_size_based_chunking(chunked_text)

        logger.info(f"Found {len(chunks)} chunks")

        if not split_after:
            logger.info("No splits suggested, using fallback size-based chunking")
            original_text = "".join([chunk_text.strip() for _, chunk_text in chunks])
            return self._fallback_size_based_chunking(original_text)

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

        max_words = 2000  # Maximum acceptable chunk size
        oversized_chunks = []

        for i, section in enumerate(sections):
            word_count = self.count_words(section)
            if word_count > max_words:
                oversized_chunks.append((i, word_count))

        if oversized_chunks:
            logger.warning(f"Found {len(oversized_chunks)} oversized chunks (max words: {max_words}). "
                         f"Oversized chunks: {oversized_chunks}")
            logger.info("Using fallback size-based chunking due to oversized chunks")
            original_text = "".join([chunk_text.strip() for _, chunk_text in chunks])
            return self._fallback_size_based_chunking(original_text)

        logger.info(f"Created {len(sections)} sections with acceptable sizes")
        return sections

    def _fallback_size_based_chunking(self, text: str) -> List[str]:
        try:
            complexity_score = self.calculate_text_complexity(text)
            target_size = self.get_target_chunk_size(complexity_score)

            logger.info(f"Using fallback chunking with target size: {target_size} words")

            sentences = self.split_into_sentences(text)

            if not sentences:
                return [text]

            chunks = []
            current_chunk = []
            current_word_count = 0

            for sentence in sentences:
                sentence_word_count = self.count_words(sentence)

                if (current_word_count + sentence_word_count > target_size
                    and current_chunk
                    and current_word_count >= target_size * 0.5):

                    chunks.append(" ".join(current_chunk).strip())
                    current_chunk = [sentence]
                    current_word_count = sentence_word_count
                else:
                    current_chunk.append(sentence)
                    current_word_count += sentence_word_count

            if current_chunk:
                chunks.append(" ".join(current_chunk).strip())

            if not chunks:
                chunks = [text]

            logger.info(f"Fallback chunking created {len(chunks)} chunks")
            return chunks

        except Exception as e:
            logger.error(f"Error in fallback chunking: {e}")
            return [text]

    async def chunk_document(self, document_text: str) -> List[str]:
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
            llm_response = await self.get_llm_chunking_suggestions(chunked_text)
            logger.info(f"LLM chunking response: {llm_response}")

            chunks = self.split_text_by_llm_suggestions(chunked_text, llm_response)

            logger.info(f"Successfully chunked document into {len(chunks)} chunks")
            return chunks

        except Exception as e:
            logger.error(f"Error chunking document: {e}")
            return [document_text]

    def cleanup(self) -> None:
        """
        Cleanup method to clear any cached data.
        """
        logger.info("Cleaning up ChunkingService")
        try:
            logger.debug("ChunkingService cleanup completed")
        except Exception as e:
            logger.warning(f"Error during ChunkingService cleanup: {e}")

chunking_service = ChunkingService()
