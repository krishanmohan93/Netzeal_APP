"""
Firebase Admin SDK Configuration
Initialize Firebase Admin for backend token verification
"""
import firebase_admin
from firebase_admin import credentials, auth
import os
from pathlib import Path

# Flag to check if Firebase Admin is initialized
_firebase_initialized = False


def initialize_firebase_admin():
    """
    Initialize Firebase Admin SDK
    
    Uses serviceAccountKey.json from backend/app/core/ directory
    or from path specified in FIREBASE_SERVICE_ACCOUNT_KEY env variable
    """
    global _firebase_initialized
    
    if _firebase_initialized:
        return
    
    try:
        # Check if already initialized
        firebase_admin.get_app()
        _firebase_initialized = True
        print("Firebase Admin SDK already initialized")
        return
    except ValueError:
        # Not initialized, proceed with initialization
        pass
    
    # Get service account key path
    service_account_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY')
    
    if not service_account_path:
        # Default path: backend/app/core/serviceAccountKey.json
        current_dir = Path(__file__).parent
        service_account_path = current_dir / 'serviceAccountKey.json'
    
    if not os.path.exists(service_account_path):
        raise FileNotFoundError(
            f"Firebase service account key not found at: {service_account_path}\n"
            "Download it from Firebase Console > Project Settings > Service Accounts\n"
            "and place it at backend/app/core/serviceAccountKey.json"
        )
    
    # Initialize Firebase Admin
    cred = credentials.Certificate(str(service_account_path))
    firebase_admin.initialize_app(cred)
    _firebase_initialized = True
    
    print(f"Firebase Admin SDK initialized successfully from: {service_account_path}")


def verify_firebase_token(id_token: str) -> dict:
    """
    Verify Firebase ID token and return decoded token with user info
    
    Args:
        id_token: Firebase ID token from client
    
    Returns:
        dict: Decoded token containing uid, phone_number, etc.
        
    Raises:
        ValueError: If token is invalid or expired
        firebase_admin.auth.InvalidIdTokenError: If token verification fails
    """
    if not _firebase_initialized:
        initialize_firebase_admin()
    
    try:
        # Verify the ID token
        decoded_token = auth.verify_id_token(id_token)
        
        # Extract user information
        user_info = {
            'uid': decoded_token.get('uid'),
            'phone_number': decoded_token.get('phone_number'),
            'email': decoded_token.get('email'),
            'auth_time': decoded_token.get('auth_time'),
            'exp': decoded_token.get('exp'),
        }
        
        return user_info
        
    except auth.InvalidIdTokenError as e:
        raise ValueError(f"Invalid Firebase ID token: {str(e)}")
    except auth.ExpiredIdTokenError as e:
        raise ValueError(f"Expired Firebase ID token: {str(e)}")
    except Exception as e:
        raise ValueError(f"Token verification failed: {str(e)}")


def get_firebase_user(uid: str):
    """
    Get Firebase user by UID
    
    Args:
        uid: Firebase user UID
    
    Returns:
        UserRecord: Firebase user record
    """
    if not _firebase_initialized:
        initialize_firebase_admin()
    
    try:
        return auth.get_user(uid)
    except auth.UserNotFoundError:
        raise ValueError(f"Firebase user not found: {uid}")
    except Exception as e:
        raise ValueError(f"Error fetching Firebase user: {str(e)}")
