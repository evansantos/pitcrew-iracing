"""
iRacing Telemetry Relay Server for Windows (Socket.IO Client Version)
VERSION: 3.1 - Multi-Racer Support with Production Defaults

This version connects to the central API server via Socket.IO and supports
multiple racers connecting simultaneously.

Run this on your Windows machine with iRacing installed.

Setup:
1. Install Python 3.11+ from https://www.python.org/
2. pip install pyirsdk python-socketio
3. Run the relay (connects to production by default):
   python windows-relay-server-socketio.py

Usage:
  python windows-relay-server-socketio.py [OPTIONS]

Options:
  --host HOST        API server hostname (default: pitcrew-iracing.onrender.com)
  --port PORT        API server port (default: 443)
  --secure           Use HTTPS/WSS (default: enabled)
  --no-secure        Disable HTTPS/WSS (for local development)
  --racer NAME       Your racer/driver name (prompts if not provided)
  --rate RATE        Telemetry update rate in Hz (default: 16)
  --mock             Use mock/test data instead of iRacing
  -h, --help         Show this help message

Environment Variables:
  API_HOST          API server hostname
  API_PORT          API server port
  API_SECURE        Use secure connection (default: true)
  RACER_NAME        Your racer/driver name
  TELEMETRY_RATE    Update rate in Hz

Examples:
  # Connect to production (default) - will prompt for racer name
  python windows-relay-server-socketio.py

  # Connect with racer name specified
  python windows-relay-server-socketio.py --racer "John Smith"

  # Connect to localhost for development
  python windows-relay-server-socketio.py --host localhost --port 3001 --no-secure

  # Using environment variables
  set RACER_NAME=John Smith
  python windows-relay-server-socketio.py
"""

import argparse
import logging
import os
import socket
import sys
import time
import threading
from datetime import datetime
from typing import Optional, Dict, Any

print("=" * 50)
print("iRacing Relay Server - Version 3.1")
print("Multi-Racer Support | Production Ready")
print("=" * 50)
print("")

# Check dependencies
try:
    import irsdk
    IRSDK_AVAILABLE = True
    print("[Relay] ✅ pyirsdk available")
except ImportError:
    IRSDK_AVAILABLE = False
    print("[Relay] ⚠️  pyirsdk not available")
    print("[Relay] Install with: pip install pyirsdk")

try:
    import socketio
    try:
        version = socketio.__version__
        print(f"[Relay] ✅ python-socketio version: {version}")
    except AttributeError:
        print("[Relay] ✅ python-socketio available")
except ImportError:
    print("[Relay] ❌ python-socketio package not found!")
    print("[Relay] Install with: pip install python-socketio")
    sys.exit(1)


