// ================================================================
//  NARROW CYCLE BUTTONS — plane / surf / axis
//  Tap = cycle to next. Long-press (400ms) = open popover upward.
//  Popover auto-dismisses on selection or outside tap.
// ================================================================
(function(){
  const PLANES=['xz','xy','yz'];
  const PLANE_LABELS={xz:'Front',xy:'Top',yz:'Side'};
  const SURFS=['plane','cube','cylinder','sphere','cone','loft','none'];
  const SURF_LABELS={plane:'Pln',cube:'Cube',cylinder:'Cyl',sphere:'Sph',cone:'Cone',loft:'Lft',none:'Off'};
  const AXES=['all','x','y','z'];

  let openPop=null;

  function closeAllPops(){
    ['pop-plane','pop-surf','pop-axis','pop-mode','pop-plane2','pop-axis2','pop-surf2'].forEach(function(id){
      const p=document.getElementById(id);if(p)p.classList.remove('open');
    });
    openPop=null;
  }
  document.addEventListener('click',function(e){
    if(openPop&&!e.target.closest('.cyc-pop')&&!e.target.closest('.cyc-btn'))closeAllPops();
  });

  function positionPop(pop,btn){
    const br=btn.getBoundingClientRect();
    pop.style.bottom=(window.innerHeight-br.top+4)+'px';
    pop.style.left=Math.max(4,Math.min(br.left,window.innerWidth-pop.offsetWidth-4))+'px';
    pop.style.top='auto';
  }

  function openPop2(popId,btn){
    closeAllPops();
    const pop=document.getElementById(popId);if(!pop)return;
    pop.classList.add('open');
    openPop=popId;
    positionPop(pop,btn);
    // Mark current item
    pop.querySelectorAll('.cyc-pop-item').forEach(function(it){it.classList.remove('cur');});
  }

  function makeCycBtn(btnId,popId,getItems,getCur,applyCur,getLabel){
    const btn=document.getElementById(btnId);if(!btn)return;
    let holdTimer=null;
    function onStart(e){
      e.preventDefault();e.stopPropagation();
      holdTimer=setTimeout(function(){
        holdTimer=null;
        openPop2(popId,btn);
      },400);
    }
    function onEnd(e){
      e.stopPropagation();
      if(holdTimer){
        clearTimeout(holdTimer);holdTimer=null;
        // Short tap — cycle to next
        const items=getItems();const cur=getCur();
        const next=items[(items.indexOf(cur)+1)%items.length];
        applyCur(next);
        btn.textContent=getLabel(next);
        closeAllPops();
      }
    }
    btn.addEventListener('mousedown',onStart);
    btn.addEventListener('touchstart',onStart,{passive:false});
    btn.addEventListener('mouseup',onEnd);
    btn.addEventListener('touchend',onEnd);
    btn.addEventListener('mouseleave',function(){if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}});
    btn.addEventListener('touchcancel',function(){if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}});
  }

  // ── Plane cycle ──────────────────────────────────────────────────
  makeCycBtn('pb-cyc-plane','pop-plane',
    function(){return PLANES;},
    function(){return curPlane;},
    function(v){
      curPlane=v;
      document.querySelectorAll('[data-plane]').forEach(function(b){b.classList.toggle('on',b.dataset.plane===v);});
      if(surfFillMat)surfFillMat.color.setHex(SURF_TRACE);
      if(surfWireMat)surfWireMat.color.setHex(SURF_TRACE);
      syncSurf();
      const btn=document.getElementById('pb-cyc-plane');if(btn)btn.textContent=PLANE_LABELS[v]||v.toUpperCase();
    },
    function(v){return PLANE_LABELS[v]||v.toUpperCase();}
  );
  document.querySelectorAll('[data-cyc-plane]').forEach(function(it){
    it.addEventListener('click',function(){
      const v=this.dataset.cycPlane;
      curPlane=v;
      document.querySelectorAll('[data-plane]').forEach(function(b){b.classList.toggle('on',b.dataset.plane===v);});
      syncSurf();
      const btn=document.getElementById('pb-cyc-plane');if(btn)btn.textContent=PLANE_LABELS[v]||v.toUpperCase();
      closeAllPops();
    });
  });

  // ── Shared surf type application — handles none/loft/standard ────
  // Exposed on window so bindings outside this IIFE (data-surf buttons) can call it
  function applySurfType(v){
    if(v==='none'){
      // Hide surface entirely — no drawing surface active
      surfType='none';
      surfGroup.visible=false;
      document.querySelectorAll('[data-surf]').forEach(function(b){b.classList.remove('on');});
      var bsurf=document.getElementById('bsurf');if(bsurf)bsurf.classList.remove('on');
      _updateLoftDelBtn();
      markDirty();
      toast('No active plane · drawing disabled');
      return;
    }
    if(v==='loft'){
      // Tap while already on loft with stored geo → clear it
      if(surfType==='loft' && window._loftGeo){
        if(window._clearLoft) window._clearLoft();
        _updateLoftDelBtn();
        return;
      }
      document.querySelectorAll('[data-surf]').forEach(function(b){b.classList.remove('on');});
      if(window._loftGeo){
        // Activate stored loft geometry
        if(window._activateLoft) window._activateLoft();
      } else {
        // No loft built yet — switch to select mode so user can pick strokes
        surfType='loft';
        surfGroup.visible=false;
        var bsurf2=document.getElementById('bsurf');if(bsurf2)bsurf2.classList.remove('on');
        markDirty();
        setMode('select');
        toast('Select 2+ strokes · then tap ⟁ Loft');
      }
      _updateLoftDelBtn();
      return;
    }
    // Standard surf types
    surfType=v;
    surfGroup.visible=true;
    var bsurf3=document.getElementById('bsurf');if(bsurf3)bsurf3.classList.add('on');
    document.querySelectorAll('[data-surf]').forEach(function(b){b.classList.toggle('on',b.dataset.surf===v);});
    buildSurf();
    _updateLoftDelBtn();
  }
  window._applySurfType=applySurfType;

  // Show/hide the topbar "Delete loft" button based on current surface state.
  // Visible only when a loft surface is active.
  function _updateLoftDelBtn(){
    var btn=document.getElementById('bdelloft');
    if(!btn)return;
    var isActiveLoft=(surfType==='loft')&&!!window._loftGeo;
    btn.style.display=isActiveLoft?'':'none';
  }
  window._updateLoftDelBtn=_updateLoftDelBtn;
  // Wire the delete button
  (function(){
    var btn=document.getElementById('bdelloft');
    if(!btn)return;
    btn.addEventListener('click',function(){
      if(window._clearLoft)window._clearLoft();
      _updateLoftDelBtn();
      toast('Loft deleted');
    });
  })();

  // ── Surface type cycle ───────────────────────────────────────────
  makeCycBtn('pb-cyc-surf','pop-surf',
    function(){return SURFS;},
    function(){return surfType;},
    function(v){
      applySurfType(v);
      const btn=document.getElementById('pb-cyc-surf');if(btn)btn.textContent=SURF_LABELS[v]||v;
    },
    function(v){return SURF_LABELS[v]||v;}
  );
  document.querySelectorAll('[data-cyc-surf]').forEach(function(it){
    it.addEventListener('click',function(){
      const v=this.dataset.cycSurf;
      applySurfType(v);
      const btn=document.getElementById('pb-cyc-surf');if(btn)btn.textContent=SURF_LABELS[v]||v;
      closeAllPops();
    });
  });

  // ── Axis cycle ───────────────────────────────────────────────────
  makeCycBtn('pb-cyc-axis','pop-axis',
    function(){return AXES;},
    function(){return document.getElementById('ga-all')&&document.getElementById('ga-all').classList.contains('on')?'all':['x','y','z'].find(function(a){const b=document.getElementById('ga-'+a);return b&&b.classList.contains('on');})||'all';},
    function(v){
      if(window._setAxisFilter)window._setAxisFilter(v);
      const btn=document.getElementById('pb-cyc-axis');if(btn)btn.textContent=v==='all'?'All':v.toUpperCase();
    },
    function(v){return v==='all'?'All':v.toUpperCase();}
  );
  document.querySelectorAll('[data-cyc-axis]').forEach(function(it){
    it.addEventListener('click',function(){
      const v=this.dataset.cycAxis;
      if(window._setAxisFilter)window._setAxisFilter(v);
      const btn=document.getElementById('pb-cyc-axis');if(btn)btn.textContent=v==='all'?'All':v.toUpperCase();
      closeAllPops();
    });
  });

  // ── Gizmo panel 4-button cycle row ───────────────────────────────
  // Helper: get current gizmo mode label
  function getGizmoModeLabel(m){return m==='all'?'All':m==='move'?'Mv':m==='rotate'?'Rot':'Sc';}
  function getCurMode(){return window._getGizmoMode?window._getGizmoMode():'all';}

  // Mode button
  makeCycBtn('pb-cyc-mode','pop-mode',
    function(){return['all','move','rotate','scale'];},
    getCurMode,
    function(v){
      if(window._setGizmoMode)window._setGizmoMode(v);
      const btn=document.getElementById('pb-cyc-mode');if(btn)btn.textContent=getGizmoModeLabel(v);
    },
    getGizmoModeLabel
  );
  document.querySelectorAll('[data-cyc-mode]').forEach(function(it){
    it.addEventListener('click',function(){
      const v=this.dataset.cycMode;
      if(window._setGizmoMode)window._setGizmoMode(v);
      const btn=document.getElementById('pb-cyc-mode');if(btn)btn.textContent=getGizmoModeLabel(v);
      closeAllPops();
    });
  });

  // Plane button (gizmo panel)
  makeCycBtn('pb-cyc-plane2','pop-plane2',
    function(){return PLANES;},
    function(){return curPlane;},
    function(v){
      curPlane=v;
      document.querySelectorAll('[data-plane]').forEach(function(b){b.classList.toggle('on',b.dataset.plane===v);});
      syncSurf();
      const btn=document.getElementById('pb-cyc-plane2');if(btn)btn.textContent=PLANE_LABELS[v]||v.toUpperCase();
      const sb=document.getElementById('sb-cyc-plane');if(sb)sb.textContent=PLANE_LABELS[v]||v.toUpperCase();
      // sync old cycle bar button if still present
      const b2=document.getElementById('pb-cyc-plane');if(b2)b2.textContent=PLANE_LABELS[v]||v.toUpperCase();
    },
    function(v){return PLANE_LABELS[v]||v.toUpperCase();}
  );
  document.querySelectorAll('[data-cyc-plane2]').forEach(function(it){
    it.addEventListener('click',function(){
      const v=this.dataset.cycPlane2;
      curPlane=v;
      document.querySelectorAll('[data-plane]').forEach(function(b){b.classList.toggle('on',b.dataset.plane===v);});
      syncSurf();
      const btn=document.getElementById('pb-cyc-plane2');if(btn)btn.textContent=PLANE_LABELS[v]||v.toUpperCase();
      const sb=document.getElementById('sb-cyc-plane');if(sb)sb.textContent=PLANE_LABELS[v]||v.toUpperCase();
      closeAllPops();
    });
  });

  // Axis button (gizmo panel)
  makeCycBtn('pb-cyc-axis2','pop-axis2',
    function(){return AXES;},
    function(){return document.getElementById('ga-all')&&document.getElementById('ga-all').classList.contains('on')?'all':['x','y','z'].find(function(a){const b=document.getElementById('ga-'+a);return b&&b.classList.contains('on');})||'all';},
    function(v){
      if(window._setAxisFilter)window._setAxisFilter(v);
      const btn=document.getElementById('pb-cyc-axis2');if(btn)btn.textContent=v==='all'?'All':v.toUpperCase();
    },
    function(v){return v==='all'?'All':v.toUpperCase();}
  );
  document.querySelectorAll('[data-cyc-axis2]').forEach(function(it){
    it.addEventListener('click',function(){
      const v=this.dataset.cycAxis2;
      if(window._setAxisFilter)window._setAxisFilter(v);
      const btn=document.getElementById('pb-cyc-axis2');if(btn)btn.textContent=v==='all'?'All':v.toUpperCase();
      closeAllPops();
    });
  });

  // Surface button (gizmo panel)
  makeCycBtn('pb-cyc-surf2','pop-surf2',
    function(){return SURFS;},
    function(){return surfType;},
    function(v){
      applySurfType(v);
      const btn=document.getElementById('pb-cyc-surf2');if(btn)btn.textContent=SURF_LABELS[v]||v;
      const sb=document.getElementById('sb-cyc-surf');if(sb)sb.textContent=SURF_LABELS[v]||v;
    },
    function(v){return SURF_LABELS[v]||v;}
  );
  document.querySelectorAll('[data-cyc-surf2]').forEach(function(it){
    it.addEventListener('click',function(){
      const v=this.dataset.cycSurf2;
      applySurfType(v);
      const btn=document.getElementById('pb-cyc-surf2');if(btn)btn.textContent=SURF_LABELS[v]||v;
      const sb=document.getElementById('sb-cyc-surf');if(sb)sb.textContent=SURF_LABELS[v]||v;
      closeAllPops();
    });
  });

  // ── Sidebar gizmo 4-button cycle row ─────────────────────────────
  // Mode
  makeCycBtn('sb-cyc-mode','pop-mode',
    function(){return['all','move','rotate','scale'];},
    getCurMode,
    function(v){
      if(window._setGizmoMode)window._setGizmoMode(v);
      const btn=document.getElementById('sb-cyc-mode');if(btn)btn.textContent=getGizmoModeLabel(v);
    },
    getGizmoModeLabel
  );
  // Plane
  makeCycBtn('sb-cyc-plane','pop-plane2',
    function(){return PLANES;},
    function(){return curPlane;},
    function(v){
      curPlane=v;
      document.querySelectorAll('[data-plane]').forEach(function(b){b.classList.toggle('on',b.dataset.plane===v);});
      syncSurf();
      const btn=document.getElementById('sb-cyc-plane');if(btn)btn.textContent=PLANE_LABELS[v]||v.toUpperCase();
      var b2=document.getElementById('pb-cyc-plane2');if(b2)b2.textContent=PLANE_LABELS[v]||v.toUpperCase();
    },
    function(v){return PLANE_LABELS[v]||v.toUpperCase();}
  );
  // Axis
  makeCycBtn('sb-cyc-axis','pop-axis2',
    function(){return AXES;},
    function(){return document.getElementById('ga-all')&&document.getElementById('ga-all').classList.contains('on')?'all':(['x','y','z'].find(function(a){var b=document.getElementById('ga-'+a);return b&&b.classList.contains('on');})||'all');},
    function(v){
      if(window._setAxisFilter)window._setAxisFilter(v);
      var btn=document.getElementById('sb-cyc-axis');if(btn)btn.textContent=v==='all'?'All':v.toUpperCase();
    },
    function(v){return v==='all'?'All':v.toUpperCase();}
  );
  // Surface type
  makeCycBtn('sb-cyc-surf','pop-surf2',
    function(){return SURFS;},
    function(){return surfType;},
    function(v){
      applySurfType(v);
      var btn=document.getElementById('sb-cyc-surf');if(btn)btn.textContent=SURF_LABELS[v]||v;
      var b2=document.getElementById('pb-cyc-surf2');if(b2)b2.textContent=SURF_LABELS[v]||v;
    },
    function(v){return SURF_LABELS[v]||v;}
  );

  // Keep sidebar surface button in sync when narrow buttons change plane state
  // (plane sync is handled directly in each applyCur callback above)
})();
