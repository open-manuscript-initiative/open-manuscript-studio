param(
  [Parameter(Mandatory = $true)][string]$ContentRoot,
  [Parameter(Mandatory = $true)][string]$OutputFile
)
$ErrorActionPreference = 'Stop'
$kits = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
if (-not (Test-Path -LiteralPath $kits)) { throw 'Windows SDK is required for MakeAppx.' }
$makeAppx = Get-ChildItem -LiteralPath $kits -Filter 'makeappx.exe' -Recurse -File |
  Where-Object { $_.FullName -match '\\x64\\makeappx\.exe$' } |
  Sort-Object { [version]($_.Directory.Parent.Name) } -Descending |
  Select-Object -First 1
if (-not $makeAppx) { throw 'Windows SDK x64 MakeAppx.exe not found.' }
if (-not (Test-Path (Join-Path $ContentRoot 'AppxManifest.xml'))) { throw 'MSIX stage has no AppxManifest.xml.' }
$outputParent = Split-Path -Parent $OutputFile
New-Item -ItemType Directory -Force -Path $outputParent | Out-Null
& $makeAppx.FullName pack /v /h SHA256 /d (Resolve-Path $ContentRoot).Path /p $OutputFile
if ($LASTEXITCODE -ne 0) { throw "MakeAppx failed with exit code $LASTEXITCODE" }
if (-not (Test-Path $OutputFile) -or (Get-Item $OutputFile).Length -eq 0) { throw 'Missing or empty MSIX output.' }
Write-Host "Unsigned MSIX created: $OutputFile"
