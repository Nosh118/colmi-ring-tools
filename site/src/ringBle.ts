import { bytesToHex, type DfuFrame, segmentFrame } from "./dfu";

export const UART_SERVICE_UUID = "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e";
export const UART_RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
export const UART_TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
export const DFU_SERVICE_UUID = "de5bf728-d711-4e47-af26-65e3012a5dc7";
export const DFU_NOTIFY_CHAR_UUID = "de5bf729-d711-4e47-af26-65e3012a5dc7";
export const DFU_WRITE_CHAR_UUID = "de5bf72a-d711-4e47-af26-65e3012a5dc7";
export const DEVICE_INFO_SERVICE_UUID = "0000180a-0000-1000-8000-00805f9b34fb";
export const DEVICE_MODEL_CHAR_UUID = "00002a24-0000-1000-8000-00805f9b34fb";
export const DEVICE_SERIAL_CHAR_UUID = "00002a25-0000-1000-8000-00805f9b34fb";
export const DEVICE_HW_CHAR_UUID = "00002a27-0000-1000-8000-00805f9b34fb";
export const DEVICE_FW_CHAR_UUID = "00002a26-0000-1000-8000-00805f9b34fb";
export const DEVICE_SW_CHAR_UUID = "00002a28-0000-1000-8000-00805f9b34fb";
export const DEVICE_MANUFACTURER_CHAR_UUID = "00002a29-0000-1000-8000-00805f9b34fb";

export const RAW_ON_HEX = "A10404";
export const RAW_OFF_HEX = "A102";
const CMD_DATA_REQUEST = 0x69;
const CMD_STOP_REAL_TIME = 0x6a;
const CMD_HEART_RATE_LOG_SETTINGS = 0x16;
const CMD_BLOOD_OXYGEN_SETTINGS = 0x2c;
const DATA_ACTION_START = 0x01;
const DATA_ACTION_STOP = 0x04;
const SUPPORTED_RING_NAME_PREFIXES = ["R02", "COLMI R02", "Colmi R02", "TR-R02"];

export interface RingPacket {
  bytes: Uint8Array;
  timestamp: number;
  sourceService: string;
  sourceCharacteristic: string;
}

export interface DeviceInfo {
  manufacturer?: string;
  model?: string;
  serial?: string;
  hardware?: string;
  firmware?: string;
  software?: string;
}

export interface BatteryInfo {
  level: number;
  charging: boolean;
}

export interface CharacteristicSummary {
  id: string;
  serviceUuid: string;
  characteristicUuid: string;
  properties: string[];
  roles: string[];
}

export interface ConnectionInfo {
  deviceId: string;
  deviceName: string;
  characteristics: CharacteristicSummary[];
  writableTargets: CharacteristicSummary[];
  notifyTargets: CharacteristicSummary[];
  dfuReady: boolean;
}

export interface WriteLog {
  timestamp: number;
  label: string;
  targetId: string;
  packetHex: string;
  byteLength: number;
  status: "ok" | "error";
  message: string;
}

type PacketListener = (packet: RingPacket) => void;
type WriteListener = (event: WriteLog) => void;
type DisconnectListener = () => void;

export function checksum(packet: Uint8Array): number {
  let sum = 0;
  for (let index = 0; index < 15; index += 1) sum = (sum + packet[index]) & 0xff;
  return sum;
}

export function packetFromBytes(bytes: Iterable<number>): Uint8Array {
  const packet = new Uint8Array(16);
  let index = 0;
  for (const byte of bytes) {
    if (index >= 15) throw new Error("Ring command can include at most 15 bytes before checksum.");
    packet[index] = byte & 0xff;
    index += 1;
  }
  packet[15] = checksum(packet);
  return packet;
}

export function packetFromHex(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, "");
  if (clean.length % 2 !== 0) throw new Error(`Invalid hex command: ${hex}`);
  const bytes: number[] = [];
  for (let index = 0; index < clean.length; index += 2) {
    bytes.push(Number.parseInt(clean.slice(index, index + 2), 16));
  }
  return packetFromBytes(bytes);
}

