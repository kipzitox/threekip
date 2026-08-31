// copy-engine-assets.mjs
// Ensures the offline engine bundle is present inside the native Android
// project's assets folder so the WebView can load it via
// file:///android_asset/engine/index.html — no server, no internet.
//
// The canonical engine source now lives directly at android/.../assets/engine
// (committed on purpose). This script is tolerant and non-destructive:
//   - If assets/engine exists (e.g. after a fresh `npm run bundle-engine`),
//     it is copied over the Android copy (original flow).
//   - Otherwise it treats the already-committed Android copy as the source,
//     which makes the operation idempotent (source == destination).
//   - If no source exists at all it warns and continues cleanly instead of
//     aborting the build, so gradle can still use the committed engine.
//
// Safe to run repeatedly.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // project root
const DEST = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'engine');
const BUNDLED_SRC = path.join(ROOT, 'assets', 'engine');

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

// Prefer a freshly bundled assets/engine; fall back to the committed Android copy.
const SRC = fs.existsSync(BUNDLED_SRC) ? BUNDLED_SRC : DEST;

if (!fs.existsSync(SRC) || !fs.existsSync(path.join(SRC, 'index.html'))) {
  console.warn(
    `[copy-engine-assets] No engine source found (expected ${BUNDLED_SRC} or ${DEST}).\n` +
    `Continuing without copying — the committed Android engine will be used if present.`
  );
} else if (SRC === BUNDLED_SRC) {
  copyRecursive(SRC, DEST);
  console.log(`[copy-engine-assets] Copied engine -> ${path.relative(ROOT, DEST)}`);
  console.log(`  index.html: ${fs.existsSync(path.join(DEST, 'index.html'))}`);
  console.log(`  sdk.bundle.js: ${fs.existsSync(path.join(DEST, 'js', 'sdk.bundle.js'))}`);
} else {
  console.log(`[copy-engine-assets] Engine already present at ${path.relative(ROOT, DEST)} (source == destination).`);
  console.log(`  index.html: ${fs.existsSync(path.join(DEST, 'index.html'))}`);
  console.log(`  sdk.bundle.js: ${fs.existsSync(path.join(DEST, 'js', 'sdk.bundle.js'))}`);
}
