import numpy as np
from typing import Dict, List, Any
import uuid

EMBEDDING_DIM = 1536

def generate_mock_embedding(seed: int = None) -> List[float]:
    if seed is not None:
        np.random.seed(seed)
    vector = np.random.randn(EMBEDDING_DIM)
    vector = vector / np.linalg.norm(vector)
    return vector.tolist()

MOCK_CHUNKS_DATA = [
    {
        "id": "chunk-public-1",
        "content": "This is a public document about company policies. Everyone can access this information about our general guidelines and procedures.",
        "metadata": {
            "accessLevel": "PUBLIC",
            "groupId": None,
            "restrictedToUsers": None,
            "keywords": ["policies", "guidelines", "procedures", "company"],
            "topics": ["company policies", "general information"],
            "entities": ["company"],
            "documentType": "policy"
        },
        "embedding_seed": 1
    },
    {
        "id": "chunk-public-2",
        "content": "Public announcement regarding office hours and general contact information. This information is available to all team members.",
        "metadata": {
            "accessLevel": "PUBLIC",
            "groupId": None,
            "restrictedToUsers": None,
            "keywords": ["office", "hours", "contact", "announcement"],
            "topics": ["office information", "contact details"],
            "entities": ["office"],
            "documentType": "announcement"
        },
        "embedding_seed": 2
    },
    {
        "id": "chunk-group-a-1",
        "content": "Group A specific document containing sensitive project information. This includes technical specifications and implementation details for Project Alpha.",
        "metadata": {
            "accessLevel": "GROUP",
            "groupId": "GROUP_A",
            "restrictedToUsers": None,
            "keywords": ["project", "technical", "specifications", "alpha"],
            "topics": ["project management", "technical details"],
            "entities": ["Project Alpha"],
            "documentType": "technical"
        },
        "embedding_seed": 3
    },
    {
        "id": "chunk-group-a-2",
        "content": "Additional Group A documentation about project timelines and resource allocation. Contains budget information and team assignments.",
        "metadata": {
            "accessLevel": "GROUP",
            "groupId": "GROUP_A",
            "restrictedToUsers": None,
            "keywords": ["timeline", "resources", "budget", "assignments"],
            "topics": ["project planning", "resource management"],
            "entities": ["budget", "team"],
            "documentType": "planning"
        },
        "embedding_seed": 4
    },
    {
        "id": "chunk-group-b-1",
        "content": "Group B exclusive content about marketing strategies and customer data analysis. This document contains confidential market research.",
        "metadata": {
            "accessLevel": "GROUP",
            "groupId": "GROUP_B",
            "restrictedToUsers": None,
            "keywords": ["marketing", "customer", "analysis", "research"],
            "topics": ["marketing strategy", "data analysis"],
            "entities": ["customers", "market"],
            "documentType": "research"
        },
        "embedding_seed": 5
    },
    {
        "id": "chunk-managers-1",
        "content": "Manager-level document discussing performance reviews and salary adjustments. Contains sensitive HR information for management review.",
        "metadata": {
            "accessLevel": "MANAGERS",
            "groupId": None,
            "restrictedToUsers": None,
            "keywords": ["performance", "salary", "reviews", "HR"],
            "topics": ["human resources", "performance management"],
            "entities": ["HR", "management"],
            "documentType": "hr"
        },
        "embedding_seed": 6
    },
    {
        "id": "chunk-admins-1",
        "content": "Administrative document containing system configurations and security protocols. Only administrators should have access to this information.",
        "metadata": {
            "accessLevel": "ADMINS",
            "groupId": None,
            "restrictedToUsers": None,
            "keywords": ["system", "configuration", "security", "protocols"],
            "topics": ["system administration", "security"],
            "entities": ["system", "security"],
            "documentType": "admin"
        },
        "embedding_seed": 7
    },
    {
        "id": "chunk-restricted-1",
        "content": "Highly restricted document with confidential financial data and strategic plans. Access limited to specific users only.",
        "metadata": {
            "accessLevel": "RESTRICTED",
            "groupId": None,
            "restrictedToUsers": ["test-user-restricted"],
            "keywords": ["financial", "strategic", "confidential", "plans"],
            "topics": ["financial planning", "strategy"],
            "entities": ["financial data"],
            "documentType": "financial"
        },
        "embedding_seed": 8
    }
]
MOCK_DOCUMENTS_DATA = [
    {
        "id": "doc-public-1",
        "title": "Company Policies Document",
        "accessLevel": "PUBLIC",
        "groupId": None,
        "restrictedToUsers": None,
        "chunk_ids": ["chunk-public-1", "chunk-public-2"]
    },
    {
        "id": "doc-group-a-1",
        "title": "Project Alpha Documentation",
        "accessLevel": "GROUP",
        "groupId": "GROUP_A",
        "restrictedToUsers": None,
        "chunk_ids": ["chunk-group-a-1", "chunk-group-a-2"]
    },
    {
        "id": "doc-group-b-1",
        "title": "Marketing Research Report",
        "accessLevel": "GROUP",
        "groupId": "GROUP_B",
        "restrictedToUsers": None,
        "chunk_ids": ["chunk-group-b-1"]
    },
    {
        "id": "doc-managers-1",
        "title": "HR Management Guidelines",
        "accessLevel": "MANAGERS",
        "groupId": None,
        "restrictedToUsers": None,
        "chunk_ids": ["chunk-managers-1"]
    },
    {
        "id": "doc-admins-1",
        "title": "System Administration Manual",
        "accessLevel": "ADMINS",
        "groupId": None,
        "restrictedToUsers": None,
        "chunk_ids": ["chunk-admins-1"]
    },
    {
        "id": "doc-restricted-1",
        "title": "Confidential Financial Report",
        "accessLevel": "RESTRICTED",
        "groupId": None,
        "restrictedToUsers": ["test-user-restricted"],
        "chunk_ids": ["chunk-restricted-1"]
    }
]

