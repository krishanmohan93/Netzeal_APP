# Authentication System Documentation

## Overview

NetZeal now uses a modern, production-ready authentication system with:

1. **Email + Password Authentication** - Traditional email/password login and registration
2. **Google OAuth** - Sign in with Google for seamless authentication

All phone-based and OTP authentication has been completely removed.

## Backend Setup

### 1. Database Migration

The authentication system requires a database schema update. Run the Alembic migration:

```bash
cd backend
alembic upgrade head
```

This migration:
- Removes `phone_number` and `firebase_uid` columns
- Adds `auth_provider` column (values: 'email' or 'google')
- Adds `provider_id` column for OAuth provider IDs
- Adds `google_refresh_token` column for token refresh

### 2. Environment Variables

Add these to your `.env` file:

```bash
# Google OAuth (required for Google sign-in)
GOOGLE_CLIENT_ID=your-google-client-id-from-gcp-console
GOOGLE_CLIENT_SECRET=your-google-client-secret-from-gcp-console

# Existing JWT config (update if needed)
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=90
```

### 3. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable OAuth 2.0 APIs
4. Create OAuth 2.0 Client ID for:
   - **Web Application** (for backend token verification)
   - **Android** (for Expo app - use package name: `com.netzeal.app`)
   - **iOS** (if building native app)
5. Copy Client ID and Secret to `.env`

## Backend API Endpoints

All endpoints are under `/api/v1/auth`

### Authentication Endpoints

#### 1. Register (Email + Password)

```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePassword123",
  "full_name": "John Doe"
}

Response (201):
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "full_name": "John Doe",
    "auth_provider": "email",
    ...
  }
}
```

#### 2. Login (Email + Password)

```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}

Response (200): Same as register
```

#### 3. Google Sign-In

```
POST /auth/google
Content-Type: application/json

{
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}

Response (200):
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": 2,
    "email": "user@gmail.com",
    "username": "user_generated_username",
    "full_name": "Google User Name",
    "auth_provider": "google",
    "profile_photo": "https://...",
    ...
  },
  "is_new_user": true
}
```

#### 4. Refresh Token

```
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}

Response (200): New tokens
```

#### 5. Get Current User Profile

```
GET /auth/me
Authorization: Bearer {access_token}

Response (200):
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "auth_provider": "email",
  "full_name": "John Doe",
  "bio": "My bio",
  "profile_photo": "https://...",
  ...
  "followers_count": 150,
  "following_count": 250,
  "posts_count": 42
}
```

#### 6. Logout

```
POST /auth/logout
Authorization: Bearer {access_token}

Response (200):
{
  "message": "Logged out successfully"
}
```

## Frontend Integration

### 1. AuthContext Setup

The `AuthContext` provides all authentication functions. Import and use it:

```javascript
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, loading, isAuthenticated, login, register, logout } = useAuth();
  
  return (
    // Your JSX
  );
}
```

### 2. Email Registration

```javascript
const { register } = useAuth();

const handleRegister = async () => {
  const result = await register(
    'user@example.com',
    'johndoe',
    'SecurePassword123',
    'John Doe'
  );
  
  if (result.success) {
    // User logged in automatically, navigate to home
    navigation.navigate('Main');
  } else {
    Alert.alert('Error', result.error);
  }
};
```

### 3. Email Login

```javascript
const { login } = useAuth();

const handleLogin = async () => {
  const result = await login(
    'user@example.com',
    'SecurePassword123'
  );
  
  if (result.success) {
    navigation.navigate('Main');
  } else {
    Alert.alert('Error', result.error);
  }
};
```

### 4. Google Sign-In Integration

Install Google Sign-In library:

```bash
# For Expo projects:
expo install @react-oauth/google
# or
expo install expo-google-app-auth
```

Implement Google sign-in:

```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuth } from '../context/AuthContext';

const handleGoogleSignIn = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const { idToken } = await GoogleSignin.signIn();
    
    const { googleSignIn } = useAuth();
    const result = await googleSignIn(idToken);
    
    if (result.success) {
      if (result.isNewUser) {
        // First time user - show onboarding
        navigation.navigate('Onboarding');
      } else {
        // Existing user - go to home
        navigation.navigate('Main');
      }
    }
  } catch (error) {
    console.error('Google sign-in failed:', error);
  }
};
```

### 5. Token Management

Tokens are automatically saved to secure storage:

