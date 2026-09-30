const cam={theta:-Math.PI/2,phi:Math.PI/2,radius:10,target:new THREE.Vector3(),active:false,panActive:false,sx:0,sy:0,st:0,sp:0,panAnchor:null,panTargetAtStart:new THREE.Vector3()};
function syncOrtho(){var _vvp=window.visualViewport;var a=(_vvp?_vvp.width:innerWidth)/(_vvp?_vvp.height:innerHeight);ortho.left=-orthoZoom*a;ortho.right=orthoZoom*a;ortho.top=orthoZoom;ortho.bottom=-orthoZoom;ortho.updateProjectionMatrix();}
// FPS mode state — declared here (var hoisted) so updCam can reference
var _fpsMode=false;
var _fpsSavedCam=null; // {theta,phi,radius,tx,ty,tz} saved on enter
var _fpsPlaneGroup=null;    // Group: fill+frosted+grid for follow-plane
var _fpsPlaneFill=null;     // fill mesh
var _fpsFrosted=null;       // frosted depth-cue mesh
var _fpsFrostedGrid=null;   // grid mesh
var _fpsSurfMode=0;         // 0=NONE  1=FOLLOW  2=SCENE
var _fpsPlaneDist=5;        // distance from eye to follow-plane
var _fpsPlaneSz=6;          // follow-plane size (world units)

function updCam(){
  if(_fpsMode){
    // FPS: camera IS at target, look along theta/phi forward vector
    var sinP=Math.sin(cam.phi),cosP=Math.cos(cam.phi);
    var sinT=Math.sin(cam.theta),cosT=Math.cos(cam.theta);
    var fx=sinP*cosT,fy=sinP*sinT,fz=cosP;
    camera.position.copy(cam.target);
    camera.up.set(0,0,1);
    camera.lookAt(cam.target.x+fx,cam.target.y+fy,cam.target.z+fz);
    ortho.position.copy(cam.target);
    ortho.up.set(0,0,1);
    ortho.lookAt(cam.target.x+fx,cam.target.y+fy,cam.target.z+fz);
    syncOrtho();
    // Reposition follow-plane group: center at eye + forward * dist, facing camera
    if(_fpsPlaneGroup){
      _fpsPlaneGroup.position.set(
        cam.target.x+fx*_fpsPlaneDist,
        cam.target.y+fy*_fpsPlaneDist,
        cam.target.z+fz*_fpsPlaneDist
      );
      _fpsPlaneGroup.quaternion.copy(camera.quaternion);
    }
  } else {
    var theta=cam.theta,phi=cam.phi,radius=cam.radius,target=cam.target;
    var p=new THREE.Vector3(target.x+radius*Math.sin(phi)*Math.cos(theta),target.y+radius*Math.sin(phi)*Math.sin(theta),target.z+radius*Math.cos(phi));
    camera.position.copy(p);camera.up.set(0,0,1);camera.lookAt(target);
    ortho.position.copy(p);ortho.up.set(0,0,1);ortho.lookAt(target);syncOrtho();
  }
  markDirty();
  if(window._gDraw)window._gDraw();if(window._ncDraw)window._ncDraw();
  if(window._pbNcDraw)window._pbNcDraw();if(window._pbGcDraw)window._pbGcDraw();
  if(window._sgGcDraw)window._sgGcDraw();
}
updCam();

// ── Renderer rect cache — getBoundingClientRect is a forced layout; cache it ──
var _cachedRect={left:0,top:0,width:innerWidth,height:innerHeight};
function _refreshRect(){_cachedRect=renderer.domElement.getBoundingClientRect();}
_refreshRect();
// Keep rect fresh on resize / orientation change
window.addEventListener('resize',function(){
  _syncRenderer();
  if(typeof updateLayoutMode==='function')updateLayoutMode();
});
// visualViewport fires in PWA standalone when window.resize doesn't (e.g. Android system bar settle)
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',function(){
    _syncRenderer();
    if(typeof updateLayoutMode==='function')updateLayoutMode();
  });
}

