import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../js/state.js';
import { getPulseServiceSignalForSector } from '../js/systems/economy/pulseService.js';

test('supplying pulse goods improves service signal', () => {
  state.economy = { pressureBySector: { 1: { pulse_canister: { currentStock: 2, targetStock: 20 }, heavy_pulse_module: { currentStock: 2, targetStock: 20 }, gate_coils: { currentStock: 2, targetStock: 20 }, control_cores: { currentStock: 2, targetStock: 20 } } }, profilesBySector: {1:{targetStock:{}}} };
  const low = getPulseServiceSignalForSector(1);
  state.economy.pressureBySector[1].pulse_canister.currentStock = 20;
  state.economy.pressureBySector[1].heavy_pulse_module.currentStock = 20;
  state.economy.pressureBySector[1].gate_coils.currentStock = 20;
  state.economy.pressureBySector[1].control_cores.currentStock = 20;
  const high = getPulseServiceSignalForSector(1);
  assert.ok(high.reserveRatio > low.reserveRatio);
});