export class RingBleClient {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private writeCharacteristics: BluetoothRemoteGATTCharacteristic[] = [];
  private notifyCharacteristics: BluetoothRemoteGATTCharacteristic[] = [];
  private readonly packetListeners = new Set<PacketListener>();
  private readonly writeListeners = new Set<WriteListener>();
  private readonly disconnectListeners = new Set<DisconnectListener>();

  private readonly handlePacket = (event: Event) => {
    const characteristic = event.currentTarget as BluetoothRemoteGATTCharacteristic;
    if (!characteristic.value) return;
    const packet: RingPacket = {
      bytes: viewBytes(characteristic.value),
      timestamp: performance.now(),
      sourceService: characteristic.service.uuid,
      sourceCharacteristic: characteristic.uuid,
    };
    this.packetListeners.forEach((listener) => listener(packet));
  };

  private readonly handleDisconnect = () => {
    this.server = null;
    this.writeCharacteristics = [];
    this.notifyCharacteristics = [];
    this.disconnectListeners.forEach((listener) => listener());
  };

  get connected(): boolean {
    return this.server?.connected ?? false;
  }

  onPacket(listener: PacketListener): () => void {
    this.packetListeners.add(listener);
    return () => this.packetListeners.delete(listener);
  }

  onWrite(listener: WriteListener): () => void {
    this.writeListeners.add(listener);
    return () => this.writeListeners.delete(listener);
  }

