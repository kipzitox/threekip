// sdk-entry.mjs
// Entry point for the OFFLINE classic bundle of the SDK.
// The SDK is written as ES modules, but Android WebView cannot load ES modules
// over file:// (Chromium blocks module scripts from an opaque "null" origin).
// So we bundle the SDK into a single classic IIFE that exposes the singletons
// on window. The engine (classic scripts) and the generated loader
// (main.classic.js) then consume these globals — no import() over file://.
//
// Relative to this file: ../../src/sdk/...
import { BridgeInstance } from '../../src/sdk/Bridge.js';
import { EventBusInstance } from '../../src/sdk/Events.js';
import { AppStateInstance } from '../../src/sdk/AppState.js';
import { EngineAdapter } from '../../src/sdk/EngineAdapter.js';
import { SketchbookSDKInstance } from '../../src/sdk/SketchbookSDK.js';

window.SketchbookBridge = BridgeInstance;
window.SketchbookEventBus = EventBusInstance;
window.SketchbookAppState = AppStateInstance;
window.__EngineAdapter = EngineAdapter;
window.__SketchbookSDKInstance = SketchbookSDKInstance;
