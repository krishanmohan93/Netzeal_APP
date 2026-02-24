"""
Social Authentication Strategies
Multi-provider OAuth support for Instagram, LinkedIn, Facebook, Apple, Google
"""

# IMPLEMENTATION PLAN (Ready to build)

## Phase 1: Google ✅ (DONE)
- [x] Expo auth-session integration
- [x] ID token verification in backend
- [x] User creation/linking
- [x] JWT response

## Phase 2: Facebook (Next)
```python
from facebook import GraphAPI

@router.post("/auth/facebook")
async def facebook_auth(request: FacebookAuthRequest, db: Session):
    """
    Flow:
    1. Frontend: Use react-native-fbsdk or Expo.Facebook
    2. Get long-lived access token
    3. POST to /auth/facebook with access_token
    4. Backend validates via Graph API
    5. Create/find user by facebook_id
    6. Return JWT
    """
    try:
        graph = GraphAPI(request.access_token)
        user_info = graph.get_object("me", fields="id,name,email,picture")
        
        facebook_id = user_info['id']
        email = user_info.get('email')
        name = user_info['name']
        picture = user_info.get('picture', {}).get('data', {}).get('url')
        
        # Find or create user
        user = db.query(User).filter(User.provider_id == facebook_id).first()
        
        if not user:
            user = User(
                email=email or f"fb_{facebook_id}@netzeal.local",
                username=name.replace(" ", "").lower(),
                full_name=name,
                profile_photo=picture,
                auth_provider="facebook",
                provider_id=facebook_id,
                is_active=True,
                is_verified=True
            )
            db.add(user)
            db.commit()
        
        # Return tokens
        return create_auth_response(user)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Facebook auth failed: {str(e)}")
```

## Phase 3: LinkedIn
```python
import requests

@router.post("/auth/linkedin")
async def linkedin_auth(request: LinkedInAuthRequest, db: Session):
    """
    Flow:
    1. Frontend: Use expo-auth-session with LinkedIn
    2. Get authorization code
    3. Exchange code for access token on backend
    4. Get user profile via API
    """
    LINKEDIN_OAUTH_URL = "https://www.linkedin.com/oauth/v2/accessToken"
    LINKEDIN_API_URL = "https://api.linkedin.com/v2/me"
    
    # Exchange code for token
    token_response = requests.post(
        LINKEDIN_OAUTH_URL,
        data={
            'grant_type': 'authorization_code',
            'code': request.code,
            'redirect_uri': settings.LINKEDIN_REDIRECT_URI,
            'client_id': settings.LINKEDIN_CLIENT_ID,
            'client_secret': settings.LINKEDIN_CLIENT_SECRET,
        }
    )
    
    access_token = token_response.json()['access_token']
    
    # Get user profile
    headers = {'Authorization': f'Bearer {access_token}'}
    profile = requests.get(LINKEDIN_API_URL, headers=headers).json()
    
    linkedin_id = profile['id']
    email = profile.get('email')
    
    # ... similar user creation flow ...
```

## Phase 4: Apple Sign-In (for iOS)
```python
import jwt as pyjwt

@router.post("/auth/apple")
async def apple_auth(request: AppleAuthRequest, db: Session):
    """
    Flow:
    1. Frontend: Use Apple Sign-In SDK
    2. Get identity token (JWT)
    3. Send to backend
    4. Verify JWT signature
    """
    try:
        # Verify Apple identity token
        decoded = pyjwt.decode(
            request.identity_token,
            algorithms=['RS256'],
            options={"verify_signature": False}  # OR verify with Apple public key
        )
        
        apple_id = decoded['sub']
        email = decoded.get('email')
        
        # Find or create user
        user = db.query(User).filter(User.provider_id == apple_id).first()
        
        if not user:
            user = User(
                email=email,
                username=f"apple_{apple_id[:8]}",
                auth_provider="apple",
                provider_id=apple_id,
                is_active=True,
                is_verified=True
            )
            db.add(user)
            db.commit()
        
        return create_auth_response(user)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail="Apple auth failed")
```

