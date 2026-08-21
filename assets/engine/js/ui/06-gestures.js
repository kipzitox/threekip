// ── Toast ─────────────────────────────────────────────────────────
let toastTimer=null;
function toast(msg,dur=1400){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),dur);}

// ── Gesture swap ─────────────────────────────────────────────────
// twoFingerMode: 'orbit' (default) | 'draw' (2-finger=pan, 1-finger=draw but on canvas only)
let twoFingerMode='orbit';
function updateGestLabel(){
  const txt=twoFingerMode==='orbit'?'2F=ORB':'2F=PAN';
  const b=document.getElementById('bgestswap');if(b)b.textContent=txt;
  var pb=document.getElementById('pb-gestswap');if(pb)pb.textContent=txt;
}
// stylusOnly: when true, finger touch = navigate (1F orbit, 2F pan); only pen draws
let stylusOnly=false;
function updateStylusLabel(){
  var txt=stylusOnly?'STYLUS':'FINGER';
  var b=document.getElementById('bstylus');if(b){b.textContent=txt;if(stylusOnly){b.classList.add('on');}else{b.classList.remove('on');}}
  var pb=document.getElementById('pb-stylus');if(pb){pb.textContent=txt;if(stylusOnly){pb.classList.add('on');}else{pb.classList.remove('on');}}
}

// ── Pointer / gesture handling ────────────────────────────────────
// Store the identifier of the finger that started drawing so we track the right finger even if indices shift
let _drawTouchId=null;
// _touchDragMode: tracks active touch drag in erase/select ('erase'|'select'|null)
var _touchDragMode=null;
// _dragSelectMode: 'add'|'remove' — set on first stroke touched, held for entire drag
var _dragSelectMode=null;
function ppos(e){
  if(e.touches){
    // If we have a stored drawing touch ID, find it specifically
    if(_drawTouchId!==null){
      for(let i=0;i<e.touches.length;i++){if(e.touches[i].identifier===_drawTouchId)return{x:e.touches[i].clientX,y:e.touches[i].clientY};}
    }
    return{x:e.touches[0].clientX,y:e.touches[0].clientY};
  }
  return{x:e.clientX,y:e.clientY};
}
let lastPD=null,lastTouchTime=0;
// Gesture lock for 2-finger: 'none' | 'zoom' | 'navigate'
let _twoFingerLock='none',_twoFingerStartD=0,_twoFingerStartCX=0,_twoFingerStartCY=0;
function pinchD(e){return Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}
let threeFingerPan=false,tf3Anchor=null,tf3TargetAtStart=null;

