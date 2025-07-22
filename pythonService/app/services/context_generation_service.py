import logging
from typing import List

from app.services.llm_service import llm_service
from app.utils.token_utils import token_utils

logger = logging.getLogger(__name__)


class ContextGenerationService:

    def __init__(self):
        self.contextualizer_prompt = self._get_contextualizer_prompt()

    def _get_contextualizer_prompt(self) -> str:
        return """
You are an assistant specialized in analyzing document chunks and providing relevant context.

<instructions>
    <instruction>You will be given a document and a specific chunk from that document</instruction>
    <instruction>Provide 2-3 concise sentences that situate this chunk within the broader document</instruction>
    <instruction>Identify the main topic or concept discussed in the chunk</instruction>
    <instruction>Include relevant information or comparisons from the broader document context</instruction>
    <instruction>Note how this information relates to the overall theme or purpose of the document if applicable</instruction>
    <instruction>Include key figures, dates, or percentages that provide important context</instruction>
    <instruction>Avoid phrases like "This chunk discusses" - instead, directly state the context</instruction>
    <instruction>Keep your response brief and focused on improving search retrieval</instruction>
</instructions>

Here is the document:
<document>
{document}
</document>

Here is the chunk to contextualize:
<chunk>
{chunk}
</chunk>

Respond only with the succinct context for this chunk. Do not mention it is a chunk or that you are providing context.
""".strip()

    async def generate_context_for_chunk(self, chunk: str, document: str) -> str:
        try:
            truncated_document = self._prepare_document_for_context(document, chunk)

            prompt = self.contextualizer_prompt.format(document=truncated_document, chunk=chunk)

            prompt_tokens = token_utils.count_tokens(prompt)
            if prompt_tokens > 6000:
                logger.warning(f"Prompt has {prompt_tokens} tokens, applying additional truncation")
                max_doc_tokens = 3000
                truncated_document = token_utils.smart_document_truncation(document, max_doc_tokens)
                prompt = self.contextualizer_prompt.format(document=truncated_document, chunk=chunk)

            context = await llm_service.call_model(prompt)

            context = self._validate_and_truncate_context(context)

            logger.debug(
                f"Generated context for chunk (length {len(chunk)}): {context[:100]}..."
            )
            return context

        except Exception as e:
            logger.error(f"Error generating context for chunk: {e}")
            return self._create_fallback_context(chunk)

    def _prepare_document_for_context(self, document: str, chunk: str) -> str:
        """
        Args:
            document: Full document text
            chunk: The specific chunk being contextualized

        Returns:
            Truncated document for context generation
        """
        max_document_tokens = 4000

        document_tokens = token_utils.count_tokens(document)

        if document_tokens <= max_document_tokens:
            return document

        logger.info(f"Document has {document_tokens} tokens, truncating for context generation")

        truncated_document = token_utils.smart_document_truncation(
            document,
            max_document_tokens,
            beginning_ratio=0.6
        )

        final_tokens = token_utils.count_tokens(truncated_document)
        logger.info(f"Truncated document to {final_tokens} tokens for context generation")

        return truncated_document

    def _validate_and_truncate_context(self, context: str) -> str:
        if not context or not context.strip():
            return ""

        context = context.strip()

        context_tokens = token_utils.count_tokens(context)
        max_context_tokens = 300

        if context_tokens > max_context_tokens:
            logger.warning(f"Context response has {context_tokens} tokens, truncating to {max_context_tokens}")
            context = token_utils.truncate_to_token_limit(context, max_context_tokens)

        return context

    def _create_fallback_context(self, chunk: str) -> str:
        sentences = chunk.split('.')
        if sentences and len(sentences[0]) > 10:
            return f"This content discusses {sentences[0][:100].strip().lower()}."
        else:
            return f"This content covers information from the document."

    async def generate_contexts_for_chunks(
        self, chunks: List[str], document: str
    ) -> List[str]:
        contexts = []
        total_chunks = len(chunks)

        logger.info(f"Generating contexts for {total_chunks} chunks")

        for i, chunk in enumerate(chunks):
            logger.info(f"Processing chunk {i+1}/{total_chunks}")

            context = await self.generate_context_for_chunk(chunk, document)
            contexts.append(context)

        logger.info(f"Successfully generated {len(contexts)} contexts")
        return contexts

    async def create_contextualized_chunks(
        self, chunks: List[str], document: str
    ) -> List[str]:
        contexts = await self.generate_contexts_for_chunks(chunks, document)

        contextualized_chunks = []
        for chunk, context in zip(chunks, contexts):
            if context.strip():
                contextualized_chunk = (
                    f"<chunk_context>{context}</chunk_context>\n<chunk>{chunk}</chunk>"
                )
            else:
                # If no context generated, just wrap the chunk
                contextualized_chunk = f"<chunk>{chunk}</chunk>"

            contextualized_chunks.append(contextualized_chunk)

        logger.info(f"Created {len(contextualized_chunks)} contextualized chunks")
        return contextualized_chunks

    def extract_chunk_content(self, contextualized_chunk: str) -> str:
        import re

        chunk_match = re.search(
            r"<chunk>(.*?)</chunk>", contextualized_chunk, re.DOTALL
        )
        if chunk_match:
            return chunk_match.group(1).strip()

        # return the whole text if no chunk found
        return contextualized_chunk

    def extract_chunk_context(self, contextualized_chunk: str) -> str:
        import re

        context_match = re.search(
            r"<chunk_context>(.*?)</chunk_context>", contextualized_chunk, re.DOTALL
        )
        if context_match:
            return context_match.group(1).strip()

        # No context found
        return ""

    def cleanup(self) -> None:
        logger.info("Cleaning up ContextGenerationService")
        try:
            logger.debug("ContextGenerationService cleanup completed")
        except Exception as e:
            logger.warning(f"Error during ContextGenerationService cleanup: {e}")

context_generation_service = ContextGenerationService()
