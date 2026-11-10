// Procedural ship models, textures and materials. Everything is generated at runtime — no external assets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function merge(list) {
  return mergeGeometries(list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    return n;
  }));
}

// Mirror a geometry across the YZ plane, fixing triangle winding.
function mirrorX(src) {
  const g = (src.index ? src.toNonIndexed() : src.clone());
  g.scale(-1, 1, 1);
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name]; const n = a.itemSize; const arr = a.array;
    for (let i = 0; i < a.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (i + 1) * n + k, i2 = (i + 2) * n + k;
        const t = arr[i1]; arr[i1] = arr[i2]; arr[i2] = t;
      }
    }
  }
  return g;
}

export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function hullTextures(seed, aniso) {
  const rnd = mulberry32(seed);
  const S = 1024;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#9a9ea6'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1100; i++) {
    const w = (1 + Math.floor(rnd() * 9)) * 16, h = (1 + Math.floor(rnd() * 6)) * 16;
    const px = Math.floor(rnd() * 64) * 16, py = Math.floor(rnd() * 64) * 16;
    const v = 120 + Math.floor(rnd() * 70);
    x.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    x.fillRect(px, py, w, h);
    x.strokeStyle = 'rgba(0,0,0,0.42)'; x.lineWidth = 1.5;
    x.strokeRect(px + 0.5, py + 0.5, w, h);
    x.strokeStyle = 'rgba(255,255,255,0.10)';
    x.beginPath(); x.moveTo(px + 2, py + 2); x.lineTo(px + w - 2, py + 2); x.stroke();
  }
  for (let i = 0; i < 90; i++) { // darker vents / hatches
    const px = Math.floor(rnd() * 64) * 16, py = Math.floor(rnd() * 64) * 16;
    x.fillStyle = 'rgba(20,22,28,0.75)';
    x.fillRect(px + 3, py + 3, 16 * (1 + Math.floor(rnd() * 3)) - 6, 10);
  }
  for (let i = 0; i < 5000; i++) { // grime
    x.fillStyle = `rgba(0,0,0,${rnd() * 0.07})`;
    x.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 5, 2 + rnd() * 26);
  }
  const e = document.createElement('canvas'); e.width = e.height = S;
  const ex = e.getContext('2d');
  ex.fillStyle = '#000'; ex.fillRect(0, 0, S, S);
  for (let row = 0; row < 64; row++) {
    if (rnd() < 0.55) continue;
    const y = row * 16 + 6;
    let px = rnd() * 200;
    while (px < S) {
      const run = 3 + Math.floor(rnd() * 12);
      const warm = rnd() < 0.75;
      for (let k = 0; k < run; k++) {
        if (rnd() < 0.3) continue;
        ex.fillStyle = warm ? '#ffd9a0' : '#a6dcff';
        ex.fillRect(px + k * 7, y, 3.5, 2.5);
      }
      px += run * 7 + 60 + rnd() * 320;
    }
  }
  const mk = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    return t;
  };
  return { map: mk(c), emissiveMap: mk(e) };
}

export function makeMaterials(aniso = 8) {
  const hull = hullTextures(7, aniso);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
  return {
    glowTex: glowTexture(),
    // fighters
    allyBody: std({ color: 0xdfe4ec, metalness: 0.75, roughness: 0.32, map: hull.map }),
    allyDark: std({ color: 0x2a3140, metalness: 0.85, roughness: 0.4 }),
    playerAccent: std({ color: 0xff7a1a, metalness: 0.5, roughness: 0.35, emissive: 0x4a1800 }),
    wingAccent: std({ color: 0x2a86ff, metalness: 0.5, roughness: 0.35, emissive: 0x06224a }),
    glass: std({ color: 0x08121c, metalness: 1, roughness: 0.06, envMapIntensity: 2.5 }),
    allyGlow: glow(0.3, 1.5, 3.4),
    foeBody: std({ color: 0x3a3d47, metalness: 0.9, roughness: 0.36, map: hull.map, flatShading: true }),
    foeDark: std({ color: 0x15161b, metalness: 0.9, roughness: 0.45 }),
    foeGlow: glow(5, 0.6, 0.2),
    aceGlow: glow(4, 0.35, 5),
    // capital ships
    capFoe: std({ color: 0x6c6470, metalness: 0.7, roughness: 0.5, map: hull.map, emissiveMap: hull.emissiveMap, emissive: 0xffffff, emissiveIntensity: 2.2 }),
    capFoeDark: std({ color: 0x24222a, metalness: 0.8, roughness: 0.55, map: hull.map }),
    capAlly: std({ color: 0xc4ccd8, metalness: 0.65, roughness: 0.45, map: hull.map, emissiveMap: hull.emissiveMap, emissive: 0xffffff, emissiveIntensity: 2.2 }),
    capAllyDark: std({ color: 0x3a4658, metalness: 0.8, roughness: 0.5, map: hull.map }),
    capFoeGlow: glow(16, 2.2, 0.6),
    capAllyGlow: glow(1.5, 7, 16),
    reactor: glow(18, 6, 0.8),
    turret: std({ color: 0x2c2c34, metalness: 0.85, roughness: 0.4 }),
  };
}

