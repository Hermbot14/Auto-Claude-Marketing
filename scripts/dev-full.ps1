# One-Command Development Environment Setup Script for Windows
# Auto-detects dependencies, installs if needed, and starts full dev environment
#
# Features:
# - Dependency checking (Node.js, Python 3.12+, bun)
# - Auto-installation of missing dependencies
# - Parallel startup of backend and frontend
# - Auto-open browser
# - QR code generation for mobile testing
# - Color-coded output for easy monitoring
#
# Usage:
#   .\scripts\dev-full.ps1 [options]
#
# Options:
#   -SkipDepsCheck    Skip dependency checking and installation
#   -NoBrowser        Don't auto-open browser
#   -NoQR             Don't display QR code
#   -Verbose          Enable verbose output

param(
    [switch]$SkipDepsCheck,
    [switch]$NoBrowser,
    [switch]$NoQR,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$StartTime = Get-Date

# Color scheme
$Colors = @{
    Info = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Service = "Magenta"
}

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-Header {
    param([string]$Title)
    $line = "=" * 60
    Write-ColorOutput "`n$line" $Colors.Info
    Write-ColorOutput "  $Title" $Colors.Info
    Write-ColorOutput "$line`n" $Colors.Info
}

function Test-Command {
    param([string]$Command)
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Get-PythonVersion {
    $candidates = @('py -3.12', 'py -3.13', 'py -3.14', 'python3.12', 'python3.13', 'python3.14', 'python3', 'python')
    foreach ($cmd in $candidates) {
        try {
            $parts = $cmd -split ' '
            $output = & $parts[0] $parts[1..($parts.Length - 1)] --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                if ($output -match 'Python (\d+)\.(\d+)') {
                    $major = [int]$matches[1]
                    $minor = [int]$matches[2]
                    if ($major -eq 3 -and $minor -ge 12) {
                        return $cmd
                    }
                }
            }
        }
        catch {
            continue
        }
    }
    return $null
}

# Check if a port is available
function Test-PortAvailable {
    param([int]$Port)
    try {
        $listener = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
        return $listener -notcontains $Port
    }
    catch {
        return $true
    }
}

# QR Code Generation using PowerShell
function Show-QRCode {
    param([string]$URL)

    Write-ColorOutput "`n========================================" $Colors.Info
    Write-ColorOutput "  SCAN QR CODE FOR MOBILE ACCESS" $Colors.Success
    Write-ColorOutput "========================================`n" $Colors.Info

    # Check if qrencode is available
    if (Test-Command "qrencode") {
        Write-ColorOutput "URL: $URL" $Colors.Warning
        & qrencode -t ANSIUTF8 "$URL"
    }
    else {
        # Fallback: Display QR info and instructions
        Write-ColorOutput "QR Code URL:" $Colors.Success
        Write-ColorOutput "$URL" $Colors.Warning
        Write-ColorOutput "`nFor mobile access, scan this URL with your QR scanner app.`n" $Colors.Info
        Write-ColorOutput "Tip: Install 'qrencode' for visual QR codes in terminal:" $Colors.Info
        Write-ColorOutput "  winget install qrencode`n" $Colors.Warning
    }

    Write-ColorOutput "`nMobile Testing Instructions:" $Colors.Info
    Write-ColorOutput "  1. Ensure your mobile device is on the same network" $Colors.Warning
    Write-ColorOutput "  2. Scan the QR code or enter the URL manually" $Colors.Warning
    Write-ColorOutput "  3. For IP issues, use: $URL" $Colors.Warning
    Write-ColorOutput "`n"
}

function Get-LocalIP {
    try {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi","Ethernet","vEthernet*" |
               Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
               Select-Object -First 1 -ExpandProperty IPAddress)
        if ($ip) {
            return $ip
        }
    }
    catch {
        # Fallback to hostname resolution
        try {
            $hostname = [System.Net.Dns]::GetHostName()
            $addresses = [System.Net.Dns]::GetHostAddresses($hostname)
            foreach ($addr in $addresses) {
                if ($addr.AddressFamily -eq 'InterNetwork' -and
                    $addr.IPAddressToString -notmatch '^127\.|^169\.254\.') {
                    return $addr.IPAddressToString
                }
            }
        }
        catch {
            # Final fallback
        }
    }
    return "localhost"
}

