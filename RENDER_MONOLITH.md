# Deploying as Single Service (Monolith) on Render.com

## Overview

This guide shows you how to deploy **both the API and Webapp** as a **single service** on Render.com.

### Benefits

✅ **Simpler**: Only 1 service to manage instead of 2
✅ **Cheaper**: $0 on free tier (or $7/month vs $14/month on paid)
✅ **Faster**: No separate CORS/networking between services
✅ **Single URL**: Everything served from one domain

### How It Works

```
┌──────────────────────────────────┐
│   Render Service (Port 3000)     │
│   ┌──────────────────────────┐   │
│   │  Fastify API Server      │   │
│   │  - /api/* → API routes   │   │
│   │  - /* → Webapp (static)  │   │
│   │  - Port 3001 → Socket.IO │   │
│   └──────────────────────────┘   │
└──────────────────────────────────┘
```

## Quick Deploy (Recommended)

### Option 1: Blueprint with render-monolith.yaml

1. **Push to GitHub**:
   ```bash
   git add render-monolith.yaml
   git commit -m "Add monolith deployment config"
   git push
   ```

2. **Deploy on Render**:
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Blueprint"
   - Connect your GitHub repo
   - Select `render-monolith.yaml`
   - Click "Apply"

3. **Done!** ✅
   - API + Webapp deployed to one URL
   - Database and Redis auto-created

### Option 2: Manual Setup

1. **Create Web Service**:
   - New + → Web Service
   - Connect GitHub repo
   - Configure:

   **Name**: `iracing-race-engineer`

   **Build Command**:
   ```bash
   npm install -g pnpm && pnpm install && pnpm run build --filter=@iracing-race-engineer/api && pnpm run build --filter=@iracing-race-engineer/web
   ```

   **Start Command**:
   ```bash
   pnpm run start --filter=@iracing-race-engineer/api
   ```

2. **Add Environment Variables**:
   ```env
   NODE_ENV=production
   API_PORT=3000
   SOCKET_PORT=3001
   CORS_ORIGIN=*
   DATABASE_URL=(auto from Render PostgreSQL)
   REDIS_URL=(auto from Render Redis)
   NEXT_PUBLIC_API_URL=https://your-app.onrender.com
   NEXT_PUBLIC_WS_URL=wss://your-app.onrender.com:3001
   ```

3. **Add Database**: New + → PostgreSQL
4. **Add Redis**: New + → Redis
5. **Deploy!**

## Architecture Details

### What Gets Built

```bash
# Build API
pnpm run build --filter=@iracing-race-engineer/api
# Output: apps/api/dist/

# Build Webapp (static export)
pnpm run build --filter=@iracing-race-engineer/web
# Output: apps/web/out/
```

### What Gets Served

| URL Pattern | Served By | Description |
|-------------|-----------|-------------|
| `/` | Webapp | Homepage |
| `/dashboard` | Webapp | Dashboard page |
| `/_next/*` | Webapp | Next.js assets |
| `/api/telemetry` | API | Telemetry data |
| `/api/session` | API | Session info |
| `/api/race-engineer` | API | AI assistant |
| `/health` | API | Health check |

Socket.IO runs on port 3001 (same host).

## Configuration

### Next.js Static Export

The webapp is built as a static export (`output: 'export'` in `next.config.ts`).

**Limitations**:
- No Server-Side Rendering (SSR)
- No API routes in Next.js
- No dynamic routing on server
- Client-side routing only

**Why It Works**:
- Our app is already client-side rendered
- We use external API (Fastify)
- No Next.js API routes needed
- Perfect for this use case!

### API Serves Static Files

In `apps/api/src/index.ts`:
```typescript
if (process.env.NODE_ENV === 'production') {
  // Serve webapp static files
  await fastify.register(fastifyStatic, {
    root: webAppExportPath,
    prefix: '/',
  });

  // Handle client-side routing
  fastify.setNotFoundHandler(...);
}
```

## Testing Locally

Simulate production deployment:

```bash
# Build both projects
pnpm run build --filter=@iracing-race-engineer/api
pnpm run build --filter=@iracing-race-engineer/web

# Start in production mode
NODE_ENV=production pnpm run start --filter=@iracing-race-engineer/api
```

