"""
iRacing Telemetry Relay Server - HYBRID VERSION
Broadcasts full telemetry when driving, SessionInfo when spectating
"""

import asyncio
import json
import logging
import socket
import sys
import yaml
from datetime import datetime
from typing import Set, Optional, Dict, Any

print("=" * 50)
print("iRacing Relay Server - HYBRID MODE")
print("Priority: Full Telemetry (driving)")
print("Fallback: SessionInfo (spectating)")
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
TELEMETRY_RATE = 60  # Hz for full telemetry
SESSIONINFO_RATE = 2  # Hz for SessionInfo updates (slower)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('iRacing-Hybrid-Relay')

# Reduce websockets logging noise
logging.getLogger('websockets').setLevel(logging.WARNING)

# Track connected clients
clients: Set[WebSocketServerProtocol] = set()

# iRacing SDK instance
ir: Optional[Any] = None
current_mode = 'unknown'  # 'driving' or 'spectating'


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


def safe_get(ir, key, default=None):
    """Safely get value from IRSDK object with fallback"""
    try:
        value = ir[key]
        return value if value is not None else default
    except (KeyError, TypeError):
        return default


def transform_full_telemetry(ir_data) -> Dict[str, Any]:
    """Transform iRacing SDK data to full telemetry format"""

    # Get SessionInfo for driver names and car numbers
    # SessionInfo is a YAML string that needs to be parsed
    session_info_yaml = safe_get(ir_data, 'SessionInfo', '')
    session_info = {}

    if session_info_yaml and isinstance(session_info_yaml, str):
        try:
            session_info = yaml.safe_load(session_info_yaml)
        except Exception as e:
            logger.warning(f"Failed to parse SessionInfo YAML in full telemetry: {e}")
            session_info = {}
    elif isinstance(session_info_yaml, dict):
        # Already parsed (shouldn't happen, but handle it)
        session_info = session_info_yaml

    driver_info = session_info.get('DriverInfo', {}) if session_info else {}
    drivers = driver_info.get('Drivers', []) if driver_info else []
    player_car_idx = driver_info.get('DriverCarIdx', 0) if driver_info else 0

    # Get player info for session metadata
    player_driver = drivers[player_car_idx] if player_car_idx < len(drivers) else {}
    player_name = player_driver.get('UserName', 'Unknown Driver') if player_driver else 'Unknown Driver'
    player_car = player_driver.get('CarScreenName', 'Unknown Car') if player_driver else 'Unknown Car'

    # Get track info
    weekend_info = session_info.get('WeekendInfo', {}) if session_info else {}
    track_name = weekend_info.get('TrackDisplayName') or weekend_info.get('TrackName', 'Unknown Track')

    logger.info(f"🏁 Full Telemetry - SessionInfo parsed: {bool(session_info)}")
    logger.info(f"🏁 Full Telemetry - Drivers available: {len(drivers)}, Player car idx: {player_car_idx}")
    logger.info(f"🏁 Track: {track_name}, Car: {player_car}, Driver: {player_name}")

    # Get current session details
    current_session_num = safe_get(ir_data, 'SessionNum', 0)
    sessions = session_info.get('SessionInfo', {}).get('Sessions', []) if session_info else []
    current_session = sessions[current_session_num] if current_session_num < len(sessions) else {}

    if current_session:
        logger.info(f"🏁 Session Type: {current_session.get('SessionType', 'Unknown')}, Name: {current_session.get('SessionName', 'Unknown')}")

    # Log session flags for debugging
    session_flags = safe_get(ir_data, 'SessionFlags', 0)
    if session_flags > 0:
        logger.info(f"🚩 Session Flags: {session_flags} (binary: {bin(session_flags)})")

    # Extract opponent data from telemetry arrays
    opponents = []
    car_idx_position = safe_get(ir_data, 'CarIdxPosition', [])
    car_idx_lap = safe_get(ir_data, 'CarIdxLap', [])
    car_idx_lap_dist_pct = safe_get(ir_data, 'CarIdxLapDistPct', [])
    car_idx_best_lap_time = safe_get(ir_data, 'CarIdxBestLapTime', [])
    car_idx_last_lap_time = safe_get(ir_data, 'CarIdxLastLapTime', [])
    car_idx_track_surface = safe_get(ir_data, 'CarIdxTrackSurface', [])

    if car_idx_position and len(car_idx_position) > 0:
        valid_positions = [p for p in car_idx_position if p > 0]
        logger.info(f"🏁 Found {len(valid_positions)} cars with valid positions")

        for idx, position in enumerate(car_idx_position):
            # Skip invalid positions
            if position <= 0:
                continue

            # Skip player's own car for opponents list (but we'll add everyone)
            # Don't skip - include everyone for standings

            # Skip cars not on track
            track_surface = car_idx_track_surface[idx] if idx < len(car_idx_track_surface) else -1
            if track_surface < 0:
                continue

            # Get driver info
            driver = drivers[idx] if idx < len(drivers) else {}

            opponent_data = {
                'carIdx': idx,
                'position': position,
                'carNumber': driver.get('CarNumber', '?') if driver else '?',
                'driverName': driver.get('UserName', 'Unknown') if driver else 'Unknown',
                'teamName': driver.get('TeamName', '') if driver else '',
                'lap': car_idx_lap[idx] if idx < len(car_idx_lap) else 0,
                'lapDistPct': car_idx_lap_dist_pct[idx] if idx < len(car_idx_lap_dist_pct) else 0,
                'bestLapTime': car_idx_best_lap_time[idx] if idx < len(car_idx_best_lap_time) else 0,
                'lastLapTime': car_idx_last_lap_time[idx] if idx < len(car_idx_last_lap_time) else 0,
                'gapToPlayer': 0,  # Will be calculated on frontend
            }
            opponents.append(opponent_data)

        logger.info(f"🏁 Extracted {len(opponents)} opponents/drivers for standings")
    else:
        logger.warning(f"🏁 No position data available")

    return {
        'timestamp': int(datetime.now().timestamp() * 1000),
        'sessionTime': safe_get(ir_data, 'SessionTime', 0),

        'player': {
            'driverName': player_name,
            'carName': player_car,
            'speed': safe_get(ir_data, 'Speed', 0) * 3.6,  # m/s to km/h
            'rpm': safe_get(ir_data, 'RPM', 0),
            'gear': safe_get(ir_data, 'Gear', 0),
            'throttle': safe_get(ir_data, 'Throttle', 0),
            'brake': safe_get(ir_data, 'Brake', 0),
            'lap': safe_get(ir_data, 'Lap', 0),
            'lapDistPct': safe_get(ir_data, 'LapDistPct', 0),
            'currentLapTime': safe_get(ir_data, 'LapCurrentLapTime', 0),
            'lastLapTime': safe_get(ir_data, 'LapLastLapTime', 0),
            'bestLapTime': safe_get(ir_data, 'LapBestLapTime', 0),
            'position': safe_get(ir_data, 'Position', 0),
            'classPosition': safe_get(ir_data, 'ClassPosition', 0),
            'incidents': safe_get(ir_data, 'PlayerCarMyIncidentCount', 0),
            # Engine/Car Systems (available on most cars)
            'oilTemp': safe_get(ir_data, 'OilTemp', 0),
            'oilPress': safe_get(ir_data, 'OilPress', 0),
            'waterTemp': safe_get(ir_data, 'WaterTemp', 0),
            'waterLevel': safe_get(ir_data, 'WaterLevel', 0),
            'voltage': safe_get(ir_data, 'Voltage', 0),
            'engineWarnings': safe_get(ir_data, 'EngineWarnings', 0),
            'manifoldPress': safe_get(ir_data, 'ManifoldPress', 0),
            # Push2Pass (IndyCar/Open Wheeler series)
            'push2PassStatus': safe_get(ir_data, 'CarIdxP2P_Status', [])[player_car_idx] if player_car_idx < len(safe_get(ir_data, 'CarIdxP2P_Status', [])) else False,
            'push2PassCount': safe_get(ir_data, 'CarIdxP2P_Count', [])[player_car_idx] if player_car_idx < len(safe_get(ir_data, 'CarIdxP2P_Count', [])) else 0,
            # Brake bias
            'dcBrakePct': safe_get(ir_data, 'dcBrakeBias', 0),
            # Additional inputs
            'clutch': safe_get(ir_data, 'Clutch', 0),
        },

        'fuel': {
            'level': safe_get(ir_data, 'FuelLevel', 0),
            'levelPct': safe_get(ir_data, 'FuelLevelPct', 0) * 100 if safe_get(ir_data, 'FuelLevelPct') else 0,
            'usePerHour': safe_get(ir_data, 'FuelUsePerHour', 0),
            'lapsRemaining': 0,  # Calculated on frontend from level/consumption
        },

        'tires': {
            'lf': {
                'tempL': safe_get(ir_data, 'LFtempCL', 0),
                'tempM': safe_get(ir_data, 'LFtempCM', 0),
                'tempR': safe_get(ir_data, 'LFtempCR', 0),
                'wearL': safe_get(ir_data, 'LFwearL', 1.0),
                'wearM': safe_get(ir_data, 'LFwearM', 1.0),
                'wearR': safe_get(ir_data, 'LFwearR', 1.0),
                'pressure': safe_get(ir_data, 'LFpressure', 0),
                'avgTemp': (safe_get(ir_data, 'LFtempCL', 0) + safe_get(ir_data, 'LFtempCM', 0) + safe_get(ir_data, 'LFtempCR', 0)) / 3,
                'avgWear': (safe_get(ir_data, 'LFwearL', 1.0) + safe_get(ir_data, 'LFwearM', 1.0) + safe_get(ir_data, 'LFwearR', 1.0)) / 3,
            },
            'rf': {
                'tempL': safe_get(ir_data, 'RFtempCL', 0),
                'tempM': safe_get(ir_data, 'RFtempCM', 0),
                'tempR': safe_get(ir_data, 'RFtempCR', 0),
                'wearL': safe_get(ir_data, 'RFwearL', 1.0),
                'wearM': safe_get(ir_data, 'RFwearM', 1.0),
                'wearR': safe_get(ir_data, 'RFwearR', 1.0),
                'pressure': safe_get(ir_data, 'RFpressure', 0),
                'avgTemp': (safe_get(ir_data, 'RFtempCL', 0) + safe_get(ir_data, 'RFtempCM', 0) + safe_get(ir_data, 'RFtempCR', 0)) / 3,
                'avgWear': (safe_get(ir_data, 'RFwearL', 1.0) + safe_get(ir_data, 'RFwearM', 1.0) + safe_get(ir_data, 'RFwearR', 1.0)) / 3,
            },
            'lr': {
                'tempL': safe_get(ir_data, 'LRtempCL', 0),
                'tempM': safe_get(ir_data, 'LRtempCM', 0),
                'tempR': safe_get(ir_data, 'LRtempCR', 0),
                'wearL': safe_get(ir_data, 'LRwearL', 1.0),
                'wearM': safe_get(ir_data, 'LRwearM', 1.0),
                'wearR': safe_get(ir_data, 'LRwearR', 1.0),
                'pressure': safe_get(ir_data, 'LRpressure', 0),
                'avgTemp': (safe_get(ir_data, 'LRtempCL', 0) + safe_get(ir_data, 'LRtempCM', 0) + safe_get(ir_data, 'LRtempCR', 0)) / 3,
                'avgWear': (safe_get(ir_data, 'LRwearL', 1.0) + safe_get(ir_data, 'LRwearM', 1.0) + safe_get(ir_data, 'LRwearR', 1.0)) / 3,
            },
            'rr': {
                'tempL': safe_get(ir_data, 'RRtempCL', 0),
                'tempM': safe_get(ir_data, 'RRtempCM', 0),
                'tempR': safe_get(ir_data, 'RRtempCR', 0),
                'wearL': safe_get(ir_data, 'RRwearL', 1.0),
                'wearM': safe_get(ir_data, 'RRwearM', 1.0),
                'wearR': safe_get(ir_data, 'RRwearR', 1.0),
                'pressure': safe_get(ir_data, 'RRpressure', 0),
                'avgTemp': (safe_get(ir_data, 'RRtempCL', 0) + safe_get(ir_data, 'RRtempCM', 0) + safe_get(ir_data, 'RRtempCR', 0)) / 3,
                'avgWear': (safe_get(ir_data, 'RRwearL', 1.0) + safe_get(ir_data, 'RRwearM', 1.0) + safe_get(ir_data, 'RRwearR', 1.0)) / 3,
            },
        },

        'track': {
            'name': track_name,
            'temperature': safe_get(ir_data, 'TrackTemp', 20),
            'airTemp': safe_get(ir_data, 'AirTemp', 20),
            'windSpeed': safe_get(ir_data, 'WindVel', 0),
            'windDirection': safe_get(ir_data, 'WindDir', 0),
            'humidity': safe_get(ir_data, 'RelativeHumidity', 0.5) * 100,
        },

        'session': {
            'state': safe_get(ir_data, 'SessionState', 0),
            'flags': safe_get(ir_data, 'SessionFlags', 0),
            'timeRemaining': safe_get(ir_data, 'SessionTimeRemain', 0),
            'lapsRemaining': safe_get(ir_data, 'SessionLapsRemain', 0),
            'type': current_session.get('SessionType', 'Unknown'),
            'name': current_session.get('SessionName', 'Unknown'),
        },

        'damage': {
            # iRacing doesn't have per-corner damage, so we approximate from overall damage
            # Values should be 0.0 to 1.0
            'lf': min(safe_get(ir_data, 'CarLeftSide', 0) + safe_get(ir_data, 'CarFront', 0), 1.0) / 2,
            'rf': min(safe_get(ir_data, 'CarRightSide', 0) + safe_get(ir_data, 'CarFront', 0), 1.0) / 2,
            'lr': min(safe_get(ir_data, 'CarLeftSide', 0) + safe_get(ir_data, 'CarRear', 0), 1.0) / 2,
            'rr': min(safe_get(ir_data, 'CarRightSide', 0) + safe_get(ir_data, 'CarRear', 0), 1.0) / 2,
        },

        'opponents': opponents,
    }


