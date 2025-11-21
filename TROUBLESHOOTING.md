# Troubleshooting Guide: Remote iRacing Connection

This guide helps diagnose and fix common issues when connecting your Mac to Windows iRacing relay.

---

## Quick Diagnostic Tools

### macOS
```bash
# Run from project root
./tools/test-connection-mac.sh
```

### Windows
```powershell
# Run in PowerShell
.\tools\test-relay-windows.ps1
```

---

## Common Issues & Solutions

### 1. "Connection Refused" / "EHOSTUNREACH"

**Symptom**: Mac can't connect to Windows relay server
```
ERROR: Remote telemetry WebSocket error
error: {
  "code": "EHOSTUNREACH",
  "address": "192.168.0.107"
}
```

**Diagnosis**:
```bash
# On Mac, test connectivity
ping 192.168.0.107
nc -zv 192.168.0.107 3002
```

**Solutions**:

#### A. Windows Firewall Blocking
**Most Common Cause**

1. **Quick Test** - Temporarily disable Windows Firewall:
   - Windows Security → Firewall & network protection
   - Turn off "Private network" firewall
   - Try connecting from Mac
   - ✅ If it works: Firewall was the issue

2. **Permanent Fix** - Add firewall rule:
   ```powershell
   # Run as Administrator
   New-NetFirewallRule -DisplayName "iRacing Relay Python" -Direction Inbound -Protocol TCP -LocalPort 3002 -Action Allow
   ```

#### B. Machines on Different Networks
- Ensure both Mac and Windows on **same WiFi network**
- Check IP ranges match (both should be `192.168.x.x` or `10.x.x.x`)
- Some routers have "AP Isolation" - disable it

#### C. Relay Server Not Running
```powershell
# On Windows, verify relay is running
cd C:\iRacing-Relay-Python
python windows-relay-server.py
```

Should see:
```
==================================================
[Relay] ✅ Ready! Waiting for iRacing to start...
==================================================
[Relay] WebSocket: ws://192.168.0.107:3002
```

---

### 2. "pyirsdk not available" or Import Errors

**Symptom**: Python relay fails to start
```
ModuleNotFoundError: No module named 'irsdk'
```

**Solution**:
```powershell
# On Windows
cd C:\iRacing-Relay-Python
pip install -r requirements.txt

# OR install manually
pip install pyirsdk websockets
```

**Verify**:
```powershell
python -c "import irsdk; import websockets; print('OK')"
```
Should print: `OK`

---

### 3. "iRacing not detected"

**Symptom**: Relay server runs but shows:
```
[Relay] Telemetry loop started, waiting for iRacing...
```

**Diagnosis**:
- iRacing must be **IN A SESSION** (practice, qualify, race)
- Main menu doesn't broadcast telemetry

**Solutions**:
1. Load into any session in iRacing
2. Wait 5-10 seconds
3. Relay should show: `✅ Connected to iRacing!`

**Verify iRacing is running**:
```powershell
# On Windows
tasklist | findstr iRacing
```
Should see: `iRacingSim64DX11.exe`

---

### 4. Mac Backend Still in "MOCK" Mode

**Symptom**: Mac logs show:
```
INFO: EnhancedTelemetryService initialized in MOCK mode
```

**Diagnosis**:
```bash
# Check .env.local
cat .env.local | grep IRACING_MODE
```

**Solution**:
```bash
# Edit .env.local in project root
IRACING_MODE=remote
IRACING_RELAY_HOST=192.168.0.107  # Your Windows IP
IRACING_RELAY_PORT=3002
```

**Alternative**: Create `.env.local` in `apps/api/`:
```bash
cat > apps/api/.env.local << 'EOF'
IRACING_MODE=remote
IRACING_RELAY_HOST=192.168.0.107
IRACING_RELAY_PORT=3002
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/race_engineer
REDIS_URL=redis://localhost:6379
EOF
```

**Restart dev server**:
```bash
pnpm dev
```

Should now show:
```
INFO: EnhancedTelemetryService initialized in REMOTE mode
INFO: Connecting to remote telemetry relay...
```

---

### 5. High Latency / Lag / Stuttering

**Symptom**: Telemetry data is delayed or choppy

**Diagnosis**:
```bash
# Check network latency
ping -c 20 192.168.0.107

# Should be < 50ms consistently
```

**Solutions**:

#### A. Use Ethernet (Best)
- Connect both machines via ethernet cable
- Expected latency: 1-5ms

#### B. Optimize WiFi
- Use 5GHz WiFi (not 2.4GHz)
- Move closer to router
- Close bandwidth-heavy apps (streaming, downloads)

#### C. Reduce Telemetry Rate
Edit `windows-relay-server.py` line 32:
```python
TELEMETRY_RATE = 30  # Change from 60 to 30 Hz
```

---

### 6. "Port 3002 already in use"

**Symptom**:
```
Address already in use: 0.0.0.0:3002
```

**Diagnosis**:
```powershell
# Windows: Find what's using port 3002
netstat -ano | findstr :3002
```

```bash
# Mac: Find what's using port 3002
lsof -i :3002
```

**Solution**:
```powershell
# Windows: Kill process using port
taskkill /PID <PID> /F

# Mac: Kill process
kill -9 <PID>
```

