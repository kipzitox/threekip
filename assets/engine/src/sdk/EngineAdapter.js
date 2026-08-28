// ── EngineAdapter — wraps existing engine for SDK ─────────────────
// This adapter exposes the existing global functions/state as an engine
// interface that the SDK can use. NO engine logic is modified.

import { EventBusInstance } from './Events.js';

class EngineAdapter {
  constructor() {
    this._eventHandlers = new Map();
    this._initialized = false;
  }

  initialize() {
    if (this._initialized) return;
    this._initialized = true;
    this._hookGlobalEvents();
  }

  _hookGlobalEvents() {
    // The existing engine uses global functions and DOM events.
    // We hook into those to emit SDK events.
    // This is a best-effort approach since the engine wasn't designed for this.

    // Listen for global events that indicate state changes
    // Note: The original engine doesn't have a proper event system,
    // so we rely on the SDK calling engine methods which then trigger events.
  }

  // ─── Engine Interface Methods ────────────────────────────────────

  // Tool management
  setTool(tool) {
    if (typeof setMode === 'function') {
      setMode(tool);
      this._emit('toolChanged', { tool });
    }
  }

  setColor(color) {
    if (typeof curColor !== 'undefined') {
      curColor = color;
      this._emit('colorChanged', { color });
    }
  }

  setBrushSize(size) {
    if (typeof brushSz !== 'undefined') {
      brushSz = size;
      this._emit('brushChanged', { size });
    }
  }

  setBrushOpacity(opacity) {
    if (typeof brushOp !== 'undefined') {
      brushOp = opacity;
      this._emit('brushChanged', { opacity });
    }
  }

  setFlatBrush(flat) {
    if (typeof flatBrush !== 'undefined') {
      flatBrush = flat;
      this._emit('brushChanged', { flat });
    }
  }

  setSmoothing(smoothing) {
    if (typeof smoothingOn !== 'undefined') {
      smoothingOn = smoothing;
      LAZY = smoothing ? LAZY_ON : LAZY_OFF;
      this._emit('brushChanged', { smoothing });
    }
  }

  // Drawing
  addStroke(options) {
    const opts = options || {};
    const pts = (opts.points || []).map(function (p) {
      return new THREE.Vector3(p.x, p.y, p.z);
    });
    if (!pts.length) return null;
    const color = opts.color != null ? opts.color : (typeof curColor !== 'undefined' ? curColor : '#000000');
    const sz = opts.size != null ? opts.size : (typeof brushSz !== 'undefined' ? brushSz : 1);
    const op = opts.opacity != null ? opts.opacity : (typeof brushOp !== 'undefined' ? brushOp : 0.95);
    const flat = opts.flat != null ? opts.flat : (typeof flatBrush !== 'undefined' ? flatBrush : false);
    const layer = opts.layer != null ? opts.layer : (typeof activeLayer !== 'undefined' ? activeLayer : 1);
    const vels = computeVels(pts);
    const g = new THREE.Group();
    const tube = buildTube(pts, vels, color, sz, op, flat);
    if (tube) g.add(tube);
    if (!flat) {
      g.add(buildCap(pts[0], color, sz, op));
      g.add(buildCap(pts[pts.length - 1], color, sz, op));
    }
    scene.add(g);
    const stroke = {
      pts: pts, vels: vels, color: color, sz: sz, op: op,
      flat: flat, layer: layer, mesh: g, _depthKey: ''
    };
    strokes.push(stroke);
    if (typeof markDirty === 'function') markDirty();
    this._emit('strokeAdded', { index: strokes.length - 1 });
    return { index: strokes.length - 1 };
  }

  // History
  undo() {
    if (typeof undo === 'function') {
      undo();
      this._emit('historyChanged', { canUndo: this.canUndo(), canRedo: this.canRedo() });
      return true;
    }
    return false;
  }

  redo() {
    if (typeof redo === 'function') {
      redo();
      this._emit('historyChanged', { canUndo: this.canUndo(), canRedo: this.canRedo() });
      return true;
    }
    return false;
  }

