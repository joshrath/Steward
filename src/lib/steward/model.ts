export const TZ = "America/Los_Angeles";

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type DayName = (typeof DAY_NAMES)[number];

export type HostId = "proxmox" | "unraid";
export type Kind = "lxc" | "vm" | "docker" | "host";
export type Posture = "hands-off" | "careful" | "notify" | "locked" | "retire";
export type Flake = "none" | "jellyfin" | "gluetun";
export type NoticeKind = "start" | "wave" | "fault" | "done" | "host" | "stop";

export interface Workload {
  id: string;
  name: string;
  host: HostId;
  kind: Kind;
  vmid?: number;
  address?: string;
  image?: string;
  container?: string;
  current: string;
  available?: string;
  posture: Posture;
  dependsOn: string[];
  networkFrom?: string;
  wave: number;
  note: string;
  probe?: string;
  packages?: number;
  reboot?: boolean;
}

export type Appearance = "light" | "dark" | "system";
export type StewardFace = "lamp" | "visor" | "bell" | "orb" | "counter";

export interface Settings {
  days: DayName[];
  startMin: number;
  endMin: number;
  tz: string;
  armed: boolean;
  haWebhook: string;
  ntfyServer: string;
  ntfyTopic: string;
  notifyStart: boolean;
  notifyWave: boolean;
  notifyFault: boolean;
  notifyDone: boolean;
  notifyHost: boolean;
  flake: Flake;
  deferJellyfinIfWatching: boolean;
  deferDownloadsIfBusy: boolean;
  watching: boolean;
  queueBusy: boolean;
  proxmoxUrl: string;
  proxmoxNode: string;
  tokenId: string;
  unraidHost: string;
  unraidUrl: string;
  salutation: string;
  houseName: string;
  appearance: Appearance;
  face: StewardFace;
  voiceMuted: boolean;
}

export type Action =
  | "note"
  | "snapshot"
  | "stop"
  | "update"
  | "start"
  | "probe"
  | "rollback"
  | "skip"
  | "notify";

export interface StepNotice {
  title: string;
  body: string;
  severity: "info" | "fault" | "done";
  kind: NoticeKind;
}

export interface Step {
  id: string;
  wave: number;
  workloadId: string;
  action: Action;
  title: string;
  detail: string;
  command?: string;
  ms: number;
  flakeId?: string;
  skipIfFailed?: string[];
  notice?: StepNotice;
}

export const POSTURE_ORDER: Posture[] = ["hands-off", "careful", "notify", "locked", "retire"];

export const POSTURE_META: Record<Posture, { label: string; hint: string }> = {
  "hands-off": {
    label: "Hands-off",
    hint: "Applies inside the window, probes, and can roll back. The telephone gets the summary, not a prompt.",
  },
  careful: {
    label: "Careful",
    hint: "Same path, but a snapshot or image digest is kept and the soak is longer.",
  },
  notify: {
    label: "Tell me",
    hint: "The telephone hears about the pending update. Nothing is changed.",
  },
  locked: {
    label: "Locked",
    hint: "Steward will not stop, update, or reboot this. DNS and Home Assistant stay here.",
  },
  retire: {
    label: "Retire",
    hint: "Left alone on purpose so it does not get maintained back into daily use.",
  },
};

export const DEFAULT_SETTINGS: Settings = {
  days: ["Tue"],
  startMin: 3 * 60 + 30,
  endMin: 5 * 60,
  tz: TZ,
  armed: true,
  haWebhook: "",
  ntfyServer: "",
  ntfyTopic: "",
  notifyStart: false,
  notifyWave: false,
  notifyFault: true,
  notifyDone: true,
  notifyHost: true,
  flake: "none",
  deferJellyfinIfWatching: true,
  deferDownloadsIfBusy: true,
  watching: false,
  queueBusy: false,
  proxmoxUrl: "",
  proxmoxNode: "",
  tokenId: "",
  unraidHost: "",
  unraidUrl: "",
  salutation: "",
  houseName: "the house",
  appearance: "system",
  face: "lamp",
  voiceMuted: false,
};

