// ================================================================
//  FLOAT CARD — narrow nav+gizmo panel system
// ================================================================

window._cardDetached=false;
window._cardHidden=false;

var _syncRafId=null;
function _syncRenderer(){
  // Debounce via RAF: if called multiple times in a frame (e.g. resize + visualViewport
  // both firing), only execute once after the browser has committed the new layout.
  // This also ensures visualViewport.width/height are the final settled values, not
  // mid-transition values from Android freeform→fullscreen expansion.
  if(_syncRafId)cancelAnimationFrame(_syncRafId);
  _syncRafId=requestAnimationFrame(function(){
    _syncRafId=null;
    var _vvp=window.visualViewport;
    var vw=_vvp?_vvp.width:window.innerWidth;
    var vh=_vvp?_vvp.height:window.innerHeight;
    renderer.setSize(vw,vh);
    camera.aspect=vw/vh;
    camera.updateProjectionMatrix();
    syncOrtho();
    _refreshRect();
    // Render synchronously at the new size so the canvas doesn't show a black
    // gap during window-resize reflows. markDirty alone waits for the next
    // rAF (up to ~32ms lag after RAF-debounce + animate tick) — enough for a
    // visible flash when the URL bar animates on Android Chrome.
    renderer.render(scene,activeCam());
    _renderDirty=false;
  });
}

function updateLayoutMode(){
  // Use visualViewport when available — gives correct dimensions in PWA standalone
  // before window.innerWidth/Height have settled after launch
  var _vvp=window.visualViewport;
  var _vw=_vvp?_vvp.width:window.innerWidth;
  var _vh=_vvp?_vvp.height:window.innerHeight;
  var isNarrow=_vw/_vh<(2/3);
  var isUiHidden=document.body.classList.contains('ui-hidden');
  var pb=document.getElementById('narrow-bar');
  var sc=document.getElementById('sidecol');
  var sb=document.getElementById('sbar');
  var card=document.getElementById('pb-float-card');
  var fab=document.getElementById('pb-fab');
  if(isNarrow){
    pb.classList.add('active');
    document.body.classList.add('narrow-mode');
    if(sc)sc.style.display='none';
    if(sb)sb.style.display='none';
    stab.style.display='none';
    // Hide any detached sc-group (they're parented on body, not sidecol, so
    // sidecol.display='none' doesn't cascade to them)
    document.querySelectorAll('.sc-group.detached').forEach(function(g){g.style.display='none';});
    _fcReparent();
    if(!window._fcEverActivated){
      window._fcEverActivated=true;
      // Only dock on first activation if UI is visible
      if(!isUiHidden){
        if(card)card.classList.add('fc-docked-bottom');
        var dockBtn2=document.getElementById('fc-dock-btn');
        if(dockBtn2)dockBtn2.textContent='✦';
      }
    }
    if(!window._cardHidden){
      if(card)card.classList.add('fc-visible');
      if(fab)fab.classList.remove('fab-visible');
    } else {
      if(fab)fab.classList.add('fab-visible');
    }
    setTimeout(function(){
      _syncRenderer();
      _fcResizeCanvases();
      var h=pb.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--pb-h',h+'px');
      // Re-sync surface group so plane isn't stale after canvas resize
      if(typeof syncSurf==='function')syncSurf();
      if(window._gDraw)window._gDraw();
      if(window._pbGcDraw)window._pbGcDraw();
      positionLclFloat();
    },50);
  } else {
    pb.classList.remove('active');
    document.body.classList.remove('narrow-mode');
    // Tablet mode: show float card only when UI is hidden
    if(isUiHidden){
      _fcReparent();
      if(!window._fcEverActivated){window._fcEverActivated=true;}
      if(!window._cardHidden){
        if(card)card.classList.add('fc-visible');
        if(fab)fab.classList.remove('fab-visible');
      } else {
        if(fab)fab.classList.add('fab-visible');
      }
      setTimeout(function(){
        _syncRenderer();_fcResizeCanvases();
        if(typeof syncSurf==='function')syncSurf();
        if(window._gDraw)window._gDraw();
        if(window._pbGcDraw)window._pbGcDraw();
        positionLclFloat();
      },50);
    } else {
      if(sc)sc.style.display='';
      if(sb)sb.style.display='';
      stab.style.display='';
      // Restore any detached sc-group visibility
      document.querySelectorAll('.sc-group.detached').forEach(function(g){g.style.display='';});
      _fcReturn();
      if(card)card.classList.remove('fc-visible');
      if(fab)fab.classList.remove('fab-visible');
      window._cardHidden=false;
      document.documentElement.style.setProperty('--pb-h','0px');
      // Sync renderer + surface after sidecol becomes visible — layout change doesn't fire resize in PWA
      setTimeout(function(){
        _syncRenderer();
        if(typeof syncSurf==='function')syncSurf();
        if(window._gDraw)window._gDraw();
        if(window._pbGcDraw)window._pbGcDraw();
        positionLclFloat();
      },50);
    }
  }
}

