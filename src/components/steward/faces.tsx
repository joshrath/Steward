import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSteward } from "@/lib/steward/store";

let crash: { on: boolean; note: string } = { on: false, note: "" };
const watchers = new Set<() => void>();

export function markCrashed(note?: string) {
  crash = { on: true, note: note || crash.note };
  watchers.forEach((fn) => fn());
}

function useCrash() {
  return useSyncExternalStore(
    (cb) => {
      watchers.add(cb);
      return () => watchers.delete(cb);
    },
    () => crash,
    () => crash,
  );
}

function Smiley() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-full w-full">
      <ellipse cx="33" cy="34" rx="27" ry="24" fill="#6b4a16" />
      <ellipse cx="31" cy="32" rx="26" ry="23" fill="#f3d48a" />
      <ellipse cx="31" cy="24" rx="16" ry="8" fill="#fff1c7" opacity="0.85" />
      <rect x="20" y="26" width="5" height="8" rx="2" fill="#2a2118" transform="rotate(-8 22 30)" />
      <rect x="37" y="24" width="6" height="7" rx="2" fill="#2a2118" transform="rotate(6 40 27)" />
      <path d="M18 40c4 7 22 8 28 3" fill="none" stroke="#7a2430" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

function Frowny() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-full w-full">
      <circle cx="17" cy="17" r="13" fill="#808080" />
      <circle cx="15" cy="15" r="13" fill="#404040" />
      <circle cx="15" cy="15" r="12" fill="#ffff4a" />
      <path d="M6 10a12 12 0 0 1 16-4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="10.5" cy="13" rx="1.5" ry="2.3" fill="#000" />
      <ellipse cx="19.5" cy="13" rx="1.5" ry="2.3" fill="#000" />
      <path d="M9.5 21.5c2-3.2 9.5-3.2 11.5 0" fill="none" stroke="#000" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function HouseMood() {
  const crashState = useCrash();
  const notices = useSteward((s) => s.notices);
  const run = useSteward((s) => s.run);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const reasons = notices
    .filter((n) => n.severity === "fault")
    .map((n) => ({ id: n.id, short: n.title, full: n.body }));
  if (crashState.on) {
    reasons.unshift({
      id: "crash",
      short: "The app stumbled",
      full: crashState.note || "An unexpected error occurred. Try reloading the page.",
    });
  }
  if (run.status === "faulted" && reasons.length === 0) {
    const who = run.blocked.filter(Boolean).join(", ") || "a guest";
    reasons.push({
      id: "window",
      short: `Rolled back ${who}`,
      full: `Rolled back ${who}. Updates that probed clean were left in place. Anything that depended on the failure was skipped.`,
    });
  }
  const wrong = reasons.length > 0;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="house-mood" ref={root}>
      {open ? (
        <div className="mood-card" role="dialog" aria-label={wrong ? "What went wrong" : "House"}>
          {wrong ? (
            <ul className="flex flex-col gap-1">
              {reasons.map((reason) => (
                <li key={reason.id}>
                  <button
                    type="button"
                    className="mood-reason"
                    aria-expanded={picked === reason.id}
                    onClick={() => setPicked((cur) => (cur === reason.id ? null : reason.id))}
                  >
                    {reason.short}
                  </button>
                  {picked === reason.id ? <p className="mood-detail">{reason.full}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg">All is well.</p>
          )}
        </div>
      ) : null}
      <button
        type="button"
        className="mood-face"
        aria-expanded={open}
        aria-label={wrong ? "Something has gone amiss" : "The house is in good hands"}
        onClick={() => {
          setPicked(null);
          setOpen((cur) => !cur);
        }}
      >
        {wrong ? <Frowny /> : <Smiley />}
      </button>
    </div>
  );
}

export function CrashFace({ message }: { message?: string }) {
  useEffect(() => {
    markCrashed(message);
  }, [message]);
  return null;
}
