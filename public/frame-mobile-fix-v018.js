(()=>{
'use strict';
const id='frame-mobile-fix-v018-style';
if(!document.getElementById(id)){
  const style=document.createElement('style');
  style.id=id;
  style.textContent=`
@media (max-width: 820px){
  .action-row{
    grid-template-columns:32px minmax(0,1fr) auto !important;
    gap:8px 10px !important;
    align-items:start !important;
    padding:12px !important;
  }
  .action-row .action-rank{
    grid-column:1 !important;
    grid-row:1 / span 6 !important;
    align-self:start !important;
  }
  .action-row .action-company{
    grid-column:2 !important;
    grid-row:1 !important;
    min-width:0 !important;
  }
  .action-row .action-company b{
    font-size:14px !important;
    line-height:1.35 !important;
    overflow-wrap:anywhere !important;
  }
  .action-row .action-company small{
    white-space:normal !important;
    overflow-wrap:anywhere !important;
  }
  .action-row .action-tags{
    display:flex !important;
    flex-wrap:wrap !important;
    gap:4px !important;
  }
  .action-row .action-state{
    grid-column:3 !important;
    grid-row:1 !important;
    justify-self:end !important;
    min-width:0 !important;
  }
  .action-row .action-state small{
    max-width:92px !important;
    text-align:right !important;
    white-space:normal !important;
  }
  .action-row .action-price{
    grid-column:2 / 4 !important;
    display:grid !important;
    grid-template-columns:92px minmax(0,1fr) !important;
    gap:2px 8px !important;
    align-items:baseline !important;
    justify-items:start !important;
    min-width:0 !important;
    width:100% !important;
    margin:0 !important;
  }
  .action-row .action-price small{
    grid-column:1 !important;
    grid-row:1 !important;
    white-space:nowrap !important;
  }
  .action-row .action-price b{
    grid-column:2 !important;
    grid-row:1 !important;
    min-width:0 !important;
    font-size:13px !important;
    white-space:nowrap !important;
  }
  .action-row .action-price em{
    grid-column:2 !important;
    grid-row:2 !important;
    white-space:nowrap !important;
  }
  .action-row .action-price.stop{
    display:grid !important;
  }
  .action-row .action-open{
    display:none !important;
  }

  .candidate-card-prices{
    grid-template-columns:1fr !important;
    gap:5px !important;
  }
  .candidate-card-prices > div{
    display:grid !important;
    grid-template-columns:76px minmax(0,1fr) !important;
    gap:8px !important;
    align-items:baseline !important;
    min-width:0 !important;
  }
  .candidate-card-prices span{
    margin:0 !important;
    white-space:nowrap !important;
  }
  .candidate-card-prices b{
    margin:0 !important;
    min-width:0 !important;
    font-size:13px !important;
    white-space:nowrap !important;
  }
}
`;
  document.head.appendChild(style);
}
const version=document.querySelector('.version');
if(version)version.textContent='UI v0.18';
})();