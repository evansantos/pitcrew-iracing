# WebSocket Architecture Setup Guide

## Overview

The application now uses a centralized WebSocket architecture where:
- **API Server** acts as the central Socket.IO hub (port 3001)
- **Python Relay** connects as a client to send iRacing telemetry
- **Webapp** connects as a client to receive telemetry and updates

```
┌─────────────────┐
│  iRacing (Win)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐      Socket.IO      ┌──────────────┐
│  Python Relay       │◄────────────────────►│ API Server   │
│  (Socket.IO Client) │                      │ (Socket.IO   │
└─────────────────────┘                      │  Hub)        │
                                             │ Port 3001    │
                                             └──────┬───────┘
                                                    │
                                                    │ Socket.IO
                                                    │
                                                    ▼
                                             ┌──────────────┐
                                             │   Webapp     │
                                             │ (Next.js)    │
                                             └──────────────┘
```

## Quick Start

### 1. Start the API Server

```bash
cd apps/api
npm run dev
```

The API server will start on:
- HTTP API: `http://localhost:3000`
- Socket.IO: `http://localhost:3001`

### 2. Start the Webapp

```bash
cd apps/web
npm run dev
```

The webapp will be available at `http://localhost:3003`

### 3. Start the Python Relay (Windows)

On your Windows machine with iRacing:

#### Option A: Use Pre-built Executable (Recommended)

```bash
# Download or copy the pre-built executable
iRacing-Relay-v3.0.exe

# Edit configuration if needed, then run
iRacing-Relay-v3.0.exe
```

#### Option B: Run from Source

```bash
cd tools
pip install pyirsdk python-socketio

# Edit the file to set your API server IP if not localhost
python windows-relay-server-socketio.py
```

#### Option C: Build Your Own Executable

See [BUILD_INSTRUCTIONS.md](tools/BUILD_INSTRUCTIONS.md) for detailed build instructions.

**Quick build:**
```bash
cd tools
build-relay.bat    # On Windows
# or
./build-relay.sh   # On Mac/Linux
```

**Configuration**: Edit `windows-relay-server-socketio.py` and update before building or running:
```python
API_HOST = 'localhost'  # Change to your API server IP
API_PORT = 3001         # Socket.IO port
```

## Architecture Details

### API Server (`apps/api/src/index.ts`)

The API server manages Socket.IO connections and routes messages between clients:

**Events Received:**
- `identify` - Client identifies as 'relay' or 'webapp'
- `relay:telemetry` - Telemetry data from Python relay
- `relay:session` - Session state from Python relay
- `subscribe:telemetry` - Webapp subscribes to telemetry
- `subscribe:strategy` - Webapp subscribes to strategy

**Events Sent:**
- `identify:ack` - Acknowledges client identification
- `relay:status` - Relay connection status to webapps
- `telemetry:update` - Telemetry broadcast to webapps
- `session:update` - Session updates to webapps
- `strategy:update` - Strategy recommendations to webapps

### Python Relay (`tools/windows-relay-server-socketio.py`)

The Python relay connects to the API and sends iRacing telemetry:

**Features:**
- Connects to API server via Socket.IO
- Auto-reconnection on disconnect
- 60Hz telemetry updates
- Identifies as 'relay' client
- Sends telemetry via `relay:telemetry` events
- Sends session state via `relay:session` events

**Dependencies:**
```bash
pip install pyirsdk python-socketio
```

### Webapp (`apps/web/hooks/use-websocket.ts`)

The webapp connects to receive real-time updates:

**Features:**
- Identifies as 'webapp' client
- Subscribes to telemetry and strategy
- Receives relay connection status
- Auto-reconnection on disconnect

## Event Flow

### 1. Relay Connection Flow
```
Python Relay → connect → API Server
Python Relay → identify {'type': 'relay'} → API Server
API Server → identify:ack → Python Relay
API Server → relay:status {'connected': true} → All Webapps
```

### 2. Webapp Connection Flow
```
Webapp → connect → API Server
Webapp → identify {'type': 'webapp'} → API Server
API Server → relay:status {current status} → Webapp
Webapp → subscribe:telemetry → API Server
```

### 3. Telemetry Flow
```
iRacing → Python Relay (via pyirsdk)
Python Relay → relay:telemetry {data} → API Server
API Server → telemetry:update {data} → All Webapps
```

## Configuration

### Environment Variables

**API Server** (`.env`):
```env
SOCKET_PORT=3001
CORS_ORIGIN=*  # Allows Python relay from any machine
```

