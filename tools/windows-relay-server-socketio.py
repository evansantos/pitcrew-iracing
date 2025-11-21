"""
iRacing Telemetry Relay Server for Windows (Socket.IO Client Version)
VERSION: 3.0 - Connects to API as Socket.IO client

This version connects to the central API server via Socket.IO instead of
running as a standalone WebSocket server.

Run this on your Windows machine with iRacing installed.

Setup:
1. Install Python 3.11+ from https://www.python.org/
2. pip install pyirsdk python-socketio
3. Run with your API server URL:
   python windows-relay-server-socketio.py --host your-api.onrender.com --port 443 --secure

Usage:
  python windows-relay-server-socketio.py [OPTIONS]

Options:
  --host HOST        API server hostname (default: localhost)
  --port PORT        API server port (default: 3001)
  --secure           Use HTTPS/WSS instead of HTTP/WS
  --rate RATE        Telemetry update rate in Hz (default: 60)
  -h, --help         Show this help message

Environment Variables:
  API_HOST          API server hostname
  API_PORT          API server port
  API_SECURE        Use secure connection (true/false)
  TELEMETRY_RATE    Update rate in Hz

Examples:
  # Connect to localhost (development)
  python windows-relay-server-socketio.py

  # Connect to Render.com (production)
  python windows-relay-server-socketio.py --host your-api.onrender.com --port 443 --secure

  # Using environment variables
  set API_HOST=your-api.onrender.com
  set API_PORT=443
  set API_SECURE=true
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
print("iRacing Relay Server - Version 3.0")
print("Socket.IO Client Mode")
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
    print(f"[Relay] ✅ python-socketio version: {socketio.__version__}")
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
  # Connect to localhost (development)
  python windows-relay-server-socketio.py

  # Connect to Render.com (production)
  python windows-relay-server-socketio.py --host your-api.onrender.com --port 443 --secure

  # Custom rate
  python windows-relay-server-socketio.py --host api.example.com --rate 30
        '''
    )

    parser.add_argument(
        '--host',
        default=os.getenv('API_HOST', 'localhost'),
        help='API server hostname (default: localhost or $API_HOST)'
    )

    parser.add_argument(
        '--port',
        type=int,
        default=int(os.getenv('API_PORT', '3001')),
        help='API server port (default: 3001 or $API_PORT)'
    )

    parser.add_argument(
        '--secure',
        action='store_true',
        default=os.getenv('API_SECURE', '').lower() in ('true', '1', 'yes'),
        help='Use HTTPS/WSS instead of HTTP/WS'
    )

    parser.add_argument(
        '--rate',
        type=int,
        default=int(os.getenv('TELEMETRY_RATE', '60')),
        help='Telemetry update rate in Hz (default: 60 or $TELEMETRY_RATE)'
    )

    return parser.parse_args()


# Parse configuration from command-line arguments and environment variables
args = parse_arguments()
API_HOST = args.host
API_PORT = args.port
API_SECURE = args.secure
TELEMETRY_RATE = args.rate
UPDATE_INTERVAL = 1.0 / TELEMETRY_RATE  # Calculate interval

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
    # Identify as relay
    sio.emit('identify', {'type': 'relay', 'version': '3.0'})


@sio.event
def connect_error(data):
    logger.error(f"❌ Connection error: {data}")


@sio.event
def disconnect():
    logger.warning("⚠️  Disconnected from API server")


@sio.on('identify:ack')
def on_identify_ack(data):
    logger.info(f"✅ Relay identified: {data.get('message', 'OK')}")


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

                # Send to API server
                sio.emit('relay:telemetry', telemetry)

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
    api_url = f"{protocol}://{API_HOST}:{API_PORT}"

    print("")
    print("=" * 50)
    print("[Relay] Configuration:")
    print(f"[Relay]   Local IP: {local_ip}")
    print(f"[Relay]   API Server: {api_url}")
    print(f"[Relay]   Secure: {'Yes (HTTPS/WSS)' if API_SECURE else 'No (HTTP/WS)'}")
    print(f"[Relay]   Telemetry Rate: {TELEMETRY_RATE} Hz")
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
