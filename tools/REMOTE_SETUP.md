# Remote iRacing Setup Guide

Connect to iRacing running on a Windows machine from your macOS development environment.

## Architecture

```
Windows PC (iRacing)          macOS (Development)
┌────────────────────┐        ┌──────────────────────┐
│  iRacing Game      │        │  Race Engineer       │
│       ↓            │        │         ↑            │
│  node-irsdk        │  WiFi  │    WebSocket         │
│       ↓            │ ←────→ │    Client            │
│  Relay Server      │        │         ↓            │
│  (Port 3002)       │        │  Strategy Engine     │
└────────────────────┘        │  Database/Redis      │
                              └──────────────────────┘
```

## Step 1: Setup Windows Machine (Relay Server)

### On your Windows PC with iRacing:

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org/
   - Choose LTS version

2. **Create a project folder**
   ```cmd
   mkdir C:\iRacing-Relay
   cd C:\iRacing-Relay
   ```

3. **Initialize npm and install dependencies**
   ```cmd
   npm init -y
   npm install ws node-irsdk
   ```

4. **Copy the relay server**
   - Copy `windows-relay-server.js` from this project to `C:\iRacing-Relay\`

5. **Find your Windows IP address**
   ```cmd
   ipconfig
   ```
   - Look for "IPv4 Address" under your active network adapter
   - Example: `192.168.1.100`

6. **Allow port 3002 through Windows Firewall**
   - Open Windows Defender Firewall
   - Advanced Settings → Inbound Rules → New Rule
   - Port: TCP 3002
   - Allow the connection
   - Apply to all profiles (Domain, Private, Public)

7. **Run the relay server**
   ```cmd
   node windows-relay-server.js
   ```
   - You should see: "Ready! Waiting for iRacing to start..."
   - Keep this terminal open

## Step 2: Configure macOS Client

### On your macOS development machine:

1. **Update environment variables**

   Create/edit `.env.local` in the project root:
   ```bash
   # Remote iRacing Connection
   IRACING_RELAY_HOST=192.168.1.100  # Your Windows IP
   IRACING_RELAY_PORT=3002
   IRACING_MODE=remote  # 'local', 'remote', or 'mock'

   # Database
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/race_engineer

   # Redis
   REDIS_URL=redis://localhost:6379
   ```

2. **Test connection**
   ```bash
   # Ping your Windows machine
   ping 192.168.1.100

   # Test WebSocket port (optional - requires telnet)
   telnet 192.168.1.100 3002
   ```

## Step 3: Start the Race Engineer

1. **Start your development server**
   ```bash
   pnpm dev
   ```

2. **The system will automatically**:
   - Connect to the Windows relay server
   - Receive real iRacing telemetry
   - Process it through the strategy engine
   - Store data in PostgreSQL
   - Cache in Redis
   - Broadcast to frontend via WebSocket

## Verification

### Check Windows Relay Server Terminal:
You should see:
```
[Relay] Client connected from 192.168.1.x
[Relay] Handshake from 192.168.1.x, version: 1.0
[Relay] Client subscribed to: telemetry
[iRacing] Connected to iRacing!
```

### Check macOS Development Server:
You should see:
```
INFO: Connecting to remote telemetry relay...
INFO: Connected to remote telemetry relay
INFO: Handshake acknowledged by relay
```

## Troubleshooting

### Problem: "Connection refused" or timeout

**Solution:**
1. Verify Windows firewall allows port 3002
2. Check both machines are on same network
3. Verify Windows IP address is correct
4. Try disabling VPN if active

### Problem: "iRacing not detected"

**Solution:**
1. Make sure iRacing is running on Windows
2. Load into a session (not just main menu)
3. Restart the relay server after iRacing starts

### Problem: "ECONNRESET" errors

**Solution:**
1. Network instability - check WiFi signal
2. Try wired ethernet connection for better stability
3. Increase reconnect interval in config

### Problem: High latency/lag

**Solution:**
1. Use wired ethernet instead of WiFi
2. Close bandwidth-heavy applications
3. Check network for other traffic
4. Reduce TELEMETRY_RATE in relay server (try 30Hz)

## Network Requirements

- **Latency**: < 50ms for best experience
- **Bandwidth**: ~1-2 Mbps (telemetry at 60Hz)
- **Recommended**: Gigabit ethernet on same subnet

## Alternative: Running Everything on Windows

If network performance is an issue, you can run the entire Race Engineer stack on Windows:

```cmd
# On Windows
git clone <your-repo>
cd race-engineer
pnpm install
pnpm dev
```

Then access the web UI from your macOS browser at `http://WINDOWS_IP:3000`

## Security Note

⚠️ The relay server has NO authentication. Only use on trusted networks (home LAN).

For production/public access:
1. Add WebSocket authentication
2. Use TLS/WSS (secure WebSocket)
3. Implement rate limiting
4. Add IP whitelist

## Performance Tips

1. **Optimize telemetry rate**: Reduce from 60Hz to 30Hz if needed
2. **Use ethernet**: WiFi can introduce lag and packet loss
3. **Close unused apps**: On both machines for better performance
4. **Monitor network**: Use Task Manager (Windows) or Activity Monitor (macOS)
