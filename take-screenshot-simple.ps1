# Simple screenshot script - takes screenshot of whatever is on screen

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Add Windows API functions
Add-Type -Name User32 -Namespace Win32 -MemberDefinition @"
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
"@

Write-Host "Looking for Edge window..."
$edge = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match "Auto-Marketing" } | Select-Object -First 1

if ($edge -ne $null) {
    Write-Host "Found Auto-Marketing window: $($edge.MainWindowTitle)"
    $handle = $edge.MainWindowHandle

    # Activate and maximize
    [Win32.User32]::ShowWindow($handle, 3)
    [Win32.User32]::SetForegroundWindow($handle)
    Start-Sleep -Seconds 2
} else {
    Write-Host "No Auto-Marketing window found, taking screenshot anyway..."
}

# Take screenshot
Write-Host "Taking screenshot..."
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

$outputPath = 'C:\Projects\Auto-Claude-Marketing\screenshot.png'
$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bmp.Dispose()

Write-Host "Screenshot saved to $outputPath"
