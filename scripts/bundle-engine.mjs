// bundle-engine.mjs
// Copies the Sketchbook engine into mobile/assets/engine/ so the Expo app can
// run it 100% offline (no GitHub Pages, no localhost, no dev server).
//
// FASE 9 fix: Android WebView cannot load ES modules over file://, so the SDK
// (ES modules) is bundled into a single classic script (js/sdk.bundle.js via
// esbuild) and the ES-module bootstrap (js/main.js) is replaced by a generated
// classic loader (js/main.classic.js) that uses the bundled globals. The web
// source (root index.html + js/main.js) is left untouched — this only affects
// the offline bundle output.
//
// What it does:
//  1. Copies index.html, styles/, js/, src/ (SDK), manifest.json, sw.js, icons.
//  2. Vendors three.js r128 locally (was a CDN <script>).
//  3. Vendors the DM Mono font locally (was a Google Fonts <link>).
//  4. Bundles the SDK into js/sdk.bundle.js (classic IIFE).
//  5. Generates js/main.classic.js (classic loader using the SDK globals).
//  6. Rewrites index.html to load three (classic) + sdk.bundle.js + main.classic.js.
//
// Run:  node mobile/scripts/bundle-engine.mjs
// Safe to run repeatedly (it overwrites the target dir).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// OUT = where the offline bundle is written. Override with ENGINE_OUT to test
// without touching the committed assets/engine.
const OUT = process.env.ENGINE_OUT
  ? path.resolve(process.env.ENGINE_OUT)
  : path.join(ROOT, 'assets', 'engine');

// ---- REPO = root of the web engine source --------------------------------
// This used to default to two directories above scripts/, which was right while
// mobile/ lived inside the web repo but broke once the project moved: it now
// lands on a folder with no engine in it and the copy step fails with a
// confusing ENOENT on index.html. Instead of guessing one fixed layout, probe
// the places the engine can realistically live and take the first one that
// actually looks like an engine. A live source next to mobile/ wins over the
// copy vendored inside this repo, so a rebuild does not silently use a stale
// engine. ENGINE_REPO still wins when explicitly set.
const ENGINE_MARKERS = ['index.html', path.join('js', 'main.js'), path.join('src', 'sdk')];

function isEngineRoot(p) {
  return ENGINE_MARKERS.every((m) => fs.existsSync(path.join(p, m)));
}

function engineRootError(detail) {
  return new Error(
    `Could not locate the Sketchbook engine source.\n` +
      `  ${detail}\n` +
      `Looked for ${ENGINE_MARKERS.join(', ')} in:\n` +
      `    ${path.resolve(ROOT, '..')}\n` +
      `    ${path.resolve(ROOT, '..', '..')}\n` +
      `    ${ROOT}\n` +
      `    ${OUT}\n` +
      `Set ENGINE_REPO to the folder holding index.html, e.g.\n` +
      `  ENGINE_REPO=<engine-root> npm run bundle-engine`
  );
}

function resolveEngineRoot() {
  if (process.env.ENGINE_REPO) {
    const p = path.resolve(process.env.ENGINE_REPO);
    if (!isEngineRoot(p)) {
      throw engineRootError(`ENGINE_REPO points at a directory that is not an engine root: ${p}`);
    }
    return p;
  }
  const candidates = [
    path.resolve(ROOT, '..'),
    path.resolve(ROOT, '..', '..'),
    ROOT,
    OUT,
  ];
  for (const c of candidates) {
    if (isEngineRoot(c)) return c;
  }
  throw engineRootError('None of the candidate locations contain an engine.');
}

const REPO = resolveEngineRoot();
// When the engine source IS the vendored copy we must not wipe it before
// reading: the copy step below starts with rmrf(OUT). Refresh in place instead.
const SELF_HOSTED = path.resolve(REPO) === path.resolve(OUT);