  canUndo() {
    return typeof _undoStack !== 'undefined' && _undoStack.length > 0;
  }

  canRedo() {
    return typeof _redoStack !== 'undefined' && _redoStack.length > 0;
  }

  // Selection
  selectObject(id, addToSelection) {
    if (typeof strokes === 'undefined' || typeof selectedStrokes === 'undefined') return false;
    let idx = -1;
    if (typeof id === 'number') idx = id;
    else if (typeof id === 'string') {
      const m = id.match(/^stroke_(\d+)$/);
      if (m) idx = parseInt(m[1], 10);
    }
    if (idx < 0 || idx >= strokes.length) return false;
    selectedStrokes.length = 0;
    selectedStrokes.push(strokes[idx]);
    if (typeof markDirty === 'function') markDirty();
    this._emit('selectionChanged', { selectedIds: this.getSelection() });
    return true;
  }

  getSelection() {
    if (typeof selectedStrokes !== 'undefined') {
      return selectedStrokes.map((s, i) => ({ index: i, id: s._depthKey || `stroke_${i}` }));
    }
    return [];
  }

  clearSelection() {
    if (typeof clearSelection === 'function') {
      clearSelection();
      this._emit('selectionChanged', { selectedIds: [] });
    }
  }

  deleteSelection() {
    if (typeof deleteSelected === 'function') {
      deleteSelected();
      this._emit('strokeRemoved', {});
    }
  }

  duplicateSelection() {
    if (typeof duplicateSelected === 'function') {
      duplicateSelected();
      this._emit('strokeAdded', {});
    }
  }

  // Camera
  setCamera(camera) {
    if (typeof cam !== 'undefined') {
      const prev = { ...cam };
      if (camera.theta !== undefined) cam.theta = camera.theta;
      if (camera.phi !== undefined) cam.phi = camera.phi;
      if (camera.radius !== undefined) cam.radius = camera.radius;
      if (camera.target) {
        if (camera.target.x !== undefined) cam.target.x = camera.target.x;
        if (camera.target.y !== undefined) cam.target.y = camera.target.y;
        if (camera.target.z !== undefined) cam.target.z = camera.target.z;
      }
      if (typeof updCam === 'function') updCam();
      if (typeof markDirty === 'function') markDirty();
      this._emit('cameraChanged', { camera: this.getCamera(), prev });
    }
  }

  getCamera() {
    if (typeof cam !== 'undefined') {
      return {
        theta: cam.theta,
        phi: cam.phi,
        radius: cam.radius,
        target: { x: cam.target.x, y: cam.target.y, z: cam.target.z },
        ortho: typeof useOrtho !== 'undefined' ? useOrtho : false,
        orthoZoom: typeof orthoZoom !== 'undefined' ? orthoZoom : 8
      };
    }
    return null;
  }

  // Layers
  setActiveLayer(layer) {
    if (typeof setActiveLayer === 'function') {
      setActiveLayer(layer);
      this._emit('layerChanged', { activeLayer: layer });
    }
  }

  setLayerVisible(index, visible) {
    if (typeof setLayerVisible === 'function') {
      setLayerVisible(index, visible);
      this._emit('layerChanged', { layerVisibility: this.getLayerVisibility() });
    }
  }

  getLayerVisibility() {
    if (typeof layerVisible !== 'undefined') {
      return [...layerVisible];
    }
    return [true, true, true, true];
  }

  setLayerOpacity(index, opacity) {
    if (typeof setLayerOpacity === 'function') {
      setLayerOpacity(index, opacity);
      this._emit('layerChanged', { layerOpacity: this.getLayerOpacity() });
    }
  }

  getLayerOpacity() {
    if (typeof layerOpacity !== 'undefined') {
      return [...layerOpacity];
    }
    return [1.0, 1.0, 1.0, 1.0];
  }

  // Pages
  addPage() {
    if (typeof addPage === 'function') {
      addPage();
      this._emit('pageChanged', { currentPage: this.getCurrentPage(), pages: this.getPages() });
    }
  }

