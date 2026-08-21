"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };

  // src/sdk/Events.js
  var EventBus = class {
    constructor() {
      this._events = /* @__PURE__ */ new Map();
      this._onceEvents = /* @__PURE__ */ new Map();
    }
    on(event, handler) {
      if (!this._events.has(event)) {
        this._events.set(event, /* @__PURE__ */ new Set());
      }
      this._events.get(event).add(handler);
      return () => this.off(event, handler);
    }
    once(event, handler) {
      if (!this._onceEvents.has(event)) {
        this._onceEvents.set(event, /* @__PURE__ */ new Set());
      }
      this._onceEvents.get(event).add(handler);
      return () => this.offOnce(event, handler);
    }
    off(event, handler) {
      const handlers = this._events.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this._events.delete(event);
        }
      }
    }
    offOnce(event, handler) {
      const handlers = this._onceEvents.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this._onceEvents.delete(event);
        }
      }
    }
    emit(event, ...args) {
      const handlers = this._events.get(event);
      if (handlers) {
        handlers.forEach((h) => {
          try {
            h(...args);
          } catch (e) {
            console.error("[EventBus] handler error:", e);
          }
        });
      }
      const onceHandlers = this._onceEvents.get(event);
      if (onceHandlers) {
        onceHandlers.forEach((h) => {
          try {
            h(...args);
          } catch (e) {
            console.error("[EventBus] once handler error:", e);
          }
        });
        this._onceEvents.delete(event);
      }
    }
    clear(event) {
      if (event) {
        this._events.delete(event);
        this._onceEvents.delete(event);
      } else {
        this._events.clear();
        this._onceEvents.clear();
      }
    }
    hasListeners(event) {
      const handlers = this._events.get(event);
      const onceHandlers = this._onceEvents.get(event);
      return handlers && handlers.size > 0 || onceHandlers && onceHandlers.size > 0;
    }
    listenerCount(event) {
      const handlers = this._events.get(event);
      const onceHandlers = this._onceEvents.get(event);
      return ((handlers == null ? void 0 : handlers.size) || 0) + ((onceHandlers == null ? void 0 : onceHandlers.size) || 0);
    }
  };
  var EventBusInstance = new EventBus();

  // src/sdk/Commands.js
  var Command = class {
    constructor(payload = {}) {
      var _a;
      this.payload = payload;
      this.id = ((_a = crypto.randomUUID) == null ? void 0 : _a.call(crypto)) || Math.random().toString(36).slice(2);
      this.timestamp = Date.now();
      this._executed = false;
    }
    async execute(context) {
      throw new Error("Command.execute() must be implemented");
    }
    async undo(context) {
      throw new Error("Command.undo() must be implemented");
    }
    canUndo() {
      return true;
    }
    getDescription() {
      return this.constructor.name;
    }
  };
  var CommandRegistry = class {
    constructor() {
      this._commands = /* @__PURE__ */ new Map();
      this._history = [];
      this._historyIndex = -1;
      this._maxHistory = 100;
    }
    register(name, commandClass) {
      this._commands.set(name, commandClass);
    }
    get(name) {
      return this._commands.get(name);
    }
    has(name) {
      return this._commands.has(name);
    }
    list() {
      return Array.from(this._commands.keys());
    }
    async execute(name, payload, context) {
      const CommandClass = this._commands.get(name);
      if (!CommandClass) {
        throw new Error(`Command not found: ${name}`);
      }
      const command = new CommandClass(payload);
      const result = await command.execute(context);
      if (command.canUndo()) {
        this._history = this._history.slice(0, this._historyIndex + 1);
        this._history.push(command);
        if (this._history.length > this._maxHistory) {
          this._history.shift();
        } else {
          this._historyIndex++;
        }
      }
      EventBusInstance.emit("commandExecuted", { name, payload, result, command });
      return result;
    }
    async undo(context) {
      if (this._historyIndex < 0) return false;
      const command = this._history[this._historyIndex];
      await command.undo(context);
      this._historyIndex--;
      EventBusInstance.emit("commandUndone", { command });
      return true;
    }
    async redo(context) {
      if (this._historyIndex >= this._history.length - 1) return false;
      this._historyIndex++;
      const command = this._history[this._historyIndex];
      await command.execute(context);
      EventBusInstance.emit("commandRedone", { command });
      return true;
    }
    canUndo() {
      return this._historyIndex >= 0;
    }
    canRedo() {
      return this._historyIndex < this._history.length - 1;
    }
    getHistory() {
      return this._history.map((c, i) => ({
        index: i,
        name: c.constructor.name,
        description: c.getDescription(),
        timestamp: c.timestamp,
        current: i === this._historyIndex
      }));
    }
    clear() {
      this._history = [];
      this._historyIndex = -1;
    }
  };
  var CommandRegistryInstance = new CommandRegistry();

  // src/sdk/AppState.js
  var AppState = class _AppState {
    constructor() {
      this._state = {
        // Tool state
        tool: "draw",
        prevDrawMode: "draw",
        color: "#000000",
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
          type: "plane",
          plane: "xz",
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
        version: "4.3"
      };
      this._listeners = /* @__PURE__ */ new Map();
    }
    get(key) {
      const keys = key.split(".");
      let value = this._state;
      for (const k of keys) {
        if (value === void 0 || value === null) return void 0;
        value = value[k];
      }
      return value;
    }
    set(key, value) {
      const keys = key.split(".");
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
        this._listeners.set(key, /* @__PURE__ */ new Set());
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
        handlers.forEach((h) => {
          try {
            h(value, oldValue, key);
          } catch (e) {
            console.error("[AppState] listener error:", e);
          }
        });
      }
      EventBusInstance.emit("stateChanged", { key, value, oldValue });
    }
    _notifyAll() {
      EventBusInstance.emit("stateReplaced", this.getAll());
    }
    // Serialization helpers
    toJSON() {
      return this.getAll();
    }
    static fromJSON(json) {
      const state = new _AppState();
      state.replace(json);
      return state;
    }
  };
  var AppStateInstance = new AppState();

  // src/sdk/commands/SetToolCommand.js
  var SetToolCommand = class extends Command {
    async execute(context) {
      const { tool } = this.payload;
      const validTools = ["draw", "erase", "select", "pan", "orbit"];
      if (!validTools.includes(tool)) {
        throw new Error(`Invalid tool: ${tool}. Valid: ${validTools.join(", ")}`);
      }
      context.engine.setTool(tool);
      return { tool };
    }
    async undo(context) {
      const prevTool = context.engine.getState().prevDrawMode || "draw";
      context.engine.setTool(prevTool);
    }
  };

  // src/sdk/commands/SetColorCommand.js
  var SetColorCommand = class extends Command {
    async execute(context) {
      const { color } = this.payload;
      if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
        throw new Error("Invalid color format. Expected #RRGGBB");
      }
      const prevColor = context.engine.getState().color;
      context.engine.setColor(color);
      this.payload._prevColor = prevColor;
      return { color };
    }
    async undo(context) {
      if (this.payload._prevColor) {
        context.engine.setColor(this.payload._prevColor);
      }
    }
  };

  // src/sdk/commands/SetBrushCommand.js
  var SetBrushCommand = class extends Command {
    async execute(context) {
      const { size, opacity, flat, smoothing } = this.payload;
      const state = context.engine.getState();
      const prev = {
        size: state.brushSize,
        opacity: state.brushOpacity,
        flat: state.flatBrush,
        smoothing: state.smoothing
      };
      if (size !== void 0) {
        const s = Math.max(0.1, Math.min(100, Number(size)));
        context.engine.setBrushSize(s);
      }
      if (opacity !== void 0) {
        const o = Math.max(0, Math.min(1, Number(opacity)));
        context.engine.setBrushOpacity(o);
      }
      if (flat !== void 0) {
        context.engine.setFlatBrush(Boolean(flat));
      }
      if (smoothing !== void 0) {
        context.engine.setSmoothing(Boolean(smoothing));
      }
      this.payload._prev = prev;
      return __spreadValues(__spreadValues({}, prev), this.payload);
    }
    async undo(context) {
      if (this.payload._prev) {
        const { size, opacity, flat, smoothing } = this.payload._prev;
        if (size !== void 0) context.engine.setBrushSize(size);
        if (opacity !== void 0) context.engine.setBrushOpacity(opacity);
        if (flat !== void 0) context.engine.setFlatBrush(flat);
        if (smoothing !== void 0) context.engine.setSmoothing(smoothing);
      }
    }
  };

  // src/sdk/commands/UndoCommand.js
  var UndoCommand = class extends Command {
    async execute(context) {
      const result = await context.engine.undo();
      return { success: result };
    }
  };

  // src/sdk/commands/RedoCommand.js
  var RedoCommand = class extends Command {
    async execute(context) {
      const result = await context.engine.redo();
      return { success: result };
    }
  };

  // src/sdk/commands/ExportCommand.js
  var ExportCommand = class extends Command {
    async execute(context) {
      const { format, name } = this.payload;
      const validFormats = ["png", "glb", "obj", "usd", "usdz"];
      if (!validFormats.includes(format)) {
        throw new Error(`Invalid export format: ${format}. Valid: ${validFormats.join(", ")}`);
      }
      let result;
      switch (format) {
        case "png":
          result = await context.engine.exportPNG();
          break;
        case "glb":
          result = await context.engine.exportGLB(name);
          break;
        case "obj":
          result = await context.engine.exportOBJ(name);
          break;
        case "usd":
          result = await context.engine.exportUSD(name);
          break;
        case "usdz":
          result = await context.engine.exportUSDZ(name);
          break;
      }
      return { format, name, result };
    }
  };

  // src/sdk/commands/LoadProjectCommand.js
  var LoadProjectCommand = class extends Command {
    async execute(context) {
      const { data } = this.payload;
      if (!data) throw new Error("LoadProjectCommand requires data payload");
      await context.engine.loadProject(data);
      return { success: true };
    }
  };

  // src/sdk/commands/SaveProjectCommand.js
  var SaveProjectCommand = class extends Command {
    async execute(context) {
      const { name } = this.payload;
      const data = context.engine.saveProject();
      if (name) {
        await context.engine.saveProjectAs(name);
      }
      return { data, name };
    }
  };

  // src/sdk/commands/SelectObjectCommand.js
  var SelectObjectCommand = class extends Command {
    async execute(context) {
      const { id, addToSelection } = this.payload;
      if (id === void 0) {
        context.engine.clearSelection();
        return { cleared: true };
      }
      const result = context.engine.selectObject(id, addToSelection);
      return { id, selected: result };
    }
    async undo(context) {
      context.engine.clearSelection();
    }
  };

  // src/sdk/commands/DeleteSelectionCommand.js
  var DeleteSelectionCommand = class extends Command {
    async execute(context) {
      const count = context.engine.getSelectionCount();
      if (count === 0) return { deleted: 0 };
      context.engine.deleteSelection();
      return { deleted: count };
    }
    async undo(context) {
      await context.bridge.undo();
    }
  };

  // src/sdk/commands/DuplicateSelectionCommand.js
  var DuplicateSelectionCommand = class extends Command {
    async execute(context) {
      const count = context.engine.getSelectionCount();
      if (count === 0) return { duplicated: 0 };
      context.engine.duplicateSelection();
      return { duplicated: count };
    }
    async undo(context) {
      await context.bridge.undo();
    }
  };

  // src/sdk/commands/CameraCommand.js
  var CameraCommand = class extends Command {
    async execute(context) {
      const { theta, phi, radius, target, ortho, orthoZoom: orthoZoom2 } = this.payload;
      const prev = context.engine.getCamera();
      const camera = {};
      if (theta !== void 0) camera.theta = Number(theta);
      if (phi !== void 0) camera.phi = Number(phi);
      if (radius !== void 0) camera.radius = Math.max(0.1, Number(radius));
      if (target) camera.target = __spreadValues(__spreadValues({}, prev.target), target);
      if (ortho !== void 0) camera.ortho = Boolean(ortho);
      if (orthoZoom2 !== void 0) camera.orthoZoom = Number(orthoZoom2);
      this.payload._prev = prev;
      context.engine.setCamera(camera);
      return { camera, prev };
    }
    async undo(context) {
      if (this.payload._prev) {
        context.engine.setCamera(this.payload._prev);
      }
    }
  };

  // src/sdk/commands/AddStrokeCommand.js
  var AddStrokeCommand = class extends Command {
    async execute(context) {
      const { points, color, size, opacity, flat, layer } = this.payload;
      const strokeId = context.engine.addStroke({
        points,
        color: color || context.engine.getState().color,
        size: size || context.engine.getState().brushSize,
        opacity: opacity || context.engine.getState().brushOpacity,
        flat: flat !== void 0 ? flat : context.engine.getState().flatBrush,
        layer: layer !== void 0 ? layer : context.engine.getState().activeLayer
      });
      return { strokeId };
    }
    async undo(context) {
      await context.bridge.undo();
    }
  };

  // src/sdk/commands/SetLayerCommand.js
  var SetLayerCommand = class extends Command {
    async execute(context) {
      const { layer, visible } = this.payload;
      const prevLayer = context.engine.getState().activeLayer;
      const prevVisibility = [...context.engine.getState().layerVisibility];
      if (layer !== void 0) {
        const l = Math.max(0, Math.min(3, Number(layer)));
        context.engine.setActiveLayer(l);
      }
      if (visible !== void 0) {
        if (Array.isArray(visible)) {
          visible.forEach((v, i) => context.engine.setLayerVisible(i, v));
        } else if (typeof visible === "object" && visible.index !== void 0) {
          context.engine.setLayerVisible(visible.index, visible.value);
        }
      }
      this.payload._prev = { layer: prevLayer, visibility: prevVisibility };
      return { layer: context.engine.getState().activeLayer };
    }
    async undo(context) {
      if (this.payload._prev) {
        context.engine.setActiveLayer(this.payload._prev.layer);
        this.payload._prev.visibility.forEach((v, i) => context.engine.setLayerVisible(i, v));
      }
    }
  };

  // src/sdk/commands/PageCommand.js
  var PageCommand = class extends Command {
    async execute(context) {
      const { action, index } = this.payload;
      let result;
      switch (action) {
        case "add":
          result = context.engine.addPage();
          break;
        case "delete":
          if (index === void 0) throw new Error("Page delete requires index");
          result = context.engine.deletePage(index);
          break;
        case "load":
          if (index === void 0) throw new Error("Page load requires index");
          result = context.engine.loadPage(index);
          break;
        case "save":
          result = context.engine.saveCurrentPage();
          break;
        default:
          throw new Error(`Unknown page action: ${action}`);
      }
      return { action, index, result };
    }
  };

  // src/sdk/commands/ViewCommand.js
  var ViewCommand = class extends Command {
    async execute(context) {
      const { action, index, viewData } = this.payload;
      let result;
      switch (action) {
        case "save":
          result = context.engine.saveView();
          break;
        case "load":
          if (index === void 0) throw new Error("View load requires index");
          result = context.engine.recallView(index);
          break;
        case "delete":
          if (index === void 0) throw new Error("View delete requires index");
          result = context.engine.deleteView(index);
          break;
        default:
          throw new Error(`Unknown view action: ${action}`);
      }
      return { action, index, result };
    }
  };

  // src/sdk/commands/ResizeCommand.js
  var ResizeCommand = class extends Command {
    async execute(context) {
      const { width, height } = this.payload;
      if (!width || !height) throw new Error("ResizeCommand requires width and height");
      context.engine.resize(width, height);
      return { width, height };
    }
  };

  // src/sdk/Bridge.js
  var Bridge = class {
    constructor() {
      this._engine = null;
      this._initialized = false;
      this._commandMap = /* @__PURE__ */ new Map();
      this._registerCommands();
    }
    _registerCommands() {
      this._commandMap.set("setTool", SetToolCommand);
      this._commandMap.set("setColor", SetColorCommand);
      this._commandMap.set("setBrush", SetBrushCommand);
      this._commandMap.set("undo", UndoCommand);
      this._commandMap.set("redo", RedoCommand);
      this._commandMap.set("export", ExportCommand);
      this._commandMap.set("loadProject", LoadProjectCommand);
      this._commandMap.set("saveProject", SaveProjectCommand);
      this._commandMap.set("selectObject", SelectObjectCommand);
      this._commandMap.set("deleteSelection", DeleteSelectionCommand);
      this._commandMap.set("duplicateSelection", DuplicateSelectionCommand);
      this._commandMap.set("setCamera", CameraCommand);
      this._commandMap.set("addStroke", AddStrokeCommand);
      this._commandMap.set("setLayer", SetLayerCommand);
      this._commandMap.set("page", PageCommand);
      this._commandMap.set("view", ViewCommand);
      this._commandMap.set("resize", ResizeCommand);
      for (const [name, CommandClass] of this._commandMap) {
        CommandRegistryInstance.register(name, CommandClass);
      }
    }
    setEngine(engine) {
      this._engine = engine;
    }
    getEngine() {
      return this._engine;
    }
    initialize() {
      if (this._initialized) return;
      this._initialized = true;
      EventBusInstance.emit("bridgeReady", this);
    }
    execute(commandName, payload = {}) {
      if (!this._engine) {
        throw new Error("Bridge: Engine not set. Call bridge.setEngine(engine) first.");
      }
      const CommandClass = this._commandMap.get(commandName);
      if (!CommandClass) {
        throw new Error(`Bridge: Unknown command: ${commandName}`);
      }
      const command = new CommandClass(payload);
      const context = {
        engine: this._engine,
        bridge: this,
        appState: AppStateInstance
      };
      return command.execute(context);
    }
    async undo() {
      if (!this._engine) return false;
      return await CommandRegistryInstance.undo({ engine: this._engine, bridge: this, appState: AppStateInstance });
    }
    async redo() {
      if (!this._engine) return false;
      return await CommandRegistryInstance.redo({ engine: this._engine, bridge: this, appState: AppStateInstance });
    }
    canUndo() {
      return CommandRegistryInstance.canUndo();
    }
    canRedo() {
      return CommandRegistryInstance.canRedo();
    }
    getHistory() {
      return CommandRegistryInstance.getHistory();
    }
    clearHistory() {
      CommandRegistryInstance.clear();
    }
    registerCommand(name, CommandClass) {
      this._commandMap.set(name, CommandClass);
      CommandRegistryInstance.register(name, CommandClass);
    }
    getCommand(name) {
      return this._commandMap.get(name);
    }
    listCommands() {
      return Array.from(this._commandMap.keys());
    }
  };
  var BridgeInstance = new Bridge();

  // src/sdk/EngineAdapter.js
  var EngineAdapter = class {
    constructor() {
      this._eventHandlers = /* @__PURE__ */ new Map();
      this._initialized = false;
    }
    initialize() {
      if (this._initialized) return;
      this._initialized = true;
      this._hookGlobalEvents();
    }
    _hookGlobalEvents() {
    }
    // ─── Engine Interface Methods ────────────────────────────────────
    // Tool management
    setTool(tool) {
      if (typeof setMode === "function") {
        setMode(tool);
        this._emit("toolChanged", { tool });
      }
    }
    setColor(color) {
      if (typeof curColor !== "undefined") {
        curColor = color;
        this._emit("colorChanged", { color });
      }
    }
    setBrushSize(size) {
      if (typeof brushSz !== "undefined") {
        brushSz = size;
        this._emit("brushChanged", { size });
      }
    }
    setBrushOpacity(opacity) {
      if (typeof brushOp !== "undefined") {
        brushOp = opacity;
        this._emit("brushChanged", { opacity });
      }
    }
    setFlatBrush(flat) {
      if (typeof flatBrush !== "undefined") {
        flatBrush = flat;
        this._emit("brushChanged", { flat });
      }
    }
    setSmoothing(smoothing) {
      if (typeof smoothingOn !== "undefined") {
        smoothingOn = smoothing;
        LAZY = smoothing ? LAZY_ON : LAZY_OFF;
        this._emit("brushChanged", { smoothing });
      }
    }
    // Drawing
    addStroke(options) {
      const opts = options || {};
      const pts = (opts.points || []).map(function(p) {
        return new THREE.Vector3(p.x, p.y, p.z);
      });
      if (!pts.length) return null;
      const color = opts.color != null ? opts.color : typeof curColor !== "undefined" ? curColor : "#000000";
      const sz = opts.size != null ? opts.size : typeof brushSz !== "undefined" ? brushSz : 1;
      const op = opts.opacity != null ? opts.opacity : typeof brushOp !== "undefined" ? brushOp : 0.95;
      const flat = opts.flat != null ? opts.flat : typeof flatBrush !== "undefined" ? flatBrush : false;
      const layer = opts.layer != null ? opts.layer : typeof activeLayer !== "undefined" ? activeLayer : 1;
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
        pts,
        vels,
        color,
        sz,
        op,
        flat,
        layer,
        mesh: g,
        _depthKey: ""
      };
      strokes.push(stroke);
      if (typeof markDirty === "function") markDirty();
      this._emit("strokeAdded", { index: strokes.length - 1 });
      return { index: strokes.length - 1 };
    }
    // History
    undo() {
      if (typeof undo === "function") {
        undo();
        this._emit("historyChanged", { canUndo: this.canUndo(), canRedo: this.canRedo() });
        return true;
      }
      return false;
    }
    redo() {
      if (typeof redo === "function") {
        redo();
        this._emit("historyChanged", { canUndo: this.canUndo(), canRedo: this.canRedo() });
        return true;
      }
      return false;
    }
    canUndo() {
      return typeof _undoStack !== "undefined" && _undoStack.length > 0;
    }
    canRedo() {
      return typeof _redoStack !== "undefined" && _redoStack.length > 0;
    }
    // Selection
    selectObject(id, addToSelection) {
      if (typeof strokes === "undefined" || typeof selectedStrokes === "undefined") return false;
      let idx = -1;
      if (typeof id === "number") idx = id;
      else if (typeof id === "string") {
        const m = id.match(/^stroke_(\d+)$/);
        if (m) idx = parseInt(m[1], 10);
      }
      if (idx < 0 || idx >= strokes.length) return false;
      selectedStrokes.length = 0;
      selectedStrokes.push(strokes[idx]);
      if (typeof markDirty === "function") markDirty();
      this._emit("selectionChanged", { selectedIds: this.getSelection() });
      return true;
    }
    getSelection() {
      if (typeof selectedStrokes !== "undefined") {
        return selectedStrokes.map((s, i) => ({ index: i, id: s._depthKey || `stroke_${i}` }));
      }
      return [];
    }
    clearSelection() {
      if (typeof clearSelection === "function") {
        clearSelection();
        this._emit("selectionChanged", { selectedIds: [] });
      }
    }
    deleteSelection() {
      if (typeof deleteSelected === "function") {
        deleteSelected();
        this._emit("strokeRemoved", {});
      }
    }
    duplicateSelection() {
      if (typeof duplicateSelected === "function") {
        duplicateSelected();
        this._emit("strokeAdded", {});
      }
    }
    // Camera
    setCamera(camera) {
      if (typeof cam !== "undefined") {
        const prev = __spreadValues({}, cam);
        if (camera.theta !== void 0) cam.theta = camera.theta;
        if (camera.phi !== void 0) cam.phi = camera.phi;
        if (camera.radius !== void 0) cam.radius = camera.radius;
        if (camera.target) {
          if (camera.target.x !== void 0) cam.target.x = camera.target.x;
          if (camera.target.y !== void 0) cam.target.y = camera.target.y;
          if (camera.target.z !== void 0) cam.target.z = camera.target.z;
        }
        if (typeof updCam === "function") updCam();
        if (typeof markDirty === "function") markDirty();
        this._emit("cameraChanged", { camera: this.getCamera(), prev });
      }
    }
    getCamera() {
      if (typeof cam !== "undefined") {
        return {
          theta: cam.theta,
          phi: cam.phi,
          radius: cam.radius,
          target: { x: cam.target.x, y: cam.target.y, z: cam.target.z },
          ortho: typeof useOrtho !== "undefined" ? useOrtho : false,
          orthoZoom: typeof orthoZoom !== "undefined" ? orthoZoom : 8
        };
      }
      return null;
    }
    // Layers
    setActiveLayer(layer) {
      if (typeof setActiveLayer === "function") {
        setActiveLayer(layer);
        this._emit("layerChanged", { activeLayer: layer });
      }
    }
    setLayerVisible(index, visible) {
      if (typeof setLayerVisible === "function") {
        setLayerVisible(index, visible);
        this._emit("layerChanged", { layerVisibility: this.getLayerVisibility() });
      }
    }
    getLayerVisibility() {
      if (typeof layerVisible !== "undefined") {
        return [...layerVisible];
      }
      return [true, true, true, true];
    }
    // Pages
    addPage() {
      if (typeof addPage === "function") {
        addPage();
        this._emit("pageChanged", { currentPage: this.getCurrentPage(), pages: this.getPages() });
      }
    }
    deletePage(index) {
      if (typeof deletePage === "function") {
        deletePage(index);
        this._emit("pageChanged", { currentPage: this.getCurrentPage(), pages: this.getPages() });
      }
    }
    loadPage(index) {
      if (typeof loadPage === "function") {
        loadPage(index);
        this._emit("pageChanged", { currentPage: this.getCurrentPage(), pages: this.getPages() });
      }
    }
    saveCurrentPage() {
      if (typeof saveCurPage === "function") {
        saveCurPage();
      }
    }
    getPages() {
      if (typeof pages !== "undefined") {
        return pages.map((p, i) => {
          var _a, _b;
          return {
            index: i,
            strokeCount: ((_a = p.strokes) == null ? void 0 : _a.length) || 0,
            thumb: p.thumb,
            views: ((_b = p.views) == null ? void 0 : _b.length) || 0
          };
        });
      }
      return [];
    }
    getCurrentPage() {
      if (typeof curPage !== "undefined") return curPage;
      return 0;
    }
    // Views
    saveView() {
      if (typeof saveView === "function") {
        saveView();
        this._emit("viewChanged", { views: this.getViews() });
      }
    }
    recallView(index) {
      if (typeof recallView === "function") {
        const views = this.getViews();
        if (views[index]) {
          recallView(views[index]);
          this._emit("cameraChanged", { camera: this.getCamera() });
        }
      }
    }
    deleteView(index) {
      if (typeof deleteView === "function") {
        deleteView(index);
        this._emit("viewChanged", { views: this.getViews() });
      }
    }
    getViews() {
      var _a;
      if (typeof pages !== "undefined" && typeof curPage !== "undefined") {
        return ((_a = pages[curPage]) == null ? void 0 : _a.views) || [];
      }
      return [];
    }
    // Project I/O
    loadProject(data) {
      if (typeof loadAllPages === "function") {
        loadAllPages(data);
        this._emit("projectLoaded", { data });
        this._syncState();
      }
    }
    saveProject() {
      if (typeof sceneData === "function") {
        return sceneData();
      }
      return null;
    }
    saveProjectAs(name) {
      if (typeof _doSaveFile === "function") {
        _doSaveFile(name);
      }
    }
    // Export (returns base64 payload so RN can write to native FS)
    exportPNG() {
      if (typeof expPNG === "function") {
        const data = expPNG(true);
        if (data) {
          this._emit("exportFinished", { format: "png" });
          return { data, mime: "image/png", ext: "png" };
        }
      }
      return null;
    }
    exportGLB(name) {
      if (typeof expGLTF === "function") {
        const data = expGLTF(name, true);
        if (data) {
          this._emit("exportFinished", { format: "glb" });
          return { data, mime: "model/gltf-binary", ext: "glb" };
        }
      }
      return null;
    }
    exportOBJ(name) {
      if (typeof expOBJ === "function") {
        const data = expOBJ(name, true);
        if (data) {
          this._emit("exportFinished", { format: "obj" });
          return { data, mime: "text/plain", ext: "obj" };
        }
      }
      return null;
    }
    exportUSD(name) {
      if (typeof expUSD === "function") {
        const data = expUSD(name, true);
        if (data) {
          this._emit("exportFinished", { format: "usd" });
          return { data, mime: "model/vnd.usda", ext: "usd" };
        }
      }
      return null;
    }
    exportUSDZ(name) {
      if (typeof expUSDZ === "function") {
        const data = expUSDZ(name, true);
        if (data) {
          this._emit("exportFinished", { format: "usdz" });
          return { data, mime: "model/vnd.usdz+zip", ext: "usdz" };
        }
      }
      return null;
    }
    // Viewport
    resize(width, height) {
      if (typeof renderer !== "undefined" && renderer.setSize) {
        renderer.setSize(width, height);
        if (typeof _syncRenderer === "function") _syncRenderer();
        if (typeof markDirty === "function") markDirty();
      }
    }
    // State
    getState() {
      var _a, _b;
      return {
        tool: typeof mode !== "undefined" ? mode : "draw",
        prevDrawMode: typeof prevDrawMode !== "undefined" ? prevDrawMode : "draw",
        color: typeof curColor !== "undefined" ? curColor : "#000000",
        brushSize: typeof brushSz !== "undefined" ? brushSz : 1,
        brushOpacity: typeof brushOp !== "undefined" ? brushOp : 0.95,
        flatBrush: typeof flatBrush !== "undefined" ? flatBrush : false,
        smoothing: typeof smoothingOn !== "undefined" ? smoothingOn : false,
        strokes: this._getStrokesState(),
        selectedStrokeIds: this.getSelection().map((s) => s.id),
        activeLayer: typeof activeLayer !== "undefined" ? activeLayer : 0,
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
          hidden: document.body.classList.contains("ui-hidden"),
          pagesOpen: ((_a = document.getElementById("pages")) == null ? void 0 : _a.classList.contains("open")) || false,
          viewsOpen: ((_b = document.getElementById("views")) == null ? void 0 : _b.classList.contains("open")) || false
        },
        exportScaleIndex: typeof exportScaleIdx !== "undefined" ? exportScaleIdx : 0,
        undoStackSize: typeof _undoStack !== "undefined" ? _undoStack.length : 0,
        redoStackSize: typeof _redoStack !== "undefined" ? _redoStack.length : 0,
        version: "4.3"
      };
    }
    applyState(state) {
      if (state.tool) this.setTool(state.tool);
      if (state.color) this.setColor(state.color);
      if (state.brushSize) this.setBrushSize(state.brushSize);
      if (state.brushOpacity) this.setBrushOpacity(state.brushOpacity);
      if (state.flatBrush !== void 0) this.setFlatBrush(state.flatBrush);
      if (state.smoothing !== void 0) this.setSmoothing(state.smoothing);
      if (state.activeLayer !== void 0) this.setActiveLayer(state.activeLayer);
      if (state.layerVisibility) {
        state.layerVisibility.forEach((v, i) => this.setLayerVisible(i, v));
      }
      if (state.camera) this.setCamera(state.camera);
    }
    _getStrokesState() {
      if (typeof strokes !== "undefined") {
        return strokes.map((s) => {
          var _a, _b, _c, _d;
          return {
            pts: ((_a = s.pts) == null ? void 0 : _a.map((p) => ({ x: p.x, y: p.y, z: p.z }))) || [],
            color: s.color,
            sz: s.sz,
            op: s.op,
            flat: s.flat,
            layer: s.layer,
            mx: ((_d = (_c = (_b = s.mesh) == null ? void 0 : _b.matrix) == null ? void 0 : _c.elements) == null ? void 0 : _d.slice()) || []
          };
        });
      }
      return [];
    }
    _getSurfaceState() {
      return {
        type: typeof surfType !== "undefined" ? surfType : "plane",
        plane: typeof curPlane !== "undefined" ? curPlane : "xz",
        position: typeof surfPos !== "undefined" ? { x: surfPos.x, y: surfPos.y, z: surfPos.z } : { x: 0, y: 0, z: 0 },
        rotation: typeof surfEuler !== "undefined" ? { x: surfEuler.x, y: surfEuler.y, z: surfEuler.z } : { x: 0, y: 0, z: 0 },
        scale: typeof surfScale !== "undefined" ? surfScale : 1,
        scaleAxes: typeof surfScaleAxes !== "undefined" ? { x: surfScaleAxes.x, y: surfScaleAxes.y, z: surfScaleAxes.z } : { x: 1, y: 1, z: 1 }
      };
    }
    _syncState() {
      EventBusInstance.emit("stateChanged", this.getState());
    }
    // Event system
    on(event, handler) {
      if (!this._eventHandlers.has(event)) {
        this._eventHandlers.set(event, /* @__PURE__ */ new Set());
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
        handlers.forEach((h) => {
          try {
            h(data);
          } catch (e) {
            console.error("[EngineAdapter] event handler error:", e);
          }
        });
      }
      EventBusInstance.emit(event, data);
    }
  };

  // src/sdk/SketchbookSDK.js
  var SketchbookSDK = class {
    constructor() {
      this._engine = null;
      this._initialized = false;
      this._disposed = false;
      this._eventProxies = /* @__PURE__ */ new Map();
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
        throw new Error("SDK: Engine must be set before initialization. Call sdk.setEngine(engine)");
      }
      BridgeInstance.initialize();
      this._initialized = true;
      this._syncStateFromEngine();
      this._setupEventForwarding();
      return this;
    }
    _syncStateFromEngine() {
      if (!this._engine) return;
      const engineState = this._engine.getState ? this._engine.getState() : {};
      AppStateInstance.replace(engineState);
    }
    _setupEventForwarding() {
      if (!this._engine || !this._engine.on) return;
      const events = [
        "toolChanged",
        "colorChanged",
        "brushChanged",
        "strokeAdded",
        "strokeRemoved",
        "strokeTransformed",
        "selectionChanged",
        "cameraChanged",
        "layerChanged",
        "pageChanged",
        "viewChanged",
        "projectLoaded",
        "projectSaved",
        "historyChanged",
        "renderFinished",
        "exportFinished",
        "error"
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
      return BridgeInstance.execute("setTool", { tool });
    }
    getTool() {
      return AppStateInstance.get("tool");
    }
    setColor(color) {
      this._assertInitialized();
      return BridgeInstance.execute("setColor", { color });
    }
    getColor() {
      return AppStateInstance.get("color");
    }
    setBrush(options = {}) {
      this._assertInitialized();
      return BridgeInstance.execute("setBrush", options);
    }
    getBrush() {
      return {
        size: AppStateInstance.get("brushSize"),
        opacity: AppStateInstance.get("brushOpacity"),
        flat: AppStateInstance.get("flatBrush"),
        smoothing: AppStateInstance.get("smoothing")
      };
    }
    // Drawing
    addStroke(points, options = {}) {
      this._assertInitialized();
      return BridgeInstance.execute("addStroke", __spreadValues({ points }, options));
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
      return BridgeInstance.execute("selectObject", { id, addToSelection });
    }
    clearSelection() {
      this._assertInitialized();
      return BridgeInstance.execute("selectObject", { id: void 0 });
    }
    getSelection() {
      return AppStateInstance.get("selectedStrokeIds") || [];
    }
    getSelectionCount() {
      return this.getSelection().length;
    }
    deleteSelection() {
      this._assertInitialized();
      return BridgeInstance.execute("deleteSelection", {});
    }
    duplicateSelection() {
      this._assertInitialized();
      return BridgeInstance.execute("duplicateSelection", {});
    }
    // Camera
    setCamera(camera) {
      this._assertInitialized();
      return BridgeInstance.execute("setCamera", camera);
    }
    getCamera() {
      return AppStateInstance.get("camera");
    }
    // Layers
    setActiveLayer(layer) {
      this._assertInitialized();
      return BridgeInstance.execute("setLayer", { layer });
    }
    getActiveLayer() {
      return AppStateInstance.get("activeLayer");
    }
    setLayerVisible(index, visible) {
      this._assertInitialized();
      return BridgeInstance.execute("setLayer", { visible: { index, value: visible } });
    }
    getLayerVisibility() {
      return AppStateInstance.get("layerVisibility") || [true, true, true, true];
    }
    // Pages
    addPage() {
      this._assertInitialized();
      return BridgeInstance.execute("page", { action: "add" });
    }
    deletePage(index) {
      this._assertInitialized();
      return BridgeInstance.execute("page", { action: "delete", index });
    }
    loadPage(index) {
      this._assertInitialized();
      return BridgeInstance.execute("page", { action: "load", index });
    }
    saveCurrentPage() {
      this._assertInitialized();
      return BridgeInstance.execute("page", { action: "save" });
    }
    getPages() {
      return AppStateInstance.get("pages") || [];
    }
    getCurrentPage() {
      return AppStateInstance.get("currentPage");
    }
    // Views
    saveView() {
      this._assertInitialized();
      return BridgeInstance.execute("view", { action: "save" });
    }
    loadView(index) {
      this._assertInitialized();
      return BridgeInstance.execute("view", { action: "load", index });
    }
    deleteView(index) {
      this._assertInitialized();
      return BridgeInstance.execute("view", { action: "delete", index });
    }
    getViews() {
      var _a;
      const pages2 = this.getPages();
      const currentPage = this.getCurrentPage();
      return ((_a = pages2[currentPage]) == null ? void 0 : _a.views) || [];
    }
    // Project I/O
    loadProject(data) {
      this._assertInitialized();
      return BridgeInstance.execute("loadProject", { data });
    }
    saveProject() {
      this._assertInitialized();
      return BridgeInstance.execute("saveProject", {});
    }
    saveProjectAs(name) {
      this._assertInitialized();
      return BridgeInstance.execute("saveProject", { name });
    }
    // Export
    exportPNG() {
      this._assertInitialized();
      return BridgeInstance.execute("export", { format: "png" });
    }
    exportGLB(name) {
      this._assertInitialized();
      return BridgeInstance.execute("export", { format: "glb", name });
    }
    exportOBJ(name) {
      this._assertInitialized();
      return BridgeInstance.execute("export", { format: "obj", name });
    }
    exportUSD(name) {
      this._assertInitialized();
      return BridgeInstance.execute("export", { format: "usd", name });
    }
    exportUSDZ(name) {
      this._assertInitialized();
      return BridgeInstance.execute("export", { format: "usdz", name });
    }
    // Viewport
    resize(width, height) {
      this._assertInitialized();
      return BridgeInstance.execute("resize", { width, height });
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
      EventBusInstance.emit("stateReplaced", state);
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
        throw new Error("SDK not initialized. Call sdk.initialize() first.");
      }
      if (this._disposed) {
        throw new Error("SDK has been disposed.");
      }
      if (!this._engine) {
        throw new Error("Engine not set. Call sdk.setEngine(engine) first.");
      }
    }
  };
  var SketchbookSDKInstance = new SketchbookSDK();

  // scripts/.sdk-entry.generated.mjs
  window.SketchbookBridge = BridgeInstance;
  window.SketchbookEventBus = EventBusInstance;
  window.SketchbookAppState = AppStateInstance;
  window.__EngineAdapter = EngineAdapter;
  window.__SketchbookSDKInstance = SketchbookSDKInstance;
})();
