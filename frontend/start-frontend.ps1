# NetZeal Frontend Startup Script (Windows PowerShell)
# Usage: .\start-frontend.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📱 Starting NetZeal Frontend (Expo)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
    npm install --legacy-peer-deps
}

# Get local IP for instructions
try {
    $LOCAL_IP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi" -ErrorAction SilentlyContinue).IPAddress
    if (-not $LOCAL_IP) {
        $LOCAL_IP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*"} | Select-Object -First 1).IPAddress
    }
} catch {
    $LOCAL_IP = "Unable to detect"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📡 Important: Check Your API Configuration" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔸 Edit: src/config/environment.js" -ForegroundColor White
Write-Host "🔸 Set LOCAL_IP to: $LOCAL_IP" -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure your backend is running at:" -ForegroundColor Yellow
Write-Host "   http://$LOCAL_IP:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✨ Starting Expo Development Server" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Options:" -ForegroundColor White
Write-Host "  📱 Press 's' - Switch to development build" -ForegroundColor Gray
Write-Host "  🔗 Press 'w' - Open in web browser" -ForegroundColor Gray
Write-Host "  📊 Press 'j' - Open debugger" -ForegroundColor Gray
Write-Host "  🔄 Press 'r' - Reload app" -ForegroundColor Gray
Write-Host "  🛑 Press 'q' - Quit" -ForegroundColor Gray
Write-Host ""
Write-Host "Scan the QR code with Expo Go app" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start Expo with clear cache
npx expo start --clear
