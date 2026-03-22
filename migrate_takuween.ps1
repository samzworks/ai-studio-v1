$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

Write-Host "=========================================="
Write-Host "  Takuween DB Clone and Cleanup"
Write-Host "=========================================="
Write-Host ""

if (-not (Test-Path "scripts/reset-generated-media.sql")) {
  Write-Error "scripts/reset-generated-media.sql not found."
}

function Ensure-PgPath {
  $versions = @("18", "17", "16", "15", "14", "13", "12")
  foreach ($v in $versions) {
    $candidate = "C:\Program Files\PostgreSQL\$v\bin"
    if (Test-Path "$candidate\psql.exe") {
      if (-not (($env:Path -split ';') -contains $candidate)) {
        $env:Path = "$candidate;$env:Path"
      }
      return
    }
  }
}

function Require-Cmd([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $name"
  }
}

function Read-DatabaseUrlFromEnv {
  if (-not (Test-Path ".env")) { return $null }
  $line = Get-Content ".env" | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  if (-not $line) { return $null }
  return $line.Substring("DATABASE_URL=".Length).Trim()
}

function Run-Step([string]$label, [scriptblock]$action) {
  Write-Host $label
  & $action
}

Ensure-PgPath
Require-Cmd "psql"
Require-Cmd "pg_dump"
Require-Cmd "pg_restore"

$localDbUrl = Read-DatabaseUrlFromEnv

$sourceDbUrl = Read-Host "Enter SOURCE database URL (original Replit DATABASE_URL)"
if ([string]::IsNullOrWhiteSpace($sourceDbUrl)) {
  throw "SOURCE_DB_URL is required."
}

if ([string]::IsNullOrWhiteSpace($localDbUrl)) {
  $localDbUrl = Read-Host "Enter LOCAL database URL (example: postgresql://postgres:postgres@localhost:5432/takuween)"
}
if ([string]::IsNullOrWhiteSpace($localDbUrl)) {
  throw "LOCAL_DB_URL is required."
}

Run-Step "[1/6] Checking source DB connectivity..." {
  & psql $sourceDbUrl -c "SELECT 1;" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Cannot connect to source DB URL." }
}

Run-Step "[2/6] Checking local DB connectivity..." {
  & psql $localDbUrl -c "SELECT 1;" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Cannot connect to local DB URL. Create local DB first." }
}

Run-Step "[3/6] Exporting source DB to source_full.dump..." {
  if (Test-Path "source_full.dump") { Remove-Item "source_full.dump" -Force }
  & pg_dump --no-owner --no-privileges --format=custom --file "source_full.dump" $sourceDbUrl
  if ($LASTEXITCODE -ne 0) { throw "Source dump export failed." }
}

Run-Step "[4/6] Restoring source dump into local DB..." {
  & pg_restore --clean --if-exists --no-owner --no-privileges --dbname $localDbUrl "source_full.dump"
  if ($LASTEXITCODE -ne 0) { throw "Restore into local DB failed." }
}

Run-Step "[5/6] Removing generated media and references from local DB..." {
  & psql $localDbUrl -f "scripts/reset-generated-media.sql"
  if ($LASTEXITCODE -ne 0) { throw "Media cleanup SQL failed." }
}

Run-Step "[6/6] Exporting cleaned local DB to takuween.dump..." {
  if (Test-Path "takuween.dump") { Remove-Item "takuween.dump" -Force }
  & pg_dump --no-owner --no-privileges --format=custom --file "takuween.dump" $localDbUrl
  if ($LASTEXITCODE -ne 0) { throw "Clean dump export failed." }
}

$importNow = Read-Host "Import takuween.dump into NEW Replit DB now? [y/N]"
if ($importNow -match '^(y|Y)$') {
  $targetDbUrl = Read-Host "Enter TARGET database URL (new Replit DATABASE_URL for takuween)"
  if (-not [string]::IsNullOrWhiteSpace($targetDbUrl)) {
    & pg_restore --clean --if-exists --no-owner --no-privileges --dbname $targetDbUrl "takuween.dump"
    if ($LASTEXITCODE -ne 0) { throw "Import to target DB failed." }
  } else {
    Write-Host "[INFO] TARGET_DB_URL empty. Skipping import."
  }
} else {
  Write-Host "[INFO] Skipped target DB import."
}

Write-Host ""
Write-Host "=========================================="
Write-Host "  Migration pipeline completed"
Write-Host "=========================================="
Write-Host "Source dump : $PSScriptRoot\source_full.dump"
Write-Host "Clean dump  : $PSScriptRoot\takuween.dump"

