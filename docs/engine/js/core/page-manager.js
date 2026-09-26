// ── PageManager — pages, saved views, view recording ────────────
// Owns: pages[], curPage, saved views, recallView lerp
// Dependencies (global): strokes, scene, clearAll, loadData, toast,
//   cam, surf*, useOrtho, orthoZoom, syncOrtho, updCam, markDirty,
//   activeCam, positionLclFloat, buildSurf, syncSurf, exportScaleMult,
//   renderer, gridH, axisGroup, surfGroup, promptExportName, _recOverlayState

var pages = [];
var curPage = 0;

function snapThumb() {
  renderer.render(scene, activeCam());
  return renderer.domElement.toDataURL('image/jpeg', .35);
}

function saveCurPage() {
  var existingViews = pages[curPage] && pages[curPage].views || [];
  pages[curPage] = {
    strokes: strokes.map(function (s) {
      return {
        pts: s.pts.map(function (p) { return { x: p.x, y: p.y, z: p.z }; }),
        color: s.color, sz: s.sz, op: s.op, flat: s.flat,
        layer: s.layer != null ? s.layer : 1,
        mx: s.mesh.matrix.elements.slice()
      };
    }),
    thumb: snapThumb(),
    views: existingViews
  };
  refreshPageStrip();
}

function loadPage(idx) {
  saveCurPage(); clearAll(); curPage = idx;
  var pg = pages[idx];
  if (pg && pg.strokes) loadData({ strokes: pg.strokes });
  refreshPageStrip(); refreshViewStrip();
}

function addPage() {
  saveCurPage(); clearAll();
  pages.push({ strokes: [], thumb: null });
  curPage = pages.length - 1;
  refreshPageStrip();
  toast('Page ' + (curPage + 1));
}

function deletePage(idx) {
  if (pages.length <= 1) { toast('Need at least 1 page'); return; }
  if (idx === curPage) saveCurPage();
  pages.splice(idx, 1);
  if (curPage >= pages.length) curPage = pages.length - 1;
  clearAll();
  var pg = pages[curPage];
  if (pg && pg.strokes) loadData({ strokes: pg.strokes });
  refreshPageStrip();
  toast('Page deleted');
}

var _pgEditMode = false;
function setPgEditMode(on) {
  _pgEditMode = on;
  refreshPageStrip();
  if (on) toast('Long-press again to exit');
}

function refreshPageStrip() {
  var strip = document.getElementById('pages');
  strip.querySelectorAll('.pg-thumb').forEach(function (x) { x.remove(); });
  var addBtn = document.getElementById('pg-add');
  pages.forEach(function (pg, i) {
    var d = document.createElement('div');
    d.className = 'pg-thumb' + (i === curPage ? ' on' : '');
    if (pg.thumb) { var img = new Image(); img.src = pg.thumb; d.appendChild(img); }
    var num = document.createElement('span'); num.className = 'pg-num'; num.textContent = i + 1; d.appendChild(num);
    if (_pgEditMode && pages.length > 1) {
      var del = document.createElement('button');
      del.textContent = '\u00d7';
      del.style.cssText = 'position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:3px;border:none;background:rgba(176,48,32,.85);color:#fff;font-size:9px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;z-index:10';
      (function (idx) { del.addEventListener('click', function (e) { e.stopPropagation(); deletePage(idx); }); })(i);
      d.appendChild(del);
    } else {
      d.addEventListener('click', function () { loadPage(i); });
    }
    strip.insertBefore(d, addBtn);
  });
}

pages.push({ strokes: [], thumb: null });
refreshPageStrip();

