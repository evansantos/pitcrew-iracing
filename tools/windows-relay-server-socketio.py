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
            'carName': ir_data.get('PlayerCarClassShortName', 'Unknown'),
            'driverName': ir_data.get('DriverInfo', {}).get('DriverUserName', 'Unknown'),
        },

        'fuel': {
            'level': ir_data.get('FuelLevel', 0),
            'levelPct': ir_data.get('FuelLevelPct', 0) * 100 if ir_data.get('FuelLevelPct') else 0,
            'usePerHour': ir_data.get('FuelUsePerHour', 0),
            'lapsRemaining': int((ir_data.get('FuelLevel', 0) or 0) / ((ir_data.get('FuelUsePerHour', 1) or 1) / 60)),
        },

        'tires': {
            'lf': {
                'avgTemp': ir_data.get('LFtempCM', 0),
                'avgWear': ir_data.get('LFwearM', 0),
                'pressure': ir_data.get('LFpressure', 0),
            },
            'rf': {
                'avgTemp': ir_data.get('RFtempCM', 0),
                'avgWear': ir_data.get('RFwearM', 0),
                'pressure': ir_data.get('RFpressure', 0),
            },
            'lr': {
                'avgTemp': ir_data.get('LRtempCM', 0),
                'avgWear': ir_data.get('LRwearM', 0),
                'pressure': ir_data.get('LRpressure', 0),
            },
            'rr': {
                'avgTemp': ir_data.get('RRtempCM', 0),
                'avgWear': ir_data.get('RRwearM', 0),
                'pressure': ir_data.get('RRpressure', 0),
            },
        },

        'track': {
            'name': ir_data.get('WeekendInfo', {}).get('TrackDisplayName', 'Unknown Track'),
            'temperature': ir_data.get('TrackTemp', 20),
            'airTemp': ir_data.get('AirTemp', 20),
            'windSpeed': ir_data.get('WindVel', 0),
            'windDirection': ir_data.get('WindDir', 0),
            'humidity': ir_data.get('RelativeHumidity', 0.5) * 100,
        },

        'session': {
            'type': ir_data.get('SessionInfo', {}).get('Sessions', [{}])[0].get('SessionType', 'Unknown'),
            'state': ir_data.get('SessionState', 0),
            'flags': ir_data.get('SessionFlags', 0),
            'timeRemaining': ir_data.get('SessionTimeRemain', 0),
            'lapsRemaining': ir_data.get('SessionLapsRemain', 0),
        },
    }


# Socket.IO event handlers
@sio.event
def connect():
    logger.info("✅ Connected to API server")
    # Identify as relay with racer name
    sio.emit('identify', {
        'type': 'relay',
        'version': '3.1',
        'racerName': RACER_NAME,
        'mock': MOCK_MODE
    })


@sio.event
def connect_error(data):
    logger.error(f"❌ Connection error: {data}")


@sio.event
def disconnect():
    logger.warning("⚠️  Disconnected from API server")


@sio.on('identify:ack')
def on_identify_ack(data):
    logger.info(f"✅ Relay identified: {data.get('message', 'OK')}")


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
    global ir, is_connected_to_iracing

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
                    sio.emit('relay:session', {'state': 'disconnected'})
                time.sleep(1)
                continue

            # Connected to iRacing
            if not is_connected_to_iracing:
                logger.info("✅ Connected to iRacing!")
                is_connected_to_iracing = True
                sio.emit('relay:session', {'state': 'connected'})

            # Freeze data to prevent changes during read
            if ir.freeze_var_buffer_latest():
                # Get all telemetry data
                telemetry = transform_telemetry(ir)

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

                # Send to API server with racer info
                sio.emit('relay:telemetry', {
                    'racerName': RACER_NAME,
                    'telemetry': telemetry
                })

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

        # Start telemetry loop in main thread
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
