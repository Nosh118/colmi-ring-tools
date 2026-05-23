# Firmware Notes

This project makes RT02R and RT02CR rings useful as low-latency motion
controllers. The stock firmware can stream raw accelerometer data, but it does
so too slowly for responsive MIDI control. The low-latency firmware keeps the
normal BLE services and OTA format while changing the raw motion path.

## Firmware Choices

- `rt02r-low-latency.bin`: recommended RT02R firmware for motion control.
- `rt02cr-low-latency.bin`: recommended RT02CR firmware for motion control.
- `rt02r-stock-restore.bin`: stock RT02R restore image.
- `rt02r-recovery.bin`: RT02R recovery image for rings that still connect over
  BLE.

## RT02R Low-Latency Firmware

This is the main RT02R motion-control firmware.

Changes from stock:

- Refreshes the nested Realtek payload metadata so the ring accepts the image
  as ready to boot.
- Uses the app-level OTA init mode that skips the vendor hardware-string gate.
- Speeds up the raw accelerometer producer used by the `A10404` raw-on command.
- Suppresses extra non-motion A1 notifications so the ring does not waste BLE
  airtime while raw motion is active.
- Keeps the raw `a1 03` packets intact, so the website can decode the same
  X/Y/Z packet shape across catalogue firmware.
- Suppresses one connection-parameter update path that otherwise made desktop
  browser streaming less stable.

Byte-level summary relative to `rt02r-stock-restore.bin`:

- `0x00000c`: `a8 79 c1 00` -> `3b 72 c1 00`. Recomputed outer body byte-sum.
- `0x000052`: `81` -> `01`. Changes the nested Realtek control flags from
  `0x0981` to `0x0901`, clearing the `not_ready` bit.
- `0x0001c4..0x0001e3`: Realtek payload SHA-256 field replaced with
  `4eedb85f77d7cabe14cc522e30e89f68bd181cbab7fdaf94a7efcddb9664961c`.
- `0x001e58`: `05 f0 d8 fe` -> `00 bf 00 bf`. NOPs the A101 notification send.
- `0x001eb2`: `05 f0 ab fe` -> `00 bf 00 bf`. NOPs the A102 notification send.
- `0x001f74`: `05 f0 4a fe` -> `00 bf 00 bf`. NOPs the A105 notification send.
- `0x002248`: `7d 22` -> `02 22`. Changes the A10404 raw producer immediate
  from `125 * 8` to `2 * 8`.
- `0x007c60`: `14 28` -> `02 28`. Lowers a notify queue retry/drop threshold
  from `20` to `2`.
- `0x007c68`: `14 20` -> `02 20`. Lowers a notify queue retry delay from `20`
  to `2`.
- `0x007cb6`: `14 28` -> `02 28`. Lowers the second queue retry/drop threshold
  from `20` to `2`.
- `0x007cba`: `14 20` -> `02 20`. Lowers the second queue retry delay from
  `20` to `2`.
- `0x009480`: `0c f0 d0 fb` -> `00 bf 00 bf`. NOPs the only observed call to
  the Realtek connection-parameter update API.
- `0x0126d0`: `60 ea 00 00` -> `c0 27 09 00`. Changes a maintenance timer
  literal from `60000` ms to `600000` ms.
- Body version strings at `0x001f04`, `0x007744`, and `0x009140` are updated so
  Device Information can distinguish this image after flashing.

Important offsets for researchers:

- Nested Realtek header starts at file offset `0x50`.
- Nested payload starts at file offset `0x450`.
- The raw producer timing work is around file offset `0x002248`.
- The connection-parameter update callsite patched for browser stability is at
  file offset `0x009480`.

## RT02CR Low-Latency Firmware

This is the RT02CR version of the low-latency firmware.

Changes from stock:

- Uses the same low-latency raw motion behaviour as the RT02R build.
- Keeps RT02CR runtime identity strings, so Device Information reports the ring
  as RT02CR after flashing.
- Keeps the same `A10404` raw-on command and strict `a1 03` motion packet
  format used by the MIDI page.

This image is for RT02CR rings. Do not use it as a general RT02R upgrade.

Byte-level summary:

- Carries the same low-latency code edits as `rt02r-low-latency.bin` at
  `0x001e58`, `0x001eb2`, `0x001f74`, `0x002248`, `0x007c60`, `0x007c68`,
  `0x007cb6`, `0x007cba`, `0x009480`, and `0x0126d0`.
- `0x000010`: outer firmware string set to `RT02CR_3.12.00_251205`.
- `0x000030`: outer hardware string set to `RT02CR_V3.1`.
- `0x000052`: nested Realtek control flags remain `0x0901`, so the image is
  marked ready.
- `0x0001c4..0x0001e3`: Realtek payload SHA-256 field replaced with
  `12a469787a54f970345720a4298a1c6443b11a8fafcc53e36952257e808d53a2`.
