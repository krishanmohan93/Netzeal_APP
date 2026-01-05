# NetZeal Backend Startup Script (Windows PowerShell)
# Usage: .\start-backend.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 Starting NetZeal Backend" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "❌ Error: Virtual environment not found!" -ForegroundColor Red
    Write-Host "Please create it first with: python -m venv venv" -ForegroundColor Yellow
    exit 1
}

# Activate virtual environment
Write-Host "📦 Activating virtual environment..." -ForegroundColor Cyan
.\venv\Scripts\Activate.ps1

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "📝 Creating .env from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item .env.example .env
        Write-Host "✅ .env file created. Please update it with your API keys." -ForegroundColor Green
    } else {
        Write-Host "❌ .env.example not found either!" -ForegroundColor Red
    }
    exit 1
}

# Install/update dependencies
Write-Host "📥 Checking dependencies..." -ForegroundColor Cyan
pip install -q -r requirements.txt

# Get local IP address
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📡 Network Information" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
try {
    $LOCAL_IP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi" -ErrorAction SilentlyContinue).IPAddress
    if (-not $LOCAL_IP) {
        $LOCAL_IP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*"} | Select-Object -First 1).IPAddress
    }
} catch {
    $LOCAL_IP = "Unable to detect"
}

Write-Host "🔸 Local IP: $LOCAL_IP" -ForegroundColor White
Write-Host "🔸 Localhost: http://localhost:8000" -ForegroundColor White
Write-Host "🔸 Network: http://$LOCAL_IP:8000" -ForegroundColor White
Write-Host "🔸 API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""

# Start the server
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✨ Starting Uvicorn Server" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔸 Host: 0.0.0.0 (accessible from network)" -ForegroundColor White
Write-Host "🔸 Port: 8000" -ForegroundColor White
Write-Host "🔸 Reload: Enabled (auto-restart on code changes)" -ForegroundColor White
Write-Host ""
Write-Host "📱 Update your mobile app's API URL to:" -ForegroundColor Yellow
Write-Host "   http://$LOCAL_IP:8000/api/v1" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
