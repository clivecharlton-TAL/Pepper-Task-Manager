#!/bin/bash
#
# Pepper backup health check. Answers one question: are my backups working?
#
#   bash scripts/backup-status.sh
#
# Exits non-zero if anything is wrong, so it can also be used as a monitor.

REPO="$HOME/.pepper-backup"
LOG="$HOME/Library/Logs/pepper-backup.log"
LABEL="com.pepper.backup"
STALE_HOURS=36

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BOLD=$'\033[1m'; OFF=$'\033[0m'
problems=0

echo
echo "${BOLD}Pepper Database Backup — Status${OFF}"
echo "────────────────────────────────────────────"

# 1. Is the scheduled job installed and enabled?
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  exit_code=$(launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | awk '/last exit code/{print $NF}')
  if [ "${exit_code:-0}" = "0" ]; then
    echo "${GREEN}✓${OFF} Scheduler      enabled (daily 12:00, every 6h, on wake)"
  else
    echo "${RED}✗${OFF} Scheduler      enabled but last run FAILED (exit $exit_code)"
    problems=$((problems + 1))
  fi
else
  echo "${RED}✗${OFF} Scheduler      NOT INSTALLED — backups are not running!"
  echo "                 Fix: bash scripts/setup-backup.sh"
  problems=$((problems + 1))
fi

# 2. How recent is the last successful backup?
if [ -f "$LOG" ]; then
  last=$(grep "backup pushed" "$LOG" | tail -1)
  if [ -n "$last" ]; then
    last_ts="${last:0:19}"
    last_epoch=$(date -j -f "%Y-%m-%d %H:%M:%S" "$last_ts" "+%s" 2>/dev/null)
    if [ -n "$last_epoch" ]; then
      hours=$(( ( $(date +%s) - last_epoch ) / 3600 ))
      if [ "$hours" -lt "$STALE_HOURS" ]; then
        echo "${GREEN}✓${OFF} Last backup    $last_ts (${hours}h ago)"
      else
        echo "${RED}✗${OFF} Last backup    $last_ts (${hours}h ago — STALE)"
        problems=$((problems + 1))
      fi
    fi
  else
    echo "${RED}✗${OFF} Last backup    never completed"
    problems=$((problems + 1))
  fi
else
  echo "${YELLOW}!${OFF} Last backup    no log yet"
fi

# 3. Is the remote actually holding the data?
if [ -d "$REPO/.git" ]; then
  cd "$REPO" || exit 1
  unpushed=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l | tr -d ' ')
  commits=$(git log --oneline 2>/dev/null | wc -l | tr -d ' ')
  if [ "$unpushed" = "0" ]; then
    echo "${GREEN}✓${OFF} Off-machine    synced to GitHub ($commits snapshots)"
  else
    echo "${YELLOW}!${OFF} Off-machine    $unpushed commit(s) not yet pushed (offline?)"
  fi
  [ -f "$REPO/MANIFEST.txt" ] && {
    echo
    echo "${BOLD}Latest snapshot${OFF}"
    sed 's/^/  /' "$REPO/MANIFEST.txt"
  }
else
  echo "${RED}✗${OFF} Off-machine    local repo missing at $REPO"
  problems=$((problems + 1))
fi

echo "────────────────────────────────────────────"
if [ "$problems" -eq 0 ]; then
  echo "${GREEN}${BOLD}Backups healthy.${OFF}"
else
  echo "${RED}${BOLD}$problems problem(s) found — backups may not be protecting you.${OFF}"
fi
echo
exit "$problems"
