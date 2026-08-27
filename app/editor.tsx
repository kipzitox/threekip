import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StatusBar,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppWebView, AppWebViewHandle } from './components/AppWebView';
import { useSketchbookBridge } from './services/sketchbookBridge';
import { INJECTED_JAVASCRIPT } from './services/webViewBridge';
import { getEngineSource } from './services/engineLoader';
import { EditorUI } from './ui/EditorUI';
import { useProjectStore, NEW_PROJECT_SENTINEL } from './stores/ProjectStore';
import { readProjectFile } from './services/projectStorage';
import { useSettingsStore } from './stores/SettingsStore';
import { translations } from './i18n';

function getI18n() {
  const lang = useSettingsStore.getState().language;
  return translations[lang] || translations.es;
}

// Loads the in-page transport (js/rn-transport.js) from the same origin as the
// engine page, so the Bridge protocol is available once the app boots.
const LOAD_RN_TRANSPORT = `
(function () {
  try {
    var s = document.createElement('script');
    s.src = 'js/rn-transport.js';
    s.onerror = function () { console.error('[RN] rn-transport.js failed to load'); };
    document.head.appendChild(s);
  } catch (e) { console.error('[RN] transport bootstrap error', e); }
})();
`;

// RN-side only: RESKIN the engine's existing HTML UI into the ThreeKip look
// (light background, rounded floating panels, soft shadows, clean font, indigo
// accent) and hide only a few redundant overlays. The engine source is NOT
// modified — we inject CSS + a tiny script at runtime. Critically we do NOT add
// `body.ui-hidden` (the engine's own class that hides the whole editor UI:
// topbar, sidecol, gizmo, view cube, status bar, etc.). All editor functions
// stay visible; we only restyle them.
const SKIN_CSS = `
/* ── ThreeKip Material Design 3 — complete token set for engine UI ──
   Defines every CSS variable the engine's m3.css / base.css expect,
   using our M3 purple brand (#6750A4) as primary. Light & dark modes. */
:root{
  /* Shape tokens (MD3) */
  --shp-xs:4px;
  --shp-sm:8px;
  --shp-md:12px;
  --shp-lg:16px;
  --shp-xl:28px;
  --shp-full:999px;

  /* Elevation shadows (MD3) */
  --elev-1:0 1px 2px rgba(29,27,32,.14),0 1px 3px 1px rgba(29,27,32,.12);
  --elev-2:0 1px 2px rgba(29,27,32,.12),0 2px 6px 2px rgba(29,27,32,.10);
  --elev-3:0 1px 3px rgba(29,27,32,.15),0 4px 8px 3px rgba(29,27,32,.10);
  --elev-4:0 6px 12px rgba(29,27,32,.14),0 12px 24px rgba(29,27,32,.10);
  --elev-5:0 8px 16px rgba(29,27,32,.16),0 16px 32px rgba(29,27,32,.12);

  /* Motion */
  --tr:all .15s cubic-bezier(.2,.0,.38,.9);

  /* MD3 Color tokens — LIGHT (default) */
  --md-primary:#6750A4;
  --md-on-primary:#FFFFFF;
  --md-primary-container:#EADDFF;
  --md-on-primary-container:#21005D;

  --md-secondary:#625B71;
  --md-on-secondary:#FFFFFF;
  --md-secondary-container:#E8DEF8;
  --md-on-secondary-container:#1D192B;

  --md-tertiary:#7D5260;
  --md-on-tertiary:#FFFFFF;
  --md-tertiary-container:#FFD8E4;
  --md-on-tertiary-container:#31111D;

  --md-error:#B3261E;
  --md-on-error:#FFFFFF;
  --md-error-container:#F9DEDC;
  --md-on-error-container:#410E0B;

  --md-background:#FEF7FF;
  --md-on-background:#1D1B20;
  --md-surface:#FEF7FF;
  --md-on-surface:#1D1B20;
  --md-surface-variant:#E7E0EC;
  --md-on-surface-variant:#49454F;
  --md-outline:#79747E;
  --md-outline-variant:#CAC4D0;
  --md-shadow:#000000;
  --md-scrim:rgba(0,0,0,.4);
  --md-inverse-surface:#322F35;
  --md-inverse-on-surface:#F5EFF7;
  --md-inverse-primary:#D0BCFF;

  /* Engine legacy aliases (used by base.css, components.css, etc.) */
  --bg:var(--md-background);
  --ink:var(--md-on-background);
  --mut:var(--md-on-surface-variant);
  --pan:rgba(254,247,255,.94);
  --bdr:var(--md-outline-variant);
  --ink-rgb:29,27,32;
  --tr:all .15s ease;
}

:root[data-theme="dark"]{
  /* MD3 Color tokens — DARK */
  --md-primary:#D0BCFF;
  --md-on-primary:#381E72;
  --md-primary-container:#4F378B;
  --md-on-primary-container:#EADDFF;

  --md-secondary:#CCC2DC;
  --md-on-secondary:#332D41;
  --md-secondary-container:#4A4458;
  --md-on-secondary-container:#E8DEF8;

  --md-tertiary:#EFB8C8;
  --md-on-tertiary:#4A2531;
  --md-tertiary-container:#633B48;
  --md-on-tertiary-container:#FFD8E4;

  --md-error:#F2B8B5;
  --md-on-error:#601410;
  --md-error-container:#8C1D18;
  --md-on-error-container:#F9DEDC;

  --md-background:#141218;
  --md-on-background:#E6E0E9;
  --md-surface:#141218;
  --md-on-surface:#E6E0E9;
  --md-surface-variant:#49454F;
  --md-on-surface-variant:#CAC4D0;
  --md-outline:#938F99;
  --md-outline-variant:#49454F;
  --md-shadow:#000000;
  --md-scrim:rgba(0,0,0,.5);
  --md-inverse-surface:#E6E0E9;
  --md-inverse-on-surface:#322F35;
  --md-inverse-primary:#6750A4;

  /* Engine legacy aliases (dark) */
  --bg:var(--md-background);
  --ink:var(--md-on-background);
  --mut:var(--md-on-surface-variant);
  --pan:rgba(20,18,24,.94);
  --bdr:var(--md-outline-variant);
  --ink-rgb:230,224,233;
  --tr:all .15s ease;
}

/* Global font — DM Mono for authentic technical aesthetic */
body,button,input,select,textarea,
.btn,.btn-sm,.btn-md,.btn-pill,.btn-sft,.cyc-btn,.cw,
#sbar,.nsm-btn,.emb,#stxt,.card,.sc-group,.panel,.pop,.brush-pop,.tsep,.nsm-lbl,
.nsm-title,.nsm-box,.fc-hdr,.fc-hdr-pill,.pg-thumb,.vw-thumb,
.cyc-pop-item,.sc-title,.nsm-lbl,.bprev-btn{
  font-family:'DM Mono',monospace,-apple-system,sans-serif !important;
}

/* Canvas background */
#cc{background:var(--bg) !important;}

/* Cards / sheets — elevation 1 */
.card,.sc-group,.nsm-box,.fc-hdr-pill{
  background:var(--md-surface) !important;
  border:1px solid var(--md-outline-variant) !important;
  border-radius:var(--shp-lg) !important;
  box-shadow:var(--elev-1) !important;
}

/* Buttons — MD3 filled/tonal/outlined */
.btn,.btn-sm,.btn-md,.btn-pill,.btn-sft{
  border-radius:var(--shp-sm) !important;
  box-shadow:none !important;
  background:var(--md-surface-container-low,var(--md-surface)) !important;
  color:var(--md-on-surface) !important;
  border:1px solid var(--md-outline-variant) !important;
  transition:background .15s,border-color .15s,box-shadow .15s !important;
}
.btn:hover,.btn-sm:hover,.btn-md:hover,.btn-pill:hover,.btn-sft:hover{
  background:var(--md-surface-container,var(--md-surface-variant)) !important;
}
.btn:active,.btn-sm:active,.btn-md:active,.btn-pill:active,.btn-sft:active{
  background:var(--md-surface-container-high,var(--md-surface-variant)) !important;
}

/* Active/toggle buttons — filled primary */
.btn.on,.btn-sm.on,.btn-md.on,.btn-pill.on,.btn-sft.on,
.cyc-btn.on{
  background:var(--md-primary) !important;
  color:var(--md-on-primary) !important;
  border-color:transparent !important;
}
.btn.on.mode,.btn-sm.on.mode{
  background:var(--md-primary-container) !important;
  color:var(--md-on-primary-container) !important;
  border-color:transparent !important;
}
.btn.on.mode::before{background:var(--md-primary) !important;}

/* Danger buttons */
.btn.danger,.btn-sm.danger{color:var(--md-error) !important;border-color:var(--md-error) !important;}
.btn.danger:hover{background:var(--md-error-container) !important;}

/* FABs */
#pb-fab,#sc-fab{
  background:var(--md-primary-container) !important;
  color:var(--md-on-primary-container) !important;
  border:none !important;
  border-radius:var(--shp-lg) !important;
  box-shadow:var(--elev-3) !important;
}

/* Top bars — hidden (we use RN top bar) */
#topbar,#narrow-bar{display:none !important;}

/* Status / bottom bars */
#sbar,#stab{
  background:var(--md-surface) !important;
  border:1px solid var(--md-outline-variant) !important;
  border-radius:var(--shp-full) !important;
  box-shadow:var(--elev-2) !important;
}

/* Color wells */
.cw,#ccpick,.bgpop-swatch,#bgpop-pick{
  border-radius:var(--shp-sm) !important;
  border:1px solid var(--md-outline-variant) !important;
}

/* Cycle buttons */
.cyc-btn{
  border-radius:var(--shp-sm) !important;
  background:var(--md-surface) !important;
  color:var(--md-on-surface) !important;
  border:1px solid var(--md-outline-variant) !important;
}
.cyc-btn.on{background:var(--md-secondary-container) !important;color:var(--md-on-secondary-container) !important;border-color:transparent !important;}

/* Popovers / menus — elevation 3 */
#expmenu,#layers-pop,#bgpop,.cyc-pop,.brush-pop,#sgizmo{
  background:var(--md-surface) !important;
  border:1px solid var(--md-outline-variant) !important;
  border-radius:var(--shp-md) !important;
  box-shadow:var(--elev-3) !important;
}

/* Dialogs */
#new-scene-modal,#save-name-modal,#export-name-modal{background:var(--md-scrim) !important;}
.nsm-box{
  background:var(--md-surface) !important;
  border:none !important;
  border-radius:var(--shp-xl) !important;
  box-shadow:var(--elev-3) !important;
}

/* Float card & strips */
#pb-float-card,#pages,#views{
  background:var(--md-surface) !important;
  border:1px solid var(--md-outline-variant) !important;
  border-radius:var(--shp-lg) !important;
  box-shadow:var(--elev-2) !important;
}

/* Snackbar / toast */
#toast{
  background:var(--md-inverse-surface) !important;
  color:var(--md-inverse-on-surface) !important;
  border-radius:var(--shp-full) !important;
  box-shadow:var(--elev-3) !important;
}

/* Recording stop pill */
#rec-stop-btn{
  background:var(--md-error-container) !important;
  color:var(--md-on-error-container) !important;
  border-color:transparent !important;
}

/* Sliders — M3 track + primary thumb */
.fps-slider,input[type=range].vr,.brush-slider-row input[type=range],#pb-colors input[type=range]{
  background:var(--md-outline-variant) !important;
}
.fps-slider::-webkit-slider-thumb,input[type=range].vr::-webkit-slider-thumb,.brush-slider-row input[type=range]::-webkit-slider-thumb,#pb-colors input[type=range]::-webkit-slider-thumb{
  background:var(--md-primary) !important;
  border-color:var(--md-on-primary) !important;
}

/* Separators */
.tsep{background:var(--md-outline-variant) !important;}

/* Layer rows */
.tb-lrow{background:var(--md-surface) !important;border-radius:var(--shp-sm) !important;}
.tb-lrow.active{background:var(--md-secondary-container) !important;color:var(--md-on-secondary-container) !important;}

/* Ensure sidecol is always displayed across all screen sizes and aspect ratios, positioned below the RN top bar */
#sidecol{
  display:flex !important;
  top:72px !important;
  bottom:56px !important;
  z-index:200 !important;
}
#sidecol.collapsed{
  opacity:0 !important;
  pointer-events:none !important;
  transform:translateX(-12px) !important;
}
body.rside #sidecol.collapsed{
  transform:translateX(12px) !important;
}

/* Hide the engine's original top bars (both regular and narrow) completely.
   Use multiple properties as fallback in case display:none is overridden. */
#topbar,#narrow-bar{
  display:none !important;
  visibility:hidden !important;
  opacity:0 !important;
  height:0 !important;
  width:0 !important;
  overflow:hidden !important;
  pointer-events:none !important;
  position:absolute !important;
  left:-9999px !important;
  top:-9999px !important;
}

/* Popovers that were anchored to the (now hidden) engine top bar would render
   at the top of the WebView, behind the RN top bar. Pin them just below the
   top bar, right-aligned, so they stay visible and aligned with the controls. */
#expmenu,#layers-pop,#bgpop,#bdepth-op,#rec-stop-btn{
  position:fixed !important;
  top:76px !important;
  right:12px !important;
  left:auto !important;
  z-index:9999 !important;
}

/* ── Tablet Adaptations (>= 768px) ── */
@media (min-width: 768px) {
  #sidecol {
    width: 216px !important;
    top: 76px !important;
    bottom: 36px !important;
    gap: 8px !important;
  }
  #gc {
    width: 184px !important;
    height: 154px !important;
  }
  .sc-group {
    border-radius: 14px !important;
  }
  .cw, #ccpick {
    width: 32px !important;
    height: 32px !important;
    border-radius: 8px !important;
  }
  .cyc-btn {
    height: 32px !important;
    font-size: 8px !important;
  }
  .btn, .btn-sm, .btn-md {
    font-size: 9px !important;
  }
  #sbar {
    bottom: 14px !important;
    padding: 6px 18px !important;
    font-size: 9.5px !important;
    border-radius: var(--shp-full) !important;
  }
  #stab {
    width: 20px !important;
    height: 40px !important;
    border-radius: 12px !important;
  }
  #stab span {
    width: 4px !important;
    height: 20px !important;
  }
  #expmenu, #layers-pop, #bgpop, #bdepth-op, #rec-stop-btn {
    top: 76px !important;
    right: 16px !important;
    border-radius: 16px !important;
  }
}
`;

