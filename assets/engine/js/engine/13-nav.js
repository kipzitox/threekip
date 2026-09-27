// ================================================================
//  NAVCUBE — XYZ axis orientation gizmo (Blender-style)
//  Three coloured arms from centre, label dots at tips.
//  Tap a tip dot to snap to that view. Drag to orbit.
// ================================================================
(function(){
  // Axis definitions: world direction, snap config, colour, label
  const AXES=[
    {dir:[1,0,0],  col:'#e03040',lbl:'X', snap:{phi:Math.PI/2,theta:Math.PI},       neg:{phi:Math.PI/2,theta:0}},
    {dir:[-1,0,0], col:'#e03040',lbl:'-X',snap:{phi:Math.PI/2,theta:0},              neg:{phi:Math.PI/2,theta:Math.PI}},
    {dir:[0,1,0],  col:'#22bb55',lbl:'Y', snap:{phi:Math.PI/2,theta:Math.PI/2},     neg:{phi:Math.PI/2,theta:-Math.PI/2}},
    {dir:[0,-1,0], col:'#22bb55',lbl:'-Y',snap:{phi:Math.PI/2,theta:-Math.PI/2},    neg:{phi:Math.PI/2,theta:Math.PI/2}},
    {dir:[0,0,1],  col:'#3377ee',lbl:'Z', snap:{phi:0.001,theta:-Math.PI/2},         neg:{phi:Math.PI-0.001,theta:-Math.PI/2}},
    {dir:[0,0,-1], col:'#3377ee',lbl:'-Z',snap:{phi:Math.PI-0.001,theta:-Math.PI/2}, neg:{phi:0.001,theta:-Math.PI/2}},
  ];
  const LABELS_MAP={
    'X':'RGT','-X':'LFT','Y':'BCK','-Y':'FRT','Z':'TOP','-Z':'BTM'
  };

  function setupNavCube(nc,W,H){
    // ── Tear down previous listeners if this canvas was already set up ──
    if(nc._ncCleanup) nc._ncCleanup();

    const ctx=nc.getContext('2d'),CX=W/2,CY=H/2;
    const ARM=Math.min(W,H)*0.37; // arm length in canvas px
    const DOT=Math.min(W,H)*0.10; // dot radius
    let ncDrag=null,ncLastTap=0,hovAxis=null;

    // Project a 3D world direction vector to 2D canvas coords
    function projectDir(dx,dy,dz){
      const sinPhi=Math.sin(cam.phi),cosPhi=Math.cos(cam.phi);
      const sinTheta=Math.sin(cam.theta),cosTheta=Math.cos(cam.theta);
      const rx=-sinTheta, ry=cosTheta, rz=0;
      const fx=sinPhi*cosTheta,fy=sinPhi*sinTheta,fz=cosPhi;
      const ux=fy*rz-fz*ry, uy=fz*rx-fx*rz, uz=fx*ry-fy*rx;
      const cx2=dx*rx+dy*ry+dz*rz;
      const cy2=dx*ux+dy*uy+dz*uz;
      return{x:CX+cx2*ARM, y:CY-cy2*ARM};
    }

    function hitAxis(mx,my){
      let best=-1,bestD=Infinity;
      AXES.forEach((ax,i)=>{
        const p=projectDir(ax.dir[0],ax.dir[1],ax.dir[2]);
        const d=Math.hypot(mx-p.x,my-p.y);
        if(d<DOT*2.2&&d<bestD){bestD=d;best=i;}
      });
      return best;
    }

    function isAlignedTo(phi,theta){
      var dp=Math.abs(cam.phi-phi),dt=Math.abs(cam.theta-theta);
      while(dt>Math.PI)dt=Math.abs(dt-Math.PI*2);
      return dp<0.08&&dt<0.08;
    }

    function snapTo(axIdx,goOrtho){
      var ax=AXES[axIdx];
      var targetPhi=ax.snap.phi,targetTheta=ax.snap.theta;
      if(isAlignedTo(targetPhi,targetTheta)){
        targetPhi=ax.neg.phi;targetTheta=ax.neg.theta;
      }
      cam.phi=targetPhi;cam.theta=targetTheta;
      updCam();
      if(goOrtho)setOrtho(true);
      else if(useOrtho)setOrtho(false);
      toast(LABELS_MAP[ax.lbl]||ax.lbl);
    }

    function draw(){
      ctx.clearRect(0,0,W,H);
      const projected=AXES.map((ax,i)=>{
        const p=projectDir(ax.dir[0],ax.dir[1],ax.dir[2]);
        const depth=ax.dir[0]*Math.sin(cam.phi)*Math.cos(cam.theta)+
                    ax.dir[1]*Math.sin(cam.phi)*Math.sin(cam.theta)+
                    ax.dir[2]*Math.cos(cam.phi);
        return{ax,i,p,depth};
      }).sort((a,b)=>a.depth-b.depth);

      ctx.save();
      ctx.strokeStyle=_uiInk(.08);ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(CX,CY,Math.min(W,H)/2-1,0,Math.PI*2);ctx.stroke();
      ctx.restore();

      projected.forEach(({ax,i,p,depth})=>{
        const isFront=depth>=-0.01;
        const isHov=hovAxis===i;
        const alpha=isFront?(isHov?1:.85):(isHov?.55:.28);
        const col=ax.col;
        const dotR=DOT*(isFront?1:.7);

        ctx.save();
        ctx.strokeStyle=col;ctx.lineWidth=isFront?2:1.2;ctx.globalAlpha=alpha*0.7;
        ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(CX,CY);ctx.lineTo(p.x,p.y);ctx.stroke();

        ctx.globalAlpha=alpha;
        ctx.fillStyle=isFront?(isHov?col:col):_uiInk(.2);
        ctx.beginPath();ctx.arc(p.x,p.y,dotR,0,Math.PI*2);ctx.fill();
        if(isFront&&isHov){
          ctx.strokeStyle='#fff';ctx.lineWidth=1.2;ctx.globalAlpha=.7;
          ctx.beginPath();ctx.arc(p.x,p.y,dotR,0,Math.PI*2);ctx.stroke();
        }

        if(isFront){
          ctx.globalAlpha=isHov?1:.75;
          ctx.fillStyle=isHov?'#fff':col;
          ctx.font=(isHov?'600 ':'')+(dotR>6?'7px':'6px')+' DM Mono,monospace';
          ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.fillText(ax.lbl,p.x,p.y+.5);
        }
        ctx.restore();
      });

      ctx.save();ctx.fillStyle=_uiInk(.25);
      ctx.beginPath();ctx.arc(CX,CY,2.5,0,Math.PI*2);ctx.fill();ctx.restore();
    }

    // ── getPos: map from visual CSS space → canvas logical space ──
    // Handles CSS zoom, transform:scale, and any CSS size ≠ logical size.
    function getPos(e){
      const r=nc.getBoundingClientRect();
      const src=e.touches&&e.touches.length>0?e.touches[0]:e.changedTouches&&e.changedTouches.length>0?e.changedTouches[0]:e;
      const rw=r.width||1, rh=r.height||1;
      return{x:(src.clientX-r.left)*(W/rw), y:(src.clientY-r.top)*(H/rh)};
    }

    var ncHoldTimer=null;

    // ── Named handler functions (removable) ──
    function onMouseDown(e){e.stopPropagation();const p=getPos(e);ncDrag={sx:p.x,sy:p.y,st:cam.theta,sp:cam.phi,moved:false};}
    function onMouseMove(e){
      const p=getPos(e);
      const h=ncDrag?-1:hitAxis(p.x,p.y);
      if(!ncDrag&&h!==hovAxis){hovAxis=h;draw();}
      if(!ncDrag)return;
      const dx=p.x-ncDrag.sx,dy=p.y-ncDrag.sy;
      if(Math.hypot(dx,dy)>4){ncDrag.moved=true;if(useOrtho)setOrtho(false);}
      if(ncDrag.moved){cam.theta=ncDrag.st+dx*.022;cam.phi=Math.max(.05,Math.min(Math.PI-.05,ncDrag.sp-dy*.022));updCam();draw();}
    }
    function onMouseUp(e){
      if(!ncDrag)return;
      if(!ncDrag.moved){const p=getPos(e);const h=hitAxis(p.x,p.y);if(h>-1)snapTo(h,false);}
      ncDrag=null;draw();
    }
    function onMouseLeave(){hovAxis=null;ncDrag=null;draw();}
    function onTouchStart(e){
      e.preventDefault();e.stopPropagation();
      const p=getPos(e);
      ncDrag={sx:p.x,sy:p.y,st:cam.theta,sp:cam.phi,moved:false,startT:Date.now()};
      if(ncHoldTimer)clearTimeout(ncHoldTimer);
      ncHoldTimer=setTimeout(function(){
        if(ncDrag&&!ncDrag.moved){
          const pp=getPos(e);const h=hitAxis(pp.x,pp.y);
          if(h>-1){snapTo(h,true);ncDrag.consumed=true;draw();}
        }
        ncHoldTimer=null;
      },400);
    }
    function onTouchMove(e){
      e.preventDefault();e.stopPropagation();
      if(!ncDrag)return;
      const p=getPos(e);const dx=p.x-ncDrag.sx,dy=p.y-ncDrag.sy;
      if(Math.hypot(dx,dy)>4){ncDrag.moved=true;if(ncHoldTimer){clearTimeout(ncHoldTimer);ncHoldTimer=null;}if(useOrtho)setOrtho(false);}
      if(ncDrag.moved){cam.theta=ncDrag.st+dx*.022;cam.phi=Math.max(.05,Math.min(Math.PI-.05,ncDrag.sp-dy*.022));updCam();draw();}
    }
    function onTouchEnd(e){
      e.stopPropagation();
      if(ncHoldTimer){clearTimeout(ncHoldTimer);ncHoldTimer=null;}
      if(ncDrag&&!ncDrag.moved&&!ncDrag.consumed){
        const p=getPos(e);const h=hitAxis(p.x,p.y);
        if(h>-1)snapTo(h,false);
      }
      ncDrag=null;draw();
    }

    nc.addEventListener('mousedown',onMouseDown);
    nc.addEventListener('mousemove',onMouseMove);
    nc.addEventListener('mouseup',onMouseUp);
    nc.addEventListener('mouseleave',onMouseLeave);
    nc.addEventListener('touchstart',onTouchStart,{passive:false});
    nc.addEventListener('touchmove',onTouchMove,{passive:false});
    nc.addEventListener('touchend',onTouchEnd);

    // ── Store cleanup function so next setupNavCube call can remove these ──
    nc._ncCleanup=function(){
      if(ncHoldTimer){clearTimeout(ncHoldTimer);ncHoldTimer=null;}
      nc.removeEventListener('mousedown',onMouseDown);
      nc.removeEventListener('mousemove',onMouseMove);
      nc.removeEventListener('mouseup',onMouseUp);
      nc.removeEventListener('mouseleave',onMouseLeave);
      nc.removeEventListener('touchstart',onTouchStart);
      nc.removeEventListener('touchmove',onTouchMove);
      nc.removeEventListener('touchend',onTouchEnd);
    };

    draw();return draw;
  }

  const nc=document.getElementById('navcube');window._ncDraw=setupNavCube(nc,nc.width,nc.height);
  const pnc=document.getElementById('pb-navcube');if(pnc)window._pbNcDraw=setupNavCube(pnc,pnc.width,pnc.height);
  window._pbNcReinit=function(){var c=document.getElementById('pb-navcube');if(c)window._pbNcDraw=setupNavCube(c,c.width,c.height);};
})();

