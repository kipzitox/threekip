// ================================================================
//  SIDECOL — side toggle, scale via #stab (zoom), detach groups, scale dots
// ================================================================

const stab=document.getElementById('stab');
const sidecol=document.getElementById('sidecol');

// Scale bounds. Cap at 1.0 (v6 baseline) — drag only shrinks.
var SC_MIN=0.7,SC_MAX=1.0;

// Persisted state (schema v11 — detached is now bool; each group has own pos)
var _scState={
  sideOpen:true,
  rside:false,
  scale:1.0,             // sidecol zoom
  detached:false,        // v11: both groups detach/redock as a unit
  topLeft:40,topTop:80,  // per-group position (v11)
  botLeft:40,botTop:200,
  detachedScale:1.0,
  fcScale:1.0,
  detachedHidden:false   // v11: user X'd the detached cards; show FAB to bring back
};
try{
  var _saved=localStorage.getItem('sk3d_sc');
  if(_saved){
    var _p=JSON.parse(_saved);
    function _clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
    if(typeof _p.scale==='number')_scState.scale=_clamp(_p.scale,SC_MIN,SC_MAX);
    if(typeof _p.detachedScale==='number')_scState.detachedScale=_clamp(_p.detachedScale,SC_MIN,SC_MAX);
    if(typeof _p.fcScale==='number')_scState.fcScale=_clamp(_p.fcScale,SC_MIN,SC_MAX);
    if(typeof _p.rside==='boolean')_scState.rside=_p.rside;
    if(typeof _p.sideOpen==='boolean')_scState.sideOpen=_p.sideOpen;
    // v11 schema
    if(typeof _p.detached==='boolean')_scState.detached=_p.detached;
    else if(_p.detached==='top'||_p.detached==='bottom')_scState.detached=true;  // v10 migration
    if(typeof _p.topLeft==='number')_scState.topLeft=_p.topLeft;
    if(typeof _p.topTop==='number')_scState.topTop=Math.max(52,_p.topTop);
    if(typeof _p.botLeft==='number')_scState.botLeft=_p.botLeft;
    if(typeof _p.botTop==='number')_scState.botTop=Math.max(52,_p.botTop);
    if(typeof _p.detachedHidden==='boolean')_scState.detachedHidden=_p.detachedHidden;
  }
}catch(e){}

function _saveScState(){try{localStorage.setItem('sk3d_sc',JSON.stringify(_scState));}catch(e){}}

// applyZoom: write `zoom` property on an element. Browsers render the element
// and its descendants (including <canvas> backing buffers) at that scale —
// no blur, no pixel-buffer recomputation needed. Vendor prefix for Safari < 16.
function applyZoom(el,scale){
  if(!el)return;
  el.style.zoom=String(scale);
}

// applyScale: use transform:scale for detached cards so top-left is guaranteed
// anchor. Unlike zoom, transform does not affect layout box — the card stays
// exactly at its left/top position while growing downward and to the right.
function applyDetachedScale(el,scale){
  if(!el)return;
  el.style.transform='scale('+scale+')';
  el.style.transformOrigin='top left';
}

// Position the stab at the inner edge of sidecol (accounts for zoom and responsive media query width).
function positionStab(){
  if (!stab || !sidecol) return;
  var isRight=document.body.classList.contains('rside');
  var scRect=sidecol.getBoundingClientRect();
  var displayW=(_scState.sideOpen && scRect.width > 0) ? Math.round(scRect.width) : Math.round(176*_scState.scale);
  var gap=2;
  var scOffset=5; // sidecol left/right offset from screen edge (--SP / --SR)
  var offset=_scState.sideOpen?(scOffset+displayW+gap):(scOffset+gap);
  if(isRight){stab.style.right=offset+'px';stab.style.left='auto';}
  else{stab.style.left=offset+'px';stab.style.right='auto';}
}