def parse_arguments():
    """Parse command-line arguments"""
    parser = argparse.ArgumentParser(
        description='iRacing Telemetry Relay Server - Connects to Race Engineer API',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Connect to production server (default)
  python windows-relay-server-socketio.py

  # Connect to localhost (development)
  python windows-relay-server-socketio.py --host localhost --port 3001 --no-secure

  # Custom rate
  python windows-relay-server-socketio.py --rate 30
        '''
    )

    parser.add_argument(
        '--host',
        default=os.getenv('API_HOST', 'pitcrew-iracing.onrender.com'),
        help='API server hostname (default: pitcrew-iracing.onrender.com or $API_HOST)'
    )

    parser.add_argument(
        '--port',
        type=int,
        default=int(os.getenv('API_PORT', '443')),
        help='API server port (default: 443 or $API_PORT)'
    )

    parser.add_argument(
        '--secure',
        action='store_true',
        default=os.getenv('API_SECURE', 'true').lower() in ('true', '1', 'yes'),
        help='Use HTTPS/WSS instead of HTTP/WS (default: True)'
    )

    parser.add_argument(
        '--no-secure',
        action='store_true',
        help='Disable HTTPS/WSS (use for local development)'
    )

    parser.add_argument(
        '--rate',
        type=int,
        default=int(os.getenv('TELEMETRY_RATE', '16')),
        help='Telemetry update rate in Hz (default: 16 or $TELEMETRY_RATE)'
    )

    parser.add_argument(
        '--mock',
        action='store_true',
        help='Use mock/test mode - generate fake telemetry data for testing (useful on non-Windows systems)'
    )

    parser.add_argument(
        '--racer',
        type=str,
        default=os.getenv('RACER_NAME', ''),
        help='Racer/driver name for multi-user setups (will prompt if not provided)'
    )

    return parser.parse_args()


# Parse configuration from command-line arguments and environment variables
args = parse_arguments()
API_HOST = args.host
API_PORT = args.port
API_SECURE = args.secure and not args.no_secure  # --no-secure overrides --secure
TELEMETRY_RATE = args.rate
MOCK_MODE = args.mock
RACER_NAME = args.racer
UPDATE_INTERVAL = 1.0 / TELEMETRY_RATE  # Calculate interval

# Prompt for racer name if not provided
if not RACER_NAME:
    print("")
    print("=" * 50)
    print("Multi-Racer Setup")
    print("=" * 50)
    print("")
    print("Enter your racer/driver name to identify your telemetry data.")
    print("This allows multiple racers to connect simultaneously.")
    print("")
    try:
        RACER_NAME = input("Racer Name: ").strip()
        if not RACER_NAME:
            RACER_NAME = "Default Racer"
            print(f"No name provided, using: {RACER_NAME}")
    except (KeyboardInterrupt, EOFError):
        print("\nCancelled by user")
        sys.exit(0)
    print("")

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('iRacing-Relay')

# Socket.IO client
sio = socketio.Client(
    logger=False,
    engineio_logger=False,
    reconnection=True,
    reconnection_attempts=0,  # Infinite
    reconnection_delay=1,
    reconnection_delay_max=5,
)

# iRacing SDK instance
ir: Optional[Any] = None
is_connected_to_iracing = False
is_in_active_session = False

# Handshake tracking
handshake_complete = threading.Event()
handshake_error = None


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


def safe_get(ir_obj, key, default=None):
    """Safely get a value from IRSDK object (adds .get() support)"""
    try:
        return ir_obj[key]
    except (KeyError, TypeError):
        return default


def transform_telemetry(ir_data) -> Dict[str, Any]:
    """Transform iRacing SDK data to our application format"""
    # Handle nested DriverInfo
    driver_info = safe_get(ir_data, 'DriverInfo', {})
    driver_name = driver_info.get('DriverUserName', 'Unknown') if isinstance(driver_info, dict) else 'Unknown'

    # Handle nested WeekendInfo
    weekend_info = safe_get(ir_data, 'WeekendInfo', {})
    track_name = weekend_info.get('TrackDisplayName', 'Unknown Track') if isinstance(weekend_info, dict) else 'Unknown Track'

    # Handle nested SessionInfo
    session_info = safe_get(ir_data, 'SessionInfo', {})
    if isinstance(session_info, dict):
        sessions = session_info.get('Sessions', [{}])
        session_type = sessions[0].get('SessionType', 'Unknown') if sessions else 'Unknown'
    else:
        session_type = 'Unknown'

    fuel_level_pct = safe_get(ir_data, 'FuelLevelPct', 0)

    return {
        'timestamp': int(datetime.now().timestamp() * 1000),
        'sessionTime': safe_get(ir_data, 'SessionTime', 0),

        'player': {
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
            'carName': safe_get(ir_data, 'PlayerCarClassShortName', 'Unknown'),
            'driverName': driver_name,
        },

        'fuel': {
            'level': safe_get(ir_data, 'FuelLevel', 0),
            'levelPct': fuel_level_pct * 100 if fuel_level_pct else 0,
            'usePerHour': safe_get(ir_data, 'FuelUsePerHour', 0),
            'lapsRemaining': int((safe_get(ir_data, 'FuelLevel', 0) or 0) / ((safe_get(ir_data, 'FuelUsePerHour', 1) or 1) / 60)),
        },

        'tires': {
            'lf': {
                'avgTemp': safe_get(ir_data, 'LFtempCM', 0),
                'avgWear': safe_get(ir_data, 'LFwearM', 0),
                'pressure': safe_get(ir_data, 'LFpressure', 0),
            },
            'rf': {
                'avgTemp': safe_get(ir_data, 'RFtempCM', 0),
                'avgWear': safe_get(ir_data, 'RFwearM', 0),
                'pressure': safe_get(ir_data, 'RFpressure', 0),
            },
            'lr': {
                'avgTemp': safe_get(ir_data, 'LRtempCM', 0),
                'avgWear': safe_get(ir_data, 'LRwearM', 0),
                'pressure': safe_get(ir_data, 'LRpressure', 0),
            },
            'rr': {
                'avgTemp': safe_get(ir_data, 'RRtempCM', 0),
                'avgWear': safe_get(ir_data, 'RRwearM', 0),
                'pressure': safe_get(ir_data, 'RRpressure', 0),
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
            'type': session_type,
            'state': safe_get(ir_data, 'SessionState', 0),
            'flags': safe_get(ir_data, 'SessionFlags', 0),
            'timeRemaining': safe_get(ir_data, 'SessionTimeRemain', 0),
            'lapsRemaining': safe_get(ir_data, 'SessionLapsRemain', 0),
        },
    }


# Socket.IO event handlers
@sio.event
def connect():
    global handshake_error
    logger.info("✅ Connected to API server")
    # Reset handshake state
    handshake_complete.clear()
    handshake_error = None
    # Identify as relay with racer name
    sio.emit('identify', {
        'type': 'relay',
        'version': '3.1',
        'racerName': RACER_NAME,
        'mock': MOCK_MODE
    })


@sio.event
def connect_error(data):
    global handshake_error
    handshake_error = str(data)
    logger.error(f"❌ Connection error: {data}")
    handshake_complete.set()  # Signal failure


@sio.event
def disconnect():
    logger.warning("⚠️  Disconnected from API server")
    handshake_complete.clear()


@sio.on('identify:ack')
def on_identify_ack(data):
    logger.info(f"✅ Relay identified: {data.get('message', 'OK')}")
    logger.info(f"✅ Handshake successful - ready to send telemetry")
    handshake_complete.set()  # Signal success


def generate_mock_telemetry() -> Dict[str, Any]:
    """Generate realistic mock telemetry data for testing"""
    import random
    import math

    # Simulate a race lap progression
    current_time = time.time()
    lap_time = 90.0  # 90 second lap
    lap_progress = (current_time % lap_time) / lap_time

    # Simulate speed varying through corners (80-250 km/h)
    speed_variation = math.sin(lap_progress * math.pi * 4) * 0.3 + 0.7
    speed = 120 + (130 * speed_variation) + random.uniform(-5, 5)

    # Simulate RPM based on speed
    rpm = int(2000 + (speed * 40) + random.uniform(-100, 100))

    # Simulate gear changes
    if speed < 80:
        gear = 2
    elif speed < 120:
        gear = 3
    elif speed < 160:
        gear = 4
    elif speed < 200:
        gear = 5
    else:
        gear = 6

    # Simulate throttle and brake (inversely correlated)
    throttle = max(0, min(1, speed_variation + random.uniform(-0.1, 0.1)))
    brake = max(0, min(1, (1 - speed_variation - 0.5) * 2 + random.uniform(-0.1, 0.1)))

    # Simulate fuel consumption
    lap_num = int(current_time / lap_time) % 50
    fuel_level = 50.0 - (lap_num * 1.2)

    # Simulate tire temps increasing with laps
    tire_temp_base = 70 + (lap_num * 2)

    return {
        'timestamp': int(datetime.now().timestamp() * 1000),
        'sessionTime': current_time % 3600,

        'player': {
            'speed': round(speed, 1),
            'rpm': rpm,
            'gear': gear,
            'throttle': round(throttle, 3),
            'brake': round(brake, 3),
            'lap': lap_num + 1,
            'lapDistPct': round(lap_progress, 4),
            'currentLapTime': round((current_time % lap_time), 3),
            'lastLapTime': round(lap_time + random.uniform(-2, 2), 3),
            'bestLapTime': round(lap_time - 3.5, 3),
            'position': 5,
            'classPosition': 3,
            'carName': 'Test Car GT3',
            'driverName': 'Mock Driver',
        },

        'fuel': {
            'level': round(max(0, fuel_level), 2),
            'levelPct': round(max(0, fuel_level / 50 * 100), 1),
            'usePerHour': 18.5,
            'lapsRemaining': int(max(0, fuel_level / 1.2)),
        },

        'tires': {
            'lf': {
                'avgTemp': round(tire_temp_base + random.uniform(-2, 2), 1),
                'avgWear': round(0.1 + (lap_num * 0.02), 3),
                'pressure': round(26.5 + random.uniform(-0.2, 0.2), 1),
            },
            'rf': {
                'avgTemp': round(tire_temp_base + random.uniform(-2, 2), 1),
                'avgWear': round(0.1 + (lap_num * 0.02), 3),
                'pressure': round(26.5 + random.uniform(-0.2, 0.2), 1),
            },
            'lr': {
                'avgTemp': round(tire_temp_base - 5 + random.uniform(-2, 2), 1),
                'avgWear': round(0.1 + (lap_num * 0.015), 3),
                'pressure': round(26.0 + random.uniform(-0.2, 0.2), 1),
            },
            'rr': {
                'avgTemp': round(tire_temp_base - 5 + random.uniform(-2, 2), 1),
                'avgWear': round(0.1 + (lap_num * 0.015), 3),
                'pressure': round(26.0 + random.uniform(-0.2, 0.2), 1),
            },
        },

        'track': {
            'name': 'Test Track (Mock)',
            'temperature': round(25 + random.uniform(-1, 1), 1),
            'airTemp': round(22 + random.uniform(-1, 1), 1),
            'windSpeed': round(5 + random.uniform(-2, 2), 1),
            'windDirection': round(random.uniform(0, 360), 0),
            'humidity': round(45 + random.uniform(-5, 5), 1),
        },

        'session': {
            'type': 'Race',
            'state': 4,  # Racing
            'flags': 0x00000001,  # Green flag
            'timeRemaining': 3600 - (current_time % 3600),
            'lapsRemaining': 50 - lap_num,
        },
    }


def mock_telemetry_loop():
    """Mock telemetry loop for testing without iRacing"""
    logger.info("🧪 Mock mode enabled - generating test telemetry data")
    logger.info("Waiting for API server connection...")

    while True:
        try:
            # Check if Socket.IO is connected
            if not sio.connected:
                time.sleep(1)
                continue

            # Generate and send mock telemetry
            telemetry = generate_mock_telemetry()

            # Log human-friendly telemetry info
            player = telemetry.get('player', {})
            session = telemetry.get('session', {})
            logger.info(
                f"📊 [{RACER_NAME}] Lap {player.get('lap', 0)} | "
                f"Speed: {round(player.get('speed', 0))} km/h | "
                f"Gear: {player.get('gear', 0)} | "
                f"Fuel: {player.get('fuelLevel', 0):.1f}L | "
                f"Position: {session.get('position', 'N/A')}/{session.get('totalDrivers', 'N/A')}"
            )

            sio.emit('relay:telemetry', {
                'racerName': RACER_NAME,
                'telemetry': telemetry
            })

            # Send session state
            sio.emit('relay:session', {'state': 'connected', 'mock': True, 'racerName': RACER_NAME})

            # Run at configured rate
            time.sleep(UPDATE_INTERVAL)

        except KeyboardInterrupt:
            logger.info("Shutting down...")
            break
        except Exception as e:
            logger.error(f"Mock telemetry loop error: {e}")
            time.sleep(1)


def telemetry_loop():
    """Main telemetry processing loop"""
    global ir, is_connected_to_iracing, is_in_active_session

    if not IRSDK_AVAILABLE:
        logger.warning("pyirsdk not available - telemetry loop will not run")
        return

    ir = irsdk.IRSDK()
    logger.info("Telemetry loop started, waiting for iRacing...")

    while True:
        try:
            # Check if Socket.IO is connected
            if not sio.connected:
                time.sleep(1)
                continue

            # Check if we need to startup
            if not ir.startup():
                if is_connected_to_iracing:
                    logger.warning("Disconnected from iRacing")
                    is_connected_to_iracing = False
                    is_in_active_session = False
                    sio.emit('relay:session', {'state': 'disconnected', 'racerName': RACER_NAME})
                time.sleep(1)
                continue

            # Connected to iRacing
            if not is_connected_to_iracing:
                logger.info("✅ Connected to iRacing!")
                is_connected_to_iracing = True
                sio.emit('relay:session', {'state': 'connected', 'racerName': RACER_NAME})

            # Try to get telemetry data - freeze_var_buffer_latest() may return False
            # if no new data, but we still want to send data if we're in an active session
            try:
                # Always call freeze to get latest buffer (ignore return value)
                ir.freeze_var_buffer_latest()

                # Try to access a session field to verify we have valid data
                # This will raise an exception if not in a session
                session_num = ir['SessionNum']

                # If we got here, we have valid session data
                if not is_in_active_session:
                    logger.info("🏁 Active session detected - telemetry data flowing!")
                    is_in_active_session = True

                # Get all telemetry data
                telemetry = transform_telemetry(ir)

                # Log human-friendly telemetry info
                player = telemetry.get('player', {})
                fuel = telemetry.get('fuel', {})
                logger.info(
                    f"📊 [{RACER_NAME}] Lap {player.get('lap', 0)} | "
                    f"Speed: {round(player.get('speed', 0))} km/h | "
                    f"Gear: {player.get('gear', 0)} | "
                    f"Fuel: {fuel.get('level', 0):.1f}L | "
                    f"Position: {player.get('position', 'N/A')}"
                )

                # Send to API server with racer info
                sio.emit('relay:telemetry', {
                    'racerName': RACER_NAME,
                    'telemetry': telemetry
                })

            except (KeyError, TypeError, AttributeError) as e:
                # No valid session data available (in menu, loading, etc.)
                if is_in_active_session:
                    logger.info("⏸️  Session paused or in menu - waiting for active session...")
                    is_in_active_session = False

            # Run at configured rate
            time.sleep(UPDATE_INTERVAL)

        except KeyboardInterrupt:
            logger.info("Shutting down...")
            break
        except Exception as e:
            logger.error(f"Telemetry loop error: {e}")
            time.sleep(1)

    # Shutdown
    if ir:
        ir.shutdown()


def main():
    """Main entry point"""
    local_ip = get_local_ip()

    # Build API URL based on secure flag
    protocol = 'https' if API_SECURE else 'http'
    # Don't include port if it's the standard port for the protocol
    if (API_SECURE and API_PORT == 443) or (not API_SECURE and API_PORT == 80):
        api_url = f"{protocol}://{API_HOST}"
    else:
        api_url = f"{protocol}://{API_HOST}:{API_PORT}"

    print("")
    print("=" * 50)
    print("[Relay] Configuration:")
    print(f"[Relay]   Racer: {RACER_NAME}")
    print(f"[Relay]   Local IP: {local_ip}")
    print(f"[Relay]   API Server: {api_url}")
    print(f"[Relay]   Secure: {'Yes (HTTPS/WSS)' if API_SECURE else 'No (HTTP/WS)'}")
    print(f"[Relay]   Telemetry Rate: {TELEMETRY_RATE} Hz")
    print(f"[Relay]   Mode: {'🧪 MOCK (Test Data)' if MOCK_MODE else '🏁 LIVE (iRacing)'}")
    print("=" * 50)
    print("")

    if not IRSDK_AVAILABLE:
        print("[Relay] ⚠️  WARNING: pyirsdk not available!")
        print("[Relay] Please install: pip install pyirsdk")
        print("")

    logger.info(f"Connecting to API server at {api_url}...")

    try:
        # Connect to API server
        # Socket.IO will automatically use wss:// for https:// URLs
        sio.connect(api_url, transports=['websocket', 'polling'])

        # Wait for handshake to complete with timeout
        logger.info("Waiting for handshake with API server...")
        handshake_timeout = 10  # seconds
        if not handshake_complete.wait(timeout=handshake_timeout):
            # Handshake timed out
            logger.error("=" * 50)
            logger.error("❌ HANDSHAKE TIMEOUT")
            logger.error("=" * 50)
            logger.error("The relay connected to the server but did not receive")
            logger.error("a handshake acknowledgment within 10 seconds.")
            logger.error("")
            logger.error("Possible causes:")
            logger.error("  1. API server is not responding properly")
            logger.error("  2. Network issues or firewall blocking")
            logger.error("  3. API server is still starting up (try again in a minute)")
            logger.error("")
            logger.error("Please check:")
            logger.error(f"  - API server status at: {api_url}/health")
            logger.error("  - Your network connection")
            logger.error("  - Firewall settings")
            logger.error("=" * 50)
            sio.disconnect()
            sys.exit(1)

        # Check if handshake failed with an error
        if handshake_error:
            logger.error("=" * 50)
            logger.error("❌ HANDSHAKE FAILED")
            logger.error("=" * 50)
            logger.error(f"Error: {handshake_error}")
            logger.error("")
            logger.error("The relay could not establish a connection with the API server.")
            logger.error("")
            logger.error("Please check:")
            logger.error(f"  - API server is running at: {api_url}")
            logger.error("  - Your internet connection")
            logger.error("  - The API server logs for more details")
            logger.error("=" * 50)
            sio.disconnect()
            sys.exit(1)

        # Handshake successful - start telemetry loop
        if MOCK_MODE:
            mock_telemetry_loop()
        else:
            telemetry_loop()

    except KeyboardInterrupt:
        logger.info("Shutdown requested")
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        if is_connected_to_iracing:
            sio.emit('relay:session', {'state': 'server_shutdown'})

        if sio.connected:
            sio.disconnect()

        logger.info("Relay stopped")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\nShutdown complete")
