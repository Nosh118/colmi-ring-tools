import { describe, expect, it } from "vitest";
import { isSupportedRingName, SUPPORTED_RING_NAME_PREFIXES } from "../src/ringBle";

describe("ring BLE device names", () => {
  it("uses picker prefixes for common R02 advertisements", () => {
    expect(SUPPORTED_RING_NAME_PREFIXES).toEqual(
      expect.arrayContaining(["R02", "COLMI R02", "Colmi R02", "TR-R02"]),
    );
  });

  it("accepts R02 anywhere in the advertised name", () => {
    expect(isSupportedRingName("R02")).toBe(true);
    expect(isSupportedRingName("R02_1234")).toBe(true);
    expect(isSupportedRingName("COLMI R02")).toBe(true);
    expect(isSupportedRingName("COLMI R02 1234")).toBe(true);
    expect(isSupportedRingName("TR-R02")).toBe(true);
    expect(isSupportedRingName("My Ring R02")).toBe(true);
  });

  it("rejects non-R02 device names", () => {
    expect(isSupportedRingName(undefined)).toBe(false);
    expect(isSupportedRingName("")).toBe(false);
    expect(isSupportedRingName("COLMI R03")).toBe(false);
    expect(isSupportedRingName("Headphones")).toBe(false);
  });
});
