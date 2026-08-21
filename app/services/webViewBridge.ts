// Communication helpers between React Native and the WebView engine page.
// Host-side glue only — this does NOT modify the engine.

// Injected into the loaded page so it can answer pings.
// react-native-webview provides window.ReactNativeWebView automatically.
export const INJECTED_JAVASCRIPT = `
(function () {
  function send(msg) {
    try { window.ReactNativeWebView.postMessage(msg); } catch (e) {}
  }
  function onPing() { send('pong'); }
  document.addEventListener('message', function (e) {
    if (e && e.data === 'ping') onPing();
  });
  window.addEventListener('message', function (e) {
    if (e && e.data === 'ping') onPing();
  });
  send('ready');
})();
`;