---

### 7. WebSocket Connection Drops Frequently

**Symptom**: Connection keeps disconnecting
```
INFO: Connected to remote telemetry relay
WARN: Disconnected from remote telemetry relay
INFO: Scheduling reconnection...
```

**Solutions**:

#### A. Network Stability
- Use ethernet instead of WiFi
- Check router isn't throttling connections
- Disable WiFi power saving:
  ```bash
  # Mac
  sudo pmset -a tcpkeepalive 1
  ```

#### B. Increase WebSocket Timeout
Edit `src/services/remote-telemetry/relay-client.ts`:
```typescript
this.reconnectInterval = 10000; // Increase from 5000 to 10000ms
```

#### C. Check Windows Power Settings
- Windows may be sleeping network adapter
- Control Panel → Power Options → Advanced
- Set "Turn off hard disk" to "Never"

---

### 8. Python Version Issues

**Symptom**:
```
SyntaxError: invalid syntax
```

**Diagnosis**:
```powershell
python --version
```

**Solution**:
- Ensure Python 3.11+ is installed
- If multiple Python versions, use:
  ```powershell
  py -3.11 windows-relay-server.py
  ```

---

## Verification Checklist

### Windows Setup ✓
- [ ] Python 3.11+ installed (`python --version`)
- [ ] pyirsdk installed (`pip list | findstr irsdk`)
- [ ] websockets installed (`pip list | findstr websockets`)
- [ ] Relay server file exists in `C:\iRacing-Relay-Python\`
- [ ] Windows Firewall allows port 3002
- [ ] Relay server running (`python windows-relay-server.py`)
- [ ] iRacing loaded into a session

### macOS Setup ✓
- [ ] `.env.local` exists with `IRACING_MODE=remote`
- [ ] `IRACING_RELAY_HOST` set to Windows IP
- [ ] Can ping Windows PC (`ping 192.168.0.107`)
- [ ] Port 3002 is reachable (`nc -zv 192.168.0.107 3002`)
- [ ] Dev server running (`pnpm dev`)

### Connection Verified ✓
- [ ] Windows shows: `Client connected from <Mac IP>`
- [ ] Mac shows: `Connected to remote telemetry relay`
- [ ] When iRacing starts: `✅ Connected to iRacing!`
- [ ] Telemetry data flowing (check Mac terminal)

---

## Advanced Debugging

### Enable Verbose Logging

**Windows Relay**:
Edit `windows-relay-server.py`:
```python
logging.basicConfig(
    level=logging.DEBUG,  # Change from INFO to DEBUG
    ...
)
```

**Mac Backend**:
Check logs for connection attempts:
```bash
pnpm dev 2>&1 | grep -i "remote\|relay\|websocket"
```

### Network Packet Inspection

```bash
# Mac: Monitor WebSocket traffic
tcpdump -i en0 -n port 3002

# Windows: Monitor with Wireshark
# Filter: tcp.port == 3002
```

### Test WebSocket Directly

```bash
# Mac: Test WebSocket connection
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://192.168.0.107:3002');
ws.on('open', () => console.log('CONNECTED'));
ws.on('message', (data) => console.log('DATA:', data));
ws.on('error', (err) => console.error('ERROR:', err));
"
```

---

## Performance Tuning

### Optimal Setup
- **Network**: Gigabit Ethernet (both machines)
- **Telemetry Rate**: 60Hz
- **Expected Latency**: 1-5ms
- **CPU Usage**: <5% on both machines

### Good Setup
- **Network**: 5GHz WiFi, close to router
- **Telemetry Rate**: 60Hz
- **Expected Latency**: 5-20ms
- **CPU Usage**: <10% on both machines

### Acceptable Setup
- **Network**: 2.4GHz WiFi
- **Telemetry Rate**: 30Hz (reduced)
- **Expected Latency**: 20-50ms
- **May experience**: Occasional lag

---

## Getting Help

If issues persist after trying these solutions:

1. **Run diagnostic scripts**:
   - Mac: `./tools/test-connection-mac.sh`
   - Windows: `.\tools\test-relay-windows.ps1`

2. **Collect logs**:
   ```bash
   # Mac
   pnpm dev 2>&1 | tee mac-debug.log
   ```

   ```powershell
   # Windows
   python windows-relay-server.py > windows-debug.log 2>&1
   ```

3. **Check network**:
   ```bash
   # Mac
   ping -c 20 <WINDOWS_IP> > ping-test.txt
   traceroute <WINDOWS_IP> >> ping-test.txt
   ```

4. **Share**:
   - Error messages from both Mac and Windows
   - Network test results
   - Output from diagnostic scripts

---

## Quick Reference

### Essential Commands

**Windows**:
```powershell
# Start relay
cd C:\iRacing-Relay-Python
python windows-relay-server.py

# Check if running
netstat -ano | findstr :3002

# Find IP address
ipconfig

# Test Python packages
python -c "import irsdk, websockets; print('OK')"
```

**Mac**:
```bash
# Test connection
./tools/test-connection-mac.sh

# Start dev server
pnpm dev

# Check .env.local
cat .env.local

# Test connectivity
ping <WINDOWS_IP>
nc -zv <WINDOWS_IP> 3002
```

---

Happy racing! 🏁
