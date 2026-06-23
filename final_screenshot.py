import subprocess
import time

screenshot_path = r"C:\Users\schek\FULL STACK DEV\Claude Projects\BEC Animations\layout-final-test.png"

# Use Chrome to take screenshot with adequate wait time
result = subprocess.run([
    'powershell', '-Command',
    fr'''
    $chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $chromePath)) {{
        $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    }}
    
    if (Test-Path $chromePath) {{
        & $chromePath --headless --disable-gpu --screenshot="{screenshot_path}" --window-size=1600,1000 --virtual-time-budget=10000 "http://localhost:8000/animations/bgcse/bio-cell-transport-study.html"
        Start-Sleep -Seconds 3
        Write-Host "Final screenshot saved"
    }}
    '''
], capture_output=True, text=True)

print(result.stdout)
