import "./styles.css";
import {
  buildCheckFrame,
  buildDataFrame,
  buildEndFrame,
  buildInitFrame,
  buildStartFrame,
  chunkCount,
  bytesToHex,
  firmwareStats,
  parseDfuResponse,
  sha256Hex,
  verifyFirmwareBytes,
} from "./dfu";
import { DOC_PAGES, docHtml, type DocPage } from "./docs";
import {
  compatibilityReason,
  loadFirmwareManifest,
  profileAcceptsDevice,
  type FirmwareEntry,
  type FirmwareManifest,
} from "./firmware";
import {
  BLOOD_OXYGEN_KIND,
  HEART_RATE_KIND,
  decodeSensorPacket,
  formatSensorValue,
  type SensorReading,
} from "./health";
import { decodeMotionPacket, MotionStats, type MotionReading } from "./motion";
import { MidiController, type MidiMapping, type MidiValues } from "./midi";
import { RingBleClient, type BatteryInfo, type ConnectionInfo, type DeviceInfo, type RingPacket } from "./ringBle";

const CUSTOM_CONFIRM_TEXT = "CUSTOM FIRMWARE";
const CUSTOM_MIN_BATTERY_PERCENT = 20;

interface LoadedFirmware {
  source: "catalogue" | "custom";
  label: string;
  fileName: string;
  bytes: Uint8Array;
  initType: 1 | 4;
  minBatteryPercent: number;
  gateText: string;
  entry?: FirmwareEntry;
}

const ble = new RingBleClient();
const midi = new MidiController();
const stats = new MotionStats();

let manifest: FirmwareManifest | null = null;
let selectedFirmware: FirmwareEntry | null = null;
let loadedFirmware: LoadedFirmware | null = null;
let connectionInfo: ConnectionInfo | null = null;
let deviceInfo: DeviceInfo = {};
let batteryInfo: BatteryInfo | null = null;
let latestReading: MotionReading | null = null;
let latestMidiValues: MidiValues = { x: 64, y: 64, z: 64 };
let rawEnabled = false;
let motionReceivedAt: string | null = null;
const packetLog: Array<{ at: string; kind: string; detail: string }> = [];
const latestSensorReadings = new Map<number, SensorReading>();
const sensorReceivedAt = new Map<number, string>();
const otherPackets: Array<{ at: string; command: string; hex: string }> = [];