// ── Raycasting ───────────────────────────────────────────────────
const drawRC=new THREE.Raycaster();
function s2w(px,py){
  var r=_cachedRect;
  var ndcX=((px-r.left)/r.width)*2-1, ndcY=-((py-r.top)/r.height)*2+1;
  var ndc=new THREE.Vector2(ndcX,ndcY);
  if(_fpsMode&&_fpsSurfMode===1&&_fpsPlaneFill){
    drawRC.setFromCamera(ndc,activeCam());
    _fpsPlaneFill.material.side=THREE.DoubleSide;
    var fhits=drawRC.intersectObject(_fpsPlaneFill,false);
    return fhits.length?fhits[0].point.clone():null;
  }
  if(!surfMesh)return null;
  if(surfType==='none')return null;
  if(surfType==='loft'&&!window._loftGeo)return null;
  drawRC.setFromCamera(ndc,activeCam());
  var prev=surfMesh.material.side;surfMesh.material.side=THREE.DoubleSide;
  var shits=drawRC.intersectObject(surfMesh,false);surfMesh.material.side=prev;
  return shits.length?shits[0].point.clone():null;
}
const hoverRC=new THREE.Raycaster();
function checkHover(px,py){
  var r=_cachedRect;
  var ndcX=((px-r.left)/r.width)*2-1, ndcY=-((py-r.top)/r.height)*2+1;
  var ndc=new THREE.Vector2(ndcX,ndcY);
  if(_fpsMode&&_fpsSurfMode===1&&_fpsPlaneFill){
    hoverRC.setFromCamera(ndc,activeCam());
    _fpsPlaneFill.material.side=THREE.DoubleSide;
    var fhits=hoverRC.intersectObject(_fpsPlaneFill,false);
    return fhits.length>0;
  }
  if(!surfMesh)return false;
  if(surfType==='none')return false;
  if(surfType==='loft'&&!window._loftGeo)return false;
  hoverRC.setFromCamera(ndc,activeCam());
  var prev=surfMesh.material.side;surfMesh.material.side=THREE.DoubleSide;
  var shits=hoverRC.intersectObject(surfMesh,false);surfMesh.material.side=prev;
  return shits.length>0;
}

// ── Depth system — frosted glass (v5.6) ──────────────────────────
// Depth cue is now the _frostedMesh in surfGroup. No per-vertex recoloring.
const BG_COL=new THREE.Color(0xf7f5f9);
function getDrawPlane(){const n=new THREE.Vector3(0,0,1).applyQuaternion(surfGroup.quaternion);return{n,d:n.dot(surfPos)};}
function signedDist(pt,plane){return plane.n.dot(pt)-plane.d;}
// Stubs kept for undo/redo references
var _lastPlaneKey='';
function updateDepth(){}
function resetDepthColors(){}

// ── Material cache ────────────────────────────────────────────────
const _matCache=new Map();
function getStrokeMat(color,op,flat){
  const key=color+'|'+op.toFixed(3)+'|'+(flat?'1':'0');
  if(_matCache.has(key))return _matCache.get(key);
  const col=new THREE.Color(color);
  const mat=new THREE.MeshBasicMaterial({
    color:col,transparent:op<1,opacity:op,
    side:THREE.DoubleSide
  });
  _matCache.set(key,mat);
  return mat;
}
function getStrokeMatForMesh(color,op,flat){return getStrokeMat(color,op,flat);}
function rebuildStrokeMaterials(){markDirty();}

// ── Stroke physics ───────────────────────────────────────────────
function computeVels(pts){
  var v=[0];
  for(var i=1;i<pts.length;i++)v.push(pts[i].distanceTo(pts[i-1]));
  // 7-point gaussian-weighted smoothing kernel [1,4,8,12,8,4,1]/38
  var s=v.slice();
  var weights=[1,4,8,12,8,4,1],half=3;
  for(var i=0;i<s.length;i++){
    var sum=0,wUsed=0;
    for(var j=-half;j<=half;j++){
      var idx=i+j;
      if(idx>=0&&idx<v.length){sum+=v[idx]*weights[j+half];wUsed+=weights[j+half];}
    }
    s[i]=sum/wUsed;
  }
  // Clamp velocity on last 3 points to avoid whipping artifact on pen lift
  var tail=Math.min(3,s.length-1);
  if(s.length>2){
    var refV=s[s.length-1-tail]||s[0];
    for(var j=s.length-tail;j<s.length;j++)s[j]=Math.min(s[j],refV*1.5);
  }
  // Also clamp first 3 points to avoid start whip
  var head=Math.min(3,s.length-1);
  if(s.length>2){
    var refVH=s[head]||s[s.length-1];
    for(var k=0;k<head;k++)s[k]=Math.min(s[k],refVH*1.5);
  }
  return s;
}

// velocityTaper: when false, uniform radius (no speed-based taper)
let velocityTaper=true;

