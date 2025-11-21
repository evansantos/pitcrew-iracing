#!/bin/bash
# Example configuration for connecting to Render.com
# Copy this file to relay-config.sh and update with your values

# Set your API server details (Render.com)
export API_HOST=your-api.onrender.com
export API_PORT=443
export API_SECURE=true

# Optional: Adjust telemetry rate if needed
export TELEMETRY_RATE=60

# Run the relay
python3 windows-relay-server-socketio.py
