@echo off
echo Installing PollenOS Trading Bot System...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is required. Please install Node.js 18+ first.
    exit /b 1
)

echo Installing dependencies...
npm install

cd web-interface
npm install
cd ..

if not exist .env (
    copy .env.example .env
    echo Configuration template created (.env)
    echo Please edit .env with your private keys and API settings
)

echo Installation complete!
echo.
echo Quick Start:
echo 1. Edit .env with your configuration
echo 2. Run: npm run setup (optional configuration wizard)
echo 3. Run: npm start (start trading bots)
echo 4. Run: npm run config (start web interface)
echo.
echo For detailed setup instructions, see README.md
pause
