@echo off
REM iRacing Race Engineer Relay - Windows Launcher
REM Double-click this file to start the relay

echo ================================================
echo iRacing Race Engineer - Relay Server v3.1
echo ================================================
echo.
echo Starting relay connection to production server...
echo.
echo IMPORTANT:
echo   - Connects to: pitcrew-iracing.onrender.com (default)
echo   - You will be prompted for your racer name
echo   - Make sure iRacing is running or will be started soon
echo   - Leave this window open while racing
echo.
echo Press Ctrl+C to stop the relay
echo ================================================
echo.

REM Run the relay (defaults to production server)
iRacing-Relay-v3.1.exe

echo.
echo Relay stopped. Press any key to close...
pause > nul
