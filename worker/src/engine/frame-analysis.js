import { smaSeries, emaSeries } from '../indicators/moving-averages.js';
import { rsiWilder, atrWilder } from '../indicators/wilder.js';
import { finite, pct, round } from '../utils.js';

function aggregate(rows,mode){
  if(mode==='daily')return rows.slice();
  const map=new Map();
  for(const r of rows){
    const d=new Date(`${r.date}T00:00:00Z`);
    let key;
    if(mode==='weekly'){
      const day=(d.getUTCDay()+6)%7;
      const monday=new Date(d);monday.setUTCDate(d.getUTCDate()-day);
      key=monday.toISOString().slice(0,10);
    }else key=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
    const x=map.get(key);
    if(!x)map.set(key,{date:r.date,open:r.open,high:r.high,low:r.low,close:r.close,volume:r.volume});
    else{x.date=r.date;x.high=Math.max(x.high,r.high);x.low=Math.min(x.low,r.low);x.close=r.close;x.volume+=r.volume;}
  }
  return[...map.values()];
}

function prepare(rows){
  const close=rows.map(r=>Number(r.close));
  return{
    rows,close,
    sma5:smaSeries(close,5),sma10:smaSeries(close,10),sma25:smaSeries(close,25),
    sma50:smaSeries(close,50),sma200:smaSeries(close,200),
    ema21:emaSeries(close,21),ema65:emaSeries(close,65),
    rsi14:rsiWilder(close,14),atr14:atrWilder(rows,14)
  };
}

function trend(p,timeframe){
  const i=p.rows.length-1,row=p.rows[i],c=row?.close,m10=p.sma10[i],m25=p.sma25[i],m50=p.sma50[i],m200=p.sma200[i],e65=p.ema65[i];
  const slope=(series,lookback=5)=>finite(series[i])&&finite(series[i-lookback])?Number(series[i])-Number(series[i-lookback]):null;
  const s10=slope(p.sma10,3),s25=slope(p.sma25),s50=slope(p.sma50),s200=slope(p.sma200,10);
  let fast=m50,slow=m200,fastSlope=s50,slowSlope=s200;
  if(timeframe==='週足'){fast=m25;slow=m50;fastSlope=s25;slowSlope=s50;}
  if(timeframe==='月足'){fast=m10;slow=m25;fastSlope=s10;slowSlope=s25;}
  let code='MIXED',label='方向感なし',score=0;
  if([c,fast,slow].every(finite)&&c>fast&&fast>slow&&fastSlope>=0&&slowSlope>=0){code='UP';label='上昇トレンド';score=2;}
  else if([c,fast,slow].every(finite)&&c<fast&&fast<slow&&fastSlope<=0&&slowSlope<=0){code='DOWN';label='下降トレンド';score=-2;}
  else if(finite(slow)&&c>=slow&&slowSlope>=0){code='BASE';label='基盤形成';score=1;}
  else if(finite(slow)&&c<slow){code='BROKEN';label='長期線割れ';score=-1;}
  const above={sma25:finite(m25)?c>m25:null,sma50:finite(m50)?c>m50:null,sma200:finite(m200)?c>m200:null,ema65:finite(e65)?c>e65:null};
  return{code,label,score,above,slopes:{sma10:round(s10,4),sma25:round(s25,4),sma50:round(s50,4),sma200:round(s200,4)}};
}

function rangeStats(rows,i,period){
  const prior=rows.slice(Math.max(0,i-period),i);
  return{
    high:prior.length?Math.max(...prior.map(x=>x.high)):null,
    low:prior.length?Math.min(...prior.map(x=>x.low)):null
  };
}

function frameSummary(rows,label){
  const p=prepare(rows),i=rows.length-1,row=rows[i]||{},t=trend(p,label),atr=p.atr14[i],rsi=p.rsi14[i];
  const r5=rangeStats(rows,i,5),r10=rangeStats(rows,i,10),r20=rangeStats(rows,i,20);
  return{
    timeframe:label,date:row.date||null,close:round(row.close,4),change_pct:i>0?round(pct(row.close,rows[i-1].close)):null,
    trend:t,rsi14:round(rsi,2),atr14:round(atr,4),atr_pct:finite(atr)&&finite(row.close)?round(atr/row.close*100,2):null,
    sma5:round(p.sma5[i],4),sma25:round(p.sma25[i],4),sma50:round(p.sma50[i],4),sma200:round(p.sma200[i],4),
    ema21:round(p.ema21[i],4),ema65:round(p.ema65[i],4),
    high5:round(r5.high,4),low5:round(r5.low,4),high10:round(r10.high,4),low10:round(r10.low,4),
    high20:round(r20.high,4),low20:round(r20.low,4),
    distance_high20:finite(r20.high)?round(pct(row.close,r20.high)):null,distance_low20:finite(r20.low)?round(pct(row.close,r20.low)):null
  };
}

