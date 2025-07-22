import sys
import os
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

load_dotenv(dotenv_path=os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env.test')))

import asyncio
import pytest
import asyncpg
from httpx import AsyncClient
from typing import AsyncGenerator, Dict, Any, List
import json
from pathlib import Path
import logging

os.environ["APP_ENV"] = "test"

from app.main import app
from app.config import get_settings
from app.services.database_service import database_service

settings = get_settings()
logger = logging.getLogger(__name__)

@pytest.fixture(scope="function")
def event_loop():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop

    try:
        pending = asyncio.all_tasks(loop)
        if pending:
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
    except Exception as e:
        logger.warning(f"Error waiting for pending tasks: {e}")
    finally:
        loop.close()

@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    try:
        conn = await asyncpg.connect(settings.DATABASE_URL.replace("/teamquery_test", "/postgres"))
        await conn.execute("CREATE DATABASE teamquery_test")
        await conn.close()
        print("Created test database.")
    except asyncpg.exceptions.DuplicateDatabaseError:
        print("Test database already exists.")
        pass

    yield

    try:
        from app.services.cleanup_manager import cleanup_manager
        await cleanup_manager.cleanup_all_services()
        logger.info("Completed cleanup of all singleton services")
    except Exception as e:
        logger.error(f"Error during service cleanup: {e}")

    try:
        conn = await asyncpg.connect(settings.DATABASE_URL.replace("/teamquery_test", "/postgres"))
        await conn.execute("DROP DATABASE teamquery_test WITH (FORCE)")
        await conn.close()
        print("Dropped test database.")
    except Exception as e:
        print(f"Could not drop test database: {e}")


@pytest.fixture(scope="function")
async def test_db():
    """Function-scoped fixture that ensures fresh database connection for each test."""
    if database_service.pool:
        try:
            await database_service.disconnect()
        except Exception as e:
            logger.warning(f"Error disconnecting existing pool: {e}")
        database_service.pool = None

    await database_service.connect()

    yield

    try:
        await database_service.disconnect()
    except Exception as e:
        logger.warning(f"Database disconnect failed: {e}")
    database_service.pool = None


@pytest.fixture(scope="function")
async def test_client() -> AsyncGenerator[AsyncClient, None]:
    """Fixture for an async test client."""
    from httpx import ASGITransport
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

@pytest.fixture(scope="session")
def assets_path() -> Path:
    """Provides the path to the test assets directory."""
    return Path(__file__).parent / "assets"

@pytest.fixture(scope="session")
def test_documents(assets_path: Path) -> List[Dict[str, Any]]:
    """Loads the test document manifest."""
    manifest_path = assets_path / "manifest.json"
    with open(manifest_path, "r") as f:
        return json.load(f)

@pytest.fixture(scope="function")
async def test_organization(test_db) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Creates a default organization, user, and groups for testing.
    Cleans up created data after the test.
    """
    user_id = "test-admin-user-id"
    org_id = "test-org-id"
    default_group_id = "default"
    group_a_id = "test-group-a"
    group_b_id = "test-group-b"

    async with database_service.pool.acquire() as conn:
        # Create User
        await conn.execute(
            "INSERT INTO \"User\" (id, email, password, name, \"createdAt\", \"updatedAt\") VALUES ($1, 'admin@test.com', 'password', 'Admin User', NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
            user_id
        )

        # Create Organization
        await conn.execute(
            "INSERT INTO \"Organization\" (id, name, \"adminUserId\", \"createdAt\", \"updatedAt\") VALUES ($1, 'Test Org', $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
            org_id, user_id
        )

        # Create Groups
        await conn.execute(
            "INSERT INTO \"Group\" (id, name, \"organizationId\", \"createdAt\", \"updatedAt\") VALUES ($1, 'Default Group', $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
            default_group_id, org_id
        )
        await conn.execute(
            "INSERT INTO \"Group\" (id, name, \"organizationId\", \"createdAt\", \"updatedAt\") VALUES ($1, 'Group A', $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
            group_a_id, org_id
        )
        await conn.execute(
            "INSERT INTO \"Group\" (id, name, \"organizationId\", \"createdAt\", \"updatedAt\") VALUES ($1, 'Group B', $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
            group_b_id, org_id
        )

        # Create Memberships
        await conn.execute(
            "INSERT INTO \"OrganizationMembership\" (id, \"userId\", \"organizationId\", role, \"createdAt\", \"updatedAt\") VALUES ('org-membership-1', $1, $2, 'ADMIN', NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
            user_id, org_id
        )
        await conn.execute(
            "INSERT INTO \"GroupMembership\" (id, \"userId\", \"groupId\", \"joinedAt\", \"updatedAt\") VALUES ('group-membership-a', $1, $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
            user_id, group_a_id
        )

    try:
        yield {
            "org_id": org_id,
            "user_id": user_id,
            "groups": {
                "default": default_group_id,
                "GROUP_A": group_a_id,
                "GROUP_B": group_b_id,
            }
        }
    finally:
        try:
            async with database_service.pool.acquire() as conn:
                await conn.execute("DELETE FROM \"GroupMembership\" WHERE \"userId\" = $1", user_id)
                await conn.execute("DELETE FROM \"OrganizationMembership\" WHERE \"userId\" = $1", user_id)
                await conn.execute("DELETE FROM \"Group\" WHERE \"organizationId\" = $1", org_id)
                await conn.execute("DELETE FROM \"Organization\" WHERE id = $1", org_id)
                await conn.execute("DELETE FROM \"User\" WHERE id = $1", user_id)
        except Exception as cleanup_error:
            logger.error(f"Cleanup failed: {cleanup_error}")


@pytest.fixture(scope="function")
async def mock_search_data(test_organization: Dict[str, Any]) -> AsyncGenerator[Dict[str, Any], None]:
    from tests.fixtures.mock_search_data import insert_mock_search_data, cleanup_mock_search_data

    org_id = test_organization["org_id"]
    group_mapping = test_organization["groups"]

    mock_data = await insert_mock_search_data(org_id, group_mapping)

    try:
        yield mock_data
    finally:
        try:
            await cleanup_mock_search_data(org_id)
        except Exception as cleanup_error:
            logger.error(f"Mock search data cleanup failed: {cleanup_error}")
