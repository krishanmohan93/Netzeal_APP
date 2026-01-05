"""
Chat System Test Suite
Tests all chat endpoints and WebSocket functionality
"""
import pytest # type: ignore
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import json

from app.main import app
from app.core.database import Base, get_db
from app.models.user import User
from app.models.chat import Conversation, Message, ConversationParticipant
from app.routers.auth import create_access_token

# Test database URL (use in-memory SQLite for testing)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture
async def test_db():
    """Create test database"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    AsyncTestSession = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with AsyncTestSession() as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest.fixture
async def test_users(test_db):
    """Create test users"""
    user1 = User(
        username="alice",
        email="alice@example.com",
        hashed_password="hashed_password_1",
        full_name="Alice Smith"
    )
    user2 = User(
        username="bob",
        email="bob@example.com",
        hashed_password="hashed_password_2",
        full_name="Bob Johnson"
    )
    
    test_db.add_all([user1, user2])
    await test_db.commit()
    await test_db.refresh(user1)
    await test_db.refresh(user2)
    
    return user1, user2

@pytest.fixture
def auth_headers(test_users):
    """Generate auth headers for test users"""
    user1, user2 = test_users
    
    token1 = create_access_token({"sub": user1.username, "user_id": user1.id})
    token2 = create_access_token({"sub": user2.username, "user_id": user2.id})
    
    return {
        "user1": {"Authorization": f"Bearer {token1}"},
        "user2": {"Authorization": f"Bearer {token2}"}
    }

def test_create_conversation(auth_headers, test_users):
    """Test creating a new conversation"""
    client = TestClient(app)
    user1, user2 = test_users
    
    response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers["user1"],
        json={
            "type": "direct",
            "participant_ids": [user2.id]
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "direct"
    assert len(data["participants"]) == 2

def test_list_conversations(auth_headers):
    """Test listing user's conversations"""
    client = TestClient(app)
    
    response = client.get(
        "/api/v1/chat/conversations",
        headers=auth_headers["user1"]
    )
    
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_send_message(auth_headers, test_users):
    """Test sending a text message"""
    client = TestClient(app)
    user1, user2 = test_users
    
    # Create conversation first
    conv_response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers["user1"],
        json={
            "type": "direct",
            "participant_ids": [user2.id]
        }
    )
    conversation_id = conv_response.json()["id"]
    
    # Send message
    response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers["user1"],
        data={
            "content": "Hello, Bob!",
            "message_type": "text"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Hello, Bob!"
    assert data["sender_id"] == user1.id

def test_get_messages_with_pagination(auth_headers, test_users):
    """Test retrieving messages with cursor pagination"""
    client = TestClient(app)
    user1, user2 = test_users
    
    # Create conversation and send multiple messages
    conv_response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers["user1"],
        json={
            "type": "direct",
            "participant_ids": [user2.id]
        }
    )
    conversation_id = conv_response.json()["id"]
    
    # Send 5 messages
    for i in range(5):
        client.post(
            f"/api/v1/chat/conversations/{conversation_id}/messages",
            headers=auth_headers["user1"],
            data={
                "content": f"Message {i}",
                "message_type": "text"
            }
        )
    
    # Get messages
    response = client.get(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers["user1"],
        params={"limit": 3}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 3
    assert data["has_more"] == True
    assert data["next_cursor"] is not None

def test_mark_message_read(auth_headers, test_users):
    """Test marking a message as read"""
    client = TestClient(app)
    user1, user2 = test_users
    
    # Create conversation and message
    conv_response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers["user1"],
        json={
            "type": "direct",
            "participant_ids": [user2.id]
        }
    )
    conversation_id = conv_response.json()["id"]
    
    msg_response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers["user1"],
        data={
            "content": "Test message",
            "message_type": "text"
        }
    )
    message_id = msg_response.json()["id"]
    
    # Mark as read by user2
    response = client.post(
        f"/api/v1/chat/messages/{message_id}/read",
        headers=auth_headers["user2"]
    )
    
    assert response.status_code == 200
    assert response.json()["success"] == True

def test_edit_message(auth_headers, test_users):
    """Test editing a message"""
    client = TestClient(app)
    user1, user2 = test_users
    
    # Create conversation and message
    conv_response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers["user1"],
        json={
            "type": "direct",
            "participant_ids": [user2.id]
        }
    )
    conversation_id = conv_response.json()["id"]
    
    msg_response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers["user1"],
        data={
            "content": "Original message",
            "message_type": "text"
        }
    )
    message_id = msg_response.json()["id"]
    
    # Edit message
    response = client.put(
        f"/api/v1/chat/messages/{message_id}",
        headers=auth_headers["user1"],
        json={"content": "Edited message"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Edited message"
    assert data["is_edited"] == True

def test_delete_message(auth_headers, test_users):
    """Test deleting a message"""
    client = TestClient(app)
    user1, user2 = test_users
    
    # Create conversation and message
    conv_response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers["user1"],
        json={
            "type": "direct",
            "participant_ids": [user2.id]
        }
    )
    conversation_id = conv_response.json()["id"]
    
    msg_response = client.post(
        f"/api/v1/chat/conversations/{conversation_id}/messages",
        headers=auth_headers["user1"],
        data={
            "content": "Message to delete",
            "message_type": "text"
        }
    )
    message_id = msg_response.json()["id"]
    
    # Delete message
    response = client.delete(
        f"/api/v1/chat/messages/{message_id}",
        headers=auth_headers["user1"]
    )
    
    assert response.status_code == 200
    assert response.json()["success"] == True

def test_unauthorized_access(auth_headers, test_users):
    """Test that unauthorized users can't access conversations"""
    client = TestClient(app)
    
    # User1 creates conversation with User2
    user1, user2 = test_users
    conv_response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers["user1"],
        json={
            "type": "direct",
            "participant_ids": [user2.id]
        }
    )
    conversation_id = conv_response.json()["id"]
    
    # Try to access without auth
    response = client.get(
        f"/api/v1/chat/conversations/{conversation_id}/messages"
    )
    
    assert response.status_code == 401

def test_group_conversation(auth_headers, test_users):
    """Test creating a group conversation"""
    client = TestClient(app)
    user1, user2 = test_users
    
    response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers["user1"],
        json={
            "type": "group",
            "title": "Team Discussion",
            "participant_ids": [user2.id]
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "group"
    assert data["title"] == "Team Discussion"

def test_conversation_unread_count(auth_headers, test_users):
    """Test unread message count in conversation"""
    client = TestClient(app)
    user1, user2 = test_users
    
    # Create conversation
    conv_response = client.post(
        "/api/v1/chat/conversations",
        headers=auth_headers["user1"],
        json={
            "type": "direct",
            "participant_ids": [user2.id]
        }
    )
    conversation_id = conv_response.json()["id"]
    
    # User1 sends 3 messages
    for i in range(3):
        client.post(
            f"/api/v1/chat/conversations/{conversation_id}/messages",
            headers=auth_headers["user1"],
            data={
                "content": f"Message {i}",
                "message_type": "text"
            }
        )
    
    # User2 checks conversation (should have 3 unread)
    response = client.get(
        f"/api/v1/chat/conversations/{conversation_id}",
        headers=auth_headers["user2"]
    )
    
    assert response.status_code == 200
    assert response.json()["unread_count"] == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
