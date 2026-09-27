// ================================================================
//  LOFT — persistent drawing plane from 2+ selected strokes
//  _loftGeo persists in memory for the session.
//  Cycle to 'loft' surf type to reactivate; tap ⟁ Loft again to rebuild.
//  Tap 'Lft' in surf cycle while already on loft → clears _loftGeo.
//  Cleared on newScene(). Serialises as 'plane' on save (ephemeral by design).
// ================================================================
(function(){
  // Stored loft geometry + centroid — persists until newScene() or explicit clear
  window._loftGeo = null;
  window._loftCen = null;

  // Resample a stroke's world-space points to N evenly-spaced samples
  function resampleStroke(stroke, N){
    var wpts = stroke.pts.map(function(p){return p.clone().applyMatrix4(stroke.mesh.matrix);});
    if(wpts.length < 2) return null;
    var lens = [0];
    for(var i = 1; i < wpts.length; i++) lens.push(lens[i-1] + wpts[i].distanceTo(wpts[i-1]));
    var total = lens[lens.length-1];
    if(total < 1e-6) return null;
    var result = [];
    for(var s = 0; s < N; s++){
      var t = s / (N-1) * total;
      var lo = 0, hi = lens.length-2;
      while(lo < hi){ var mid = (lo+hi)>>1; if(lens[mid+1] < t) lo=mid+1; else hi=mid; }
      var seg = lo;
      var segLen = lens[seg+1] - lens[seg];
      var alpha = segLen < 1e-10 ? 0 : (t - lens[seg]) / segLen;
      result.push(wpts[seg].clone().lerp(wpts[seg+1], alpha));
    }
    return result;
  }

  function buildLoftGeo(rails, N){
    var M = rails.length;
    var pos = [], norms = [], idx = [];
    for(var ri = 0; ri < M; ri++){
      for(var pi = 0; pi < N; pi++){
        var p = rails[ri][pi];
        pos.push(p.x, p.y, p.z);
        norms.push(0, 1, 0);
      }
    }
    for(var ri = 0; ri < M-1; ri++){
      for(var pi = 0; pi < N-1; pi++){
        var a = ri*N + pi;
        var b = ri*N + pi+1;
        var c = (ri+1)*N + pi;
        var d = (ri+1)*N + pi+1;
        idx.push(a, b, c,  b, d, c);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // Apply stored _loftGeo to the active surfGroup
  window._activateLoft = function(){
    if(!window._loftGeo || !window._loftCen){ toast('No loft — select 2+ strokes → ⟁ Loft'); return; }
    var geo = window._loftGeo;
    var cen = window._loftCen;
    surfPos.copy(cen);
    surfEuler.set(0,0,0);
    surfScale = 1;
    surfScaleAxes.set(1,1,1);
    surfType = 'plane';
    curPlane = 'xz';
    buildSurf();
    if(surfMesh && surfMesh.geometry){ surfMesh.geometry.dispose(); surfMesh.geometry = geo.clone(); }
    if(_frostedMesh && _frostedMesh.geometry){ _frostedMesh.geometry.dispose(); _frostedMesh.geometry = geo.clone(); }
    if(_frostedGridMesh && _frostedGridMesh.geometry){ _frostedGridMesh.geometry.dispose(); _frostedGridMesh.geometry = geo.clone(); }
    surfType = 'loft';
    surfGroup.visible = true;
    surfGroup.position.copy(surfPos);
    surfGroup.rotation.copy(new THREE.Euler(0,0,0));
    surfGroup.scale.set(1,1,1);
    // Sync all surf cycle buttons
    ['pb-cyc-surf','pb-cyc-surf2','sb-cyc-surf'].forEach(function(id){
      var b=document.getElementById(id);if(b)b.textContent='Lft';
    });
    var bsurf=document.getElementById('bsurf');if(bsurf)bsurf.classList.add('on');
    markDirty();
    setMode('draw');
  };

  // Clear the stored loft and fall back to none
  window._clearLoft = function(){
    if(window._loftGeo){ window._loftGeo.dispose(); window._loftGeo=null; }
    window._loftCen = null;
    surfGroup.visible = false;
    surfType = 'none';
    ['pb-cyc-surf','pb-cyc-surf2','sb-cyc-surf'].forEach(function(id){
      var b=document.getElementById(id);if(b)b.textContent='Off';
    });
    var bsurf=document.getElementById('bsurf');if(bsurf)bsurf.classList.remove('on');
    markDirty();
    setMode('select');
    toast('Loft cleared · select strokes to build new loft');
  };

  function loftFromSelection(){
    if(selectedStrokes.length < 2){ toast('Select 2+ strokes to loft'); return; }
    var N = 48;
    var rails = [];
    for(var i = 0; i < selectedStrokes.length; i++){
      var r = resampleStroke(selectedStrokes[i], N);
      if(!r){ toast('Stroke too short to loft'); return; }
      rails.push(r);
    }

    var cen = new THREE.Vector3();
    var total = 0;
    rails.forEach(function(r){ r.forEach(function(p){ cen.add(p); total++; }); });
    cen.divideScalar(total);

    var geo = buildLoftGeo(rails, N);
    var posArr = geo.attributes.position.array;
    for(var i = 0; i < posArr.length; i+=3){
      posArr[i]   -= cen.x;
      posArr[i+1] -= cen.y;
      posArr[i+2] -= cen.z;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();

    // Dispose old stored geo if present
    if(window._loftGeo){ window._loftGeo.dispose(); }
    window._loftGeo = geo;
    window._loftCen = cen.clone();

    // Activate immediately
    window._activateLoft();
    clearSelection();
    toast('Loft built · draw on it · cycle Lft again to clear');
  }

  // sg-loft button: build from selection
  document.getElementById('sg-loft').addEventListener('click', function(){
    // If already on loft with a stored geo, tapping again clears it
    if(surfType === 'loft' && selectedStrokes.length === 0 && window._loftGeo){
      window._clearLoft();
    } else {
      loftFromSelection();
    }
  });
})();
