import { describe, expect, it } from "vitest";
import { decodeSensorPacket, formatSensorValue } from "../src/health";
import type { RingPacket } from "../src/ringBle";

function packet(bytes: number[]): RingPacket {
  return {
    bytes: new Uint8Array(bytes),
    timestamp: 100,
    sourceService: "svc",
    sourceCharacteristic: "chr",
  };
}

describe("health sensor packets", () => {
  it("decodes realtime heart rate readings", () => {
    const reading = decodeSensorPacket(packet([0x69, 0x01, 0x00, 72]));
    expect(reading?.label).toBe("Heart rate");
    expect(reading?.value).toBe(72);
    expect(formatSensorValue(reading ?? undefined)).toBe("72 bpm");
  });

  it("decodes realtime blood oxygen readings", () => {
    const reading = decodeSensorPacket(packet([0x69, 0x03, 0x00, 98]));
    expect(reading?.label).toBe("Blood oxygen");
    expect(formatSensorValue(reading ?? undefined)).toBe("98%");
  });

  it("keeps extra realtime sensor kinds visible", () => {
    const reading = decodeSensorPacket(packet([0x69, 0x09, 0x00, 5]));
    expect(reading?.label).toBe("Blood sugar");
    expect(formatSensorValue(reading ?? undefined)).toBe("5");
  });

  it("reports sensor error packets", () => {
    const reading = decodeSensorPacket(packet([0x69, 0x01, 0x02, 0]));
    expect(reading?.value).toBeNull();
    expect(formatSensorValue(reading ?? undefined)).toBe("Error 2");
  });

  it("ignores non-realtime packets", () => {
    expect(decodeSensorPacket(packet([0xa1, 0x03, 0x00, 0x00]))).toBeNull();
  });
});
