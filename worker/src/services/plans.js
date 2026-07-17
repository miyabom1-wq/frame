import { nowIso, parseJson, normalizeSymbol } from '../utils.js';

const KEY='frame:plans:v1';
const VALID_ENTRY_STATUS=new Set(['UNSET','WAIT','READY','TRIGGERED','INVALID']);
const VALID_TEMPLATE=new Set(['unset','reacceleration','reversal','pullback_complete']);

async function readRaw(env){return parseJson(await env.FRAME_KV.get(KEY),[])||[];}
async function write(env,plans){await env.FRAME_KV.put(KEY,JSON.stringify(plans));return plans;}
function contextText(v,n=120){return String(v??'').trim().slice(0,n);}
function contextNumber(v){return v==null||String(v).trim()===''?null:(Number.isFinite(Number(v))?Number(v):null);}
function normalizeEntryStatus(v,fallback='WAIT'){const s=String(v||'').toUpperCase();return VALID_ENTRY_STATUS.has(s)?s:fallback;}
function templateFromLane(lane,source=''){if(String(source||'').toLowerCase()==='manual')return'unset';const l=String(lane||'').toUpperCase();if(l==='A')return'reacceleration';if(l==='B')return'reversal';if(l==='C')return'pullback_complete';return'unset';}
function normalizeTemplate(v,lane='',source=''){const t=String(v||'').toLowerCase();return VALID_TEMPLATE.has(t)?t:templateFromLane(lane,source);}
function modeFromTemplate(t){return t==='pullback_complete'?'pullback':'new';}
function templateLabel(t){return({reacceleration:'再加速待ち',reversal:'反転確認待ち',pullback_complete:'押し目完了待ち',unset:'条件未設定'})[t]||'条件未設定';}

function normalizeSourceContext(v){
  if(!v||String(v.source||'').toUpperCase()!=='VANTAGE')return null;
  return{
    source:'VANTAGE',market:v.market==='jp'?'jp':'us',symbol:contextText(v.symbol,32),name:contextText(v.name,100),
    theme:contextText(v.theme,80),theme_phase:contextText(v.theme_phase,40),theme_code:contextText(v.theme_code,40),
    propagation:contextText(v.propagation,60),lane:contextText(v.lane,8),lane_label:contextText(v.lane_label,80),
    risk:contextText(v.risk,80),scope:contextText(v.scope,20),from:contextText(v.from,30),setup:contextText(v.setup,80),
    trade_date:contextText(v.trade_date,20),rs5:contextNumber(v.rs5),rs20:contextNumber(v.rs20),vol_ratio:contextNumber(v.vol_ratio),
    price:contextNumber(v.price),change_pct:contextNumber(v.change_pct),price_time:contextText(v.price_time,40),quote_state:contextText(v.quote_state,100),
    supply_label:contextText(v.supply_label,30),supply_score:contextNumber(v.supply_score),margin_ratio:contextNumber(v.margin_ratio),
    margin_buy:contextNumber(v.margin_buy),margin_sell:contextNumber(v.margin_sell),margin_buy_change_pct:contextNumber(v.margin_buy_change_pct),
    margin_turnover_days:contextNumber(v.margin_turnover_days),margin_as_of:contextText(v.margin_as_of,20),margin_summary:contextText(v.margin_summary,180),
    margin_flags:v.margin_flags&&typeof v.margin_flags==='object'?v.margin_flags:{},margin_add_blocked:!!v.margin_add_blocked
  };
}

function configuredPlan(plan={}){
  if(plan.plan_configured===true)return true;
  if(plan.plan_configured===false)return false;
  return Boolean(plan.diagnosis||plan.phase||plan.entries||plan.entry||plan.invalidation||
    (Array.isArray(plan.checklist)&&plan.checklist.length)||String(plan.memo||'').trim()||
    (Array.isArray(plan.history)&&plan.history.length));
}

