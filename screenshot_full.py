import subprocess
import time

screenshot_path = r"C:\Users\schek\FULL STACK DEV\Claude Projects\BEC Animations\layout-full.png"

result = subprocess.run([
    'powershell', '-Command',
    fr'''
    $chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $chromePath)) {{
        $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    }}
    
    if (Test-Path $chromePath) {{
        & $chromePath --headless --disable-gpu --screenshot="{screenshot_path}" --window-size=1600,1000 "http://localhost:8000/animations/bgcse/bio-cell-transport-study.html"
        Start-Sleep -Seconds 4
        Write-Host "Full screenshot saved at {screenshot_path}"
    }}
    '''
], capture_output=True, text=True)

print(result.stdout)
