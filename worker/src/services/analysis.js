import { DEFAULT_BENCHMARKS } from '../config.js';
import { fetchYahooChart } from '../data/yahoo.js';
import { normalizeYahooDaily } from '../data/normalization.js';
import { analyzeFrame } from '../engine/frame-analysis.js';
import { normalizeSymbol } from '../utils.js';

function marketOf(value){return value==='jp'?'jp':'us';}
function providerName(raw,symbol){return String(raw?.meta?.longName||raw?.meta?.shortName||raw?.meta?.symbol||symbol);}
function quoteFrom(analysis,data){
  const daily=analysis.frames?.daily||{},marketState=String(data.meta?.market_state||'').toUpperCase(),regularTime=Number(data.meta?.regular_market_time||0);
  return{
    price:daily.close??null,
    change_pct:daily.change_pct??null,
    date:daily.date??null,
    price_time:regularTime>0?new Date(regularTime*1000).toISOString():null,
    market_state:marketState||null,
    close_confirmed:['CLOSED','POST','POSTPOST'].includes(marketState)
  };
}

export async function prepareBenchmark(market,{benchmark='',cacheTtl=300}={}){
  const m=marketOf(market),symbol=String(benchmark||DEFAULT_BENCHMARKS[m]);
  const raw=await fetchYahooChart(symbol,{range:'5y',cacheTtl});
  const normalized=normalizeYahooDaily(raw);
  return{market:m,symbol,rows:normalized.rows,meta:normalized.meta};
}

export async function analyzeFrameSymbol({market,symbol,name='',benchmark='',benchmarkContext=null,cacheTtl=300}={}){
  const m=marketOf(market),normalizedSymbol=normalizeSymbol(symbol,m);if(!normalizedSymbol)throw new Error('symbol required');
  const bench=benchmarkContext||await prepareBenchmark(m,{benchmark,cacheTtl});
  const raw=await fetchYahooChart(normalizedSymbol,{range:'5y',cacheTtl});
  const data=normalizeYahooDaily(raw),sourceName=providerName(raw,normalizedSymbol),displayName=String(name||sourceName||normalizedSymbol);
  const analysis=analyzeFrame({symbol:normalizedSymbol,name:displayName,market:m,rows:data.rows,benchmarkSymbol:bench.symbol,benchmarkRows:bench.rows,meta:data.meta});
  if(displayName!==sourceName)analysis.provider_name=sourceName;
  analysis.quote=quoteFrom(analysis,data);
  return analysis;
}

export async function analyzeFrameItems(items,{concurrency=4,cacheTtl=300}={}){
  const list=Array.isArray(items)?items:[],results=new Array(list.length),benchmarks=new Map();let cursor=0;
  const benchmarkFor=market=>{
    const m=marketOf(market);if(!benchmarks.has(m))benchmarks.set(m,prepareBenchmark(m,{cacheTtl}));return benchmarks.get(m);
  };
  async function worker(){
    while(cursor<list.length){
      const index=cursor++,item=list[index];
      try{
        const benchmarkContext=await benchmarkFor(item.market);
        results[index]={ok:true,item,analysis:await analyzeFrameSymbol({...item,benchmarkContext,cacheTtl})};
      }catch(error){results[index]={ok:false,item,error:error?.message||String(error)};}
    }
  }
  await Promise.all(Array.from({length:Math.min(Math.max(1,concurrency),Math.max(1,list.length))},worker));
  return results;
}
