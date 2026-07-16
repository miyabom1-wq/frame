import { nowIso, parseJson, normalizeSymbol } from '../utils.js';
const KEY='frame:plans:v1';
async function read(env){return parseJson(await env.FRAME_KV.get(KEY),[])||[];}
async function write(env,plans){await env.FRAME_KV.put(KEY,JSON.stringify(plans));return plans;}
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
