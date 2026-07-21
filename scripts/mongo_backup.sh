#!/usr/bin/env bash
set -euo pipefail

# Configuration
BACKUP_DIR="/home/ubuntu/talent-spotify-backend-nodejs/mongo-backup"
PROJECT_DIR="/home/ubuntu/talent-spotify-backend-nodejs"
RETENTION_COUNT=7
# Database name to dump (override: MONGO_DB_NAME=mydb ./mongo_backup.sh)
MONGO_DB_NAME="${MONGO_DB_NAME:-vihanga}"

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

log() {
  echo "[$(timestamp)] $*"
}

ensure_mongodump() {
  if ! command -v mongodump >/dev/null 2>&1; then
    log "ERROR: mongodump not found in PATH. Install MongoDB Database Tools and retry."
    exit 1
  fi
}

resolve_mongo_uri() {
  # Prefer DATABASE_URL from environment, else try to read from project's config/environment.js via Node
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "$DATABASE_URL"
    return 0
  fi

  local env_js="$PROJECT_DIR/config/environment.js"
  if [[ -f "$env_js" ]] && command -v node >/dev/null 2>&1; then
    # Attempt to load DATABASE_URL from environment.js
    local uri
    uri="$(node -e "try{console.log(require('$env_js').DATABASE_URL||'');}catch(e){process.exit(1)}" 2>/dev/null || true)"
    if [[ -n "$uri" ]]; then
      echo "$uri"
      return 0
    fi
  fi

  # Fallback (adjust if needed)
  echo ""
}

rotate_backups() {
  # Keep only the newest $RETENTION_COUNT backups matching backup-*.gz
  shopt -s nullglob
  local backups=( "$BACKUP_DIR"/backup-*.gz )
  local count="${#backups[@]}"
  if (( count > RETENTION_COUNT )); then
    # Sort by modification time descending, keep first RETENTION_COUNT, delete the rest
    mapfile -t sorted < <(ls -1t "$BACKUP_DIR"/backup-*.gz 2>/dev/null || true)
    local to_delete=( "${sorted[@]:RETENTION_COUNT}" )
    for f in "${to_delete[@]}"; do
      log "Removing old backup: $f"
      rm -f -- "$f"
    done
  fi
}

main() {
  ensure_mongodump
  mkdir -p "$BACKUP_DIR"

  local mongo_uri
  mongo_uri="$(resolve_mongo_uri)"
  if [[ -z "$mongo_uri" ]]; then
    log "ERROR: Could not resolve MongoDB URI. Set DATABASE_URL env var or ensure config/environment.js exposes DATABASE_URL."
    exit 1
  fi

  local date_str
  date_str="$(date +%F)"
  local archive_path="$BACKUP_DIR/backup-$date_str.archive.gz"

  log "Starting mongodump (database: $MONGO_DB_NAME) to $archive_path"
  mongodump \
    --uri="$mongo_uri" \
    --db="$MONGO_DB_NAME" \
    --archive="$archive_path" \
    --gzip
  log "Backup completed successfully."

  rotate_backups
  log "Rotation complete. Retained latest $RETENTION_COUNT backups."
}

main "$@"


