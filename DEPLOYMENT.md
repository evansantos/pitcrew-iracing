# Deployment Guide

This project can be deployed in two configurations:

## 1. Monolith Deployment (Cheaper, Single Service)

**File**: `render.yaml`

Deploys API and webapp as a single service. The API serves the static webapp files.

**Pros**:
- Cheaper (only one service)
- Simpler setup
- No CORS issues

**Cons**:
- Slower deploys (must rebuild both)
- Can't scale independently

**Deploy**:
```bash
# In Render Dashboard, use render.yaml
```

## 2. Split Deployment (API + Webapp Separate)

**Files**: `render-api.yaml` + `render-web.yaml`

Deploys API and webapp as separate services.

**Pros**:
- Faster deploys (can deploy independently)
- Can scale independently
- Webapp uses Render's global CDN

**Cons**:
- More expensive (two services)
- Requires CORS configuration

**Deploy**:

### Step 1: Deploy API Backend
```bash
# In Render Dashboard, create service using render-api.yaml
# Note the API URL: https://pitcrew-iracing-api.onrender.com
```

### Step 2: Update Webapp Config
Update `render-web.yaml` with your actual API URL:
```yaml
- key: NEXT_PUBLIC_API_URL
  value: https://your-actual-api-url.onrender.com
- key: NEXT_PUBLIC_WS_URL
  value: https://your-actual-api-url.onrender.com
```

### Step 3: Deploy Webapp
```bash
# In Render Dashboard, create service using render-web.yaml
```

## Cost Comparison

### Monolith (render.yaml)
- 1x Web Service: Free or $7/month (starter)
- 1x Redis: Free
- 1x PostgreSQL: Free
- **Total**: Free or $7/month

### Split (render-api.yaml + render-web.yaml)
- 1x API Web Service: Free or $7/month (starter)
- 1x Static Site: Free
- 1x Redis: Free
- 1x PostgreSQL: Free
- **Total**: Free or $7/month

## Recommendations

- **Development/Testing**: Use monolith (`render.yaml`) - simpler
- **Production (low traffic)**: Use monolith (`render.yaml`) - cheaper
- **Production (high traffic)**: Use split deployment - better performance
- **When you need CDN**: Use split deployment - webapp gets CDN

## Environment Variables

### API Backend (`render-api.yaml`)
- `DATABASE_URL`: Auto-set from database
- `REDIS_URL`: Auto-set from Redis
- `CORS_ORIGIN`: Set to `*` for split deployment
- `API_PORT`: 3000

### Webapp (`render-web.yaml`)
- `NEXT_PUBLIC_API_URL`: Your API service URL
- `NEXT_PUBLIC_WS_URL`: Your API service URL (Socket.IO)

## Troubleshooting

### Webapp can't connect to API
1. Check `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` are set correctly
2. Check API CORS is set to `*` or includes webapp domain
3. Check API health endpoint: `https://your-api.onrender.com/health`

### Strategy data not updating
1. Check backend logs for "Strategy calculated" messages
2. Verify relay is connected to API
3. Check browser console for WebSocket connection

### Database migrations fail
1. Check `DATABASE_URL` is set correctly
2. Ensure database is created in Render
3. Check drizzle-kit is installed in dependencies
