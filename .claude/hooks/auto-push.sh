#!/usr/bin/env bash
# Commit any pending changes and push to origin/main at the end of each Claude turn.
set -e
cd "$(git rev-parse --show-toplevel)"
git add -A
git diff --cached --quiet && exit 0
files=$(git diff --cached --name-only | head -5 | tr '\n' ' ')
count=$(git diff --cached --name-only | wc -l | tr -d ' ')
git commit -q -m "Auto-commit: update ${count} file(s): ${files}" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD:main
echo "{\"systemMessage\": \"Auto-pushed $(git rev-parse --short HEAD) to origin/main\"}"
