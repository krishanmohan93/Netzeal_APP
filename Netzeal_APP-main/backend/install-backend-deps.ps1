# Firebase Phone Auth - Quick Install Script for Backend (Windows PowerShell)
# Run this script to install all backend dependencies

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Firebase Phone Auth Setup - Backend" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the backend directory
if (-Not (Test-Path "requirements.txt")) {
    Write-Host "❌ Error: requirements.txt not found!" -ForegroundColor Red
    Write-Host "Please run this script from the backend directory:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor Yellow
    Write-Host "  .\install-backend-deps.ps1" -ForegroundColor Yellow
    exit 1
}

# Check if virtual environment exists
if (Test-Path "venv\Scripts\activate.ps1") {
    Write-Host "🐍 Activating virtual environment..." -ForegroundColor Green
    & .\venv\Scripts\activate.ps1
} else {
    Write-Host "⚠️  Virtual environment not found at venv/" -ForegroundColor Yellow
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
    Write-Host "✅ Virtual environment created!" -ForegroundColor Green
    Write-Host "Activating..." -ForegroundColor Green
    & .\venv\Scripts\activate.ps1
}

Write-Host ""
Write-Host "📦 Installing Firebase Admin SDK..." -ForegroundColor Green
pip install firebase-admin

Write-Host ""
Write-Host "📦 Updating requirements.txt..." -ForegroundColor Green
pip freeze > requirements.txt

Write-Host ""
Write-Host "✅ Backend dependencies installed!" -ForegroundColor Green
Write-Host ""

# Check if serviceAccountKey.json exists
$serviceKeyPath = "app\core\serviceAccountKey.json"
if (-Not (Test-Path $serviceKeyPath)) {
    Write-Host "⚠️  serviceAccountKey.json not found!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 Important:" -ForegroundColor Cyan
    Write-Host "1. Go to Firebase Console: https://console.firebase.google.com" -ForegroundColor White
    Write-Host "2. Select your project" -ForegroundColor White
    Write-Host "3. Go to Project Settings > Service Accounts" -ForegroundColor White
    Write-Host "4. Click 'Generate new private key'" -ForegroundColor White
    Write-Host "5. Save the downloaded file as:" -ForegroundColor White
    Write-Host "   $serviceKeyPath" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "✅ serviceAccountKey.json found!" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Run database migration: alembic upgrade head" -ForegroundColor Yellow
Write-Host "2. Start backend server: uvicorn app.main:app --reload" -ForegroundColor Yellow
Write-Host ""
Write-Host "📖 See FIREBASE_PHONE_AUTH_SETUP.md for detailed instructions" -ForegroundColor Cyan
