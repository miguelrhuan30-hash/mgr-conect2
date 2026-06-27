# MGR Campo — Setup inicial Android (rodar apenas 1x)
# Pré-requisito: Android Studio instalado com SDK API 33+
# Uso: .\scripts\setup-android.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

Write-Host "`n=== MGR Campo — Setup Android (primeira vez) ===" -ForegroundColor Cyan

# 1. Build React
Write-Host "`n[1/5] Build React..." -ForegroundColor Yellow
npm run build

# 2. Adiciona plataforma Android
Write-Host "`n[2/5] Adicionando plataforma Android..." -ForegroundColor Yellow
npx cap add android

# 3. Copia permissões no manifest
Write-Host "`n[3/5] Aplicando permissoes no AndroidManifest..." -ForegroundColor Yellow
$manifest = Join-Path $projectRoot "android\app\src\main\AndroidManifest.xml"
$permissions = @"

    <!-- Localização em primeiro plano -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <!-- Localização em background (rastreio continuo — Android 10+) -->
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <!-- Camera -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <!-- Microfone -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <!-- Chamadas -->
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />
    <!-- Notificações (Android 13+) -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <!-- Vibração e sons -->
    <uses-permission android:name="android.permission.VIBRATE" />
    <!-- Internet -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <!-- Wake lock para rastreio background -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <!-- Receber boot para notificações persistentes -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

"@

$content = Get-Content $manifest -Raw
# Insere as permissões antes do <application
if ($content -notmatch "ACCESS_FINE_LOCATION") {
    $content = $content -replace "(<application)", "$permissions`$1"
    Set-Content $manifest $content -Encoding UTF8
    Write-Host "Permissoes inseridas no AndroidManifest.xml" -ForegroundColor Green
} else {
    Write-Host "Permissoes ja existem no AndroidManifest.xml" -ForegroundColor Gray
}

# 4. Sync Capacitor
Write-Host "`n[4/5] Sincronizando Capacitor..." -ForegroundColor Yellow
npx cap sync android

# 5. Abrir Android Studio
Write-Host "`n[5/5] Abrindo Android Studio..." -ForegroundColor Yellow
Write-Host "No Android Studio:" -ForegroundColor Cyan
Write-Host "  Build → Generate Signed Bundle / APK → APK → Next" -ForegroundColor White
Write-Host "  Crie ou selecione o keystore (guarde a senha!)" -ForegroundColor White
Write-Host "  Selecione 'release' → Finish" -ForegroundColor White
Write-Host "  APK gerado em: android/app/release/app-release.apk`n" -ForegroundColor White
npx cap open android
