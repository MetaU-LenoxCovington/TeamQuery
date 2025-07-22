import logging
from pathlib import Path
from typing import List, Optional

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions,
    RapidOcrOptions,
    smolvlm_picture_description,
)
from docling.document_converter import DocumentConverter, PdfFormatOption

logger = logging.getLogger(__name__)

IMAGE_PLACEHOLDER = "<!-- image_placeholder -->"
PAGE_BREAK_PLACEHOLDER = "<!-- page_break -->"


class DocumentConversionService:

    def __init__(self):
        self.pipeline_options = PdfPipelineOptions(
            generate_page_images=True,
            images_scale=1.00,
            do_ocr=True,
            do_picture_description=True,
            ocr_options=RapidOcrOptions(),
            picture_description_options=smolvlm_picture_description,
        )

        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=self.pipeline_options)
            }
        )

    def replace_occurrences(self, text: str, target: str, replacements: List[str]) -> str:
        """
        Replace occurrences of target string with replacements in order

        Args:
            text: Text to process
            target: Target string to replace
            replacements: List of replacement strings

        Returns:
            Text with replacements made
        """
        for replacement in replacements:
            if target in text:
                text = text.replace(target, replacement, 1)
            else:
                logger.warning(
                    f"No more occurrences of '{target}' found in the text for replacement ({replacement}). "
                    f"Skipping this replacement."
                )
        return text

    def process_document(
        self,
        document_path: Path,
        n_pages: int = -1
    ) -> str:
        """
        Process a document and convert it to markdown with image descriptions

        Args:
            document_path: Path to the document file
            n_pages: Number of pages to process (-1 for all pages)

        Returns:
            Processed document text in markdown format
        """
        try:
            logger.info(f"Processing document: {document_path}")

            # Convert document
            result = self.converter.convert(document_path)
            document = result.document

            # Extract image annotations
            annotations = []
            for picture in document.pictures:
                logger.debug(f"Processing picture: {picture}")
                for annotation in picture.annotations:
                    annotations.append(annotation.text)

            # Check for mismatch
            if len(annotations) != len(document.pictures):
                logger.warning("Mismatch in number of annotations and number of pictures")

            # Export to markdown
            text = document.export_to_markdown(
                page_break_placeholder=PAGE_BREAK_PLACEHOLDER,
                image_placeholder=IMAGE_PLACEHOLDER,
            )

            # Replace image placeholders with annotations
            if annotations:
                text = self.replace_occurrences(text, IMAGE_PLACEHOLDER, annotations)

            # Limit pages if specified
            if n_pages != -1:
                pages = text.split(PAGE_BREAK_PLACEHOLDER)
                text = PAGE_BREAK_PLACEHOLDER.join(pages[:n_pages])

            logger.info(f"Successfully processed document with {len(text)} characters")
            return text

        except Exception as e:
            logger.error(f"Error processing document {document_path}: {e}")
            raise

    def process_document_from_bytes(
        self,
        document_bytes: bytes,
        filename: str,
        n_pages: int = -1
    ) -> str:
        """
        Process a document from bytes data since documents will be loaded from S3

        Args:
            document_bytes: Document data as bytes
            filename: Original filename for detecting the format
            n_pages: Number of pages to process (-1 for all pages)

        Returns:
            Processed document text in markdown format
        """
        try:
            # Save bytes to temporary file for processing
            import tempfile

            with tempfile.NamedTemporaryFile(suffix=Path(filename).suffix, delete=False) as tmp_file:
                tmp_file.write(document_bytes)
                tmp_path = Path(tmp_file.name)

            try:
                return self.process_document(tmp_path, n_pages)
            finally:
                # Clean up temporary file
                tmp_path.unlink(missing_ok=True)

        except Exception as e:
            logger.error(f"Error processing document from bytes: {e}")
            raise


    def cleanup(self) -> None:
        logger.info("Cleaning up DocumentConversionService")
        try:
            self.converter = None
            self.pipeline_options = None
            logger.debug("Cleared DocumentConversionService ML models and pipelines")
        except Exception as e:
            logger.warning(f"Error during DocumentConversionService cleanup: {e}")

document_conversion_service = DocumentConversionService()
