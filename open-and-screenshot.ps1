Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Write-Host "Opening Edge to localhost:3001..."
Start-Process "msedge.exe" -ArgumentList "http://localhost:3001", "--start-maximized"
Write-Host "Waiting 10 seconds for page to load..."
Start-Sleep -Seconds 10

Write-Host "Taking screenshot..."
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save('C:\Projects\Auto-Claude-Marketing\screenshot.png', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bmp.Dispose()

Write-Host "Screenshot saved to screenshot.png"
