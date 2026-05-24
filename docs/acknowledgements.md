# Acknowledgements

This project builds on public research, examples, and reference documentation
from people who had already done useful work around Colmi rings, the RF03
platform, BLE, and browser MIDI/Bluetooth tooling.

Thanks in particular to:

- Aaron Christophel / atc1441 for [ATC_RF03_Ring](https://github.com/atc1441/ATC_RF03_Ring), including RF03/BlueX hardware notes, OTA firmware context, and prior work on faster raw motion data.
- Floyd Steinberg / mrfloydst for [smartringmidi](https://github.com/mrfloydst/smartringmidi), which provided a clear browser-based MIDI controller example for the R02.
- Puxtril for [colmi-docs](https://github.com/Puxtril/colmi-docs), documenting Colmi BLE commands and response shapes.
- Wesley Ellis / tahnok for [colmi_r02_client](https://github.com/tahnok/colmi_r02_client), including practical BLE client code and packet-level documentation for R02-family rings.
- Bluetooth SIG for the [Assigned Numbers](https://www.bluetooth.com/specifications/assigned-numbers/) and BLE GATT reference material used to confirm standard service and characteristic meanings.
- Nordic Semiconductor for the [Nordic UART Service documentation](https://docs.nordicsemi.com/bundle/ncs-latest/page/nrf/libraries/bluetooth_services/services/nus.html), useful background for the UART-like BLE service shape used by these rings.
- The MDN Web Docs projects for the [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) and [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) references used while building the browser tools.

Those projects and documents remain under their own licences and terms. This
repository does not vendor their code or assets; they are credited here as
important references for understanding the device and building a usable public
tool.
