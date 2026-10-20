# Steward

Steward is the house console for a Proxmox and Unraid home. It keeps the guest list, the order of an update window, and a rehearsal that can roll back. It runs on your LAN. The browser preview cannot see that LAN, which is why a scan from there answers nothing.

This version installs as a Proxmox LXC. The container checks GitHub every morning. When `main` has moved, it pulls, rebuilds, and restarts. Running the create script again on an existing container does the same upgrade immediately.

The console keeps its notes in the browser. API tokens you type are used for that scan and are not written into the container.

## Create the container

On the Proxmox host, as root. Pick a free CT id. `120` is only an example. DHCP is fine. Use a static address if you want a bookmark that does not move. Pick an address that is free on `192.168.1.0/24`.

```bash
curl -fsSL https://raw.githubusercontent.com/joshrath/Steward/main/deploy/proxmox-create.sh -o /root/steward-create.sh
bash /root/steward-create.sh
```

Static address:

```bash
CTID=120 IP=192.168.1.45/24 GW=192.168.1.1 bash /root/steward-create.sh
```

Other knobs, if the defaults do not match the host: `BRIDGE` (`vmbr0`), `STORAGE` (`local-lvm`), `TEMPLATE_STORAGE` (`local`), `MEMORY` (`3072`), `DISK` (`12`), `CORES` (`2`).

The script downloads a Debian 12 template, creates an unprivileged container on `vmbr0`, and installs Steward inside it. Give it a minute. The build is the slow part.

When it finishes, the last lines print the container address. Open:

```text
http://<that-address>:8080
```

Put the container on the LAN bridge, not behind a NAT-only interface, so it can reach Proxmox and Unraid.

## Upgrade

Nothing else is required. At 04:20 the container fetches `main`. If the commit changed, it runs the new upgrade script, installs dependencies, builds, and restarts the service.

To upgrade now, on the Proxmox host:

```bash
bash /root/steward-create.sh
```

If CT `120` already exists, that command does not create a second one. It upgrades the one you have. For another id, set `CTID`.

Inside the container, the same job is:

```bash
pct exec 120 -- /opt/steward/deploy/upgrade.sh
```

Logs from the timer land in the journal:

```bash
pct exec 120 -- journalctl -u steward-upgrade.service -n 40 --no-pager
pct exec 120 -- systemctl status steward --no-pager
```

## What you should see

The first time the house is not arranged, Steward speaks and the words appear as he says them, then the first question opens. After setup, a reload opens the house. The face in the corner says the house is fine, or names what went wrong.

From a browser on the LAN, give it the Proxmox API token and the Unraid GraphQL key. It will list the guests. A rehearsal stays a rehearsal until you trust the window.

## Layout inside the container

| Path | What it is |
| --- | --- |
| `/opt/steward` | The git checkout |
| `steward.service` | The web process on port 8080 |
| `steward-upgrade.timer` | The morning check |

Do not put this on the public internet. It is a LAN console.

A Dockerfile is in the repo if you ever need a container image. The Proxmox LXC is the install this project is set up for.

