// ── Mode ─────────────────────────────────────────────────────────
const STXT={draw:'DRAW · 2F orbit · 3F pan',erase:'ERASE · click/drag to remove',orbit:'ORBIT · drag to rotate · press R or D to exit',pan:'PAN · drag to pan · press G or D to exit',select:'SELECT · tap a stroke'};
function setMode(m){
  if(m!=='select'){clearSelection();setHoverStroke(null);}
  else{setHoverStroke(null);}// also clear erase hover when entering select
  if(m==='draw'||m==='erase'||m==='select')prevDrawMode=m;
  mode=m;
  // Toggle all mode buttons: topbar and narrow bar
  // Topbar: pan + orbit only
  ['pan','orbit'].forEach(id=>{const b=document.getElementById('b'+id);if(b)b.classList.toggle('on',m===id);});
  // Sidebar: draw, erase, select
  ['draw','erase','select'].forEach(id=>{const b=document.getElementById('s'+id);if(b)b.classList.toggle('on',m===id);});
  // Narrow: draw, erase, select
  ['draw','erase','select'].forEach(id=>{const pb=document.getElementById('pb-'+id);if(pb)pb.classList.toggle('on',m===id);});
  // Hidden-UI bar (v14.2): draw, erase, select
  ['draw','erase','select'].forEach(id=>{const scx=document.getElementById('scx-'+id);if(scx)scx.classList.toggle('on',m===id);});
  const dots={draw:'#1a1a2e',erase:'#c0392b',orbit:'#e67e22',pan:'#2a9d8f',select:'#1a9940'};
  document.getElementById('mdot').style.background=dots[m]||'#1a1a2e';
  document.getElementById('stxt').textContent=_fpsMode?(STXT[m]||'')+' · FPS':(STXT[m]||'');
  document.body.classList.toggle('erasing',m==='erase');
  document.body.classList.toggle('selecting',m==='select');
  renderer.domElement.style.cursor=m==='draw'?'crosshair':m==='pan'||m==='orbit'?'grab':'default';
}

// Pages, views, recording — see js/core/page-manager.js
// Export functions — see js/core/export-manager.js
// Persistence (save/load/IDB) — see js/core/persistence-manager.js
