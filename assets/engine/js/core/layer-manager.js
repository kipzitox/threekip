// ── LayerManager — layer state, visibility, merge ───────────────
// Owns: activeLayer, layerVisible, setActiveLayer, setLayerVisible,
//   applyLayerVisibility, showMergeLayerRow, mergeLayer
// Dependencies (global): strokes, scene, markDirty, toast,
//   _undoStack, _redoStack, redoStack, document.getElementById

var activeLayer = 0;
var layerVisible = [true, true, true, true];
var layerOrder = [0, 1, 2, 3]; // Default rendering order (index 0 is bottom, index 3 is top)

function setActiveLayer(i) {
  activeLayer = i;
  [0, 1, 2, 3].forEach(function (j) {
    var tb = document.getElementById('tb-lrow' + j);
    if (tb) tb.classList.toggle('active', j === i);
  });
  var dotColors = ['#b03020', '#1a1a2e', '#1a9940', '#8b5cf6'];
  var dot = document.getElementById('pb-layer-dot');
  if (dot) dot.style.background = dotColors[i] || '#1a1a2e';
}

function setLayerVisible(i, v) {
  layerVisible[i] = v;
  var tbeye = document.getElementById('tb-leye' + i);
  if (tbeye) { tbeye.textContent = v ? '◉' : '○'; tbeye.classList.toggle('vis', v); }
  applyLayerVisibility();
}

function applyLayerVisibility() {
  strokes.forEach(function (s) {
    var layer = s.layer != null ? s.layer : 1;
    s.mesh.visible = layerVisible[layer] !== false;
    
    // Set renderOrder based on layer position in layerOrder array.
    // The visual list in #layers-pop should be top-to-bottom = top-layer to bottom-layer.
    // So if layerOrder = [0, 1, 2, 3], and it's rendered as 3, 2, 1, 0 in DOM:
    // index 3 is highest renderOrder.
    var orderIdx = layerOrder.indexOf(layer);
    s.mesh.renderOrder = orderIdx + 3; // +3 to stay above default grid/axis if they use lower orders
  });
  markDirty();
}

function showMergeLayerRow(show) {
  var row = document.getElementById('tb-lrow3');
  if (row) row.style.display = show ? 'flex' : 'none';
}

function mergeLayer(srcLayer) {
  var toMerge = strokes.filter(function (s) { return (s.layer != null ? s.layer : 1) === srcLayer; });
  if (!toMerge.length) { toast('Nothing on layer'); return; }

  var mergedGroup = new THREE.Group();
  toMerge.forEach(function (s) {
    s.mesh.traverse(function (c) {
      if (!c.isMesh || !c.geometry) return;
      var geo = c.geometry.clone();
      geo.applyMatrix4(s.mesh.matrix);
      var mat = c.material.clone();
      var m = new THREE.Mesh(geo, mat);
      m.renderOrder = 3;
      mergedGroup.add(m);
    });
  });
  mergedGroup.matrixAutoUpdate = false;
  mergedGroup.updateMatrix();

  var replacedMerged = strokes.filter(function (s) { return s.layer === 3; });
  replacedMerged.forEach(function (s) {
    var idx = strokes.indexOf(s);
    if (idx > -1) { strokes.splice(idx, 1); }
    scene.remove(s.mesh);
  });

  var savedOrigIndices = [];
  toMerge.forEach(function (s) {
    var idx = strokes.indexOf(s);
    if (idx > -1) savedOrigIndices.push(idx);
    scene.remove(s.mesh);
  });
  savedOrigIndices.sort(function (a, b) { return b - a; }).forEach(function (i) { strokes.splice(i, 1); });

  scene.add(mergedGroup);
  var mergeColor = toMerge[0] ? toMerge[0].color : '#1a1a2e';
  var mergedStroke = { pts: [new THREE.Vector3()], vels: [0], color: mergeColor, sz: 1, op: 1, flat: false, layer: 3, mesh: mergedGroup, _depthKey: '' };
  strokes.push(mergedStroke);

  _undoStack.push({ type: 'merge_layer', srcLayer: srcLayer, origStrokes: toMerge, savedOrigIndices: savedOrigIndices, mergedStroke: mergedStroke, replacedMerged: replacedMerged });
  _redoStack.length = 0;
  redoStack.length = 0;

  showMergeLayerRow(true);
  applyLayerVisibility();
  markDirty();
  toast('Merged to layer 3');
}