function _fcReparent(){
  var fcPanels=document.getElementById('fc-panels');
  var navPanel=document.getElementById('pb-panel-nav');
  var gizPanel=document.getElementById('pb-panel-gizmo');
  if(!fcPanels||!navPanel||!gizPanel)return;
  if(navPanel.parentNode!==fcPanels)fcPanels.appendChild(navPanel);
  if(gizPanel.parentNode!==fcPanels)fcPanels.appendChild(gizPanel);
  window._cardDetached=true;
}

function _fcReturn(){
  var pbPanels=document.getElementById('pb-panels');
  var navPanel=document.getElementById('pb-panel-nav');
  var gizPanel=document.getElementById('pb-panel-gizmo');
  if(!pbPanels||!navPanel||!gizPanel)return;
  if(navPanel.parentNode!==pbPanels)pbPanels.appendChild(navPanel);
  if(gizPanel.parentNode!==pbPanels)pbPanels.appendChild(gizPanel);
  window._cardDetached=false;
}

function _fcResizeCanvases(){
  if(window._cardDetached){
    var navPanel=document.getElementById('pb-panel-nav');
    var gizPanel=document.getElementById('pb-panel-gizmo');
    if(!navPanel||!gizPanel)return;
    var nw=navPanel.clientWidth-2;if(nw<60)nw=60;
    var nh=Math.round(nw*0.88);
    var nc=document.getElementById('pb-navcube');var nj=document.getElementById('pb-navjoy');
    if(nc){nc.width=nw;nc.height=nh;nc.style.width=nw+'px';nc.style.height=nh+'px';}
    if(nj){nj.width=nw;nj.height=nh;nj.style.width=nw+'px';nj.style.height=nh+'px';}
    var gw=gizPanel.clientWidth-6;if(gw<50)gw=50;
    var gh=Math.round(gw*0.80);
    var gc2=document.getElementById('pb-gc');
    if(gc2){gc2.width=gw;gc2.height=gh;gc2.style.width=gw+'px';gc2.style.height=gh+'px';}
    var hintRow=document.getElementById('pb-greset');
    if(hintRow&&hintRow.parentElement)hintRow.parentElement.style.width=gw+'px';
  } else {
    var navPanel2=document.getElementById('pb-panel-nav');
    var gizPanel2=document.getElementById('pb-panel-gizmo');
    if(navPanel2){
      var nw2=navPanel2.clientWidth-2;var nh2=Math.round(nw2*0.88);
      var nc2=document.getElementById('pb-navcube');var nj2=document.getElementById('pb-navjoy');
      if(nc2){nc2.width=nw2;nc2.height=nh2;nc2.style.width=nw2+'px';nc2.style.height=nh2+'px';}
      if(nj2){nj2.width=nw2;nj2.height=nh2;nj2.style.width=nw2+'px';nj2.style.height=nh2+'px';}
    }
    if(gizPanel2){
      var gw2=gizPanel2.clientWidth-6;var gh2=Math.round(gw2*0.80);
      var gc3=document.getElementById('pb-gc');
      if(gc3){gc3.width=gw2;gc3.height=gh2;gc3.style.width=gw2+'px';gc3.style.height=gh2+'px';}
      var hintRow2=document.getElementById('pb-greset');
      if(hintRow2&&hintRow2.parentElement)hintRow2.parentElement.style.width=gw2+'px';
    }
  }
  if(window._pbNcReinit)window._pbNcReinit();
  if(window._pbJoyReinit)window._pbJoyReinit();
  if(window._applyNavToggle)window._applyNavToggle();
  if(window._pbNcDraw)window._pbNcDraw();
  if(window._pbGcDraw)window._pbGcDraw();
}

