# Flashing Guide

Use Chrome or Edge on a desktop computer. Web Bluetooth requires HTTPS, which
the hosted site provides.

## Before Flashing

1. Charge the ring to at least 20%.
2. Close any other app connected to the ring.
3. Connect the ring in the site.
4. Check Device Information.
5. Choose a matching catalog firmware, or upload your own `.bin` file.
6. Load the firmware and type the confirmation text shown by the site.

## Catalog Firmware

- `rt02r-low-latency.bin`: recommended RT02R firmware for faster raw motion.
- `rt02cr-low-latency.bin`: recommended RT02CR firmware for faster raw motion.
- `rt02r-stock-restore.bin`: stock RT02R restore image.
- `rt02r-recovery.bin`: RT02R recovery image for rings that still connect.

Catalog files are checked against the manifest before flashing.

## Custom Firmware Uploads

The flasher can load a local `.bin` file from your computer. It will show the
file size, SHA-256, CRC16, and checksum before flashing.

Use Normal mode for standard firmware. Use Recovery mode only when you know the
file expects it.

Custom uploads are not checked for hardware compatibility.

## During Flashing

Keep the page open until the flash finishes. The ring may disconnect or reboot
after the final step.

If anything fails, the flasher stops instead of continuing. Export diagnostics
before reconnecting if you need to report the failure.
