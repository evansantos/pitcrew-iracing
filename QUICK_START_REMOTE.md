# Quick Start: Remote iRacing Connection

## 🎯 Goal
Connect your macOS development machine to iRacing running on your Windows PC.

---

## Part 1: Windows Setup (5 minutes)

### 1. Find your Windows IP Address
```cmd
ipconfig
```
**Write down your IPv4 Address** (example: `192.168.1.100`)

### 2. Copy the relay server
Copy `tools/windows-relay-server.js` to your Windows machine

### 3. Install Node.js on Windows
- Download: https://nodejs.org/ (LTS version)
- Install and restart terminal

### 4. Setup relay server
```cmd
mkdir C:\iRacing-Relay
cd C:\iRacing-Relay

REM Copy windows-relay-server.js here

npm init -y
npm install ws node-irsdk
```

### 5. Open Windows Firewall
- Windows Defender Firewall → Advanced Settings
- Inbound Rules → New Rule
- Port: **TCP 3002**
- Allow connection → Apply to all profiles

### 6. Start the relay (keep this running!)
```cmd
node windows-relay-server.js
```

You should see:
```
[Relay] iRacing Telemetry Relay Server starting on port 3002...
[Relay] Ready! Waiting for iRacing to start...
[Relay] Clients can connect to: ws://YOUR_WINDOWS_IP:3002
```

---

## Part 2: macOS Setup (2 minutes)

### 1. Create `.env.local` in project root
```bash
# Create file
cat > .env.local << 'EOF'
# iRacing Connection
IRACING_MODE=remote
IRACING_RELAY_HOST=192.168.1.100  # YOUR WINDOWS IP HERE!
IRACING_RELAY_PORT=3002

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/race_engineer

# Redis
REDIS_URL=redis://localhost:6379
EOF
```

### 2. Test connection
```bash
# Ping Windows machine
ping 192.168.1.100

# Should get replies like:
# 64 bytes from 192.168.1.100: icmp_seq=0 ttl=128 time=1.234 ms
```

### 3. Start dev server
```bash
pnpm dev
```

---

## Part 3: Verification (1 minute)

### ✅ Windows Terminal should show:
```
[Relay] Client connected from 192.168.1.x
[Relay] Handshake from 192.168.1.x, version: 1.0
[Relay] Client subscribed to: telemetry
```

### ✅ macOS Terminal should show:
```
INFO: EnhancedTelemetryService initialized in REMOTE mode
INFO: Connecting to remote telemetry relay...
INFO: Connected to remote telemetry relay
INFO: Handshake acknowledged by relay
```

### ✅ When iRacing starts:
Windows:
```
[iRacing] Connected to iRacing!
```

macOS:
```
INFO: Telemetry data streaming...
INFO: Strategy calculations running...
```

---

## Part 4: Using It

### Start a race in iRacing:
1. Load into any session (practice/race)
2. Wait ~5 seconds
3. Check your macOS browser: http://localhost:3000
4. You should see REAL telemetry data!

### What's happening:
```
iRacing → Windows Relay → Network → macOS API → Frontend
  60Hz       60Hz           WiFi     Process    Display
```

---

## Troubleshooting

### Problem: "Connection refused"
**Fix**:
1. Check Windows firewall allows port 3002
2. Verify both machines on same WiFi network
3. Double-check IP address in `.env.local`

### Problem: "ECONNRESET" frequent disconnects
**Fix**:
1. Use ethernet cable instead of WiFi
2. Move closer to WiFi router
3. Close bandwidth-heavy apps

### Problem: "iRacing not detected"
**Fix**:
1. Make sure iRacing is IN A SESSION (not main menu)
2. Restart relay server after iRacing loads
3. Check Task Manager - iRacingSim64DX11.exe should be running

### Problem: High latency/lag
**Fix**:
1. Use ethernet on both machines
2. Reduce TELEMETRY_RATE in relay (line 13: change 60 to 30)
3. Check network with: `ping -t 192.168.1.100` (should be <50ms)

---

## Performance Tips

✅ **Best**: Gigabit Ethernet on both machines
👍 **Good**: 5GHz WiFi, close to router
⚠️ **OK**: 2.4GHz WiFi (may have lag)
❌ **Bad**: WiFi through walls/floors

---

## Next Steps

Once connected:
- All telemetry flows normally
- Strategy engine calculates as usual
- Database stores all data
- Redis caches everything
- **It just works!** 🎉

---

## To Switch Back to Mock Mode

Edit `.env.local`:
```bash
IRACING_MODE=mock  # Change from 'remote' to 'mock'
```

Restart dev server.

---

## Files You Need

From this project:
- `tools/windows-relay-server.js` → Copy to Windows
- `tools/REMOTE_SETUP.md` → Full detailed guide

That's it! Happy racing! 🏁
