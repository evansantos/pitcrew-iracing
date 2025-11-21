# iRacing Relay Tools

This directory contains tools for relaying iRacing telemetry data to the Race Engineer API.

## Active Files

### Python Relay Server
- **`windows-relay-server-socketio.py`** - Current Socket.IO client version (v3.0)
  - Connects to the API server as a Socket.IO client
  - Sends real-time telemetry at 60Hz
  - Auto-reconnection support
  - Requires: Python 3.11+, pyirsdk, python-socketio

### Build Scripts
- **`build-relay.bat`** - Windows build script for creating .exe
- **`build-relay.sh`** - Mac/Linux build script for creating executable
- **`BUILD_INSTRUCTIONS.md`** - Comprehensive build documentation

## Quick Start

### Run from Source (Development)

```bash
# Install dependencies
pip install pyirsdk python-socketio

# Edit configuration in the file
# Set API_HOST to your API server IP

# Run the relay
python windows-relay-server-socketio.py
```

### Build Executable (Distribution)

#### On Windows:
```cmd
build-relay.bat
```

#### On Mac/Linux:
```bash
./build-relay.sh
```

The executable will be created in `dist/iRacing-Relay-v3.0.exe`

## Configuration

Edit these values in `windows-relay-server-socketio.py`:

```python
API_HOST = 'localhost'      # Your API server IP
API_PORT = 3001             # Socket.IO port (default 3001)
TELEMETRY_RATE = 60         # Update rate in Hz
```

## Requirements

### For Running from Source:
- Python 3.11 or higher
- pyirsdk (iRacing SDK wrapper)
- python-socketio (Socket.IO client)

### For Building Executable:
- Python 3.11 or higher
- PyInstaller (installed by build script)

### For Running the Executable:
- No dependencies required! Just the .exe file

## Architecture

```
┌─────────────────┐
│  iRacing        │ (reads telemetry via pyirsdk)
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  Python Relay       │ (windows-relay-server-socketio.py)
│  Socket.IO Client   │
└──────────┬──────────┘
           │
           │ Socket.IO connection
           │
           ▼
    ┌─────────────────┐
    │  API Server     │ (Node.js Socket.IO hub)
    │  Port 3001      │
    └─────────────────┘
```

## Files Removed

The following old relay versions have been removed:
- ~~`windows-relay-server.py`~~ - Original version
- ~~`windows-relay-server-v2.py`~~ - WebSocket server version
- ~~`windows-relay-server-hybrid.py`~~ - Hybrid mode
- ~~`windows-relay-server-spectator-debug.py`~~ - Debug version
- ~~`windows-relay-server-deep-debug.py`~~ - Deep debug version

These have been replaced by the single `windows-relay-server-socketio.py` which uses the new centralized architecture.

## Documentation

- **[BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)** - How to build executables
- **[../WEBSOCKET_SETUP.md](../WEBSOCKET_SETUP.md)** - Complete WebSocket architecture guide

## Troubleshooting

### "Cannot connect to API server"
1. Check API server is running on the configured host and port
2. Verify firewall allows connections to port 3001
3. Test connectivity: `curl http://API_HOST:3001/socket.io/`

### "pyirsdk not found"
```bash
pip install pyirsdk
```

### "python-socketio not found"
```bash
pip install python-socketio
```

### "iRacing not detected"
- Ensure iRacing is running
- Check that iRacing is actively in a session (not just in UI)
- Verify pyirsdk can access iRacing shared memory

## Version History

### v3.0 (Current)
- Socket.IO client architecture
- Connects to centralized API hub
- Simplified deployment with single executable
- Auto-reconnection support
- Better error handling

### v2.0 (Deprecated)
- WebSocket server architecture
- Required API to connect to relay
- Multiple debug variants

### v1.0 (Deprecated)
- Original implementation

## Support

For issues or questions:
1. Check [WEBSOCKET_SETUP.md](../WEBSOCKET_SETUP.md) troubleshooting section
2. Review API server logs
3. Verify network connectivity
4. Check iRacing is running and in a session
