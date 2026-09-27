// ── UI bindings ───────────────────────────────────────────────────
document.getElementById('sdraw').addEventListener('click',()=>setMode('draw'));
document.getElementById('serase').addEventListener('click',()=>setMode('erase'));
document.getElementById('sselect').addEventListener('click',()=>setMode('select'));
document.getElementById('pb-draw').addEventListener('click',()=>setMode('draw'));
document.getElementById('pb-erase').addEventListener('click',()=>setMode('erase'));
document.getElementById('pb-select').addEventListener('click',()=>setMode('select'));
document.getElementById('bpan').addEventListener('click',()=>setMode('pan'));
document.getElementById('borbit').addEventListener('click',()=>setMode('orbit'));

document.getElementById('sflat').addEventListener('click',function(){flatBrush=!flatBrush;this.classList.toggle('on',flatBrush);var pb=document.getElementById('pb-flat');if(pb)pb.classList.toggle('on',flatBrush);var scx=document.getElementById('scx-flat');if(scx)scx.classList.toggle('on',flatBrush);toast(flatBrush?'Marker brush':'Round brush');});
document.getElementById('pb-flat').addEventListener('click',()=>document.getElementById('sflat').click());

document.getElementById('ssmooth').addEventListener('click',function(){smoothingOn=!smoothingOn;LAZY=smoothingOn?LAZY_ON:LAZY_OFF;this.classList.toggle('on',smoothingOn);var pb=document.getElementById('pb-smooth');if(pb)pb.classList.toggle('on',smoothingOn);var scx=document.getElementById('scx-smooth');if(scx)scx.classList.toggle('on',smoothingOn);toast(smoothingOn?'Smoothing on':'Raw tracking');});
document.getElementById('pb-smooth').addEventListener('click',()=>document.getElementById('ssmooth').click());

document.getElementById('svel').addEventListener('click',function(){velocityTaper=!velocityTaper;this.classList.toggle('on',velocityTaper);var pb=document.getElementById('pb-vel');if(pb)pb.classList.toggle('on',velocityTaper);var scx=document.getElementById('scx-vel');if(scx)scx.classList.toggle('on',velocityTaper);toast(velocityTaper?'Velocity taper on':'Uniform thickness');});
document.getElementById('pb-vel').addEventListener('click',()=>document.getElementById('svel').click());

// ── Hidden-UI mini-toolbar wiring (v14.2) ───────────────────────────
// Toggle button shows/hides the bar. All tool buttons delegate to existing sidecol handlers.
(function(){
  var tgl=document.getElementById('sc-hidden-toggle');
  var bar=document.getElementById('sc-hidden-bar');
  if(!tgl||!bar)return;
  tgl.addEventListener('click',function(){
    var open=bar.classList.toggle('scx-open');
    tgl.classList.toggle('lit',open);
  });
  // Mode buttons → delegate to sidecol equivalents
  var pairs=[['scx-draw','sdraw'],['scx-erase','serase'],['scx-select','sselect'],
             ['scx-flat','sflat'],['scx-smooth','ssmooth'],['scx-vel','svel'],
             ['scx-undo','s-undo'],['scx-redo','s-redo'],
             ['sz-trig-scx','sz-trig-sb'],['op-trig-scx','op-trig-sb']];
  pairs.forEach(function(p){
    var src=document.getElementById(p[0]),tgt=document.getElementById(p[1]);
    if(src&&tgt)src.addEventListener('click',function(e){e.stopPropagation();tgt.click();});
  });
  // data-sz / data-op / .cw clicks are already handled by the global querySelectorAll
  // listeners, so no per-button wiring needed — they dispatch directly.
  // When the UI toggles from hidden→shown, auto-close the bar to avoid stale state
  var _mo=new MutationObserver(function(){
    if(!document.body.classList.contains('ui-hidden')){
      bar.classList.remove('scx-open');
      tgl.classList.remove('lit');
    }
  });
  _mo.observe(document.body,{attributes:true,attributeFilter:['class']});
})();

// Export scale cycling
document.getElementById('bscale').addEventListener('click',function(){
  exportScaleIdx=(exportScaleIdx+1)%SCALE_STEPS.length;
  const lbl=SCALE_LABELS[exportScaleIdx];
  const isOff=SCALE_STEPS[exportScaleIdx]===null;
  this.textContent=lbl;
  this.style.opacity=isOff?'0.45':'';
  this.classList.toggle('on',!isOff);
  buildScaleBar();updateScaleBarLabel();
  toast(isOff?'Export scale off':'Export '+lbl);
});

