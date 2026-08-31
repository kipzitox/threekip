/* eslint-env node */
// withEngineAssets.js
// Expo config plugin: ensures the offline engine bundle is present in the
// native app so it can be loaded by the WebView via file:// — no server,
// no internet.
//
// Android: <app>/src/main/assets/engine  -> file:///android_asset/engine/index.html
// iOS    : <project>/Resources/engine     -> resolved via extra.engineIosUri
//
// The canonical engine source now lives directly at android/.../assets/engine
// (committed on purpose — see .gitignore note). This plugin is tolerant and
// non-destructive: it only copies when a bundled assets/engine exists. If that
// folder is absent it does nothing, so the already-committed Android copy is
// left intact and prebuild never fails because of a missing engine source.
//
// Runs at prebuild (expo prebuild / expo run:android / EAS Build). It does NOT
// run in Expo Go — there the app falls back to the remote URL (see engineLoader).

const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

// Tolerant copy: if src does not exist (or has no index.html), do nothing so a
// pre-existing committed engine copy is preserved and prebuild does not break.
function copyRecursive(src, dest) {
  if (!fs.existsSync(src) || !fs.existsSync(path.join(src, 'index.html'))) {
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function withEngineAssets(config) {
  const engineSrc = path.join(__dirname, '..', 'assets', 'engine');

  config = withDangerousMod(config, 'android', (c) => {
    const dest = path.join(
      c.modRequest.projectRoot,
      'android',
      'app',
      'src',
      'main',
      'assets',
      'engine'
    );
    copyRecursive(engineSrc, dest);
    return c;
  });

  config = withDangerousMod(config, 'ios', async (c) => {
    const projectName = c.modRequest.projectName || c.name;
    const dest = path.join(
      c.modRequest.projectRoot,
      'ios',
      projectName,
      'Resources',
      'engine'
    );
    copyRecursive(engineSrc, dest);
    // NOTE: also add this folder as a "folder reference" in Xcode's
    // "Copy Bundle Resources" so it ships inside the IPA. See docs/webview-local.md.
    return c;
  });

  return config;
}

module.exports = withEngineAssets;
module.exports.withEngineAssets = withEngineAssets;
