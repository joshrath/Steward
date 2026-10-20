#!/bin/bash
# Pull Steward from GitHub and, when main has moved, rebuild and restart.
# The script updates itself: after a fast-forward it runs the new copy once.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run upgrade as root." >&2
  exit 1
fi

APP=/opt/steward
if [ ! -d "$APP/.git" ]; then
  echo "No git checkout at $APP. Run deploy/lxc-install.sh first." >&2
  exit 1
fi

sudo -u steward git -C "$APP" fetch origin main
local_rev=$(sudo -u steward git -C "$APP" rev-parse HEAD)
remote_rev=$(sudo -u steward git -C "$APP" rev-parse origin/main)

if [ "$local_rev" != "$remote_rev" ]; then
  sudo -u steward git -C "$APP" merge --ff-only origin/main
  if [ "${STEWARD_UPGRADE_REEXEC:-}" != "1" ]; then
    export STEWARD_UPGRADE_REEXEC=1
    exec "$APP/deploy/upgrade.sh"
  fi
fi

if [ "${STEWARD_UPGRADE_REEXEC:-}" != "1" ]; then
  echo "Steward is current ($(sudo -u steward git -C "$APP" rev-parse --short HEAD))."
  exit 0
fi

chown -R steward:steward "$APP"
sudo -u steward bash -lc "cd '$APP' && VITE_AUTH_ENABLED=false npm ci && VITE_AUTH_ENABLED=false npm run build"
install -m 0644 "$APP/deploy/steward.service" /etc/systemd/system/steward.service
install -m 0644 "$APP/deploy/steward-upgrade.service" /etc/systemd/system/steward-upgrade.service
install -m 0644 "$APP/deploy/steward-upgrade.timer" /etc/systemd/system/steward-upgrade.timer
systemctl daemon-reload
systemctl enable steward-upgrade.timer
systemctl restart steward
echo "Upgraded Steward to $(sudo -u steward git -C "$APP" rev-parse --short HEAD)."
