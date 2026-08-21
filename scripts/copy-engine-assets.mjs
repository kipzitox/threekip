// copy-engine-assets.mjs
// Copies the offline engine bundle (mobile/assets/engine) into the native
// Android project's assets folder so the WebView can load it via
// file:///android_asset/engine/index.html — no server, no internet.
//
// This is the deterministic counterpart of the withEngineAssets Expo config
// plugin. If the plugin did not copy the assets during `expo prebuild`
// (some Expo versions skip withDangerousMod actions), run this manually:
//   npm run copy-engine-assets
//
// Safe to run repeatedly.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // mobile/
const SRC = path.join(ROOT, 'assets', 'engine');
const DEST = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'engine');

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(SRC)) {
  console.error(`[copy-engine-assets] Source not found: ${SRC}\nRun "npm run bundle-engine" first.`);
  process.exit(1);
}

copyRecursive(SRC, DEST);
console.log(`[copy-engine-assets] Copied engine -> ${path.relative(ROOT, DEST)}`);
console.log(`  index.html: ${fs.existsSync(path.join(DEST, 'index.html'))}`);
console.log(`  sdk.bundle.js: ${fs.existsSync(path.join(DEST, 'js', 'sdk.bundle.js'))}`);
