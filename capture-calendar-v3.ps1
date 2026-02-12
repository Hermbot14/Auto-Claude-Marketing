# PowerShell script to navigate Edge to localhost:3001 and take screenshot
# Uses keyboard shortcuts to ensure we're on the right tab

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Add Windows API functions
Add-Type -Name User32 -Namespace Win32 -MemberDefinition @"
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")]
public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")]
public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);
"@

$VK_CONTROL = 0x11
$VK_L = 0x4C
$VK_T = 0x54
$KEYEVENTF_KEYUP = 0x0002

function SendCtrlKey([byte]$key) {
    [Win32.User32]::keybd_event($VK_CONTROL, 0, 0, [IntPtr]::Zero)
    [Win32.User32]::keybd_event($key, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [Win32.User32]::keybd_event($key, 0, $KEYEVENTF_KEYUP, [IntPtr]::Zero)
    [Win32.User32]::keybd_event($VK_CONTROL, 0, $KEYEVENTF_KEYUP, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 100
}

Write-Host "Step 1: Starting Edge browser with localhost:3001..."

# Close all existing Edge windows to avoid confusion
Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

# Start fresh Edge with the calendar URL (port 3001) - use a new window
Start-Process "msedge.exe" -ArgumentList "http://localhost:3001", "--new-window"
Write-Host "Waiting for page to load (8 seconds)..."
Start-Sleep -Seconds 8

# Find and activate Edge window
Write-Host "Step 2: Activating Edge window..."
$edge = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1

if ($edge -ne $null) {
    $handle = $edge.MainWindowHandle
    Write-Host "Found window: $($edge.MainWindowTitle)"

    # Maximize and bring to front
    [Win32.User32]::ShowWindow($handle, 3)     # SW_MAXIMIZE
    [Win32.User32]::SetForegroundWindow($handle)
    Start-Sleep -Seconds 1

    # Try to navigate to address bar and go to our URL
    Write-Host "Step 3: Navigating to localhost:3001..."
    SendCtrlKey $VK_L  # Focus address bar
    Start-Sleep -Milliseconds 200
    SendCtrlKey $VK_L  # Double Ctrl+L to ensure focus
    Start-Sleep -Milliseconds 500

    # Type the URL
    $wshell = New-Object -ComObject WScript.Shell
    $wshell.SendKeys("http://localhost:3001{ENTER}")
    Start-Sleep -Seconds 4

    # Verify URL by checking window title
    Write-Host "Step 4: Verifying page loaded..."
    $edge = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1
    Write-Host "Window title: $($edge.MainWindowTitle)"

    [Win32.User32]::SetForegroundWindow($handle)
    Start-Sleep -Seconds 2
} else {
    Write-Host "ERROR: Could not find Edge window!"
    exit 1
}

# Take screenshot
Write-Host "Step 5: Taking screenshot..."
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

$outputPath = 'C:\Projects\Auto-Claude-Marketing\screenshot.png'
$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bmp.Dispose()

Write-Host "Screenshot saved to $outputPath"
Write-Host "Done!"
