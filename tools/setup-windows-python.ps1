# iRacing Relay Server Setup Script for Windows (Python Version)
# Run this with PowerShell as Administrator

Write-Host "================================" -ForegroundColor Cyan
Write-Host "iRacing Relay Server Setup (Python)" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Please run this script as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit
}

# Check for Python
Write-Host "[1/5] Checking for Python 3.11...  " -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python 3\.11") {
        Write-Host "  Python 3.11 found: $pythonVersion" -ForegroundColor Green
    } else {
        Write-Host "  Python found but not version 3.11: $pythonVersion" -ForegroundColor Yellow
        Write-Host "  Recommended: Python 3.11" -ForegroundColor Yellow
        Write-Host "  Download from: https://www.python.org/downloads/" -ForegroundColor Cyan
        $continue = Read-Host "Continue anyway? (y/n)"
        if ($continue -ne "y") {
            exit
        }
    }
} catch {
    Write-Host "  Python NOT found!" -ForegroundColor Red
    Write-Host "  Please download and install Python 3.11 from:" -ForegroundColor Yellow
    Write-Host "  https://www.python.org/downloads/" -ForegroundColor Cyan
    Write-Host "  Make sure to check 'Add Python to PATH' during installation!" -ForegroundColor Yellow
    Start-Process "https://www.python.org/downloads/"
    pause
    exit
}

# Get Windows IP Address
Write-Host ""
Write-Host "[2/5] Finding your IP address..." -ForegroundColor Yellow
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*"} | Select-Object -First 1).IPAddress
if ($ipAddress) {
    Write-Host "  Your IP Address: $ipAddress" -ForegroundColor Green
    Write-Host "  (Use this on your Mac!)" -ForegroundColor Cyan
} else {
    Write-Host "  Could not detect IP automatically" -ForegroundColor Yellow
    Write-Host "  Run 'ipconfig' manually to find it" -ForegroundColor Yellow
}

# Create relay directory
Write-Host ""
Write-Host "[3/5] Creating relay directory..." -ForegroundColor Yellow
$relayPath = "C:\iRacing-Relay-Python"
if (Test-Path $relayPath) {
    Write-Host "  Directory already exists: $relayPath" -ForegroundColor Green
} else {
    New-Item -ItemType Directory -Path $relayPath | Out-Null
    Write-Host "  Created: $relayPath" -ForegroundColor Green
}

# Copy relay server files
Write-Host ""
Write-Host "[4/5] Looking for relay server files..." -ForegroundColor Yellow
$currentPath = Get-Location

# Copy Python server
$sourceFile = Join-Path $currentPath "windows-relay-server.py"
$destFile = Join-Path $relayPath "windows-relay-server.py"
if (Test-Path $sourceFile) {
    Copy-Item $sourceFile $destFile -Force
    Write-Host "  Copied windows-relay-server.py" -ForegroundColor Green
} else {
    Write-Host "  windows-relay-server.py not found!" -ForegroundColor Red
    Write-Host "  Please copy it manually to $relayPath" -ForegroundColor Yellow
}

# Copy requirements.txt
$sourceReq = Join-Path $currentPath "requirements.txt"
$destReq = Join-Path $relayPath "requirements.txt"
if (Test-Path $sourceReq) {
    Copy-Item $sourceReq $destReq -Force
    Write-Host "  Copied requirements.txt" -ForegroundColor Green
} else {
    Write-Host "  requirements.txt not found!" -ForegroundColor Red
}

# Configure Windows Firewall
Write-Host ""
Write-Host "[5/5] Configuring Windows Firewall..." -ForegroundColor Yellow
try {
    # Check if rule already exists
    $existingRule = Get-NetFirewallRule -DisplayName "iRacing Relay Server (Python)" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "  Firewall rule already exists" -ForegroundColor Green
    } else {
        New-NetFirewallRule -DisplayName "iRacing Relay Server (Python)" -Direction Inbound -Protocol TCP -LocalPort 3002 -Action Allow | Out-Null
        Write-Host "  Firewall rule created for port 3002" -ForegroundColor Green
    }
} catch {
    Write-Host "  Could not create firewall rule automatically" -ForegroundColor Yellow
    Write-Host "  You may need to allow it manually:" -ForegroundColor Yellow
    Write-Host "    1. Windows Defender Firewall -> Advanced Settings" -ForegroundColor Yellow
    Write-Host "    2. Inbound Rules -> New Rule" -ForegroundColor Yellow
    Write-Host "    3. Port: TCP 3002 -> Allow" -ForegroundColor Yellow
}

# Install Python dependencies
Write-Host ""
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
Set-Location $relayPath

if (Test-Path "requirements.txt") {
    try {
        python -m pip install --upgrade pip
        python -m pip install -r requirements.txt
        Write-Host "  Installed pyirsdk and websockets" -ForegroundColor Green
    } catch {
        Write-Host "  Warning: Failed to install dependencies automatically" -ForegroundColor Yellow
        Write-Host "  Try manually: pip install pyirsdk websockets" -ForegroundColor Yellow
    }
} else {
    Write-Host "  requirements.txt not found, installing manually..." -ForegroundColor Yellow
    try {
        python -m pip install pyirsdk websockets
        Write-Host "  Installed pyirsdk and websockets" -ForegroundColor Green
    } catch {
        Write-Host "  Warning: Failed to install dependencies" -ForegroundColor Yellow
    }
}

# Done!
Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start iRacing and load into a session" -ForegroundColor White
Write-Host "2. Run this command in PowerShell:" -ForegroundColor White
Write-Host "   cd $relayPath" -ForegroundColor Yellow
Write-Host "   python windows-relay-server.py" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. On your Mac, edit .env.local:" -ForegroundColor White
Write-Host "   IRACING_MODE=remote" -ForegroundColor Yellow
Write-Host "   IRACING_RELAY_HOST=$ipAddress" -ForegroundColor Yellow
Write-Host "   IRACING_RELAY_PORT=3002" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Start your Mac dev server: pnpm dev" -ForegroundColor White
Write-Host ""
Write-Host "Advantages of Python version:" -ForegroundColor Cyan
Write-Host "  - No C++ compilation needed" -ForegroundColor Green
Write-Host "  - Works with any Python 3.11+" -ForegroundColor Green
Write-Host "  - Easier to debug and modify" -ForegroundColor Green
Write-Host ""
Write-Host "Happy racing! 🏁" -ForegroundColor Cyan
Write-Host ""
pause
