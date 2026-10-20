import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_SETTINGS,
  buildGuestPlan,
  buildHostPlan,
  rollbackSteps,
  type NoticeKind,
  type Posture,
  type Settings,
  type Step,
  type Workload,
} from "@/lib/steward/model";

export type ViewId = "board" | "estate" | "order" | "run" | "notify" | "agent";

export type StepState = "pending" | "active" | "ok" | "failed" | "skipped";

export interface RuntimeStep extends Step {
  state: StepState;
}

export interface Notice {
  id: string;
  at: number;
  title: string;
  body: string;
  severity: "info" | "fault" | "done";
  kind: NoticeKind;
}

export interface Run {
  kind: "guest" | "host";
  status: "idle" | "running" | "done" | "faulted" | "stopped";
  steps: RuntimeStep[];
  index: number;
  blocked: string[];
  flaked: string[];
  startedAt?: number;
}

interface Persisted {
  onboarded?: boolean;
  workloads?: Workload[];
  settings?: Partial<Settings>;
  notices?: Notice[];
}

export interface StewardState {
  view: ViewId;
  workloads: Workload[];
  settings: Settings;
  notices: Notice[];
  run: Run;
  onboarded: boolean;
  setView: (view: ViewId) => void;
  setPosture: (id: string, posture: Posture) => void;
  patchSettings: (patch: Partial<Settings>) => void;
  startRun: (kind: "guest" | "host") => void;
  stopRun: () => void;
  resetTwin: () => void;
  commitSetup: (workloads: Workload[], settings: Settings) => void;
}

const EMPTY_RUN: Run = {
  kind: "guest",
  status: "idle",
  steps: [],
  index: 0,
  blocked: [],
  flaked: [],
};

let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function allowNotice(kind: NoticeKind, settings: Settings): boolean {
  if (kind === "start") return settings.notifyStart;
  if (kind === "wave") return settings.notifyWave;
  if (kind === "fault") return settings.notifyFault;
  if (kind === "done") return settings.notifyDone;
  if (kind === "host") return settings.notifyHost;
  return true;
}

function pushNotice(title: string, body: string, severity: Notice["severity"], kind: NoticeKind) {
  const { settings, notices } = useSteward.getState();
  if (!allowNotice(kind, settings)) return;
  const next: Notice = {
    id: `${Date.now()}-${kind}-${notices.length}`,
    at: Date.now(),
    title,
    body,
    severity,
    kind,
  };
  useSteward.setState({ notices: [next, ...notices].slice(0, 40) });
}

function isSkipped(step: RuntimeStep, blocked: string[]): boolean {
  return (step.skipIfFailed ?? []).some((id) => blocked.includes(id));
}

function finishActive() {
  const { run, settings } = useSteward.getState();
  if (run.status !== "running") return;
  const steps = run.steps.map((s) => ({ ...s }));
  const i = run.index;
  const step = steps[i];
  if (!step || step.state !== "active") return;

  const blocked = [...run.blocked];
  const flaked = [...run.flaked];
  const shouldFlake =
    step.action === "probe" &&
    Boolean(step.flakeId) &&
    settings.flake === step.flakeId &&
    !flaked.includes(step.flakeId as string);

  if (shouldFlake && step.flakeId) {
    steps[i] = { ...step, state: "failed" };
    flaked.push(step.flakeId);
    blocked.push(step.flakeId);
    const extra: RuntimeStep[] = rollbackSteps(step.flakeId, settings).map((s) => ({
      ...s,
      state: "pending",
    }));
    steps.splice(i + 1, 0, ...extra);
    useSteward.setState({ run: { ...run, steps, index: i + 1, blocked, flaked } });
    pump();
    return;
  }

  steps[i] = { ...step, state: "ok" };
  if (step.notice) {
    pushNotice(step.notice.title, step.notice.body, step.notice.severity, step.notice.kind);
  }
  useSteward.setState({ run: { ...run, steps, index: i + 1, blocked, flaked } });
  pump();
}

