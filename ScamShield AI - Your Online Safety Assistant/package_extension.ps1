# ScamShield AI - Chrome Web Store Packaging Script
$sourceDir = $PSScriptRoot
$distDir = Join-Path $sourceDir "dist"
$zipPath = Join-Path $distDir "ScamShield-AI-v1.0.0.zip"
$tempStaging = Join-Path $distDir "staging"

Write-Host "Packaging ScamShield AI for Chrome Web Store..."

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

if (Test-Path $tempStaging) {
    Remove-Item -Path $tempStaging -Recurse -Force | Out-Null
}
New-Item -ItemType Directory -Path $tempStaging -Force | Out-Null

if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force | Out-Null
}

$includeItems = @(
    "manifest.json",
    "icons",
    "popup",
    "background",
    "content",
    "lib"
)

foreach ($item in $includeItems) {
    $src = Join-Path $sourceDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $tempStaging -Recurse -Force
        Write-Host "  + Included: $item"
    }
}

Compress-Archive -Path "$tempStaging\*" -DestinationPath $zipPath -Force
Remove-Item -Path $tempStaging -Recurse -Force | Out-Null

$zipSize = [Math]::Round(((Get-Item $zipPath).Length / 1KB), 2)
Write-Host "SUCCESS: Package created at $zipPath ($zipSize KB)"