# Check dependencies
function Test-Dependencies {
    Write-Header "CHECKING DEPENDENCIES"

    $allGood = $true
    $missingDeps = @()

    # Check Node.js
    Write-ColorOutput "Checking Node.js..." $Colors.Info
    if (Test-Command "node") {
        $nodeVersion = node --version
        Write-ColorOutput "  ✓ Node.js $nodeVersion found" $Colors.Success
    }
    else {
        Write-ColorOutput "  ✗ Node.js NOT found" $Colors.Error
        Write-ColorOutput "    Install: winget install OpenJS.NodeJS.LTS" $Colors.Warning
        $missingDeps += "Node.js"
        $allGood = $false
    }

    # Check Python 3.12+
    Write-ColorOutput "`nChecking Python 3.12+..." $Colors.Info
    $pythonCmd = Get-PythonVersion
    if ($pythonCmd) {
        $pythonVersion = & ($pythonCmd -split ' ')[0] ($pythonCmd -split ' ')[1] --version 2>&1
        Write-ColorOutput "  ✓ $pythonVersion found ($pythonCmd)" $Colors.Success
    }
    else {
        Write-ColorOutput "  ✗ Python 3.12+ NOT found" $Colors.Error
        Write-ColorOutput "    Install: winget install Python.Python.3.12" $Colors.Warning
        $missingDeps += "Python 3.12+"
        $allGood = $false
    }

    # Check bun
    Write-ColorOutput "`nChecking bun..." $Colors.Info
    if (Test-Command "bun") {
        $bunVersion = bun --version
        Write-ColorOutput "  ✓ bun $bunVersion found" $Colors.Success
    }
    else {
        Write-ColorOutput "  ✗ bun NOT found" $Colors.Error
        Write-ColorOutput "    Install: winget install Oven-Sh.Bun" $Colors.Warning
        $missingDeps += "bun"
        $allGood = $false
    }

    # Check git
    Write-ColorOutput "`nChecking git..." $Colors.Info
    if (Test-Command "git") {
        $gitVersion = git --version
        Write-ColorOutput "  ✓ $gitVersion found" $Colors.Success
    }
    else {
        Write-ColorOutput "  ✗ git NOT found" $Colors.Error
        Write-ColorOutput "    Install: winget install Git.Git" $Colors.Warning
        $missingDeps += "git"
        $allGood = $false
    }

    if (-not $allGood) {
        Write-ColorOutput "`n❌ Missing dependencies: $($missingDeps -join ', ')" $Colors.Error
        Write-ColorOutput "`nPlease install missing dependencies and re-run this script." $Colors.Warning
        exit 1
    }

    Write-ColorOutput "`n✅ All dependencies found!" $Colors.Success
    return $pythonCmd
}

# Install backend dependencies
function Install-Backend {
    param([string]$PythonCmd)

    Write-Header "INSTALLING BACKEND DEPENDENCIES"

    $backendDir = Join-Path $PSScriptRoot "..\apps\backend"
    $venvDir = Join-Path $backendDir ".venv"
    $venvPip = Join-Path $venvDir "Scripts\pip.exe"

    # Check if venv exists
    if (-not (Test-Path $venvDir)) {
        Write-ColorOutput "Creating Python virtual environment..." $Colors.Info
        & ($PythonCmd -split ' ')[0] ($PythonCmd -split ' ')[1] -m venv (Resolve-Path $venvDir).Path
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "✗ Failed to create virtual environment" $Colors.Error
            exit 1
        }
    }
    else {
        Write-ColorOutput "Virtual environment already exists" $Colors.Success
    }

    # Check if requirements are installed
    $requirementsFile = Join-Path $backendDir "requirements.txt"
    if (Test-Path $requirementsFile) {
        Write-ColorOutput "Installing Python dependencies..." $Colors.Info
        & $venvPip install -r $requirementsFile --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ Python dependencies installed" $Colors.Success
        }
        else {
            Write-ColorOutput "✗ Failed to install Python dependencies" $Colors.Error
            exit 1
        }
    }

    # Create .env from .env.example if needed
    $envFile = Join-Path $backendDir ".env"
    $envExample = Join-Path $backendDir ".env.example"
    if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
        Write-ColorOutput "Creating .env from .env.example..." $Colors.Info
        Copy-Item $envExample $envFile
        Write-ColorOutput "✓ Created .env file" $Colors.Success
        Write-ColorOutput "  Please run: claude setup-token" $Colors.Warning
    }
}

