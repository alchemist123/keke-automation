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

# Strip localStorage (origins) — only cookies are needed for auth.
# Full session is ~180KB (over GitHub's 48KB secret limit); cookies alone are ~6KB.
SLIM=$(python3 -c "
import json, sys
with open('keka-session.json') as f:
    d = json.load(f)
json.dump({'cookies': d['cookies'], 'origins': []}, sys.stdout, separators=(',', ':'))
")

SESSION_B64=$(echo "$SLIM" | base64)
echo "$SESSION_B64" | gh secret set KEKA_SESSION
echo "Uploaded session to GitHub secret KEKA_SESSION (cookies only, $(echo "$SESSION_B64" | wc -c | tr -d ' ') bytes)."
