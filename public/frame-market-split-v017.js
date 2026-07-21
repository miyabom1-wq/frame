(()=>{
'use strict';

const FRAME_MARKET_SPLIT_VERSION='v0.17-market-split-20260721';
const MARKET_KEY='frame_market_view';
const STATUS_LABEL={UNSET:'分析待ち',WAIT:'待機',READY:'接近',TRIGGERED:'条件成立',INVALID:'無効'};
const STATUS_ORDER={TRIGGERED:0,READY:1,WAIT:2,UNSET:3,INVALID:4};
let marketView=localStorage.getItem(MARKET_KEY)==='us'?'us':'jp';
if(typeof vantageContext!=='undefined'&&['jp','us'].includes(vantageContext?.market))marketView=vantageContext.market;
let candidateFilter='focus';
let candidateQuery='';
let allActionPlans=[];
let actionRendering=false;
let boardPainting=false;

const marketOfPlan=p=>p?.market==='us'?'us':'jp';
const configured=p=>p?.plan_configured===true?true:p?.plan_configured===false?false:Boolean(p?.diagnosis||p?.phase||p?.entries||String(p?.memo||'').trim());
const statusOf=p=>(configured(p)||p?.auto_analyzed_at)?String(p?.entry_status||p?.status||'WAIT').toUpperCase():'UNSET';
const priceText=(v,m)=>v==null||!Number.isFinite(Number(v))?'—':m==='jp'?fmt(v,0)+'円':'$'+fmt(v,2);
const displayTime=v=>{const d=new Date(v||0);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})};
const marketName=m=>m==='jp'?'日本株':'米国株';

function plansSource(){
  if(allActionPlans.length)return allActionPlans;
  return Array.isArray(planCache)?planCache:[];
}
function marketCounts(plans=plansSource()){
  return {jp:plans.filter(x=>marketOfPlan(x)==='jp').length,us:plans.filter(x=>marketOfPlan(x)==='us').length};
}
function marketSwitchHtml(context,plans=plansSource()){
  const counts=marketCounts(plans);
  return `<div class="market-split" data-context="${esc(context)}"><div><b>市場を分けて表示</b><span>${context==='queue'?'仕掛け順位は市場ごとに独立':'候補判定も市場ごとに確認'}</span></div><div class="market-split-buttons"><button class="${marketView==='jp'?'active':''}" onclick="setFrameMarketView('jp')">日本株 <em>${counts.jp}</em></button><button class="${marketView==='us'?'active':''}" onclick="setFrameMarketView('us')">米国株 <em>${counts.us}</em></button></div></div>`;
}
function syncManualMarket(){
  const select=document.getElementById('market');
  if(select)select.value=marketView;
}

