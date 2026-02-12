# PowerShell script to navigate Edge to localhost:3001 and take screenshot
# Longer wait times to ensure page loads properly

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
"@

Write-Host "Step 1: Starting Edge in incognito mode with localhost:3001..."

# Close all existing Edge windows to avoid confusion
Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 4

# Start Edge in incognito mode with only our URL
Start-Process "msedge.exe" -ArgumentList "-inprivate", "http://localhost:3001"
Write-Host "Waiting for page to load (15 seconds)..."
Start-Sleep -Seconds 15

# Find and activate Edge window
Write-Host "Step 2: Activating Edge window..."
$edge = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1

if ($edge -ne $null) {
    $handle = $edge.MainWindowHandle
    Write-Host "Found window: $($edge.MainWindowTitle)"

    # Verify we have the correct page
    if ($edge.MainWindowTitle -match "Auto-Marketing") {
        Write-Host "Correct page detected!"
    } else {
        Write-Host "WARNING: Window title doesn't match expected 'Auto-Marketing'"
    }

    # Maximize and bring to front
    [Win32.User32]::ShowWindow($handle, 3)     # SW_MAXIMIZE
    [Win32.User32]::SetForegroundWindow($handle)

    Write-Host "Waiting for window to fully render (4 seconds)..."
    Start-Sleep -Seconds 4
} else {
    Write-Host "ERROR: Could not find Edge window!"
    exit 1
}

# Verify we have the foreground window
$foreground = [Win32.User32]::GetForegroundWindow()
Write-Host "Foreground window handle: $foreground"
Write-Host "Edge window handle: $($edge.MainWindowHandle)"

# Take screenshot
Write-Host "Step 3: Taking screenshot..."
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
