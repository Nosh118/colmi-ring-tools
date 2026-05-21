import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "public/firmware/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const ids = new Set();
let publicDefaults = 0;

for (const entry of manifest.firmware) {
  assert(!ids.has(entry.id), `duplicate firmware id ${entry.id}`);
  ids.add(entry.id);
  assert(/^[a-z0-9-]+\.bin$/.test(entry.fileName), `${entry.id} must use a user-facing firmware filename`);
  assert(entry.path.startsWith("./firmware/"), `${entry.id} must stay under ./firmware/`);
  assert(entry.path === `./firmware/${entry.fileName}`, `${entry.id} path and fileName mismatch`);
  assert(/^[a-f0-9]{64}$/.test(entry.sha256), `${entry.id} invalid sha256`);
  assert(entry.initType === 1 || entry.initType === 4, `${entry.id} invalid initType`);
  assert(entry.minBatteryPercent >= 20, `${entry.id} battery gate too low`);
  if (entry.publicDefault) publicDefaults += 1;

  const filePath = resolve(root, "public", entry.path.replace(/^\.\//, ""));
  const bytes = await readFile(filePath);
  assert(bytes.byteLength === entry.size, `${entry.id} size mismatch`);
  assert(createHash("sha256").update(bytes).digest("hex") === entry.sha256, `${entry.id} sha256 mismatch`);
  assert(hex(crc16Modbus(bytes)) === entry.crc16.toLowerCase(), `${entry.id} crc16 mismatch`);
  assert(hex(checksum16(bytes)) === entry.checksum16.toLowerCase(), `${entry.id} checksum16 mismatch`);
}

assert(publicDefaults === 2, `expected exactly two public defaults, got ${publicDefaults}`);
console.log(`Validated ${manifest.firmware.length} firmware entries.`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hex(value) {
  return `0x${value.toString(16).padStart(4, "0")}`;
}

function checksum16(bytes) {
  let sum = 0;
  for (const byte of bytes) sum = (sum + byte) & 0xffff;
  return sum;
}

function crc16Modbus(bytes) {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc & 0xffff;
}
