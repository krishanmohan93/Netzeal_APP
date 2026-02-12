# 🏗️ Better Auth Architecture & Flow

**Purpose**: Visual overview of Better Auth integration  
**Last Updated**: February 5, 2026

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NetZeal Application                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐         ┌──────────────────────────┐  │
│  │   Frontend (React    │         │  Backend (FastAPI)       │  │
│  │   Native + Expo)     │         │                          │  │
│  ├──────────────────────┤         ├──────────────────────────┤  │
│  │                      │         │                          │  │
│  │ • LoginScreen        │────────▶│ • /auth/login            │  │
│  │ • RegisterScreen     │         │ • /auth/register         │  │
│  │ • AuthContext        │         │ • /auth/google           │  │
│  │ • useAuth() hook     │         │ • /auth/me               │  │
│  │                      │◀────────│ • /auth/logout           │  │
│  │ Secure Storage:      │         │ • /auth/refresh-session  │  │
│  │ • SecureStore        │         │                          │  │
│  │ • AsyncStorage       │         │ Router: auth_better.py   │  │
│  │                      │         │ (420 lines)              │  │
│  └──────────────────────┘         └──────────────────────────┘  │
│           │                                    │                 │
│           │ Tokens                             │ HTTP/REST       │
│           │ User Data                          │                 │
│           │                                    │                 │
└─────────────────────────────────────────────────────────────────┘
                      │                          │
                      │                          │
                      └──────────────┬───────────┘
                                     │
              ┌──────────────────────────────────────┐
              │   Neon DB Better Auth Service        │
              ├──────────────────────────────────────┤
              │                                      │
              │  • User Management                   │
              │  • Token Generation                  │
              │  • Email Verification                │
              │  • Password Reset                    │
              │  • OAuth Provider Integration        │
              │  • Session Management                │
              │  • Rate Limiting & DDOS Protection   │
              │                                      │
              │  Endpoint:                           │
              │  https://ep-wispy-sky-ahjrwwp1...    │
              │  .neoauth.c-3.us-east-1.aws.neon.   │
              │  tech                                │
              │                                      │
              └──────────────────────────────────────┘
                      │        │         │
                      │        │         │
        ┌─────────────┘        │         └────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
    ┌────────┐          ┌────────────┐         ┌──────────┐
    │ Neon   │          │ Email      │         │ Google   │
    │ DB     │          │ Service    │         │ OAuth    │
    │ (Users)│          │            │         │          │
    └────────┘          └────────────┘         └──────────┘
```

---

## 🔄 Authentication Flow Diagrams

### 1. Email + Password Registration

```
Frontend                          Backend                    Neon DB Auth
   │                                │                              │
   │ POST /auth/register            │                              │
   │ {email, password, name}        │                              │
   ├───────────────────────────────▶│                              │
   │                                │                              │
   │                                │ POST /sign-up/email          │
   │                                ├─────────────────────────────▶│
   │                                │                              │
   │                                │◀─────────────────────────────┤
   │                                │ {token, user}                │
   │                                │                              │
   │◀───────────────────────────────┤                              │
   │ {status, token, user}          │                              │
   │                                │                              │
   │ Save token to SecureStore       │                              │
   │ Save user to AsyncStorage       │                              │
   │ Set AuthContext.user            │                              │
   │ Redirect to Home                │                              │
   │                                │                              │
```

**Payload Example**:
```json
Request:
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "User Name"
}

Response:
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

---

### 2. Email + Password Login

```
Frontend                          Backend                    Neon DB Auth
   │                                │                              │
   │ POST /auth/login               │                              │
   │ {email, password}              │                              │
   ├───────────────────────────────▶│                              │
   │                                │                              │
   │                                │ POST /sign-in/email          │
   │                                ├─────────────────────────────▶│
   │                                │                              │
   │                                │ Verify Credentials           │
   │                                │ Generate JWT Token           │
   │                                │                              │
   │                                │◀─────────────────────────────┤
   │                                │ {token, user}                │
   │                                │                              │
   │◀───────────────────────────────┤                              │
   │ {status, token, user}          │                              │
   │                                │                              │
   │ Save token (refresh if provided)│                              │
   │ Set user data                   │                              │
   │ Redirect to Home                │                              │
   │                                │                              │
```

---

### 3. Google OAuth Flow

