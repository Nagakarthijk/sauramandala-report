#!/usr/bin/env bash
# DRIVE app installer — run on the ERPNext server as the frappe user
# Usage: bash install.sh <site-name> <anthropic-api-key>
# Example: bash install.sh erp.sauramandala.org sk-ant-api03-...
set -euo pipefail

SITE="${1:-}"
ANTHROPIC_KEY="${2:-}"

if [[ -z "$SITE" ]]; then
  echo "Usage: bash install.sh <site-name> [anthropic-api-key]"
  echo "Example: bash install.sh erp.sauramandala.org sk-ant-api03-..."
  exit 1
fi

BENCH_DIR="$(pwd)"

# ── 1. Copy app into bench apps/ directory ─────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_SRC="$SCRIPT_DIR/drive"

if [[ ! -d "$BENCH_DIR/apps/drive" ]]; then
  echo "→ Copying drive app into bench..."
  cp -r "$APP_SRC" "$BENCH_DIR/apps/drive"
else
  echo "→ Updating existing drive app..."
  rsync -a --delete "$APP_SRC/" "$BENCH_DIR/apps/drive/"
fi

# ── 2. Install Python package in bench virtualenv ──────────────────────────────
echo "→ Installing drive Python package..."
"$BENCH_DIR/env/bin/pip" install -e "$BENCH_DIR/apps/drive" --quiet

# ── 3. Install the app on the site ────────────────────────────────────────────
echo "→ Installing drive app on site: $SITE"
bench --site "$SITE" install-app drive

# ── 4. Run migrations ─────────────────────────────────────────────────────────
echo "→ Running database migrations..."
bench --site "$SITE" migrate

# ── 5. Configure Anthropic API key (optional) ─────────────────────────────────
if [[ -n "$ANTHROPIC_KEY" ]]; then
  echo "→ Setting Anthropic API key in site config..."
  bench --site "$SITE" set-config anthropic_api_key "$ANTHROPIC_KEY"
  echo "   AI voice extraction is now enabled."
else
  echo "   (Skipping Anthropic key — AI extraction disabled until you set it)"
  echo "   To enable later: bench --site $SITE set-config anthropic_api_key sk-ant-..."
fi

# ── 6. Create DRIVE roles ──────────────────────────────────────────────────────
echo "→ Ensuring DRIVE roles exist..."
bench --site "$SITE" execute drive.drive.drive.setup.create_roles

# ── 7. Restart services ───────────────────────────────────────────────────────
echo "→ Restarting bench..."
bench restart

echo ""
echo "✓ DRIVE app installed successfully on $SITE"
echo ""
echo "Next steps:"
echo "  1. Log into ERPNext as Administrator"
echo "  2. Go to: Setup → Users → create/invite field agents"
echo "  3. Assign role 'DRIVE Agent' to each field agent"
echo "  4. Set their Default Company in User → Default Settings"
echo "  5. Generate API key for each user: User → API Access → Generate API Key"
echo "  6. Share: API Key + API Secret + site URL with field agent (for PWA login)"
echo ""
