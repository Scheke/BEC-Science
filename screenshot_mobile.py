import subprocess

screenshot_path = r"C:\Users\schek\FULL STACK DEV\Claude Projects\BEC Animations\layout-mobile.png"

# Chrome headless with mobile viewport
result = subprocess.run([
    'powershell', '-Command',
    fr'''
    $chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $chromePath)) {{
        $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    }}
    
    if (Test-Path $chromePath) {{
        & $chromePath --headless --disable-gpu --screenshot="{screenshot_path}" --window-size=480,900 --user-agent="Mozilla/5.0 (Linux; Android 10)" "http://localhost:8000/animations/bgcse/bio-cell-transport-study.html"
        Start-Sleep -Seconds 3
        Write-Host "Mobile screenshot saved"
    }}
    '''
], capture_output=True, text=True)

print(result.stdout)
