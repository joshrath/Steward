import { createServerFn } from "@tanstack/react-start";
import type { Workload } from "@/lib/steward/model";

export interface ScanRequest {
  proxmoxUrl: string;
  proxmoxNode: string;
  tokenId: string;
  tokenSecret: string;
  unraidUrl: string;
  unraidKey: string;
}

export interface ScanSide {
  ok: boolean;
  detail: string;
}

export interface ScanResult {
  guests: Workload[];
  hosts: Workload[];
  proxmox: ScanSide;
  unraid: ScanSide;
}

export const scanHouse = createServerFn({ method: "POST" })
  .validator((data: ScanRequest) => data)
  .handler(async ({ data }) => {
    const { runScan } = await import("./scan.server");
    return runScan(data);
  });
