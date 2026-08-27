// ── State ────────────────────────────────────────────────────────
let mode='draw',flatBrush=false;
let prevDrawMode='draw'; // tracks last draw/erase/select mode for returning from nav modes
let curColor='#000000',brushSz=1,brushOp=.95;
let isDrawing=false,rawPts=[],smoothPts=[],velHistory=[],lazyPos=null;
const LAZY_ON=.18,LAZY_OFF=1.0;let smoothingOn=false,LAZY=LAZY_OFF;

// Layers
// Layers declared below in layer system section

// Strokes + undo/redo — state in core/history-manager.js, functions exposed as globals
const strokes=[];

function addStroke(s){scene.add(s.mesh);strokes.push(s);if(window.SketchbookEventBus)window.SketchbookEventBus.emit('strokeAdded',{index:strokes.length-1,count:strokes.length});redoStack.length=0;_redoStack.length=0;markDirty();}

// ── Preview line — pre-allocated geometry, updated in-place each point ──────
// Avoids creating new BufferGeometry + LineBasicMaterial on every touchmove.
// Buffer is sized for MAX_PREV_PTS; drawRange tells Three.js how many to draw.
var MAX_PREV_PTS=2048;
var _prevBuf=new Float32Array(MAX_PREV_PTS*3);
var _prevGeo=new THREE.BufferGeometry();
_prevGeo.setAttribute('position',new THREE.BufferAttribute(_prevBuf,3));
_prevGeo.setDrawRange(0,0);
var _prevMat=new THREE.LineBasicMaterial({color:0x1a1a2e,transparent:true,opacity:.75,linewidth:2});
var prevLine=new THREE.Line(_prevGeo,_prevMat);
prevLine.renderOrder=4;
prevLine.frustumCulled=false;
// Not added to scene until first draw; toggled via visible flag
prevLine.visible=false;
scene.add(prevLine);

function updPrev(pts){
  var n=Math.min(pts.length,MAX_PREV_PTS);
  if(n<2){prevLine.visible=false;markDirty();return;}
  // Sync material color/opacity to current brush
  _prevMat.color.set(curColor);
  _prevMat.opacity=brushOp*.75;
  // Write positions into pre-allocated buffer
  for(var i=0;i<n;i++){_prevBuf[i*3]=pts[i].x;_prevBuf[i*3+1]=pts[i].y;_prevBuf[i*3+2]=pts[i].z;}
  _prevGeo.attributes.position.needsUpdate=true;
  _prevGeo.setDrawRange(0,n);
  prevLine.visible=true;
  markDirty();
}

function finStroke(){
  prevLine.visible=false;_prevGeo.setDrawRange(0,0);
  var pts=(smoothPts.length>=2?smoothPts:rawPts).slice();
  rawPts=[];smoothPts=[];velHistory=[];lazyPos=null;
  if(pts.length<1)return;
  // Single-point tap: duplicate with micro-offset so buildTube can make a dot
  if(pts.length===1){var dp=pts[0].clone();dp.x+=0.002;pts.push(dp);}
  // Trim trailing points that reverse or hook at end of stroke.
  // Smooth mode: trim shallow hooks too (dot < 0.15) since lazy smoothing can
  // leave a lagging tail. Raw mode (v14.2): trim disabled entirely (-1.1) so
  // even full reversals survive — preserves the user's original line shape.
  var _trimThresh=smoothingOn?0.15:-1.1;
  if(pts.length>3){
    var _safety=0;
    while(pts.length>3&&_safety<12){
      _safety++;
      var _n=pts.length;
      var _d1=new THREE.Vector3().subVectors(pts[_n-2],pts[_n-3]).normalize();
      var _d2=new THREE.Vector3().subVectors(pts[_n-1],pts[_n-2]).normalize();
      if(_d1.dot(_d2)<_trimThresh){pts=pts.slice(0,_n-1);}
      else{break;}
    }
  }
  const vels=computeVels(pts);
  const g=new THREE.Group();
  const tube=buildTube(pts,vels,curColor,brushSz,brushOp,flatBrush);if(tube)g.add(tube);
  // Always add caps for non-flat strokes (start cap = rounded nib, end cap = rounded tail)
  if(!flatBrush){
    g.add(buildCap(pts[0],curColor,brushSz,brushOp));
    g.add(buildCap(pts[pts.length-1],curColor,brushSz,brushOp));
  }
  const s={pts,vels,color:curColor,sz:brushSz,op:brushOp,flat:flatBrush,layer:activeLayer,mesh:g,_depthKey:''};
  // Set renderOrder based on layer position in layerOrder (defined in layer-manager.js)
  if (typeof layerOrder !== 'undefined') {
    var orderIdx = layerOrder.indexOf(activeLayer);
    g.renderOrder = orderIdx + 3;
  } else {
    g.renderOrder = 3;
  }
  g.matrixAutoUpdate=false;g.updateMatrix();
  scene.add(g);strokes.push(s);
  if (window.SketchbookEventBus) window.SketchbookEventBus.emit('strokeAdded', { index: strokes.length - 1, count: strokes.length });
  // New stroke needs depth color assigned — mark it dirty so updateDepth picks it up next frame
  s._depthKey='';
  pushUndo({type:'stroke_add',stroke:s});
  markDirty();
}

// ── Eraser ───────────────────────────────────────────────────────
function tryErase(px,py){
  _refreshRect();
  var r=_cachedRect;
  const sx=px-r.left,sy=py-r.top,W=r.width,H=r.height,ac=activeCam();
  const THRESH=22,tmpV=new THREE.Vector3();
  var bestI=-1,bestDist=THRESH;
  for(let i=strokes.length-1;i>=0;i--){
    const s=strokes[i];
    s.mesh.updateMatrixWorld(false);
    var mw=s.mesh.matrixWorld;
    const step=Math.max(1,Math.floor(s.pts.length/60));
    var minDist=Infinity,nearMiss=false;
    // Coarse pass
    for(let j=0;j<s.pts.length;j+=step){
      tmpV.copy(s.pts[j]).applyMatrix4(mw);tmpV.project(ac);
      var d=Math.hypot((tmpV.x*.5+.5)*W-sx,(-tmpV.y*.5+.5)*H-sy);
      if(d<minDist)minDist=d;
      if(d<THRESH*2)nearMiss=true;
    }
    // Dense pass if coarse pass was close — scan the full point list to get true minimum
    if(nearMiss){
      for(let jj=0;jj<s.pts.length;jj++){
        tmpV.copy(s.pts[jj]).applyMatrix4(mw);tmpV.project(ac);
        var dd=Math.hypot((tmpV.x*.5+.5)*W-sx,(-tmpV.y*.5+.5)*H-sy);
        if(dd<minDist)minDist=dd;
      }
    }
    if(minDist<bestDist){bestDist=minDist;bestI=i;}
  }
  if(bestI>-1){
    const s=strokes[bestI];const i=bestI;
    if(s===_hoverStroke)setHoverStroke(null);
    pushUndo({type:'stroke_delete',stroke:s,index:i});
    strokes.splice(i,1);scene.remove(s.mesh);
    s.mesh.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});
    markDirty();return true;
  }
  return false;
}
