import { state } from '../../state.js';
import { deriveRouteMetrics } from '../tradeRoutes.js';

const TYPES = ['mining_contractor','refinery_operator','industrial_supplier','import_export','haulage','ship_refitter','dockyard','security_contractor'];
const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d;};

function nearbyExtraction(sectorId){
  return Object.keys(state.economy?.profilesBySector||{}).reduce((sum,sid)=>{
    const m=deriveRouteMetrics(Number(sectorId), Number(sid));
    if (!m.path || (m.hopCount||99)>3) return sum;
    return sum + num(state.economy?.profilesBySector?.[sid]?.extractionCapacity) / Math.max(1,(m.hopCount||1));
  },0);
}
export function scoreCompanyTypeForSector(sectorId,type){
  const p = state.economy?.profilesBySector?.[sectorId] || {};
  const routeAccess = num(p.routeAccess, 1 - num(p.routeDependence, 0.5));
  const extraction = num(p.extractionCapacity);
  const nearby = nearbyExtraction(sectorId);
  const importPressure = (p.likelyImports||[]).length;
  const exportPressure = (p.likelyExports||[]).length;
  const demand = num(p.demandWeight);
  const front = state.universe?.[sectorId]?.front ? 1 : 0;
  const portType = state.ports?.[sectorId]?.typeKey || '';
  const hazard = num(state.universe?.[sectorId]?.asteroids?.hazard);
  let score = 0;
  if (type==='mining_contractor') score = extraction*0.02 + nearby*0.005 - hazard*2 + (portType==='mining'?3:0);
  if (type==='refinery_operator') score = (extraction+nearby)*0.01 + importPressure + exportPressure + (portType==='refinery'?2:0);
  if (type==='industrial_supplier') score = demand*2 + importPressure*1.2 + exportPressure*0.8 + routeAccess*3 + (portType==='industrial'?2:0);
  if (type==='import_export') score = (importPressure+exportPressure)*1.4 + routeAccess*4 + Math.min(importPressure, exportPressure)*2;
  if (type==='haulage') score = (importPressure+exportPressure) + routeAccess*4 + Math.min(importPressure, exportPressure)*2;
  if (type==='ship_refitter') score = routeAccess*2 + (portType==='stardock'?3:0);
  if (type==='dockyard') score = routeAccess*2 + demand + (portType==='stardock'?2:0);
  if (type==='security_contractor') score = hazard + (1-routeAccess)*2;
  if (state.ports?.[sectorId]?.hiddenFactionId==='vc' && type==='import_export') score += 1.5;
  if (front && type==='security_contractor') score += 2;
  return { type, score: Math.max(0, score), count: Math.max(0, Math.min(3, Math.round(score/4))), reasons: [`route:${routeAccess.toFixed(2)}`,`extract:${Math.round(extraction)}`] };
}
export function scoreCompanyTypesForSector(sectorId){ return TYPES.map((t)=>scoreCompanyTypeForSector(sectorId,t)).sort((a,b)=>b.score-a.score); }
export function chooseCapacityBasedCompanyTypes(sectorId){
  const ranked = scoreCompanyTypesForSector(sectorId);
  const picks = [];
  ranked.slice(0,4).forEach((r,idx)=>{ const count = Math.max(idx===0?1:0, r.count); for(let i=0;i<count;i++) picks.push(r.type);});
  if (picks.length===0) picks.push('haulage');
  return picks;
}
export function explainCompanyScore(sectorId,type){ return scoreCompanyTypeForSector(sectorId,type); }
