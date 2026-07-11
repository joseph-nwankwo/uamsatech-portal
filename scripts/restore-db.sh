#!/usr/bin/env bash
# Restores a database dump produced by backup-db.sh. Requires pg_restore
# (same Postgres client install as pg_dump) and $DATABASE_URL. Verified for
# real (2026-07-11) against a scratch database — this caught and fixed a real
# bug: pg_restore needs the connection string via -d, not as a bare
# positional argument (the positional slot is the dump FILE).
#
# Usage: ./scripts/restore-db.sh path/to/uamsatech-<timestamp>.dump
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

DUMP_FILE="${1:?Usage: restore-db.sh <path-to-dump-file>}"
if [ ! -f "$DUMP_FILE" ]; then
  echo "File not found: $DUMP_FILE" >&2
  exit 1
fi

echo "This will overwrite existing data in the database at:"
echo "  $DATABASE_URL"
read -r -p "Type 'restore' to continue: " CONFIRM
if [ "$CONFIRM" != "restore" ]; then
  echo "Aborted."
  exit 1
fi

echo "Restoring from $DUMP_FILE ..."
# --clean drops existing objects before recreating them; --if-exists avoids
# noisy errors on a fresh/empty target database. The connection target must
# go through -d — pg_restore's only bare positional argument is the dump
# FILE, not the database.
pg_restore -d "$DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$DUMP_FILE"

echo "Restore complete."
