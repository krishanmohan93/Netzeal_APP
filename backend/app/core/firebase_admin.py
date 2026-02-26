"""
Firebase Admin SDK Configuration
Initialize Firebase Admin for backend token verification
"""
import firebase_admin
from firebase_admin import credentials, auth
import os
import json

from .config import settings

# Flag to check if Firebase Admin is initialized
_firebase_initialized = False


def initialize_firebase_admin():
    """
    Initialize Firebase Admin SDK
    
    Uses FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_KEY env variables.
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
    
    service_account_json = settings.FIREBASE_SERVICE_ACCOUNT_JSON or os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    service_account_path = settings.FIREBASE_SERVICE_ACCOUNT_KEY or os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")

    if service_account_json:
        key_data = json.loads(service_account_json)
        private_key = key_data.get("private_key")
        if private_key and "\\n" in private_key:
            key_data["private_key"] = private_key.replace("\\n", "\n")
        cred = credentials.Certificate(key_data)
    elif service_account_path and os.path.exists(service_account_path):
        cred = credentials.Certificate(str(service_account_path))
    else:
        raise FileNotFoundError(
            "Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_KEY."
        )

    # Initialize Firebase Admin
    firebase_admin.initialize_app(cred)
    _firebase_initialized = True
    print("Firebase Admin SDK initialized successfully")


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
