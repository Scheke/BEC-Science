import subprocess
import time
import os

# Try using Firefox via a headless approach
screenshot_path = r"C:\Users\schek\FULL STACK DEV\Claude Projects\BEC Animations\layout-screenshot.png"

# Use Windows screenshot utility with Chrome
result = subprocess.run([
    'powershell', '-Command',
    f'''
    Add-Type -AssemblyName System.Windows.Forms
    
    # Open Chrome in headless mode and capture
    $chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $chromePath)) {{
        $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    }}
    
    if (Test-Path $chromePath) {{
        & $chromePath --headless --disable-gpu --screenshot="{screenshot_path}" --window-size=1400,900 "http://localhost:8000/animations/bgcse/bio-cell-transport-study.html"
        Start-Sleep -Seconds 3
        Write-Host "Screenshot saved to: {screenshot_path}"
    }} else {{
        Write-Host "Chrome not found. Trying alternative..."
    }}
    '''
], capture_output=True, text=True)

print("PowerShell output:", result.stdout)
if result.stderr:
    print("Errors:", result.stderr)
