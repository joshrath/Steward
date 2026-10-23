#!/bin/bash
# Create one unprivileged LXC for Steward, or upgrade that same container.
# Run on the Proxmox host as root.
#
# This script will not reboot the node, will not edit the host network,
# and will not stop, destroy, or reconfigure any other guest.
#
#   bash proxmox-create.sh --dry-run
#   CTID=130 bash proxmox-create.sh
#   STEWARD_REF=<tag-or-commit> bash proxmox-create.sh   # pin the in-container installer (default: main)
#   CTID=130 IP=192.168.1.45/24 GW=192.168.1.1 bash proxmox-create.sh
set -euo pipefail

CTID="${CTID:-130}"
BRIDGE="${BRIDGE:-vmbr0}"
STORAGE="${STORAGE:-local-lvm}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
STEWARD_REF="${STEWARD_REF:-main}"
IP="${IP:-dhcp}"
GW="${GW:-}"
CORES="${CORES:-2}"
MEMORY="${MEMORY:-0}"
DISK="${DISK:-12}"
DRY_RUN=0
ROOT="${STEWARD_TEST_ROOT:-}"

case "$#:${1:-}" in
  0:) ;;
  1:--dry-run) DRY_RUN=1 ;;
  *) printf 'Refusing: unknown arguments: %s. The only option is --dry-run.\n' "$*" >&2; exit 2 ;;
esac

say() { printf '%s\n' "$*"; }
die() { printf 'Refusing: %s\n' "$*" >&2; exit 1; }

say "Steward installer revision 4"

[ "$(id -u)" -eq 0 ] || die "run this as root on the Proxmox host."
command -v pct >/dev/null 2>&1 || die "pct is not installed. This is not a Proxmox node."
command -v pvesm >/dev/null 2>&1 || die "pvesm is not installed. This is not a Proxmox node."
command -v pveam >/dev/null 2>&1 || die "pveam is not installed. This is not a Proxmox node."

[[ "$CTID" =~ ^[0-9]+$ ]] || die "CTID must be a number."
[ "$CTID" -ge 100 ] || die "CTID must be 100 or higher so it cannot collide with a system id."
[[ "$DISK" =~ ^[0-9]+$ ]] || die "DISK must be a whole number of gigabytes."
[ "$DISK" -ge 8 ] && [ "$DISK" -le 32 ] || die "DISK must be between 8 and 32 GB."
[[ "$STEWARD_REF" =~ ^[A-Za-z0-9._/-]+$ ]] || die "STEWARD_REF must be a branch, tag, or commit id."
[[ "$CORES" =~ ^[0-9]+$ ]] || die "CORES must be a number."
[ "$CORES" -ge 1 ] && [ "$CORES" -le 4 ] || die "CORES must be from 1 to 4."

if [ -n "$ROOT" ]; then
  meminfo="$ROOT/proc/meminfo"
  storage_cfg="$ROOT/etc/pve/storage.cfg"
  interfaces="$ROOT/etc/network/interfaces"
  lxc_conf="$ROOT/etc/pve/lxc/${CTID}.conf"
  qemu_conf="$ROOT/etc/pve/qemu-server/${CTID}.conf"
else
  meminfo=/proc/meminfo
  storage_cfg=/etc/pve/storage.cfg
  interfaces=/etc/network/interfaces
  lxc_conf="/etc/pve/lxc/${CTID}.conf"
  qemu_conf="/etc/pve/qemu-server/${CTID}.conf"
fi

[ -f "$meminfo" ] || die "cannot read memory info."
avail_kb=$(awk '/^MemAvailable:/ { print $2 }' "$meminfo")
[ -n "$avail_kb" ] || die "MemAvailable was not in the memory info."
avail_mb=$((avail_kb / 1024))

if [ "$MEMORY" = "0" ]; then
  if [ "$avail_mb" -ge 5120 ]; then
    MEMORY=3072
  else
    MEMORY=2048
  fi
fi
[[ "$MEMORY" =~ ^[0-9]+$ ]] || die "MEMORY must be a number of megabytes."
[ "$MEMORY" -ge 1536 ] && [ "$MEMORY" -le 4096 ] || die "MEMORY must be from 1536 to 4096 MB."
need_mb=$((MEMORY + 1536))
[ "$avail_mb" -ge "$need_mb" ] || die "only ${avail_mb} MB is free and this container wants ${MEMORY} MB plus 1536 MB left for the node. Free some RAM or set a lower MEMORY."

if [ -f "$qemu_conf" ]; then
  die "ID $CTID is a virtual machine. It will not be touched. Choose another CTID."
fi
if [ -f "$lxc_conf" ]; then
  if grep -q '^hostname: steward$' "$lxc_conf"; then
    say "Steward container $CTID is already on this node. Upgrading only that container."
    if [ "$DRY_RUN" -eq 1 ]; then
      say "Dry run: would run the upgrade inside CT $CTID and then stop."
      exit 0
    fi
    pct exec "$CTID" -- bash -lc 'if [ -x /opt/steward/deploy/upgrade.sh ]; then /opt/steward/deploy/upgrade.sh; else curl -fsSL https://raw.githubusercontent.com/joshrath/Steward/main/deploy/lxc-install.sh | bash; fi'
    pct exec "$CTID" -- hostname -I || true
    exit 0
  fi
  host_now=$(awk '/^hostname:/ { print $2 }' "$lxc_conf")
  die "ID $CTID is already container ${host_now:-unknown}. It will not be touched. Choose another CTID."
fi

