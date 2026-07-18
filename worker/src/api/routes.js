import { APP_VERSION, BUILD_ID, ENGINE_VERSION, DEPLOYED_AT, DEFAULT_BENCHMARKS } from '../config.js';
import { json } from './http.js';
import { lookupSymbol } from '../data/yahoo.js';
import { analyzeFrameSymbol } from '../services/analysis.js';
import { getPlans, mutatePlans } from '../services/plans.js';
import { normalizeSymbol } from '../utils.js';

export async function route(request,env){
  const url=new URL(request.url),p=url.pathname;
  if(p==='/api/health')return json({ok:true,app:'FRAME',version:APP_VERSION,build:BUILD_ID,engine:ENGINE_VERSION,deployed_at:DEPLOYED_AT,time:new Date().toISOString()},200,request);
  if(p==='/api/lookup'){
    const market=url.searchParams.get('market')==='jp'?'jp':'us';
    const symbol=normalizeSymbol(url.searchParams.get('symbol'),market);if(!symbol)return json({ok:false,error:'symbol required'},400,request);
    const q=await lookupSymbol(symbol);return q?json({ok:true,...q},200,request):json({ok:false,error:'not found'},404,request);
  }
  if(p==='/api/analyze'){
    const market=url.searchParams.get('market')==='jp'?'jp':'us';
    const symbol=normalizeSymbol(url.searchParams.get('symbol'),market);if(!symbol)return json({ok:false,error:'symbol required'},400,request);
    const benchmark=String(url.searchParams.get('benchmark')||DEFAULT_BENCHMARKS[market]);
    return json(await analyzeFrameSymbol({market,symbol,benchmark,cacheTtl:300}),200,request);
  }
  if(p==='/api/plans')return request.method==='GET'?json(await getPlans(env),200,request):json(await mutatePlans(env,await request.json()),200,request);
  return new Response('Not Found',{status:404});
}
