"""
iRacing Telemetry Relay Server - DEEP DEBUG VERSION
Checks connection state and session info
"""

import asyncio
import json
import logging
import socket
import sys
from datetime import datetime
from typing import Set, Optional, Dict, Any

print("=" * 50)
print("iRacing Relay Server - DEEP DEBUG")
print("=" * 50)
print("")

try:
    import irsdk
    IRSDK_AVAILABLE = True
except ImportError:
    IRSDK_AVAILABLE = False
    print("[Relay] ⚠️  pyirsdk not available")
    sys.exit(1)

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
    print(f"[Relay] ✅ websockets version: {websockets.__version__}")
except ImportError:
    print("[Relay] ❌ websockets package not found!")
    sys.exit(1)

PORT = 3002

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('iRacing-Deep-Debug')

clients: Set[WebSocketServerProtocol] = set()
ir: Optional[Any] = None


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return 'localhost'


async def broadcast(message: Dict[str, Any]) -> None:
    if not clients:
        return
    data = json.dumps(message)
    disconnected = set()
    for client in clients:
        try:
            await client.send(data)
        except:
            disconnected.add(client)
    for client in disconnected:
        clients.discard(client)


async def handle_client_message(websocket: WebSocketServerProtocol, message_str: str) -> None:
    try:
        message = json.loads(message_str)
        msg_type = message.get('type')

        if msg_type == 'handshake':
            logger.info(f"Handshake from client")
            await websocket.send(json.dumps({
                'type': 'handshake_ack',
                'version': 'deep-debug',
                'irsdkAvailable': True
            }))

        elif msg_type == 'subscribe':
            logger.info(f"Client subscribed")

    except Exception as e:
        logger.error(f"Error: {e}")


async def websocket_handler(websocket: WebSocketServerProtocol) -> None:
    client_ip = websocket.remote_address[0] if websocket.remote_address else 'unknown'
    logger.info(f"✅ Client connected from {client_ip}")
    clients.add(websocket)
    try:
        async for message in websocket:
            await handle_client_message(websocket, message)
    except:
        pass
    finally:
        clients.discard(websocket)
        logger.info(f"Client {client_ip} disconnected")


async def telemetry_loop() -> None:
    global ir
    ir = irsdk.IRSDK()
    was_connected = False
    last_check = 0

    logger.info("Starting telemetry loop...")

    while True:
        try:
            current_time = datetime.now().timestamp()

            # Check connection
            is_connected = ir.startup()

            if not is_connected:
                if was_connected:
                    logger.warning("❌ Disconnected from iRacing")
                    was_connected = False
                await asyncio.sleep(1)
                continue

            if not was_connected:
                logger.info("✅ Connected to iRacing!")
                was_connected = True

            # Deep debug every 3 seconds
            if current_time - last_check > 3:
                logger.info("")
                logger.info("=" * 70)
                logger.info("🔍 DEEP DEBUG CHECK")
                logger.info("=" * 70)

                # Check is_connected and is_initialized
                logger.info(f"  ir.is_connected: {ir.is_connected}")
                logger.info(f"  ir.is_initialized: {ir.is_initialized}")

                # Check session info
                try:
                    session_info = ir['SessionInfo']
                    if session_info:
                        logger.info(f"  ✅ SessionInfo available: {type(session_info)}")
                    else:
                        logger.info(f"  ❌ SessionInfo is None/empty")
                except Exception as e:
                    logger.info(f"  ❌ SessionInfo error: {e}")

                # Try freeze_var_buffer_latest
                can_freeze = ir.freeze_var_buffer_latest()
                logger.info(f"  freeze_var_buffer_latest(): {can_freeze}")

                if can_freeze:
                    logger.info("  ✅ CAN READ TELEMETRY!")

                    # Try to read some basic values
                    test_vars = ['Speed', 'SessionTime', 'IsOnTrack', 'PlayerCarIdx', 'CamCarIdx']
                    for var in test_vars:
                        try:
                            value = ir[var]
                            logger.info(f"    {var}: {value}")
                        except Exception as e:
                            logger.info(f"    {var}: ERROR - {e}")
                else:
                    logger.info("  ❌ CANNOT READ TELEMETRY (freeze_var_buffer_latest = False)")
                    logger.info("  This means:")
                    logger.info("    - You might be in menus/garage")
                    logger.info("    - No active session is running")
                    logger.info("    - Replay is paused")
                    logger.info("    - In spectator mode with no session data")

                # Check var_buffer status
                try:
                    logger.info(f"  var_buf status: {ir.var_buf}")
                except:
                    logger.info(f"  var_buf: Not accessible")

                logger.info("=" * 70)
                logger.info("")
                last_check = current_time

            await asyncio.sleep(0.5)

        except KeyboardInterrupt:
            logger.info("Shutting down...")
            break
        except Exception as e:
            logger.error(f"Loop error: {e}")
            await asyncio.sleep(1)

    if ir:
        ir.shutdown()


async def main() -> None:
    local_ip = get_local_ip()

    print("")
    print("=" * 50)
    print("[Relay] 🔬 DEEP DEBUG MODE")
    print("=" * 50)
    print(f"[Relay] WebSocket: ws://{local_ip}:{PORT}")
    print("[Relay] Checking iRacing connection state...")
    print("")

    server = await websockets.serve(
        websocket_handler,
        "0.0.0.0",
        PORT,
        ping_interval=20,
        ping_timeout=10,
    )

    logger.info(f"✅ Server listening on 0.0.0.0:{PORT}")

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
