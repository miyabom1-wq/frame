import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlans, mutatePlans } from '../src/services/plans.js';
function env(){const m=new Map();return{FRAME_KV:{get:async k=>m.get(k)||null,put:async(k,v)=>m.set(k,v)}}}

test('save, update memo and delete plan',async()=>{
  const e=env();
  let r=await mutatePlans(e,{action:'save',market:'jp',symbol:'285A',name:'Test',mode:'hold',entry_status:'WAIT',holding_status:'HOLD',phase:{code:'REPAIR',label:'修復中'},source_context:{source:'VANTAGE',market:'jp',symbol:'285A',theme:'メモリ・ストレージ',theme_phase:'修復',propagation:'米国先行・日本未追随',lane:'B',rs5:2.5},checklist:[{key:'weekly',pass:true}]});
  assert.equal(r.item.symbol,'285A.T');
  assert.equal(r.item.mode,'hold');
  assert.equal(r.item.holding_status,'HOLD');
  assert.equal(r.item.phase.code,'REPAIR');
  assert.equal(r.item.source_context.theme,'メモリ・ストレージ');
  assert.equal(r.item.source_context.lane,'B');
  assert.equal(r.item.source_context.rs5,2.5);
  assert.equal((await getPlans(e)).plans.length,1);
  await mutatePlans(e,{action:'memo',id:r.item.id,memo:'長期枠',mode:'pullback'});
  const updated=(await getPlans(e)).plans[0];
  assert.equal(updated.memo,'長期枠');
  assert.equal(updated.mode,'pullback');
  await mutatePlans(e,{action:'delete',id:r.item.id});
  assert.equal((await getPlans(e)).plans.length,0);
});