// Position the floating LCL group just below sg-bottom (docked or detached).
function positionLclFloat(){
  var grp=document.getElementById('lcl-float-group');
  if(!grp)return;
  var isNarrow=document.body.classList.contains('narrow-mode');
  if(isNarrow){grp.style.display='none';return;}
  var isUiHidden=document.body.classList.contains('ui-hidden');
  if(isUiHidden){
    // In ui-hidden mode the sidecol is invisible; anchor to bottom-left above the mini-toolbar toggle.
    // Base bottom is 52px; CSS strip-shift rules override with !important when strips are open.
    grp.style.display='flex';
    grp.style.left='10px';
    grp.style.bottom=''; // clear inline bottom so CSS strip-shift rules apply cleanly
    grp.style.top='auto';
    grp.style.right='auto';
    return;
  }
  var sgBot=document.getElementById('sg-bottom');
  if(!sgBot||sgBot.style.display==='none'){grp.style.display='none';return;}
  // Check if sg-bottom is actually visible (may be inside hidden sidecol)
  var r=sgBot.getBoundingClientRect();
  if(r.width===0&&r.height===0){grp.style.display='none';return;}
  grp.style.display='flex';
  grp.style.left=Math.round(r.left)+'px';
  grp.style.top=Math.round(r.bottom+5)+'px';
  grp.style.bottom='auto';
  grp.style.right='auto';
}

// ── Sidecol-level apply ──
function applySidecol(){
  document.body.classList.toggle('rside',_scState.rside);
  sidecol.classList.toggle('collapsed',!_scState.sideOpen);
  applyZoom(sidecol,_scState.scale);
  positionStab();
  positionLclFloat();
  var sgTop=document.getElementById('sg-top');
  var sgBot=document.getElementById('sg-bottom');
  // If detached: both groups float independently at their own positions.
  // If docked: both sit in sidecol with zoom=1 (inherit sidecol zoom).
  [sgTop,sgBot].forEach(function(g){if(!g)return;
    var isDetached=g.classList.contains('detached');
    if(isDetached)applyDetachedScale(g,_scState.detachedScale);
    else{applyZoom(g,1);g.style.transform='';g.style.transformOrigin='';}
  });
  if(_scState.detached){
    if(sgTop){sgTop.style.left=_scState.topLeft+'px';sgTop.style.top=_scState.topTop+'px';}
    if(sgBot){sgBot.style.left=_scState.botLeft+'px';sgBot.style.top=_scState.botTop+'px';}
    // If user hid the detached cards, hide them; otherwise show
    var hide=_scState.detachedHidden;
    if(sgTop)sgTop.style.display=hide?'none':'';
    if(sgBot)sgBot.style.display=hide?'none':'';
  }
  // Float-card zoom (narrow mode)
  var fc=document.getElementById('pb-float-card');
  if(fc)applyZoom(fc,_scState.fcScale);
}

// ── Detach / redock — BOTH groups together (v11) ──
// When undocked, both groups detach simultaneously and keep their visual
// positions (captured from getBoundingClientRect before the hoist). When
// docked, both return to sidecol in correct DOM order.
function detachAll(){
  if(_scState.detached)return;
  var sgTop=document.getElementById('sg-top');
  var sgBot=document.getElementById('sg-bottom');
  if(!sgTop||!sgBot)return;
  // Capture current on-screen positions BEFORE hoisting (so we can place them
  // exactly where they were visually — no jump).
  var rTop=sgTop.getBoundingClientRect();
  var rBot=sgBot.getBoundingClientRect();
  _scState.topLeft=Math.round(rTop.left);_scState.topTop=Math.round(rTop.top);
  _scState.botLeft=Math.round(rBot.left);_scState.botTop=Math.round(rBot.top);
  // Ensure cards don't start above the topbar (top ≥ 52px)
  var TB_MIN=52;
  if(_scState.topTop<TB_MIN)_scState.topTop=TB_MIN;
  if(_scState.botTop<TB_MIN)_scState.botTop=TB_MIN;
  // (No nudge: the drag itself moves the card from its exact visual position)
  // Match detached zoom to current sidecol zoom so cards don't jump size on detach.
  _scState.detachedScale=_scState.scale;
  // Add detached class + hoist to body (escape sidecol zoom)
  sgTop.classList.add('detached');
  sgBot.classList.add('detached');
  document.body.appendChild(sgTop);
  document.body.appendChild(sgBot);
  // Set positions synchronously BEFORE any paint — prevents single-frame jump to 0,0
  sgTop.style.left=_scState.topLeft+'px'; sgTop.style.top=_scState.topTop+'px';
  sgBot.style.left=_scState.botLeft+'px'; sgBot.style.top=_scState.botTop+'px';
  applyDetachedScale(sgTop,_scState.detachedScale);
  applyDetachedScale(sgBot,_scState.detachedScale);
  document.body.classList.add('sc-detached');  // hides #stab via CSS
  _scState.detached=true;
  _scState.detachedHidden=false;
  applySidecol();
  _saveScState();
}
function redockAll(save){
  if(!_scState.detached)return;
  var sgTop=document.getElementById('sg-top');
  var sgBot=document.getElementById('sg-bottom');
  var sc=document.getElementById('sidecol');
  if(!sgTop||!sgBot||!sc)return;
  sgTop.classList.remove('detached','dock-snap-ready');
  sgBot.classList.remove('detached','dock-snap-ready');
  sgTop.style.left='';sgTop.style.top='';sgTop.style.display='';sgTop.style.transform='';sgTop.style.transformOrigin='';
  sgBot.style.left='';sgBot.style.top='';sgBot.style.display='';sgBot.style.transform='';sgBot.style.transformOrigin='';
  // Restore DOM order: sg-bottom FIRST (column-reverse places first at visual bottom),
  // sg-top SECOND (visual top).
  sc.insertBefore(sgBot,sc.firstChild);
  sc.appendChild(sgTop);
  document.body.classList.remove('sc-detached');  // shows #stab again
  _scState.detached=false;
  _scState.detachedHidden=false;
  applySidecol();
  if(save!==false)_saveScState();
}

