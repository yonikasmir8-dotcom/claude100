// SDF SCULPTING — Blender-metaball-style modeling in the engine.
// A model part is a list of signed-distance primitives (spheres, ellipsoids, tapered capsules,
// rounded boxes, tori, cylinders) blended with smooth-union, carved with smooth-subtraction and
// coloured with "paint" volumes. Surface Nets turns the field into a smooth high-poly mesh with
// analytic (gradient) normals and per-vertex colours.
(() => {
  'use strict';
  const NX = window.NX = window.NX || {};
  const SDF = NX.SDF = {};

  const hex = (h) => {
    let v = h.slice(1);
    if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
    const n = parseInt(v, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const colorCache = new Map();
  SDF.color = (h) => {
    let c = colorCache.get(h);
    if (!c) { c = hex(h).map(srgbToLinear); colorCache.set(h, c); }
    return c;
  };

  // ---------- Primitive preparation ----------
  function rotMatrix(rx = 0, ry = 0, rz = 0) {
    // inverse (transpose) of R = Rz * Ry * Rx, used to bring world points into primitive space
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    const m = [
      cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
      sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
      -sy, cy * sx, cy * cx,
    ];
    return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
  }

  function prep(q) {
    const p = Object.assign({}, q);
    if (p.t === 'cap') { const r = Array.isArray(p.r) ? p.r : [p.r, p.r]; p.r0 = r[0]; p.r1 = r[1]; }
    if (p.rot) p.m = rotMatrix(p.rot[0], p.rot[1], p.rot[2]);
    p.k = p.k == null ? 0.04 : p.k;
    p.col = p.col ? SDF.color(p.col) : null;
    return p;
  }
  function mirrorZ(q) {
    const p = JSON.parse(JSON.stringify(q));
    if (p.c) p.c[2] = -p.c[2];
    if (p.a) p.a[2] = -p.a[2];
    if (p.b) p.b[2] = -p.b[2];
    if (p.rot) p.rot = [-p.rot[0], -p.rot[1], p.rot[2]];
    delete p.m;
    return p;
  }

  // ---------- Distance functions ----------
  function dist(q, x, y, z) {
    if (q.m) {
      const px = x - q.c[0], py = y - q.c[1], pz = z - q.c[2], m = q.m;
      x = m[0] * px + m[1] * py + m[2] * pz; y = m[3] * px + m[4] * py + m[5] * pz; z = m[6] * px + m[7] * py + m[8] * pz;
    } else if (q.c) { x -= q.c[0]; y -= q.c[1]; z -= q.c[2]; }
    switch (q.t) {
      case 'sph': return Math.sqrt(x * x + y * y + z * z) - q.r;
      case 'ell': {
        const rx = q.r[0], ry = q.r[1], rz = q.r[2];
        const k0 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2);
        const k1 = Math.sqrt((x / (rx * rx)) ** 2 + (y / (ry * ry)) ** 2 + (z / (rz * rz)) ** 2);
        return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
      }
      case 'box': {
        const rr = q.rr || 0;
        const qx = Math.abs(x) - q.h[0] + rr, qy = Math.abs(y) - q.h[1] + rr, qz = Math.abs(z) - q.h[2] + rr;
        const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0, oz = qz > 0 ? qz : 0;
        return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - rr;
      }
      case 'tor': {
        let px = x, py = y, pz = z;
        if (q.ax === 'x') { px = y; py = x; } else if (q.ax === 'z') { pz = y; py = z; }
        const a = Math.sqrt(px * px + pz * pz) - q.R;
        return Math.sqrt(a * a + py * py) - q.r;
      }
      case 'cyl': { // vertical capped cylinder (use rot to orient), half height h, radius r, rounding rr
        const rr = q.rr || 0;
        const dx = Math.sqrt(x * x + z * z) - q.r + rr, dy = Math.abs(y) - q.h + rr;
        const ox = dx > 0 ? dx : 0, oy = dy > 0 ? dy : 0;
        return Math.min(Math.max(dx, dy), 0) + Math.sqrt(ox * ox + oy * oy) - rr;
      }
      case 'cap': {
        const ax = q.a[0], ay = q.a[1], az = q.a[2];
        const bx = q.b[0] - ax, by = q.b[1] - ay, bz = q.b[2] - az;
        const px = x - ax, py = y - ay, pz = z - az;
        const bb = bx * bx + by * by + bz * bz;
        let t = bb > 0 ? (px * bx + py * by + pz * bz) / bb : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - bx * t, dy = py - by * t, dz = pz - bz * t;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) - (q.r0 + (q.r1 - q.r0) * t);
      }
    }
    return 1e9;
  }

  // Bounding sphere (center bc, radius br) for cheap culling.
  function bound(q) {
    switch (q.t) {
      case 'sph': q.bc = q.c; q.br = q.r; break;
      case 'ell': q.bc = q.c; q.br = Math.max(...q.r); break;
      case 'box': q.bc = q.c; q.br = Math.hypot(...q.h); break;
      case 'tor': q.bc = q.c; q.br = q.R + q.r; break;
      case 'cyl': q.bc = q.c; q.br = Math.hypot(q.r, q.h); break;
      case 'cap': q.bc = [(q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2, (q.a[2] + q.b[2]) / 2]; q.br = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1], q.b[2] - q.a[2]) / 2 + Math.max(q.r0, q.r1); break;
      default: q.bc = [0, 0, 0]; q.br = 1e9;
    }
  }

  const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);

  // ---------- Part: field + colour ----------
  // prims: [{ t, ..., col, k, op: 'add'|'sub'|'paint', m: mirror }]
  SDF.compile = (prims) => {
    const list = [];
    for (const q of prims) { list.push(q); if (q.mirror) list.push(mirrorZ(q)); }
    const all = list.map(prep);
    const adds = all.filter((q) => !q.op || q.op === 'add');
    const subs = all.filter((q) => q.op === 'sub');
    const paints = all.filter((q) => q.op === 'paint');
    for (const q of all) bound(q);
    const field = (x, y, z) => {
      let d = 1e9;
      for (let i = 0; i < adds.length; i++) {
        const q = adds[i], bx = x - q.bc[0], by = y - q.bc[1], bz = z - q.bc[2];
        if (Math.sqrt(bx * bx + by * by + bz * bz) - q.br > d + q.k) continue;   // can't affect the blend
        d = smin(d, dist(q, x, y, z), q.k);
      }
      for (let i = 0; i < subs.length; i++) {
        const q = subs[i], bx = x - q.bc[0], by = y - q.bc[1], bz = z - q.bc[2];
        if (Math.sqrt(bx * bx + by * by + bz * bz) - q.br > q.k - d) continue;    // too far away to carve here
        d = smax(d, -dist(q, x, y, z), q.k);
      }
      return d;
    };
    const base = SDF.color('#888888');
    const ds = new Float32Array(adds.length);
    const colorAt = (x, y, z) => {
      let best = Infinity, r = 0, g = 0, b = 0, wsum = 0;
      for (let i = 0; i < adds.length; i++) { ds[i] = dist(adds[i], x, y, z); if (ds[i] < best) best = ds[i]; }
      for (let i = 0; i < adds.length; i++) {
        const w = Math.exp(-(ds[i] - best) / 0.012) * (adds[i].weight || 1);
        const c = adds[i].col || base;
        r += c[0] * w; g += c[1] * w; b += c[2] * w; wsum += w;
      }
      r /= wsum; g /= wsum; b /= wsum;
      for (const s of subs) if (s.col) { const d = dist(s, x, y, z); if (d < 0.02) { const a = Math.min(1, (0.02 - d) / 0.02); r += (s.col[0] - r) * a; g += (s.col[1] - g) * a; b += (s.col[2] - b) * a; } }
      for (const p of paints) {
        const d = dist(p, x, y, z), soft = p.soft || 0.006;
        if (d < soft) { const a = Math.min(1, (soft - d) / (2 * soft)); r += (p.col[0] - r) * a; g += (p.col[1] - g) * a; b += (p.col[2] - b) * a; }
      }
      return [r, g, b];
    };
    // bounds
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    const grow = (c, e) => { for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], c[i] - e); mx[i] = Math.max(mx[i], c[i] + e); } };
    for (const q of adds) {
      switch (q.t) {
        case 'sph': grow(q.c, q.r); break;
        case 'ell': grow(q.c, Math.max(...q.r)); break;
        case 'box': grow(q.c, q.m ? Math.hypot(...q.h) : Math.max(...q.h)); if (!q.m) { for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], q.c[i] - q.h[i]); mx[i] = Math.max(mx[i], q.c[i] + q.h[i]); } } break;
        case 'tor': grow(q.c, q.R + q.r); break;
        case 'cyl': grow(q.c, Math.hypot(q.r, q.h)); break;
        case 'cap': grow(q.a, Math.max(q.r0, q.r1)); grow(q.b, Math.max(q.r0, q.r1)); break;
      }
    }
    return { field, colorAt, min: mn, max: mx };
  };

  // ---------- Surface Nets mesher ----------
  // Returns { positions, normals, colors, indices } (typed arrays), or null if empty.
  const CO = new Int8Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1]);
  const ED = new Int8Array([0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7]);
  SDF.mesh = (part, res) => {
    const { field, colorAt } = part;
    const pad = res * 2.5 + 0.03;
    const x0 = part.min[0] - pad, y0 = part.min[1] - pad, z0 = part.min[2] - pad;
    const nx = Math.ceil((part.max[0] + pad - x0) / res) + 1, ny = Math.ceil((part.max[1] + pad - y0) / res) + 1, nz = Math.ceil((part.max[2] + pad - z0) / res) + 1;
    const sxy = nx * ny;
    const vals = new Float32Array(nx * ny * nz);
    const done = new Uint8Array(nx * ny * nz);
    // Coarse blocks of FxFxF cells: if every corner is provably far from the surface, the whole
    // block has one sign and needs no fine evaluation.
    const F = 4, safe = F * res * 1.75;
    for (let bk = 0; bk < nz - 1; bk += F) for (let bj = 0; bj < ny - 1; bj += F) for (let bi = 0; bi < nx - 1; bi += F) {
      const ei = Math.min(bi + F, nx - 1), ej = Math.min(bj + F, ny - 1), ek = Math.min(bk + F, nz - 1);
      let allPos = true, allNeg = true;
      for (let c = 0; c < 8; c++) {
        const i = c & 1 ? ei : bi, j = c & 2 ? ej : bj, k = c & 4 ? ek : bk, n = i + nx * j + sxy * k;
        if (!done[n]) { vals[n] = field(x0 + i * res, y0 + j * res, z0 + k * res); done[n] = 1; }
        const v = vals[n];
        if (!(v > safe)) allPos = false;
        if (!(v < -safe)) allNeg = false;
      }
      if (allPos || allNeg) {
        const fill = allPos ? safe : -safe;
        for (let k = bk; k <= ek; k++) for (let j = bj; j <= ej; j++) for (let i = bi, n = bi + nx * j + sxy * k; i <= ei; i++, n++) if (!done[n]) { vals[n] = fill; done[n] = 2; }
      } else {
        for (let k = bk; k <= ek; k++) for (let j = bj; j <= ej; j++) for (let i = bi, n = bi + nx * j + sxy * k; i <= ei; i++, n++) {
          if (done[n] === 1) continue;
          vals[n] = field(x0 + i * res, y0 + j * res, z0 + k * res); done[n] = 1;
        }
      }
    }
    // Vertices: one per cell that straddles the surface, at the mean of its edge crossings.
    const cx = nx - 1, cxy = cx * (ny - 1);
    const cells = new Int32Array(cxy * (nz - 1)).fill(-1);
    const pos = [];
    const g = new Float32Array(8);
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) {
      let n0 = nx * j + sxy * k;
      for (let i = 0; i < nx - 1; i++, n0++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) { const v = vals[n0 + CO[c * 3] + nx * CO[c * 3 + 1] + sxy * CO[c * 3 + 2]]; g[c] = v; if (v < 0) mask |= 1 << c; }
        if (mask === 0 || mask === 255) continue;
        let px = 0, py = 0, pz = 0, cnt = 0;
        for (let e = 0; e < 24; e += 2) {
          const a = ED[e], b = ED[e + 1];
          if ((g[a] < 0) === (g[b] < 0)) continue;
          const t = g[a] / (g[a] - g[b]);
          px += CO[a * 3] + (CO[b * 3] - CO[a * 3]) * t;
          py += CO[a * 3 + 1] + (CO[b * 3 + 1] - CO[a * 3 + 1]) * t;
          pz += CO[a * 3 + 2] + (CO[b * 3 + 2] - CO[a * 3 + 2]) * t;
          cnt++;
        }
        cells[i + cx * j + cxy * k] = pos.length / 3;
        pos.push(x0 + (i + px / cnt) * res, y0 + (j + py / cnt) * res, z0 + (k + pz / cnt) * res);
      }
    }
    if (!pos.length) return null;
    // Faces: a quad for every grid edge with a sign change, joining the 4 cells around it.
    const idx = [];
    const quad = (a, b, c, d, flip) => { if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); };
    const cell = (i, j, k) => cells[i + cx * j + cxy * k];
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const n = i + nx * j + sxy * k, inside = vals[n] < 0;
      if ((vals[n + 1] < 0) !== inside) quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), inside);
      if ((vals[n + nx] < 0) !== inside) quad(cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1), inside);
      if ((vals[n + sxy] < 0) !== inside) quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), inside);
    }
    const nv = pos.length / 3;
    const positions = new Float32Array(pos), normals = new Float32Array(nv * 3), colors = new Float32Array(nv * 3);
    const h = res * 0.5;
    for (let v = 0; v < nv; v++) {
      const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
      const gx = field(x + h, y, z) - field(x - h, y, z), gy = field(x, y + h, z) - field(x, y - h, z), gz = field(x, y, z + h) - field(x, y, z - h);
      const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      normals[v * 3] = gx / l; normals[v * 3 + 1] = gy / l; normals[v * 3 + 2] = gz / l;
      const c = colorAt(x, y, z);
      colors[v * 3] = c[0]; colors[v * 3 + 1] = c[1]; colors[v * 3 + 2] = c[2];
    }
    const indices = nv > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
    return { positions, normals, colors, indices };
  };

  // Convenience builders used by js/models.js. Every builder takes an options bag:
  // { col, k (blend), op: 'sub'|'paint', mirror: true, rot: [x,y,z], weight }
  SDF.sph = (c, r, col, o) => Object.assign({ t: 'sph', c, r, col }, o);
  SDF.ell = (c, r, col, o) => Object.assign({ t: 'ell', c, r, col }, o);
  SDF.cap = (a, b, r, col, o) => Object.assign({ t: 'cap', a, b, r, col }, o);
  SDF.box = (c, h, rr, col, o) => Object.assign({ t: 'box', c, h, rr, col }, o);
  SDF.tor = (c, R, r, col, o) => Object.assign({ t: 'tor', c, R, r, col }, o);
  SDF.cyl = (c, r, h, col, o) => Object.assign({ t: 'cyl', c, r, h, col }, o);
})();