// ── Narrow float card interactions ─────────────────────────────
(function(){
  var card=document.getElementById('pb-float-card');
  var handle=document.getElementById('fc-handle');
  var closeBtn=document.getElementById('fc-close');
  var dockBtn=document.getElementById('fc-dock-btn');
  var resizeEl=document.getElementById('fc-resize');
  var snapHint=document.getElementById('fc-snap-hint');
  var fab=document.getElementById('pb-fab');
  if(!card||!handle)return;

  var SNAP_DIST=5;  // narrow range — only snap-redock when almost back to docked position
  var DEFAULT_W=Math.min(window.innerWidth-16,340);
  card.style.width=DEFAULT_W+'px';card.style.left='8px';card.style.top='52px';

  function isDocked(){return card.classList.contains('fc-docked-bottom');}
  function undock(){
    card.classList.remove('fc-docked-bottom');
    card.style.left=(window._fcLastLeft||8)+'px';
    card.style.top=(window._fcLastTop||52)+'px';
    card.style.width=(window._fcLastW||DEFAULT_W)+'px';
    card.style.right='';card.style.bottom='';
    if(dockBtn)dockBtn.textContent='⊞';
    setTimeout(_fcResizeCanvases,30);
  }
  function dockTo(edge){
    if(!isDocked()){
      window._fcLastLeft=parseInt(card.style.left)||8;
      window._fcLastTop=parseInt(card.style.top)||52;
      window._fcLastW=card.offsetWidth||DEFAULT_W;
    }
    card.classList.remove('fc-docked-bottom');
    if(edge==='bottom')card.classList.add('fc-docked-bottom');
    card.style.right='';card.style.bottom='';
    if(isDocked()&&window._fcNavResizeReset)window._fcNavResizeReset();
    if(dockBtn)dockBtn.textContent=isDocked()?'✦':'⊞';
    setTimeout(_fcResizeCanvases,30);
  }
  window._fcDockTo=dockTo;window._fcUndock=undock;
  if(dockBtn)dockBtn.addEventListener('click',function(e){e.stopPropagation();if(isDocked()){undock();}else if(!document.body.classList.contains('ui-hidden')){dockTo('bottom');}});

  var dragState=null;
  function snapEdge(nx,ny){
    // Never snap to bottom when UI is hidden — card must stay floating
    if(document.body.classList.contains('ui-hidden'))return null;
    var ch=card.offsetHeight,ih=window.innerHeight;
    // Dock only when bottom edge is within SNAP_DIST px of the viewport bottom.
    // Do NOT use --pb-h — that var is set to the card's own docked height,
    // making the threshold circular and causing premature snapping.
    if(ny+ch>ih-SNAP_DIST)return'bottom';
    return null;
  }
  function onDragStart(e){
    if(e.target===closeBtn||e.target===dockBtn)return;
    if(isDocked())undock();
    e.preventDefault();
    var src=e.touches?e.touches[0]:e,r=card.getBoundingClientRect();
    dragState={ox:src.clientX-r.left,oy:src.clientY-r.top};
  }
  function onDragMove(e){
    if(!dragState)return;e.preventDefault();
    var src=e.touches?e.touches[0]:e;
    var nx=src.clientX-dragState.ox,ny=src.clientY-dragState.oy;
    var cw=card.offsetWidth,ch=card.offsetHeight;
    // No clamping — card moves freely anywhere on screen.
    card.style.left=nx+'px';card.style.top=ny+'px';
    if(snapHint){if(snapEdge(nx,ny))snapHint.classList.add('show');else snapHint.classList.remove('show');}
  }
  function onDragEnd(){
    if(!dragState)return;
    var nx=parseInt(card.style.left)||0,ny=parseInt(card.style.top)||0;
    var edge=snapEdge(nx,ny);
    if(edge){dockTo(edge);}else{window._fcLastLeft=nx;window._fcLastTop=ny;window._fcLastW=card.offsetWidth;}
    if(snapHint)snapHint.classList.remove('show');
    dragState=null;
  }
  handle.addEventListener('touchstart',onDragStart,{passive:false});
  handle.addEventListener('touchmove',onDragMove,{passive:false});
  handle.addEventListener('touchend',onDragEnd);
  handle.addEventListener('mousedown',onDragStart);
  document.addEventListener('mousemove',function(e){if(dragState)onDragMove(e);});
  document.addEventListener('mouseup',function(){if(dragState)onDragEnd();});

  // Width resize — right edge
  var resizeState=null;
  function onResizeStart(e){
    if(isDocked())return;e.preventDefault();e.stopPropagation();
    var src=e.touches?e.touches[0]:e;
    resizeState={sx:src.clientX,sw:card.offsetWidth};
  }
  function onResizeMove(e){
    if(!resizeState)return;e.preventDefault();
    var src=e.touches?e.touches[0]:e;
    var nw=Math.max(200,Math.min(window.innerWidth-16,resizeState.sw+(src.clientX-resizeState.sx)));
    card.style.width=nw+'px';
    var cx=parseInt(card.style.left)||0;
    if(cx+nw>window.innerWidth)card.style.left=Math.max(0,window.innerWidth-nw)+'px';
    _fcResizeCanvases();
  }
  function onResizeEnd(){if(resizeState)window._fcLastW=card.offsetWidth;resizeState=null;_fcResizeCanvases();}
  if(resizeEl){
    resizeEl.addEventListener('touchstart',onResizeStart,{passive:false});
    resizeEl.addEventListener('touchmove',onResizeMove,{passive:false});
    resizeEl.addEventListener('touchend',onResizeEnd);
    resizeEl.addEventListener('mousedown',onResizeStart);
    document.addEventListener('mousemove',function(e){if(resizeState)onResizeMove(e);});
    document.addEventListener('mouseup',function(){if(resizeState)onResizeEnd();});
  }

  if(closeBtn)closeBtn.addEventListener('click',function(e){e.stopPropagation();card.classList.remove('fc-visible');window._cardHidden=true;if(fab)fab.classList.add('fab-visible');});

  var fabDrag=null;
  if(fab){
    fab.style.left='8px';fab.style.top='52px';
    fab.addEventListener('touchstart',function(e){var src=e.touches[0],r=fab.getBoundingClientRect();fabDrag={ox:src.clientX-r.left,oy:src.clientY-r.top,moved:false};},{passive:true});
    fab.addEventListener('touchmove',function(e){if(!fabDrag)return;e.preventDefault();fabDrag.moved=true;var src=e.touches[0];var nx=Math.max(0,Math.min(window.innerWidth-36,src.clientX-fabDrag.ox)),ny=Math.max(0,Math.min(window.innerHeight-36,src.clientY-fabDrag.oy));fab.style.left=nx+'px';fab.style.top=ny+'px';},{passive:false});
    fab.addEventListener('touchend',function(){if(fabDrag&&!fabDrag.moved){window._cardHidden=false;card.classList.add('fc-visible');fab.classList.remove('fab-visible');setTimeout(_fcResizeCanvases,30);}fabDrag=null;});
    fab.addEventListener('click',function(){window._cardHidden=false;card.classList.add('fc-visible');fab.classList.remove('fab-visible');setTimeout(_fcResizeCanvases,30);});
  }
})();

