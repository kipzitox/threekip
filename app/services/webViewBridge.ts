// Communication helpers between React Native and the WebView engine page.
// Host-side glue only — this does NOT modify the engine.

// Injected into the loaded page so it can answer pings.
// react-native-webview provides window.ReactNativeWebView automatically.
export const INJECTED_JAVASCRIPT = `
(function () {
  var oErr = console.error;
  function send(msg) {
    try {
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    } catch (e) {}
  }
  console.error = function() {
    oErr.apply(console, arguments);
    send(JSON.stringify({ type: 'log', level: 'error', args: Array.from(arguments).map(String) }));
  };
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