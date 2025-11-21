# Deployment Summary for Pitcrew iRacing

## Your Setup

**Project Name**: `pitcrew-iracing`
**Render URL**: `https://pitcrew-iracing.onrender.com`

## What You Need to Do

### Step 1: Fix Your Current Deployment

Your build is failing because Render is using `npm` in `apps/api`, but this is a pnpm monorepo.

#### Option A: Use Blueprint (Easiest - Recommended) ✅

1. Push `render-monolith.yaml` to GitHub:
   ```bash
   git add render-monolith.yaml
   git commit -m "Add monolith deployment config"
   git push
   ```

2. In Render Dashboard:
   - **Delete** your current failing service
   - Click "New +" → "Blueprint"
   - Connect your GitHub repo
   - Select `render-monolith.yaml`
   - Click "Apply"
   - Wait for deployment

#### Option B: Fix Current Service Manually

In your existing `pitcrew-iracing` service settings:

1. **Root Directory**: (leave empty)

2. **Build Command**:
   ```bash
   npm install -g pnpm && pnpm install && pnpm run build --filter=@iracing-race-engineer/api && pnpm run build --filter=@iracing-race-engineer/web
   ```

3. **Start Command**:
   ```bash
   pnpm run start --filter=@iracing-race-engineer/api
   ```

4. **Environment Variables** - Add these:
   ```env
   NODE_ENV=production
   API_PORT=3000
   SOCKET_PORT=3001
   CORS_ORIGIN=*
   NEXT_PUBLIC_API_URL=https://pitcrew-iracing.onrender.com
   NEXT_PUBLIC_WS_URL=wss://pitcrew-iracing.onrender.com:3001
   ```

5. Click "Save Changes" then "Manual Deploy"

### Step 2: Connect Windows Relay

After deployment succeeds, on your Windows machine:

#### Quick Method:
```cmd
cd tools
connect-to-pitcrew.bat
```

#### Command-Line Method:
```cmd
python windows-relay-server-socketio.py --host pitcrew-iracing.onrender.com --port 443 --secure
```

### Step 3: Test It Works

1. **Check Health**:
   ```bash
   curl https://pitcrew-iracing.onrender.com/health
   ```

   Should return:
   ```json
   {
     "status": "ok",
     "timestamp": "...",
     "uptime": 123.45
   }
   ```

2. **Visit Webapp**:
   Open `https://pitcrew-iracing.onrender.com` in browser

3. **Check Relay Connection**:
   Your relay should show:
   ```
   ✅ Connected to API server
   ✅ Relay identified
   ```

4. **Start iRacing** and join a session - telemetry should flow!

## Architecture (Monolith Deployment)

```
┌────────────────────────────────────────┐
│  https://pitcrew-iracing.onrender.com │
├────────────────────────────────────────┤
│  Fastify API Server (Port 3000)       │
│  ├─ /api/* → API routes                │
│  ├─ /* → Next.js webapp (static)       │
│  └─ Port 3001 → Socket.IO              │
└────────────────────────────────────────┘
         ▲
         │ HTTPS/WSS
         │
┌────────────────────┐
│  Windows PC        │
│  - iRacing         │
│  - Python Relay    │
└────────────────────┘
```

## Files Created/Modified

### Created:
- ✅ `render-monolith.yaml` - Blueprint configuration
- ✅ `RENDER_MONOLITH.md` - Monolith deployment guide
- ✅ `RENDER_FIX.md` - Fix for build errors
- ✅ `tools/connect-to-pitcrew.bat` - Quick connect script
- ✅ `tools/windows-relay-server-socketio.py` - Enhanced relay with CLI args

### Modified:
- ✅ `apps/api/src/index.ts` - Now serves webapp static files
- ✅ `apps/api/package.json` - Added @fastify/static
- ✅ `apps/web/next.config.ts` - Static export in production

## What Gets Deployed

| Service | What | Where |
|---------|------|-------|
| Web Service | API + Webapp | pitcrew-iracing.onrender.com |
| PostgreSQL | Database | pitcrew-db |
| Redis | Cache | pitcrew-redis |

**Total Cost**: $0 (free tier) or $24/month (paid tier)

## Next Steps After Deployment

1. ✅ Test health endpoint
2. ✅ Visit webapp in browser
3. ✅ Connect relay from Windows
4. ✅ Start iRacing
5. ✅ Race!

## Troubleshooting

### "Connection refused" from relay

**Wait 1 minute** - Render free tier services sleep and take 30-60 seconds to wake up.

Then try again:
```cmd
connect-to-pitcrew.bat
```

### Build still failing?

Make sure you're using **pnpm** not npm:
```bash
# Correct
npm install -g pnpm && pnpm install && pnpm run build ...

# Wrong
npm install && npm run build ...
```

### Webapp not showing?

Check build logs - both builds must succeed:
```
✓ Built @iracing-race-engineer/api
✓ Built @iracing-race-engineer/web
```

## Documentation Reference

- **[RENDER_FIX.md](RENDER_FIX.md)** - Fix build errors
- **[RENDER_MONOLITH.md](RENDER_MONOLITH.md)** - Full monolith guide
- **[tools/QUICK_START.md](tools/QUICK_START.md)** - Relay quick start
- **[WEBSOCKET_SETUP.md](WEBSOCKET_SETUP.md)** - Architecture overview

## Support

Having issues? Check the logs in Render dashboard:
1. Go to your service
2. Click "Logs"
3. Look for errors in build or deploy phase

Common issues are covered in [RENDER_FIX.md](RENDER_FIX.md)

---

**Your URLs:**
- Webapp: `https://pitcrew-iracing.onrender.com`
- API: `https://pitcrew-iracing.onrender.com/api/*`
- Health: `https://pitcrew-iracing.onrender.com/health`
- Socket.IO: `wss://pitcrew-iracing.onrender.com:3001`

Good luck racing! 🏁
