// ── Background color ──────────────────────────────────────────────
var BG_PRESETS={beige:'#cdb899',white:'#f5f0e8',black:'#1a1a2e'};
var _curBgKey='beige';
function setBgColor(hex,key){
  var c=new THREE.Color(hex);
  scene.background=c;
  scene.fog.color=c;
  renderer.setClearColor(c,1);
  BG_COL.set(hex);
  if(_frostedMat)_frostedMat.color.set(hex);
  document.documentElement.style.setProperty('--bg',hex);
  markDirty();
  // Sync swatch active state
  _curBgKey=key||'custom';
  document.querySelectorAll('.bgpop-swatch').forEach(function(sw){sw.classList.remove('on');});
  var pick=document.getElementById('bgpop-pick');if(pick)pick.classList.remove('on');
  if(key){var sw=document.getElementById('bgpop-'+key);if(sw)sw.classList.add('on');}
  else{if(pick)pick.classList.add('on');}
}
(function(){
  var btn=document.getElementById('bbg');
  var pop=document.getElementById('bgpop');
  if(!btn||!pop)return;
  btn.addEventListener('click',function(e){
    e.stopPropagation();
    var isOpen=pop.classList.toggle('open');
    btn.classList.toggle('on',isOpen);
    if(isOpen){
      var br=btn.getBoundingClientRect();
      var left=Math.max(4,Math.min(br.left,window.innerWidth-180));
      var top=br.bottom+4;
      if(top+50>window.innerHeight)top=br.top-54;
      pop.style.top=top+'px';pop.style.left=left+'px';
    }
  });
  document.getElementById('bgpop-beige').addEventListener('click',function(){setBgColor('#cdb899','beige');});
  document.getElementById('bgpop-white').addEventListener('click',function(){setBgColor('#f5f0e8','white');});
  document.getElementById('bgpop-black').addEventListener('click',function(){setBgColor('#1a1a2e','black');});
  var customInput=document.getElementById('bgpop-custom');
  if(customInput)customInput.addEventListener('input',function(){setBgColor(this.value,null);});
  document.addEventListener('click',function(e){
    if(pop.classList.contains('open')&&!pop.contains(e.target)&&e.target!==btn){
      pop.classList.remove('open');btn.classList.remove('on');
    }
  });
})();

