import asyncio
from app.core.database import async_session
from sqlalchemy import text

async def check_tables():
    async with async_session() as session:
        # For Postgres
        result = await session.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
        tables = [row[0] for row in result.fetchall()]
        print("Tables:", tables)
        
        # Check if connections table exists
        if 'connections' in tables:
            print("✅ 'connections' table exists")
            # Check columns
            cols = await session.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'connections'"))
            print("Columns in 'connections':")
            for col in cols.fetchall():
                print(f" - {col[0]}: {col[1]}")
        else:
            print("❌ 'connections' table MISSING!")

if __name__ == "__main__":
    import sys
    import os
    # Add backend to path
    sys.path.append(os.getcwd())
    
    # Run
    asyncio.run(check_tables())
