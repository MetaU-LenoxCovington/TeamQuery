import logging
import google.generativeai as genai
from tenacity import retry, stop_after_attempt, retry_if_exception_type

from app.config import get_settings
from ollama import chat

logger = logging.getLogger(__name__)
settings = get_settings()


class LLMService:

    def __init__(self):
        self.ollama_model = settings.LLM_MODEL
        self.temperature = settings.LLM_TEMPERATURE
        self.max_tokens = settings.LLM_MAX_TOKENS

        self.provider = getattr(settings, 'LLM_PROVIDER', 'gemini')

        self.gemini_model = getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash')
        self.gemini_temperature = getattr(settings, 'GEMINI_TEMPERATURE', 0.0)
        self.gemini_max_tokens = getattr(settings, 'GEMINI_MAX_TOKENS', 8192)
        self.gemini_max_retries = getattr(settings, 'GEMINI_MAX_RETRIES', 3)

        self.gemini_client = None
        if hasattr(settings, 'GOOGLE_API_KEY') and settings.GOOGLE_API_KEY:
            genai.configure(api_key=settings.GOOGLE_API_KEY)
            self.gemini_client = genai.GenerativeModel(self.gemini_model)

    @retry(
        stop=stop_after_attempt(2),
        retry=retry_if_exception_type((Exception,))
    )
    async def _call_gemini_model(self, prompt: str, **kwargs) -> str:
        try:
            generation_config = genai.types.GenerationConfig(
                temperature=kwargs.get("temperature", self.gemini_temperature),
                max_output_tokens=kwargs.get("max_tokens", self.gemini_max_tokens),
                top_p=kwargs.get("top_p", 0.95),
                top_k=kwargs.get("top_k", 64),
            )

            response = await self.gemini_client.generate_content_async(
                prompt,
                generation_config=generation_config
            )

            if response.text:
                return response.text
            else:
                logger.error("Gemini returned empty response")
                raise ValueError("Empty response from Gemini")

        except Exception as e:
            if "429" in str(e) or "quota" in str(e).lower():
                logger.warning(f"Gemini rate limit hit: {e}")
            else:
                logger.error(f"Error calling Gemini model: {e}")
            raise

    async def _call_ollama_model(self, prompt: str, **kwargs) -> str:
        try:
            response = chat(
                model=kwargs.get("model", self.ollama_model),
                messages=[{"role": "user", "content": prompt}],
                keep_alive="1h",
                options={
                    "num_ctx": kwargs.get("max_tokens", self.max_tokens),
                    "temperature": kwargs.get("temperature", self.temperature),
                    "min_p": kwargs.get("min_p", 0.0),
                    "repeat_penalty": kwargs.get("repeat_penalty", 1.0),
                    "top_k": kwargs.get("top_k", 64),
                    "top_p": kwargs.get("top_p", 0.95),
                },
            )
            return response.message.content

        except Exception as e:
            logger.error(f"Error calling Ollama model: {e}")
            raise

    async def call_model(self, prompt: str, **kwargs) -> str:
        try:
            if self.provider == 'gemini' and self.gemini_client:
                return await self._call_gemini_model(prompt, **kwargs)
            else:
                return await self._call_ollama_model(prompt, **kwargs)

        except Exception as e:
            logger.error(f"Error calling LLM model with provider {self.provider}: {e}")
            raise

    async def enhance_query(self, query: str, conversation_history: list = []) -> list[str]:
        """
        Generate 1-5 enhanced search queries from user input
        """
        try:
            logger.info(f"QUERY ENHANCEMENT - Original query: '{query}'")

            conversation_context = ""
            if conversation_history:
                recent_history = conversation_history[-3:]  # Last 3 exchanges
                conversation_context = "\n".join([
                    f"User: {msg.get('query', '')}\nAssistant: {msg.get('answer', '')}"
                    for msg in recent_history if msg.get('query')
                ])
                conversation_context = f"\n\nConversation History:\n{conversation_context}\n"
                logger.debug(f"Using conversation context: {len(recent_history)} previous exchanges")

            prompt = f"""You are a query enhancement specialist. Your task is to generate multiple search queries that will help find the most relevant information to answer the user's question.

                    {conversation_context}
                    Current User Query: "{query}"

                    Generate 1-5 diverse search queries that would help find relevant information. Include:
                    1. The original query (reformulated if needed)
                    2. Keyword-focused variants for specific terms
                    3. Semantic variants that capture the intent
                    4. Related concept queries if applicable

                    Format your response as a JSON array of strings, like this:
                    ["query 1", "query 2", "query 3"]

                    Do NOT include any explanatory text, reasoning, or additional commentary
                    Focus on creating queries that would retrieve different but relevant perspectives on the topic."""

            logger.debug(f"QUERY ENHANCEMENT PROMPT:\n{prompt}")
            response = await self.call_model(prompt, temperature=0.3)
            logger.info(f"QUERY ENHANCEMENT RESPONSE:\n{response}")

            import json
            try:
                enhanced_queries = json.loads(response.strip())
                if isinstance(enhanced_queries, list) and len(enhanced_queries) > 0:
                    if query not in enhanced_queries:
                        enhanced_queries.insert(0, query)
                    return enhanced_queries[:5]
                else:
                    logger.warning("LLM returned invalid query enhancement format, using original query")
                    return [query]
            except json.JSONDecodeError:
                logger.warning("Failed to parse LLM query enhancement response, using original query")
                return [query]

        except Exception as e:
            logger.error(f"Error in query enhancement: {e}")
            return [query]

    async def select_context(self, query: str, candidate_chunks: list) -> list[dict]:
        try:
            logger.info(f"CONTEXT SELECTION - Query: '{query}' | Candidates: {len(candidate_chunks)}")

            if not candidate_chunks:
                logger.warning("No candidate chunks provided for context selection")
                return []

            candidates = candidate_chunks[:15]
            logger.debug(f"Limited candidates to {len(candidates)} chunks to prevent token overflow")

            formatted_candidates = []
            for i, chunk in enumerate(candidates):
                doc_title = chunk.get('metadata', {}).get('document_title', 'Unknown')
                content_preview = chunk['content'][:500] + ('...' if len(chunk['content']) > 500 else '')
                score = chunk['score']

                formatted_candidates.append(
                    f"[{i+1}] Document: {doc_title}\n"
                    f"Content: {content_preview}\n"
                    f"Score: {score:.3f}"
                )

                logger.debug(f"Candidate {i+1}: {doc_title} (score: {score:.3f})")

            candidates_text = "\n\n".join(formatted_candidates)

            prompt = f"""You are a context selection specialist. Your task is to select the most relevant document chunks that will help answer the user's question.

                    User Question: "{query}"

                    Available Document Chunks:
                    {candidates_text}

                    Select the 3-5 most relevant chunks that would best help answer the user's question. Consider:
                    1. Direct relevance to the question
                    2. Complementary information that provides complete context
                    3. Avoid redundant or duplicate information
                    4. Prioritize chunks with higher relevance scores when relevance is similar

                    Respond with a JSON array of the chunk numbers (1-based indexing) you want to select, like this:
                    [1, 3, 5]

                    If none of the chunks are relevant, respond with an empty array like this:
                    []

                    Do NOT include any explanatory text, reasoning, or additional commentary. Only respond with the JSON array.
                    Select only the chunk numbers, not the content."""

            logger.debug(f"CONTEXT SELECTION PROMPT:\n{prompt}")
            response = await self.call_model(prompt, temperature=0.1)
            logger.info(f"CONTEXT SELECTION RESPONSE:\n{response}")

            import json
            try:
                selected_indices = json.loads(response.strip())
                if isinstance(selected_indices, list):
                    selected_chunks = []
                    for idx in selected_indices:
                        if isinstance(idx, int) and 1 <= idx <= len(candidates):
                            selected_chunks.append(candidates[idx - 1])

                    if not selected_chunks:
                        logger.info("LLM determined no chunks are relevant - returning empty context")
                        # return at least two chunk
                        return sorted(candidates[:2], key=lambda x: x['score'], reverse=True)

                    return selected_chunks[:5]
                else:
                    logger.warning("LLM returned invalid context selection format")
                    return sorted(candidates[:3], key=lambda x: x['score'], reverse=True)
            except json.JSONDecodeError:
                logger.warning("Failed to parse LLM context selection response")
                return sorted(candidates[:3], key=lambda x: x['score'], reverse=True)

        except Exception as e:
            logger.error(f"Error in context selection: {e}")
            return sorted(candidate_chunks[:3], key=lambda x: x['score'], reverse=True)

    async def generate_answer(self, query: str, context_chunks: list, conversation_history: list = None) -> dict:
        try:
            logger.info(f"ANSWER GENERATION - Query: '{query}' | Context chunks: {len(context_chunks)}")

            if not context_chunks:
                logger.warning("No context chunks provided for answer generation")
                return {
                    "answer": "I don't have enough information in the available documents to answer your question.",
                    "sources": [],
                    "confidence": "low"
                }

            formatted_context = []
            sources = []

            for i, chunk in enumerate(context_chunks):
                doc_title = chunk.get('metadata', {}).get('document_title', 'Unknown Document')
                formatted_context.append(
                    f"[Source {i+1}] {doc_title}:\n{chunk['content']}"
                )

                logger.debug(f"Source {i+1}: {doc_title} | Score: {chunk.get('score', 0.0):.3f}")

                sources.append({
                    "chunk_id": chunk.get('chunk_id', f'chunk-{i}'),
                    "document_id": chunk.get('document_id', f'doc-{i}'),
                    "document_title": doc_title,
                    "content": chunk['content'][:200] + "..." if len(chunk['content']) > 200 else chunk['content'],
                    "relevance_score": chunk.get('score', 0.0),
                    "page_number": chunk.get('metadata', {}).get('page_number'),
                    "source_number": i + 1
                })
            if context_chunks:
                context_text = "\n\n".join(formatted_context)
            else:
                context_text = "\n\n No context was found for this query."

            conversation_context = ""
            if conversation_history:
                recent_history = conversation_history[-2:]  # Last 2 exchanges
                conversation_context = "\n\nRecent Conversation:\n" + "\n".join([
                    f"Q: {msg.get('query', '')}\nA: {msg.get('answer', '')}"
                    for msg in recent_history if msg.get('query')
                ])
                logger.debug(f"Using conversation history: {len(recent_history)} previous exchanges")

            prompt = f"""You are a helpful AI assistant that answers questions based on provided document context. Your task is to provide accurate, comprehensive answers using only the information from the given sources.

                    {conversation_context}

                    User Question: "{query}"

                    Available Context:
                    {context_text}

                    Instructions:
                    1. Answer the question using ONLY the information provided in the context
                    2. Be comprehensive but concise
                    3. If the context doesn't contain enough information, say so clearly
                    4. Reference specific sources when making claims (e.g., "According to Source 1...")
                    5. If multiple sources provide different perspectives, acknowledge this
                    6. Do not make up information not present in the context
                    7. If the question cannot be answered with the given context, explain what information would be needed

                    Provide a clear, well-structured answer that directly addresses the user's question."""

            logger.debug(f"ANSWER GENERATION PROMPT:\n{prompt}")
            response = await self.call_model(prompt, temperature=0.2)
            logger.info(f"ANSWER GENERATION RESPONSE:\n{response}")

            # Determine confidence based on context quality and coverage
            confidence = "high"
            if len(context_chunks) < 2:
                confidence = "medium"
            if not any(chunk['score'] > 0.7 for chunk in context_chunks):
                confidence = "medium"
            if "don't have enough information" in response.lower() or "cannot be answered" in response.lower():
                confidence = "low"

            return {
                "answer": response.strip(),
                "sources": sources,
                "confidence": confidence
            }

        except Exception as e:
            logger.error(f"Error in answer generation: {e}")
            return {
                "answer": "I encountered an error while generating the answer. Please try again.",
                "sources": [],
                "confidence": "low"
            }

    async def cleanup(self) -> None:
        logger.info("Cleaning up LLMService")
        try:
            self.gemini_client = None
            logger.debug("Cleared Gemini client reference")

        except Exception as e:
            logger.warning(f"Error during LLMService cleanup: {e}")

llm_service = LLMService()
