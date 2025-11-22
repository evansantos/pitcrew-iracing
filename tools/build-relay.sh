#!/bin/bash
# Build script for iRacing Relay Server Windows Executable
# This uses PyInstaller to create a cross-platform build

echo "================================================"
echo "iRacing Relay Server - Build Script"
echo "================================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.11+ from https://www.python.org/"
    exit 1
fi

echo "[1/4] Checking Python installation..."
python3 --version

echo ""
echo "[2/4] Installing dependencies..."
pip3 install pyirsdk python-socketio websocket-client pyinstaller

echo ""
echo "[3/4] Building executable with PyInstaller..."
pyinstaller --onefile \
    --name "iRacing-Relay-v3.0" \
    --console \
    --clean \
    --noconfirm \
    windows-relay-server-socketio.py

echo ""
echo "[4/4] Build complete!"
echo ""
echo "================================================"
echo "The executable is located at:"
echo "  dist/iRacing-Relay-v3.0.exe (Windows)"
echo "  dist/iRacing-Relay-v3.0 (Mac/Linux)"
echo "================================================"
echo ""
echo "You can now copy this file to any machine"
echo "and run it without installing Python!"
echo ""
