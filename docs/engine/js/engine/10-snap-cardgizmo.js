// ================================================================
//  SURFACE GIZMO (unchanged from v4)
// ================================================================
// ── Shared snap state (used by both card gizmo and local overlay gizmo) ──
var snapEnabled=true;
var SNAP_STEP=Math.PI/4,SNAP_THRESH=Math.PI/16;
function snapAngle(raw){var sn=Math.round(raw/SNAP_STEP)*SNAP_STEP;return Math.abs(raw-sn)<SNAP_THRESH?sn:raw;}
function isSnapped(raw){return Math.abs(raw-Math.round(raw/SNAP_STEP)*SNAP_STEP)<SNAP_THRESH;}
// Expose so lcl-float snap button can toggle
window._getSnapEnabled=function(){return snapEnabled;};
window._setSnapEnabled=function(v){
  snapEnabled=v;
  // sync both snap buttons
  var gs=document.getElementById('gsnap');if(gs)gs.classList.toggle('on',v);
  var ps=document.getElementById('pb-gsnap');if(ps)ps.classList.toggle('on',v);
  var lf=document.getElementById('lcl-snap');if(lf)lf.classList.toggle('on',v);
};

(function(){
  const gc=document.getElementById('gc'),ctx=gc.getContext('2d');
  const W=gc.width,H=gc.height,CX=W/2,CY=H/2;
  const COL={x:'#e03040',y:'#22bb55',z:'#3377ee'};
  // Geometry scales with canvas half-size — same proportions as local overlay gizmo
  const _R=Math.min(CX,CY);
  const AL=Math.round(_R*0.68);
  const HIT_MOUSE=14,HIT_TOUCH=48;
  const RING_RADIUS=Math.round(_R*0.68);
  const RING_R={x:RING_RADIUS,y:RING_RADIUS,z:RING_RADIUS};
  let drag=null,hov=null;
  let _grabT=0;
  let gizmoMode='all',axisFilter='all';
  let _gcAxisLocal=true;
  let snapFlash=null;
  // snapEnabled / SNAP_STEP / SNAP_THRESH / snapAngle / isSnapped now at module scope
  function setGizmoMode(m){gizmoMode=m;['move','rotate','scale'].forEach(id=>{const b=document.getElementById('gm-'+id);if(b)b.classList.toggle('on',id===m);const p=document.getElementById('pb-gm-'+id);if(p)p.classList.toggle('on',id===m);});const hints={all:'move · rotate · scale',move:'drag arrows to move',rotate:'drag arcs to rotate',scale:'drag boxes to scale'};const h=document.getElementById('ghint');if(h)h.textContent=hints[m]||'';const lbl=m==='all'?'All':m==='move'?'Mv':m==='rotate'?'Rot':'Sc';const mc=document.getElementById('pb-cyc-mode');if(mc)mc.textContent=lbl;const sc=document.getElementById('sb-cyc-mode');if(sc)sc.textContent=lbl;draw();if(window._pbGcDraw)window._pbGcDraw();}
  function setAxisFilter(a){axisFilter=a;['all','x','y','z'].forEach(id=>{const b=document.getElementById('ga-'+id);if(b)b.classList.toggle('on',id===a);const p=document.getElementById('pb-ax-'+id);if(p)p.classList.toggle('on',id===a);});const albl=a==='all'?'All':a.toUpperCase();const sca=document.getElementById('sb-cyc-axis');if(sca)sca.textContent=albl;draw();if(window._pbGcDraw)window._pbGcDraw();}
  window._setAxisFilter=setAxisFilter;
  window._setGizmoMode=setGizmoMode;
  window._getGizmoMode=function(){return gizmoMode;};
  window._gcToggleAxisMode=function(){
    _gcAxisLocal=!_gcAxisLocal;
    var lbl=_gcAxisLocal?'LCL':'WLD';
    ['gc-axmode','pb-gc-axmode'].forEach(function(id){
      var b=document.getElementById(id);
      if(b){b.textContent=lbl; b.classList.toggle('on',_gcAxisLocal);}
    });
    draw();if(window._pbGcDraw)window._pbGcDraw();
  };
  ['move','rotate','scale'].forEach(m=>{const b=document.getElementById('gm-'+m);if(b)b.addEventListener('click',()=>setGizmoMode(m));const p=document.getElementById('pb-gm-'+m);if(p)p.addEventListener('click',()=>setGizmoMode(m));});
  ['all','x','y','z'].forEach(a=>{const b=document.getElementById('ga-'+a);if(b)b.addEventListener('click',()=>setAxisFilter(a));const p=document.getElementById('pb-ax-'+a);if(p)p.addEventListener('click',()=>setAxisFilter(a));});
  // Perspective projection — ONLY used for applyDrag delta math, never for drawing
  function axisDir2D(worldAxis){const ac=activeCam(),o=new THREE.Vector3(0,0,0).project(ac),t=worldAxis.clone().normalize().project(ac);const dx=t.x-o.x,dy=-(t.y-o.y),len=Math.sqrt(dx*dx+dy*dy)||1;return{nx:dx/len,ny:dy/len};}
  const WORLD={x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)};
  function aDir(ax){return axisDir2D(WORLD[ax]);}  // drag math only
  function ringAxes3D(ax){const pairs={x:['y','z'],y:['x','z'],z:['x','y']};const[a,b]=pairs[ax];return{da3:WORLD[a],db3:WORLD[b]};}
  // v17: ALL drawing uses orthographic projection via camera right/up.
  // This guarantees rings are perfect circles and handles sit exactly on them.
  function _od(worldAxis){
    const ac=activeCam();
    const rx=worldAxis.dot(new THREE.Vector3().setFromMatrixColumn(ac.matrixWorld,0));
    const ry=worldAxis.dot(new THREE.Vector3().setFromMatrixColumn(ac.matrixWorld,1));
    return{nx:rx,ny:-ry}; // NOT normalised — preserves true screen scale for rings
  }
  // Ortho ring bases: da,db are raw (un-normalised) screen offsets per unit world distance
  function _ora(ax){const p={x:['y','z'],y:['x','z'],z:['x','y']};const[a,b]=p[ax];return{da:_od(WORLD[a]),db:_od(WORLD[b])};}
  // Ortho signed axis direction for shafts/arrows/boxes (unit-length for consistent AL distance)
  function _oDir(ax){const d=_od(WORLD[ax]);const len=Math.sqrt(d.nx*d.nx+d.ny*d.ny)||1;return{nx:d.nx/len,ny:d.ny/len};}
  function cameraLookDir(){const ac=activeCam();return new THREE.Vector3().subVectors(ac.position,new THREE.Vector3(0,0,0)).normalize();}
  // v17: arrow/box always points toward camera hemisphere
  function _axisSign(ax){const c=cameraLookDir(),w=WORLD[ax];return(w.x*c.x+w.y*c.y+w.z*c.z)>=0?1:-1;}
  function _signedTip(ax){const s=_axisSign(ax),d=_oDir(ax);return{x:CX+d.nx*s*AL,y:CY+d.ny*s*AL,s,d};}
  function _signedBoxPos(ax){const s=_axisSign(ax),d=_oDir(ax);return{x:CX+d.nx*s*AL*.72,y:CY+d.ny*s*AL*.72,s};}
  // v17: 120° handle placement — aspect-ratio-corrected angle matching.
  // v19: handle at most camera-facing point on its ring, then slide along arc to avoid overlap.
  // Returns {x,y,t,tx,ty} — screen position, ring angle, and tangent direction at that point.
  // MIN_SEP: minimum screen-pixel separation between any two handles before sliding kicks in.
  const HANDLE_MIN_SEP=28;
  function _handleAngles(){
    const camDir=cameraLookDir();
    const axes=['x','y','z'];
    // Step 1: unconstrained best-t for each ring (most camera-facing point)
    const result={};
    axes.forEach(function(ax){
      const{da3,db3}=ringAxes3D(ax);
      const STEPS=64;var bestT=0,bestDot=-Infinity;
      for(var i=0;i<STEPS;i++){
        const t=(i/STEPS)*Math.PI*2,ct=Math.cos(t),st=Math.sin(t);
        const fw=(da3.x*ct+db3.x*st)*camDir.x+(da3.y*ct+db3.y*st)*camDir.y+(da3.z*ct+db3.z*st)*camDir.z;
        if(fw>bestDot){bestDot=fw;bestT=t;}
      }
      result[ax]={t:bestT};
    });
    // Step 2: compute screen positions using ortho ring bases
    function screenPos(ax,t){
      const{da,db}=_ora(ax),ct=Math.cos(t),st=Math.sin(t);
      return{x:CX+da.nx*ct*RING_RADIUS+db.nx*st*RING_RADIUS,
             y:CY+da.ny*ct*RING_RADIUS+db.ny*st*RING_RADIUS};
    }
    // Step 3: slide handles apart if too close — one pass over all 3 pairs
    const pairs=[['x','y'],['x','z'],['y','z']];
    pairs.forEach(function(pair){
      const a=pair[0],b=pair[1];
      var pa=screenPos(a,result[a].t),pb=screenPos(b,result[b].t);
      var dist=Math.hypot(pa.x-pb.x,pa.y-pb.y);
      if(dist>=HANDLE_MIN_SEP)return;
      // Slide the handle that's less "optimally placed" (lower dot product with camDir)
      // We slide it along its ring in the direction that increases separation.
      const{da3:da3a,db3:db3a}=ringAxes3D(a);
      const{da3:da3b,db3:db3b}=ringAxes3D(b);
      const dotA=(da3a.x*Math.cos(result[a].t)+db3a.x*Math.sin(result[a].t))*camDir.x+
                 (da3a.y*Math.cos(result[a].t)+db3a.y*Math.sin(result[a].t))*camDir.y+
                 (da3a.z*Math.cos(result[a].t)+db3a.z*Math.sin(result[a].t))*camDir.z;
      const dotB=(da3b.x*Math.cos(result[b].t)+db3b.x*Math.sin(result[b].t))*camDir.x+
                 (da3b.y*Math.cos(result[b].t)+db3b.y*Math.sin(result[b].t))*camDir.y+
                 (da3b.z*Math.cos(result[b].t)+db3b.z*Math.sin(result[b].t))*camDir.z;
      // Slide the one with lower dot (less ideally placed) since it costs less visibility
      const slideAx=(dotA<=dotB)?a:b;
      const{da,db}=_ora(slideAx);
      const step=0.06; // radians per nudge
      var t=result[slideAx].t;
      for(var iter=0;iter<52;iter++){
        // Try both +step and -step, pick the one that increases separation more
        const tp=t+step,tm=t-step;
        const pp=screenPos(slideAx,tp),pm=screenPos(slideAx,tm);
        const otherAx=(slideAx===a)?b:a;
        const po=screenPos(otherAx,result[otherAx].t);
        const dp=Math.hypot(pp.x-po.x,pp.y-po.y);
        const dm=Math.hypot(pm.x-po.x,pm.y-po.y);
        t=(dp>=dm)?tp:tm;
        if(Math.hypot(screenPos(slideAx,t).x-po.x,screenPos(slideAx,t).y-po.y)>=HANDLE_MIN_SEP)break;
      }
      result[slideAx].t=t;
    });
    // Step 4: attach screen position and tangent to each result
    axes.forEach(function(ax){
      const{da,db}=_ora(ax),t=result[ax].t,ct=Math.cos(t),st=Math.sin(t);
      result[ax].x=CX+da.nx*ct*RING_RADIUS+db.nx*st*RING_RADIUS;
      result[ax].y=CY+da.ny*ct*RING_RADIUS+db.ny*st*RING_RADIUS;
      // Tangent at t: d/dt of (da*cos+db*sin)*R = (-da*sin+db*cos)*R — normalise for orientation
      const tx=-da.nx*st+db.nx*ct,ty=-da.ny*st+db.ny*ct;
      const tl=Math.sqrt(tx*tx+ty*ty)||1;
      result[ax].tx=tx/tl;result[ax].ty=ty/tl;
    });
    return result;
  }
  // Thin wrapper for hit test (returns just t per axis)
  function _handleAngle(ax){return _handleAngles()[ax].t;}
  // v17: shaft drawn with ortho direction — consistent with rings
  function drawAxisShaft(ax,alpha){const d=_oDir(ax),s=_axisSign(ax),col=COL[ax];ctx.save();ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.globalAlpha=alpha*.4;ctx.lineCap='round';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(CX,CY);ctx.lineTo(CX+d.nx*s*AL*1.1,CY+d.ny*s*AL*1.1);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
  // v17: arrow uses ortho direction — tip, shaft and head all consistent
  function drawArrow(ax,active){
    const e=_signedTip(ax),s=e.s,d=e.d,col=COL[ax],hlit=hov==='a'+ax||active;
    ctx.save();
    // Glow / shadow for hover (mouse + pen)
    if(hlit){ctx.shadowColor=col;ctx.shadowBlur=10;}
    ctx.strokeStyle=hlit?'#fff':col;ctx.fillStyle=hlit?'#fff':col;
    ctx.lineWidth=hlit?3.5:2.8;ctx.globalAlpha=hlit?1:.85;ctx.lineCap='round';
    // Shaft — leave gap for head (15px back from tip) and draw from tail dot
    const tailX=CX+d.nx*s*8, tailY=CY+d.ny*s*8;
    ctx.beginPath();ctx.moveTo(tailX,tailY);ctx.lineTo(e.x-d.nx*s*16,e.y-d.ny*s*16);ctx.stroke();
    // Tail dot (rounded base)
    ctx.beginPath();ctx.arc(tailX,tailY,hlit?4:3,0,Math.PI*2);ctx.fill();
    // Arrowhead — larger: half-width 9px, back-depth 15px
    const pw=-d.ny*s*9,py2=d.nx*s*9;
    ctx.beginPath();
    ctx.moveTo(e.x,e.y);
    ctx.lineTo(e.x-d.nx*s*15+pw,e.y-d.ny*s*15+py2);
    ctx.lineTo(e.x-d.nx*s*15-pw,e.y-d.ny*s*15-py2);
    ctx.closePath();ctx.fill();
    // Label
    ctx.shadowBlur=0;ctx.font='600 9px DM Mono,monospace';
    ctx.fillStyle=hlit?'#fff':col;ctx.globalAlpha=hlit?1:.9;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(ax.toUpperCase(),e.x+d.nx*s*9,e.y+d.ny*s*9+1);
    ctx.restore();
  }
  // v21: FLAT 2D PIE SEGMENTS — three equal 120° arcs on screen.
  // Assignment: each segment angle is compared against projected 3D axes;
  // the axis whose projected screen direction is closest to that segment gets it.
  // Returns [{ax, midAngle, startAngle, endAngle}, ...] sorted by draw order.
  // ── New arc system (v28) ────────────────────────────────────────
  var GC_RING_R   = Math.round(_R*0.68); // ring radius — proportional to half-canvas
  var GC_GAP      = 0.22;
  var GC_ARC_BOUNDS = {x:['z','y'], y:['z','x'], z:['x','y']};
  var GC_ARROW    = Math.round(_R*0.76); // arrow tip stays within canvas with margin
  var GC_HEAD_S   = Math.round(_R*0.11);
  var GC_HEAD_L   = Math.round(_R*0.15);
  var GC_BOX_S    = Math.round(_R*0.11);
  var GC_CENTER_R = Math.round(_R*0.17);
  var _gcLayout   = null;
  var _gcScale    = false; // false=move arrows, true=scale squares

  function _gcComputeLayout(){
    // Reuse camera matrixWorld columns (same as _od) — correct canvas-space projection
    // Supports local quaternion by pre-rotating each world axis
    var q = _gcAxisLocal ? surfGroup.quaternion : new THREE.Quaternion();
    var ac = activeCam();
    var camR = new THREE.Vector3().setFromMatrixColumn(ac.matrixWorld, 0); // right
    var camU = new THREE.Vector3().setFromMatrixColumn(ac.matrixWorld, 1); // up
    var camDir = new THREE.Vector3().subVectors(ac.position, surfPos).normalize();

    var axisAngles={}, flipped={};
    ['x','y','z'].forEach(function(ax){
      var dir = WORLD[ax].clone().applyQuaternion(q).normalize();
      flipped[ax] = dir.dot(camDir) < 0;
      if(flipped[ax]) dir.negate();
      // Canvas-space direction: project onto camera right and up
      var nx = dir.dot(camR);
      var ny = -dir.dot(camU); // flip Y for canvas
      axisAngles[ax] = Math.atan2(ny, nx);
    });
    function N(a){return((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);}
    var arcs={};
    ['x','y','z'].forEach(function(ax){
      var bA=GC_ARC_BOUNDS[ax][0], bB=GC_ARC_BOUNDS[ax][1];
      var s=N(axisAngles[bA]), e=N(axisAngles[bB]), own=N(axisAngles[ax]);
      var spanCCW=(e-s+Math.PI*2)%(Math.PI*2);
      var ownInCCW=((own-s+Math.PI*2)%(Math.PI*2))<spanCCW;
      var arcStart,arcEnd;
      if(!ownInCCW){arcStart=s+GC_GAP; arcEnd=s+spanCCW-GC_GAP;}
      else          {arcStart=e+GC_GAP; arcEnd=e+(Math.PI*2-spanCCW)-GC_GAP;}
      arcs[ax]={start:arcStart, end:arcEnd};
    });
    _gcLayout={cx:CX, cy:CY, axisAngles:axisAngles, flipped:flipped, arcs:arcs};
  }


  function _gcComputeArcs(){
    // _oDir/_axisSign already handle hemisphere flip — use them directly
    var axisAngles={};
    ['x','y','z'].forEach(function(ax){
      var d=_oDir(ax), s=_axisSign(ax);
      axisAngles[ax]=Math.atan2(d.ny*s, d.nx*s);
    });
    function N(a){return((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);}
    var arcs={};
    ['x','y','z'].forEach(function(ax){
      var bA=GC_ARC_BOUNDS[ax][0], bB=GC_ARC_BOUNDS[ax][1];
      var s=N(axisAngles[bA]), e=N(axisAngles[bB]), own=N(axisAngles[ax]);
      var spanCCW=(e-s+Math.PI*2)%(Math.PI*2);
      var ownInCCW=((own-s+Math.PI*2)%(Math.PI*2))<spanCCW;
      var arcStart,arcEnd;
      if(!ownInCCW){arcStart=s+GC_GAP; arcEnd=s+spanCCW-GC_GAP;}
      else         {arcStart=e+GC_GAP; arcEnd=e+(Math.PI*2-spanCCW)-GC_GAP;}
      arcs[ax]={start:arcStart, end:arcEnd};
    });
    return{axisAngles:axisAngles, arcs:arcs};
  }

  function _gcDraw(){
    // During a rotate drag, freeze the layout so arrows/arcs don't jitter as plane moves
    if(drag&&drag.h&&drag.h[0]==='r'&&drag.frozenLayout){
      _gcLayout=drag.frozenLayout;
    } else {
      _gcComputeLayout();
    }
    ctx.clearRect(0,0,W,H);
    if(!_gcLayout) return;
    var cx=_gcLayout.cx, cy=_gcLayout.cy;
    var axisAngles=_gcLayout.axisAngles, arcs=_gcLayout.arcs, flipped=_gcLayout.flipped;
    var axes=axisFilter==='all'?['x','y','z']:[axisFilter];
    var activeDrag=drag?drag.h:null;

    var showArcs  =(gizmoMode==='all'||gizmoMode==='rotate');
    var showArrows=(gizmoMode==='all'||gizmoMode==='move'||gizmoMode==='scale');

    axes.forEach(function(ax){
      var col=COL[ax];
      var arc=arcs[ax];
      var angle=axisAngles[ax];
      var ax2c=Math.cos(angle), ay2s=Math.sin(angle);
      var arcHlit=(hov==='r'+ax)||(activeDrag==='r'+ax);
      var arwHlit=(hov==='a'+ax||hov==='s'+ax)||(activeDrag==='a'+ax||activeDrag==='s'+ax);

      // ── Arc ──
      if(showArcs){
        ctx.save();
        if(arcHlit){ctx.shadowColor=col;ctx.shadowBlur=10;}
        ctx.beginPath();
        ctx.arc(cx,cy,GC_RING_R,arc.start,arc.end);
        ctx.strokeStyle=col;
        ctx.lineWidth=arcHlit?Math.round(_R*0.09):Math.round(_R*0.065);
        ctx.lineCap='round';
        ctx.globalAlpha=arcHlit?1:0.45;
        ctx.stroke();
        ctx.restore();
      }

      // ── Arrow shaft + head / scale box ──
      if(showArrows){
        var shaftS=GC_RING_R*0.55;
        var ex=cx+ax2c*GC_ARROW, ey=cy+ay2s*GC_ARROW;
        ctx.save();
        if(arwHlit){ctx.shadowColor=col;ctx.shadowBlur=8;}
        ctx.globalAlpha=arwHlit?1:0.85;
        ctx.strokeStyle=col;
        ctx.lineWidth=arwHlit?Math.round(_R*0.055):Math.round(_R*0.04);
        ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(cx+ax2c*shaftS, cy+ay2s*shaftS);
        ctx.lineTo(ex, ey); ctx.stroke();
        // tail dot
        ctx.beginPath();
        ctx.arc(cx+ax2c*shaftS,cy+ay2s*shaftS,arwHlit?Math.round(_R*0.055):Math.round(_R*0.03),0,Math.PI*2);
        ctx.fillStyle=col; ctx.fill();

        if(_gcScale||gizmoMode==='scale'){
          var bx2=ex+ax2c*(GC_HEAD_L*0.5), by2=ey+ay2s*(GC_HEAD_L*0.5);
          var hs=arwHlit?GC_BOX_S*1.2:GC_BOX_S;
          ctx.save(); ctx.translate(bx2,by2); ctx.rotate(angle+Math.PI/4);
          ctx.globalAlpha=arwHlit?0.9:0.65;
          ctx.fillStyle=col; ctx.fillRect(-hs,-hs,hs*2,hs*2); ctx.restore();
        } else {
          var px=ay2s, py=-ax2c;
          ctx.beginPath();
          ctx.moveTo(ex+ax2c*GC_HEAD_L, ey+ay2s*GC_HEAD_L);
          ctx.lineTo(ex+px*GC_HEAD_S, ey+py*GC_HEAD_S);
          ctx.lineTo(ex-px*GC_HEAD_S, ey-py*GC_HEAD_S);
          ctx.closePath(); ctx.fillStyle=col; ctx.fill();
        }
        ctx.restore();

        // Label — clamped to canvas bounds
        ctx.save();
        ctx.font='bold '+Math.round(_R*0.12)+'px DM Mono,monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle=col; ctx.globalAlpha=arwHlit?1:0.88;
        var lblDist=GC_ARROW+GC_HEAD_L+Math.round(_R*0.05);
        var lx2=cx+ax2c*lblDist, ly2=cy+ay2s*lblDist;
        var mg=6; lx2=Math.max(mg,Math.min(W-mg,lx2)); ly2=Math.max(mg,Math.min(H-mg,ly2));
        ctx.fillText((flipped[ax]?'-':'')+ax.toUpperCase(), lx2, ly2);
        ctx.restore();
      }
    });

    // ── Center button ──
    var cenHlit=(hov==='su')||(activeDrag==='su'||activeDrag==='cd');
    ctx.save();
    if(_gcScale){
      ctx.translate(cx,cy); ctx.rotate(Math.PI/4);
      var ds=cenHlit?Math.round(_R*0.12):Math.round(_R*0.09);
      ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.fillRect(-ds,-ds,ds*2,ds*2);
      ctx.fillStyle=cenHlit?'rgba(255,220,60,1)':'rgba(255,200,60,0.85)';
      var di=cenHlit?Math.round(_R*0.09):Math.round(_R*0.065); ctx.fillRect(-di,-di,di*2,di*2);
    } else {
      ctx.beginPath(); ctx.arc(cx,cy,cenHlit?Math.round(_R*0.09):Math.round(_R*0.065),0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.90)'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx,cy,cenHlit?Math.round(_R*0.065):Math.round(_R*0.05),0,Math.PI*2);
      ctx.fillStyle='rgba(80,80,110,0.65)'; ctx.fill();
    }
    ctx.restore();

    // LCL/WLD indicator
    ctx.save();
    ctx.font='bold '+Math.round(_R*0.10)+'px DM Mono,monospace';
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillStyle=_gcAxisLocal?'rgba(255,220,100,0.85)':'rgba(160,200,255,0.85)';
    ctx.fillText(_gcAxisLocal?'LCL':'WLD', 4, 4);
    ctx.restore();

    // Snap flash
    if(snapFlash&&(performance.now()-snapFlash.t)<500){
      var sfa=1-(performance.now()-snapFlash.t)/500;
      ctx.save(); ctx.globalAlpha=sfa*0.7;
      ctx.strokeStyle=COL[snapFlash.ax]; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx,cy,GC_RING_R,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
  }
  function drawBox(){}
  function drawUniformDot(){}

  function draw(){ _gcDraw(); }
  function hitTest(mx,my,isTouch){
    var axes=axisFilter==='all'?['x','y','z']:[axisFilter];
    var showArcs  =(gizmoMode==='all'||gizmoMode==='rotate');
    var showArrows=(gizmoMode==='all'||gizmoMode==='move'||gizmoMode==='scale'||_gcScale);
    var arrowW=isTouch?HIT_TOUCH:HIT_MOUSE; // perpendicular hit width for arrows
    var dist=Math.hypot(mx-CX,my-CY);
    var angle=Math.atan2(my-CY,mx-CX);
    var arcTol = isTouch ? 18 : 9; // arc ring tolerance

    // 1. Center dot — uniform scale / mode toggle
    if(showArrows && dist<=GC_CENTER_R+(isTouch?10:2)) return 'su';

    var shaftStart=GC_RING_R*0.45;
    var shaftEnd=GC_ARROW+GC_HEAD_L;
    var inArcZone = dist>=(GC_RING_R-arcTol) && dist<=(GC_RING_R+arcTol);

    // For touch: test arrows first when clearly outside the arc ring zone
    // (prevents arcs from stealing taps aimed at arrow shafts)
    if(isTouch && showArrows && !inArcZone && _gcLayout){
      for(var ia=0;ia<axes.length;ia++){
        var axa=axes[ia];
        var anga=_gcLayout.axisAngles[axa];
        var acosa=Math.cos(anga),asina=Math.sin(anga);
        var alonga=(mx-CX)*acosa+(my-CY)*asina;
        var perpa =Math.abs((mx-CX)*(-asina)+(my-CY)*acosa);
        if(alonga>=shaftStart&&alonga<=shaftEnd&&perpa<arrowW){
          return (_gcScale||gizmoMode==='scale')?'s'+axa:'a'+axa;
        }
      }
    }

    // 2. Arc ring — rotate
    // Use _gcLayout.arcs (same data as drawing). _gcComputeArcs() used a different
    // projection path (_oDir/_axisSign) that disagreed with _gcComputeLayout() (camR/camU),
    // so hit zones were misaligned from the drawn arcs — rotate was broken on touch.
    if(showArcs && inArcZone && _gcLayout){
      function normA3(a){return((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);}
      for(var i3=0;i3<axes.length;i3++){
        var ax3=axes[i3];
        var arc3=_gcLayout.arcs[ax3];
        var s3=normA3(arc3.start),e3=normA3(arc3.end),a3=normA3(angle);
        var hit3=(e3>=s3)?(a3>=s3&&a3<=e3):(a3>=s3||a3<=e3);
        if(hit3){_grabT=angle;return'r'+ax3;}
      }
    }

    // 3. Arrow shafts — move / scale
    if(showArrows&&_gcLayout){
      for(var i=0;i<axes.length;i++){
        var ax=axes[i];
        var ang=_gcLayout.axisAngles[ax];
        var acos=Math.cos(ang),asin=Math.sin(ang);
        // Project pointer onto axis direction and perpendicular
        var along=(mx-CX)*acos+(my-CY)*asin;
        var perp =Math.abs((mx-CX)*(-asin)+(my-CY)*acos);
        if(along>=shaftStart&&along<=shaftEnd&&perp<arrowW){
          return (_gcScale||gizmoMode==='scale')?'s'+ax:'a'+ax;
        }
      }
    }

    return null;
  }
  function getPos(e){const r=gc.getBoundingClientRect(),src=e.touches&&e.touches.length>0?e.touches[0]:e.changedTouches&&e.changedTouches.length>0?e.changedTouches[0]:e;var rw=r.width||1,rh=r.height||1;return{x:(src.clientX-r.left)*(W/rw),y:(src.clientY-r.top)*(H/rh)};}
  function applyDrag(p){if(!drag)return;const dx=p.x-drag.sx,dy=p.y-drag.sy,h=drag.h;
  if(h.startsWith('a')){
    const ax=h[1];
    var _aLayout=drag.frozenLayout||_gcLayout;
    if(_aLayout&&_aLayout.axisAngles){
      // Use frozen layout screen angle — consistent with drawn arrow, immune to drift
      var gang=_aLayout.axisAngles[ax];
      var proj=(dx*Math.cos(gang)+dy*Math.sin(gang))*0.028;
      var q=_gcAxisLocal?drag.oQuat:new THREE.Quaternion();
      var worldDir=WORLD[ax].clone().applyQuaternion(q).normalize();
      if(_aLayout.flipped[ax]) worldDir.negate();
      surfPos.copy(drag.oPos).addScaledVector(worldDir,proj);
    } else {
      const d=aDir(ax),proj=(dx*d.nx+dy*d.ny)*.032;
      surfPos.copy(drag.oPos);if(ax==='x')surfPos.x+=proj;if(ax==='y')surfPos.y+=proj;if(ax==='z')surfPos.z+=proj;
    }
    syncSurf();
  }else if(h.startsWith('r')){
    const ax=h[1];
    const grabAngle=drag.grabT;
    const tx=-Math.sin(grabAngle),ty=Math.cos(grabAngle);
    var proj=(dx*tx+dy*ty)*0.022;
    // Flip sign for z arc (arc direction convention)
    if(ax==='z') proj=-proj;
    // Flip if axis was shown flipped
    var _rLayout=drag.frozenLayout||_gcLayout;
    if(_rLayout&&_rLayout.flipped[ax]) proj=-proj;

    if(_gcAxisLocal){
      // LOCAL: rotate around the surface's own local axis — compose quaternion delta
      // Local axis in world space = WORLD[ax] rotated by current surfGroup quaternion
      var localAxis = WORLD[ax].clone().applyQuaternion(drag.oQuat).normalize();
      var doSnap2=snapEnabled||drag.shiftHeld;
      var rawProj=proj;
      if(doSnap2){
        // Snap the total accumulated angle
        var snapped=snapAngle(rawProj);
        var didSnap2=isSnapped(rawProj);
        if(didSnap2){snapFlash={ax,angle:snapped,t:performance.now()};proj=snapped;}
      }
      var delta=new THREE.Quaternion().setFromAxisAngle(localAxis, proj);
      var newQuat=drag.oQuat.clone().premultiply(delta).normalize();
      // Strip base-plane quaternion before decomposing to surfEuler
      // syncSurf will re-apply bq, so surfEuler must only hold the user rotation
      var bqCard=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),PNORMALS[curPlane]);
      var userQuat=newQuat.clone().multiply(bqCard.clone().invert());
      surfEuler.setFromQuaternion(userQuat.normalize(),'XYZ');
    } else {
      // WORLD: rotate around global axis (original behaviour)
      surfEuler.copy(drag.oEuler);
      var rawAngle;
      if(ax==='x')rawAngle=drag.oEuler.x+proj;
      if(ax==='y')rawAngle=drag.oEuler.y+proj;
      if(ax==='z')rawAngle=drag.oEuler.z+proj;
      const doSnap=snapEnabled||drag.shiftHeld,finalAngle=doSnap?snapAngle(rawAngle):rawAngle,didSnap=doSnap&&isSnapped(rawAngle);
      if(ax==='x')surfEuler.x=finalAngle;if(ax==='y')surfEuler.y=finalAngle;if(ax==='z')surfEuler.z=finalAngle;
      if(didSnap)snapFlash={ax,angle:finalAngle,t:performance.now()};
      const deg=Math.round(THREE.MathUtils.radToDeg(finalAngle)%360);
      document.getElementById('ghint').textContent=(didSnap?'⊙ ':'')+ax.toUpperCase()+': '+deg+'°'+(doSnap?'  [snapped]':'');
    }
    syncSurf();
  }else if(h.startsWith('s')&&h!=='su'){
    const ax=h[1];
    var _sLayout2=drag.frozenLayout||_gcLayout;
    var sgang2=_sLayout2?_sLayout2.axisAngles[ax]:0;
    var sproj=(dx*Math.cos(sgang2)+dy*Math.sin(sgang2))*0.018;
    var sv=drag.oSA.clone();
    if(ax==='x')sv.x=Math.max(.05,sv.x+sproj);
    if(ax==='y')sv.y=Math.max(.05,sv.y+sproj);
    if(ax==='z')sv.z=Math.max(.05,sv.z+sproj);
    surfScaleAxes.copy(sv);syncSurf();
  }else if(h==='su'){surfScale=Math.max(.05,drag.oSc-dy*.01);syncSurf();}draw();}
  gc.addEventListener('mousedown',e=>{const p=getPos(e),h=hitTest(p.x,p.y,false);if(!h)return;e.stopPropagation();drag={h,sx:p.x,sy:p.y,grabT:_grabT,oPos:surfPos.clone(),oEuler:surfEuler.clone(),oQuat:surfGroup.quaternion.clone(),oSc:surfScale,oSA:surfScaleAxes.clone(),shiftHeld:e.shiftKey,_startClientX:e.clientX,_startClientY:e.clientY,frozenLayout:_gcLayout?JSON.parse(JSON.stringify(_gcLayout)):null};hov=h;draw();});
  window.addEventListener('keydown',e=>{if(drag&&e.key==='Shift')drag.shiftHeld=true;});window.addEventListener('keyup',e=>{if(drag&&e.key==='Shift')drag.shiftHeld=false;});
  gc.addEventListener('mousemove',e=>{const p=getPos(e);if(!drag){const h=hitTest(p.x,p.y,false);if(h!==hov){hov=h;draw();}const hints={ax:'drag → move X',ay:'drag → move Y',az:'drag → move Z',rx:'drag → rotate X',ry:'drag → rotate Y',rz:'drag → rotate Z',sx:'drag → scale X',sy:'drag → scale Y',sz:'drag → scale Z',su:'drag ↕ uniform scale'};document.getElementById('ghint').textContent=h?(hints[h]||h):'move · rotate · scale';return;}e.stopPropagation();applyDrag(p);});
  gc.addEventListener('mouseup',e=>{
    if(drag&&drag.h==='su'){
      var ddx=e.clientX-(drag._startClientX||0),ddy=e.clientY-(drag._startClientY||0);
      if(Math.hypot(ddx,ddy)<5){_gcScale=!_gcScale; drag=null; draw(); return;}
    }
    drag=null;draw();
  });gc.addEventListener('mouseleave',()=>{if(!drag){hov=null;draw();}});
  gc.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();const p=getPos(e),h=hitTest(p.x,p.y,true);if(!h)return;drag={h,sx:p.x,sy:p.y,grabT:_grabT,oPos:surfPos.clone(),oEuler:surfEuler.clone(),oQuat:surfGroup.quaternion.clone(),oSc:surfScale,oSA:surfScaleAxes.clone(),frozenLayout:_gcLayout?JSON.parse(JSON.stringify(_gcLayout)):null};hov=h;draw();},{passive:false});
  gc.addEventListener('touchmove',e=>{e.preventDefault();e.stopPropagation();if(drag)applyDrag(getPos(e));},{passive:false});
  gc.addEventListener('touchend',e=>{
    if(drag&&drag.h==='su'&&e.changedTouches.length){
      var t=e.changedTouches[0];
      var ddx=t.clientX-(drag._startClientX||0),ddy=t.clientY-(drag._startClientY||0);
      if(Math.hypot(ddx,ddy)<8){_gcScale=!_gcScale; drag=null; hov=null; draw(); return;}
    }
    drag=null;hov=null;draw();
  });
  gc.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();surfScale=Math.max(.05,Math.min(10,surfScale-e.deltaY*.0025));syncSurf();draw();},{passive:false});
  document.getElementById('greset').addEventListener('click',()=>{surfPos.set(0,0,0);surfEuler.set(0,0,0);surfScale=1;surfScaleAxes.set(1,1,1);syncSurf();draw();});
  document.getElementById('gsnap').addEventListener('click',function(){window._setSnapEnabled(!snapEnabled);document.getElementById('ghint').textContent=snapEnabled?'snap 45° ON':'snap OFF';setTimeout(()=>document.getElementById('ghint').textContent='move · rotate · scale',1200);draw();});

  // ── Align camera to face ─────────────────────────────────────────
  // For plane/loft: faces the plane's world normal head-on.
  // For cube: picks the face most currently facing the viewer; re-tap flips.
  // Cylinder/cone/sphere/none: disabled.
  var _faceAnimRaf=null;
  var _lastFaceNormal=null; // last normal we aligned to, used to flip on re-tap
  function cameraForward(){
    // Current camera look direction from camera position to target
    const{theta,phi,radius,target}=cam;
    const px=target.x+radius*Math.sin(phi)*Math.cos(theta);
    const py=target.y+radius*Math.sin(phi)*Math.sin(theta);
    const pz=target.z+radius*Math.cos(phi);
    var f=new THREE.Vector3(target.x-px,target.y-py,target.z-pz);
    return f.normalize();
  }
  function surfaceWorldNormal(){
    // Normal of plane/loft surface = surfGroup quaternion applied to local +Z
    var n=new THREE.Vector3(0,0,1).applyQuaternion(surfGroup.quaternion);
    return n.normalize();
  }
  function cubeFaceNormals(){
    // 6 world-space face normals of the cube, using surfGroup's rotation
    var q=surfGroup.quaternion;
    var bases=[
      new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),
      new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),
      new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)
    ];
    return bases.map(function(v){return v.clone().applyQuaternion(q).normalize();});
  }
  function thetaPhiFromDir(dir){
    // Return {theta, phi} such that camera-to-target = -dir (i.e. camera looks along dir)
    // Camera position relative to target is at -dir * radius. In our spherical form:
    //   relPos = (sin(phi)cos(theta), sin(phi)sin(theta), cos(phi))
    // So relPos = -dir  =>  cos(phi) = -dir.z, and the xy projection points to (-dir.x,-dir.y)
    var relx=-dir.x,rely=-dir.y,relz=-dir.z;
    var phi=Math.acos(Math.max(-1,Math.min(1,relz)));
    // Avoid singularity at poles — when relx/rely near zero, keep current theta
    var xy=Math.hypot(relx,rely);
    var theta;
    if(xy<1e-4)theta=cam.theta;
    else theta=Math.atan2(rely,relx);
    return{theta:theta,phi:phi};
  }
  function shortAngleDelta(from,to){
    var d=to-from;
    while(d>Math.PI)d-=Math.PI*2;
    while(d<-Math.PI)d+=Math.PI*2;
    return d;
  }
  function animateCameraTo(targetTheta,targetPhi,targetCtr,onComplete){
    if(_faceAnimRaf){cancelAnimationFrame(_faceAnimRaf);_faceAnimRaf=null;}
    // Unwrap theta to take short path
    var dTheta=shortAngleDelta(cam.theta,targetTheta);
    var finalTheta=cam.theta+dTheta;
    var startTheta=cam.theta,startPhi=cam.phi;
    var startTgt=cam.target.clone();
    var DUR=250,t0=performance.now();
    function ease(t){return 1-Math.pow(1-t,3);} // ease-out cubic
    function step(){
      var t=(performance.now()-t0)/DUR;
      if(t>=1)t=1;
      var k=ease(t);
      cam.theta=startTheta+(finalTheta-startTheta)*k;
      cam.phi=startPhi+(targetPhi-startPhi)*k;
      cam.target.lerpVectors(startTgt,targetCtr,k);
      updCam();
      if(t<1)_faceAnimRaf=requestAnimationFrame(step);
      else{_faceAnimRaf=null;if(onComplete)onComplete();}
    }
    step();
  }
  function alignCameraToFace(){
    // Disabled for surfaces without a single well-defined face
    if(surfType==='cylinder'||surfType==='cone'||surfType==='sphere'||surfType==='none'){
      var hint=document.getElementById('ghint');
      if(hint){hint.textContent='FACE: not available for '+surfType;setTimeout(()=>{hint.textContent='move · rotate · scale';},1400);}
      return;
    }
    var normal,center=surfPos.clone();
    if(surfType==='cube'){
      var normals=cubeFaceNormals();
      // Find face most facing the viewer (dot with camera forward most negative: face normal opposes camera look dir)
      var fwd=cameraForward();
      var bestDot=Infinity,bestN=null;
      for(var i=0;i<normals.length;i++){
        var d=normals[i].dot(fwd);
        if(d<bestDot){bestDot=d;bestN=normals[i];}
      }
      normal=bestN;
    } else {
      // plane or loft
      normal=surfaceWorldNormal();
    }
    // Check if we're already aligned to this normal — if so, flip to opposite side
    var fwd2=cameraForward();
    var alreadyAligned=(-normal.dot(fwd2))>0.995; // camera fwd ≈ -normal
    if(alreadyAligned)normal=normal.clone().multiplyScalar(-1);
    // Target spherical coords: camera sits along +normal from target, looking down -normal
    var tp=thetaPhiFromDir(normal.clone().multiplyScalar(-1));
    // Guard near poles — if phi is ~0 or ~PI, camera up (0,0,1) degenerates; nudge slightly
    if(tp.phi<0.02)tp.phi=0.02;
    if(tp.phi>Math.PI-0.02)tp.phi=Math.PI-0.02;
    animateCameraTo(tp.theta,tp.phi,center,function(){setOrtho(true);});
    _lastFaceNormal=normal.clone();
  }
  var gface=document.getElementById('gface');
  if(gface)gface.addEventListener('click',alignCameraToFace);
  var pbGface=document.getElementById('pb-gface');
  if(pbGface)pbGface.addEventListener('click',alignCameraToFace);
  window._alignCameraToFace=alignCameraToFace;
  window._animateCameraTo=animateCameraTo;
  // Narrow gizmo panel RESET + snap
  const pbGrst=document.getElementById('pb-greset');if(pbGrst)pbGrst.addEventListener('click',()=>document.getElementById('greset').click());
  const pbGsnp=document.getElementById('pb-gsnap');if(pbGsnp)pbGsnp.addEventListener('click',function(){window._setSnapEnabled(!snapEnabled);const ph=document.getElementById('pb-ghint');if(ph)ph.textContent=snapEnabled?'snap ON':'snap OFF';setTimeout(()=>{if(ph)ph.textContent='move';},1200);});
  draw();window._gDraw=draw;
  window._pbGcDraw=function(){const pg=document.getElementById('pb-gc');if(!pg)return;draw();const pgctx=pg.getContext('2d');pgctx.clearRect(0,0,pg.width,pg.height);pgctx.drawImage(gc,0,0,pg.width,pg.height);};
  const pbGc=document.getElementById('pb-gc');
  if(pbGc){let pbDrag=null;function pbXY(e){const r=pbGc.getBoundingClientRect(),src=e.touches&&e.touches.length>0?e.touches[0]:e.changedTouches&&e.changedTouches.length>0?e.changedTouches[0]:e;return{x:(src.clientX-r.left)/r.width*W,y:(src.clientY-r.top)/r.height*H};}pbGc.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();const p=pbXY(e),h=hitTest(p.x,p.y,false);if(!h)return;pbDrag={h,sx:p.x,sy:p.y,grabT:_grabT,oPos:surfPos.clone(),oEuler:surfEuler.clone(),oQuat:surfGroup.quaternion.clone(),oSc:surfScale,oSA:surfScaleAxes.clone(),shiftHeld:e.shiftKey,frozenLayout:_gcLayout?JSON.parse(JSON.stringify(_gcLayout)):null};hov=h;draw();window._pbGcDraw&&window._pbGcDraw();});pbGc.addEventListener('mousemove',e=>{e.preventDefault();e.stopPropagation();const p=pbXY(e);if(!pbDrag){const h=hitTest(p.x,p.y,false);if(h!==hov){hov=h;draw();window._pbGcDraw&&window._pbGcDraw();}return;}drag=pbDrag;applyDrag(p);drag=null;window._pbGcDraw&&window._pbGcDraw();});pbGc.addEventListener('mouseup',()=>{pbDrag=null;draw();window._pbGcDraw&&window._pbGcDraw();});pbGc.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();const p=pbXY(e),h=hitTest(p.x,p.y,true);if(!h)return;pbDrag={h,sx:p.x,sy:p.y,grabT:_grabT,oPos:surfPos.clone(),oEuler:surfEuler.clone(),oQuat:surfGroup.quaternion.clone(),oSc:surfScale,oSA:surfScaleAxes.clone(),shiftHeld:false,frozenLayout:_gcLayout?JSON.parse(JSON.stringify(_gcLayout)):null};hov=h;draw();window._pbGcDraw&&window._pbGcDraw();},{passive:false});pbGc.addEventListener('touchmove',e=>{e.preventDefault();e.stopPropagation();if(!pbDrag)return;const p=pbXY(e);drag=pbDrag;applyDrag(p);drag=null;window._pbGcDraw&&window._pbGcDraw();},{passive:false});pbGc.addEventListener('touchend',e=>{e.stopPropagation();if(pbDrag&&pbDrag.h==='su'&&e.changedTouches.length){const ep=pbXY(e),ddx=ep.x-pbDrag.sx,ddy=ep.y-pbDrag.sy;if(Math.hypot(ddx,ddy)<10){_gcScale=!_gcScale;pbDrag=null;hov=null;draw();window._pbGcDraw&&window._pbGcDraw();return;}}pbDrag=null;draw();window._pbGcDraw&&window._pbGcDraw();});}
})();
