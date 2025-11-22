# iRacing Race Engineer - Relay Server

This relay connects your Windows machine running iRacing to the Race Engineer web application.

## Quick Start

### Windows (With iRacing - Production Use)

1. **Run the relay:**
   ```powershell
   # Double-click run-relay.bat
   # OR run from command prompt:
   iRacing-Relay-v3.0.exe --host pitcrew-iracing.onrender.com --port 443 --secure
   ```

2. **Start iRacing** and join a session

3. **Open the webapp** at: https://pitcrew-iracing.onrender.com

4. You should see live telemetry data flowing!

### Mac/Linux (Testing Without iRacing)

```bash
# Make executable (first time only):
chmod +x iRacing-Relay-v3.0

# Run in mock mode:
./iRacing-Relay-v3.0 --host pitcrew-iracing.onrender.com --port 443 --secure --mock
```

## Command Line Options

```
Usage: iRacing-Relay-v3.0 [OPTIONS]

Options:
  --host HOST        API server hostname (default: localhost)
  --port PORT        API server port (default: 3001)
  --secure           Use HTTPS/WSS instead of HTTP/WS
  --rate RATE        Telemetry update rate in Hz (default: 60)
  --mock             Mock mode - generate test data (for testing without iRacing)
  -h, --help         Show help message

Examples:
  # Production (Windows + iRacing):
  iRacing-Relay-v3.0.exe --host pitcrew-iracing.onrender.com --port 443 --secure

  # Testing (any OS, no iRacing needed):
  iRacing-Relay-v3.0 --host pitcrew-iracing.onrender.com --port 443 --secure --mock

  # Custom update rate:
  iRacing-Relay-v3.0.exe --host pitcrew-iracing.onrender.com --port 443 --secure --rate 30
```

## What You Should See

### When Relay Starts:
```
==================================================
iRacing Relay Server - Version 3.0
Socket.IO Client Mode
==================================================

[Relay] Configuration:
[Relay]   Local IP: 192.168.1.100
[Relay]   API Server: https://pitcrew-iracing.onrender.com:443
[Relay]   Secure: Yes (HTTPS/WSS)
[Relay]   Telemetry Rate: 60 Hz
[Relay]   Mode: 🏁 LIVE (iRacing)
==================================================

[15:20:46] INFO: Connecting to API server...
[15:20:47] INFO: ✅ Connected to API server
[15:20:47] INFO: ✅ Relay identified: Relay identified and ready to send telemetry
[15:20:47] INFO: Telemetry loop started, waiting for iRacing...
```

### When iRacing is NOT Running:
```
Failed to connect to sim: [Errno 61] Connection refused
```
This is normal! The relay is waiting for iRacing to start.

### When iRacing IS Running:
```
[15:25:10] INFO: ✅ Connected to iRacing!
```
Telemetry data now flows at 60Hz to the webapp.

## Troubleshooting

### "Failed to connect to API server"
- Check your internet connection
- Verify the API server is running
- Check if a firewall is blocking the connection

### "Failed to connect to sim"
- This is normal when iRacing is not running
- Start iRacing and join a session
- The relay will automatically connect when iRacing starts

### "Connection refused" or "Connection timeout"
- Ensure you're using the correct host and port
- For Render.com deployments, use port 443 with --secure flag

### Relay connects but no data in webapp
- Refresh the webapp
- Check browser console for errors
- Verify the relay shows "Connected to iRacing!"

## System Requirements

- **Windows**: Windows 10/11 (for iRacing connection)
- **Mac/Linux**: Any version (mock mode only)
- **Network**: Internet connection to reach API server
- **iRacing**: Active iRacing subscription and installed game (Windows only)

## Architecture

```
┌─────────────────────┐
│  iRacing (Windows)  │
│  Shared Memory      │
└──────────┬──────────┘
           │
           ↓
    ┌──────────────┐
    │ Relay Server │ ← You are here
    │  (This exe)  │
    └──────┬───────┘
           │
           │ Socket.IO (HTTPS/WSS)
           │ 60Hz telemetry stream
           ↓
┌──────────────────────┐
│  API Server          │
│  (Render.com)        │
└──────────┬───────────┘
           │
           ↓
    ┌──────────────┐
    │   Webapp     │
    │ (Any device) │
    └──────────────┘
```

## License

Part of the iRacing Race Engineer project.

## Support

For issues or questions, visit:
https://github.com/evansantos/pitcrew-iracing
