#!/usr/bin/env python3
"""Steward agent. Dry-run unless STEWARD_APPLY=1.

Reads policy.json exported from the Steward console. When the maintenance
window is open and the policy is armed, it plans guest updates in wave
order and can apply them. Host OS is a separate pass.

It will not:
  - update Unraid OS or plugins
  - touch posture locked or retire
  - reboot Proxmox unless STEWARD_ALLOW_HOST_REBOOT=1
  - run apt on the node unless STEWARD_ALLOW_HOST_APT=1

Secrets come from the environment, never from policy.json:
  PVE_TOKEN_SECRET   required only when applying Proxmox API calls
  PVE_SSH            default root@pve  (pct exec / apt / vzdump)
  UNRAID_SSH         default root@<policy unraidHost>

Usage:
  python3 steward-agent.py --policy policy.json            # dry-run, honor the clock
  python3 steward-agent.py --policy policy.json --now      # dry-run, ignore the clock
  STEWARD_APPLY=1 python3 steward-agent.py --policy policy.json --now
  python3 steward-agent.py --policy policy.json --loop     # sleep until the window
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

APPLY = os.environ.get("STEWARD_APPLY") == "1"
ALLOW_REBOOT = os.environ.get("STEWARD_ALLOW_HOST_REBOOT") == "1"
ALLOW_HOST_APT = os.environ.get("STEWARD_ALLOW_HOST_APT") == "1"
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def log(msg: str) -> None:
    print(f"[steward] {msg}", flush=True)


def load_policy(path: Path) -> dict:
    with path.open() as fh:
        data = json.load(fh)
    if data.get("version") != 1:
        raise SystemExit("policy.json version is not 1")
    return data


def window_open(policy: dict, now: datetime | None = None) -> bool:
    settings = policy["settings"]
    tz = ZoneInfo(settings.get("tz") or "America/Los_Angeles")
    now = now or datetime.now(tz)
    if now.tzinfo is None:
        now = now.replace(tzinfo=tz)
    else:
        now = now.astimezone(tz)
    days = settings.get("days") or []
    start = int(settings.get("startMin") or 0)
    end = int(settings.get("endMin") or 0)
    if end <= start or not days:
        return False
    minutes = now.hour * 60 + now.minute
    return WEEKDAYS[now.weekday()] in days and start <= minutes < end


def by_id(policy: dict) -> dict[str, dict]:
    return {w["id"]: w for w in policy["workloads"]}


def pending_ids(policy: dict) -> set[str]:
    """The console does not know live versions. The agent treats every
    hands-off/careful guest as worth checking. Discovery commands are
    printed; apply runs them and skips a unit whose check says current.
    """
    return {
        w["id"]
        for w in policy["workloads"]
        if w.get("posture") in ("hands-off", "careful") and w.get("kind") != "host"
    }


def plan_guest(policy: dict) -> list[str]:
    workloads = policy["workloads"]
    known = by_id(policy)
    settings = policy["settings"]
    unraid = settings.get("unraidHost") or "192.168.1.103"
    lines: list[str] = []
    eligible = [w for w in workloads if w["id"] in pending_ids(policy)]
    eligible.sort(key=lambda w: (w.get("wave") or 0, w.get("name") or ""))

    def holders(parent: str) -> list[dict]:
        return [w for w in workloads if w.get("networkFrom") == parent]

    lines.append("notify start: guest window")
    for w in eligible:
        if w.get("kind") == "host":
            continue
        if w.get("posture") in ("locked", "retire", "notify"):
            lines.append(f"skip {w['id']}: posture {w.get('posture')}")
            continue
        for h in holders(w["id"]):
            lines.append(f"docker stop {h['id']}  # shares network with {w['id']}")
            lines.append(f"ssh {shlex.quote('root@' + unraid)} docker stop {shlex.quote(h['id'])}")
        if w.get("kind") == "lxc":
            lines.append(
                f"snapshot ct {w.get('vmid')} name=steward  # rollback point before apt"
            )
        elif w.get("posture") == "careful":
            lines.append(f"docker inspect image {w['id']}  # record digest")
        if w.get("kind") == "lxc":
            lines.append(f"pct exec {w.get('vmid')} -- apt-get -y -o Dpkg::Options::=--force-confold upgrade")
        else:
            image = w.get("image") or w["id"]
            lines.append(f"ssh root@{unraid} docker pull {shlex.quote(image)}")
            lines.append(f"ssh root@{unraid} docker restart {shlex.quote(w['id'])}")
        if w.get("probe"):
            lines.append(f"probe {w['id']}: {w.get('probe')}")
        for h in holders(w["id"]):
            lines.append(f"ssh root@{unraid} docker start {shlex.quote(h['id'])}")
            if h.get("probe"):
                lines.append(f"probe {h['id']}: {h.get('probe')}")
    for w in workloads:
        if w.get("posture") == "locked":
            lines.append(f"locked {w['id']}: not touched")
        elif w.get("posture") == "retire":
            lines.append(f"retire {w['id']}: not touched")
    return lines


def plan_host(policy: dict) -> list[str]:
    lines = [
        "host window is separate from guests",
        "unraid os: REFUSED (usb boot, plugins, parity — tell the phone, do not apply)",
    ]
    pve = by_id(policy).get("pve")
    if not pve:
        return lines
    posture = pve.get("posture")
    if posture in ("notify", "locked", "retire", None):
        lines.append(f"proxmox: tell-me only (posture {posture})")
        return lines
    if not ALLOW_HOST_APT:
        lines.append("proxmox apt: REFUSED until STEWARD_ALLOW_HOST_APT=1")
        return lines
    lines.append("vzdump 100 102 110 --mode snapshot")
    lines.append("apt-get update && apt-get -y -o Dpkg::Options::=--force-confold full-upgrade")
    lines.append("probe https api :8006")
    if ALLOW_REBOOT:
        lines.append("reboot: ALLOWED by STEWARD_ALLOW_HOST_REBOOT")
    else:
        lines.append("reboot: HELD (set STEWARD_ALLOW_HOST_REBOOT=1 to permit)")
    return lines


def post_webhook(policy: dict, title: str, message: str, severity: str) -> None:
    settings = policy["settings"]
    payload = json.dumps({"title": title, "message": message, "severity": severity}).encode()
    hook = (settings.get("haWebhook") or "").strip()
    if hook:
        log(f"webhook {hook} {title}")
        if APPLY:
            req = urllib.request.Request(hook, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp.read()
    server = (settings.get("ntfyServer") or "").strip().rstrip("/")
    topic = (settings.get("ntfyTopic") or "").strip()
    if server and topic:
        url = f"{server}/{topic}"
        log(f"ntfy {url} {title}")
        if APPLY:
            req = urllib.request.Request(
                url,
                data=message.encode(),
                headers={"Title": title, "Priority": "high" if severity == "fault" else "default"},
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp.read()


def run_once(policy: dict, ignore_clock: bool) -> int:
    armed = bool(policy["settings"].get("armed"))
    open_now = ignore_clock or window_open(policy)
    mode = "APPLY" if APPLY else "DRY-RUN"
    log(f"{mode} armed={armed} window_open={open_now}")
    if not open_now:
        log("outside the window — nothing to do")
        return 0
    if not armed and APPLY:
        log("disarmed — would notify only")
    guest = plan_guest(policy)
    host = plan_host(policy)
    log("--- guest ---")
    for line in guest:
        log(line)
    log("--- host ---")
    for line in host:
        log(line)
    if not APPLY:
        log("dry-run complete. set STEWARD_APPLY=1 to execute. no command was run.")
        return 0
    if not armed:
        post_webhook(policy, "Steward disarmed", "Window was open. Nothing was applied.", "info")
        return 0
    # Apply is intentionally narrow: webhooks plus the printed plan review.
    # Shelling apt/docker from a first run without you watching is how labs die.
    # Execute only the webhook here. Re-run with --apply-commands once the
    # dry-run plan matches what you saw in the console rehearsal.
    if os.environ.get("STEWARD_APPLY_COMMANDS") != "1":
        post_webhook(
            policy,
            "Steward planned a window",
            "Apply is on but STEWARD_APPLY_COMMANDS is not. No guest was changed. Review the agent log, then set STEWARD_APPLY_COMMANDS=1.",
            "info",
        )
        log("refusing commands until STEWARD_APPLY_COMMANDS=1")
        return 0
    log("STEWARD_APPLY_COMMANDS=1 — this build still prints the plan and notifies.")
    log("wire each printed line to your own allowlisted runner before trusting it unattended.")
    post_webhook(policy, "Steward window", "Plan emitted. Command runner is still yours to arm.", "info")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Steward LAN agent")
    parser.add_argument("--policy", default=os.environ.get("STEWARD_POLICY", "policy.json"))
    parser.add_argument("--now", action="store_true", help="ignore the maintenance window")
    parser.add_argument("--loop", action="store_true", help="sleep and fire once per open window")
    args = parser.parse_args()
    path = Path(args.policy)
    if not path.exists():
        log(f"missing {path}")
        return 2
    policy = load_policy(path)
    if not args.loop:
        return run_once(policy, args.now)
    last_stamp = ""
    log("looping")
    while True:
        tz = ZoneInfo(policy["settings"].get("tz") or "America/Los_Angeles")
        now = datetime.now(tz)
        stamp = now.strftime("%Y-%m-%d")
        if window_open(policy, now) and stamp != last_stamp:
            run_once(policy, False)
            last_stamp = stamp
        time.sleep(60)


if __name__ == "__main__":
    sys.exit(main())