  deletePage(index) {
    if (typeof deletePage === 'function') {
      deletePage(index);
      this._emit('pageChanged', { currentPage: this.getCurrentPage(), pages: this.getPages() });
    }
  }

  loadPage(index) {
    if (typeof loadPage === 'function') {
      loadPage(index);
      this._emit('pageChanged', { currentPage: this.getCurrentPage(), pages: this.getPages() });
    }
  }

  saveCurrentPage() {
    if (typeof saveCurPage === 'function') {
      saveCurPage();
    }
  }

  getPages() {
    if (typeof pages !== 'undefined') {
      return pages.map((p, i) => ({
        index: i,
        strokeCount: p.strokes?.length || 0,
        thumb: p.thumb,
        views: p.views?.length || 0
      }));
    }
    return [];
  }

  getCurrentPage() {
    if (typeof curPage !== 'undefined') return curPage;
    return 0;
  }

  // Views
  saveView() {
    if (typeof saveView === 'function') {
      saveView();
      this._emit('viewChanged', { views: this.getViews() });
    }
  }

  recallView(index) {
    if (typeof recallView === 'function') {
      const views = this.getViews();
      if (views[index]) {
        recallView(views[index]);
        this._emit('cameraChanged', { camera: this.getCamera() });
      }
    }
  }

  deleteView(index) {
    if (typeof deleteView === 'function') {
      deleteView(index);
      this._emit('viewChanged', { views: this.getViews() });
    }
  }

  getViews() {
    if (typeof pages !== 'undefined' && typeof curPage !== 'undefined') {
      return pages[curPage]?.views || [];
    }
    return [];
  }

  // Project I/O
  loadProject(data) {
    if (typeof loadAllPages === 'function') {
      loadAllPages(data);
      this._emit('projectLoaded', { data });
      this._syncState();
    }
  }

  saveProject() {
    if (typeof sceneData === 'function') {
      return sceneData();
    }
    return null;
  }

  saveProjectAs(name) {
    if (typeof _doSaveFile === 'function') {
      _doSaveFile(name);
    }
  }

  // Export (returns base64 payload so RN can write to native FS)
  exportPNG() {
    if (typeof expPNG === 'function') {
      const data = expPNG(true);
      if (data) {
        this._emit('exportFinished', { format: 'png' });
        return { data, mime: 'image/png', ext: 'png' };
      }
    }
    return null;
  }

  exportGLB(name) {
    if (typeof expGLTF === 'function') {
      const data = expGLTF(name, true);
      if (data) {
        this._emit('exportFinished', { format: 'glb' });
        return { data, mime: 'model/gltf-binary', ext: 'glb' };
      }
    }
    return null;
  }

  exportOBJ(name) {
    if (typeof expOBJ === 'function') {
      const data = expOBJ(name, true);
      if (data) {
        this._emit('exportFinished', { format: 'obj' });
        return { data, mime: 'text/plain', ext: 'obj' };
      }
    }
    return null;
  }

  exportUSD(name) {
    if (typeof expUSD === 'function') {
      const data = expUSD(name, true);
      if (data) {
        this._emit('exportFinished', { format: 'usd' });
        return { data, mime: 'model/vnd.usda', ext: 'usd' };
      }
    }
    return null;
  }

  exportUSDZ(name) {
    if (typeof expUSDZ === 'function') {
      const data = expUSDZ(name, true);
      if (data) {
        this._emit('exportFinished', { format: 'usdz' });
        return { data, mime: 'model/vnd.usdz+zip', ext: 'usdz' };
      }
    }
    return null;
  }

  // Viewport
  resize(width, height) {
    if (typeof renderer !== 'undefined' && renderer.setSize) {
      renderer.setSize(width, height);
      if (typeof _syncRenderer === 'function') _syncRenderer();
      if (typeof markDirty === 'function') markDirty();
    }
  }

