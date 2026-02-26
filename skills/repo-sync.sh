#!/usr/bin/env bash
# Sync workspace skills + specs to GitHub repo
# Run daily via cron or manually

set -euo pipefail

WORKSPACE="/Users/marcusrawlins/.openclaw/workspace"
REPO="/tmp/openclaw-platform"
SKILLS_DIR="$WORKSPACE/skills"
SPECS_DIR="$WORKSPACE/specs"

# Ensure repo exists
if [ ! -d "$REPO/.git" ]; then
  git clone https://github.com/MarcusRawlins/openclaw-platform.git "$REPO"
fi

cd "$REPO"
git pull origin main --rebase 2>/dev/null || true

# Sync all modules
for module_dir in "$SKILLS_DIR"/*/; do
  module=$(basename "$module_dir")
  rm -rf "modules/$module"
  cp -r "$module_dir" "modules/$module"
  rm -rf "modules/$module/node_modules"
done

# Sync specs
rm -rf specs/
mkdir -p specs/
cp "$SPECS_DIR"/*.md specs/ 2>/dev/null || true

# Sync README if it exists in workspace
[ -f "$REPO/README.md" ] || true

# Check for secrets before committing
if grep -rl "sk_live\|sk_test_[a-zA-Z0-9]\{20,\}\|rk_live\|pk_live" modules/ 2>/dev/null; then
  echo "ERROR: Secrets detected. Aborting push."
  exit 1
fi

# Commit and push if there are changes
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  DATE=$(date +%Y-%m-%d)
  CHANGED=$(git diff --cached --stat | tail -1)
  git commit -m "Sync $DATE: $CHANGED"
  git push origin main
  echo "Pushed: $CHANGED"
else
  echo "No changes to sync."
fi
