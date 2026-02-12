# 📚 Migration Guide: Custom Auth → Better Auth

**Purpose**: Migrate from custom JWT authentication to Neon DB's Better Auth  
**Time Required**: 30-60 minutes  
**Difficulty**: Easy

---

## 🔄 What's Changing

### Files Removed
- ❌ `backend/app/routers/auth.py` (old custom implementation)
- ❌ `backend/alembic/versions/refactor_auth_remove_phone_add_oauth.py` (old migration)
- ❌ Custom password hashing utilities
- ❌ Custom JWT token generation

### Files Added
- ✅ `backend/app/routers/auth_better.py` (Better Auth wrapper)
- ✅ `frontend/src/context/AuthContext_better.js` (Better Auth context)
- ✅ `BETTER_AUTH_SETUP.md` (This guide)

### Files Updated
- 📝 `backend/.env.example` (Better Auth config)
- 📝 `frontend/src/config/environment.js` (API endpoint)

---

## 📋 Migration Steps

### Step 1: Backup Current Setup (Optional)

```bash
# Create backup branch
git checkout -b backup/custom-auth
git push origin backup/custom-auth
```

### Step 2: Update Backend

#### 2.1 Update `.env`

Replace:
```bash
# OLD
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=90
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

With:
```bash
# NEW
BETTER_AUTH_URL=https://ep-wispy-sky-ahjrwwp1.neoauth.c-3.us-east-1.aws.neon.tech
BETTER_AUTH_SECRET=your_secret_from_neon
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

#### 2.2 Remove Old Router

```bash
# Backup old router (optional)
cp backend/app/routers/auth.py backend/app/routers/auth.py.backup

# Remove old router
rm backend/app/routers/auth.py
```

#### 2.3 Update Main Router

Edit `backend/app/main.py`:

```python
# OLD
from app.routers import auth as auth_router
app.include_router(auth_router.router)

# NEW
from app.routers import auth_better as auth_router
app.include_router(auth_router.router)
```

#### 2.4 Verify Backend

```bash
# Start backend
cd backend
python -m uvicorn app.main:app --reload

# Should start without errors
# Go to http://localhost:8000/docs to see new endpoints
```

### Step 3: Update Frontend

#### 3.1 Update AuthContext

Replace old context with new one:

```bash
# Backup old context (optional)
cp frontend/src/context/AuthContext.js frontend/src/context/AuthContext.js.backup

# Copy new context
cp frontend/src/context/AuthContext_better.js frontend/src/context/AuthContext.js
```

#### 3.2 Update App.js

```javascript
// OLD
import { AuthProvider } from './src/context/FirebaseAuthContext';

// NEW
import { AuthProvider } from './src/context/AuthContext';
```

#### 3.3 Update Screens

The new login/register screens work with Better Auth automatically.

If you're using custom auth calls, update them:

```javascript
// OLD
import FirebaseAuth from './services/firebase-auth';
const result = await FirebaseAuth.sendOTP(phone);

// NEW
import { useAuth } from '../context/AuthContext';
const { register, login } = useAuth();
const result = await login(email, password);
```

#### 3.4 Verify Frontend

```bash
# Install any new dependencies if needed
cd frontend
npm install httpx  # Usually already installed

# Start frontend
npm start
```

### Step 4: Remove Old Files

```bash
# Remove old authentication files
rm -f backend/app/routers/auth.py
rm -f backend/alembic/versions/refactor_auth_remove_phone_add_oauth.py
rm -f frontend/src/context/FirebaseAuthContext.js
rm -f frontend/src/screens/PhoneLoginScreen.js
rm -f frontend/src/screens/OTPVerificationScreen.js
```

### Step 5: Test Migration

#### 5.1 Test Backend

```bash
# Register
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "migrate@test.com",
    "password": "TestPass123!",
    "name": "Migration Test"
  }'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "migrate@test.com",
    "password": "TestPass123!"
  }'
```

#### 5.2 Test Frontend

1. Open app
2. Go to Login screen
3. Create new account with email
4. Should redirect to home screen
5. User data should display

#### 5.3 Test Google OAuth

