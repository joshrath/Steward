import { useEffect, useState } from "react";
import {
  DAY_NAMES,
  POSTURE_META,
  RETIRED_NOTE,
  fmtMin,
  formatPt,
  hasUpdate,
  timeOptions,
  windowStatus,
  type Workload,
} from "@/lib/steward/model";
import { useSteward } from "@/lib/steward/store";
import { Card, Eyebrow, PosturePill, PostureSelect, SwitchRow, field } from "@/components/steward/ui";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function willMove(w: Workload, watching: boolean, queueBusy: boolean, deferJ: boolean, deferQ: boolean) {
  if (w.kind === "host") return false;
  if (!hasUpdate(w)) return false;
  if (w.posture !== "hands-off" && w.posture !== "careful") return false;
  if (deferJ && watching && w.id === "jellyfin") return false;
  if (deferQ && queueBusy && (w.id === "sab" || w.id === "gluetun")) return false;
  return true;
}

export function Board() {
  const workloads = useSteward((s) => s.workloads);
  const settings = useSteward((s) => s.settings);
  const patch = useSteward((s) => s.patchSettings);
  const setPosture = useSteward((s) => s.setPosture);
  const startRun = useSteward((s) => s.startRun);
  const running = useSteward((s) => s.run.status === "running");
  const now = useNow();
  const win = windowStatus(now, settings);
  const times = timeOptions();
  const moving = workloads.filter((w) =>
    willMove(w, settings.watching, settings.queueBusy, settings.deferJellyfinIfWatching, settings.deferDownloadsIfBusy),
  );
  const pending = workloads.filter(hasUpdate);
  const held = pending.filter((w) => !moving.includes(w));
  const badWindow = settings.endMin <= settings.startMin || settings.days.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Eyebrow>Quiet hours</Eyebrow>
            <h2 className="mt-1 text-2xl font-medium text-fg">
              {badWindow ? "Those hours need a proper range" : win.open ? "I'm looking after the house" : win.next ? `I'll start ${formatPt(win.next)}` : "No quiet hours set"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {settings.days.join(", ")} · {fmtMin(settings.startMin)}–{fmtMin(settings.endMin)}. Outside that, I leave everyone be. A practice run never touches the machines.
            </p>
          </div>
          <div className="sm:w-64">
            <SwitchRow
              checked={settings.armed}
              onChange={(armed) => patch({ armed })}
              label={settings.armed ? "I'll take care of it" : "I'll only tell you"}
              detail={settings.armed ? "When quiet hours open, I update what you trusted me with." : "Nothing changes. I just telephone."}
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1">
          {DAY_NAMES.map((day) => {
            const on = settings.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const days = on ? settings.days.filter((d) => d !== day) : [...settings.days, day];
                  patch({ days });
                }}
                className={`h-11 rounded-md text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${on ? "bg-amber text-bg" : "bg-raised text-muted"}`}
              >
                {day}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Start
            <select
              className={field}
              value={settings.startMin}
              onChange={(e) => patch({ startMin: Number(e.target.value) })}
            >
              {times.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            End
            <select
              className={field}
              value={settings.endMin}
              onChange={(e) => patch({ endMin: Number(e.target.value) })}
            >
              {times.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {badWindow ? (
          <p className="mt-3 text-sm text-fault">Pick at least one day, and an end that is after the start. Overnight windows are not in this version.</p>
        ) : null}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3">
          <p className="text-xs text-faint">I'll update</p>
          <p className="text-2xl font-medium tabular-nums text-felt">{moving.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-faint">Waiting</p>
          <p className="text-2xl font-medium tabular-nums text-amber">{pending.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-faint">Left alone</p>
          <p className="text-2xl font-medium tabular-nums text-fg">
            {workloads.filter((w) => w.posture === "locked").length}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <Eyebrow>While you sleep</Eyebrow>
          <ul className="mt-3 flex flex-col gap-3">
            {moving.length === 0 ? (
              <li className="text-sm text-muted">Nothing for me to touch. Change how I treat someone, or clear a pause.</li>
            ) : (
              moving.map((w) => (
                <li key={w.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{w.name}</span>
                    <span className="block font-mono text-xs text-faint tabular-nums">
                      {w.kind === "lxc" ? `CT ${w.vmid}` : w.kind === "vm" ? `VM ${w.vmid}` : w.kind}
                      {hasUpdate(w) ? ` · ${w.current} → ${w.available}` : ` · ${w.current}`}
                    </span>
                  </span>
                  <PosturePill posture={w.posture} />
                </li>
              ))
            )}
          </ul>
        </Card>
        <Card>
          <Eyebrow>Held back</Eyebrow>
          <ul className="mt-3 flex flex-col gap-3">
            {held.length === 0 ? (
              <li className="text-sm text-muted">Nothing is being held.</li>
            ) : (
              held.map((w) => (
              <li key={w.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-fg">{w.name}</span>
                  <span className="block text-xs text-muted">
                    {w.posture === "hands-off" || w.posture === "careful"
                      ? w.id === "jellyfin"
                        ? "Playback session"
                        : "Queue is busy"
                      : POSTURE_META[w.posture].hint}
                  </span>
                </span>
                <PosturePill posture={w.posture} />
              </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <Card className="flex flex-col gap-4">
        <Eyebrow>Do not kick a live session</Eyebrow>
        <SwitchRow
          checked={settings.deferJellyfinIfWatching}
          onChange={(deferJellyfinIfWatching) => patch({ deferJellyfinIfWatching })}
          label="Defer Jellyfin while someone is watching"
          detail="Agent asks /Sessions. A movie beats a version bump."
        />
        <SwitchRow
          checked={settings.watching}
          onChange={(watching) => patch({ watching })}
          label="Twin: playback in progress"
          detail="Stand-in for a real Jellyfin session, so you can see the deferral."
        />
        <SwitchRow
          checked={settings.deferDownloadsIfBusy}
          onChange={(deferDownloadsIfBusy) => patch({ deferDownloadsIfBusy })}
          label="Defer Gluetun and SABnzbd while the queue is moving"
          detail="SABnzbd uses Gluetun's network. Recreating either one kills the download."
        />
        <SwitchRow
          checked={settings.queueBusy}
          onChange={(queueBusy) => patch({ queueBusy })}
          label="Twin: SABnzbd queue active"
          detail="Stand-in for a non-empty queue."
        />
      </Card>

      <Card>
        <Eyebrow>The hosts</Eyebrow>
        <p className="mt-2 text-sm text-muted">
          Guest waves never reboot a node. Unraid OS is never applied. Proxmox apt is available only if you promote it, and the reboot stays held.
        </p>
        <ul className="mt-4 flex flex-col gap-4">
          {workloads
            .filter((w) => w.kind === "host")
            .map((w) => (
              <li key={w.id} className="grid gap-2 sm:grid-cols-[1fr_10rem] sm:items-center">
                <div>
                  <p className="text-sm font-medium text-fg">{w.name}</p>
                  <p className="font-mono text-xs text-faint tabular-nums">
                    {w.current} → {w.available}
                    {w.packages ? ` · ${w.packages} packages` : ""}
                    {w.reboot ? " · reboot required" : ""}
                  </p>
                </div>
                <PostureSelect
                  id={`posture-${w.id}`}
                  label={`Posture for ${w.name}`}
                  value={w.posture}
                  onChange={(posture) => setPosture(w.id, posture)}
                />
              </li>
            ))}
        </ul>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={running}
          onClick={() => startRun("guest")}
          className="h-12 rounded-md bg-amber text-sm font-medium text-bg disabled:opacity-50"
        >
          Rehearse guest window
        </button>
        <button
          type="button"
          disabled={running}
          onClick={() => startRun("host")}
          className="h-12 rounded-md border border-line bg-raised text-sm font-medium text-fg disabled:opacity-50"
        >
          Rehearse host window
        </button>
      </div>
      <p className="text-xs text-faint">{RETIRED_NOTE}</p>
    </div>
  );
}