const ui = {
  connectButton: byId<HTMLButtonElement>("connectButton"),
  disconnectButton: byId<HTMLButtonElement>("disconnectButton"),
  themeToggle: byId<HTMLButtonElement>("themeToggle"),
  statusText: byId<HTMLElement>("statusText"),
  deviceText: byId<HTMLElement>("deviceText"),
  hardwareText: byId<HTMLElement>("hardwareText"),
  firmwareText: byId<HTMLElement>("firmwareText"),
  batteryText: byId<HTMLElement>("batteryText"),
  rateText: byId<HTMLElement>("rateText"),
  bluetoothSupportText: byId<HTMLElement>("bluetoothSupportText"),
  bluetoothSupportMeta: byId<HTMLElement>("bluetoothSupportMeta"),
  midiSupportText: byId<HTMLElement>("midiSupportText"),
  midiSupportMeta: byId<HTMLElement>("midiSupportMeta"),
  secureContextText: byId<HTMLElement>("secureContextText"),
  secureContextMeta: byId<HTMLElement>("secureContextMeta"),
  pickerFilterText: byId<HTMLElement>("pickerFilterText"),
  pickerFilterMeta: byId<HTMLElement>("pickerFilterMeta"),
  tabs: [...document.querySelectorAll<HTMLButtonElement>(".tab-button")],
  panels: [...document.querySelectorAll<HTMLElement>(".tool-panel")],
  refreshFirmwareButton: byId<HTMLButtonElement>("refreshFirmwareButton"),
  firmwareSelect: byId<HTMLSelectElement>("firmwareSelect"),
  customFirmwareInput: byId<HTMLInputElement>("customFirmwareInput"),
  customInitTypeSelect: byId<HTMLSelectElement>("customInitTypeSelect"),
  firmwareDetails: byId<HTMLElement>("firmwareDetails"),
  confirmInput: byId<HTMLInputElement>("confirmInput"),
  loadFirmwareButton: byId<HTMLButtonElement>("loadFirmwareButton"),
  flashButton: byId<HTMLButtonElement>("flashButton"),
  flashStages: byId<HTMLOListElement>("flashStages"),
  flashLog: byId<HTMLTextAreaElement>("flashLog"),
  midiRefreshButton: byId<HTMLButtonElement>("midiRefreshButton"),
  midiPanicButton: byId<HTMLButtonElement>("midiPanicButton"),
  midiOutputSelect: byId<HTMLSelectElement>("midiOutputSelect"),
  midiChannelSelect: byId<HTMLSelectElement>("midiChannelSelect"),
  xCcInput: byId<HTMLInputElement>("xCcInput"),
  yCcInput: byId<HTMLInputElement>("yCcInput"),
  zCcInput: byId<HTMLInputElement>("zCcInput"),
  xCcSendButton: byId<HTMLButtonElement>("xCcSendButton"),
  yCcSendButton: byId<HTMLButtonElement>("yCcSendButton"),
  zCcSendButton: byId<HTMLButtonElement>("zCcSendButton"),
  midiRateInput: byId<HTMLInputElement>("midiRateInput"),
  smoothingInput: byId<HTMLInputElement>("smoothingInput"),
  deadbandInput: byId<HTMLInputElement>("deadbandInput"),
  invertXInput: byId<HTMLInputElement>("invertXInput"),
  invertYInput: byId<HTMLInputElement>("invertYInput"),
  invertZInput: byId<HTMLInputElement>("invertZInput"),
  rawOnButton: byId<HTMLButtonElement>("rawOnButton"),
  rawOffButton: byId<HTMLButtonElement>("rawOffButton"),
  quietSensorsButton: byId<HTMLButtonElement>("quietSensorsButton"),
  healthOffButton: byId<HTMLButtonElement>("healthOffButton"),
  xMeter: byId<HTMLMeterElement>("xMeter"),
  yMeter: byId<HTMLMeterElement>("yMeter"),
  zMeter: byId<HTMLMeterElement>("zMeter"),
  xMidiText: byId<HTMLElement>("xMidiText"),
  yMidiText: byId<HTMLElement>("yMidiText"),
  zMidiText: byId<HTMLElement>("zMidiText"),
  compatibilityPanel: byId<HTMLElement>("compatibilityPanel"),
  heartRateButton: byId<HTMLButtonElement>("heartRateButton"),
  bloodOxygenButton: byId<HTMLButtonElement>("bloodOxygenButton"),
  stopSensorsButton: byId<HTMLButtonElement>("stopSensorsButton"),
  heartRateText: byId<HTMLElement>("heartRateText"),
  bloodOxygenText: byId<HTMLElement>("bloodOxygenText"),
  heartRateMeta: byId<HTMLElement>("heartRateMeta"),
  bloodOxygenMeta: byId<HTMLElement>("bloodOxygenMeta"),
  accelXText: byId<HTMLElement>("accelXText"),
  accelYText: byId<HTMLElement>("accelYText"),
  accelZText: byId<HTMLElement>("accelZText"),
  accelMagnitudeText: byId<HTMLElement>("accelMagnitudeText"),
  accelXMeta: byId<HTMLElement>("accelXMeta"),
  accelYMeta: byId<HTMLElement>("accelYMeta"),
  accelZMeta: byId<HTMLElement>("accelZMeta"),
  accelMagnitudeMeta: byId<HTMLElement>("accelMagnitudeMeta"),
  extraSensorList: byId<HTMLElement>("extraSensorList"),
  otherPacketList: byId<HTMLElement>("otherPacketList"),
  packetLog: byId<HTMLTextAreaElement>("packetLog"),
  copyDiagButton: byId<HTMLButtonElement>("copyDiagButton"),
  exportDiagButton: byId<HTMLButtonElement>("exportDiagButton"),
  clearDiagButton: byId<HTMLButtonElement>("clearDiagButton"),
  docTabs: byId<HTMLElement>("docTabs"),
  docContent: byId<HTMLElement>("docContent"),
};

void initialise();

async function initialise(): Promise<void> {
  wireUi();
  initTheme();
  renderCapabilities();
  renderMidiChannels();
  renderDocTabs();
  renderSensorReadings();
  renderAccelerationReading();
  renderOtherPackets();
  ble.onPacket(handlePacket);
  ble.onWrite((event) => appendPacketLog("write", `${event.label}: ${event.packetHex} (${event.status})`));
  ble.onDisconnect(() => {
    clearRingState();
    setStatus("Disconnected");
    renderConnection();
    renderFirmwareOptions();
  });
  await refreshFirmwareCatalogue();
  await refreshMidiOutputs();
  selectDoc(DOC_PAGES[0]);
  setStatus("Ready");
}