document.getElementById('bundo').addEventListener('click',undo);
document.getElementById('bredo').addEventListener('click',redo);
document.getElementById('pb-undo').addEventListener('click',undo);
document.getElementById('pb-redo').addEventListener('click',redo);
document.getElementById('bclear').addEventListener('click',()=>{if(confirm('Clear all strokes?'))clearAll();});

// Visibility — sidebar + narrow both wired
document.getElementById('bsurf').addEventListener('click',function(){surfGroup.visible=!surfGroup.visible;this.classList.toggle('on',surfGroup.visible);var pb=document.getElementById('pb-surf');if(pb)pb.classList.toggle('on',surfGroup.visible);markDirty();});

document.getElementById('bgrid').addEventListener('click',function(){gridH.visible=!gridH.visible;this.classList.toggle('on',gridH.visible);var pb=document.getElementById('pb-grid');if(pb)pb.classList.toggle('on',gridH.visible);markDirty();});

function toggleAxis(on){axisLinesOn=on;axisGroup.visible=on;var b=document.getElementById('baxis');if(b)b.classList.toggle('on',on);var pb=document.getElementById('pb-axis');if(pb)pb.classList.toggle('on',on);markDirty();}
document.getElementById('baxis').addEventListener('click',()=>toggleAxis(!axisLinesOn));

document.getElementById('bdepth').addEventListener('click',function(){
  depthCuesOn=!depthCuesOn;
  this.classList.toggle('on',depthCuesOn);
  var pb=document.getElementById('pb-depth');if(pb)pb.classList.toggle('on',depthCuesOn);
  if(_frostedMesh)_frostedMesh.visible=depthCuesOn;
  if(_frostedGridMesh)_frostedGridMesh.visible=depthCuesOn&&_surfGridMode>0;
  if(window._syncFpsDepth)window._syncFpsDepth();
  markDirty();
  toast(depthCuesOn?'Depth on':'Depth off');
});

// Depth plane opacity — affects tint mesh only, not grid dots/lines
function cycleDepthOp(){
  _depthOpIdx=(_depthOpIdx+1)%_depthOpSteps.length;
  var op=_depthOpSteps[_depthOpIdx];
  var lbl=_depthOpLabels[_depthOpIdx];
  if(_frostedMat){_frostedMat.opacity=op;_frostedMat.needsUpdate=true;}
  if(_fpsFrosted){_fpsFrosted.material.opacity=op;_fpsFrosted.material.needsUpdate=true;}
  var tb=document.getElementById('bdepth-op');if(tb)tb.textContent=lbl;
  var pb=document.getElementById('pb-depthop');if(pb)pb.textContent=lbl;
  markDirty();toast('Plane '+lbl);
}
document.getElementById('bdepth-op').addEventListener('click',cycleDepthOp);
document.getElementById('pb-depthop').addEventListener('click',cycleDepthOp);

// Surface grid cycle — DOT → GRD → OFF (outline always stays)
function cycleSurfGrid(){
  _surfGridMode=(_surfGridMode+1)%3;
  var lbl=_surfGridLabels[_surfGridMode];
  var isOn=_surfGridMode>0;
  var tb=document.getElementById('bsurfgrid');if(tb){tb.textContent=lbl;tb.classList.toggle('on',isOn);}
  var pb=document.getElementById('pb-surfgrid');if(pb){pb.textContent=lbl;pb.classList.toggle('on',isOn);}
  applyFrostedGridTex();
  toast('Grid '+lbl);
}
document.getElementById('bsurfgrid').addEventListener('click',cycleSurfGrid);
document.getElementById('pb-surfgrid').addEventListener('click',cycleSurfGrid);

