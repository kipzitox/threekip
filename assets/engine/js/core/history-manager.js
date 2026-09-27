// ── HistoryManager — undo/redo stacks + action dispatch ─────────
// Owns: _undoStack, _redoStack, pushUndo, undo, redo, clearAll
// Dependencies (global): strokes, scene, markDirty, clearSelection,
//   updateSelHighlights, showMergeLayerRow, applyLayerVisibility,
//   _lastPlaneKey, redoStack (legacy compat)

var _undoStack = [];
var _redoStack = [];
var redoStack = []; // legacy compat — cleared in clearAll

function pushUndo(action) {
  _redoStack.length = 0;
  redoStack.length = 0;
  _undoStack.push(action);
}

function undo() {
  if (_undoStack.length) {
    var a = _undoStack.pop();
    if (a.type === 'stroke_add') {
      var i = strokes.indexOf(a.stroke);
      if (i > -1) { strokes.splice(i, 1); scene.remove(a.stroke.mesh); }
      _redoStack.push(a);
      clearSelection();
      _lastPlaneKey = '';
      markDirty();
      return;
    }
    if (a.type === 'stroke_delete') {
      scene.add(a.stroke.mesh);
      strokes.splice(a.index, 0, a.stroke);
      _redoStack.push(a);
      _lastPlaneKey = '';
      markDirty();
      return;
    }
    if (a.type === 'stroke_transform') {
      var redo_a = { type: 'stroke_transform', stroke: a.stroke, oldMatrix: a.stroke.mesh.matrix.clone() };
      a.stroke.mesh.matrix.copy(a.oldMatrix);
      a.stroke.mesh.matrix.decompose(a.stroke.mesh.position, a.stroke.mesh.quaternion, a.stroke.mesh.scale);
      _redoStack.push(redo_a);
      markDirty();
      updateSelHighlights();
      if (window._sgGcDraw) window._sgGcDraw();
      return;
    }
    if (a.type === 'stroke_transform_multi') {
      var redo_a2 = { type: 'stroke_transform_multi', strokes: a.strokes, oldMatrices: a.strokes.map(function (s) { return s.mesh.matrix.clone(); }) };
      a.strokes.forEach(function (s, i) {
        s.mesh.matrix.copy(a.oldMatrices[i]);
        s.mesh.matrix.decompose(s.mesh.position, s.mesh.quaternion, s.mesh.scale);
      });
      _redoStack.push(redo_a2);
      markDirty();
      updateSelHighlights();
      if (window._sgGcDraw) window._sgGcDraw();
      return;
    }
    if (a.type === 'stroke_duplicate') {
      var di = strokes.indexOf(a.newStroke);
      if (di > -1) { strokes.splice(di, 1); scene.remove(a.newStroke.mesh); }
      _redoStack.push(a);
      clearSelection();
      markDirty();
      return;
    }
    if (a.type === 'merge_layer') {
      var mi = strokes.indexOf(a.mergedStroke);
      if (mi > -1) { strokes.splice(mi, 1); }
      scene.remove(a.mergedStroke.mesh);
      a.replacedMerged.forEach(function (s) { scene.add(s.mesh); strokes.push(s); });
      var sorted = a.origStrokes.slice().map(function (s, ii) { return { s: s, idx: a.savedOrigIndices[ii] }; });
      sorted.sort(function (x, y) { return x.idx - y.idx; });
      sorted.forEach(function (item) { scene.add(item.s.mesh); strokes.splice(item.idx, 0, item.s); });
      _redoStack.push(a);
      showMergeLayerRow(strokes.some(function (s) { return s.layer === 3; }));
      applyLayerVisibility();
      markDirty();
      return;
    }
  }
  if (window.SketchbookEventBus) {
    window.SketchbookEventBus.emit('historyChanged', {
      canUndo: _undoStack.length > 0,
      canRedo: _redoStack.length > 0,
    });
  }
}

function redo() {
  if (_redoStack.length) {
    var a = _redoStack.pop();
    if (a.type === 'stroke_add') {
      scene.add(a.stroke.mesh);
      strokes.push(a.stroke);
      _undoStack.push(a);
      _lastPlaneKey = '';
      markDirty();
      return;
    }
    if (a.type === 'stroke_delete') {
      var ri = strokes.indexOf(a.stroke);
      if (ri > -1) { strokes.splice(ri, 1); scene.remove(a.stroke.mesh); } else { scene.remove(a.stroke.mesh); }
      _undoStack.push(a);
      _lastPlaneKey = '';
      markDirty();
      return;
    }
    if (a.type === 'stroke_transform') {
      var undo_a = { type: 'stroke_transform', stroke: a.stroke, oldMatrix: a.stroke.mesh.matrix.clone() };
      a.stroke.mesh.matrix.copy(a.oldMatrix);
      a.stroke.mesh.matrix.decompose(a.stroke.mesh.position, a.stroke.mesh.quaternion, a.stroke.mesh.scale);
      _undoStack.push(undo_a);
      markDirty();
      updateSelHighlights();
      if (window._sgGcDraw) window._sgGcDraw();
      return;
    }
    if (a.type === 'stroke_transform_multi') {
      var undo_a2 = { type: 'stroke_transform_multi', strokes: a.strokes, oldMatrices: a.strokes.map(function (s) { return s.mesh.matrix.clone(); }) };
      a.strokes.forEach(function (s, i) {
        s.mesh.matrix.copy(a.oldMatrices[i]);
        s.mesh.matrix.decompose(s.mesh.position, s.mesh.quaternion, s.mesh.scale);
      });
      _undoStack.push(undo_a2);
      markDirty();
      updateSelHighlights();
      if (window._sgGcDraw) window._sgGcDraw();
      return;
    }
    if (a.type === 'stroke_duplicate') {
      scene.add(a.newStroke.mesh);
      strokes.push(a.newStroke);
      _undoStack.push(a);
      markDirty();
      return;
    }
    if (a.type === 'merge_layer') {
      a.origStrokes.forEach(function (s) { var idx = strokes.indexOf(s); if (idx > -1) strokes.splice(idx, 1); scene.remove(s.mesh); });
      a.replacedMerged.forEach(function (s) { var idx = strokes.indexOf(s); if (idx > -1) strokes.splice(idx, 1); scene.remove(s.mesh); });
      scene.add(a.mergedStroke.mesh);
      strokes.push(a.mergedStroke);
      _undoStack.push(a);
      showMergeLayerRow(true);
      applyLayerVisibility();
      markDirty();
      return;
    }
  }
  if (window.SketchbookEventBus) {
    window.SketchbookEventBus.emit('historyChanged', {
      canUndo: _undoStack.length > 0,
      canRedo: _redoStack.length > 0,
    });
  }
}

function clearAll() {
  clearSelection();
  while (strokes.length) {
    var s = strokes.pop();
    scene.remove(s.mesh);
    s.mesh.traverse(function (c) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
  }
  redoStack.length = 0;
  _undoStack.length = 0;
  markDirty();
}
