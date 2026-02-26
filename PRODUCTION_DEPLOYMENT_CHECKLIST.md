# NetZeal Production Deployment Checklist

## 1) Pre-deploy
- [ ] Fill backend env from `backend/.env.production.example`
- [ ] Fill frontend env from `frontend/.env.production.example`
- [ ] Set production Google OAuth clients (Android/iOS/Web) in Google Cloud Console
- [ ] Add production redirect domains and package/bundle IDs:
  - Android package: `com.netzeal.app`
  - iOS bundle: `com.netzeal.app`
  - Backend API domain (for token exchange): `https://api.netzeal.com`

## 2) Backend deploy (Render)
- [ ] Push latest branch to Git remote connected to Render
- [ ] Render uses `render.yaml` web service `netzeal-backend`
- [ ] Confirm health check: `/health/ready`
- [ ] Confirm migration auto-run (`RUN_MIGRATIONS=true`)
- [ ] Confirm cron service `netzeal-db-backup` is scheduled and successful

### Suggested backend URL
- API: `https://api.netzeal.com`
- Health: `https://api.netzeal.com/health`
- Ready: `https://api.netzeal.com/health/ready`
- Ping: `https://api.netzeal.com/api/v1/ping`

## 3) Database backups
- [ ] Ensure `DATABASE_URL` set for cron service
- [ ] Ensure `BACKUP_RETENTION_DAYS` set (default: 7)
- [ ] (Optional) Set `BACKUP_S3_BUCKET` + AWS credentials for offsite backups
- [ ] Validate first backup run in cron logs

## 4) Expo production build (Android)
From `frontend/`:
- [ ] `npm install`
- [ ] `npx eas login`
- [ ] Build AAB: `npx eas build --platform android --profile production`
- [ ] Build APK: `npx eas build --platform android --profile production-apk`
- [ ] Download artifact URLs from EAS build dashboard

## 5) Verify Google OAuth in production
- [ ] Sign in with Google on production build
- [ ] Backend receives and validates token on `/api/v1/auth/google`
- [ ] User can refresh session (`/api/v1/auth/refresh`) and call `/api/v1/auth/me`
- [ ] Verify no account conflict with same email between email/password and Google

## 6) Smoke tests (critical)
- [ ] Health endpoints (`/health`, `/health/ready`, `/api/v1/ping`)
- [ ] Register -> verify email -> login
- [ ] Forgot password -> reset password -> login with new password
- [ ] Feed load (`/api/v1/content/feed-cursor`)
- [ ] Like/comment actions
- [ ] Chat list and send message
- [ ] Logout invalidates refresh token

Run automated API smoke checks:
- `python backend/scripts/smoke_test_prod.py` with:
  - `SMOKE_BASE_URL=https://api.netzeal.com`
  - `SMOKE_EMAIL=<test-user-email>`
  - `SMOKE_PASSWORD=<test-user-password>`

## 7) Live URLs (fill after deploy)
- Backend API: `TBD`
- Health URL: `TBD`
- Expo build dashboard: `TBD`
- Android AAB URL: `TBD`
- Android APK URL: `TBD`

## 8) Post-launch TODOs
- Add managed backup verification alerting (failure notifications)
- Add synthetic monitoring for `/health/ready` and `/api/v1/auth/me`
- Add automated end-to-end smoke tests in CI/CD
- Configure WAF/rate limits at edge
- Rotate secrets on schedule and enforce secret scanning in CI
