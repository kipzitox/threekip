/* eslint-env node */
// withEngineAssets.js
// Expo config plugin: copies mobile/assets/engine (the offline engine bundle
// produced by scripts/bundle-engine.mjs) into the native app so it can be
// loaded by the WebView via file:// — no server, no internet.
//
// Android: <app>/src/main/assets/engine  -> file:///android_asset/engine/index.html
// iOS    : <project>/Resources/engine     -> resolved via extra.engineIosUri
//
// Runs at prebuild (expo prebuild / expo run:android / EAS Build). It does NOT
// run in Expo Go — there the app falls back to the remote URL (see engineLoader).

const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

function copyRecursive(src, dest) {
  try {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) copyRecursive(s, d);
      else fs.copyFileSync(s, d);
    }
  } catch (e) {
    throw e;
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
