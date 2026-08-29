// ── SelectionManager — selection, hover, delete, duplicate ──────
// Owns: selectedStrokes, selHighlights, hover, delete, duplicate
// Dependencies (global): strokes, scene, markDirty, mode, activeCam,
//   _cachedRect, _refreshRect, pushUndo, toast, computeVels, buildTube,
//   buildCap, document.getElementById

var selectedStrokes = [], selHighlights = [];
var _hoverStroke = null, _hoverHighlight = null;

var _matSelLine = new THREE.LineBasicMaterial({ color: 0xf5c842, transparent: true, opacity: .9, depthTest: false, depthWrite: false });
var _matHoverBlue = new THREE.LineBasicMaterial({ color: 0x3a9eff, transparent: true, opacity: .85, depthTest: false, depthWrite: false });
var _matHoverGreen = new THREE.LineBasicMaterial({ color: 0x22dd66, transparent: true, opacity: .85, depthTest: false, depthWrite: false });

function _strokeOverlay(s, mat) {
  s.mesh.updateMatrixWorld(true);
  var grp = new THREE.Group();
  grp.frustumCulled = false;
  s.mesh.traverse(function (c) {
    if (!c.isMesh || !c.geometry) return;
    var geo = c.geometry.clone();
    var worldMat = new THREE.Matrix4();
    worldMat.multiplyMatrices(s.mesh.matrixWorld, c.matrix);
    geo.applyMatrix4(worldMat);
    var m = new THREE.Mesh(geo, mat);
    m.renderOrder = 9; m.frustumCulled = false;
    grp.add(m);
  });
  return grp;
}

function _disposeObj(obj) {
  if (!obj) return;
  obj.traverse(function (c) { if (c.geometry) c.geometry.dispose(); });
  scene.remove(obj);
}

