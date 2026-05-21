import { describe, expect, it } from "vitest";
import { profileAcceptsDevice, validateManifest, type FirmwareManifest } from "../src/firmware";
import manifestJson from "../public/firmware/manifest.json";

const manifest = manifestJson as FirmwareManifest;

describe("firmware manifest", () => {
  it("is schema-valid and user-facing", () => {
    expect(() => validateManifest(manifest)).not.toThrow();
    expect(manifest.firmware.map((entry) => entry.id)).toEqual([
      "rt02r-low-latency",
      "rt02cr-low-latency",
      "rt02r-stock-restore",
      "rt02r-recovery",
    ]);
  });

  it("matches recommended firmware to connected ring states", () => {
    const rt02r = manifest.firmware.find((entry) => entry.id === "rt02r-low-latency");
    const rt02cr = manifest.firmware.find((entry) => entry.id === "rt02cr-low-latency");
    expect(rt02r).toBeDefined();
    expect(rt02cr).toBeDefined();
    expect(profileAcceptsDevice(rt02r!, { hardware: "RT02R12_V3.1", firmware: "RT02R12_3.12.55_260513" })).toBe(
      true,
    );
    expect(profileAcceptsDevice(rt02cr!, { hardware: "RT02R12_V3.1", firmware: "RT02R12_3.12.06_260514" })).toBe(
      true,
    );
    expect(profileAcceptsDevice(rt02cr!, { hardware: "RT02R12_V3.1", firmware: "RT02R12_3.12.67_260514" })).toBe(
      false,
    );
  });

  it("does not expose development-only firmware", () => {
    for (const entry of manifest.firmware) {
      expect(entry.role === "recommended" || entry.role === "stock" || entry.role === "recovery").toBe(true);
      expect(entry.fileName).toMatch(/^[a-z0-9-]+\.bin$/);
    }
  });
});
