@echo off
setlocal
cd /d "%~dp0"
py -3 --version >nul 2>&1
if not errorlevel 1 (
    py -3 scripts\serve.py
    goto done
)
python --version >nul 2>&1
if not errorlevel 1 (
    python scripts\serve.py
    goto done
)
echo Python 3.10 or newer is required. See README.md.
:done
pause
