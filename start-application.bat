# start-application.bat (Windows)
@echo off
echo Starting Shopify Google Merchant Automation...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check if client dependencies are installed
if not exist "client\node_modules" (
    echo Installing client dependencies...
    call npm run install-client
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install client dependencies
        pause
        exit /b 1
    )
)

REM Create necessary directories
if not exist "data" mkdir data
if not exist "exports" mkdir exports

REM Start the application
echo.
echo Starting application servers...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000 (development mode)
echo.
echo The application will open in your default browser.
echo Press Ctrl+C to stop the application.
echo.

@REM start "" "http://localhost:3001/api/status"
npm run dev

pause