// ── Grab-handle drag: tap-move > 8px in sidecol → detach; once detached → reposition ──
// Snap zone: 10 px. Only the card's screen-facing edge (the edge closest to the
// screen border, away from the viewport interior) needs to be within 10 px of
// the corresponding screen edge. This means the user drags the card back toward
// the side of the screen — not just anywhere near the sidecol.
var SNAP_REDOCK=10;

// Check if a detached group's screen-facing edge is within SNAP_REDOCK px of
// the screen edge where the sidecol lives. Returns true → redock on release.
function _shouldRedock(g){
  var gr=g.getBoundingClientRect();
  var onRight=document.body.classList.contains('rside');
  if(onRight){
    // Sidecol is on the right. Card's far (right) edge must be near right screen edge.
    return (window.innerWidth-gr.right)<=SNAP_REDOCK;
  }else{
    // Sidecol is on the left. Card's far (left) edge must be near left screen edge.
    return gr.left<=SNAP_REDOCK;
  }
}

// Redock arms after the drag has been in progress for REDOCK_ARM_MS.
// Prevents the user's initial detach-drag from immediately re-docking when
// they're still adjacent to the sidecol edge, but allows a quick wiggle-and-
// return to redock (which the old distance-travelled gate blocked).
var REDOCK_ARM_MS=250;

