/* ThreeKip Web Desktop â€” vanilla JS shell that drives the engine via the
   Sketchbook Bridge protocol (same as the React Native app).
   Parent window posts {type:'cmd', id, name, payload} to the engine iframe;
   the engine's rn-transport forwards responses/events back to window.parent. */

(function () {
  "use strict";

  var STORE_KEY = "threekip_projects";
  var frame = document.getElementById("engineFrame");

  // ---------- state ----------
  var projects = loadProjects();
  var filter = "all";
  var query = "";
  var sort = "date"; // or 'name'
  var currentId = null;
  var pendingCmds = {}; // id -> {resolve, reject, timer}
  var cmdSeq = 1;
  var engineReady = false;

  // ---------- storage ----------
  function loadProjects() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveProjects() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(projects)); } catch (e) {}
  }
  function uid() { return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- toast ----------
  var toastEl = document.getElementById("toast");
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.add("hidden"); }, 2200);
  }

  // ---------- library rendering ----------
  var grid = document.getElementById("projectGrid");
  var emptyState = document.getElementById("emptyState");
  var emptyText = document.getElementById("emptyText");

  function visibleProjects() {
    var list = projects.slice();
    if (filter === "favorites") list = list.filter(function (p) { return p.favorite && !p.trashed; });
    else if (filter === "trash") list = list.filter(function (p) { return p.trashed; });
    else list = list.filter(function (p) { return !p.trashed; }); // all/recent/shared
    if (query.trim()) {
      var q = query.toLowerCase();
      list = list.filter(function (p) { return p.name.toLowerCase().indexOf(q) >= 0; });
    }
    list.sort(function (a, b) {
      if (sort === "name") return a.name.localeCompare(b.name);
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });
    return list;
  }

  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString(); } catch (e) { return ""; }
  }
  function fmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; }
  }

  function render() {
    var list = visibleProjects();
    grid.innerHTML = "";
    if (!list.length) {
      grid.classList.add("hidden");
      emptyState.classList.remove("hidden");
      emptyText.textContent = filter === "trash" ? "La papelera estÃ¡ vacÃ­a." : "No hay proyectos aquÃ­.";
      return;
    }
    grid.classList.remove("hidden");
    emptyState.classList.add("hidden");

    list.forEach(function (p) {
      var card = document.createElement("div");
      card.className = "card";
      card.innerHTML =
        '<div class="card-thumb">' +
          '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' +
        "</div>" +
        '<div class="card-body">' +
          '<div class="card-name">' + escapeHtml(p.name) + "</div>" +
          '<div class="card-meta">' + fmtDate(p.updatedAt) + " Â· " + fmtTime(p.updatedAt) + "</div>" +
        "</div>" +
        (p.favorite ? '<div class="card-fav"><svg viewBox="0 0 24 24" width="14" height="14" fill="#FBBF24" stroke="#FBBF24" stroke-width="2"><path d="M12 2 15 9l7 .5-5.5 4.5L18 21l-6-4-6 4 2-7L3 9.5 10 9z"/></svg></div>' : "") +
        '<button class="card-options" title="Opciones">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>' +
        "</button>";

      card.addEventListener("click", function () { openProject(p.id); });
      card.querySelector(".card-options").addEventListener("click", function (e) {
        e.stopPropagation();
        showOptions(p.id);
      });
      grid.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- options sheet ----------
  var sheetBackdrop = document.getElementById("sheetBackdrop");
  var sheetTitle = document.getElementById("sheetTitle");
  var sheetBody = document.getElementById("sheetBody");

  function openSheet(title, items) {
    sheetTitle.textContent = title;
    sheetBody.innerHTML = "";
    items.forEach(function (it) {
      var el = document.createElement("div");
      el.className = "sheet-item" + (it.danger ? " danger" : "");
      el.innerHTML = '<span>' + it.label + "</span>";
      el.addEventListener("click", function () {
        closeSheet();
        it.onClick();
      });
      sheetBody.appendChild(el);
    });
    sheetBackdrop.classList.remove("hidden");
  }
  function closeSheet() { sheetBackdrop.classList.add("hidden"); }
  sheetBackdrop.addEventListener("click", function (e) { if (e.target === sheetBackdrop) closeSheet(); });

  function showOptions(id) {
    var p = projects.find(function (x) { return x.id === id; });
    if (!p) return;
    var items = [];
    if (p.trashed) {
      items.push({ label: "Restaurar", onClick: function () { p.trashed = false; saveProjects(); render(); } });
      items.push({ label: "Eliminar permanentemente", danger: true, onClick: function () {
        projects = projects.filter(function (x) { return x.id !== id; }); saveProjects(); render();
      } });
    } else {
      items.push({ label: "Abrir", onClick: function () { openProject(id); } });
      items.push({ label: "Renombrar", onClick: function () { renameProject(id); } });
      items.push({ label: p.favorite ? "Quitar de favoritos" : "Favorito", onClick: function () {
        p.favorite = !p.favorite; saveProjects(); render();
      } });
      items.push({ label: "Mover a papelera", danger: true, onClick: function () {
        p.trashed = true; saveProjects(); render();
      } });
    }
    openSheet(p.name, items);
  }

  function renameProject(id) {
    var p = projects.find(function (x) { return x.id === id; });
    if (!p) return;
    sheetTitle.textContent = "Renombrar";
    sheetBody.innerHTML = "";
    var input = document.createElement("input");
    input.className = "sheet-input";
    input.value = p.name;
    sheetBody.appendChild(input);
    var btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.textContent = "Guardar";
    sheetBody.appendChild(btn);
    btn.addEventListener("click", function () {
      p.name = input.value.trim() || "Sin tÃ­tulo";
      saveProjects(); render(); closeSheet();
    });
    input.focus();
  }

  // ---------- editor / engine bridge ----------
  function showEditor() {
    document.getElementById("desktop").classList.add("hidden");
    document.getElementById("editor").classList.remove("hidden");
  }
  function showDesktop() {
    document.getElementById("editor").classList.add("hidden");
    document.getElementById("desktop").classList.remove("hidden");
    frame.src = "about:blank"; // free engine resources
    engineReady = false;
    render();
  }

  function openProject(id, data) {
    var p = projects.find(function (x) { return x.id === id; });
    if (!p) return;
    currentId = id;
    document.getElementById("editorTitle").textContent = p.name;
    showEditor();
    startEngine(p.data || {});
  }

  function newProject() {
    var p = { id: uid(), name: "Sin tÃ­tulo", updatedAt: Date.now(), data: {}, favorite: false, trashed: false };
    projects.unshift(p);
    saveProjects();
    currentId = p.id;
    document.getElementById("editorTitle").textContent = p.name;
    showEditor();
    startEngine({});
  }

  function startEngine(sceneData) {
    engineReady = false;
    document.getElementById("engineLoading").classList.remove("hidden");
    frame.src = "engine/";
    frame.onload = function () {
      injectHide();
      whenBridgeReady(function () {
        injectHide();
        setWhiteBg();
        postCommand("loadProject", { data: sceneData || {} }).then(function () {
          hideSpinner();
        }).catch(function (err) {
          console.error("loadProject failed", err);
          hideSpinner();
        });
        // safety net: never leave the spinner stuck
        setTimeout(hideSpinner, 5000);
      });
    };
  }

  function hideSpinner() {
    document.getElementById("engineLoading").classList.add("hidden");
  }

  // Poll the engine's Bridge directly from the parent (same-origin iframe).
  function whenBridgeReady(cb) {
    var n = 0;
    var iv = setInterval(function () {
      n++;
      var ok = false;
      try {
        ok = frame.contentWindow && frame.contentWindow.SketchbookBridge &&
             typeof frame.contentWindow.SketchbookBridge.execute === "function";
      } catch (e) {}
      if (ok) { clearInterval(iv); cb(); }
      else if (n > 150) { clearInterval(iv); toast("Motor no disponible"); }
    }, 100);
  }

  function injectHide() {
    try {
      var doc = frame.contentDocument;
      if (!doc) return;
      if (!doc.getElementById("tk-web-hide")) {
        var s = doc.createElement("style");
        s.id = "tk-web-hide";
        s.textContent =
          "#topbar,#narrow-bar,#bhide,#sc-hidden-toggle,#sc-hidden-bar,#pb-fab,#sc-fab,#lcl-float-group,#fps-overlay{display:none!important;visibility:hidden!important;}";
        (doc.head || doc.documentElement).appendChild(s);
      }
      // keep re-injecting briefly in case engine rebuilds the bars
      var n = 0;
      var iv = setInterval(function () {
        if (!doc.getElementById("tk-web-hide")) {
          var s2 = doc.createElement("style");
          s2.id = "tk-web-hide";
          s2.textContent = "#topbar,#narrow-bar,#bhide,#sc-hidden-toggle,#sc-hidden-bar,#pb-fab,#sc-fab,#lcl-float-group,#fps-overlay{display:none!important;visibility:hidden!important;}";
          (doc.head || doc.documentElement).appendChild(s2);
        }
        if (++n > 12) clearInterval(iv);
      }, 400);
    } catch (e) { /* cross-origin guard */ }
  }

  function setWhiteBg() {
    try {
      var doc = frame.contentDocument;
      var ci = doc && doc.getElementById("bgpop-custom");
      if (ci) { ci.value = "#ffffff"; ci.dispatchEvent(new Event("input", { bubbles: true })); }
    } catch (e) {}
  }

  // post a command to the engine and return a promise resolved by its response
  function postCommand(name, payload) {
    return new Promise(function (resolve, reject) {
      var id = "c" + (cmdSeq++);
      pendingCmds[id] = { resolve: resolve, reject: reject };
      var timer = setTimeout(function () {
        delete pendingCmds[id];
        reject(new Error("timeout: " + name));
      }, 15000);
      pendingCmds[id].timer = timer;
      try {
        frame.contentWindow.postMessage({ type: "cmd", id: id, name: name, payload: payload || {} }, "*");
      } catch (e) { delete pendingCmds[id]; reject(e); }
    });
  }

  // messages from the engine iframe (rn-transport forwards to window.parent)
  window.addEventListener("message", function (e) {
    if (e.source !== frame.contentWindow) return;
    var msg = e.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "ready") { engineReady = true; }
    else if (msg.type === "res" && msg.id && pendingCmds[msg.id]) {
      var p = pendingCmds[msg.id];
      clearTimeout(p.timer);
      delete pendingCmds[msg.id];
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error || "command failed"));
    } else if (msg.type === "evt" && msg.event === "projectLoaded") {
      document.getElementById("engineLoading").classList.add("hidden");
    }
  });

  // ---------- toolbar handlers ----------
  function sendKey(key) {
    try { frame.contentWindow.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true })); } catch (e) {}
  }

  document.querySelectorAll(".tool-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tool-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      postCommand("setTool", { tool: btn.dataset.tool }).catch(function () {});
    });
  });

  document.getElementById("undoBtn").addEventListener("click", function () { postCommand("undo").catch(function () {}); });
  document.getElementById("redoBtn").addEventListener("click", function () { postCommand("redo").catch(function () {}); });
  document.getElementById("perspBtn").addEventListener("click", function () { sendKey("v"); });
  document.getElementById("axisBtn").addEventListener("click", function () { sendKey("a"); });

  document.getElementById("saveBtn").addEventListener("click", function () { saveCurrent(); });
  document.getElementById("exportPngBtn").addEventListener("click", function () {
    var name = currentName();
    postCommand("export", { format: "png", name: name }).then(function () { toast("Exportando PNGâ€¦"); }).catch(function () { toast("Error al exportar"); });
  });
  document.getElementById("exportGlbBtn").addEventListener("click", function () {
    var name = currentName();
    postCommand("export", { format: "glb", name: name }).then(function () { toast("Exportando GLBâ€¦"); }).catch(function () { toast("Error al exportar"); });
  });

  function currentName() {
    var p = projects.find(function (x) { return x.id === currentId; });
    return p ? p.name : "threekip";
  }

  function saveCurrent() {
    if (!currentId) return;
    postCommand("saveProject", { name: currentName() }).then(function (res) {
      var p = projects.find(function (x) { return x.id === currentId; });
      if (p && res && res.data) { p.data = res.data; p.updatedAt = Date.now(); saveProjects(); }
      toast("Guardado");
    }).catch(function () { toast("Error al guardar"); });
  }

  document.getElementById("backBtn").addEventListener("click", function () {
    if (currentId) {
      // autosave before leaving
      postCommand("saveProject", { name: currentName() }).then(function (res) {
        var p = projects.find(function (x) { return x.id === currentId; });
        if (p && res && res.data) { p.data = res.data; p.updatedAt = Date.now(); saveProjects(); }
      }).catch(function () {});
    }
    showDesktop();
  });

  // ---------- library events ----------
  document.getElementById("newFab").addEventListener("click", newProject);
  document.getElementById("emptyNew").addEventListener("click", newProject);
  document.getElementById("emptyImport").addEventListener("click", function () { document.getElementById("importInput").click(); });

  document.getElementById("searchInput").addEventListener("input", function (e) { query = e.target.value; render(); });
  document.getElementById("sortBtn").addEventListener("click", function () {
    sort = sort === "date" ? "name" : "date"; render();
  });
  document.querySelectorAll("#filterTabs .tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll("#filterTabs .tab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      filter = tab.dataset.filter;
      render();
    });
  });

  document.getElementById("importInput").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var p = { id: uid(), name: file.name.replace(/\.(sk3d|json)$/i, ""), updatedAt: Date.now(), data: data, favorite: false, trashed: false };
        projects.unshift(p); saveProjects();
        currentId = p.id;
        document.getElementById("editorTitle").textContent = p.name;
        showEditor(); startEngine(data);
      } catch (err) { toast("Archivo invÃ¡lido"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("settingsBtn").addEventListener("click", function () {
    openSheet("Ajustes", [
      { label: "Acerca de ThreeKip", onClick: function () { toast("ThreeKip Â· Editor 3D"); } },
      { label: "Limpiar todo", onClick: function () {
        if (confirm("Â¿Borrar todos los proyectos?")) { projects = []; saveProjects(); render(); }
      } }
    ]);
  });

  // ---------- init ----------
  render();
})();

