"""
Sample data fixtures for testing.
"""
import numpy as np
from typing import List, Dict, Any


class SampleDocuments:

    SIMPLE_TEXT = """
    This is a simple test document.

    It contains basic information about testing procedures.
    The document has multiple paragraphs for chunking tests.

    Each paragraph covers different aspects of the testing process.
    """

    FINANCIAL_REPORT = """
    # Q3 2024 Financial Report

    ## Executive Summary
    The company delivered exceptional results in Q3 2024, with strong growth across all business segments.
    Revenue increased by 15% year-over-year, driven primarily by growth in the digital services division.

    ## Financial Highlights
    - Revenue: $2.5B (+15% YoY)
    - Operating Income: $550M (+22% YoY)
    - Net Income: $420M (+18% YoY)
    - Earnings Per Share: $3.25 (+20% YoY)

    ## Business Segment Performance

    ### Digital Services Division
    The digital services division continued its strong performance with revenue of $1.2B, representing 25% growth year-over-year.
    Key drivers included increased adoption of cloud services and expansion into new markets.

    ### Traditional Services Division
    Traditional services generated $800M in revenue, showing steady 8% growth.
    The division maintained strong margins despite competitive pressures.

    ### International Operations
    International revenue reached $500M with 12% growth, driven by expansion in European markets.

    ## Outlook
    The company expects continued growth in Q4 2024, with projected revenue of $2.7B.
    Investment in R&D and market expansion will continue to drive long-term growth.
    """

    TECHNICAL_MANUAL = """
    # System Architecture Documentation

    ## Overview
    This document describes the technical architecture of the RAG system.
    The system is designed for high performance and scalability.

    ## Components

    ### Document Processing Pipeline
    The document processing pipeline handles ingestion and conversion of various file formats.
    It includes OCR capabilities for scanned documents and image processing.

    ### Search Index Management
    The search system uses HNSW (Hierarchical Navigable Small World) graphs for vector similarity search.
    BM25 indexing provides keyword-based search capabilities.

    ### Embedding Generation
    Vector embeddings are generated using state-of-the-art transformer models.
    The system supports both OpenAI and local embedding models.

    ## Performance Characteristics
    - Search latency: < 100ms for typical queries
    - Index build time: ~1 minute per 1000 documents
    - Memory usage: ~2GB per million embeddings

    ## Security Considerations
    All document access is controlled through role-based permissions.
    Embeddings are stored securely with encryption at rest.
    """

    LEGAL_DOCUMENT = """
    # Terms of Service Agreement

    ## Article 1: Definitions
    For the purposes of this agreement, the following terms shall have the meanings set forth below:

    1.1 "Service" means the software platform and related services provided by the Company.
    1.2 "User" means any individual or entity that accesses or uses the Service.
    1.3 "Content" means any data, text, graphics, or other materials uploaded to the Service.

    ## Article 2: Grant of License
    Subject to the terms and conditions of this Agreement, Company hereby grants User a limited, non-exclusive, non-transferable license to use the Service.

    ## Article 3: User Obligations
    User agrees to:
    - Comply with all applicable laws and regulations
    - Maintain the confidentiality of account credentials
    - Use the Service only for lawful purposes

    ## Article 4: Limitation of Liability
    In no event shall Company be liable for any indirect, incidental, special, or consequential damages.
    The total liability of Company shall not exceed the amount paid by User in the twelve months preceding the claim.

    ## Article 5: Termination
    This Agreement may be terminated by either party with thirty (30) days written notice.
    Upon termination, User's access to the Service will be discontinued.
    """


