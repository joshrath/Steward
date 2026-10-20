import http from "node:http";
import https from "node:https";
import type { Workload } from "@/lib/steward/model";
import type { ScanRequest, ScanResult } from "@/lib/steward/scan";

const LIMIT = 1_000_000;

function parseBase(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "169.254.169.254" || host === "metadata.google.internal") return null;
  return url;
}

function explain(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|timed out|ETIMEDOUT|ECONNRESET/.test(msg)) {
    return "Nothing answered. This app can only see a private LAN when it is running on that network.";
  }
  return msg.slice(0, 200);
}

function request(url: URL, method: string, headers: Record<string, string>, body?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "http:" ? http : https;
    const req = lib.request(
      url,
      {
        method,
        headers,
        rejectUnauthorized: false,
        timeout: 8000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > LIMIT) {
            req.destroy();
            reject(new Error("response too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timed out"));
    });
    if (body) req.write(body);
    req.end();
  });
}

function suggestPosture(name: string): Workload["posture"] {
  const n = name.toLowerCase();
  if (/adguard|pi-?hole|technitium|(^|[^a-z])dns([^a-z]|$)/.test(n)) return "locked";
  if (/home-?assistant|^haos|hassio|^hass([^a-z]|$)/.test(n)) return "locked";
  return "notify";
}

function blank(partial: Pick<Workload, "id" | "name" | "host" | "kind"> & Partial<Workload>): Workload {
  return {
    current: "running",
    posture: partial.kind === "host" ? "notify" : suggestPosture(partial.name),
    wave: partial.kind === "host" || partial.posture === "locked" ? (partial.kind === "host" ? 9 : 0) : 1,
    note: "",
    ...partial,
    dependsOn: partial.dependsOn ?? [],
  };
}

