interface Navigator {
  bluetooth?: Bluetooth;
  requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MIDIAccess>;
}

interface Bluetooth extends EventTarget {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
}

interface RequestDeviceOptions {
  filters?: BluetoothLEScanFilter[];
  optionalServices?: BluetoothServiceUUID[];
}

interface BluetoothLEScanFilter {
  name?: string;
  namePrefix?: string;
  services?: BluetoothServiceUUID[];
}

type BluetoothServiceUUID = number | string;
type BluetoothCharacteristicUUID = number | string;

interface BluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
}

interface BluetoothRemoteGATTServer {
  readonly connected: boolean;
  readonly device: BluetoothDevice;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService {
  readonly uuid: string;
  readonly device: BluetoothDevice;
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly uuid: string;
  readonly service: BluetoothRemoteGATTService;
  readonly properties: BluetoothCharacteristicProperties;
  readonly value?: DataView;
  readValue(): Promise<DataView>;
  writeValue?(value: BufferSource): Promise<void>;
  writeValueWithResponse?(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothCharacteristicProperties {
  readonly read: boolean;
  readonly write: boolean;
  readonly writeWithoutResponse: boolean;
  readonly notify: boolean;
  readonly indicate: boolean;
}

interface MIDIConnectionEvent extends Event {
  readonly port: MIDIPort;
}

interface MIDIAccess extends EventTarget {
  readonly inputs: Map<string, MIDIInput>;
  readonly outputs: Map<string, MIDIOutput>;
  readonly sysexEnabled: boolean;
  onstatechange: ((this: MIDIAccess, ev: MIDIConnectionEvent) => unknown) | null;
}

interface MIDIPort extends EventTarget {
  readonly id: string;
  readonly manufacturer?: string;
  readonly name?: string;
  readonly state: "connected" | "disconnected";
  readonly type: "input" | "output";
}

interface MIDIInput extends MIDIPort {}

interface MIDIOutput extends MIDIPort {
  send(data: number[], timestamp?: number): void;
}