function togglePersp(){
  setOrtho(!useOrtho);
}
var _orthoLerp=null;
function setOrtho(on){
  if(on===useOrtho){return;}
  // Cancel any in-progress ortho lerp
  if(_orthoLerp){cancelAnimationFrame(_orthoLerp);_orthoLerp=null;}
  var CAM_FOV_HALF_TAN=Math.tan(27.5*Math.PI/180);
  var dur=400;
  var startT=performance.now();
  if(on){
    // Persp → Ortho: flip immediately, lerp zoom from perspective-matching to target
    useOrtho=true;
    var startZoom=cam.radius*CAM_FOV_HALF_TAN;
    var endZoom=orthoZoom; // current orthoZoom is the target (last saved value)
    orthoZoom=startZoom;
    syncOrtho();
    function stepToOrtho(){
      var t=Math.min(1,(performance.now()-startT)/dur);
      var e=t<1?t*(2-t):1;
      orthoZoom=startZoom+(endZoom-startZoom)*e;
      syncOrtho();updCam();markDirty();
      if(t<1){_orthoLerp=requestAnimationFrame(stepToOrtho);}
      else{_orthoLerp=null;orthoZoom=endZoom;syncOrtho();updCam();}
    }
    _orthoLerp=requestAnimationFrame(stepToOrtho);
  } else {
    // Ortho → Persp: keep ortho, lerp zoom toward persp-matching, flip at end
    var startZoom2=orthoZoom;
    var endZoom2=cam.radius*CAM_FOV_HALF_TAN;
    function stepToPersp(){
      var t=Math.min(1,(performance.now()-startT)/dur);
      var e=t<1?t*(2-t):1;
      orthoZoom=startZoom2+(endZoom2-startZoom2)*e;
      syncOrtho();updCam();markDirty();
      if(t<1){_orthoLerp=requestAnimationFrame(stepToPersp);}
      else{_orthoLerp=null;useOrtho=false;syncOrtho();updCam();}
    }
    _orthoLerp=requestAnimationFrame(stepToPersp);
  }
  var txt=on?'ORTHO':'PERSP';
  ['bpersp','nav-persp','pb-nav-persp'].forEach(function(id){
    var b=document.getElementById(id);
    if(b){b.textContent=txt;b.classList.toggle('on',on);}
  });
}
document.getElementById('bpersp').addEventListener('click',togglePersp);
document.getElementById('nav-persp').addEventListener('click',togglePersp);
document.getElementById('pb-nav-persp').addEventListener('click',togglePersp);

// Gesture swap
document.getElementById('bgestswap').addEventListener('click',function(){twoFingerMode=twoFingerMode==='orbit'?'pan':'orbit';updateGestLabel();toast('2-finger = '+(twoFingerMode==='orbit'?'orbit':'pan'));});
document.getElementById('bstylus').addEventListener('click',function(){stylusOnly=!stylusOnly;updateStylusLabel();toast(stylusOnly?'Stylus mode: pen draws, finger navigates':'Stylus mode off');});

// Narrow-bar delegates — scene toggles
document.getElementById('pb-depth').addEventListener('click',function(){document.getElementById('bdepth').click();});
document.getElementById('pb-surf').addEventListener('click',function(){document.getElementById('bsurf').click();});
document.getElementById('pb-grid').addEventListener('click',function(){document.getElementById('bgrid').click();});
document.getElementById('pb-axis').addEventListener('click',function(){document.getElementById('baxis').click();});
// Narrow-bar delegates — input modes
document.getElementById('pb-gestswap').addEventListener('click',function(){document.getElementById('bgestswap').click();});
document.getElementById('pb-stylus').addEventListener('click',function(){document.getElementById('bstylus').click();});
// Narrow-bar delegates — actions
document.getElementById('pb-clear').addEventListener('click',function(){document.getElementById('bclear').click();});
document.getElementById('pb-bg').addEventListener('click',function(e){
  e.stopPropagation();
  var pop=document.getElementById('bgpop');
  var isOpen=pop.classList.toggle('open');
  document.getElementById('bbg').classList.toggle('on',isOpen);
  if(isOpen){
    var br=this.getBoundingClientRect();
    var left=Math.max(4,Math.min(br.left,window.innerWidth-180));
    var top=br.top-54;
    if(top<4)top=br.bottom+4;
    pop.style.top=top+'px';pop.style.left=left+'px';
  }
});
document.getElementById('pb-new').addEventListener('click',function(){document.getElementById('bnew').click();});
// Narrow-bar delegates — file operations
document.getElementById('pb-save').addEventListener('click',saveFile);
document.getElementById('pb-load').addEventListener('click',loadFile);
document.getElementById('pb-exp').addEventListener('click',function(e){
  e.stopPropagation();
  var menu=document.getElementById('expmenu');
  var open=menu.classList.toggle('vis');
  if(open){
    var br=this.getBoundingClientRect();
    var mw=140;
    var left=Math.max(4,Math.min(br.left,window.innerWidth-mw-4));
    var top=br.top-150;
    if(top<4)top=br.bottom+4;
    menu.style.top=top+'px';
    menu.style.right='auto';
    menu.style.left=left+'px';
  }
});
document.getElementById('pb-png').addEventListener('click',expPNG);

