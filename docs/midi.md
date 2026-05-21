# MIDI Guide

The MIDI tool turns the ring's raw accelerometer packets into MIDI control
changes.

## Setup

1. Connect the ring.
2. Select a MIDI output.
3. Choose a MIDI channel.
4. Set the X, Y, and Z CC numbers.
5. Use the Send button beside each CC number to map controls in your music app.
6. Turn Raw On.

## Controls

- Raw On starts the motion stream.
- Raw Off stops it.
- Quiet Sensors asks the ring to stop active health sensor streams.
- Health Logs Off disables periodic heart-rate and SpO2 logging.
- All Notes Off sends MIDI CC 123 on the selected channel.

The X, Y, and Z values can be inverted, smoothed, and rate-limited.

## Notes

The Send buttons emit one MIDI CC message at value `127`. They are meant for
MIDI-learn screens where continuous motion would make mapping difficult.

Motion streaming uses the current raw command path for these rings:

- raw on: `A10404`
- raw off: `A102`