function buildTube(pts,vels,color,sz,op,flat){
  if(pts.length<2)return null;
  const f=[pts[0]],fv=[vels[0]];
  for(let i=1;i<pts.length;i++){if(f[f.length-1].distanceTo(pts[i])>.003){f.push(pts[i]);fv.push(vels[i]);}}
  if(f.length<2)return null;
  var maxV=0,minV=Infinity;for(var _vi=0;_vi<fv.length;_vi++){if(fv[_vi]>maxV)maxV=fv[_vi];if(fv[_vi]<minV)minV=fv[_vi];}
  if(maxV===0)maxV=1;const range=maxV-minV||1;
  const N=f.length,baseR=sz*.011;
  const mat=getStrokeMatForMesh(color,op,flat);
  if(flat){
    const curve=new THREE.CatmullRomCurve3(f),segs=Math.max(N*3,12);
    // Fallback normal: group orientation (correct for planes, used when ray misses)
    const groupNorm=new THREE.Vector3(0,0,1).applyQuaternion(surfGroup.quaternion);
    // Raycaster for sampling local surface normal per segment point
    const _flatRC=new THREE.Raycaster();
    const _flatRCOrigin=new THREE.Vector3();
    const pos=[],norms=[],idx=[];
    for(let i=0;i<=segs;i++){
      const t=i/segs;
      const vIdx=Math.min(Math.floor(t*(N-1)),N-1);
      const vn=velocityTaper?(fv[vIdx]-minV)/range*0.75:0;
      const velZone=t<.08?t/.08:t>.92?(1-t)/.08:1;
      const vw=1-vn*velZone*.65,w=baseR*4*vw,h=baseR*.5;
      const pt=curve.getPoint(t),tang=curve.getTangent(t).normalize();
      // Sample local normal: cast ray from slightly above pt along inverted group normal
      let up=groupNorm.clone();
      if(surfMesh&&surfMesh.geometry){
        _flatRCOrigin.copy(pt).addScaledVector(groupNorm,0.1);
        _flatRC.set(_flatRCOrigin,groupNorm.clone().negate());
        _flatRC.near=0;_flatRC.far=0.5;
        const prevSide=surfMesh.material.side;
        surfMesh.material.side=THREE.DoubleSide;
        const hits=_flatRC.intersectObject(surfMesh,false);
        surfMesh.material.side=prevSide;
        if(hits.length>0&&hits[0].face){
          // Transform face normal from mesh local space to world space
          const fn=hits[0].face.normal.clone()
            .applyQuaternion(surfGroup.quaternion).normalize();
          // Ensure normal points same way as group normal (not inward)
          if(fn.dot(groupNorm)<0)fn.negate();
          up=fn;
        }
      }
      let side=new THREE.Vector3().crossVectors(tang,up).normalize();
      if(side.lengthSq()<.001){
        // tang parallel to up — pick an arbitrary perpendicular
        side.set(1,0,0);
        if(Math.abs(up.x)>.9)side.set(0,1,0);
        side.crossVectors(side,up).normalize();
      }
      pos.push(pt.x+side.x*w+up.x*h,pt.y+side.y*w+up.y*h,pt.z+side.z*w+up.z*h,pt.x-side.x*w+up.x*h,pt.y-side.y*w+up.y*h,pt.z-side.z*w+up.z*h,pt.x+side.x*w-up.x*h,pt.y+side.y*w-up.y*h,pt.z+side.z*w-up.z*h,pt.x-side.x*w-up.x*h,pt.y-side.y*w-up.y*h,pt.z-side.z*w-up.z*h);
      const un=up.toArray(),dn=up.clone().negate().toArray();norms.push(...un,...un,...dn,...dn);
    }
    for(let i=0;i<segs;i++){const b=i*4;idx.push(b,b+4,b+1,b+1,b+4,b+5,b+2,b+3,b+6,b+3,b+7,b+6,b,b+2,b+4,b+2,b+6,b+4,b+1,b+5,b+3,b+3,b+5,b+7);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(norms,3));geo.setIndex(idx);geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,mat);m.renderOrder=3;m.userData.radSeg=4;return m;
  }
  try{
    const curve=new THREE.CatmullRomCurve3(f),segs=Math.max(N*3,12),radSeg=Math.min(8,Math.max(5,segs>>2));
    const geo=new THREE.TubeGeometry(curve,segs,baseR,radSeg,false);
    const pa=geo.attributes.position,rc2=segs+1;
    for(let ring=0;ring<rc2;ring++){
      const t=ring/(rc2-1);
      const vIdx=Math.min(Math.floor(t*(N-1)),N-1);
      // Velocity min floor: scale vn by 0.75 so fastest sections thin to ~55% base radius
      const vn=velocityTaper?(fv[vIdx]-minV)/range*0.75:0;
      // Velocity influence fades to 0 in cap zones (first/last 12%) so caps always match full weight
      const velZone=t<.12?t/.12:t>.88?(1-t)/.12:1;
      const sc=1-vn*velZone*.6;
      // Scale from actual ring centroid (not re-sampled curve point) to avoid lateral geometry shift
      const rs=ring*radSeg;
      let cx=0,cy=0,cz=0,cnt=0;
      for(let s=0;s<radSeg;s++){const vi=rs+s;if(vi>=pa.count)break;cx+=pa.getX(vi);cy+=pa.getY(vi);cz+=pa.getZ(vi);cnt++;}
      if(cnt>0){cx/=cnt;cy/=cnt;cz/=cnt;}
      for(let s=0;s<radSeg;s++){const vi=rs+s;if(vi>=pa.count)break;pa.setXYZ(vi,cx+(pa.getX(vi)-cx)*sc,cy+(pa.getY(vi)-cy)*sc,cz+(pa.getZ(vi)-cz)*sc);}
    }
    pa.needsUpdate=true;geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,mat);m.renderOrder=3;m.userData.radSeg=radSeg;return m;
  }catch(e){return null;}
}

// ── End cap: sphere at start & end, matching full stroke radius ──
function buildCap(pt,color,sz,op){
  const r=sz*.011;
  const mat=getStrokeMatForMesh(color,op,false);
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,8,6),mat);
  m.position.copy(pt);m.renderOrder=3;return m;
}