if [ -f "$interfaces" ]; then
  grep -qE "^(iface|auto)[[:space:]]+${BRIDGE}([^[:alnum:]_]|$)" "$interfaces" || die "bridge ${BRIDGE} is not in the host network file. Refusing to invent one."
elif ! ip link show "$BRIDGE" >/dev/null 2>&1; then
  die "bridge ${BRIDGE} is not on this host."
fi

[ -f "$storage_cfg" ] || die "storage config is missing."
storage_block=$(awk -v name="$STORAGE" '
  $0 ~ "^[^[:space:]].*:[[:space:]]+" name "$" { grab=1 }
  grab && NR>0 { print }
  grab && /^[^[:space:]]/ && $0 !~ "^[^[:space:]].*:[[:space:]]+" name "$" { exit }
' "$storage_cfg")
[ -n "$storage_block" ] || die "storage ${STORAGE} is not defined. Check pvesm status and set STORAGE."
printf '%s\n' "$storage_block" | grep -q 'rootdir' || die "storage ${STORAGE} cannot hold containers (no rootdir content). Pick another STORAGE."

status_line=$(pvesm status --storage "$STORAGE" | awk -v name="$STORAGE" '$1==name { print }')
[ -n "$status_line" ] || die "storage ${STORAGE} did not answer pvesm."
[ "$(printf '%s\n' "$status_line" | awk '{ print $3 }')" = "active" ] || die "storage ${STORAGE} is not active."
free_kb=$(printf '%s\n' "$status_line" | awk '{ print $(NF-1) }')
[[ "$free_kb" =~ ^[0-9]+$ ]] || die "could not read free space on ${STORAGE}."
need_kb=$(((DISK + 2) * 1024 * 1024))
[ "$free_kb" -ge "$need_kb" ] || die "storage ${STORAGE} has $((free_kb / 1024 / 1024)) GB free and the disk needs ${DISK} GB plus a little room."

[[ "$IP" == "dhcp" || "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$ ]] || die "IP must be dhcp or an address like 192.168.1.45/24."
NET="name=eth0,bridge=${BRIDGE},ip=${IP},firewall=0"
if [ "$IP" != "dhcp" ]; then
  [[ "$GW" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "set GW to the LAN gateway, for example GW=192.168.1.1."
  NET="${NET},gw=${GW}"
fi

pick_debian() {
  grep -oE 'debian-1[23]-standard_[^[:space:]]+\.tar\.(zst|gz|xz)' | sort -uV | tail -1
}

pveam update >/dev/null 2>&1 || say "Template list could not be refreshed. Using what is already downloaded, if any."
TEMPLATE=""
if pveam list "$TEMPLATE_STORAGE" >/dev/null 2>&1; then
  TEMPLATE=$(pveam list "$TEMPLATE_STORAGE" | pick_debian || true)
fi
download_needed=0
if [ -z "$TEMPLATE" ]; then
  TEMPLATE=$(pveam available --section system | pick_debian || true)
  if [ -z "$TEMPLATE" ]; then
    say "The appliance list did not contain a Debian 12 or 13 archive. This is what the node returned:" >&2
    pveam list "$TEMPLATE_STORAGE" 2>&1 | head -n 30 >&2 || true
    pveam available --section system 2>&1 | head -n 40 >&2 || true
    die "no Debian 12 or 13 standard template is published for this node. Nothing was created."
  fi
  download_needed=1
fi
case "$TEMPLATE" in
  debian-1[23]-standard_*.tar.zst|debian-1[23]-standard_*.tar.gz|debian-1[23]-standard_*.tar.xz) ;;
  *) die "the template name '${TEMPLATE}' is not a Debian appliance. Nothing was created." ;;
esac

say "Preflight passed. Nothing else on this node will be changed."
say "  new container id ${CTID}, hostname steward"
say "  ${CORES} cores, ${MEMORY} MB RAM, 0 MB swap, ${DISK} GB on ${STORAGE}"
say "  network ${NET}"
say "  template ${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}"
say "  host memory still free before create: ${avail_mb} MB"

if [ "$DRY_RUN" -eq 1 ]; then
  say "Dry run only. No container was created."
  exit 0
fi

if [ "$download_needed" -eq 1 ]; then
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi

pct create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --hostname steward \
  --cores "$CORES" \
  --memory "$MEMORY" \
  --swap 0 \
  --rootfs "${STORAGE}:${DISK}" \
  --net0 "$NET" \
  --unprivileged 1 \
  --features nesting=1 \
  --onboot 1 \
  --start 0

pct start "$CTID"
ready=0
for _ in $(seq 1 30); do
  if pct exec "$CTID" -- true >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
[ "$ready" -eq 1 ] || die "container $CTID started but did not accept a command. It is still running but nothing was installed in it. Inspect it with: pct status $CTID"

has_ip=0
for _ in $(seq 1 20); do
  if pct exec "$CTID" -- ip -4 addr show eth0 2>/dev/null | grep -q 'inet '; then
    has_ip=1
    break
  fi
  sleep 2
done
[ "$has_ip" -eq 1 ] || die "container $CTID has no IPv4 address. It was not modified further. Give it DHCP on ${BRIDGE}, or recreate is not required: set the address in the container and run the installer by hand."

pct exec "$CTID" -- bash -c 'apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl sudo git'
pct exec "$CTID" -- bash -c "curl -fsSL 'https://raw.githubusercontent.com/joshrath/Steward/${STEWARD_REF}/deploy/lxc-install.sh' | bash"
say "Container $CTID is up. Open http://<the-address-below>:8080"
pct exec "$CTID" -- hostname -I || true
