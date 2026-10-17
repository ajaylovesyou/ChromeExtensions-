# Packaging script for Grammarly - AI Writing Assistant

$extDir = "E:\Goal\Extension\Grammarly - AI Writing Assistant"
$distDir = Join-Path $extDir "dist"
$rootZip = "E:\Goal\Extension\Grammarly - AI Writing Assistant.zip"
$version = "1.0.0"
$distZip = Join-Path $distDir "Grammarly-AI-Writing-Assistant-v$version.zip"

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

# Remove existing zip files if present
if (Test-Path $distZip) { Remove-Item $distZip -Force }
if (Test-Path $rootZip) { Remove-Item $rootZip -Force }

# List of files and folders to include
$includeItems = @(
    "manifest.json",
    "background",
    "content",
    "lib",
    "popup",
    "options",
    "icons",
    "test",
    "README.md"
)

# Temporary staging directory
$stageDir = Join-Path $env:TEMP "Grammarly-AI-Stage"
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

foreach ($item in $includeItems) {
    $src = Join-Path $extDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $stageDir -Recurse -Force
    }
}

# Create zip in dist and root
Compress-Archive -Path "$stageDir\*" -DestinationPath $distZip -Force
Copy-Item -Path $distZip -Destination $rootZip -Force

# Clean staging
Remove-Item $stageDir -Recurse -Force

Write-Host "✅ Extension packaged successfully!" -ForegroundColor Green
Write-Host "📦 Dist Zip: $distZip"
Write-Host "📦 Root Zip: $rootZip"
