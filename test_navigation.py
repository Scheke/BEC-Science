import subprocess

screenshot_path = r"C:\Users\schek\FULL STACK DEV\Claude Projects\BEC Animations\layout-step2.png"

# Use headless Chrome with JavaScript execution to click the Next button
result = subprocess.run([
    'powershell', '-Command',
    fr'''
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Cursor]::Current = [System.Windows.Forms.Cursors]::WaitCursor
    
    $chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $chromePath)) {{
        $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    }}
    
    # First, open in interactive mode to test click
    Write-Host "Testing navigation by opening in regular browser..."
    Start-Process $chromePath "http://localhost:8000/animations/bgcse/bio-cell-transport-study.html?test=1"
    
    # Then take headless screenshot
    Start-Sleep -Seconds 5
    & $chromePath --headless --disable-gpu --screenshot="{screenshot_path}" --window-size=1600,1000 "http://localhost:8000/animations/bgcse/bio-cell-transport-study.html"
    
    Write-Host "Screenshot after waiting 5s saved"
    '''
], capture_output=True, text=True)

print(result.stdout)
if result.stderr:
    print("Info:", result.stderr[:500])
