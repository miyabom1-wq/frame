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

function priceActionMetrics(rows){
  const recent=rows.slice(-120),current=recent.at(-1)||{},c=Number(current.close);
  const window=period=>recent.slice(-Math.min(period,recent.length));
  const highLow=period=>{
    const xs=window(period);
    return{high:xs.length?Math.max(...xs.map(x=>Number(x.high))):null,low:xs.length?Math.min(...xs.map(x=>Number(x.low))):null};
  };
  const r20=highLow(20),r60=highLow(60),r120=highLow(120);
  const avgVolRows=window(20).map(x=>Number(x.volume)).filter(finite);
  const avgVol=avgVolRows.length?avgVolRows.reduce((a,b)=>a+b,0)/avgVolRows.length:null;
  let distributionDays=0,accumulationDays=0;
  const upVolumes=[],downVolumes=[];
  const xs=window(21);
  for(let i=1;i<xs.length;i++){
    const ch=pct(xs[i].close,xs[i-1].close),vol=Number(xs[i].volume);
    if(ch>0)upVolumes.push(vol);if(ch<0)downVolumes.push(vol);
    if(finite(avgVol)&&ch<=-1&&vol>=avgVol*1.05)distributionDays++;
    if(finite(avgVol)&&ch>=1&&vol>=avgVol*1.05)accumulationDays++;
  }
  const avg=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:null;
  const upAvg=avg(upVolumes),downAvg=avg(downVolumes);
  const last10=window(10),prior5=last10.slice(0,5),last5=last10.slice(-5);
  const priorLow=prior5.length?Math.min(...prior5.map(x=>Number(x.low))):null;
  const currentLow=last5.length?Math.min(...last5.map(x=>Number(x.low))):null;
  const high60Index=finite(r60.high)?recent.map(x=>Number(x.high)).lastIndexOf(r60.high):-1;
  const daysFromHigh60=high60Index>=0?recent.length-1-high60Index:null;
  const rangePct=(r,base)=>finite(r.high)&&finite(r.low)&&finite(base)&&base!==0?(r.high-r.low)/base*100:null;
  const range20=rangePct(r20,c),range60=rangePct(r60,c);
  return{
    high20:round(r20.high,4),low20:round(r20.low,4),high60:round(r60.high,4),low60:round(r60.low,4),high120:round(r120.high,4),low120:round(r120.low,4),
    drawdown20:finite(r20.high)?round(pct(c,r20.high)):null,
    drawdown60:finite(r60.high)?round(pct(c,r60.high)):null,
    drawdown120:finite(r120.high)?round(pct(c,r120.high)):null,
    rebound20:finite(r20.low)?round(pct(c,r20.low)):null,
    range20_pct:round(range20,2),range60_pct:round(range60,2),
    compression:finite(range20)&&finite(range60)&&range60>0?round(range20/range60,2):null,
    distribution_days:distributionDays,accumulation_days:accumulationDays,
    down_up_volume_ratio:finite(downAvg)&&finite(upAvg)&&upAvg>0?round(downAvg/upAvg,2):null,
    higher_low:finite(currentLow)&&finite(priorLow)?currentLow>priorLow:null,
    days_from_high60:daysFromHigh60
  };
}

