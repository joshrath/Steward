import { useEffect, useMemo, useRef, useState } from "react";
import {
  DAY_NAMES,
  SEED,
  fmtMin,
  greeting,
  hasUpdate,
  timeOptions,
  type Settings,
  type Workload,
} from "@/lib/steward/model";
import { scanHouse } from "@/lib/steward/scan";
import { useSteward } from "@/lib/steward/store";
import { field } from "@/components/steward/ui";

const DOOR_KEY = "steward-door";

export function markEntered() {
  try {
    sessionStorage.setItem(DOOR_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function wasEntered(): boolean {
  try {
    return sessionStorage.getItem(DOOR_KEY) === "1";
  } catch {
    return false;
  }
}

function place(w: Workload): string {
  if (w.kind === "lxc") return `CT ${w.vmid}`;
  if (w.kind === "vm") return `VM ${w.vmid}`;
  if (w.kind === "host") return "host";
  return "docker";
}

const SPOKE = "steward-spoke-2";

export function hasSpoken() {
  try {
    return sessionStorage.getItem(SPOKE) === "1";
  } catch {
    return false;
  }
}

function markSpoken() {
  try {
    sessionStorage.setItem(SPOKE, "1");
  } catch {
    /* ignore */
  }
}

export function VoiceMark() {
  const quiet = useSteward((s) => s.settings.voiceMuted);
  const patch = useSteward((s) => s.patchSettings);
  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2">
      <div className={`voice-mark ${quiet ? "is-quiet" : ""}`}>
        <img src="/steward/alive.jpg" alt="" className="h-full w-full object-cover object-top" />
      </div>
      <button
        type="button"
        aria-pressed={quiet}
        onClick={() => patch({ voiceMuted: !quiet })}
        className="h-10 rounded-full border border-line bg-surface px-3 text-xs font-medium text-fg"
      >
        {quiet ? "Quiet, for good" : "Mute forever"}
      </button>
    </div>
  );
}

const WORDS: { at: number; word: string; sentence: number }[] = [
  { at: 0.08, word: "Oh,", sentence: 0 },
  { at: 0.28, word: "hello.", sentence: 0 },
  { at: 1.12, word: "I'm", sentence: 1 },
  { at: 1.32, word: "Steward.", sentence: 1 },
  { at: 2.04, word: "The", sentence: 2 },
  { at: 2.16, word: "house", sentence: 2 },
  { at: 2.42, word: "is", sentence: 2 },
  { at: 2.54, word: "in", sentence: 2 },
  { at: 2.66, word: "good", sentence: 2 },
  { at: 2.86, word: "hands.", sentence: 2 },
  { at: 3.66, word: "I'll", sentence: 3 },
  { at: 3.81, word: "only", sentence: 3 },
  { at: 4.05, word: "telephone", sentence: 3 },
  { at: 4.53, word: "if", sentence: 3 },
  { at: 4.65, word: "something", sentence: 3 },
  { at: 5.03, word: "actually", sentence: 3 },
  { at: 5.41, word: "misbehaves.", sentence: 3 },
  { at: 6.47, word: "Come", sentence: 4 },
  { at: 6.65, word: "on", sentence: 4 },
  { at: 6.83, word: "in.", sentence: 4 },
];

function lineAt(t: number) {
  const said = WORDS.filter((w) => w.at <= t);
  if (!said.length) return "";
  const sentence = said[said.length - 1].sentence;
  return said
    .filter((w) => w.sentence === sentence)
    .map((w) => w.word)
    .join(" ");
}

export function Arrival({ onDone }: { onDone: () => void }) {
  const quiet = useSteward((s) => s.settings.voiceMuted);
  const [beat, setBeat] = useState<"arrive" | "speak" | "dock">("arrive");
  const [blocked, setBlocked] = useState(false);
  const [line, setLine] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const done = useRef(false);
  const doneCb = useRef(onDone);
  doneCb.current = onDone;

  function finish() {
    if (done.current) return;
    done.current = true;
    markSpoken();
    setLine("The first question.");
    setBeat("dock");
    window.setTimeout(() => doneCb.current(), 1000);
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = window.setTimeout(() => {
        markSpoken();
        doneCb.current();
      }, 1200);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setBeat("speak"), 1200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (beat !== "speak") return;
    if (quiet) {
      setLine("The first question.");
      const t = window.setTimeout(finish, 700);
      return () => window.clearTimeout(t);
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => setBlocked(true));
    const limit = window.setTimeout(finish, 12000);
    return () => window.clearTimeout(limit);
  }, [beat]);

  function unlock() {
    const audio = audioRef.current;
    if (!audio || !blocked || quiet) return;
    audio.currentTime = 0;
    setLine("");
    void audio.play();
    setBlocked(false);
  }

  function follow(event: { currentTarget: HTMLAudioElement }) {
    const next = lineAt(event.currentTarget.currentTime);
    setLine((cur) => (cur === next ? cur : next));
  }

  return (
    <div className={`intro-room ${beat === "dock" ? "is-open" : ""}`} onPointerDown={unlock}>
      <img
        src={beat === "arrive" ? "/steward/butler.jpg" : "/steward/alive.jpg"}
        alt=""
        className={`intro-film ${beat === "dock" ? "is-docked" : ""}`}
      />
      <audio ref={audioRef} src="/steward/greeting.mp3" preload="auto" onTimeUpdate={follow} onEnded={finish} />
      {line ? (
        <p className="intro-caption" aria-live="polite">
          {line}
        </p>
      ) : null}
      {blocked && beat === "speak" ? <p className="intro-tap">Touch the room, and I will say it aloud.</p> : null}
    </div>
  );
}

export function LivingSteward({
  welcome = false,
  className = "",
}: {
  welcome?: boolean;
  className?: string;
}) {
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setStill(true);
  }, []);
  if (still || !welcome) {
    if (still && welcome) {
      return <img src="/steward/butler.jpg" alt="Steward, painted" className={`portrait object-cover object-top ${className}`} />;
    }
    return (
      <video
        className={`portrait bg-surface object-cover object-top ${className}`}
        src="/steward/alive.mp4"
        poster="/steward/alive.jpg"
        autoPlay
        muted
        loop
        playsInline
        aria-label="Steward, at the door"
      />
    );
  }
  return (
    <video
      className={`portrait bg-surface object-cover object-top ${className}`}
      src="/steward/welcome.mp4"
      poster="/steward/butler.jpg"
      autoPlay
      muted
      playsInline
      aria-label="Steward steps out of the painting"
    />
  );
}