function normalizePlan(plan={}){
  const linked=plan.linked_to_vantage===true;
  const configured=configuredPlan(plan);
  const lane=plan.source_context?.lane||plan.vantage_lane||'';
  const template=normalizeTemplate(plan.template,lane,plan.vantage_source);
  const fallback=configured?'WAIT':'UNSET';
  const entryStatus=normalizeEntryStatus(plan.entry_status||plan.status,fallback);
  return{
    ...plan,
    linked_to_vantage:linked,
    vantage_link_state:linked?'linked':(plan.vantage_link_state||null),
    plan_configured:configured,
    template,
    template_label:templateLabel(template),
    status:configured?entryStatus:'UNSET',
    entry_status:configured?entryStatus:'UNSET'
  };
}

async function read(env){return(await readRaw(env)).map(normalizePlan);}

function statusRecord(plan){
  const status=plan.plan_configured?normalizeEntryStatus(plan.entry_status||plan.status,'WAIT'):'UNSET';
  return{
    id:plan.id,symbol:plan.symbol,market:plan.market,status,
    configured:!!plan.plan_configured,linked:!!plan.linked_to_vantage,
    template:plan.template||'unset',template_label:templateLabel(plan.template||'unset'),
    updated_at:plan.updated_at||null
  };
}
function statusMap(plans){return Object.fromEntries(plans.filter(x=>x.linked_to_vantage).map(x=>[String(x.symbol||'').toUpperCase(),statusRecord(x)]));}

function contextFromSync(raw,market,symbol,name){
  const source=raw.source_context&&typeof raw.source_context==='object'?raw.source_context:{};
  return normalizeSourceContext({...source,source:'VANTAGE',market,symbol,name,lane:raw.lane??source.lane,lane_label:raw.lane_label??source.lane_label,from:'watch'});
}

async function syncVantage(env,plans,body){
  const incoming=Array.isArray(body.items)?body.items:[];
  if(incoming.length>500)throw new Error('too many watch items');
  const now=nowIso(),seen=new Set(),next=[...plans];
  for(const raw of incoming){
    const market=raw.market==='jp'?'jp':'us',symbol=normalizeSymbol(raw.symbol,market);if(!symbol)continue;
    const id=`${market}:${symbol}`,idx=next.findIndex(x=>x.id===id),previous=idx>=0?normalizePlan(next[idx]):null;
    const name=contextText(raw.name||previous?.name||symbol,100),lane=contextText(raw.lane||raw.source_context?.lane,8),source=contextText(raw.source||'watch',30);
    const suggested=normalizeTemplate(raw.template,lane,source),configured=previous?configuredPlan(previous):false;
    const template=configured?normalizeTemplate(previous.template,lane,source):suggested;
    const sourceContext=contextFromSync(raw,market,symbol,name);
    const linked={
      ...(previous||{}),id,market,symbol,name,
      mode:configured?(previous.mode||modeFromTemplate(template)):modeFromTemplate(template),
      status:configured?normalizeEntryStatus(previous.entry_status||previous.status,'WAIT'):'UNSET',
      entry_status:configured?normalizeEntryStatus(previous.entry_status||previous.status,'WAIT'):'UNSET',
      holding_status:previous?.holding_status||'HOLD',
      template,template_label:templateLabel(template),plan_configured:configured,
      linked_to_vantage:true,vantage_link_state:'linked',vantage_watch_id:contextText(raw.watch_id||raw.id,80),
      vantage_status:contextText(raw.watch_status||raw.status,30),vantage_memo:contextText(raw.memo,500),vantage_source:source,
      vantage_lane:lane,vantage_synced_at:now,vantage_unlinked_at:null,
      source_context:sourceContext||previous?.source_context||null,
      memo:previous?.memo||'',updated_at:configured?(previous.updated_at||now):now,created_at:previous?.created_at||now
    };
    if(idx>=0)next[idx]=linked;else next.push(linked);seen.add(id);
  }

  const cleaned=[];
  for(const raw of next){
    const plan=normalizePlan(raw);
    if(!plan.linked_to_vantage||seen.has(plan.id)){cleaned.push(plan);continue;}
    if(configuredPlan(plan))cleaned.push({...plan,linked_to_vantage:false,vantage_link_state:'detached',vantage_unlinked_at:now,vantage_watch_id:null,vantage_synced_at:now});
  }
  await write(env,cleaned);
  return{ok:true,schema:'vantage-watch-sync-v1',synced_at:now,received:incoming.length,linked:cleaned.filter(x=>x.linked_to_vantage).length,detached:cleaned.filter(x=>x.vantage_link_state==='detached').length,statuses:statusMap(cleaned),plans:cleaned};
}

