import type { MotionReading } from "./motion";

export interface MidiMapping {
  xCc: number;
  yCc: number;
  zCc: number;
  channel: number;
  smoothing: number;
  deadband: number;
  rateLimitHz: number;
  invertX: boolean;
  invertY: boolean;
  invertZ: boolean;
}

export interface MidiValues {
  x: number;
  y: number;
  z: number;
}

const DEFAULT_VALUES: MidiValues = { x: 64, y: 64, z: 64 };

export class MidiController {
  private access: MIDIAccess | null = null;
  private output: MIDIOutput | null = null;
  private lastValues: MidiValues = { ...DEFAULT_VALUES };
  private smoothed: MidiValues = { ...DEFAULT_VALUES };
  private lastSentAt = 0;

  async initialize(): Promise<MIDIOutput[]> {
    if (!navigator.requestMIDIAccess) {
      throw new Error("Web MIDI is not available in this browser.");
    }
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    const outputs = this.outputs();
    this.output = outputs[0] ?? null;
    return outputs;
  }

  outputs(): MIDIOutput[] {
    return this.access ? [...this.access.outputs.values()] : [];
  }

  setOutput(outputId: string): void {
    this.output = this.access?.outputs.get(outputId) ?? null;
  }

  sendMotion(reading: MotionReading, mapping: MidiMapping, now = performance.now()): MidiValues | null {
    const minIntervalMs = 1000 / Math.max(mapping.rateLimitHz, 1);
    if (now - this.lastSentAt < minIntervalMs) return null;
    const target = motionToMidi(reading, mapping);
    this.smoothed = smoothMidiValues(this.smoothed, target, mapping.smoothing);
    const rounded = roundMidiValues(this.smoothed);
    const changed =
      Math.abs(rounded.x - this.lastValues.x) > mapping.deadband ||
      Math.abs(rounded.y - this.lastValues.y) > mapping.deadband ||
      Math.abs(rounded.z - this.lastValues.z) > mapping.deadband;
    if (!changed) return rounded;

    this.sendCc(mapping.xCc, rounded.x, mapping.channel);
    this.sendCc(mapping.yCc, rounded.y, mapping.channel);
    this.sendCc(mapping.zCc, rounded.z, mapping.channel);
    this.lastValues = rounded;
    this.lastSentAt = now;
    return rounded;
  }

  sendSingleCc(cc: number, value: number, channel: number): boolean {
    return this.sendCc(cc, value, channel);
  }

  allNotesOff(channel: number): void {
    this.sendCc(123, 0, channel);
  }

  private sendCc(cc: number, value: number, channel: number): boolean {
    if (!this.output) return false;
    this.output.send([0xb0 + clampChannel(channel), clamp7(cc), clamp7(value)]);
    return true;
  }
}

export function motionToMidi(reading: MotionReading, mapping: Pick<MidiMapping, "invertX" | "invertY" | "invertZ">): MidiValues {
  const x = tiltToMidi(reading.g.x, reading.g.y, reading.g.z, mapping.invertX);
  const y = tiltToMidi(reading.g.y, reading.g.x, reading.g.z, mapping.invertY);
  const z = tiltToMidi(reading.g.z, reading.g.x, reading.g.y, mapping.invertZ);
  return { x, y, z };
}

export function tiltToMidi(axisG: number, otherA: number, otherB: number, invert: boolean): number {
  const ratio = 127 / Math.PI;
  const angle = Math.atan2(axisG, Math.sqrt(otherA * otherA + otherB * otherB));
  const value = (angle + Math.PI / 2) * ratio;
  return invert ? 127 - clamp7(value) : clamp7(value);
}

export function smoothMidiValues(current: MidiValues, target: MidiValues, smoothing: number): MidiValues {
  const alpha = 1 - Math.min(Math.max(smoothing, 0), 0.95);
  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
    z: current.z + (target.z - current.z) * alpha,
  };
}

export function roundMidiValues(values: MidiValues): MidiValues {
  return {
    x: clamp7(Math.round(values.x)),
    y: clamp7(Math.round(values.y)),
    z: clamp7(Math.round(values.z)),
  };
}

function clamp7(value: number): number {
  return Math.min(127, Math.max(0, Math.round(value)));
}

function clampChannel(channel: number): number {
  return Math.min(15, Math.max(0, Math.round(channel)));
}
