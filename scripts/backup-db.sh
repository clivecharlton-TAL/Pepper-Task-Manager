#!/bin/bash
#
# Pepper Task Manager — daily off-machine database backup.
#
# Dumps tasks.db to compressed SQL and commits it to a private GitHub repo.
# A SQL dump (rather than the binary .db) is used deliberately: git stores
# successive text dumps as deltas, so a year of daily snapshots costs a few MB
# and any past day can be restored exactly.
#
# Run by launchd (com.pepper.backup). Safe to run manually at any time.

set -uo pipefail

APP_DATA="$HOME/Library/Application Support/pepper-task-manager"
DB="$APP_DATA/tasks.db"
CONFIG="$APP_DATA/config.json"
REPO="$HOME/.pepper-backup"
LOG="$HOME/Library/Logs/pepper-backup.log"

mkdir -p "$(dirname "$LOG")"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S')  $*" >> "$LOG"; }

fail() { log "ERROR: $*"; exit 1; }

log "--- backup starting ---"

[ -f "$DB" ] || fail "database not found at $DB"
[ -d "$REPO/.git" ] || fail "backup repo missing at $REPO (run setup-backup.sh first)"

# Integrity-check before trusting the file. A corrupt source must never
# overwrite a known-good backup.
INTEGRITY=$(sqlite3 "$DB" "PRAGMA integrity_check;" 2>&1 | head -1)
if [ "$INTEGRITY" != "ok" ]; then
  fail "integrity check failed ($INTEGRITY) — refusing to overwrite good backup"
fi

# Dump via a temp copy so a concurrent app write can't tear the read.
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cp "$DB" "$TMP/snapshot.db" || fail "could not copy database"
sqlite3 "$TMP/snapshot.db" .dump > "$TMP/tasks.sql" 2>/dev/null || fail "dump failed"

# A dump far smaller than expected means something went wrong upstream.
DUMP_BYTES=$(wc -c < "$TMP/tasks.sql")
[ "$DUMP_BYTES" -gt 1000 ] || fail "dump suspiciously small (${DUMP_BYTES}B) — aborting"

# Verify the dump actually rebuilds before shipping it. This is the whole
# point of a backup, so it is checked every single run rather than assumed.
sqlite3 "$TMP/verify.db" < "$TMP/tasks.sql" 2>/dev/null || fail "dump does not rebuild"
VERIFY=$(sqlite3 "$TMP/verify.db" "PRAGMA integrity_check;" 2>&1 | head -1)
[ "$VERIFY" = "ok" ] || fail "rebuilt database failed integrity check"

SRC_TASKS=$(sqlite3 "$DB" "SELECT COUNT(*) FROM tasks;" 2>/dev/null)
DST_TASKS=$(sqlite3 "$TMP/verify.db" "SELECT COUNT(*) FROM tasks;" 2>/dev/null)
[ "$SRC_TASKS" = "$DST_TASKS" ] || fail "row count mismatch: $SRC_TASKS vs $DST_TASKS"

gzip -9 -c "$TMP/tasks.sql" > "$REPO/tasks.sql.gz" || fail "compression failed"

# Store config with the API key redacted: the settings shape is useful when
# restoring, but a live credential must not sit in a git repo.
if [ -f "$CONFIG" ]; then
  sed 's/"anthropicApiKey"[[:space:]]*:[[:space:]]*"[^"]*"/"anthropicApiKey": "REDACTED — re-enter in app settings"/' \
    "$CONFIG" > "$REPO/config.json" 2>/dev/null || log "warning: could not write config.json"
fi

# Record what this snapshot contains, so the repo is self-describing.
{
  echo "Backed up:    $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "Host:         $(hostname -s)"
  echo "Tasks:        $SRC_TASKS"
  echo "Notes:        $(sqlite3 "$DB" 'SELECT COUNT(*) FROM notes;' 2>/dev/null)"
  echo "Labels:       $(sqlite3 "$DB" 'SELECT COUNT(*) FROM labels;' 2>/dev/null)"
  echo "Sub-tasks:    $(sqlite3 "$DB" 'SELECT COUNT(*) FROM sub_tasks;' 2>/dev/null)"
  echo "Links:        $(sqlite3 "$DB" 'SELECT COUNT(*) FROM task_links;' 2>/dev/null)"
  echo "DB size:      $(du -h "$DB" | cut -f1)"
  echo "Dump size:    $(du -h "$REPO/tasks.sql.gz" | cut -f1) (gzipped)"
} > "$REPO/MANIFEST.txt"

cd "$REPO" || fail "could not enter $REPO"

git add -A >> "$LOG" 2>&1

# Compare against the index after staging: `git diff` alone reports no change
# for a file that is not yet tracked, which would skip the very first backup.
if git diff --cached --quiet 2>/dev/null; then
  log "no database changes since last backup — nothing to commit"
  # An earlier run may have committed while offline; try to ship it now.
  git push -q origin main >> "$LOG" 2>&1 && log "pushed pending commits" || true
  exit 0
fi
git commit -q -m "Backup $(date '+%Y-%m-%d %H:%M') — $SRC_TASKS tasks" >> "$LOG" 2>&1 \
  || fail "commit failed"

# Offline or asleep is normal and not an error: the commit is already made
# locally and will be pushed on the next successful run.
if git push -q origin main >> "$LOG" 2>&1; then
  log "backup pushed ($SRC_TASKS tasks, $(du -h "$REPO/tasks.sql.gz" | cut -f1))"
else
  log "push failed (likely offline) — commit retained, will push next run"
  exit 0
fi

log "--- backup complete ---"
