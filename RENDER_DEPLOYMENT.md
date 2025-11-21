# Deploying to Render.com

This guide covers deploying the iRacing Race Engineer API and Webapp to Render.com, with the Python relay running on your Windows machine.

## Architecture

```
┌─────────────────────┐
│  Windows PC         │
│  - iRacing          │
│  - Python Relay ────┼───┐
└─────────────────────┘   │
                          │ HTTPS/WSS
                          │ (Port 443)
                          ▼
                   ┌──────────────────┐
                   │   Render.com     │
                   │  ┌────────────┐  │
                   │  │ API Server │  │
                   │  │ Port 3001  │  │
                   │  └─────┬──────┘  │
                   │        │         │
                   │  ┌─────▼──────┐  │
                   │  │   Webapp   │  │
                   │  │ Next.js    │  │
                   │  └────────────┘  │
                   └──────────────────┘
```

## Prerequisites

1. Render.com account (free tier works!)
2. GitHub repository with your code
3. Windows machine with iRacing for the relay

## Quick Deploy (Easiest Method)

We've included a `render.yaml` file that automatically configures everything!

### One-Click Deploy

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Select the repository
5. Render will detect `render.yaml` and create all services automatically!
6. Click "Apply" and wait for deployment

**What gets created:**
- ✅ API Server (with health checks)
- ✅ Webapp
- ✅ PostgreSQL Database
- ✅ Redis Cache

All environment variables are pre-configured!

### After Blueprint Deploy

Just update these in the API service environment:
- `NEXT_PUBLIC_API_URL` in webapp → Use your actual API URL
- `NEXT_PUBLIC_WS_URL` in webapp → Use your actual API URL with wss://

---

## Manual Deploy (Alternative Method)

If you prefer manual control, follow these steps:

## Step 1: Deploy API Server

### 1.1 Create a New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `iracing-api` (or your choice)
   - **Environment**: `Node`
   - **Root Directory**: Leave blank (build from root)
   - **Build Command**: `npm install -g pnpm && pnpm install && pnpm run build --filter=@iracing-race-engineer/api`
   - **Start Command**: `pnpm run start --filter=@iracing-race-engineer/api`
   - **Plan**: Free (or paid for better performance)

**Important**: This is a pnpm monorepo, so we must build from the root!

### 1.2 Environment Variables

Add these environment variables in Render:

```env
# Database
DATABASE_URL=your_postgres_connection_string

# Redis (use Render Redis or external)
REDIS_URL=your_redis_connection_string

# Server
NODE_ENV=production
API_PORT=3000
SOCKET_PORT=3001

# CORS - Allow all origins for relay connection
CORS_ORIGIN=*

# Ollama (optional - for AI features)
OLLAMA_BASE_URL=http://your-ollama-instance:11434
```

### 1.3 Get Your API URL

After deployment, Render will give you a URL like:
```
https://iracing-api.onrender.com
```

**Save this URL** - you'll need it for the relay configuration.

## Step 2: Deploy Webapp

### 2.1 Create Another Web Service

1. Click "New +" → "Web Service"
2. Connect same GitHub repository
3. Configure:
   - **Name**: `iracing-webapp`
   - **Environment**: `Node`
   - **Root Directory**: Leave blank (build from root)
   - **Build Command**: `npm install -g pnpm && pnpm install && pnpm run build --filter=@iracing-race-engineer/web`
   - **Start Command**: `pnpm run start --filter=@iracing-race-engineer/web`
   - **Plan**: Free

### 2.2 Environment Variables

```env
# Point to your deployed API
NEXT_PUBLIC_API_URL=https://iracing-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://iracing-api.onrender.com:3001

NODE_ENV=production
```

### 2.3 Access Your Webapp

Your webapp will be available at:
```
https://iracing-webapp.onrender.com
```

## Step 3: Configure Database & Redis

### Option A: Use Render Add-ons (Recommended)

1. **PostgreSQL**:
   - In your API service, go to "Settings"
   - Click "Add PostgreSQL"
   - Render will create a database and set `DATABASE_URL`

2. **Redis**:
   - Click "New +" → "Redis"
   - Create a new Redis instance
   - Copy the `REDIS_URL` and add to API environment variables

### Option B: Use External Services