function panUnproject(sx,sy){
  var r=_cachedRect;
  const ndcX=(sx/r.width)*2-1,ndcY=-(sy/r.height)*2+1;
  if(useOrtho){
    // For ortho: unproject NDC directly to world space on the Z=target.z plane
    const ac=ortho;
    const worldPt=new THREE.Vector3(ndcX,ndcY,0).unproject(ac);
    return worldPt;
  }
  const ac=camera;
  const origin=new THREE.Vector3(),dir=new THREE.Vector3(ndcX,ndcY,.5);
  origin.setFromMatrixPosition(ac.matrixWorld);dir.unproject(ac).sub(origin).normalize();
  const fwd=new THREE.Vector3().subVectors(cam.target,origin).normalize();
  const denom=fwd.dot(dir);if(Math.abs(denom)<1e-6)return cam.target.clone();
  const t=fwd.dot(new THREE.Vector3().subVectors(cam.target,origin))/denom;
  return origin.clone().addScaledVector(dir,t);
}
function resetGesture(){cam.active=false;cam.panActive=false;lastPD=null;threeFingerPan=false;tf3Anchor=null;_twoFingerLock='none';_touchDragMode=null;_dragSelectMode=null;}
function cancelDraw(){if(isDrawing){isDrawing=false;rawPts=[];smoothPts=[];velHistory=[];lazyPos=null;_drawTouchId=null;prevLine.visible=false;_prevGeo.setDrawRange(0,0);}; _touchDragMode=null;_dragSelectMode=null;}
function startOrbit(e){const p=ppos(e);cam.active=true;cam.sx=p.x;cam.sy=p.y;cam.st=cam.theta;cam.sp=cam.phi;
  // Ortho auto-return: any manual orbit snaps back to perspective
  if(useOrtho)setOrtho(false);
}
function startPan(e){const p=ppos(e);cam.panActive=true;cam.panAnchor=panUnproject(p.x,p.y);cam.panTargetAtStart.copy(cam.target);cam._panPrevX=p.x;cam._panPrevY=p.y;}
function doOrbit(e){const p=ppos(e);
  if(_fpsMode){
    // FPS: drag right → look right → decrease theta; drag up → look up → decrease phi
    cam.theta=cam.st-(p.x-cam.sx)*.013;
    cam.phi=Math.max(.05,Math.min(Math.PI-.05,cam.sp+(p.y-cam.sy)*.013));
  } else {
    cam.theta=cam.st+(p.x-cam.sx)*.013;
    cam.phi=Math.max(.05,Math.min(Math.PI-.05,cam.sp-(p.y-cam.sy)*.013));
  }
  updCam();
}
function doPan(e,overrideCX,overrideCY){
  var cx,cy;
  if(overrideCX!=null){cx=overrideCX;cy=overrideCY;}
  else{const p=ppos(e);cx=p.x;cy=p.y;}
  var prevX=cam._panPrevX!=null?cam._panPrevX:cx;
  var prevY=cam._panPrevY!=null?cam._panPrevY:cy;
  var dx=cx-prevX,dy=cy-prevY;
  cam._panPrevX=cx;cam._panPrevY=cy;
  if(Math.abs(dx)<0.5&&Math.abs(dy)<0.5)return;
  var r=_cachedRect;
  if(useOrtho){
    var ac=ortho;
    var worldW=(ac.right-ac.left);var worldH=(ac.top-ac.bottom);
    cam.target.x-=(dx/r.width)*worldW;
    cam.target.y-=(dy/r.height)*worldH;
  } else {
    var wBefore=panUnproject((cx-dx)-r.left,(cy-dy)-r.top);
    var wAfter=panUnproject(cx-r.left,cy-r.top);
    cam.target.add(new THREE.Vector3().subVectors(wBefore,wAfter));
  }
  updCam();
}

