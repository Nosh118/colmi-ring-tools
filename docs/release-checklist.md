# Release Checklist

Use this before publishing a new site or firmware catalogue update.

## Firmware

- Keep only end-user firmware in `site/public/firmware/`.
- Give every binary a plain filename that describes the device and purpose.
- Update `site/public/firmware/manifest.json` with size, SHA-256, CRC16,
  checksum16, init type, compatibility strings, confirmation text, and notes.
- Keep experimental canaries, packet-discovery builds, APK output, SDK archives,
  private captures, and private paths out of the public repository.
- Update Firmware Notes with the byte-level patch table and any compatibility
  caveats.

## Site

- Run:

```sh
cd site
npm test
npm run validate:release
npm run build
```

- Check the Docs tab on a narrow mobile viewport.
- Check that code blocks wrap inside the docs panel.
- Check that catalogue firmware cannot flash until it has been loaded,
  verified, and confirmed.
- Check that a custom upload displays size, SHA-256, CRC16, and checksum before
  flashing.

## Public Text

- Search for private project names, local paths, personal notes, raw device
  identifiers, and APK/decompiler artefacts before pushing.
- Keep Bluetooth names in examples generic. Real users may see any advertised
  name containing `R02`, including `COLMI R02`.
- Prefer British spelling in public prose.

## GitHub

- Open a pull request from a review branch.
- Let GitHub Pages build from `main` only after review.
- Confirm the live site loads the expected commit after merging.