// Long-press pages thumbnail to toggle delete mode
(function () {
  var strip = document.getElementById('pages');
  var _lpt = null;
  function startLong() { _lpt = setTimeout(function () { _lpt = null; setPgEditMode(!_pgEditMode); }, 500); }
  function cancelLong() { if (_lpt) { clearTimeout(_lpt); _lpt = null; } }
  strip.addEventListener('touchstart', function (e) {
    var el = e.touches[0], target = document.elementFromPoint(el.clientX, el.clientY);
    while (target && target !== strip) { if (target.classList.contains('pg-thumb')) { startLong(); return; } target = target.parentElement; }
  }, { passive: true });
  strip.addEventListener('touchend', cancelLong);
  strip.addEventListener('touchcancel', cancelLong);
  strip.addEventListener('touchmove', cancelLong, { passive: true });
  strip.addEventListener('mousedown', function (e) {
    var el = e.target;
    while (el && el !== strip) { if (el.classList.contains('pg-thumb')) { startLong(); return; } el = el.parentElement; }
  });
  strip.addEventListener('mouseup', cancelLong);
  strip.addEventListener('mouseleave', cancelLong);
}());

function togglePages() {
  var pb = document.getElementById('narrow-bar');
  if (pb && pb.classList.contains('active')) {
    var h = pb.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--pb-h', h + 'px');
  }
  var open = document.getElementById('pages').classList.toggle('open');
  document.body.classList.toggle('pages-open', open);
  document.getElementById('pgbtn').classList.toggle('on', open);
  var pbBtn = document.getElementById('pb-pgbtn'); if (pbBtn) pbBtn.classList.toggle('on', open);
  if (open) refreshPageStrip();
  var vs = document.getElementById('views');
  if (vs.classList.contains('open')) {
    if (open) { vs.classList.add('pages-also-open'); }
    else { vs.classList.remove('pages-also-open'); }
  }
  setTimeout(positionLclFloat, 50);
}

document.getElementById('pgbtn').addEventListener('click', togglePages);
document.getElementById('pb-pgbtn').addEventListener('click', togglePages);
document.getElementById('pg-add').addEventListener('click', addPage);

// ── Saved Views ─────────────────────────────────────────────────
function snapViewThumb() {
  renderer.render(scene, activeCam());
  return renderer.domElement.toDataURL('image/jpeg', .35);
}

function saveView() {
  if (!pages[curPage]) return;
  if (!pages[curPage].views) pages[curPage].views = [];
  var v = {
    cam: { theta: cam.theta, phi: cam.phi, radius: cam.radius, tx: cam.target.x, ty: cam.target.y, tz: cam.target.z, ortho: useOrtho, orthoZoom: orthoZoom },
    surf: { type: surfType, plane: curPlane, px: surfPos.x, py: surfPos.y, pz: surfPos.z, rx: surfEuler.x, ry: surfEuler.y, rz: surfEuler.z, sc: surfScale, sax: surfScaleAxes.x, say: surfScaleAxes.y, saz: surfScaleAxes.z },
    thumb: snapViewThumb()
  };
  pages[curPage].views.push(v);
  refreshViewStrip();
  toast('View saved');
}

function deleteView(idx) {
  if (!pages[curPage] || !pages[curPage].views) return;
  pages[curPage].views.splice(idx, 1);
  refreshViewStrip();
}

