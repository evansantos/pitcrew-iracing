# Complete Deployment Guide - Pitcrew iRacing

## Quick Summary

You have **ONE deployment file**: `render.yaml`

This deploys **both API and Webapp** as a **single service** on Render.com.

**Your URL**: `https://pitcrew-iracing.onrender.com`

---

## Step-by-Step Deployment

### 1. Push to GitHub

```bash
# Add all changes
git add .

# Commit
git commit -m "Add deployment configuration"

# Push
git push
```

### 2. Deploy on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "**New +**" → "**Blueprint**"
3. Connect your GitHub repository
4. Render will detect `render.yaml`
5. Review the services:
   - ✅ `pitcrew-iracing` - Web Service
   - ✅ `pitcrew-db` - PostgreSQL Database
   - ✅ `pitcrew-redis` - Redis Cache
6. Click "**Apply**"
7. Wait 5-10 minutes for build and deploy

### 3. Verify Deployment

After deployment completes:

**Check Health**:
```bash
curl https://pitcrew-iracing.onrender.com/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T...",
  "uptime": 123.45
}
```

**Visit Webapp**:
Open in browser: `https://pitcrew-iracing.onrender.com`

### 4. Connect Windows Relay

On your Windows PC with iRacing:

```cmd
cd tools
connect-to-pitcrew.bat
```

Or manually:
```cmd
python windows-relay-server-socketio.py --host pitcrew-iracing.onrender.com --port 443 --secure
```

### 5. Start Racing! 🏁

1. Start iRacing
2. Join a session (practice, qualify, race)
3. Telemetry flows: iRacing → Relay → Render → Webapp
4. See live data in your browser!

---

## What Gets Deployed

```
┌─────────────────────────────────────────┐
│  pitcrew-iracing.onrender.com           │
├─────────────────────────────────────────┤
│  Single Web Service                     │
│  ├─ Fastify API (Port 3000)             │
│  ├─ Socket.IO (Port 3001)               │
│  ├─ Next.js Webapp (served by API)      │
│  ├─ PostgreSQL Database (pitcrew-db)    │
│  └─ Redis Cache (pitcrew-redis)         │
└─────────────────────────────────────────┘
```

## Build Process

When you deploy, Render runs:

```bash
# 1. Install pnpm
npm install -g pnpm

# 2. Install dependencies
pnpm install

# 3. Build API
pnpm run build --filter=@iracing-race-engineer/api

# 4. Build Webapp (static export)
pnpm run build --filter=@iracing-race-engineer/web

# 5. Start API (serves webapp too)
pnpm run start --filter=@iracing-race-engineer/api
```

## Environment Variables

Already configured in `render.yaml`:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | production |
| `API_PORT` | 3000 |
| `SOCKET_PORT` | 3001 |
| `CORS_ORIGIN` | * |
| `DATABASE_URL` | (auto from PostgreSQL) |
| `REDIS_URL` | (auto from Redis) |
| `NEXT_PUBLIC_API_URL` | https://pitcrew-iracing.onrender.com |
| `NEXT_PUBLIC_WS_URL` | wss://pitcrew-iracing.onrender.com:3001 |

## Cost

### Free Tier
- ✅ Web Service: $0 (sleeps after 15min)
- ✅ PostgreSQL: $0 (limited storage)
- ✅ Redis: $0 (25MB)
- **Total: $0/month**

### Paid Tier (Recommended)
- ✅ Web Service: $7/month (no sleeping!)
- ✅ PostgreSQL: $7/month
- ✅ Redis: $10/month
- **Total: ~$24/month**

## Troubleshooting

### Build Fails

**Error**: `npm error ERESOLVE unable to resolve dependency tree`

**Fix**: Make sure build command uses **pnpm**:
```bash
npm install -g pnpm && pnpm install && pnpm run build ...
```

See [RENDER_FIX.md](RENDER_FIX.md) for details.

### Relay Can't Connect

**Error**: `Connection refused`

**Fix**:
1. Wait 1 minute (Render wakes up sleeping services)
2. Check URL is correct: `pitcrew-iracing.onrender.com`
3. Use `--secure` flag for HTTPS
4. Visit webapp in browser first to wake up service

### Webapp Not Loading

**Check**:
1. Build logs show: `✓ Built @iracing-race-engineer/web`
2. API logs show: `✅ Serving Next.js webapp from API server`
3. `/health` endpoint works

### No Telemetry Data

**Check**:
1. Relay connected: Shows "✅ Connected to API server"
2. iRacing running and in session
3. Webapp shows "Relay: connected"
4. Browser console for errors

## Files Reference

| File | Purpose |
|------|---------|
| `render.yaml` | Deployment configuration |
| `DEPLOY_SUMMARY.md` | This guide |
| `RENDER_FIX.md` | Fix build errors |
| `RENDER_MONOLITH.md` | Detailed monolith info |
| `tools/connect-to-pitcrew.bat` | Quick relay connect |
| `tools/windows-relay-server-socketio.py` | Relay server |

## Support

**Documentation**:
- [RENDER_FIX.md](RENDER_FIX.md) - Build errors
- [RENDER_MONOLITH.md](RENDER_MONOLITH.md) - Monolith details
- [WEBSOCKET_SETUP.md](WEBSOCKET_SETUP.md) - Architecture
- [tools/QUICK_START.md](tools/QUICK_START.md) - Relay guide

**Logs**:
1. Go to Render dashboard
2. Click your service
3. Click "Logs" tab
4. Look for errors

---

**You're all set!** 🎉

1. ✅ Deploy with Blueprint
2. ✅ Wait for build (5-10 min)
3. ✅ Connect relay from Windows
4. ✅ Start racing!

Visit: `https://pitcrew-iracing.onrender.com`