const HIDE_UI_JS = `
(function () {
  function injectSkin() {
    try {
      if (!document.getElementById('__tk_skin')) {
        var s = document.createElement('style');
        s.id = '__tk_skin';
        s.textContent = ${JSON.stringify(SKIN_CSS)};
        document.head.appendChild(s);
      }
      var h = document.getElementById('__tk_hide');
      if (!h) {
        h = document.createElement('style');
        h.id = '__tk_hide';
        h.textContent = '#topbar,#narrow-bar,#bhide,#sc-hidden-toggle,#sc-hidden-bar,#pb-fab,#sc-fab,#lcl-float-group,#fps-overlay,#fps-crosshair,#fps-plane-ctrl{display:none!important;visibility:hidden!important;opacity:0!important;height:0!important;width:0!important;overflow:hidden!important;pointer-events:none!important;position:absolute!important;left:-9999px!important;top:-9999px!important;}';
        document.head.appendChild(h);
      } else {
        // Ensure __tk_hide is always the last style in head to override later-loaded CSS
        if (h.parentNode === document.head && h !== document.head.lastElementChild) {
          document.head.appendChild(h);
        }
      }
    } catch (e) {}
  }
  function whiteBg() {
    try {
      var ci = document.getElementById('bgpop-custom');
      if (ci && !ci.__tkInit) {
        ci.__tkInit = true;
        ci.value = '#FEF7FF';
        ci.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (e) {}
  }
  function on(sel) {
    try { var e = document.querySelector(sel); return !!(e && e.classList.contains('on')); } catch (e) { return false; }
  }
  function reportState() {
    try {
      var st = {
        grid: on('#bgrid') || on('#pb-grid'),
        axis: on('#baxis') || on('#pb-axis'),
        persp: on('#bpersp') || on('#pb-nav-persp') || on('#nav-persp'),
        surf: on('#bsurf') || on('#pb-surf'),
        depth: on('#bdepth') || on('#pb-depth'),
        surfgrid: on('#bsurfgrid') || on('#pb-surfgrid'),
        pan: on('#bpan'),
        orbit: on('#borbit'),
        stylus: on('#bstylus') || on('#pb-stylus'),
        gestswap: on('#bgestswap') || on('#pb-gestswap'),
        lcl: on('#lcl-float') || on('#glocal') || on('#pb-glocal'),
      };
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'evt', event: 'tkState', data: st }));
      }
    } catch (e) {}
  }
  var HIDE_IDS = ['topbar','narrow-bar','bhide','sc-hidden-toggle','sc-hidden-bar','pb-fab','sc-fab','lcl-float-group','fps-overlay','fps-crosshair','fps-plane-ctrl'];
  function enforceHide() {
    try {
      for (var i = 0; i < HIDE_IDS.length; i++) {
        var e = document.getElementById(HIDE_IDS[i]);
        if (e && e.style.display !== 'none') e.style.setProperty('display', 'none', 'important');
      }
    } catch (e) {}
  }
  function setupWatch() {
    if (window.__tkWatch) return;
    window.__tkWatch = true;
    try {
      for (var i = 0; i < HIDE_IDS.length; i++) {
        (function (id) {
          var e = document.getElementById(id);
          if (e && !e.__tkObs) {
            e.__tkObs = true;
            new MutationObserver(function () {
              var el = document.getElementById(id);
              if (el && el.style.display !== 'none') el.style.setProperty('display', 'none', 'important');
            }).observe(e, { attributes: true, attributeFilter: ['style', 'class'] });
          }
        })(HIDE_IDS[i]);
      }
      setInterval(enforceHide, 1500);
      document.addEventListener('click', function () {
        setTimeout(reportState, 60);
      });
    } catch (e) {}
  }
  function patchDownload() {
    try {
      if (window.__tkDlPatched) return;
      window.__tkDlPatched = true;
      // Keep exported blobs alive so we can read them after the engine calls
      // URL.revokeObjectURL() right after the anchor click.
      window.__tkBlobs = window.__tkBlobs || {};
      var _create = URL.createObjectURL ? URL.createObjectURL.bind(URL) : null;
      var _revoke = URL.revokeObjectURL ? URL.revokeObjectURL.bind(URL) : null;
      if (_create) URL.createObjectURL = function (b) { var u = _create(b); try { window.__tkBlobs[u] = b; } catch (e) {} return u; };
      if (_revoke) URL.revokeObjectURL = function () { /* keep blob so async capture works */ };

      function postExport(name, b64) {
        if (!b64 || !window.ReactNativeWebView) return;
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'evt', event: 'fileExport', data: { name: name || 'export', b64: b64 } }));
        } catch (e) {}
      }

      var MODEL_RE = /\.(glb|obj|usda|usdz|json|gltf)$/i;
      var orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        try {
          var href = this.href || '';
          var dl = (this.download || '').toLowerCase();
          if (href.indexOf('data:image/png') === 0 && /\.png$/i.test(dl)) {
            postExport(dl, href.split(',')[1]);
            return;
          }
          if (MODEL_RE.test(dl)) {
            if (href.indexOf('data:') === 0) {
              postExport(dl, href.split(',')[1]);
              return;
            }
            if (href.indexOf('blob:') === 0) {
              var blob = window.__tkBlobs[href];
              if (blob) {
                var fr = new FileReader();
                fr.onload = function () { postExport(dl, ('' + fr.result).split(',')[1]); };
                fr.readAsDataURL(blob);
                return;
              }
            }
          }
        } catch (e) {}
        return orig.apply(this, arguments);
      };
    } catch (e) {}
  }
  function tick() { injectSkin(); enforceHide(); whiteBg(); reportState(); setupWatch(); patchDownload(); }
  if (document.readyState !== 'loading') tick();
  else document.addEventListener('DOMContentLoaded', tick);
  var n = 0;
  var iv = setInterval(function () { tick(); if (++n > 8) clearInterval(iv); }, 400);
  document.addEventListener('projectLoaded', function () { setTimeout(function () { whiteBg(); reportState(); enforceHide(); }, 300); });
  window.__tkWhiteBg = whiteBg;
  window.__tkReportState = reportState;
})();
`;

