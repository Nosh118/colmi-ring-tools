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

The public catalogue contains four files:

- `rt02r-low-latency.bin`: recommended firmware for RT02R rings
- `rt02cr-low-latency.bin`: recommended firmware for RT02CR rings
- `rt02r-stock-restore.bin`: stock restore image for RT02R rings
- `rt02r-recovery.bin`: recovery image for RT02R rings that still connect over BLE

You can also upload your own `.bin` file in the flasher. Uploaded files are not
checked against the public catalogue, so only flash files you trust and understand.

## Documentation

The `docs/` folder and the hosted Docs tab include:

- flashing and MIDI setup guides
- byte-level firmware patch notes
- BLE command and DFU protocol notes
- OTA firmware discovery notes
- small sanitised packet examples
- release and contribution notes for maintainers

## Safety

Firmware flashing can brick a ring. Charge the ring first, keep it close to the
computer, close other apps connected to it, and do not refresh the page during a
flash.

The catalogue firmware uses a 20% battery minimum. A transfer is usually short,
but do not flash a ring that is nearly empty.

## Acknowledgements

This project builds on public Colmi/RF03 research, BLE notes, and MIDI examples
from:

- Aaron Christophel / atc1441 for [ATC_RF03_Ring](https://github.com/atc1441/ATC_RF03_Ring), including RF03/BlueX hardware notes, OTA firmware context, and prior work on faster raw motion data.
- Floyd Steinberg / mrfloydst for [smartringmidi](https://github.com/mrfloydst/smartringmidi), which provided a clear browser-based MIDI controller example for the R02.
- Puxtril for [colmi-docs](https://github.com/Puxtril/colmi-docs), documenting Colmi BLE commands and response shapes.
- Wesley Ellis / tahnok for [colmi_r02_client](https://github.com/tahnok/colmi_r02_client), including practical BLE client code and packet-level documentation for R02-family rings.

Those projects remain under their own licences and terms. This repository does
not vendor their code or assets; they are credited here as references that
helped make this tool possible.

## Local Development

```sh
cd site
npm install
npm test
npm run validate:release
npm run build
```

The site is static and deploys through the included GitHub Pages workflow.
