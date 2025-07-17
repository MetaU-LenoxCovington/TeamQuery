import logging
from typing import List

from app.services.llm_service import llm_service

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

    def generate_context_for_chunk(self, chunk: str, document: str) -> str:
        try:
            prompt = self.contextualizer_prompt.format(document=document, chunk=chunk)
            context = llm_service.call_model_sync(prompt)

            logger.debug(
                f"Generated context for chunk (length {len(chunk)}): {context[:100]}..."
            )
            return context

        except Exception as e:
            logger.error(f"Error generating context for chunk: {e}")
            return ""

    def generate_contexts_for_chunks(
        self, chunks: List[str], document: str
    ) -> List[str]:
        contexts = []
        total_chunks = len(chunks)

        logger.info(f"Generating contexts for {total_chunks} chunks")

        for i, chunk in enumerate(chunks):
            logger.info(f"Processing chunk {i+1}/{total_chunks}")

            context = self.generate_context_for_chunk(chunk, document)
            contexts.append(context)

        logger.info(f"Successfully generated {len(contexts)} contexts")
        return contexts

    def create_contextualized_chunks(
        self, chunks: List[str], document: str
    ) -> List[str]:
        contexts = self.generate_contexts_for_chunks(chunks, document)

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


context_generation_service = ContextGenerationService()
