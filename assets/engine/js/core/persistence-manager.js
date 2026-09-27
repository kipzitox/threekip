// ── PersistenceManager — save/load, IndexedDB autosave ──────────
// Owns: sceneData, loadData, loadAllPages, saveFile, loadFile,
//   idbSave, idbLoad, _idb, autosave interval
// Dependencies (global): strokes, pages, curPage, clearAll,
//   applyLayerVisibility, showMergeLayerRow, buildTube, buildCap,
//   computeVels, scene, surf*, buildSurf, toast, renderer, activeCam,
//   markDirty, refreshPageStrip, refreshViewStrip, THREE

function sceneData() {
  var allPages = pages.map(function (pg, i) {
    var pgViews = pg.views || [];
    if (i === curPage) {
      return {
        strokes: strokes.map(function (s) {
          return {
            pts: s.pts.map(function (p) { return { x: p.x, y: p.y, z: p.z }; }),
            color: s.color, sz: s.sz, op: s.op, flat: s.flat,
            layer: s.layer != null ? s.layer : 1,
            mx: s.mesh.matrix.elements.slice()
          };
        }),
        views: pgViews
      };
    }
    return { strokes: (pg.strokes || []), views: pgViews };
  });
  return {
    version: 4.3, curPage: curPage, pages: allPages,
    strokes: strokes.map(function (s) {
      return {
        pts: s.pts.map(function (p) { return { x: p.x, y: p.y, z: p.z }; }),
        color: s.color, sz: s.sz, op: s.op, flat: s.flat,
        layer: s.layer != null ? s.layer : 1,
        mx: s.mesh.matrix.elements.slice()
      };
    }),
    surf: {
      type: (surfType === 'loft' || surfType === 'none') ? 'plane' : surfType,
      plane: curPlane, px: surfPos.x, py: surfPos.y, pz: surfPos.z,
      rx: surfEuler.x, ry: surfEuler.y, rz: surfEuler.z,
      sc: surfScale, sax: surfScaleAxes.x, say: surfScaleAxes.y, saz: surfScaleAxes.z
    }
  };
}

function loadData(data) {
  clearAll();
  if (data.surf) {
    surfType = data.surf.type || 'plane'; curPlane = data.surf.plane || 'xz';
    surfPos.set(data.surf.px || 0, data.surf.py || 0, data.surf.pz || 0);
    surfEuler.set(data.surf.rx || 0, data.surf.ry || 0, data.surf.rz || 0);
    surfScale = data.surf.sc || 1;
    surfScaleAxes.set(data.surf.sax || 1, data.surf.say || 1, data.surf.saz || 1);
    buildSurf();
    document.querySelectorAll('[data-surf]').forEach(function (b) { b.classList.toggle('on', b.dataset.surf === surfType); });
    document.querySelectorAll('[data-plane]').forEach(function (b) { b.classList.toggle('on', b.dataset.plane === curPlane); });
    var _pl = { 'xz': 'Front', 'xy': 'Top', 'yz': 'Side' };
    ['pb-cyc-plane', 'pb-cyc-plane2', 'sb-cyc-plane'].forEach(function (id) {
      var b = document.getElementById(id); if (b) b.textContent = _pl[curPlane] || curPlane;
    });
  }
  if (data.strokes) {
    data.strokes.forEach(function (s) {
      var pts = s.pts.map(function (p) { return new THREE.Vector3(p.x, p.y, p.z); });
      var vels = computeVels(pts), g = new THREE.Group();
      var tube = buildTube(pts, vels, s.color, s.sz, s.op, s.flat || false);
      if (tube) g.add(tube);
      if (!(s.flat || false)) { g.add(buildCap(pts[0], s.color, s.sz, s.op)); g.add(buildCap(pts[pts.length - 1], s.color, s.sz, s.op)); }
      if (s.mx) { g.matrix.fromArray(s.mx); g.matrix.decompose(g.position, g.quaternion, g.scale); g.matrixAutoUpdate = false; }
      scene.add(g);
      strokes.push({ pts: pts, vels: vels, color: s.color, sz: s.sz, op: s.op, flat: s.flat || false, layer: s.layer != null ? s.layer : 1, mesh: g, _depthKey: '' });
    });
  }
  applyLayerVisibility();
  showMergeLayerRow(strokes.some(function (s) { return s.layer === 3; }));
}