function glowSprite(tex, color, size) {
  const m = new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(m); s.scale.setScalar(size);
  return s;
}

function wingGeo(pts, depth) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  g.rotateX(-Math.PI / 2); // shape Y -> forward (-Z), extrusion -> +Y
  return g;
}
const cylZ = (rFront, rBack, len, seg = 12) => { const g = new THREE.CylinderGeometry(rFront, rBack, len, seg); g.rotateX(-Math.PI / 2); return g; };

// Player / allied interceptor: swept delta with twin engines. Nose is -Z.
export function buildInterceptor(M, accentMat) {
  const body = [], dark = [], accent = [], glow = [];
  let g = cylZ(0.12, 1.05, 8, 16); g.scale(1, 0.72, 1); g.translate(0, 0, -3); body.push(g);
  g = cylZ(1.05, 0.8, 4.4, 16); g.scale(1, 0.72, 1); g.translate(0, 0, 3.2); body.push(g);
  const wing = wingGeo([[0.7, 1.2], [6.6, -3.1], [6.6, -4.5], [0.7, -4.8]], 0.2);
  const wr = wing.clone(); wr.rotateZ(-0.07); wr.translate(0, -0.1, 0); body.push(wr); body.push(mirrorX(wr));
  const tipY = -0.1 - 6.6 * Math.sin(0.07);
  for (const sx of [-1, 1]) {
    g = cylZ(0.1, 0.17, 5, 8); g.translate(sx * 6.6, tipY, 2.6); dark.push(g);
    g = cylZ(0.82, 0.72, 4.4, 14); g.translate(sx * 1.6, 0.12, 3.7); dark.push(g);
    g = new THREE.CircleGeometry(0.6, 20); g.translate(sx * 1.6, 0.12, 5.92); glow.push(g);
    g = new THREE.BoxGeometry(0.12, 2.3, 2.4); g.translate(0, 1.15, 0); g.rotateZ(-sx * 0.42); g.translate(sx * 1.6, 0.6, 4.3); body.push(g);
    g = new THREE.BoxGeometry(0.5, 0.34, 5.2); g.translate(sx * 0.98, 0.02, 1.3); accent.push(g);
    g = new THREE.BoxGeometry(1.5, 0.26, 0.9); g.rotateZ(-sx * 0.07); g.translate(sx * 4.3, -0.4, 3.4); accent.push(g);
  }
  g = new THREE.BoxGeometry(0.5, 0.1, 2.6); g.translate(0, 0.42, -4.6); accent.push(g);
  const canopy = new THREE.SphereGeometry(1, 20, 14); canopy.scale(0.6, 0.52, 1.9); canopy.translate(0, 0.46, -1.3);

  const group = new THREE.Group();
  group.add(new THREE.Mesh(merge(body), M.allyBody), new THREE.Mesh(merge(dark), M.allyDark),
    new THREE.Mesh(merge(accent), accentMat), new THREE.Mesh(canopy, M.glass), new THREE.Mesh(merge(glow), M.allyGlow));
  const flares = [];
  for (const sx of [-1, 1]) {
    const s = glowSprite(M.glowTex, new THREE.Color(0.06, 0.3, 0.85), 3); s.position.set(sx * 1.6, 0.12, 6.2);
    group.add(s); flares.push(s);
  }
  return {
    group, flares, radius: 5.5,
    muzzles: [new THREE.Vector3(-6.6, tipY, -0.2), new THREE.Vector3(6.6, tipY, -0.2)],
    engines: [new THREE.Vector3(-1.6, 0.12, 6.1), new THREE.Vector3(1.6, 0.12, 6.1)],
  };
}