## Phase 5: Twitter/X
```python
from authlib.integrations.httpx_client import AsyncOAuth2Client

@router.post("/auth/twitter")
async def twitter_auth(request: TwitterAuthRequest, db: Session):
    """Twitter OAuth 2.0 with PKCE"""
    client = AsyncOAuth2Client(
        client_id=settings.TWITTER_CLIENT_ID,
        client_secret=settings.TWITTER_CLIENT_SECRET,
        redirect_uri=settings.TWITTER_REDIRECT_URI,
    )
    
    token = await client.fetch_token(
        'https://twitter.com/i/oauth2/token',
        code=request.code,
        code_verifier=request.code_verifier,
    )
    
    # Get user info
    response = await client.get('https://api.twitter.com/2/users/me')
    user_info = response.json()
    
    # ... create user ...
```

---

## Frontend Integration Pattern

```javascript
// src/context/AuthContext.js

export const useAuth = () => {
  const [user, setUser] = useState(null);

  // Generic social sign-in wrapper
  const socialSignIn = async (provider, credentials) => {
    try {
      setLoading(true);
      
      const response = await fetchAuthWithFallback(`/auth/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      await saveSession(data.access_token, data.refresh_token, data.user);
      
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Individual providers
  const googleSignIn = async (idToken) => 
    socialSignIn('google', { id_token: idToken });

  const facebookSignIn = async (accessToken) => 
    socialSignIn('facebook', { access_token: accessToken });

  const linkedinSignIn = async (code, state) => 
    socialSignIn('linkedin', { code, state });

  const appleSignIn = async (identityToken, user) => 
    socialSignIn('apple', { identity_token: identityToken, user });

  const twitterSignIn = async (code, codeVerifier) => 
    socialSignIn('twitter', { code, code_verifier: codeVerifier });

  return {
    googleSignIn,
    facebookSignIn,
    linkedinSignIn,
    appleSignIn,
    twitterSignIn,
    socialSignIn,
    user,
    loading,
  };
};
```

---

## Environment Variables Required

```bash
# Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Facebook
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_REDIRECT_URI=http://localhost:8000/auth/facebook/callback

# LinkedIn
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_REDIRECT_URI=http://localhost:8000/auth/linkedin/callback

# Apple
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY=...
APPLE_CLIENT_ID=...
APPLE_REDIRECT_URI=http://localhost:8000/auth/apple/callback

# Twitter
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
TWITTER_REDIRECT_URI=http://localhost:8000/auth/twitter/callback
```

---

## Database Schema

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    
    # Auth provider fields
    auth_provider = Column(String, default="email")  # email, google, facebook, linkedin, apple, twitter
    provider_id = Column(String, index=True)  # Sub, app_user_id, etc.
    
    # Linked accounts (many-to-one)
    linked_accounts = Column(JSON, default={})  # { 'google': 'xxx', 'facebook': 'yyy' }
    
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## Production Checklist

- [ ] Add all OAuth credentials to backend/.env
- [ ] Test Google flow (already done ✅)
- [ ] Test email/password (fallback)
- [ ] Add Facebook app (get credentials)
- [ ] Add LinkedIn app (get credentials)
- [ ] Add Apple credentials (if iOS)
- [ ] Add Twitter OAuth (if needed)
- [ ] Update database User model with linked_accounts
- [ ] Test sign-in → sign-out → sign-in with different provider
- [ ] Handle same email across different providers (link accounts)
- [ ] Rate limit auth endpoints
- [ ] Add error analytics/logging
- [ ] Handle token refresh for long-lived sessions

---

**Status:** Ready to build  
**Est. Time per Provider:** 2-3 hours  
**Priority:** Google ✅ → Facebook → LinkedIn
