# NetZeal Authentication API - Quick Reference

## Base URL
```
http://10.162.205.75:8000/api/v1
```

## Authentication Headers
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

---

## 📝 Registration

```http
POST /auth/register

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePassword123",
  "full_name": "John Doe"
}

Response 201:
{
  "access_token": "eyJ0eXAi...",
  "refresh_token": "eyJ0eXAi...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "full_name": "John Doe",
    "auth_provider": "email"
  }
}
```

**Validation**:
- Email: Valid email format
- Username: 3-100 characters, unique
- Password: Min 8 characters
- Full Name: Optional

**Errors**:
- 400: Invalid email or username
- 409: Email already registered
- 409: Username already taken

---

## 🔐 Login

```http
POST /auth/login

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}

Response 200: Same as registration
```

**Validation**:
- Email must exist in database
- Password must match hashed password

**Errors**:
- 401: Invalid email or password
- 403: Account is disabled

---

## 🔄 Refresh Token

```http
POST /auth/refresh

{
  "refresh_token": "eyJ0eXAi..."
}

Response 200:
{
  "access_token": "new_token...",
  "refresh_token": "new_refresh_token...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

**When to Use**:
- Access token expired (401 error)
- Before access token expires (proactive)
- Keep user session alive

**Errors**:
- 401: Invalid refresh token
- 401: User not found or inactive

---

## 🌐 Google Sign-In

```http
POST /auth/google

{
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}

Response 200:
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": 2,
    "email": "user@gmail.com",
    "username": "user_username",
    "full_name": "Google User",
    "auth_provider": "google",
    "profile_photo": "https://..."
  },
  "is_new_user": true
}
```

**Important**:
- Send `id_token` from Google Sign-In, NOT `access_token`
- First-time users are auto-created
- Returns `is_new_user` flag
- Profile picture auto-synced

**Errors**:
- 400: Missing or invalid ID token
- 401: Google token verification failed
- 500: Authentication service unavailable

---

## 👤 Get Current User

```http
GET /auth/me
Authorization: Bearer {access_token}

Response 200:
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "auth_provider": "email",
  "full_name": "John Doe",
  "bio": "My bio",
  "profile_photo": "https://...",
  "education": [...],
  "work_experience": [...],
  "skills": [...],
  "is_active": true,
  "is_verified": true,
  "created_at": "2026-02-05T10:00:00Z",
  "followers_count": 150,
  "following_count": 250,
  "posts_count": 42
}
```

**Errors**:
- 401: Unauthorized (invalid/expired token)
- 404: User not found

---

## 📝 Update Profile

```http
PUT /auth/me
Authorization: Bearer {access_token}

{
  "full_name": "John Updated",
  "bio": "Updated bio",
  "profile_photo": "https://..."
}

Response 200: Updated user object
```

**Fields** (all optional):
- full_name
- bio
- profile_photo
- education
- work_experience
- skills
- interests
- achievements

---

## 👥 Get User Profile

```http
GET /auth/users/{user_id}
Authorization: Bearer {access_token}

Response 200: Public user profile (same as /auth/me)
```

**Note**: Returns public profile data (no sensitive info)

---

## 🚪 Logout

```http
POST /auth/logout
Authorization: Bearer {access_token}

Response 200:
{
  "message": "Logged out successfully"
}
```

**Note**: Frontend should also:
1. Delete stored tokens
2. Clear user data
3. Navigate to login

---

## 🔑 Token Structure

### Access Token
- **Type**: JWT (HS256)
- **Expiry**: 60 minutes
- **Used for**: API requests (Authorization header)
- **Payload**: `{sub: user_id, iat, exp}`

### Refresh Token
- **Type**: JWT (HS256)
- **Expiry**: 90 days
- **Used for**: Getting new access tokens
- **Payload**: `{sub: user_id, iat, exp, type: refresh}`

### How to Use
```javascript
// Get from response
const { access_token, refresh_token } = response;

// Store securely
SecureStore.setItem('access_token', access_token);
SecureStore.setItem('refresh_token', refresh_token);

// Use in requests
const headers = {
  'Authorization': `Bearer ${access_token}`
};

// When expired, refresh
const newTokens = await fetch('/auth/refresh', {
  body: JSON.stringify({ refresh_token })
});
```

---

## ⚡ Quick Integration Example

### React Native
```javascript
import { useAuth } from '../context/AuthContext';

function LoginScreen() {
  const { login } = useAuth();

  const handleLogin = async () => {
    const result = await login('email@example.com', 'password');
    if (result.success) {
      navigation.navigate('Home');
    }
  };

  return <TouchableOpacity onPress={handleLogin}>Login</TouchableOpacity>;
}
```

### Web
```javascript
async function register(formData) {
  const response = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });
  
  const data = await response.json();
  if (response.ok) {
    localStorage.setItem('access_token', data.access_token);
    window.location.href = '/home';
  }
}
```

---

## ❌ Common Error Responses

### 400 Bad Request
```json
{
  "detail": "Invalid email format"
}
```

### 401 Unauthorized
```json
{
  "detail": "Invalid email or password"
}
```

### 403 Forbidden
```json
{
  "detail": "Account is disabled"
}
```

### 409 Conflict
```json
{
  "detail": "Email already registered"
}
```

### 500 Server Error
```json
{
  "detail": "Internal Server Error"
}
```

---

## 🔒 Security Rules

✅ **DO**:
- Store tokens in secure storage
- Include Authorization header on all protected routes
- Refresh token before expiry (60 min)
- Hash passwords on backend
- Validate inputs
- Use HTTPS in production

❌ **DON'T**:
- Store tokens in AsyncStorage (use SecureStore)
- Send tokens in URL
- Store passwords in plain text
- Skip token validation
- Expose error details to users
- Use HTTP in production

---

## 📊 Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Proceed |
| 201 | Created | Resource created |
| 400 | Bad Request | Fix request body |
| 401 | Unauthorized | Refresh token or login |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Already exists (email/username) |
| 500 | Server Error | Retry or contact support |

---

## 🧪 Testing with cURL

### Register
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "username":"testuser",
    "password":"TestPassword123",
    "full_name":"Test User"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"TestPassword123"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Refresh Token
```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token":"YOUR_REFRESH_TOKEN"
  }'
```

---

## 📱 Frontend Hooks

### useAuth()
```javascript
const {
  user,              // Current user object or null
  loading,           // Loading state
  isAuthenticated,   // Boolean
  tokens,            // { access, refresh }
  error,             // Last error message
  register,          // Function
  login,             // Function
  googleSignIn,      // Function
  refreshAccessToken,// Function
  logout,            // Function
  clearError         // Function
} = useAuth();
```

---

## 🔗 Related Docs

- [Full Authentication Guide](./AUTHENTICATION_GUIDE.md)
- [Setup Checklist](./AUTH_SETUP_CHECKLIST.md)
- [Refactor Summary](./AUTH_REFACTOR_SUMMARY.md)

---

**Last Updated**: February 5, 2026  
**API Version**: v1  
**Status**: Production Ready