// Hostile "wasp" raider: faceted hull with forward-swept blades.
export function buildWasp(M, ace = false) {
  const body = [], dark = [], glow = [];
  let g = new THREE.OctahedronGeometry(1, 0); g.scale(1.15, 0.8, 5.2); body.push(g);
  const blade = wingGeo([[0.5, -2.6], [0.9, 1.3], [5.6, 4.9], [5.95, 4.9], [3.2, -0.6], [1.4, -3.3]], 0.16);
  const br = blade.clone(); br.rotateZ(0.22); body.push(br); body.push(mirrorX(br));
  const tipY = 5.75 * Math.sin(0.22);
  g = new THREE.BoxGeometry(0.12, 2.1, 2.8); g.translate(0, -1.1, 2.1); body.push(g);
  g = cylZ(0.75, 0.98, 2.4, 10); g.translate(0, 0, 4.5); dark.push(g);
  g = new THREE.CircleGeometry(0.8, 18); g.translate(0, 0, 5.72); glow.push(g);
  g = new THREE.BoxGeometry(0.85, 0.12, 1.5); g.translate(0, 0.42, -2.3); glow.push(g);
  for (const sx of [-1, 1]) {
    g = cylZ(0.08, 0.12, 2.6, 6); g.translate(sx * 5.75, tipY, -5.2); dark.push(g);
  }
  const gm = ace ? M.aceGlow : M.foeGlow;
  const group = new THREE.Group();
  group.add(new THREE.Mesh(merge(body), M.foeBody), new THREE.Mesh(merge(dark), M.foeDark), new THREE.Mesh(merge(glow), gm));
  const s = glowSprite(M.glowTex, ace ? new THREE.Color(1.2, 0.15, 1.6) : new THREE.Color(1.6, 0.25, 0.08), 4.5); s.position.set(0, 0, 6);
  group.add(s);
  if (ace) group.scale.setScalar(1.2);
  return {
    group, flares: [s], radius: ace ? 7 : 6,
    muzzles: [new THREE.Vector3(-5.75, tipY, -6.4), new THREE.Vector3(5.75, tipY, -6.4)],
    engines: [new THREE.Vector3(0, 0, 5.9)],
  };
}

export function buildTurret(M) {
  const base = new THREE.CylinderGeometry(9, 12, 6, 14); base.translate(0, 3, 0);
  const head = new THREE.Group(); head.position.y = 9;
  const hg = [new THREE.BoxGeometry(11, 7, 13)];
  for (const sx of [-1, 1]) { const b = new THREE.CylinderGeometry(1.1, 1.3, 18, 8); b.rotateX(Math.PI / 2); b.translate(sx * 3, 0.5, 14); hg.push(b); }
  head.add(new THREE.Mesh(merge(hg), M.turret));
  const group = new THREE.Group();
  group.add(new THREE.Mesh(base, M.turret), head);
  return { group, head };
}

