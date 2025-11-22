@echo off
REM iRacing Race Engineer Relay - Windows Launcher
REM Double-click this file to start the relay

echo ================================================
echo iRacing Race Engineer - Relay Server
echo ================================================
echo.
echo Starting relay connection to production server...
echo.
echo IMPORTANT:
echo   - This will connect to: pitcrew-iracing.onrender.com
echo   - Make sure iRacing is running or will be started soon
echo   - Leave this window open while racing
echo.
echo Press Ctrl+C to stop the relay
echo ================================================
echo.

REM Run the relay with production settings
iRacing-Relay-v3.0.exe --host pitcrew-iracing.onrender.com --port 443 --secure

echo.
echo Relay stopped. Press any key to close...
pause > nul
