// ── Material Design 3 — dark/light theme toggle ──
// Initial theme is set by the inline <head> script (pre-paint). This file only
// wires the toggle buttons and re-syncs theme-dependent chrome on switch.

function _getTheme(){return document.documentElement.getAttribute('data-theme')||'light';}

function _applyTheme(t){
  var el=document.documentElement;
  if(t==='dark')el.setAttribute('data-theme','dark');else el.removeAttribute('data-theme');
  window._inkRGB=(t==='dark')?'230,224,233':'29,27,32';
  try{localStorage.setItem('sk3d_theme',t);}catch(e){}
  // Sync browser chrome color
  var m=document.querySelector('meta[name=theme-color]');
  if(m)m.setAttribute('content',getComputedStyle(el).getPropertyValue('--md-surface').trim());
  // Repaint UI canvases that baked ink colours
  markDirty();
  if(window._syncLocalGizmo)window._syncLocalGizmo();
  if(window.updateScaleBarLabel)updateScaleBarLabel();
}

function toggleTheme(){_applyTheme(_getTheme()==='dark'?'light':'dark');}

(function(){
  var b=document.getElementById('btheme');if(b)b.addEventListener('click',toggleTheme);
  var pb=document.getElementById('pb-theme');if(pb)pb.addEventListener('click',toggleTheme);
  var m=document.querySelector('meta[name=theme-color]');
  if(m)m.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--md-surface').trim());
})();
