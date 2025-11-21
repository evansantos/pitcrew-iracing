# iRacing Relay Server Setup Script for Windows
# Run this with PowerShell as Administrator

Write-Host "================================" -ForegroundColor Cyan
Write-Host "iRacing Relay Server Setup" -ForegroundColor Cyan
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

# Check for Node.js
Write-Host "[1/5] Checking for Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  Node.js NOT found!" -ForegroundColor Red
    Write-Host "  Please download and install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Start-Process "https://nodejs.org/"
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
$relayPath = "C:\iRacing-Relay"
if (Test-Path $relayPath) {
    Write-Host "  Directory already exists: $relayPath" -ForegroundColor Green
} else {
    New-Item -ItemType Directory -Path $relayPath | Out-Null
    Write-Host "  Created: $relayPath" -ForegroundColor Green
}

# Copy relay server file
Write-Host ""
Write-Host "[4/5] Looking for windows-relay-server.js..." -ForegroundColor Yellow
$currentPath = Get-Location
$sourceFile = Join-Path $currentPath "windows-relay-server.js"
$destFile = Join-Path $relayPath "windows-relay-server.js"

if (Test-Path $sourceFile) {
    Copy-Item $sourceFile $destFile -Force
    Write-Host "  Copied relay server to $relayPath" -ForegroundColor Green
} else {
    Write-Host "  windows-relay-server.js not found in current directory!" -ForegroundColor Red
    Write-Host "  Please copy it manually to $relayPath" -ForegroundColor Yellow
}

# Configure Windows Firewall
Write-Host ""
Write-Host "[5/5] Configuring Windows Firewall..." -ForegroundColor Yellow
try {
    # Check if rule already exists
    $existingRule = Get-NetFirewallRule -DisplayName "iRacing Relay Server" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "  Firewall rule already exists" -ForegroundColor Green
    } else {
        New-NetFirewallRule -DisplayName "iRacing Relay Server" -Direction Inbound -Protocol TCP -LocalPort 3002 -Action Allow | Out-Null
        Write-Host "  Firewall rule created for port 3002" -ForegroundColor Green
    }
} catch {
    Write-Host "  Could not create firewall rule automatically" -ForegroundColor Yellow
    Write-Host "  You may need to allow it manually:" -ForegroundColor Yellow
    Write-Host "    1. Windows Defender Firewall -> Advanced Settings" -ForegroundColor Yellow
    Write-Host "    2. Inbound Rules -> New Rule" -ForegroundColor Yellow
    Write-Host "    3. Port: TCP 3002 -> Allow" -ForegroundColor Yellow
}

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Set-Location $relayPath
if (Test-Path "package.json") {
    Write-Host "  Dependencies already installed" -ForegroundColor Green
} else {
    npm init -y | Out-Null
    npm install ws node-irsdk
    Write-Host "  Installed ws and node-irsdk" -ForegroundColor Green
}

# Done!
Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start iRacing and load into a session" -ForegroundColor White
Write-Host "2. Run this command:" -ForegroundColor White
Write-Host "   cd $relayPath" -ForegroundColor Yellow
Write-Host "   node windows-relay-server.js" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. On your Mac, edit .env.local:" -ForegroundColor White
Write-Host "   IRACING_MODE=remote" -ForegroundColor Yellow
Write-Host "   IRACING_RELAY_HOST=$ipAddress" -ForegroundColor Yellow
Write-Host "   IRACING_RELAY_PORT=3002" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Start your Mac dev server: pnpm dev" -ForegroundColor White
Write-Host ""
Write-Host "Happy racing! 🏁" -ForegroundColor Cyan
Write-Host ""
pause
