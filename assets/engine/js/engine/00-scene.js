// ================================================================
//  SKETCH3D v4.1
// ================================================================

// Block browser native pinch-to-zoom and Ctrl+scroll zoom — these scale
// the entire page including UI panels. We handle zoom ourselves on the canvas.
document.addEventListener('wheel', function(e){
  if(e.ctrlKey) e.preventDefault();
}, {passive: false});
// Block Safari/iOS pinch gesture events
document.addEventListener('gesturestart', function(e){ e.preventDefault(); }, {passive: false});
document.addEventListener('gesturechange', function(e){ e.preventDefault(); }, {passive: false});

const container=document.getElementById('cc');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xffffff);
scene.fog=new THREE.FogExp2(0xffffff,.012);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.01,2000);
let orthoZoom=8;
const ortho=new THREE.OrthographicCamera(-orthoZoom,orthoZoom,orthoZoom,-orthoZoom,.01,2000);
let useOrtho=false;
function activeCam(){return useOrtho?ortho:camera;}
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.setClearColor(0xffffff,1);
renderer.sortObjects=true;
container.appendChild(renderer.domElement);

// ── Render dirty flag — declare early so syncSurf/updCam/etc can call markDirty ──
let _renderDirty=true;
function markDirty(){_renderDirty=true;}
scene.add(new THREE.AmbientLight(0xffffff,.9));
const sun=new THREE.DirectionalLight(0xffffff,.5);sun.position.set(5,4,8);scene.add(sun);
const gridH=new THREE.GridHelper(20,20,0x000000,0x222222);gridH.rotation.x=Math.PI/2;scene.add(gridH);
const axisGroup=new THREE.Group();scene.add(axisGroup);
(function(){const L=8;[[new THREE.Vector3(L,0,0),'#e03040'],[new THREE.Vector3(0,L,0),'#22bb55'],[new THREE.Vector3(0,0,L),'#3377ee']].forEach(([tip,col])=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),tip]);axisGroup.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.55})));const g2=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),tip.clone().negate()]);axisGroup.add(new THREE.Line(g2,new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.18})));});})();
let axisLinesOn=true;

// ── Export Scale ─────────────────────────────────────────────────
// Scale steps cover small objects (mm scale) through large (urban scale)
// Index 0 = OFF (no cue, no scale applied), index 5 = 1:1 default
const SCALE_STEPS=[null,0.001,0.01,0.1,0.5,1,5,10,50,100];
const SCALE_LABELS=['OFF','1:0.001','1:0.01','1:0.1','1:0.5','1:1','1:5','1:10','1:50','1:100'];
let exportScaleIdx=0; // start OFF — user enables when needed
function exportScaleMult(){return SCALE_STEPS[exportScaleIdx]||1;}

// Scale cue — 3-arm cross at scene origin, hidden until user enables scale
let scaleBarGroup=new THREE.Group();scaleBarGroup.visible=false;scene.add(scaleBarGroup);

// Scale label — flat plane mesh lying on XZ grid, not a billboard sprite
let _sbCanvas=document.createElement('canvas');_sbCanvas.width=192;_sbCanvas.height=32;
let _sbCtx=_sbCanvas.getContext('2d');
let _sbTex=new THREE.CanvasTexture(_sbCanvas);
// PlaneGeometry rotated to lie flat on XZ (like the grid)
let _sbMesh=new THREE.Mesh(
  new THREE.PlaneGeometry(1.6,0.18),
  new THREE.MeshBasicMaterial({map:_sbTex,transparent:true,depthWrite:false,side:THREE.DoubleSide})
);
// Rotate to lie flat on XZ plane (PlaneGeometry faces Z by default; grid is XZ so rotate -90° on X)
_sbMesh.rotation.x=-Math.PI/2;
_sbMesh.renderOrder=3;_sbMesh.visible=false;
scene.add(_sbMesh);

function buildScaleBar(){
  while(scaleBarGroup.children.length){
    const c=scaleBarGroup.children[0];
    if(c.geometry)c.geometry.dispose();
    if(c.material)c.material.dispose();
    scaleBarGroup.remove(c);
  }
  if(SCALE_STEPS[exportScaleIdx]===null){
    scaleBarGroup.visible=false;_sbMesh.visible=false;markDirty();return;
  }
  scaleBarGroup.visible=true;
  const mat=new THREE.LineBasicMaterial({color:0x1a1a2e,transparent:true,opacity:.3,depthWrite:false});
  // Bar along X, 1 world-unit, flat on XZ grid plane
  scaleBarGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(1,0,0)]),mat));
  // End ticks perpendicular in Z
  const tk=0.06;
  scaleBarGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-tk),new THREE.Vector3(0,0,tk)]),mat));
  scaleBarGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1,0,-tk),new THREE.Vector3(1,0,tk)]),mat));
  scaleBarGroup.position.set(0,0,0);scaleBarGroup.renderOrder=3;
  markDirty();
}

