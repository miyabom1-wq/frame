(()=>{
'use strict';

const FRAME_ACTION_VERSION='v0.16-action-queue-20260721';
const STATUS_LABEL={UNSET:'分析待ち',WAIT:'待機',READY:'接近',TRIGGERED:'条件成立',INVALID:'無効'};
const STATUS_ORDER={TRIGGERED:0,READY:1,WAIT:2,UNSET:3,INVALID:4};
const TEMPLATE_LABEL={unset:'条件未設定',reacceleration:'再加速待ち',reversal:'反転確認待ち',pullback_complete:'押し目完了待ち'};

function configured(p){
  if(p?.plan_configured===true)return true;
  if(p?.plan_configured===false)return false;
  return Boolean(p?.diagnosis||p?.phase||p?.entries||String(p?.memo||'').trim());
}
function statusOf(p){
  return configured(p)||p?.auto_analyzed_at
    ? String(p?.entry_status||p?.status||'WAIT').toUpperCase()
    : 'UNSET';
}
function templateOf(p){
  return p?.template||({A:'reacceleration',B:'reversal',C:'pullback_complete'}[String(p?.source_context?.lane||p?.vantage_lane||'').toUpperCase()]||'unset');
}
function marketLabel(m){return m==='jp'?'JP':'US'}
function priceText(v,m){
  if(v==null||!Number.isFinite(Number(v)))return '—';
  return m==='jp'?fmt(v,0)+'円':'$'+fmt(v,2);
}
function currentPrice(p){
  return p?.source_context?.price??p?.current_price??p?.quote?.price??null;
}
function stages(p){
  const e=p?.entries||{};
  return [
    {key:'probe',label:'打診',data:e.probe},
    {key:'standard',label:'標準',data:e.standard||p?.entry},
    {key:'add',label:'追加',data:e.add}
  ].filter(x=>x.data);
}
function nextStage(p){
  const list=stages(p),status=statusOf(p);
  if(!list.length)return null;
  if(status==='TRIGGERED'){
    const pending=list.find(x=>!['TRIGGERED','HOLD'].includes(String(x.data?.state||'').toUpperCase()));
    return pending||list[list.length-1];
  }
  if(status==='READY'){
    return list.find(x=>String(x.data?.state||'').toUpperCase()==='READY')||list[0];
  }
  if(status==='WAIT'){
    return list.find(x=>String(x.data?.state||'').toUpperCase()==='WAIT')||list[0];
  }
  return list[0];
}
function distancePct(now,target){
  const a=Number(now),b=Number(target);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a===0)return null;
  return (b-a)/a*100;
}
function distanceText(v){
  if(v==null||!Number.isFinite(Number(v)))return '距離 —';
  const n=Number(v);
  if(Math.abs(n)<0.05)return 'ほぼ到達';
  return `${n>=0?'+':''}${n.toFixed(1)}%`;
}
function invalidationPrice(p){
  const e=p?.entries||{};
  return e.standard?.stop?.price??e.probe?.stop?.price??p?.stop?.price??null;
}
function actionInfo(p){
  const status=statusOf(p),stage=nextStage(p),now=currentPrice(p);
  const target=stage?.data?.price??null,dist=distancePct(now,target);
  if(status==='TRIGGERED'){
    const stageState=String(stage?.data?.state||'').toUpperCase();
    if(stage&&stageState!=='TRIGGERED')return {label:`次は${stage.label}`,detail:`${priceText(target,p.market)}まで ${distanceText(dist)}`,target,dist};
    return {label:'条件成立',detail:'無効化条件と出来高を確認',target,dist};
  }
  if(status==='READY')return {label:`${stage?.label||'条件'}に接近`,detail:`${priceText(target,p.market)}まで ${distanceText(dist)}`,target,dist};
  if(status==='WAIT')return {label:`${stage?.label||'条件'}待ち`,detail:`${priceText(target,p.market)}まで ${distanceText(dist)}`,target,dist};
  if(status==='INVALID')return {label:'新規見送り',detail:'シナリオ再構築まで待機',target:null,dist:null};
  return {label:'分析待ち',detail:'FRAME自動分析の更新待ち',target:null,dist:null};
}
function priorityScore(p){
  const status=statusOf(p),info=actionInfo(p),distance=Math.abs(Number(info.dist));
  return (STATUS_ORDER[status]??9)*1000+(Number.isFinite(distance)?distance:999);
}
function sourceBadge(p){
  if(p?.linked_to_vantage)return '<span class="queue-source linked">VANTAGE</span>';
  if(p?.vantage_link_state==='detached')return '<span class="queue-source detached">独立</span>';
  return '<span class="queue-source">保存</span>';
}
function queueRow(p,index){
  const status=statusOf(p),info=actionInfo(p),now=currentPrice(p),stop=invalidationPrice(p);
  const theme=p?.source_context?.theme||'',phase=p?.phase?.label||'',mode=typeof modeLabel==='function'?modeLabel(p?.mode):p?.mode||'';
  return `<button class="action-row ${status}" onclick="loadPlanById('${attr(p.id)}')">
    <span class="action-rank">${index}</span>
    <span class="action-company">
      <b>${esc(p?.name||p?.symbol||'—')}</b>
      <small>${marketLabel(p?.market)} · ${esc(p?.symbol||'—')}</small>
      <span class="action-tags">${sourceBadge(p)}${theme?`<em>${esc(theme)}</em>`:''}${phase?`<em>${esc(phase)}</em>`:''}${mode?`<em>${esc(mode)}</em>`:''}</span>
    </span>
    <span class="action-state"><b class="queue-status ${status}">${esc(STATUS_LABEL[status]||status)}</b><small>${esc(info.label)}</small></span>
    <span class="action-price"><small>現在</small><b>${priceText(now,p?.market)}</b></span>
    <span class="action-price"><small>${esc(info.label)}</small><b>${priceText(info.target,p?.market)}</b><em>${esc(distanceText(info.dist))}</em></span>
    <span class="action-price stop"><small>撤回・再評価</small><b>${priceText(stop,p?.market)}</b></span>
    <span class="action-open">詳細 ›</span>
  </button>`;
}
function queueSection(title,subtitle,items,startIndex=1){
  return `<section class="action-section"><div class="action-section-head"><div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div><span>${items.length}件</span></div>${items.length?`<div class="action-list">${items.map((p,i)=>queueRow(p,startIndex+i)).join('')}</div>`:'<div class="empty action-empty">該当銘柄はありません。</div>'}</section>`;
}

const style=document.createElement('style');
style.id='frame-action-queue-v016-style';
style.textContent=`
.action-hero{display:grid;grid-template-columns:1fr repeat(4,minmax(88px,.34fr));gap:8px;padding:16px;border-radius:18px;background:linear-gradient(135deg,#162238,#2e3f5c);color:#fff;box-shadow:0 11px 30px rgba(24,34,51,.16);margin-bottom:12px}.action-hero h2{margin:0;font-size:18px}.action-hero p{margin:5px 0 0;color:#ccd7e6;font-size:10px;line-height:1.6}.action-kpi{display:grid;place-items:center;padding:9px;border:1px solid rgba(255,255,255,.13);border-radius:12px;background:rgba(255,255,255,.08);text-align:center}.action-kpi b{display:block;font:900 18px ui-monospace,monospace}.action-kpi span{display:block;font-size:9px;color:#d2dbe8;margin-top:2px}.action-note{margin:0 0 12px;padding:10px 12px;border:1px solid #d8e1eb;border-radius:11px;background:#f7f9fc;color:#57667a;font-size:10px;line-height:1.6}.action-note b{color:#1f2e43}.action-section{margin:14px 0}.action-section-head{display:flex;align-items:flex-end;gap:10px;margin:0 2px 7px}.action-section-head h3{margin:0;font-size:14px}.action-section-head p{margin:3px 0 0;color:#748093;font-size:9px}.action-section-head>span{margin-left:auto;font-size:10px;font-weight:900;color:#5e6c7e}.action-list{display:grid;gap:7px}.action-row{display:grid;grid-template-columns:34px minmax(180px,1.5fr) minmax(104px,.7fr) minmax(92px,.55fr) minmax(130px,.8fr) minmax(105px,.65fr) 54px;gap:8px;align-items:center;width:100%;padding:11px 12px;border:1px solid #dce3eb;border-left:5px solid #9aa5b4;border-radius:13px;background:#fff;color:inherit;text-align:left;cursor:pointer;box-shadow:0 2px 9px rgba(24,34,51,.035)}.action-row:hover{border-color:#bcc8d7;box-shadow:0 7px 18px rgba(24,34,51,.075)}.action-row.TRIGGERED{border-left-color:#178159}.action-row.READY{border-left-color:#2d6fd2}.action-row.WAIT{border-left-color:#c58a24}.action-row.INVALID{border-left-color:#c63249}.action-rank{display:grid;place-items:center;width:27px;height:27px;border-radius:9px;background:#edf1f6;color:#4c5a6e;font:900 11px ui-monospace,monospace}.action-company b{display:block;font-size:12px;line-height:1.35}.action-company small{display:block;margin-top:2px;font:9px ui-monospace,monospace;color:#758195}.action-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.action-tags em,.queue-source{display:inline-flex;border-radius:999px;padding:2px 6px;background:#edf1f6;color:#617084;font-size:8px;font-style:normal;font-weight:800}.queue-source.linked{background:#dff3ef;color:#087565}.queue-source.detached{background:#eceff3;color:#697486}.action-state b{display:inline-flex;border-radius:999px;padding:4px 8px;font-size:9px;font-weight:900;background:#edf1f6;color:#596579}.action-state b.TRIGGERED{background:#dff3e9;color:#157a50}.action-state b.READY{background:#e1ebff;color:#245fc2}.action-state b.WAIT{background:#fff0d4;color:#9b6700}.action-state b.INVALID{background:#fde3e7;color:#b4253f}.action-state small{display:block;margin-top:5px;color:#657286;font-size:9px}.action-price small{display:block;color:#7b8797;font-size:8px}.action-price b{display:block;margin-top:2px;font:800 12px ui-monospace,monospace}.action-price em{display:block;margin-top:2px;color:#52647d;font-size:8px;font-style:normal}.action-price.stop b{color:#9e3b4b}.action-open{color:#245fc2;font-size:9px;font-weight:900;text-align:right}.action-empty{background:#fff;border:1px solid #e0e5ec;border-radius:13px}.detail-plan-tools{margin-top:12px;border:1px solid #dce3eb;border-radius:13px;background:#f8fafc;padding:0 12px}.detail-plan-tools summary{cursor:pointer;padding:11px 0;font-size:11px;font-weight:900;color:#536175}.detail-plan-tools-body{padding:0 0 12px}.detail-plan-tools-grid{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}.detail-plan-tools select{border:1px solid #cbd3de;border-radius:9px;background:#fff;padding:8px 9px}.detail-plan-tools .danger-zone{margin-top:9px;padding-top:9px;border-top:1px solid #e3e7ed}.detail-plan-tools .danger-zone button{font-size:10px}
@media(max-width:900px){.action-row{grid-template-columns:30px 1fr auto}.action-state{grid-column:3}.action-price{grid-column:auto}.action-price.stop{display:none}.action-open{grid-column:3;grid-row:2/4;align-self:center}.action-company{grid-column:2}.action-row>.action-price{margin-top:5px}.action-hero{grid-template-columns:repeat(2,1fr)}.action-hero>div:first-child{grid-column:1/-1}}
@media(max-width:650px){.action-row{grid-template-columns:28px 1fr auto;padding:10px}.action-company b{font-size:11px}.action-price{display:inline-block}.action-open{display:none}.action-state{grid-column:3;grid-row:1/2}.detail-plan-tools-grid{grid-template-columns:1fr}.action-section-head{align-items:flex-start}}
`;
document.head.appendChild(style);

const version=document.querySelector('.version');if(version)version.textContent='UI v0.16';
const planTab=document.querySelector('[data-tab="plans"] span');if(planTab)planTab.textContent='仕掛け順';
const flow=document.querySelector('.frame-flow');if(flow)flow.innerHTML='<span><i>1</i>候補を選ぶ</span><b>›</b><span><i>2</i>仕掛け順を確認</span><b>›</b><span><i>3</i>局面・価格</span><b>›</b><span><i>4</i>無効化を固定</span>';

window.renderPlans=function(plans){
  plans=[...(plans||[])];
  planCache=plans;
  const sorted=plans.sort((a,b)=>priorityScore(a)-priorityScore(b)||String(b?.auto_analyzed_at||b?.updated_at||'').localeCompare(String(a?.auto_analyzed_at||a?.updated_at||'')));
  const triggered=sorted.filter(x=>statusOf(x)==='TRIGGERED');
  const ready=sorted.filter(x=>statusOf(x)==='READY');
  const wait=sorted.filter(x=>['WAIT','UNSET'].includes(statusOf(x)));
  const invalid=sorted.filter(x=>statusOf(x)==='INVALID');
  const near=ready.filter(x=>Math.abs(Number(actionInfo(x).dist))<=3).length;
  let index=1;
  let html=`<div class="action-hero"><div><h2>仕掛け順</h2><p>候補の重複管理ではなく、FRAMEの個別判定と目標価格までの距離で、今日確認する順番を整理します。</p></div><div class="action-kpi"><b>${triggered.length}</b><span>条件成立</span></div><div class="action-kpi"><b>${ready.length}</b><span>接近</span></div><div class="action-kpi"><b>${near}</b><span>3%以内</span></div><div class="action-kpi"><b>${invalid.length}</b><span>見送り</span></div></div>`;
  html+='<div class="action-note"><b>見方：</b>上から順に確認します。条件成立でも即時購入ではなく、出来高・無効化価格・VANTAGEの地合いを確認してから判断します。メモやテンプレートは銘柄詳細の「プラン設定」に移しました。</div>';
  html+=queueSection('条件成立','エントリー条件が成立。発注前に無効化と現在値を再確認',triggered,index);index+=triggered.length;
  html+=queueSection('接近','次の打診・標準・追加水準まで近い順',ready,index);index+=ready.length;
  html+=queueSection('待機','まだ条件不足。目標価格と局面の変化を監視',wait,index);index+=wait.length;
  html+=queueSection('見送り','新規シナリオが無効。再構築まで優先順位外',invalid,index);
  const root=document.getElementById('plans');if(root)root.innerHTML=html;
};

const baseRenderAnalysis=renderAnalysis;
renderAnalysis=function(d){
  baseRenderAnalysis(d);
  const root=document.getElementById('analysis');if(!root)return;
  const plan=(planCache||[]).find(p=>String(p?.market)===String(d?.market)&&String(p?.symbol||'').replace(/\.T$/,'')===String(d?.symbol||'').replace(/\.T$/,''));
  if(!plan)return;
  const tools=document.createElement('details');
  tools.className='detail-plan-tools';
  tools.innerHTML=`<summary>この銘柄のプラン設定</summary><div class="detail-plan-tools-body"><div class="detail-plan-tools-grid"><select id="detail-template">${Object.entries(TEMPLATE_LABEL).map(([v,l])=>`<option value="${v}" ${templateOf(plan)===v?'selected':''}>${l}</option>`).join('')}</select><button class="secondary" onclick="saveFrameDetailPlan('${attr(plan.id)}')">テンプレート・メモを保存</button></div><div class="muted" style="margin-top:8px">メモは上の「プランメモ」を使用します。分析モードは画面上部の新規・押し目・長期保有で変更します。</div><div class="danger-zone"><button class="secondary danger" onclick="deleteFrameDetailPlan('${attr(plan.id)}')">このプランを削除</button></div></div>`;
  root.appendChild(tools);
};

window.saveFrameDetailPlan=async function(id){
  try{
    const template=document.getElementById('detail-template')?.value||'unset';
    const mode=document.getElementById('mode')?.value||'new';
    const memo=document.getElementById('analysis-memo')?.value||'';
    await api('/api/plans',{method:'POST',body:{action:'memo',id,memo,mode,template}});
    const p=(planCache||[]).find(x=>x.id===id);
    if(p){p.memo=memo;p.mode=mode;p.template=template}
    toast('プラン設定を保存しました');
  }catch(e){toast(e.message)}
};

window.deleteFrameDetailPlan=async function(id){
  if(!confirm('このプランを削除しますか？'))return;
  try{
    await api('/api/plans',{method:'POST',body:{action:'delete',id}});
    planCache=(planCache||[]).filter(x=>x.id!==id);
    toast('プランを削除しました');
    const root=document.getElementById('analysis');
    if(root)root.innerHTML='<div class="empty">プランを削除しました。候補一覧から別の銘柄を選んでください。</div>';
    if(typeof frameShowBoard==='function')frameShowBoard();
  }catch(e){toast(e.message)}
};

const guide=document.querySelector('#tab-guide .card');
if(guide&&!document.getElementById('action-guide-note')){
  const note=document.createElement('div');
  note.id='action-guide-note';
  note.className='note';
  note.innerHTML='<b>仕掛け順：</b>候補一覧で銘柄を探し、仕掛け順で「今日どれから確認するか」を決めます。条件成立・接近・待機・見送りを、次の価格水準までの距離で整理します。';
  guide.insertBefore(note,guide.children[2]||null);
}

console.info('FRAME action queue loaded',FRAME_ACTION_VERSION);
})();