(function(){
  var TAP=8;
  function wireGrab(grab){
    var which=grab.dataset.group;  // 'top' or 'bottom'
    var state=null;
    function onDown(e){
      // Don't start a drag if the target is a button (dock/close)
      if(e.target.tagName==='BUTTON')return;
      e.preventDefault();e.stopPropagation();
      var src=e.touches?e.touches[0]:e;
      var g=document.getElementById('sg-'+which);
      var r=g.getBoundingClientRect();
      state={sx:src.clientX,sy:src.clientY,ox:src.clientX-r.left,oy:src.clientY-r.top,
             moved:false,which:which,startT:Date.now()};
    }
    function onMove(e){
      if(!state)return;e.preventDefault();
      var src=e.touches?e.touches[0]:e;
      var dx=src.clientX-state.sx,dy=src.clientY-state.sy;
      if(!state.moved&&Math.hypot(dx,dy)<TAP)return;
      if(!state.moved){
        state.moved=true;
        // First threshold crossing — detach BOTH groups (they move together)
        // keeping their visual positions; then this specific group follows
        // the cursor while the other stays where it was.
        if(!_scState.detached)detachAll();
      }
      // Reposition THIS group only — no position clamping, cards can go anywhere
      var g=document.getElementById('sg-'+state.which);
      var nx=src.clientX-state.ox,ny=src.clientY-state.oy;
      g.style.left=nx+'px';g.style.top=ny+'px';
      if(state.which==='top'){_scState.topLeft=nx;_scState.topTop=ny;}
      else{_scState.botLeft=nx;_scState.botTop=ny;}
      positionLclFloat();
      // Redock arms after a short delay — gives the user a chance to move
      // the card away from the initial detach position before the snap engages
      var armed=(Date.now()-state.startT)>REDOCK_ARM_MS;
      var snapReady=armed&&_shouldRedock(g);
      g.classList.toggle('dock-snap-ready',snapReady);
      markDirty();renderer.render(scene,activeCam());_renderDirty=false;
    }
    function onEnd(){
      if(!state)return;
      var g=document.getElementById('sg-'+state.which);
      if(g)g.classList.remove('dock-snap-ready');
      if(state.moved){
        // Redock ALL if this group came close to sidecol edge (and gate armed)
        var armed=(Date.now()-state.startT)>REDOCK_ARM_MS;
        if(g&&armed&&_shouldRedock(g)){
          redockAll(true);
        }else{
          _saveScState();
        }
        positionLclFloat();
      }
      state=null;
    }
    grab.addEventListener('mousedown',onDown);
    grab.addEventListener('touchstart',onDown,{passive:false});
    document.addEventListener('mousemove',function(e){if(state)onMove(e);});
    document.addEventListener('mouseup',function(){if(state)onEnd();});
    grab.addEventListener('touchmove',onMove,{passive:false});
    grab.addEventListener('touchend',onEnd);
    grab.addEventListener('touchcancel',onEnd);
  }
  document.querySelectorAll('.sc-grab').forEach(wireGrab);
})();

// ── Close buttons on either detached group → hide both with FAB recall ──
// Close (X) doesn't redock — it hides the detached cards and shows a FAB
// to bring them back. Redocking happens via the 5 px edge snap or programmatic
// redockAll. This matches the narrow-mode float card behavior.
document.querySelectorAll('.sc-close').forEach(function(btn){
  btn.addEventListener('click',function(e){
    e.stopPropagation();
    _scState.detachedHidden=true;
    applySidecol();
    _updateScFab();
    _saveScState();
  });
});

// ── Dock buttons on either detached group → redock both ──
// Dock (⊞) triggers full redock. Matches narrow-mode float-card dock button
// so users have consistent "bring it back to its home" affordance.
document.querySelectorAll('.sc-dock').forEach(function(btn){
  btn.addEventListener('click',function(e){
    e.stopPropagation();
    redockAll(true);
  });
});

// ── FAB to restore hidden detached cards (wide-mode ui-hidden or not) ──
function _updateScFab(){
  var fab=document.getElementById('sc-fab');
  if(!fab)return;
  var show=_scState.detached&&_scState.detachedHidden;
  fab.style.display=show?'flex':'none';
}
(function(){
  var fab=document.getElementById('sc-fab');
  if(!fab)return;
  fab.addEventListener('click',function(){
    _scState.detachedHidden=false;
    applySidecol();
    _updateScFab();
    _saveScState();
  });
})();