function wireUi(): void {
  ui.connectButton.addEventListener("click", () => void connectRing());
  ui.disconnectButton.addEventListener("click", () => void disconnectRing());
  ui.themeToggle.addEventListener("click", () => toggleTheme());
  ui.tabs.forEach((tab) => tab.addEventListener("click", () => selectTab(tab.dataset.tab ?? "flash")));
  ui.refreshFirmwareButton.addEventListener("click", () => void refreshFirmwareCatalogue());
  ui.firmwareSelect.addEventListener("change", () => selectFirmware(ui.firmwareSelect.value));
  ui.customFirmwareInput.addEventListener("change", () => void loadCustomFirmware());
  ui.customInitTypeSelect.addEventListener("change", () => void loadCustomFirmware());
  ui.firmwareDetails.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const docButton = target.closest<HTMLButtonElement>("[data-doc-page]");
    if (!docButton) return;
    openDocReference(docButton.dataset.docPage ?? "findings", docButton.dataset.docAnchor);
  });
  ui.loadFirmwareButton.addEventListener("click", () => void loadSelectedFirmware());
  ui.flashButton.addEventListener("click", () => void guardedFlashLoadedFirmware());
  ui.midiRefreshButton.addEventListener("click", () => void refreshMidiOutputs());
  ui.midiOutputSelect.addEventListener("change", () => midi.setOutput(ui.midiOutputSelect.value));
  ui.midiPanicButton.addEventListener("click", () => midi.allNotesOff(Number(ui.midiChannelSelect.value)));
  ui.xCcSendButton.addEventListener("click", () => sendLearnCc("X", ui.xCcInput));
  ui.yCcSendButton.addEventListener("click", () => sendLearnCc("Y", ui.yCcInput));
  ui.zCcSendButton.addEventListener("click", () => sendLearnCc("Z", ui.zCcInput));
  ui.rawOnButton.addEventListener("click", () => void rawOn());
  ui.rawOffButton.addEventListener("click", () => void rawOff());
  ui.quietSensorsButton.addEventListener("click", () => void quietSensors());
  ui.healthOffButton.addEventListener("click", () => void healthOff());
  ui.heartRateButton.addEventListener("click", () => void startSensor(HEART_RATE_KIND, "heart rate"));
  ui.bloodOxygenButton.addEventListener("click", () => void startSensor(BLOOD_OXYGEN_KIND, "blood oxygen"));
  ui.stopSensorsButton.addEventListener("click", () => void stopSensors());
  ui.copyDiagButton.addEventListener("click", () => void copyDiagnosticsSummary());
  ui.exportDiagButton.addEventListener("click", exportDiagnostics);
  ui.clearDiagButton.addEventListener("click", () => {
    packetLog.length = 0;
    latestReading = null;
    motionReceivedAt = null;
    latestSensorReadings.clear();
    sensorReceivedAt.clear();
    otherPackets.length = 0;
    renderSensorReadings();
    renderAccelerationReading();
    renderOtherPackets();
    renderPacketLog();
  });
}

async function connectRing(): Promise<void> {
  try {
    setStatus("Connecting...");
    connectionInfo = await ble.connect();
    const [info, battery] = await Promise.all([ble.probeDeviceInfo(), ble.probeBattery()]);
    deviceInfo = info;
    batteryInfo = battery;
    setStatus("Connected");
    renderConnection();
    renderFirmwareOptions();
    appendPacketLog("connect", JSON.stringify({ connectionInfo, deviceInfo, batteryInfo }));
  } catch (error) {
    setStatus(errorMessage(error));
  }
}

async function disconnectRing(): Promise<void> {
  await ble.disconnect();
  setStatus("Disconnected");
  renderConnection();
}

async function refreshFirmwareCatalogue(): Promise<void> {
  try {
    manifest = await loadFirmwareManifest();
    renderFirmwareOptions();
    appendFlashLog(`Loaded ${manifest.firmware.length} firmware options.`);
  } catch (error) {
    appendFlashLog(errorMessage(error));
  }
}

function renderFirmwareOptions(): void {
  ui.firmwareSelect.replaceChildren();
  if (!manifest) return;
  const entries = manifest.firmware;
  const compatible = manifest.firmware.filter((entry) => profileAcceptsDevice(entry, deviceInfo));
  for (const entry of entries) {
    const option = new Option(`${entry.publicDefault ? "* " : ""}${entry.label}`, entry.id);
    ui.firmwareSelect.append(option);
  }
  const preferred =
    compatible.find((entry) => entry.publicDefault) ??
    compatible[0] ??
    entries.find((entry) => entry.publicDefault) ??
    entries[0] ??
    null;
  if (preferred) {
    ui.firmwareSelect.value = preferred.id;
    selectFirmware(preferred.id);
  }
}

function selectFirmware(id: string): void {
  selectedFirmware = manifest?.firmware.find((entry) => entry.id === id) ?? null;
  loadedFirmware = null;
  ui.flashButton.disabled = true;
  if (!selectedFirmware) {
    ui.firmwareDetails.textContent = "No firmware selected.";
    return;
  }
  ui.confirmInput.placeholder = selectedFirmware.gateText;
  const compatibility = compatibilityReason(selectedFirmware, deviceInfo);
  ui.firmwareDetails.innerHTML = `
    <dl>
      <dt>Type</dt><dd>${escapeHtml(selectedFirmware.role)}</dd>
      <dt>For</dt><dd>${escapeHtml(selectedFirmware.deviceFamily)}</dd>
      <dt>File</dt><dd>${escapeHtml(selectedFirmware.fileName)}</dd>
      <dt>SHA-256</dt><dd><code>${escapeHtml(selectedFirmware.sha256)}</code></dd>
      <dt>Status</dt><dd>${escapeHtml(compatibility)}</dd>
      <dt>Battery</dt><dd>${selectedFirmware.minBatteryPercent}% minimum</dd>
      <dt>Notes</dt><dd>${escapeHtml(selectedFirmware.patchSummary)}</dd>
    </dl>
    ${renderFirmwareDocAction(selectedFirmware)}`;
}