**Webapp** (`.env.local`):
```env
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

**Python Relay** (edit `windows-relay-server-socketio.py`):
```python
API_HOST = 'localhost'  # Your API server IP
API_PORT = 3001
TELEMETRY_RATE = 60  # Hz
```

## Network Configuration

### Running on Same Machine (Development)
No configuration needed. Use `localhost` everywhere.

```bash
# Just run with defaults
python windows-relay-server-socketio.py
```

### Running on Render.com (Production)

**Perfect for your setup!** When the API and webapp are hosted on Render.com:

#### 1. Deploy to Render.com

Deploy your API server to Render.com. It will give you a URL like:
```
https://your-api.onrender.com
```

#### 2. Configure the Relay (Windows)

**Option A: Using the quick-start script**

Edit `tools/connect-to-render.bat`:
```bat
set API_HOST=your-api.onrender.com
set API_PORT=443
```

Then run:
```cmd
connect-to-render.bat
```

**Option B: Command-line arguments**
```cmd
python windows-relay-server-socketio.py --host your-api.onrender.com --port 443 --secure
```

**Option C: Environment variables**
```cmd
set API_HOST=your-api.onrender.com
set API_PORT=443
set API_SECURE=true
python windows-relay-server-socketio.py
```

**Option D: Build executable with config**

1. Edit `windows-relay-server-socketio.py` before building
2. Build the executable with your config baked in
3. Distribute to Windows machines

#### 3. Render.com Configuration

Make sure your Render.com deployment:
- Exposes port 3001 for Socket.IO
- Has CORS configured to accept connections from anywhere (`origin: '*'`)
- Uses HTTPS (Render.com provides this automatically)

**Important:** Render.com free tier may have connection limits. Monitor your usage.

### Running Webapp and API on Mac, Relay on Windows

1. **Find your Mac's IP address:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. **Run the relay with your Mac's IP:**
   ```cmd
   python windows-relay-server-socketio.py --host 192.168.1.100 --port 3001
   ```

3. **Ensure firewall allows port 3001:**
   ```bash
   # On Mac (if needed)
   sudo pfctl -d  # Disable firewall temporarily for testing
   ```

### Running Across Multiple Networks

If using VPN or complex networking:

1. **API Server**: Bind to `0.0.0.0` (already configured)
2. **Python Relay**: Use full hostname or IP with `--host` flag
3. **Firewall**: Open port 3001 on API server machine

## Troubleshooting

### Python Relay Can't Connect

**Symptoms:**
- "Connection error" in Python relay
- No relay status in webapp

**Solutions:**
1. Check API server is running: `curl http://API_HOST:3001/socket.io/`
2. Verify network connectivity: `ping API_HOST`
3. Check firewall settings
4. Try using IP instead of hostname
5. Check API logs for connection attempts

### Webapp Not Receiving Telemetry

**Symptoms:**
- Webapp connects but no data updates
- Relay shows connected but webapp doesn't receive data

**Solutions:**
1. Check browser console for Socket.IO messages
2. Verify relay status shows "connected" in webapp
3. Check API server logs for `relay:telemetry` events
4. Ensure webapp subscribed to telemetry

### High Latency

**Solutions:**
1. Check network connection quality
2. Reduce `TELEMETRY_RATE` in Python relay (e.g., 30Hz instead of 60Hz)
3. Use websocket transport only: `transports=['websocket']`

## Old vs New Architecture

### Old Architecture (REMOVED)
- Python relay ran as WebSocket server (port 3002)
- API connected to relay as WebSocket client
- Webapp connected to API via Socket.IO (port 3001)

### New Architecture (CURRENT)
- API runs Socket.IO server (port 3001)
- Python relay connects to API as Socket.IO client
- Webapp connects to API as Socket.IO client

**Benefits:**
- Simpler firewall configuration (only one port)
- Better connection management (API controls all connections)
- Easier to scale (multiple relays can connect)
- Built-in reconnection logic
- Better error handling

## Files Modified

1. `apps/api/src/index.ts` - Enhanced Socket.IO server
2. `apps/web/hooks/use-websocket.ts` - Added client identification
3. `tools/windows-relay-server-socketio.py` - NEW Socket.IO client version

## Old Files (Deprecated)

These files are now deprecated but kept for reference:
- `tools/windows-relay-server-v2.py` - Old WebSocket server version
- `apps/api/src/services/remote-telemetry/relay-client.ts` - Old WebSocket client

## Testing

### Test Relay Connection

```bash
# Terminal 1: Start API
cd apps/api && npm run dev

# Terminal 2: Check Socket.IO endpoint
curl http://localhost:3001/socket.io/

# Terminal 3: Start Python relay (Windows)
python windows-relay-server-socketio.py
```

Expected output:
```
[Relay] ✅ Connected to API server
[Relay] ✅ Relay identified: Relay identified and ready to send telemetry
```

### Test Webapp Connection

```bash
# Start webapp
cd apps/web && npm run dev

# Open http://localhost:3003 in browser
# Check browser console for:
# "WebSocket connected to API server"
# "Webapp identified: ..."
# "Relay status: connected" (if relay is running)
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review API server logs
3. Check browser console for webapp
4. Check Python relay output
5. Verify network connectivity between components
