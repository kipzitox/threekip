// ── Export filename prompt ──────────────────────────────────────
// Generic prompt for export filename — reuses its own modal (#export-name-modal).
// ext includes the dot, e.g. '.glb'. callback receives (name) with no ext.
function promptExportName(defaultName, ext, callback){
  var enmod=document.getElementById('export-name-modal');
  var inp=document.getElementById('export-name-input');
  var extSpan=document.getElementById('export-name-ext');
  inp.value=defaultName||'sketch3d';
  extSpan.textContent=ext;
  enmod._expCallback=callback;
  enmod._expExt=ext;
  enmod.classList.add('vis');
  inp.focus();inp.select();
}

// ── PNG export ────────────────────────────────────────────────────
function expPNG(returnData){var _sg=gridH.visible,_sa=axisGroup.visible,_ss=surfGroup.visible;gridH.visible=false;axisGroup.visible=false;surfGroup.visible=false;renderer.render(scene,activeCam());const url=renderer.domElement.toDataURL('image/png');gridH.visible=_sg;axisGroup.visible=_sa;surfGroup.visible=_ss;markDirty();if(returnData)return url.split(',')[1];const a=document.createElement('a');a.href=url;a.download='sketch3d.png';a.click();toast('PNG saved');}

// sceneData, loadData, loadAllPages, save/load, IDB — see js/core/persistence-manager.js