function classifyPhase({daily,weekly,monthly,volume,rs,priceAction}){
  const c=Number(daily.close),longStructure=monthly.trend.score>=0&&weekly.trend.code!=='DOWN';
  const belowEma65=finite(daily.ema65)&&c<daily.ema65;
  const belowEma21=finite(daily.ema21)&&c<daily.ema21;
  const below25=finite(daily.sma25)&&c<daily.sma25;
  const severeDamage=finite(priceAction.drawdown60)&&priceAction.drawdown60<=-20;
  const mediumDamage=finite(priceAction.drawdown60)&&priceAction.drawdown60<=-10;
  const rsDamaged=finite(rs.rs20)&&rs.rs20<=-8;
  const rsTurning=finite(rs.rs5)&&((rs.rs5>0)||(!finite(rs.rs20)||rs.rs5>=rs.rs20+3));
  const breakout=weekly.trend.score>0&&daily.trend.score>0&&finite(daily.high20)&&c>=daily.high20&&finite(volume.ratio)&&volume.ratio>=1.2&&finite(rs.rs20)&&rs.rs20>0;
  const compressed=finite(priceAction.compression)&&priceAction.compression<=.62;
  const distribution=longStructure&&!severeDamage&&mediumDamage&&belowEma21&&below25&&priceAction.distribution_days>=3&&finite(rs.rs5)&&rs.rs5<0&&finite(rs.rs20)&&rs.rs20<0;
  const breakdown=(weekly.trend.code==='DOWN'&&daily.trend.code==='DOWN')||(monthly.trend.score<0&&weekly.trend.code==='DOWN')||(daily.trend.above.sma200===false&&weekly.trend.code==='DOWN'&&mediumDamage);
  const repair=longStructure&&!breakdown&&(severeDamage||(mediumDamage&&(belowEma65||rsDamaged)));
  const pullback=longStructure&&!repair&&!distribution&&finite(priceAction.drawdown60)&&priceAction.drawdown60<=-3&&priceAction.drawdown60>-18&&daily.trend.above.sma200!==false&&(!finite(rs.rs20)||rs.rs20>-7)&&priceAction.distribution_days<=2;
  const base=longStructure&&!repair&&!distribution&&compressed&&['BASE','MIXED'].includes(daily.trend.code)&&priceAction.distribution_days<=2;
  const advance=weekly.trend.score>0&&daily.trend.score>0&&daily.trend.above.ema65!==false&&(!finite(rs.rs20)||rs.rs20>=0)&&(!finite(priceAction.drawdown60)||priceAction.drawdown60>-10);

  let code='TRANSITION',label='移行・判定待ち',summary='上昇・押し目・修復のいずれも確定していません。',confidence=55;
  const reasons=[],risks=[];
  if(breakdown){
    code='BREAKDOWN';label='崩壊・下降';summary='複数時間軸で構造が弱く、新規モメンタムより下落継続を警戒する局面です。';confidence=90;
    reasons.push('日足・週足または月足・週足の下降が重なる');
  }else if(breakout&&(compressed||priceAction.days_from_high60>=15)){
    code='MOMENTUM_START';label='モメンタム初動';summary='ベースまたは調整を抜け、出来高と相対強度を伴う初動が確認されています。';confidence=88;
    reasons.push('20日高値を突破','出来高比1.2以上','20日相対強度がプラス');
    if(compressed)reasons.push('直前の値幅が収縮');
  }else if(distribution){
    code='DISTRIBUTION';label='分配警戒';summary='長期上昇は残る一方、高値圏から売り圧力と相対強度悪化が重なっています。';confidence=82;
    reasons.push('下落日に出来高が増加','短中期の相対強度が悪化','短期線を下回る');
  }else if(repair){
    code='REPAIR';label='修復中';summary='長期構造は残りますが、通常の押し目を超える損傷があり、反転確認を積み上げる局面です。';confidence=84;
    reasons.push('月足・週足の長期構造は残る');
    if(severeDamage)risks.push('60日高値から20%以上下落');
    if(belowEma65)risks.push('EMA65を下回る');
    if(rsDamaged)risks.push('20日相対強度が大幅マイナス');
    if(rsTurning)reasons.push('5日相対強度は改善方向');
  }else if(pullback){
    code='PULLBACK';label='健全な押し目';summary='週足上昇を維持し、損傷と売り圧力が限定された調整です。';confidence=80;
    reasons.push('月足・週足の構造を維持','60日高値からの調整が許容範囲','分配日が少ない');
    if(priceAction.higher_low)reasons.push('短期安値を切り上げ');
  }else if(base){
    code='BASE';label='ベース形成';summary='値幅が収縮し、次の方向を決めるための土台を作っている局面です。';confidence=76;
    reasons.push('20日値幅が60日値幅に対して収縮','日足は基盤形成または方向感なし');
    if(priceAction.higher_low)reasons.push('短期安値を切り上げ');
  }else if(advance){
    code='ADVANCE';label='上昇継続';summary='日足・週足と相対強度が揃い、既存モメンタムが継続しています。';confidence=82;
    reasons.push('日足・週足が上昇','EMA65より上','20日相対強度が非マイナス');
  }

  if(finite(priceAction.drawdown60)&&priceAction.drawdown60<=-15&&!risks.some(x=>x.includes('60日高値')))risks.push(`60日高値から${round(priceAction.drawdown60,1)}%`);
  if(finite(rs.rs20)&&rs.rs20<0&&!risks.some(x=>x.includes('20日相対強度')))risks.push(`20日相対強度 ${round(rs.rs20,1)}%`);
  if(priceAction.distribution_days>=3&&code!=='DISTRIBUTION')risks.push(`直近20日で分配日 ${priceAction.distribution_days}日`);
  return{code,label,summary,confidence,reasons,risks,metrics:priceAction};
}

