#!/bin/bash
# iRacing Race Engineer Relay - Mac/Linux Launcher

echo "================================================"
echo "iRacing Race Engineer - Relay Server"
echo "================================================"
echo ""
echo "Starting relay in MOCK mode (test data)..."
echo ""
echo "IMPORTANT:"
echo "  - This will connect to: pitcrew-iracing.onrender.com"
echo "  - Running in MOCK mode (generates test data)"
echo "  - For real iRacing data, use Windows version"
echo "  - Press Ctrl+C to stop"
echo "================================================"
echo ""

# Make executable if not already
chmod +x iRacing-Relay-v3.0

# Run the relay with mock mode
./iRacing-Relay-v3.0 --host pitcrew-iracing.onrender.com --port 443 --secure --mock

echo ""
echo "Relay stopped."
