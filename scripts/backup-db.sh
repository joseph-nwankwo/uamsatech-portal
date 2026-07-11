#!/usr/bin/env bash
# Dumps the database to a timestamped, compressed file and prunes backups
# older than RETENTION_DAYS. Requires pg_dump (part of any standard
# PostgreSQL client install) and $DATABASE_URL to be set. Verified for real
# against the live local database (2026-07-11) — a full backup, plus a
# restore into a scratch database with row counts confirmed to match exactly.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/uamsatech-$TIMESTAMP.dump"

mkdir -p "$BACKUP_DIR"

echo "Backing up database to $OUT_FILE ..."
# Custom format (-Fc): compressed, and restorable with pg_restore's
# selective-table/parallel-restore options — plain SQL dumps can't do either.
pg_dump "$DATABASE_URL" -Fc -f "$OUT_FILE"

echo "Backup complete: $(du -h "$OUT_FILE" | cut -f1)"

echo "Pruning backups older than $RETENTION_DAYS days ..."
find "$BACKUP_DIR" -name "uamsatech-*.dump" -type f -mtime "+$RETENTION_DAYS" -print -delete

echo "Done."
