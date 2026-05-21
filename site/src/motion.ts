import type { RingPacket } from "./ringBle";

export interface MotionReading {
  timestamp: number;
  raw: { x: number; y: number; z: number };
  g: { x: number; y: number; z: number };
  magnitudeG: number;
  packetBytes: number[];
}

export interface MotionStatsSnapshot {
  sampleRateHz: number;
  meanIntervalMs: number;
  jitterMs: number;
  packetCount: number;
}

export function int12(value: number): number {
  const clean = value & 0xfff;
  return clean > 2047 ? clean - 4096 : clean;
}

export function rawToG(rawValue: number): number {
  return (rawValue / 2048) * 4;
}

export function decodeMotionPacket(packet: RingPacket): MotionReading | null {
  const value = packet.bytes;
  if (value.byteLength < 8 || value[0] !== 0xa1 || value[1] !== 0x03) {
    return null;
  }
  const rawY = int12(((value[2] << 4) | (value[3] & 0x0f)) & 0xfff);
  const rawZ = int12(((value[4] << 4) | (value[5] & 0x0f)) & 0xfff);
  const rawX = int12(((value[6] << 4) | (value[7] & 0x0f)) & 0xfff);
  const x = rawToG(rawX);
  const y = rawToG(rawY);
  const z = rawToG(rawZ);
  const magnitudeG = Math.sqrt(x * x + y * y + z * z);
  return {
    timestamp: packet.timestamp,
    raw: { x: rawX, y: rawY, z: rawZ },
    g: { x, y, z },
    magnitudeG,
    packetBytes: [...value],
  };
}

export class MotionStats {
  private readonly intervals: number[] = [];
  private readonly recentTimestamps: number[] = [];
  private previousTimestamp: number | null = null;
  private packetCount = 0;

  push(timestamp: number): MotionStatsSnapshot {
    if (this.previousTimestamp !== null) {
      const interval = timestamp - this.previousTimestamp;
      if (interval > 0 && interval < 1000) {
        this.intervals.push(interval);
        if (this.intervals.length > 128) this.intervals.shift();
      }
    }
    this.previousTimestamp = timestamp;
    this.packetCount += 1;
    this.recentTimestamps.push(timestamp);
    const cutoff = timestamp - 1000;
    while (this.recentTimestamps.length > 0 && this.recentTimestamps[0] < cutoff) this.recentTimestamps.shift();
    return this.snapshot();
  }

  snapshot(): MotionStatsSnapshot {
    const sampleRateHz = this.recentTimestamps.length > 1 ? this.recentTimestamps.length : 0;
    if (this.intervals.length === 0) {
      return { sampleRateHz, meanIntervalMs: 0, jitterMs: 0, packetCount: this.packetCount };
    }
    const meanIntervalMs = this.intervals.reduce((sum, value) => sum + value, 0) / this.intervals.length;
    const variance =
      this.intervals.reduce((sum, value) => sum + (value - meanIntervalMs) ** 2, 0) / this.intervals.length;
    return { sampleRateHz, meanIntervalMs, jitterMs: Math.sqrt(variance), packetCount: this.packetCount };
  }

  reset(): void {
    this.intervals.length = 0;
    this.recentTimestamps.length = 0;
    this.previousTimestamp = null;
    this.packetCount = 0;
  }
}
