# Research Notes

These notes are the public, sanitised version of the firmware and app findings
used to build the flasher and low-latency firmware. They are intended for
people who want to reproduce the work, audit the firmware changes, or build
compatible tools.

This repository publishes derived findings and stable firmware artefacts. It
does not include decompiled APK output, proprietary app assets, unpublished lab
notes, large raw captures, or device-specific identifiers.

## Device Scope

The released firmware targets newer 3.1-family RT02R and RT02CR rings. Stock
Bluetooth names are not stable; rings may advertise as `COLMI R02`, `Colmi
R02`, `R02_....`, or another name containing `R02`. Use Device Information in
the site after connecting rather than relying on the advertised name alone.

Older R02 3.0 firmware uses a different OTA format and is not compatible with
the catalogue firmware in this repository.

## OTA Firmware Discovery

QRing firmware lookup was recovered from the Android app's network behaviour.
The public flasher does not call these endpoints; the details are provided so
other researchers can understand the provenance of the stock RT02R image.

Known base URLs:

- `https://api1.qcwxkjvip.com/qcwx/`
- `https://api2.qcwxkjvip.com/qcwx/`
- `https://china.qcwxwire.com/qcwx/`

Known firmware endpoints:

- `POST app-update/last-ota`
- `POST app-update/last-ota/china`

Token endpoint observed by the app:

- `GET token/getToken?key=qcwx_android`

The firmware lookup request body has this shape:

| Field | Meaning |
| --- | --- |
| `appId` | QRing application identifier. |
| `uid` | User id value sent by the app. |
| `hardwareVersion` | Ring hardware string, for example `RT02R_V3.1`. |
| `romVersion` | Current firmware string. |
| `os` | Platform selector. |
| `mac` | Device identifier field. Public examples omit real values. |
| `country` | Country code used by the app. |
| `dev` | Device/app channel selector. |

The response includes:

| Field | Meaning |
| --- | --- |
| `downloadUrl` | Direct firmware binary URL. |
| `hardwareVersion` | Target hardware string. |
| `version` | Advertised firmware version. |
| `uploadDate` | Server-side upload timestamp. |
| `openOrNot` | App-side rollout field. |
| `os` | Platform selector returned by the API. |
| force-update fields | App update policy fields. |
| update description | Human-readable release text when present. |
| `specifyMacUpgrade` | Optional device allow-list style field. Exact observed values are omitted here. |

One successful public stock acquisition returned:

| Field | Value |
| --- | --- |
| Hardware request | `RT02R_V3.1` |
| ROM request | `RT02R_3.11.00_250611` |
| API version | `RT02R_3.12.00_251125` |
| Header firmware string | `RT02R12_3.12.00_251125` |
| Header hardware string | `RT02R_V3.1` |
| Download URL | `http://api2.qcwxkjvip.com/download/ota/RT02R_V3.1/RT02R_3.12.00_251125.bin` |
| File size | `137540` bytes |
| SHA-256 | `06a942ee1e63552b050e0c9dfc175eb0d6c60b096d1fd573f2f025cb53965cff` |

The public `rt02r-stock-restore.bin` is this stock image.

## Firmware Container

The RT02R 3.1 OTA file has two nested layers:

| Layer | File offset | Notes |
| --- | ---: | --- |
| QRing OTA wrapper | `0x0000` | 80-byte wrapper with magic `0x81BDC3E5`. |
| Wrapper body sum | `0x000c` | Little-endian byte sum over file bytes from `0x50` to EOF. |
| Outer firmware string | `0x0010` | Display/version string used by OTA metadata. |
| Outer hardware string | `0x0030` | Hardware gate string used by the app-level data handler. |
| Realtek image header | `0x0050` | Nested `T_IMG_HEADER_FORMAT`-style header. |
| Realtek application payload | `0x0450` | Application image payload. |

The app-level data handler accepts init types `0x01` and `0x04`. Init type
`0x01` performs a hardware-string compare on the first data chunk. Init type
`0x04` skips that app-level hardware compare. Skipping that compare is not
enough to activate arbitrary firmware by itself.

The activation fix for custom images is in the nested Realtek layer:

- refresh the Realtek payload SHA-256 stored in the nested header
- clear the Realtek `not_ready` bit by changing control flags from `0x0981` to
  `0x0901`
- recompute the outer QRing body sum
- transfer using init type `0x04`

Images with a refreshed SHA but `not_ready` still set transferred but did not
boot as the new firmware. Images with both the refreshed SHA and cleared
`not_ready` bit became active.

## Patch Ladder

Only stable end-user images are included in the public catalogue. The research
line that led to them is summarised here so the byte edits in Firmware Notes
have context.

| Step | Finding |
| --- | --- |
| Stock RT02R 3.12 | OTA transfer and DFU frame format were validated, but raw motion stayed near stock speed. |
| Realtek activation | Refreshed payload SHA plus cleared `not_ready` made BLE OTA custom firmware boot. |
| A1 send suppression | Full 4-byte NOPs at the A101/A102/A105 send sites removed non-motion A1 traffic while keeping A103 raw accelerometer packets. |
| A10404 producer | The raw-on path uses the `A10404` command and a producer immediate at file `0x002248`. |
| Queue tuning | Notify queue retry/drop immediates at `0x007c60`, `0x007c68`, `0x007cb6`, and `0x007cba` improved sustained delivery. |
| Connection update suppression | NOPing the observed Realtek connection-parameter update call at `0x009480` stopped desktop browser streams decaying after the initial high-rate burst. |
| RT02CR cross-port | The same low-latency body runs on RT02CR when the outer and runtime identity strings are rewritten for CR hardware. |

The public RT02R low-latency firmware is the cleaned release of the stable
RT02R line. The public RT02CR low-latency firmware is the identity-clean CR
release using the same low-latency body behaviour.

## Retired Findings

File offset `0x007ed4` is intentionally not patched. It looked like a timing
candidate because it contains a `125 << 3` timer shape, but live recovery work
proved it is part of incoming DFU frame reassembly. Lowering it can make large
DFU Data frames CRC-check before all BLE write slices arrive, which can break
future OTA recovery.

Packet-discovery builds that restored A101/A102/A105 sends are not published
as user firmware. They were useful for identifying packet families, but they
are not better end-user motion-control firmware.

No decompiled APK output is published here. The useful public result is the
protocol, endpoint, and packet behaviour documented in these notes.
