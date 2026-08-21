// ── SketchbookSDK — public API facade for external platforms ──────
// This is the ONLY entry point for React Native, Electron, Android, etc.
// All engine access goes through this SDK.

import { BridgeInstance } from './Bridge.js';
import { EventBusInstance } from './Events.js';
import { AppStateInstance } from './AppState.js';

class SketchbookSDK {
  constructor() {
    this._engine = null;
    this._initialized = false;
    this._disposed = false;

    // Bind event proxies
    this._eventProxies = new Map();
  }

  setEngine(engine) {
    this._engine = engine;
    BridgeInstance.setEngine(engine);
  }

  getEngine() {
    return this._engine;
  }

  async initialize() {
    if (this._initialized) return this;
    if (!this._engine) {
      throw new Error('SDK: Engine must be set before initialization. Call sdk.setEngine(engine)');
    }

    BridgeInstance.initialize();
    this._initialized = true;

    // Sync initial state
    this._syncStateFromEngine();

    // Forward engine events to SDK event bus
    this._setupEventForwarding();

    return this;
  }

  _syncStateFromEngine() {
    if (!this._engine) return;
    // Engine should expose a getState() method that returns serializable state
    const engineState = this._engine.getState ? this._engine.getState() : {};
    AppStateInstance.replace(engineState);
  }

