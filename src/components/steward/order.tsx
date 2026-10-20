import { buildGuestPlan, buildHostPlan, waveLabel, type Step } from "@/lib/steward/model";
import { useSteward } from "@/lib/steward/store";
import { Card, Eyebrow } from "@/components/steward/ui";

function Groups({ steps }: { steps: Step[] }) {
  const waves: number[] = [];
  for (const step of steps) {
    if (!waves.includes(step.wave)) waves.push(step.wave);
  }
  if (steps.length === 0) {
    return <p className="text-sm text-muted">No steps.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {waves.map((wave) => (
        <div key={wave}>
          <h3 className="text-sm font-medium text-fg">{wave === 0 ? "Notes" : waveLabel(wave)}</h3>
          <ol className="mt-2 flex flex-col gap-2">
            {steps
              .filter((s) => s.wave === wave)
              .map((step) => (
                <li key={step.id} className="rounded-md border border-line bg-raised px-3 py-2">
                  <p className="text-sm text-fg">{step.title}</p>
                  <p className="text-sm text-muted">{step.detail}</p>
                  {step.command ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-faint">The actual instruction</summary>
                      <p className="mt-1 font-mono text-xs text-faint break-all">{step.command}</p>
                    </details>
                  ) : null}
                </li>
              ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

export function Order() {
  const workloads = useSteward((s) => s.workloads);
  const settings = useSteward((s) => s.settings);
  const guest = buildGuestPlan(workloads, settings);
  const host = buildHostPlan(workloads, settings);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Eyebrow>Why I go in this order</Eyebrow>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm text-muted">
          <li>Prowlarr before Sonarr and Radarr. Seerr after all three and Jellyfin.</li>
          <li>NPM last among guests. A bad bump should not take the front door with it.</li>
          <li>Stop SABnzbd, recreate Gluetun, prove the tunnel, start SABnzbd, only then bump SABnzbd.</li>
          <li>AdGuard and Home Assistant are not in the list. DNS and the phone path stay up.</li>
          <li>Plex is retired, so a pending version is not a task.</li>
        </ul>
      </Card>
      <Card>
        <Eyebrow>The guests</Eyebrow>
        <div className="mt-3">
          <Groups steps={guest} />
        </div>
      </Card>
      <Card>
        <Eyebrow>The hosts, later</Eyebrow>
        <div className="mt-3">
          <Groups steps={host} />
        </div>
      </Card>
    </div>
  );
}
