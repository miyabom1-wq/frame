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

function frameSummary(rows,label){
  const p=prepare(rows),i=rows.length-1,row=rows[i]||{},t=trend(p,label),atr=p.atr14[i],rsi=p.rsi14[i];
  const prior20=rows.slice(Math.max(0,i-20),i),high20=prior20.length?Math.max(...prior20.map(x=>x.high)):null,low20=prior20.length?Math.min(...prior20.map(x=>x.low)):null;
  return{
    timeframe:label,date:row.date||null,close:round(row.close,4),change_pct:i>0?round(pct(row.close,rows[i-1].close)):null,
    trend:t,rsi14:round(rsi,2),atr14:round(atr,4),atr_pct:finite(atr)&&finite(row.close)?round(atr/row.close*100,2):null,
    sma5:round(p.sma5[i],4),sma25:round(p.sma25[i],4),sma50:round(p.sma50[i],4),sma200:round(p.sma200[i],4),ema65:round(p.ema65[i],4),
    high20:round(high20,4),low20:round(low20,4),distance_high20:finite(high20)?round(pct(row.close,high20)):null,distance_low20:finite(low20)?round(pct(row.close,low20)):null
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
    {key:'high20',label:'20日高値から2.5%以内',pass:finite(daily.distance_high20)&&daily.distance_high20>=-2.5,actual:finite(daily.distance_high20)?daily.distance_high20+'%':'—'},
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

function setupState({daily,weekly,monthly,volume,rs}){
  const checklist=entryChecklist({daily,weekly,monthly,volume,rs});
  const reasons=[],risks=[];let status='WAIT';
  const c=daily.close,ema=daily.ema65,rsi=daily.rsi14,vr=volume.ratio;
  const multi=monthly.trend.score+weekly.trend.score+daily.trend.score;
  const nearEma=finite(c)&&finite(ema)&&Math.abs(pct(c,ema))<=2.5;
  const nearBreak=finite(daily.high20)&&finite(c)&&pct(c,daily.high20)>=-2.5;
  const invalid=daily.trend.code==='DOWN'&&weekly.trend.score<0;
  const required=checklist.filter(x=>['weekly','daily','high20','volume','relative','rsi'].includes(x.key));
  if(invalid){status='INVALID';risks.push('日足・週足がともに下降');}
  else if(required.every(x=>x.pass)){
    status='TRIGGERED';reasons.push('日足・週足が上向き','20日高値圏','出来高増加','指数に対して優位');
  }else if(multi>=2&&(nearEma||nearBreak)&&(!finite(rsi)||rsi<75)){
    status='READY';reasons.push('上位足の方向が改善','EMA65または20日高値に接近');
    if(finite(rs.rs20)&&rs.rs20<0)risks.push('指数に対する相対強度は未改善');
    if(finite(vr)&&vr<1)risks.push('出来高の裏付けが弱い');
  }else{
    reasons.push('条件待ち');
    if(weekly.trend.score<0)risks.push('週足が下降または移行局面');
    if(finite(rs.rs20)&&rs.rs20<0)risks.push('指数に劣後');
  }
  const triggerCandidates=[daily.high20,daily.ema65,daily.sma25].filter(finite);
  const trigger=triggerCandidates.length?Math.max(...triggerCandidates):null;
  const structuralStop=[daily.low20,daily.sma50].filter(finite),eligibleStop=structuralStop.filter(x=>x<c);
  const stop=eligibleStop.length?Math.max(...eligibleStop):(finite(daily.low20)?daily.low20:null);
  return{
    status,reasons,risks,checklist,
    progress:{passed:checklist.filter(x=>x.pass).length,total:checklist.length},
    entry:{price:round(trigger,4),rule:'終値でトリガー水準を回復し、出来高比1.2以上を確認'},
    stop:{price:round(stop,4),rule:'直近20日安値または50日線を終値で明確に割れたら再評価'},
    add_rule:'週足短期線回復かつ相対強度20日がプラスを維持',
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
    methodology:'月足・週足・日足の構造、EMA65、25/50/200日線、RSI14、ATR14、5/20/60日相対強度、20日出来高比を統合。新規エントリーと既存保有を分離し、売買注文は送信しません。'
  };
}