  onDisconnect(listener: DisconnectListener): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  async connect(): Promise<ConnectionInfo> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth is not available in this browser.");
    }
    const device = await navigator.bluetooth.requestDevice({
      filters: SUPPORTED_RING_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
      optionalServices: [UART_SERVICE_UUID, DFU_SERVICE_UUID, DEVICE_INFO_SERVICE_UUID, "device_information"],
    });
    if (!isSupportedRingName(device.name)) {
      throw new Error(`Selected device is not an R02 ring: ${device.name ?? "unnamed device"}`);
    }
    this.device = device;
    this.device.addEventListener("gattserverdisconnected", this.handleDisconnect);
    return this.connectSelectedDevice();
  }

  async disconnect(): Promise<void> {
    await Promise.all(
      this.notifyCharacteristics.map(async (characteristic) => {
        characteristic.removeEventListener("characteristicvaluechanged", this.handlePacket);
        try {
          await characteristic.stopNotifications();
        } catch {
          // Already disconnected.
        }
      }),
    );
    this.server?.disconnect();
    this.handleDisconnect();
  }

  async probeDeviceInfo(): Promise<DeviceInfo> {
    if (!this.server?.connected) return {};
    try {
      const service = await this.server.getPrimaryService(DEVICE_INFO_SERVICE_UUID);
      const [manufacturer, model, serial, hardware, firmware, software] = await Promise.all([
        tryReadUtf8(service, DEVICE_MANUFACTURER_CHAR_UUID),
        tryReadUtf8(service, DEVICE_MODEL_CHAR_UUID),
        tryReadUtf8(service, DEVICE_SERIAL_CHAR_UUID),
        tryReadUtf8(service, DEVICE_HW_CHAR_UUID),
        tryReadUtf8(service, DEVICE_FW_CHAR_UUID),
        tryReadUtf8(service, DEVICE_SW_CHAR_UUID),
      ]);
      return { manufacturer, model, serial, hardware, firmware, software };
    } catch {
      return {};
    }
  }

  async probeBattery(timeoutMs = 1400): Promise<BatteryInfo | null> {
    if (this.notifyCharacteristics.length === 0 || this.writeCharacteristics.length === 0) return null;
    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, timeoutMs);
      const unsubscribe = this.onPacket((packet) => {
        if (packet.bytes[0] !== 0x03 || packet.bytes.byteLength < 3) return;
        window.clearTimeout(timeout);
        unsubscribe();
        resolve({ level: packet.bytes[1], charging: packet.bytes[2] !== 0 });
      });
      void this.writePacketToAll(packetFromBytes([0x03]), "Battery probe").catch(() => {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(null);
      });
    });
  }

  async enableRaw(): Promise<number> {
    return this.writePacketToAll(packetFromHex(RAW_ON_HEX), "Raw on A10404");
  }

  async disableRaw(): Promise<number> {
    const packet = packetFromHex(RAW_OFF_HEX);
    const first = await this.writePacketToAll(packet, "Raw off pass 1");
    await delay(120);
    const second = await this.writePacketToAll(packet, "Raw off pass 2");
    return Math.max(first, second);
  }

  async startRealtimeSensor(kind: number, label: string): Promise<number> {
    return this.writePacketToAll(packetFromBytes([CMD_DATA_REQUEST, kind, DATA_ACTION_START]), `Start ${label}`);
  }

  async stopRealtimeSensor(kind: number, label: string): Promise<number> {
    const dataStop = await this.writePacketToAll(
      packetFromBytes([CMD_DATA_REQUEST, kind, DATA_ACTION_STOP]),
      `Stop data ${label}`,
    );
    await delay(25);
    const realtimeStop = await this.writePacketToAll(
      packetFromBytes([CMD_STOP_REAL_TIME, kind, 0, 0]),
      `Stop realtime ${label}`,
    );
    return dataStop + realtimeStop;
  }

  async quietOpticalSensors(): Promise<number> {
    const realtimeKinds = [1, 2, 3, 4, 5, 7, 8, 9, 10];
    let writes = 0;
    for (const kind of realtimeKinds) {
      writes += await this.writePacketToAll(packetFromBytes([CMD_DATA_REQUEST, kind, DATA_ACTION_STOP]), `Quiet data ${kind}`);
      await delay(25);
      writes += await this.writePacketToAll(packetFromBytes([CMD_STOP_REAL_TIME, kind, 0, 0]), `Quiet realtime ${kind}`);
      await delay(25);
    }
    return writes;
  }

  async disableHealthLogging(intervalMinutes = 60): Promise<number> {
    const heart = await this.writePacketToAll(
      packetFromBytes([CMD_HEART_RATE_LOG_SETTINGS, 2, 2, intervalMinutes]),
      "Heart-rate log off",
    );
    const oxygen = await this.writePacketToAll(packetFromBytes([CMD_BLOOD_OXYGEN_SETTINGS, 2, 2]), "SpO2 log off");
    return heart + oxygen;
  }

  async writePacketToAll(packet: Uint8Array, label: string): Promise<number> {
    if (this.writeCharacteristics.length === 0) throw new Error("No writable ring characteristics are ready.");
    let ok = 0;
    for (const characteristic of this.writeCharacteristics) {
      try {
        await this.writeToCharacteristic(characteristic, packet, label);
        ok += 1;
        await delay(18);
      } catch {
        // Some firmware exposes write-capable characteristics that reject normal packets.
      }
    }
    if (ok === 0) throw new Error("No writable characteristic accepted the command.");
    return ok;
  }

  async writeDfuFrame(
    frame: DfuFrame,
    segmentBytes: number,
    label: string,
    onSegment?: (sent: number, total: number) => void,
  ): Promise<number> {
    const target = this.writeCharacteristics.find(isDfuWriteCharacteristic);
    if (!target) throw new Error("DFU write characteristic is not available.");
    const segments = segmentFrame(frame, segmentBytes);
    let writes = 0;
    for (const segment of segments) {
      await this.writeToCharacteristic(target, segment, `${label} ${writes + 1}/${segments.length}`);
      writes += 1;
      onSegment?.(writes, segments.length);
      if (writes < segments.length) await delay(12);
    }
    return writes;
  }

  private async connectSelectedDevice(): Promise<ConnectionInfo> {
    if (!this.device?.gatt) throw new Error("Selected device does not expose GATT.");
    this.server = await this.device.gatt.connect();
    const discovered = await this.discoverCharacteristics();
    const uart = await this.tryResolveUartCharacteristics();

    const allCharacteristics = discovered.map((item) => item.characteristic);
    this.writeCharacteristics = uniqueCharacteristics(
      uart ? [uart.write, ...allCharacteristics] : allCharacteristics,
      canWrite,
    );
    this.notifyCharacteristics = uniqueCharacteristics(
      uart ? [...allCharacteristics, uart.notify] : allCharacteristics,
      canNotify,
    );

    if (this.writeCharacteristics.length === 0 || this.notifyCharacteristics.length === 0) {
      throw new Error("No writable/notifiable characteristics were found.");
    }

    await Promise.all(
      this.notifyCharacteristics.map(async (characteristic) => {
        characteristic.addEventListener("characteristicvaluechanged", this.handlePacket);
        await characteristic.startNotifications();
      }),
    );

    const writable = new Set(this.writeCharacteristics.map(characteristicKey));
    const notifiable = new Set(this.notifyCharacteristics.map(characteristicKey));
    const summaries = discovered.map((item) => {
      const key = characteristicKey(item.characteristic);
      const roles: string[] = [];
      if (writable.has(key)) roles.push("write");
      if (notifiable.has(key)) roles.push("notify");
      if (item.characteristic.service.uuid === DFU_SERVICE_UUID) roles.push("dfu");
      return summaryFor(item.characteristic, roles);
    });

    return {
      deviceId: this.device.id,
      deviceName: this.device.name ?? "Unknown ring",
      characteristics: summaries,
      writableTargets: this.writeCharacteristics.map((item) => summaryFor(item, ["write"])),
      notifyTargets: this.notifyCharacteristics.map((item) => summaryFor(item, ["notify"])),
      dfuReady: this.writeCharacteristics.some(isDfuWriteCharacteristic) && this.notifyCharacteristics.some(isDfuNotifyCharacteristic),
    };
  }

  private async tryResolveUartCharacteristics(): Promise<
    { write: BluetoothRemoteGATTCharacteristic; notify: BluetoothRemoteGATTCharacteristic } | null
  > {
    if (!this.server?.connected) return null;
    try {
      const service = await this.server.getPrimaryService(UART_SERVICE_UUID);
      const write = await service.getCharacteristic(UART_RX_CHAR_UUID);
      const notify = await service.getCharacteristic(UART_TX_CHAR_UUID);
      return { write, notify };
    } catch {
      return null;
    }
  }

  private async discoverCharacteristics(): Promise<
    { serviceUuid: string; characteristic: BluetoothRemoteGATTCharacteristic }[]
  > {
    if (!this.server?.connected) return [];
    const services: BluetoothRemoteGATTService[] = [];
    try {
      services.push(...(await this.server.getPrimaryServices()));
    } catch {
      // Browser/device may not allow broad discovery.
    }
    const existing = new Set(services.map((service) => service.uuid));
    for (const serviceId of [UART_SERVICE_UUID, DFU_SERVICE_UUID, DEVICE_INFO_SERVICE_UUID]) {
      if (existing.has(serviceId)) continue;
      try {
        services.push(await this.server.getPrimaryService(serviceId));
      } catch {
        // Optional service not granted/present.
      }
    }
    const results: { serviceUuid: string; characteristic: BluetoothRemoteGATTCharacteristic }[] = [];
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        results.push(...characteristics.map((characteristic) => ({ serviceUuid: service.uuid, characteristic })));
      } catch {
        // Ignore inaccessible optional service.
      }
    }
    return results;
  }

  private async writeToCharacteristic(
    characteristic: BluetoothRemoteGATTCharacteristic,
    packet: Uint8Array,
    label: string,
  ): Promise<void> {
    const value = new ArrayBuffer(packet.byteLength);
    new Uint8Array(value).set(packet);
    try {
      if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
        await characteristic.writeValueWithoutResponse(value);
        this.emitWrite(characteristic, packet, label, "ok", "writeWithoutResponse");
        return;
      }
      if (characteristic.writeValueWithResponse) {
        await characteristic.writeValueWithResponse(value);
        this.emitWrite(characteristic, packet, label, "ok", "writeWithResponse");
        return;
      }
      if (characteristic.writeValue) {
        await characteristic.writeValue(value);
        this.emitWrite(characteristic, packet, label, "ok", "writeValue");
        return;
      }
      throw new Error("Characteristic does not support writes.");
    } catch (error) {
      this.emitWrite(characteristic, packet, label, "error", errorMessage(error));
      throw error;
    }
  }

  private emitWrite(
    characteristic: BluetoothRemoteGATTCharacteristic,
    packet: Uint8Array,
    label: string,
    status: "ok" | "error",
    message: string,
  ): void {
    this.writeListeners.forEach((listener) =>
      listener({
        timestamp: performance.now(),
        label,
        targetId: characteristicKey(characteristic),
        packetHex: bytesToHex(packet),
        byteLength: packet.byteLength,
        status,
        message,
      }),
    );
  }
}

