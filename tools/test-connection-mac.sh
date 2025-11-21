#!/bin/bash

# iRacing Remote Connection Diagnostic Script (macOS)
# Run this to test connectivity to your Windows relay server

set -e

echo "======================================"
echo "iRacing Remote Connection Test (macOS)"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get Windows IP from .env.local
WINDOWS_IP=""
if [ -f ".env.local" ]; then
    WINDOWS_IP=$(grep "IRACING_RELAY_HOST" .env.local | cut -d'=' -f2 | tr -d ' ')
    echo -e "${GREEN}[✓]${NC} Found .env.local"
    echo "    Windows IP: $WINDOWS_IP"
elif [ -f "apps/api/.env.local" ]; then
    WINDOWS_IP=$(grep "IRACING_RELAY_HOST" apps/api/.env.local | cut -d'=' -f2 | tr -d ' ')
    echo -e "${GREEN}[✓]${NC} Found apps/api/.env.local"
    echo "    Windows IP: $WINDOWS_IP"
else
    echo -e "${RED}[✗]${NC} .env.local not found!"
    echo ""
    read -p "Enter Windows PC IP address: " WINDOWS_IP
fi

if [ -z "$WINDOWS_IP" ]; then
    echo -e "${RED}[✗]${NC} No IP address provided!"
    exit 1
fi

echo ""
echo "Testing connection to: $WINDOWS_IP:3002"
echo "--------------------------------------"
echo ""

# Test 1: Ping
echo "[1/4] Testing network connectivity (ping)..."
if ping -c 3 -W 2 "$WINDOWS_IP" > /dev/null 2>&1; then
    PING_TIME=$(ping -c 1 "$WINDOWS_IP" | grep "time=" | awk -F'time=' '{print $2}' | awk '{print $1}')
    echo -e "${GREEN}[✓]${NC} Ping successful (${PING_TIME}ms)"
else
    echo -e "${RED}[✗]${NC} Ping failed - Windows PC unreachable"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if Windows PC is on"
    echo "  2. Ensure both machines on same WiFi/network"
    echo "  3. Check Windows Firewall allows ICMP (ping)"
    exit 1
fi

# Test 2: Port connectivity
echo ""
echo "[2/4] Testing port 3002 connectivity..."
if nc -z -w 2 "$WINDOWS_IP" 3002 > /dev/null 2>&1; then
    echo -e "${GREEN}[✓]${NC} Port 3002 is open and reachable"
else
    echo -e "${RED}[✗]${NC} Port 3002 is not accessible"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check Windows Firewall allows port 3002"
    echo "  2. Verify Python relay server is running on Windows"
    echo "  3. Run on Windows: python windows-relay-server.py"
    exit 1
fi

# Test 3: WebSocket handshake
echo ""
echo "[3/4] Testing WebSocket connection..."
TIMEOUT=5
WS_TEST=$(timeout $TIMEOUT node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://${WINDOWS_IP}:3002');

ws.on('open', () => {
    console.log('CONNECTED');
    ws.close();
    process.exit(0);
});

ws.on('error', (err) => {
    console.error('ERROR:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.error('TIMEOUT');
    process.exit(1);
}, ${TIMEOUT}000);
" 2>&1)

if echo "$WS_TEST" | grep -q "CONNECTED"; then
    echo -e "${GREEN}[✓]${NC} WebSocket connection successful"
else
    echo -e "${RED}[✗]${NC} WebSocket connection failed"
    echo "    Error: $WS_TEST"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Verify Python relay is running"
    echo "  2. Check for error messages in Windows terminal"
    echo "  3. Try restarting the relay server"
    exit 1
fi

# Test 4: Check .env.local configuration
echo ""
echo "[4/4] Checking .env.local configuration..."
ENV_MODE=$(grep "IRACING_MODE" .env.local 2>/dev/null || grep "IRACING_MODE" apps/api/.env.local 2>/dev/null || echo "")

if echo "$ENV_MODE" | grep -q "remote"; then
    echo -e "${GREEN}[✓]${NC} IRACING_MODE set to 'remote'"
else
    echo -e "${YELLOW}[!]${NC} IRACING_MODE not set to 'remote'"
    echo "    Current: $ENV_MODE"
    echo "    Update .env.local with: IRACING_MODE=remote"
fi

# Summary
echo ""
echo "======================================"
echo -e "${GREEN}All tests passed!${NC}"
echo "======================================"
echo ""
echo "Your setup is ready. To start:"
echo "  1. On Windows: python windows-relay-server.py"
echo "  2. Load iRacing into a session"
echo "  3. On Mac: pnpm dev"
echo ""
echo "Expected flow:"
echo "  iRacing → Python Relay → $WINDOWS_IP:3002 → macOS API"
echo ""