export const SEED: Workload[] = [
  {
    id: "npm",
    name: "nginxproxymanager",
    host: "proxmox",
    kind: "lxc",
    vmid: 100,
    current: "running",
    posture: "careful",
    dependsOn: [],
    wave: 6,
    note: "Edge proxy, CT 100. Last among guests, so a bad update is not also a dead front door.",
    probe: "TCP :81",
  },
  {
    id: "kuma",
    name: "uptimekuma",
    host: "proxmox",
    kind: "lxc",
    vmid: 101,
    current: "running",
    posture: "hands-off",
    dependsOn: [],
    wave: 1,
    note: "CT 101. Running. No update was showing on the node.",
    probe: "HTTP :3001",
  },
  {
    id: "jellyfin",
    name: "jellyfin",
    host: "proxmox",
    kind: "lxc",
    vmid: 102,
    address: "192.168.1.86:8096",
    current: "running",
    posture: "hands-off",
    dependsOn: [],
    wave: 2,
    note: "CT 102. Public name is tv.onrath.net. Probe the LAN port, not the public name.",
    probe: "HTTP 192.168.1.86:8096/health",
  },
  {
    id: "seerr",
    name: "seerr",
    host: "proxmox",
    kind: "lxc",
    vmid: 103,
    address: "192.168.1.110:5055",
    current: "running",
    posture: "hands-off",
    dependsOn: ["sonarr", "radarr", "jellyfin"],
    wave: 5,
    note: "CT 103. Also on 10.10.10.10. After Sonarr, Radarr, and Jellyfin.",
    probe: "HTTP :5055",
  },
  {
    id: "plex",
    name: "plex",
    host: "proxmox",
    kind: "lxc",
    vmid: 104,
    current: "running",
    posture: "retire",
    dependsOn: [],
    wave: 8,
    note: "CT 104. Retire candidate. Left in the tree, not in the window.",
    probe: "HTTP :32400",
  },
  {
    id: "radarr",
    name: "radarr",
    host: "proxmox",
    kind: "lxc",
    vmid: 105,
    address: "192.168.1.111:7878",
    current: "running",
    posture: "hands-off",
    dependsOn: ["prowlarr"],
    wave: 4,
    note: "CT 105. VLAN 10.10.10.12. Prowlarr moves first.",
    probe: "HTTP :7878/ping",
  },
  {
    id: "sonarr",
    name: "sonarr",
    host: "proxmox",
    kind: "lxc",
    vmid: 106,
    address: "192.168.1.112:8989",
    current: "running",
    posture: "hands-off",
    dependsOn: ["prowlarr"],
    wave: 4,
    note: "CT 106. VLAN 10.10.10.13.",
    probe: "HTTP :8989/ping",
  },
  {
    id: "prowlarr",
    name: "prowlarr",
    host: "proxmox",
    kind: "lxc",
    vmid: 107,
    address: "192.168.1.114:9696",
    current: "running",
    posture: "hands-off",
    dependsOn: [],
    wave: 3,
    note: "CT 107. Not .113. That address clashes with the router.",
    probe: "HTTP :9696/ping",
  },
  {
    id: "adguard-ct",
    name: "adguard",
    host: "proxmox",
    kind: "lxc",
    vmid: 109,
    current: "running",
    posture: "locked",
    dependsOn: [],
    wave: 0,
    note: "CT 109. DNS. A restart in the middle of a wave looks like everything else died.",
    probe: "DNS :53",
  },
  {
    id: "immich",
    name: "immich",
    host: "proxmox",
    kind: "lxc",
    vmid: 110,
    current: "running",
    posture: "careful",
    dependsOn: [],
    wave: 1,
    note: "CT 110. Photo library. Snapshot first.",
    probe: "HTTP :2283",
  },
  {
    id: "haos",
    name: "haos-18.2",
    host: "proxmox",
    kind: "vm",
    vmid: 113,
    current: "running",
    posture: "locked",
    dependsOn: [],
    wave: 0,
    note: "VM 113, not a container. This is the phone path. Steward does not update it.",
    probe: "HTTP :8123",
  },
  {
    id: "gluetun",
    name: "Gluetun",
    host: "unraid",
    kind: "docker",
    container: "Gluetun",
    address: "192.168.1.103",
    image: "qmcgaw/gluetun",
    current: "installed",
    available: "update ready",
    posture: "careful",
    dependsOn: [],
    wave: 7,
    note: "Unraid reports apply update. SABnzbd uses this network namespace. Ports 8000, 8080, 8888, 7777.",
    probe: "HTTP :8000/v1/publicip/ip",
  },
  {
    id: "sab",
    name: "sabnzbd",
    host: "unraid",
    kind: "docker",
    container: "sabnzbd",
    address: "192.168.1.103:7777",
    image: "linuxserver/sabnzbd",
    current: "installed",
    available: "update ready",
    posture: "hands-off",
    dependsOn: ["gluetun"],
    networkFrom: "gluetun",
    wave: 7,
    note: "Unraid reports apply update. Shares Gluetun's network. Incomplete stays on /mnt/user/media/unfinished.",
    probe: "HTTP :7777/api?mode=version",
  },
  {
    id: "adguard-unraid",
    name: "AdGuard-Home",
    host: "unraid",
    kind: "docker",
    container: "AdGuard-Home",
    address: "192.168.1.53",
    image: "adguard/adguardhome",
    current: "up to date",
    posture: "locked",
    dependsOn: [],
    wave: 0,
    note: "Up to date on Tower. On br0, not behind Gluetun. Locked, same as the other DNS.",
    probe: "HTTP 192.168.1.53",
  },
  {
    id: "adguard-sync",
    name: "AdGuardHome-Sync",
    host: "unraid",
    kind: "docker",
    container: "AdGuardHome-Sync",
    current: "up to date",
    posture: "locked",
    dependsOn: [],
    wave: 0,
    note: "Up to date on Tower. Keeps the two AdGuard instances honest. Locked.",
    probe: "HTTP",
  },
  {
    id: "pve",
    name: "pve",
    host: "proxmox",
    kind: "host",
    current: "running",
    posture: "notify",
    dependsOn: [],
    wave: 9,
    note: "The node in the tree. No package count was on the screen. A reboot is never part of the guest window.",
    probe: "HTTPS :8006",
  },
  {
    id: "unraid",
    name: "Unraid",
    host: "unraid",
    kind: "host",
    address: "192.168.1.103",
    current: "7.3.3",
    posture: "notify",
    dependsOn: [],
    wave: 9,
    note: "The panel says 7.3.3. Steward will not apply Unraid OS or plugin updates.",
    probe: "HTTP tower",
  },
];

