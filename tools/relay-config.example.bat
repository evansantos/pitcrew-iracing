@echo off
REM Example configuration for connecting to Render.com
REM Copy this file to relay-config.bat and update with your values

REM Set your API server details (Render.com)
set API_HOST=your-api.onrender.com
set API_PORT=443
set API_SECURE=true

REM Optional: Adjust telemetry rate if needed
set TELEMETRY_RATE=60

REM Run the relay
python windows-relay-server-socketio.py
