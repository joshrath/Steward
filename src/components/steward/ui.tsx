import type { ReactNode } from "react";
import { POSTURE_META, POSTURE_ORDER, type Appearance, type Posture } from "@/lib/steward/model";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium tracking-widest text-faint uppercase">{children}</p>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-line bg-surface p-4 ${className}`}>{children}</section>;
}

export function PosturePill({ posture }: { posture: Posture }) {
  const tone =
    posture === "hands-off"
      ? "bg-felt-dim text-felt"
      : posture === "retire"
        ? "bg-fault-dim text-fault"
        : posture === "locked"
          ? "bg-raised text-faint"
          : "bg-raised text-muted";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${tone}`}>
      {POSTURE_META[posture].label}
    </span>
  );
}

const field =
  "h-11 w-full rounded-md border border-line bg-raised px-3 text-sm text-fg placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber";

const APPEARANCE: { id: Appearance; label: string }[] = [
  { id: "light", label: "Day" },
  { id: "system", label: "Auto" },
  { id: "dark", label: "Night" },
];

export function AppearanceSwitch({ value, onChange }: { value: Appearance; onChange: (next: Appearance) => void }) {
  return (
    <div className="seg" role="group" aria-label="Appearance">
      {APPEARANCE.map((item) => (
        <button key={item.id} type="button" aria-pressed={value === item.id} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function PostureSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: Posture;
  onChange: (posture: Posture) => void;
}) {
  return (
    <select id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value as Posture)} className={field}>
      {POSTURE_ORDER.map((p) => (
        <option key={p} value={p}>
          {POSTURE_META[p].label}
        </option>
      ))}
    </select>
  );
}

export function SwitchRow({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="ios-switch relative shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        <span className={`ios-knob absolute top-0.5 left-0.5 size-6 rounded-full ${checked ? "translate-x-7" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export { field };