const TEXT_EXT = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.ts', '.json', '.webmanifest', '.md',
]);

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    const full = path.join(p, entry.name);
    if (entry.isDirectory()) rmrf(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(p);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  // Self-hosted refresh copies a file onto itself. Reading then writing is fine
  // for text, but fs.copyFileSync on an identical path can truncate the file,
  // so bail out before that happens.
  if (path.resolve(src) === path.resolve(dest)) return;
  ensureDir(path.dirname(dest));
  const ext = path.extname(src).toLowerCase();
  if (TEXT_EXT.has(ext)) {
    let text = fs.readFileSync(src, 'utf8');
    text = rewriteText(text, path.basename(src));
    fs.writeFileSync(dest, text, 'utf8');
  } else {
    fs.copyFileSync(src, dest);
  }
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

// index.html: swap the three.js CDN + Google Fonts for local vendored copies.
// We deliberately do NOT rewrite "/src/" globally — the SDK is bundled, and the
// generated loader has no module paths. This avoids breaking relative URLs.
function rewriteText(text, fileName) {
  if (fileName === 'index.html') {
    text = text.replace(
      /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"><\/script>/,
      '<script src="./js/vendor/three.min.js"></script>'
    );
    text = text.replace(
      /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=DM\+Mono[^"]*" rel="stylesheet">/,
      '<link href="./assets/fonts/DMMono.css" rel="stylesheet">'
    );
  }
  return text;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  return res;
}

async function vendorThree() {
  const dest = path.join(OUT, 'js', 'vendor', 'three.min.js');
  if (fs.existsSync(dest)) {
    console.log('• three.js already vendored, skipping download');
    return;
  }
  console.log('• Vendoring three.js r128 ...');
  const res = await download('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
  const code = await res.text();
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, code, 'utf8');
  console.log(`  -> js/vendor/three.min.js (${(code.length / 1024).toFixed(0)} KB)`);
}

async function vendorFont() {
  const cssDest = path.join(OUT, 'assets', 'fonts', 'DMMono.css');
  if (fs.existsSync(cssDest)) {
    console.log('• DM Mono font already vendored, skipping download');
    return;
  }
  console.log('• Vendoring DM Mono font ...');
  const cssUrl = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap';
  const res = await download(cssUrl);
  let css = await res.text();

  const urls = [...css.matchAll(/url\((https:\/\/[^)]+\.(?:woff2|woff|ttf|otf))\)/g)].map((m) => m[1]);
  const localNames = [];
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    const buf = Buffer.from(await (await download(u)).arrayBuffer());
    const ext = path.extname(new URL(u).pathname) || '.ttf';
    const localName = `DMMono-${i}${ext}`;
    const dest = path.join(OUT, 'assets', 'fonts', localName);
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, buf);
    localNames.push(localName);
    console.log(`  -> assets/fonts/${localName}`);
  }
  let i = 0;
  css = css.replace(/url\(https:\/\/[^)]+\.(?:woff2|woff|ttf|otf)\)/g, () => `url(./${localNames[i++]})`);
  ensureDir(path.dirname(cssDest));
  fs.writeFileSync(cssDest, css, 'utf8');
  console.log('  -> assets/fonts/DMMono.css');
}

// Bundle the SDK (ES modules) into one classic IIFE exposing globals.
// The entry is generated so it resolves the SDK source from REPO (independent
// of where this script lives), avoiding the old ../../src/sdk relative path.
// esbuild writes each module's source path as a comment in its output. Because
// the SDK entry is generated from absolute paths, those comments embed the build
// machine's user name and directory layout, e.g.
//   // ../../Users/<you>/Documents/<project>/src/sdk/Events.js
// This repo is published, so strip that prefix on every build and keep only the
// useful repo-relative part. Without this, each rebuild reintroduces the leak.
//
// Only comment lines are touched, never code, and the vendored-location prefix
// is normalised too, so a rebuild from the committed copy is byte-identical to
// what is already committed instead of churning 20-odd lines every run.
function scrubPersonalPaths(file) {
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, 'utf8');
  const after = before
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*\/\/\s*)(\S.*)$/);
      if (!m) return line;
      const cleaned = m[2]
        // ../../Users/<name>/Documents/<anything>/
        .replace(/(?:\.\.\/)+Users\/[^/\r\n]+\/Documents\/[^/\r\n]+\//g, '')
        // C:/Users/<name>/Documents/<anything>/
        .replace(/[A-Za-z]:\/Users\/[^/\r\n]+\/Documents\/[^/\r\n]+\//g, '')
        // C:\Users\<name>\
        .replace(/[A-Za-z]:\\Users\\[^\\\r\n]+\\/g, '')
        // /Users/<name>/  (macOS)
        .replace(/\/Users\/[^/\r\n]+\//g, '')
        // Self-hosted rebuild: esbuild resolves modules relative to the generated
        // entry in scripts/, so the vendored location ends up in front. Drop it so
        // repeated builds produce identical output.
        .replace(/^(?:\.\.\/)*(?:[\w.-]+\/)*assets\/engine\//, '');
      return m[1] + cleaned;
    })
    .join('\n');
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    console.log('  (scrubbed personal paths from bundle comments)');
  }
}

