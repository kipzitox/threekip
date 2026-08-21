// ================================================================
//  STROKE GIZMO — move/rotate/scale selected stroke via group matrix
// ================================================================
(function(){
  const sgc=document.getElementById('sg-gc'),ctx=sgc.getContext('2d');
  const W=sgc.width,H=sgc.height,CX=W/2,CY=H/2;
  const COL={x:'#e03040',y:'#22bb55',z:'#3377ee'};
  const AL=56,HIT_MOUSE=14,HIT_TOUCH=42;
  // v14.3: equal-radius rings; view-aligned arcs provide spatial identity.
  const RING_RADIUS=AL*0.85;
  const RING_R={x:RING_RADIUS,y:RING_RADIUS,z:RING_RADIUS};
  let sgMode='all';// 'all'|'move'|'rotate'|'scale'
  let sgDrag=null,sgHov=null;
  let _sgGrabT=0;

  function axisDir2D(worldAxis){const ac=activeCam(),o=new THREE.Vector3(0,0,0).project(ac),t=worldAxis.clone().normalize().project(ac);const dx=t.x-o.x,dy=-(t.y-o.y),len=Math.sqrt(dx*dx+dy*dy)||1;return{nx:dx/len,ny:dy/len};}
  const WORLD={x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)};
  function aDir(ax){return axisDir2D(WORLD[ax]);}
  function aTip(ax){const d=aDir(ax);return{x:CX+d.nx*AL,y:CY+d.ny*AL};}
  function ringAxes(ax){const pairs={x:['y','z'],y:['x','z'],z:['x','y']};const[a,b]=pairs[ax];return{da:aDir(a),db:aDir(b)};}
  function ringAxes3D(ax){const pairs={x:['y','z'],y:['x','z'],z:['x','y']};const[a,b]=pairs[ax];return{da3:WORLD[a],db3:WORLD[b]};}
  function cameraLookDir(){const ac=activeCam();return new THREE.Vector3().subVectors(ac.position,new THREE.Vector3(0,0,0)).normalize();}
  // v17: sg ortho — un-normalised for rings (guarantees handle sits on ring), normalised for shafts/arrows
  function _sgOd(worldAxis){const ac=activeCam();const rx=worldAxis.dot(new THREE.Vector3().setFromMatrixColumn(ac.matrixWorld,0));const ry=worldAxis.dot(new THREE.Vector3().setFromMatrixColumn(ac.matrixWorld,1));return{nx:rx,ny:-ry};}
  function _sgODir(ax){const d=_sgOd(WORLD[ax]);const len=Math.sqrt(d.nx*d.nx+d.ny*d.ny)||1;return{nx:d.nx/len,ny:d.ny/len};}
  function _sgOra(ax){const p={x:['y','z'],y:['x','z'],z:['x','y']};const[a,b]=p[ax];return{da:_sgOd(WORLD[a]),db:_sgOd(WORLD[b])};}
  function _sgAxisSign(ax){const c=cameraLookDir(),w=WORLD[ax];return(w.x*c.x+w.y*c.y+w.z*c.z)>=0?1:-1;}
  function _sgSignedTip(ax){const s=_sgAxisSign(ax),d=_sgODir(ax);return{x:CX+d.nx*s*AL,y:CY+d.ny*s*AL,s,d};}
  function _sgSignedBoxPos(ax){const s=_sgAxisSign(ax),d=_sgODir(ax);return{x:CX+d.nx*s*AL*.70,y:CY+d.ny*s*AL*.70,s};}
  const SG_RING_RADIUS=AL*0.85;
  // v19: sg handles — most-forward per ring + slide for separation
  const SG_HANDLE_MIN_SEP=26;
  function _sgHandleAngles(){
    const camDir=cameraLookDir();const axes=['x','y','z'];
    const result={};
    axes.forEach(function(ax){
      const{da3,db3}=ringAxes3D(ax);const STEPS=64;var bestT=0,bestDot=-Infinity;
      for(var i=0;i<STEPS;i++){const t=(i/STEPS)*Math.PI*2,ct=Math.cos(t),st=Math.sin(t);const fw=(da3.x*ct+db3.x*st)*camDir.x+(da3.y*ct+db3.y*st)*camDir.y+(da3.z*ct+db3.z*st)*camDir.z;if(fw>bestDot){bestDot=fw;bestT=t;}}
      result[ax]={t:bestT};
    });
    function sp(ax,t){const{da,db}=_sgOra(ax),ct=Math.cos(t),st=Math.sin(t);return{x:CX+da.nx*ct*SG_RING_RADIUS+db.nx*st*SG_RING_RADIUS,y:CY+da.ny*ct*SG_RING_RADIUS+db.ny*st*SG_RING_RADIUS};}
    [['x','y'],['x','z'],['y','z']].forEach(function(pair){
      const a=pair[0],b=pair[1];
      var pa=sp(a,result[a].t),pb=sp(b,result[b].t);
      if(Math.hypot(pa.x-pb.x,pa.y-pb.y)>=SG_HANDLE_MIN_SEP)return;
      const{da3:da3a,db3:db3a}=ringAxes3D(a);const{da3:da3b,db3:db3b}=ringAxes3D(b);
      const dotA=(da3a.x*Math.cos(result[a].t)+db3a.x*Math.sin(result[a].t))*camDir.x+(da3a.y*Math.cos(result[a].t)+db3a.y*Math.sin(result[a].t))*camDir.y+(da3a.z*Math.cos(result[a].t)+db3a.z*Math.sin(result[a].t))*camDir.z;
      const dotB=(da3b.x*Math.cos(result[b].t)+db3b.x*Math.sin(result[b].t))*camDir.x+(da3b.y*Math.cos(result[b].t)+db3b.y*Math.sin(result[b].t))*camDir.y+(da3b.z*Math.cos(result[b].t)+db3b.z*Math.sin(result[b].t))*camDir.z;
      const slideAx=(dotA<=dotB)?a:b;const step=0.06;var t=result[slideAx].t;
      for(var iter=0;iter<52;iter++){const tp=t+step,tm=t-step;const otherAx=(slideAx===a)?b:a;const po=sp(otherAx,result[otherAx].t);const dp=Math.hypot(sp(slideAx,tp).x-po.x,sp(slideAx,tp).y-po.y);const dm=Math.hypot(sp(slideAx,tm).x-po.x,sp(slideAx,tm).y-po.y);t=(dp>=dm)?tp:tm;if(Math.hypot(sp(slideAx,t).x-po.x,sp(slideAx,t).y-po.y)>=SG_HANDLE_MIN_SEP)break;}
      result[slideAx].t=t;
    });
    axes.forEach(function(ax){
      const{da,db}=_sgOra(ax),t=result[ax].t,ct=Math.cos(t),st=Math.sin(t);
      result[ax].x=CX+da.nx*ct*SG_RING_RADIUS+db.nx*st*SG_RING_RADIUS;
      result[ax].y=CY+da.ny*ct*SG_RING_RADIUS+db.ny*st*SG_RING_RADIUS;
      const tx=-da.nx*st+db.nx*ct,ty=-da.ny*st+db.ny*ct,tl=Math.sqrt(tx*tx+ty*ty)||1;
      result[ax].tx=tx/tl;result[ax].ty=ty/tl;
    });
    return result;
  }
  function _sgHandleAngle(ax){return _sgHandleAngles()[ax].t;}
  function boxPos2(ax){return _sgSignedBoxPos(ax);}

  // ── Selection gizmo unified 2D (v30) ─────────────────────────
  var _SG_R = Math.min(CX,CY); // proportional base
  var SG_RING_R2  = Math.round(_SG_R*0.68);
  var SG_GAP2     = 0.22;
  var SG_ARC_BOUNDS2 = {x:['z','y'], y:['z','x'], z:['x','y']};
  var SG_ARROW    = Math.round(_SG_R*0.76);
  var SG_HEAD_S   = Math.round(_SG_R*0.10);
  var SG_HEAD_L   = Math.round(_SG_R*0.14);
  var SG_BOX_S    = Math.round(_SG_R*0.10);
  var SG_CENTER_R = Math.round(_SG_R*0.16);
  var _sgLayout2  = null;
  var _sgScaleMode= false;
  var _sgAxisLocal= true;

  function _sgComputeLayout2(){
    var q = _sgAxisLocal ? (selectedStrokes.length ? _sgGetSelQuat() : new THREE.Quaternion()) : new THREE.Quaternion();
    var ac = activeCam();
    var cen = selectedStrokes.length ? selectionCentroid() : new THREE.Vector3();
    var cv  = cen.clone().project(ac);
    var camDir = new THREE.Vector3().subVectors(ac.position, cen).normalize();
    var axisAngles={}, flipped={};
    ['x','y','z'].forEach(function(ax){
      var dir=WORLD[ax].clone().applyQuaternion(q).normalize();
      flipped[ax] = dir.dot(camDir)<0;
      if(flipped[ax]) dir.negate();
      var tipV = cen.clone().addScaledVector(dir,1).project(ac);
      axisAngles[ax] = Math.atan2(-(tipV.y-cv.y),(tipV.x-cv.x));
    });
    function N(a){return((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);}
    var arcs={};
    ['x','y','z'].forEach(function(ax){
      var bA=SG_ARC_BOUNDS2[ax][0],bB=SG_ARC_BOUNDS2[ax][1];
      var s=N(axisAngles[bA]),e=N(axisAngles[bB]),own=N(axisAngles[ax]);
      var spanCCW=(e-s+Math.PI*2)%(Math.PI*2);
      var ownInCCW=((own-s+Math.PI*2)%(Math.PI*2))<spanCCW;
      var arcStart,arcEnd;
      if(!ownInCCW){arcStart=s+SG_GAP2;arcEnd=s+spanCCW-SG_GAP2;}
      else          {arcStart=e+SG_GAP2;arcEnd=e+(Math.PI*2-spanCCW)-SG_GAP2;}
      arcs[ax]={start:arcStart,end:arcEnd};
    });
    _sgLayout2={cx:CX,cy:CY,axisAngles:axisAngles,flipped:flipped,arcs:arcs};
  }
  function _sgGetSelQuat(){
    // Use first selected stroke's mesh quaternion for local axes
    if(selectedStrokes.length) return selectedStrokes[0].mesh.quaternion;
    return new THREE.Quaternion();
  }

  function _sgComputeArcs(){
    var axisAngles={};
    ['x','y','z'].forEach(function(ax){
      var d=_sgODir(ax), s=_sgAxisSign(ax);
      axisAngles[ax]=Math.atan2(d.ny*s, d.nx*s);
    });
    function N(a){return((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);}
    var arcs={};
    ['x','y','z'].forEach(function(ax){
      var bA=SG_ARC_BOUNDS2[ax][0], bB=SG_ARC_BOUNDS2[ax][1];
      var s=N(axisAngles[bA]), e=N(axisAngles[bB]), own=N(axisAngles[ax]);
      var spanCCW=(e-s+Math.PI*2)%(Math.PI*2);
      var ownInCCW=((own-s+Math.PI*2)%(Math.PI*2))<spanCCW;
      var arcStart,arcEnd;
      if(!ownInCCW){arcStart=s+SG_GAP2; arcEnd=s+spanCCW-SG_GAP2;}
      else         {arcStart=e+SG_GAP2; arcEnd=e+(Math.PI*2-spanCCW)-SG_GAP2;}
      arcs[ax]={start:arcStart, end:arcEnd};
    });
    return{axisAngles:axisAngles, arcs:arcs};
  }

  function _sgUnifiedDraw(){
    // Freeze layout during rotate drag to prevent jitter
    if(sgDrag&&sgDrag.h&&sgDrag.h[0]==='r'&&sgDrag.frozenLayout){
      _sgLayout2=sgDrag.frozenLayout;
    } else {
      _sgComputeLayout2();
    }
    ctx.clearRect(0,0,W,H);
    if(!_sgLayout2||!selectedStrokes.length) return;
    var cx=_sgLayout2.cx,cy=_sgLayout2.cy;
    var axisAngles=_sgLayout2.axisAngles,arcs=_sgLayout2.arcs,flipped=_sgLayout2.flipped;
    var activeDrag=sgDrag?sgDrag.h:null;
    var showSgArcs  =(sgMode==='all'||sgMode==='rotate');
    var showSgArrows=(sgMode==='all'||sgMode==='move'||sgMode==='scale');

    ['x','y','z'].forEach(function(ax){
      var col=COL[ax],arc=arcs[ax],angle=axisAngles[ax];
      var ax2c=Math.cos(angle),ay2s=Math.sin(angle);
      var arcHlit=(sgHov==='r'+ax)||(activeDrag==='r'+ax);
      var arwHlit=(sgHov==='a'+ax||sgHov==='s'+ax)||(activeDrag==='a'+ax||activeDrag==='s'+ax);

      // Arc — only in all/rotate mode
      if(showSgArcs){
        ctx.save();
        if(arcHlit){ctx.shadowColor=col;ctx.shadowBlur=9;}
        ctx.beginPath(); ctx.arc(cx,cy,SG_RING_R2,arc.start,arc.end);
        ctx.strokeStyle=col;
        ctx.lineWidth=arcHlit?Math.round(_SG_R*0.09):Math.round(_SG_R*0.065);
        ctx.lineCap='round';
        ctx.globalAlpha=arcHlit?1:0.45; ctx.stroke();
        ctx.restore();
      }

      // Shaft + head — only in all/move/scale mode
      if(!showSgArrows) return;
      var shaftS=SG_RING_R2*0.55;
      var ex=cx+ax2c*SG_ARROW,ey=cy+ay2s*SG_ARROW;
      ctx.save();
      if(arwHlit){ctx.shadowColor=col;ctx.shadowBlur=7;}
      ctx.globalAlpha=arwHlit?1:0.85;
      ctx.strokeStyle=col;
      ctx.lineWidth=arwHlit?Math.round(_SG_R*0.055):Math.round(_SG_R*0.04);
      ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cx+ax2c*shaftS,cy+ay2s*shaftS); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx+ax2c*shaftS,cy+ay2s*shaftS,arwHlit?Math.round(_SG_R*0.055):Math.round(_SG_R*0.03),0,Math.PI*2);
      ctx.fillStyle=col; ctx.fill();
      if(_sgScaleMode){
        var bx=ex+ax2c*(SG_HEAD_L*0.5),by=ey+ay2s*(SG_HEAD_L*0.5);
        var hs=arwHlit?SG_BOX_S*1.2:SG_BOX_S;
        ctx.save(); ctx.translate(bx,by); ctx.rotate(angle+Math.PI/4);
        ctx.globalAlpha=arwHlit?0.9:0.65;
        ctx.fillStyle=col; ctx.fillRect(-hs,-hs,hs*2,hs*2);
        ctx.restore();
      } else {
        var px=ay2s,py=-ax2c;
        ctx.beginPath();
        ctx.moveTo(ex+ax2c*SG_HEAD_L,ey+ay2s*SG_HEAD_L);
        ctx.lineTo(ex+px*SG_HEAD_S,ey+py*SG_HEAD_S);
        ctx.lineTo(ex-px*SG_HEAD_S,ey-py*SG_HEAD_S);
        ctx.closePath(); ctx.fillStyle=col; ctx.fill();
      }
      ctx.restore();
      // Label — clamped, proportional font
      ctx.save(); ctx.font='bold '+Math.round(_SG_R*0.12)+'px DM Mono,monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle=col; ctx.globalAlpha=arwHlit?1:0.88;
      var sgLblDist=SG_ARROW+SG_HEAD_L+Math.round(_SG_R*0.06);
      var slx=cx+ax2c*sgLblDist, sly=cy+ay2s*sgLblDist;
      var sm=6; slx=Math.max(sm,Math.min(W-sm,slx)); sly=Math.max(sm,Math.min(H-sm,sly));
      ctx.fillText((flipped[ax]?'-':'')+ax.toUpperCase(), slx, sly);
      ctx.restore();
    });

    // Center
    var cenHlit=(sgHov==='su')||(activeDrag==='su');
    ctx.save();
    if(_sgScaleMode){
      ctx.translate(cx,cy); ctx.rotate(Math.PI/4);
      var ds2=cenHlit?Math.round(_SG_R*0.12):Math.round(_SG_R*0.09);
      ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.fillRect(-ds2,-ds2,ds2*2,ds2*2);
      ctx.fillStyle=cenHlit?'rgba(255,220,60,1)':'rgba(255,200,60,0.85)';
      var di2=cenHlit?Math.round(_SG_R*0.09):Math.round(_SG_R*0.065); ctx.fillRect(-di2,-di2,di2*2,di2*2);
    } else {
      ctx.beginPath(); ctx.arc(cx,cy,cenHlit?Math.round(_SG_R*0.09):Math.round(_SG_R*0.065),0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.90)'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx,cy,cenHlit?Math.round(_SG_R*0.065):Math.round(_SG_R*0.05),0,Math.PI*2);
      ctx.fillStyle='rgba(80,80,110,0.65)'; ctx.fill();
    }
    ctx.restore();
    // Count
    if(selectedStrokes.length>1){
      ctx.save(); ctx.fillStyle=_uiInk(.55);
      ctx.font='7px DM Mono,monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(selectedStrokes.length+' selected',CX,H-8); ctx.restore();
    }
    // LCL/WLD indicator
    ctx.save(); ctx.font='bold 7px DM Mono,monospace';
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillStyle=_sgAxisLocal?'rgba(255,220,100,0.85)':'rgba(160,200,255,0.85)';
    ctx.fillText(_sgAxisLocal?'LCL':'WLD',4,4); ctx.restore();
  }
  function drawNewSgArc(){} // stub — _sgUnifiedDraw handles everything


  function drawSgArrow(ax,active){const e=_sgSignedTip(ax),s=e.s,d=e.d,col=COL[ax],hlit=sgHov==='a'+ax||active;ctx.save();ctx.strokeStyle=hlit?'#111':col;ctx.fillStyle=hlit?'#111':col;ctx.lineWidth=hlit?3:2.5;ctx.globalAlpha=hlit?1:.85;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(CX+d.nx*s*10,CY+d.ny*s*10);ctx.lineTo(e.x-d.nx*s*12,e.y-d.ny*s*12);ctx.stroke();const px=-d.ny*s*5,py=d.nx*s*5;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x-d.nx*s*10+px,e.y-d.ny*s*10+py);ctx.lineTo(e.x-d.nx*s*10-px,e.y-d.ny*s*10-py);ctx.closePath();ctx.fill();ctx.font='600 8px DM Mono,monospace';ctx.fillStyle=hlit?'#111':col;ctx.globalAlpha=.9;ctx.fillText(ax.toUpperCase(),e.x+d.nx*s*6,e.y+d.ny*s*6+3);ctx.restore();}
  function drawSgArc(ax,active){
    // v21: flat pie segment — reuses _pieSegments() from surface gizmo (same camera)
    const segs=_pieSegments();
    const seg=segs.find(s=>s.ax===ax);
    if(!seg)return;
    const col=COL[ax],hlit=sgHov==='r'+ax||active;
    var anyActive=null;if(sgDrag&&sgDrag.h&&sgDrag.h[0]==='r')anyActive=sgDrag.h[1];else if(sgHov&&sgHov[0]==='r')anyActive=sgHov[1];
    const dimmed=anyActive&&anyActive!==ax;
    const alpha=hlit?1:(dimmed?0.18:0.78);
    const ri=PIE_R_INNER*0.94,ro=PIE_R_OUTER*0.94; // slightly smaller for sg
    const capR=(ro-ri)*0.5,midR2=(ri+ro)*0.5;
    ctx.save();
    // Band with rounded tail cap at seg.start
    ctx.beginPath();
    ctx.arc(CX,CY,ro,seg.start,seg.end);
    ctx.arc(CX,CY,ri,seg.end,seg.start,true);
    const capCx=CX+Math.cos(seg.start)*midR2,capCy=CY+Math.sin(seg.start)*midR2;
    ctx.arc(capCx,capCy,capR,seg.start+Math.PI,seg.start,true);
    ctx.closePath();
    ctx.fillStyle=col;ctx.globalAlpha=alpha*(hlit?0.85:0.65);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.22)';ctx.globalAlpha=alpha*0.5;ctx.fill();
    ctx.beginPath();ctx.arc(CX,CY,midR2,seg.start,seg.end);
    ctx.strokeStyle=hlit?_uiInk(.9):col;ctx.lineWidth=hlit?2:1.2;ctx.globalAlpha=alpha*(hlit?1:0.7);ctx.setLineDash([]);ctx.lineCap='round';ctx.stroke();
    const lx=CX+Math.cos(seg.mid)*(ro+8),ly=CY+Math.sin(seg.mid)*(ro+8);
    ctx.globalAlpha=hlit?1:(dimmed?0.25:0.8);ctx.fillStyle=hlit?_uiInk(.9):col;
    ctx.font='600 7px DM Mono,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ax.toUpperCase(),lx,ly);
    ctx.restore();
  }
