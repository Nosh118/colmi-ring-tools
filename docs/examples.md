# Packet Examples

These examples are short, sanitised snippets. They are meant to show packet
shape, not to provide complete captures.

## Battery

Transmit:

```text
03000000000000000000000000000003
```

Example response:

```text
03 64 00
```

Meaning:

- command `0x03`
- battery `100%`
- charging flag `0`

## Raw Motion

Transmit raw on:

```text
a10404000000000000000000000000a9
```

Example response packet:

```text
a1 03 00 08 ff 0d 00 02
```

Decoded by the site:

| Field | Value |
| --- | --- |
| Packet family | `a1 03` raw accelerometer |
| Raw Y | `8` |
| Raw Z | `-3` |
| Raw X | `2` |

Transmit raw off:

```text
a10200000000000000000000000000a3
```

The site sends raw off twice with a short delay because some sessions keep the
stream alive after a single stop command.

## Realtime Sensors

Transmit start heart rate:

```text
6901010000000000000000000000006b
```

Example successful response:

```text
69 01 00 4b
```

Meaning:

- command `0x69`
- sensor kind `1`
- error code `0`
- value `75 bpm`

Transmit start blood oxygen:

```text
6903010000000000000000000000006d
```

Example successful response:

```text
69 03 00 62
```

Meaning:

- command `0x69`
- sensor kind `3`
- error code `0`
- value `98%`

Health values are ring estimates and are not medical measurements.

## Quiet Sensors

For each realtime sensor kind, Quiet Sensors sends both command families:

```text
69 <kind> 04 ...
6a <kind> 00 00 ...
```

For heart rate, those full packets are:

```text
6901040000000000000000000000006e
6a01000000000000000000000000006b
```

The button does not change firmware state permanently. It asks the currently
connected ring to stop active realtime streams so raw motion and MIDI have less
notification noise.

## DFU Start

Transmit:

```text
bc010000ffff
```

Example successful response:

```text
bc010100bf4000
```

Meaning:

- magic `0xbc`
- command `0x01`
- payload length `1`
- payload CRC `0x40bf`
- status payload `00`, meaning success

## Stock OTA Metadata

The stock RT02R restore image in this repository has:

| Field | Value |
| --- | --- |
| File | `rt02r-stock-restore.bin` |
| Size | `137540` bytes |
| SHA-256 | `06a942ee1e63552b050e0c9dfc175eb0d6c60b096d1fd573f2f025cb53965cff` |
| CRC16/MODBUS | `0x42c2` |
| Byte sum16 | `0x882a` |

For catalogue firmware, the site verifies size, SHA-256, CRC16, and byte sum
against the manifest before flashing.
