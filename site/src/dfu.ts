import type { FirmwareEntry } from "./firmware";

export const QRING_DFU_MAGIC = 0xbc;
export const DFU_START = 0x01;
export const DFU_INIT = 0x02;
export const DFU_DATA = 0x03;
export const DFU_CHECK = 0x04;
export const DFU_END = 0x05;
export const DEFAULT_CHUNK_SIZE_BYTES = 1024;

export interface DfuFrame {
  command: number;
  bytes: Uint8Array;
  hex: string;
  payloadCrc16: number;
}

export interface ParsedDfuResponse {
  valid: boolean;
  command: number | null;
  statusCode: number | null;
  statusName: string;
  error: string | null;
}

export function crc16Modbus(bytes: ArrayLike<number>): number {
  let crc = 0xffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index] & 0xff;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc & 0xffff;
}

export function checksum16(bytes: ArrayLike<number>): number {
  let sum = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    sum = (sum + (bytes[index] & 0xff)) & 0xffff;
  }
  return sum;
}

export function bytesToHex(bytes: ArrayLike<number>): string {
  return [...Array.from({ length: bytes.length }, (_, index) => bytes[index])]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function buildDfuFrame(command: number, payload = new Uint8Array()): DfuFrame {
  const payloadCrc16 = crc16Modbus(payload);
  const frame = new Uint8Array(6 + payload.byteLength);
  frame[0] = QRING_DFU_MAGIC;
  frame[1] = command & 0xff;
  frame[2] = payload.byteLength & 0xff;
  frame[3] = (payload.byteLength >>> 8) & 0xff;
  frame[4] = payloadCrc16 & 0xff;
  frame[5] = (payloadCrc16 >>> 8) & 0xff;
  frame.set(payload, 6);
  return {
    command,
    bytes: frame,
    hex: bytesToHex(frame),
    payloadCrc16,
  };
}

export function buildStartFrame(): DfuFrame {
  return buildDfuFrame(DFU_START);
}

export function buildInitFrame(firmware: Uint8Array, initType: 1 | 4): DfuFrame {
  const payload = new Uint8Array(9);
  const view = new DataView(payload.buffer);
  payload[0] = initType;
  view.setUint32(1, firmware.byteLength, true);
  view.setUint16(5, crc16Modbus(firmware), true);
  view.setUint16(7, checksum16(firmware), true);
  return buildDfuFrame(DFU_INIT, payload);
}

export function buildDataFrame(firmware: Uint8Array, chunkIndex: number): DfuFrame {
  const offset = chunkIndex * DEFAULT_CHUNK_SIZE_BYTES;
  const chunk = firmware.slice(offset, offset + DEFAULT_CHUNK_SIZE_BYTES);
  const payload = new Uint8Array(2 + chunk.byteLength);
  const view = new DataView(payload.buffer);
  view.setUint16(0, chunkIndex + 1, true);
  payload.set(chunk, 2);
  return buildDfuFrame(DFU_DATA, payload);
}

export function buildCheckFrame(): DfuFrame {
  return buildDfuFrame(DFU_CHECK);
}

export function buildEndFrame(): DfuFrame {
  return buildDfuFrame(DFU_END);
}

export function chunkCount(byteLength: number): number {
  return Math.ceil(byteLength / DEFAULT_CHUNK_SIZE_BYTES);
}

export function segmentFrame(frame: DfuFrame, segmentBytes: number): Uint8Array[] {
  if (!Number.isInteger(segmentBytes) || segmentBytes < 20) {
    throw new Error("DFU segment size must be at least 20 bytes.");
  }
  const segments: Uint8Array[] = [];
  for (let offset = 0; offset < frame.bytes.byteLength; offset += segmentBytes) {
    segments.push(frame.bytes.slice(offset, offset + segmentBytes));
  }
  return segments;
}

export function parseDfuResponse(bytes: Uint8Array | number[]): ParsedDfuResponse {
  if (bytes.length < 6) {
    return invalid("Frame is shorter than the 6-byte QRing DFU header.");
  }
  if (bytes[0] !== QRING_DFU_MAGIC) {
    return invalid("Frame magic is not 0xBC.");
  }
  const payloadLength = bytes[2] | (bytes[3] << 8);
  if (payloadLength !== bytes.length - 6) {
    return invalid("Frame payload length does not match frame size.");
  }
  const stored = bytes[4] | (bytes[5] << 8);
  const payload = bytes.slice(6);
  const computed = crc16Modbus(payload);
  if (stored !== computed) {
    return invalid("Frame CRC16 does not match payload.");
  }
  const statusCode = payload.length > 0 ? payload[0] : null;
  return {
    valid: true,
    command: bytes[1],
    statusCode,
    statusName: statusCode === 0 ? "ok" : statusName(statusCode),
    error: null,
  };
}

export function firmwareStats(bytes: Uint8Array): { size: number; crc16: string; checksum16: string; sha256?: string } {
  return {
    size: bytes.byteLength,
    crc16: `0x${crc16Modbus(bytes).toString(16).padStart(4, "0")}`,
    checksum16: `0x${checksum16(bytes).toString(16).padStart(4, "0")}`,
  };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hash = await crypto.subtle.digest("SHA-256", copy.buffer);
  return bytesToHex(new Uint8Array(hash));
}

export async function verifyFirmwareBytes(entry: FirmwareEntry, bytes: Uint8Array): Promise<void> {
  if (bytes.byteLength !== entry.size) {
    throw new Error(`Size mismatch: expected ${entry.size}, got ${bytes.byteLength}.`);
  }
  const digest = await sha256Hex(bytes);
  if (digest !== entry.sha256) {
    throw new Error(`SHA-256 mismatch: expected ${entry.sha256}, got ${digest}.`);
  }
  const stats = firmwareStats(bytes);
  if (stats.crc16.toLowerCase() !== entry.crc16.toLowerCase()) {
    throw new Error(`CRC16 mismatch: expected ${entry.crc16}, got ${stats.crc16}.`);
  }
  if (stats.checksum16.toLowerCase() !== entry.checksum16.toLowerCase()) {
    throw new Error(`Checksum16 mismatch: expected ${entry.checksum16}, got ${stats.checksum16}.`);
  }
}

function invalid(error: string): ParsedDfuResponse {
  return {
    valid: false,
    command: null,
    statusCode: null,
    statusName: "invalid",
    error,
  };
}

function statusName(statusCode: number | null): string {
  switch (statusCode) {
    case null:
      return "missing-status";
    case 1:
      return "data-size";
    case 2:
      return "data-content";
    case 3:
      return "command-status";
    case 4:
      return "command-format";
    case 5:
      return "inner-error";
    case 6:
      return "low-battery";
    default:
      return `status-${statusCode}`;
  }
}