- `0x001f1c`, `0x00772c`, `0x0084d4`, and `0x008d38`: runtime hardware strings
  rewritten from `RT02R12_V3.1` to `RT02CR_V3.1`.
- `0x00773c` and `0x009138`: runtime firmware prefixes rewritten from
  `RT02R12_` to `RT02CR_`.
- Runtime firmware marker copies are set to `RT02CR_3.12.07_260514`.
- `0x00000c`: outer body byte-sum recomputed to `34 6d c1 00`.

## RT02R Stock Restore

This is an unmodified vendor RT02R firmware image included for restore and
comparison.

Behaviour:

- Keeps normal stock ring behaviour.
- Does not include the low-latency raw motion changes.
- Raw motion remains much slower than the low-latency firmware.

Reference bytes retained from stock:

- `0x000052`: `81 09`, nested Realtek control flags `0x0981`.
- `0x001e58`: `05 f0 d8 fe`, A101 send still active.
- `0x001eb2`: `05 f0 ab fe`, A102 send still active.
- `0x001f74`: `05 f0 4a fe`, A105 send still active.
- `0x002248`: `7d 22`, A10404 raw producer immediate remains `125`.
- `0x009480`: `0c f0 d0 fb`, connection-parameter update call still active.
- `0x0126d0`: `60 ea 00 00`, maintenance timer remains `60000` ms.

## RT02R Recovery Firmware

This is a known-good RT02R recovery image for rings that still connect over BLE
but need to be moved back to a stable firmware.

Behaviour:

- Uses recovery OTA init mode.
- Uses the same 240-byte BLE transfer slicing as the web flasher.
- Intended for recovery, not as the normal recommended motion-control firmware.

Byte-level summary relative to `rt02r-stock-restore.bin`:

- `0x00000c`: `a8 79 c1 00` -> `d7 74 c1 00`. Recomputed outer body byte-sum.
- `0x000030`: outer hardware string changed from `RT02R_V3.1` to
  `RT02R12_V3.1`.
- `0x000052`: `81` -> `01`. Changes nested Realtek control flags from `0x0981`
  to `0x0901`, clearing the `not_ready` bit.
- `0x0001c4..0x0001e3`: Realtek payload SHA-256 field replaced with
  `1b33b2e94a83102f0db7b5b2376a7085e3d2909b89a8899190c00ed6845a1448`.
- Body version strings at `0x001f04`, `0x007744`, and `0x009140` are updated to
  the recovery firmware marker.
- The low-latency code sites are intentionally left stock: `0x001e58`,
  `0x001eb2`, `0x001f74`, `0x002248`, `0x007c60`, `0x007c68`, `0x007cb6`,
  `0x007cba`, `0x009480`, and `0x0126d0`.

## OTA / DFU Findings

The QRing OTA service is:

- service: `de5bf728-d711-4e47-af26-65e3012a5dc7`
- notify: `de5bf729-d711-4e47-af26-65e3012a5dc7`
- write: `de5bf72a-d711-4e47-af26-65e3012a5dc7`

DFU frames start with `0xbc`, then command, payload length, CRC16/MODBUS over
the payload, and payload bytes.

Commands used by the flasher:

- Start
- Init
- Data
- Check
- End

Each Data payload carries a 1-based chunk index followed by up to 1024 firmware
bytes. The web flasher sends the resulting DFU frame over BLE in 240-byte
segments because that size has been reliable for both normal flashing and
recovery cases.

The flasher stops on size/hash mismatch, CRC/checksum mismatch, malformed DFU
response, nonzero DFU status, timeout, or disconnect.

One firmware area worth avoiding is file offset `0x007ed4`. Testing showed it
affects incoming OTA frame reassembly timing rather than raw motion cadence.
Changing it can make later OTA recovery harder, so the public firmware catalogue
does not include builds that patch it.

## BLE Commands Used by the Site

- `A10404`: raw motion on
- `A102`: raw motion off
- `03`: battery check. Responses use `03`, battery percentage, charging flag.
- `69`: realtime sensor data request and response. Requests use sensor kind and
  action (`1` start, `4` stop). Responses use byte 1 as sensor kind, byte 2 as
  error code, and byte 3 as the current value.
- `6a`: stop active realtime sensor streams.

Raw motion packets begin with `a1 03` and contain X, Y, and Z accelerometer
values. The diagnostics panel displays the decoded acceleration in g, the raw
12-bit axis values, and the vector magnitude.

The realtime sensor kinds used by the diagnostics panel follow the QRing data
request shape:

- `1`: heart rate, displayed as bpm.
- `3`: blood oxygen, displayed as SpO2 percentage.
- `2`, `4`, `5`, `6`, `7`, `8`, `9`, `10`: shown as extra sensor values if the
  ring sends them.
