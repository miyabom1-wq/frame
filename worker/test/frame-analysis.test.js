import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFrame } from '../src/engine/frame-analysis.js';

function series(n=520,start=100,step=.18){
  const out=[];let p=start,day=0;
  while(out.length<n){
    const d=new Date(Date.UTC(2024,0,1+day++));
    if(d.getUTCDay()===0||d.getUTCDay()===6)continue;
    const i=out.length;p+=step+Math.sin(i/12)*.08;
    out.push({date:d.toISOString().slice(0,10),open:p-.4,high:p+.8,low:p-.9,close:p,volume:1000000+(i%20)*25000});
  }
  return out;
}
test('analyzes multi-timeframe structure',()=>{
  const rows=series(),bench=series(520,100,.08);
  const d=analyzeFrame({symbol:'TEST',name:'Test',market:'us',rows,benchmarkSymbol:'^SOX',benchmarkRows:bench,meta:{currency:'USD'}});
  assert.equal(d.ok,true);
  assert.equal(d.frames.daily.timeframe,'日足');
  assert.equal(d.frames.weekly.timeframe,'週足');
  assert.equal(d.frames.monthly.timeframe,'月足');
  assert.ok(['WAIT','READY','TRIGGERED','INVALID'].includes(d.status));
  assert.ok(d.chart.length<=120);
  assert.ok(Number.isFinite(d.frames.daily.rsi14));
});

test('rejects insufficient history',()=>{
  assert.throws(()=>analyzeFrame({symbol:'X',rows:series(20),benchmarkRows:series(20)}),/不足/);
});
