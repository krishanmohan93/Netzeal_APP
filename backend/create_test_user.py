"""
Create test user for NetZeal app
"""
import sys
sys.path.append('.')

from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def create_test_user():
    db = SessionLocal()
    
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == "kmkbasic@gmail.com").first()
        if existing_user:
            print("✅ User already exists!")
            print(f"   Username: {existing_user.username}")
            print(f"   Email: {existing_user.email}")
            return
        
        # Create new user
        test_user = User(
            username="kmkbasic",
            email="kmkbasic@gmail.com",
            full_name="KMK Basic",
            hashed_password=get_password_hash("kmkbhai93"),
            is_active=True
        )
        
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        
        print("✅ Test user created successfully!")
        print(f"   Username: {test_user.username}")
        print(f"   Email: {test_user.email}")
        print(f"   Password: kmkbhai93")
        print("\nYou can now login with these credentials!")
        
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating test user...")
    create_test_user()