// ── New Scene ─────────────────────────────────────────────────────
function newScene(){
  // Exit FPS mode if active
  if(_fpsMode&&window._exitFps)window._exitFps();
  // Close any open strips so sidecol/sbar aren't left shifted
  document.getElementById('pages').classList.remove('open');
  document.getElementById('views').classList.remove('open','recording-open','pages-also-open');
  document.body.classList.remove('pages-open','views-open');
  document.getElementById('pgbtn').classList.remove('on');
  document.getElementById('vwbtn').classList.remove('on');
  var _pbp=document.getElementById('pb-pgbtn');if(_pbp)_pbp.classList.remove('on');
  var _pbv=document.getElementById('pb-vwbtn');if(_pbv)_pbv.classList.remove('on');
  var _hvb=document.getElementById('bviews-hidden');if(_hvb)_hvb.classList.remove('on');
  // Reset strokes + undo
  clearAll();
  _redoStack.length=0;redoStack.length=0;
  // Reset pages
  pages.length=0;curPage=0;
  pages.push({strokes:[],thumb:null,views:[]});
  refreshPageStrip();refreshViewStrip();
  // Clear loft — dispose stored geometry
  if(window._loftGeo){window._loftGeo.dispose();window._loftGeo=null;}
  window._loftCen=null;
  // Reset surface to default plane XZ
  surfType='plane';curPlane='xz';
  surfPos.set(0,0,0);surfEuler.set(0,0,0);surfScale=1;surfScaleAxes.set(1,1,1);
  surfGroup.visible=true;
  buildSurf();
  document.querySelectorAll('[data-surf]').forEach(function(b){b.classList.toggle('on',b.dataset.surf==='plane');});
  document.querySelectorAll('[data-plane]').forEach(function(b){b.classList.toggle('on',b.dataset.plane==='xz');});
  // Sync plane cycle buttons back to Front
  ['pb-cyc-plane','pb-cyc-plane2','sb-cyc-plane'].forEach(function(id){
    var b=document.getElementById(id);if(b)b.textContent='Front';
  });
  // Sync surf cycle buttons back to Pln
  ['pb-cyc-surf','pb-cyc-surf2','sb-cyc-surf'].forEach(function(id){
    var b=document.getElementById(id);if(b)b.textContent='Pln';
  });
  var bsurf=document.getElementById('bsurf');if(bsurf)bsurf.classList.add('on');
  // Reset camera
  cam.theta=-Math.PI/2;cam.phi=Math.PI/2;cam.radius=10;cam.target.set(0,0,0);
  useOrtho=false;orthoZoom=8;
  document.querySelectorAll('#bpersp,#nav-persp,#pb-nav-persp').forEach(function(b){if(b)b.classList.remove('on');});
  updCam();
  // Reset bg color to beige
  setBgColor('#cdb899','beige');
  // Reset brush to defaults: draw mode, size 1, opacity 95
  setMode('draw');
  if(window._applySize) window._applySize(1);
  if(window._applyOpacity) window._applyOpacity(95);
  // Reset layers
  setActiveLayer(1);
  for(var i=0;i<4;i++){layerVisible[i]=true;}
  applyLayerVisibility();
  showMergeLayerRow(false);
  // Clear IDB autosave
  try{idbSave(JSON.stringify(sceneData()));}catch(e){}
  toast('New scene');
}
(function(){
  var modal=document.getElementById('new-scene-modal');
  function showModal(){modal.classList.add('vis');}
  function hideModal(){modal.classList.remove('vis');}
  document.getElementById('bnew').addEventListener('click',function(){
    if(strokes.length===0&&pages.length<=1){newScene();return;}
    showModal();
  });
  document.getElementById('nsm-save').addEventListener('click',function(){
    hideModal();saveFileWithName('sketch3d',newScene);
  });
  document.getElementById('nsm-discard').addEventListener('click',function(){
    hideModal();newScene();
  });
  document.getElementById('nsm-cancel').addEventListener('click',hideModal);
  modal.addEventListener('click',function(e){if(e.target===modal)hideModal();});
})();
(function(){
  var snmod=document.getElementById('save-name-modal');
  var inp=document.getElementById('save-name-input');
  function hideSnm(){snmod.classList.remove('vis');}
  function confirm(){
    var name=inp.value.trim()||'sketch3d';
    var cb=snmod._onComplete;
    snmod._onComplete=null;
    hideSnm();
    _doSaveFile(name);
    if(cb)cb();
  }
  function cancel(){
    snmod._onComplete=null;
    hideSnm();
  }
  document.getElementById('snm-save').addEventListener('click',confirm);
  document.getElementById('snm-cancel').addEventListener('click',cancel);
  snmod.addEventListener('click',function(e){if(e.target===snmod)cancel();});
  inp.addEventListener('keydown',function(e){
    if(e.key==='Enter'){confirm();}
    if(e.key==='Escape'){cancel();}
  });
})();
// ── Export name modal handler ──
(function(){
  var enmod=document.getElementById('export-name-modal');
  var inp=document.getElementById('export-name-input');
  function hideEnm(){enmod.classList.remove('vis');}
  function confirm(){
    var name=inp.value.trim()||'sketch3d';
    var cb=enmod._expCallback;
    enmod._expCallback=null;
    hideEnm();
    if(cb)cb(name);
  }
  function cancel(){
    enmod._expCallback=null;
    hideEnm();
  }
  document.getElementById('enm-export').addEventListener('click',confirm);
  document.getElementById('enm-cancel').addEventListener('click',cancel);
  enmod.addEventListener('click',function(e){if(e.target===enmod)cancel();});
  inp.addEventListener('keydown',function(e){
    if(e.key==='Enter'){confirm();}
    if(e.key==='Escape'){cancel();}
  });
})();