export function hasUpdate(w: Workload): boolean {
  return Boolean(w.available && w.available !== w.current);
}

export function unitName(w: Workload): string {
  return w.container ?? w.id;
}

export function fmtMin(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeOptions(): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = [];
  for (let m = 0; m < 24 * 60; m += 30) out.push({ value: m, label: fmtMin(m) });
  return out;
}

export function laParts(date: Date): { weekday: DayName; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) bag[p.type] = p.value;
  const weekday = (DAY_NAMES.includes(bag.weekday as DayName) ? bag.weekday : "Sun") as DayName;
  return { weekday, minutes: Number(bag.hour) * 60 + Number(bag.minute) };
}

export function windowStatus(now: Date, settings: Settings): { open: boolean; next: number | null } {
  const cur = laParts(now);
  const open =
    settings.endMin > settings.startMin &&
    settings.days.includes(cur.weekday) &&
    cur.minutes >= settings.startMin &&
    cur.minutes < settings.endMin;
  if (open || settings.days.length === 0 || settings.endMin <= settings.startMin) {
    return { open, next: null };
  }
  for (let i = 1; i <= 11 * 24 * 60; i++) {
    const t = new Date(now.getTime() + i * 60_000);
    const q = laParts(t);
    if (settings.days.includes(q.weekday) && q.minutes === settings.startMin) {
      return { open: false, next: t.getTime() };
    }
  }
  return { open: false, next: null };
}

export function formatPt(ts: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ts));
}

function byId(workloads: Workload[], id: string): Workload | undefined {
  return workloads.find((w) => w.id === id);
}

function topo(workloads: Workload[]): Workload[] {
  const map = new Map(workloads.map((w) => [w.id, w]));
  const seen = new Set<string>();
  const out: Workload[] = [];
  const visit = (w: Workload) => {
    if (seen.has(w.id)) return;
    seen.add(w.id);
    for (const dep of w.dependsOn) {
      const d = map.get(dep);
      if (d) visit(d);
    }
    out.push(w);
  };
  const ordered = [...workloads].sort((a, b) => a.wave - b.wave || a.name.localeCompare(b.name));
  for (const w of ordered) visit(w);
  return out;
}