function volumeMetrics(rows){
  const i=rows.length-1,current=rows[i]?.volume,base=rows.slice(Math.max(0,i-20),i).map(x=>x.volume).filter(finite);
  const avg=base.length?base.reduce((a,b)=>a+b,0)/base.length:null;
  return{volume:round(current,0),avg20:round(avg,0),ratio:finite(avg)&&avg>0?round(current/avg,2):null};
}

function relativeStrength(rows,benchmarkRows){
  const byDate=new Map(benchmarkRows.map(x=>[x.date,x.close]));
  const aligned=rows.filter(x=>finite(byDate.get(x.date)));
  const calc=period=>{
    if(aligned.length<period+1)return{stock:null,benchmark:null,relative:null};
    const end=aligned.at(-1),start=aligned.at(-(period+1));
    const stock=pct(end.close,start.close),benchmark=pct(byDate.get(end.date),byDate.get(start.date));
    return{stock:round(stock),benchmark:round(benchmark),relative:round(stock-benchmark)};
  };
  const d5=calc(5),d20=calc(20),d60=calc(60);
  return{
    ret5:d5.stock,benchmark_ret5:d5.benchmark,rs5:d5.relative,
    ret20:d20.stock,benchmark_ret20:d20.benchmark,rs20:d20.relative,
    ret60:d60.stock,benchmark_ret60:d60.benchmark,rs60:d60.relative
  };
}

function entryChecklist({daily,weekly,monthly,volume,rs}){
  const c=daily.close;
  return[
    {key:'monthly',label:'月足が下降ではない',pass:monthly.trend.score>=0,actual:monthly.trend.label},
    {key:'weekly',label:'週足が上向き',pass:weekly.trend.score>0,actual:weekly.trend.label},
    {key:'daily',label:'日足が上向き',pass:daily.trend.score>0,actual:daily.trend.label},
    {key:'ema65',label:'終値がEMA65より上',pass:finite(c)&&finite(daily.ema65)&&c>daily.ema65,actual:finite(daily.ema65)?round(pct(c,daily.ema65),1)+'%':'—'},
    {key:'high20',label:'20日高値から2.5%以内（追加条件）',pass:finite(daily.distance_high20)&&daily.distance_high20>=-2.5,actual:finite(daily.distance_high20)?daily.distance_high20+'%':'—'},
    {key:'volume',label:'出来高比1.2以上',pass:finite(volume.ratio)&&volume.ratio>=1.2,actual:finite(volume.ratio)?volume.ratio+'x':'—'},
    {key:'relative',label:'20日相対強度がプラス',pass:finite(rs.rs20)&&rs.rs20>0,actual:finite(rs.rs20)?rs.rs20+'%':'—'},
    {key:'rsi',label:'RSIが過熱域未満',pass:!finite(daily.rsi14)||daily.rsi14<75,actual:finite(daily.rsi14)?daily.rsi14:'—'}
  ];
}

function holdingState({daily,weekly,monthly,rs}){
  const reasons=[],risks=[];
  let status='HOLD',label='保有継続可';
  const structuralBreak=weekly.trend.score<0&&monthly.trend.score<0;
  const doubleDown=daily.trend.code==='DOWN'&&weekly.trend.score<0;
  if(structuralBreak||doubleDown){
    status='REVIEW';label='保有再評価';
    if(structuralBreak)risks.push('月足・週足がともに弱い');
    if(doubleDown)risks.push('日足・週足の下降が重なっている');
  }else if(weekly.trend.score<0||daily.trend.score<0||daily.trend.above.sma200===false){
    status='CAUTION';label='保有注意';
    if(weekly.trend.score<0)risks.push('週足が下降または移行局面');
    if(daily.trend.score<0)risks.push('日足が弱い');
    if(daily.trend.above.sma200===false)risks.push('200日線より下');
  }else{
    reasons.push('長期構造は維持','週足が非下降');
  }
  if(finite(rs.rs60)&&rs.rs60>0)reasons.push('60日相対強度はプラス');
  if(finite(rs.rs60)&&rs.rs60<0)risks.push('60日では指数に劣後');
  return{
    status,label,reasons,risks,
    rule:'新規エントリー条件と既存保有の継続条件を分離して判定',
    invalidation:'月足・週足の下降が重なる、または週足安値更新後も相対強度が回復しない場合は再評価'
  };
}

