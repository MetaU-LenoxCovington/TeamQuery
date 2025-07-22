import logging
from typing import List, Tuple
import tiktoken
from nltk.tokenize import sent_tokenize

logger = logging.getLogger(__name__)

class TokenUtils:

    def __init__(self):
        # same encoding as OpenAI text-embedding-3-small
        self.encoding = tiktoken.get_encoding("cl100k_base")

    def count_tokens(self, text: str) -> int:
        try:
            return len(self.encoding.encode(text))
        except Exception as e:
            logger.warning(f"Error counting tokens, falling back to word count estimation: {e}")
            word_count = len(text.split())
            return int(word_count / 0.75)

    def truncate_to_token_limit(self, text: str, max_tokens: int) -> str:
        if not text:
            return text

        current_tokens = self.count_tokens(text)
        if current_tokens <= max_tokens:
            return text

        try:
            tokens = self.encoding.encode(text)
            truncated_tokens = tokens[:max_tokens]
            return self.encoding.decode(truncated_tokens)
        except Exception as e:
            logger.warning(f"Error in token-level truncation, using character estimation: {e}")
            chars_per_token = len(text) / current_tokens
            target_chars = int(max_tokens * chars_per_token)
            return text[:target_chars]

    def smart_document_truncation(
        self,
        document: str,
        max_tokens: int,
        beginning_ratio: float = 0.6
    ) -> str:
        if not document:
            return document

        current_tokens = self.count_tokens(document)
        if current_tokens <= max_tokens:
            return document

        logger.info(f"Document has {current_tokens} tokens, truncating to {max_tokens}")

        beginning_tokens = int(max_tokens * beginning_ratio)
        end_tokens = max_tokens - beginning_tokens
        separator_tokens = self.count_tokens("\n\n[... middle content omitted ...]\n\n")

        if separator_tokens < beginning_tokens:
            beginning_tokens -= separator_tokens // 2
            end_tokens -= separator_tokens // 2
        else:
            return self.truncate_to_token_limit(document, max_tokens)

        try:
            sentences = sent_tokenize(document)
            if not sentences:
                return self.truncate_to_token_limit(document, max_tokens)

            beginning_section = self._get_section_by_tokens(
                sentences, beginning_tokens, from_start=True
            )

            end_section = self._get_section_by_tokens(
                sentences, end_tokens, from_start=False
            )

            if beginning_section and end_section:
                truncated = f"{beginning_section}\n\n[... middle content omitted ...]\n\n{end_section}"
            elif beginning_section:
                truncated = beginning_section
            elif end_section:
                truncated = end_section
            else:
                truncated = self.truncate_to_token_limit(document, max_tokens)

            if self.count_tokens(truncated) > max_tokens:
                logger.warning("Truncated document still exceeds token limit, applying final truncation")
                truncated = self.truncate_to_token_limit(truncated, max_tokens)

            return truncated

        except Exception as e:
            logger.error(f"Error in smart truncation, falling back to simple truncation: {e}")
            return self.truncate_to_token_limit(document, max_tokens)

    def _get_section_by_tokens(
        self,
        sentences: List[str],
        max_tokens: int,
        from_start: bool = True
    ) -> str:
        if not sentences:
            return ""

        section_sentences = []
        current_tokens = 0

        sentence_range = sentences if from_start else reversed(sentences)

        for sentence in sentence_range:
            sentence_tokens = self.count_tokens(sentence)

            if current_tokens + sentence_tokens <= max_tokens:
                if from_start:
                    section_sentences.append(sentence)
                else:
                    section_sentences.insert(0, sentence)
                current_tokens += sentence_tokens
            else:
                break

        return " ".join(section_sentences)

    def validate_embedding_text_length(self, text: str, max_tokens: int = 8000) -> Tuple[bool, int]:
        token_count = self.count_tokens(text)
        is_valid = token_count <= max_tokens

        if not is_valid:
            logger.warning(f"Text has {token_count} tokens, exceeds limit of {max_tokens}")

        return is_valid, token_count

token_utils = TokenUtils()
