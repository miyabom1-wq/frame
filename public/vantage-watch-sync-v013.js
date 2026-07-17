(()=>{
  const STATUS_LABEL={UNSET:'未設定',WAIT:'WAIT',READY:'READY',TRIGGERED:'TRIGGERED',INVALID:'INVALID'};
  const TEMPLATE_LABEL={unset:'条件未設定',reacceleration:'再加速待ち',reversal:'反転確認待ち',pullback_complete:'押し目完了待ち'};
  const MODE_BY_TEMPLATE={unset:'new',reacceleration:'new',reversal:'new',pullback_complete:'pullback'};
  const statusRank={UNSET:0,TRIGGERED:1,READY:2,WAIT:3,INVALID:4};

  const style=document.createElement('style');
  style.id='vantage-watch-sync-v013-style';
  style.textContent=`
    .sync-hero{display:grid;grid-template-columns:1fr repeat(4,minmax(82px,.35fr));gap:8px;align-items:stretch;margin-bottom:12px;padding:15px 16px;border-radius:18px;background:linear-gradient(135deg,#162338,#243653);color:#fff;box-shadow:0 10px 28px rgba(24,34,51,.15)}
    .sync-hero h2{margin:0;font-size:17px}.sync-hero p{margin:4px 0 0;color:#c9d5e7;font-size:10px;line-height:1.55}.sync-kpi{padding:9px;border:1px solid rgba(255,255,255,.13);border-radius:12px;background:rgba(255,255,255,.08);text-align:center}.sync-kpi b{display:block;font:900 17px ui-monospace,monospace}.sync-kpi span{display:block;font-size:9px;color:#cad5e5;margin-top:2px}
    .sync-section-note{margin:7px 0 10px;padding:9px 11px;border:1px solid #dce5ec;border-radius:11px;background:#f7f9fb;color:#5d6b7d;font-size:10px;line-height:1.6}.sync-section-note b{color:#203047}
    .plan-row.sync-linked{border-left:4px solid #0f8b78;padding-left:12px}.plan-row.sync-detached{border-left:4px solid #9aa5b4;padding-left:12px}.sync-link-badge,.sync-template,.sync-status{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:900}.sync-link-badge{background:#dff3ef;color:#087565}.sync-link-badge.detached{background:#edf0f4;color:#667385}.sync-template{background:#e8eef9;color:#395c8e}.sync-status{background:#edf1f6;color:#596579}.sync-status.UNSET{background:#f0eafa;color:#6a52a1}.sync-status.READY{background:#e1ebff;color:#245fc2}.sync-status.TRIGGERED{background:#dff3e9;color:#157a50}.sync-status.INVALID{background:#fde3e7;color:#b4253f}.sync-status.WAIT{background:#fff0d4;color:#9b6700}
    .vantage-memo{margin:7px 0;padding:8px 10px;border-radius:10px;background:#eef8f6;color:#47645f;font-size:10px;line-height:1.55}.plan-config-note{margin-top:7px;color:#6a7687;font-size:10px}.template-select{border:1px solid #cbd2dd;background:#fff;border-radius:9px;padding:7px 9px;color:#39455a;font-weight:700}
    @media(max-width:720px){.sync-hero{grid-template-columns:repeat(2,1fr)}.sync-hero>div:first-child{grid-column:1/-1}.sync-kpi{min-width:0}}
  `;
  document.head.appendChild(style);

  const version=document.querySelector('.version');if(version)version.textContent='UI v0.13';
  const planTab=document.querySelector('[data-tab="plans"] span');if(planTab)planTab.textContent='監視・プラン';
  const guide=document.querySelector('#tab-guide .card');
  if(guide&&!document.getElementById('sync-guide-note')){
    const note=document.createElement('div');note.id='sync-guide-note';note.className='note';
    note.innerHTML='<b>VANTAGE自動同期：</b>VANTAGEウォッチがマスターです。登録するとFRAMEへ未設定で現れ、Aは再加速待ち、Bは反転確認待ち、Cは押し目完了待ちを初期テンプレートにします。VANTAGEから削除しても、保存済みプランは「連携解除」として履歴を残します。';
    guide.insertBefore(note,guide.children[2]||null);
  }

  const configured=p=>p?.plan_configured===true||Boolean(p?.diagnosis||p?.phase||p?.entries||String(p?.memo||'').trim());
  const statusOf=p=>configured(p)?String(p.entry_status||p.status||'WAIT').toUpperCase():'UNSET';
  const templateOf=p=>p?.template||({A:'reacceleration',B:'reversal',C:'pullback_complete'}[String(p?.source_context?.lane||p?.vantage_lane||'').toUpperCase()]||'unset');
  const displayDate=v=>{const d=new Date(v||0);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ja-JP')};
  const templateOptions=p=>Object.entries(TEMPLATE_LABEL).map(([v,l])=>`<option value="${v}" ${templateOf(p)===v?'selected':''}>${l}</option>`).join('');

  function card(p){
    const e=p.entries||{},status=statusOf(p),template=templateOf(p),linked=!!p.linked_to_vantage,detached=p.vantage_link_state==='detached';
    const linkBadge=linked?'<span class="sync-link-badge">VANTAGE連携中</span>':detached?'<span class="sync-link-badge detached">VANTAGE連携解除</span>':'';
    const context=p.source_context?`<div class="muted">VANTAGE ${esc(p.source_context.propagation||'')} / 候補 ${esc(p.source_context.lane||p.vantage_lane||'—')} / ${esc(p.source_context.risk||'')}</div>`:'';
    const memo=p.vantage_memo?`<div class="vantage-memo"><b>VANTAGE登録時メモ</b><br>${esc(p.vantage_memo)}</div>`:'';
    const prices=configured(p)?`<div class="muted">打診 ${fmt(e.probe?.price,4)} / 標準 ${fmt(e.standard?.price??p.entry?.price,4)} / 追加 ${fmt(e.add?.price,4)}</div>`:'<div class="plan-config-note">同期済みですが、FRAMEの監視条件はまだ保存されていません。</div>';
    const deleteButton=linked&&!configured(p)?'':` <button class="secondary danger" onclick="deletePlan('${attr(p.id)}')">削除</button>`;
    return `<div class="plan-row ${linked?'sync-linked':detached?'sync-detached':''}"><div class="plan-top"><div><div class="plan-name">${esc(p.name)} <span class="code">${esc(p.symbol)}</span></div><div class="plan-badges">${linkBadge}<span class="sync-template">${esc(TEMPLATE_LABEL[template]||template)}</span><span class="sync-status ${status}">${esc(STATUS_LABEL[status]||status)}</span>${p.phase?`<span class="phase-badge ${esc(p.phase.code)}">${esc(p.phase.label)}</span>`:''}</div><div class="muted">${esc(p.diagnosis||'')} ${p.updated_at?'· 更新 '+displayDate(p.updated_at):''}</div>${context}${memo}${prices}</div><div><button class="secondary" onclick="loadPlanById('${attr(p.id)}')">${configured(p)?'再分析':'条件を設定'}</button>${deleteButton}</div></div><textarea id="memo-${attr(p.id)}" class="memo" style="min-height:58px;margin-top:9px" placeholder="プランメモ">${esc(p.memo||'')}</textarea><div class="actions"><select id="template-${attr(p.id)}" class="template-select">${templateOptions(p)}</select><select id="mode-${attr(p.id)}" class="secondary"><option value="new" ${p.mode==='new'?'selected':''}>新規</option><option value="pullback" ${p.mode==='pullback'?'selected':''}>押し目</option><option value="hold" ${p.mode==='hold'?'selected':''}>長期保有</option></select><button class="secondary" onclick="savePlanMemo('${attr(p.id)}')">設定・メモ保存</button></div></div>`;
  }

  window.renderPlans=function(plans){
    plans=[...(plans||[])].sort((a,b)=>(statusRank[statusOf(a)]??9)-(statusRank[statusOf(b)]??9)||String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
    const linked=plans.filter(x=>x.linked_to_vantage),detached=plans.filter(x=>!x.linked_to_vantage),counts={UNSET:0,WAIT:0,READY:0,TRIGGERED:0,INVALID:0};for(const p of linked)counts[statusOf(p)]=(counts[statusOf(p)]||0)+1;
    let html=`<div class="sync-hero"><div><h2>VANTAGEウォッチ連携</h2><p>銘柄の追跡はVANTAGE、条件と無効化はFRAMEで管理します。状態は最後に保存したFRAME分析です。</p></div><div class="sync-kpi"><b>${linked.length}</b><span>連携銘柄</span></div><div class="sync-kpi"><b>${counts.UNSET}</b><span>未設定</span></div><div class="sync-kpi"><b>${counts.READY+counts.TRIGGERED}</b><span>READY以上</span></div><div class="sync-kpi"><b>${counts.INVALID}</b><span>INVALID</span></div></div>`;
    html+='<div class="sync-section-note"><b>削除の扱い：</b>VANTAGEから外した未設定銘柄はFRAMEからも削除します。保存済みプランは削除せず「VANTAGE連携解除」として残します。</div>';
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
