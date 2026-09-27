// ================================================================
//  LOCAL PLANE GIZMO v29 — unified 2D overlay (prototype parity)
//  One gizmo: arcs=rotate, arrows=move/scale, center=tap to toggle
//  Mode: 0=off, 1=on (move arrows + rotate arcs + center btn)
// ================================================================
(function(){

  // ── State ──────────────────────────────────────────────────────
  var _lgOn      = false;   // gizmo visible
  var _lgScale   = false;   // false=move arrows, true=scale squares

  // _localGroup: invisible THREE.Group used only for position+quaternion
  // (no visible 3D children — everything is drawn on the 2D overlay)
  var _localGroup = new THREE.Group();
  _localGroup.visible = false;
  scene.add(_localGroup);

  // ── 2D overlay canvas ──────────────────────────────────────────
  var _lgOverlay = document.createElement('canvas');
  _lgOverlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:15;';
  document.body.appendChild(_lgOverlay);
  var _lgCtx = _lgOverlay.getContext('2d');

  function _lgResize(){
    var w=window.innerWidth, h=window.innerHeight;
    _lgOverlay.width  = w*(window.devicePixelRatio||1);
    _lgOverlay.height = h*(window.devicePixelRatio||1);
    _lgOverlay.style.width  = w+'px';
    _lgOverlay.style.height = h+'px';
  }
  _lgResize();
  window.addEventListener('resize', function(){ _lgCtx.resetTransform(); _lgResize(); markDirty(); });

  // ── Constants ──────────────────────────────────────────────────
  var LG_RING_R  = 62;    // px — ring radius (constant in screen space)
  var LG_GAP     = 0.22;  // radians gap at each arrow
  var LG_ARROW   = 90;    // px from center to arrowhead tip
  var LG_HEAD_S  = 12;    // arrowhead half-width
  var LG_HEAD_L  = 18;    // arrowhead length
  var LG_BOX_S   = 11;    // scale square half-size
  var LG_CENTER_R= 16;    // px — center button hit radius
  var LG_HIT_ARC = 16;    // px tolerance on ring
  var LG_HIT_ARW = 18;    // px half-width for arrow/scale hit

  var LG_COLS = {x:'#e03040', y:'#22bb55', z:'#3377ee'};
  var LG_ARC_BOUNDS = {x:['z','y'], y:['z','x'], z:['x','y']};
  var LOCAL_DIRS = {
    x: new THREE.Vector3(1,0,0),
    y: new THREE.Vector3(0,1,0),
    z: new THREE.Vector3(0,0,1)
  };

  // ── Layout ─────────────────────────────────────────────────────
  var _lgLayout = null; // {cx,cy,axisAngles,flipped,arcs}

  function _lgProject(v3){
    var ac=activeCam(), v=v3.clone().project(ac);
    return{
      x:( v.x*0.5+0.5)*window.innerWidth,
      y:(-v.y*0.5+0.5)*window.innerHeight
    };
  }

  function _lgComputeLayout(){
    if(!_lgOn){ _lgLayout=null; return; }
    var ac  = activeCam();
    var pos = _localGroup.position;
    var cen = _lgProject(pos);
    var cx=cen.x, cy=cen.y;
    // Use camera matrix column projection — same method as card gizmo so axes match
    var camR   = new THREE.Vector3().setFromMatrixColumn(ac.matrixWorld, 0); // right
    var camU   = new THREE.Vector3().setFromMatrixColumn(ac.matrixWorld, 1); // up
    var camDir = new THREE.Vector3().subVectors(ac.position, pos).normalize();
    var axisAngles={}, flipped={};
    ['x','y','z'].forEach(function(ax){
      var dir = LOCAL_DIRS[ax].clone().applyQuaternion(_localGroup.quaternion).normalize();
      flipped[ax] = dir.dot(camDir) < 0;
      if(flipped[ax]) dir.negate();
      // Canvas-space angle via camera columns (same as _gcComputeLayout)
      var nx =  dir.dot(camR);
      var ny = -dir.dot(camU); // flip Y for canvas/screen
      axisAngles[ax] = Math.atan2(ny, nx);
    });
    function N(a){ return((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2); }
    var arcs={};
    ['x','y','z'].forEach(function(ax){
      var bA=LG_ARC_BOUNDS[ax][0], bB=LG_ARC_BOUNDS[ax][1];
      var s=N(axisAngles[bA]), e=N(axisAngles[bB]), own=N(axisAngles[ax]);
      var spanCCW=(e-s+Math.PI*2)%(Math.PI*2);
      var ownInCCW=((own-s+Math.PI*2)%(Math.PI*2))<spanCCW;
      var arcStart, arcEnd;
      if(!ownInCCW){ arcStart=s+LG_GAP; arcEnd=s+spanCCW-LG_GAP; }
      else          { arcStart=e+LG_GAP; arcEnd=e+(Math.PI*2-spanCCW)-LG_GAP; }
      arcs[ax]={start:arcStart, end:arcEnd};
    });
    _lgLayout={cx:cx, cy:cy, axisAngles:axisAngles, flipped:flipped, arcs:arcs};
  }

  // ── Draw ───────────────────────────────────────────────────────
  function _lgDraw(){
    // Freeze layout during rotate drag to prevent visual jitter
    if(_lgDrag&&_lgDrag.type==='ring'&&_lgDrag.frozenLayout){
      _lgLayout=_lgDrag.frozenLayout;
    } else {
      _lgComputeLayout();
    }
    var dpr = window.devicePixelRatio||1;
    _lgCtx.setTransform(dpr,0,0,dpr,0,0);
    _lgCtx.clearRect(0,0,window.innerWidth,window.innerHeight);
    if(!_lgLayout||!_lgOn) return;

    var cx=_lgLayout.cx, cy=_lgLayout.cy;
    var axisAngles=_lgLayout.axisAngles, arcs=_lgLayout.arcs, flipped=_lgLayout.flipped;

    // Determine hover/active highlights
    var hovAx   = _lgHov  ? _lgHov.ax   : null;
    var hovType = _lgHov  ? _lgHov.type : null;
    var dragAx  = _lgDrag ? _lgDrag.ax  : null;
    var dragType= _lgDrag ? _lgDrag.type: null;

    ['x','y','z'].forEach(function(ax){
      var col = LG_COLS[ax];
      var arc = arcs[ax];
      var angle = axisAngles[ax];
      var ax2=Math.cos(angle), ay2=Math.sin(angle);

      // ── Rotate arc ─────────────────────────────────────────────
      var arcHlit = (hovAx===ax&&hovType==='ring')||(dragAx===ax&&dragType==='ring');
      _lgCtx.save();
      if(arcHlit){ _lgCtx.shadowColor=col; _lgCtx.shadowBlur=14; }
      // colored arc only — no white outline
      _lgCtx.beginPath();
      _lgCtx.arc(cx,cy,LG_RING_R,arc.start,arc.end);
      _lgCtx.strokeStyle=col;
      _lgCtx.lineWidth=arcHlit?7:5; _lgCtx.lineCap='round';
      _lgCtx.globalAlpha=arcHlit?1:0.45;
      _lgCtx.stroke();
      _lgCtx.restore();

      // ── Arrow shaft ────────────────────────────────────────────
      var arwHlit = (hovAx===ax&&(hovType==='arrow'||hovType==='scale'))
                  ||(dragAx===ax&&(dragType==='arrow'||dragType==='scale'));
      var shaftS = LG_RING_R*0.55;
      var ex = cx+ax2*LG_ARROW, ey = cy+ay2*LG_ARROW;
      _lgCtx.save();
      if(arwHlit){ _lgCtx.shadowColor=col; _lgCtx.shadowBlur=10; }
      _lgCtx.globalAlpha = arwHlit?1:0.85;
      _lgCtx.strokeStyle=col; _lgCtx.lineWidth=arwHlit?4:3; _lgCtx.lineCap='round';
      _lgCtx.beginPath();
      _lgCtx.moveTo(cx+ax2*shaftS, cy+ay2*shaftS);
      _lgCtx.lineTo(ex, ey);
      _lgCtx.stroke();
      // tail dot
      _lgCtx.beginPath();
      _lgCtx.arc(cx+ax2*shaftS, cy+ay2*shaftS, arwHlit?4:2.5, 0, Math.PI*2);
      _lgCtx.fillStyle=col; _lgCtx.fill();

      if(_lgScale){
        // Scale square at tip
        var bx=ex+ax2*(LG_HEAD_L*0.5), by=ey+ay2*(LG_HEAD_L*0.5);
        var hs=arwHlit?LG_BOX_S*1.2:LG_BOX_S;
        _lgCtx.save();
        _lgCtx.translate(bx, by);
        _lgCtx.rotate(angle + Math.PI/4);
        _lgCtx.globalAlpha=arwHlit?0.9:0.65;
        _lgCtx.fillStyle=col;
        _lgCtx.fillRect(-hs,-hs,hs*2,hs*2);
        _lgCtx.restore();
      } else {
        // Arrow head
        var px=ay2, py=-ax2;
        _lgCtx.beginPath();
        _lgCtx.moveTo(ex+ax2*LG_HEAD_L, ey+ay2*LG_HEAD_L);
        _lgCtx.lineTo(ex+px*LG_HEAD_S,  ey+py*LG_HEAD_S);
        _lgCtx.lineTo(ex-px*LG_HEAD_S,  ey-py*LG_HEAD_S);
        _lgCtx.closePath();
        _lgCtx.fillStyle=col; _lgCtx.fill();
      }
      _lgCtx.restore();

      // ── Axis label ─────────────────────────────────────────────
      _lgCtx.save();
      _lgCtx.font='bold 11px DM Mono,monospace';
      _lgCtx.textAlign='center'; _lgCtx.textBaseline='middle';
      _lgCtx.fillStyle=col; _lgCtx.globalAlpha=arwHlit?1:0.9;
      var lx=cx+ax2*(LG_ARROW+LG_HEAD_L+10), ly=cy+ay2*(LG_ARROW+LG_HEAD_L+10);
      _lgCtx.fillText((flipped[ax]?'-':'')+ax.toUpperCase(), lx, ly);
      _lgCtx.restore();
    });

    // ── Center button ───────────────────────────────────────────
    var cenHlit = (hovType==='center')||(dragType==='center'||dragType==='center-drag');
    _lgCtx.save();
    if(_lgScale){
      // Diamond = scale mode active
      _lgCtx.translate(cx, cy);
      _lgCtx.rotate(Math.PI/4);
      var ds=cenHlit?9:7;
      _lgCtx.fillStyle='rgba(255,255,255,0.92)'; _lgCtx.fillRect(-ds,-ds,ds*2,ds*2);
      _lgCtx.fillStyle=cenHlit?'rgba(255,220,60,1)':'rgba(255,200,60,0.85)';
      var di=cenHlit?6:4.5; _lgCtx.fillRect(-di,-di,di*2,di*2);
    } else {
      // Circle = move mode
      _lgCtx.beginPath(); _lgCtx.arc(cx,cy,cenHlit?7:5,0,Math.PI*2);
      _lgCtx.fillStyle='rgba(255,255,255,0.90)'; _lgCtx.fill();
      _lgCtx.beginPath(); _lgCtx.arc(cx,cy,cenHlit?5:3.5,0,Math.PI*2);
      _lgCtx.fillStyle='rgba(80,80,110,0.65)'; _lgCtx.fill();
    }
    _lgCtx.restore();
  }

  // ── Hit testing (fully 2D screen space) ────────────────────────
  function _lgHit(px, py, isTouch){
    if(!_lgOn || !_lgLayout) return null;
    var cx=_lgLayout.cx, cy=_lgLayout.cy;
    var dx=px-cx, dy=py-cy;
    var dist=Math.sqrt(dx*dx+dy*dy);
    var angle=Math.atan2(dy,dx);
    var hitArc = isTouch ? 22 : LG_HIT_ARC;   // wider arc band for touch
    var hitArw = isTouch ? 28 : LG_HIT_ARW;   // wider arrow band for touch
    var cenR   = isTouch ? 26 : LG_CENTER_R;  // bigger center tap target

    // Center button — highest priority
    if(dist<=cenR) return{ax:null, type:'center'};

    // For touch: test arrows first when clearly outside the arc zone (avoids arcs stealing arrow taps)
    var inArcZone = Math.abs(dist-LG_RING_R) < hitArc;
    var shaftStart = LG_RING_R*0.4;
    var shaftEnd   = LG_ARROW + LG_HEAD_L;
    var axisAngles=_lgLayout.axisAngles;
    if(isTouch && !inArcZone){
      // Arrow-first when pointer is clearly not on the ring
      var axes0=['x','y','z'];
      for(var k=0;k<axes0.length;k++){
        var ax0=axes0[k];
        var ang0=axisAngles[ax0];
        var ac0=Math.cos(ang0), as0=Math.sin(ang0);
        var along0 = dx*ac0 + dy*as0;
        var perp0  = Math.abs(dx*(-as0) + dy*ac0);
        if(along0>=shaftStart && along0<=shaftEnd && perp0<hitArw){
          return{ax:ax0, type: _lgScale?'scale':'arrow'};
        }
      }
    }

    // Arc ring zone
    if(inArcZone){
      function normA(a){return((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);}
      var axes=['x','y','z'];
      for(var i=0;i<axes.length;i++){
        var ax=axes[i], arc=_lgLayout.arcs[ax];
        var s=normA(arc.start), e=normA(arc.end), a=normA(angle);
        var hit=(e>=s)?(a>=s&&a<=e):(a>=s||a<=e);
        if(hit) return{ax:ax, type:'ring'};
      }
    }

    // Arrows / scale handles (mouse, or touch when in arc zone)
    var axes2=['x','y','z'];
    for(var j=0;j<axes2.length;j++){
      var ax2=axes2[j];
      var ang=axisAngles[ax2];
      var acos=Math.cos(ang), asin=Math.sin(ang);
      var along = dx*acos + dy*asin;
      var perp   = Math.abs(dx*(-asin) + dy*acos);
      if(along>=shaftStart && along<=shaftEnd && perp<hitArw){
        return{ax:ax2, type: _lgScale?'scale':'arrow'};
      }
    }
    return null;
  }

  // ── Drag state & handlers ──────────────────────────────────────
  var _lgDrag = null;
  var _lgHov  = null;

  function _localAxisWorld(ax){
    // Returns axis direction already flipped toward camera — matches overlay arrow direction
    var dir = LOCAL_DIRS[ax].clone().applyQuaternion(_localGroup.quaternion).normalize();
    var ac  = activeCam();
    var camDir = new THREE.Vector3().subVectors(ac.position, _localGroup.position).normalize();
    if(dir.dot(camDir) < 0) dir.negate(); // same flip as _lgComputeLayout
    return dir;
  }

  function _lgStartDrag(hit, clientX, clientY){
    if(hit.type==='center'){
      _lgDrag={ax:null, type:'center',
        startClient:{x:clientX,y:clientY}, moved:false,
        oSurfScaleAxes:surfScaleAxes.clone(),
        oSurfPos:surfPos.clone(), oSurfEuler:surfEuler.clone(),
        oQuat:surfGroup.quaternion.clone(),
        frozenLayout:_lgLayout?JSON.parse(JSON.stringify(_lgLayout)):null};
      return;
    }
    _lgDrag={
      ax: hit.ax,
      type: hit.type,
      oSurfPos:        surfPos.clone(),
      oSurfEuler:      surfEuler.clone(),
      oQuat:           surfGroup.quaternion.clone(),
      runQuat:         surfGroup.quaternion.clone(), // running accumulated quat (ring)
      prevAngle:       _lgLayout                    // turntable: angle at last frame
        ? Math.atan2(clientY-_lgLayout.cy, clientX-_lgLayout.cx)
        : 0,
      oSurfScaleAxes:  surfScaleAxes.clone(),
      startClient:     {x:clientX, y:clientY},
      moved:           false,
      frozenLayout:    _lgLayout ? JSON.parse(JSON.stringify(_lgLayout)) : null,
      grabAngle: _lgLayout
        ? Math.atan2(clientY-_lgLayout.cy, clientX-_lgLayout.cx)
        : 0
    };
    _lgDraw();
  }

  function _lgApplyDrag(clientX, clientY){
    if(!_lgDrag) return;
    var dx = clientX - _lgDrag.startClient.x;
    var dy = clientY - _lgDrag.startClient.y;
    if(Math.abs(dx)>2||Math.abs(dy)>2) _lgDrag.moved=true;

    if(_lgDrag.type==='center'){
      if(Math.abs(dx)>5||Math.abs(dy)>5) _lgDrag.type='center-drag';
      else return;
    }

    var ax = _lgDrag.ax;

    if(_lgDrag.type==='arrow'){
      var _lgFL=_lgDrag.frozenLayout||_lgLayout;
      var axWorld  = LOCAL_DIRS[ax].clone().applyQuaternion(_lgDrag.oQuat).normalize();
      if(_lgFL&&_lgFL.flipped[ax]) axWorld.negate();
      var axAngle  = _lgFL ? _lgFL.axisAngles[ax] : 0;
      var proj     = (dx*Math.cos(axAngle) + dy*Math.sin(axAngle)) * 0.022;
      surfPos.copy(_lgDrag.oSurfPos).addScaledVector(axWorld, proj);

    } else if(_lgDrag.type==='scale'){
      var _lgFL2=_lgDrag.frozenLayout||_lgLayout;
      var axAngle2 = _lgFL2 ? _lgFL2.axisAngles[ax] : 0;
      var proj2    = (dx*Math.cos(axAngle2) + dy*Math.sin(axAngle2)) * 0.014;
      var sv=_lgDrag.oSurfScaleAxes.clone();
      if(ax==='x') sv.x=Math.max(0.05,sv.x+proj2);
      if(ax==='y') sv.y=Math.max(0.05,sv.y+proj2);
      if(ax==='z') sv.z=Math.max(0.05,sv.z+proj2);
      surfScaleAxes.copy(sv);

    } else if(_lgDrag.type==='center-drag'){
      // Uniform scale — drag right/up = bigger
      var delta=(dx-dy)*0.008;
      var s=Math.max(0.05,1+delta);
      var sv2=_lgDrag.oSurfScaleAxes.clone();
      sv2.x=Math.max(0.05,sv2.x*s);
      sv2.y=Math.max(0.05,sv2.y*s);
      sv2.z=Math.max(0.05,sv2.z*s);
      surfScaleAxes.copy(sv2);

    } else if(_lgDrag.type==='ring'){
      // Turntable rotation: compute angle from gizmo centre each frame,
      // take the SHORT delta from the previous frame's angle.
      // This eliminates tangent-crossing jumps and sign-reversal jitter entirely.
      var fl=_lgDrag.frozenLayout||_lgLayout;
      var gcx = fl ? fl.cx : (window.innerWidth/2);
      var gcy = fl ? fl.cy : (window.innerHeight/2);
      var curAngle = Math.atan2(clientY - gcy, clientX - gcx);
      var prevAngle = _lgDrag.prevAngle;
      // shortAngleDelta: unwrap to [-π, π]
      var rawIncr = curAngle - prevAngle;
      while(rawIncr >  Math.PI) rawIncr -= Math.PI*2;
      while(rawIncr < -Math.PI) rawIncr += Math.PI*2;
      _lgDrag.prevAngle = curAngle;

      // Flip for per-axis convention (matches card gizmo sign)
      if(fl&&fl.flipped[ax]) rawIncr=-rawIncr;
      if(ax==='z') rawIncr=-rawIncr;

      // Apply snap: accumulate total angle, snap the total, recover frame delta
      _lgDrag.accumAngle = (_lgDrag.accumAngle||0) + rawIncr;
      var incrProj3;
      if(snapEnabled){
        var snappedTotal = snapAngle(_lgDrag.accumAngle);
        incrProj3 = snappedTotal - (_lgDrag.lastSnapped||0);
        _lgDrag.lastSnapped = snappedTotal;
      } else {
        incrProj3 = rawIncr;
      }

      // Incremental quaternion compose on running quat — no gimbal drift
      var runQuat3 = _lgDrag.runQuat || _lgDrag.oQuat.clone();
      var localAxis3 = LOCAL_DIRS[ax].clone().applyQuaternion(runQuat3).normalize();
      var delta3 = new THREE.Quaternion().setFromAxisAngle(localAxis3, incrProj3);
      var newQuat3 = runQuat3.clone().premultiply(delta3).normalize();
      _lgDrag.runQuat = newQuat3;

      // Decompose back to surfEuler (strip base-plane quaternion)
      var bqLg = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0,0,1), PNORMALS[curPlane]);
      var userQuat3 = newQuat3.clone().multiply(bqLg.clone().invert());
      surfEuler.setFromQuaternion(userQuat3.normalize(), 'XYZ');
    }

    syncSurf();
    _lgDraw(); // _lgDraw handles layout recompute with freeze logic
  }

  function _lgEndDrag(){
    if(_lgDrag){
      // Center tap (no move) → toggle move/scale
      if((_lgDrag.type==='center')&&!_lgDrag.moved){
        _lgScale = !_lgScale;
        _lgComputeLayout();
        _lgDraw();
      }
    }
    _lgDrag=null;
    _lgComputeLayout();
    _lgDraw();
  }

  // ── Pointer events ─────────────────────────────────────────────
  setTimeout(function(){
    var cvs = renderer.domElement;
    if(!cvs) return;

    cvs.addEventListener('pointerdown', function(e){
      if(!_lgOn) return;
      var hit = _lgHit(e.clientX, e.clientY, e.pointerType==='touch');
      if(!hit) return;
      e.stopImmediatePropagation(); e.preventDefault();
      cvs.setPointerCapture(e.pointerId);
      _lgStartDrag(hit, e.clientX, e.clientY);
    }, true);

    cvs.addEventListener('pointermove', function(e){
      if(!_lgOn) return;
      if(_lgDrag){
        e.stopImmediatePropagation(); e.preventDefault();
        _lgApplyDrag(e.clientX, e.clientY);
        return;
      }
      // Hover — mouse + pen only
      if(e.pointerType==='touch') return;
      var hit = _lgHit(e.clientX, e.clientY, false);
      var newKey = hit ? hit.ax+hit.type : null;
      var oldKey = _lgHov ? _lgHov.ax+_lgHov.type : null;
      if(newKey!==oldKey){
        _lgHov = hit;
        _lgComputeLayout();
        _lgDraw();
      }
    }, true);

    cvs.addEventListener('pointerup', function(e){
      if(!_lgDrag) return;
      e.stopImmediatePropagation();
      _lgEndDrag();
      _lgHov = null;
      _lgDraw();
    }, true);

    cvs.addEventListener('pointercancel', function(){
      _lgDrag=null; _lgHov=null; _lgDraw();
    }, true);

    // Touch passthrough block
    cvs.addEventListener('touchstart', function(e){
      if(!_lgOn) return;
      var t=e.touches[0];
      if(!_lgHit(t.clientX, t.clientY, true)) return;
      e.stopImmediatePropagation(); e.preventDefault();
    }, {capture:true, passive:false});

    cvs.addEventListener('touchmove', function(e){
      if(!_lgOn||!_lgDrag) return;
      e.stopImmediatePropagation(); e.preventDefault();
    }, {capture:true, passive:false});

    cvs.addEventListener('touchend', function(e){
      if(!_lgOn||!_lgDrag) return;
      e.stopImmediatePropagation();
    }, true);
  }, 0);

  // ── Public sync hook (called by syncSurf) ──────────────────────
  window._syncLocalGizmo = function(){
    if(!_lgOn) return;
    _localGroup.position.copy(surfPos);
    _localGroup.quaternion.copy(surfGroup.quaternion);
    _lgComputeLayout();
    _lgDraw();
    markDirty();
  };

  // ── Overlay draw — called from animate() loop, same RAF as renderer.render() ──
  // Do NOT hook into _gDraw (which fires in the event handler before the RAF).
  // By drawing here, projection and Three.js render always use the same camera matrix.
  window._lgOverlayDraw = function(){
    if(_lgOn){
      _lgComputeLayout();
      _lgDraw();
    } else {
      var dpr=window.devicePixelRatio||1;
      _lgCtx.setTransform(dpr,0,0,dpr,0,0);
      _lgCtx.clearRect(0,0,window.innerWidth,window.innerHeight);
    }
  };

  // ── Button wiring — external "LCL" button toggles on/off ──────
  function _lgToggle(){
    _lgOn = !_lgOn;
    if(_lgOn){
      _localGroup.position.copy(surfPos);
      _localGroup.quaternion.copy(surfGroup.quaternion);
      _lgComputeLayout();
      _lgDraw();
    } else {
      _lgCtx.setTransform(1,0,0,1,0,0);
      _lgCtx.clearRect(0,0,_lgOverlay.width,_lgOverlay.height);
    }
    _syncButtons();
    markDirty();
  }
  window._cycleLocalGizmo = _lgToggle; // kept for compatibility

  function _syncButtons(){
    var on=_lgOn;
    var b1=document.getElementById('glocal');
    var b2=document.getElementById('pb-glocal');
    var b3=document.getElementById('lcl-float');
    if(b1){b1.textContent='⊕LCL';b1.classList.toggle('on',on);}
    if(b2){b2.textContent='⊕LCL';b2.classList.toggle('on',on);}
    if(b3){b3.textContent='⊕ LCL';b3.classList.toggle('on',on);}
    // Hide card gizmo canvas while local overlay is active — keep other buttons
    var gcEl=document.getElementById('gc');if(gcEl)gcEl.style.display=on?'none':'';
    var pbGcEl=document.getElementById('pb-gc');if(pbGcEl)pbGcEl.style.display=on?'none':'';
  }

  setTimeout(function(){
    var b1=document.getElementById('glocal');
    var b2=document.getElementById('pb-glocal');
    var b3=document.getElementById('lcl-float');
    if(b1) b1.addEventListener('click', _lgToggle);
    if(b2) b2.addEventListener('click', _lgToggle);
    if(b3) b3.addEventListener('click', _lgToggle);
    // lcl-snap mirrors the shared snapEnabled toggle
    var bs=document.getElementById('lcl-snap');
    if(bs) bs.addEventListener('click',function(){
      if(window._setSnapEnabled) window._setSnapEnabled(!snapEnabled);
      this.classList.toggle('on',snapEnabled);
    });
    _syncButtons();
  }, 0);

})();
