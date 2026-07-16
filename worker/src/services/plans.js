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
    const item={
      id,market,symbol,name:String(body.name||symbol),status:String(body.status||'WAIT'),
      diagnosis:body.diagnosis||null,entry:body.entry||null,stop:body.stop||null,
      invalidation:body.invalidation||null,memo:String(body.memo||''),updated_at:now,
      created_at:plans.find(x=>x.id===id)?.created_at||now
    };
    const next=[item,...plans.filter(x=>x.id!==id)];
    await write(env,next);return{ok:true,item,plans:next};
  }
  if(action==='delete'){
    const next=plans.filter(x=>x.id!==body.id);await write(env,next);return{ok:true,plans:next};
  }
  if(action==='memo'){
    const idx=plans.findIndex(x=>x.id===body.id);if(idx<0)throw new Error('plan not found');
    plans[idx]={...plans[idx],memo:String(body.memo||''),updated_at:nowIso()};await write(env,plans);return{ok:true,item:plans[idx]};
  }
  throw new Error('unsupported action');
}
