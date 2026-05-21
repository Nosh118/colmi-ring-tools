# Contributing

Keep this repo small and practical.

## Firmware

- Add only firmware that has a clear end-user purpose.
- Every catalog binary needs size, SHA-256, CRC16, checksum16, target device,
  init type, and battery threshold in `site/public/firmware/manifest.json`.
- Do not add APKs, SDK archives, private captures, decompiled app trees, or
  generated build output.
- Do not add experimental firmware that weakens OTA recovery.

## Tools

- Flasher changes should preserve manifest verification for catalog files,
  explicit confirmation, 240-byte DFU slicing, and stop-on-error behavior.
- MIDI changes should keep strict `a103` raw packet parsing and the current raw
  commands: `A10404` for raw on and `A102` for raw off.
- Prefer tests for pure behavior: manifest validation, DFU frames, MIDI
  mapping, smoothing, and compatibility decisions.

## Verification

Run:

```sh
cd site
npm test
npm run validate:release
npm run build
```
