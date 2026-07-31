#!/bin/bash
#
# Pepper backup watchdog.
#
# Deliberately a SEPARATE launchd job from the backup itself. If the backup job
# is disabled, unloaded, or silently failing, the backup cannot report on its
# own absence — something outside it has to notice the silence.
#
# Alerts if no successful backup has completed within STALE_HOURS.

LOG="$HOME/Library/Logs/pepper-backup.log"
STALE_HOURS=36
LABEL="com.pepper.backup"

notify() {
  osascript -e "display notification \"$1\" with title \"⚠️ Pepper Backup\" sound name \"Basso\"" \
    >/dev/null 2>&1 || true
}

# Is the backup job even installed any more?
if ! launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  notify "Backup job is NOT INSTALLED. Your database is unprotected."
  exit 1
fi

if [ ! -f "$LOG" ]; then
  notify "No backup log found. Backups may never have run."
  exit 1
fi

last=$(grep "backup pushed\|nothing to commit" "$LOG" | tail -1)
if [ -z "$last" ]; then
  notify "No successful backup recorded yet."
  exit 1
fi

last_epoch=$(date -j -f "%Y-%m-%d %H:%M:%S" "${last:0:19}" "+%s" 2>/dev/null)
[ -n "$last_epoch" ] || exit 0

hours=$(( ( $(date +%s) - last_epoch ) / 3600 ))
if [ "$hours" -ge "$STALE_HOURS" ]; then
  notify "No backup in ${hours}h. Run: bash scripts/backup-status.sh"
  exit 1
fi

exit 0
