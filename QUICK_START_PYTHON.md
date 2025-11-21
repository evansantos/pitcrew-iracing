# Quick Start: Remote iRacing Connection (Python Version)

## 🎯 Goal
Connect your macOS development machine to iRacing running on your Windows PC using **Python** (avoids Node.js compilation issues).

---

## Why Python Instead of Node.js?

The `node-irsdk` package requires C++ compilation which can fail on newer Node.js versions. The Python approach:
- No compilation needed
- Works with Python 3.11+
- Easier to debug
- Same performance (60Hz telemetry)

---

## Part 1: Windows Setup (5 minutes)

### 1. Install Python 3.11

Download and install Python 3.11 from:
https://www.python.org/downloads/

**IMPORTANT**: Check "Add Python to PATH" during installation!

Verify installation:
```cmd
python --version
```
Should show: `Python 3.11.x`

### 2. Find your Windows IP Address
```cmd
ipconfig
```
**Write down your IPv4 Address** (example: `192.168.1.100`)

### 3. Automated Setup (Recommended)

Copy these files from the project to your Windows machine:
- `tools/windows-relay-server.py`
- `tools/requirements.txt`
- `tools/setup-windows-python.ps1`

Then run in PowerShell **as Administrator**:
```powershell
cd path\to\copied\files
.\setup-windows-python.ps1
```

The script will:
- Check Python installation
- Find your IP address
- Create `C:\iRacing-Relay-Python` directory
- Install dependencies (`pyirsdk`, `websockets`)
- Configure Windows Firewall

### 4. Manual Setup (Alternative)

If you prefer manual setup:

```cmd
REM Create directory
mkdir C:\iRacing-Relay-Python
cd C:\iRacing-Relay-Python

REM Copy windows-relay-server.py and requirements.txt here

REM Install dependencies
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

**Windows Firewall**:
1. Windows Defender Firewall → Advanced Settings
2. Inbound Rules → New Rule
3. Port: **TCP 3002**
4. Allow connection → Apply to all profiles

### 5. Start the relay server

```cmd
cd C:\iRacing-Relay-Python
python windows-relay-server.py
```

You should see:
```
==================================================
[Relay] ✅ Ready! Waiting for iRacing to start...
==================================================
[Relay] WebSocket: ws://192.168.1.100:3002
[Relay] Clients can connect from: 192.168.1.100:3002
[Relay] Press Ctrl+C to stop
```

**Keep this terminal open!** This relay must run while racing.

---

## Part 2: macOS Setup (2 minutes)

### 1. Create `.env.local` in project root

```bash
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

**Replace `192.168.1.100` with your actual Windows IP!**

### 2. Test connection

```bash
# Ping Windows machine
ping 192.168.1.100

# Should get replies like:
# 64 bytes from 192.168.1.100: icmp_seq=0 ttl=128 time=1.234 ms
```

If ping fails:
- Ensure both machines are on same WiFi network
- Check Windows Firewall allows ICMP (ping)
- Verify IP address is correct

### 3. Start dev server

```bash
pnpm dev
```

---

## Part 3: Verification (1 minute)

### ✅ Windows Terminal should show:

```
[Relay] Telemetry loop started, waiting for iRacing...
```

When iRacing starts:
```
✅ Connected to iRacing!
```

When your Mac connects:
```
Client connected from 192.168.1.x
Handshake from client, version: 1.0
Client subscribed to: telemetry
```

### ✅ macOS Terminal should show:

```
INFO: EnhancedTelemetryService initialized in REMOTE mode
INFO: Connecting to remote telemetry relay...
INFO: Connected to remote telemetry relay
INFO: Handshake acknowledged by relay
```

When iRacing starts:
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
iRacing → Python Relay → Network → macOS API → Frontend
  60Hz       60Hz          WiFi     Process    Display
```

---

## Troubleshooting

### Problem: "pyirsdk not available"

**Fix**:
```cmd
cd C:\iRacing-Relay-Python
python -m pip install pyirsdk websockets
```

### Problem: "Connection refused" from Mac

**Fix**:
1. Check Windows firewall allows port 3002
2. Verify both machines on same WiFi network
3. Double-check IP address in `.env.local`
4. Test: `telnet 192.168.1.100 3002` from Mac

### Problem: "Python not found"

**Fix**:
1. Reinstall Python 3.11 from https://www.python.org/
2. **Check "Add Python to PATH"** during installation
3. Restart terminal/PowerShell
4. Verify: `python --version`

### Problem: "iRacing not detected"

**Fix**:
1. Make sure iRacing is **IN A SESSION** (not main menu)
2. Restart relay server after iRacing loads
3. Check Task Manager - `iRacingSim64DX11.exe` should be running

### Problem: High latency/lag

**Fix**:
1. Use ethernet on both machines
2. Reduce `TELEMETRY_RATE` in `windows-relay-server.py` (line 32: change 60 to 30)
3. Check network: `ping -t 192.168.1.100` (should be <50ms)
4. Close bandwidth-heavy apps (streaming, downloads)

### Problem: "Module not found: websockets"

**Fix**:
```cmd
python -m pip install websockets
```

---

## Performance Tips

✅ **Best**: Gigabit Ethernet on both machines (~1ms latency)
👍 **Good**: 5GHz WiFi, close to router (~5ms latency)
⚠️ **OK**: 2.4GHz WiFi (~20ms latency, may have occasional lag)
❌ **Bad**: WiFi through walls/floors (>50ms, unstable)

**Recommended**:
- Windows PC: Ethernet cable to router
- MacBook: 5GHz WiFi or Ethernet adapter

---

## Advantages of Python Version

Compared to Node.js version:
- ✅ No C++ compilation required
- ✅ No Visual Studio Build Tools needed
- ✅ No node-gyp issues
- ✅ Works with latest Python (3.11+)
- ✅ Easier to debug (plain Python)
- ✅ Same performance (60Hz)
- ✅ More stable (fewer dependencies)

---

## Next Steps

Once connected:
- All telemetry flows normally at 60Hz
- Strategy engine calculates fuel/tire/pit strategies
- Database stores all session data
- Redis caches real-time data
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
- `tools/windows-relay-server.py` → Copy to Windows
- `tools/requirements.txt` → Copy to Windows
- `tools/setup-windows-python.ps1` → Optional automated setup

That's it! Happy racing! 🏁