async function loadSelectedFirmware(): Promise<void> {
  if (!selectedFirmware) return;
  try {
    setStatus("Fetching firmware...");
    const response = await fetch(selectedFirmware.path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Firmware fetch failed: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await verifyFirmwareBytes(selectedFirmware, bytes);
    loadedFirmware = {
      source: "catalogue",
      label: selectedFirmware.label,
      fileName: selectedFirmware.fileName,
      bytes,
      initType: selectedFirmware.initType,
      minBatteryPercent: selectedFirmware.minBatteryPercent,
      gateText: selectedFirmware.gateText,
      entry: selectedFirmware,
    };
    ui.flashButton.disabled = false;
    appendFlashLog(`Verified ${selectedFirmware.fileName}`);
    setStatus("Firmware verified");
  } catch (error) {
    loadedFirmware = null;
    ui.flashButton.disabled = true;
    appendFlashLog(errorMessage(error));
    setStatus("Firmware verification failed");
  }
}

async function loadCustomFirmware(): Promise<void> {
  const file = ui.customFirmwareInput.files?.[0];
  if (!file) return;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stats = firmwareStats(bytes);
    const sha256 = await sha256Hex(bytes);
    const initType = Number(ui.customInitTypeSelect.value) === 1 ? 1 : 4;
    loadedFirmware = {
      source: "custom",
      label: "Custom firmware",
      fileName: file.name,
      bytes,
      initType,
      minBatteryPercent: CUSTOM_MIN_BATTERY_PERCENT,
      gateText: CUSTOM_CONFIRM_TEXT,
    };
    ui.confirmInput.placeholder = CUSTOM_CONFIRM_TEXT;
    ui.flashButton.disabled = false;
    ui.firmwareDetails.innerHTML = `
      <dl>
        <dt>Type</dt><dd>custom</dd>
        <dt>File</dt><dd>${escapeHtml(file.name)}</dd>
        <dt>Size</dt><dd>${stats.size} bytes</dd>
        <dt>SHA-256</dt><dd><code>${sha256}</code></dd>
        <dt>CRC16</dt><dd>${stats.crc16}</dd>
        <dt>Checksum</dt><dd>${stats.checksum16}</dd>
        <dt>Mode</dt><dd>${initType === 4 ? "Normal" : "Recovery"}</dd>
        <dt>Battery</dt><dd>${CUSTOM_MIN_BATTERY_PERCENT}% minimum</dd>
      </dl>`;
    appendFlashLog(`Loaded custom firmware ${file.name}`);
    setStatus("Custom firmware ready");
  } catch (error) {
    loadedFirmware = null;
    ui.flashButton.disabled = true;
    appendFlashLog(errorMessage(error));
    setStatus("Custom firmware failed to load");
  }
}

async function guardedFlashLoadedFirmware(): Promise<void> {
  if (!loadedFirmware) return;
  if (!ble.connected) {
    setStatus("Connect the ring before flashing.");
    return;
  }
  if (loadedFirmware.entry && !profileAcceptsDevice(loadedFirmware.entry, deviceInfo)) {
    setStatus("Selected firmware is not compatible with the connected ring state.");
    return;
  }
  if (batteryInfo && batteryInfo.level < loadedFirmware.minBatteryPercent) {
    setStatus(`Battery must be at least ${loadedFirmware.minBatteryPercent}%.`);
    return;
  }
  if (ui.confirmInput.value.trim() !== loadedFirmware.gateText) {
    setStatus(`Type ${loadedFirmware.gateText} to confirm.`);
    return;
  }

  ui.flashButton.disabled = true;
  ui.flashStages.replaceChildren();
  appendFlashLog(`Starting flash: ${loadedFirmware.label}`);

  try {
    await dfuStage("Start", buildStartFrame(), 0x01);
    await dfuStage("Init", buildInitFrame(loadedFirmware.bytes, loadedFirmware.initType), 0x02);
    const totalChunks = chunkCount(loadedFirmware.bytes.byteLength);
    for (let index = 0; index < totalChunks; index += 1) {
      await dfuStage(`Data ${index + 1}/${totalChunks}`, buildDataFrame(loadedFirmware.bytes, index), 0x03);
    }
    await dfuStage("Check", buildCheckFrame(), 0x04);
    await ble.writeDfuFrame(buildEndFrame(), manifest?.defaultDfuSegmentBytes ?? 240, "DFU End");
    addStage("End", "ok");
    appendFlashLog("End frame sent. The ring may disconnect or reboot.");
    setStatus("Flash complete; reconnect and verify Device Information.");
  } catch (error) {
    addStage("Hard stop", "fail");
    appendFlashLog(errorMessage(error));
    setStatus("Flash stopped");
  } finally {
    ui.flashButton.disabled = false;
  }
}

