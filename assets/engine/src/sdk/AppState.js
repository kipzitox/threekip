// ── AppState — single source of truth for project state ──────────
// All engine modules read/write through this.
// The SDK exposes getState() and setState() for serialization.

import { EventBusInstance } from './Events.js';

class AppState {
  constructor() {
    this._state = {
      // Tool state
      tool: 'draw',
      prevDrawMode: 'draw',
      color: '#000000',
      brushSize: 1,
      brushOpacity: 0.95,
      flatBrush: false,
      smoothing: false,

      // Drawing state
      isDrawing: false,
      rawPoints: [],
      smoothPoints: [],
      velHistory: [],
      lazyPos: null,

      // Strokes (serializable representation)
      strokes: [],

      // Selection
      selectedStrokeIds: [],

      // Layers
      activeLayer: 0,
      layerVisibility: [true, true, true, true],

      // Pages
      pages: [],
      currentPage: 0,

      // Camera
      camera: {
        theta: 0.6,
        phi: 0.6,
        radius: 8,
        target: { x: 0, y: 0, z: 0 },
        ortho: false,
        orthoZoom: 8
      },

      // Surface
      surface: {
        type: 'plane',
        plane: 'xz',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
        scaleAxes: { x: 1, y: 1, z: 1 }
      },

      // Viewport
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },

      // UI state
      ui: {
        hidden: false,
        pagesOpen: false,
        viewsOpen: false,
        narrowBarActive: false,
        narrowBarCollapsed: false
      },

      // Export
      exportScaleIndex: 0,

      // History
      undoStackSize: 0,
      redoStackSize: 0,

      // Version
      version: '4.3'
    };

    this._listeners = new Map();
  }

  get(key) {
    const keys = key.split('.');
    let value = this._state;
    for (const k of keys) {
      if (value === undefined || value === null) return undefined;
      value = value[k];
    }
    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    let obj = this._state;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    const oldValue = obj[keys[keys.length - 1]];
    obj[keys[keys.length - 1]] = value;
    this._notify(key, value, oldValue);
  }

  setMultiple(updates) {
    for (const [key, value] of Object.entries(updates)) {
      this.set(key, value);
    }
  }

  getAll() {
    return JSON.parse(JSON.stringify(this._state));
  }

  replace(newState) {
    this._state = newState;
    this._notifyAll();
  }

  on(key, handler) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(handler);
    return () => this.off(key, handler);
  }

  off(key, handler) {
    const handlers = this._listeners.get(key);
    if (handlers) handlers.delete(handler);
  }

  _notify(key, value, oldValue) {
    const handlers = this._listeners.get(key);
    if (handlers) {
      handlers.forEach(h => {
        try { h(value, oldValue, key); } catch (e) { console.error('[AppState] listener error:', e); }
      });
    }
    EventBusInstance.emit('stateChanged', { key, value, oldValue });
  }

  _notifyAll() {
    EventBusInstance.emit('stateReplaced', this.getAll());
  }

  // Serialization helpers
  toJSON() {
    return this.getAll();
  }

  static fromJSON(json) {
    const state = new AppState();
    state.replace(json);
    return state;
  }
}

const AppStateInstance = new AppState();

export { AppState, AppStateInstance };
export default AppStateInstance;