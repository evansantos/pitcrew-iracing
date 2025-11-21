@echo off
REM Quick start script for connecting to Pitcrew iRacing on Render.com

echo ================================================
echo iRacing Relay - Connecting to Pitcrew
echo ================================================
echo.

REM ============================================
REM CONFIGURATION - Already set for Pitcrew!
REM ============================================
set API_HOST=pitcrew-iracing.onrender.com
set API_PORT=443
REM ============================================

echo Configuration:
echo   API Host: %API_HOST%
echo   API Port: %API_PORT%
echo   Secure: Yes (HTTPS/WSS)
echo.
echo Starting relay...
echo.

REM Run the relay with secure connection
python windows-relay-server-socketio.py --host %API_HOST% --port %API_PORT% --secure

pause