function notice(
  id: string,
  wave: number,
  title: string,
  body: string,
  severity: StepNotice["severity"],
  kind: NoticeKind,
  ms = 140,
): Step {
  return {
    id,
    wave,
    workloadId: "steward",
    action: "notify",
    title,
    detail: body,
    ms,
    notice: { title, body, severity, kind },
  };
}

function deferredIds(workloads: Workload[], settings: Settings): Map<string, string> {
  const reasons = new Map<string, string>();
  if (settings.deferJellyfinIfWatching && settings.watching) {
    reasons.set("jellyfin", "Jellyfin has a playback session. Deferred so the picture stays up.");
  }
  if (settings.deferDownloadsIfBusy && settings.queueBusy) {
    reasons.set("sab", "SABnzbd queue is moving. Deferred.");
    reasons.set("gluetun", "SABnzbd is using Gluetun's network and the queue is moving. Both wait.");
  }
  for (const w of workloads) {
    if (reasons.has(w.id) && !hasUpdate(w)) reasons.delete(w.id);
  }
  return reasons;
}

let stepSeq = 0;
function sid(prefix: string): string {
  stepSeq += 1;
  return `${prefix}-${stepSeq}`;
}

export function buildGuestPlan(workloads: Workload[], settings: Settings): Step[] {
  stepSeq = 0;
  const steps: Step[] = [];
  const deferred = deferredIds(workloads, settings);
  const eligible = topo(workloads).filter(
    (w) =>
      w.kind !== "host" &&
      hasUpdate(w) &&
      (w.posture === "hands-off" || w.posture === "careful") &&
      !deferred.has(w.id),
  );
  const held = workloads.filter(
    (w) =>
      w.kind !== "host" &&
      hasUpdate(w) &&
      (w.posture === "notify" || w.posture === "locked" || w.posture === "retire" || deferred.has(w.id)),
  );

  if (settings.notifyStart) {
    const names = eligible.map((w) => w.name);
    steps.push(
      notice(
        sid("start"),
        0,
        "Steward window",
        names.length ? `Guest window starting. Will touch ${names.join(", ")}.` : "Guest window opened. Nothing is eligible to apply.",
        "info",
        "start",
      ),
    );
  }

  if (eligible.length === 0) {
    steps.push({
      id: sid("idle"),
      wave: 0,
      workloadId: "steward",
      action: "note",
      title: "Nothing to apply",
      detail: "Pending updates are deferred, locked, retired, or set to tell-me. Hosts are a separate window.",
      ms: 160,
    });
  }

  let lastWave = -1;
  for (const w of eligible) {
    if (settings.notifyWave && lastWave !== -1 && w.wave !== lastWave) {
      steps.push(notice(sid("wave"), lastWave, `Wave ${lastWave} settled`, "Probes passed. Moving to the next wave.", "info", "wave"));
    }
    lastWave = w.wave;
    const holders = workloads.filter((h) => h.networkFrom === w.id);
    for (const h of holders) {
      steps.push({
        id: sid("stop"),
        wave: w.wave,
        workloadId: h.id,
        action: "stop",
        title: `Stop ${h.name}`,
        detail: `${h.name} borrows ${w.name}'s network namespace. It has to be down before that container is recreated.`,
        command: `ssh root@${settings.unraidHost} docker stop ${unitName(h)}`,
        ms: 160,
        skipIfFailed: [w.id],
      });
    }
    if (w.kind === "lxc" || w.kind === "vm" || w.posture === "careful") {
      const guest = w.kind === "vm" ? "qemu" : "lxc";
      steps.push({
        id: sid("snap"),
        wave: w.wave,
        workloadId: w.id,
        action: "snapshot",
        title: w.kind === "docker" ? `Record ${w.name} image` : `Snapshot ${w.kind === "vm" ? "VM" : "CT"} ${w.vmid}`,
        detail: w.posture === "careful" ? "Kept through the next clean window. This is the rollback point." : "Short-lived rollback point. Pruned after a clean probe.",
        command:
          w.kind === "docker"
            ? `ssh root@${settings.unraidHost} docker inspect -f '{{.Image}}' ${unitName(w)}`
            : `POST /nodes/${settings.proxmoxNode}/${guest}/${w.vmid}/snapshot snapname=steward`,
        ms: w.posture === "careful" ? 260 : 180,
      });
    }
    steps.push({
      id: sid("upd"),
      wave: w.wave,
      workloadId: w.id,
      action: "update",
      title: `Update ${w.name}`,
      detail: `${w.current} → ${w.available}. ${w.note}`,
      command:
        w.kind === "lxc"
          ? `pct exec ${w.vmid} -- apt-get -y -o Dpkg::Options::=--force-confold upgrade`
          : w.kind === "vm"
            ? `qm guest exec ${w.vmid} -- bash -lc 'apt-get -y upgrade'`
            : `ssh root@${settings.unraidHost} docker pull ${w.image ?? unitName(w)}`,
      ms: 280,
      skipIfFailed: w.id === "sab" ? ["gluetun"] : [],
    });
    steps.push({
      id: sid("probe"),
      wave: w.wave,
      workloadId: w.id,
      action: "probe",
      title: `Probe ${w.name}`,
      detail: w.probe ? `Expect ${w.probe} within the soak.` : "Running state only.",
      command: w.probe,
      ms: w.posture === "careful" ? 240 : 180,
      flakeId: w.id === "jellyfin" || w.id === "gluetun" ? w.id : undefined,
      skipIfFailed: w.id === "sab" ? ["gluetun"] : undefined,
    });
    for (const h of holders) {
      steps.push({
        id: sid("start"),
        wave: w.wave,
        workloadId: h.id,
        action: "start",
        title: `Start ${h.name}`,
        detail: `${w.name} answered. Put ${h.name} back on its network before touching ${h.name}'s own image.`,
        command: `ssh root@${settings.unraidHost} docker start ${unitName(h)}`,
        ms: 160,
        skipIfFailed: [w.id],
      });
      steps.push({
        id: sid("probe"),
        wave: w.wave,
        workloadId: h.id,
        action: "probe",
        title: `Probe ${h.name}`,
        detail: h.probe ?? "Running.",
        command: h.probe,
        ms: 160,
        skipIfFailed: [w.id],
      });
    }
  }

  if (deferred.size) {
    const lines = [...deferred.entries()].map(([id, why]) => `${byId(workloads, id)?.name ?? id}: ${why}`);
    steps.push({
      id: sid("defer"),
      wave: 0,
      workloadId: "steward",
      action: "skip",
      title: "Deferred on purpose",
      detail: lines.join(" "),
      ms: 160,
    });
  }

  if (held.some((w) => !deferred.has(w.id))) {
    const quiet = held.filter((w) => !deferred.has(w.id));
    steps.push({
      id: sid("held"),
      wave: 0,
      workloadId: "steward",
      action: "skip",
      title: "Left alone",
      detail: quiet.map((w) => `${w.name} (${POSTURE_META[w.posture].label})`).join(", "),
      ms: 140,
    });
  }

  return steps;
}