function pump() {
  clearTimer();
  const { run } = useSteward.getState();
  if (run.status !== "running") return;
  const steps = run.steps.map((s) => ({ ...s }));
  let index = run.index;
  while (index < steps.length && isSkipped(steps[index], run.blocked)) {
    steps[index] = { ...steps[index], state: "skipped" };
    index += 1;
  }
  if (index >= steps.length) {
    const status = run.blocked.length ? "faulted" : "done";
    useSteward.setState({ run: { ...run, steps, index, status } });
    const updated = [
      ...new Set(steps.filter((s) => s.action === "update" && s.state === "ok").map((s) => s.workloadId)),
    ];
    const labels = updated.map((id) => useSteward.getState().workloads.find((w) => w.id === id)?.name ?? id);
    if (status === "faulted") {
      pushNotice(
        "Window finished with a rollback",
        `Rolled back ${run.blocked.join(", ")}. Updates that probed clean were left in place. Skipped anything that depended on the failure.`,
        "fault",
        "done",
      );
    } else if (run.kind === "guest") {
      pushNotice(
        "Guest window finished",
        labels.length ? `Updated ${labels.join(", ")}. No rollbacks.` : "Nothing applied. The estate was already within policy.",
        "done",
        "done",
      );
    }
    return;
  }
  steps[index] = { ...steps[index], state: "active" };
  useSteward.setState({ run: { ...run, steps, index } });
  timer = setTimeout(finishActive, steps[index].ms);
}

function cloneSeed(): Workload[] {
  return [];
}

export const useSteward = create<StewardState>()(
  persist(
    (set, get) => ({
      view: "board",
      workloads: cloneSeed(),
      settings: { ...DEFAULT_SETTINGS },
      notices: [],
      run: EMPTY_RUN,
      onboarded: false,
      setView: (view) => set({ view }),
      setPosture: (id, posture) =>
        set({
          workloads: get().workloads.map((w) => (w.id === id ? { ...w, posture } : w)),
        }),
      patchSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      startRun: (kind) => {
        if (get().run.status === "running") return;
        clearTimer();
        const { workloads, settings } = get();
        const planned = kind === "guest" ? buildGuestPlan(workloads, settings) : buildHostPlan(workloads, settings);
        const steps: RuntimeStep[] = planned.map((s) => ({ ...s, state: "pending" }));
        set({
          view: "run",
          run: {
            kind,
            status: "running",
            steps,
            index: 0,
            blocked: [],
            flaked: [],
            startedAt: Date.now(),
          },
        });
        pump();
      },
      stopRun: () => {
        clearTimer();
        const run = get().run;
        if (run.status !== "running") return;
        const steps = run.steps.map((s) =>
          s.state === "active" || s.state === "pending" ? { ...s, state: "skipped" as const } : s,
        );
        set({ run: { ...run, steps, status: "stopped" } });
        pushNotice(
          "Rehearsal stopped",
          "The window was cut short. Nothing further in this pass will apply.",
          "info",
          "stop",
        );
      },
      resetTwin: () => {
        clearTimer();
        try {
          sessionStorage.removeItem("steward-door");
        } catch {
          /* ignore */
        }
        set({
          onboarded: false,
          workloads: cloneSeed(),
          settings: { ...DEFAULT_SETTINGS },
          notices: [],
          run: EMPTY_RUN,
          view: "board",
        });
      },
      commitSetup: (workloads, settings) => {
        clearTimer();
        set({
          onboarded: true,
          workloads,
          settings,
          view: "board",
          run: EMPTY_RUN,
        });
      },
    }),
    {
      name: "steward-v1",
      version: 2,
      migrate: (persisted, from) => (from < 2 ? {} : persisted),
      partialize: (state) => ({
        onboarded: state.onboarded,
        workloads: state.workloads,
        settings: state.settings,
        notices: state.notices.slice(0, 40),
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Persisted;
        const workloads = p.workloads?.length
          ? p.workloads.map((w) => ({ ...w, dependsOn: [...(w.dependsOn ?? [])] }))
          : current.workloads;
        return {
          ...current,
          onboarded: Boolean(p.onboarded),
          notices: p.notices ?? [],
          settings: { ...current.settings, ...(p.settings ?? {}) },
          workloads,
        };
      },
    },
  ),
);

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
