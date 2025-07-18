import concurrent.futures
import logging
import os
import pathlib
import re
import urllib.request
from functools import lru_cache
from typing import List, Optional

import kenlm
import spacy
from huggingface_hub import hf_hub_download
from symspellpy import SymSpell
from wordfreq import zipf_frequency

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(message)s", level=logging.INFO
)


class TextCleaningService:

    def __init__(self, models_dir: str = "app/models"):
        """Initialize the text cleaning service with model loading."""
        self.models_dir = pathlib.Path(models_dir)
        self.models_dir.mkdir(exist_ok=True)

        # Model paths
        self.kenlm_path = None
        self.freq_file = self.models_dir / "frequency_dictionary_en_82_765.txt"

        # Models
        self.kenlm_model = None
        self.nlp = None
        self.sym = None
        self.en_words = None

        # Regex patterns
        self.camel_re = re.compile(r"(?<=[a-z])(?=[A-Z])")

        # Placeholders for document structure
        self.image_placeholder = "<!-- image_placeholder -->"
        self.page_break_placeholder = "<!-- page_break -->"
        self.placeholders = {self.image_placeholder, self.page_break_placeholder}
        self.placeholder_re = re.compile(
            rf"({re.escape(self.image_placeholder)}|{re.escape(self.page_break_placeholder)})"
        )

        # Initialize models
        self._load_models()

    def _load_models(self):
        self._load_kenlm_model()
        self._load_spacy_model()
        self._load_symspell_model()

    def _load_kenlm_model(self):
        """Load KenLM model, downloading if not present."""
        try:
            logging.info("Loading KenLM 5-gram model...")

            # Check if model exists in models directory (direct path)
            kenlm_local_path = self.models_dir / "wiki_en_token.arpa.bin"

            # Check if model exists in HuggingFace cache structure
            hf_cache_pattern = (
                self.models_dir
                / "models--BramVanroy--kenlm_wikipedia_en"
                / "snapshots"
                / "*"
                / "wiki_en_token.arpa.bin"
            )

            # Try to find existing model in HF cache structure
            import glob

            hf_cached_files = glob.glob(str(hf_cache_pattern))

            if kenlm_local_path.exists():
                logging.info(f"Using local KenLM model: {kenlm_local_path}")
                self.kenlm_path = str(kenlm_local_path)
            elif hf_cached_files:
                # Use the first found cached model
                self.kenlm_path = hf_cached_files[0]
                logging.info(f"Using cached HuggingFace KenLM model: {self.kenlm_path}")
            else:
                logging.info("Downloading KenLM model from HuggingFace...")
                self.kenlm_path = hf_hub_download(
                    "BramVanroy/kenlm_wikipedia_en",
                    "wiki_en_token.arpa.bin",
                    cache_dir=str(self.models_dir),
                )
                logging.info(f"KenLM model downloaded to: {self.kenlm_path}")

            self.kenlm_model = kenlm.Model(self.kenlm_path)
            logging.info("KenLM model loaded successfully.")

        except Exception as e:
            logging.error(f"Failed to load KenLM model: {e}")
            raise

    def _load_spacy_model(self):
        """Load spaCy model for tokenization."""
        try:
            logging.info("Loading spaCy model...")
            self.nlp = spacy.load(
                "en_core_web_sm", disable=["ner", "parser", "tagger", "lemmatizer"]
            )
            logging.info("spaCy model loaded successfully.")
        except Exception as e:
            logging.error(f"Failed to load spaCy model: {e}")
            raise

    def _load_symspell_model(self):
        """Load SymSpell model and frequency dictionary."""
        try:
            logging.info("Loading SymSpell model...")

            # Download frequency dictionary if not present
            if not self.freq_file.exists():
                freq_url = (
                    "https://raw.githubusercontent.com/mammothb/symspellpy/master/"
                    "symspellpy/frequency_dictionary_en_82_765.txt"
                )
                logging.info("Downloading SymSpell frequency dictionary...")
                urllib.request.urlretrieve(freq_url, self.freq_file)
                logging.info("Frequency dictionary downloaded.")

            # Initialize SymSpell
            self.sym = SymSpell(max_dictionary_edit_distance=0, prefix_length=7)
            self.sym.load_dictionary(str(self.freq_file), 0, 1)

            # Add custom terms
            for term in ["bylaws", "universitycourt", "lanai"]:
                self.sym.create_dictionary_entry(term, 1)

            # Load word set
            self.en_words = self._load_word_set(str(self.freq_file))

            logging.info("SymSpell model loaded successfully.")

        except Exception as e:
            logging.error(f"Failed to load SymSpell model: {e}")
            raise

    def _load_word_set(self, dict_path: str, min_zipf: float = 2) -> set:
        """Load word set from frequency dictionary."""
        words = set()
        with open(dict_path, "r", encoding="utf8") as f:
            for line in f:
                word = line.strip().split()[0]
                words.add(word.lower())
        return words

    @lru_cache(maxsize=10000)
    def _kenlm_score(self, txt: str) -> float:
        """Per-token cached perplexity scoring."""
        return self.kenlm_model.perplexity(txt)

    def _reconstruct_sentence_with_split(
        self, sentence_tokens: List[str], word_index: int, split_words: List[str]
    ) -> str:
        """Reconstruct sentence with a specific word split for perplexity scoring."""
        reconstructed = (
            sentence_tokens[:word_index]
            + split_words
            + sentence_tokens[word_index + 1 :]
        )
        return " ".join(reconstructed)

    @lru_cache(maxsize=50_000)
    def _recursive_split_with_context(
        self, word: str, sentence_context: str = "", word_position: int = -1
    ) -> str:
        """
        Recursive splitting with sentence context awareness and perplexity checking.
        This is the main splitting strategy.
        """
        # Parse sentence context
        sentence_tokens = sentence_context.split() if sentence_context else [word]
        if word_position == -1:
            try:
                word_position = sentence_tokens.index(word)
            except ValueError:
                sentence_tokens = [word]
                word_position = 0

        # Score original word in context
        original_sentence = self._reconstruct_sentence_with_split(
            sentence_tokens, word_position, [word]
        )
        original_perplexity = self._kenlm_score(original_sentence)

        # Try all possible splits
        best_split = word
        best_perplexity = original_perplexity

        def _try_all_splits(s, start_pos=0):
            nonlocal best_split, best_perplexity

            for i in range(1, len(s)):
                left, right = s[:i], s[i:]

                # Only require that split parts are reasonable words (Zipf > 1.0)
                if (
                    zipf_frequency(left.lower(), "en") > 1.0
                    and zipf_frequency(right.lower(), "en") > 1.0
                ):

                    split_words = [left, right]
                    test_sentence = self._reconstruct_sentence_with_split(
                        sentence_tokens, word_position, split_words
                    )
                    perplexity = self._kenlm_score(test_sentence)

                    if perplexity < best_perplexity:
                        best_perplexity = perplexity
                        best_split = " ".join(split_words)

        _try_all_splits(word)

        # Only return split if it significantly improves perplexity
        if best_perplexity < original_perplexity * 0.90:  # 10% improvement threshold
            return best_split

        return word

    def _split_camel_case(self, token: str) -> str:
        """Split camel case: theBoardbut → the Boardbut"""
        return self.camel_re.sub(" ", token)

    def _symspell_segments(self, word: str) -> List[str]:
        """Get SymSpell segmentation suggestions."""
        comp = self.sym.word_segmentation(word.lower())
        seg = comp.segmented_string if hasattr(comp, "segmented_string") else comp
        return [seg]

    def _get_candidate_splits(
        self, token: str, sentence_context: str = "", word_position: int = -1
    ) -> List[str]:
        """
        Return candidate splits using recursive splitting, camel case, and SymSpell.
        Beam search and all caps splitting have been removed.
        """
        # Use sentence-aware recursive splitting when context is available
        if sentence_context and word_position >= 0:
            best_recursive = self._recursive_split_with_context(
                token, sentence_context, word_position
            )
        else:
            best_recursive = self._recursive_split_with_context(token)

        # if a split was made
        if best_recursive != token and " " in best_recursive:
            return [best_recursive]

        # Try camel case splitting
        if self.camel_re.search(token):
            camel_split = self._split_camel_case(token)
            # if camel already yields at least one space, return it
            if " " in camel_split:
                return [camel_split]

        # Try SymSpell segmentation as fallback
        segs = self._symspell_segments(token)
        good = [
            s
            for s in segs
            if " " in s and all(zipf_frequency(w, "en") > 2 for w in s.split())
        ]

        if good:
            return good

        # Return original token if no good splits found
        return [token]

    def clean_sentence(
        self, sentence: str, ratio_thresh: float = 0.65, abs_thresh: float = 40
    ) -> str:
        """
        Clean a single sentence using recursive splitting and camel case splitting only.
        """
        doc = self.nlp(sentence)
        sentence_tokens = [tk.text for tk in doc]
        out = []

        for i, tk in enumerate(doc):
            w = tk.text

            if w.isalpha() and len(w) > 8:
                candidates = self._get_candidate_splits(w, sentence, i)

                # Accept immediately if all parts are common words
                if " " in candidates[0] and all(
                    zipf_frequency(p, "en") > 2 for p in candidates[0].split()
                ):
                    out.append(candidates[0])
                    continue

                # Score candidates in sentence context
                scored = []
                for c in candidates:
                    # Reconstruct sentence with this candidate
                    test_tokens = (
                        sentence_tokens[:i] + c.split() + sentence_tokens[i + 1 :]
                    )
                    test_sentence = " ".join(test_tokens)
                    ppl = self._kenlm_score(test_sentence)
                    scored.append((ppl, c))

                best_ppl, best = min(scored, key=lambda x: x[0])

                # Compare with original sentence
                orig_ppl = self._kenlm_score(sentence)

                if (
                    best_ppl < orig_ppl * ratio_thresh
                    or orig_ppl - best_ppl > abs_thresh
                ):
                    out.append(best)
                else:
                    out.append(w)
            else:
                out.append(w)

        return " ".join(out)

    def clean_text(self, text: str, max_workers: int = 8) -> str:
        sentences = re.split(r"(?<=[.?!])\s+", text)
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            cleaned = list(executor.map(self.clean_sentence, sentences))
        return "\n".join(cleaned)

    def clean_document_with_placeholders(self, doc_text: str) -> str:
        """
        Clean document text while preserving image and page break placeholders.
        """
        parts = self.placeholder_re.split(doc_text)
        cleaned_parts = []

        for part in parts:
            if part in self.placeholders:
                cleaned_parts.append(part)
            elif part.strip():
                cleaned_parts.append(self.clean_text(part))
            else:
                cleaned_parts.append(part)

        return "".join(cleaned_parts)




def get_text_cleaning_service() -> TextCleaningService:
    global _text_cleaning_service
    if _text_cleaning_service is None:
        _text_cleaning_service = TextCleaningService()
    return _text_cleaning_service

text_cleaning_service = get_text_cleaning_service()