const INJECTED = `${INJECTED_JAVASCRIPT}\n;${LOAD_RN_TRANSPORT}\n;${HIDE_UI_JS}`;

// Receives a base64 PNG (captured from the engine's export anchor, which does
// not save inside a WebView) and writes it to a file, then opens the system
// share sheet so the user can save it to the device gallery / storage.
async function savePngExport(base64: string): Promise<void> {
  const tr = getI18n();
  const safe = (base64 || '').replace(/\s/g, '');
  if (!safe) {
    Alert.alert(tr.common.error, tr.editor.pngError);
    return;
  }
  try {
    const name = `sketch3d_${Date.now()}.png`;
    if (Platform.OS === 'web') {
      const byteCharacters = atob(safe.replace(/^data:[^;]+;base64,/, ''));
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const NativeFS = require('expo-file-system');
    const NativeSharing = require('expo-sharing');
    const uri = `${NativeFS.cacheDirectory || NativeFS.documentDirectory || ''}${name}`;
    await NativeFS.writeAsStringAsync(uri, safe, {
      encoding: NativeFS.EncodingType.Base64,
    });
    if (NativeSharing && (await NativeSharing.isAvailableAsync())) {
      await NativeSharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: tr.editor.pngShareTitle,
        UTI: 'public.png',
      });
    } else {
      Alert.alert(tr.editor.pngReady, `${tr.editor.savedIn}\n${uri}`);
    }
  } catch (e) {
    console.error('[Editor] png export failed', e);
    Alert.alert(tr.common.error, tr.editor.pngError);
  }
}