async function dfuStage(label: string, frame: ReturnType<typeof buildStartFrame>, expectedCommand: number): Promise<void> {
  addStage(label, "pending");
  const responsePromise = waitForDfuResponse(expectedCommand, 20000);
  await ble.writeDfuFrame(frame, manifest?.defaultDfuSegmentBytes ?? 240, `DFU ${label}`, (sent, total) => {
    if (total > 1 && sent === total) appendFlashLog(`${label}: wrote ${total} BLE segments.`);
  });
  const response = await responsePromise;
  if (!response.valid || response.statusCode !== 0) {
    throw new Error(`${label} failed: ${response.error ?? response.statusName}`);
  }
  addStage(label, "ok");
}

function waitForDfuResponse(expectedCommand: number, timeoutMs: number): Promise<ReturnType<typeof parseDfuResponse>> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for DFU response 0x${expectedCommand.toString(16).padStart(2, "0")}.`));
    }, timeoutMs);
    const unsubscribe = ble.onPacket((packet) => {
      const parsed = parseDfuResponse(packet.bytes);
      if (!parsed.valid || parsed.command !== expectedCommand) return;
      window.clearTimeout(timeout);
      unsubscribe();
      appendFlashLog(`RX ${expectedCommand.toString(16)}: ${parsed.statusName}`);
      resolve(parsed);
    });
  });
}

async function refreshMidiOutputs(): Promise<void> {
  ui.midiOutputSelect.replaceChildren();
  try {
    const outputs = await midi.initialise();
    if (outputs.length === 0) {
      ui.midiOutputSelect.append(new Option("No MIDI outputs", ""));
      return;
    }
    for (const output of outputs) {
      ui.midiOutputSelect.append(new Option(output.name ?? output.id, output.id));
    }
    midi.setOutput(ui.midiOutputSelect.value);
  } catch (error) {
    ui.midiOutputSelect.append(new Option(errorMessage(error), ""));
  }
}

async function rawOn(): Promise<void> {
  try {
    const writes = await ble.enableRaw();
    rawEnabled = true;
    setStatus(`Raw on (${writes} writes)`);
  } catch (error) {
    setStatus(errorMessage(error));
  }
}

async function rawOff(): Promise<void> {
  try {
    const writes = await ble.disableRaw();
    rawEnabled = false;
    setStatus(`Raw off (${writes} writes)`);
  } catch (error) {
    setStatus(errorMessage(error));
  }
}

async function quietSensors(): Promise<void> {
  try {
    const writes = await ble.quietOpticalSensors();
    setStatus(`Quiet sensor commands sent (${writes} writes)`);
  } catch (error) {
    setStatus(errorMessage(error));
  }
}

async function healthOff(): Promise<void> {
  try {
    const writes = await ble.disableHealthLogging();
    setStatus(`Health logs off (${writes} writes)`);
  } catch (error) {
    setStatus(errorMessage(error));
  }
}

async function startSensor(kind: number, label: string): Promise<void> {
  try {
    const writes = await ble.startRealtimeSensor(kind, label);
    setStatus(`Started ${label} (${writes} writes)`);
  } catch (error) {
    setStatus(errorMessage(error));
  }
}

async function stopSensors(): Promise<void> {
  try {
    const writes = await ble.quietOpticalSensors();
    setStatus(`Sensor streams stopped (${writes} writes)`);
  } catch (error) {
    setStatus(errorMessage(error));
  }
}

function sendLearnCc(axis: string, input: HTMLInputElement): void {
  const sent = midi.sendSingleCc(Number(input.value), 127, Number(ui.midiChannelSelect.value));
  setStatus(sent ? `${axis} CC sent` : "Select a MIDI output first.");
}

function handlePacket(packet: RingPacket): void {
  const motion = decodeMotionPacket(packet);
  if (motion) {
    latestReading = motion;
    motionReceivedAt = new Date().toLocaleTimeString();
    const snapshot = stats.push(packet.timestamp);
    ui.rateText.textContent = `${snapshot.sampleRateHz} Hz`;
    const values = midi.sendMotion(motion, currentMidiMapping());
    if (values) {
      latestMidiValues = values;
      renderMidiValues(values);
    }
    renderAccelerationReading();
    return;
  }
  const sensor = decodeSensorPacket(packet);
  if (sensor) {
    latestSensorReadings.set(sensor.kind, sensor);
    sensorReceivedAt.set(sensor.kind, new Date().toLocaleTimeString());
    appendPacketLog("sensor", `${sensor.label}: ${formatSensorValue(sensor)} (${sensor.packetHex})`);
    renderSensorReadings();
    return;
  }
  recordOtherPacket(packet);
}

function currentMidiMapping(): MidiMapping {
  return {
    xCc: Number(ui.xCcInput.value),
    yCc: Number(ui.yCcInput.value),
    zCc: Number(ui.zCcInput.value),
    channel: Number(ui.midiChannelSelect.value),
    smoothing: Number(ui.smoothingInput.value),
    deadband: Number(ui.deadbandInput.value),
    rateLimitHz: Number(ui.midiRateInput.value),
    invertX: ui.invertXInput.checked,
    invertY: ui.invertYInput.checked,
    invertZ: ui.invertZInput.checked,
  };
}

function renderMidiChannels(): void {
  for (let index = 0; index < 16; index += 1) {
    ui.midiChannelSelect.append(new Option(`Channel ${String(index + 1).padStart(2, "0")}`, String(index)));
  }
}

function renderDocTabs(): void {
  ui.docTabs.replaceChildren();
  for (const page of DOC_PAGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = page.title;
    button.dataset.doc = page.id;
    button.addEventListener("click", () => selectDoc(page));
    ui.docTabs.append(button);
  }
}

function selectDoc(page: DocPage): void {
  ui.docTabs
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((button) => button.classList.toggle("active", button.dataset.doc === page.id));
  ui.docContent.innerHTML = docHtml(page);
}

function openDocReference(pageId: string, anchorId: string | undefined): void {
  const page = DOC_PAGES.find((entry) => entry.id === pageId) ?? DOC_PAGES[0];
  selectTab("docs");
  selectDoc(page);
  if (!anchorId) return;
  window.requestAnimationFrame(() => {
    document.getElementById(anchorId)?.scrollIntoView({ block: "start" });
  });
}

function renderMidiValues(values: MidiValues): void {
  ui.xMeter.value = values.x;
  ui.yMeter.value = values.y;
  ui.zMeter.value = values.z;
  ui.xMidiText.textContent = String(values.x);
  ui.yMidiText.textContent = String(values.y);
  ui.zMidiText.textContent = String(values.z);
}

function renderConnection(): void {
  const connected = ble.connected;
  ui.connectButton.disabled = connected;
  ui.disconnectButton.disabled = !connected;
  for (const button of [
    ui.rawOnButton,
    ui.rawOffButton,
    ui.quietSensorsButton,
    ui.healthOffButton,
    ui.heartRateButton,
    ui.bloodOxygenButton,
    ui.stopSensorsButton,
  ]) {
    button.disabled = !connected;
  }
  ui.deviceText.textContent = connectionInfo?.deviceName ?? "None";
  ui.hardwareText.textContent = deviceInfo.hardware ?? "Unknown";
  ui.firmwareText.textContent = deviceInfo.firmware ?? "Unknown";
  ui.batteryText.textContent = batteryInfo ? `${batteryInfo.level}%${batteryInfo.charging ? " charging" : ""}` : "Unknown";
  ui.rateText.textContent = connected ? ui.rateText.textContent : "0 Hz";
  ui.compatibilityPanel.innerHTML = renderCompatibility();
}

function renderCapabilities(): void {
  const capabilities = browserCapabilities();
  ui.bluetoothSupportText.textContent = capabilities.webBluetooth ? "Available" : "Unavailable";
  ui.bluetoothSupportMeta.textContent = capabilities.webBluetooth
    ? "Chrome or Edge can connect to the ring."
    : "Use a Web Bluetooth browser.";
  ui.midiSupportText.textContent = capabilities.webMidi ? "Available" : "Unavailable";
  ui.midiSupportMeta.textContent = capabilities.webMidi ? "MIDI outputs can be selected." : "MIDI controls will be limited.";
  ui.secureContextText.textContent = capabilities.secureContext ? "Secure" : "Blocked";
  ui.secureContextMeta.textContent = capabilities.secureContext ? "Bluetooth is allowed." : "Open the HTTPS site.";
  ui.pickerFilterText.textContent = "R02 prefixes";
  ui.pickerFilterMeta.textContent = "Examples include R02 and Colmi R02.";
}

function renderSensorReadings(): void {
  const heartRate = latestSensorReadings.get(HEART_RATE_KIND);
  const bloodOxygen = latestSensorReadings.get(BLOOD_OXYGEN_KIND);
  ui.heartRateText.textContent = formatSensorValue(heartRate);
  ui.bloodOxygenText.textContent = formatSensorValue(bloodOxygen);
  ui.heartRateMeta.textContent = sensorMeta(HEART_RATE_KIND, heartRate);
  ui.bloodOxygenMeta.textContent = sensorMeta(BLOOD_OXYGEN_KIND, bloodOxygen);

  const extras = [...latestSensorReadings.values()]
    .filter((reading) => reading.kind !== HEART_RATE_KIND && reading.kind !== BLOOD_OXYGEN_KIND)
    .sort((left, right) => left.kind - right.kind);
  ui.extraSensorList.replaceChildren(...extras.map(sensorCard));
}

function renderAccelerationReading(): void {
  ui.accelXText.textContent = latestReading ? formatG(latestReading.g.x) : "No data";
  ui.accelYText.textContent = latestReading ? formatG(latestReading.g.y) : "No data";
  ui.accelZText.textContent = latestReading ? formatG(latestReading.g.z) : "No data";
  ui.accelMagnitudeText.textContent = latestReading ? formatG(latestReading.magnitudeG) : "No data";
  ui.accelXMeta.textContent = latestReading ? accelerationMeta("X", latestReading.raw.x) : "Idle";
  ui.accelYMeta.textContent = latestReading ? accelerationMeta("Y", latestReading.raw.y) : "Idle";
  ui.accelZMeta.textContent = latestReading ? accelerationMeta("Z", latestReading.raw.z) : "Idle";
  ui.accelMagnitudeMeta.textContent = latestReading ? `${motionReceivedAt ?? "Now"} | vector length` : "Idle";
}

function sensorCard(reading: SensorReading): HTMLElement {
  const item = document.createElement("div");
  const label = document.createElement("span");
  const value = document.createElement("strong");
  const meta = document.createElement("small");
  label.textContent = reading.label;
  value.textContent = formatSensorValue(reading);
  meta.textContent = sensorMeta(reading.kind, reading);
  item.append(label, value, meta);
  return item;
}

function sensorMeta(kind: number, reading: SensorReading | undefined): string {
  if (!reading) return "Idle";
  return `${sensorReceivedAt.get(kind) ?? "Now"} | kind ${kind}`;
}

function accelerationMeta(axis: string, raw: number): string {
  return `${motionReceivedAt ?? "Now"} | ${axis} raw ${raw}`;
}

function formatG(value: number): string {
  return `${value.toFixed(2)} g`;
}

function recordOtherPacket(packet: RingPacket): void {
  const hex = bytesToHex(packet.bytes);
  const command = `0x${packet.bytes[0]?.toString(16).padStart(2, "0") ?? "??"}`;
  const at = new Date().toLocaleTimeString();
  otherPackets.unshift({ at, command, hex });
  if (otherPackets.length > 8) otherPackets.pop();
  appendPacketLog("rx", `${command}: ${hex}`);
  renderOtherPackets();
}

function renderOtherPackets(): void {
  ui.otherPacketList.replaceChildren(
    ...otherPackets.map((packet) => {
      const item = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      const meta = document.createElement("small");
      label.textContent = "Other packet";
      value.textContent = packet.command;
      meta.textContent = `${packet.at} | ${packet.hex}`;
      item.append(label, value, meta);
      return item;
    }),
  );
}

function renderCompatibility(): string {
  if (!manifest) return "Firmware catalogue not loaded.";
  const compatible = manifest.firmware.filter((entry) => profileAcceptsDevice(entry, deviceInfo));
  if (!deviceInfo.hardware) return "Connect a ring to see compatible firmware.";
  if (compatible.length === 0) {
    return `<strong>No catalogue firmware is marked compatible with this ring state.</strong><p>${escapeHtml(
      JSON.stringify(deviceInfo),
    )}</p>`;
  }
  return `<strong>${compatible.length} compatible option${compatible.length === 1 ? "" : "s"}</strong><ul>${compatible
    .map((entry) => `<li>${escapeHtml(entry.label)}</li>`)
    .join("")}</ul>`;
}

function renderFirmwareDocAction(entry: FirmwareEntry): string {
  if (!entry.docPageId) return "";
  const anchor = entry.docAnchorId ? ` data-doc-anchor="${escapeHtml(entry.docAnchorId)}"` : "";
  return `<div class="firmware-actions"><button class="btn btn-ghost" type="button" data-doc-page="${escapeHtml(
    entry.docPageId,
  )}"${anchor}>Open patch notes</button></div>`;
}

