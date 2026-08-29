// ── Sketch3D entry — ES module shell ─────────────────────────────
// The application logic lives in classic scripts grouped by responsibility
// (engine / tools / ui / storage). They share one global scope (THREE, window,
// DOM) and a strictly order-dependent init sequence (00 → 20), so this entry
// loads them sequentially in the exact same order and with the exact same
// classic-script semantics as the previous <script src> tags.
// Also loads the SDK (ES modules) after engine is ready.
//
// Paths are resolved against the document URL (index.html at the root).

const MODULES = [
  'js/engine/00-scene.js',
  'js/engine/01-local-gizmo.js',
  'js/engine/02-core3d.js',
  'js/core/history-manager.js',
  'js/core/selection-manager.js',
  'js/core/layer-manager.js',
  'js/tools/03-drawing.js',
  'js/engine/05-layers.js',
  'js/ui/06-gestures.js',
  'js/core/persistence-manager.js',
  'js/core/page-manager.js',
  'js/core/export-manager.js',
  'js/tools/07-mode-pages.js',
  'js/storage/08-persistence.js',
  'js/storage/09-export.js',
  'js/engine/10-snap-cardgizmo.js',
  'js/engine/11-stroke-gizmo.js',
  'js/engine/12-loft.js',
  'js/engine/13-nav.js',
  'js/ui/14-narrow-cycle.js',
  'js/ui/15-ui-bindings.js',
  'js/ui/16-bg-modals.js',
  'js/ui/17-sidecol.js',
  'js/ui/18-float-card.js',
  'js/core/app.js',
  'js/ui/19-init.js',
  'js/ui/20-theme.js',
];

// SDK modules (ES modules, loaded after classic scripts)
// Absolute paths from document root (index.html)
const SDK_MODULES = [
  '/src/sdk/Events.js',
  '/src/sdk/AppState.js',
  '/src/sdk/Commands.js',
  '/src/sdk/commands/SetToolCommand.js',
  '/src/sdk/commands/SetColorCommand.js',
  '/src/sdk/commands/SetBrushCommand.js',
  '/src/sdk/commands/UndoCommand.js',
  '/src/sdk/commands/RedoCommand.js',
  '/src/sdk/commands/ExportCommand.js',
  '/src/sdk/commands/LoadProjectCommand.js',
  '/src/sdk/commands/SaveProjectCommand.js',
  '/src/sdk/commands/SelectObjectCommand.js',
  '/src/sdk/commands/DeleteSelectionCommand.js',
  '/src/sdk/commands/DuplicateSelectionCommand.js',
  '/src/sdk/commands/CameraCommand.js',
  '/src/sdk/commands/AddStrokeCommand.js',
  '/src/sdk/commands/SetLayerCommand.js',
  '/src/sdk/commands/PageCommand.js',
  '/src/sdk/commands/ViewCommand.js',
  '/src/sdk/commands/ResizeCommand.js',
  '/src/sdk/Bridge.js',
  '/src/sdk/EngineAdapter.js',
  '/src/sdk/SketchbookSDK.js',
];

function loadClassic(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error('Failed to load ' + src)); };
    document.body.appendChild(s);
  });
}

function loadModule(src) {
  return import(src);
}

(async function bootstrap() {
  // 1. Load all classic scripts in order
  for (var i = 0; i < MODULES.length; i++) {
    await loadClassic(MODULES[i]);
  }

  // 2. Wait for App to be initialized (App.init() is called in 19-init.js)
  // Give it a moment to finish initialization
  await new Promise(r => setTimeout(r, 100));

  // 3. Load SDK modules
  for (var i = 0; i < SDK_MODULES.length; i++) {
    try {
      await loadModule(SDK_MODULES[i]);
    } catch (e) {
      console.error('Failed to load SDK module:', SDK_MODULES[i], e);
    }
  }

  // 4. Initialize SDK with EngineAdapter
  try {
    const { EngineAdapter } = await import('/src/sdk/EngineAdapter.js');
    const { SketchbookSDKInstance } = await import('/src/sdk/SketchbookSDK.js');

    const engineAdapter = new EngineAdapter();
    engineAdapter.initialize();

    SketchbookSDKInstance.setEngine(engineAdapter);
    await SketchbookSDKInstance.initialize();

    // Expose globally for debugging / external access
    window.SketchbookSDK = SketchbookSDKInstance;
    window.SketchbookBridge = (await import('/src/sdk/Bridge.js')).BridgeInstance;
    window.SketchbookEventBus = (await import('/src/sdk/Events.js')).EventBusInstance;
    window.SketchbookAppState = (await import('/src/sdk/AppState.js')).AppStateInstance;

    console.log('[Sketch3D] SDK initialized and exposed on window.SketchbookSDK');
  } catch (e) {
    console.error('[Sketch3D] SDK initialization failed:', e);
  }
})();