# NetZeal Authentication System - Complete Setup Guide

## 🚀 Quick Start

This guide walks you through setting up the new email + Google OAuth authentication system.

## ✅ What's Been Done

- ✅ Backend authentication routes (email + password + Google OAuth)
- ✅ Frontend auth context and UI screens
- ✅ Database migration scripts ready
- ✅ Security implementation with bcrypt + JWT
- ✅ All phone/OTP code removed
- ✅ Environment configuration templates

## 📋 Setup Checklist

### 1. Backend Setup

#### A. Install Dependencies

```bash
cd backend
pip install google-auth google-auth-oauthlib google-auth-httplib2
# OR if using requirements.txt
pip install -r requirements.txt
```

The following packages are already in requirements.txt:
- `google-auth==2.43.0`
- `google-api-core==2.28.1`

#### B. Configure Environment Variables

Create/update `.env` file in `backend/` directory:

```bash
# Database
DATABASE_URL=postgresql://neon_username:neon_password@host.neon.tech:5432/database_name?sslmode=require

# JWT Configuration
SECRET_KEY=generate-with: openssl rand -hex 32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=90

# Google OAuth (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

# Existing configs
NVIDIA_API_KEY=your-key
NVIDIA_API_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_CHAT_MODEL=deepseek-ai/deepseek-r1
CLOUDINARY_CLOUD_NAME=your-name
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

#### C. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "NetZeal Authentication"
3. Enable APIs:
   - Google+ API
   - Google Sign-In API
4. Create OAuth 2.0 Credentials:
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - For Web: Download JSON (for backend)
   - For Android: 
     - Package name: `com.netzeal.app`
     - SHA-1 certificate fingerprint: [Get from your keystore]
5. Copy Client ID and Secret to `.env`

#### D. Run Database Migration

```bash
cd backend

# Check migration status
alembic current

# Run new migration
alembic upgrade head

# Verify tables
psql $DATABASE_URL -c "\d users"
```

Expected columns after migration:
- `auth_provider` (VARCHAR 50)
- `provider_id` (VARCHAR 255)
- `google_refresh_token` (VARCHAR 500)
- ❌ `phone_number` (REMOVED)
- ❌ `firebase_uid` (REMOVED)

#### E. Test Backend Endpoints

```bash
# Start backend
cd backend
python -m uvicorn app.main:app --reload

# Test registration
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "TestPassword123",
    "full_name": "Test User"
  }'

# Expected response (201):
{
  "access_token": "eyJ0eXAi...",
  "refresh_token": "eyJ0eXAi...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": { ... }
}
```

### 2. Frontend Setup

#### A. Install Dependencies

```bash
cd frontend

# Google Sign-In (choose one)
expo install @react-oauth/google
# OR
expo install expo-google-app-auth
```

Verify existing packages:
```bash
npm ls expo-secure-store @react-native-async-storage
```

Should show:
- `expo-secure-store` ✅
- `@react-native-async-storage/async-storage` ✅

#### B. Update Environment Configuration

File: `frontend/src/config/environment.js`

```javascript
const LOCAL_IP = '10.162.205.75';  // Your machine IP
const API_PORT = '8000';
```

#### C. Verify Auth Context

File: `frontend/src/context/AuthContext.js`

Should export:
- `AuthProvider` - Wrapper component
- `useAuth()` - Hook for using auth

```javascript
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, login, register, googleSignIn, logout } = useAuth();
}
```

#### D. Verify Navigation

File: `frontend/src/navigation/AppNavigator.js`

Should have:
- ✅ LoginScreen (email + password)
- ✅ RegisterScreen (email + password)
- ✅ Google OAuth button (ready for integration)
- ❌ PhoneLoginScreen (REMOVED)
- ❌ OTPVerificationScreen (REMOVED)
- ❌ FirebaseAuthProvider (REMOVED)

#### E. Test Frontend

```bash
cd frontend

# Start development server
npm start
# Or
expo start

# On Expo Go app:
# Scan QR code
# Try: Login → Register → Create account
# Verify tokens saved to secure storage
```

### 3. Google Sign-In Integration (Mobile)

#### For React Native with Expo

```bash
expo install expo-google-app-auth
```

**Implementation:**

```javascript
import * as GoogleSignIn from 'expo-google-app-auth';
import { useAuth } from '../context/AuthContext';

const handleGoogleSignIn = async () => {
  try {
    const result = await GoogleSignIn.logInAsync({
      iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
      androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
      scopes: ['email', 'profile'],
    });

    if (result.type === 'success') {
      const { googleSignIn } = useAuth();
      const authResult = await googleSignIn(result.idToken);
      
      if (authResult.success) {
        navigation.navigate('Main');
      }
    }
  } catch (error) {
    console.error('Google Sign-In failed:', error);
  }
};
```

#### For Web Browser (JavaScript)

```bash
npm install @react-oauth/google
```

**Implementation:**

```javascript
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

function LoginPage() {
  const { googleSignIn } = useAuth();

  return (
    <GoogleOAuthProvider clientId="YOUR_CLIENT_ID.apps.googleusercontent.com">
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          const result = await googleSignIn(credentialResponse.credential);
          if (result.success) {
            // Navigate to home
          }
        }}
        onError={() => console.log('Login Failed')}
      />
    </GoogleOAuthProvider>
  );
}
```

### 4. Testing Checklist

#### Backend Tests

- [ ] Registration with email + password
- [ ] Login with email + password
- [ ] Token refresh endpoint works
- [ ] Get current user endpoint works
- [ ] Google token verification (with mock token)
- [ ] Proper error handling for invalid tokens

Test script:

```bash
# In backend directory
python -m pytest tests/ -v