```
Frontend                          Backend                    Neon DB Auth    Google
   │                                │                              │            │
   │ Tap "Sign in with Google"      │                              │            │
   ├──────────────────────────────▶ Google Sign-In SDK             │            │
   │                                 │◀──────────────────────────────────────────│
   │◀──────────────────────────────── Google Sign-In SDK           │            │
   │ idToken                         │                              │            │
   │                                │                              │            │
   │ POST /auth/google              │                              │            │
   │ {idToken}                      │                              │            │
   ├───────────────────────────────▶│                              │            │
   │                                │                              │            │
   │                                │ POST /sign-in/google         │            │
   │                                ├─────────────────────────────▶│            │
   │                                │                              │            │
   │                                │ Verify Token with Google JWKS│            │
   │                                │ Get User Info                │            │
   │                                │ Create/Update User           │            │
   │                                │                              │            │
   │                                │◀─────────────────────────────┤            │
   │                                │ {token, user}                │            │
   │                                │                              │            │
   │◀───────────────────────────────┤                              │            │
   │ {status, token, user}          │                              │            │
   │                                │                              │            │
   │ Save tokens                    │                              │            │
   │ Set user data                  │                              │            │
   │ Redirect to Home               │                              │            │
   │                                │                              │            │
```

---

### 4. Session Restoration (App Start)

```
Frontend (App Start)               Backend                    Neon DB Auth
   │                                │                              │
   │ useEffect(() => bootstrap)     │                              │
   ├─ SecureStore.getItem('auth_token')                            │
   │ Get token from storage         │                              │
   │                                │                              │
   │ If token exists:               │                              │
   │ GET /auth/me                   │                              │
   │ Authorization: Bearer {token}  │                              │
   ├───────────────────────────────▶│                              │
   │                                │                              │
   │                                │ Verify token with JWKS       │
   │                                ├─────────────────────────────▶│
   │                                │                              │
   │                                │ Get User from DB             │
   │                                │                              │
   │◀───────────────────────────────┤ {user data}                  │
   │ {user: {...}}                  │                              │
   │                                │                              │
   │ Set user in AuthContext        │                              │
   │ Show authenticated UI          │                              │
   │                                │                              │
   │ Else (token expired):          │                              │
   │ POST /auth/refresh-session     │                              │
   │ {refreshToken}                 │                              │
   ├───────────────────────────────▶│                              │
   │                                │                              │
   │                                │ POST /refresh-session        │
   │                                ├─────────────────────────────▶│
   │                                │                              │
   │                                │◀─────────────────────────────┤
   │                                │ {token, user}                │
   │                                │                              │
   │◀───────────────────────────────┤                              │
   │ {token, user}                  │                              │
   │                                │                              │
   │ Save new token                 │                              │
   │ Set user data                  │                              │
   │ Show authenticated UI          │                              │
   │                                │                              │
```

---

## 🔐 Token Flow

### Token Structure

```
Access Token (JWT):
┌─────────────────────────────────────────────────────────────┐
│ Header (Algorithm & Type)                                   │
├─────────────────────────────────────────────────────────────┤
│ {                                                           │
│   "alg": "HS256",                                          │
│   "typ": "JWT"                                             │
│ }                                                           │
├─────────────────────────────────────────────────────────────┤
│ Payload (User Info & Claims)                               │
├─────────────────────────────────────────────────────────────┤
│ {                                                           │
│   "sub": "user_123",                                       │
│   "email": "user@example.com",                             │
│   "iat": 1707126600,  (issued at)                          │
│   "exp": 1707130200   (expires in 60 minutes)              │
│ }                                                           │
├─────────────────────────────────────────────────────────────┤
│ Signature (HMAC SHA256)                                     │
├─────────────────────────────────────────────────────────────┤
│ HMACSHA256(                                                │
│   base64UrlEncode(header) + "." +                          │
│   base64UrlEncode(payload),                                │
│   secret                                                    │
│ )                                                           │
└─────────────────────────────────────────────────────────────┘

Full Token: eyJhbGc...base64...more.base64...more.signature
```

### Token Verification Process

```
Frontend sends token:
   │
   ├─ Authorization: Bearer eyJhbGc...
   │
   ▼
Backend receives request:
   │
   ├─ Extract token from header
   ├─ Get JWKS from Neon DB Auth (cached)
   │
   ▼
Token Validation:
   ├─ Check signature with JWKS public key
   ├─ Verify token not expired
   ├─ Verify issuer is Neon DB Auth
   ├─ Extract user claims (email, sub, etc.)
   │
   ▼
If valid:
   ├─ Allow request to proceed
   ├─ User data available to route
   │
If invalid:
   ├─ Return 401 Unauthorized
   ├─ Frontend should refresh or redirect to login
```