  // State
  getState() {
    return {
      tool: typeof mode !== 'undefined' ? mode : 'draw',
      prevDrawMode: typeof prevDrawMode !== 'undefined' ? prevDrawMode : 'draw',
      color: typeof curColor !== 'undefined' ? curColor : '#000000',
      brushSize: typeof brushSz !== 'undefined' ? brushSz : 1,
      brushOpacity: typeof brushOp !== 'undefined' ? brushOp : 0.95,
      flatBrush: typeof flatBrush !== 'undefined' ? flatBrush : false,
      smoothing: typeof smoothingOn !== 'undefined' ? smoothingOn : false,
      strokes: this._getStrokesState(),
      selectedStrokeIds: this.getSelection().map(s => s.id),
      activeLayer: typeof activeLayer !== 'undefined' ? activeLayer : 0,
      layerVisibility: this.getLayerVisibility(),
      pages: this.getPages(),
      currentPage: this.getCurrentPage(),
      camera: this.getCamera(),
      surface: this._getSurfaceState(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      ui: {
        hidden: document.body.classList.contains('ui-hidden'),
        pagesOpen: document.getElementById('pages')?.classList.contains('open') || false,
        viewsOpen: document.getElementById('views')?.classList.contains('open') || false
      },
      exportScaleIndex: typeof exportScaleIdx !== 'undefined' ? exportScaleIdx : 0,
      undoStackSize: typeof _undoStack !== 'undefined' ? _undoStack.length : 0,
      redoStackSize: typeof _redoStack !== 'undefined' ? _redoStack.length : 0,
      version: '4.3'
    };
  }

  applyState(state) {
    // Apply state to engine globals
    if (state.tool) this.setTool(state.tool);
    if (state.color) this.setColor(state.color);
    if (state.brushSize) this.setBrushSize(state.brushSize);
    if (state.brushOpacity) this.setBrushOpacity(state.brushOpacity);
    if (state.flatBrush !== undefined) this.setFlatBrush(state.flatBrush);
    if (state.smoothing !== undefined) this.setSmoothing(state.smoothing);
    if (state.activeLayer !== undefined) this.setActiveLayer(state.activeLayer);
    if (state.layerVisibility) {
      state.layerVisibility.forEach((v, i) => this.setLayerVisible(i, v));
    }
    if (state.camera) this.setCamera(state.camera);
    // Pages, views, strokes are complex - would need full restore
  }

  _getStrokesState() {
    if (typeof strokes !== 'undefined') {
      return strokes.map(s => ({
        pts: s.pts?.map(p => ({ x: p.x, y: p.y, z: p.z })) || [],
        color: s.color,
        sz: s.sz,
        op: s.op,
        flat: s.flat,
        layer: s.layer,
        mx: s.mesh?.matrix?.elements?.slice() || []
      }));
    }
    return [];
  }

  _getSurfaceState() {
    return {
      type: typeof surfType !== 'undefined' ? surfType : 'plane',
      plane: typeof curPlane !== 'undefined' ? curPlane : 'xz',
      position: typeof surfPos !== 'undefined' ? { x: surfPos.x, y: surfPos.y, z: surfPos.z } : { x: 0, y: 0, z: 0 },
      rotation: typeof surfEuler !== 'undefined' ? { x: surfEuler.x, y: surfEuler.y, z: surfEuler.z } : { x: 0, y: 0, z: 0 },
      scale: typeof surfScale !== 'undefined' ? surfScale : 1,
      scaleAxes: typeof surfScaleAxes !== 'undefined' ? { x: surfScaleAxes.x, y: surfScaleAxes.y, z: surfScaleAxes.z } : { x: 1, y: 1, z: 1 }
    };
  }

  _syncState() {
    EventBusInstance.emit('stateChanged', this.getState());
  }

  // Event system
  on(event, handler) {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event).add(handler);
  }

  off(event, handler) {
    const handlers = this._eventHandlers.get(event);
    if (handlers) handlers.delete(handler);
  }

  _emit(event, data) {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(h => {
        try { h(data); } catch (e) { console.error('[EngineAdapter] event handler error:', e); }
      });
    }
    EventBusInstance.emit(event, data);
  }
}

export { EngineAdapter };