// ── Narrow nav inter-panel resize grip ──────────────────────────
(function(){
  var navGrip=document.getElementById('fc-nav-resize');
  var navPanel=document.getElementById('pb-panel-nav');
  var gizPanel=document.getElementById('pb-panel-gizmo');
  if(!navGrip||!navPanel||!gizPanel)return;
  var navState=null;
  function onStart(e){
    if(document.getElementById('pb-float-card').classList.contains('fc-docked-bottom'))return;
    e.preventDefault();e.stopPropagation();
    var src=e.touches?e.touches[0]:e;
    navState={sx:src.clientX,nw:navPanel.offsetWidth,gw:gizPanel.offsetWidth};
  }
  function onMove(e){
    if(!navState)return;e.preventDefault();
    var src=e.touches?e.touches[0]:e,dx=src.clientX-navState.sx,total=navState.nw+navState.gw;
    var newNw=Math.max(80,Math.min(total-80,navState.nw+dx));
    navPanel.style.flex='none';navPanel.style.width=newNw+'px';
    gizPanel.style.flex='none';gizPanel.style.width=(total-newNw)+'px';
    _fcResizeCanvases();
  }
  function onEnd(){navState=null;_fcResizeCanvases();}
  navGrip.addEventListener('touchstart',onStart,{passive:false});
  navGrip.addEventListener('touchmove',onMove,{passive:false});
  navGrip.addEventListener('touchend',onEnd);
  navGrip.addEventListener('mousedown',onStart);
  document.addEventListener('mousemove',function(e){if(navState)onMove(e);});
  document.addEventListener('mouseup',function(){if(navState)onEnd();});
  window._fcNavResizeReset=function(){navPanel.style.flex='';navPanel.style.width='';gizPanel.style.flex='';gizPanel.style.width='';};
})();