---

## 🔄 Token Lifecycle

```
Timeline:
0s ─────────────────────────────────────────── 60 minutes ─────────────────
│                                                                          │
├─ User logs in                                                           │
│ Token generated:                                                        │
│ • Access Token: Expires in 60 minutes                                   │
│ • Refresh Token: Expires in 90 days                                     │
│                                                                         │
├─ Tokens stored securely                                                │
│                                                                         │
├─ User makes requests                                                   │
│ • Send Access Token in Authorization header                            │
│                                                                         │
├─ Access Token expires (60 minutes)                                     │
│                                                                         │
├─ Backend detects expired token                                         │
│ • Returns 401 Unauthorized                                             │
│                                                                         │
├─ Frontend refreshes token                                              │
│ • POST /auth/refresh-session with refreshToken                         │
│ • Backend exchanges for new Access Token                               │
│ • New token valid for another 60 minutes                               │
│                                                                         │
└─ Refresh Token expires (90 days) ──────────────────────────────────────┘
   User must re-login
```

---

## 📊 Data Flow Architecture

```
User Data Storage:
┌─────────────────────────────────────┐
│   Neon DB Better Auth Tables        │
├─────────────────────────────────────┤
│                                     │
│ ┌──────────────────────────────┐   │
│ │ better_auth_account          │   │
│ ├──────────────────────────────┤   │
│ │ • id                         │   │
│ │ • email (UNIQUE)             │   │
│ │ • name                       │   │
│ │ • image (OAuth photo)        │   │
│ │ • created_at                 │   │
│ │ • updated_at                 │   │
│ │ • emailVerified              │   │
│ │ • email_verified_at          │   │
│ └──────────────────────────────┘   │
│                                     │
│ ┌──────────────────────────────┐   │
│ │ better_auth_session          │   │
│ ├──────────────────────────────┤   │
│ │ • id                         │   │
│ │ • user_id (FK)               │   │
│ │ • token (JWT)                │   │
│ │ • refresh_token              │   │
│ │ • expires_at                 │   │
│ │ • created_at                 │   │
│ │ • user_agent                 │   │
│ └──────────────────────────────┘   │
│                                     │
│ ┌──────────────────────────────┐   │
│ │ better_auth_verification... │   │
│ ├──────────────────────────────┤   │
│ │ • token                      │   │
│ │ • identifier                 │   │
│ │ • expires_at                 │   │
│ └──────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
        ▲                    ▲
        │                    │
        └─ Managed by        │
           Neon DB Auth      │
                             │
   Optional Mirroring ───────┘
┌─────────────────────────────────────┐
│   Your Custom Users Table           │
├─────────────────────────────────────┤
│                                     │
│ ┌──────────────────────────────┐   │
│ │ users                        │   │
│ ├──────────────────────────────┤   │
│ │ • id                         │   │
│ │ • email (FK to Better Auth)  │   │
│ │ • username                   │   │
│ │ • bio                        │   │
│ │ • profile_image              │   │
│ │ • created_at                 │   │
│ │ • custom_field_1             │   │
│ │ • custom_field_2             │   │
│ │ • ...                        │   │
│ └──────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔐 Security Layers

```
Layer 1: Transport Security
┌────────────────────────────────────────┐
│ HTTPS/TLS Encryption                   │
│ • All data encrypted in transit        │
│ • Certificate validation               │
│ • Perfect Forward Secrecy              │
└────────────────────────────────────────┘
         ▲
         │
Layer 2: Authentication
┌────────────────────────────────────────┐
│ Token-Based Authentication (JWT)       │
│ • Cryptographic signature verification │
│ • Token expiration validation          │
│ • JWKS public key caching              │
└────────────────────────────────────────┘
         ▲
         │
Layer 3: Authorization
┌────────────────────────────────────────┐
│ Bearer Token Validation                │
│ • Extract from Authorization header    │
│ • Verify not expired                   │
│ • Extract user identity                │
└────────────────────────────────────────┘
         ▲
         │
Layer 4: Rate Limiting
┌────────────────────────────────────────┐
│ Neon DB Built-in Rate Limits           │
│ • Login attempts: 5/minute             │
│ • Password reset: 3/hour               │
│ • Email verification: 5/hour           │
└────────────────────────────────────────┘
         ▲
         │
Layer 5: DDOS Protection
┌────────────────────────────────────────┐
│ Neon DB Infrastructure                 │
│ • Automatic scaling                    │
│ • Attack detection                     │
│ • IP reputation checking               │
│ • Request throttling                   │
└────────────────────────────────────────┘
         ▲
         │