export function Welcome({ onBegin, onEnter, onRevise }: { onBegin: () => void; onEnter: () => void; onRevise: () => void }) {
  const onboarded = useSteward((s) => s.onboarded);
  const settings = useSteward((s) => s.settings);
  const waiting = useSteward((s) => s.workloads.filter(hasUpdate).length);
  const hello = greeting(new Date(), onboarded ? settings.salutation : "");
  const matters =
    waiting === 0 ? "Nothing is waiting." : waiting === 1 ? "One matter is waiting." : `${waiting} matters are waiting.`;

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-5 py-8 pb-28 md:justify-center">
      <div className="grid items-center gap-6 md:grid-cols-[15rem_1fr] md:gap-8">
        <LivingSteward welcome className="mx-auto h-72 w-52 md:h-96 md:w-64" />
        <div className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-widest text-amber uppercase">At your service</p>
          <h1 className="font-display text-5xl text-fg">Steward</h1>
          <p className="font-display text-2xl text-fg">{hello}</p>
          <p className="max-w-md text-base text-muted">
            I keep the machines in their places, and I telephone only when something has gone amiss.
          </p>
          {onboarded ? (
            <p className="text-sm text-fg">
              {settings.houseName} · {matters}
            </p>
          ) : (
            <p className="text-sm text-muted">I will ask the house who is home before I write anyone into the ledger.</p>
          )}
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            {onboarded ? (
              <button type="button" onClick={onEnter} className="h-12 rounded-md bg-amber px-6 text-sm font-medium text-bg">
                Enter
              </button>
            ) : (
              <button type="button" onClick={onBegin} className="h-12 rounded-md bg-amber px-6 text-sm font-medium text-bg">
                Do come in
              </button>
            )}
            {onboarded ? (
              <button type="button" onClick={onRevise} className="h-12 rounded-md border border-line px-6 text-sm text-fg">
                Revise the arrangements
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Setup({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const commit = useSteward((s) => s.commitSetup);
  const liveWork = useSteward((s) => s.workloads);
  const liveSettings = useSteward((s) => s.settings);
  const onboarded = useSteward((s) => s.onboarded);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Settings>({
    ...liveSettings,
    unraidUrl: liveSettings.unraidUrl || (liveSettings.unraidHost ? `https://${liveSettings.unraidHost}` : ""),
  });
  const [tokenSecret, setTokenSecret] = useState("");
  const [unraidKey, setUnraidKey] = useState("");
  const [rows, setRows] = useState<Workload[]>(() => (onboarded ? liveWork.map((w) => ({ ...w, dependsOn: [...w.dependsOn] })) : []));
  const [included, setIncluded] = useState<string[]>(() =>
    onboarded ? liveWork.filter((w) => w.kind !== "host").map((w) => w.id) : [],
  );
  const [scanned, setScanned] = useState(onboarded && liveWork.length > 0);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ proxmox: string; unraid: string; sample: boolean } | null>(null);
  const times = timeOptions();
  const guests = rows.filter((w) => w.kind !== "host");
  const badWindow = draft.endMin <= draft.startMin || draft.days.length === 0;
  const titles = useMemo(() => ["How shall I address you", "The keys", "Who is home", "Hours and the telephone"], []);

  function toggleId(id: string) {
    setIncluded((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function toggleUpdate(id: string, on: boolean) {
    setRows((cur) => cur.map((w) => (w.id === id ? { ...w, available: on ? w.available && w.available !== w.current ? w.available : "update ready" : undefined } : w)));
  }

  function adopt(found: Workload[], next: { proxmox: string; unraid: string; sample: boolean }) {
    const previous = new Map(rows.map((w) => [w.id, w]));
    const merged = found.map((w) => {
      const old = previous.get(w.id);
      return old ? { ...w, posture: old.posture, dependsOn: [...old.dependsOn] } : { ...w, dependsOn: [...w.dependsOn] };
    });
    setRows(merged);
    setIncluded([]);
    setScanned(true);
    setReport(next);
    setStep(2);
  }

  async function look() {
    setBusy(true);
    setReport(null);
    try {
      const result = await scanHouse({
        data: {
          proxmoxUrl: draft.proxmoxUrl,
          proxmoxNode: draft.proxmoxNode,
          tokenId: draft.tokenId,
          tokenSecret,
          unraidUrl: draft.unraidUrl,
          unraidKey,
        },
      });
      const found = [...result.guests, ...result.hosts];
      const next = { proxmox: result.proxmox.detail, unraid: result.unraid.detail, sample: false };
      if (found.length === 0) {
        setReport(next);
        setScanned(false);
        return;
      }
      adopt(found, next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The scan did not complete.";
      setReport({ proxmox: message, unraid: message, sample: false });
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    const keep = new Set(included);
    let unraidHost = draft.unraidHost;
    try {
      if (draft.unraidUrl.trim()) unraidHost = new URL(draft.unraidUrl.includes("://") ? draft.unraidUrl : `https://${draft.unraidUrl}`).hostname;
    } catch {
      /* keep the host we already have */
    }
    commit(
      rows.filter((w) => w.kind === "host" || keep.has(w.id)),
      { ...draft, unraidHost, appearance: useSteward.getState().settings.appearance, face: useSteward.getState().settings.face, voiceMuted: useSteward.getState().settings.voiceMuted },
    );
    onDone();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-5 py-8 pb-28">
      <div>
        <p className="text-xs font-medium tracking-widest text-amber uppercase">
          Particular {step + 1} of {titles.length}
        </p>
        <h1 className="mt-2 font-display text-4xl text-fg">{titles[step]}</h1>
      </div>

      {step === 0 ? (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-muted">
            What shall I call you
            <input
              className={field}
              value={draft.salutation}
              placeholder="Leave blank, if you prefer"
              onChange={(e) => setDraft({ ...draft, salutation: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            And the house
            <input className={field} value={draft.houseName} onChange={(e) => setDraft({ ...draft, houseName: e.target.value || "the house" })} />
          </label>
          <p className="text-sm text-muted">I do not keep a list of machines. Give me the keys, and I will ask who is running.</p>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Proxmox takes an API token. Unraid 7.2 or newer takes an API key from Management Access. Neither secret is written into the ledger.</p>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Proxmox
            <input
              className={field}
              value={draft.proxmoxUrl}
              placeholder="https://pve.local:8006"
              spellCheck={false}
              onChange={(e) => setDraft({ ...draft, proxmoxUrl: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Token id
              <input
                className={field}
                value={draft.tokenId}
                placeholder="steward@pve!agent"
                spellCheck={false}
                onChange={(e) => setDraft({ ...draft, tokenId: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Token secret
              <input className={field} type="password" value={tokenSecret} spellCheck={false} autoComplete="off" onChange={(e) => setTokenSecret(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Node, if you wish to limit the look
            <input className={field} value={draft.proxmoxNode} placeholder="every online node" spellCheck={false} onChange={(e) => setDraft({ ...draft, proxmoxNode: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Unraid
            <input
              className={field}
              value={draft.unraidUrl}
              placeholder="https://tower.local"
              spellCheck={false}
              onChange={(e) => setDraft({ ...draft, unraidUrl: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            API key
            <input className={field} type="password" value={unraidKey} spellCheck={false} autoComplete="off" onChange={(e) => setUnraidKey(e.target.value)} />
          </label>
          <button type="button" disabled={busy} onClick={() => void look()} className="h-12 rounded-md bg-amber px-6 text-sm font-medium text-bg disabled:opacity-50">
            {busy ? "Looking…" : "Look around"}
          </button>
          {report && !scanned ? (
            <div className="flex flex-col gap-1 text-sm text-fault">
              <p>{report.proxmox}</p>
              <p>{report.unraid}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {report?.sample
              ? "This is a rehearsal house, not a live scan. Tick the ones you want in the ledger."
              : "These answered. Nothing is kept until you tick it. DNS and Home Assistant are locked if the name gives them away. Everyone else is only told about, until you say otherwise."}
          </p>
          {report && !report.sample ? (
            <p className="text-xs text-faint">
              {report.proxmox} {report.unraid}
            </p>
          ) : null}
          {guests.length === 0 ? <p className="text-sm text-muted">No guests yet.</p> : <GuestList rows={guests} included={included} onToggle={toggleId} onUpdate={toggleUpdate} />}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="h-11 rounded-md border border-line px-3 text-sm text-fg"
              onClick={() => setIncluded(guests.filter((w) => w.current === "running").map((w) => w.id))}
            >
              The running ones
            </button>
            <button
              type="button"
              className="h-11 rounded-md border border-line px-3 text-sm text-fg"
              onClick={() =>
                adopt(
                  SEED.map((w) => ({ ...w, dependsOn: [...w.dependsOn] })),
                  { proxmox: "Rehearsal.", unraid: "Rehearsal.", sample: true },
                )
              }
            >
              Rehearse instead
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((day) => {
              const on = draft.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      days: on ? draft.days.filter((d) => d !== day) : [...draft.days, day],
                    })
                  }
                  className={`h-11 rounded-md text-sm font-medium ${on ? "bg-amber text-bg" : "bg-raised text-muted"}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-muted">
              From
              <select className={field} value={draft.startMin} onChange={(e) => setDraft({ ...draft, startMin: Number(e.target.value) })}>
                {times.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Until
              <select className={field} value={draft.endMin} onChange={(e) => setDraft({ ...draft, endMin: Number(e.target.value) })}>
                {times.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-sm text-muted">
            {fmtMin(draft.startMin)}–{fmtMin(draft.endMin)} Pacific. Armed means the agent may act when that window opens. Postures stay on the estate, not here.
          </p>
          <label className="flex items-center justify-between gap-4 text-sm text-fg">
            Armed
            <input type="checkbox" className="size-5 accent-amber" checked={draft.armed} onChange={(e) => setDraft({ ...draft, armed: e.target.checked })} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Home Assistant webhook
            <input
              className={field}
              value={draft.haWebhook}
              placeholder="http://homeassistant.local:8123/api/webhook/steward"
              spellCheck={false}
              onChange={(e) => setDraft({ ...draft, haWebhook: e.target.value })}
            />
          </label>
          {badWindow ? <p className="text-sm text-fault">Choose a day, and an end that is after the start.</p> : null}
          <p className="text-sm text-fg">
            {included.length === 0 ? "No guests ticked. Only the hosts will be written down." : `${included.length} will be written down.`}
          </p>
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3">
        <button type="button" className="h-11 px-2 text-sm text-muted" onClick={() => (step === 0 ? onBack() : setStep((n) => n - 1))}>
          Back
        </button>
        {step < titles.length - 1 ? (
          <button
            type="button"
            disabled={step === 1 && !scanned}
            className="h-12 rounded-md bg-amber px-6 text-sm font-medium text-bg disabled:opacity-50"
            onClick={() => setStep((n) => n + 1)}
          >
            Continue
          </button>
        ) : (
          <button type="button" disabled={badWindow || !scanned} className="h-12 rounded-md bg-amber px-6 text-sm font-medium text-bg disabled:opacity-50" onClick={finish}>
            That will do
          </button>
        )}
      </div>
    </div>
  );
}
function GuestList({
  rows,
  included,
  onToggle,
  onUpdate,
}: {
  rows: Workload[];
  included: string[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, on: boolean) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
      {rows.map((w) => {
        const on = included.includes(w.id);
        return (
          <li key={w.id} className="flex flex-col gap-2 px-3 py-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="size-5 accent-amber" checked={on} onChange={() => onToggle(w.id)} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{w.name}</span>
                <span className="block font-mono text-xs text-faint">
                  {place(w)} · {w.current}
                </span>
              </span>
            </label>
            {on ? (
              <label className="ml-8 flex items-center gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  className="size-5 accent-amber"
                  checked={hasUpdate(w)}
                  onChange={(e) => onUpdate(w.id, e.target.checked)}
                />
                Update waiting
              </label>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