function candidateMatches(p){
  const status=statusOf(p),q=candidateQuery.trim().toLowerCase();
  if(candidateFilter==='focus'&&!['TRIGGERED','READY'].includes(status))return false;
  if(candidateFilter==='wait'&&status!=='WAIT')return false;
  if(candidateFilter==='invalid'&&status!=='INVALID')return false;
  if(q){
    const text=[p?.name,p?.symbol,p?.source_context?.theme,p?.phase?.label,p?.diagnosis].join(' ').toLowerCase();
    if(!text.includes(q))return false;
  }
  return true;
}
function candidateCard(p){
  const status=statusOf(p),market=marketOfPlan(p),e=p?.entries||{},theme=p?.source_context?.theme||'',phase=p?.phase?.label||'';
  const current=p?.source_context?.price??p?.current_price??p?.quote?.price??null;
  return `<button class="candidate-card ${status}" onclick="openFrameCandidate('${attr(p.id)}')"><div class="candidate-card-head"><div><div class="candidate-card-name">${esc(p?.name||p?.symbol||'—')}</div><div class="candidate-card-code">${market==='jp'?'JP':'US'} · ${esc(p?.symbol||'—')}</div></div><span class="candidate-card-status ${status}">${esc(STATUS_LABEL[status]||status)}</span></div><div class="candidate-card-badges">${theme?`<span class="theme">${esc(theme)}</span>`:''}${phase?`<span class="phase">${esc(phase)}</span>`:''}${p?.source_context?.lane?`<span>候補 ${esc(p.source_context.lane)}</span>`:''}</div><div class="candidate-card-diagnosis">${esc(p?.diagnosis||'FRAMEの自動分析待ち')}</div><div class="candidate-card-prices"><div><span>現在</span><b>${priceText(current,market)}</b></div><div><span>打診</span><b>${priceText(e.probe?.price,market)}</b></div><div><span>標準</span><b>${priceText(e.standard?.price??p?.entry?.price,market)}</b></div></div><div class="candidate-card-foot"><span>${p?.auto_analyzed_at?'分析 '+displayTime(p.auto_analyzed_at):'更新待ち'}</span><span class="open-detail">セットアップを見る ›</span></div></button>`;
}
function renderSeparatedCandidateBoard(){
  const root=document.getElementById('frame-candidate-board');
  if(!root||boardPainting)return;
  const all=[...plansSource()];
  const marketPlans=all.filter(x=>marketOfPlan(x)===marketView).sort((a,b)=>(STATUS_ORDER[statusOf(a)]??9)-(STATUS_ORDER[statusOf(b)]??9)||String(b?.auto_analyzed_at||b?.updated_at||'').localeCompare(String(a?.auto_analyzed_at||a?.updated_at||'')));
  const counts={TRIGGERED:0,READY:0,WAIT:0,INVALID:0,UNSET:0};
  for(const p of marketPlans)counts[statusOf(p)]=(counts[statusOf(p)]||0)+1;
  const shown=marketPlans.filter(candidateMatches);
  boardPainting=true;
  root.innerHTML=`<div id="frame-market-board-v017">${marketSwitchHtml('candidate',all)}<div class="candidate-hero"><div><h2>${marketName(marketView)}の個別セットアップ</h2><p>${marketView==='jp'?'日本株は日経平均などとの市場差と円建て価格で判定します。':'米国株はSOXなどとの市場差とドル建て価格で判定します。'} 他市場の銘柄は混在させません。</p></div><div class="candidate-kpi"><b>${counts.TRIGGERED}</b><span>条件成立</span></div><div class="candidate-kpi"><b>${counts.READY}</b><span>接近</span></div><div class="candidate-kpi"><b>${counts.WAIT}</b><span>待機</span></div><div class="candidate-kpi"><b>${counts.INVALID}</b><span>無効</span></div></div><div class="candidate-toolbar"><input value="${esc(candidateQuery)}" oninput="setFrameBoardQuery(this.value)" placeholder="${marketName(marketView)}の銘柄名・コード・テーマ"><button class="board-filter ${candidateFilter==='focus'?'active':''}" onclick="setFrameBoardFilter('focus')">今見る</button><button class="board-filter ${candidateFilter==='wait'?'active':''}" onclick="setFrameBoardFilter('wait')">待機</button><button class="board-filter ${candidateFilter==='invalid'?'active':''}" onclick="setFrameBoardFilter('invalid')">無効</button><button class="board-filter ${candidateFilter==='all'?'active':''}" onclick="setFrameBoardFilter('all')">すべて</button></div>${shown.length?`<div class="candidate-grid">${shown.map(candidateCard).join('')}</div>`:`<div class="empty">${marketName(marketView)}でこの条件に該当する候補はありません。</div>`}</div>`;
  boardPainting=false;
  filterRecentMarket();
}

const baseRecent=window.renderRecent;
function filterRecentMarket(){
  const root=document.getElementById('recent');
  if(!root)return;
  let visible=0;
  root.querySelectorAll('.recent-card').forEach(card=>{
    const small=card.querySelector('small')?.textContent||'';
    const market=small.trim().startsWith('US')?'us':'jp';
    card.hidden=market!==marketView;
    if(!card.hidden)visible++;
  });
  const title=root.querySelector('.recent-title');
  if(title)title.textContent=`最近見た${marketName(marketView)}`;
  root.hidden=visible===0;
}
if(typeof baseRecent==='function'){
  window.renderRecent=function(){baseRecent();filterRecentMarket()};
}

