#!/usr/bin/env bash
#
# Update a production zFamily install to the latest code and restart it.
# Run this from the app directory on the device (e.g. /opt/zfamily):
#
#   ./scripts/update.sh
#
# Your data lives in ZFAMILY_DATA_DIR (not the app dir), so updates never touch
# the database — schema migrations run automatically on the next boot. If a
# build fails, the old build keeps serving until a successful restart.
#
# Options:
#   SERVICE=zfamily        systemd service name to restart (default: zfamily)
#   BRANCH=main            git branch/tag to check out (default: current branch)
#   NO_RESTART=1           build only, don't restart the service
#   RELOAD_KIOSK=1         also hard-reload the Chromium kiosk tab (needs xdotool + DISPLAY)

set -euo pipefail

SERVICE="${SERVICE:-zfamily}"
NO_RESTART="${NO_RESTART:-0}"
RELOAD_KIOSK="${RELOAD_KIOSK:-0}"

# Run from the repo root regardless of where the script was invoked.
cd "$(dirname "$0")/.."
echo "==> Updating zFamily in $(pwd)"

echo "==> Fetching latest code"
git fetch --all --prune
if [ -n "${BRANCH:-}" ]; then
  echo "==> Checking out ${BRANCH}"
  git checkout "${BRANCH}"
fi
git pull --ff-only

echo "==> Installing dependencies"
npm install

echo "==> Building (Turbopack + type-check)"
npm run build

if [ "${NO_RESTART}" = "1" ]; then
  echo "==> NO_RESTART=1 set — skipping service restart"
else
  echo "==> Restarting service '${SERVICE}'"
  sudo systemctl restart "${SERVICE}"
  sleep 2
  sudo systemctl status "${SERVICE}" --no-pager || true
fi

if [ "${RELOAD_KIOSK}" = "1" ]; then
  echo "==> Hard-reloading the Chromium kiosk tab"
  DISPLAY="${DISPLAY:-:0}" xdotool key ctrl+shift+r || echo "   (couldn't reach the display — reload the kiosk manually)"
fi

echo "==> Done. zFamily is up to date."
