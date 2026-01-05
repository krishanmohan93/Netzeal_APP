"""
Check if user exists in database
Run from backend directory: python check_user.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User

def check_user_exists():
    db = SessionLocal()
    try:
        # Search for user by email
        email = "kmkbasic@gmail.com"
        print(f"Searching for user with email: {email}")
        
        user = db.query(User).filter(User.email.ilike(f"%{email}%")).first()
        
        if user:
            print(f"\n✅ User found!")
            print(f"   ID: {user.id}")
            print(f"   Public ID: {user.public_id}")
            print(f"   Username: {user.username}")
            print(f"   Email: {user.email}")
            print(f"   Full Name: {user.full_name}")
            print(f"   Profile Photo: {user.profile_photo}")
        else:
            print(f"\n❌ No user found with email: {email}")
            
            # List all users
            print("\nAll users in database:")
            all_users = db.query(User).limit(10).all()
            for u in all_users:
                print(f"   - {u.username} ({u.email})")
                
    finally:
        db.close()

if __name__ == "__main__":
    check_user_exists()