// ── Scale dots: drag diagonally → change zoom of target card ──
// Uses Pointer Events + setPointerCapture so the drag stays live even if
// the finger/cursor moves off the small dot. No press-and-hold required —
// the drag starts the instant pointerdown fires.
(function(){
  function wireDot(dot){
    var targetId=dot.dataset.scaletarget;
    var state=null;
    function currentScale(){
      if(targetId==='pb-float-card')return _scState.fcScale;
      return _scState.detachedScale;
    }
    function setScale(v){
      v=Math.max(SC_MIN,Math.min(SC_MAX,v));
      if(targetId==='pb-float-card'){
        _scState.fcScale=v;
        var target=document.getElementById(targetId);
        if(target)applyZoom(target,v);
      }else{
        _scState.detachedScale=v;
        // Use transform:scale with top-left origin so card stays anchored.
        var target=document.getElementById(targetId);
        if(target)applyDetachedScale(target,v);
      }
      markDirty();
    }
    dot.addEventListener('pointerdown',function(e){
      e.preventDefault();e.stopPropagation();
      // Capture all future pointer events to this element — finger can move
      // anywhere and we still get pointermove/pointerup.
      dot.setPointerCapture(e.pointerId);
      state={sx:e.clientX,sy:e.clientY,startScale:currentScale()};
      dot.classList.add('dragging');
    });
    dot.addEventListener('pointermove',function(e){
      if(!state)return;
      e.preventDefault();
      // Right-edge strip: drag right = grow, drag left = shrink.
      // Use dx only (vertical drag on a side strip does nothing).
      var dx=e.clientX-state.sx;
      setScale(state.startScale+dx*0.007);
    });
    dot.addEventListener('pointerup',function(e){
      if(!state)return;
      state=null;
      dot.classList.remove('dragging');
      _saveScState();
    });
    dot.addEventListener('pointercancel',function(){
      if(!state)return;
      state=null;
      dot.classList.remove('dragging');
    });
  }
  document.querySelectorAll('.scale-dot').forEach(wireDot);
})();

// ── Stab: tap → collapse; horizontal drag → scale sidecol (0.7–1.0) ──
// Drag TOWARD screen edge = shrink (column gets thinner).
// Drag TOWARD screen center = grow (back up to 1.0).
(function(){
  var state=null;
  var TAP_THRESH=8;
  function onDown(e){
    e.preventDefault();
    var src=e.touches?e.touches[0]:e;
    state={sx:src.clientX,sy:src.clientY,startScale:_scState.scale,moved:false};
    stab.classList.add('resizing');
  }
  function onMove(e){
    if(!state)return;
    e.preventDefault();
    var src=e.touches?e.touches[0]:e;
    var dx=src.clientX-state.sx,dy=src.clientY-state.sy;
    if(!state.moved&&Math.hypot(dx,dy)<TAP_THRESH)return;
    state.moved=true;
    // Horizontal drag: sign depends on which side the sidecol is on.
    // Left side: positive dx = moving right (toward center) = grow.
    // Right side: negative dx = moving left (toward center) = grow.
    var isRight=document.body.classList.contains('rside');
    var growDir=isRight?-dx:dx;
    var scaleDelta=growDir*0.003;
    var newScale=Math.max(SC_MIN,Math.min(SC_MAX,state.startScale+scaleDelta));
    _scState.scale=newScale;
    applyZoom(sidecol,_scState.scale);
    positionStab();positionLclFloat();
    markDirty();renderer.render(scene,activeCam());_renderDirty=false;
  }
  function onEnd(){
    if(!state)return;
    stab.classList.remove('resizing');
    if(!state.moved){
      _scState.sideOpen=!_scState.sideOpen;
      sidecol.classList.toggle('collapsed',!_scState.sideOpen);
      positionStab();positionLclFloat();
    }
    _saveScState();
    state=null;
  }
  stab.addEventListener('mousedown',onDown);
  document.addEventListener('mousemove',function(e){if(state)onMove(e);});
  document.addEventListener('mouseup',function(){if(state)onEnd();});
  stab.addEventListener('touchstart',onDown,{passive:false});
  stab.addEventListener('touchmove',onMove,{passive:false});
  stab.addEventListener('touchend',onEnd);
  stab.addEventListener('touchcancel',onEnd);
})();

// ── Side-switch button in status bar ──
var _sbSideBtn=document.getElementById('sb-sideswitch');
if(_sbSideBtn){
  _sbSideBtn.addEventListener('click',function(){
    _scState.rside=!_scState.rside;
    applySidecol();
    _saveScState();
  });
}

// Apply initial state
applySidecol();
// If both groups were persisted as detached, restore (hoist to body)
if(_scState.detached){
  var sgT=document.getElementById('sg-top');
  var sgB=document.getElementById('sg-bottom');
  if(sgT){sgT.classList.add('detached');document.body.appendChild(sgT);}
  if(sgB){sgB.classList.add('detached');document.body.appendChild(sgB);}
  document.body.classList.add('sc-detached');
  applySidecol();
  _updateScFab();
}
window.addEventListener('resize',positionStab);
if(window.visualViewport)window.visualViewport.addEventListener('resize',positionStab);
