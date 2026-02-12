# PowerShell script to take screenshot of http://localhost:5173 in Microsoft Edge

# Function to minimize all windows
function MinimizeAllWindows {
    Write-Output "Minimizing all windows..."
    $shell = New-Object -ComObject Shell.Application
    $shell.MinimizeAll()
    Start-Sleep -Milliseconds 1000
}

# Function to open Microsoft Edge and navigate to localhost:5173
function OpenEdge {
    Write-Output "Opening Microsoft Edge..."
    try {
        # Start Microsoft Edge with the specified URL
        Start-Process -FilePath "msedge.exe" -ArgumentList "http://localhost:5173" -WindowStyle Maximized

        # Wait for the page to load
        Write-Output "Waiting for page to load..."
        Start-Sleep -Seconds 3

        # Bring Edge to front
        Write-Output "Bringing Edge to foreground..."
        $edgeProcess = Get-Process | Where-Object { $_.ProcessName -eq "msedge" } | Select-Object -First 1
        if ($edgeProcess -and $edgeProcess.MainWindowHandle) {
            $handle = $edgeProcess.MainWindowHandle

            # Use Windows API to restore and bring to front
            $type = Add-Type -MemberDefinition @"
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
public const int SW_RESTORE = 9;
"@ -Name NativeMethods -PassThru

            $type::ShowWindow($handle, $type::SW_RESTORE)
            $type::SetForegroundWindow($handle)
            Start-Sleep -Milliseconds 500
        }
    } catch {
        Write-Error "Failed to open Edge: $_"
        exit 1
    }
}

# Function to take screenshot
function Take-Screenshot {
    param (
        [string]$outputPath
    )

    Write-Output "Taking screenshot..."
    try {
        # Verify the output directory exists
        $outputDir = Split-Path $outputPath -Parent
        if (-not (Test-Path $outputDir)) {
            Write-Output "Creating output directory..."
            New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
        }

        # Use Windows API to capture screenshot
        Add-Type -AssemblyName System.Windows.Forms

        # Get primary screen bounds
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen
        $bounds = $screen.Bounds

        # Create bitmap and graphics
        $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

        # Copy screen content to bitmap
        $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)

        # Save the screenshot
        $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

        # Clean up
        $graphics.Dispose()
        $bitmap.Dispose()

        Write-Output "Screenshot saved successfully"
    } catch {
        Write-Error "Failed to take screenshot: $_"
        exit 1
    }
}

# Main execution
Write-Output "Starting screenshot process..."

# 1. Minimize all currently open windows
MinimizeAllWindows

# 2. Open a new Microsoft Edge browser window to http://localhost:5173
# 3. Wait 3 seconds for the page to load
# 4. Maximize the Edge window and bring it to foreground
OpenEdge

# 5. Take a screenshot of the primary display
# 6. Save the screenshot to C:\Projects\Auto-Claude-Marketing\screenshot.png
$outputPath = "C:\Projects\Auto-Claude-Marketing\screenshot.png"
Take-Screenshot -outputPath $outputPath

# 7. Output "Screenshot saved successfully"
Write-Output "Screenshot saved successfully"