async function bundleSdk() {
  console.log('• Bundling SDK (ESM -> classic IIFE) ...');
  const sdkPath = (f) => JSON.stringify(path.join(REPO, 'src', 'sdk', f));
  const entrySrc = `// AUTO-GENERATED by bundle-engine.mjs — do not edit.
import { BridgeInstance } from ${sdkPath('Bridge.js')};
import { EventBusInstance } from ${sdkPath('Events.js')};
import { AppStateInstance } from ${sdkPath('AppState.js')};
import { EngineAdapter } from ${sdkPath('EngineAdapter.js')};
import { SketchbookSDKInstance } from ${sdkPath('SketchbookSDK.js')};
window.SketchbookBridge = BridgeInstance;
window.SketchbookEventBus = EventBusInstance;
window.SketchbookAppState = AppStateInstance;
window.__EngineAdapter = EngineAdapter;
window.__SketchbookSDKInstance = SketchbookSDKInstance;
`;
  const entry = path.join(__dirname, '.sdk-entry.generated.mjs');
  fs.writeFileSync(entry, entrySrc, 'utf8');
  const outfile = path.join(OUT, 'js', 'sdk.bundle.js');
  ensureDir(path.dirname(outfile));
  try {
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      format: 'iife',
      target: ['es2017'],
      outfile,
      logLevel: 'info',
    });
  } finally {
    fs.unlinkSync(entry);
  }
  scrubPersonalPaths(outfile);
  console.log(`  -> js/sdk.bundle.js`);
}

// Generate a classic loader that mirrors js/main.js's bootstrap but uses the
// SDK globals provided by sdk.bundle.js (no import() over file://).
function generateClassicMain() {
  const srcMain = fs.readFileSync(path.join(REPO, 'js', 'main.js'), 'utf8');
  const m = srcMain.match(/const MODULES = \[([\s\S]*?)\];/);
  if (!m) throw new Error('Could not extract MODULES from js/main.js');
  const modulesLiteral = m[1].trim();

  const out = `// AUTO-GENERATED by scripts/bundle-engine.mjs — do not edit by hand.
// Classic loader for offline file:// (no ES modules). Mirrors js/main.js but
// consumes the SDK globals exposed by js/sdk.bundle.js.
const MODULES = [${modulesLiteral}];

function loadClassic(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error('Failed to load ' + src)); };
    document.body.appendChild(s);
  });
}

(async function bootstrap() {
  for (var i = 0; i < MODULES.length; i++) {
    await loadClassic(MODULES[i]);
  }
  await new Promise(function (r) { setTimeout(r, 100); });

  try {
    const EngineAdapter = window.__EngineAdapter;
    const SketchbookSDKInstance = window.__SketchbookSDKInstance;
    const engineAdapter = new EngineAdapter();
    engineAdapter.initialize();
    SketchbookSDKInstance.setEngine(engineAdapter);
    await SketchbookSDKInstance.initialize();
    window.SketchbookSDK = SketchbookSDKInstance;
    console.log('[Sketch3D] SDK initialized and exposed on window.SketchbookSDK');
  } catch (e) {
    console.error('[Sketch3D] SDK initialization failed:', e);
  }
})();
`;
  const dest = path.join(OUT, 'js', 'main.classic.js');
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, out, 'utf8');
  console.log('• js/main.classic.js (classic loader)');
}

// Rewrite index.html to load three (classic) + sdk.bundle.js + main.classic.js
// instead of the ES-module main.js.
function rewriteIndexScripts() {
  const index = path.join(OUT, 'index.html');
  let html = fs.readFileSync(index, 'utf8');
  html = html.replace(
    /<script type="module" src="js\/main\.js"><\/script>/,
    '<script src="./js/sdk.bundle.js"></script>\n<script src="./js/main.classic.js"></script>'
  );
  fs.writeFileSync(index, html, 'utf8');
  console.log('• index.html rewritten for classic offline loading');
}

// ---- main ----
if (SELF_HOSTED) {
  console.log(`• engine source: vendored copy, refreshing in place (${OUT})`);
} else {
  console.log(`• engine source: ${REPO}`);
  rmrf(OUT);
}
ensureDir(OUT);

copyFile(path.join(REPO, 'index.html'), path.join(OUT, 'index.html'));
console.log('• index.html');

if (fs.existsSync(path.join(REPO, 'styles'))) {
  copyDir(path.join(REPO, 'styles'), path.join(OUT, 'styles'));
  console.log('• styles/');
}
if (fs.existsSync(path.join(REPO, 'js'))) {
  copyDir(path.join(REPO, 'js'), path.join(OUT, 'js'));
  console.log('• js/');
}
if (fs.existsSync(path.join(REPO, 'src'))) {
  copyDir(path.join(REPO, 'src'), path.join(OUT, 'src'));
  console.log('• src/');
}
for (const f of ['manifest.json', 'sw.js']) {
  const src = path.join(REPO, f);
  if (fs.existsSync(src)) {
    copyFile(src, path.join(OUT, f));
    console.log(`• ${f}`);
  }
}
for (const f of fs.readdirSync(REPO)) {
  if (/^icon-\d+\.png$/.test(f)) {
    copyFile(path.join(REPO, f), path.join(OUT, f));
  }
}
console.log('• icons');

await vendorThree();
await vendorFont();
await bundleSdk();
generateClassicMain();
rewriteIndexScripts();

console.log('\n=== bundle complete ===');
console.log('Output:', path.relative(REPO, OUT) || '.');
