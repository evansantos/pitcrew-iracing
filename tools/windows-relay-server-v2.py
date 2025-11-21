"""
iRacing Telemetry Relay Server for Windows (Python Version)
VERSION: 2.0 - Fixed for websockets 12+ compatibility

This version uses pyirsdk (Python 3.11+) instead of node-irsdk
to avoid native compilation issues.

Run this on your Windows machine with iRacing installed.

Setup:
1. Install Python 3.11 from https://www.python.org/
2. pip install pyirsdk websockets
3. python windows-relay-server-v2.py
"""

import asyncio
import json
import logging
import socket
import sys
from datetime import datetime
from typing import Set, Optional, Dict, Any

print("=" * 50)
print("iRacing Relay Server - Version 2.0")
print("Fixed for websockets 12+ compatibility")
print("=" * 50)
print("")

try:
    import irsdk
    IRSDK_AVAILABLE = True
except ImportError:
    IRSDK_AVAILABLE = False
    print("[Relay] ⚠️  pyirsdk not available")
    print("[Relay] Install with: pip install pyirsdk")

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
    print(f"[Relay] ✅ websockets version: {websockets.__version__}")
except ImportError:
    print("[Relay] ❌ websockets package not found!")
    print("[Relay] Install with: pip install websockets")
    sys.exit(1)

# Configuration
PORT = 3002
TELEMETRY_RATE = 60  # Hz
UPDATE_INTERVAL = 1.0 / TELEMETRY_RATE  # ~16.67ms

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('iRacing-Relay')

# Track connected clients
clients: Set[WebSocketServerProtocol] = set()

# iRacing SDK instance
ir: Optional[Any] = None