// Capital ships, built from greebled boxes. Bow is -Z. Returns collision boxes in local space.
export function buildCapital(M, enemy, seed = 3) {
  const rnd = mulberry32(seed);
  const main = [], dark = [], glow = [];
  const boxes = [];
  const TS = 1 / 260;
  const box = (w, h, d, x, y, z, list = main, solid = true) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const ox = rnd(), oy = rnd();
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] * TS + ox, uv.getY(i) * dims[f][1] * TS + oy);
    }
    g.translate(x, y, z); list.push(g);
    if (solid) boxes.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)));
  };
  const greeble = (n, x0, x1, y, z0, z1, up = 1) => {
    for (let i = 0; i < n; i++) {
      const w = 6 + rnd() * 30, h = 3 + rnd() * 13, d = 10 + rnd() * 70;
      box(w, h, d, x0 + rnd() * (x1 - x0), y + up * h / 2, z0 + rnd() * (z1 - z0), rnd() < 0.3 ? dark : main, false);
    }
  };
  const turretSlots = [], reactorSlots = [], engines = [];

  if (enemy) {
    box(180, 90, 1200, 0, 0, 0);
    box(140, 70, 170, 0, 0, -680); box(96, 50, 130, 0, 0, -825); box(50, 30, 90, 0, 0, -930);
    for (const sx of [-1, 1]) {
      box(84, 62, 720, sx * 172, 0, 60);
      box(60, 40, 90, sx * 172, 0, -340);
      for (const z of [-180, 60, 300]) box(100, 22, 56, sx * 110, 0, z, dark);
      greeble(40, sx * 172 - 36, sx * 172 + 36, 31, -280, 400);
      greeble(22, sx * 172 - 36, sx * 172 + 36, -31, -280, 400, -1);
    }
    box(74, 110, 170, 0, 100, 260); box(120, 26, 76, 0, 168, 250); box(30, 60, 30, 0, 200, 290, dark);
    box(54, 70, 620, 0, -80, 60, dark);
    box(230, 124, 150, 0, 0, 670);
    greeble(110, -80, 80, 45, -580, 560);
    greeble(60, -80, 80, -45, -580, 560, -1);
    for (const [ex, ey] of [[-62, 26], [62, 26], [-62, -30], [62, -30]]) {
      const c = new THREE.CylinderGeometry(34, 40, 70, 18); c.rotateX(-Math.PI / 2); c.translate(ex, ey, 770); dark.push(c);
      const d = new THREE.CircleGeometry(31, 24); d.translate(ex, ey, 806); glow.push(d);
      engines.push(new THREE.Vector3(ex, ey, 812));
    }
    turretSlots.push([-48, 45, -420], [48, 45, -160], [-48, 45, 480], [172, 31, 180], [-172, 31, -80], [0, 181, 250]);
    reactorSlots.push([232, 0, 120], [-232, 0, 120], [0, -133, 120]);
    for (const r of reactorSlots) { // docking collars around each reactor
      const t = new THREE.TorusGeometry(34, 5, 8, 24);
      if (r[0] !== 0) t.rotateY(Math.PI / 2); else t.rotateX(Math.PI / 2);
      t.translate(r[0] * 0.95, r[1] * 0.94, r[2]); dark.push(t);
    }
  } else {
    box(150, 70, 900, 0, 0, 0);
    box(110, 54, 150, 0, 0, -520); box(64, 36, 110, 0, 0, -645);
    box(340, 14, 760, 0, 42, -30); // flight deck
    box(120, 6, 700, 0, 51, -30, dark, false);
    for (const sx of [-1, 1]) { box(40, 40, 520, sx * 150, 12, 20, dark); greeble(26, sx * 170 - 20, sx * 170 + 14, 49, -360, 320); }
    box(50, 110, 120, 128, 104, 190); box(70, 20, 60, 128, 168, 180); box(12, 70, 12, 128, 210, 200, dark);
    box(200, 100, 130, 0, -4, 510);
    greeble(70, -70, 70, -35, -420, 420, -1);
    for (const ex of [-60, 0, 60]) {
      const c = new THREE.CylinderGeometry(26, 32, 60, 18); c.rotateX(-Math.PI / 2); c.translate(ex, -4, 595); dark.push(c);
      const d = new THREE.CircleGeometry(23.5, 24); d.translate(ex, -4, 626); glow.push(d);
      engines.push(new THREE.Vector3(ex, -4, 632));
    }
  }
  const group = new THREE.Group();
  group.add(new THREE.Mesh(merge(main), enemy ? M.capFoe : M.capAlly), new THREE.Mesh(merge(dark), enemy ? M.capFoeDark : M.capAllyDark),
    new THREE.Mesh(merge(glow), enemy ? M.capFoeGlow : M.capAllyGlow));
  for (const e of engines) {
    const s = glowSprite(M.glowTex, enemy ? new THREE.Color(9, 1.4, 0.4) : new THREE.Color(0.6, 3, 8), enemy ? 260 : 190);
    s.position.copy(e); group.add(s);
  }
  return {
    group, boxes,
    turretSlots: turretSlots.map((a) => new THREE.Vector3(...a)),
    reactorSlots: reactorSlots.map((a) => new THREE.Vector3(...a)),
    radius: enemy ? 1000 : 720,
  };
}
