import { state } from '../../state.js';
import { getFreshnessSummaryForSector } from '../../core/dataCargo/implementation.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d;};

export function getMarketInformationQuality(actorContext, sectorId){
  const acumen=num(actorContext?.acumen, actorContext?.character?.acumen || 0);
  const tradecraft=num(actorContext?.tradecraft, actorContext?.character?.tradecraft || 0);
  const standing=num(actorContext?.factionStanding,0);
  const freshness=getFreshnessSummaryForSector(sectorId);
  const freshnessScore = freshness.label==='current'?1:freshness.label==='fresh'?0.75:freshness.label==='stale'?0.45:freshness.known?0.3:0.1;
  const skillScore = clamp((acumen+tradecraft)/200 + standing/300,0,1);
  const score = clamp(skillScore*0.65 + freshnessScore*0.35 + (Number(actorContext?.currentSector)===Number(sectorId)?0.2:0),0,1);
  const tier = score >=0.72 ? 'high' : score >=0.42 ? 'medium' : 'low';
  return { score, tier, freshness: freshness.label, known: freshness.known };
}

export function getDisplayedMarketSignal(sectorId, commodity, actorContext, options={}){
  const q=getMarketInformationQuality(actorContext,sectorId);
  const s=state.economy?.pressureBySector?.[sectorId]?.[commodity]||{};
  if (q.tier==='high') return { quality:q, stock: num(s.currentStock), target: num(s.targetStock), dailyDemand:num(s.dailyDemand||s.dailyConsumption), dailyProduction:num(s.dailyProduction), causes:s.causes||[], intelPrompt:null };
  if (q.tier==='medium') return { quality:q, stockBand: Math.round(num(s.currentStock)/10)*10, targetBand:Math.round(num(s.targetStock)/10)*10, dailyUseBand:Math.round(num(s.dailyDemand||s.dailyConsumption||0)/5)*5, causes:['market pressure trend'], intelPrompt:null };
  return { quality:q, label: num(s.shortageSeverity)>0.5?'shortage risk':'volatile', causes:['insufficient telemetry'], intelPrompt:'Gather intel for precise market telemetry.' };
}

export function getDisplayedSupplierSignals(sectorId, commodity, actorContext, options={}){
  const q=getMarketInformationQuality(actorContext,sectorId);
  const rows = Object.entries(state.economy?.pressureBySector||{}).filter(([sid,p])=>Number(sid)!==Number(sectorId)&&num(p?.[commodity]?.surplus)>0)
    .map(([sid,p])=>({sectorId:Number(sid),surplus:num(p?.[commodity]?.surplus),routeAccess:num(p?.[commodity]?.routeAccess,0),confidence:num(p?.[commodity]?.confidence,0)}))
    .sort((a,b)=>b.surplus-a.surplus).slice(0,3);
  return rows.map((r)=> q.tier==='high'?r : q.tier==='medium'?({...r,surplus:Math.round(r.surplus/10)*10,confidenceLabel:r.confidence>0.7?'high':'medium'}) : ({sectorId:r.sectorId,label:'possible supplier',confidenceLabel:'low'}));
}
export function formatMarketIntelligenceQuality(quality){ return `${quality.tier} (${Math.round(quality.score*100)}%)`; }
