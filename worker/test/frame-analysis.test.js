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

function damagedSeries(){
  const out=series(520,100,.35).map(x=>({...x}));
  let p=out.at(-19).close;
  for(let i=out.length-18;i<out.length;i++){
    p*=i<out.length-5?.982:1.004;
    const j=i-(out.length-18);
    out[i]={...out[i],open:p*1.006,high:p*1.015,low:p*.982,close:p,volume:1500000+j*35000};
  }
  return out;
}

function fallingSeries(){
  return series(520,300,-.22).map((x,i)=>({...x,volume:1200000+(i%12)*40000}));
}

test('analyzes entry, holding and phase separately',()=>{
  const rows=series(),bench=series(520,100,.08);
  const d=analyzeFrame({symbol:'TEST',name:'Test',market:'us',rows,benchmarkSymbol:'^SOX',benchmarkRows:bench,meta:{currency:'USD'}});
  assert.equal(d.ok,true);
  assert.equal(d.frames.daily.timeframe,'日足');
  assert.equal(d.frames.weekly.timeframe,'週足');
  assert.equal(d.frames.monthly.timeframe,'月足');
  assert.ok(['WAIT','READY','TRIGGERED','INVALID'].includes(d.entry_status));
  assert.ok(['HOLD','CAUTION','REVIEW'].includes(d.holding_status));
  assert.ok(['MOMENTUM_START','ADVANCE','PULLBACK','BASE','DISTRIBUTION','REPAIR','BREAKDOWN','TRANSITION'].includes(d.phase.code));
  assert.equal(d.setup.checklist.length,8);
  assert.equal(d.setup.progress.total,8);
  assert.ok('drawdown60' in d.phase.metrics);
  assert.ok('distribution_days' in d.phase.metrics);
  assert.ok('rs5' in d.relative_strength);
  assert.ok('rs60' in d.relative_strength);
  assert.ok(d.chart.length<=120);
  assert.ok(Number.isFinite(d.frames.daily.rsi14));
});

test('separates probe, standard and add levels',()=>{
  const rows=series(),bench=series(520,100,.08);
  const d=analyzeFrame({symbol:'TEST',name:'Test',market:'us',rows,benchmarkSymbol:'^SOX',benchmarkRows:bench,meta:{currency:'USD'}});
  const e=d.setup.entries;
  assert.ok(e.probe&&e.standard&&e.add);
  assert.equal(e.probe.label,'打診');
  assert.equal(e.standard.label,'標準');
  assert.equal(e.add.label,'追加');
  assert.ok(['WAIT','READY','TRIGGERED','INVALID'].includes(e.probe.state));
  assert.ok(['WAIT','READY','TRIGGERED','INVALID'].includes(e.standard.state));
  assert.ok(['WAIT','READY','TRIGGERED','INVALID'].includes(e.add.state));
  assert.equal(d.setup.entry.price,e.standard.price);
  if(Number.isFinite(e.standard.price)&&Number.isFinite(e.add.price))assert.ok(e.add.price>=e.standard.price);
});

test('classifies a damaged long-term uptrend as repair and holding caution',()=>{
  const rows=damagedSeries(),bench=series(520,100,.1);
  const d=analyzeFrame({symbol:'DAMAGE',name:'Damage',market:'us',rows,benchmarkSymbol:'^SOX',benchmarkRows:bench});
  assert.equal(d.phase.code,'REPAIR');
  assert.equal(d.holding_status,'CAUTION');
  assert.ok(d.phase.metrics.drawdown60<=-15);
});

test('classifies multi-timeframe decline as breakdown and review',()=>{
  const rows=fallingSeries(),bench=series(520,100,.05);
  const d=analyzeFrame({symbol:'DOWN',name:'Down',market:'us',rows,benchmarkSymbol:'^SOX',benchmarkRows:bench});
  assert.equal(d.phase.code,'BREAKDOWN');
  assert.equal(d.holding_status,'REVIEW');
  assert.equal(d.entry_status,'INVALID');
});

test('rejects insufficient history',()=>{
  assert.throws(()=>analyzeFrame({symbol:'X',rows:series(20),benchmarkRows:series(20)}),/不足/);
});