function updateScaleBarLabel(){
  _sbCtx.clearRect(0,0,192,32);
  if(SCALE_STEPS[exportScaleIdx]===null){
    _sbMesh.visible=false;_sbTex.needsUpdate=true;markDirty();return;
  }
  _sbMesh.visible=true;
  _sbCtx.fillStyle=_uiInk(0.45);_sbCtx.font='11px monospace';
  _sbCtx.textAlign='left';_sbCtx.textBaseline='middle';
  _sbCtx.fillText(SCALE_LABELS[exportScaleIdx]+' · 1u='+exportScaleMult()+'m',4,16);
  _sbTex.needsUpdate=true;
  // Position flat on grid, just past the X arm tip — Y=0 is on the grid
  _sbMesh.position.set(1.9,0,0);
  markDirty();
}

// Don't call buildScaleBar/updateScaleBarLabel at init — starts OFF, nothing to show

// ── Surface ──────────────────────────────────────────────────────
const PNORMALS={xy:new THREE.Vector3(0,0,1),xz:new THREE.Vector3(0,1,0),yz:new THREE.Vector3(1,0,0)};
const SURF_TRACE=0x000000;
let curPlane='xz',surfType='plane';
const surfPos=new THREE.Vector3(),surfEuler=new THREE.Euler(0,0,0,'XYZ');
let surfScale=2.0;const surfScaleAxes=new THREE.Vector3(1,1,1);
const surfGroup=new THREE.Group();scene.add(surfGroup);
let surfMesh=null,surfFillMat=null,surfWireMat=null,isHovering=false;
let _frostedMat=null,_frostedMesh=null;
let _frostedGridMat=null,_frostedGridMesh=null;
// depthCuesOn declared early — buildSurf references it (TDZ safety)
let depthCuesOn=true;
// Surface overlay grid mode: 0=off, 1=grid lines, 2=dots
var _surfGridMode=2;
var _surfGridLabels=['OFF','GRD','DOT'];
var _depthOpSteps=[0.50,0.75,0.90];
var _depthOpLabels=['50%','75%','90%'];
var _depthOpIdx=0;
function buildSurfGridTex(){
  var sz=128;
  var cv=document.createElement('canvas');cv.width=sz;cv.height=sz;
  var ctx=cv.getContext('2d');
  ctx.clearRect(0,0,sz,sz);
  if(_surfGridMode===1){
    ctx.strokeStyle='rgba(0,0,0,0.7)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(sz,0);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,sz);ctx.stroke();
  } else if(_surfGridMode===2){
    ctx.fillStyle='rgba(0,0,0,0.85)';var r=3;
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(sz,0,r,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(0,sz,r,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(sz,sz,r,0,Math.PI*2);ctx.fill();
  }
  var tex=new THREE.CanvasTexture(cv);
  tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
  // Plane: 40 world units / 0.5 per tile = 80 repeats. Curved: fixed 6.
  var rep=surfType==='plane'?80:6;
  tex.repeat.set(rep,rep);
  return tex;
}
function applyFrostedGridTex(){
  if(!_frostedGridMat||!_frostedGridMesh)return;
  if(_surfGridMode===0){
    _frostedGridMesh.visible=false;
  } else {
    if(_frostedGridMat.map)_frostedGridMat.map.dispose();
    _frostedGridMat.map=buildSurfGridTex();
    _frostedGridMat.needsUpdate=true;
    _frostedGridMesh.visible=depthCuesOn;
  }
  markDirty();
}
function buildSurf(){
  while(surfGroup.children.length){const c=surfGroup.children[0];if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();surfGroup.remove(c);}
  surfMesh=null;_frostedMesh=null;_frostedMat=null;_frostedGridMesh=null;_frostedGridMat=null;
  const tint=SURF_TRACE;let geo;
  if(surfType==='plane')geo=new THREE.PlaneGeometry(10,10,8,8);
  else if(surfType==='cube')geo=new THREE.BoxGeometry(3,3,3,3,3,3);
  else if(surfType==='cylinder')geo=new THREE.CylinderGeometry(1.5,1.5,3,32);
  else if(surfType==='cone')geo=new THREE.ConeGeometry(1.5,3,32);
  else geo=new THREE.SphereGeometry(1.8,32,24);
  // Surface fill + wireframe (renderOrder 0/1) — always visible, never affected by depth toggle
  surfFillMat=new THREE.MeshStandardMaterial({color:tint,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false,roughness:.9});
  surfMesh=new THREE.Mesh(geo,surfFillMat);surfMesh.renderOrder=7;surfGroup.add(surfMesh);
  const wgeo=new THREE.EdgesGeometry(geo,15);
  surfWireMat=new THREE.LineBasicMaterial({color:tint,transparent:true,opacity:.55,depthWrite:false});
  const wire=new THREE.LineSegments(wgeo,surfWireMat);wire.renderOrder=8;surfGroup.add(wire);
  if(surfType==='plane'){const h=5,ep=[new THREE.Vector3(-h,-h,0),new THREE.Vector3(h,-h,0),new THREE.Vector3(h,-h,0),new THREE.Vector3(h,h,0),new THREE.Vector3(h,h,0),new THREE.Vector3(-h,h,0),new THREE.Vector3(-h,h,0),new THREE.Vector3(-h,-h,0)];const borderLine=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ep),new THREE.LineBasicMaterial({color:tint,transparent:true,opacity:1,depthWrite:false}));borderLine.renderOrder=8;surfGroup.add(borderLine);}
  // Frosted tint mesh (renderOrder 5): bg-colour semi-transparent plane, depthTest:true
  // Renders after strokes — depth buffer shows strokes in front as already drawn,
  // so frosted mesh tints only what is BEHIND the draw plane. depthWrite:false = no depth holes.
  var fgeo;
  if(surfType==='plane')fgeo=new THREE.PlaneGeometry(40,40);
  else if(surfType==='cube')fgeo=new THREE.BoxGeometry(3.02,3.02,3.02);
  else if(surfType==='cylinder')fgeo=new THREE.CylinderGeometry(1.52,1.52,3.04,48);
  else if(surfType==='cone')fgeo=new THREE.ConeGeometry(1.52,3.04,48);
  else fgeo=new THREE.SphereGeometry(1.82,48,32);
  var bgHex=scene.background?('#'+scene.background.getHexString()):'#ffffff';
  _frostedMat=new THREE.MeshBasicMaterial({
    color:new THREE.Color(bgHex),
    transparent:true,opacity:_depthOpSteps[_depthOpIdx],
    side:THREE.DoubleSide,depthWrite:false,depthTest:true,
    polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1
  });
  _frostedMesh=new THREE.Mesh(fgeo,_frostedMat);
  _frostedMesh.renderOrder=5;
  _frostedMesh.visible=depthCuesOn;
  surfGroup.add(_frostedMesh);
  // Grid/dot overlay mesh (renderOrder 6): texture only, always full alpha, never fades with opacity
  var fgeo2;
  if(surfType==='plane')fgeo2=new THREE.PlaneGeometry(40,40);
  else if(surfType==='cube')fgeo2=new THREE.BoxGeometry(3.02,3.02,3.02);
  else if(surfType==='cylinder')fgeo2=new THREE.CylinderGeometry(1.52,1.52,3.04,48);
  else if(surfType==='cone')fgeo2=new THREE.ConeGeometry(1.52,3.04,48);
  else fgeo2=new THREE.SphereGeometry(1.82,48,32);
  _frostedGridMat=new THREE.MeshBasicMaterial({
    color:0xffffff,transparent:true,
    side:THREE.DoubleSide,depthWrite:false,depthTest:true
  });
  if(_surfGridMode>0){_frostedGridMat.map=buildSurfGridTex();}
  _frostedGridMesh=new THREE.Mesh(fgeo2,_frostedGridMat);
  _frostedGridMesh.renderOrder=6;
  _frostedGridMesh.visible=depthCuesOn&&_surfGridMode>0;
  surfGroup.add(_frostedGridMesh);
  syncSurf();
}
function syncSurf(){
  const bq=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),PNORMALS[curPlane]);
  surfGroup.quaternion.copy(new THREE.Quaternion().setFromEuler(surfEuler).multiply(bq));
  surfGroup.position.copy(surfPos);
  surfGroup.scale.set(surfScale*surfScaleAxes.x,surfScale*surfScaleAxes.y,surfScale*surfScaleAxes.z);
  // Scale-compensate grid texture on plane only — keeps 0.5-unit spacing constant
  if(surfType==='plane'&&_frostedGridMat&&_frostedGridMat.map){
    var sx=surfScale*surfScaleAxes.x||1;
    var sy=surfScale*surfScaleAxes.y||1;
    _frostedGridMat.map.repeat.set(80*sx,80*sy);
    _frostedGridMat.map.needsUpdate=true;
  }
  markDirty();
  if(window._gDraw)window._gDraw();
  if(window._syncLocalGizmo)window._syncLocalGizmo();
}
function setSurfHover(on){if(!surfFillMat||!surfWireMat||on===isHovering)return;isHovering=on;surfFillMat.opacity=on?.38:.16;surfWireMat.opacity=on?.5:.28;}
buildSurf();
