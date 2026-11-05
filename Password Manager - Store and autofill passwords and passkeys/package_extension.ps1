# Packaging script for Bitwarden Password Manager - Store and autofill passwords and passkeys
# Generates Chrome Web Store & Edge Add-ons compliant ZIP packages

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$extDir = "E:\Goal\Extension\Bitwarden Password Manager - Store and autofill passwords and passkeys"
$distDir = Join-Path $extDir "dist"
$version = "1.0.0"
$distZip = Join-Path $distDir "CipherVault-v$version.zip"
$legacyZip = Join-Path $distDir "Bitwarden-Password-Manager-v$version.zip"
$rootZip = "E:\Goal\Extension\CipherVault - Store and autofill passwords and passkeys.zip"
$legacyRootZip = "E:\Goal\Extension\Bitwarden Password Manager - Store and autofill passwords and passkeys.zip"

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

if (Test-Path $distZip) { Remove-Item $distZip -Force }
if (Test-Path $rootZip) { Remove-Item $rootZip -Force }

$includeItems = @(
    "manifest.json",
    "background",
    "content",
    "lib",
    "popup",
    "options",
    "icons",
    "test"
)

$stageDir = Join-Path $env:TEMP "Bitwarden-Stage"
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

foreach ($item in $includeItems) {
    $src = Join-Path $extDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $stageDir -Recurse -Force
    }
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($stageDir, $distZip)
Copy-Item -Path $distZip -Destination $legacyZip -Force
Copy-Item -Path $distZip -Destination $rootZip -Force
Copy-Item -Path $distZip -Destination $legacyRootZip -Force

# Clean up staging
Remove-Item $stageDir -Recurse -Force

$zipInfo = Get-Item $distZip
$sizeKb = [Math]::Round($zipInfo.Length / 1KB, 2)

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " CipherVault Extension Packaged Successfully!" -ForegroundColor Green
Write-Host " Package: $distZip ($sizeKb KB)" -ForegroundColor Cyan
Write-Host " Root:    $rootZip" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