- **PostgreSQL**: Use [Neon](https://neon.tech/), [Supabase](https://supabase.com/), or [Railway](https://railway.app/)
- **Redis**: Use [Upstash](https://upstash.com/) or [Redis Cloud](https://redis.com/cloud/)

## Step 4: Configure Windows Relay

### 4.1 Quick Setup Script

On your Windows machine, edit `tools/connect-to-render.bat`:

```bat
set API_HOST=iracing-api.onrender.com
set API_PORT=443
```

Then run:
```cmd
cd tools
connect-to-render.bat
```

### 4.2 Command-Line Method

```cmd
python windows-relay-server-socketio.py --host iracing-api.onrender.com --port 443 --secure
```

### 4.3 Build Executable with Config

1. Edit `windows-relay-server-socketio.py` and set defaults:
   ```python
   # In parse_arguments(), change defaults:
   '--host', default='iracing-api.onrender.com'
   '--port', default=443
   '--secure', action='store_true', default=True
   ```

2. Build the executable:
   ```cmd
   build-relay.bat
   ```

3. Distribute `dist/iRacing-Relay-v3.0.exe` to users

## Render.com-Specific Configuration

### Port Configuration

Render.com services are accessible via:
- HTTP/HTTPS: Port 443 (automatic HTTPS)
- Internal port: Whatever you configure (3000, 3001, etc.)

For Socket.IO, configure the relay to use:
```cmd
--host your-api.onrender.com --port 443 --secure
```

Socket.IO will automatically upgrade to WSS (secure WebSocket).

### CORS Configuration

In your API (`apps/api/src/index.ts`), ensure CORS allows relay connections:

```typescript
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow connections from anywhere (relay can be on any IP)
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});
```

### Health Checks

Render.com will ping your `/health` endpoint. Ensure it's working:

```bash
curl https://iracing-api.onrender.com/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T...",
  "uptime": 123.45
}
```

## Testing the Deployment

### 1. Test API Health

```bash
curl https://iracing-api.onrender.com/health
```

### 2. Test Socket.IO Endpoint

```bash
curl https://iracing-api.onrender.com/socket.io/
```

Should return Socket.IO info (not an error).

### 3. Test Webapp

Visit `https://iracing-webapp.onrender.com` in browser.

### 4. Test Relay Connection

Run the relay on Windows:
```cmd
python windows-relay-server-socketio.py --host iracing-api.onrender.com --port 443 --secure
```

Expected output:
```
[Relay] Configuration:
[Relay]   API Server: https://iracing-api.onrender.com:443
[Relay]   Secure: Yes (HTTPS/WSS)
...
✅ Connected to API server
✅ Relay identified: Relay identified and ready to send telemetry
```

## Troubleshooting

### "Connection refused" from Relay

**Cause**: Render service might be sleeping (free tier)

**Solution**:
1. Visit your API URL to wake it up
2. Wait 30-60 seconds for service to start
3. Try connecting relay again

### "CORS error" in Browser

**Cause**: CORS not configured properly

**Solution**:
1. Check API environment variable: `CORS_ORIGIN=*`
2. Redeploy API if needed
3. Check browser console for exact error

### "Cannot find module" or Build Errors

**Cause**: Monorepo structure not handled correctly

**Solutions**:
1. **Use render.yaml** (recommended): Deploy via Blueprint with the included `render.yaml`
2. **Check build command**: Must use `pnpm` and build from root:
   ```bash
   npm install -g pnpm && pnpm install && pnpm run build --filter=@iracing-race-engineer/api
   ```
3. **Don't use npm**: This is a pnpm workspace, npm won't work correctly
4. **Root directory**: Must be empty (build from repo root, not from apps/api)

### "Database connection failed"

**Cause**: DATABASE_URL not set or incorrect

**Solution**:
1. Check Render dashboard → API service → Environment
2. Verify DATABASE_URL is set
3. Test connection string locally first

### Relay connects but no telemetry

**Cause**: iRacing not running or not in session

**Solution**:
1. Start iRacing
2. Join a session (practice, race, etc.)
3. Check relay logs for "Connected to iRacing"

## Performance Optimization

### Free Tier Limitations

- Services sleep after 15 minutes of inactivity
- Limited CPU/RAM
- Slower cold starts

### Recommended Upgrades

For production use:

1. **Starter Plan ($7/month per service)**
   - No sleeping
   - Better performance
   - More RAM

2. **Persistent Redis**
   - Prevents data loss on restart
   - Faster cache access

3. **PostgreSQL with more storage**
   - More telemetry history
   - Better query performance

### Optimize Cold Starts

Add a keep-alive service:

```javascript
// In API server
setInterval(() => {
  fetch('https://iracing-api.onrender.com/health')
}, 14 * 60 * 1000); // Ping every 14 minutes
```

Or use external services like:
- [UptimeRobot](https://uptimerobot.com/)
- [Cron-job.org](https://cron-job.org/)

## Cost Estimation

### Free Tier (Current)
- API: $0/month (sleeps after 15min)
- Webapp: $0/month (sleeps after 15min)
- PostgreSQL: $0/month (limited storage)
- Redis: $0/month (25MB)
- **Total: $0/month**

### Recommended Production
- API: $7/month (Starter)
- Webapp: $7/month (Starter)
- PostgreSQL: $7/month (Essential)
- Redis: $10/month (Essential)
- **Total: ~$31/month**

## Environment Variables Reference

### API Server

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | Yes | postgres://... | PostgreSQL connection string |
| REDIS_URL | Yes | redis://... | Redis connection string |
| CORS_ORIGIN | Yes | * | Allow all origins for relay |
| API_PORT | No | 3000 | HTTP API port |
| SOCKET_PORT | No | 3001 | Socket.IO port |
| OLLAMA_BASE_URL | No | http://... | AI service URL |

### Webapp

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| NEXT_PUBLIC_API_URL | Yes | https://api.onrender.com | API base URL |
| NEXT_PUBLIC_WS_URL | Yes | wss://api.onrender.com:3001 | WebSocket URL |

## Next Steps

1. **Set up monitoring**: Use Render's built-in metrics
2. **Configure alerts**: Get notified of downtime
3. **Set up CI/CD**: Auto-deploy on git push
4. **Add custom domain**: Use your own domain name
5. **Enable SSL**: Render provides automatic HTTPS

## Support

For Render.com-specific issues:
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com/)

For application issues:
- Check [WEBSOCKET_SETUP.md](WEBSOCKET_SETUP.md)
- Review API logs in Render dashboard
- Test locally first
