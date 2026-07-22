(()=>{
const PAPER_URL='https://miyabom1-wq.github.io/paper/';
const kindLabel={probe:'打診',standard:'標準',add:'追加'};
function num(v){const x=Number(v);return Number.isFinite(x)?x:null}
function targetFor(kind,d,e){const price=num(e?.price),stop=num(e?.stop?.price);if(!(price>0))return null;let next=null;if(kind==='probe')next=num(d?.setup?.entries?.standard?.price);if(kind==='standard')next=num(d?.setup?.entries?.add?.price);if(next>price)return next;if(stop!=null&&stop<price)return price+(price-stop)*2;return null}
function paperParams(kind){
 const d=current,e=d?.setup?.entries?.[kind];if(!d||!e)return null;
 const vc=vantageContext||{},phase=d.phase?.label||'',theme=vc.theme||'',lane=vc.lane||'';
 const thesis=[e.rule,phase?`局面: ${phase}`:'',d.diagnosis?`診断: ${d.diagnosis}`:''].filter(Boolean).join(' / ');
 const invalid=[e.stop?.rule,d.setup?.invalidation].filter(Boolean).join(' / ');
 const q=new URLSearchParams({source:'frame',market:d.market,symbol:d.symbol,name:d.name||d.symbol,entry_type:kind,frame:e.state||d.entry_status||'READY',price:String(e.price??''),stop:String(e.stop?.price??''),target:String(targetFor(kind,d,e)??''),lane,regime:vc.risk||'',thesis,invalid,phase,theme,setup:e.rule||'',mode:document.getElementById('mode')?.value||'new'});
 return q;
}
window.openPaperEntry=function(kind){try{const q=paperParams(kind);if(!q){toast('FRAME分析後に利用できます');return}open(PAPER_URL+'?'+q.toString(),'_blank','noopener')}catch(err){console.error(err);toast('PAPER連携に失敗しました')}};
function addButtons(){
 const root=document.getElementById('analysis');if(!root)return;
 ['probe','standard','add'].forEach(kind=>{const card=root.querySelector('.entry-card.'+kind);if(!card||card.querySelector('.paper-entry-btn'))return;const btn=document.createElement('button');btn.type='button';btn.className='paper-entry-btn';btn.textContent='PAPERへ '+kindLabel[kind];btn.onclick=()=>window.openPaperEntry(kind);card.appendChild(btn)});
}
const style=document.createElement('style');style.textContent='.paper-entry-btn{width:100%;margin-top:10px;border:1px solid #d6a84e;background:linear-gradient(90deg,#e1a327,#f0ba4a);color:#fff;border-radius:10px;padding:9px 10px;font-weight:900;cursor:pointer;box-shadow:0 5px 14px rgba(199,133,34,.17)}.paper-entry-btn:active{transform:translateY(1px)}';document.head.appendChild(style);
const start=()=>{const root=document.getElementById('analysis');if(!root)return;new MutationObserver(addButtons).observe(root,{childList:true,subtree:true});addButtons()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
