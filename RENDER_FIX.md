# Quick Fix for Render.com Build Error

## The Problem

You're getting this error:
```
npm error ERESOLVE unable to resolve dependency tree
```

**Root cause**: Render is trying to use `npm` in the `apps/api` directory, but this is a **pnpm monorepo** that must be built from the root.

## The Solution

You have 2 options:

---

## Option 1: Use Blueprint (Easiest - Recommended)

This will recreate your deployment correctly.

### Steps:

1. **Delete current services** (optional - or just create new ones):
   - Go to your Render dashboard
   - Delete the failing API service

2. **Deploy with Blueprint**:
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml`
   - Click "Apply"
   - Wait for deployment to complete

3. **Update environment variables**:
   After deployment, update the webapp service:
   - `NEXT_PUBLIC_API_URL` → `https://pitcrew-iracing.onrender.com` (your Render URL)
   - `NEXT_PUBLIC_WS_URL` → `wss://pitcrew-iracing.onrender.com:3001`

**Done!** ✅

---

## Option 2: Fix Existing Service Manually

If you want to keep your current service:

### Steps:

1. **Go to your API service** in Render dashboard

2. **Click "Settings"**

3. **Update Build & Deploy section**:

   **Root Directory**:
   ```
   (leave empty)
   ```

   **Build Command**:
   ```bash
   npm install -g pnpm && pnpm install && pnpm run build --filter=@iracing-race-engineer/api
   ```

   **Start Command**:
   ```bash
   pnpm run start --filter=@iracing-race-engineer/api
   ```

4. **Click "Save Changes"**

5. **Manual Deploy**:
   - Click "Manual Deploy" → "Deploy latest commit"
   - Wait for build to complete

**Done!** ✅

---

## Why This Happens

| What You Had | Why It Failed |
|--------------|---------------|
| `cd apps/api && npm install` | ❌ Can't use `npm` in a pnpm workspace |
| Build from `apps/api` | ❌ Missing workspace dependencies |
| No pnpm installed | ❌ Render doesn't have pnpm by default |

| What You Need | Why It Works |
|---------------|--------------|
| `npm install -g pnpm` | ✅ Installs pnpm first |
| `pnpm install` (from root) | ✅ Installs all workspace dependencies |
| `pnpm run build --filter=...` | ✅ Builds only the API package |

---

## Verify It Works

After deployment succeeds, test:

### 1. Check Health Endpoint
```bash
curl https://your-api.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T...",
  "uptime": 123.45
}
```

### 2. Check Socket.IO Endpoint
```bash
curl https://your-api.onrender.com/socket.io/
```

Should return Socket.IO info (not an error).

### 3. Check Build Logs
In Render dashboard, check that logs show:
```
[Build] ✅ Successfully built @iracing-race-engineer/api
[Deploy] ✅ API server running on http://0.0.0.0:3000
[Deploy] ✅ WebSocket server running on port 3001
```

---

## Still Having Issues?

### Build still failing?

Check package.json in the root - make sure you have:
```json
{
  "scripts": {
    "build": "turbo run build",
    "start": "turbo run start"
  }
}
```

### "pnpm: command not found"?

Add to start of build command:
```bash
npm install -g pnpm@latest && ...
```

### "Cannot find workspace"?

Make sure `pnpm-workspace.yaml` exists in root:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Environment variables not working?

Double-check in Render dashboard → Service → Environment:
- `DATABASE_URL` is set (auto-created if using Blueprint)
- `REDIS_URL` is set (auto-created if using Blueprint)
- `CORS_ORIGIN` is set to `*`

---

## Next Steps

After API is deployed successfully:

1. ✅ Deploy the webapp (same process)
2. ✅ Configure Windows relay to connect
3. ✅ Test end-to-end flow

See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for complete instructions.
