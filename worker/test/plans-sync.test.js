import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlans, mutatePlans } from '../src/services/plans.js';

function env(){
  const map=new Map();
  return{FRAME_KV:{async get(k){return map.get(k)||null},async put(k,v){map.set(k,v)}}};
}
function yahoo(symbol='TEST',step=.2){
  const timestamp=[],open=[],high=[],low=[],close=[],volume=[];let p=100,day=0;
  while(close.length<520){
    const d=new Date(Date.UTC(2024,0,1+day++));if([0,6].includes(d.getUTCDay()))continue;
    p+=step;timestamp.push(Math.floor(d.getTime()/1000));open.push(p-.2);high.push(p+.6);low.push(p-.7);close.push(p);volume.push(1_000_000+close.length*1000);
  }
  return{chart:{result:[{meta:{symbol,longName:`${symbol} Name`,currency:'JPY',exchangeName:'TSE',regularMarketPrice:p,marketState:'CLOSED',regularMarketTime:timestamp.at(-1)},timestamp,indicators:{quote:[{open,high,low,close,volume}],adjclose:[{adjclose:close}]},events:{}}],error:null}};
}
const watch=(symbol,lane='C',tradeDate='2026-07-18')=>({watch_id:'w1',symbol,market:'jp',name:'テスト',lane,source:'candidate',memo:'登録理由',source_context:{source:'VANTAGE',market:'jp',symbol,name:'テスト',lane,lane_label:'候補',trade_date:tradeDate,price_time:`${tradeDate}T06:30:00.000Z`,price:120,change_pct:1.2,rs5:2.1,rs20:3.2,vol_ratio:1.4}});

test('sync auto-analyzes a linked placeholder while keeping it user-unconfigured',async()=>{
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=async url=>{calls++;const benchmark=String(url).includes('%5EN225');return new Response(JSON.stringify(benchmark?yahoo('N225',.1):yahoo('285A.T',.25)),{status:200,headers:{'content-type':'application/json'}})};
  try{
    const e=env();const r=await mutatePlans(e,{action:'sync_vantage',items:[watch('285A.T','C')]});
    assert.equal(r.auto_analysis.updated,1);assert.equal(r.auto_analysis.failed,0);
    assert.notEqual(r.statuses['285A.T'].status,'UNSET');assert.equal(r.statuses['285A.T'].template,'pullback_complete');
    const p=(await getPlans(e)).plans[0];assert.equal(p.linked_to_vantage,true);assert.equal(p.plan_configured,false);assert.ok(p.auto_analyzed_at);assert.ok(p.diagnosis);assert.ok(p.entries);
    const firstCalls=calls;await mutatePlans(e,{action:'sync_vantage',items:[watch('285A.T','C')]});assert.equal(calls,firstCalls);
    const changed=await mutatePlans(e,{action:'sync_vantage',items:[watch('285A.T','C','2026-07-19')]});assert.equal(changed.auto_analysis.updated,1);assert.ok(calls>firstCalls);
  }finally{globalThis.fetch=old}
});

test('sync can create an unconfigured placeholder without auto analysis',async()=>{
  const e=env();const r=await mutatePlans(e,{action:'sync_vantage',auto_analyze:false,items:[watch('285A.T','C')]});
  assert.equal(r.statuses['285A.T'].status,'UNSET');assert.equal(r.statuses['285A.T'].template,'pullback_complete');
  const p=(await getPlans(e)).plans[0];assert.equal(p.linked_to_vantage,true);assert.equal(p.plan_configured,false);
});

test('saved plan keeps link and survives VANTAGE removal as detached history',async()=>{
  const e=env();await mutatePlans(e,{action:'sync_vantage',auto_analyze:false,items:[watch('7203.T','A')]});
  await mutatePlans(e,{action:'save',market:'jp',symbol:'7203.T',name:'トヨタ',entry_status:'READY',diagnosis:'準備中',entries:{standard:{price:1}},source_context:{source:'VANTAGE',market:'jp',symbol:'7203.T',name:'トヨタ',lane:'A'}});
  let p=(await getPlans(e)).plans[0];assert.equal(p.linked_to_vantage,true);assert.equal(p.plan_configured,true);assert.equal(p.entry_status,'READY');
  await mutatePlans(e,{action:'sync_vantage',auto_analyze:false,items:[]});p=(await getPlans(e)).plans[0];assert.equal(p.linked_to_vantage,false);assert.equal(p.vantage_link_state,'detached');assert.equal(p.entry_status,'READY');
});

test('auto-analyzed but unconfigured placeholder is removed with VANTAGE watch',async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('%5EN225')?yahoo('N225',.1):yahoo('8306.T',.25)),{status:200,headers:{'content-type':'application/json'}});
  try{
    const e=env();await mutatePlans(e,{action:'sync_vantage',items:[watch('8306.T','B')]});await mutatePlans(e,{action:'sync_vantage',auto_analyze:false,items:[]});
    assert.equal((await getPlans(e)).plans.length,0);
  }finally{globalThis.fetch=old}
});

test('manual VANTAGE watch stays template-unconfigured when auto analysis is disabled',async()=>{
  const e=env();const item={...watch('9984.T','A'),source:'manual'};const r=await mutatePlans(e,{action:'sync_vantage',auto_analyze:false,items:[item]});
  assert.equal(r.statuses['9984.T'].template,'unset');assert.equal(r.statuses['9984.T'].status,'UNSET');
});
