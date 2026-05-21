# Firmware Provenance and Redistribution Notes

The source code and documentation in this repository are licensed under the
repository licence. Firmware binaries are different.

The included `.bin` files are firmware artefacts for Colmi / QRing smart rings.
Some are vendor images, and some are patched images derived from vendor images.
They are provided for interoperability, repair, and research, with hashes and
basic provenance in the firmware manifest.

No claim is made that vendor firmware bytes are open-source. If you redistribute
this repository, preserve this file and the firmware manifest.

The public repo intentionally excludes APKs, SDK archives, decompiled app
output, private captures, generated build output, and development-only firmware.

If a rights holder asks for a firmware artefact to be removed, remove the binary
and keep a minimal hash/provenance record where legally appropriate.
