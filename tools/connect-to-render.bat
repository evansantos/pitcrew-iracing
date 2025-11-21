@echo off
REM Quick start script for connecting to Render.com
REM Edit the variables below to match your Render.com deployment

echo ================================================
echo iRacing Relay - Connecting to Render.com
echo ================================================
echo.

REM ============================================
REM CONFIGURATION - UPDATE THESE VALUES
REM ============================================
set API_HOST=your-api.onrender.com
set API_PORT=443
REM ============================================

echo Configuration:
echo   API Host: %API_HOST%
echo   API Port: %API_PORT%
echo   Secure: Yes (HTTPS/WSS)
echo.
echo Press Ctrl+C to cancel, or
pause

REM Run the relay with secure connection
python windows-relay-server-socketio.py --host %API_HOST% --port %API_PORT% --secure

pause
