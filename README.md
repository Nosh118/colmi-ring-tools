# Colmi Ring Tools

Browser tools for Colmi / QRing RT02R and RT02CR smart rings.

The site includes:

- a Web Bluetooth firmware flasher
- a motion-to-MIDI controller
- basic ring diagnostics and JSON export

Live site: https://nosh118.github.io/colmi-ring-tools/

## Supported Rings

This project is for RT02R and RT02CR rings on the newer 3.1 firmware family.
Ring Bluetooth names vary by device, so use Device Information in the site to
confirm what is connected before flashing.

Do not use these firmware files on older R02 3.0 rings.

## Firmware

The public catalog contains four files:

- `rt02r-low-latency.bin`: recommended firmware for RT02R rings
- `rt02cr-low-latency.bin`: recommended firmware for RT02CR rings
- `rt02r-stock-restore.bin`: stock restore image for RT02R rings
- `rt02r-recovery.bin`: recovery image for RT02R rings that still connect over BLE

You can also upload your own `.bin` file in the flasher. Uploaded files are not
checked against the public catalog, so only flash files you trust and understand.

## Safety

Firmware flashing can brick a ring. Charge the ring first, keep it close to the
computer, close other apps connected to it, and do not refresh the page during a
flash.

The catalog firmware uses a 20% battery minimum. A transfer is usually short,
but do not flash a ring that is nearly empty.

## Local Development

```sh
cd site
npm install
npm test
npm run validate:release
npm run build
```

The site is static and deploys through the included GitHub Pages workflow.
