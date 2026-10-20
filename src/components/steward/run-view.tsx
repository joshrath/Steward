import { Check, Minus, X } from "lucide-react";
import type { Flake } from "@/lib/steward/model";
import { useSteward, type RuntimeStep } from "@/lib/steward/store";
import { Card, Eyebrow, field } from "@/components/steward/ui";

function Mark({ step }: { step: RuntimeStep }) {
  if (step.state === "ok") return <Check className="size-4 text-felt" aria-hidden="true" />;
  if (step.state === "failed") return <X className="size-4 text-fault" aria-hidden="true" />;
  if (step.state === "skipped") return <Minus className="size-4 text-faint" aria-hidden="true" />;
  if (step.state === "active") {
    return <span className="pulse-dot block size-2.5 rounded-full bg-amber" aria-hidden="true" />;
  }
  return <span className="block size-2.5 rounded-full bg-line" aria-hidden="true" />;
}

export function RunView() {
  const run = useSteward((s) => s.run);
  const settings = useSteward((s) => s.settings);
  const patch = useSteward((s) => s.patchSettings);
  const startRun = useSteward((s) => s.startRun);
  const stopRun = useSteward((s) => s.stopRun);
  const done = run.steps.filter((s) => s.state === "ok" || s.state === "failed" || s.state === "skipped").length;
  const total = run.steps.length;
  const running = run.status === "running";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Eyebrow>A practice run</Eyebrow>
        <p className="mt-2 text-sm text-muted">
          This is a dress rehearsal on the desk, not the house. I can pretend one check fails so you can watch me put things back. Nothing real is touched.
        </p>
        <label className="mt-3 flex flex-col gap-1 text-sm text-muted">
          Pretend this check fails
          <select
            className={field}
            value={settings.flake}
            disabled={running}
            onChange={(e) => patch({ flake: e.target.value as Flake })}
          >
            <option value="none">Clean pass</option>
            <option value="jellyfin">Jellyfin probe fails</option>
            <option value="gluetun">Gluetun probe fails</option>
          </select>
        </label>
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

      {run.status === "idle" ? (
        <Card>
          <p className="text-sm text-muted">No rehearsal yet. Start one. The timeline stays on this page.</p>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Eyebrow>{run.kind === "guest" ? "Guest rehearsal" : "Host rehearsal"}</Eyebrow>
              <p className="mt-1 text-sm text-fg tabular-nums" aria-live="polite">
                {run.status === "running"
                  ? `Step ${Math.min(done + 1, total)} of ${total}`
                  : run.status === "done"
                    ? "Clean pass"
                    : run.status === "faulted"
                      ? `Rolled back ${run.blocked.join(", ")}`
                      : "Stopped"}
              </p>
            </div>
            {running ? (
              <button type="button" onClick={stopRun} className="h-11 rounded-md border border-line px-4 text-sm text-fg">
                Stop
              </button>
            ) : null}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
            <div
              className={`h-full ${run.status === "faulted" ? "bg-fault" : "bg-felt"}`}
              style={{ width: total === 0 ? "0%" : `${Math.round((done / total) * 100)}%` }}
            />
          </div>
          {run.status === "faulted" ? (
            <p className="mt-3 text-sm text-fault">
              The failed unit was restored. Steps that would have ridden on it were skipped. Everything that had already probed clean stayed updated.
            </p>
          ) : null}
          {run.status === "done" ? (
            <p className="mt-3 text-sm text-muted">
              {settings.armed
                ? "Armed is on. A real agent would have done this inside the window, without you."
                : "Disarmed. A real agent would have sent the summary and changed nothing."}
            </p>
          ) : null}
          <ol className="mt-4 flex flex-col">
            {run.steps.map((step) => (
              <li
                key={step.id}
                className={`flex gap-3 border-t border-line py-3 ${step.state === "active" ? "bg-amber-dim -mx-4 px-4" : ""}`}
              >
                <span className="mt-1 flex w-4 justify-center">
                  <Mark step={step} />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm ${step.state === "skipped" ? "text-faint" : "text-fg"}`}>
                    {step.title}
                  </span>
                  <span className="block text-sm text-muted">{step.detail}</span>
                  {step.command ? (
                    <span className="mt-1 block font-mono text-xs text-faint break-all">{step.command}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
