import { useState } from "react";
import { haAutomation } from "@/lib/steward/model";
import { useSteward } from "@/lib/steward/store";
import { Card, Eyebrow, SwitchRow, field } from "@/components/steward/ui";

export function Notify() {
  const settings = useSteward((s) => s.settings);
  const patch = useSteward((s) => s.patchSettings);
  const notices = useSteward((s) => s.notices);
  const [copied, setCopied] = useState(false);
  const yaml = haAutomation();

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div>
          <Eyebrow>Phone</Eyebrow>
          <p className="mt-2 text-sm text-muted">
            One summary when a window finishes. A louder note only if something rolls back. Per-wave play-by-play is off so 3:30am stays quiet. ntfy is the backup path for the day Home Assistant itself is down.
          </p>
        </div>
        <SwitchRow
          checked={settings.notifyDone}
          onChange={(notifyDone) => patch({ notifyDone })}
          label="Summary when finished"
          detail="The morning note. What moved, what was deferred, what was left."
        />
        <SwitchRow
          checked={settings.notifyFault}
          onChange={(notifyFault) => patch({ notifyFault })}
          label="Immediate note on rollback"
          detail="Time-sensitive. This is the one that should wake you."
        />
        <SwitchRow
          checked={settings.notifyHost}
          onChange={(notifyHost) => patch({ notifyHost })}
          label="Host updates, tell me only"
          detail="Proxmox packages and Unraid OS. Never silent."
        />
        <SwitchRow
          checked={settings.notifyStart}
          onChange={(notifyStart) => patch({ notifyStart })}
          label="Note when the window starts"
          detail="Off by default."
        />
        <SwitchRow
          checked={settings.notifyWave}
          onChange={(notifyWave) => patch({ notifyWave })}
          label="Note after every wave"
          detail="Noisy. Useful the first night, then turn it off."
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <Eyebrow>Home Assistant webhook</Eyebrow>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Webhook URL
          <input
            className={field}
            value={settings.haWebhook}
            placeholder="http://homeassistant.local:8123/api/webhook/steward"
            onChange={(e) => patch({ haWebhook: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <p className="text-sm text-muted">
          HAOS is CT 113. Keep the webhook local-only. The agent on your LAN posts JSON. This preview never does.
        </p>
        <pre className="overflow-x-auto rounded-md bg-raised p-3 font-mono text-xs text-muted">{`{"title":"Guest window finished","message":"Updated immich, jellyfin, prowlarr.","severity":"done"}`}</pre>
      </Card>

      <Card className="flex flex-col gap-3">
        <Eyebrow>ntfy backup</Eyebrow>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Server
          <input
            className={field}
            value={settings.ntfyServer}
            placeholder="https://ntfy.example"
            onChange={(e) => patch({ ntfyServer: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Topic
          <input
            className={field}
            value={settings.ntfyTopic}
            placeholder="a long random topic"
            onChange={(e) => patch({ ntfyTopic: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <p className="text-sm text-muted">
          If you use public ntfy.sh, the topic is the password. Anyone who can guess it can read the lab notes. Prefer your own server.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Automation to paste into HA</Eyebrow>
          <button
            type="button"
            className="h-11 rounded-md border border-line px-3 text-sm text-fg"
            onClick={() => {
              void navigator.clipboard.writeText(yaml).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                },
                () => setCopied(false),
              );
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Rename <span className="font-mono text-fg">notify.mobile_app_iphone</span> to the companion app entity on your phone.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-raised p-3 font-mono text-xs text-muted whitespace-pre">{yaml}</pre>
      </Card>

      <Card>
        <Eyebrow>What the phone would have seen</Eyebrow>
        {notices.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Run a rehearsal. Notes land here, not on your phone, until an agent is posting to the webhook.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {notices.map((n) => (
              <li key={n.id} className="border-t border-line pt-3">
                <p className={`text-sm font-medium ${n.severity === "fault" ? "text-fault" : "text-fg"}`}>{n.title}</p>
                <p className="text-sm text-muted">{n.body}</p>
                <p className="mt-1 font-mono text-xs text-faint tabular-nums">
                  {n.kind} · {new Date(n.at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