export function buildHostPlan(workloads: Workload[], settings: Settings): Step[] {
  stepSeq = 0;
  const steps: Step[] = [];
  steps.push({
    id: sid("host-rule"),
    wave: 9,
    workloadId: "steward",
    action: "note",
    title: "Hosts are a different matter",
    detail: "A node reboot drops every guest. This window never runs beside a guest wave, and a reboot stays held unless the agent is explicitly allowed.",
    ms: 180,
  });

  const waiting = workloads.filter((w) => w.kind === "host" && hasUpdate(w));
  if (waiting.length === 0) {
    const quiet = workloads.filter((w) => w.kind === "host");
    steps.push({
      id: sid("hosts-quiet"),
      wave: 9,
      workloadId: "steward",
      action: "note",
      title: "No host update is offered",
      detail: `${quiet.map((h) => `${h.name} is ${h.current}`).join(". ")}. Nothing to apply.`,
      ms: 160,
    });
    return steps;
  }

  for (const h of waiting) {
    if (h.id === "unraid") {
      steps.push(
        settings.notifyHost
          ? notice(
              sid("unraid"),
              9,
              "Unraid OS is waiting",
              `${h.current} → ${h.available}. Steward will not apply this. USB boot stays a daylight job.`,
              "info",
              "host",
            )
          : {
              id: sid("unraid"),
              wave: 9,
              workloadId: h.id,
              action: "skip",
              title: "Unraid OS refused",
              detail: "Even on Hands-off, Steward does not apply Unraid OS updates.",
              ms: 160,
            },
      );
      continue;
    }
    if (h.posture === "notify" || h.posture === "locked" || h.posture === "retire") {
      steps.push(
        settings.notifyHost
          ? notice(
              sid("pve-note"),
              9,
              "Proxmox packages are waiting",
              `${h.current} → ${h.available}. Posture is ${POSTURE_META[h.posture].label}, so nothing was applied. Reboot would still be held.`,
              "info",
              "host",
            )
          : {
              id: sid("pve-skip"),
              wave: 9,
              workloadId: h.id,
              action: "skip",
              title: "Proxmox left alone",
              detail: `Posture is ${POSTURE_META[h.posture].label}.`,
              ms: 140,
            },
      );
      continue;
    }
    steps.push({
      id: sid("idle-check"),
      wave: 9,
      workloadId: h.id,
      action: "note",
      title: "Guests must be idle",
      detail: "The agent refuses the host window if a guest wave is still running.",
      ms: 160,
    });
    steps.push({
      id: sid("vzdump"),
      wave: 9,
      workloadId: h.id,
      action: "snapshot",
      title: "Snapshot the awkward guests",
      detail: "CT 100, CT 102, CT 110. Not every guest. Home Assistant and DNS stay up.",
      command: "vzdump 100 102 110 --mode snapshot --storage local --notes-template steward-host",
      ms: 280,
    });
    steps.push({
      id: sid("apt"),
      wave: 9,
      workloadId: h.id,
      action: "update",
      title: "apt full-upgrade on the node",
      detail: "force-confold. No surprises beyond what Proxmox already staged.",
      command: "apt-get update && apt-get -y -o Dpkg::Options::=--force-confold full-upgrade",
      ms: 300,
    });
    steps.push({
      id: sid("pve-probe"),
      wave: 9,
      workloadId: h.id,
      action: "probe",
      title: "Probe the API",
      detail: "HTTPS :8006 must answer before a reboot is even discussed.",
      command: `curl -sk ${settings.proxmoxUrl}/api2/json/version`,
      ms: 180,
    });
    steps.push({
      id: sid("reboot-hold"),
      wave: 9,
      workloadId: h.id,
      action: "skip",
      title: "Reboot held",
      detail: "The agent will not reboot the node unless STEWARD_ALLOW_HOST_REBOOT=1 and the window is still open.",
      ms: 180,
    });
    if (settings.notifyHost) {
      steps.push(notice(sid("host-phone"), 9, "Proxmox upgraded, reboot held", "Packages applied. The node has not rebooted.", "info", "host"));
    }
  }
  return steps;
}