function onDown(e){
  // ── Stylus-only mode: finger touches always navigate, only pen draws ──
  if(stylusOnly&&e.touches){
    if(e.touches.length===1){
      // 1 finger = orbit
      cancelDraw();
      startOrbit(e);
      return;
    }
    if(e.touches.length===2){
      // 2 finger = pan
      cancelDraw();
      cam.active=false;cam.panActive=false;threeFingerPan=false;tf3Anchor=null;
      const d=pinchD(e);
      lastPD=d;_twoFingerLock='none';_twoFingerStartD=d;
      const cx=(e.touches[0].clientX+e.touches[1].clientX)/2,cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
      _twoFingerStartCX=cx;_twoFingerStartCY=cy;
      // Arm pan immediately
      cam.panActive=true;cam._panPrevX=cx;cam._panPrevY=cy;
      return;
    }
  }
  // ── Two-finger: lock resolves in onMove (zoom vs navigate). Do NOT pre-set
  // cam.active/cam.panActive here — that state leaks if the gesture resolves
  // to pure zoom. Orbit/pan origin is armed lazily when lock becomes 'navigate'.
  if(e.touches&&e.touches.length===2){
    cancelDraw();
    // Clear any prior multi-touch state so a 3→2 step-down starts clean
    cam.active=false;cam.panActive=false;threeFingerPan=false;tf3Anchor=null;
    const d=pinchD(e);
    lastPD=d;
    _twoFingerLock='none';
    _twoFingerStartD=d;
    const cx=(e.touches[0].clientX+e.touches[1].clientX)/2,cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
    _twoFingerStartCX=cx;_twoFingerStartCY=cy;
    return;
  }
  // ── Three-finger: pan (or orbit when swapped). Clear any 2-finger state first
  // so a 2→3 step-up starts clean — previously lastPD/_twoFingerLock/cam.active
  // could leak from the preceding two-finger gesture.
  if(e.touches&&e.touches.length===3){
    cancelDraw();
    cam.active=false;cam.panActive=false;
    lastPD=null;_twoFingerLock='none';
    const mx=(e.touches[0].clientX+e.touches[1].clientX+e.touches[2].clientX)/3;
    const my=(e.touches[0].clientY+e.touches[1].clientY+e.touches[2].clientY)/3;
    if(twoFingerMode==='orbit'){threeFingerPan=true;cam._panPrevX=mx;cam._panPrevY=my;}
    else{cam.active=true;cam.sx=mx;cam.sy=my;cam.st=cam.theta;cam.sp=cam.phi;}
    return;
  }
  if(e.button===1){startPan(e);e.preventDefault();return;}
  if(e.button===2){startOrbit(e);return;}
  if(mode==='orbit'){startOrbit(e);return;}
  if(mode==='pan'){startPan(e);return;}
  if(mode==='erase'){setHoverStroke(null);_touchDragMode=e.touches?'erase':null;tryErase(e.clientX||ppos(e).x,e.clientY||ppos(e).y);return;}
  if(mode==='select'){
    const p=ppos(e);
    _touchDragMode=e.touches?'select':null;
    // Determine drag direction from first stroke hit: already selected → remove, else → add
    var firstHit=findNearestStroke(p.x,p.y);
    _dragSelectMode=firstHit&&selectedStrokes.indexOf(firstHit)>-1?'remove':'add';
    selectStroke(p.x,p.y,e.shiftKey||_selAddMode);
    return;
  }
  if(mode==='draw'){
    const p=ppos(e),pt=s2w(p.x,p.y);
    if(!pt)return;
    // Record which finger is drawing so ppos() tracks the right one if indices shift
    if(e.touches&&e.touches.length>0)_drawTouchId=e.touches[0].identifier;
    isDrawing=true;setSurfHover(false);rawPts=[pt];smoothPts=[pt];velHistory=[0];lazyPos=pt.clone();updPrev(smoothPts);
  }
}
function onMove(e){
  e.preventDefault();const p=ppos(e);
  if(e.touches&&e.touches.length>=2){
    if(e.touches.length===2){
      const d=pinchD(e);
      const cx=(e.touches[0].clientX+e.touches[1].clientX)/2;
      const cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
      // Stylus-only: 2-finger always pans (pinch-zoom still works, navigate = pan)
      if(stylusOnly){
        if(_twoFingerLock==='none'){
          const pinchDelta=Math.abs(d-_twoFingerStartD);
          const moveDelta=Math.hypot(cx-_twoFingerStartCX,cy-_twoFingerStartCY);
          if(pinchDelta>8)_twoFingerLock='zoom';
          else if(moveDelta>8){
            _twoFingerLock='navigate';
            if(!cam.panActive){cam.panActive=true;cam._panPrevX=cx;cam._panPrevY=cy;}
          }
        }
        if(_twoFingerLock==='zoom'||_twoFingerLock==='none'){
          if(lastPD!==null){
            const delta=lastPD-d;
            var midXs=cx-_cachedRect.left,midYs=cy-_cachedRect.top;
            var wBs=panUnproject(midXs,midYs);
            if(useOrtho){orthoZoom=Math.max(1,Math.min(50,orthoZoom+delta*.04));syncOrtho();updCam();var wAs=panUnproject(midXs,midYs);cam.target.add(new THREE.Vector3().subVectors(wBs,wAs));}
            else{var oldRs=cam.radius;cam.radius=Math.max(1,Math.min(40,cam.radius+delta*.04));var zFs=1-(cam.radius/Math.max(0.001,oldRs));cam.target.addScaledVector(new THREE.Vector3().subVectors(wBs,cam.target),zFs*0.35);}
            updCam();
          }
        }
        if(_twoFingerLock==='navigate'&&cam.panActive)doPan(null,cx,cy);
        lastPD=d;
      } else {
      // Determine gesture lock if not yet set (threshold: 8px)
      if(_twoFingerLock==='none'){
        const pinchDelta=Math.abs(d-_twoFingerStartD);
        const moveDelta=Math.hypot(cx-_twoFingerStartCX,cy-_twoFingerStartCY);
        if(pinchDelta>8)_twoFingerLock='zoom';
        else if(moveDelta>8){
          _twoFingerLock='navigate';
          // Arm orbit/pan origin now — lazily, only once the lock is decided
          if(twoFingerMode==='orbit'){cam.active=true;cam.sx=cx;cam.sy=cy;cam.st=cam.theta;cam.sp=cam.phi;if(useOrtho)setOrtho(false);}
          else{cam.panActive=true;cam._panPrevX=cx;cam._panPrevY=cy;}
        }
      }
      if(_twoFingerLock==='zoom'||_twoFingerLock==='none'){
        // Only apply zoom
        if(lastPD!==null){
          const delta=lastPD-d;
          var midX=cx-_cachedRect.left, midY=cy-_cachedRect.top;
          var worldBefore2=panUnproject(midX,midY);
          if(useOrtho){
            orthoZoom=Math.max(1,Math.min(50,orthoZoom+delta*.04));
            syncOrtho();updCam();
            var worldAfter2=panUnproject(midX,midY);
            cam.target.add(new THREE.Vector3().subVectors(worldBefore2,worldAfter2));
          } else {
            var oldR2=cam.radius;
            cam.radius=Math.max(1,Math.min(40,cam.radius+delta*.04));
            var zoomFrac2=1-(cam.radius/Math.max(0.001,oldR2));
            cam.target.addScaledVector(new THREE.Vector3().subVectors(worldBefore2,cam.target),zoomFrac2*0.35);
          }
          updCam();
        }
      }
      if(_twoFingerLock==='navigate'){
        // Only apply orbit or pan
        if(twoFingerMode==='orbit'&&cam.active){cam.theta=cam.st+(cx-cam.sx)*.013;cam.phi=Math.max(.05,Math.min(Math.PI-.05,cam.sp-(cy-cam.sy)*.013));updCam();}
        else if(twoFingerMode==='pan'&&cam.panActive)doPan(null,cx,cy);
      }
      lastPD=d;
      }
    }else if(e.touches.length===3){
      if(threeFingerPan){const mx=(e.touches[0].clientX+e.touches[1].clientX+e.touches[2].clientX)/3,my=(e.touches[0].clientY+e.touches[1].clientY+e.touches[2].clientY)/3;doPan(null,mx,my);}
      else if(cam.active){const mx=(e.touches[0].clientX+e.touches[1].clientX+e.touches[2].clientX)/3,my=(e.touches[0].clientY+e.touches[1].clientY+e.touches[2].clientY)/3;cam.theta=cam.st+(mx-cam.sx)*.013;cam.phi=Math.max(.05,Math.min(Math.PI-.05,cam.sp-(my-cam.sy)*.013));updCam();}
    }
    return;
  }
  if(mode==='draw'&&!isDrawing&&!cam.active&&!cam.panActive)setSurfHover(checkHover(p.x,p.y));
  if(cam.panActive){doPan(e);return;}
  if(cam.active){doOrbit(e);return;}
  if((mode==='erase')&&(e.buttons||_touchDragMode==='erase')){tryErase(p.x,p.y);return;}
  if(mode==='select'&&(e.buttons||_touchDragMode==='select')&&!cam.active&&!cam.panActive){
    var ds=findNearestStroke(p.x,p.y);
    if(ds){
      var dsIdx=selectedStrokes.indexOf(ds);
      if(_dragSelectMode==='add'&&dsIdx===-1){
        selectedStrokes.push(ds);
        updateSelHighlights();
        positionStrokeGizmo();
        document.getElementById('sgizmo').classList.add('vis');
        if(window._sgGcDraw)window._sgGcDraw();
      } else if(_dragSelectMode==='remove'&&dsIdx>-1){
        selectedStrokes.splice(dsIdx,1);
        updateSelHighlights();
        if(selectedStrokes.length===0)document.getElementById('sgizmo').classList.remove('vis');
        if(window._sgGcDraw)window._sgGcDraw();
      }
    }
    return;
  }
  if(isDrawing&&mode==='draw'){
    const raw=s2w(p.x,p.y);if(!raw)return;
    if(!smoothingOn){
      // RAW mode (v14.2): bypass lazyPos entirely — push every point as-is.
      // Gate lowered .003 → .001 so micro-wiggles on slow/precise strokes survive.
      const last=smoothPts[smoothPts.length-1];
      if(last&&raw.distanceTo(last)>.001){smoothPts.push(raw.clone());rawPts.push(raw.clone());velHistory.push(raw.distanceTo(last));updPrev(smoothPts);}
    } else {
      // SMOOTH mode: adaptive lazy — reduce smoothing factor for tight/small strokes
      // AND for fast strokes (large step per event) so preview keeps up with finger.
      if(!lazyPos)lazyPos=raw.clone();
      var effectiveLazy=LAZY_ON;
      var _step=raw.distanceTo(smoothPts[smoothPts.length-1]||raw);
      if(smoothPts.length>2){
        var _p0=smoothPts[smoothPts.length-3],_p1=smoothPts[smoothPts.length-2],_p2=smoothPts[smoothPts.length-1];
        var _d1=new THREE.Vector3().subVectors(_p1,_p0).normalize();
        var _d2=new THREE.Vector3().subVectors(_p2,_p1).normalize();
        var _curve=1-Math.max(0,_d1.dot(_d2));
        var _tightness=Math.min(1,_curve*2+(_step<0.04?0.5:0));
        effectiveLazy=LAZY_ON+(1.0-LAZY_ON)*(_tightness*.72);
      }
      // Fast-stroke boost: if pointer moved > 0.12 units since last sample, the
      // finger is moving quickly — increase lazy toward 1.0 so preview doesn't
      // fall behind. At step=0.30 we're effectively raw. Prevents the "writing
      // fast stroke not keeping up" feeling.
      if(_step>0.12){
        var speedBoost=Math.min(1,(_step-0.12)/0.18);  // 0 at step=0.12, 1 at step=0.30+
        effectiveLazy=effectiveLazy+(1.0-effectiveLazy)*speedBoost;
      }
      lazyPos.lerp(raw,effectiveLazy);
      const last=smoothPts[smoothPts.length-1];
      if(last&&lazyPos.distanceTo(last)>.009){smoothPts.push(lazyPos.clone());rawPts.push(raw.clone());velHistory.push(lazyPos.distanceTo(last));updPrev(smoothPts);}
    }
  }
}
function onUp(e){
  // Step-down: if fingers remain on screen, re-anchor the continuing gesture
  // instead of nuking all state. Classic case: lifting one finger of a 3-finger
  // pan should leave a 2-finger gesture active, not cancel everything.
  if(e&&e.touches&&e.touches.length>0){
    var remaining=e.touches.length;
    if(remaining===2){
      // Re-anchor for 2-finger zoom/navigate
      const d=pinchD(e);
      lastPD=d;_twoFingerLock='none';_twoFingerStartD=d;
      const cx=(e.touches[0].clientX+e.touches[1].clientX)/2,cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
      _twoFingerStartCX=cx;_twoFingerStartCY=cy;
      threeFingerPan=false;tf3Anchor=null;
      // Seed incremental pan prev position for the continuing gesture
      cam._panPrevX=cx;cam._panPrevY=cy;
      // Carry camera pose forward so navigate branch has a valid origin
      cam.active=false;cam.panActive=false;
      return;
    }
    if(remaining===1){
      // Down to 1 finger — end multi-touch navigation but don't re-arm drawing
      // (user didn't start with a single-finger touch; don't interpret mid-gesture leftover as a draw)
      lastPD=null;_twoFingerLock='none';threeFingerPan=false;tf3Anchor=null;
      cam.active=false;cam.panActive=false;
      _touchDragMode=null;_dragSelectMode=null;
      return;
    }
    // 3+ remaining: rarely hit; let the next touchmove re-anchor
    lastPD=null;_twoFingerLock='none';
    return;
  }
  const wasOrbit=cam.active,wasPan=cam.panActive,wasDraw=isDrawing;
  resetGesture();
  if(wasDraw&&!wasOrbit&&!wasPan){
    isDrawing=false;_drawTouchId=null;
    // In smooth mode: flush the true last raw position so the stroke ends where
    // the user lifted — lazy smoothing lags behind, causing end hooks on curves.
    if(smoothingOn&&rawPts.length>0&&smoothPts.length>0){
      var _lastRaw=rawPts[rawPts.length-1];
      var _lastSmooth=smoothPts[smoothPts.length-1];
      if(_lastRaw.distanceTo(_lastSmooth)>.003){smoothPts.push(_lastRaw.clone());}
    }
    finStroke();
  }
  else if(wasDraw){isDrawing=false;_drawTouchId=null;rawPts=[];smoothPts=[];velHistory=[];lazyPos=null;prevLine.visible=false;_prevGeo.setDrawRange(0,0);}
  // Pan/orbit modes are now sticky — user must manually switch back via buttons or keyboard
}
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('contextmenu',function(e){e.preventDefault();});
document.addEventListener('selectstart',function(e){if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;e.preventDefault();});

