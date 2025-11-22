#!/bin/bash
# iRacing Race Engineer Relay - Mac/Linux Launcher

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "================================================"
echo "iRacing Race Engineer - Relay Server v3.1"
echo "================================================"
echo ""
echo "Starting relay in MOCK mode (test data)..."
echo ""
echo "IMPORTANT:"
echo "  - Connects to: pitcrew-iracing.onrender.com (default)"
echo "  - You will be prompted for your racer name"
echo "  - Running in MOCK mode (generates test data)"
echo "  - For real iRacing data, use Windows version"
echo "  - Press Ctrl+C to stop"
echo "================================================"
echo ""

# Change to script directory
cd "$SCRIPT_DIR"

# Make executable if not already
chmod +x iRacing-Relay-v3.1

# Run the relay with mock mode (defaults to production server)
./iRacing-Relay-v3.1 --mock

echo ""
echo "Relay stopped."