class SampleChunks:

    @staticmethod
    def get_financial_chunks() -> List[str]:
        return [
            "The company delivered exceptional results in Q3 2024, with strong growth across all business segments. Revenue increased by 15% year-over-year, driven primarily by growth in the digital services division.",
            "Revenue: $2.5B (+15% YoY), Operating Income: $550M (+22% YoY), Net Income: $420M (+18% YoY), Earnings Per Share: $3.25 (+20% YoY)",
            "The digital services division continued its strong performance with revenue of $1.2B, representing 25% growth year-over-year. Key drivers included increased adoption of cloud services and expansion into new markets.",
            "Traditional services generated $800M in revenue, showing steady 8% growth. The division maintained strong margins despite competitive pressures.",
            "International revenue reached $500M with 12% growth, driven by expansion in European markets.",
            "The company expects continued growth in Q4 2024, with projected revenue of $2.7B. Investment in R&D and market expansion will continue to drive long-term growth."
        ]

    @staticmethod
    def get_technical_chunks() -> List[str]:
        return [
            "This document describes the technical architecture of the RAG system. The system is designed for high performance and scalability.",
            "The document processing pipeline handles ingestion and conversion of various file formats. It includes OCR capabilities for scanned documents and image processing.",
            "The search system uses HNSW (Hierarchical Navigable Small World) graphs for vector similarity search. BM25 indexing provides keyword-based search capabilities.",
            "Vector embeddings are generated using state-of-the-art transformer models. The system supports both OpenAI and local embedding models.",
            "Search latency: < 100ms for typical queries, Index build time: ~1 minute per 1000 documents, Memory usage: ~2GB per million embeddings",
            "All document access is controlled through role-based permissions. Embeddings are stored securely with encryption at rest."
        ]


class SampleMetadata:

    @staticmethod
    def get_financial_metadata() -> List[Dict[str, Any]]:
        return [
            {
                "keywords": ["revenue", "growth", "Q3", "2024", "digital services"],
                "topics": ["financial performance", "quarterly results"],
                "entities": ["Q3 2024"],
                "document_type": "financial_report"
            },
            {
                "keywords": ["revenue", "operating income", "net income", "earnings"],
                "topics": ["financial metrics", "key performance indicators"],
                "entities": ["$2.5B", "$550M", "$420M"],
                "document_type": "financial_report"
            },
            {
                "keywords": ["digital services", "cloud services", "markets"],
                "topics": ["business segments", "digital transformation"],
                "entities": ["$1.2B"],
                "document_type": "financial_report"
            }
        ]

    @staticmethod
    def get_technical_metadata() -> List[Dict[str, Any]]:
        return [
            {
                "keywords": ["architecture", "RAG", "system", "performance"],
                "topics": ["system design", "technical documentation"],
                "entities": ["RAG system"],
                "document_type": "technical_manual"
            },
            {
                "keywords": ["pipeline", "processing", "OCR", "documents"],
                "topics": ["document processing", "data ingestion"],
                "entities": [],
                "document_type": "technical_manual"
            },
            {
                "keywords": ["HNSW", "BM25", "search", "indexing"],
                "topics": ["search algorithms", "information retrieval"],
                "entities": ["HNSW", "BM25"],
                "document_type": "technical_manual"
            }
        ]


class SampleEmbeddings:

    @staticmethod
    def generate_deterministic_embedding(text: str, dimension: int = 1536) -> np.ndarray:
        # Use text hash as seed for reproducible embeddings
        seed = hash(text) % 2**32
        np.random.seed(seed)
        embedding = np.random.normal(0, 1, dimension)
        # Normalize to unit length
        return embedding / np.linalg.norm(embedding)

    @staticmethod
    def get_financial_embeddings() -> List[np.ndarray]:
        chunks = SampleChunks.get_financial_chunks()
        return [SampleEmbeddings.generate_deterministic_embedding(chunk) for chunk in chunks]

    @staticmethod
    def get_technical_embeddings() -> List[np.ndarray]:
        chunks = SampleChunks.get_technical_chunks()
        return [SampleEmbeddings.generate_deterministic_embedding(chunk) for chunk in chunks]


class SampleOrganizations:
    TEST_ORG_1 = {
        "id": "test-org-1",
        "name": "Test Organization 1",
        "admin_user_id": "admin-user-1",
        "groups": {
            "default": "default-group-1",
            "finance": "finance-group-1",
            "engineering": "engineering-group-1"
        }
    }

    TEST_ORG_2 = {
        "id": "test-org-2",
        "name": "Test Organization 2",
        "admin_user_id": "admin-user-2",
        "groups": {
            "default": "default-group-2",
            "legal": "legal-group-2",
            "hr": "hr-group-2"
        }
    }


class SampleUsers:
    ADMIN_USER = {
        "id": "admin-user-1",
        "email": "admin@test.com",
        "name": "Admin User",
        "role": "ADMIN"
    }

    MANAGER_USER = {
        "id": "manager-user-1",
        "email": "manager@test.com",
        "name": "Manager User",
        "role": "MANAGER"
    }

    MEMBER_USER = {
        "id": "member-user-1",
        "email": "member@test.com",
        "name": "Member User",
        "role": "MEMBER"
    }


