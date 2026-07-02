@echo off
setlocal enabledelayedexpansion

set "OFFLINE_PASSWORD_HASH=4220a808e22854e20ee1018e17b8a1855b4cf7968a3ae68b1faad28381539e5c"
set "VERIFY_URL=https://salesforce-implementation-woad.vercel.app/api/sf-auth"
set "TOKEN_PATH=public\token.txt"

echo ===================================================
echo   Salesforce Automator Local Agent Launcher
echo ===================================================
echo.
echo Select Mode:
echo   [1] Offline Mode (Password Protected)
echo   [2] Online Mode (Session Verification)
echo.
set /p "choice=Enter choice (1 or 2): "

if "%choice%"=="1" (
    echo.
    set /p "pass=Enter Password to access code: "
    for /f "delims=" %%i in ('python -c "import hashlib; print(hashlib.sha256(b'!pass!').hexdigest())"') do set "entered_hash=%%i"
    if "!entered_hash!"=="%OFFLINE_PASSWORD_HASH%" (
        echo Access Granted.
        goto :start_agent
    ) else (
        echo Access Denied. Incorrect password. Script will self-destruct.
        pause
        (goto) 2>nul & del "%~f0" & exit
    )
)

if "%choice%"=="2" (
    echo.
    echo Verifying session...
    
    :: Check if token file exists
    if exist "%TOKEN_PATH%" (
        set /p token=<"%TOKEN_PATH%"
        if not "!token!"=="" (
            :: Verify token via Vercel endpoint
            for /f "delims=" %%i in ('curl -s -o nul -w "%%{http_code}" -H "Authorization: Bearer !token!" "%VERIFY_URL%"') do set "http_status=%%i"
            if "!http_status!"=="200" (
                echo Session verified successfully.
                goto :start_agent
            )
        )
    )
    
    echo Session invalid, expired, or missing.
    echo.
    set /p "manual_token=Please paste your JWT Token for manual verification: "
    if not "!manual_token!"=="" (
        for /f "delims=" %%i in ('curl -s -o nul -w "%%{http_code}" -H "Authorization: Bearer !manual_token!" "%VERIFY_URL%"') do set "http_status=%%i"
        if "!http_status!"=="200" (
            echo Manual verification successful.
            :: Save token
            if not exist "public" mkdir "public"
            echo !manual_token!>"%TOKEN_PATH%"
            goto :start_agent
        )
    )
    
    echo Authentication failed. Script will self-destruct.
    pause
    :: Self destruct command
    (goto) 2>nul & del "%~f0" & exit
)

echo Invalid choice.
pause
exit /b

:start_agent
echo Starting Salesforce Automator Local Agent...
:: Install dependencies quietly if needed
pip install playwright >nul 2>&1
python salesforce_playwright.py
pause
