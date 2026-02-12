# 🚀 Qdrant Cloud - Quick Start Guide

## ⚡ Quick Setup (5 minutes)

### 1️⃣ Get Qdrant Cloud Credentials
1. Go to: **https://cloud.qdrant.io/**
2. Sign up / Log in
3. Click **"Create Cluster"**
4. Choose **Free Tier** (1GB storage)
5. Copy your **Cluster URL** (looks like: `https://xxx-xxx-xxx.qdrant.io`)
6. Go to **"API Keys"** → **"Create API Key"**
7. Copy the API key (you won't see it again!)

### 2️⃣ Update Your .env File
```bash
# Replace these lines in your .env file:
QDRANT_URL=https://your-actual-cluster-url.qdrant.io
QDRANT_API_KEY=your-actual-api-key-here
```

### 3️⃣ Validate Connection
```bash
python validate_qdrant_cloud.py
```

You should see:
```
✅ Successfully connected to Qdrant Cloud!
✅ Validation Complete!
```

### 4️⃣ Start Your Application
```bash
uvicorn app.main:app --reload
```

Look for this in the logs:
```
✅ Successfully connected to Qdrant Cloud at https://xxx.qdrant.io
✅ Qdrant posts collection initialized
```

---

## 🚢 Production Deployment (Fly.io)

### Set Secrets
```bash
fly secrets set QDRANT_URL=https://your-cluster-url.qdrant.io
fly secrets set QDRANT_API_KEY=your-api-key-here
fly secrets set QDRANT_COLLECTION_NAME=netzeal_posts
```

### Deploy
```bash
fly deploy
```

### Verify
```bash
fly logs
```

Look for:
```
✅ Successfully connected to Qdrant Cloud
```

---

## ❓ Troubleshooting

### Error: "QDRANT_URL environment variable is required"
**Fix:** Add `QDRANT_URL` to your `.env` file

### Error: "QDRANT_API_KEY environment variable is required"
**Fix:** Add `QDRANT_API_KEY` to your `.env` file

### Error: "Failed to connect to Qdrant Cloud"
**Check:**
1. ✅ URL starts with `https://` (not `http://`)
2. ✅ API key is correct (no extra spaces)
3. ✅ Cluster is running (check Qdrant Cloud dashboard)
4. ✅ You have internet connection

### Collection Not Found
**This is normal!** The collection will be created automatically when:
- The app starts for the first time
- You create your first post

Or manually create it:
```bash
python -m app.scripts.init_qdrant
```

---

## 📊 What Changed?

| Before | After |
|--------|-------|
| Local Qdrant (localhost:6333) | Qdrant Cloud (HTTPS) |
| No authentication | API key required |
| Manual setup required | Managed service |
| In-memory fallback | Fail-fast with clear errors |

---

## ✅ What Stayed the Same?

- ✅ All API endpoints
- ✅ All business logic
- ✅ All search functionality
- ✅ All recommendation logic
- ✅ Collection names and structure
- ✅ Vector dimensions (384)
- ✅ Distance metric (COSINE)

**Result:** Zero functional changes, just better infrastructure!

---

## 📚 More Help?

- **Full Migration Guide:** `QDRANT_CLOUD_MIGRATION.md`
- **All Changes:** `MIGRATION_SUMMARY.md`
- **Qdrant Docs:** https://qdrant.tech/documentation/
- **Qdrant Cloud:** https://cloud.qdrant.io/

---

## 🎯 Next Steps

1. ✅ Update `.env` with real credentials
2. ✅ Run validation script
3. ✅ Test locally
4. ✅ Deploy to production
5. ✅ Monitor Qdrant Cloud dashboard

**You're all set! 🎉**
