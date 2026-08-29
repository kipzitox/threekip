// ── ExportManager — GLTF, OBJ, USD, USDZ export ─────────────────
// Owns: expGLTF, expOBJ, buildUSDA, expUSD, expUSDZ
// Dependencies (global): strokes, exportScaleMult, SCALE_LABELS,
//   exportScaleIdx, toast, renderer, scene, activeCam, THREE

function bytesToBase64(bytes) {
  var bin = '', chunk = 0x8000;
  for (var i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function expGLTF(expName, returnData) {
  var meshes = [];
  var sc = exportScaleMult();
  strokes.forEach(function (s) {
    if (s.pts.length < 2) return;
    try {
      var wpts = s.pts.map(function (p) {
        return p.clone().applyMatrix4(s.mesh.matrix).multiplyScalar(sc);
      });
      var geo = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(wpts),
        Math.max(wpts.length * 3, 8), s.sz * .011 * sc, 6, false
      );
      var c = new THREE.Color(s.color);
      meshes.push({ geo: geo, col: [c.r, c.g, c.b], op: s.op });
    } catch (e) {}
  });
  if (!meshes.length) { alert('Nothing to export.'); return; }

  var bvs = [], accs = [], mds = [], mts = [], cks = [], bo = 0;
  meshes.forEach(function (m, mi) {
    var pos = m.geo.attributes.position;
    var idx = m.geo.index;
    var pb = new Float32Array(pos.array);
    var ib = idx ? new Uint32Array(idx.array) : null;
    bvs.push({ buffer: 0, byteOffset: bo, byteLength: pb.byteLength, target: 34962 });
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (var i = 0; i < pos.array.length; i += 3) {
      mn[0] = Math.min(mn[0], pos.array[i]); mn[1] = Math.min(mn[1], pos.array[i + 1]); mn[2] = Math.min(mn[2], pos.array[i + 2]);
      mx[0] = Math.max(mx[0], pos.array[i]); mx[1] = Math.max(mx[1], pos.array[i + 1]); mx[2] = Math.max(mx[2], pos.array[i + 2]);
    }
    accs.push({ bufferView: bvs.length - 1, componentType: 5126, count: pos.count, type: 'VEC3', min: mn, max: mx });
    cks.push(new Uint8Array(pb.buffer));
    bo += pb.byteLength;
    var pr = { attributes: { POSITION: accs.length - 1 }, mode: 4 };
    if (ib) {
      bvs.push({ buffer: 0, byteOffset: bo, byteLength: ib.byteLength, target: 34963 });
      accs.push({ bufferView: bvs.length - 1, componentType: 5125, count: idx.count, type: 'SCALAR' });
      pr.indices = accs.length - 1;
      cks.push(new Uint8Array(ib.buffer));
      bo += ib.byteLength;
    }
    pr.material = mi;
    mds.push({ primitives: [pr] });
    mts.push({ pbrMetallicRoughness: { baseColorFactor: [m.col[0], m.col[1], m.col[2], m.op], metallicFactor: .04, roughnessFactor: .55 }, alphaMode: m.op < 1 ? 'BLEND' : 'OPAQUE' });
  });

  var nodes = mds.map(function (_, i) { return { mesh: i }; });
  var gltf = { asset: { version: '2.0', generator: 'Sketch3D v4.1' }, scene: 0, scenes: [{ nodes: nodes.map(function (_, i) { return i; }) }], nodes: nodes, meshes: mds, materials: mts, accessors: accs, bufferViews: bvs, buffers: [{ byteLength: bo }] };

  var jb = new TextEncoder().encode(JSON.stringify(gltf)), jl = jb.length, jp = (4 - jl % 4) % 4;
  var bin = new Uint8Array(bo); var off = 0;
  cks.forEach(function (c) { bin.set(c, off); off += c.byteLength; });
  var bl = bin.length, bp = (4 - bl % 4) % 4, tot = 12 + 8 + (jl + jp) + 8 + (bl + bp);
  var out = new ArrayBuffer(tot);
  var dv = new DataView(out); var p = 0;
  dv.setUint32(p, 0x46546C67, true); p += 4;
  dv.setUint32(p, 2, true); p += 4;
  dv.setUint32(p, tot, true); p += 4;
  dv.setUint32(p, jl + jp, true); p += 4;
  dv.setUint32(p, 0x4E4F534A, true); p += 4;
  new Uint8Array(out, p).set(jb);
  for (var i = 0; i < jp; i++) new Uint8Array(out)[p + jl + i] = 0x20;
  p += jl + jp;
  dv.setUint32(p, bl + bp, true); p += 4;
  dv.setUint32(p, 0x004E4942, true); p += 4;
  new Uint8Array(out, p).set(bin);

  if (returnData) return bytesToBase64(new Uint8Array(out));
  var blob = new Blob([out], { type: 'model/gltf-binary' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = (expName || 'sketch3d') + '.glb'; a.click();
  URL.revokeObjectURL(url); toast('GLB exported');
}

function expOBJ(expName, returnData) {
  if (!strokes.length) { alert('Nothing to export.'); return; }
  var sc = exportScaleMult();
  var lines = ['# Sketch3D v5', '# Export scale: ' + SCALE_LABELS[exportScaleIdx], ''];
  var vo = 1;
  strokes.forEach(function (s, si) {
    if (s.pts.length < 2) return;
    var wpts = s.pts.map(function (p) {
      return p.clone().applyMatrix4(s.mesh.matrix).multiplyScalar(sc);
    });
    var geo;
    try { geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wpts), Math.max(wpts.length * 3, 8), s.sz * .011 * sc, 6, false); } catch (e) { return; }
    var pa = geo.attributes.position, ix = geo.index;
    lines.push('g stroke_' + si);
    for (var i = 0; i < pa.count; i++) lines.push('v ' + pa.getX(i).toFixed(5) + ' ' + pa.getY(i).toFixed(5) + ' ' + pa.getZ(i).toFixed(5));
    if (ix) for (var i = 0; i < ix.count; i += 3) lines.push('f ' + (ix.getX(i) + vo) + ' ' + (ix.getX(i + 1) + vo) + ' ' + (ix.getX(i + 2) + vo));
    vo += pa.count; lines.push(''); geo.dispose();
  });
  if (returnData) return utf8ToBase64(lines.join('\n'));
  var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = (expName || 'sketch3d') + '.obj'; a.click();
  URL.revokeObjectURL(url); toast('OBJ exported (' + SCALE_LABELS[exportScaleIdx] + ')');
}

function buildUSDA() {
  var sc = exportScaleMult();
  var lines = ['#usda 1.0', '(', '    defaultPrim = "Sketch3D"', '    upAxis = "Z"', '    metersPerUnit = ' + sc.toFixed(2), ')', '', 'def Xform "Sketch3D" {'];
  strokes.forEach(function (s, si) {
    if (s.pts.length < 2) return;
    var wpts = s.pts.map(function (p) {
      return p.clone().applyMatrix4(s.mesh.matrix).multiplyScalar(sc);
    });
    var geo;
    try { geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wpts), Math.max(wpts.length * 3, 8), s.sz * .011 * sc, 6, false); } catch (e) { return; }
    var pa = geo.attributes.position, ix = geo.index, col = new THREE.Color(s.color);
    var pts = [];
    for (var i = 0; i < pa.count; i++) pts.push('(' + pa.getX(i).toFixed(4) + ', ' + pa.getY(i).toFixed(4) + ', ' + pa.getZ(i).toFixed(4) + ')');
    var counts = [], indices = [];
    if (ix) for (var i = 0; i < ix.count; i += 3) { counts.push(3); indices.push(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)); }
    lines.push('    def Mesh "stroke_' + si + '" {');
    lines.push('        point3f[] points = [' + pts.join(', ') + ']');
    if (counts.length) { lines.push('        int[] faceVertexCounts = [' + counts.join(', ') + ']'); lines.push('        int[] faceVertexIndices = [' + indices.join(', ') + ']'); }
    lines.push('        color3f[] primvars:displayColor = [(' + col.r.toFixed(3) + ', ' + col.g.toFixed(3) + ', ' + col.b.toFixed(3) + ')]');
    lines.push('        float primvars:displayOpacity = ' + s.op.toFixed(3));
    lines.push('        uniform token subdivisionScheme = "none"');
    lines.push('    }'); geo.dispose();
  });
  lines.push('}');
  return lines.join('\n');
}

