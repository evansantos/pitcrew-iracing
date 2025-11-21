/**
 * iRacing Telemetry Relay Server for Windows (v2)
 *
 * This version handles node-irsdk gracefully if it fails to install
 *
 * Run this on your Windows machine with iRacing installed.
 *
 * Setup:
 * 1. npm install ws
 * 2. npm install node-irsdk (if this fails, the script will tell you)
 * 3. node windows-relay-server-v2.js
 */

const WebSocket = require('ws');

// Configuration
const PORT = 3002;
const TELEMETRY_RATE = 60; // Hz

// Try to load iRacing SDK
let irsdk = null;
let irsdkAvailable = false;

try {
  irsdk = require('node-irsdk');
  irsdkAvailable = true;
  console.log('[Relay] ✅ node-irsdk loaded successfully');
} catch (error) {
  console.log('[Relay] ⚠️  node-irsdk not available');
  console.log('[Relay] Error:', error.message);
  console.log('');
  console.log('To fix this:');
  console.log('1. Install Visual Studio Build Tools:');
  console.log('   https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022');
  console.log('   - Select "Desktop development with C++"');
  console.log('');
  console.log('2. Then run: npm install -g windows-build-tools');
  console.log('3. Then run: npm install node-irsdk');
  console.log('');
  console.log('The relay server will still start, but needs node-irsdk to work.');
  console.log('');
}

// Initialize WebSocket server
const wss = new WebSocket.Server({ port: PORT });

console.log(`[Relay] iRacing Telemetry Relay Server starting on port ${PORT}...`);

// Track connected clients
const clients = new Set();

// Initialize iRacing SDK if available
let iracing = null;

if (irsdkAvailable) {
  try {
    iracing = irsdk.init({
      telemetryUpdateInterval: Math.floor(1000 / TELEMETRY_RATE),
      sessionInfoUpdateInterval: 1000,
    });
    console.log('[Relay] ✅ iRacing SDK initialized');
  } catch (error) {
    console.log('[Relay] ⚠️  Failed to initialize iRacing SDK:', error.message);
  }
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[Relay] Client connected from ${clientIp}`);

  clients.add(ws);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'handshake':
          console.log(`[Relay] Handshake from ${clientIp}, version: ${message.version}`);
          ws.send(JSON.stringify({
            type: 'handshake_ack',
            version: '1.0',
            irsdkAvailable: irsdkAvailable
          }));
          break;

        case 'subscribe':
          console.log(`[Relay] Client subscribed to: ${message.channels?.join(', ')}`);
          if (!irsdkAvailable) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'node-irsdk not available on server'
            }));
          }
          break;

        default:
          console.log(`[Relay] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('[Relay] Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`[Relay] Client disconnected from ${clientIp}`);
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[Relay] WebSocket error:', error);
  });
});

// Broadcast to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Only setup iRacing handlers if SDK is available
if (iracing) {
  // iRacing SDK event handlers
  iracing.on('Connected', () => {
    console.log('[iRacing] ✅ Connected to iRacing!');
    broadcast({
      type: 'session',
      data: { state: 'connected' },
    });
  });

  iracing.on('Disconnected', () => {
    console.log('[iRacing] ❌ Disconnected from iRacing');
    broadcast({
      type: 'session',
      data: { state: 'disconnected' },
    });
  });

  iracing.on('Telemetry', (telemetry) => {
    // Transform iRacing telemetry to our format
    const transformed = transformTelemetry(telemetry);

    broadcast({
      type: 'telemetry',
      data: transformed,
    });
  });

  iracing.on('SessionInfo', (sessionInfo) => {
    console.log('[iRacing] Session info updated');
    broadcast({
      type: 'session',
      data: { sessionInfo },
    });
  });
}

// Transform iRacing SDK data to our application format
function transformTelemetry(data) {
  return {
    timestamp: Date.now(),
    sessionTime: data.SessionTime || 0,

    player: {
      speed: data.Speed ? data.Speed * 3.6 : 0, // m/s to km/h
      rpm: data.RPM || 0,
      gear: data.Gear || 0,
      throttle: data.Throttle || 0,
      brake: data.Brake || 0,
      lap: data.Lap || 0,
      lapDistPct: data.LapDistPct || 0,
      currentLapTime: data.LapCurrentLapTime || 0,
      lastLapTime: data.LapLastLapTime || 0,
      bestLapTime: data.LapBestLapTime || 0,
      position: data.Position || 0,
      classPosition: data.ClassPosition || 0,
    },

    fuel: {
      level: data.FuelLevel || 0,
      levelPct: data.FuelLevelPct ? data.FuelLevelPct * 100 : 0,
      usePerHour: data.FuelUsePerHour || 0,
      lapsRemaining: Math.floor((data.FuelLevel || 0) / ((data.FuelUsePerHour || 1) / 60)),
    },

    tires: {
      lf: {
        temp: data.LFtempCM || 0,
        wear: data.LFwearM || 0,
        pressure: data.LFpressure || 0,
      },
      rf: {
        temp: data.RFtempCM || 0,
        wear: data.RFwearM || 0,
        pressure: data.RFpressure || 0,
      },
      lr: {
        temp: data.LRtempCM || 0,
        wear: data.LRwearM || 0,
        pressure: data.LRpressure || 0,
      },
      rr: {
        temp: data.RRtempCM || 0,
        wear: data.RRwearM || 0,
        pressure: data.RRpressure || 0,
      },
    },

    track: {
      temperature: data.TrackTemp || 20,
      airTemp: data.AirTemp || 20,
      windSpeed: data.WindVel || 0,
      windDirection: data.WindDir || 0,
      humidity: data.RelativeHumidity ? data.RelativeHumidity * 100 : 50,
    },

    session: {
      state: data.SessionState || 0,
      flags: data.SessionFlags || 0,
      timeRemaining: data.SessionTimeRemain || 0,
      lapsRemaining: data.SessionLapsRemain || 0,
    },
  };
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Relay] Shutting down...');

  broadcast({
    type: 'session',
    data: { state: 'server_shutdown' },
  });

  wss.close(() => {
    console.log('[Relay] WebSocket server closed');
    process.exit(0);
  });
});

// Get local IP
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

console.log('');
console.log('================================');
if (irsdkAvailable) {
  console.log('[Relay] ✅ Ready! Waiting for iRacing to start...');
} else {
  console.log('[Relay] ⚠️  Server running but node-irsdk not available');
  console.log('[Relay] Please install build tools and node-irsdk');
}
console.log('================================');
console.log(`[Relay] WebSocket: ws://${localIP}:${PORT}`);
console.log(`[Relay] Clients can connect from: ${localIP}:${PORT}`);
console.log('[Relay] Press Ctrl+C to stop');
console.log('');
