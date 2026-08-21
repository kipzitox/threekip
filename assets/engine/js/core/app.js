// ── Sketch3D App — single coordination entry point ──────────────
// Pure coordinator: owns initialization sequence, keyboard shortcuts,
// restore-from-DB. Contains no editor logic.

class _App {
  constructor() { this._initialized = false; }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    // 1. Scene sync
    syncSurf();
    setMode('draw');
    document.getElementById('bsurf').classList.add('on');

    // 2. Initial UI state
    setActiveLayer(0);
    updateGestLabel();
    updateLayoutMode();
    _syncRenderer();

    // 3. PWA viewport retries (dimensions may not be final at script time)
    setTimeout(updateLayoutMode, 200);
    setTimeout(updateLayoutMode, 600);
    setTimeout(_syncRenderer, 250);
    setTimeout(_syncRenderer, 700);
    setTimeout(positionLclFloat, 220);
    setTimeout(positionLclFloat, 650);

    // 4. Restore from IndexedDB (localStorage fallback)
    this._restore();

    // 5. Keyboard shortcuts
    this._bindKeyboard();

    // 6. Start render loop
    animate();
  }

  _restore() {
    function doRestore() {
      idbLoad(function (saved) {
        if (saved) {
          try {
            var data = JSON.parse(saved);
            if (data.strokes && data.strokes.length > 0) loadAllPages(data);
          } catch (e) {}
        }
      });
    }
    if (_idb) {
      doRestore();
    } else {
      _onIdbReady(function () { doRestore(); });
      setTimeout(function () {
        if (!_idb) {
          try {
            var s = localStorage.getItem('sk3d_auto');
            if (s) {
              var d = JSON.parse(s);
              if (d.strokes && d.strokes.length > 0) loadAllPages(d);
            }
          } catch (e) {}
        }
      }, 2000);
    }
  }

  _bindKeyboard() {
    window.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedStrokes.length) { e.preventDefault(); deleteSelected(); return; } }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.activeElement.tagName === 'INPUT') return;
      if (_fpsMode) {
        var k = e.key.toLowerCase();
        if (k === 'escape') { if (window._exitFps) window._exitFps(); return; }
        if ('wasdqe'.indexOf(k) >= 0) return;
        if (k === 'arrowleft' || k === 'arrowright' || k === 'arrowup' || k === 'arrowdown') return;
      }
      switch (e.key.toLowerCase()) {
        case 'd': setMode('draw'); break;
        case 'e': setMode('erase'); break;
        case 'q': setMode('select'); break;
        case 'g': setMode('pan'); break;
        case 'r': setMode('orbit'); break;
        case 'f': document.getElementById('sflat').click(); break;
        case 'v': togglePersp(); break;
        case 'x': document.getElementById('bdepth').click(); break;
        case 'a': toggleAxis(!axisLinesOn); break;
        case 's': document.getElementById('ssmooth').click(); break;
        case 'w': document.getElementById('svel').click(); break;
        case 'p': expPNG(); break;
        case 'h': document.getElementById('bhide').click(); break;
        case 'escape': clearSelection(); setMode(prevDrawMode); break;
      }
    });
  }
}

// Expose instance directly so App.init() works from 19-init.js
App = new _App();

// Render loop — global function (referenced by 01-local-gizmo, 10-snap-cardgizmo)
function animate() {
  requestAnimationFrame(animate);
  if (_renderDirty || isDrawing || _hoverStroke || _recState) {
    renderer.render(scene, activeCam());
    // The 2D local-gizmo overlay shares the same camera matrix as the WebGL
    // render, so it is redrawn only on frames where the scene actually
    // renders. Camera moves call markDirty() (via updCam), and toggling the
    // gizmo also calls markDirty(), so the overlay stays in sync with no
    // visual change — while idle frames do zero work.
    if (window._lgOverlayDraw) window._lgOverlayDraw();
    _renderDirty = false;
  }
}