function nearestOverhead(current,values){
  const xs=values.filter(finite).map(Number);
  if(!xs.length)return null;
  const above=xs.filter(x=>x>Number(current)*1.001).sort((a,b)=>a-b);
  return above.length?above[0]:Math.max(...xs);
}

function stageState({price,current,readyPct,triggered,invalid}){
  if(invalid)return'INVALID';
  if(triggered)return'TRIGGERED';
  if(!finite(price)||!finite(current))return'WAIT';
  const distance=pct(price,current);
  return finite(distance)&&distance<=readyPct?'READY':'WAIT';
}

function entryStages({daily,weekly,monthly,volume,rs}){
  const c=Number(daily.close),invalid=daily.trend.code==='DOWN'&&weekly.trend.score<0;
  const longStructure=monthly.trend.score>=0&&weekly.trend.score>=0;
  const rsTurning=finite(rs.rs5)&&(rs.rs5>0||!finite(rs.rs20)||rs.rs5>rs.rs20);
  const volumeOkay=!finite(volume.ratio)||volume.ratio>=.8;
  const probePrice=nearestOverhead(c,[daily.sma5,daily.ema21,daily.high5]);
  let standardPrice=nearestOverhead(c,[daily.ema65,daily.sma25,daily.high10]);
  if(finite(probePrice)&&finite(standardPrice)&&standardPrice<probePrice)standardPrice=probePrice;
  let addPrice=finite(daily.high20)?Number(daily.high20):null;
  if(finite(standardPrice)&&finite(addPrice)&&addPrice<standardPrice)addPrice=standardPrice;

  const probeTriggered=longStructure&&finite(probePrice)&&c>=probePrice&&rsTurning&&daily.rsi14<70;
  const standardTriggered=weekly.trend.score>0&&finite(standardPrice)&&c>=standardPrice&&rsTurning&&volumeOkay&&daily.rsi14<75;
  const addTriggered=weekly.trend.score>0&&daily.trend.score>0&&finite(addPrice)&&c>=addPrice&&finite(volume.ratio)&&volume.ratio>=1.2&&finite(rs.rs20)&&rs.rs20>0;

  const probeStop=[daily.low5,daily.low10].filter(finite);
  const standardStop=[daily.low10,daily.low20,daily.sma50].filter(x=>finite(x)&&x<c);
  const addStop=[daily.low10,daily.ema21,daily.sma25].filter(x=>finite(x)&&x<c);

  const probe={
    key:'probe',label:'打診',price:round(probePrice,4),
    state:stageState({price:probePrice,current:c,readyPct:4,triggered:probeTriggered,invalid}),
    size:'予定サイズの1/3以下',
    rule:'終値で5日線・EMA21・短期戻り高値のうち最初の水準を回復し、5日相対強度の改善を確認',
    stop:{price:round(probeStop.length?Math.max(...probeStop):daily.low10,4),rule:'直近5〜10日安値を終値で割れたら打診を撤回'}
  };
  const standard={
    key:'standard',label:'標準',price:round(standardPrice,4),
    state:stageState({price:standardPrice,current:c,readyPct:7,triggered:standardTriggered,invalid}),
    size:'中心ポジション',
    rule:'EMA65・25日線・10日戻り高値のうち次の主要水準を終値で回復し、短期相対強度と出来高の改善を確認',
    stop:{price:round(standardStop.length?Math.max(...standardStop):daily.low20,4),rule:'10〜20日安値または50日線を終値で明確に割れたら再評価'}
  };
  const add={
    key:'add',label:'追加',price:round(addPrice,4),
    state:stageState({price:addPrice,current:c,readyPct:2.5,triggered:addTriggered,invalid}),
    size:'モメンタム確認後の追加',
    rule:'20日高値を終値で突破し、出来高比1.2以上・20日相対強度プラスを確認',
    stop:{price:round(addStop.length?Math.max(...addStop):daily.low10,4),rule:'突破後に10日安値または短期線を終値で割れたら追加分を再評価'}
  };
  return{probe,standard,add};
}