// Receives an exported model/scene file (captured from the engine's blob
// download, which does not save inside a WebView) and writes it to a file,
// then opens the system share sheet so the user can save it to the device.
async function saveFileExport(name: string, b64: string): Promise<void> {
  const tr = getI18n();
  const safe = (b64 || '').replace(/\s/g, '');
  if (!safe) {
    Alert.alert(tr.common.error, tr.editor.fileExportError);
    return;
  }
  const fname = name || `export_${Date.now()}`;
  const ext = fname.includes('.') ? fname.split('.').pop()!.toLowerCase() : '';
  const mimeByExt: Record<string, string> = {
    glb: 'model/gltf-binary',
    gltf: 'model/gltf+json',
    obj: 'text/plain',
    usda: 'model/usd',
    usdz: 'model/vnd.usdz+zip',
    json: 'application/json',
  };
  const mime = mimeByExt[ext] || 'application/octet-stream';
  try {
    if (Platform.OS === 'web') {
      const byteCharacters = atob(safe.replace(/^data:[^;]+;base64,/, ''));
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const NativeFS = require('expo-file-system');
    const NativeSharing = require('expo-sharing');
    const uri = `${NativeFS.cacheDirectory || NativeFS.documentDirectory || ''}${fname}`;
    await NativeFS.writeAsStringAsync(uri, safe, {
      encoding: NativeFS.EncodingType.Base64,
    });
    if (NativeSharing && (await NativeSharing.isAvailableAsync())) {
      await NativeSharing.shareAsync(uri, { mimeType: mime, dialogTitle: tr.editor.fileShareTitle });
    } else {
      Alert.alert(tr.editor.fileReady, `${tr.editor.savedIn}\n${uri}`);
    }
  } catch (e) {
    console.error('[Editor] file export failed', e);
    Alert.alert(tr.common.error, tr.editor.fileExportError);
  }
}

export default function Editor() {
  const webRef = useRef<AppWebViewHandle>(null);
  const bridge = useSketchbookBridge(webRef);
  const [ready, setReady] = useState(false);

  // Re-apply the light background whenever the scene is (re)loaded
  const reapplyLightBg = useCallback(() => {
    webRef.current?.injectJavaScript(
      "try{var ci=document.getElementById('bgpop-custom');if(ci){ci.value='#FEF7FF';ci.dispatchEvent(new Event('input',{bubbles:true}));}}catch(e){}"
    );
    if (useSettingsStore.getState().resetCamOnOpen) {
      bridge.send('setCamera', { theta: 0.6, phi: 1.0, radius: 14 }).catch(() => {});
    }
  }, [bridge]);

  useEffect(() => {
    const loadPending = async () => {
      const id = useProjectStore.getState().pendingLoadId;
      if (!id) return;
      try {
        // NOTE: the engine's LoadProjectCommand throws if `data` is null, and the
        // engine otherwise restores its SHARED autosave slot (sk3d_auto) on boot.
        // Always load an explicit scene — an empty object for new/empty projects —
        // so each project renders its own content instead of the shared autosave.
        let scene: unknown = {};
        if (id !== NEW_PROJECT_SENTINEL) {
          const file = await readProjectFile(id);
          scene = file?.scene ?? {};
        }
        await bridge.send('loadProject', { data: scene });
        reapplyLightBg();
      } catch (e) {
        console.error('[Editor] pending project load failed', e);
      }
      useProjectStore.getState().setPendingLoad(null);
    };
    const offReady = bridge.on('ready', () => {
      setReady(true);
      loadPending();
      reapplyLightBg();
    });
    const offLoaded = bridge.on('projectLoaded', reapplyLightBg);
    const offPng = bridge.on('pngExport', (d) => {
      savePngExport(String(d)).catch(() => {});
    });
    const offFile = bridge.on('fileExport', (d) => {
      const o = d as { name?: string; b64?: string };
      saveFileExport(o?.name || 'export', String(o?.b64 ?? '')).catch(() => {});
    });
    if (bridge.isReady()) {
      setReady(true);
      loadPending();
      reapplyLightBg();
    }
    const fallbackTimer = setTimeout(() => {
      setReady(true);
    }, 500);

    return () => {
      clearTimeout(fallbackTimer);
      offReady();
      offLoaded();
      offPng();
      offFile();
    };
  }, [bridge, reapplyLightBg]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      <AppWebView
        ref={webRef}
        style={styles.webview}
        source={getEngineSource()}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        originWhitelist={['*']}
        cacheEnabled
        androidLayerType="hardware"
        injectedJavaScript={INJECTED}
        onMessage={(event) => bridge.handleMessage(event.nativeEvent.data)}
      />
      {ready ? <EditorUI bridge={bridge} webRef={webRef} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF7FF' },
  webview: { ...StyleSheet.absoluteFillObject },
});