// ================================================================
//  NAV JOYSTICK — pan joystick that swaps with NavCube in the nav slot
//
//  Behaviour:
//  - Touch/drag: knob follows finger, clamped to rim
//  - Single tap-release: one small pan step in the direction touched
//  - Hold: continuous pan while held, speed proportional to deflection
//  - Direction: always follows joystick push — right=cam-right, up=cam-up
//    Diagonal movement uses atan2 on the raw vector, no axis reversal
// ================================================================
(function(){
  let navShowJoy=false;

  // ── Reset view ───────────────────────────────────────────────────
  const CAM_DEFAULT={theta:-Math.PI/2,phi:Math.PI/2,radius:10};
  function resetView(){
    // If in FPS, exit without restoring saved cam (we want full reset)
    if(_fpsMode){
      _fpsMode=false;
      document.body.classList.remove('fps-active');
      _fpsSavedCam=null;
      _disposeFpsPlane();
      surfGroup.visible=true;
      navState=0;
      applyNavToggle();
    }
    cam.theta=CAM_DEFAULT.theta;cam.phi=CAM_DEFAULT.phi;cam.radius=CAM_DEFAULT.radius;
    cam.target.set(0,0,0);updCam();toast('View reset');
  }
  ['nav-reset','pb-nav-reset'].forEach(function(id){
    const b=document.getElementById(id);if(b)b.addEventListener('click',resetView);
  });

  // ── Zoom +/− buttons ─────────────────────────────────────────────
  // Tap = one step (~5%). Hold = continuous zoom via RAF.
  const ZOOM_STEP=0.05; // fraction of current radius per tap
  const ZOOM_HOLD_DELAY=180; // ms before continuous starts
  function applyZoom(dir){
    // dir: +1 = zoom in (reduce radius), -1 = zoom out (increase radius)
    if(useOrtho){
      orthoZoom=Math.max(1,Math.min(50,orthoZoom*(1-dir*ZOOM_STEP)));
      syncOrtho();
    } else {
      cam.radius=Math.max(1,Math.min(40,cam.radius*(1-dir*ZOOM_STEP)));
    }
    updCam();markDirty();
  }
  function setupZoomBtn(inId,outId){
    [
      {id:inId,dir:1},
      {id:outId,dir:-1}
    ].forEach(function(cfg){
      const b=document.getElementById(cfg.id);
      if(!b)return;
      let rafId=null,holdTimer=null;
      function startZoom(e){
        e.preventDefault();e.stopPropagation();
        applyZoom(cfg.dir);
        holdTimer=setTimeout(function(){
          function loop(){applyZoom(cfg.dir);rafId=requestAnimationFrame(loop);}
          rafId=requestAnimationFrame(loop);
        },ZOOM_HOLD_DELAY);
      }
      function stopZoom(){
        clearTimeout(holdTimer);holdTimer=null;
        if(rafId){cancelAnimationFrame(rafId);rafId=null;}
      }
      b.addEventListener('mousedown',startZoom);
      b.addEventListener('touchstart',startZoom,{passive:false});
      b.addEventListener('mouseup',stopZoom);
      b.addEventListener('mouseleave',stopZoom);
      b.addEventListener('touchend',stopZoom);
      b.addEventListener('touchcancel',stopZoom);
    });
  }
  setupZoomBtn('nav-zoom-in','nav-zoom-out');
  setupZoomBtn('pb-nav-zoom-in','pb-nav-zoom-out');


  const PAN_SPEED=0.00015;  // world units per pixel deflection per frame, ×radius (slowed v14.2)
  const JOY_DEADZONE=0.15;  // fraction of MAX_D that must be exceeded before panning starts

  function setupJoy(el){
    if(!el)return;
    if(el._joyCleanup)el._joyCleanup();
    const ctx=el.getContext('2d');
    const W=el.width,H=el.height,CX=W/2,CY=H/2;
    const PAD_R=Math.min(W,H)/2-4;
    const KNOB_R=Math.min(W,H)*0.14;
    const MAX_D=PAD_R-KNOB_R-2;
    const DEADZONE_PX=MAX_D*JOY_DEADZONE;
    let active=false,kx=0,ky=0,rafId=null;

    function draw(){
      ctx.clearRect(0,0,W,H);
      ctx.save();
      // Rim
      ctx.strokeStyle=_uiInk(.15);ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(CX,CY,PAD_R,0,Math.PI*2);ctx.stroke();
      // Deadzone ring — faint, so user can see where responsive zone begins
      ctx.strokeStyle=_uiInk(.10);ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(CX,CY,DEADZONE_PX,0,Math.PI*2);ctx.stroke();
      // Crosshair
      ctx.strokeStyle=_uiInk(.08);ctx.lineWidth=1;ctx.setLineDash([2,4]);
      ctx.beginPath();ctx.moveTo(CX,CY-PAD_R+5);ctx.lineTo(CX,CY+PAD_R-5);ctx.stroke();
      ctx.beginPath();ctx.moveTo(CX-PAD_R+5,CY);ctx.lineTo(CX+PAD_R-5,CY);ctx.stroke();
      ctx.setLineDash([]);
      // Direction line when active
      if(active&&(kx!==0||ky!==0)){
        ctx.strokeStyle=_uiInk(.18);ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(CX,CY);ctx.lineTo(CX+kx,CY+ky);ctx.stroke();
      }
      // Knob
      ctx.fillStyle=active?_uiInk(.28):_uiInk(.12);
      ctx.strokeStyle=_uiInk(.25);ctx.lineWidth=1.2;
      ctx.beginPath();ctx.arc(CX+kx,CY+ky,KNOB_R,0,Math.PI*2);ctx.fill();ctx.stroke();
      // Idle hint arrows
      if(!active&&kx===0&&ky===0){
        ctx.strokeStyle=_uiInk(.12);ctx.lineWidth=1;ctx.lineCap='round';
        [[0,-1],[0,1],[-1,0],[1,0]].forEach(function(d){
          const r=PAD_R-8;
          ctx.beginPath();ctx.moveTo(CX+d[0]*(r-5),CY+d[1]*(r-5));ctx.lineTo(CX+d[0]*r,CY+d[1]*r);ctx.stroke();
        });
      }
      ctx.restore();
    }

    function applyPan(dx,dy){
      const dist=Math.sqrt(dx*dx+dy*dy);
      // Deadzone: if within inner ring, no pan
      if(dist<DEADZONE_PX)return;
      // Rescale: remap [DEADZONE_PX, MAX_D] to [0, MAX_D] so full-range stays reachable
      const effDist=(dist-DEADZONE_PX)*(MAX_D/(MAX_D-DEADZONE_PX));
      const s=effDist/dist; // scale factor on the (dx,dy) vector
      const edx=dx*s,edy=dy*s;
      const sinT=Math.sin(cam.theta),cosT=Math.cos(cam.theta);
      const sinP=Math.sin(cam.phi),cosP=Math.cos(cam.phi);
      const rx=-sinT,ry=cosT; // camera right
      const fz=cosP,fy=sinP*sinT,fx=sinP*cosT;
      const ux=ry*fz,uy=-rx*fz,uz=rx*fy-ry*fx; // camera up
      const sc=cam.radius*PAN_SPEED;
      cam.target.x+=(edx*rx+edy*ux)*sc;
      cam.target.y+=(edx*ry+edy*uy)*sc;
      cam.target.z+=(edy*uz)*sc;
      updCam();
    }

    function clamp(dx,dy){
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d>MAX_D)return{x:dx/d*MAX_D,y:dy/d*MAX_D};
      return{x:dx,y:dy};
    }

    function getPos(e){
      const r=el.getBoundingClientRect();
      const src=e.touches&&e.touches.length>0?e.touches[0]:e.changedTouches&&e.changedTouches.length>0?e.changedTouches[0]:e;
      var rw=r.width||1,rh=r.height||1;
      return{x:(src.clientX-r.left)*(W/rw),y:(src.clientY-r.top)*(H/rh)};
    }

    function onStart(e){
      e.preventDefault();e.stopPropagation();
      active=true;
      const p=getPos(e),c=clamp(p.x-CX,p.y-CY);
      kx=c.x;ky=c.y;
      // Immediate single step on touch-down
      applyPan(kx,ky);
      draw();
      if(rafId)cancelAnimationFrame(rafId);
      function loop(){
        if(!active)return;
        // Continue panning proportional to knob deflection
        if(kx!==0||ky!==0)applyPan(kx,ky);
        rafId=requestAnimationFrame(loop);
      }
      // Small delay before continuous — so a quick tap feels like one step
      setTimeout(function(){if(active)rafId=requestAnimationFrame(loop);},120);
    }
    function onMove(e){
      e.preventDefault();e.stopPropagation();
      if(!active)return;
      const p=getPos(e),c=clamp(p.x-CX,p.y-CY);
      kx=c.x;ky=c.y;draw();
    }
    function onEnd(e){
      e.stopPropagation();
      active=false;kx=0;ky=0;
      if(rafId){cancelAnimationFrame(rafId);rafId=null;}
      draw();
    }

    function onMouseMove(e){if(active)onMove(e);}

    el.addEventListener('mousedown',onStart);
    el.addEventListener('mousemove',onMouseMove);
    el.addEventListener('mouseup',onEnd);
    el.addEventListener('mouseleave',onEnd);
    el.addEventListener('touchstart',onStart,{passive:false});
    el.addEventListener('touchmove',onMove,{passive:false});
    el.addEventListener('touchend',onEnd);
    el.addEventListener('touchcancel',onEnd);

    el._joyCleanup=function(){
      el.removeEventListener('mousedown',onStart);
      el.removeEventListener('mousemove',onMouseMove);
      el.removeEventListener('mouseup',onEnd);
      el.removeEventListener('mouseleave',onEnd);
      el.removeEventListener('touchstart',onStart);
      el.removeEventListener('touchmove',onMove);
      el.removeEventListener('touchend',onEnd);
      el.removeEventListener('touchcancel',onEnd);
    };

    draw();
  }

  setupJoy(document.getElementById('navjoy'));
  setupJoy(document.getElementById('pb-navjoy'));
  window._pbJoyReinit=function(){setupJoy(document.getElementById('pb-navjoy'));};

  // ── Toggle NavCube ↔ Joystick ↔ FPS ──────────────────────────────
  // navState: 0=NavCube, 1=Joystick, 2=FPS
  var navState=0;
  var NAV_LABELS=['⬡ NAV','✥ JOY','👁 FPS'];

  function _createFpsPlane(){
    if(_fpsPlaneGroup)return;
    _fpsPlaneGroup=new THREE.Group();
    var sz=_fpsPlaneSz;
    // Fill mesh — same style as surfFillMat
    var fillMat=new THREE.MeshBasicMaterial({
      color:SURF_TRACE,transparent:true,opacity:0.16,
      side:THREE.DoubleSide,depthWrite:false
    });
    _fpsPlaneFill=new THREE.Mesh(new THREE.PlaneGeometry(sz,sz),fillMat);
    _fpsPlaneFill.renderOrder=7;
    _fpsPlaneGroup.add(_fpsPlaneFill);
    // Frosted depth-cue mesh
    var bgHex=scene.background?('#'+scene.background.getHexString()):'#cdb899';
    var froMat=new THREE.MeshBasicMaterial({
      color:new THREE.Color(bgHex),
      transparent:true,opacity:_depthOpSteps[_depthOpIdx],
      side:THREE.DoubleSide,depthWrite:false,depthTest:true
    });
    _fpsFrosted=new THREE.Mesh(new THREE.PlaneGeometry(sz,sz),froMat);
    _fpsFrosted.renderOrder=5;
    _fpsFrosted.visible=depthCuesOn;
    _fpsPlaneGroup.add(_fpsFrosted);
    // Grid mesh
    var gridMat=new THREE.MeshBasicMaterial({
      color:0xffffff,transparent:true,
      side:THREE.DoubleSide,depthWrite:false,depthTest:true
    });
    if(_surfGridMode>0){gridMat.map=buildSurfGridTex();gridMat.map.repeat.set(sz*2,sz*2);gridMat.map.needsUpdate=true;}
    _fpsFrostedGrid=new THREE.Mesh(new THREE.PlaneGeometry(sz,sz),gridMat);
    _fpsFrostedGrid.renderOrder=6;
    _fpsFrostedGrid.visible=depthCuesOn&&_surfGridMode>0;
    _fpsPlaneGroup.add(_fpsFrostedGrid);
    scene.add(_fpsPlaneGroup);
  }

  // Rebuild follow-plane geometries when size changes (avoids full dispose/recreate)
  function _rebuildFpsPlaneGeo(){
    if(!_fpsPlaneGroup)return;
    var sz=_fpsPlaneSz;
    var newGeo=new THREE.PlaneGeometry(sz,sz);
    [_fpsPlaneFill,_fpsFrosted,_fpsFrostedGrid].forEach(function(m){
      if(!m)return;
      if(m.geometry)m.geometry.dispose();
      m.geometry=newGeo.clone();
    });
    newGeo.dispose();
    // Rescale grid texture repeat
    if(_fpsFrostedGrid&&_fpsFrostedGrid.material.map){
      _fpsFrostedGrid.material.map.repeat.set(sz*2,sz*2);
      _fpsFrostedGrid.material.map.needsUpdate=true;
    }
    markDirty();
  }

  function _disposeFpsPlane(){
    if(!_fpsPlaneGroup)return;
    scene.remove(_fpsPlaneGroup);
    _fpsPlaneGroup.children.slice().forEach(function(m){
      if(m.geometry)m.geometry.dispose();
      if(m.material){if(m.material.map)m.material.map.dispose();m.material.dispose();}
    });
    _fpsPlaneGroup=null;_fpsPlaneFill=null;_fpsFrosted=null;_fpsFrostedGrid=null;
  }

  // Apply _fpsSurfMode: 0=NONE 1=FOLLOW 2=SCENE
  function _applyFpsSurfMode(){
    // surfGroup visibility
    surfGroup.visible=(_fpsSurfMode===2);
    // follow-plane group visibility
    if(_fpsPlaneGroup)_fpsPlaneGroup.visible=(_fpsSurfMode===1);
    markDirty();
    // sync button label
    var btn=document.getElementById('fps-plane-toggle');
    var labels=['○ NONE','✦ FOLLOW','⬡ SCENE'];
    if(btn){
      btn.textContent=labels[_fpsSurfMode];
      btn.classList.toggle('on',_fpsSurfMode>0);
    }
    // dist slider: only relevant in FOLLOW mode
    var distWrap=document.getElementById('fps-plane-dist-wrap');
    if(distWrap)distWrap.style.display=(_fpsSurfMode===1)?'flex':'none';
  }
  window._applyFpsSurfMode=_applyFpsSurfMode;

  // Called when depth cues toggle changes — update follow-plane frosted meshes
  window._syncFpsDepth=function(){
    if(!_fpsPlaneGroup)return;
    if(_fpsFrosted)_fpsFrosted.visible=depthCuesOn;
    if(_fpsFrostedGrid)_fpsFrostedGrid.visible=depthCuesOn&&_surfGridMode>0;
    markDirty();
  };

  function enterFps(){
    if(_fpsMode)return;
    // Save radius only for restore reference; we won't snap camera back
    _fpsSavedCam={radius:cam.radius};
    // Compute orbit eye position → set as FPS eye
    var sinP=Math.sin(cam.phi),cosP=Math.cos(cam.phi);
    var sinT=Math.sin(cam.theta),cosT=Math.cos(cam.theta);
    var eyeX=cam.target.x+cam.radius*sinP*cosT;
    var eyeY=cam.target.y+cam.radius*sinP*sinT;
    var eyeZ=cam.target.z+cam.radius*cosP;
    cam.target.set(eyeX,eyeY,eyeZ);
    // Flip look direction: was orbit eye→target, now look toward original target
    cam.theta=cam.theta+Math.PI;
    cam.phi=Math.PI-cam.phi;
    cam.phi=Math.max(0.05,Math.min(Math.PI-0.05,cam.phi));
    _fpsMode=true;
    document.body.classList.add('fps-active');
    _createFpsPlane();
    _fpsSurfMode=0; // default: NONE
    _applyFpsSurfMode();
    updCam();
    toast('FPS mode · left:move · right:look');
  }

  function exitFps(){
    if(!_fpsMode)return;
    // Compute orbit state from current FPS eye+direction (item 1: no view snap)
    var sinP=Math.sin(cam.phi),cosP=Math.cos(cam.phi);
    var sinT=Math.sin(cam.theta),cosT=Math.cos(cam.theta);
    var radius=(_fpsSavedCam&&_fpsSavedCam.radius)||cam.radius||10;
    // Orbit target = eye + forward * radius  (place target in front of eye)
    var fx=sinP*cosT,fy=sinP*sinT,fz=cosP;
    cam.target.set(
      cam.target.x+fx*radius,
      cam.target.y+fy*radius,
      cam.target.z+fz*radius
    );
    // Orbit theta/phi = opposite of FPS (orbit camera is behind the target)
    cam.theta=cam.theta-Math.PI;
    cam.phi=Math.PI-cam.phi;
    cam.phi=Math.max(0.05,Math.min(Math.PI-0.05,cam.phi));
    cam.radius=radius;
    _fpsMode=false;
    _fpsSavedCam=null;
    document.body.classList.remove('fps-active');
    _disposeFpsPlane();
    surfGroup.visible=true; // always restore surface visibility
    updCam();
    toast('Orbit mode');
  }
  window._exitFps=exitFps;

  // FPS follow-plane UI wiring
  (function(){
    var toggleBtn=document.getElementById('fps-plane-toggle');
    var distSlider=document.getElementById('fps-plane-dist');
    var sizeSlider=document.getElementById('fps-plane-size');
    if(toggleBtn){
      toggleBtn.addEventListener('click',function(){
        if(!_fpsMode)return;
        _fpsSurfMode=(_fpsSurfMode+1)%3;
        _applyFpsSurfMode();
      });
    }
    if(distSlider){
      distSlider.value=_fpsPlaneDist;
      distSlider.addEventListener('input',function(){
        _fpsPlaneDist=parseFloat(distSlider.value);
        updCam();
      });
    }
    if(sizeSlider){
      sizeSlider.value=_fpsPlaneSz;
      sizeSlider.addEventListener('input',function(){
        _fpsPlaneSz=parseFloat(sizeSlider.value);
        _rebuildFpsPlaneGeo();
      });
    }
  })();

  function applyNavToggle(){
    navShowJoy=(navState===1);
    var isFps=(navState===2);
    var ids=[
      {nc:'navcube',jy:'navjoy',fc:'fps-move-card',btn:'nav-toggle'},
      {nc:'pb-navcube',jy:'pb-navjoy',fc:'pb-fps-move-card',btn:'pb-nav-toggle'}
    ];
    ids.forEach(function(g){
      var nc=document.getElementById(g.nc);
      var jy=document.getElementById(g.jy);
      var fc=document.getElementById(g.fc);
      var btn=document.getElementById(g.btn);
      if(nc)nc.style.display=(navState===0)?'block':'none';
      if(jy)jy.style.display=(navState===1)?'block':'none';
      if(fc)fc.style.display=(navState===2)?'flex':'none';
      if(btn){btn.textContent=NAV_LABELS[navState];btn.classList.toggle('on',navState>0);}
    });
    if(navState===0){if(window._ncDraw)window._ncDraw();if(window._pbNcDraw)window._pbNcDraw();}
    if(isFps) enterFps();
    else exitFps();
  }

  function toggleNav(){navState=(navState+1)%3;applyNavToggle();}
  window._applyNavToggle=applyNavToggle;
  var t1=document.getElementById('nav-toggle');if(t1)t1.addEventListener('click',toggleNav);
  var t2=document.getElementById('pb-nav-toggle');if(t2)t2.addEventListener('click',toggleNav);

  // FPS exit button
  var fpsExitBtn=document.getElementById('fps-exit');
  if(fpsExitBtn)fpsExitBtn.addEventListener('click',function(){navState=0;applyNavToggle();});

  applyNavToggle();
})();

