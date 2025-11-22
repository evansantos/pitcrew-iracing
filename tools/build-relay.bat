@echo off
REM Build script for iRacing Relay Server Windows Executable
REM Run this on Windows to create a standalone .exe file

echo ================================================
echo iRacing Relay Server - Build Script
echo ================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11+ from https://www.python.org/
    pause
    exit /b 1
)

echo [1/4] Checking Python installation...
python --version

echo.
echo [2/4] Installing dependencies...
pip install pyirsdk python-socketio websocket-client pyinstaller

echo.
echo [3/4] Building executable with PyInstaller...
echo Default values (hardcoded in executable):
echo   - Host: pitcrew-iracing.onrender.com
echo   - Port: 443
echo   - Secure: Yes (HTTPS/WSS)
echo   - Rate: 16 Hz
echo.
pyinstaller --onefile ^
    --name "iRacing-Relay-v3.1" ^
    --icon=NONE ^
    --console ^
    --clean ^
    --noconfirm ^
    windows-relay-server-socketio.py

echo.
echo [4/4] Build complete!
echo.
echo ================================================
echo The executable is located at:
echo   dist\iRacing-Relay-v3.1.exe
echo ================================================
echo.
echo You can now copy this .exe file to any Windows machine
echo and run it without installing Python!
echo.
pause