var _vwLerp = null;
function recallView(v) {
  if (v.surf) {
    surfType = v.surf.type || surfType; curPlane = v.surf.plane || curPlane;
    surfPos.set(v.surf.px || 0, v.surf.py || 0, v.surf.pz || 0);
    surfEuler.set(v.surf.rx || 0, v.surf.ry || 0, v.surf.rz || 0);
    surfScale = v.surf.sc || 1; surfScaleAxes.set(v.surf.sax || 1, v.surf.say || 1, v.surf.saz || 1);
    buildSurf(); syncSurf();
    document.querySelectorAll('[data-surf]').forEach(function (b) { b.classList.toggle('on', b.dataset.surf === surfType); });
    document.querySelectorAll('[data-plane]').forEach(function (b) { b.classList.toggle('on', b.dataset.plane === curPlane); });
  }
  var c = v.cam;
  var startTheta = cam.theta, startPhi = cam.phi, startRadius = cam.radius;
  var startTx = cam.target.x, startTy = cam.target.y, startTz = cam.target.z;
  var endTheta = c.theta, endPhi = c.phi, endRadius = c.radius;
  var endTx = c.tx || 0, endTy = c.ty || 0, endTz = c.tz || 0;
  var dTheta = Math.abs(endTheta - startTheta), dPhi = Math.abs(endPhi - startPhi);
  var dTarget = Math.sqrt(Math.pow(endTx - startTx, 2) + Math.pow(endTy - startTy, 2) + Math.pow(endTz - startTz, 2));
  var dRadius = Math.abs(endRadius - startRadius);
  var angularDist = Math.sqrt(dTheta * dTheta + dPhi * dPhi);
  var totalDist = angularDist / Math.PI + dTarget / 5 + dRadius / 10;
  var dur = Math.min(3000, Math.max(1000, totalDist * 2500));

  var targetOrtho = c.ortho || false;
  var targetOrthoZoom = c.orthoZoom || 8;
  var startOrthoZoom = orthoZoom;
  var needsOrthoTransition = targetOrtho !== useOrtho;
  var CAM_FOV_HALF_TAN = Math.tan(27.5 * Math.PI / 180);

  if (needsOrthoTransition) {
    if (targetOrtho) {
      useOrtho = true;
      startOrthoZoom = startRadius * CAM_FOV_HALF_TAN;
      orthoZoom = startOrthoZoom;
      syncOrtho();
    } else {
      startOrthoZoom = orthoZoom;
      targetOrthoZoom = endRadius * CAM_FOV_HALF_TAN;
    }
  } else if (useOrtho) {
    startOrthoZoom = orthoZoom;
  }

  if (_vwLerp) cancelAnimationFrame(_vwLerp);
  if (typeof _orthoLerp !== 'undefined' && _orthoLerp) { cancelAnimationFrame(_orthoLerp); _orthoLerp = null; }
  var startT = performance.now();
  function step() {
    var t = Math.min(1, (performance.now() - startT) / dur);
    var e = t < 1 ? t * (2 - t) : 1;
    cam.theta = startTheta + (endTheta - startTheta) * e;
    cam.phi = startPhi + (endPhi - startPhi) * e;
    cam.radius = startRadius + (endRadius - startRadius) * e;
    cam.target.x = startTx + (endTx - startTx) * e;
    cam.target.y = startTy + (endTy - startTy) * e;
    cam.target.z = startTz + (endTz - startTz) * e;
    if (needsOrthoTransition && !targetOrtho && useOrtho && e >= 0.85) {
      useOrtho = false;
    }
    if (useOrtho) {
      orthoZoom = startOrthoZoom + (targetOrthoZoom - startOrthoZoom) * e;
      syncOrtho();
    }
    updCam(); markDirty();
    if (t < 1) { _vwLerp = requestAnimationFrame(step); }
    else {
      _vwLerp = null;
      if (needsOrthoTransition && !targetOrtho) { useOrtho = false; }
      orthoZoom = targetOrtho ? (c.orthoZoom || 8) : orthoZoom;
      syncOrtho(); updCam();
      var txt = useOrtho ? 'ORTHO' : 'PERSP';
      ['bpersp', 'nav-persp', 'pb-nav-persp'].forEach(function (id) {
        var b = document.getElementById(id);
        if (b) { b.textContent = txt; b.classList.toggle('on', useOrtho); }
      });
      markDirty();
    }
  }
  step();
}

var _vwEditMode = false;
function setVwEditMode(on) {
  _vwEditMode = on;
  refreshViewStrip();
  if (on) toast('Long-press again to exit');
}

function refreshViewStrip() {
  var strip = document.getElementById('views');
  strip.querySelectorAll('.vw-thumb').forEach(function (x) { x.remove(); });
  var addBtn = document.getElementById('vw-add');
  var views = pages[curPage] && pages[curPage].views || [];
  views.forEach(function (v, i) {
    var d = document.createElement('div');
    d.className = 'vw-thumb';
    if (v.thumb) { var img = new Image(); img.src = v.thumb; d.appendChild(img); }
    var num = document.createElement('span'); num.className = 'vw-num'; num.textContent = i + 1; d.appendChild(num);
    if (_vwEditMode) {
      var del = document.createElement('button');
      del.textContent = '\u00d7';
      del.style.cssText = 'position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:3px;border:none;background:rgba(176,48,32,.85);color:#fff;font-size:9px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;z-index:10';
      (function (idx) { del.addEventListener('click', function (e) { e.stopPropagation(); deleteView(idx); }); })(i);
      d.appendChild(del);
    } else {
      d.addEventListener('click', function () { recallView(v); });
    }
    strip.insertBefore(d, addBtn);
  });
}

