import { describe, expect, it } from "vitest";
import {
  buildDataFrame,
  buildDfuFrame,
  buildInitFrame,
  buildStartFrame,
  checksum16,
  chunkCount,
  crc16Modbus,
  parseDfuResponse,
  segmentFrame,
} from "../src/dfu";

describe("QRing DFU helpers", () => {
  it("matches CRC-16/MODBUS reference vectors", () => {
    const bytes = [..."123456789"].map((character) => character.charCodeAt(0));
    expect(crc16Modbus(bytes)).toBe(0x4b37);
    expect(crc16Modbus([])).toBe(0xffff);
  });

  it("builds start and init frames", () => {
    expect(buildStartFrame().hex).toBe("bc010000ffff");
    const firmware = new Uint8Array([1, 2, 3]);
    expect(checksum16(firmware)).toBe(6);
    expect(buildInitFrame(firmware, 1).hex).toBe("bc0209000af7010300000061610600");
    expect(buildInitFrame(firmware, 4).hex).toBe("bc02090035a7040300000061610600");
  });

  it("segments data frames using the public 240-byte slice size", () => {
    const firmware = new Uint8Array(2050);
    expect(chunkCount(firmware.byteLength)).toBe(3);
    const frame = buildDataFrame(firmware, 0);
    const segments = segmentFrame(frame, 240);
    expect(segments).toHaveLength(5);
    expect(segments.at(-1)?.byteLength).toBe(72);
  });

  it("parses valid and invalid responses", () => {
    const ok = buildDfuFrame(1, new Uint8Array([0]));
    expect(parseDfuResponse(ok.bytes)).toMatchObject({ valid: true, command: 1, statusCode: 0 });
    expect(parseDfuResponse(new Uint8Array([0xbd, 1, 0, 0, 255, 255]))).toMatchObject({
      valid: false,
      error: "Frame magic is not 0xBC.",
    });
  });
});
