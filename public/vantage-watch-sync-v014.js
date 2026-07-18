(()=>{
  const STATUS_LABEL={UNSET:'未設定',WAIT:'WAIT',READY:'READY',TRIGGERED:'TRIGGERED',INVALID:'INVALID'};
  const TEMPLATE_LABEL={unset:'条件未設定',reacceleration:'再加速待ち',reversal:'反転確認待ち',pullback_complete:'押し目完了待ち'};
  const MODE_BY_TEMPLATE={unset:'new',reacceleration:'new',reversal:'new',pullback_complete:'pullback'};
  const statusRank={TRIGGERED:0,READY:1,WAIT:2,INVALID:3,UNSET:4};

  const style=document.createElement('style');
  style.id='vantage-watch-sync-v014-style';
  style.textContent=`
    .sync-hero{display:grid;grid-template-columns:1fr repeat(4,minmax(82px,.35fr));gap:8px;align-items:stretch;margin-bottom:12px;padding:15px 16px;border-radius:18px;background:linear-gradient(135deg,#162338,#243653);color:#fff;box-shadow:0 10px 28px rgba(24,34,51,.15)}
    .sync-hero h2{margin:0;font-size:17px}.sync-hero p{margin:4px 0 0;color:#c9d5e7;font-size:10px;line-height:1.55}.sync-kpi{padding:9px;border:1px solid rgba(255,255,255,.13);border-radius:12px;background:rgba(255,255,255,.08);text-align:center}.sync-kpi b{display:block;font:900 17px ui-monospace,monospace}.sync-kpi span{display:block;font-size:9px;color:#cad5e5;margin-top:2px}
    .sync-section-note{margin:7px 0 10px;padding:9px 11px;border:1px solid #dce5ec;border-radius:11px;background:#f7f9fb;color:#5d6b7d;font-size:10px;line-height:1.6}.sync-section-note b{color:#203047}
    .plan-row.sync-linked{border-left:4px solid #0f8b78;padding-left:12px}.plan-row.sync-detached{border-left:4px solid #9aa5b4;padding-left:12px}.sync-link-badge,.sync-template,.sync-status,.sync-auto-badge{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:900}.sync-link-badge{background:#dff3ef;color:#087565}.sync-link-badge.detached{background:#edf0f4;color:#667385}.sync-template{background:#e8eef9;color:#395c8e}.sync-status{background:#edf1f6;color:#596579}.sync-status.UNSET{background:#f0eafa;color:#6a52a1}.sync-status.READY{background:#e1ebff;color:#245fc2}.sync-status.TRIGGERED{background:#dff3e9;color:#157a50}.sync-status.INVALID{background:#fde3e7;color:#b4253f}.sync-status.WAIT{background:#fff0d4;color:#9b6700}.sync-auto-badge{background:#e8f5f2;color:#087568}
    .vantage-memo{margin:7px 0;padding:8px 10px;border-radius:10px;background:#eef8f6;color:#47645f;font-size:10px;line-height:1.55}.plan-config-note,.auto-analysis-note{margin-top:7px;color:#6a7687;font-size:10px}.auto-analysis-note.error{color:#b4253f}.template-select{border:1px solid #cbd2dd;background:#fff;border-radius:9px;padding:7px 9px;color:#39455a;font-weight:700}
    @media(max-width:720px){.sync-hero{grid-template-columns:repeat(2,1fr)}.sync-hero>div:first-child{grid-column:1/-1}.sync-kpi{min-width:0}}
  `;
  document.head.appendChild(style);

  const version=document.querySelector('.version');if(version)version.textContent='UI v0.14';
  const planTab=document.querySelector('[data-tab="plans"] span');if(planTab)planTab.textContent='監視・プラン';
  const guide=document.querySelector('#tab-guide .card');
  if(guide&&!document.getElementById('sync-guide-note')){
    const note=document.createElement('div');note.id='sync-guide-note';note.className='note';
    note.innerHTML='<b>VANTAGE自動同期：</b>VANTAGEウォッチの最新情報を受けると、FRAMEが月足・週足・日足を自動再分析し、WAIT／READY／TRIGGERED／INVALIDを更新します。メモ・テンプレート・連携解除後の履歴は保持します。';
    guide.insertBefore(note,guide.children[2]||null);
  }

  const configured=p=>{if(p?.plan_configured===true)return true;if(p?.plan_configured===false)return false;return Boolean(p?.diagnosis||p?.phase||p?.entries||String(p?.memo||'').trim())};
  const hasAuto=p=>Boolean(p?.auto_analyzed_at);
  const statusOf=p=>(configured(p)||hasAuto(p))?String(p.entry_status||p.status||'WAIT').toUpperCase():'UNSET';
  const templateOf=p=>p?.template||({A:'reacceleration',B:'reversal',C:'pullback_complete'}[String(p?.source_context?.lane||p?.vantage_lane||'').toUpperCase()]||'unset');
  const displayDate=v=>{const d=new Date(v||0);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ja-JP')};
  const displayTime=v=>{const d=new Date(v||0);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})};
  const templateOptions=p=>Object.entries(TEMPLATE_LABEL).map(([v,l])=>`<option value="${v}" ${templateOf(p)===v?'selected':''}>${l}</option>`).join('');

  function card(p){
    const e=p.entries||{},status=statusOf(p),template=templateOf(p),linked=!!p.linked_to_vantage,detached=p.vantage_link_state==='detached',auto=hasAuto(p);
    const linkBadge=linked?'<span class="sync-link-badge">VANTAGE連携中</span>':detached?'<span class="sync-link-badge detached">VANTAGE連携解除</span>':'';
    const autoBadge=auto?'<span class="sync-auto-badge">自動分析</span>':'';
    const context=p.source_context?`<div class="muted">VANTAGE ${esc(p.source_context.propagation||'')} / 候補 ${esc(p.source_context.lane||p.vantage_lane||'—')} / ${esc(p.source_context.risk||'')}</div>`:'';
    const memo=p.vantage_memo?`<div class="vantage-memo"><b>VANTAGE登録時メモ</b><br>${esc(p.vantage_memo)}</div>`:'';
    const prices=(auto||configured(p))&&p.entries?`<div class="muted">打診 ${fmt(e.probe?.price,4)} / 標準 ${fmt(e.standard?.price??p.entry?.price,4)} / 追加 ${fmt(e.add?.price,4)}</div>`:'<div class="plan-config-note">最新データの自動分析待ちです。</div>';
    const autoNote=p.auto_analysis_error?`<div class="auto-analysis-note error">自動分析失敗：${esc(p.auto_analysis_error)}</div>`:auto?`<div class="auto-analysis-note">FRAME自動分析 ${displayTime(p.auto_analyzed_at)}${p.source_context?.price_time?' / VANTAGE更新 '+displayTime(p.source_context.price_time):''}</div>`:'';
    const configNote=!configured(p)&&auto?'<div class="plan-config-note">判定は自動更新中です。テンプレートやメモを保存すると、VANTAGEから外した後も独立プランとして残ります。</div>':'';
    const deleteButton=linked&&!configured(p)?'':` <button class="secondary danger" onclick="deletePlan('${attr(p.id)}')">削除</button>`;
    return `<div class="plan-row ${linked?'sync-linked':detached?'sync-detached':''}"><div class="plan-top"><div><div class="plan-name">${esc(p.name)} <span class="code">${esc(p.symbol)}</span></div><div class="plan-badges">${linkBadge}${autoBadge}<span class="sync-template">${esc(TEMPLATE_LABEL[template]||template)}</span><span class="sync-status ${status}">${esc(STATUS_LABEL[status]||status)}</span>${p.phase?`<span class="phase-badge ${esc(p.phase.code)}">${esc(p.phase.label)}</span>`:''}</div><div class="muted">${esc(p.diagnosis||'')} ${p.updated_at?'· 更新 '+displayDate(p.updated_at):''}</div>${context}${autoNote}${memo}${prices}${configNote}</div><div><button class="secondary" onclick="loadPlanById('${attr(p.id)}')">${configured(p)?'今すぐ再分析':'条件を設定'}</button>${deleteButton}</div></div><textarea id="memo-${attr(p.id)}" class="memo" style="min-height:58px;margin-top:9px" placeholder="プランメモ">${esc(p.memo||'')}</textarea><div class="actions"><select id="template-${attr(p.id)}" class="template-select">${templateOptions(p)}</select><select id="mode-${attr(p.id)}" class="secondary"><option value="new" ${p.mode==='new'?'selected':''}>新規</option><option value="pullback" ${p.mode==='pullback'?'selected':''}>押し目</option><option value="hold" ${p.mode==='hold'?'selected':''}>長期保有</option></select><button class="secondary" onclick="savePlanMemo('${attr(p.id)}')">設定・メモ保存</button></div></div>`;
  }

  window.renderPlans=function(plans){
    plans=[...(plans||[])].sort((a,b)=>(statusRank[statusOf(a)]??9)-(statusRank[statusOf(b)]??9)||String(b.auto_analyzed_at||b.updated_at||'').localeCompare(String(a.auto_analyzed_at||a.updated_at||'')));
    const linked=plans.filter(x=>x.linked_to_vantage),detached=plans.filter(x=>!x.linked_to_vantage),counts={UNSET:0,WAIT:0,READY:0,TRIGGERED:0,INVALID:0};for(const p of linked)counts[statusOf(p)]=(counts[statusOf(p)]||0)+1;
    const errors=linked.filter(x=>x.auto_analysis_error).length,pending=linked.filter(x=>!x.auto_analyzed_at&&!x.auto_analysis_error).length;
    let html=`<div class="sync-hero"><div><h2>VANTAGEウォッチ連携</h2><p>VANTAGEの最新ウォッチ情報を受けるたびにFRAMEが自動再分析します。再分析ボタンは今すぐ取り直すための手動更新です。</p></div><div class="sync-kpi"><b>${linked.length}</b><span>連携銘柄</span></div><div class="sync-kpi"><b>${pending}</b><span>分析待ち</span></div><div class="sync-kpi"><b>${counts.READY+counts.TRIGGERED}</b><span>READY以上</span></div><div class="sync-kpi"><b>${errors||counts.INVALID}</b><span>${errors?'取得エラー':'INVALID'}</span></div></div>`;
    html+='<div class="sync-section-note"><b>自動更新：</b>VANTAGEの価格時刻・基準日・市場差RSなどが変わるとFRAME自身の分析エンジンを再実行します。手書きメモ、テンプレート、保存済みプランは上書きしません。</div>';
    html+=`<div class="section-title">VANTAGEウォッチ ${linked.length}件</div>${linked.length?`<div class="card">${linked.map(card).join('')}</div>`:'<div class="empty">VANTAGEウォッチを同期すると、ここへ自動表示されます。</div>'}`;
    html+=`<div class="section-title">独立プラン・連携解除 ${detached.length}件</div>${detached.length?`<div class="card">${detached.map(card).join('')}</div>`:'<div class="empty">独立プランはありません。</div>'}`;
    $('plans').innerHTML=html;
  };

  window.loadPlanById=function(id){
    const p=planCache.find(x=>x.id===id);if(!p)return;
    switchTab('analyze');vantageContext=p.source_context||null;renderVantageContext();$('market').value=p.market;
    const template=templateOf(p);$('mode').value=p.mode||MODE_BY_TEMPLATE[template]||'new';$('symbol').value=p.symbol;
    analyze().then(()=>{const e=$('analysis-memo');if(e)e.value=p.memo||''});
  };

  window.savePlanMemo=async function(id){
    try{
      const template=$(`template-${id}`)?.value||'unset',mode=$(`mode-${id}`)?.value||MODE_BY_TEMPLATE[template]||'new';
      await api('/api/plans',{method:'POST',body:{action:'memo',id,memo:$(`memo-${id}`)?.value||'',mode,template}});
      toast('設定とメモを保存しました');loadPlans();
    }catch(e){toast(e.message)}
  };
})();