Visit:
- `http://localhost:3000` → Webapp
- `http://localhost:3000/api/health` → API
- `http://localhost:3001` → Socket.IO

## Connecting the Relay

From your Windows machine:

```cmd
python windows-relay-server-socketio.py --host your-app.onrender.com --port 443 --secure
```

Or edit `connect-to-render.bat`:
```bat
set API_HOST=your-app.onrender.com
set API_PORT=443
```

## Troubleshooting

### "Cannot GET /" shows blank page

**Cause**: Webapp not built or not served

**Fix**:
1. Check build logs: `pnpm run build --filter=@iracing-race-engineer/web` succeeded
2. Check `apps/web/out/` directory exists
3. Check API logs for "Serving Next.js webapp"

### API routes return HTML instead of JSON

**Cause**: Static file handler catching API routes

**Fix**: API routes are checked first in the `setNotFoundHandler`, so this shouldn't happen. If it does, check route registration order.

### WebSocket connection fails

**Cause**: Socket.IO port not exposed

**Fix**:
- Render should automatically expose both ports
- Use `wss://` (secure WebSocket) in production
- Check `NEXT_PUBLIC_WS_URL` is correct

### Webapp shows old content after deploy

**Cause**: Browser cache or build cache

**Fix**:
1. Hard refresh: Ctrl+Shift+R (Chrome/Firefox)
2. Clear build cache on Render
3. Add cache-busting to Next.js config

## Comparison: Monolith vs Microservices

### Monolith (This Guide)

**Pros:**
- ✅ Single service = cheaper
- ✅ Simpler deployment
- ✅ No CORS issues
- ✅ Single URL
- ✅ Easier to manage

**Cons:**
- ❌ Can't scale API and Webapp independently
- ❌ Single point of failure
- ❌ Must use static export (no SSR)

**Best for:**
- Small to medium apps
- Cost-sensitive deployments
- Hobby/personal projects

### Microservices (Separate Deployments)

**Pros:**
- ✅ Independent scaling
- ✅ Full Next.js features (SSR, API routes)
- ✅ Better separation of concerns

**Cons:**
- ❌ 2 services = 2x cost
- ❌ More complex
- ❌ CORS configuration needed
- ❌ 2 URLs to manage

**Best for:**
- Large apps
- Production deployments
- Need SSR or Next.js API routes

## When to Switch to Microservices

Consider switching if:
- Need Server-Side Rendering (SSR)
- API and Webapp have different scaling needs
- Want to use Next.js API routes
- Have budget for multiple services ($14/month vs $7/month)

To switch: Use `render.yaml` instead of `render-monolith.yaml`

## Cost Breakdown

### Monolith Deployment

| Service | Free Tier | Paid (Starter) |
|---------|-----------|----------------|
| Web Service | $0 (sleeps) | $7/month |
| PostgreSQL | $0 (limited) | $7/month |
| Redis | $0 (25MB) | $10/month |
| **Total** | **$0** | **~$24/month** |

### Microservices Deployment

| Service | Free Tier | Paid (Starter) |
|---------|-----------|----------------|
| API Service | $0 | $7/month |
| Webapp Service | $0 | $7/month |
| PostgreSQL | $0 | $7/month |
| Redis | $0 | $10/month |
| **Total** | **$0** | **~$31/month** |

**Savings**: $7/month with monolith!

## Next Steps

1. ✅ Deploy using Blueprint or Manual method
2. ✅ Test health endpoint: `https://your-app.onrender.com/health`
3. ✅ Visit webapp: `https://your-app.onrender.com`
4. ✅ Connect Windows relay
5. ✅ Start iRacing and race!

## Related Documentation

- [RENDER_FIX.md](RENDER_FIX.md) - Fix build errors
- [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) - Microservices deployment
- [WEBSOCKET_SETUP.md](WEBSOCKET_SETUP.md) - WebSocket architecture
- [tools/QUICK_START.md](tools/QUICK_START.md) - Relay quick start

---

**Recommended**: Use this monolith deployment for most use cases. It's simpler, cheaper, and works great for this application!