function entryChecklist({daily,weekly,monthly,volume,rs,phase}){
  const c=daily.close;
  return[
    {key:'monthly',label:'月足が下降ではない',pass:monthly.trend.score>=0,actual:monthly.trend.label},
    {key:'weekly',label:'週足が上向き',pass:weekly.trend.score>0,actual:weekly.trend.label},
    {key:'daily',label:'日足が上向き',pass:daily.trend.score>0,actual:daily.trend.label},
    {key:'ema65',label:'終値がEMA65より上',pass:finite(c)&&finite(daily.ema65)&&c>daily.ema65,actual:finite(daily.ema65)?round(pct(c,daily.ema65),1)+'%':'—'},
    {key:'phase',label:'局面が分配・崩壊ではない',pass:!['DISTRIBUTION','BREAKDOWN'].includes(phase.code),actual:phase.label},
    {key:'volume',label:'出来高比1.2以上',pass:finite(volume.ratio)&&volume.ratio>=1.2,actual:finite(volume.ratio)?volume.ratio+'x':'—'},
    {key:'relative',label:'20日相対強度がプラス',pass:finite(rs.rs20)&&rs.rs20>0,actual:finite(rs.rs20)?rs.rs20+'%':'—'},
    {key:'rsi',label:'RSIが過熱域未満',pass:!finite(daily.rsi14)||daily.rsi14<75,actual:finite(daily.rsi14)?daily.rsi14:'—'}
  ];
}

function holdingState({daily,weekly,monthly,rs,phase}){
  const reasons=[],risks=[];
  let status='HOLD',label='保有継続可';
  const structuralBreak=weekly.trend.score<0&&monthly.trend.score<0;
  const doubleDown=daily.trend.code==='DOWN'&&weekly.trend.score<0;
  const damage=phase.metrics||{};
  const severeRelative=finite(rs.rs20)&&rs.rs20<=-10;
  const largeDrawdown=finite(damage.drawdown60)&&damage.drawdown60<=-18;
  if(phase.code==='BREAKDOWN'||structuralBreak||doubleDown){
    status='REVIEW';label='保有再評価';
    if(phase.code==='BREAKDOWN')risks.push('局面判定が崩壊・下降');
    if(structuralBreak)risks.push('月足・週足がともに弱い');
    if(doubleDown)risks.push('日足・週足の下降が重なっている');
  }else if(['REPAIR','DISTRIBUTION'].includes(phase.code)||weekly.trend.score<0||daily.trend.score<0||daily.trend.above.sma200===false||largeDrawdown||severeRelative){
    status='CAUTION';label='保有注意';
    if(phase.code==='REPAIR')risks.push('通常の押し目ではなく修復局面');
    if(phase.code==='DISTRIBUTION')risks.push('高値圏の分配を警戒');
    if(weekly.trend.score<0)risks.push('週足が下降または移行局面');
    if(daily.trend.score<0)risks.push('日足が弱い');
    if(daily.trend.above.sma200===false)risks.push('200日線より下');
    if(largeDrawdown)risks.push(`60日高値から${round(damage.drawdown60,1)}%`);
    if(severeRelative)risks.push(`20日相対強度 ${round(rs.rs20,1)}%`);
  }else{
    reasons.push('長期構造は維持','週足が非下降');
    if(phase.code==='PULLBACK')reasons.push('健全な押し目の範囲');
    if(phase.code==='ADVANCE'||phase.code==='MOMENTUM_START')reasons.push('モメンタム局面を維持');
  }
  if(finite(rs.rs60)&&rs.rs60>0)reasons.push('60日相対強度はプラス');
  if(finite(rs.rs60)&&rs.rs60<0)risks.push('60日では指数に劣後');
  return{
    status,label,reasons:[...new Set(reasons)],risks:[...new Set(risks)],
    rule:'新規エントリー条件と既存保有を分離し、局面の損傷度も加えて判定',
    invalidation:'月足・週足の下降が重なる、崩壊局面へ移行する、または週足安値更新後も相対強度が回復しない場合は再評価'
  };
}

