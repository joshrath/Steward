import { exportPolicy } from "@/lib/steward/model";
import { downloadText, useSteward } from "@/lib/steward/store";
import { Card, Eyebrow, field } from "@/components/steward/ui";

export function Agent() {
  const workloads = useSteward((s) => s.workloads);
  const settings = useSteward((s) => s.settings);
  const patch = useSteward((s) => s.patchSettings);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Eyebrow>Where the work happens</Eyebrow>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-md bg-raised p-3">
            <p className="text-sm font-medium text-fg">This console</p>
            <p className="mt-1 text-sm text-muted">Postures, the window, who gets a phone note. It does not dial your LAN. A published copy of it cannot see 192.168.1.0/24, and it should not.</p>
          </div>
          <div className="rounded-md bg-amber-dim p-3">
            <p className="text-sm font-medium text-amber">Agent, pinned</p>
            <p className="mt-1 text-sm text-fg">A small unprivileged LXC on Proxmox. Suggested VMID 114 if it is free. It calls the Proxmox API and SSH to Tower. It is locked so a window never updates the updater.</p>
          </div>
          <div className="rounded-md bg-raised p-3">
            <p className="text-sm font-medium text-fg">Home Assistant</p>
            <p className="mt-1 text-sm text-muted">CT 113, also locked. The agent posts a webhook. The companion app is how the iPhone hears it. ntfy only if HA is the thing that is down.</p>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <Eyebrow>Do not put it on Gluetun</Eyebrow>
        <p className="text-sm text-muted">
          A container attached to Gluetun dies when Gluetun is recreated, which is the moment you most want the agent alive. Docker on Unraid has the same problem if the agent is one of the containers it updates. An LXC on vmbr0, talking to Unraid over SSH, stays up while the download path bounces.
        </p>
        <p className="text-sm text-muted">
          Turn Watchtower off. It will race Steward, ignore SABnzbd's network namespace, and update the thing you marked locked.
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <Eyebrow>Least privilege</Eyebrow>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted">
          <li>Proxmox token, not root password. Role with VM.Audit, VM.Snapshot, VM.Backup, VM.Monitor, VM.PowerMgmt on the guest CTs. Not on the agent CT.</li>
          <li>Host apt is a separate sudoers line on the node for exactly <span className="font-mono text-fg">apt-get</span> and <span className="font-mono text-fg">vzdump</span>. Reboot is a different line, and the unit ships without it.</li>
          <li>Unraid: an SSH key that can run docker for the named containers only. No Unraid OS update command exists in the agent.</li>
          <li>The token secret stays in <span className="font-mono text-fg">/etc/steward.env</span> mode 600 on the LXC. It is not stored in this browser.</li>
        </ul>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Proxmox API URL
          <input className={field} value={settings.proxmoxUrl} onChange={(e) => patch({ proxmoxUrl: e.target.value })} spellCheck={false} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Node name
            <input className={field} value={settings.proxmoxNode} onChange={(e) => patch({ proxmoxNode: e.target.value })} spellCheck={false} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Token id
            <input className={field} value={settings.tokenId} onChange={(e) => patch({ tokenId: e.target.value })} spellCheck={false} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Unraid host
          <input className={field} value={settings.unraidHost} onChange={(e) => patch({ unraidHost: e.target.value })} spellCheck={false} />
        </label>
      </Card>

      <Card className="flex flex-col gap-3">
        <Eyebrow>Take this to the LAN</Eyebrow>
        <p className="text-sm text-muted">
          The download is a dry-run planner plus the phone webhook. It will not apt, pull images, or reboot on its own. Read a <span className="font-mono text-fg">--now</span> log against a rehearsal here before you teach it to run commands. Unraid OS is refused outright. A Proxmox reboot stays off unless you later set <span className="font-mono text-fg">STEWARD_ALLOW_HOST_REBOOT=1</span>, and that flag does nothing until a command runner exists.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="h-11 rounded-md bg-amber px-4 text-sm font-medium text-bg"
            onClick={() =>
              downloadText(
                "policy.json",
                JSON.stringify(exportPolicy(workloads, settings), null, 2),
                "application/json",
              )
            }
          >
            Download policy.json
          </button>
          <a
            className="inline-flex h-11 items-center justify-center rounded-md border border-line px-4 text-sm text-fg"
            href="/agent/steward-agent.py"
            download
          >
            Download agent
          </a>
          <a
            className="inline-flex h-11 items-center justify-center rounded-md border border-line px-4 text-sm text-fg"
            href="/agent/docker-compose.yml"
            download
          >
            Download compose
          </a>
        </div>
        <p className="text-xs text-faint">
          The ledger is whoever answered the scan. policy.json carries postures, not package versions, and never a token secret.
        </p>
      </Card>
    </div>
  );
}
