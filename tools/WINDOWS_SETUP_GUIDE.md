# iRacing Relay - Windows Setup Guide

Connect your iRacing telemetry to the Pitcrew Race Engineer cloud service.

## Prerequisites

- **Windows 10/11** (64-bit)
- **iRacing** installed and licensed
- **Internet connection**

## Quick Start (3 Steps)

### Option A: Using the Executable (Easiest)

1. **Download** `iRacing-Relay-v3.0.exe` to your computer
2. **Double-click** `connect-to-pitcrew.bat` (or the executable)
3. **Start iRacing** and join a session

That's it! Your telemetry will automatically stream to the cloud.

### Option B: Using Python (Advanced)

If you prefer to run from source or the executable doesn't work:

1. **Install Python 3.11+** from https://www.python.org/
2. **Open Command Prompt** and run:
   ```cmd
   pip install pyirsdk python-socketio
   ```
3. **Run the relay:**
   ```cmd
   python windows-relay-server-socketio.py --host pitcrew-iracing.onrender.com --port 443 --secure
   ```

## What You'll See

When you start the relay, you should see:

```
==================================================
iRacing Relay Server - Version 3.0
Socket.IO Client Mode
==================================================

[Relay] ✅ pyirsdk available
[Relay] ✅ python-socketio version: 5.14.3

Configuration:
  API Host: pitcrew-iracing.onrender.com
  API Port: 443
  Protocol: HTTPS/WSS (Secure)
  Update Rate: 60 Hz

[Relay] 🔌 Connecting to API server...
[Relay] ✅ Connected to API server!
[Relay] 🏁 Waiting for iRacing...
```

Once you join an iRacing session:

```
[Relay] 🎮 iRacing detected!
[Relay] 📊 Streaming telemetry at 60 Hz
[Relay] Session: Practice @ Watkins Glen
[Relay] Car: Porsche 911 GT3 R
```

## Viewing Your Data

1. **Open your web browser**
2. **Navigate to:** https://pitcrew-iracing.onrender.com
3. **See real-time telemetry, strategy recommendations, and race analysis!**

## Files Included

- **`iRacing-Relay-v3.0.exe`** - Main relay executable (8-20 MB)
- **`connect-to-pitcrew.bat`** - Quick start script (double-click to run)
- **`windows-relay-server-socketio.py`** - Python source code (optional)

## Connection Details

The relay connects to:
- **Service:** Pitcrew iRacing Race Engineer
- **URL:** https://pitcrew-iracing.onrender.com
- **WebSocket Port:** 443 (HTTPS/WSS)
- **Security:** Encrypted connection (SSL/TLS)

## Troubleshooting

### "Cannot connect to API server"

**Check your internet connection:**
```cmd
ping pitcrew-iracing.onrender.com
```

**Verify the service is running:**
Open https://pitcrew-iracing.onrender.com/health in your browser.
You should see: `{"status":"ok"}`

**Firewall/Antivirus:**
- Add exception for `iRacing-Relay-v3.0.exe`
- Allow outbound connections to port 443

### "iRacing not detected"

Make sure:
1. ✅ iRacing is running
2. ✅ You're in an active session (Practice, Race, etc.)
3. ✅ Not just in the main menu - you must be on track

### "pyirsdk not found" (Python users only)

```cmd
pip install pyirsdk python-socketio
```

### Windows Defender SmartScreen Warning

This is normal for new executables. Click "More info" → "Run anyway"

To avoid this warning:
- Build the executable yourself on your Windows machine
- Or run from Python source

### Relay disconnects frequently

**Check your internet stability:**
```cmd
ping -t pitcrew-iracing.onrender.com
```

**The relay has auto-reconnect** - it will automatically reconnect if the connection drops.

## Advanced Configuration

### Custom Connection Settings

Create a file named `relay-config.bat`:

```cmd
@echo off
set API_HOST=pitcrew-iracing.onrender.com
set API_PORT=443
set API_SECURE=true
set TELEMETRY_RATE=60

iRacing-Relay-v3.0.exe
pause
```

### Command-Line Options