class SamplePermissions:

    @staticmethod
    def get_admin_permissions(org_id: str, group_ids: List[str] = None) -> Dict[str, Any]:
        return {
            "permissions": {
                "userId": "admin-user-1",
                "userRole": "ADMIN",
                "userGroupIds": group_ids or ["default-group-1", "finance-group-1", "engineering-group-1"]
            }
        }

    @staticmethod
    def get_manager_permissions(org_id: str, group_ids: List[str] = None) -> Dict[str, Any]:
        return {
            "permissions": {
                "userId": "manager-user-1",
                "userRole": "MANAGER",
                "userGroupIds": group_ids or ["default-group-1", "finance-group-1"]
            }
        }

    @staticmethod
    def get_member_permissions(org_id: str, group_ids: List[str] = None) -> Dict[str, Any]:
        return {
            "permissions": {
                "userId": "member-user-1",
                "userRole": "MEMBER",
                "userGroupIds": group_ids or ["default-group-1"]
            }
        }


class SampleSearchQueries:

    FINANCIAL_QUERIES = [
        "What was the revenue growth in Q3 2024?",
        "How did the digital services division perform?",
        "What are the financial highlights?",
        "Show me the earnings per share",
        "What is the outlook for Q4?"
    ]

    TECHNICAL_QUERIES = [
        "How does the search system work?",
        "What is the document processing pipeline?",
        "Explain the HNSW algorithm",
        "What are the performance characteristics?",
        "How is security handled?"
    ]

    GENERAL_QUERIES = [
        "What is this document about?",
        "Give me a summary",
        "What are the key points?",
        "Find information about performance",
        "Show me the main topics"
    ]


class SampleLLMResponses:

    CHUNKING_RESPONSES = {
        "financial": "split_after: 2, 4, 6",
        "technical": "split_after: 1, 3, 5, 7",
        "legal": "split_after: 2, 5, 8, 11"
    }

    CONTEXT_RESPONSES = {
        "financial": "This financial data represents Q3 2024 performance metrics showing strong revenue growth and improved profitability across business segments.",
        "technical": "This technical information describes the system architecture and performance characteristics of the RAG platform.",
        "legal": "This legal content outlines the terms and conditions governing the use of the service platform."
    }

    METADATA_RESPONSES = {
        "financial": {
            "keywords": ["revenue", "growth", "Q3", "2024", "financial"],
            "topics": ["financial performance", "quarterly results"],
            "entities": ["Q3 2024"],
            "document_type": "financial_report"
        },
        "technical": {
            "keywords": ["system", "architecture", "RAG", "performance"],
            "topics": ["technical documentation", "system design"],
            "entities": ["RAG system", "HNSW"],
            "document_type": "technical_manual"
        },
        "legal": {
            "keywords": ["terms", "service", "agreement", "license"],
            "topics": ["legal terms", "service agreement"],
            "entities": ["Company", "User"],
            "document_type": "legal_document"
        }
    }


def get_sample_document_data() -> List[Dict[str, Any]]:
    return [
        {
            "id": "doc-financial-1",
            "title": "Q3 2024 Financial Report",
            "content": SampleDocuments.FINANCIAL_REPORT,
            "chunks": SampleChunks.get_financial_chunks(),
            "metadata": SampleMetadata.get_financial_metadata(),
            "embeddings": SampleEmbeddings.get_financial_embeddings(),
            "access_level": "MANAGERS",
            "document_type": "financial_report"
        },
        {
            "id": "doc-technical-1",
            "title": "System Architecture Documentation",
            "content": SampleDocuments.TECHNICAL_MANUAL,
            "chunks": SampleChunks.get_technical_chunks(),
            "metadata": SampleMetadata.get_technical_metadata(),
            "embeddings": SampleEmbeddings.get_technical_embeddings(),
            "access_level": "GROUP",
            "group_id": "engineering-group-1",
            "document_type": "technical_manual"
        },
        {
            "id": "doc-legal-1",
            "title": "Terms of Service Agreement",
            "content": SampleDocuments.LEGAL_DOCUMENT,
            "chunks": ["Legal chunk 1", "Legal chunk 2", "Legal chunk 3"],
            "metadata": [{"keywords": ["terms", "service"], "topics": ["legal"], "entities": [], "document_type": "legal"}],
            "embeddings": [SampleEmbeddings.generate_deterministic_embedding("Legal chunk 1")],
            "access_level": "PUBLIC",
            "document_type": "legal_document"
        }
    ]