// ── Restore Last Session Modal Handler ──
(function(){
  var rmod = document.getElementById('restore-modal');
  if(!rmod) return;
  function hideRmod(){ rmod.classList.remove('vis'); }
  
  document.getElementById('rsm-restore').addEventListener('click', function(){
    hideRmod();
    if(window._pendingRestoreData){
      try {
        loadAllPages(window._pendingRestoreData);
        if(typeof toast === 'function') toast('Session restored');
      } catch(e) {}
      window._pendingRestoreData = null;
    }
  });

  document.getElementById('rsm-fresh').addEventListener('click', function(){
    hideRmod();
    window._pendingRestoreData = null;
    try {
      if(typeof idbSave === 'function' && typeof sceneData === 'function') {
        idbSave(JSON.stringify(sceneData()));
      }
      localStorage.removeItem('sk3d_auto');
    } catch(e){}
    if(typeof toast === 'function') toast('Started fresh session');
  });

  document.getElementById('rsm-cancel').addEventListener('click', function(){
    hideRmod();
    window._pendingRestoreData = null;
  });

  rmod.addEventListener('click', function(e){
    if(e.target === rmod){
      hideRmod();
      window._pendingRestoreData = null;
    }
  });
})();
document.getElementById('bsave').addEventListener('click',saveFile);
document.getElementById('bload').addEventListener('click',loadFile);
document.getElementById('bexp').addEventListener('click',function(e){
  e.stopPropagation();
  var menu=document.getElementById('expmenu');
  var open=menu.classList.toggle('vis');
  if(open){
    var br=this.getBoundingClientRect();
    var mw=140;
    var left=Math.max(4,Math.min(br.left,window.innerWidth-mw-4));
    var top=br.bottom+4;
    // If too close to bottom, flip above
    if(top+200>window.innerHeight)top=br.top-4;
    menu.style.top=top+'px';
    menu.style.right='auto';
    menu.style.left=left+'px';
  }
});
document.getElementById('bpng').addEventListener('click',expPNG);
document.addEventListener('click',()=>document.getElementById('expmenu').classList.remove('vis'));
document.getElementById('expmenu').addEventListener('click',e=>e.stopPropagation());
document.getElementById('exgltf').addEventListener('click',()=>{document.getElementById('expmenu').classList.remove('vis');promptExportName('sketch3d','.glb',expGLTF);});
document.getElementById('exobj').addEventListener('click',()=>{document.getElementById('expmenu').classList.remove('vis');promptExportName('sketch3d','.obj',expOBJ);});
document.getElementById('exusd').addEventListener('click',()=>{document.getElementById('expmenu').classList.remove('vis');promptExportName('sketch3d','.usda',expUSD);});
document.getElementById('exusdz').addEventListener('click',()=>{document.getElementById('expmenu').classList.remove('vis');promptExportName('sketch3d','.usdz',expUSDZ);});
document.getElementById('exjson').addEventListener('click',()=>{document.getElementById('expmenu').classList.remove('vis');saveFile();});
document.getElementById('exrecord').addEventListener('click',function(){document.getElementById('expmenu').classList.remove('vis');startRecordViews();});
document.getElementById('vw-rec').addEventListener('click',function(){startRecordViews();});
document.getElementById('rec-stop-btn').addEventListener('click',function(){stopRecordViews(false);});

// Surface / plane
document.querySelectorAll('[data-plane]').forEach(b=>b.addEventListener('click',function(){document.querySelectorAll('[data-plane]').forEach(x=>x.classList.remove('on'));this.classList.add('on');curPlane=this.dataset.plane;if(surfFillMat)surfFillMat.color.setHex(SURF_TRACE);if(surfWireMat)surfWireMat.color.setHex(SURF_TRACE);syncSurf();}));
document.querySelectorAll('[data-surf]').forEach(b=>b.addEventListener('click',function(){document.querySelectorAll('[data-surf]').forEach(x=>x.classList.remove('on'));this.classList.add('on');if(window._applySurfType)window._applySurfType(this.dataset.surf);}));

// Colors
document.querySelectorAll('.cw').forEach(sw=>sw.addEventListener('click',function(){curColor=this.dataset.c;document.querySelectorAll('.cw').forEach(c=>c.classList.toggle('on',c.dataset.c===curColor));document.getElementById('ccpick').classList.remove('on');}));
document.getElementById('cpick').addEventListener('input',function(){curColor=this.value;document.querySelectorAll('.cw').forEach(c=>c.classList.remove('on'));document.getElementById('ccpick').classList.add('on');});

