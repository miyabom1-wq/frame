import test from 'node:test';
import assert from 'node:assert/strict';
import { route } from '../src/api/routes.js';

function yahoo(symbol='TEST',step=.2){
  const timestamp=[],open=[],high=[],low=[],close=[],volume=[];let p=100,day=0;
  while(close.length<520){
    const d=new Date(Date.UTC(2024,0,1+day++));if([0,6].includes(d.getUTCDay()))continue;
    p+=step;timestamp.push(Math.floor(d.getTime()/1000));open.push(p-.2);high.push(p+.6);low.push(p-.7);close.push(p);volume.push(1_000_000+close.length*1000);
  }
  return{chart:{result:[{meta:{symbol,longName:`${symbol} Name`,currency:'USD',exchangeName:'NMS',regularMarketPrice:p},timestamp,indicators:{quote:[{open,high,low,close,volume}],adjclose:[{adjclose:close}]},events:{}}],error:null}};
}

test('health route',async()=>{const r=await route(new Request('https://x/api/health'),{});assert.equal(r.status,200);const d=await r.json();assert.equal(d.app,'FRAME')});

test('analyze route integrates fetch normalization and engine',async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('%5ESOX')?yahoo('SOX',.1):yahoo('MU',.25)),{status:200,headers:{'content-type':'application/json'}});
  try{
    const r=await route(new Request('https://x/api/analyze?market=us&symbol=MU'),{});assert.equal(r.status,200);
    const d=await r.json();assert.equal(d.ok,true);assert.equal(d.symbol,'MU');assert.equal(d.benchmark,'^SOX');assert.ok(d.frames.daily);assert.ok(d.setup.entry);assert.ok(d.holding);assert.equal(d.setup.checklist.length,8);
  }finally{globalThis.fetch=old}
});