function nearestOverhead(current,values){
  const xs=values.filter(finite).map(Number);
  if(!xs.length)return null;
  const above=xs.filter(x=>x>Number(current)*1.001).sort((a,b)=>a-b);
  return above.length?above[0]:Math.max(...xs);
}

function stageState({price,current,readyPct,triggered,invalid,blocked}){
  if(invalid)return'INVALID';
  if(blocked)return'WAIT';
  if(triggered)return'TRIGGERED';
  if(!finite(price)||!finite(current))return'WAIT';
  const distance=pct(price,current);
  return finite(distance)&&distance<=readyPct?'READY':'WAIT';
}

function entryStages({daily,weekly,monthly,volume,rs,phase}){
  const c=Number(daily.close),invalid=phase.code==='BREAKDOWN';
  const blocked=phase.code==='DISTRIBUTION';
  const longStructure=monthly.trend.score>=0&&weekly.trend.code!=='DOWN';
  const rsTurning=finite(rs.rs5)&&(rs.rs5>0||!finite(rs.rs20)||rs.rs5>rs.rs20);
  const volumeOkay=!finite(volume.ratio)||volume.ratio>=.8;
  const phaseSupportsProbe=['PULLBACK','REPAIR','BASE','TRANSITION','MOMENTUM_START','ADVANCE'].includes(phase.code);
  const repairConfirmed=phase.code!=='REPAIR'||phase.metrics?.higher_low===true||rsTurning;
  const probePrice=nearestOverhead(c,[daily.sma5,daily.ema21,daily.high5]);
  let standardPrice=nearestOverhead(c,[daily.ema65,daily.sma25,daily.high10]);
  if(finite(probePrice)&&finite(standardPrice)&&standardPrice<probePrice)standardPrice=probePrice;
  let addPrice=finite(daily.high20)?Number(daily.high20):null;
  if(finite(standardPrice)&&finite(addPrice)&&addPrice<standardPrice)addPrice=standardPrice;

  const probeTriggered=!blocked&&phaseSupportsProbe&&repairConfirmed&&longStructure&&finite(probePrice)&&c>=probePrice&&rsTurning&&daily.rsi14<70;
  const standardTriggered=!blocked&&weekly.trend.score>0&&finite(standardPrice)&&c>=standardPrice&&rsTurning&&volumeOkay&&daily.rsi14<75;
  const addTriggered=!blocked&&weekly.trend.score>0&&daily.trend.score>0&&finite(addPrice)&&c>=addPrice&&finite(volume.ratio)&&volume.ratio>=1.2&&finite(rs.rs20)&&rs.rs20>0;

  const probeStop=[daily.low5,daily.low10].filter(finite);
  const standardStop=[daily.low10,daily.low20,daily.sma50].filter(x=>finite(x)&&x<c);
  const addStop=[daily.low10,daily.ema21,daily.sma25].filter(x=>finite(x)&&x<c);
  const blockedRule=blocked?'分配警戒中のため新規は停止し、ベース形成または修復移行を待つ':null;

  const probe={
    key:'probe',label:'打診',price:round(probePrice,4),
    state:stageState({price:probePrice,current:c,readyPct:4,triggered:probeTriggered,invalid,blocked}),
    size:'予定サイズの1/3以下',
    rule:blockedRule||'終値で5日線・EMA21・短期戻り高値のうち最初の水準を回復し、5日相対強度の改善を確認',
    stop:{price:round(probeStop.length?Math.max(...probeStop):daily.low10,4),rule:'直近5〜10日安値を終値で割れたら打診を撤回'}
  };
  const standard={
    key:'standard',label:'標準',price:round(standardPrice,4),
    state:stageState({price:standardPrice,current:c,readyPct:7,triggered:standardTriggered,invalid,blocked}),
    size:'中心ポジション',
    rule:blockedRule||'EMA65・25日線・10日戻り高値のうち次の主要水準を終値で回復し、短期相対強度と出来高の改善を確認',
    stop:{price:round(standardStop.length?Math.max(...standardStop):daily.low20,4),rule:'10〜20日安値または50日線を終値で明確に割れたら再評価'}
  };
  const add={
    key:'add',label:'追加',price:round(addPrice,4),
    state:stageState({price:addPrice,current:c,readyPct:2.5,triggered:addTriggered,invalid,blocked}),
    size:'モメンタム確認後の追加',
    rule:blockedRule||'20日高値を終値で突破し、出来高比1.2以上・20日相対強度プラスを確認',
    stop:{price:round(addStop.length?Math.max(...addStop):daily.low10,4),rule:'突破後に10日安値または短期線を終値で割れたら追加分を再評価'}
  };
  return{probe,standard,add};
}

