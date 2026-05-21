export type FirmwareRole = "recommended" | "stock" | "recovery";

export interface FirmwareEntry {
  id: string;
  label: string;
  role: FirmwareRole;
  deviceFamily: "RT02R" | "RT02CR";
  fileName: string;
  path: string;
  compatibleCurrentHardware: string[];
  compatibleCurrentFirmware: string[];
  compatibleCurrentFirmwarePrefixes: string[];
  size: number;
  sha256: string;
  crc16: string;
  checksum16: string;
  initType: 1 | 4;
  minBatteryPercent: number;
  gateText: string;
  patchSummary: string;
  publicDefault: boolean;
}

export interface FirmwareManifest {
  schemaVersion: 1;
  generatedAt: string;
  transferConfirmText: string;
  defaultDfuSegmentBytes: number;
  firmware: FirmwareEntry[];
}

export interface DeviceInfoLike {
  hardware?: string;
  firmware?: string;
}

export function profileAcceptsDevice(entry: FirmwareEntry, device: DeviceInfoLike): boolean {
  const hardware = normalise(device.hardware);
  const firmware = normalise(device.firmware);
  if (!hardware || !firmware) return false;

  const hardwareOk = entry.compatibleCurrentHardware.map(normalise).includes(hardware);
  const firmwareOk =
    entry.compatibleCurrentFirmware.map(normalise).includes(firmware) ||
    entry.compatibleCurrentFirmwarePrefixes.some((prefix) => firmware.startsWith(normalise(prefix)));

  return hardwareOk && firmwareOk;
}

export function compatibilityReason(entry: FirmwareEntry, device: DeviceInfoLike): string {
  if (profileAcceptsDevice(entry, device)) return "Compatible with the connected ring state.";
  if (!device.hardware || !device.firmware) return "Connect a ring and read Device Information first.";
  return `Expected hardware ${entry.compatibleCurrentHardware.join(" or ")} and firmware ${[
    ...entry.compatibleCurrentFirmware,
    ...entry.compatibleCurrentFirmwarePrefixes.map((prefix) => `${prefix}*`),
  ].join(" or ")}.`;
}

export function normalise(value: string | undefined): string {
  return (value ?? "").trim();
}

export async function loadFirmwareManifest(): Promise<FirmwareManifest> {
  const response = await fetch("./firmware/manifest.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Firmware manifest fetch failed: HTTP ${response.status}`);
  }
  const manifest = (await response.json()) as FirmwareManifest;
  validateManifest(manifest);
  return manifest;
}

export function validateManifest(manifest: FirmwareManifest): void {
  if (manifest.schemaVersion !== 1) {
    throw new Error("Unsupported firmware manifest schema.");
  }
  if (!Number.isInteger(manifest.defaultDfuSegmentBytes) || manifest.defaultDfuSegmentBytes < 20) {
    throw new Error("Manifest defaultDfuSegmentBytes must be at least 20.");
  }
  const ids = new Set<string>();
  for (const entry of manifest.firmware) {
    if (ids.has(entry.id)) throw new Error(`Duplicate firmware id ${entry.id}.`);
    ids.add(entry.id);
    if (!entry.path.startsWith("./firmware/")) throw new Error(`${entry.id} path must stay under ./firmware/.`);
    if (entry.path !== `./firmware/${entry.fileName}`) throw new Error(`${entry.id} path and fileName mismatch.`);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`${entry.id} has invalid SHA-256.`);
    if (entry.size <= 0) throw new Error(`${entry.id} has invalid size.`);
    if (entry.initType !== 1 && entry.initType !== 4) throw new Error(`${entry.id} has invalid init type.`);
    if (!/^[a-z0-9-]+\.bin$/.test(entry.fileName)) {
      throw new Error(`${entry.id} must use a user-facing firmware filename.`);
    }
  }
}