function updateSelHighlights() {
  selHighlights.forEach(_disposeObj);
  selHighlights = [];
  var mat = new THREE.MeshBasicMaterial({ color: 0xf5c842, transparent: true, opacity: .75, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  selectedStrokes.forEach(function (s) {
    var grp = _strokeOverlay(s, mat);
    grp.renderOrder = 8;
    scene.add(grp); selHighlights.push(grp);
  });
  var pending = _hoverStroke;
  _hoverStroke = null;
  _updateHoverLine(pending);
  applySelectionTint();
  markDirty();
}

function _updateHoverLine(s) {
  _disposeObj(_hoverHighlight);
  _hoverHighlight = null;
  _hoverStroke = s || null;
  if (!s) { markDirty(); return; }
  var col;
  if (mode === 'erase') {
    col = 0xff2233;
  } else {
    var isSelected = selectedStrokes.indexOf(s) > -1;
    col = isSelected ? 0x22dd66 : 0x3a9eff;
  }
  var mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .82, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  var grp = _strokeOverlay(s, mat);
  grp.renderOrder = 9;
  scene.add(grp); _hoverHighlight = grp;
  markDirty();
}

function setHoverStroke(s) {
  var isSel = s && selectedStrokes.indexOf(s) > -1;
  var isErase = mode === 'erase';
  if (s === _hoverStroke && _hoverHighlight) {
    var curCol = _hoverHighlight.children && _hoverHighlight.children[0] &&
      _hoverHighlight.children[0].material &&
      _hoverHighlight.children[0].material.color.getHex();
    var wantColor = isErase ? 0xff2233 : (isSel ? 0x22dd66 : 0x3a9eff);
    if (curCol === wantColor) return;
  } else if (s === _hoverStroke && !_hoverHighlight && !s) {
    return;
  }
  _updateHoverLine(s);
}

function findNearestStroke(px, py) {
  _refreshRect();
  var r = _cachedRect;
  var sx = px - r.left, sy = py - r.top, W = r.width, H = r.height, ac = activeCam();
  var THRESH = 32, tmpV = new THREE.Vector3();
  var bestStroke = null, bestDist = THRESH;
  for (var i = strokes.length - 1; i >= 0; i--) {
    var s = strokes[i];
    s.mesh.updateMatrixWorld(false);
    var mw = s.mesh.matrixWorld;
    var step = Math.max(1, Math.floor(s.pts.length / 60));
    var minDist = Infinity, nearMiss = false;
    for (var j = 0; j < s.pts.length; j += step) {
      tmpV.copy(s.pts[j]).applyMatrix4(mw); tmpV.project(ac);
      var d = Math.hypot((tmpV.x * .5 + .5) * W - sx, (-tmpV.y * .5 + .5) * H - sy);
      if (d < minDist) minDist = d;
      if (d < THRESH) { nearMiss = false; break; }
      if (d < THRESH * 2) nearMiss = true;
    }
    if (nearMiss) {
      for (var jj = 0; jj < s.pts.length; jj++) {
        tmpV.copy(s.pts[jj]).applyMatrix4(mw); tmpV.project(ac);
        var dd = Math.hypot((tmpV.x * .5 + .5) * W - sx, (-tmpV.y * .5 + .5) * H - sy);
        if (dd < minDist) minDist = dd;
      }
    }
    if (minDist < bestDist) { bestDist = minDist; bestStroke = s; }
  }
  return bestStroke;
}

var SEL_EMISSIVE = new THREE.Color(0xf5c842);
var SEL_EMISSIVE_INT = 0.35;
function applySelectionTint() {
  strokes.forEach(function (s) {
    var isSel = selectedStrokes.indexOf(s) > -1;
    s.mesh.traverse(function (c) {
      if (!c.isMesh || !c.material || !c.material.emissive) return;
      c.material.emissive = isSel ? SEL_EMISSIVE.clone() : new THREE.Color(0x000000);
      c.material.emissiveIntensity = isSel ? SEL_EMISSIVE_INT : 0;
      c.material.needsUpdate = true;
    });
  });
  markDirty();
}

function clearSelection() {
  selectedStrokes = [];
  selHighlights.forEach(_disposeObj); selHighlights = [];
  _updateHoverLine(null);
  applySelectionTint();
  document.getElementById('sgizmo').classList.remove('vis');
  if (window._sgGcDraw) window._sgGcDraw();
  markDirty();
  if (window.SketchbookEventBus) window.SketchbookEventBus.emit('selectionChanged', { count: 0 });
}

function selectStroke(px, py, addToSelection) {
  if (!addToSelection) clearSelection();
  _refreshRect();
  var r = _cachedRect;
  var sx = px - r.left, sy = py - r.top, W = r.width, H = r.height, ac = activeCam();
  var THRESH = 32, tmpV = new THREE.Vector3();
  var bestStroke = null, bestDist = THRESH;
  for (var i = strokes.length - 1; i >= 0; i--) {
    var s = strokes[i];
    s.mesh.updateMatrixWorld(false);
    var mw = s.mesh.matrixWorld;
    var step = Math.max(1, Math.floor(s.pts.length / 60));
    var minDist = Infinity, nearMiss = false;
    for (var j = 0; j < s.pts.length; j += step) {
      tmpV.copy(s.pts[j]).applyMatrix4(mw); tmpV.project(ac);
      var d = Math.hypot((tmpV.x * .5 + .5) * W - sx, (-tmpV.y * .5 + .5) * H - sy);
      if (d < minDist) minDist = d;
      if (d < THRESH) { nearMiss = false; break; }
      if (d < THRESH * 2) nearMiss = true;
    }
    if (nearMiss) {
      for (var jj = 0; jj < s.pts.length; jj++) {
        tmpV.copy(s.pts[jj]).applyMatrix4(mw); tmpV.project(ac);
        var dd = Math.hypot((tmpV.x * .5 + .5) * W - sx, (-tmpV.y * .5 + .5) * H - sy);
        if (dd < minDist) minDist = dd;
      }
    }
    if (minDist < bestDist) { bestDist = minDist; bestStroke = s; }
  }
  if (bestStroke) {
    var idx = selectedStrokes.indexOf(bestStroke);
    if (idx > -1) selectedStrokes.splice(idx, 1);
    else selectedStrokes.push(bestStroke);
    updateSelHighlights();
    if (selectedStrokes.length > 0) {
      positionStrokeGizmo();
      document.getElementById('sgizmo').classList.add('vis');
      if (window._sgGcDraw) window._sgGcDraw();
    } else {
      document.getElementById('sgizmo').classList.remove('vis');
    }
    if (window.SketchbookEventBus) window.SketchbookEventBus.emit('selectionChanged', { count: selectedStrokes.length });
    return true;
  }
  if (!addToSelection) document.getElementById('sgizmo').classList.remove('vis');
  return false;
}

var _sgizmoDragged = false;
function positionStrokeGizmo() {
  var sg = document.getElementById('sgizmo');
  if (!_sgizmoDragged) {
    sg.style.left = '10px'; sg.style.top = '52px';
  }
  sg.style.maxHeight = 'calc(100dvh - 120px)';
}

// Sgizmo drag IIFE
(function () {
  var sg = document.getElementById('sgizmo');
  var handle = document.getElementById('sgizmo-handle');
  if (!sg || !handle) return;
  var dragState = null;
  function onStart(e) {
    e.preventDefault(); e.stopPropagation();
    var src = e.touches ? e.touches[0] : e;
    var r = sg.getBoundingClientRect();
    dragState = { ox: src.clientX - r.left, oy: src.clientY - r.top };
  }
  function onMove(e) {
    if (!dragState) return;
    e.preventDefault();
    var src = e.touches ? e.touches[0] : e;
    var nx = src.clientX - dragState.ox;
    var ny = src.clientY - dragState.oy;
    var sw = sg.offsetWidth, sh = sg.offsetHeight;
    nx = Math.max(0, Math.min(window.innerWidth - sw, nx));
    ny = Math.max(0, Math.min(window.innerHeight - sh, ny));
    sg.style.left = nx + 'px'; sg.style.top = ny + 'px';
    _sgizmoDragged = true;
  }
  function onEnd() { dragState = null; }
  handle.addEventListener('touchstart', onStart, { passive: false });
  handle.addEventListener('touchmove', onMove, { passive: false });
  handle.addEventListener('touchend', onEnd);
  handle.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', function (e) { if (dragState) onMove(e); });
  document.addEventListener('mouseup', onEnd);
})();

var _selAddMode = true;
function setSelAddMode(on) {
  _selAddMode = on;
  var btn = document.getElementById('sg-addmode');
  if (btn) btn.classList.toggle('on', on);
}

function deleteSelected() {
  if (!selectedStrokes.length) return;
  var count = selectedStrokes.length;
  selectedStrokes.slice().forEach(function (s) {
    var i = strokes.indexOf(s);
    if (i > -1) {
      pushUndo({ type: 'stroke_delete', stroke: s, index: i });
      strokes.splice(i, 1);
      scene.remove(s.mesh);
      s.mesh.traverse(function (c) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    }
  });
  clearSelection();
  if (window.SketchbookEventBus) window.SketchbookEventBus.emit('strokeRemoved', { count: count });
  toast('Deleted ' + count + ' stroke' + (count > 1 ? 's' : ''));
}

function duplicateSelected() {
  if (!selectedStrokes.length) return;
  var duped = [];
  selectedStrokes.forEach(function (s) {
    var newG = new THREE.Group();
    var newPts = s.pts.map(function (p) { return p.clone(); });
    var vels = computeVels(newPts);
    var tube = buildTube(newPts, vels, s.color, s.sz, s.op, s.flat); if (tube) newG.add(tube);
    if (!s.flat) {
      newG.add(buildCap(newPts[0], s.color, s.sz, s.op));
      newG.add(buildCap(newPts[newPts.length - 1], s.color, s.sz, s.op));
    }
    newG.matrix.copy(s.mesh.matrix);
    newG.matrix.decompose(newG.position, newG.quaternion, newG.scale);
    newG.matrixAutoUpdate = false;
    var ns = { pts: newPts, vels: vels, color: s.color, sz: s.sz, op: s.op, flat: s.flat, layer: s.layer, mesh: newG, _depthKey: '' };
    scene.add(newG); strokes.push(ns);
    pushUndo({ type: 'stroke_duplicate', newStroke: ns });
    duped.push(ns);
  });
  clearSelection();
  selectedStrokes = duped;
  updateSelHighlights();
  if (selectedStrokes.length > 0) { positionStrokeGizmo(); document.getElementById('sgizmo').classList.add('vis'); }
  if (window._sgGcDraw) window._sgGcDraw();
  if (window.SketchbookEventBus) window.SketchbookEventBus.emit('strokeAdded', { count: duped.length });
  if (window.SketchbookEventBus) window.SketchbookEventBus.emit('selectionChanged', { count: selectedStrokes.length });
  toast('Duplicated');
}
