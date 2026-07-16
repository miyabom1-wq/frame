import { nowIso, parseJson, normalizeSymbol } from '../utils.js';
const KEY='frame:plans:v1';
async function read(env){return parseJson(await env.FRAME_KV.get(KEY),[])||[];}
async function write(env,plans){await env.FRAME_KV.put(KEY,JSON.stringify(plans));return plans;}
function contextText(v,n=120){return String(v??'').trim().slice(0,n);}
function normalizeSourceContext(v){
  if(!v||String(v.source||'').toUpperCase()!=='VANTAGE')return null;
  const number=x=>x==null||String(x).trim()===''?null:(Number.isFinite(Number(x))?Number(x):null);
  return{source:'VANTAGE',market:v.market==='jp'?'jp':'us',symbol:contextText(v.symbol,32),name:contextText(v.name,100),theme:contextText(v.theme,80),theme_phase:contextText(v.theme_phase,40),theme_code:contextText(v.theme_code,40),propagation:contextText(v.propagation,60),lane:contextText(v.lane,8),lane_label:contextText(v.lane_label,80),risk:contextText(v.risk,80),scope:contextText(v.scope,20),from:contextText(v.from,30),setup:contextText(v.setup,80),trade_date:contextText(v.trade_date,20),rs5:number(v.rs5),rs20:number(v.rs20),vol_ratio:number(v.vol_ratio)};
}

export async function getPlans(env){return{ok:true,plans:await read(env)};}
export async function mutatePlans(env,body={}){
  const plans=await read(env),action=body.action;
  if(action==='save'){
    const market=body.market==='jp'?'jp':'us',symbol=normalizeSymbol(body.symbol,market);
    if(!symbol)throw new Error('symbol required');
    const now=nowIso(),id=body.id||`${market}:${symbol}`;
    const previous=plans.find(x=>x.id===id);
    const item={
      id,market,symbol,name:String(body.name||symbol),
      mode:['new','pullback','hold'].includes(body.mode)?body.mode:'new',
      status:String(body.status||body.entry_status||'WAIT'),entry_status:String(body.entry_status||body.status||'WAIT'),
      holding_status:String(body.holding_status||'HOLD'),diagnosis:body.diagnosis||null,
      phase:body.phase||previous?.phase||null,
      source_context:body.source_context===null?null:(normalizeSourceContext(body.source_context)||previous?.source_context||null),
      entries:body.entries||previous?.entries||null,
      entry:body.entry||body.entries?.standard||previous?.entry||null,
      stop:body.stop||body.entries?.standard?.stop||previous?.stop||null,
      invalidation:body.invalidation||null,
      checklist:Array.isArray(body.checklist)?body.checklist:[],
      memo:String(body.memo??previous?.memo??''),updated_at:now,created_at:previous?.created_at||now
    };
    const next=[item,...plans.filter(x=>x.id!==id)];
    await write(env,next);return{ok:true,item,plans:next};
  }
  if(action==='delete'){
    const next=plans.filter(x=>x.id!==body.id);await write(env,next);return{ok:true,plans:next};
  }
  if(action==='memo'){
    const idx=plans.findIndex(x=>x.id===body.id);if(idx<0)throw new Error('plan not found');
    plans[idx]={...plans[idx],memo:String(body.memo||''),mode:['new','pullback','hold'].includes(body.mode)?body.mode:plans[idx].mode,updated_at:nowIso()};
    await write(env,plans);return{ok:true,item:plans[idx]};
  }
  throw new Error('unsupported action');
}