# Install frontend dependencies
function Install-Frontend {
    Write-Header "INSTALLING FRONTEND DEPENDENCIES"

    $frontendDir = Join-Path $PSScriptRoot "..\apps\frontend"

    Write-ColorOutput "Installing Node dependencies with bun..." $Colors.Info
    Push-Location $frontendDir
    bun install --silent
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Node dependencies installed" $Colors.Success
    }
    else {
        Write-ColorOutput "✗ Failed to install Node dependencies" $Colors.Error
        Pop-Location
        exit 1
    }
    Pop-Location
}

# Start development servers
function Start-DevServers {
    Write-Header "STARTING DEVELOPMENT SERVERS"

    $rootDir = Split-Path $PSScriptRoot -Parent
    $frontendDir = Join-Path $rootDir "apps\frontend"

    # Kill any existing processes on ports
    Write-ColorOutput "Checking for existing processes..." $Colors.Info
    $ports = @(3000, 5173)
    foreach ($port in $ports) {
        try {
            $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
                       Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-ColorOutput "  Stopping process on port $port (PID: $process)" $Colors.Warning
                Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
            }
        }
        catch {
            # Ignore errors
        }
    }

    # Get local IP for QR code
    $localIP = Get-LocalIP
    $frontendURL = "http://localhost:3000"
    $networkURL = "http://$localIP`:3000"

    # Start web dev server
    Write-ColorOutput "`nStarting frontend dev server..." $Colors.Service
    $frontendProcess = Start-Process -FilePath "bun" -ArgumentList "run", "dev:web" -WorkingDirectory $frontendDir -WindowStyle Hidden -PassThru

    # Wait for server to start
    Write-ColorOutput "Waiting for servers to start..." $Colors.Info
    $timeout = 30
    $elapsed = 0
    $serverReady = $false

    while ($elapsed -lt $timeout) {
        try {
            $response = Invoke-WebRequest -Uri $frontendURL -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $serverReady = $true
                break
            }
        }
        catch {
            # Server not ready yet
        }
        Start-Sleep -Seconds 1
        $elapsed++
    }

    if ($serverReady) {
        Write-ColorOutput "✓ Frontend server ready!" $Colors.Success
        Write-ColorOutput "  Local:   $frontendURL" $Colors.Warning
        Write-ColorOutput "  Network: $networkURL" $Colors.Warning

        # Show QR code
        if (-not $NoQR) {
            Show-QRCode -URL $networkURL
        }

        # Open browser
        if (-not $NoBrowser) {
            Write-ColorOutput "`nOpening browser..." $Colors.Info
            Start-Process $frontendURL
        }
    }
    else {
        Write-ColorOutput "✗ Frontend server failed to start within ${timeout}s" $Colors.Error
        Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
        exit 1
    }

    # Calculate startup time
    $duration = ((Get-Date) - $StartTime).TotalSeconds
    Write-ColorOutput "`n✅ Development environment started in $($duration.ToString('F1')) seconds!" $Colors.Success
    Write-ColorOutput "`nPress Ctrl+C to stop all servers`n" $Colors.Info

    # Keep script running
    try {
        Wait-Process -Id $frontendProcess.Id
    }
    finally {
        Write-ColorOutput "`nStopping servers..." $Colors.Warning
        Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
        Write-ColorOutput "✓ Servers stopped" $Colors.Success
    }
}

# Main execution
try {
    Clear-Host

    Write-ColorOutput "`n╔════════════════════════════════════════════════════════════╗" $Colors.Info
    Write-ColorOutput "║     Auto Claude Marketing Hub - Dev Environment Setup     ║" $Colors.Info
    Write-ColorOutput "╚════════════════════════════════════════════════════════════╝`n" $Colors.Info

    if (-not $SkipDepsCheck) {
        $pythonCmd = Test-Dependencies
        Install-Backend -PythonCmd $pythonCmd
        Install-Frontend
    }

    Start-DevServers
}
catch {
    Write-ColorOutput "`n✗ Error: $($_.Exception.Message)" $Colors.Error
    exit 1
}
