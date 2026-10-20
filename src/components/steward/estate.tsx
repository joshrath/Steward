import { useState } from "react";
import { hasUpdate, type HostId } from "@/lib/steward/model";
import { useSteward } from "@/lib/steward/store";
import { Card, Eyebrow, PostureSelect } from "@/components/steward/ui";

type Filter = "all" | HostId | "pending";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "proxmox", label: "Proxmox" },
  { id: "unraid", label: "Unraid" },
  { id: "pending", label: "Waiting" },
];

export function Estate() {
  const workloads = useSteward((s) => s.workloads);
  const setPosture = useSteward((s) => s.setPosture);
  const resetTwin = useSteward((s) => s.resetTwin);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirm, setConfirm] = useState(false);
  const rows = workloads.filter((w) => {
    if (filter === "all") return true;
    if (filter === "pending") return hasUpdate(w);
    return w.host === filter;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`h-11 shrink-0 rounded-md px-3 text-sm ${filter === f.id ? "bg-amber-dim text-amber" : "bg-surface text-muted"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((w) => (
          <li key={w.id}>
            <Card className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Eyebrow>
                    {w.host === "proxmox" ? "Proxmox" : "Unraid"} · {w.kind}
                    {w.vmid ? ` ${w.vmid}` : ""}
                  </Eyebrow>
                  <h2 className="mt-1 text-lg font-medium text-fg">{w.name}</h2>
                  <p className="mt-1 font-mono text-xs text-faint tabular-nums break-all">
                    {w.address ? `${w.address} · ` : ""}
                    {w.image ? `${w.image} · ` : ""}
                    {hasUpdate(w) ? `${w.current} → ${w.available}` : `${w.current} · current`}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted">{w.note}</p>
              {w.dependsOn.length || w.networkFrom ? (
                <p className="text-xs text-faint">
                  {w.networkFrom ? `Network from ${w.networkFrom}. ` : ""}
                  {w.dependsOn.length ? `Waits on ${w.dependsOn.join(", ")}.` : ""}
                </p>
              ) : null}
              <PostureSelect
                id={`estate-${w.id}`}
                label={`Posture for ${w.name}`}
                value={w.posture}
                onChange={(posture) => setPosture(w.id, posture)}
              />
            </Card>
          </li>
        ))}
      </ul>
      <div>
        {confirm ? (
          <button
            type="button"
            onClick={() => {
              resetTwin();
              setConfirm(false);
            }}
            className="h-11 rounded-md border border-line px-4 text-sm text-fault"
          >
            Confirm reset of postures and window
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="h-11 rounded-md px-2 text-sm text-faint"
          >
            Reset twin
          </button>
        )}
      </div>
    </div>
  );
}
