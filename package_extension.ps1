# Bible Hover - Chrome Web Store Packaging Script
# Run this script whenever you update your extension to produce a fresh zip in dist/

$sourceDir = "$PSScriptRoot\extension"
$distDir = "$PSScriptRoot\dist"
if (!(Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }

# Read version from manifest
$manifest = Get-Content "$sourceDir\manifest.json" | ConvertFrom-Json
$version = $manifest.version
$zipPath = "$distDir\Bible-Hover-v$version.zip"

Write-Host "Packaging Bible Hover v$version..." -ForegroundColor Cyan

# Stage files (excluding development and test files)
$stagingDir = "$distDir\staging"
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDir | Out-Null

Copy-Item -Path "$sourceDir\*" -Destination $stagingDir -Recurse -Exclude "test-page.html"

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$stagingDir\*" -DestinationPath $zipPath -Force
Remove-Item $stagingDir -Recurse -Force

$zipFile = Get-Item $zipPath
$sizeMb = [math]::Round($zipFile.Length / 1MB, 2)
Write-Host "Success! Created $zipPath ($sizeMb MB)" -ForegroundColor Green
Write-Host "Ready to upload to Chrome Web Store Developer Console!" -ForegroundColor Yellow
