#!/bin/bash
# Run on the Proxmox host, not inside a guest.
# Creates an unprivileged Debian 12 LXC on vmbr0 and installs Steward in it.
# Run it again later and, if that CT already exists, it upgrades Steward instead.
#
#   CTID=120 bash deploy/proxmox-create.sh
#   CTID=120 IP=192.168.1.45/24 GW=192.168.1.1 bash deploy/proxmox-create.sh
set -euo pipefail

CTID="${CTID:-120}"
BRIDGE="${BRIDGE:-vmbr0}"
STORAGE="${STORAGE:-local-lvm}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
IP="${IP:-dhcp}"
GW="${GW:-}"
CORES="${CORES:-2}"
MEMORY="${MEMORY:-3072}"
DISK="${DISK:-12}"

if ! command -v pct >/dev/null 2>&1; then
  echo "pct was not found. Run this on the Proxmox host." >&2
  exit 1
fi

if pct status "$CTID" >/dev/null 2>&1; then
  echo "CT $CTID is already here. Upgrading Steward inside it."
  pct exec "$CTID" -- bash -lc 'if [ -x /opt/steward/deploy/upgrade.sh ]; then /opt/steward/deploy/upgrade.sh; else curl -fsSL https://raw.githubusercontent.com/joshrath/Steward/main/deploy/lxc-install.sh | bash; fi'
  pct exec "$CTID" -- hostname -I || true
  exit 0
fi

pveam update
TEMPLATE="$(pveam available --section system | awk '/debian-12-standard/ { print $2 }' | sort | tail -1)"
if [ -z "$TEMPLATE" ]; then
  echo "No Debian 12 template in the appliance list." >&2
  exit 1
fi
pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"

NET="name=eth0,bridge=${BRIDGE},ip=${IP},type=veth"
if [ "$IP" != "dhcp" ]; then
  if [ -z "$GW" ]; then
    echo "Set GW when IP is static. Example: GW=192.168.1.1" >&2
    exit 1
  fi
  NET="${NET},gw=${GW}"
fi

pct create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --hostname steward \
  --cores "$CORES" \
  --memory "$MEMORY" \
  --swap 512 \
  --rootfs "${STORAGE}:${DISK}" \
  --net0 "$NET" \
  --unprivileged 1 \
  --onboot 1 \
  --start 0

pct start "$CTID"
for _ in $(seq 1 30); do
  pct exec "$CTID" -- true && break
  sleep 2
done

pct exec "$CTID" -- bash -c 'apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl'
pct exec "$CTID" -- bash -c 'curl -fsSL https://raw.githubusercontent.com/joshrath/Steward/main/deploy/lxc-install.sh | bash'
echo "Container $CTID is up. Open http://<its-lan-address>:8080"
pct exec "$CTID" -- hostname -I || true
