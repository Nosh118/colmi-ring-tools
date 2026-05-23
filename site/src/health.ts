import { bytesToHex } from "./dfu";
import type { RingPacket } from "./ringBle";

export const REALTIME_DATA_COMMAND = 0x69;
export const HEART_RATE_KIND = 1;
export const BLOOD_OXYGEN_KIND = 3;

export interface SensorReading {
  timestamp: number;
  kind: number;
  label: string;
  value: number | null;
  unit: string;
  errorCode: number | null;
  packetHex: string;
}

const SENSOR_LABELS = new Map<number, string>([
  [HEART_RATE_KIND, "Heart rate"],
  [2, "Blood pressure"],
  [BLOOD_OXYGEN_KIND, "Blood oxygen"],
  [4, "Fatigue"],
  [5, "Health check"],
  [6, "Realtime heart rate"],
  [7, "ECG"],
  [8, "Pressure"],
  [9, "Blood sugar"],
  [10, "HRV"],
]);

export function decodeSensorPacket(packet: RingPacket): SensorReading | null {
  const bytes = packet.bytes;
  if (bytes.byteLength < 4 || bytes[0] !== REALTIME_DATA_COMMAND) return null;
  const kind = bytes[1];
  const errorCode = bytes[2] === 0 ? null : bytes[2];
  return {
    timestamp: packet.timestamp,
    kind,
    label: sensorLabel(kind),
    value: errorCode === null ? bytes[3] : null,
    unit: sensorUnit(kind),
    errorCode,
    packetHex: bytesToHex(bytes),
  };
}

export function sensorLabel(kind: number): string {
  return SENSOR_LABELS.get(kind) ?? `Sensor ${kind}`;
}

export function sensorUnit(kind: number): string {
  if (kind === HEART_RATE_KIND || kind === 6) return "bpm";
  if (kind === BLOOD_OXYGEN_KIND) return "%";
  return "";
}

export function formatSensorValue(reading: SensorReading | undefined): string {
  if (!reading) return "No data";
  if (reading.errorCode !== null) return `Error ${reading.errorCode}`;
  if (reading.value === null) return "No data";
  if (reading.unit === "%") return `${reading.value}%`;
  return `${reading.value}${reading.unit ? ` ${reading.unit}` : ""}`;
}