def get_local_ip() -> str:
    """Get local IP address"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return 'localhost'


async def broadcast(message: Dict[str, Any]) -> None:
    """Broadcast message to all connected clients"""
    if not clients:
        return

    data = json.dumps(message)
    disconnected = set()

    for client in clients:
        try:
            await client.send(data)
        except websockets.exceptions.ConnectionClosed:
            disconnected.add(client)
        except Exception as e:
            logger.error(f"Error sending to client: {e}")
            disconnected.add(client)

    # Remove disconnected clients
    for client in disconnected:
        clients.discard(client)


def transform_telemetry(ir_data) -> Dict[str, Any]:
    """Transform iRacing SDK data to our application format"""
    return {
        'timestamp': int(datetime.now().timestamp() * 1000),
        'sessionTime': ir_data.get('SessionTime', 0),

        'player': {
            'speed': ir_data.get('Speed', 0) * 3.6,  # m/s to km/h
            'rpm': ir_data.get('RPM', 0),
            'gear': ir_data.get('Gear', 0),
            'throttle': ir_data.get('Throttle', 0),
            'brake': ir_data.get('Brake', 0),
            'lap': ir_data.get('Lap', 0),
            'lapDistPct': ir_data.get('LapDistPct', 0),
            'currentLapTime': ir_data.get('LapCurrentLapTime', 0),
            'lastLapTime': ir_data.get('LapLastLapTime', 0),
            'bestLapTime': ir_data.get('LapBestLapTime', 0),
            'position': ir_data.get('Position', 0),
            'classPosition': ir_data.get('ClassPosition', 0),
        },

        'fuel': {
            'level': ir_data.get('FuelLevel', 0),
            'levelPct': ir_data.get('FuelLevelPct', 0) * 100 if ir_data.get('FuelLevelPct') else 0,
            'usePerHour': ir_data.get('FuelUsePerHour', 0),
            'lapsRemaining': int((ir_data.get('FuelLevel', 0) or 0) / ((ir_data.get('FuelUsePerHour', 1) or 1) / 60)),
        },

        'tires': {
            'lf': {
                'temp': ir_data.get('LFtempCM', 0),
                'wear': ir_data.get('LFwearM', 0),
                'pressure': ir_data.get('LFpressure', 0),
            },
            'rf': {
                'temp': ir_data.get('RFtempCM', 0),
                'wear': ir_data.get('RFwearM', 0),
                'pressure': ir_data.get('RFpressure', 0),
            },
            'lr': {
                'temp': ir_data.get('LRtempCM', 0),
                'wear': ir_data.get('LRwearM', 0),
                'pressure': ir_data.get('LRpressure', 0),
            },
            'rr': {
                'temp': ir_data.get('RRtempCM', 0),
                'wear': ir_data.get('RRwearM', 0),
                'pressure': ir_data.get('RRpressure', 0),
            },
        },

        'track': {
            'temperature': ir_data.get('TrackTemp', 20),
            'airTemp': ir_data.get('AirTemp', 20),
            'windSpeed': ir_data.get('WindVel', 0),
            'windDirection': ir_data.get('WindDir', 0),
            'humidity': ir_data.get('RelativeHumidity', 0.5) * 100,
        },

        'session': {
            'state': ir_data.get('SessionState', 0),
            'flags': ir_data.get('SessionFlags', 0),
            'timeRemaining': ir_data.get('SessionTimeRemain', 0),
            'lapsRemaining': ir_data.get('SessionLapsRemain', 0),
        },
    }


async def handle_client_message(websocket: WebSocketServerProtocol, message_str: str) -> None:
    """Handle incoming client messages"""
    try:
        message = json.loads(message_str)
        msg_type = message.get('type')

        if msg_type == 'handshake':
            logger.info(f"Handshake from client, version: {message.get('version', 'unknown')}")
            await websocket.send(json.dumps({
                'type': 'handshake_ack',
                'version': '2.0',
                'irsdkAvailable': IRSDK_AVAILABLE and ir is not None
            }))

        elif msg_type == 'subscribe':
            channels = message.get('channels', [])
            logger.info(f"Client subscribed to: {', '.join(channels)}")
            if not IRSDK_AVAILABLE or ir is None:
                await websocket.send(json.dumps({
                    'type': 'error',
                    'error': 'pyirsdk not available or iRacing not running'
                }))

        else:
            logger.warning(f"Unknown message type: {msg_type}")

    except json.JSONDecodeError:
        logger.error("Failed to parse client message")
    except Exception as e:
        logger.error(f"Error handling client message: {e}")


async def websocket_handler(websocket: WebSocketServerProtocol) -> None:
    """
    Handle WebSocket connections

    NOTE: websockets 12+ removed the 'path' parameter from handler signature
    This version is compatible with websockets 12+
    """
    client_ip = websocket.remote_address[0] if websocket.remote_address else 'unknown'
    logger.info(f"✅ Client connected from {client_ip}")

    clients.add(websocket)

    try:
        async for message in websocket:
            await handle_client_message(websocket, message)
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected from {client_ip}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        clients.discard(websocket)
        logger.info(f"Client {client_ip} removed from active connections")


async def telemetry_loop() -> None:
    """Main telemetry processing loop"""
    global ir

    if not IRSDK_AVAILABLE:
        logger.warning("pyirsdk not available - telemetry loop will not run")
        return

    ir = irsdk.IRSDK()
    was_connected = False

    logger.info("Telemetry loop started, waiting for iRacing...")

    while True:
        try:
            # Check if we need to startup
            if not ir.startup():
                if was_connected:
                    logger.warning("Disconnected from iRacing")
                    was_connected = False
                    await broadcast({
                        'type': 'session',
                        'data': {'state': 'disconnected'},
                    })
                await asyncio.sleep(1)
                continue

            # Connected to iRacing
            if not was_connected:
                logger.info("✅ Connected to iRacing!")
                was_connected = True
                await broadcast({
                    'type': 'session',
                    'data': {'state': 'connected'},
                })

            # Freeze data to prevent changes during read
            if ir.freeze_var_buffer_latest():
                # Get all telemetry data
                telemetry = transform_telemetry(ir)

                # Broadcast to all clients
                await broadcast({
                    'type': 'telemetry',
                    'data': telemetry,
                })

            # Run at configured rate
            await asyncio.sleep(UPDATE_INTERVAL)

        except KeyboardInterrupt:
            logger.info("Shutting down...")
            break
        except Exception as e:
            logger.error(f"Telemetry loop error: {e}")
            await asyncio.sleep(1)

    # Shutdown
    if ir:
        ir.shutdown()


async def main() -> None:
    """Main entry point"""
    local_ip = get_local_ip()

    print("")
    print("=" * 50)
    if IRSDK_AVAILABLE:
        print("[Relay] ✅ Ready! Waiting for iRacing to start...")
    else:
        print("[Relay] ⚠️  Server running but pyirsdk not available")
        print("[Relay] Please install: pip install pyirsdk")
    print("=" * 50)
    print(f"[Relay] WebSocket: ws://{local_ip}:{PORT}")
    print(f"[Relay] Clients can connect from: {local_ip}:{PORT}")
    print("[Relay] Press Ctrl+C to stop")
    print("")

    # Start WebSocket server
    server = await websockets.serve(
        websocket_handler,
        "0.0.0.0",
        PORT,
        ping_interval=20,
        ping_timeout=10,
    )

    logger.info(f"✅ Server listening on 0.0.0.0:{PORT}")

    # Start telemetry loop
    telemetry_task = asyncio.create_task(telemetry_loop())

    try:
        # Run forever
        await asyncio.Future()
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
    finally:
        # Cleanup
        await broadcast({
            'type': 'session',
            'data': {'state': 'server_shutdown'},
        })

        server.close()
        await server.wait_closed()

        telemetry_task.cancel()
        try:
            await telemetry_task
        except asyncio.CancelledError:
            pass

        logger.info("Server stopped")


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutdown complete")