// ================================================================
//  FPS NAV CONTROLS — dual joysticks, vertical buttons, canvas drag,
//  keyboard WASD/arrows, scroll wheel vertical
//
//  Activated when navState===2 (FPS toggle). All UI is inside
//  #fps-overlay and only receives events when body.fps-active.
//  Drawing still works: 1-finger on canvas = draw (when not on FPS UI).
//  In STYLUS mode, pen draws, 1-finger = FPS look drag on canvas.
// ================================================================
(function(){
  // ── Constants ──
  var FPS_MOVE_SPEED=0.012;
  var FPS_MOVE_BOOST=0.028;
  var FPS_VT_SPEED=0.015;
  var FPS_ORBIT_SENS=0.004;
  var FPS_LOOK_JOY_RATE=0.015;
  var FPS_JOY_DEADZONE=0.15;
  var FPS_KB_LOOK_RATE=0.015;

  // ── Joystick Factory (adapted from prototype) ──
  function createFpsJoystick(wrapId,onTick,opts){
    opts=opts||{};
    var wrap=document.getElementById(wrapId);
    if(!wrap)return null;
    var el=wrap.querySelector('canvas');
    if(!el)return null;
    var ctx=el.getContext('2d');
    var W=el.width,H=el.height,CX=W/2,CY=H/2;
    var PAD_R=Math.min(W,H)/2-8;
    var KNOB_R=Math.min(W,H)*0.14;
    var MAX_D=PAD_R-KNOB_R-2;
    var DEADZONE_PX=MAX_D*FPS_JOY_DEADZONE;
    var active=false,kx=0,ky=0,rafId=null;
    var touchId=null;
    var labels=opts.labels||null;
    var accent=opts.accent||_inkP();

    function draw(){
      ctx.clearRect(0,0,W,H);
      ctx.save();
      ctx.strokeStyle=accent+'.12)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(CX,CY,PAD_R,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=accent+'.06)';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(CX,CY,DEADZONE_PX,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=accent+'.05)';ctx.lineWidth=1;ctx.setLineDash([3,5]);
      ctx.beginPath();ctx.moveTo(CX,CY-PAD_R+8);ctx.lineTo(CX,CY+PAD_R-8);ctx.stroke();
      ctx.beginPath();ctx.moveTo(CX-PAD_R+8,CY);ctx.lineTo(CX+PAD_R-8,CY);ctx.stroke();
      ctx.setLineDash([]);
      if(active&&(kx!==0||ky!==0)){
        ctx.strokeStyle=accent+'.15)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(CX,CY);ctx.lineTo(CX+kx,CY+ky);ctx.stroke();
      }
      ctx.fillStyle=active?accent+'.22)':accent+'.07)';
      ctx.strokeStyle=accent+'.18)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(CX+kx,CY+ky,KNOB_R,0,Math.PI*2);ctx.fill();ctx.stroke();
      if(!active&&kx===0&&ky===0){
        if(labels){
          ctx.fillStyle=accent+'.12)';
          ctx.font='600 14px DM Mono, monospace';
          ctx.textAlign='center';ctx.textBaseline='middle';
          var lr=PAD_R-16;
          ctx.fillText(labels[0],CX,CY-lr);
          ctx.fillText(labels[2],CX,CY+lr);
          ctx.fillText(labels[1],CX-lr,CY);
          ctx.fillText(labels[3],CX+lr,CY);
        } else {
          ctx.strokeStyle=accent+'.1)';ctx.lineWidth=1.5;ctx.lineCap='round';
          [[0,-1],[0,1],[-1,0],[1,0]].forEach(function(d){
            var rr=PAD_R-10;
            ctx.beginPath();ctx.moveTo(CX+d[0]*(rr-6),CY+d[1]*(rr-6));ctx.lineTo(CX+d[0]*rr,CY+d[1]*rr);ctx.stroke();
          });
        }
      }
      ctx.restore();
    }

    function getNorm(){
      var dist=Math.sqrt(kx*kx+ky*ky);
      if(dist<DEADZONE_PX)return{nx:0,ny:0,norm:0};
      var effDist=(dist-DEADZONE_PX)*(MAX_D/(MAX_D-DEADZONE_PX));
      var s=effDist/dist;
      return{nx:(kx*s)/MAX_D,ny:(ky*s)/MAX_D,norm:effDist/MAX_D};
    }

    function clamp(dx,dy){
      var d=Math.sqrt(dx*dx+dy*dy);
      if(d>MAX_D)return{x:dx/d*MAX_D,y:dy/d*MAX_D};
      return{x:dx,y:dy};
    }

    function getPos(e){
      var r=el.getBoundingClientRect();
      var src=null;
      if(e.touches){
        if(touchId!==null){
          for(var i=0;i<e.touches.length;i++){
            if(e.touches[i].identifier===touchId){src=e.touches[i];break;}
          }
        }
        if(!src&&e.touches.length>0)src=e.touches[0];
        if(!src&&e.changedTouches&&e.changedTouches.length>0)src=e.changedTouches[0];
      }
      if(!src)src=e;
      var rw=r.width||1,rh=r.height||1;
      return{x:(src.clientX-r.left)*(W/rw),y:(src.clientY-r.top)*(H/rh)};
    }

    function startLoop(){
      if(rafId)return;
      function loop(){
        if(!active){rafId=null;return;}
        var n=getNorm();
        if(n.norm>0)onTick(n.nx,n.ny,n.norm);
        rafId=requestAnimationFrame(loop);
      }
      rafId=requestAnimationFrame(loop);
    }

    function onStart(e){
      e.preventDefault();e.stopPropagation();
      if(active)return;
      if(e.touches){
        var t=e.changedTouches?e.changedTouches[0]:e.touches[0];
        touchId=t.identifier;
      }
      active=true;
      var p=getPos(e),c=clamp(p.x-CX,p.y-CY);
      kx=c.x;ky=c.y;
      var n=getNorm();
      if(n.norm>0)onTick(n.nx,n.ny,n.norm);
      draw();
      setTimeout(function(){if(active)startLoop();},100);
    }
    function onMoveTouch(e){
      e.preventDefault();e.stopPropagation();
      if(!active)return;
      if(touchId!==null&&e.touches){
        var found=false;
        for(var i=0;i<e.touches.length;i++){
          if(e.touches[i].identifier===touchId){found=true;break;}
        }
        if(!found)return;
      }
      var p=getPos(e),c=clamp(p.x-CX,p.y-CY);
      kx=c.x;ky=c.y;draw();
    }
    function onEnd(e){
      if(!active)return;
      if(touchId!==null&&e.touches){
        for(var i=0;i<e.touches.length;i++){
          if(e.touches[i].identifier===touchId)return;
        }
      }
      e.stopPropagation();
      active=false;kx=0;ky=0;touchId=null;
      if(rafId){cancelAnimationFrame(rafId);rafId=null;}
      draw();
    }

    var mouseActive=false;
    function onMouseDown(e){
      e.preventDefault();e.stopPropagation();
      mouseActive=true;active=true;
      var p=getPos(e),c=clamp(p.x-CX,p.y-CY);
      kx=c.x;ky=c.y;
      var n=getNorm();
      if(n.norm>0)onTick(n.nx,n.ny,n.norm);
      draw();
      setTimeout(function(){if(active)startLoop();},100);
    }
    function onMouseMove(e){if(!mouseActive)return;var p=getPos(e),c=clamp(p.x-CX,p.y-CY);kx=c.x;ky=c.y;draw();}
    function onMouseUp(){if(!mouseActive)return;mouseActive=false;active=false;kx=0;ky=0;if(rafId){cancelAnimationFrame(rafId);rafId=null;}draw();}

    el.addEventListener('touchstart',onStart,{passive:false});
    el.addEventListener('touchmove',onMoveTouch,{passive:false});
    el.addEventListener('touchend',onEnd);
    el.addEventListener('touchcancel',onEnd);
    el.addEventListener('mousedown',onMouseDown);
    el.addEventListener('mousemove',onMouseMove);
    el.addEventListener('mouseup',onMouseUp);
    el.addEventListener('mouseleave',onMouseUp);

    draw();
    return{redraw:draw};
  }

  // ── Movement Joystick (left) — FPS ground movement, inside nav card ──
  function fpsMoveTick(nx,ny,norm){
    if(!_fpsMode)return;
    var sinT=Math.sin(cam.theta),cosT=Math.cos(cam.theta);
    var sinP=Math.sin(cam.phi);
    // Ground-projected forward (XY plane, Z-up)
    var fx=sinP*cosT,fy=sinP*sinT;
    var gfLen=Math.sqrt(fx*fx+fy*fy);
    var gfx,gfy;
    if(gfLen<0.001){gfx=cosT;gfy=sinT;}
    else{gfx=fx/gfLen;gfy=fy/gfLen;}
    // Ground right: perpendicular on XY plane
    var grx=gfy,gry=-gfx;
    // Acceleration curve
    var curved=norm*norm;
    var speed=FPS_MOVE_SPEED+curved*FPS_MOVE_BOOST;
    // stick up (ny<0) → forward, stick right (nx>0) → strafe right
    cam.target.x+=(-ny*gfx+nx*grx)*speed;
    cam.target.y+=(-ny*gfy+nx*gry)*speed;
    updCam();
  }
  createFpsJoystick('fps-move-card',fpsMoveTick,{labels:null,accent:_inkP()});
  createFpsJoystick('pb-fps-move-card',fpsMoveTick,{labels:null,accent:_inkP()});

  // ── Look Joystick (right) — FPS look rotation ──
  createFpsJoystick('fps-joy-look',function(nx,ny,norm){
    if(!_fpsMode)return;
    cam.theta-=nx*FPS_LOOK_JOY_RATE;
    cam.phi=Math.max(0.05,Math.min(Math.PI-0.05,cam.phi+ny*FPS_LOOK_JOY_RATE));
    updCam();
  },{labels:['\u2191','\u2190','\u2193','\u2192'],accent:_inkP()});

  // ── Vertical buttons — hold to move up/down ──
  function wireFpsVtBtn(id,dir){
    var btn=document.getElementById(id);
    if(!btn)return;
    var rafId2=null,holdTimer=null,held=false;
    function step(){
      if(!_fpsMode)return;
      cam.target.z+=dir*FPS_VT_SPEED;
      updCam();
      rafId2=requestAnimationFrame(step);
    }
    function onDown(e){
      e.preventDefault();e.stopPropagation();
      if(!_fpsMode)return;
      held=true;btn.classList.add('held');
      cam.target.z+=dir*FPS_VT_SPEED;
      updCam();
      holdTimer=setTimeout(function(){
        if(held)rafId2=requestAnimationFrame(step);
      },150);
    }
    function onUp(e){
      if(e)e.stopPropagation();
      held=false;btn.classList.remove('held');
      clearTimeout(holdTimer);holdTimer=null;
      if(rafId2){cancelAnimationFrame(rafId2);rafId2=null;}
    }
    btn.addEventListener('mousedown',onDown);
    btn.addEventListener('mouseup',onUp);
    btn.addEventListener('mouseleave',onUp);
    btn.addEventListener('touchstart',onDown,{passive:false});
    btn.addEventListener('touchend',onUp);
    btn.addEventListener('touchcancel',onUp);
  }
  wireFpsVtBtn('fps-vt-up',1);
  wireFpsVtBtn('fps-vt-down',-1);
  wireFpsVtBtn('pb-fps-vt-up',1);
  wireFpsVtBtn('pb-fps-vt-down',-1);

  // ── Canvas look-drag ──
  // FPS look on desktop: right-click orbit (doOrbit has FPS branch), keyboard arrows,
  // or right joystick. Left-click stays free for drawing.
  // On mobile: STYLUS mode 1-finger = orbit (which becomes FPS look via doOrbit FPS branch).
  // Non-STYLUS mode: 1-finger = draw, look via right joystick only.

  function _fpsIsOnUI(x,y){
    var els=[document.getElementById('fps-joy-look'),document.getElementById('fps-plane-ctrl')];
    for(var i=0;i<els.length;i++){
      if(!els[i])continue;
      var r=els[i].getBoundingClientRect();
      var pad=10;
      if(x>=r.left-pad&&x<=r.right+pad&&y>=r.top-pad&&y<=r.bottom+pad)return true;
    }
    return false;
  }

  // Scroll wheel = vertical movement in FPS (handled in main wheel handler via _fpsMode check)

  // ── Keyboard — WASD move, Arrow look, Q/E vertical ──
  var _fpsKeys={};
  window.addEventListener('keydown',function(e){
    if(!_fpsMode)return;
    if(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA')return;
    _fpsKeys[e.key.toLowerCase()]=true;
    if(e.code)_fpsKeys[e.code]=true;
  });
  window.addEventListener('keyup',function(e){
    _fpsKeys[e.key.toLowerCase()]=false;
    if(e.code)_fpsKeys[e.code]=false;
  });

  // FPS keyboard tick — runs every frame
  function fpsTick(){
    requestAnimationFrame(fpsTick);
    if(!_fpsMode)return;
    var moved=false;
    // Movement (WASD)
    var fwd=0,strafe=0;
    if(_fpsKeys['w'])fwd+=1;
    if(_fpsKeys['s'])fwd-=1;
    if(_fpsKeys['d'])strafe+=1;
    if(_fpsKeys['a'])strafe-=1;

    if(fwd!==0||strafe!==0){
      var sinT=Math.sin(cam.theta),cosT=Math.cos(cam.theta);
      var sinP=Math.sin(cam.phi);
      var fx=sinP*cosT,fy=sinP*sinT;
      var gfLen=Math.sqrt(fx*fx+fy*fy);
      var gfx,gfy;
      if(gfLen<0.001){gfx=cosT;gfy=sinT;}
      else{gfx=fx/gfLen;gfy=fy/gfLen;}
      var grx=gfy,gry=-gfx;
      var len=Math.sqrt(fwd*fwd+strafe*strafe);
      var nfwd=fwd/len,nstrafe=strafe/len;
      cam.target.x+=(nfwd*gfx+nstrafe*grx)*FPS_MOVE_SPEED;
      cam.target.y+=(nfwd*gfy+nstrafe*gry)*FPS_MOVE_SPEED;
      moved=true;
    }
    // Vertical (Q up, E down)
    if(_fpsKeys['q']){cam.target.z+=FPS_MOVE_SPEED*0.5;moved=true;}
    if(_fpsKeys['e']){cam.target.z-=FPS_MOVE_SPEED*0.5;moved=true;}
    // Look (arrows)
    if(_fpsKeys['arrowleft']){cam.theta+=FPS_KB_LOOK_RATE;moved=true;}
    if(_fpsKeys['arrowright']){cam.theta-=FPS_KB_LOOK_RATE;moved=true;}
    if(_fpsKeys['arrowup']){cam.phi=Math.max(0.05,cam.phi-FPS_KB_LOOK_RATE);moved=true;}
    if(_fpsKeys['arrowdown']){cam.phi=Math.min(Math.PI-0.05,cam.phi+FPS_KB_LOOK_RATE);moved=true;}

    if(moved)updCam();
  }
  fpsTick();

})();