// ── Narrow float card: pinch-to-scale ───────────────────────────
// Two-finger pinch on the card scales its width proportionally.
// Canvases are resized via _fcResizeCanvases after each step.
// Works whether card is docked or floating.
(function(){
  var card=document.getElementById('pb-float-card');
  if(!card)return;
  var pinch=null; // {dist, w}
  function dist(t){
    var dx=t[0].clientX-t[1].clientX,dy=t[0].clientY-t[1].clientY;
    return Math.sqrt(dx*dx+dy*dy);
  }
  card.addEventListener('touchstart',function(e){
    if(e.touches.length===2){
      e.preventDefault();
      pinch={dist:dist(e.touches),w:card.offsetWidth};
    }
  },{passive:false});
  card.addEventListener('touchmove',function(e){
    if(pinch&&e.touches.length===2){
      e.preventDefault();
      var scale=dist(e.touches)/pinch.dist;
      var nw=Math.round(pinch.w*scale);
      nw=Math.max(200,Math.min(window.innerWidth-16,nw));
      card.style.width=nw+'px';
      // Keep card on screen
      if(!card.classList.contains('fc-docked-bottom')){
        var cx=parseInt(card.style.left)||0;
        if(cx+nw>window.innerWidth)card.style.left=Math.max(0,window.innerWidth-nw)+'px';
      }
      if(window._fcResizeCanvases)window._fcResizeCanvases();
    }
  },{passive:false});
  card.addEventListener('touchend',function(e){
    if(e.touches.length<2){
      if(pinch){window._fcLastW=card.offsetWidth;}
      pinch=null;
    }
  });
  card.addEventListener('touchcancel',function(){pinch=null;});
})();