function setupState({daily,weekly,monthly,volume,rs,phase}){
  const checklist=entryChecklist({daily,weekly,monthly,volume,rs,phase});
  const entries=entryStages({daily,weekly,monthly,volume,rs,phase});
  const reasons=[],risks=[];let status='WAIT';
  const invalid=entries.standard.state==='INVALID';
  if(invalid){
    status='INVALID';risks.push('局面判定が崩壊・下降');
  }else if(phase.code==='DISTRIBUTION'){
    status='WAIT';risks.push('分配警戒中のため新規を停止');
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
  if(phase.code==='REPAIR')risks.push('修復局面のため打診サイズを抑える');
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
    invalidation:'局面が崩壊へ移行、週足安値更新、または日足・週足がともに下降トレンドへ移行'
  };
}

function chartRows(rows){return rows.slice(-120).map(r=>({date:r.date,close:round(r.close,4),volume:round(r.volume,0)}));}

export function analyzeFrame({symbol,name,market,rows,benchmarkSymbol,benchmarkRows,meta}){
  if(!rows||rows.length<60)throw new Error('分析に必要な価格履歴が不足しています');
  const daily=frameSummary(aggregate(rows,'daily'),'日足');
  const weekly=frameSummary(aggregate(rows,'weekly'),'週足');
  const monthly=frameSummary(aggregate(rows,'monthly'),'月足');
  const volume=volumeMetrics(rows),rs=relativeStrength(rows,benchmarkRows||[]),priceAction=priceActionMetrics(rows);
  const phase=classifyPhase({daily,weekly,monthly,volume,rs,priceAction});
  const setup=setupState({daily,weekly,monthly,volume,rs,phase});
  const holding=holdingState({daily,weekly,monthly,rs,phase});
  const score=monthly.trend.score*2+weekly.trend.score*3+daily.trend.score*2+(finite(rs.rs20)?Math.max(-2,Math.min(2,rs.rs20/5)):0);
  const diagnosis=`${phase.label}・${setup.status==='TRIGGERED'?'仕掛け条件成立':setup.status==='READY'?'反転条件へ接近':setup.status==='INVALID'?'新規無効':'条件待ち'}`;
  return{
    ok:true,symbol,name:name||meta?.symbol||symbol,market,currency:meta?.currency||null,exchange:meta?.exchange||null,
    benchmark:benchmarkSymbol,updated_at:new Date().toISOString(),diagnosis,score:round(score,1),status:setup.status,
    phase,entry_status:setup.status,holding_status:holding.status,holding,
    frames:{monthly,weekly,daily},volume,relative_strength:rs,setup,chart:chartRows(rows),
    methodology:'月足・週足・日足、EMA21/65、25/50/200日線、RSI14、ATR14、5/20/60日相対強度、出来高と高値からの損傷度を統合。局面を初動・上昇・押し目・ベース・分配・修復・崩壊に分け、打診・標準・追加を判定します。'
  };
}
