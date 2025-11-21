# iRacing Relay Server Diagnostic Script (Windows)
# Run this to verify your relay server setup

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "iRacing Relay Diagnostic Tool (Windows)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testsPassed = 0
$testsFailed = 0

# Test 1: Python Installation
Write-Host "[1/6] Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python 3\.1[1-9]") {
        Write-Host "  [✓] Python found: $pythonVersion" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "  [!] Python version: $pythonVersion" -ForegroundColor Yellow
        Write-Host "      Recommended: Python 3.11+" -ForegroundColor Yellow
        $testsPassed++
    }
} catch {
    Write-Host "  [✗] Python not found!" -ForegroundColor Red
    Write-Host "      Install from: https://python.org" -ForegroundColor Yellow
    $testsFailed++
}

# Test 2: pyirsdk Installation
Write-Host ""
Write-Host "[2/6] Checking pyirsdk installation..." -ForegroundColor Yellow
try {
    $pyirsdkCheck = python -c "import irsdk; print('OK')" 2>&1
    if ($pyirsdkCheck -match "OK") {
        Write-Host "  [✓] pyirsdk is installed" -ForegroundColor Green
        $testsPassed++
    } else {
        throw "Not installed"
    }
} catch {
    Write-Host "  [✗] pyirsdk not installed" -ForegroundColor Red
    Write-Host "      Install: pip install pyirsdk" -ForegroundColor Yellow
    $testsFailed++
}

# Test 3: websockets Installation
Write-Host ""
Write-Host "[3/6] Checking websockets installation..." -ForegroundColor Yellow
try {
    $wsCheck = python -c "import websockets; print('OK')" 2>&1
    if ($wsCheck -match "OK") {
        Write-Host "  [✓] websockets is installed" -ForegroundColor Green
        $testsPassed++
    } else {
        throw "Not installed"
    }
} catch {
    Write-Host "  [✗] websockets not installed" -ForegroundColor Red
    Write-Host "      Install: pip install websockets" -ForegroundColor Yellow
    $testsFailed++
}

# Test 4: Relay Server File
Write-Host ""
Write-Host "[4/6] Checking relay server file..." -ForegroundColor Yellow
$relayPaths = @(
    "C:\iRacing-Relay-Python\windows-relay-server.py",
    ".\windows-relay-server.py",
    "..\windows-relay-server.py"
)

$relayFound = $false
foreach ($path in $relayPaths) {
    if (Test-Path $path) {
        Write-Host "  [✓] Found relay server: $path" -ForegroundColor Green
        $relayFound = $true
        $testsPassed++
        break
    }
}

if (-not $relayFound) {
    Write-Host "  [✗] Relay server not found" -ForegroundColor Red
    Write-Host "      Copy windows-relay-server.py to C:\iRacing-Relay-Python\" -ForegroundColor Yellow
    $testsFailed++
}

# Test 5: Network Configuration
Write-Host ""
Write-Host "[5/6] Checking network configuration..." -ForegroundColor Yellow
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*"} | Select-Object -First 1).IPAddress

if ($ipAddress) {
    Write-Host "  [✓] Your IP Address: $ipAddress" -ForegroundColor Green
    Write-Host "      (Configure this on your Mac)" -ForegroundColor Cyan
    $testsPassed++
} else {
    Write-Host "  [!] Could not detect IP automatically" -ForegroundColor Yellow
    Write-Host "      Run 'ipconfig' to find it manually" -ForegroundColor Yellow
    $testsPassed++
}

# Test 6: Firewall Check
Write-Host ""
Write-Host "[6/6] Checking Windows Firewall..." -ForegroundColor Yellow
try {
    $firewallRule = Get-NetFirewallRule -DisplayName "*iRacing*Relay*" -ErrorAction SilentlyContinue
    if ($firewallRule) {
        Write-Host "  [✓] Firewall rule exists" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "  [!] No firewall rule found" -ForegroundColor Yellow
        Write-Host "      You may need to create one for port 3002" -ForegroundColor Yellow
        Write-Host "      Or temporarily disable firewall for testing" -ForegroundColor Yellow
        $testsPassed++
    }
} catch {
    Write-Host "  [!] Could not check firewall (run as Administrator)" -ForegroundColor Yellow
    $testsPassed++
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Results: $testsPassed passed, $testsFailed failed" -ForegroundColor $(if ($testsFailed -eq 0) { "Green" } else { "Yellow" })
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Host "All checks passed! You're ready to run the relay server." -ForegroundColor Green
    Write-Host ""
    Write-Host "To start the relay server:" -ForegroundColor Cyan
    Write-Host "  1. cd C:\iRacing-Relay-Python" -ForegroundColor White
    Write-Host "  2. python windows-relay-server.py" -ForegroundColor White
    Write-Host ""
    Write-Host "Then on your Mac:" -ForegroundColor Cyan
    Write-Host "  1. Edit .env.local with IRACING_RELAY_HOST=$ipAddress" -ForegroundColor White
    Write-Host "  2. Run: pnpm dev" -ForegroundColor White
} else {
    Write-Host "Please fix the failed tests above before running the relay." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Quick fixes:" -ForegroundColor Cyan
    Write-Host "  pip install pyirsdk websockets" -ForegroundColor White
}

Write-Host ""
pause
