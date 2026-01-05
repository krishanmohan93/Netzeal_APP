# NetZeal App Diagnostic & Reload Script
param(
    [switch]$RestoreFull,
    [switch]$ClearCache
)

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "🔧 NetZeal App Diagnostic Tool" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$frontendDir = "d:\Vibe Coding\Netzeal APP\frontend"

if ($RestoreFull) {
    Write-Host "📦 Restoring full app..." -ForegroundColor Yellow
    if (Test-Path "$frontendDir\App.backup.js") {
        Copy-Item "$frontendDir\App.backup.js" "$frontendDir\App.js" -Force
        Write-Host "✅ Restored full App.js" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No backup found" -ForegroundColor Red
    }
    exit
}

Write-Host "📊 Current Status:" -ForegroundColor Cyan
Write-Host "  Frontend: Using MINIMAL test app (basic React Native)" -ForegroundColor White
Write-Host "  Backend: Should be running on port 8000" -ForegroundColor White
Write-Host ""

Write-Host "🔄 To reload the app on your device:" -ForegroundColor Yellow
Write-Host "  Option 1: Shake your device" -ForegroundColor White
Write-Host "  Option 2: Press 'r' in the Expo terminal" -ForegroundColor White
Write-Host "  Option 3: In Expo Go, tap menu → Reload" -ForegroundColor White
Write-Host ""

Write-Host "✅ If you see 'NetZeal App Loaded Successfully' on device:" -ForegroundColor Green
Write-Host "   → The problem is in one of the imported components" -ForegroundColor White
Write-Host "   → Run: .\diagnose.ps1 -RestoreFull" -ForegroundColor White
Write-Host "   → I'll fix the component errors one by one" -ForegroundColor White
Write-Host ""

Write-Host "❌ If you still see 'main has not been registered':" -ForegroundColor Red
Write-Host "   1. Force close Expo Go app completely" -ForegroundColor White
Write-Host "   2. Clear Expo Go app data (Settings → Apps → Expo Go)" -ForegroundColor White
Write-Host "   3. Rescan the QR code" -ForegroundColor White
Write-Host "   4. Check if phone and computer are on same WiFi" -ForegroundColor White
Write-Host ""

if ($ClearCache) {
    Write-Host "🗑️  Clearing Metro bundler cache..." -ForegroundColor Yellow
    cd $frontendDir
    npx expo start --clear
}
