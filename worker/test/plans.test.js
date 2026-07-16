import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlans, mutatePlans } from '../src/services/plans.js';
function env(){const m=new Map();return{FRAME_KV:{get:async k=>m.get(k)||null,put:async(k,v)=>m.set(k,v)}}}
test('save and delete plan',async()=>{const e=env();let r=await mutatePlans(e,{action:'save',market:'jp',symbol:'285A',name:'Test',status:'WAIT'});assert.equal(r.item.symbol,'285A.T');assert.equal((await getPlans(e)).plans.length,1);await mutatePlans(e,{action:'delete',id:r.item.id});assert.equal((await getPlans(e)).plans.length,0)});
