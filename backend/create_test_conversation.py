"""
Create a test conversation for testing the chat system
Run this to create a valid conversation in the database
"""
import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.chat import Conversation, ConversationParticipant, ConversationType
from datetime import datetime

async def create_test_conversation():
    async with AsyncSessionLocal() as db:
        # Get first two users
        result = await db.execute(select(User).limit(2))
        users = result.scalars().all()
        
        if len(users) < 2:
            print("❌ Need at least 2 users in database. Run create_test_user.py first!")
            return
        
        user1, user2 = users[0], users[1]
        
        # Check if conversation already exists
        existing = await db.execute(
            select(Conversation).where(
                Conversation.id == 1
            )
        )
        if existing.scalar_one_or_none():
            print(f"✅ Conversation already exists!")
            print(f"   Conversation ID: 1")
            print(f"   Participants: {user1.username} & {user2.username}")
            return
        
        # Create conversation
        conversation = Conversation(
            type=ConversationType.DIRECT,
            title=None,  # Direct chats don't need titles
            created_at=datetime.utcnow(),
            last_message_at=datetime.utcnow()
        )
        db.add(conversation)
        await db.flush()
        
        # Add participants
        participant1 = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user1.id,
            joined_at=datetime.utcnow()
        )
        participant2 = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user2.id,
            joined_at=datetime.utcnow()
        )
        db.add(participant1)
        db.add(participant2)
        
        await db.commit()
        
        print(f"✅ Test conversation created!")
        print(f"   Conversation ID: {conversation.id}")
        print(f"   Type: {conversation.type.value}")
        print(f"   Participants:")
        print(f"     - {user1.username} (ID: {user1.id})")
        print(f"     - {user2.username} (ID: {user2.id})")
        print(f"\n✅ You can now test the chat system!")
        print(f"   Open MyWork screen and click on a conversation")

if __name__ == "__main__":
    asyncio.run(create_test_conversation())