export async function getPlans(env){
  const plans=await read(env);
  return{ok:true,plans,sync:{linked:plans.filter(x=>x.linked_to_vantage).length,unconfigured:plans.filter(x=>x.linked_to_vantage&&!x.plan_configured).length,detached:plans.filter(x=>x.vantage_link_state==='detached').length,statuses:statusMap(plans)}};
}

export async function mutatePlans(env,body={}){
  const plans=await read(env),action=body.action;
  if(action==='sync_vantage')return syncVantage(env,plans,body);
  if(action==='save'){
    const market=body.market==='jp'?'jp':'us',symbol=normalizeSymbol(body.symbol,market);if(!symbol)throw new Error('symbol required');
    const now=nowIso(),id=body.id||`${market}:${symbol}`,previous=plans.find(x=>x.id===id),entryStatus=normalizeEntryStatus(body.entry_status||body.status,'WAIT');
    const sourceContext=body.source_context===null?null:(normalizeSourceContext(body.source_context)||previous?.source_context||null);
    const template=normalizeTemplate(body.template||previous?.template,sourceContext?.lane||previous?.vantage_lane,previous?.vantage_source);
    const item={
      id,market,symbol,name:String(body.name||previous?.name||symbol),
      mode:['new','pullback','hold'].includes(body.mode)?body.mode:(previous?.mode||modeFromTemplate(template)),
      status:entryStatus,entry_status:entryStatus,
      holding_status:String(body.holding_status||previous?.holding_status||'HOLD'),diagnosis:body.diagnosis||previous?.diagnosis||null,
      phase:body.phase||previous?.phase||null,source_context:sourceContext,
      entries:body.entries||previous?.entries||null,entry:body.entry||body.entries?.standard||previous?.entry||null,
      stop:body.stop||body.entries?.standard?.stop||previous?.stop||null,invalidation:body.invalidation||previous?.invalidation||null,
      checklist:Array.isArray(body.checklist)?body.checklist:(previous?.checklist||[]),memo:String(body.memo??previous?.memo??''),
      template,template_label:templateLabel(template),plan_configured:true,
      linked_to_vantage:!!previous?.linked_to_vantage,vantage_link_state:previous?.linked_to_vantage?'linked':(previous?.vantage_link_state||null),
      vantage_watch_id:previous?.vantage_watch_id||null,vantage_status:previous?.vantage_status||null,vantage_memo:previous?.vantage_memo||'',
      vantage_source:previous?.vantage_source||null,vantage_lane:previous?.vantage_lane||sourceContext?.lane||'',vantage_synced_at:previous?.vantage_synced_at||null,
      vantage_unlinked_at:previous?.vantage_unlinked_at||null,updated_at:now,created_at:previous?.created_at||now
    };
    const next=[item,...plans.filter(x=>x.id!==id)];await write(env,next);return{ok:true,item,plans:next};
  }
  if(action==='delete'){
    const next=plans.filter(x=>x.id!==body.id);await write(env,next);return{ok:true,plans:next};
  }
  if(action==='memo'){
    const idx=plans.findIndex(x=>x.id===body.id);if(idx<0)throw new Error('plan not found');
    const template=normalizeTemplate(body.template||plans[idx].template,plans[idx].source_context?.lane||plans[idx].vantage_lane,plans[idx].vantage_source);
    plans[idx]={...plans[idx],memo:String(body.memo||''),mode:['new','pullback','hold'].includes(body.mode)?body.mode:plans[idx].mode,template,template_label:templateLabel(template),plan_configured:plans[idx].plan_configured||Boolean(String(body.memo||'').trim())||template!=='unset',updated_at:nowIso()};
    if(plans[idx].plan_configured&&plans[idx].entry_status==='UNSET'){plans[idx].entry_status='WAIT';plans[idx].status='WAIT';}
    await write(env,plans);return{ok:true,item:plans[idx]};
  }
  throw new Error('unsupported action');
}
