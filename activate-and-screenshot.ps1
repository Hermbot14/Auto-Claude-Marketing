# PowerShell script to activate Edge window and take screenshot

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Add Windows API functions
Add-Type -Name User32 -Namespace Win32 -MemberDefinition @"
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")]
public static extern bool IsIconic(IntPtr hWnd);
[DllImport("user32.dll")]
public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
[DllImport("user32.dll")]
public static extern int GetWindowTextLength(IntPtr hWnd);
"@

# Function to find window by title
function FindWindowByTitle($titlePattern) {
    $processes = Get-Process | Where-Object { $_.MainWindowTitle -match $titlePattern }
    return $processes | Select-Object -First 1
}

# Find Edge window with localhost:5173
Write-Host "Looking for Edge window with localhost:5173..."
$edge = FindWindowByTitle "localhost:5173"

if ($edge -eq $null) {
    Write-Host "No Edge window found with localhost:5173 in title"
    Write-Host "Looking for any Edge window..."
    $edge = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1
}

if ($edge -ne $null) {
    Write-Host "Found Edge window: $($edge.MainWindowTitle)"

    # Activate the window
    $handle = $edge.MainWindowHandle
    if ([Win32.User32]::IsIconic($handle)) {
        [Win32.User32]::ShowWindow($handle, 9)  # SW_RESTORE
    }
    [Win32.User32]::ShowWindow($handle, 3)     # SW_MAXIMIZE
    [Win32.User32]::SetForegroundWindow($handle)

    Write-Host "Window activated, waiting 2 seconds..."
    Start-Sleep -Seconds 2
} else {
    Write-Host "ERROR: No Edge window found!"
    exit 1
}

# Take screenshot
Write-Host "Taking screenshot..."
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save('C:\Projects\Auto-Claude-Marketing\screenshot.png', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bmp.Dispose()

Write-Host "Screenshot saved to screenshot.png"
