import { describe, expect, it } from "vitest";
import { decodeMotionPacket, int12 } from "../src/motion";
import type { RingPacket } from "../src/ringBle";

describe("ring packet decoding", () => {
  it("decodes signed 12-bit values", () => {
    expect(int12(0x7ff)).toBe(2047);
    expect(int12(0x800)).toBe(-2048);
    expect(int12(0xfff)).toBe(-1);
  });

  it("requires strict a103 raw motion packets", () => {
    const packet: RingPacket = {
      bytes: new Uint8Array([0xa1, 0x03, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00]),
      timestamp: 10,
      sourceService: "svc",
      sourceCharacteristic: "chr",
    };
    const reading = decodeMotionPacket(packet);
    expect(reading?.raw.x).toBe(256);
    expect(reading?.raw.y).toBe(0);
    expect(decodeMotionPacket({ ...packet, bytes: new Uint8Array([0xa1, 0x02, 0, 0, 0, 0, 0, 0]) })).toBeNull();
  });
});