// ── Layer popover IIFE (DOM bindings) ──────────────────────────
[0, 1, 2, 3].forEach(function (i) {
  var tblb = document.getElementById('tb-lrow' + i);
  if (tblb) tblb.addEventListener('click', function (e) {
    if (e.target === document.getElementById('tb-leye' + i)) return;
    if (e.target === document.getElementById('tb-merge' + i)) return;
    setActiveLayer(i);
  });
  var tbeye = document.getElementById('tb-leye' + i);
  if (tbeye) tbeye.addEventListener('click', function (e) { e.stopPropagation(); setLayerVisible(i, !layerVisible[i]); });
  var tbmerge = document.getElementById('tb-merge' + i);
  if (tbmerge) tbmerge.addEventListener('click', function (e) { e.stopPropagation(); mergeLayer(i); });
});

// Topbar LAYERS button IIFE
(function () {
  var btn = document.getElementById('blayers');
  var pop = document.getElementById('layers-pop');
  if (!btn || !pop) return;

  function updateLayerListUI() {
    var rows = Array.from(pop.querySelectorAll('.tb-lrow'));
    rows.sort(function (a, b) {
      var la = parseInt(a.getAttribute('data-layer'));
      var lb = parseInt(b.getAttribute('data-layer'));
      return layerOrder.indexOf(lb) - layerOrder.indexOf(la);
    });
    rows.forEach(function (row) { pop.appendChild(row); });
  }

  // Initialize draggable rows
  [0, 1, 2, 3].forEach(function (i) {
    var row = document.getElementById('tb-lrow' + i);
    if (row) {
      row.setAttribute('draggable', 'true');
      row.addEventListener('dragstart', function (e) {
        if (e.target.closest('.tb-leye') || e.target.closest('.tb-merge')) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', i);
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', function () {
        row.classList.remove('dragging');
        pop.querySelectorAll('.tb-lrow').forEach(function (r) { r.classList.remove('drag-over'); });
      });
      row.addEventListener('dragover', function (e) {
        e.preventDefault();
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', function () {
        row.classList.remove('drag-over');
      });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        var draggedLayer = parseInt(e.dataTransfer.getData('text/plain'));
        var targetLayer = parseInt(row.getAttribute('data-layer'));
        if (draggedLayer === targetLayer) return;

        var oldIdx = layerOrder.indexOf(draggedLayer);
        var newIdx = layerOrder.indexOf(targetLayer);

        layerOrder.splice(oldIdx, 1);
        layerOrder.splice(newIdx, 0, draggedLayer);

        updateLayerListUI();
        applyLayerVisibility();
        if (window.SketchbookEventBus) window.SketchbookEventBus.emit('layerOrderChanged', { order: layerOrder });
      });
    }
  });

  // Initial sort
  updateLayerListUI();

  function openLayersPop(trigger) {
    pop.classList.add('open');
    btn.classList.add('on');
    var br = trigger.getBoundingClientRect();
    pop.style.top = (br.bottom + 6) + 'px';
    pop.style.left = Math.max(4, Math.min(br.left, window.innerWidth - pop.offsetWidth - 4)) + 'px';
  }
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (pop.classList.contains('open')) { pop.classList.remove('open'); btn.classList.remove('on'); }
    else { openLayersPop(btn); }
  });
  var dot = document.getElementById('pb-layer-dot');
  if (dot) dot.addEventListener('click', function (e) {
    e.stopPropagation();
    if (pop.classList.contains('open')) { pop.classList.remove('open'); btn.classList.remove('on'); }
    else { openLayersPop(dot); }
  });
  document.addEventListener('click', function (e) {
    if (!pop.contains(e.target) && e.target !== btn && e.target !== dot) {
      pop.classList.remove('open');
      btn.classList.remove('on');
    }
  });
})();