Layer 6: Password Security
┌────────────────────────────────────────┐
│ Better Auth Password Management        │
│ • Enterprise-grade hashing             │
│ • Common password detection            │
│ • Secure reset flow                    │
│ • No plaintext storage                 │
└────────────────────────────────────────┘
```

---

## 🚀 Deployment Architecture

```
Production Environment:
┌──────────────────────────────────────────────────────────────┐
│                     CDN / Load Balancer                       │
├──────────────────────────────────────────────────────────────┤
│ • Global distribution                                        │
│ • SSL termination                                            │
│ • DDoS protection                                            │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│               FastAPI Backend (Multiple Instances)           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Instance 1         Instance 2         Instance 3           │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐          │
│  │ /auth/*  │      │ /auth/*  │      │ /auth/*  │          │
│  │ Endpoints│      │ Endpoints│      │ Endpoints│          │
│  └──────────┘      └──────────┘      └──────────┘          │
│       │                  │                  │               │
│       └──────────────────┼──────────────────┘               │
│                          ▼                                   │
│              ┌──────────────────────┐                        │
│              │ Connection Pool      │                        │
│              │ (Neon DB)            │                        │
│              └──────────────────────┘                        │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│            Neon DB Better Auth Service                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ • User management                                           │
│ • Token generation/validation                              │
│ • Email service                                            │
│ • OAuth integration                                        │
│ • 99.9% uptime SLA                                         │
│ • Automatic failover                                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
    ┌────────┐  ┌─────────────┐  ┌──────────┐
    │Database│  │Email Service│  │ OAuth    │
    │        │  │             │  │ Providers│
    └────────┘  └─────────────┘  └──────────┘
```

---

## 📈 Scaling Considerations

```
User Growth Scenarios:

Low Traffic (100-1K users/day):
│ Single Backend Instance
│ Shared DB Connection
│ ✅ Works with current setup

Medium Traffic (1K-10K users/day):
│ 2-3 Backend Instances
│ Load balancer
│ Connection pooling
│ ✅ Neon DB handles automatically

High Traffic (10K-100K users/day):
│ Auto-scaling group (5-10 instances)
│ Neon DB Professional plan
│ Connection pooling
│ CDN for static assets
│ ✅ Neon DB handles auth at scale

Enterprise (100K+ users/day):
│ Multi-region deployment
│ Neon DB Enterprise plan
│ Regional load balancing
│ Advanced monitoring
│ ✅ Neon DB dedicated support

Neon DB Better Auth handles all scenarios automatically!
```

---

## 🔍 Error Handling Flow

```
User makes request:
   │
   ├─ Validation errors?
   │  └─ Return 400 Bad Request
   │     {
   │       "detail": "Invalid email format"
   │     }
   │
   ├─ Authentication errors?
   │  ├─ No token provided? → 401 Unauthorized
   │  ├─ Token expired? → 401 Unauthorized
   │  │  (Frontend should refresh or redirect)
   │  └─ Token invalid? → 401 Unauthorized
   │
   ├─ Authorization errors?
   │  └─ Return 403 Forbidden
   │     {
   │       "detail": "Insufficient permissions"
   │     }
   │
   ├─ Better Auth service down?
   │  └─ Return 503 Service Unavailable
   │     {
   │       "detail": "Auth service unavailable"
   │     }
   │
   ├─ Database error?
   │  └─ Return 500 Internal Server Error
   │     {
   │       "detail": "An error occurred processing your request"
   │     }
   │
   └─ Request successful?
      └─ Return 200 OK
         {
           "status": "success",
           "data": {...}
         }
```

---

## ✅ Verification Checklist

Use this diagram to verify your setup:

```
✓ Neon DB Better Auth enabled in console
✓ Better Auth URL copied to .env
✓ Better Auth Secret copied to .env
✓ Backend starts without errors
✓ /auth/health endpoint returns OK
✓ Can register new user
✓ Can login with email/password
✓ Can get current user (/auth/me)
✓ Token refresh works
✓ Logout endpoint works
✓ Google OAuth credentials configured
✓ Frontend app starts
✓ Login screen loads
✓ Can register in app
✓ Can login in app
✓ User data displays correctly
✓ Logout works in app
✓ Session restores on app restart
✓ Token refresh works in app
✓ Google login works (if configured)
```

All ✓? You're ready for production! 🚀

---

**Status**: ✅ Complete  
**Last Updated**: February 5, 2026  
**Version**: 1.0
