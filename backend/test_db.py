import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

async def main():
    engine = create_async_engine(os.getenv("DATABASE_URL"))
    async with AsyncSession(engine) as session:
        # Get first user
        res = await session.execute(text("SELECT id, email FROM users LIMIT 1;"))
        user = res.fetchone()
        if not user:
            print("No users found")
            return
        print(f"Found user: {user.email} ({user.id})")
        
        from app.db.repositories.chat_history_repository import ChatHistoryRepository
        import uuid
        repo = ChatHistoryRepository(session)
        sess_id = uuid.uuid4()
        try:
            msg = await repo.create(
                user_id=user.id,
                session_id=sess_id,
                role="user",
                content="Test message",
                ui_payload=None,
            )
            print("Created message!")
        except Exception as e:
            print("Failed to create message:", e)
        
        sessions = await repo.get_sessions_for_user(user.id)
        print("Sessions for user:", sessions)

if __name__ == "__main__":
    asyncio.run(main())
