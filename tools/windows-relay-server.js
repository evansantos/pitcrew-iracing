/**
 * iRacing Telemetry Relay Server for Windows
 *
 * Run this on your Windows machine with iRacing installed.
 * It reads from the iRacing SDK and broadcasts telemetry via WebSocket.
 *
 * Setup:
 * 1. Copy this file to your Windows machine
 * 2. Install dependencies: npm install ws node-irsdk
 * 3. Run: node windows-relay-server.js
 * 4. Configure your macOS client with the Windows IP address
 */

const WebSocket = require('ws');
const irsdk = require('node-irsdk');

// Configuration
const PORT = 3002; // WebSocket port
const TELEMETRY_RATE = 60; // Hz

// Initialize WebSocket server
const wss = new WebSocket.Server({ port: PORT });

console.log(`[Relay] iRacing Telemetry Relay Server starting on port ${PORT}...`);

// Track connected clients
const clients = new Set();

// Initialize iRacing SDK
const iracing = irsdk.init({
  telemetryUpdateInterval: Math.floor(1000 / TELEMETRY_RATE),
  sessionInfoUpdateInterval: 1000,
});

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
          ws.send(JSON.stringify({ type: 'handshake_ack', version: '1.0' }));
          break;

        case 'subscribe':
          console.log(`[Relay] Client subscribed to: ${message.channels?.join(', ')}`);
          // Client is now subscribed
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

// iRacing SDK event handlers
iracing.on('Connected', () => {
  console.log('[iRacing] Connected to iRacing!');
  broadcast({
    type: 'session',
    data: { state: 'connected' },
  });
});

iracing.on('Disconnected', () => {
  console.log('[iRacing] Disconnected from iRacing');
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

  // Notify clients
  broadcast({
    type: 'session',
    data: { state: 'server_shutdown' },
  });

  // Close all connections
  wss.close(() => {
    console.log('[Relay] WebSocket server closed');
    process.exit(0);
  });
});

console.log('[Relay] Ready! Waiting for iRacing to start...');
console.log(`[Relay] Clients can connect to: ws://YOUR_WINDOWS_IP:${PORT}`);
console.log('[Relay] Press Ctrl+C to stop');