// ── Brush preview canvases + size/opacity pickers ─────────────────
(function(){

  function drawSzCanvas(canvas,sz,color){
    if(!canvas)return;
    var ctx=canvas.getContext('2d');
    var W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    var r=Math.max(1,sz*0.42*Math.min(W,H)/20);
    ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);
    ctx.fillStyle=color||'#1a1a2e';ctx.fill();
  }

  function drawOpCanvas(canvas,op100,color){
    if(!canvas)return;
    var ctx=canvas.getContext('2d');
    var W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    var pad=Math.max(2,Math.round(W*0.12));
    ctx.globalAlpha=op100/100;
    ctx.beginPath();ctx.arc(W/2,H/2,W/2-pad,0,Math.PI*2);
    ctx.fillStyle=color||'#1a1a2e';ctx.fill();
    ctx.globalAlpha=1;
  }

  function redrawAll(){
    var col='#1a1a2e'; // always black for visibility — never follows stroke color
    var op=Math.round(brushOp*100);
    drawSzCanvas(document.getElementById('sz-p1'),1,col);
    drawSzCanvas(document.getElementById('sz-p3'),3,col);
    drawSzCanvas(document.getElementById('sz-p6'),6,col);
    drawOpCanvas(document.getElementById('op-p30'),30,col);
    drawOpCanvas(document.getElementById('op-p60'),60,col);
    drawOpCanvas(document.getElementById('op-p95'),95,col);
    drawSzCanvas(document.getElementById('sz-p1-pb'),1,col);
    drawSzCanvas(document.getElementById('sz-p3-pb'),3,col);
    drawSzCanvas(document.getElementById('sz-p6-pb'),6,col);
    drawOpCanvas(document.getElementById('op-p30-pb'),30,col);
    drawOpCanvas(document.getElementById('op-p60-pb'),60,col);
    drawOpCanvas(document.getElementById('op-p95-pb'),95,col);
    drawSzCanvas(document.getElementById('sz-p1-scx'),1,col);
    drawSzCanvas(document.getElementById('sz-p3-scx'),3,col);
    drawSzCanvas(document.getElementById('sz-p6-scx'),6,col);
    drawOpCanvas(document.getElementById('op-p30-scx'),30,col);
    drawOpCanvas(document.getElementById('op-p60-scx'),60,col);
    drawOpCanvas(document.getElementById('op-p95-scx'),95,col);
    drawSzCanvas(document.getElementById('sz-prev-pop'),brushSz,col);
    drawOpCanvas(document.getElementById('op-prev-pop'),op,col);
    document.querySelectorAll('[data-sz]').forEach(function(b){b.classList.toggle('cur',+b.dataset.sz===brushSz);});
    document.querySelectorAll('[data-op]').forEach(function(b){b.classList.toggle('cur',+b.dataset.op===op);});
  }
  window._brushRedraw=redrawAll;

  function applySize(v){
    v=Math.min(20,Math.max(1,+v));
    brushSz=v;
    var sld=document.getElementById('sz-sld');if(sld)sld.value=v;
    redrawAll();
  }
  function applyOpacity(v){
    v=Math.min(100,Math.max(10,+v));
    brushOp=v/100;
    var sld=document.getElementById('op-sld');if(sld)sld.value=v;
    redrawAll();
  }
  window._applySize=applySize;
  window._applyOpacity=applyOpacity;

  var openPopEl=null;
  function positionPop(pop,trigger){
    var br=trigger.getBoundingClientRect();
    var ph=pop.offsetHeight||120;
    var top=br.top>ph+12?br.top-ph-8:br.bottom+6;
    var left=Math.max(4,Math.min(br.left,window.innerWidth-pop.offsetWidth-4));
    pop.style.top=top+'px';pop.style.left=left+'px';
  }
  function openPop(pop,trigger){
    if(openPopEl&&openPopEl!==pop)openPopEl.classList.remove('open');
    redrawAll();pop.classList.add('open');openPopEl=pop;positionPop(pop,trigger);
  }
  function closePops(){if(openPopEl){openPopEl.classList.remove('open');openPopEl=null;}}
  document.addEventListener('click',function(e){
    if(openPopEl&&!openPopEl.contains(e.target)&&!e.target.closest('.bprev-more'))closePops();
  });

  document.querySelectorAll('[data-sz]').forEach(function(b){
    b.addEventListener('click',function(e){e.stopPropagation();applySize(+this.dataset.sz);closePops();});
  });
  document.querySelectorAll('[data-op]').forEach(function(b){
    b.addEventListener('click',function(e){e.stopPropagation();applyOpacity(+this.dataset.op);closePops();});
  });

  var szPop=document.getElementById('sz-pop');
  var opPop=document.getElementById('op-pop');
  ['sz-trig-sb','sz-trig-pb'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.addEventListener('click',function(e){e.stopPropagation();szPop.classList.contains('open')?closePops():openPop(szPop,this);});
  });
  ['op-trig-sb','op-trig-pb'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.addEventListener('click',function(e){e.stopPropagation();opPop.classList.contains('open')?closePops():openPop(opPop,this);});
  });

  var szSld=document.getElementById('sz-sld');
  if(szSld)szSld.addEventListener('input',function(){applySize(+this.value);});
  var opSld=document.getElementById('op-sld');
  if(opSld)opSld.addEventListener('input',function(){applyOpacity(+this.value);});

  redrawAll();
})();