def prepare_mock_data_for_org(org_id: str, group_mapping: Dict[str, str]) -> Dict[str, Any]:
    documents = []
    chunks = []
    embeddings = []

    for doc_data in MOCK_DOCUMENTS_DATA:
        doc = {
            "id": doc_data["id"],
            "organizationId": org_id,
            "title": doc_data["title"],
            "accessLevel": doc_data["accessLevel"],
            "groupId": group_mapping.get(doc_data["groupId"]) if doc_data["groupId"] else None,
            "restrictedToUsers": doc_data["restrictedToUsers"],
            "isDeleted": False,
            "createdAt": "NOW()",
            "updatedAt": "NOW()"
        }
        documents.append(doc)

    for chunk_data in MOCK_CHUNKS_DATA:
        doc_data = next(doc for doc in MOCK_DOCUMENTS_DATA if chunk_data["id"] in doc["chunk_ids"])

        metadata = chunk_data["metadata"].copy()
        if metadata["groupId"] and metadata["groupId"] in group_mapping:
            metadata["groupId"] = group_mapping[metadata["groupId"]]

        chunk = {
            "id": chunk_data["id"],
            "documentId": doc_data["id"],
            "organizationId": org_id,
            "content": chunk_data["content"],
            "metadata": metadata,
            "isDeleted": False,
            "createdAt": "NOW()",
            "updatedAt": "NOW()"
        }
        chunks.append(chunk)

        embedding = {
            "id": f"emb-{chunk_data['id']}",
            "chunkId": chunk_data["id"],
            "documentId": doc_data["id"],
            "organizationId": org_id,
            "vector": generate_mock_embedding(chunk_data["embedding_seed"]),
            "isDeleted": False,
            "createdAt": "NOW()",
            "updatedAt": "NOW()"
        }
        embeddings.append(embedding)

    return {
        "documents": documents,
        "chunks": chunks,
        "embeddings": embeddings
    }

TEST_USERS = {
    "public_user": {
        "userId": "test-user-public",
        "userRole": "MEMBER",
        "userGroupIds": []
    },
    "group_a_member": {
        "userId": "test-user-group-a",
        "userRole": "MEMBER",
        "userGroupIds": ["GROUP_A"]
    },
    "group_b_member": {
        "userId": "test-user-group-b",
        "userRole": "MEMBER",
        "userGroupIds": ["GROUP_B"]
    },
    "manager": {
        "userId": "test-user-manager",
        "userRole": "MANAGER",
        "userGroupIds": ["GROUP_A"]
    },
    "admin": {
        "userId": "test-user-admin",
        "userRole": "ADMIN",
        "userGroupIds": ["GROUP_A", "GROUP_B"]
    },
    "restricted_user": {
        "userId": "test-user-restricted",
        "userRole": "MEMBER",
        "userGroupIds": []
    }
}

def prepare_test_users(group_mapping: Dict[str, str]) -> Dict[str, Dict[str, Any]]:
    users = {}
    for user_key, user_data in TEST_USERS.items():
        user = user_data.copy()
        user["userGroupIds"] = [
            group_mapping.get(group_id, group_id)
            for group_id in user_data["userGroupIds"]
        ]
        users[user_key] = user

    return users
