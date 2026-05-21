import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../js/state.js';
import { scoreCompanyTypeForSector } from '../js/systems/economy/companyScoring.js';

test('higher extraction raises mining score', () => {
  state.economy = { profilesBySector: {1:{extractionCapacity:100,likelyImports:[],likelyExports:[],demandWeight:1},2:{extractionCapacity:5000,likelyImports:[],likelyExports:[],demandWeight:1}} };
  state.universe = {1:{jumpGates:[]},2:{jumpGates:[]}};
  state.ports = {};
  assert.ok(scoreCompanyTypeForSector(2,'mining_contractor').score > scoreCompanyTypeForSector(1,'mining_contractor').score);
});
