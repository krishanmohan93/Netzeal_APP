from app.core.database import SessionLocal, engine
from sqlalchemy import text, inspect

def check_tables():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print("Tables detected:", tables)
    
    if 'connections' in tables:
        print("✅ 'connections' table exists")
        columns = inspector.get_columns('connections')
        for column in columns:
            print(f"  - {column['name']}: {column['type']}")
    else:
        print("❌ 'connections' table MISSING")
    
    if 'users' in tables:
        print("✅ 'users' table exists")
        columns = inspector.get_columns('users')
        for column in columns:
            if column['name'] == 'public_id':
                print(f"  - public_id found: {column['type']}")

if __name__ == "__main__":
    import sys
    import os
    sys.path.append(os.getcwd())
    check_tables()