```cmd
iRacing-Relay-v3.0.exe [OPTIONS]

Options:
  --host HOST        API server hostname (default: localhost)
  --port PORT        API server port (default: 3001)
  --secure           Use HTTPS/WSS (recommended for cloud)
  --rate RATE        Telemetry rate in Hz (default: 60)
  -h, --help         Show help message

Examples:
  # Connect to Pitcrew cloud service
  iRacing-Relay-v3.0.exe --host pitcrew-iracing.onrender.com --port 443 --secure

  # Connect with custom update rate
  iRacing-Relay-v3.0.exe --host pitcrew-iracing.onrender.com --port 443 --secure --rate 30

  # Connect to local development server
  iRacing-Relay-v3.0.exe --host localhost --port 3001
```

## System Requirements

**Minimum:**
- Windows 10/11 (64-bit)
- 4 GB RAM
- Internet connection (1 Mbps upload)

**Recommended:**
- Windows 11
- 8 GB RAM
- Stable internet (5+ Mbps upload)
- SSD for iRacing

## Data Usage

The relay sends approximately:
- **60 data points per second** (default rate)
- **~10-20 KB/s** upload bandwidth
- **~36-72 MB/hour** of data

Most home internet connections can easily handle this.

## Privacy & Security

- ✅ **Encrypted connection** (HTTPS/WSS with SSL/TLS)
- ✅ **No personal data** collected
- ✅ **Only telemetry data** is sent
- ✅ **Open source** - you can review the code

## What Data is Sent?

The relay only sends iRacing telemetry data:
- Speed, RPM, gear, throttle, brake
- Lap times and sector times
- Fuel level and consumption
- Tire temperatures and wear
- Session information

**NOT sent:**
- Personal information
- iRacing account details
- Computer information
- Files or screenshots

## Building from Source (Optional)

If you want to build the executable yourself:

1. **Install Python 3.11+**
2. **Open Command Prompt in the tools folder**
3. **Run:**
   ```cmd
   build-relay.bat
   ```

The executable will be created in `dist/iRacing-Relay-v3.0.exe`

## Support & Updates

**Issues or questions?**
- Check this guide's troubleshooting section
- Review logs in the relay console
- Test connection to https://pitcrew-iracing.onrender.com/health

**Feature requests or bugs?**
- Report issues on the GitHub repository
- Or contact the development team

## Architecture

```
┌─────────────────────┐
│  iRacing (Windows)  │
│  Shared Memory      │
└──────────┬──────────┘
           │
           ▼
    ┌──────────────────┐
    │  Python Relay    │
    │  (This Program)  │
    └──────────┬───────┘
               │
               │ HTTPS/WSS (Port 443)
               │ Encrypted Connection
               ▼
        ┌─────────────────────┐
        │  Pitcrew Cloud API  │
        │  Render.com         │
        └─────────┬───────────┘
                  │
                  ▼
           ┌──────────────┐
           │  Web Browser │
           │  Dashboard   │
           └──────────────┘
```

## FAQ

**Q: Do I need to keep this running?**
A: Yes, the relay must run while you're racing to send telemetry.

**Q: Can I use this during official races?**
A: Yes! The relay is read-only and doesn't modify iRacing in any way.

**Q: Will this affect my FPS?**
A: No, the relay has minimal CPU usage (< 1%).

**Q: Can I run this on the same PC as iRacing?**
A: Yes! That's the recommended setup.

**Q: Does this work with VR?**
A: Yes, the relay works regardless of display mode.

**Q: Can multiple people use the same cloud service?**
A: Yes, each relay connection is independent.

**Q: What if I close the relay during a race?**
A: You can restart it anytime. Historical data remains saved.

## Version History

### v3.0 (Current)
- Socket.IO architecture
- Cloud service support
- Auto-reconnection
- HTTPS/WSS encryption
- 60 Hz telemetry rate

## License

MIT License - Free and open source

---

**Ready to race? Double-click `connect-to-pitcrew.bat` and start iRacing!**

For technical support or questions, refer to the troubleshooting section above.