// Hide UI
document.getElementById('bhide').addEventListener('click',function(){
  const hidden=document.body.classList.toggle('ui-hidden');
  // Swap icon between eye and eye-off
  this.innerHTML=hidden
    ?'<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="12" y2="12"/><path d="M5 4.5Q6 4 7 4Q11 4 13 7Q10.5 9.8 7.5 10"/><path d="M1 7Q2.5 4.5 5 3.5"/><circle cx="7" cy="7" r="2" stroke-dasharray="1 2"/></svg>'
    :'<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 7Q3 4 7 4Q11 4 13 7Q11 10 7 10Q3 10 1 7Z"/><circle cx="7" cy="7" r="2"/></svg>';
  // Close strips when hiding UI so canvas is fully clear
  if(hidden){
    document.getElementById('pages').classList.remove('open');
    document.getElementById('views').classList.remove('open','recording-open','pages-also-open');
    document.body.classList.remove('pages-open','views-open');
    document.getElementById('pgbtn').classList.remove('on');
    document.getElementById('vwbtn').classList.remove('on');
    var pbp=document.getElementById('pb-pgbtn');if(pbp)pbp.classList.remove('on');
    var pbv=document.getElementById('pb-vwbtn');if(pbv)pbv.classList.remove('on');
  }
  // Float card: show/hide based on UI state and layout mode
  var _vvp2=window.visualViewport;
  var isNarrow=(_vvp2?_vvp2.width:window.innerWidth)/(_vvp2?_vvp2.height:window.innerHeight)<(2/3);
  var card=document.getElementById('pb-float-card');
  var fab=document.getElementById('pb-fab');
  if(hidden){
    // UI turning off: show float card in both narrow and tablet mode
    // Undock if currently docked (card must be floating when UI is off)
    if(card&&card.classList.contains('fc-docked-bottom')){
      card.classList.remove('fc-docked-bottom');
      card.style.left=(window._fcLastLeft||8)+'px';
      card.style.top=(window._fcLastTop||52)+'px';
      card.style.width=(window._fcLastW||Math.min(window.innerWidth-16,340))+'px';
      card.style.right='';card.style.bottom='';
      var db=document.getElementById('fc-dock-btn');
      if(db)db.textContent='⊞';
    }
    // In tablet mode: reparent panels into float card now
    // …unless the user has already detached sc-groups — those serve the role
    // of the float card and showing both would duplicate UI.
    if(!isNarrow&&!_scState.detached){
      _fcReparent();
      if(!window._fcEverActivated){window._fcEverActivated=true;}
    }
    if(!window._cardHidden&&!(_scState.detached&&!isNarrow)){
      if(card)card.classList.add('fc-visible');
      if(fab)fab.classList.remove('fab-visible');
    }
    // If wide + ui-hidden + detached: show detached cards (they're already visible
    // unless user hid them) and FAB if they were hidden.
    if(!isNarrow&&_scState.detached){
      applySidecol();
      _updateScFab();
    }
    setTimeout(_fcResizeCanvases,50);
  } else {
    // UI turning on: in tablet mode, hide float card and return panels to sidebar
    if(!isNarrow){
      if(card)card.classList.remove('fc-visible');
      if(fab)fab.classList.remove('fab-visible');
      window._cardHidden=false;
      _fcReturn();
    }
    // In narrow mode, card visibility is already managed by updateLayoutMode/narrow state
  }
  // Sync LCL float position to new ui-hidden state.
  // Docked path never called applySidecol(), so LCL would stay at its old
  // sg-bottom position and overlap the ≡ toggle. Call immediately on hide;
  // defer on show so sidecol layout is restored before measuring sg-bottom.
  if(hidden){positionLclFloat();}else{setTimeout(positionLclFloat,0);}
});