function selectTab(tabId: string): void {
  ui.tabs.forEach((tab) => {
    const active = tab.dataset.tab === tabId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  ui.panels.forEach((panel) => panel.classList.toggle("active", panel.id === `${tabId}Panel`));
}

function addStage(label: string, status: "pending" | "ok" | "fail"): void {
  const item = document.createElement("li");
  item.className = status;
  item.textContent = `${label}: ${status}`;
  ui.flashStages.append(item);
}

function appendFlashLog(message: string): void {
  ui.flashLog.value = `${ui.flashLog.value}${new Date().toISOString()} ${message}\n`;
  ui.flashLog.scrollTop = ui.flashLog.scrollHeight;
}

function appendPacketLog(kind: string, detail: string): void {
  packetLog.push({ at: new Date().toISOString(), kind, detail });
  if (packetLog.length > 1000) packetLog.shift();
  renderPacketLog();
}

function renderPacketLog(): void {
  ui.packetLog.value = packetLog.map((item) => `${item.at} ${item.kind}: ${item.detail}`).join("\n");
  ui.packetLog.scrollTop = ui.packetLog.scrollHeight;
}

function exportDiagnostics(): void {
  const payload = diagnosticsPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `colmi-ring-diagnostics-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyDiagnosticsSummary(): Promise<void> {
  const summary = diagnosticsSummaryText();
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard is not available.");
    await navigator.clipboard.writeText(summary);
    setStatus("Diagnostics summary copied.");
  } catch (error) {
    appendPacketLog("diagnostics-summary", summary);
    setStatus(`${errorMessage(error)} Summary added to the packet log.`);
  }
}

function diagnosticsPayload() {
  return {
    exportedAt: new Date().toISOString(),
    page: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      capabilities: browserCapabilities(),
    },
    manifest: manifest
      ? {
          generatedAt: manifest.generatedAt,
          defaultDfuSegmentBytes: manifest.defaultDfuSegmentBytes,
          firmwareCount: manifest.firmware.length,
        }
      : null,
    selectedFirmware: selectedFirmware
      ? {
          id: selectedFirmware.id,
          label: selectedFirmware.label,
          fileName: selectedFirmware.fileName,
          sha256: selectedFirmware.sha256,
          initType: selectedFirmware.initType,
          minBatteryPercent: selectedFirmware.minBatteryPercent,
        }
      : null,
    loadedFirmware: loadedFirmware
      ? {
          source: loadedFirmware.source,
          label: loadedFirmware.label,
          fileName: loadedFirmware.fileName,
          byteLength: loadedFirmware.bytes.byteLength,
          initType: loadedFirmware.initType,
          minBatteryPercent: loadedFirmware.minBatteryPercent,
        }
      : null,
    connectionInfo,
    deviceInfo,
    batteryInfo,
    rawEnabled,
    latestReading,
    latestMidiValues,
    sensorReadings: [...latestSensorReadings.values()],
    otherPackets,
    packetLog,
  };
}

function diagnosticsSummaryText(): string {
  const capabilities = browserCapabilities();
  const sensors = [...latestSensorReadings.values()].map((reading) => `${reading.label}: ${formatSensorValue(reading)}`);
  return [
    "Colmi Ring Tools diagnostics",
    `Time: ${new Date().toISOString()}`,
    `URL: ${window.location.href}`,
    `Browser: ${navigator.userAgent}`,
    `Secure context: ${yesNo(capabilities.secureContext)}`,
    `Web Bluetooth: ${yesNo(capabilities.webBluetooth)}`,
    `Web MIDI: ${yesNo(capabilities.webMidi)}`,
    `Device name: ${connectionInfo?.deviceName ?? "None"}`,
    `Hardware: ${deviceInfo.hardware ?? "Unknown"}`,
    `Firmware: ${deviceInfo.firmware ?? "Unknown"}`,
    `Battery: ${batteryInfo ? `${batteryInfo.level}%${batteryInfo.charging ? " charging" : ""}` : "Unknown"}`,
    `DFU ready: ${connectionInfo ? yesNo(connectionInfo.dfuReady) : "Unknown"}`,
    `Selected firmware: ${selectedFirmware?.label ?? "None"}`,
    `Loaded firmware: ${loadedFirmware ? `${loadedFirmware.label} (${loadedFirmware.fileName})` : "None"}`,
    `Raw enabled: ${yesNo(rawEnabled)}`,
    `Raw rate: ${ui.rateText.textContent ?? "Unknown"}`,
    `Latest acceleration: ${latestReading ? `${formatG(latestReading.g.x)}, ${formatG(latestReading.g.y)}, ${formatG(latestReading.g.z)}` : "No data"}`,
    `Sensors: ${sensors.length > 0 ? sensors.join("; ") : "No data"}`,
    `Recent status: ${ui.statusText.textContent ?? "Unknown"}`,
  ].join("\n");
}

function browserCapabilities() {
  return {
    secureContext: window.isSecureContext,
    webBluetooth: Boolean(navigator.bluetooth),
    webMidi: Boolean(navigator.requestMIDIAccess),
    clipboard: Boolean(navigator.clipboard?.writeText),
  };
}

function initTheme(): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("theme");
  } catch {
    // Safari private mode or storage disabled.
  }
  if (stored === "dark" || stored === "light") {
    applyTheme(stored);
    return;
  }
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  ui.themeToggle.textContent = prefersDark ? "☀️" : "🌙";
}

function toggleTheme(): void {
  const current = document.documentElement.dataset.theme;
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = current ? current === "dark" : prefersDark;
  applyTheme(isDark ? "light" : "dark");
}

function applyTheme(theme: "dark" | "light"): void {
  document.documentElement.dataset.theme = theme;
  ui.themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Safari private mode or storage disabled.
  }
  const meta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
  if (meta) {
    meta.content = theme === "dark" ? "#111318" : "#176e61";
  }
}

function setStatus(message: string): void {
  ui.statusText.textContent = message;
}

function clearRingState(): void {
  rawEnabled = false;
  connectionInfo = null;
  deviceInfo = {};
  batteryInfo = null;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}
