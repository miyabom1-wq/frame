import { FRONTEND_ORIGIN } from '../config.js';
export function corsHeaders(request){
  const origin=request?.headers?.get('Origin')||'';
  const allow=origin===FRONTEND_ORIGIN||origin.startsWith('http://localhost:')?origin:'*';
  return{
    'Access-Control-Allow-Origin':allow,
    'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type, X-Frame-Key',
    'Access-Control-Max-Age':'86400',
    'Vary':'Origin'
  };
}
export function json(data,status=200,request=null){
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',...corsHeaders(request)}});
}
export function authorized(request,env){
  const url=new URL(request.url);
  const privateRead=url.pathname==='/api/plans';
  const requires=['POST','PUT','DELETE'].includes(request.method)||privateRead;
  if(!requires)return true;
  const token=String(env.WRITE_TOKEN||''),supplied=request.headers.get('X-Frame-Key')||'';
  if(token)return supplied===token;
  const origin=request.headers.get('Origin')||'';
  return origin===FRONTEND_ORIGIN||origin.startsWith('http://localhost:');
}