# Or use test files
python tests/test_auth.py
```

#### Frontend Tests

- [ ] Registration screen validates inputs
- [ ] Login screen accepts credentials
- [ ] Tokens saved to secure storage
- [ ] User data persists on app restart
- [ ] Logout clears all data
- [ ] Google button displays (not yet functional until OAuth is set up)
- [ ] Network errors handled gracefully

#### Integration Tests

- [ ] Backend running on `http://10.162.205.75:8000`
- [ ] Frontend can reach backend
- [ ] Create account → Auto login → Navigate to home
- [ ] Logout → Return to login screen
- [ ] Restart app → User still logged in (session restored)

### 5. Environment Variables Summary

#### Backend (.env)

```bash
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
SECRET_KEY=<32-char hex string>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=90
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
```

#### Frontend (src/config/environment.js)

```javascript
const LOCAL_IP = '10.162.205.75';  // Your machine
const API_PORT = '8000';
const TIMEOUT = 30000;
```

#### Google Cloud Console Setup

1. Project: "NetZeal"
2. OAuth Consent Screen: User type = External
3. Authorized redirect URIs:
   - `http://localhost:8000/auth/google/callback`
   - `http://10.162.205.75:8000/auth/google/callback`
4. Client credentials for:
   - Web Application
   - Android (package: `com.netzeal.app`)
   - iOS (if needed)

## 🔐 Security Features

- **Password Hashing**: Bcrypt with 10 salt rounds
- **JWT Tokens**: HS256 signed, 60-min expiry
- **Secure Storage**: 
  - iOS: Keychain
  - Android: Keystore
- **Token Refresh**: Automatic refresh before expiry
- **HTTPS**: Required in production
- **CORS**: Configured for frontend domain

## 📊 Database Schema

### Users Table

```sql
- id (PRIMARY KEY)
- email (UNIQUE, NOT NULL)
- username (UNIQUE, NOT NULL)
- hashed_password (nullable for OAuth)
- auth_provider (VARCHAR 50: 'email' or 'google')
- provider_id (UNIQUE, nullable - Google ID)
- google_refresh_token (VARCHAR 500, nullable)
- full_name, bio, profile_photo
- is_active, is_verified
- created_at, updated_at
```

## 🐛 Troubleshooting

### "GOOGLE_CLIENT_ID not set"

Solution: Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`

### "Token verification failed"

Check:
1. `GOOGLE_CLIENT_ID` matches Google Console
2. Token is `id_token` not `access_token`
3. Token hasn't expired

### "Connection refused to backend"

Check:
1. Backend is running: `http://10.162.205.75:8000/api/v1/ping`
2. `LOCAL_IP` in `environment.js` matches your machine
3. Frontend and backend on same network

### "User already exists"

This is expected if registration was successful. Try login instead.

### "Migration failed"

Check:
1. Database is accessible: `psql $DATABASE_URL`
2. Alembic version table exists: `alembic current`
3. No syntax errors in migration file

## 📖 Files Changed/Created

### Backend

- ✅ `app/routers/auth.py` - New auth routes (email + Google OAuth)
- ✅ `app/models/user.py` - Updated User model (removed phone, added auth_provider)
- ✅ `app/schemas/user.py` - Updated schemas (UserLogin, GoogleAuthRequest, etc.)
- ✅ `alembic/versions/refactor_auth_remove_phone_add_oauth.py` - Database migration
- ✅ `.env.example` - Added Google OAuth vars

### Frontend

- ✅ `src/context/AuthContext.js` - New auth context (replaces Firebase)
- ✅ `src/screens/LoginScreen.js` - Modern email login UI
- ✅ `src/screens/RegisterScreen.js` - Modern email registration UI
- ✅ `src/navigation/AppNavigator.js` - Updated navigation (removed phone/OTP)
- ✅ `AUTHENTICATION_GUIDE.md` - Comprehensive auth documentation

### Removed

- ❌ `src/screens/PhoneLoginScreen.js`
- ❌ `src/screens/OTPVerificationScreen.js`
- ❌ `src/context/FirebaseAuthContext.js`
- ❌ All Firebase phone auth logic
- ❌ All OTP-related code

## 🚀 Deployment Steps

### Production Checklist

1. [ ] Update `DATABASE_URL` to production Neon DB
2. [ ] Generate strong `SECRET_KEY`
3. [ ] Set `GOOGLE_CLIENT_ID` and `SECRET`
4. [ ] Enable HTTPS for all API calls
5. [ ] Set up CORS for production domain
6. [ ] Run database migrations
7. [ ] Test all auth endpoints
8. [ ] Set up monitoring/logging
9. [ ] Configure backup and disaster recovery

### Production Environment Variables

```bash
# Backend
DATABASE_URL=postgresql://neon:password@ep-xxxx.neon.tech/production?sslmode=require
SECRET_KEY=<new-strong-random-hex-32>
GOOGLE_CLIENT_ID=<production-client-id>
GOOGLE_CLIENT_SECRET=<production-client-secret>
DEBUG=False
CORS_ORIGINS=["https://yourapp.com"]
```

## 📞 Support

For issues or questions:
1. Check [Authentication Guide](./AUTHENTICATION_GUIDE.md)
2. Review backend error logs: `uvicorn` output
3. Check frontend logs: Expo console
4. Verify environment variables
5. Test endpoints with cURL or Postman

---

**Created**: February 5, 2026
**Authentication System Version**: 2.0 (Email + Google OAuth)
**Status**: ✅ Ready for Setup