// ── Unified pointer input routing ─────────────────────────────────
// Pointer Events carry pointerType ('mouse'|'touch'|'pen') so we can
// distinguish stylus from finger for the STYLUS mode toggle.
// Strategy:
//   pen   → routed through pointerdown/move/up directly into onDown/onMove/onUp.
//            Touch events fired by the same pen contact are suppressed via _penActive.
//   touch → routed through touchstart/move/end as before (multi-touch needs e.touches).
//   mouse → routed through mousedown/move/up as before, with synthetic-mouse guard.
// touch-action:none on the canvas is required for pointer events to fire on Android.
renderer.domElement.style.touchAction='none';

// _penActive: true while a pen pointer is in contact, used to suppress
// the redundant touch events that Android also fires for stylus contacts.
var _penActive=false;

renderer.domElement.addEventListener('pointerdown',function(e){
  if(e.pointerType!=='pen')return;
  _penActive=true;
  // Capture so pointermove/up follow the pen even if it leaves the element
  try{renderer.domElement.setPointerCapture(e.pointerId);}catch(ex){}
  onDown(e);
},{passive:false});

renderer.domElement.addEventListener('pointermove',function(e){
  if(e.pointerType==='pen'){
    if(_penActive&&e.buttons>0){
      onMove(e);
      // Also feed hover preview for pens in select/erase mode — many Android
      // styli lack hover-above-screen, so this is the only pointermove they get.
      if(mode==='select'||mode==='erase'){
        _hoverPending={pointerType:e.pointerType,buttons:e.buttons,clientX:e.clientX,clientY:e.clientY};
        if(_hoverRafId==null)_hoverRafId=requestAnimationFrame(_runHover);
      }
    } else {
      // Pen hovering (buttons=0) — feed hover preview
      _hoverPending={pointerType:e.pointerType,buttons:e.buttons,clientX:e.clientX,clientY:e.clientY};
      if(_hoverRafId==null)_hoverRafId=requestAnimationFrame(_runHover);
    }
    return;
  }
  // mouse hover preview
  if(e.pointerType==='mouse'){
    _hoverPending={pointerType:e.pointerType,buttons:e.buttons,clientX:e.clientX,clientY:e.clientY};
    if(_hoverRafId==null)_hoverRafId=requestAnimationFrame(_runHover);
  }
});

