"""
iRacing Telemetry Relay Server - SPECTATOR MODE DEBUG VERSION
This version logs all available data to help understand what's accessible in spectator mode
"""

import asyncio
import json
import logging
import socket
import sys
from datetime import datetime
from typing import Set, Optional, Dict, Any

print("=" * 50)
print("iRacing Relay Server - SPECTATOR DEBUG")
print("=" * 50)
print("")

try:
    import irsdk
    IRSDK_AVAILABLE = True
except ImportError:
    IRSDK_AVAILABLE = False
    print("[Relay] ⚠️  pyirsdk not available")
    print("[Relay] Install with: pip install pyirsdk")
    sys.exit(1)

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
    print(f"[Relay] ✅ websockets version: {websockets.__version__}")
except ImportError:
    print("[Relay] ❌ websockets package not found!")
    sys.exit(1)

# Configuration
PORT = 3002
TELEMETRY_RATE = 10  # Reduced to 10Hz for debugging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('iRacing-Relay-Debug')

# Track connected clients
clients: Set[WebSocketServerProtocol] = set()

# iRacing SDK instance
ir: Optional[Any] = None
last_log_time = 0


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

    for client in disconnected:
        clients.discard(client)


def debug_available_data(ir_instance) -> Dict[str, Any]:
    """Debug: Check what data is actually available"""
    available_vars = {}

    # Test key variables
    test_vars = [
        # Player info
        'PlayerCarIdx',
        'CamCarIdx',  # Camera car index (who we're watching)
        'IsOnTrack',
        'IsInGarage',
        'IsReplayPlaying',

        # Session data
        'SessionState',
        'SessionFlags',
        'SessionTime',
        'SessionTimeRemain',

        # Try to get data for ALL cars
        'CarIdxLapDistPct',  # Array of lap distance % for all cars
        'CarIdxTrackSurface',  # Array of track surface for all cars
        'CarIdxPosition',  # Array of positions
        'CarIdxF2Time',  # Array of last lap times
        'CarIdxLastLapTime',  # Array of last lap times
        'CarIdxBestLapTime',  # Array of best lap times

        # Single car data (might be for camera car)
        'Speed',
        'RPM',
        'Gear',
        'Throttle',
        'Brake',
        'Lap',
        'LapDistPct',

        # Fuel and tires (may not be available for spectated cars)
        'FuelLevel',
        'FuelLevelPct',
        'LFtempCM',
        'RFtempCM',
    ]

    for var in test_vars:
        try:
            value = ir_instance[var]
            available_vars[var] = value
        except:
            available_vars[var] = 'NOT_AVAILABLE'

    return available_vars


async def handle_client_message(websocket: WebSocketServerProtocol, message_str: str) -> None:
    """Handle incoming client messages"""
    try:
        message = json.loads(message_str)
        msg_type = message.get('type')

        if msg_type == 'handshake':
            logger.info(f"Handshake from client, version: {message.get('version', 'unknown')}")
            await websocket.send(json.dumps({
                'type': 'handshake_ack',
                'version': 'debug-spectator',
                'irsdkAvailable': IRSDK_AVAILABLE and ir is not None
            }))

        elif msg_type == 'subscribe':
            channels = message.get('channels', [])
            logger.info(f"Client subscribed to: {', '.join(channels)}")

    except Exception as e:
        logger.error(f"Error handling client message: {e}")


async def websocket_handler(websocket: WebSocketServerProtocol) -> None:
    """Handle WebSocket connections"""
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


async def telemetry_loop() -> None:
    """Main telemetry processing loop with debug logging"""
    global ir, last_log_time

    ir = irsdk.IRSDK()
    was_connected = False

    logger.info("Telemetry loop started, waiting for iRacing...")

    while True:
        try:
            if not ir.startup():
                if was_connected:
                    logger.warning("Disconnected from iRacing")
                    was_connected = False
                await asyncio.sleep(1)
                continue

            if not was_connected:
                logger.info("✅ Connected to iRacing!")
                was_connected = True

            # Check if data is available
            if ir.freeze_var_buffer_latest():
                current_time = datetime.now().timestamp()

                # Log debug info every 5 seconds
                if current_time - last_log_time > 5:
                    logger.info("=" * 60)
                    logger.info("DEBUGGING AVAILABLE DATA:")
                    debug_data = debug_available_data(ir)

                    for key, value in debug_data.items():
                        if value != 'NOT_AVAILABLE':
                            # Truncate arrays
                            if isinstance(value, (list, tuple)):
                                logger.info(f"  {key}: [array with {len(value)} items]")
                            else:
                                logger.info(f"  {key}: {value}")

                    logger.info("=" * 60)
                    last_log_time = current_time

                # Broadcast whatever data we can get
                try:
                    player_car_idx = ir['PlayerCarIdx']
                    cam_car_idx = ir['CamCarIdx']

                    telemetry_data = {
                        'timestamp': int(datetime.now().timestamp() * 1000),
                        'mode': 'spectator' if player_car_idx != cam_car_idx else 'driving',
                        'playerCarIdx': player_car_idx,
                        'cameraCarIdx': cam_car_idx,
                        'sessionTime': ir['SessionTime'] if 'SessionTime' in ir else 0,
                        'debug': debug_available_data(ir)
                    }

                    await broadcast({
                        'type': 'telemetry',
                        'data': telemetry_data,
                    })

                except Exception as e:
                    logger.error(f"Error reading telemetry: {e}")

            await asyncio.sleep(1.0 / TELEMETRY_RATE)

        except KeyboardInterrupt:
            logger.info("Shutting down...")
            break
        except Exception as e:
            logger.error(f"Telemetry loop error: {e}")
            await asyncio.sleep(1)

    if ir:
        ir.shutdown()


async def main() -> None:
    """Main entry point"""
    local_ip = get_local_ip()

    print("")
    print("=" * 50)
    print("[Relay] 🐛 DEBUG MODE - Spectator Data Analysis")
    print("=" * 50)
    print(f"[Relay] WebSocket: ws://{local_ip}:{PORT}")
    print("[Relay] This will log all available data every 5 seconds")
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
        await asyncio.Future()
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
    finally:
        server.close()
        await server.wait_closed()
        telemetry_task.cancel()
        try:
            await telemetry_task
        except asyncio.CancelledError:
            pass


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutdown complete")