function unique(base: string, used: Set<string>): string {
  const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
  let id = clean;
  let n = 2;
  while (used.has(id)) {
    id = `${clean}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

async function scanProxmox(input: ScanRequest, used: Set<string>): Promise<{ ok: boolean; guests: Workload[]; hosts: Workload[]; detail: string }> {
  const base = parseBase(input.proxmoxUrl);
  if (!base) return { ok: false, guests: [], hosts: [], detail: "Proxmox address is missing." };
  if (!input.tokenId.trim() || !input.tokenSecret.trim()) {
    return { ok: false, guests: [], hosts: [], detail: "Proxmox needs a token id and a token secret." };
  }
  const headers = { Authorization: `PVEAPIToken=${input.tokenId.trim()}=${input.tokenSecret.trim()}` };
  const root = new URL(base.origin);

  async function get(path: string): Promise<unknown> {
    const url = new URL(`/api2/json${path}`, root);
    const res = await request(url, "GET", headers);
    if (res.status === 401 || res.status === 403) throw new Error("The Proxmox token was refused.");
    if (res.status < 200 || res.status >= 300) throw new Error(`Proxmox answered ${res.status}.`);
    const json = JSON.parse(res.body) as { data?: unknown };
    return json.data;
  }

  const version = (await get("/version")) as { version?: string } | undefined;
  const nodes = (await get("/nodes")) as { node: string; status: string }[];
  const wanted = input.proxmoxNode.trim();
  const chosen = nodes.filter((n) => (wanted ? n.node === wanted : n.status === "online"));
  if (wanted && chosen.length === 0) throw new Error(`Node ${wanted} is not in the cluster.`);

  const guests: Workload[] = [];
  const hosts: Workload[] = [];
  for (const node of chosen) {
    hosts.push(
      blank({
        id: unique(`pve-${node.node}`, used),
        name: node.node,
        host: "proxmox",
        kind: "host",
        current: version?.version || node.status,
        posture: "notify",
        wave: 9,
        note: "Proxmox node, read from the API. A reboot is never part of a guest window.",
        probe: "HTTPS :8006",
      }),
    );
    const lxc = (await get(`/nodes/${encodeURIComponent(node.node)}/lxc`)) as { vmid: number; name?: string; status?: string }[];
    const qemu = (await get(`/nodes/${encodeURIComponent(node.node)}/qemu`)) as { vmid: number; name?: string; status?: string }[];
    for (const ct of lxc) {
      const name = ct.name || `ct-${ct.vmid}`;
      const status = ct.status || "unknown";
      guests.push(
        blank({
          id: unique(`ct-${ct.vmid}`, used),
          name,
          host: "proxmox",
          kind: "lxc",
          vmid: ct.vmid,
          current: status,
          posture: suggestPosture(name),
          wave: suggestPosture(name) === "locked" ? 0 : 1,
          note: `CT ${ct.vmid} on ${node.node}. Status is ${status}.`,
          probe: "running",
        }),
      );
    }
    for (const vm of qemu) {
      const name = vm.name || `vm-${vm.vmid}`;
      const status = vm.status || "unknown";
      guests.push(
        blank({
          id: unique(`vm-${vm.vmid}`, used),
          name,
          host: "proxmox",
          kind: "vm",
          vmid: vm.vmid,
          current: status,
          posture: suggestPosture(name),
          wave: suggestPosture(name) === "locked" ? 0 : 1,
          note: `VM ${vm.vmid} on ${node.node}. Status is ${status}.`,
          probe: "running",
        }),
      );
    }
  }
  return {
    ok: true,
    guests,
    hosts,
    detail: `${guests.length} guest${guests.length === 1 ? "" : "s"} on ${chosen.map((n) => n.node).join(", ") || "no node"}.`,
  };
}

async function scanUnraid(input: ScanRequest, used: Set<string>): Promise<{ ok: boolean; guests: Workload[]; hosts: Workload[]; detail: string }> {
  const base = parseBase(input.unraidUrl);
  if (!base) return { ok: false, guests: [], hosts: [], detail: "Unraid address is missing." };
  if (!input.unraidKey.trim()) return { ok: false, guests: [], hosts: [], detail: "Unraid needs an API key." };
  const url = new URL(base.pathname.replace(/\/$/, "").endsWith("/graphql") ? base.pathname : `${base.pathname.replace(/\/$/, "")}/graphql`, base);
  const query = `query { info { versions { core { unraid } } } docker { containers { id names image state isUpdateAvailable } } }`;
  const res = await request(
    url,
    "POST",
    { "content-type": "application/json", "x-api-key": input.unraidKey.trim() },
    JSON.stringify({ query }),
  );
  if (res.status === 401 || res.status === 403) throw new Error("The Unraid API key was refused.");
  if (res.status < 200 || res.status >= 300) throw new Error(`Unraid answered ${res.status}.`);
  const json = JSON.parse(res.body) as {
    errors?: { message?: string }[];
    data?: {
      info?: { versions?: { core?: { unraid?: string } } };
      docker?: { containers?: { id?: string; names?: string[]; image?: string; state?: string; isUpdateAvailable?: boolean }[] };
    };
  };
  if (json.errors?.length && !json.data?.docker) {
    throw new Error(json.errors[0]?.message || "Unraid refused the query.");
  }
  const version = json.data?.info?.versions?.core?.unraid;
  const containers = json.data?.docker?.containers ?? [];
  const guests = containers.map((c) => {
    const name = (c.names?.[0] || c.id || "container").replace(/^\//, "");
    const state = (c.state || "unknown").toLowerCase();
    const running = state === "running";
    return blank({
      id: unique(name, used),
      name,
      host: "unraid",
      kind: "docker",
      container: name,
      image: c.image,
      current: running ? "running" : state,
      available: c.isUpdateAvailable ? "update ready" : undefined,
      posture: suggestPosture(name),
      wave: suggestPosture(name) === "locked" ? 0 : 1,
      note: c.isUpdateAvailable ? `${name} reports an image update.` : `${name} is ${state}.`,
      probe: "running",
    });
  });
  const hosts = [
    blank({
      id: unique("unraid", used),
      name: "Unraid",
      host: "unraid",
      kind: "host",
      address: base.hostname,
      current: version || "running",
      posture: "notify",
      wave: 9,
      note: version ? `Unraid ${version}, read from the API. Steward will not apply OS updates.` : "Unraid host, read from the API.",
      probe: "HTTP",
    }),
  ];
  return { ok: true, guests, hosts, detail: `${guests.length} container${guests.length === 1 ? "" : "s"}${version ? `, Unraid ${version}` : ""}.` };
}

export async function runScan(input: ScanRequest): Promise<ScanResult> {
  const used = new Set<string>();
  const proxmox = await scanProxmox(input, used).catch((err: unknown) => ({
    ok: false,
    guests: [] as Workload[],
    hosts: [] as Workload[],
    detail: explain(err),
  }));
  const unraid = await scanUnraid(input, used).catch((err: unknown) => ({
    ok: false,
    guests: [] as Workload[],
    hosts: [] as Workload[],
    detail: explain(err),
  }));
  return {
    guests: [...proxmox.guests, ...unraid.guests],
    hosts: [...proxmox.hosts, ...unraid.hosts],
    proxmox: { ok: proxmox.ok, detail: proxmox.detail },
    unraid: { ok: unraid.ok, detail: unraid.detail },
  };
}