function summaryFor(characteristic: BluetoothRemoteGATTCharacteristic, roles: string[]): CharacteristicSummary {
  return {
    id: characteristicKey(characteristic),
    serviceUuid: characteristic.service.uuid,
    characteristicUuid: characteristic.uuid,
    properties: propertiesFor(characteristic),
    roles,
  };
}

function propertiesFor(characteristic: BluetoothRemoteGATTCharacteristic): string[] {
  const names: string[] = [];
  if (characteristic.properties.read) names.push("read");
  if (characteristic.properties.write) names.push("write");
  if (characteristic.properties.writeWithoutResponse) names.push("writeWithoutResponse");
  if (characteristic.properties.notify) names.push("notify");
  if (characteristic.properties.indicate) names.push("indicate");
  return names;
}

function canWrite(characteristic: BluetoothRemoteGATTCharacteristic): boolean {
  return characteristic.properties.write || characteristic.properties.writeWithoutResponse;
}

function canNotify(characteristic: BluetoothRemoteGATTCharacteristic): boolean {
  return characteristic.properties.notify || characteristic.properties.indicate;
}

function isDfuWriteCharacteristic(characteristic: BluetoothRemoteGATTCharacteristic): boolean {
  return characteristic.service.uuid === DFU_SERVICE_UUID && characteristic.uuid === DFU_WRITE_CHAR_UUID;
}

