@echo off
setlocal

echo Starting Salesforce Automator Local Agent...

:: Install dependencies quietly if needed
pip install playwright >nul 2>&1

:: Start the python backend
python public\salesforce_playwright.py

pause