export function rollbackSteps(workloadId: string, settings: Settings): Step[] {
  stepSeq += 20;
  if (workloadId === "gluetun") {
    return [
      {
        id: sid("rb"),
        wave: 7,
        workloadId: "gluetun",
        action: "rollback",
        title: "Restore Gluetun image",
        detail: "Recreate from the digest recorded before the pull. SABnzbd stays stopped until this answers.",
        command: `ssh root@${settings.unraidHost} docker start Gluetun`,
        ms: 240,
      },
      {
        id: sid("rb-probe"),
        wave: 7,
        workloadId: "gluetun",
        action: "probe",
        title: "Probe restored Gluetun",
        detail: "The public IP endpoint must answer before SABnzbd is allowed back.",
        command: "HTTP :8000/v1/publicip/ip",
        ms: 180,
      },
      {
        id: sid("rb-sab"),
        wave: 7,
        workloadId: "sab",
        action: "start",
        title: "Start sabnzbd on the restored network",
        detail: "Its own image update is skipped. The queue matters more than the bump.",
        command: `ssh root@${settings.unraidHost} docker start sabnzbd`,
        ms: 160,
      },
      {
        id: sid("rb-sab-probe"),
        wave: 7,
        workloadId: "sab",
        action: "probe",
        title: "Probe sabnzbd",
        detail: "WebUI on :7777.",
        command: "HTTP :7777",
        ms: 160,
      },
      notice(
        sid("rb-phone"),
        7,
        "Gluetun rolled back",
        "The new image failed its probe. The previous digest is running and sabnzbd is back. sabnzbd's own update was skipped.",
        "fault",
        "fault",
      ),
    ];
  }
  return [
    {
      id: sid("rb"),
      wave: 2,
      workloadId,
      action: "rollback",
      title: "Roll back snapshot",
      detail: "Stop, restore the pre-window snapshot, start. Guests that already probed clean stay updated.",
      command: `POST /nodes/${settings.proxmoxNode}/lxc/102/snapshot/steward/rollback`,
      ms: 260,
    },
    {
      id: sid("rb-probe"),
      wave: 2,
      workloadId,
      action: "probe",
      title: "Probe restored guest",
      detail: "The previous version must answer before the window continues.",
      ms: 180,
    },
    notice(
      sid("rb-phone"),
      2,
      "jellyfin rolled back",
      "The health check failed after the update. The snapshot is restored. The rest of the window continues.",
      "fault",
      "fault",
    ),
  ];
}

