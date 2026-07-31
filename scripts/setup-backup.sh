#!/bin/bash
#
# One-time setup for Pepper database backups.
#
# Creates a PRIVATE GitHub repo, clones it to ~/.pepper-backup, and installs a
# launchd job that backs up daily plus on wake. Safe to re-run.

set -uo pipefail

REPO_NAME="pepper-backups"
REPO="$HOME/.pepper-backup"
PLIST="$HOME/Library/LaunchAgents/com.pepper.backup.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v gh >/dev/null || { echo "ERROR: gh CLI not found"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated — run 'gh auth login'"; exit 1; }

OWNER=$(gh api user --jq .login)
echo "GitHub account: $OWNER"

# 1. Create the private repo if it does not already exist.
if gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  echo "Repo $OWNER/$REPO_NAME already exists — reusing it"
else
  echo "Creating PRIVATE repo $OWNER/$REPO_NAME..."
  gh repo create "$REPO_NAME" --private \
    --description "Automated Pepper Task Manager database backups" || exit 1
fi

# Refuse to continue if the repo is public — it holds business data.
VISIBILITY=$(gh repo view "$OWNER/$REPO_NAME" --json visibility --jq .visibility)
if [ "$VISIBILITY" != "PRIVATE" ]; then
  echo "ERROR: $OWNER/$REPO_NAME is $VISIBILITY, refusing to back up to it."
  exit 1
fi
echo "Visibility: $VISIBILITY"

# 2. Clone locally (this is a working copy, not the backup itself).
if [ ! -d "$REPO/.git" ]; then
  echo "Cloning to $REPO..."
  gh repo clone "$OWNER/$REPO_NAME" "$REPO" -- -q || exit 1
fi

cd "$REPO" || exit 1

# Use gh as the credential helper so the unattended job can push without a prompt.
git config credential.helper '!gh auth git-credential'
git config user.name  "$(git -C "$SCRIPT_DIR" config user.name  || echo 'Pepper Backup')"
git config user.email "$(git -C "$SCRIPT_DIR" config user.email || echo 'pepper@localhost')"

# Ensure a main branch exists with restore instructions.
if [ -z "$(git log --oneline -1 2>/dev/null)" ]; then
  cat > README.md <<'EOF'
# Pepper Task Manager — Database Backups

Automated daily backups of the Pepper task database. **Private repo — contains business data.**

## Contents

| File | Description |
|---|---|
| `tasks.sql.gz` | Gzipped SQL dump of `tasks.db`. Overwritten each backup; history lives in git. |
| `config.json` | App settings. **API key is redacted** — re-enter it in app settings after restoring. |
| `MANIFEST.txt` | What the latest snapshot contains (row counts, sizes, timestamp). |

## Restore the latest backup

```bash
git clone https://github.com/OWNER/pepper-backups.git
cd pepper-backups
gunzip -c tasks.sql.gz > tasks.sql
sqlite3 restored.db < tasks.sql
sqlite3 restored.db "PRAGMA integrity_check;"   # expect: ok

# Quit Pepper first, then:
cp restored.db "$HOME/Library/Application Support/pepper-task-manager/tasks.db"
```

## Restore a specific past day

```bash
git log --oneline                    # find the commit you want
git show <commit>:tasks.sql.gz | gunzip > old.sql
sqlite3 old.db < old.sql
```

## Why a SQL dump rather than the .db file

Git delta-compresses text well, so successive dumps cost far less than
successive binary files. Every backup is also verified to rebuild before it is
committed, so anything in this repo is known-restorable.
EOF
  git add README.md
  git commit -q -m "Initial commit — backup repo setup"
  git branch -M main
  git push -q -u origin main || { echo "ERROR: initial push failed"; exit 1; }
  echo "Initialised repo with README"
fi

# 3. Copy the backup script out of ~/Documents.
#    launchd agents do not inherit Full Disk Access, and ~/Documents is TCC
#    protected, so a job pointing there fails with "Operation not permitted"
#    (exit 126). Running it from ~/ avoids the protected path entirely.
RUNNER="$HOME/.pepper-backup-run.sh"
cp "$SCRIPT_DIR/backup-db.sh" "$RUNNER" || exit 1
chmod +x "$RUNNER"
echo "Installed runner at $RUNNER"

# 4. Install the launchd job.
#    StartCalendarInterval fires daily at 12:00. launchd runs a missed job when
#    the machine wakes, so a closed laptop delays the backup rather than
#    skipping it. StartInterval adds a 6-hourly safety net.
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pepper.backup</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$RUNNER</string>
    </array>

    <!-- launchd starts with a minimal PATH that omits Homebrew, so the gh
         credential helper would not be found when the token needs refreshing. -->
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key><integer>12</integer>
        <key>Minute</key><integer>0</integer>
    </dict>

    <key>StartInterval</key>
    <integer>21600</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/pepper-backup.out</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/pepper-backup.err</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/com.pepper.backup" 2>/dev/null
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || {
  echo "WARNING: could not load launchd job automatically."
  echo "Run: launchctl bootstrap gui/$(id -u) $PLIST"
}

echo
echo "Setup complete."
echo "  Repo:     https://github.com/$OWNER/$REPO_NAME (private)"
echo "  Local:    $REPO"
echo "  Runner:   $RUNNER"
echo "  Schedule: daily 12:00, plus every 6h, plus on wake"
echo "  Log:      ~/Library/Logs/pepper-backup.log"
echo
echo "Note: launchd runs the copy at \$RUNNER, not the repo script."
echo "After editing scripts/backup-db.sh, re-run this setup to reinstall it."