function drawSgBox(ax,active){const b=_sgSignedBoxPos(ax),col=COL[ax],hlit=sgHov==='s'+ax||active,S=hlit?11:9;ctx.save();ctx.strokeStyle=hlit?_uiInk(.9):col;ctx.fillStyle=hlit?col+'30':col+'18';ctx.lineWidth=hlit?2:1.6;ctx.globalAlpha=hlit?1:.85;ctx.beginPath();ctx.rect(b.x-S/2,b.y-S/2,S,S);ctx.stroke();ctx.fill();ctx.restore();}
function drawSgUniform(active){const hlit=sgHov==='su'||active;ctx.save();ctx.fillStyle=_uiInk(.08);ctx.strokeStyle=hlit?_uiInk(.9):_uiInk(.45);ctx.lineWidth=hlit?2:1.4;ctx.globalAlpha=hlit?1:.7;ctx.beginPath();ctx.arc(CX,CY,5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}

  function sgDraw(){ _sgUnifiedDraw(); }

  function sgHitTest(mx,my,isTouch){
    if(!selectedStrokes.length) return null;
    _sgComputeLayout2();
    if(!_sgLayout2) return null;
    var sgl=_sgLayout2;
    var sdx=mx-sgl.cx,sdy=my-sgl.cy;
    var sdist=Math.sqrt(sdx*sdx+sdy*sdy);
    var sang=Math.atan2(sdy,sdx);
    var axes=['x','y','z'];
    var hitArcs   =(sgMode==='all'||sgMode==='rotate');
    var hitArrows =(sgMode==='all'||sgMode==='move');
    var hitScale  =(sgMode==='all'||sgMode==='scale');
    var arcTol = isTouch ? 18 : 9;
    var sgW = isTouch ? 48 : 14;
    var inArcZone = Math.abs(sdist-SG_RING_R2) < arcTol;
    // Center (uniform scale) — always visible in all/scale mode
    if((sgMode==='all'||sgMode==='scale')&&sdist<=SG_CENTER_R+(isTouch?8:0)) return 'su';
    // Touch: test arrows first when clearly outside arc zone
    if(isTouch && (hitArrows||hitScale) && !inArcZone){
      for(var sk=0;sk<axes.length;sk++){
        var sak=axes[sk],sangk=sgl.axisAngles[sak];
        var sacsk=Math.cos(sangk),sask=Math.sin(sangk);
        var salk=sdx*sacsk+sdy*sask;
        var sperk=Math.abs(sdx*(-sask)+sdy*sacsk);
        if(salk>=SG_RING_R2*0.4&&salk<=SG_ARROW+SG_HEAD_L&&sperk<sgW){
          var useScaleK=(sgMode==='scale')||(sgMode==='all'&&_sgScaleMode);
          return useScaleK?'s'+sak:'a'+sak;
        }
      }
    }
    // Arc hits
    if(hitArcs && inArcZone){
      function normSgA2(a){return((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);}
      for(var si2=0;si2<axes.length;si2++){
        var sax2=axes[si2],sarc2=sgl.arcs[sax2];
        var ss2=normSgA2(sarc2.start),se2=normSgA2(sarc2.end),sa2=normSgA2(sang);
        var shit2=(se2>=ss2)?(sa2>=ss2&&sa2<=se2):(sa2>=ss2||sa2<=se2);
        if(shit2){_sgGrabT=sang;return'r'+sax2;}
      }
    }
    // Arrow / scale hits
    if(hitArrows||hitScale){
      for(var sj=0;sj<axes.length;sj++){
        var sax3=axes[sj],sang3=sgl.axisAngles[sax3];
        var sacos=Math.cos(sang3),sasin=Math.sin(sang3);
        var salong=sdx*sacos+sdy*sasin;
        var saperp=Math.abs(sdx*(-sasin)+sdy*sacos);
        if(salong>=SG_RING_R2*0.4&&salong<=SG_ARROW+SG_HEAD_L&&saperp<sgW){
          var useScale=(sgMode==='scale')||(sgMode==='all'&&_sgScaleMode);
          return useScale?'s'+sax3:'a'+sax3;
        }
      }
    }
    return null;
  }

  function sgGetPos(e){const r=sgc.getBoundingClientRect(),src=e.touches&&e.touches.length>0?e.touches[0]:e.changedTouches&&e.changedTouches.length>0?e.changedTouches[0]:e;var rw=r.width||1,rh=r.height||1;return{x:(src.clientX-r.left)*(sgc.width/rw),y:(src.clientY-r.top)*(sgc.height/rh)};}

  // Compute centroid of all selected strokes (world space)
  function selectionCentroid(){
    const c=new THREE.Vector3();
    selectedStrokes.forEach(s=>{
      const wpts=s.pts.map(p=>p.clone().applyMatrix4(s.mesh.matrix));
      const sc=new THREE.Vector3();wpts.forEach(p=>sc.add(p));sc.divideScalar(wpts.length);
      c.add(sc);
    });
    return c.divideScalar(selectedStrokes.length);
  }

  function sgApplyDrag(p){
    if(!sgDrag||!selectedStrokes.length)return;
    const dx=p.x-sgDrag.sx,dy=p.y-sgDrag.sy,h=sgDrag.h;
    const centroid=sgDrag.centroid;

    selectedStrokes.forEach((s,si)=>{
      const mesh=s.mesh;
      // Restore from saved start matrix
      mesh.matrix.copy(sgDrag.oMatrices[si]);
      mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);

      if(h.startsWith('a')){
        const ax=h[1];
        var _sgFL=sgDrag.frozenLayout||_sgLayout2;
        var sgang=_sgFL?_sgFL.axisAngles[ax]:0;
        var sgproj=(dx*Math.cos(sgang)+dy*Math.sin(sgang))*0.028;
        var sgdir=WORLD[ax].clone();
        if(_sgFL&&_sgFL.flipped[ax]) sgdir.negate();
        mesh.position.addScaledVector(sgdir,sgproj);
        // also re-offset from oMatrix base:
        mesh.matrix.copy(sgDrag.oMatrices[si]); mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);
        mesh.position.addScaledVector(sgdir,sgproj);
      }else if(h.startsWith('r')){
        // v21: flat 2D tangent at grab screen angle
        const ax=h[1];
        const grabAngle=sgDrag.grabT;
        const tx=-Math.sin(grabAngle),ty=Math.cos(grabAngle);
        const proj=(dx*tx+dy*ty)*0.022;
        const angle=ax==='z'?-proj:proj;
        const q=new THREE.Quaternion();
        if(ax==='x')q.setFromAxisAngle(new THREE.Vector3(1,0,0),angle);
        if(ax==='y')q.setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
        if(ax==='z')q.setFromAxisAngle(new THREE.Vector3(0,0,1),angle);
        // Orbit position around centroid
        const offset=mesh.position.clone().sub(centroid);
        offset.applyQuaternion(q);
        mesh.position.copy(centroid).add(offset);
        mesh.quaternion.premultiply(q);
      }else if(h.startsWith('s')&&h!=='su'){
        const ax=h[1],d=aDir(ax),proj=1+(dx*d.nx+dy*d.ny)*.015;
        // Scale away from centroid
        const offset=mesh.position.clone().sub(centroid);
        if(ax==='x'){mesh.scale.x=Math.max(.05,sgDrag.oScales[si].x*proj);offset.x*=proj;}
        if(ax==='y'){mesh.scale.y=Math.max(.05,sgDrag.oScales[si].y*proj);offset.y*=proj;}
        if(ax==='z'){mesh.scale.z=Math.max(.05,sgDrag.oScales[si].z*proj);offset.z*=proj;}
        mesh.position.copy(centroid).add(offset);
      }else if(h==='su'){
        const sc=Math.max(.05,1-dy*.012);
        mesh.scale.copy(sgDrag.oScales[si]).multiplyScalar(sc);
        const offset=mesh.position.clone().sub(centroid).multiplyScalar(sc);
        mesh.position.copy(centroid).add(offset);
      }
      mesh.updateMatrix();mesh.matrixAutoUpdate=false;
    });
    updateSelHighlights();sgDraw();
  }

  function sgStartDrag(p,h){
    if(!h||!selectedStrokes.length)return;
    const oMatrices=selectedStrokes.map(s=>s.mesh.matrix.clone());
    const oScales=selectedStrokes.map(s=>s.mesh.scale.clone());
    const centroid=selectionCentroid();
    // Push one undo action covering all selected strokes
    pushUndo({type:'stroke_transform_multi',strokes:selectedStrokes.slice(),oldMatrices:oMatrices});
    sgDrag={h,sx:p.x,sy:p.y,grabT:_sgGrabT,oMatrices,oScales,centroid,_scx:p.x+sgc.getBoundingClientRect().left,_scy:p.y+sgc.getBoundingClientRect().top,frozenLayout:_sgLayout2?JSON.parse(JSON.stringify(_sgLayout2)):null};
    sgHov=h;sgDraw();
  }

  sgc.addEventListener('mousedown',e=>{
    e.stopPropagation();const p=sgGetPos(e),h=sgHitTest(p.x,p.y,false);sgStartDrag(p,h);
  });
  sgc.addEventListener('mousemove',e=>{
    e.stopPropagation();const p=sgGetPos(e);
    if(!sgDrag){const h=sgHitTest(p.x,p.y,false);if(h!==sgHov){sgHov=h;sgDraw();}return;}
    sgApplyDrag(p);
  });
  sgc.addEventListener('mouseup',e=>{
    if(sgDrag&&sgDrag.h==='su'){
      var ddx=e.clientX-(sgDrag._scx||0),ddy=e.clientY-(sgDrag._scy||0);
      if(Math.hypot(ddx,ddy)<5){_sgScaleMode=!_sgScaleMode;sgDrag=null;sgDraw();return;}
    }
    sgDrag=null;sgDraw();
  });
  sgc.addEventListener('mouseleave',()=>{if(!sgDrag){sgHov=null;sgDraw();}});
  sgc.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();const p=sgGetPos(e),h=sgHitTest(p.x,p.y,true);sgStartDrag(p,h);},{passive:false});
  sgc.addEventListener('touchmove',e=>{e.preventDefault();e.stopPropagation();if(sgDrag)sgApplyDrag(sgGetPos(e));},{passive:false});
  sgc.addEventListener('touchend',e=>{
    if(sgDrag&&sgDrag.h==='su'&&e.changedTouches.length){
      var t=e.changedTouches[0];
      var ddx=t.clientX-(sgDrag._scx||0),ddy=t.clientY-(sgDrag._scy||0);
      if(Math.hypot(ddx,ddy)<8){_sgScaleMode=!_sgScaleMode;sgDrag=null;sgHov=null;sgDraw();return;}
    }
    sgDrag=null;sgHov=null;sgDraw();
  });

  // Wire mode buttons (all, move, rotate, scale)
  ['all','move','rotate','scale'].forEach(m=>{
    const b=document.getElementById('sg-'+m);
    if(b)b.addEventListener('click',()=>{
      sgMode=m;
      ['all','move','rotate','scale'].forEach(id=>{const bb=document.getElementById('sg-'+id);if(bb)bb.classList.toggle('on',id===m);});
      const hints={all:'drag arcs / arrows / boxes to transform',move:'drag arrows to move',rotate:'drag arcs to rotate',scale:'drag boxes to scale'};
      document.getElementById('sgizmo-hint').textContent=hints[m]||'drag to transform';
      sgDraw();
    });
  });
  // Set initial state — 'all' is default
  (function(){
    ['all','move','rotate','scale'].forEach(id=>{const bb=document.getElementById('sg-'+id);if(bb)bb.classList.toggle('on',id==='all');});
    document.getElementById('sgizmo-hint').textContent='drag arcs / arrows / boxes to transform';
  })();

  document.getElementById('sg-dup').addEventListener('click',duplicateSelected);
  document.getElementById('sg-del').addEventListener('click',deleteSelected);
  document.getElementById('sg-addmode').addEventListener('click',function(){setSelAddMode(!_selAddMode);});
  document.getElementById('sg-close').addEventListener('click',()=>{clearSelection();setMode('draw');});

  sgDraw();window._sgGcDraw=sgDraw;
})();
