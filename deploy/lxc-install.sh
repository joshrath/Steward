#!/bin/bash
# Run as root inside a fresh Debian 12 LXC. Builds Steward, starts it on :8080,
# and arms a daily job that pulls main and rebuilds when GitHub has moved.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root inside the container." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! id steward >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/steward --shell /usr/sbin/nologin steward
fi

if [ ! -d /opt/steward/.git ]; then
  rm -rf /opt/steward
  git clone https://github.com/joshrath/Steward.git /opt/steward
fi
chown -R steward:steward /opt/steward

sudo -u steward bash -lc 'cd /opt/steward && VITE_AUTH_ENABLED=false npm ci && VITE_AUTH_ENABLED=false npm run build'
install -m 0755 /opt/steward/deploy/upgrade.sh /opt/steward/deploy/upgrade.sh
install -m 0644 /opt/steward/deploy/steward.service /etc/systemd/system/steward.service
install -m 0644 /opt/steward/deploy/steward-upgrade.service /etc/systemd/system/steward-upgrade.service
install -m 0644 /opt/steward/deploy/steward-upgrade.timer /etc/systemd/system/steward-upgrade.timer
systemctl daemon-reload
systemctl enable --now steward
systemctl enable --now steward-upgrade.timer
echo "Steward is listening on port 8080. It checks GitHub every morning and upgrades itself."
