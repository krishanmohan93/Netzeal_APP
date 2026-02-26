#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/tmp/netzeal_backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="netzeal_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "${BACKUP_DIR}"

echo "Creating backup: ${FILEPATH}"
pg_dump "${DATABASE_URL}" | gzip > "${FILEPATH}"

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "${FILEPATH}" "s3://${BACKUP_S3_BUCKET}/${FILENAME}"
    echo "Uploaded backup to s3://${BACKUP_S3_BUCKET}/${FILENAME}"
  else
    echo "aws cli not found; skipping S3 upload"
  fi
fi

find "${BACKUP_DIR}" -type f -name "netzeal_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "Backup completed"
