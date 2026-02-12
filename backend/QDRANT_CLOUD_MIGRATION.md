# Qdrant Cloud Migration Guide

## Overview
This application now uses **Qdrant Cloud** for vector database operations instead of a locally hosted Qdrant instance. This provides better scalability, reliability, and eliminates the need to manage Qdrant infrastructure.

## What Changed
- ✅ Removed local Qdrant server dependency (localhost:6333)
- ✅ Migrated to Qdrant Cloud with HTTPS and API key authentication
- ✅ Removed in-memory fallback (not suitable for production)
- ✅ Added proper error handling and connection validation
- ✅ Updated environment variable requirements

## Setup Instructions

### 1. Create a Qdrant Cloud Account
1. Go to [https://cloud.qdrant.io/](https://cloud.qdrant.io/)
2. Sign up for a free account (or use an existing account)
3. Create a new cluster:
   - **Free tier**: 1GB storage, perfect for development
   - **Paid tier**: For production workloads

### 2. Get Your Credentials
After creating a cluster:
1. **Cluster URL**: Copy from the dashboard (format: `https://xxx-xxx-xxx.qdrant.io`)
2. **API Key**: 
   - Go to "API Keys" section
   - Click "Create API Key"
   - Copy the generated key (you won't be able to see it again!)

### 3. Update Environment Variables
Update your `.env` file with the Qdrant Cloud credentials:

```bash
# Qdrant Cloud Configuration
QDRANT_URL=https://your-cluster-id.qdrant.io
QDRANT_API_KEY=your-actual-api-key-here
QDRANT_COLLECTION_NAME=netzeal_posts
```

### 4. Initialize the Collection
The collection will be automatically created on first use. You can also manually initialize it:

```bash
python -m app.scripts.init_qdrant
```

## Deployment (Fly.io / Production)

### Setting Environment Variables
For production deployment, set the environment variables securely:

**Fly.io:**
```bash
fly secrets set QDRANT_URL=https://your-cluster-id.qdrant.io
fly secrets set QDRANT_API_KEY=your-actual-api-key-here
fly secrets set QDRANT_COLLECTION_NAME=netzeal_posts
```

**Other platforms:**
- Use your platform's secrets management system
- Never commit credentials to version control
- Ensure `.env` is in `.gitignore`

## Verification

### Test Connection
Start your application and check the logs:

```bash
uvicorn app.main:app --reload
```

You should see:
```
✅ Successfully connected to Qdrant Cloud at https://xxx.qdrant.io
✅ Qdrant posts collection initialized
```

### Common Issues

**Error: "QDRANT_URL environment variable is required"**
- Solution: Ensure `QDRANT_URL` is set in your `.env` file

**Error: "QDRANT_API_KEY environment variable is required"**
- Solution: Ensure `QDRANT_API_KEY` is set in your `.env` file

**Error: "Failed to connect to Qdrant Cloud"**
- Check that your cluster URL is correct (should start with `https://`)
- Verify your API key is valid
- Ensure your cluster is running (check Qdrant Cloud dashboard)
- Check network connectivity

## Data Migration (If Needed)

If you have existing data in a local Qdrant instance that needs to be migrated:

1. **Export from local Qdrant:**
   ```python
   from qdrant_client import QdrantClient
   
   local_client = QdrantClient(url="http://localhost:6333")
   points = local_client.scroll(collection_name="netzeal_posts", limit=10000)
   ```

2. **Import to Qdrant Cloud:**
   ```python
   from qdrant_client import QdrantClient
   
   cloud_client = QdrantClient(
       url="https://your-cluster.qdrant.io",
       api_key="your-api-key"
   )
   cloud_client.upsert(collection_name="netzeal_posts", points=points[0])
   ```

## Architecture Notes

### Collection Schema
- **Collection Name**: `netzeal_posts`
- **Vector Dimensions**: 384 (MiniLM-L6-v2 embeddings)
- **Named Vectors**:
  - `caption_embedding`: Text caption embeddings
  - `hashtags_embedding`: Hashtag embeddings
  - `image_embedding`: Image feature embeddings
- **Distance Metric**: Cosine similarity

### Performance Considerations
- Qdrant Cloud provides automatic scaling
- Free tier: Suitable for development and small applications
- Paid tier: Recommended for production with high traffic
- Connection timeout: 10 seconds (configurable)

## Rollback (Emergency Only)

If you need to temporarily rollback to local Qdrant:

1. Start local Qdrant:
   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   ```

2. Update `.env`:
   ```bash
   QDRANT_URL=http://localhost:6333
   QDRANT_API_KEY=  # Leave empty for local
   ```

**Note**: This is not recommended for production. The application now expects cloud credentials.

## Support

- **Qdrant Cloud Docs**: [https://qdrant.tech/documentation/cloud/](https://qdrant.tech/documentation/cloud/)
- **Qdrant Client Docs**: [https://qdrant.tech/documentation/](https://qdrant.tech/documentation/)
- **Community**: [https://discord.gg/qdrant](https://discord.gg/qdrant)

## Security Best Practices

1. ✅ Never commit `.env` file to version control
2. ✅ Use environment-specific credentials (dev, staging, prod)
3. ✅ Rotate API keys periodically
4. ✅ Use read-only API keys where write access is not needed
5. ✅ Monitor API usage in Qdrant Cloud dashboard
6. ✅ Enable IP whitelisting if available in your plan

## Cost Optimization

- **Free Tier**: 1GB storage, sufficient for ~1M vectors (384-dim)
- **Monitor Usage**: Check Qdrant Cloud dashboard regularly
- **Optimize Queries**: Use filters to reduce search scope
- **Batch Operations**: Use bulk upsert for better performance
