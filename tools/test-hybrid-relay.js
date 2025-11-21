#!/usr/bin/env node

/**
 * Test script for hybrid relay server
 * Tests both driving mode (full telemetry) and spectating mode (SessionInfo)
 */

import WebSocket from 'ws';

const RELAY_HOST = '192.168.0.107';
const RELAY_PORT = 3002;

console.log('='.repeat(60));
console.log('Testing Hybrid Relay Server');
console.log('='.repeat(60));
console.log(`Connecting to ws://${RELAY_HOST}:${RELAY_PORT}...\n`);

const ws = new WebSocket(`ws://${RELAY_HOST}:${RELAY_PORT}`);

let messageCount = 0;
let lastMode = null;

ws.on('open', () => {
  console.log('✅ Connected!\n');

  // Send handshake
  ws.send(JSON.stringify({ type: 'handshake', version: '1.0' }));

  // Subscribe to telemetry
  setTimeout(() => {
    ws.send(JSON.stringify({ type: 'subscribe', channels: ['telemetry'] }));
    console.log('📡 Subscribed to telemetry channel');
    console.log('Listening for data...\n');
    console.log('='.repeat(60));
  }, 500);
});

ws.on('message', (data) => {
  messageCount++;
  const msg = JSON.parse(data.toString());
  const timestamp = new Date().toLocaleTimeString();

  if (msg.type === 'handshake_ack') {
    console.log(`[${timestamp}] 🤝 Handshake acknowledged`);
    console.log(`   Mode: ${msg.mode}`);
    console.log(`   irsdk Available: ${msg.irsdkAvailable}\n`);
  }

  else if (msg.type === 'session') {
    console.log(`[${timestamp}] 🎮 Session: ${msg.data.state}\n`);
  }

  else if (msg.type === 'telemetry') {
    const mode = msg.data.mode;

    // Only log mode changes
    if (mode !== lastMode) {
      console.log('='.repeat(60));
      if (mode === 'full_telemetry') {
        console.log(`[${timestamp}] 🏎️  DRIVING MODE - Full Telemetry`);
        console.log('   Receiving: Speed, RPM, Fuel, Tires, Throttle, Brake');
      } else if (mode === 'session_info') {
        console.log(`[${timestamp}] 👁️  SPECTATING MODE - SessionInfo Only`);
        console.log('   Receiving: Lap times, Positions, Session state');
      }
      console.log('='.repeat(60));
      lastMode = mode;
    }

    // Log sample data
    if (mode === 'full_telemetry') {
      const player = msg.data.player;
      console.log(`[${timestamp}] Speed: ${player.speed.toFixed(1)} km/h | ` +
                  `Lap: ${player.lap} | ` +
                  `Gear: ${player.gear} | ` +
                  `Fuel: ${msg.data.fuel.level.toFixed(1)}L`);
    }

    else if (mode === 'session_info') {
      const session = msg.data.session;
      const drivers = msg.data.drivers;
      const player = drivers.find(d => d.isPlayer);

      console.log(`[${timestamp}] Session: ${session.type} | ` +
                  `Time Left: ${Math.floor(session.timeRemaining / 60)}m | ` +
                  `Drivers: ${drivers.length}`);

      if (player) {
        console.log(`   Your Position: ${player.position} | ` +
                    `Lap: ${player.lap} | ` +
                    `Last Lap: ${player.lastLapTime.toFixed(3)}s | ` +
                    `Best: ${player.bestLapTime.toFixed(3)}s`);
      }
    }
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket Error:', error.message);
});

ws.on('close', () => {
  console.log('\n' + '='.repeat(60));
  console.log('🔌 Connection closed');
  console.log(`Total messages received: ${messageCount}`);
  console.log('='.repeat(60));
});

// Run for 60 seconds
setTimeout(() => {
  console.log('\n⏱️  Test complete');
  ws.close();
  process.exit(0);
}, 60000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nTest interrupted');
  ws.close();
  process.exit(0);
});
