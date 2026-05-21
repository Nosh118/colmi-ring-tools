import { describe, expect, it } from "vitest";
import { motionToMidi, smoothMidiValues, tiltToMidi } from "../src/midi";
import type { MotionReading } from "../src/motion";

describe("MIDI mapping", () => {
  const reading: MotionReading = {
    timestamp: 0,
    raw: { x: 0, y: 0, z: 2048 },
    g: { x: 0, y: 0, z: 4 },
    magnitudeG: 4,
    packetBytes: [0xa1, 0x03, 0, 0, 0, 0, 0, 0],
  };

  it("maps neutral axes into MIDI range", () => {
    expect(tiltToMidi(0, 0, 4, false)).toBe(64);
    expect(tiltToMidi(0, 0, 4, true)).toBe(63);
    expect(tiltToMidi(4, 0, 0, false)).toBe(127);
  });

  it("maps motion readings and supports inversion", () => {
    expect(motionToMidi(reading, { invertX: false, invertY: false, invertZ: false })).toEqual({
      x: 64,
      y: 64,
      z: 127,
    });
    expect(motionToMidi(reading, { invertX: false, invertY: false, invertZ: true }).z).toBe(0);
  });

  it("smooths toward targets", () => {
    expect(smoothMidiValues({ x: 0, y: 50, z: 100 }, { x: 100, y: 100, z: 0 }, 0.5)).toEqual({
      x: 50,
      y: 75,
      z: 50,
    });
  });
});