renderer.domElement.addEventListener('pointerup',function(e){
  if(e.pointerType!=='pen')return;
  _penActive=false;
  onUp(e);
});

renderer.domElement.addEventListener('pointercancel',function(e){
  if(e.pointerType!=='pen')return;
  _penActive=false;
  cancelDraw();resetGesture();
});

renderer.domElement.addEventListener('pointerover',function(e){
  if(e.pointerType==='touch')return;
  _hoverPending={pointerType:e.pointerType,buttons:e.buttons,clientX:e.clientX,clientY:e.clientY};
  if(_hoverRafId==null)_hoverRafId=requestAnimationFrame(_runHover);
});

renderer.domElement.addEventListener('pointerleave',function(e){
  if(e.pointerType!=='touch')setHoverStroke(null);
});

// ── Hover preview rAF throttle (shared by pen + mouse pointermove above) ──
// rAF throttle — coalesce high-frequency pointermove events into one
// hit-test per animation frame. findNearestStroke is O(strokes × points)
// and was being called at pointer event rate (~120Hz on stylus).
var _hoverPending=null,_hoverRafId=null;
function _runHover(){
  _hoverRafId=null;
  var e=_hoverPending;_hoverPending=null;
  if(!e)return;
  if(e.pointerType==='touch')return;
  var inSelect=mode==='select'&&!cam.active&&!cam.panActive;
  var inErase=mode==='erase'&&!cam.active&&!cam.panActive;
  if((inSelect||inErase)&&(e.buttons===0||(e.pointerType==='pen'&&!isDrawing))){
    setHoverStroke(findNearestStroke(e.clientX,e.clientY));
  } else if(_hoverStroke){
    setHoverStroke(null);
  }
}