export function waveLabel(wave: number): string {
  switch (wave) {
    case 1:
      return "Wave 1 · leaves";
    case 2:
      return "Wave 2 · jellyfin";
    case 3:
      return "Wave 3 · prowlarr";
    case 4:
      return "Wave 4 · sonarr and radarr";
    case 5:
      return "Wave 5 · seerr";
    case 6:
      return "Wave 6 · proxy last";
    case 7:
      return "Wave 7 · download path";
    case 9:
      return "Host window";
    default:
      return "Outside the waves";
  }
}

export interface PolicyFile {
  version: 1;
  note: string;
  settings: Record<string, unknown>;
  workloads: Record<string, unknown>[];
}

export function exportPolicy(workloads: Workload[], settings: Settings): PolicyFile {
  return {
    version: 1,
    note: "Postures and windows are the contract. The agent re-checks real versions on the LAN. This file has no secrets.",
    settings: {
      tz: settings.tz,
      days: settings.days,
      startMin: settings.startMin,
      endMin: settings.endMin,
      armed: settings.armed,
      haWebhook: settings.haWebhook,
      ntfyServer: settings.ntfyServer,
      ntfyTopic: settings.ntfyTopic,
      notify: {
        start: settings.notifyStart,
        wave: settings.notifyWave,
        fault: settings.notifyFault,
        done: settings.notifyDone,
        host: settings.notifyHost,
      },
      deferJellyfinIfWatching: settings.deferJellyfinIfWatching,
      deferDownloadsIfBusy: settings.deferDownloadsIfBusy,
      proxmoxUrl: settings.proxmoxUrl,
      proxmoxNode: settings.proxmoxNode,
      tokenId: settings.tokenId,
      unraidHost: settings.unraidHost,
      unraidUrl: settings.unraidUrl,
      salutation: settings.salutation,
      houseName: settings.houseName,
    },
    workloads: workloads.map((w) => ({
      id: w.id,
      name: w.name,
      host: w.host,
      kind: w.kind,
      vmid: w.vmid ?? null,
      address: w.address ?? null,
      image: w.image ?? null,
      container: w.container ?? null,
      posture: w.posture,
      dependsOn: w.dependsOn,
      networkFrom: w.networkFrom ?? null,
      wave: w.wave,
      probe: w.probe ?? null,
      reboot: w.reboot ?? false,
    })),
  };
}

export function haAutomation(): string {
  return `alias: Steward to iPhone
description: LAN-only webhook from the Steward agent
triggers:
  - trigger: webhook
    webhook_id: steward
    allowed_methods:
      - POST
    local_only: true
actions:
  - action: notify.mobile_app_iphone
    data:
      title: "{{ trigger.json.title | default('Steward') }}"
      message: "{{ trigger.json.message | default('Window event') }}"
      data:
        push:
          interruption-level: >-
            {{ 'time-sensitive' if trigger.json.severity == 'fault' else 'active' }}
        tag: steward
mode: queued
`;
}

export function greeting(now: Date, salutation: string): string {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const h = Number(hour);
  const hello = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const who = salutation.trim();
  return who ? `${hello}, ${who}.` : `${hello}.`;
}

export const RETIRED_NOTE =
  "CT 108 and CT 112 are not in the tree. Storage on the node is localnetwork, local, and local-lvm.";
