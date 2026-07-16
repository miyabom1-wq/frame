import { corsHeaders, json, authorized } from './api/http.js';
import { route } from './api/routes.js';
export default{
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(request)});
    if(!authorized(request,env))return json({ok:false,error:'write access denied'},403,request);
    try{return await route(request,env);}catch(e){console.error('[FRAME]',e?.stack||e);return json({ok:false,error:e?.message||String(e)},500,request);}
  }
};