// ── Touch events (finger multi-touch, and stylus on devices that don't
//    report pointerType='pen'). Suppressed while a pen pointer is active
//    to avoid double-firing on devices that send both.
renderer.domElement.addEventListener('touchstart',function(e){
  if(_penActive)return; // pen is handled via pointer events
  lastTouchTime=Date.now();onDown(e);
},{passive:false});
renderer.domElement.addEventListener('touchmove',function(e){
  if(_penActive)return;
  lastTouchTime=Date.now();onMove(e);
},{passive:false});
renderer.domElement.addEventListener('touchend',function(e){
  if(_penActive)return;
  lastTouchTime=Date.now();onUp(e);
});
renderer.domElement.addEventListener('touchcancel',function(e){
  if(_penActive)return;
  lastTouchTime=Date.now();cancelDraw();resetGesture();
});

// ── Mouse events (desktop, guarded against synthetic mouse from touch) ──
function isSyntheticMouse(){return Date.now()-lastTouchTime<500;}
renderer.domElement.addEventListener('mousedown',e=>{if(!isSyntheticMouse())onDown(e);});
renderer.domElement.addEventListener('mousemove',e=>{if(!isSyntheticMouse())onMove(e);});
renderer.domElement.addEventListener('mouseup',  e=>{if(!isSyntheticMouse())onUp(e);});
renderer.domElement.addEventListener('mouseleave',function(){if(!isSyntheticMouse())setSurfHover(false);});
renderer.domElement.addEventListener('wheel',e=>{
  e.preventDefault();
  if(e.ctrlKey) return;
  if(_fpsMode){cam.target.z-=e.deltaY*0.003;updCam();return;}
  var mx=e.clientX, my=e.clientY;
  // World point under cursor before zoom (used to re-anchor target)
  var worldBefore=panUnproject(mx-_cachedRect.left, my-_cachedRect.top);
  if(useOrtho){
    orthoZoom=Math.max(1,Math.min(50,orthoZoom+e.deltaY*.025));
    syncOrtho();updCam();
    // Re-anchor: shift target so worldBefore stays under cursor
    var worldAfter=panUnproject(mx-_cachedRect.left, my-_cachedRect.top);
    cam.target.add(new THREE.Vector3().subVectors(worldBefore,worldAfter));
  } else {
    var oldR=cam.radius;
    cam.radius=Math.max(1,Math.min(40,cam.radius+e.deltaY*.02));
    // Re-anchor toward cursor: lerp target toward worldBefore by zoom fraction
    var zoomFrac=1-(cam.radius/oldR);
    cam.target.addScaledVector(new THREE.Vector3().subVectors(worldBefore,cam.target),zoomFrac*0.35);
  }
  updCam();
},{passive:false});

// ── Stylus hover highlight for UI buttons ──
(function(){
  var lastHovered=null;
  document.addEventListener('pointermove',function(e){
    if(e.pointerType!=='pen')return;
    var el=document.elementFromPoint(e.clientX,e.clientY);
    var btn=el?el.closest('.btn,.cyc-btn,.emb,.nsm-btn,.cw,.bprev-btn,.bprev-more,.cyc-pop-item,.bgpop-swatch,.tb-lrow,.fc-hdr-btn'):null;
    if(btn===lastHovered)return;
    if(lastHovered)lastHovered.classList.remove('hover');
    lastHovered=btn;
    if(btn)btn.classList.add('hover');
  },{passive:true});
  document.addEventListener('pointerleave',function(e){
    if(e.pointerType!=='pen')return;
    if(lastHovered){lastHovered.classList.remove('hover');lastHovered=null;}
  },{passive:true});
})();