1. Ensure Google Client ID is set
2. Tap "Sign in with Google"
3. Complete Google login flow
4. Should create/login user

### Step 6: Update Documentation

```bash
# Old docs are now archived
# New docs are in:
# - BETTER_AUTH_SETUP.md (this file)
# - DOCUMENTATION_INDEX.md (main index)

# Update team wiki/docs:
# - Remove references to Firebase OTP
# - Update auth flow diagrams
# - Add Better Auth setup instructions
```

---

## 🔗 Data Migration

### User Data

If you have existing users in the old system:

```bash
# Option 1: Fresh Start
# - Clear user data
# - Start with new Better Auth users
# - Best for development

# Option 2: Migrate Users
# - Query old user table
# - Create Better Auth accounts via API
# - Mirror relationships in your tables
# - More complex but preserves user history
```

### Example User Migration Script

```python
# backend/migrate_users.py
import httpx
from app.models.user import User
from app.core.database import SessionLocal

async def migrate_users():
    """Migrate existing users to Better Auth"""
    
    db = SessionLocal()
    old_users = db.query(User).all()
    
    async with httpx.AsyncClient() as client:
        for user in old_users:
            # Create user in Better Auth
            response = await client.post(
                f"{BETTER_AUTH_URL}/sign-up/email",
                json={
                    "email": user.email,
                    "name": user.username,
                    "password": "temp_password_123"  # User should reset
                }
            )
            
            if response.status_code == 201:
                print(f"✅ Migrated {user.email}")
            else:
                print(f"❌ Failed to migrate {user.email}")
    
    db.close()

# Run with:
# python migrate_users.py
```

---

## ✅ Verification Checklist

- [ ] Backend starts without errors
- [ ] `/auth/health` returns OK
- [ ] Can register with email
- [ ] Can login with email/password
- [ ] Can get user profile
- [ ] Can logout
- [ ] Google OAuth works (if configured)
- [ ] Frontend app starts
- [ ] Login screen loads
- [ ] Can login in app
- [ ] User data displays correctly
- [ ] Old files are deleted/backed up
- [ ] `.env` has Better Auth config
- [ ] No console errors

---

## 🆘 Troubleshooting

### Backend won't start

```bash
# Check error messages
python -m uvicorn app.main:app --reload

# If import error:
# - Verify auth_better.py is in routers/
# - Check main.py imports auth_better correctly

# If .env error:
# - Verify BETTER_AUTH_URL is set
# - Verify BETTER_AUTH_SECRET is set
```

### "Auth service unavailable" in requests

```bash
# Verify Better Auth URL
curl https://ep-wispy-sky-ahjrwwp1.neoauth.c-3.us-east-1.aws.neon.tech/health

# If fails:
# - URL is wrong in .env
# - Better Auth not enabled in Neon Console
# - Network connectivity issue
```

### Frontend won't authenticate

```bash
# Check:
# 1. AuthContext is imported in App.js
# 2. useAuth() is being called in components
# 3. Backend is running and accessible
# 4. API_URL is correct in environment.js
```

### Old database migrations causing issues

```bash
# If you get migration errors:
# 1. You can delete old migration files
# 2. Better Auth manages its own schema
# 3. Your custom fields still work

# Remove old migration:
rm backend/alembic/versions/refactor_auth_remove_phone_add_oauth.py
```

---

## 📚 Learn More

- **Setup Details**: See [BETTER_AUTH_SETUP.md](./BETTER_AUTH_SETUP.md)
- **API Reference**: See [AUTH_API_REFERENCE.md](./AUTH_API_REFERENCE.md)
- **All Docs**: See [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)
- **Neon Docs**: https://neon.tech/docs/guides/auth

---

## 🎯 What's Next

1. ✅ Complete migration steps above
2. ✅ Verify everything works
3. ✅ Delete backup files when confident
4. ✅ Deploy to staging
5. ✅ Test with real users
6. ✅ Deploy to production

---

**Status**: ✅ Ready to migrate  
**Complexity**: ⭐⭐ (Easy)  
**Time**: 30-60 minutes  
**Support**: See troubleshooting section above