function loadAllPages(data) {
  if (data.pages && data.pages.length) {
    pages.length = 0;
    data.pages.forEach(function (pg) { pages.push({ strokes: pg.strokes || [], thumb: null, views: pg.views || [] }); });
    curPage = Math.min(data.curPage || 0, pages.length - 1);
    clearAll();
    var pg = pages[curPage];
    if (pg && pg.strokes) loadData(Object.assign({}, data, { strokes: pg.strokes }));
    refreshPageStrip();
    refreshViewStrip();
  } else {
    loadData(data);
    pages[0] = {
      strokes: strokes.map(function (s) {
        return {
          pts: s.pts.map(function (p) { return { x: p.x, y: p.y, z: p.z }; }),
          color: s.color, sz: s.sz, op: s.op, flat: s.flat,
          layer: s.layer != null ? s.layer : 1,
          mx: s.mesh.matrix.elements.slice()
        };
      }),
      thumb: null, views: []
    };
    refreshPageStrip();
    refreshViewStrip();
  }
}

function _doSaveFile(name) {
  renderer.render(scene, activeCam());
  var src = renderer.domElement;
  var tmp = document.createElement('canvas');
  tmp.width = 120; tmp.height = 84;
  var tc = tmp.getContext('2d');
  tc.drawImage(src, 0, 0, 120, 84);
  var thumb = tmp.toDataURL('image/jpeg', 0.5);
  var data = sceneData();
  data.thumb = thumb;
  var b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var u = URL.createObjectURL(b);
  var a = document.createElement('a'); a.href = u; a.download = (name || 'sketch3d') + '.json'; a.click();
  URL.revokeObjectURL(u); toast('Saved');
}

function saveFileWithName(defaultName, onComplete) {
  var snmod = document.getElementById('save-name-modal');
  var inp = document.getElementById('save-name-input');
  inp.value = defaultName || 'sketch3d';
  snmod._onComplete = onComplete || null;
  snmod.classList.add('vis');
  inp.focus(); inp.select();
}

function saveFile() { saveFileWithName('sketch3d', null); }
function loadFile() { document.getElementById('filein').click(); }

document.getElementById('filein').addEventListener('change', function () {
  var f = this.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function (ev) {
    try { loadAllPages(JSON.parse(ev.target.result)); toast('Loaded'); } catch (e) { alert('Invalid file.'); }
  };
  r.readAsText(f); this.value = '';
});

// ── IndexedDB auto-save ────────────────────────────────────────
var _idb = null;
var _idbReadyCallbacks = [];
function _onIdbReady(cb) { if (_idb) { cb(_idb); } else { _idbReadyCallbacks.push(cb); } }

(function () {
  try {
    var req = indexedDB.open('sketch3d', 1);
    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('autosave')) db.createObjectStore('autosave');
    };
    req.onsuccess = function (e) {
      _idb = e.target.result;
      try {
        var old = localStorage.getItem('sk3d_auto');
        if (old) {
          var tx = _idb.transaction('autosave', 'readwrite');
          tx.objectStore('autosave').put(old, 'sk3d_auto');
          localStorage.removeItem('sk3d_auto');
        }
      } catch (e2) {}
      var cbs = _idbReadyCallbacks.splice(0);
      for (var i = 0; i < cbs.length; i++) { try { cbs[i](_idb); } catch (e3) {} }
    };
    req.onerror = function () { _idb = null; };
  } catch (e) { _idb = null; }
})();

function idbSave(dataStr) {
  if (_idb) {
    try {
      var tx = _idb.transaction('autosave', 'readwrite');
      tx.objectStore('autosave').put(dataStr, 'sk3d_auto');
      return;
    } catch (e) {}
  }
  try { localStorage.setItem('sk3d_auto', dataStr); } catch (e) {}
}

function idbLoad(cb) {
  if (_idb) {
    try {
      var tx = _idb.transaction('autosave', 'readonly');
      var req = tx.objectStore('autosave').get('sk3d_auto');
      req.onsuccess = function (e) { cb(e.target.result || null); };
      req.onerror = function () { cb(null); };
      return;
    } catch (e) {}
  }
  try { cb(localStorage.getItem('sk3d_auto')); } catch (e) { cb(null); }
}

setInterval(function () { try { idbSave(JSON.stringify(sceneData())); } catch (e) {} }, 30000);

(function () {
  var _lastSaveAt = 0;
  function _flushSave() {
    try {
      var now = Date.now(); if (now - _lastSaveAt < 500) return;
      _lastSaveAt = now;
      var str = JSON.stringify(sceneData());
      try { localStorage.setItem('sk3d_auto', str); } catch (e) {}
      try { idbSave(str); } catch (e) {}
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') _flushSave();
  });
  window.addEventListener('pagehide', _flushSave);
  window.addEventListener('beforeunload', _flushSave);
  window._flushAutosave = _flushSave;
})();
