# MGR Campo — Build APK Script
# Executa o pipeline completo: build React → sync Capacitor → gera APK debug
# Uso: .\scripts\build-apk.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent

Write-Host "`n=== MGR Campo — Build APK ===" -ForegroundColor Cyan
Set-Location $projectRoot

# 1. Build React
Write-Host "`n[1/4] Build do app React..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build falhou."; exit 1 }

# 2. Sync Capacitor
Write-Host "`n[2/4] Sincronizando Capacitor..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Error "Cap sync falhou."; exit 1 }

# 3. Build APK debug via Gradle
Write-Host "`n[3/4] Gerando APK debug..." -ForegroundColor Yellow
$gradlew = Join-Path $projectRoot "android\gradlew.bat"
if (-not (Test-Path $gradlew)) {
    Write-Host "gradlew não encontrado. Execute: npx cap add android" -ForegroundColor Red
    Write-Host "Depois: npx cap open android (para configurar chave de assinatura)" -ForegroundColor Gray
    exit 0
}
& $gradlew assembleDebug --project-dir (Join-Path $projectRoot "android")
if ($LASTEXITCODE -ne 0) { Write-Error "Gradle build falhou."; exit 1 }

# 4. Copiar APK para pasta raiz
Write-Host "`n[4/4] Copiando APK..." -ForegroundColor Yellow
$apkSrc = Join-Path $projectRoot "android\app\build\outputs\apk\debug\app-debug.apk"
$apkDst = Join-Path $projectRoot "mgr-campo-debug.apk"
Copy-Item $apkSrc $apkDst -Force

Write-Host "`n=== APK gerado com sucesso! ===" -ForegroundColor Green
Write-Host "Arquivo: $apkDst" -ForegroundColor Green
Write-Host "Distribua o link de download via Firebase Hosting ou Storage.`n"
