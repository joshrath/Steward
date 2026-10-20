import { useEffect, useState } from "react";
import { greeting, type Appearance } from "@/lib/steward/model";
import { useSteward, type ViewId } from "@/lib/steward/store";
import { Agent } from "@/components/steward/agent";
import { Board } from "@/components/steward/board";
import { Arrival, markEntered, Setup, VoiceMark, wasEntered, Welcome } from "@/components/steward/door";
import { Estate } from "@/components/steward/estate";
import { Notify } from "@/components/steward/notify";
import { Order } from "@/components/steward/order";
import { RunView } from "@/components/steward/run-view";
import { AppearanceSwitch } from "@/components/steward/ui";

const VIEWS: { id: ViewId; label: string }[] = [
  { id: "board", label: "Today" },
  { id: "estate", label: "Guests" },
  { id: "order", label: "The plan" },
  { id: "run", label: "Practice" },
  { id: "notify", label: "Phone" },
  { id: "agent", label: "The kit" },
];

type Phase = "intro" | "welcome" | "setup" | "house";

function useAppearance(appearance: Appearance) {
  useEffect(() => {
    const root = document.documentElement;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = appearance === "dark" || (appearance === "system" && query.matches);
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [appearance]);
}

function Splash() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-2 px-5">
      <p className="text-xs font-medium tracking-widest text-amber uppercase">At your service</p>
      <h1 className="font-display text-5xl text-fg">Steward</h1>
    </div>
  );
}

export function StewardApp() {
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const view = useSteward((s) => s.view);
  const setView = useSteward((s) => s.setView);
  const onboarded = useSteward((s) => s.onboarded);
  const settings = useSteward((s) => s.settings);
  const patch = useSteward((s) => s.patchSettings);
  useAppearance(settings.appearance ?? "system");

  useEffect(() => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const onboardedNow = useSteward.getState().onboarded;
      if (!onboardedNow) setPhase("intro");
      else if (wasEntered()) setPhase("house");
      else setPhase("welcome");
      setReady(true);
    };
    const backup = window.setTimeout(finish, 500);
    try {
      const unsub = useSteward.persist.onFinishHydration(finish);
      if (useSteward.persist.hasHydrated()) finish();
      return () => {
        unsub();
        window.clearTimeout(backup);
      };
    } catch {
      finish();
      return () => window.clearTimeout(backup);
    }
  }, []);

  useEffect(() => {
    if (ready && !onboarded && phase === "house") setPhase("welcome");
  }, [ready, onboarded, phase]);

  const dock = (
    <div className="fixed top-3 right-3 z-30">
      <AppearanceSwitch value={settings.appearance ?? "system"} onChange={(appearance) => patch({ appearance })} />
    </div>
  );

  if (!ready) return <Splash />;
  if (phase === "intro") {
    return (
      <Arrival
        onDone={() => {
          const onboardedNow = useSteward.getState().onboarded;
          if (!onboardedNow) setPhase("setup");
          else if (wasEntered()) setPhase("house");
          else setPhase("welcome");
        }}
      />
    );
  }
  if (phase === "welcome") {
    return (
      <>
        {dock}
        <Welcome
          onBegin={() => setPhase("setup")}
          onRevise={() => setPhase("setup")}
          onEnter={() => {
            markEntered();
            setPhase("house");
          }}
        />
      </>
    );
  }
  if (phase === "setup") {
    return (
      <>
        {dock}
        <Setup
          onBack={() => setPhase("welcome")}
          onDone={() => {
            markEntered();
            setPhase("house");
          }}
        />
        <VoiceMark />
      </>
    );
  }

  const hello = greeting(new Date(), settings.salutation);

  return (
    <div className="min-h-screen">
      <div className="leather" />
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-5 pb-28">
        <header className="flex flex-wrap items-end justify-between gap-4 px-2">
          <div className="flex items-end gap-4">
            <div>
            <p className="text-xs font-medium tracking-widest text-amber uppercase">At your service</p>
            <h1 className="font-display text-4xl text-fg">Steward</h1>
            <p className="text-sm text-muted">
              {hello.replace(/\.$/, "")}
              {settings.houseName ? ` · ${settings.houseName}` : ""}
            </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AppearanceSwitch value={settings.appearance ?? "system"} onChange={(appearance) => patch({ appearance })} />
            <button type="button" className="h-11 shrink-0 text-sm text-muted" onClick={() => setPhase("welcome")}>
              To the door
            </button>
          </div>
        </header>
        <div className="table flex flex-col gap-5">
        <nav aria-label="Sections" className="seg w-max max-w-full overflow-x-auto">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => setView(item.id)}
              className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            >
              {item.label}
            </button>
          ))}
        </nav>
        {view === "board" ? <Board /> : null}
        {view === "estate" ? <Estate /> : null}
        {view === "order" ? <Order /> : null}
        {view === "run" ? <RunView /> : null}
        {view === "notify" ? <Notify /> : null}
        {view === "agent" ? <Agent /> : null}
        </div>
      </div>
      <VoiceMark />
    </div>
  );
}