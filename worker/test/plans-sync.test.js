import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlans, mutatePlans } from '../src/services/plans.js';

function env(){
  const map=new Map();
  return{FRAME_KV:{async get(k){return map.get(k)||null},async put(k,v){map.set(k,v)}}};
}
const watch=(symbol,lane='C')=>({watch_id:'w1',symbol,market:'jp',name:'テスト',lane,source:'candidate',memo:'登録理由',source_context:{source:'VANTAGE',market:'jp',symbol,name:'テスト',lane,lane_label:'候補'}});

test('sync creates an unconfigured linked placeholder',async()=>{
  const e=env();const r=await mutatePlans(e,{action:'sync_vantage',items:[watch('285A.T','C')]});
  assert.equal(r.statuses['285A.T'].status,'UNSET');
  assert.equal(r.statuses['285A.T'].template,'pullback_complete');
  const p=(await getPlans(e)).plans[0];assert.equal(p.linked_to_vantage,true);assert.equal(p.plan_configured,false);
});

test('saved plan keeps link and survives VANTAGE removal as detached history',async()=>{
  const e=env();await mutatePlans(e,{action:'sync_vantage',items:[watch('7203.T','A')]});
  await mutatePlans(e,{action:'save',market:'jp',symbol:'7203.T',name:'トヨタ',entry_status:'READY',diagnosis:'準備中',entries:{standard:{price:1}},source_context:{source:'VANTAGE',market:'jp',symbol:'7203.T',name:'トヨタ',lane:'A'}});
  let p=(await getPlans(e)).plans[0];assert.equal(p.linked_to_vantage,true);assert.equal(p.plan_configured,true);assert.equal(p.entry_status,'READY');
  await mutatePlans(e,{action:'sync_vantage',items:[]});p=(await getPlans(e)).plans[0];assert.equal(p.linked_to_vantage,false);assert.equal(p.vantage_link_state,'detached');assert.equal(p.entry_status,'READY');
});

test('unconfigured placeholder is removed when VANTAGE watch is removed',async()=>{
  const e=env();await mutatePlans(e,{action:'sync_vantage',items:[watch('8306.T','B')]});await mutatePlans(e,{action:'sync_vantage',items:[]});
  assert.equal((await getPlans(e)).plans.length,0);
});

test('manual VANTAGE watch stays unconfigured even when current lane is A',async()=>{
  const e=env();const item={...watch('9984.T','A'),source:'manual'};const r=await mutatePlans(e,{action:'sync_vantage',items:[item]});
  assert.equal(r.statuses['9984.T'].template,'unset');assert.equal(r.statuses['9984.T'].status,'UNSET');
});