// Long-press views thumbnail to toggle delete mode
(function () {
  var strip = document.getElementById('views');
  var _lpt = null;
  function startLong() { _lpt = setTimeout(function () { _lpt = null; setVwEditMode(!_vwEditMode); }, 500); }
  function cancelLong() { if (_lpt) { clearTimeout(_lpt); _lpt = null; } }
  strip.addEventListener('touchstart', function (e) {
    var el = e.touches[0], target = document.elementFromPoint(el.clientX, el.clientY);
    while (target && target !== strip) { if (target.classList.contains('vw-thumb')) { startLong(); return; } target = target.parentElement; }
  }, { passive: true });
  strip.addEventListener('touchend', cancelLong);
  strip.addEventListener('touchcancel', cancelLong);
  strip.addEventListener('touchmove', cancelLong, { passive: true });
  strip.addEventListener('mousedown', function (e) {
    var el = e.target;
    while (el && el !== strip) { if (el.classList.contains('vw-thumb')) { startLong(); return; } el = el.parentElement; }
  });
  strip.addEventListener('mouseup', cancelLong);
  strip.addEventListener('mouseleave', cancelLong);
}());

function toggleViews() {
  var viewsStrip = document.getElementById('views');
  var pagesStrip = document.getElementById('pages');
  var isHidden = document.body.classList.contains('ui-hidden');
  var open;
  if (isHidden) {
    open = viewsStrip.classList.toggle('recording-open');
    viewsStrip.classList.toggle('open', open);
  } else {
    open = viewsStrip.classList.toggle('open');
    viewsStrip.classList.remove('recording-open');
  }
  document.body.classList.toggle('views-open', open);
  document.getElementById('vwbtn').classList.toggle('on', open);
  var pbBtn = document.getElementById('pb-vwbtn'); if (pbBtn) pbBtn.classList.toggle('on', open);
  var hvBtn = document.getElementById('bviews-hidden'); if (hvBtn) hvBtn.classList.toggle('on', open);
  if (open) {
    refreshViewStrip();
    if (!isHidden && pagesStrip.classList.contains('open')) { viewsStrip.classList.add('pages-also-open'); }
    else { viewsStrip.classList.remove('pages-also-open'); }
  }
  setTimeout(positionLclFloat, 50);
}

document.getElementById('vwbtn').addEventListener('click', toggleViews);
document.getElementById('pb-vwbtn').addEventListener('click', toggleViews);
document.getElementById('bviews-hidden').addEventListener('click', toggleViews);
document.getElementById('vw-add').addEventListener('click', saveView);

// Narrow bar hide tab
document.getElementById('pb-tab').addEventListener('click', function () {
  var pb = document.getElementById('narrow-bar');
  var collapsed = pb.classList.toggle('pb-collapsed');
  setTimeout(function () {
    var h = pb.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--pb-h', h + 'px');
  }, 50);
  toast(collapsed ? 'Panel hidden' : 'Panel shown', 900);
});

// ── View recording ──────────────────────────────────────────────
var _recState = null;