```javascript
const { tokens, refreshAccessToken } = useAuth();

// Access token (for API requests)
const accessToken = tokens.access;

// Refresh token (for getting new access tokens)
const refreshToken = tokens.refresh;

// Manually refresh token if needed
const isValid = await refreshAccessToken();
```

### 6. Logout

```javascript
const { logout } = useAuth();

const handleLogout = async () => {
  const result = await logout();
  if (result.success) {
    navigation.navigate('Login');
  }
};
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  public_id UUID UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  hashed_password VARCHAR(255),  -- NULL for Google users
  
  -- Authentication
  auth_provider VARCHAR(50) NOT NULL DEFAULT 'email',  -- 'email' or 'google'
  provider_id VARCHAR(255) UNIQUE,  -- Google ID
  google_refresh_token VARCHAR(500),  -- For token refresh
  
  -- Profile
  full_name VARCHAR(255),
  bio TEXT,
  profile_photo VARCHAR(500),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Best Practices

1. **Password Hashing**: Bcrypt is used with salt rounds = 10
2. **JWT Tokens**: Signed with HS256 algorithm
3. **Token Expiry**: 
   - Access tokens: 60 minutes (configurable)
   - Refresh tokens: 90 days (configurable)
4. **Token Storage**: 
   - Stored in secure storage (Secure Enclave on iOS, Keystore on Android)
   - Never stored in AsyncStorage
5. **HTTPS Only**: All API calls must use HTTPS in production
6. **Token Refresh**: Implement automatic token refresh before expiry

## User Flow Diagrams

### Email Registration Flow

```
User enters: email, username, password, full name
        ↓
Validation (client-side)
        ↓
POST /auth/register
        ↓
Server validates uniqueness
        ↓
Hash password with bcrypt
        ↓
Create user in DB with auth_provider='email'
        ↓
Generate access & refresh tokens
        ↓
Store tokens in secure storage (frontend)
        ↓
Navigate to home
```

### Email Login Flow

```
User enters: email, password
        ↓
POST /auth/login
        ↓
Find user by email
        ↓
Verify password hash
        ↓
Generate tokens
        ↓
Store tokens in secure storage
        ↓
Navigate to home
```

### Google Sign-In Flow

```
User taps "Sign in with Google"
        ↓
Google Sign-In library opens Google dialog
        ↓
User authenticates with Google
        ↓
Get ID token from Google
        ↓
POST /auth/google with ID token
        ↓
Server verifies ID token with Google
        ↓
Check if user exists by provider_id or email
        ↓
If new user: create in DB with auth_provider='google'
If exists: update provider_id if needed
        ↓
Generate access & refresh tokens
        ↓
Store tokens in secure storage
        ↓
Navigate to home (or onboarding if new)
```

## Linking Email + Google Accounts

When a user signs in with Google using the same email as their email account:

1. They are logged into their existing email account
2. The `provider_id` is updated with their Google ID
3. On future logins, they can use either email or Google
4. The `auth_provider` remains 'email' (priority) but both methods work

## Troubleshooting

### Google Token Verification Fails

- Verify `GOOGLE_CLIENT_ID` matches your Google Console project
- Check token hasn't expired
- Ensure `id_token` is being passed (not `access_token`)

### Tokens Not Persisting

- Verify `expo-secure-store` is properly configured
- Check for platform-specific permissions in `app.json`
- Ensure `AsyncStorage` and `SecureStore` libraries are installed

### Login Shows "Invalid Email or Password"

- Password hashing uses Bcrypt - very strict
- Check user exists in database
- Verify password is correct (case-sensitive)

### Expired Token Not Refreshing

- Call `refreshAccessToken()` manually before making API calls
- Or implement interceptor in API service
- Check refresh token hasn't expired (90 days default)

## Migration from Old System

If migrating from Firebase phone auth:

1. Run the database migration
2. Existing users will have `auth_provider=NULL` or `auth_provider='email'`
3. These users can reset password or sign in with Google to continue
4. Phone numbers are completely removed
5. No OTP functionality available

## Next Steps

1. Update `.env` with Google OAuth credentials
2. Run database migration: `alembic upgrade head`
3. Rebuild frontend app: `expo prebuild --clean`
4. Test registration and login flows
5. Test Google sign-in integration
6. Deploy to production

---

**Last Updated**: February 5, 2026
**Version**: 2.0 (Email + Google OAuth)
