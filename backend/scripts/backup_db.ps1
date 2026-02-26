Param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$BackupDir = $(if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { ".\\backups" }),
  [int]$RetentionDays = $(if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 7 })
)

if (-not $DatabaseUrl) {
  throw "DATABASE_URL is required"
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump is required and not found in PATH"
}

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$filePath = Join-Path $BackupDir "netzeal_$timestamp.sql"

Write-Host "Creating backup: $filePath"
pg_dump $DatabaseUrl | Out-File -FilePath $filePath -Encoding utf8

Get-ChildItem -Path $BackupDir -Filter "netzeal_*.sql" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
  Remove-Item -Force

Write-Host "Backup completed"
