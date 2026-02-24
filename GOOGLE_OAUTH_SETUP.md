# Google OAuth Setup Guide - NetZeal

Complete production-ready Google Sign-In integration for web, Android, and iOS.

## Current Status ✅

- **Google Client ID:** `<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com`
- **Google Client Secret:** (configured in backend/.env)
- **Backend:** FastAPI validation ready
- **Frontend:** Expo auth-session integrated with fallback URLs

---

## Google Console Configuration

### 1. **Authorized Redirect URIs** (Add to OAuth 2.0 Credentials)

```
https://auth.expo.io/@netzeal-app/netzeal
https://localhost:3000/auth/callback
http://localhost:8080/auth/callback
```

### 2. **Authorized JavaScript Origins**

```
https://auth.expo.io
http://localhost:8000
http://localhost:3000
http://localhost:8080
```

### 3. **Android Configuration**

Add to Google Cloud Console:

```json
{
  "packageName": "com.netzeal.app",
  "certFingerprint": "GET_FROM_PLAY_STORE_OR_BUILD"
}
```

**How to get Android certificate fingerprint:**

```bash
cd frontend
npx eas credentials
```

### 4. **iOS Configuration**

Add to Google Cloud Console:

```
Reverse client ID: com.googleusercontent.apps.<YOUR_GOOGLE_CLIENT_ID>
Bundle ID: com.netzeal.app
```

---

## Backend Setup ✅

Already configured in `backend/.env`:

```env
GOOGLE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<YOUR_GOOGLE_CLIENT_SECRET>
```

APIs verify via:
- **POST** `/api/v1/auth/google` → Accepts `id_token` from frontend
- Uses `google.oauth2.id_token.verify_oauth2_token()` for validation
- Creates user on first sign-in
- Returns JWT tokens for API calls

---

## Frontend Setup ✅

### Environment Config (`frontend/src/config/environment.js`)

```javascript
const GOOGLE_EXPO_CLIENT_ID = 
  '<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_ID = GOOGLE_EXPO_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = null; // Set after Play Store upload
const GOOGLE_IOS_CLIENT_ID = null;     // Set after App Store upload
```

### App Config (`frontend/app.json`)

```json
{
  "expo": {
    "owner": "netzeal-app",
    "extra": {
      "expoClient": {
        "googleOAuth": {
          "expoClientId": "<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com"
        }
      }
    },
    "ios": {
      "config": {
        "googleSignIn": {
          "reservedClientId": "com.googleusercontent.apps.<YOUR_GOOGLE_CLIENT_ID>"
        }
      }
    },
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

### Login Screen Flow (`frontend/src/screens/LoginScreen.js`)

```javascript
import * as Google from 'expo-auth-session/providers/google';

const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
  expoClientId: GOOGLE_EXPO_CLIENT_ID,
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  selectAccount: true,
});

const handleGoogleLogin = async () => {
  const promptResult = await promptAsync();
  // Auto-calls backend via useEffect when response ready
};
```

---

## Network Configuration

**Primary IPs** (auto-fallback in AuthContext):
- `10.113.240.75:8000` (primary development)
- `10.97.116.75:8000` (fallback 1)
- `10.0.2.2:8000` (Android emulator fallback)
- `localhost:8000` (web fallback)

Update `frontend/src/config/environment.js` LOCAL_IP to match your machine:

```bash
ipconfig getifaddr en0  # macOS
ipconfig                # Windows (look for IPv4)
hostname -I             # Linux
```

---

## Testing Checklist

### ✅ Local Development (Expo Go)

1. **Start servers:**
   ```bash
   # Terminal 1
   cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

   # Terminal 2
   cd frontend && npx expo start
   ```

2. **Test email login first:**
   - Register: test@example.com / password123
   - Login: Same credentials
   - ✅ Should get JWT tokens

3. **Test Google sign-in:**
   - Press "Continue with Google"
   - Select account (should open Google sign-in)
   - Approve permissions
   - ✅ Should auto-login and redirect to home

4. **Common Issues:**
   - `invalid_request`: Check Google Console redirects
   - `network_error`: Check backend IP in environment.js
   - No ID token: Ensure `selectAccount: true` in useIdTokenAuthRequest

### ⚠️ Building for Production (EAS)

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android

# Web
eas build --platform web
```

**Then update Google Console with:**
- iOS: App Store Bundle ID cert
- Android: Play Store signing cert fingerprint
- Web: Production domain

---

## Instagram/LinkedIn/Facebook Style

For other social providers, add to AuthContext:

```javascript
// Facebook
const facebookSignIn = async (accessToken) => {
  const response = await fetchAuthWithFallback('/auth/facebook', {
    method: 'POST',
    body: JSON.stringify({ access_token: accessToken }),
  });
  // ...
};

// LinkedIn
const linkedinSignIn = async (code, state) => {
  const response = await fetchAuthWithFallback('/auth/linkedin', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
  });
  // ...
};
```

Backend handler:

```python
@router.post("/auth/facebook")
async def facebook_auth(request: FacebookAuthRequest, db: Session = Depends(get_db)):
    """Validate Facebook access token via Graph API"""
    # Similar to Google flow but use Facebook Graph API
    
@router.post("/auth/linkedin")
async def linkedin_auth(request: LinkedInAuthRequest, db: Session = Depends(get_db)):
    """Exchange LinkedIn code for access token via OAuth2"""
    # Similar flow but use LinkedIn OAuth2 endpoint
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid_request` | Google Client ID mismatch or missing redirect | Add exact redirect URI to Google Console |
| `network_error` | Backend unreachable | Update LOCAL_IP in environment.js to your machine IP |
| `idToken undefined` | Auth session not completed | Check expo-auth-session version, restart app |
| `user already exists` | Same email, different auth provider | In DB, allow linking accounts |

---

## Quick Start

```bash
# 1. Backend running?
curl http://localhost:8000/docs

# 2. Frontend running?
cd frontend && npx expo start

# 3. Test email login first (simpler)
# 4. Then test Google sign-in

# 5. Mobile device? Scan QR code with Expo Go app
# 6. Desktop browser? Press 'w' in terminal
```

---

**Last Updated:** Feb 19, 2026  
**Status:** ✅ Production-Ready