def extract_session_data(session_info: Dict) -> Dict[str, Any]:
    """Extract useful racing data from SessionInfo"""
    try:
        # Get current session
        current_session_num = session_info.get('SessionNum', 0)
        sessions = session_info.get('SessionInfo', {}).get('Sessions', [])
        current_session = sessions[current_session_num] if current_session_num < len(sessions) else {}

        # Get driver info
        driver_info = session_info.get('DriverInfo', {})
        drivers = driver_info.get('Drivers', [])
        logger.info(f"📊 Found {len(drivers)} drivers in DriverInfo")

        # Find player
        player_car_idx = driver_info.get('DriverCarIdx', 0)

        # Get results - try both ResultsPositions and ResultsFastestLap
        results_positions = current_session.get('ResultsPositions', [])

        # If ResultsPositions is empty, build from driver list with positions from ResultsPositions or driver order
        driver_list = []

        if results_positions and len(results_positions) > 0:
            # Use ResultsPositions data
            logger.info(f"📊 Spectating: Found {len(results_positions)} entries in ResultsPositions")
            for result in results_positions:
                car_idx = result.get('CarIdx', -1)
                if car_idx >= 0 and car_idx < len(drivers):
                    driver = drivers[car_idx]
                    driver_list.append({
                        'carIdx': car_idx,
                        'isPlayer': car_idx == player_car_idx,
                        'driverName': driver.get('UserName', 'Unknown'),
                        'carNumber': driver.get('CarNumber', '?'),
                        'teamName': driver.get('TeamName', ''),
                        'position': result.get('Position', 0) + 1,  # Position is 0-indexed
                        'classPosition': result.get('ClassPosition', 0) + 1,
                        'lap': result.get('Lap', 0),
                        'lastLapTime': result.get('LastTime', 0),
                        'bestLapTime': result.get('BestTime', 0),
                        'lapsCompleted': result.get('LapsComplete', 0),
                        'lapsDriven': result.get('LapsDriven', 0),
                        'lapDistPct': 0,
                        'gapToPlayer': 0,
                    })
        else:
            # Fallback: use driver list directly
            logger.info(f"📊 Spectating: ResultsPositions empty, using driver list ({len(drivers)} drivers)")
            for idx, driver in enumerate(drivers):
                if driver.get('CarIsPaceCar', 0) == 1:
                    continue  # Skip pace car

                driver_list.append({
                    'carIdx': idx,
                    'isPlayer': idx == player_car_idx,
                    'driverName': driver.get('UserName', 'Unknown'),
                    'carNumber': driver.get('CarNumber', '?'),
                    'teamName': driver.get('TeamName', ''),
                    'position': idx + 1,  # Use index as position
                    'classPosition': idx + 1,
                    'lap': 0,
                    'lastLapTime': 0,
                    'bestLapTime': 0,
                    'lapsCompleted': 0,
                    'lapsDriven': 0,
                    'lapDistPct': 0,
                    'gapToPlayer': 0,
                })

        # Build simplified data
        session_data = {
            'timestamp': int(datetime.now().timestamp() * 1000),
            'mode': 'session_info',  # Indicate this is limited data

            'session': {
                'type': current_session.get('SessionType', 'Unknown'),
                'name': current_session.get('SessionName', 'Unknown'),
                'lapsRemaining': current_session.get('SessionLapsRemainEx', 0),
                'timeRemaining': current_session.get('SessionTimeRemain', 0),
                'state': 0,  # Not available in SessionInfo, use 0
                'flags': 0,  # Not available in SessionInfo, use 0
            },

            'drivers': driver_list,
        }

        logger.info(f"📊 Spectating: Sending {len(driver_list)} drivers to frontend")
        return session_data

    except Exception as e:
        logger.error(f"Error extracting session data: {e}")
        return {
            'timestamp': int(datetime.now().timestamp() * 1000),
            'mode': 'session_info',
            'error': str(e)
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
                'version': 'hybrid-1.0',
                'irsdkAvailable': IRSDK_AVAILABLE and ir is not None,
                'mode': current_mode
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
    """Main telemetry processing loop - hybrid mode"""
    global ir, current_mode

    ir = irsdk.IRSDK()
    was_connected = False
    last_session_info_update = 0

    logger.info("Telemetry loop started, waiting for iRacing...")

    while True:
        try:
            # Check if we need to startup
            if not ir.startup():
                if was_connected:
                    logger.warning("Disconnected from iRacing")
                    was_connected = False
                    current_mode = 'disconnected'
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

            # Freeze the buffer to get consistent data snapshot
            # Note: freeze_var_buffer_latest() returns None, not a boolean
            ir.freeze_var_buffer_latest()

            # Try to read telemetry data to determine if we're driving or spectating
            # When driving, telemetry variables like Speed, IsOnTrack will be available
            # When spectating, these may not be available
            try:
                is_on_track = ir['IsOnTrack']

                # Check if we have valid driving telemetry
                # IsOnTrack > 0 means we're actively driving/in session
                if is_on_track is not None and is_on_track > 0:
                    # DRIVING MODE - Full telemetry available!
                    if current_mode != 'driving':
                        current_mode = 'driving'
                        logger.info("🏎️  MODE: DRIVING - Full telemetry active")

                    telemetry = transform_full_telemetry(ir)
                    telemetry['mode'] = 'full_telemetry'

                    await broadcast({
                        'type': 'telemetry',
                        'data': telemetry,
                    })

                    # Run at 60Hz for full telemetry
                    await asyncio.sleep(1.0 / TELEMETRY_RATE)

                else:
                    # Not on track - use SessionInfo mode
                    raise ValueError("Not on track")

            except (KeyError, ValueError, TypeError):
                # SPECTATING MODE - Use SessionInfo (FALLBACK)
                # This happens when telemetry variables are not available
                if current_mode != 'spectating':
                    current_mode = 'spectating'
                    logger.info("👁️  MODE: SPECTATING - Using SessionInfo only")

                current_time = datetime.now().timestamp()

                # Update SessionInfo at slower rate (2Hz)
                if current_time - last_session_info_update > (1.0 / SESSIONINFO_RATE):
                    try:
                        session_info_yaml = ir['SessionInfo']
                        if session_info_yaml:
                            # Check if SessionInfo is already a dict or needs parsing
                            if isinstance(session_info_yaml, dict):
                                session_info = session_info_yaml
                            elif isinstance(session_info_yaml, str):
                                # Parse YAML string to dict
                                session_info = yaml.safe_load(session_info_yaml)
                            else:
                                logger.warning(f"📊 Unexpected SessionInfo type: {type(session_info_yaml)}")
                                continue

                            session_data = extract_session_data(session_info)

                            await broadcast({
                                'type': 'telemetry',
                                'data': session_data,
                            })

                            last_session_info_update = current_time
                        else:
                            logger.warning("📊 SessionInfo is empty")
                    except Exception as e:
                        logger.error(f"Error reading SessionInfo: {e}")
                        import traceback
                        logger.error(f"Traceback: {traceback.format_exc()}")

                await asyncio.sleep(0.5)

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
    print("=" * 60)
    print("[Relay] 🔄 HYBRID MODE Ready!")
    print("[Relay] - Driving: Full telemetry at 60Hz")
    print("[Relay] - Spectating: SessionInfo at 2Hz")
    print("=" * 60)
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
