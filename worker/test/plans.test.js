import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlans, mutatePlans } from '../src/services/plans.js';
function env(){const m=new Map();return{FRAME_KV:{get:async k=>m.get(k)||null,put:async(k,v)=>m.set(k,v)}}}

test('save, update memo and delete plan',async()=>{
  const e=env();
  let r=await mutatePlans(e,{action:'save',market:'jp',symbol:'285A',name:'Test',mode:'hold',entry_status:'WAIT',holding_status:'HOLD',checklist:[{key:'weekly',pass:true}]});
  assert.equal(r.item.symbol,'285A.T');
  assert.equal(r.item.mode,'hold');
  assert.equal(r.item.holding_status,'HOLD');
  assert.equal((await getPlans(e)).plans.length,1);
  await mutatePlans(e,{action:'memo',id:r.item.id,memo:'長期枠',mode:'pullback'});
  const updated=(await getPlans(e)).plans[0];
  assert.equal(updated.memo,'長期枠');
  assert.equal(updated.mode,'pullback');
  await mutatePlans(e,{action:'delete',id:r.item.id});
  assert.equal((await getPlans(e)).plans.length,0);
});
