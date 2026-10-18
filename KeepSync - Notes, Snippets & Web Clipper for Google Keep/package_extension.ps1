# Packaging script for KeepSync - Notes, Snippets & Web Clipper for Google Keep
# Generates Chrome Web Store compliant ZIP package with standard forward-slash directory paths

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$extDir = "E:\Goal\Extension\KeepSync - Notes, Snippets & Web Clipper for Google Keep"
$distDir = Join-Path $extDir "dist"
$rootZip = "E:\Goal\Extension\KeepSync - Notes, Snippets & Web Clipper for Google Keep.zip"
$version = "1.0.0"
$distZip = Join-Path $distDir "KeepSync-Notes-Snippets-Web-Clipper-v$version.zip"

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

# Remove existing zip files if present
if (Test-Path $distZip) { Remove-Item $distZip -Force }
if (Test-Path $rootZip) { Remove-Item $rootZip -Force }

# List of files and folders to include in production Chrome Web Store zip
$includeItems = @(
    "manifest.json",
    "background",
    "content",
    "lib",
    "popup",
    "options",
    "icons"
)

# Temporary staging directory
$stageDir = Join-Path $env:TEMP "KeepSync-Stage"
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

foreach ($item in $includeItems) {
    $src = Join-Path $extDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $stageDir -Recurse -Force
    } else {
        Write-Warning "Item not found to package: $item"
    }
}

# Build ZIP using System.IO.Compression.ZipArchive to enforce forward slash '/' paths (CWS compliant)
$zipFileStream = [System.IO.File]::Create($distZip)
$archive = New-Object System.IO.Compression.ZipArchive($zipFileStream, [System.IO.Compression.ZipArchiveMode]::Create)

$allFiles = Get-ChildItem -Path $stageDir -Recurse -File
foreach ($file in $allFiles) {
    $relPath = $file.FullName.Substring($stageDir.Length).TrimStart('\', '/').Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relPath, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}

$archive.Dispose()
$zipFileStream.Dispose()

# Copy to root folder as well
Copy-Item -Path $distZip -Destination $rootZip -Force

# Clean staging directory
Remove-Item $stageDir -Recurse -Force

$distSize = (Get-Item $distZip).Length / 1KB
$roundedSize = [Math]::Round($distSize, 2)

Write-Host "[SUCCESS] Extension packaged successfully with standard Unix '/' separators!" -ForegroundColor Green
Write-Host "[PACKAGE] Chrome Web Store Ready Zip: $distZip ($roundedSize KB)"
Write-Host "[PACKAGE] Root Zip: $rootZip"
