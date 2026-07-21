(()=>{
  const STATUS_LABEL={UNSET:'分析待ち',WAIT:'待機',READY:'接近',TRIGGERED:'条件成立',INVALID:'無効'};
  const TEMPLATE_LABEL={unset:'条件未設定',reacceleration:'再加速待ち',reversal:'反転確認待ち',pullback_complete:'押し目完了待ち'};
  const MODE_BY_TEMPLATE={unset:'new',reacceleration:'new',reversal:'new',pullback_complete:'pullback'};
  const statusRank={TRIGGERED:0,READY:1,WAIT:2,INVALID:3,UNSET:4};
  let boardFilter='focus',boardQuery='';

  const style=document.createElement('style');
  style.id='vantage-watch-sync-v015-style';
  style.textContent=`
    .frame-candidate-board{margin-bottom:14px}.candidate-hero{display:grid;grid-template-columns:1fr repeat(4,minmax(78px,.32fr));gap:8px;align-items:stretch;padding:16px;border-radius:18px;background:linear-gradient(135deg,#142239,#253a5b);color:#fff;box-shadow:0 11px 30px rgba(24,34,51,.16)}.candidate-hero h2{margin:0;font-size:18px}.candidate-hero p{margin:5px 0 0;color:#cad7e8;font-size:10px;line-height:1.6}.candidate-kpi{display:grid;place-items:center;padding:9px;border:1px solid rgba(255,255,255,.13);border-radius:12px;background:rgba(255,255,255,.08);text-align:center}.candidate-kpi b{display:block;font:900 18px ui-monospace,monospace}.candidate-kpi span{display:block;font-size:9px;color:#d1dbea;margin-top:2px}.candidate-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:10px 0}.candidate-toolbar input{flex:1;min-width:190px;border:1px solid #cbd2dd;background:#fff;border-radius:10px;padding:9px 11px}.board-filter{border:1px solid #ccd4df;background:#fff;color:#526075;border-radius:999px;padding:7px 11px;font-size:10px;font-weight:800;cursor:pointer}.board-filter.active{background:#172237;border-color:#172237;color:#fff}.candidate-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.candidate-card{position:relative;border:1px solid #dbe2ea;border-left:5px solid #9aa5b4;border-radius:15px;background:#fff;padding:13px;box-shadow:0 3px 12px rgba(24,34,51,.045);cursor:pointer;text-align:left;color:inherit;transition:.15s}.candidate-card:hover{transform:translateY(-1px);border-color:#bdc9d8;box-shadow:0 8px 20px rgba(24,34,51,.08)}.candidate-card.TRIGGERED{border-left-color:#178159}.candidate-card.READY{border-left-color:#2d6fd2}.candidate-card.WAIT{border-left-color:#c58a24}.candidate-card.INVALID{border-left-color:#c63249}.candidate-card-head{display:flex;align-items:flex-start;gap:7px}.candidate-card-name{font-size:14px;font-weight:900;line-height:1.4}.candidate-card-code{font:10px ui-monospace,monospace;color:#718096}.candidate-card-status{margin-left:auto;flex:none;border-radius:999px;padding:4px 8px;font-size:9px;font-weight:900;background:#edf1f6;color:#596579}.candidate-card-status.TRIGGERED{background:#dff3e9;color:#157a50}.candidate-card-status.READY{background:#e1ebff;color:#245fc2}.candidate-card-status.WAIT{background:#fff0d4;color:#9b6700}.candidate-card-status.INVALID{background:#fde3e7;color:#b4253f}.candidate-card-badges{display:flex;gap:5px;flex-wrap:wrap;margin:7px 0}.candidate-card-badges span{display:inline-flex;border-radius:999px;padding:3px 7px;font-size:9px;font-weight:800;background:#edf1f6;color:#596579}.candidate-card-badges .theme{background:#dff3ef;color:#087565}.candidate-card-badges .phase{background:#e8eef9;color:#395c8e}.candidate-card-diagnosis{font-size:11px;color:#4f5c6e;line-height:1.55;min-height:34px}.candidate-card-prices{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:9px}.candidate-card-prices div{padding:7px;border:1px solid #e1e6ed;border-radius:9px;background:#f8fafc}.candidate-card-prices span{display:block;font-size:8px;color:#788395}.candidate-card-prices b{display:block;font:800 12px ui-monospace,monospace;margin-top:2px}.candidate-card-foot{display:flex;align-items:center;gap:7px;margin-top:8px;font-size:9px;color:#7a8595}.candidate-card-foot .open-detail{margin-left:auto;color:#245fc2;font-weight:900}.manual-analysis-label{display:flex;align-items:center;gap:8px;margin:15px 2px 7px;font-size:12px;font-weight:900;color:#566275}.manual-analysis-label span{font-size:10px;font-weight:500;color:#7a8595}.analysis-nav{display:flex;align-items:center;gap:8px;margin:4px 0 10px}.analysis-nav button{border:1px solid #cad3df;background:#fff;border-radius:10px;padding:8px 11px;color:#445268;font-weight:800;cursor:pointer}.analysis-nav span{font-size:10px;color:#788395}.recent{display:block}.recent-title{font-size:10px;font-weight:900;color:#657184;margin:10px 0 6px}.recent-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.recent-card{border:1px solid #d7dee7;background:#fff;border-radius:11px;padding:8px 9px;text-align:left;color:#3f4d62;cursor:pointer}.recent-card b{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.recent-card small{display:block;margin-top:2px;font:9px ui-monospace,monospace;color:#7b8797}.sync-hero{display:grid;grid-template-columns:1fr repeat(4,minmax(82px,.35fr));gap:8px;align-items:stretch;margin-bottom:12px;padding:15px 16px;border-radius:18px;background:linear-gradient(135deg,#162338,#243653);color:#fff;box-shadow:0 10px 28px rgba(24,34,51,.15)}.sync-hero h2{margin:0;font-size:17px}.sync-hero p{margin:4px 0 0;color:#c9d5e7;font-size:10px;line-height:1.55}.sync-kpi{padding:9px;border:1px solid rgba(255,255,255,.13);border-radius:12px;background:rgba(255,255,255,.08);text-align:center}.sync-kpi b{display:block;font:900 17px ui-monospace,monospace}.sync-kpi span{display:block;font-size:9px;color:#cad5e5;margin-top:2px}.sync-section-note{margin:7px 0 10px;padding:9px 11px;border:1px solid #dce5ec;border-radius:11px;background:#f7f9fb;color:#5d6b7d;font-size:10px;line-height:1.6}.sync-section-note b{color:#203047}.plan-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.plan-manage-card{border:1px solid #dce3eb;border-left:4px solid #9aa5b4;border-radius:14px;background:#fff;padding:12px;box-shadow:0 3px 12px rgba(24,34,51,.04)}.plan-manage-card.sync-linked{border-left-color:#0f8b78}.plan-manage-card.sync-detached{border-left-color:#9aa5b4}.plan-manage-head{display:flex;align-items:flex-start;gap:7px}.plan-manage-head .plan-name{flex:1}.plan-manage-actions{display:flex;gap:5px;margin-top:9px}.plan-manage-actions button{flex:1}.plan-config{margin-top:9px;border-top:1px solid #e6eaf0;padding-top:8px}.plan-config summary{cursor:pointer;font-size:10px;font-weight:900;color:#596579}.plan-config-body{padding-top:8px}.sync-link-badge,.sync-template,.sync-status,.sync-auto-badge{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:9px;font-weight:900}.sync-link-badge{background:#dff3ef;color:#087565}.sync-link-badge.detached{background:#edf0f4;color:#667385}.sync-template{background:#e8eef9;color:#395c8e}.sync-status{background:#edf1f6;color:#596579}.sync-status.UNSET{background:#f0eafa;color:#6a52a1}.sync-status.READY{background:#e1ebff;color:#245fc2}.sync-status.TRIGGERED{background:#dff3e9;color:#157a50}.sync-status.INVALID{background:#fde3e7;color:#b4253f}.sync-status.WAIT{background:#fff0d4;color:#9b6700}.sync-auto-badge{background:#e8f5f2;color:#087568}.vantage-memo{margin:7px 0;padding:8px 10px;border-radius:10px;background:#eef8f6;color:#47645f;font-size:10px;line-height:1.55}.plan-config-note,.auto-analysis-note{margin-top:7px;color:#6a7687;font-size:10px}.auto-analysis-note.error{color:#b4253f}.template-select{border:1px solid #cbd2dd;background:#fff;border-radius:9px;padding:7px 9px;color:#39455a;font-weight:700}
    @media(max-width:760px){.candidate-grid,.plan-card-grid{grid-template-columns:1fr}.candidate-hero,.sync-hero{grid-template-columns:repeat(2,1fr)}.candidate-hero>div:first-child,.sync-hero>div:first-child{grid-column:1/-1}.recent-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);

  const version=document.querySelector('.version');if(version)version.textContent='UI v0.15';
  const analyzeTab=document.querySelector('[data-tab="analyze"] span');if(analyzeTab)analyzeTab.textContent='候補・分析';
  const planTab=document.querySelector('[data-tab="plans"] span');if(planTab)planTab.textContent='管理';
  const flow=document.querySelector('.frame-flow');if(flow)flow.innerHTML='<span><i>1</i>候補を選ぶ</span><b>›</b><span><i>2</i>局面確認</span><b>›</b><span><i>3</i>打診・標準・追加</span><b>›</b><span><i>4</i>プラン管理</span>';

  const configured=p=>{if(p?.plan_configured===true)return true;if(p?.plan_configured===false)return false;return Boolean(p?.diagnosis||p?.phase||p?.entries||String(p?.memo||'').trim())};
  const hasAuto=p=>Boolean(p?.auto_analyzed_at);
  const statusOf=p=>(configured(p)||hasAuto(p))?String(p.entry_status||p.status||'WAIT').toUpperCase():'UNSET';
  const templateOf=p=>p?.template||({A:'reacceleration',B:'reversal',C:'pullback_complete'}[String(p?.source_context?.lane||p?.vantage_lane||'').toUpperCase()]||'unset');
  const displayDate=v=>{const d=new Date(v||0);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ja-JP')};
  const displayTime=v=>{const d=new Date(v||0);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})};
  const templateOptions=p=>Object.entries(TEMPLATE_LABEL).map(([v,l])=>`<option value="${v}" ${templateOf(p)===v?'selected':''}>${l}</option>`).join('');
  const priceText=(v,m)=>v==null||!Number.isFinite(Number(v))?'—':m==='jp'?fmt(v,0)+'円':'$'+fmt(v,2);

  function injectCandidateBoard(){
    const tab=document.getElementById('tab-analyze');if(!tab||document.getElementById('frame-candidate-board'))return;
    const searchCard=tab.querySelector(':scope > .card');if(!searchCard)return;
    const board=document.createElement('section');board.id='frame-candidate-board';board.className='frame-candidate-board';
    board.innerHTML='<div class="loading">VANTAGE連携候補を取得中…</div>';
    tab.insertBefore(board,searchCard);
    const label=document.createElement('div');label.className='manual-analysis-label';label.innerHTML='銘柄コードで個別分析 <span>一覧にない銘柄を確認するときだけ使います</span>';
    tab.insertBefore(label,searchCard);
  }

  function recentItems(){
    try{return JSON.parse(localStorage.getItem('frame_recent')||'[]')}catch{return[]}
  }
  addRecent=function(m,s){
    const d=current||{},item={market:m,symbol:s,name:d.name||s,mode:document.getElementById('mode')?.value||'new',status:d.entry_status||'',phase:d.phase?.label||'',viewed_at:new Date().toISOString()};
    const next=[item,...recentItems().filter(v=>!(v.market===m&&v.symbol===s))].slice(0,8);
    localStorage.setItem('frame_recent',JSON.stringify(next));renderRecent();
  };
  renderRecent=function(){
    const root=document.getElementById('recent');
    if(!root)return;
    const items=recentItems();
    if(!items.length){root.innerHTML='';return}
    const cards=items.map(x=>{
      const plan=planCache.find(p=>p.market===x.market&&String(p.symbol).replace(/\.T$/,'')===String(x.symbol).replace(/\.T$/,''));
      const name=x.name&&x.name!==x.symbol?x.name:(plan?.name||x.symbol);
      const phase=x.phase?` · ${esc(x.phase)}`:'';
      return `<button class="recent-card" onclick="runRecent('${x.market}','${attr(x.symbol)}','${attr(x.mode||'new')}')"><b>${esc(name)}</b><small>${x.market==='jp'?'JP':'US'} · ${esc(x.symbol)}${phase}</small></button>`;
    }).join('');
    root.innerHTML=`<div class="recent-title">最近見た銘柄</div><div class="recent-grid">${cards}</div>`;
  };
  runRecent=function(m,s,mode='new'){document.getElementById('market').value=m;document.getElementById('mode').value=mode;document.getElementById('symbol').value=s;analyze()};

  function boardMatches(p){
    const status=statusOf(p),q=boardQuery.trim().toLowerCase();
    if(boardFilter==='focus'&&!['TRIGGERED','READY'].includes(status))return false;
    if(boardFilter==='wait'&&status!=='WAIT')return false;
    if(boardFilter==='invalid'&&status!=='INVALID')return false;
    if(q){const text=[p.name,p.symbol,p.source_context?.theme,p.phase?.label,p.diagnosis].join(' ').toLowerCase();if(!text.includes(q))return false}
    return true;
  }

  function candidateCard(p){
    const status=statusOf(p),e=p.entries||{},theme=p.source_context?.theme||'',phase=p.phase?.label||'',market=p.market||'jp';
    const currentPrice=p.source_context?.price??p.current_price??null;
    return `<button class="candidate-card ${status}" onclick="openFrameCandidate('${attr(p.id)}')"><div class="candidate-card-head"><div><div class="candidate-card-name">${esc(p.name||p.symbol)}</div><div class="candidate-card-code">${market==='jp'?'JP':'US'} · ${esc(p.symbol)}</div></div><span class="candidate-card-status ${status}">${esc(STATUS_LABEL[status]||status)}</span></div><div class="candidate-card-badges">${theme?`<span class="theme">${esc(theme)}</span>`:''}${phase?`<span class="phase">${esc(phase)}</span>`:''}${p.source_context?.lane?`<span>候補 ${esc(p.source_context.lane)}</span>`:''}</div><div class="candidate-card-diagnosis">${esc(p.diagnosis||'FRAMEの自動分析待ち')}</div><div class="candidate-card-prices"><div><span>現在</span><b>${priceText(currentPrice,market)}</b></div><div><span>打診</span><b>${priceText(e.probe?.price,market)}</b></div><div><span>標準</span><b>${priceText(e.standard?.price??p.entry?.price,market)}</b></div></div><div class="candidate-card-foot"><span>${p.auto_analyzed_at?'分析 '+displayTime(p.auto_analyzed_at):'更新 '+displayDate(p.updated_at)}</span><span class="open-detail">セットアップを見る ›</span></div></button>`;
  }

  function renderCandidateBoard(){
    const root=document.getElementById('frame-candidate-board');if(!root)return;
    const all=[...(planCache||[])].sort((a,b)=>(statusRank[statusOf(a)]??9)-(statusRank[statusOf(b)]??9)||String(b.auto_analyzed_at||b.updated_at||'').localeCompare(String(a.auto_analyzed_at||a.updated_at||'')));
    const counts={TRIGGERED:0,READY:0,WAIT:0,INVALID:0,UNSET:0};for(const p of all)counts[statusOf(p)]=(counts[statusOf(p)]||0)+1;
    const shown=all.filter(boardMatches);
    root.innerHTML=`<div class="candidate-hero"><div><h2>個別セットアップ候補</h2><p>VANTAGEで選んだ銘柄を、FRAMEの価格局面とエントリー条件で並べ替えます。銘柄カードを押すと、現在の詳細分析へ移動します。</p></div><div class="candidate-kpi"><b>${counts.TRIGGERED}</b><span>条件成立</span></div><div class="candidate-kpi"><b>${counts.READY}</b><span>接近</span></div><div class="candidate-kpi"><b>${counts.WAIT}</b><span>待機</span></div><div class="candidate-kpi"><b>${counts.INVALID}</b><span>無効</span></div></div><div class="candidate-toolbar"><input value="${esc(boardQuery)}" oninput="setFrameBoardQuery(this.value)" placeholder="銘柄名・コード・テーマで絞り込み"><button class="board-filter ${boardFilter==='focus'?'active':''}" onclick="setFrameBoardFilter('focus')">今見る</button><button class="board-filter ${boardFilter==='wait'?'active':''}" onclick="setFrameBoardFilter('wait')">待機</button><button class="board-filter ${boardFilter==='invalid'?'active':''}" onclick="setFrameBoardFilter('invalid')">無効</button><button class="board-filter ${boardFilter==='all'?'active':''}" onclick="setFrameBoardFilter('all')">すべて</button></div>${shown.length?`<div class="candidate-grid">${shown.map(candidateCard).join('')}</div>`:'<div class="empty">この条件に該当する候補はありません。</div>'}`;
    renderRecent();
  }

  window.setFrameBoardFilter=v=>{boardFilter=v;renderCandidateBoard()};
  window.setFrameBoardQuery=v=>{boardQuery=v;renderCandidateBoard()};
  window.openFrameCandidate=id=>{loadPlanById(id)};
  window.frameShowBoard=()=>{document.getElementById('frame-candidate-board')?.scrollIntoView({behavior:'smooth',block:'start'})};

  async function loadCandidateBoard(){
    const root=document.getElementById('frame-candidate-board');if(root&&!(planCache||[]).length)root.innerHTML='<div class="loading">VANTAGE連携候補を取得中…</div>';
    try{const d=await api('/api/plans');planCache=d.plans||[];renderCandidateBoard()}catch(e){if(root)root.innerHTML=`<div class="card down">${esc(e.message)}</div>`}
  }

  const baseRenderAnalysis=renderAnalysis;
  renderAnalysis=function(d){
    baseRenderAnalysis(d);
    const root=document.getElementById('analysis');if(!root)return;
    const nav=document.createElement('div');nav.className='analysis-nav';nav.innerHTML='<button onclick="frameShowBoard()">‹ 候補一覧へ</button><span>詳細を確認後、別のカードを選べます</span>';
    root.prepend(nav);
    setTimeout(()=>root.scrollIntoView({behavior:'smooth',block:'start'}),0);
  };

  function manageCard(p){
    const e=p.entries||{},status=statusOf(p),template=templateOf(p),linked=!!p.linked_to_vantage,detached=p.vantage_link_state==='detached',auto=hasAuto(p);
    const linkBadge=linked?'<span class="sync-link-badge">VANTAGE連携中</span>':detached?'<span class="sync-link-badge detached">連携解除</span>':'';
    const autoBadge=auto?'<span class="sync-auto-badge">自動分析</span>':'';
    const memo=p.vantage_memo?`<div class="vantage-memo"><b>VANTAGE登録時メモ</b><br>${esc(p.vantage_memo)}</div>`:'';
    const autoNote=p.auto_analysis_error?`<div class="auto-analysis-note error">自動分析失敗：${esc(p.auto_analysis_error)}</div>`:auto?`<div class="auto-analysis-note">FRAME自動分析 ${displayTime(p.auto_analyzed_at)}</div>`:'';
    const deleteButton=linked&&!configured(p)?'':`<button class="secondary danger" onclick="deletePlan('${attr(p.id)}')">削除</button>`;
    return `<article class="plan-manage-card ${linked?'sync-linked':detached?'sync-detached':''}"><div class="plan-manage-head"><div class="plan-name">${esc(p.name)} <span class="code">${esc(p.symbol)}</span></div><span class="sync-status ${status}">${esc(STATUS_LABEL[status]||status)}</span></div><div class="plan-badges">${linkBadge}${autoBadge}<span class="sync-template">${esc(TEMPLATE_LABEL[template]||template)}</span>${p.phase?`<span class="phase-badge ${esc(p.phase.code)}">${esc(p.phase.label)}</span>`:''}</div><div class="muted">${esc(p.diagnosis||'分析待ち')}</div>${autoNote}${memo}<div class="muted">打診 ${fmt(e.probe?.price,4)} / 標準 ${fmt(e.standard?.price??p.entry?.price,4)} / 追加 ${fmt(e.add?.price,4)}</div><div class="plan-manage-actions"><button class="primary" onclick="loadPlanById('${attr(p.id)}')">セットアップを見る</button>${deleteButton}</div><details class="plan-config"><summary>テンプレート・メモを編集</summary><div class="plan-config-body"><textarea id="memo-${attr(p.id)}" class="memo" style="min-height:58px" placeholder="プランメモ">${esc(p.memo||'')}</textarea><div class="actions"><select id="template-${attr(p.id)}" class="template-select">${templateOptions(p)}</select><select id="mode-${attr(p.id)}" class="secondary"><option value="new" ${p.mode==='new'?'selected':''}>新規</option><option value="pullback" ${p.mode==='pullback'?'selected':''}>押し目</option><option value="hold" ${p.mode==='hold'?'selected':''}>長期保有</option></select><button class="secondary" onclick="savePlanMemo('${attr(p.id)}')">保存</button></div></div></details></article>`;
  }

  window.renderPlans=function(plans){
    plans=[...(plans||[])].sort((a,b)=>(statusRank[statusOf(a)]??9)-(statusRank[statusOf(b)]??9)||String(b.auto_analyzed_at||b.updated_at||'').localeCompare(String(a.auto_analyzed_at||a.updated_at||'')));
    planCache=plans;const linked=plans.filter(x=>x.linked_to_vantage),detached=plans.filter(x=>!x.linked_to_vantage),counts={WAIT:0,READY:0,TRIGGERED:0,INVALID:0,UNSET:0};for(const p of linked)counts[statusOf(p)]=(counts[statusOf(p)]||0)+1;
    let html=`<div class="sync-hero"><div><h2>候補とプランの管理</h2><p>日々見る画面は「候補・分析」です。ここではテンプレート、メモ、VANTAGE連携、独立プランを管理します。</p></div><div class="sync-kpi"><b>${linked.length}</b><span>連携銘柄</span></div><div class="sync-kpi"><b>${counts.TRIGGERED}</b><span>条件成立</span></div><div class="sync-kpi"><b>${counts.READY}</b><span>接近</span></div><div class="sync-kpi"><b>${detached.length}</b><span>独立プラン</span></div></div>`;
    html+='<div class="sync-section-note"><b>使い分け：</b>候補カードからセットアップを見るのが通常運用です。ここはメモ・テンプレート変更や不要プランの削除に使います。</div>';
    html+=`<div class="section-title">VANTAGE連携 ${linked.length}件</div>${linked.length?`<div class="plan-card-grid">${linked.map(manageCard).join('')}</div>`:'<div class="empty">VANTAGEウォッチを同期すると表示されます。</div>'}`;
    html+=`<div class="section-title">独立プラン・連携解除 ${detached.length}件</div>${detached.length?`<div class="plan-card-grid">${detached.map(manageCard).join('')}</div>`:'<div class="empty">独立プランはありません。</div>'}`;
    document.getElementById('plans').innerHTML=html;renderCandidateBoard();
  };

  window.loadPlanById=function(id){
    const p=planCache.find(x=>x.id===id);if(!p)return;
    switchTab('analyze');vantageContext=p.source_context||null;renderVantageContext();document.getElementById('market').value=p.market;
    const template=templateOf(p);document.getElementById('mode').value=p.mode||MODE_BY_TEMPLATE[template]||'new';document.getElementById('symbol').value=p.symbol;
    analyze().then(()=>{const e=document.getElementById('analysis-memo');if(e)e.value=p.memo||''});
  };

  window.savePlanMemo=async function(id){
    try{const template=document.getElementById(`template-${id}`)?.value||'unset',mode=document.getElementById(`mode-${id}`)?.value||MODE_BY_TEMPLATE[template]||'new';await api('/api/plans',{method:'POST',body:{action:'memo',id,memo:document.getElementById(`memo-${id}`)?.value||'',mode,template}});toast('設定とメモを保存しました');loadPlans();loadCandidateBoard()}catch(e){toast(e.message)}
  };

  const baseSavePlan=savePlan;
  savePlan=async function(){await baseSavePlan();setTimeout(loadCandidateBoard,250)};

  const guide=document.querySelector('#tab-guide .card');if(guide&&!document.getElementById('sync-guide-note')){const note=document.createElement('div');note.id='sync-guide-note';note.className='note';note.innerHTML='<b>通常の使い方：</b>「候補・分析」で条件成立・接近カードを選び、セットアップ詳細で局面、打診・標準・追加、無効化条件を確認します。コード検索は一覧にない銘柄だけに使います。';guide.insertBefore(note,guide.children[2]||null)}
  injectCandidateBoard();renderRecent();loadCandidateBoard();
})();