function setupState({daily,weekly,monthly,volume,rs}){
  const checklist=entryChecklist({daily,weekly,monthly,volume,rs});
  const entries=entryStages({daily,weekly,monthly,volume,rs});
  const reasons=[],risks=[];let status='WAIT';
  const invalid=entries.standard.state==='INVALID';
  if(invalid){
    status='INVALID';risks.push('日足・週足がともに下降');
  }else if(entries.add.state==='TRIGGERED'||entries.standard.state==='TRIGGERED'){
    status='TRIGGERED';
    if(entries.standard.state==='TRIGGERED')reasons.push('標準エントリー条件が成立');
    if(entries.add.state==='TRIGGERED')reasons.push('高値突破の追加条件が成立');
  }else if(['READY','TRIGGERED'].includes(entries.probe.state)||entries.standard.state==='READY'||entries.add.state==='READY'){
    status='READY';
    if(entries.probe.state==='TRIGGERED')reasons.push('打診条件が成立');
    else if(entries.probe.state==='READY')reasons.push('打診水準へ接近');
    if(entries.standard.state==='READY')reasons.push('標準エントリー水準へ接近');
    if(entries.add.state==='READY')reasons.push('追加ブレイク水準へ接近');
  }else{
    reasons.push('条件待ち');
  }
  if(weekly.trend.score<0)risks.push('週足が下降または移行局面');
  if(finite(rs.rs20)&&rs.rs20<0)risks.push('20日では指数に劣後');
  if(finite(volume.ratio)&&volume.ratio<1)risks.push('出来高の裏付けが弱い');
  const standardStop=entries.standard.stop;
  return{
    status,reasons,risks,checklist,entries,
    progress:{passed:checklist.filter(x=>x.pass).length,total:checklist.length},
    entry:entries.standard,
    stop:standardStop,
    add_rule:entries.add.rule,
    invalidation:'週足安値更新、または日足・週足がともに下降トレンドへ移行'
  };
}

function chartRows(rows){return rows.slice(-120).map(r=>({date:r.date,close:round(r.close,4),volume:round(r.volume,0)}));}

export function analyzeFrame({symbol,name,market,rows,benchmarkSymbol,benchmarkRows,meta}){
  if(!rows||rows.length<60)throw new Error('分析に必要な価格履歴が不足しています');
  const daily=frameSummary(aggregate(rows,'daily'),'日足');
  const weekly=frameSummary(aggregate(rows,'weekly'),'週足');
  const monthly=frameSummary(aggregate(rows,'monthly'),'月足');
  const volume=volumeMetrics(rows),rs=relativeStrength(rows,benchmarkRows||[]);
  const setup=setupState({daily,weekly,monthly,volume,rs});
  const holding=holdingState({daily,weekly,monthly,rs});
  const score=monthly.trend.score*2+weekly.trend.score*3+daily.trend.score*2+(finite(rs.rs20)?Math.max(-2,Math.min(2,rs.rs20/5)):0);
  const diagnosis=score>=8?'長期上昇・押し目候補':score>=3?'上昇優位・条件待ち':score>-3?'移行・レンジ':score>-8?'下降優位・反転待ち':'下降トレンド';
  return{
    ok:true,symbol,name:name||meta?.symbol||symbol,market,currency:meta?.currency||null,exchange:meta?.exchange||null,
    benchmark:benchmarkSymbol,updated_at:new Date().toISOString(),diagnosis,score:round(score,1),status:setup.status,
    entry_status:setup.status,holding_status:holding.status,holding,
    frames:{monthly,weekly,daily},volume,relative_strength:rs,setup,chart:chartRows(rows),
    methodology:'月足・週足・日足、EMA21/65、25/50/200日線、RSI14、ATR14、5/20/60日相対強度、20日出来高比を統合。打診・標準・追加を分け、最高値突破だけを初回エントリー条件にはしません。'
  };
}
