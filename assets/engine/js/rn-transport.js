// ── RN WebView Transport — host glue only ─────────────────────────
// Connects React Native's <WebView> to the in-page Sketchbook SDK/Bridge.
// The Engine and the SDK under /src/sdk are NOT modified by this file.
// It only reads window.SketchbookBridge / window.SketchbookEventBus (which
// main.js already exposes) and shuttles JSON messages over postMessage.
//
// ── Protocol (every message is a JSON string) ──
//   RN → Web  command : { type:'cmd', id, name, payload }
//                       name    = Bridge command name (setTool, setColor,
//                                 setBrush, undo, redo, export, addStroke,
//                                 selectObject, deleteSelection, duplicateSelection,
//                                 setCamera, setLayer, page, view, resize,
//                                 loadProject, saveProject)
//                       payload = command payload object (see docs/bridge.md)
//   Web → RN  response: { type:'res', id, ok, result?, error? }
//   Web → RN  event   : { type:'evt', event, data }
//   Web → RN  ready   : { type:'ready', version }
//
// Web→RN is sent with window.ReactNativeWebView.postMessage (react-native-webview).
// RN→Web is received as a 'message' event on both window and document (covers
// the webview bridge and a plain parent iframe during local dev).

(function () {
  'use strict';

  function postToRN(msg) {
    var str = JSON.stringify(msg);
    try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(str); } catch (e) {}
    // Dev fallback (page loaded in an iframe / browser) for manual testing.
    try { if (window.parent && window.parent !== window) window.parent.postMessage(str, '*'); } catch (e) {}
  }

  function bridge() { return window.SketchbookBridge; }
  function bus() { return window.SketchbookEventBus; }

  // Events forwarded from the SDK EventBus to React Native.
  var FORWARD_EVENTS = [
    'toolChanged', 'colorChanged', 'brushChanged',
    'strokeAdded', 'strokeRemoved', 'strokeTransformed',
    'selectionChanged', 'cameraChanged',
    'layerChanged', 'pageChanged', 'viewChanged',
    'projectLoaded', 'projectSaved',
    'historyChanged', 'renderFinished', 'exportFinished', 'error'
  ];

  function wireEvents() {
    var ev = bus();
    if (!ev || typeof ev.on !== 'function') return false;
    FORWARD_EVENTS.forEach(function (name) {
      ev.on(name, function (data) {
        postToRN({ type: 'evt', event: name, data: data === undefined ? null : data });
      });
    });
    return true;
  }

  function runCommand(msg) {
    var b = bridge();
    if (!b || typeof b.execute !== 'function') {
      return Promise.reject(new Error('Bridge not ready'));
    }
    return Promise.resolve(b.execute(msg.name, msg.payload || {}));
  }

  // De-dupe guard so the same command is never handled twice when both the
  // window and document 'message' listeners fire for one RN message.
  var seen = Object.create(null);
  function markSeen(id) {
    if (!id) return true;
    if (seen[id]) return false;
    seen[id] = true;
    setTimeout(function () { delete seen[id]; }, 5000);
    return true;
  }

  function onMessage(raw) {
    var msg;
    try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
    if (!msg || msg.type !== 'cmd') return;

    if (!markSeen(msg.id)) return;

    if (!msg.name) {
      postToRN({ type: 'res', id: msg.id || null, ok: false, error: 'missing command name' });
      return;
    }

    Promise.resolve()
      .then(function () { return runCommand(msg); })
      .then(function (result) {
        postToRN({ type: 'res', id: msg.id, ok: true, result: result === undefined ? null : result });
      })
      .catch(function (err) {
        postToRN({ type: 'res', id: msg.id, ok: false, error: String((err && err.message) || err) });
      });
  }

  window.addEventListener('message', function (e) { onMessage(e.data); });
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('message', function (e) { onMessage(e.data); });
  }

  // Wait for main.js to finish booting the SDK/Bridge, then wire events + announce.
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var b = bridge();
    if (b && typeof b.execute === 'function') {
      clearInterval(timer);
      wireEvents();
      var ver = '4.3';
      try {
        var s = window.SketchbookSDK;
        if (s && typeof s.getState === 'function') ver = s.getState().version || ver;
      } catch (e) {}
      postToRN({ type: 'ready', version: ver });
      return;
    }
    if (tries > 400) { // ~40s
      clearInterval(timer);
      postToRN({ type: 'error', error: 'Bridge failed to initialize' });
    }
  }, 100);

  // Exposed for console debugging / injected JS from RN.
  window.__rnTransport = { postToRN: postToRN, onMessage: onMessage };
})();