  _setupEventForwarding() {
    if (!this._engine || !this._engine.on) return;

    const events = [
      'toolChanged', 'colorChanged', 'brushChanged',
      'strokeAdded', 'strokeRemoved', 'strokeTransformed',
      'selectionChanged', 'cameraChanged',
      'layerChanged', 'pageChanged', 'viewChanged',
      'projectLoaded', 'projectSaved',
      'historyChanged', 'renderFinished',
      'exportFinished', 'error'
    ];

    for (const event of events) {
      this._engine.on(event, (data) => {
        EventBusInstance.emit(event, data);
      });
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._initialized = false;
    EventBusInstance.clear();
    BridgeInstance.clearHistory();
    this._engine = null;
  }

  isInitialized() {
    return this._initialized;
  }

  // ─── Public API ───────────────────────────────────────────────────

  // Tool management
  setTool(tool) {
    this._assertInitialized();
    return BridgeInstance.execute('setTool', { tool });
  }

  getTool() {
    return AppStateInstance.get('tool');
  }

  setColor(color) {
    this._assertInitialized();
    return BridgeInstance.execute('setColor', { color });
  }

  getColor() {
    return AppStateInstance.get('color');
  }

  setBrush(options = {}) {
    this._assertInitialized();
    return BridgeInstance.execute('setBrush', options);
  }

  getBrush() {
    return {
      size: AppStateInstance.get('brushSize'),
      opacity: AppStateInstance.get('brushOpacity'),
      flat: AppStateInstance.get('flatBrush'),
      smoothing: AppStateInstance.get('smoothing')
    };
  }

  // Drawing
  addStroke(points, options = {}) {
    this._assertInitialized();
    return BridgeInstance.execute('addStroke', { points, ...options });
  }

  // History
  undo() {
    this._assertInitialized();
    return BridgeInstance.undo();
  }

  redo() {
    this._assertInitialized();
    return BridgeInstance.redo();
  }

  canUndo() {
    return BridgeInstance.canUndo();
  }

  canRedo() {
    return BridgeInstance.canRedo();
  }

  getHistory() {
    return BridgeInstance.getHistory();
  }

  // Selection
  selectObject(id, addToSelection = false) {
    this._assertInitialized();
    return BridgeInstance.execute('selectObject', { id, addToSelection });
  }

  clearSelection() {
    this._assertInitialized();
    return BridgeInstance.execute('selectObject', { id: undefined });
  }

  getSelection() {
    return AppStateInstance.get('selectedStrokeIds') || [];
  }

  getSelectionCount() {
    return this.getSelection().length;
  }

  deleteSelection() {
    this._assertInitialized();
    return BridgeInstance.execute('deleteSelection', {});
  }

  duplicateSelection() {
    this._assertInitialized();
    return BridgeInstance.execute('duplicateSelection', {});
  }

  // Camera
  setCamera(camera) {
    this._assertInitialized();
    return BridgeInstance.execute('setCamera', camera);
  }

  getCamera() {
    return AppStateInstance.get('camera');
  }

  // Layers
  setActiveLayer(layer) {
    this._assertInitialized();
    return BridgeInstance.execute('setLayer', { layer });
  }

  getActiveLayer() {
    return AppStateInstance.get('activeLayer');
  }

  setLayerVisible(index, visible) {
    this._assertInitialized();
    return BridgeInstance.execute('setLayer', { visible: { index, value: visible } });
  }

  getLayerVisibility() {
    return AppStateInstance.get('layerVisibility') || [true, true, true, true];
  }

  // Pages
  addPage() {
    this._assertInitialized();
    return BridgeInstance.execute('page', { action: 'add' });
  }

  deletePage(index) {
    this._assertInitialized();
    return BridgeInstance.execute('page', { action: 'delete', index });
  }

  loadPage(index) {
    this._assertInitialized();
    return BridgeInstance.execute('page', { action: 'load', index });
  }

  saveCurrentPage() {
    this._assertInitialized();
    return BridgeInstance.execute('page', { action: 'save' });
  }

  getPages() {
    return AppStateInstance.get('pages') || [];
  }

  getCurrentPage() {
    return AppStateInstance.get('currentPage');
  }

  // Views
  saveView() {
    this._assertInitialized();
    return BridgeInstance.execute('view', { action: 'save' });
  }

  loadView(index) {
    this._assertInitialized();
    return BridgeInstance.execute('view', { action: 'load', index });
  }

  deleteView(index) {
    this._assertInitialized();
    return BridgeInstance.execute('view', { action: 'delete', index });
  }

  getViews() {
    const pages = this.getPages();
    const currentPage = this.getCurrentPage();
    return pages[currentPage]?.views || [];
  }

  // Project I/O
  loadProject(data) {
    this._assertInitialized();
    return BridgeInstance.execute('loadProject', { data });
  }

  saveProject() {
    this._assertInitialized();
    return BridgeInstance.execute('saveProject', {});
  }

  saveProjectAs(name) {
    this._assertInitialized();
    return BridgeInstance.execute('saveProject', { name });
  }

  // Export
  exportPNG() {
    this._assertInitialized();
    return BridgeInstance.execute('export', { format: 'png' });
  }

  exportGLB(name) {
    this._assertInitialized();
    return BridgeInstance.execute('export', { format: 'glb', name });
  }

  exportOBJ(name) {
    this._assertInitialized();
    return BridgeInstance.execute('export', { format: 'obj', name });
  }

  exportUSD(name) {
    this._assertInitialized();
    return BridgeInstance.execute('export', { format: 'usd', name });
  }

  exportUSDZ(name) {
    this._assertInitialized();
    return BridgeInstance.execute('export', { format: 'usdz', name });
  }

  // Viewport
  resize(width, height) {
    this._assertInitialized();
    return BridgeInstance.execute('resize', { width, height });
  }

  // State
  getState() {
    return AppStateInstance.getAll();
  }

  setState(state) {
    this._assertInitialized();
    AppStateInstance.replace(state);
    if (this._engine && this._engine.applyState) {
      this._engine.applyState(state);
    }
    EventBusInstance.emit('stateReplaced', state);
    return true;
  }

  // Events
  on(event, handler) {
    return EventBusInstance.on(event, handler);
  }

  off(event, handler) {
    EventBusInstance.off(event, handler);
  }

  once(event, handler) {
    return EventBusInstance.once(event, handler);
  }

  emit(event, ...args) {
    EventBusInstance.emit(event, ...args);
  }

  // Bridge access (advanced)
  getBridge() {
    return BridgeInstance;
  }

  // Internal
  _assertInitialized() {
    if (!this._initialized) {
      throw new Error('SDK not initialized. Call sdk.initialize() first.');
    }
    if (this._disposed) {
      throw new Error('SDK has been disposed.');
    }
    if (!this._engine) {
      throw new Error('Engine not set. Call sdk.setEngine(engine) first.');
    }
  }
}

const SketchbookSDKInstance = new SketchbookSDK();

export { SketchbookSDK, SketchbookSDKInstance };
export default SketchbookSDKInstance;