const baseActionRenderPlans=window.renderPlans;
function decorateActionQueue(){
  const root=document.getElementById('plans');
  if(!root)return;
  root.querySelector('.market-split[data-context="queue"]')?.remove();
  root.insertAdjacentHTML('afterbegin',marketSwitchHtml('queue',allActionPlans));
  const title=root.querySelector('.action-hero h2');
  if(title)title.textContent=`${marketName(marketView)}の仕掛け順`;
  const note=root.querySelector('.action-hero p');
  if(note)note.textContent=marketView==='jp'?'日本株だけを条件成立・接近・待機の順で比較します。米国株とは順位を混ぜません。':'米国株だけを条件成立・接近・待機の順で比較します。日本株とは順位を混ぜません。';
}
if(typeof baseActionRenderPlans==='function'){
  window.renderPlans=function(plans){
    const incoming=[...(plans||[])];
    if(!actionRendering)allActionPlans=incoming;
    const source=allActionPlans.length?allActionPlans:incoming;
    const filtered=source.filter(x=>marketOfPlan(x)===marketView);
    actionRendering=true;
    try{baseActionRenderPlans(filtered)}finally{actionRendering=false;planCache=source}
    decorateActionQueue();
  };
}
function rerenderActionQueue(){
  const source=allActionPlans.length?allActionPlans:[...(Array.isArray(planCache)?planCache:[])];
  if(!source.length){decorateActionQueue();return}
  allActionPlans=source;
  window.renderPlans(source);
}

window.setFrameMarketView=function(market){
  marketView=market==='us'?'us':'jp';
  localStorage.setItem(MARKET_KEY,marketView);
  syncManualMarket();
  renderSeparatedCandidateBoard();
  rerenderActionQueue();
  if(typeof window.renderRecent==='function')window.renderRecent();
};
window.setFrameBoardFilter=function(value){candidateFilter=['focus','wait','invalid','all'].includes(value)?value:'focus';renderSeparatedCandidateBoard()};
window.setFrameBoardQuery=function(value){candidateQuery=String(value||'');renderSeparatedCandidateBoard()};
window.openFrameCandidate=id=>loadPlanById(id);

const boardRoot=document.getElementById('frame-candidate-board');
if(boardRoot){
  const observer=new MutationObserver(()=>{
    if(boardPainting)return;
    if(!boardRoot.querySelector('#frame-market-board-v017'))queueMicrotask(renderSeparatedCandidateBoard);
  });
  observer.observe(boardRoot,{childList:true});
}

const version=document.querySelector('.version');if(version)version.textContent='UI v0.17';
const style=document.createElement('style');
style.id='frame-market-split-v017-style';
style.textContent=`
.market-split{display:flex;align-items:center;gap:12px;margin:0 0 10px;padding:10px 12px;border:1px solid #d7e0e9;border-radius:14px;background:linear-gradient(135deg,#f7fafc,#fff)}.market-split>div:first-child b{display:block;font-size:11px}.market-split>div:first-child span{display:block;margin-top:2px;font-size:9px;color:#748195}.market-split-buttons{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-left:auto;min-width:250px;padding:4px;border-radius:11px;background:#e7ecf2}.market-split-buttons button{border:0;border-radius:8px;padding:8px 12px;background:transparent;color:#5b687a;font-size:10px;font-weight:900;cursor:pointer}.market-split-buttons button.active{background:#172237;color:#fff;box-shadow:0 3px 10px rgba(24,34,51,.15)}.market-split-buttons em{margin-left:5px;font-style:normal;font:800 9px ui-monospace,monospace;opacity:.75}
@media(max-width:650px){.market-split{display:block}.market-split-buttons{margin:8px 0 0;min-width:0}.candidate-hero{margin-top:0}}
`;
document.head.appendChild(style);

syncManualMarket();
setTimeout(renderSeparatedCandidateBoard,0);
setTimeout(renderSeparatedCandidateBoard,500);
console.info('FRAME market split loaded',FRAME_MARKET_SPLIT_VERSION);
})();
