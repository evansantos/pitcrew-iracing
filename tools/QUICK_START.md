# Quick Start Guide - iRacing Relay

## For Render.com Users (Recommended)

Your API and webapp are hosted on Render.com, relay runs on your Windows PC.

### Step 1: Edit Configuration

Open `connect-to-render.bat` in Notepad and change:

```bat
set API_HOST=your-api.onrender.com
```

Replace `your-api.onrender.com` with your actual Render.com URL.

### Step 2: Run the Relay

Double-click `connect-to-render.bat`

That's it! 🎉

---

## For Local Development

If running everything on the same machine:

```cmd
python windows-relay-server-socketio.py
```

No configuration needed!

---

## Command-Line Options

### Connect to Render.com
```cmd
python windows-relay-server-socketio.py --host your-api.onrender.com --port 443 --secure
```

### Connect to Local Network
```cmd
python windows-relay-server-socketio.py --host 192.168.1.100 --port 3001
```

### Reduce Telemetry Rate (30Hz instead of 60Hz)
```cmd
python windows-relay-server-socketio.py --rate 30
```

### Show All Options
```cmd
python windows-relay-server-socketio.py --help
```

---

## Using the Executable

If you have `iRacing-Relay-v3.0.exe`:

### Method 1: Batch File
Create `run-relay.bat`:
```bat
@echo off
iRacing-Relay-v3.0.exe --host your-api.onrender.com --port 443 --secure
pause
```

### Method 2: Shortcut
1. Right-click `iRacing-Relay-v3.0.exe`
2. Create Shortcut
3. Right-click shortcut → Properties
4. In Target, add: `--host your-api.onrender.com --port 443 --secure`
5. Click OK

---

## Troubleshooting

### "Connection refused"
- Check API server is running
- Try pinging: `curl https://your-api.onrender.com/health`
- If Render.com, wait 1 minute for service to wake up

### "iRacing not detected"
- Start iRacing
- Join a session (practice, qualify, race)
- Relay only works when actively in a session

### "Module not found"
```cmd
pip install pyirsdk python-socketio
```

---

## Environment Variables (Alternative Method)

Create `.env` file or set system variables:

```env
API_HOST=your-api.onrender.com
API_PORT=443
API_SECURE=true
```

Then just run:
```cmd
python windows-relay-server-socketio.py
```

---

## Configuration Priority

The relay checks in this order:
1. Command-line arguments (`--host`, `--port`, etc.)
2. Environment variables (`API_HOST`, `API_PORT`, etc.)
3. Defaults (`localhost:3001`)

**Tip:** Command-line arguments override environment variables!

---

## Need More Help?

- **Full Setup Guide**: [WEBSOCKET_SETUP.md](../WEBSOCKET_SETUP.md)
- **Render Deployment**: [RENDER_DEPLOYMENT.md](../RENDER_DEPLOYMENT.md)
- **Build Executable**: [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)
- **Tools Overview**: [README.md](README.md)
