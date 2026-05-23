import { describe, expect, it } from "vitest";
import { isSupportedRingName } from "../src/ringBle";

describe("ring BLE device names", () => {
  it("accepts R02 anywhere in the advertised name", () => {
    expect(isSupportedRingName("R02")).toBe(true);
    expect(isSupportedRingName("R02_1234")).toBe(true);
    expect(isSupportedRingName("COLMI R02")).toBe(true);
    expect(isSupportedRingName("COLMI R02 1234")).toBe(true);
  });

  it("rejects non-R02 device names", () => {
    expect(isSupportedRingName(undefined)).toBe(false);
    expect(isSupportedRingName("")).toBe(false);
    expect(isSupportedRingName("COLMI R03")).toBe(false);
    expect(isSupportedRingName("Headphones")).toBe(false);
  });
});
