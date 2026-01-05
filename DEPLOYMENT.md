# Deployment Guide for NetZeal

## Table of Contents
1. [Backend Deployment](#backend-deployment)
2. [Frontend Deployment](#frontend-deployment)
3. [Database Setup](#database-setup)
4. [Environment Variables](#environment-variables)
5. [Production Considerations](#production-considerations)

---

## Backend Deployment

### Option 1: Render (Recommended for Free Tier)

#### Prerequisites
- GitHub account
- Render account (free)
- PostgreSQL database (Neon, Supabase, or Render)

#### Steps

1. **Prepare Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Create Render Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: netzeal-api
     - **Environment**: Python 3
     - **Build Command**: `pip install -r backend/requirements.txt`
     - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
     - **Instance Type**: Free

3. **Add Environment Variables**
   In Render dashboard, add these environment variables:
   ```
   DATABASE_URL=postgresql://...
   SECRET_KEY=your-secret-key
   OPENAI_API_KEY=sk-...
   PINECONE_API_KEY=...
   PINECONE_ENVIRONMENT=...
   PINECONE_INDEX_NAME=netzeal-vectors
   DEBUG=False
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note your API URL: `https://netzeal-api.onrender.com`

### Option 2: Railway

1. **Install Railway CLI**
   ```powershell
   npm install -g @railway/cli
   ```

2. **Login and Initialize**
   ```powershell
   railway login
   cd backend
   railway init
   ```

3. **Add PostgreSQL Database**
   ```powershell
   railway add --database postgresql
   ```

4. **Set Environment Variables**
   ```powershell
   railway variables set SECRET_KEY=your-secret-key
   railway variables set OPENAI_API_KEY=sk-...
   railway variables set PINECONE_API_KEY=...
   ```

5. **Deploy**
   ```powershell
   railway up
   ```

### Option 3: AWS EC2 (Production)

1. **Launch EC2 Instance**
   - Ubuntu Server 22.04 LTS
   - t2.micro (free tier) or larger
   - Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)

2. **SSH into Instance**
   ```bash
   ssh -i your-key.pem ubuntu@your-instance-ip
   ```

3. **Install Dependencies**
   ```bash
   sudo apt update
   sudo apt install python3-pip python3-venv nginx -y
   ```

4. **Clone Repository**
   ```bash
   git clone <your-repo-url>
   cd netzeal/backend
   ```

5. **Setup Virtual Environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

6. **Configure Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/netzeal
   ```
   
   Add:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

7. **Setup Systemd Service**
   ```bash
   sudo nano /etc/systemd/system/netzeal.service
   ```
   
   Add:
   ```ini
   [Unit]
   Description=NetZeal FastAPI
   After=network.target
   
   [Service]
   User=ubuntu
   WorkingDirectory=/home/ubuntu/netzeal/backend
   Environment="PATH=/home/ubuntu/netzeal/backend/venv/bin"
   ExecStart=/home/ubuntu/netzeal/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
   
   [Install]
   WantedBy=multi-user.target
   ```

8. **Start Service**
   ```bash
   sudo systemctl enable netzeal
   sudo systemctl start netzeal
   sudo systemctl enable nginx
   sudo systemctl restart nginx
   ```

---

## Frontend Deployment

### Option 1: Expo EAS Build (Recommended)

#### Prerequisites
- Expo account (free)
- EAS CLI installed

#### Steps

1. **Install EAS CLI**
   ```powershell
   npm install -g eas-cli
   ```

2. **Login to Expo**
   ```powershell
   eas login
   ```

3. **Configure Project**
   ```powershell
   cd frontend
   eas build:configure
   ```

4. **Update API URL**
   Edit `src/services/api.js`:
   ```javascript
   const API_BASE_URL = 'https://your-backend-url.com/api/v1';
   ```

5. **Build for Android**
   ```powershell
   eas build --platform android --profile production
   ```

6. **Build for iOS**
   ```powershell
   eas build --platform ios --profile production
   ```

7. **Submit to Stores**
   ```powershell
   eas submit --platform android
   eas submit --platform ios
   ```

### Option 2: Local Build

#### Android

1. **Install Android Studio** and configure SDK

2. **Generate APK**
   ```powershell
   cd frontend
   expo build:android -t apk
   ```

3. **Download and Install**
   - Download APK from Expo
   - Transfer to Android device
   - Install APK

#### iOS (Requires Mac)

1. **Install Xcode** from App Store

2. **Generate IPA**
   ```powershell
   expo build:ios
   ```

3. **Deploy via TestFlight** or direct distribution

---

## Database Setup

### Option 1: Neon (Recommended - Free PostgreSQL)

1. **Create Account** at [Neon.tech](https://neon.tech)
2. **Create Project**
   - Name: NetZeal
   - Region: Choose nearest
3. **Copy Connection String**
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/netzealdb
   ```
4. **Add to Environment Variables**

### Option 2: Supabase

1. **Create Account** at [Supabase.com](https://supabase.com)
2. **Create New Project**
3. **Get Connection String** from Settings → Database
4. **Use in DATABASE_URL**

### Option 3: Render PostgreSQL

1. In Render Dashboard, click "New +"
2. Select "PostgreSQL"
3. Name: netzeal-db
4. Copy Internal Database URL
5. Add to environment variables

---

## Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Security
SECRET_KEY=your-very-long-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

# Pinecone
PINECONE_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=netzeal-vectors

# Application
API_V1_PREFIX=/api/v1
PROJECT_NAME=NetZeal
DEBUG=False
```

### Frontend (config.js)
```javascript
export const config = {
  API_URL: 'https://your-backend.com/api/v1',
  APP_NAME: 'NetZeal',
  VERSION: '1.0.0',
};
```

---

## Production Considerations

### Security

1. **Enable HTTPS**
   ```bash
   # Using Certbot for Let's Encrypt
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

2. **Update CORS Settings**
   In `backend/app/main.py`:
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["https://your-frontend-domain.com"],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

3. **Environment Variables**
   - Never commit `.env` files
   - Use platform's secret management
   - Rotate keys regularly

### Performance

1. **Database Connection Pooling**
   ```python
   engine = create_engine(
       DATABASE_URL,
       pool_size=10,
       max_overflow=20
   )
   ```

2. **Caching** (Add Redis)
   ```bash
   pip install redis
   ```

3. **Background Tasks** (Use Celery)
   ```bash
   pip install celery
   ```

### Monitoring

1. **Add Logging**
   ```python
   import logging
   logging.basicConfig(level=logging.INFO)
   ```

2. **Use Sentry** for error tracking
   ```bash
   pip install sentry-sdk
   ```

3. **Setup Health Checks**
   Already implemented at `/health` endpoint

### Backup

1. **Database Backups**
   ```bash
   # Automated daily backups
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   ```

2. **Code Backups**
   - Use Git tags for releases
   - Maintain separate branches for environments

### Scaling

1. **Horizontal Scaling**
   - Add more Render/Railway instances
   - Use load balancer

2. **Database Scaling**
   - Upgrade to paid tier
   - Add read replicas
   - Implement caching

3. **CDN for Media**
   - Use AWS S3 + CloudFront
   - Or Cloudinary for images

---

## Testing Deployment

1. **Test Backend**
   ```bash
   curl https://your-api-url.com/health
   curl https://your-api-url.com/docs
   ```

2. **Test Frontend**
   - Install app on test device
   - Try registration
   - Test all features
   - Check error handling

3. **Load Testing**
   ```bash
   pip install locust
   locust -f load_test.py
   ```

---

## Rollback Strategy

1. **Keep Previous Versions**
   ```bash
   git tag -a v1.0.0 -m "Release 1.0.0"
   git push origin v1.0.0
   ```

2. **Quick Rollback**
   - On Render: Deploy previous commit
   - On Railway: `railway rollback`
   - On AWS: Restore previous Docker image

---

## Support

For deployment issues:
- Check deployment logs
- Review environment variables
- Test database connectivity
- Verify API endpoints
- Check CORS configuration

Good luck with your deployment! 🚀
