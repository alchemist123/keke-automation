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

# Gzip the full session (including localStorage) then base64-encode.
# Raw JSON is ~180KB (over GitHub's 48KB secret limit); gzipped is ~37KB.
SESSION_B64=$(gzip -c keka-session.json | base64)
SIZE=$(echo "$SESSION_B64" | wc -c | tr -d ' ')

if [ "$SIZE" -gt 48000 ]; then
  echo "Error: compressed session is ${SIZE} bytes — still over GitHub's 48KB limit."
  exit 1
fi

echo "$SESSION_B64" | gh secret set KEKA_SESSION
echo "Uploaded session to GitHub secret KEKA_SESSION (gzipped, ${SIZE} bytes)."
