"""
Verify test user credentials
"""
import sys
sys.path.append('.')

from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import verify_password

def verify_test_user():
    db = SessionLocal()
    
    try:
        # Find user by email
        user = db.query(User).filter(User.email == "kmkbasic@gmail.com").first()
        
        if not user:
            print("❌ User not found in database!")
            return
        
        print("✅ User found in database:")
        print(f"   ID: {user.id}")
        print(f"   Username: {user.username}")
        print(f"   Email: {user.email}")
        print(f"   Full Name: {user.full_name}")
        print(f"   Is Active: {user.is_active}")
        print(f"   Hashed Password: {user.hashed_password[:50]}...")
        
        # Test password verification
        test_password = "kmkbhai93"
        is_valid = verify_password(test_password, user.hashed_password)
        
        print(f"\n🔐 Password Verification:")
        print(f"   Test Password: {test_password}")
        print(f"   Is Valid: {is_valid}")
        
        if is_valid:
            print("\n✅ Password verification successful! Login should work.")
        else:
            print("\n❌ Password verification failed! There's an issue with password hashing.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("Verifying test user credentials...\n")
    verify_test_user()
