# Protocol Notes

The site talks to the ring through two BLE paths:

- the normal UART-style command service for diagnostics, sensors, and raw
  motion
- the QRing DFU service for firmware transfer

## BLE Services

| Purpose | UUID |
| --- | --- |
| Normal command service | `6e40fff0-b5a3-f393-e0a9-e50e24dcca9e` |
| Normal write characteristic | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` |
| Normal notify characteristic | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` |
| DFU service | `de5bf728-d711-4e47-af26-65e3012a5dc7` |
| DFU notify characteristic | `de5bf729-d711-4e47-af26-65e3012a5dc7` |
| DFU write characteristic | `de5bf72a-d711-4e47-af26-65e3012a5dc7` |
| Device Information service | `0000180a-0000-1000-8000-00805f9b34fb` |

The browser requests devices whose advertised name contains `R02` by using
Bluetooth name-prefix filters for common `R02` names. After selection, the app
still rejects names that do not contain `R02`.

## Normal Command Packets

Normal commands are 16 bytes. The command bytes occupy the start of the packet,
unused bytes are zero, and byte 15 is the 8-bit sum of bytes 0 through 14.

Examples:

| Purpose | Short command | Full 16-byte packet |
| --- | --- | --- |
| Battery | `03` | `03000000000000000000000000000003` |
| Raw motion on | `a1 04 04` | `a10404000000000000000000000000a9` |
| Raw motion off | `a1 02` | `a10200000000000000000000000000a3` |
| Start heart rate | `69 01 01` | `6901010000000000000000000000006b` |
| Start blood oxygen | `69 03 01` | `6903010000000000000000000000006d` |
| Stop heart rate data | `69 01 04` | `6901040000000000000000000000006e` |
| Stop heart rate realtime | `6a 01 00 00` | `6a01000000000000000000000000006b` |
| Disable heart-rate logs | `16 02 02 3c` | `1602023c000000000000000000000056` |
| Disable blood-oxygen logs | `2c 02 02` | `2c020200000000000000000000000030` |

`Quiet Sensors` sends stop commands for the realtime sensor kinds that are
known to use optical or health streams. It is useful before MIDI work because
it reduces unrelated notifications and LED/sensor activity.

## Raw Motion Notifications

Raw motion notifications begin with `a1 03`. The current firmware keeps the
same packet shape as stock firmware so host tools can use one decoder across
stock and low-latency images.

Decoded axis order:

| Axis | Bytes |
| --- | --- |
| Y | `packet[2] << 4 | packet[3] & 0x0f` |
| Z | `packet[4] << 4 | packet[5] & 0x0f` |
| X | `packet[6] << 4 | packet[7] & 0x0f` |

Each axis is a signed 12-bit value. The site converts raw values to g with
`raw / 2048 * 4`.

## Realtime Sensor Notifications

Realtime sensor requests use command `0x69`:

| Byte | Meaning |
| ---: | --- |
| `0` | `0x69` command id |
| `1` | sensor kind |
| `2` | action, usually `0x01` start or `0x04` stop |

Responses also use command `0x69`:

| Byte | Meaning |
| ---: | --- |
| `0` | `0x69` command id |
| `1` | sensor kind |
| `2` | error code, with `0` meaning success |
| `3` | current value when the error code is `0` |

Known sensor kinds:

| Kind | Display |
| ---: | --- |
| `1` | Heart rate |
| `2` | Blood pressure |
| `3` | Blood oxygen |
| `4` | Fatigue |
| `5` | Health check |
| `6` | Realtime heart rate |
| `7` | ECG |
| `8` | Pressure |
| `9` | Blood sugar |
| `10` | HRV |

The firmware patching did not intentionally NOP the `0x69` heart-rate or SpO2
send paths. Health measurements are still device estimates, not medical data.

## DFU Frames

DFU frames are written to the QRing DFU write characteristic. The ring replies
on the DFU notify characteristic.

Frame layout:

| Offset | Size | Meaning |
| --- | ---: | --- |
| `0x00` | 1 | magic `0xbc` |
| `0x01` | 1 | command |
| `0x02` | 2 | payload length, little-endian |
| `0x04` | 2 | CRC16/MODBUS over payload, little-endian |
| `0x06` | variable | payload |

CRC settings:

- initial value: `0xffff`
- reflected polynomial: `0xa001`
- empty payload CRC: `0xffff`

Commands:

| Command | Direction | Payload | Meaning |
| ---: | --- | --- | --- |
| `0x01` | app to ring | empty | Start DFU |
| `0x02` | app to ring | 9 bytes | Init transfer metadata |
| `0x03` | app to ring | chunk index plus data | Send firmware chunk |
| `0x04` | app to ring | empty | Ask the ring to check the received image |
| `0x05` | app to ring | empty | Finish/release after successful check |

The Start frame is:

```text
bc010000ffff
```

A successful Start response observed on RT02R was:

```text
bc010100bf4000
```

The response payload byte `0` is the status code:

| Code | Name |
| ---: | --- |
| `0` | `RSP_OK` |
| `1` | `RSP_DATA_SIZE` |
| `2` | `RSP_DATA_CONTENT` |
| `3` | `RSP_CMD_STATUS` |
| `4` | `RSP_CMD_FORMAT` |
| `5` | `RSP_INNER` |
| `6` | `RSP_LOW_BATTERY` |

Command `0x02` init payload:

| Offset | Size | Meaning |
| --- | ---: | --- |
| `0x00` | 1 | init type, `0x04` for the catalogue firmware |
| `0x01` | 4 | full firmware file length |
| `0x05` | 2 | CRC16/MODBUS over the whole firmware file |
| `0x07` | 2 | byte sum over the whole firmware file, modulo `0x10000` |

Command `0x03` data payload:

| Offset | Size | Meaning |
| --- | ---: | --- |
| `0x00` | 2 | chunk index, little-endian, starting at `1` |
| `0x02` | up to 1024 | firmware bytes |

The site slices wrapped DFU frames into 240-byte BLE writes. The original app
starts from 20-byte writes, but 240-byte slices have been reliable in desktop
browser testing and were important for recovering from images that shortened
the incoming DFU reassembly timer.