function startRecordViews() {
  var views = pages[curPage] && pages[curPage].views;
  if (!views || views.length < 2) { toast('Need 2+ saved views to record'); return; }
  var canvasEl = renderer.domElement;
  if (typeof canvasEl.captureStream !== 'function') { toast('Recording not supported on this device'); return; }
  var mimeType = 'video/webm;codecs=vp8';
  try { if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'; } catch (ex) { mimeType = 'video/webm'; }
  try { if (!MediaRecorder.isTypeSupported(mimeType)) { toast('Recording not supported on this device'); return; } } catch (ex) { toast('Recording not supported on this device'); return; }

  var _recOverlayState = { grid: gridH.visible, axis: axisGroup.visible, surf: surfGroup.visible };
  window._recOverlayState = _recOverlayState;
  gridH.visible = false; axisGroup.visible = false; surfGroup.visible = false; markDirty();

  if (!document.body.classList.contains('ui-hidden')) {
    document.getElementById('bhide').click();
  }
  document.getElementById('views').classList.remove('open', 'recording-open', 'pages-also-open');
  document.getElementById('pages').classList.remove('open');
  document.body.classList.remove('views-open', 'pages-open');

  var stream;
  try { stream = canvasEl.captureStream(30); } catch (ex) { toast('Recording failed: ' + ex.message); return; }
  var recorder;
  try { recorder = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 4000000 }); } catch (ex) { toast('Recording failed: ' + ex.message); return; }
  var chunks = [];
  _recState = { recorder: recorder, chunks: chunks, cancelled: false };
  recorder.ondataavailable = function (e) { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = function () {
    if (_recState && _recState.cancelled) { _recState = null; toast('Recording cancelled'); return; }
    var recChunks = _recState ? _recState.chunks : chunks;
    _recState = null;
    if (!recChunks.length) { toast('No recording data'); return; }
    var blob = new Blob(recChunks, { type: mimeType });
    promptExportName('sketch3d-views', '.webm', function (name) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = name + '.webm'; a.click();
      URL.revokeObjectURL(url); toast('Recording saved');
    });
  };
  recorder.onerror = function () {
    _recState = null;
    document.getElementById('rec-stop-btn').classList.remove('vis');
    toast('Recording error');
  };
  recorder.start();
  document.getElementById('rec-stop-btn').classList.add('vis');
  toast('Recording started');

  renderer.render(scene, activeCam()); markDirty();
  setTimeout(function () { _recPlayViews(views, 0); }, 500);
}

function _recPlayViews(views, idx) {
  if (!_recState || _recState.cancelled) return;
  if (idx >= views.length) {
    setTimeout(function () { stopRecordViews(false); }, 1000);
    return;
  }
  recallView(views[idx]);
  function waitForLerp() {
    if (!_recState || _recState.cancelled) return;
    if (_vwLerp != null) {
      requestAnimationFrame(waitForLerp);
    } else {
      setTimeout(function () { _recPlayViews(views, idx + 1); }, 800);
    }
  }
  requestAnimationFrame(waitForLerp);
}

function stopRecordViews(cancel) {
  if (!_recState) return;
  if (cancel) _recState.cancelled = true;
  document.getElementById('rec-stop-btn').classList.remove('vis');
  if (_vwLerp) { cancelAnimationFrame(_vwLerp); _vwLerp = null; }
  try { if (_recState.recorder.state !== 'inactive') _recState.recorder.stop(); } catch (ex) {}
  if (window._recOverlayState) {
    gridH.visible = window._recOverlayState.grid;
    axisGroup.visible = window._recOverlayState.axis;
    surfGroup.visible = window._recOverlayState.surf;
    window._recOverlayState = null;
    var bg = document.getElementById('bgrid'); if (bg) bg.classList.toggle('on', gridH.visible);
    var ba = document.getElementById('baxis'); if (ba) ba.classList.toggle('on', axisGroup.visible);
    var bs = document.getElementById('bsurf'); if (bs) bs.classList.toggle('on', surfGroup.visible);
    var pbg = document.getElementById('pb-grid'); if (pbg) pbg.classList.toggle('on', gridH.visible);
    var pba = document.getElementById('pb-axis'); if (pba) pba.classList.toggle('on', axisGroup.visible);
    var pbs = document.getElementById('pb-surf'); if (pbs) pbs.classList.toggle('on', surfGroup.visible);
    markDirty();
  }
  if (document.body.classList.contains('ui-hidden')) {
    document.getElementById('bhide').click();
  }
}