function isDfuNotifyCharacteristic(characteristic: BluetoothRemoteGATTCharacteristic): boolean {
  return characteristic.service.uuid === DFU_SERVICE_UUID && characteristic.uuid === DFU_NOTIFY_CHAR_UUID;
}

function uniqueCharacteristics(
  characteristics: BluetoothRemoteGATTCharacteristic[],
  predicate: (characteristic: BluetoothRemoteGATTCharacteristic) => boolean,
): BluetoothRemoteGATTCharacteristic[] {
  const seen = new Set<string>();
  return characteristics.filter((characteristic) => {
    if (!predicate(characteristic)) return false;
    const key = characteristicKey(characteristic);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function characteristicKey(characteristic: BluetoothRemoteGATTCharacteristic): string {
  return `${characteristic.service.uuid}:${characteristic.uuid}`;
}

function viewBytes(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
}

async function tryReadUtf8(service: BluetoothRemoteGATTService, characteristicUuid: string): Promise<string | undefined> {
  try {
    const characteristic = await service.getCharacteristic(characteristicUuid);
    const value = await characteristic.readValue();
    return new TextDecoder().decode(viewBytes(value)).replace(/\0/g, "").trim();
  } catch {
    return undefined;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isSupportedRingName(name: string | undefined): boolean {
  return (name ?? "").toUpperCase().includes("R02");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
