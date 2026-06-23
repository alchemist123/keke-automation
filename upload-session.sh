#!/usr/bin/env bash
set -euo pipefail

if [ ! -f keka-session.json ]; then
  echo "keka-session.json not found — run 'npm run login' first."
  exit 1
fi

if ! command -v gh &>/dev/null; then
  echo "GitHub CLI (gh) not installed. Install it: https://cli.github.com"
  exit 1
fi

SESSION_B64=$(base64 < keka-session.json)
echo "$SESSION_B64" | gh secret set KEKA_SESSION
echo "Uploaded session to GitHub secret KEKA_SESSION."