function expUSD(expName, returnData) {
  if (!strokes.length) { alert('Nothing to export.'); return; }
  var usda = buildUSDA();
  if (returnData) return utf8ToBase64(usda);
  var b = new Blob([usda], { type: 'model/vnd.usda' });
  var u = URL.createObjectURL(b);
  var a = document.createElement('a'); a.href = u; a.download = (expName || 'sketch3d') + '.usda'; a.click();
  URL.revokeObjectURL(u); toast('USDA exported');
}

function expUSDZ(expName, returnData) {
  if (!strokes.length) { alert('Nothing to export.'); return; }
  var usda = buildUSDA(), enc = new TextEncoder(), data = enc.encode(usda), name = enc.encode('sketch3d.usda');
  function u16(n) { var b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
  function u32(n) { var b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }
  function crc32(buf) {
    var c = 0xFFFFFFFF;
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) { var v = i; for (var j = 0; j < 8; j++) v = v & 1 ? (0xEDB88320 ^ (v >>> 1)) : (v >>> 1); t[i] = v; }
    for (var i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function pad64(offset) { return (64 - offset % 64) % 64; }
  var crc = crc32(data);
  var lhdrFixed = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0]);
  var lhdrLen = lhdrFixed.length + name.length;
  var dataOffset = lhdrLen + pad64(lhdrLen);
  var extraLen = dataOffset - lhdrLen;
  var lhdr = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(extraLen), ...name, ...new Uint8Array(extraLen)]);
  var cdOffset = lhdr.length + data.length;
  var cdhdr = new Uint8Array([0x50, 0x4B, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(0), ...name]);
  var eocd = new Uint8Array([0x50, 0x4B, 0x05, 0x06, 0, 0, 0, 0, 1, 0, 1, 0, ...u32(cdhdr.length), ...u32(cdOffset), 0, 0]);
  var total = new Uint8Array(lhdr.length + data.length + cdhdr.length + eocd.length);
  var off = 0;
  [lhdr, data, cdhdr, eocd].forEach(function (b) { total.set(b, off); off += b.length; });
  if (returnData) return bytesToBase64(total);
  var blob = new Blob([total], { type: 'model/vnd.usdz+zip' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = (expName || 'sketch3d') + '.usdz'; a.click();
  URL.revokeObjectURL(url); toast('USDZ exported');
}
