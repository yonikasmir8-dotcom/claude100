// RENDER3D — Three.js renderer for THE NEXUS. The simulation (js/game.js) stays 2D on the ground
// plane; this maps it into 3D: 1 tile = 1 unit, sim (x, y) px -> world (x/32, height, y/32).
(() => {
  'use strict';
  const NX = window.NX, C = NX.C, T = NX.T, W = NX.World;
  const R3D = NX.R3D = { ok: false };
  const TS = C.world.tile, S = C.world.sectorTiles;
  let THREE, renderer, scene, camera, hemi, sun, fill, raycaster, groundPlane;
  const mobile = matchMedia('(pointer: coarse)').matches;
  const Q = { shadows: !mobile, res: mobile ? 1.5 : 1, budgetMs: mobile ? 6 : 10, pixelRatio: mobile ? 1.25 : 1.5 };
  R3D.quality = Q;

  // Per-fandom lighting moods.
  const LOOK = {
    hub: { sky: '#120e2a', hemi: ['#8a7aff', '#2a1a40'], sun: ['#e0d8ff', 0.82], exposure: 1.1 },
    galaxy: { sky: '#d8b47a', hemi: ['#ffe0b0', '#6a4a2a'], sun: ['#fff0d0', 1.3], exposure: 0.85 },
    pocket: { sky: '#9fd8ff', hemi: ['#d8f0ff', '#4a7a3a'], sun: ['#fffbe8', 1.36], exposure: 1.0 },
    mushroom: { sky: '#7ec8ff', hemi: ['#d8f0ff', '#4a8a3a'], sun: ['#fffbe8', 1.36], exposure: 1.05 },
    hyrule: { sky: '#8fd0ff', hemi: ['#d0ecff', '#3a6a2a'], sun: ['#fff4d8', 1.29], exposure: 1.0 },
    pacmaze: { sky: '#03030c', hemi: ['#3a3aff', '#05051a'], sun: ['#8a8aff', 0.34], exposure: 1.2 },
    blocklands: { sky: '#88b8ff', hemi: ['#d0e4ff', '#5a7a3a'], sun: ['#fffbe8', 1.29], exposure: 1.0 },
    ghostcity: { sky: '#1a1430', hemi: ['#7a5aff', '#1a1020'], sun: ['#a8a0ff', 0.41], exposure: 1.25 },
    grid: { sky: '#000812', hemi: ['#18e0ff', '#000a14'], sun: ['#6af0ff', 0.34], exposure: 1.25 },
    marvel: { sky: '#7a8fb8', hemi: ['#c8d4f0', '#3a3a4a'], sun: ['#fff0e0', 1.09], exposure: 1.0 },
    dc: { sky: '#0c0f18', hemi: ['#4a5a8a', '#0a0a10'], sun: ['#8a9aff', 0.31], exposure: 1.3 },
    hogwarts: { sky: '#2a3048', hemi: ['#9aa8d8', '#2a2a3a'], sun: ['#c8d8ff', 0.61], exposure: 1.15 },
    middleearth: { sky: '#a8b0b8', hemi: ['#e0e4e8', '#4a4a3a'], sun: ['#fff0d8', 1.02], exposure: 1.0 },
    jurassic: { sky: '#8fb8a0', hemi: ['#e0f0d8', '#2a4a2a'], sun: ['#fff4d0', 1.16], exposure: 1.0 },
    halo: { sky: '#8fc8e0', hemi: ['#e0f4ff', '#3a5a5a'], sun: ['#ffffff', 1.22], exposure: 1.0 },
    startrek: { sky: '#101018', hemi: ['#c8a8ff', '#1a1a2a'], sun: ['#ffe0c0', 0.61], exposure: 1.2 },
    doctorwho: { sky: '#5a6a80', hemi: ['#b0c0d8', '#2a2a3a'], sun: ['#e8f0ff', 0.75], exposure: 1.05 },
    sonic: { sky: '#5ab0ff', hemi: ['#e0f4ff', '#4a8a2a'], sun: ['#fffbe0', 1.5], exposure: 1.0 },
    stranger: { sky: '#180a10', hemi: ['#ff5a7a', '#0a0508'], sun: ['#ff8a9a', 0.34], exposure: 1.3 },
    namek: { sky: '#8fe0b0', hemi: ['#e0fff0', '#3a6a5a'], sun: ['#fffff0', 1.22], exposure: 1.0 },
    portal: { sky: '#c8d0d8', hemi: ['#ffffff', '#707880'], sun: ['#ffffff', 0.9], exposure: 0.85 },
    // optional: fog (defaults to sky), fill [colour, intensity] (default cool blue), sunH (key light height, default 26)
    castle: { sky: '#1a0408', fog: '#4a1208', hemi: ['#ff8a6a', '#1a0820'], sun: ['#ffa060', 0.95], exposure: 1.15, fill: ['#9a5aff', 0.6], sunH: 11 },
  };
  const DARK = new Set(['pacmaze', 'ghostcity', 'grid', 'dc', 'startrek', 'stranger', 'hub', 'castle']);
  const FILL = ['#8ab0ff', 0.35];

  // ---------- Init ----------
  R3D.init = (canvas) => {
    THREE = window.THREE;
    if (!THREE) return false;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch { return false; }
    renderer.outputEncoding = THREE.sRGBEncoding;
    const tm = new URLSearchParams(location.search).get('tm');
    renderer.toneMapping = tm === 'none' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    R3D.tm = tm || 'aces';
    renderer.shadowMap.enabled = Q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#000');
    scene.fog = new THREE.Fog('#000', 28, 70);
    camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.3, 220);
    hemi = new THREE.HemisphereLight('#fff', '#444', 0.9);
    sun = new THREE.DirectionalLight('#fff', 1.5);
    sun.castShadow = Q.shadows;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    fill = new THREE.DirectionalLight('#8ab0ff', 0.35);
    scene.add(hemi, sun, sun.target, fill);
    buildEnvironment();
    raycaster = new THREE.Raycaster();
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
    initMaterials();
    initPools();
    R3D.ok = true;
    return true;
  };

  function buildEnvironment() {
    // A soft gradient "studio" so metal and gloss materials have something to reflect.
    const pm = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    const g = new THREE.SphereGeometry(10, 32, 16);
    const cols = [];
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 10;
      const c = new THREE.Color().setHSL(0.62, 0.35, 0.18 + Math.max(0, y) * 0.7);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    env.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    panel.position.set(0, 7, 3); panel.lookAt(0, 0, 0); env.add(panel);
    R3D.envMap = pm.fromScene(env, 0.03).texture;   // used for character/prop reflections only
    pm.dispose();
  }

  // ---------- Materials ----------
  const MAT = {};
  const glowMats = new Map(), haloMats = new Map();
  let haloTex;
  function initMaterials() {
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMap: R3D.envMap, envMapIntensity: 0.6 }, o));
    MAT.skin = std({ roughness: 0.62, metalness: 0.0 });
    MAT.gloss = std({ roughness: 0.22, metalness: 0.05 });
    MAT.metal = std({ roughness: 0.28, metalness: 0.85 });
    MAT.gold = std({ roughness: 0.22, metalness: 1.0 });
    MAT.stone = std({ roughness: 0.95, metalness: 0.0 });
    MAT.ghost = std({ roughness: 0.3, transparent: true, opacity: 0.72 });
    MAT.glowSoft = new THREE.MeshBasicMaterial({ vertexColors: true });
    MAT.flash = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.9 });
    MAT.scared = new THREE.MeshStandardMaterial({ color: '#2121de', emissive: '#10106a', roughness: 0.3 });
    MAT.scaredBlink = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#888', roughness: 0.3 });
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    haloTex = new THREE.CanvasTexture(c);
  }
  function glowMat(color, opacity = 1) {
    const k = color + opacity;
    let m = glowMats.get(k);
    if (!m) { m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false }); glowMats.set(k, m); }
    return m;
  }
  function haloMat(color) {
    let m = haloMats.get(color);
    if (!m) { m = new THREE.SpriteMaterial({ map: haloTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }); haloMats.set(color, m); }
    return m;
  }
  function halo(color, size) { const s = new THREE.Sprite(haloMat(color)); s.scale.set(size, size, 1); return s; }

  // ---------- Model building (lazy, time-sliced) ----------
  const built = new Map();     // key -> { spec, parts: [{ name, geo, mat, pivot }] } once complete (or null)
  const pending = new Map();   // key -> { spec, parts: [], i }
  const queue = [];
  function request(key, hi) {
    if (built.has(key)) return built.get(key);
    if (!pending.has(key)) {
      const spec = NX.Models.spec(key);
      if (!spec) { built.set(key, null); return null; }
      pending.set(key, { spec, parts: [], i: 0 });
      if (hi) queue.splice(queue.length ? 1 : 0, 0, key); else queue.push(key);
    } else if (hi) {
      const i = queue.indexOf(key);
      if (i > 1) { queue.splice(i, 1); queue.splice(1, 0, key); }
    }
    return null;
  }
  R3D.prewarm = (keys) => { for (const k of keys) request(k); };
  R3D.pendingCount = () => queue.length;
  function pumpBuild(budget) {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < budget) {
      const key = queue[0], job = pending.get(key);
      const p = job.spec.parts[job.i];
      const part = NX.SDF.compile(p.prims);
      const m = NX.SDF.mesh(part, (p.res || 0.02) * Q.res);
      if (m) {
        const geo = new THREE.BufferGeometry();
        const pv = p.pivot || [0, 0, 0];
        for (let i = 0; i < m.positions.length; i += 3) { m.positions[i] -= pv[0]; m.positions[i + 1] -= pv[1]; m.positions[i + 2] -= pv[2]; }
        geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
        geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
        geo.computeBoundingSphere();
        job.parts.push({ name: p.name, geo, mat: MAT[p.mat || 'skin'] || MAT.skin, pivot: pv });
      }
      if (++job.i >= job.spec.parts.length) {
        queue.shift(); pending.delete(key);
        built.set(key, { spec: job.spec, parts: job.parts });
      }
    }
  }
  R3D.idle = () => pumpBuild(Q.budgetMs);
  R3D.prewarmTick = (ms) => pumpBuild(ms);
  R3D.triangles = () => { let n = 0; for (const b of built.values()) if (b) for (const p of b.parts) n += p.geo.index.count / 3; return n; };

  // Instantiate a model: { root, body, rig: { name -> Object3D }, spec, meshes }
  function instance(key) {
    const b = request(key);
    if (!b) return null;
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const rig = {}, meshes = [];
    for (const p of b.parts) {
      const m = new THREE.Mesh(p.geo, p.mat);
      m.position.set(p.pivot[0], p.pivot[1], p.pivot[2]);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.baseMat = p.mat; m.userData.pivot = p.pivot;
      body.add(m); rig[p.name] = m; meshes.push(m);
    }
    rig.root = body;
    for (const ex of b.spec.extras || []) addExtra(ex, rig);
    body.scale.setScalar(b.spec.scale || 1);
    return { root, body, rig, spec: b.spec, meshes, key };
  }
  R3D.instance = (key) => instance(key);

  function addExtra(ex, rig) {
    const parent = rig[ex.to] || rig.root;
    const pv = parent === rig.root ? [0, 0, 0] : parent.position.toArray();
    const local = (a) => new THREE.Vector3(a[0] - pv[0], a[1] - pv[1], a[2] - pv[2]);
    switch (ex.kind) {
      case 'eyes': {
        const r = ex.size || 0.03;
        const zs = ex.single ? [ex.at[2]] : [ex.at[2], -ex.at[2]];
        for (const z of zs) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), glowMat(ex.glow));
          m.position.copy(local([ex.at[0], ex.at[1], z])); parent.add(m);
          const h = halo(ex.glow, r * 7); h.position.copy(m.position); parent.add(h);
        }
        break;
      }
      case 'visor': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.3), glowMat(ex.glow));
        m.position.copy(local([ex.at[0] + 0.035, ex.at[1], 0])); parent.add(m);
        break;
      }
      case 'flame': {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.SphereGeometry(ex.size, 12, 8), glowMat('#fff2a0')));
        g.add(halo(ex.glow, ex.size * 6));
        g.position.copy(local(ex.at)); parent.add(g);
        rig.flame = g;
        break;
      }
      case 'aura': {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), new THREE.MeshBasicMaterial({ color: ex.glow, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        m.position.y = 0.75; m.scale.set(1, 1.15, 1); parent.add(m); rig.aura = m;
        break;
      }
      case 'spines': {
        for (let i = 0; i < 5; i++) { const h = halo(ex.glow, 0.5); h.position.set(-0.32 - i * 0.03, 1.5 - i * 0.18, 0); parent.add(h); }
        break;
      }
      case 'prop': {
        const w = propMesh(ex.prop, ex.color);
        if (w) { w.position.copy(local(ex.at)); parent.add(w); rig.prop = w; }
        break;
      }
      case 'glow': { const h = halo(ex.glow, ex.size || 1); h.position.copy(local(ex.at)); parent.add(h); break; }
      case 'portal': {
        // swirling event-horizon discs on both faces of a gate membrane (facing ±X), spun by the 'gate' rig
        const g = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ map: swirlTex(), color: ex.glow, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
        for (const s of [1, -1]) { const m = new THREE.Mesh(geo.swirl || (geo.swirl = new THREE.CircleGeometry(1, 48).rotateY(Math.PI / 2)), mat); m.position.x = 0.085 * s; m.scale.setScalar(ex.size || 1); g.add(m); }
        g.position.copy(local(ex.at)); parent.add(g); rig.swirl = g; rig.swirlMat = mat;
        break;
      }
    }
  }
  function swirlTex() {
    return canvasTex('swirl', 128, 128, (x, w, h) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0.3)');
      x.fillStyle = g; x.beginPath(); x.arc(64, 64, 63, 0, Math.PI * 2); x.fill();
      x.lineCap = 'round';
      for (let a = 0; a < 4; a++) for (let i = 0; i < 40; i++) {
        const t = i / 40, ang = a * Math.PI / 2 + t * 4.2, r = 6 + t * 54;
        x.strokeStyle = `rgba(255,255,255,${0.75 * (1 - t * 0.6)})`; x.lineWidth = 1.5 + t * 4;
        x.beginPath(); x.arc(64, 64, r, ang, ang + 0.16); x.stroke();
      }
    });
  }

  // Hard-surface hand props & weapons (pointing along +X, held at the origin).
  function propMesh(kind, color) {
    const g = new THREE.Group();
    const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.4, metalness: 0.3, envMap: R3D.envMap, envMapIntensity: 0.8 }, o));
    const add = (geom, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geom, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
    const cylX = (r, len, segs = 16) => new THREE.CylinderGeometry(r, r, len, segs).rotateZ(-Math.PI / 2);
    const glowShell = (col) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const blade = (len, col, w = 0.025, z = 0) => { add(cylX(w, len), glowMat(col), len / 2 + 0.08, 0, z); add(cylX(w * 2.2, len * 1.02), glowShell(col), len / 2 + 0.08, 0, z); };
    const at = (obj, x, y, z) => { obj.position.set(x, y, z); g.add(obj); return obj; };
    switch (kind) {
      case 'saber': case 'lightsaber': add(cylX(0.03, 0.16), std('#888', { metalness: 0.9 })); blade(0.75, color || '#4fc3ff'); break;
      case 'esword': case 'energysword': add(cylX(0.035, 0.14), std('#555')); blade(0.55, color || '#7ab0ff', 0.02, 0.04); blade(0.55, color || '#7ab0ff', 0.02, -0.04); break;
      case 'blaster': case 'pistol': case 'rifle': case 'plasma': case 'phaser': case 'tranqrifle': {
        const len = kind === 'rifle' || kind === 'tranqrifle' ? 0.45 : 0.28;
        add(new THREE.BoxGeometry(len, 0.07, 0.06), std(kind === 'plasma' ? '#5a4aa8' : '#222'), len / 2);
        add(new THREE.BoxGeometry(0.06, 0.12, 0.05), std('#333'), 0.03, -0.07);
        add(cylX(0.02, 0.1), glowMat(color || '#ff3b3b'), len + 0.03);
        break;
      }
      case 'gaffi': case 'staff':
        add(new THREE.CylinderGeometry(0.02, 0.025, 1.0, 8), std('#7a5a3a'), 0, 0.2);
        if (kind === 'staff') { add(new THREE.IcosahedronGeometry(0.07, 1), glowMat(color || '#ffd23f'), 0, 0.72); at(halo(color || '#ffd23f', 0.5), 0, 0.72, 0); }
        break;
      case 'spear': case 'trident':
        add(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), std('#8a6a3a'), 0, 0.25);
        add(new THREE.ConeGeometry(0.05, 0.16, 8), std('#ccc', { metalness: 0.9 }), 0, 0.86);
        if (kind === 'trident') { add(new THREE.ConeGeometry(0.03, 0.12, 6), std('#d8b040', { metalness: 1 }), 0, 0.84, 0.07); add(new THREE.ConeGeometry(0.03, 0.12, 6), std('#d8b040', { metalness: 1 }), 0, 0.84, -0.07); }
        break;
      case 'bow': add(new THREE.TorusGeometry(0.28, 0.015, 6, 20, Math.PI), std('#8a6a3a'), 0, 0, 0, 0, 0, -Math.PI / 2); break;
      case 'wand': case 'elderwand': add(cylX(0.012, 0.32, 8), std(color || '#d8ccb0'), 0.16); break;
      case 'sword': case 'scimitar': case 'pixelsword': case 'mastersword': case 'sting': {
        const col = { sting: '#8ad8ff', mastersword: '#bfe3ff', pixelsword: '#ffe066' }[kind] || '#cfd4dc';
        add(new THREE.BoxGeometry(0.62, 0.06, 0.015), std(col, { metalness: 0.95, roughness: 0.15 }), 0.38);
        add(new THREE.BoxGeometry(0.03, 0.04, 0.2), std('#8a6a3a'), 0.06);
        add(cylX(0.022, 0.12), std('#5a3a20'), 0);
        if (kind === 'sting') at(halo('#4ab8ff', 0.6), 0.4, 0, 0);
        break;
      }
      case 'batleth': add(new THREE.TorusGeometry(0.3, 0.025, 6, 16, Math.PI), std('#ccc', { metalness: 0.9 }), 0.3, 0, 0, Math.PI / 2, 0, 0); break;
      case 'bat': case 'nailbat': add(new THREE.CylinderGeometry(0.06, 0.025, 0.7, 10).rotateZ(-Math.PI / 2), std('#b08a5a', { metalness: 0 }), 0.35); break;
      case 'whip': { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.4, 0.2, 0.1), new THREE.Vector3(0.9, -0.2, 0), new THREE.Vector3(1.3, 0.1, -0.1)]); add(new THREE.TubeGeometry(curve, 20, 0.025, 6), glowMat('#ff6a1a')); break; }
      case 'wrench': add(new THREE.BoxGeometry(0.35, 0.04, 0.03), std('#aaa', { metalness: 0.9 }), 0.18); add(new THREE.TorusGeometry(0.05, 0.02, 6, 12, Math.PI * 1.5), std('#aaa', { metalness: 0.9 }), 0.37); break;
      case 'gauntlet': add(new THREE.SphereGeometry(0.11, 16, 12), std('#d8b040', { metalness: 1, roughness: 0.2 })); ['#ff3030', '#ffd23f', '#3a9aff', '#3aff6a', '#c070ff', '#ff8a1a'].forEach((c, i) => add(new THREE.SphereGeometry(0.022, 8, 6), glowMat(c), 0.08, 0.05 - (i % 3) * 0.04, i < 3 ? 0.05 : -0.05)); break;
      case 'fireflower': add(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6), std('#2a9a3a'), 0, 0.05); add(new THREE.TorusGeometry(0.07, 0.03, 8, 16), glowMat('#ff7a1a'), 0, 0.2, 0, Math.PI / 2); add(new THREE.SphereGeometry(0.04, 8, 6), glowMat('#fff2a0'), 0, 0.2); break;
      case 'pickaxe': add(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), std('#7a5a3a'), 0, 0.15); add(new THREE.TorusGeometry(0.2, 0.03, 6, 12, Math.PI * 0.8), std('#5ef2e5', { metalness: 0.6, emissive: '#1a5a55' }), 0, 0.3, 0, 0, 0, Math.PI * 0.1); break;
      case 'protonpack': add(new THREE.BoxGeometry(0.3, 0.06, 0.06), std('#333'), 0.15); add(cylX(0.025, 0.05), glowMat('#ff9a3a'), 0.33); break;
      case 'lightdisc': case 'disc': add(new THREE.TorusGeometry(0.16, 0.03, 8, 32), glowMat('#18e0ff'), 0, 0, 0, Math.PI / 2); add(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 24), std('#111')); break;
      case 'mjolnir': case 'hammer': add(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8), std('#6a4a2a'), 0, -0.1); add(new THREE.BoxGeometry(0.18, 0.12, 0.28), std('#9aa4b0', { metalness: 0.9, roughness: 0.25 }), 0, 0.12); break;
      case 'capshield': case 'shield': {
        ['#e23636', '#f2f2f2', '#e23636', '#2a4aa8'].forEach((c, i) => add(new THREE.CylinderGeometry(0.28 - i * 0.065, 0.28 - i * 0.065, 0.03 + i * 0.004, 32), std(c, { metalness: 0.5, roughness: 0.3 }), 0, 0, 0, 0, 0, Math.PI / 2));
        const star = new THREE.Shape();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.035 : 0.085, a = i * Math.PI / 5 + Math.PI / 2; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        add(new THREE.ShapeGeometry(star), std('#fff'), 0.025, 0, 0, 0, Math.PI / 2, 0);
        break;
      }
      case 'webshooter': add(cylX(0.05, 0.1), std('#c02020'), 0.05); add(new THREE.SphereGeometry(0.03, 8, 6), glowMat('#ffffff'), 0.12); break;
      case 'repulsors': add(new THREE.SphereGeometry(0.06, 12, 8), std('#b02020', { metalness: 0.8 })); add(new THREE.CircleGeometry(0.04, 16), glowMat('#9af0ff'), 0.06, 0, 0, 0, Math.PI / 2); at(halo('#9af0ff', 0.5), 0.08, 0, 0); break;
      case 'batarang': { const s = new THREE.Shape(); s.moveTo(-0.2, 0); s.quadraticCurveTo(-0.1, 0.06, -0.04, -0.05); s.lineTo(0, 0.02); s.lineTo(0.04, -0.05); s.quadraticCurveTo(0.1, 0.06, 0.2, 0); s.lineTo(0, 0.1); s.closePath(); add(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), std('#222', { metalness: 0.7 }), 0, 0, 0, -Math.PI / 2, 0, 0); break; }
      case 'lasso': add(new THREE.TorusGeometry(0.12, 0.015, 6, 24), glowMat('#ffd23f'), 0.1, 0, 0, Math.PI / 2); break;
      case 'lanternring': add(new THREE.TorusGeometry(0.04, 0.015, 6, 16), glowMat('#3aff6a'), 0.02, 0, 0, Math.PI / 2); at(halo('#3aff6a', 0.6), 0.04, 0, 0); break;
      case 'sonicscrewdriver': add(cylX(0.02, 0.22), std('#888', { metalness: 0.9 }), 0.11); add(new THREE.SphereGeometry(0.025, 8, 6), glowMat('#5fffaf'), 0.24); break;
      case 'kamehameha': at(halo('#5fc8ff', 0.4), 0.05, 0, 0); break;
      case 'portalgun': add(new THREE.CapsuleGeometry(0.06, 0.2, 6, 12).rotateZ(-Math.PI / 2), std('#f0f0f0', { roughness: 0.2 }), 0.12); add(cylX(0.035, 0.05), glowMat('#3a9aff'), 0.28); break;
      case 'atomicbreath': at(halo('#4ad0ff', 0.4), 0.05, 0, 0); break;
      default: return null;
    }
    return g;
  }

  // ---------- Terrain ----------
  const sectors = new Map();   // key -> { group, pellets, anim, power, needs }
  const texCache = new Map();
  const geo = {};
  let D;
  const dummy = () => D || (D = new THREE.Object3D());

  function canvasTex(key, w, h, draw, opts = {}) {
    let t = texCache.get(key);
    if (t) return t;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
    texCache.set(key, t);
    return t;
  }

  const blockTex = {
    brick: (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(4, 4, w - 8, 4); },
    bricks: (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,0.35)'; for (let r = 0; r < 4; r++) { x.fillRect(0, r * 16 + 14, w, 2); for (let c = 0; c < 3; c++) x.fillRect((r % 2 ? 0 : 16) + c * 32, r * 16, 2, 14); } },
    cobble: (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`; x.fillRect(Math.floor(Math.random() * 8) * 8, Math.floor(Math.random() * 8) * 8, 8, 8); } },
    panel: (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2; x.strokeRect(1, 1, w - 2, h - 2); x.strokeRect(1, 1, w - 2, h / 2); },
    checker: (x, w, h) => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.fillStyle = (i + j) % 2 ? '#c8762e' : '#8a4a1a'; x.fillRect(i * w / 4, j * h / 4, w / 4, h / 4); } },
    neonEdge: (col) => (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.strokeStyle = col; x.lineWidth = 5; x.strokeRect(4, 4, w - 8, h - 8); },
    stripe: (col) => (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.fillStyle = col; x.fillRect(0, h * 0.45, w, h * 0.1); x.fillRect(w * 0.45, 0, w * 0.06, h); },
    lcars: (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); const c = ['#f7a83a', '#c08ad8', '#8ab0ff', '#e0705a']; for (let i = 0; i < 4; i++) { x.fillStyle = c[i]; x.beginPath(); x.roundRect(6, 6 + i * 15, w - 12 - (i % 2) * 20, 10, 5); x.fill(); } },
    windows: (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) { if (Math.random() < 0.55) { x.fillStyle = '#fff'; x.fillRect(6 + i * 20, 8 + j * 30, 12, 18); } } },
    windowsBase: (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,0.55)'; for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) x.fillRect(6 + i * 20, 8 + j * 30, 12, 18); },
    qblock: (x, w, h) => { x.fillStyle = '#f5b829'; x.fillRect(0, 0, w, h); x.strokeStyle = '#7a4a10'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4); x.fillStyle = '#7a4a10'; x.font = 'bold 44px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', w / 2, h / 2 + 2); },
    // emissive map for obsidian blocks: black with glowing purple seams and a hairline crack
    obsidianSeams: (x, w, h) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#b06aff'; x.lineWidth = 2; x.strokeRect(1, 1, w - 2, h - 2);
      x.strokeStyle = 'rgba(176,106,255,0.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo(8, 0); x.lineTo(20, 22); x.lineTo(14, 40); x.lineTo(30, 64); x.moveTo(20, 22); x.lineTo(44, 30); x.stroke();
    },
  };

  function boxGeo() { return geo.box || (geo.box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)); }
  let needs = null;   // model keys the sector being built is still waiting for
  function lib(key) {
    // Shared low-res sculpted geometry for instanced terrain objects (trees, bushes, rocks...).
    const b = request(key, true);
    if (b && b.parts[0]) return b.parts[0].geo;
    if (needs && !built.has(key)) needs.add(key);
    return null;
  }

  const themeKeyMap = new Map();
  function themeKey(th) { if (!themeKeyMap.size) for (const k of Object.keys(NX.THEMES)) themeKeyMap.set(NX.THEMES[k], k); return themeKeyMap.get(th); }
  function wallMaterial(th, kind, h) {
    const key = `wall:${th.name}:${kind}:${h}`;
    let m = texCache.get(key);
    if (m) return m;
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, o));
    const tex = (k, fn, rep) => canvasTex(`${k}:${rep}`, 64, 64, fn, { repeat: rep });
    switch (kind) {
      case 'plain': m = std({ roughness: 0.9 }); break;
      case 'brick': m = std({ map: tex('brick', blockTex.brick, [1, 1]), roughness: 0.6 }); break;
      case 'bricks': m = std({ map: tex('bricks', blockTex.bricks, [1, h]) }); break;
      case 'stone': m = std({ map: tex('cobble', blockTex.cobble, [1, h]), roughness: 0.95 }); break;
      case 'checker': { const ct = tex('checker', blockTex.checker, [1, 1]); m = [std({ map: ct }), std({ map: ct }), std({ color: '#5cd04a' }), std({}), std({ map: ct }), std({ map: ct })]; break; }
      case 'neon': m = std({ color: '#06061a', emissive: '#ffffff', emissiveMap: tex('neon' + th.wallColor, blockTex.neonEdge(th.wallColor), [1, h]), roughness: 0.4 }); break;
      case 'stripe': m = std({ emissive: '#ffffff', emissiveMap: tex('stripe' + th.wallColor, blockTex.stripe(th.wallColor), [1, h]), roughness: 0.35, metalness: 0.4 }); break;
      case 'lcars': m = std({ emissive: '#ffffff', emissiveMap: tex('lcars', blockTex.lcars, [1, h]), roughness: 0.5 }); break;
      case 'panel': m = std({ map: tex('panel', blockTex.panel, [1, h]), roughness: 0.4 }); break;
      case 'building': {
        const side = std({ map: canvasTex('wb:' + h, 64, 64, blockTex.windowsBase, { repeat: [1, h] }), emissive: th.windows || '#ffd76a', emissiveMap: canvasTex('we:' + h, 64, 64, blockTex.windows, { repeat: [1, h] }), emissiveIntensity: DARK.has(themeKey(th)) ? 1.2 : 0.35, roughness: 0.5, metalness: 0.2 });
        const roof = std({ map: canvasTex('roof', 64, 64, blockTex.panel), roughness: 0.8 });
        m = [side, side, roof, roof, side, side];
        break;
      }
      case 'qblock': m = std({ map: tex('q', blockTex.qblock, [1, 1]), emissive: '#5a3a00', roughness: 0.4 }); break;
      case 'obsidian': m = std({ color: new THREE.Color(th.wallColor).convertSRGBToLinear(), roughness: 0.2, metalness: 0.3, envMap: R3D.envMap, envMapIntensity: 0.5, emissive: '#ffffff', emissiveMap: tex('obsidian', blockTex.obsidianSeams, [1, h]), emissiveIntensity: 1 }); break;
      default: m = std({});
    }
    texCache.set(key, m);
    return m;
  }

  const WALL = {
    mesa: { mat: 'plain', h: (r) => 1.1 + r * 1.6 },
    brick: { mat: 'brick', h: () => 1 },
    stone: { mat: 'stone', h: (r) => 1 + Math.floor(r * 3) },
    neon: { mat: 'neon', h: () => 0.9 },
    gridwall: { mat: 'neon', h: () => 0.7 },
    neonwall: { mat: 'stripe', h: () => 1.6 },
    building: { mat: 'building', h: (r, b) => 2 + Math.floor(b * 5) },
    castle: { mat: 'bricks', h: (r) => 2 + Math.floor(r * 2) },
    brickhouse: { mat: 'bricks', h: (r, b) => 2 + Math.floor(b * 2) },
    forerunner: { mat: 'stripe', h: (r) => 1.5 + Math.floor(r * 2) * 0.5 },
    lcars: { mat: 'lcars', h: () => 2 },
    checker: { mat: 'checker', h: () => 1 },
    panel: { mat: 'panel', h: (r) => 2 + Math.floor(r * 2) },
    obsidian: { mat: 'obsidian', h: (r) => (r < 0.5 ? 2.5 : 3) },   // two heights read as battlements
    vines: { geo: 'rock', h: (r) => 0.9 + r * 0.6 },
    tree: { geo: 'tree' },
  };
  const TINTED = new Set(['plain', 'stone', 'bricks', 'panel', 'building', 'brick', 'stripe']);
  const TREE_KIND = { pocket: 'tree_round', hyrule: 'tree_round', jurassic: 'tree_palm', namek: 'tree_round', middleearth: 'tree_pine', hogwarts: 'tree_pine' };

  function buildSector(sx, sy) {
    needs = new Set();
    const sec = W.sector(sx, sy), theme = sec.theme, th = NX.THEMES[theme];
    const group = new THREE.Group();
    group.position.set(sx * S, 0, sy * S);
    const tiles = sec.tiles;
    const h01 = (lx, ly, salt = 0) => NX.h01(sx * S + lx, sy * S + ly, 900 + salt);
    const lists = {};
    const push = (k, lx, ly) => (lists[k] || (lists[k] = [])).push([lx, ly]);
    let hasWater = false;
    const KIND = { [T.WALL]: 'wall', [T.BREAK]: 'break', [T.QBLOCK]: 'qblock', [T.USED]: 'used', [T.PELLET]: 'pellet', [T.POWER]: 'power', [T.GRASS]: 'grass', [T.PROP]: 'prop', [T.DECOR]: 'decor', [T.GATE]: 'gate', [T.ALTAR]: 'altar', [T.FORCE]: 'force' };
    for (let ly = 0; ly < S; ly++) for (let lx = 0; lx < S; lx++) {
      const t = tiles[ly * S + lx];
      if (t === T.WATER) hasWater = true;
      else if (KIND[t]) push(KIND[t], lx, ly);
    }
    // Floor: one textured plane per sector (4 px per tile).
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshStandardMaterial({ map: floorTexture(sx, sy, sec, th), roughness: 0.92, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(S / 2, 0, S / 2); floor.receiveShadow = true;
    floor.userData.own = true;
    group.add(floor);
    if (hasWater) {
      const wm = new THREE.MeshStandardMaterial({ color: th.waterColor || '#3d8fd6', roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.78, alphaMap: waterMask(sec) });
      const water = new THREE.Mesh(new THREE.PlaneGeometry(S, S), wm);
      water.rotation.x = -Math.PI / 2; water.position.set(S / 2, 0.06, S / 2); water.userData.own = true;
      group.add(water);
    }
    const Dm = dummy();
    // Instanced meshes are split into 16x16-tile chunks and culled against the camera frustum
    // by syncCulling() (three r149 can't cull individual instances).
    const CH = 16;
    const inst = (g, mat, list, fn, opts = {}) => {
      if (!g || !list || !list.length) return null;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const chunks = new Map();
      list.forEach((it, i) => { const k = (it[0] / CH | 0) + ',' + (it[1] / CH | 0); if (!chunks.has(k)) chunks.set(k, []); chunks.get(k).push([it, i]); });
      const col = new THREE.Color();
      const meshes = [];
      for (const [k, items] of chunks) {
        const [cx, cy] = k.split(',').map(Number);
        const m = new THREE.InstancedMesh(g, mat, items.length);
        m.frustumCulled = false;
        m.userData.cull = new THREE.Sphere(new THREE.Vector3(sx * S + cx * CH + CH / 2, 1.5, sy * S + cy * CH + CH / 2), CH * 0.72 + g.boundingSphere.radius * 2 + 3);
        items.forEach(([it, i], j) => {
          const [lx, ly] = it;
          Dm.position.set(lx + 0.5, 0, ly + 0.5); Dm.rotation.set(0, 0, 0); Dm.scale.set(1, 1, 1);
          const c = fn(Dm, lx, ly, i, col, it);
          Dm.updateMatrix(); m.setMatrixAt(j, Dm.matrix);
          if (c) m.setColorAt(j, c);
          if (opts.index) opts.index(it, m, j);
        });
        m.castShadow = opts.cast !== false; m.receiveShadow = true;
        group.add(m);
        meshes.push(m);
      }
      return meshes;
    };
    // Walls
    const ws = WALL[th.wall] || WALL.mesa;
    const wallCol = new THREE.Color(th.wallColor);
    if (ws.geo === 'tree') {
      const g = lib(`${TREE_KIND[theme] || 'tree_round'}:${th.wallColor}`);
      inst(g, MAT.skin, lists.wall, (d, lx, ly, i, c) => { const r = h01(lx, ly); d.rotation.y = r * 6.28; d.scale.setScalar(0.85 + r * 0.5); return c.setHSL(0, 0, 0.85 + r * 0.3); });
    } else if (ws.geo === 'rock') {
      const g = lib(`rock:${th.wallColor}`);
      inst(g, MAT.stone, lists.wall, (d, lx, ly) => { const r = h01(lx, ly); d.rotation.y = r * 6.28; d.scale.set(1.1, ws.h(r), 1.1); return null; });
    } else if (lists.wall) {
      const byH = new Map();
      for (const [lx, ly] of lists.wall) {
        const r = h01(lx, ly), bh = NX.h01(Math.floor((sx * S + lx) / 8), Math.floor((sy * S + ly) / 8), 77);
        const hgt = Math.max(0.5, Math.round(ws.h(r, bh) * 2) / 2);
        if (!byH.has(hgt)) byH.set(hgt, []);
        byH.get(hgt).push([lx, ly, r]);
      }
      for (const [hgt, list] of byH) {
        inst(boxGeo(), wallMaterial(th, ws.mat, Math.ceil(hgt)), list, (d, lx, ly, i, c, it) => {
          d.scale.set(1, hgt, 1);
          return TINTED.has(ws.mat) ? c.copy(wallCol).offsetHSL(0, 0, (it[2] - 0.5) * 0.08) : null;
        });
      }
    }
    // Breakables
    if (lists.break) {
      if (th.breakStyle === 'bush') inst(lib('bush:#2f9a3c'), MAT.skin, lists.break, (d, lx, ly) => { d.rotation.y = h01(lx, ly) * 6; d.scale.setScalar(0.9); return null; });
      else if (th.breakStyle === 'brick') inst(boxGeo(), wallMaterial(th, 'bricks', 1), lists.break, (d, lx, ly, i, c) => c.set('#c4602c'));
      else inst(boxGeo(), wallMaterial(th, 'stone', 1), lists.break, (d, lx, ly, i, c) => c.set(['#5ef2e5', '#ffd23f', '#e0302a', '#4a4a4a'][Math.floor(h01(lx, ly, 3) * 4)]).lerp(new THREE.Color('#999'), 0.55));
    }
    if (lists.qblock) inst(boxGeo(), wallMaterial(th, 'qblock', 1), lists.qblock, (d) => { d.position.y = 0.6; d.scale.setScalar(0.9); return null; });
    if (lists.used) inst(boxGeo(), wallMaterial(th, 'brick', 1), lists.used, (d, lx, ly, i, c) => { d.position.y = 0.6; d.scale.setScalar(0.9); return c.set('#8a5a2b'); });
    // Pac pellets (instances hidden individually when eaten)
    const pellets = new Map();
    const pelletMesh = (list, r, col) => inst(geo['pellet' + r] || (geo['pellet' + r] = new THREE.SphereGeometry(r, 12, 8)), glowMat(col), list, (d) => { d.position.y = 0.45; return null; },
      { cast: false, index: ([lx, ly], m, j) => pellets.set(ly * S + lx, [m, j]) });
    pelletMesh(lists.pellet, 0.08, '#ffcfb0');
    const power = pelletMesh(lists.power, 0.22, '#ffcfb0');
    if (lists.grass) inst(grassGeo(), texCache.get('grassMat:' + theme) || texCache.set('grassMat:' + theme, new THREE.MeshStandardMaterial({ color: theme === 'jurassic' ? '#3a7a2a' : '#3e9e3a', roughness: 0.8, side: THREE.DoubleSide })).get('grassMat:' + theme), lists.grass, (d, lx, ly) => { d.rotation.y = h01(lx, ly) * 6; d.scale.setScalar(0.8 + h01(lx, ly, 2) * 0.5); return null; }, { cast: false });
    if (lists.decor) decorInst(th, theme, lists.decor, inst, h01);
    if (lists.prop) propInst(th, theme, lists.prop, inst, h01, group);
    if (lists.force) forceInst(lists.force, tiles, inst);
    const anim = [];
    for (const [lx, ly] of lists.gate || []) { const g = gateMesh(); g.position.set(lx + 0.5, 0, ly + 0.5); group.add(g); anim.push(g); }
    for (const [lx, ly] of lists.altar || []) { const a = th.gen === 'castle' ? castleAltarMesh() : altarMesh(); if (a) { a.position.set(lx + 0.5, 0, ly + 0.5); group.add(a); anim.push(a); } else if (needs) needs.add('egg'); }
    const out = { group, pellets, anim, power, needs };
    needs = null;
    return out;
  }

  function grassGeo() {
    if (geo.grass) return geo.grass;
    const pos = [];
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2, r = 0.18 + (i % 3) * 0.08, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.35 + (i % 4) * 0.08, w = 0.06;
      const tx = x + Math.cos(a) * 0.08, tz = z + Math.sin(a) * 0.08;
      pos.push(x - w * Math.sin(a), 0, z + w * Math.cos(a), x + w * Math.sin(a), 0, z - w * Math.cos(a), tx, h, tz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return (geo.grass = g);
  }

  function sharedMat(key, make) { let m = texCache.get(key); if (!m) { m = make(); texCache.set(key, m); } return m; }
  function decorInst(th, theme, list, inst, h01) {
    const kind = th.gen === 'hub' ? 'hub' : th.gen === 'grid' ? 'grid' : th.decor || 'flowers';
    if (kind === 'hub') inst(geo.hubTile || (geo.hubTile = new THREE.BoxGeometry(0.92, 0.04, 0.92).translate(0, 0.02, 0)), glowMat('#ff4fd8', 0.55), list, () => null, { cast: false });
    else if (kind === 'grid') inst(geo.dot || (geo.dot = new THREE.SphereGeometry(0.06, 8, 6)), glowMat(th.wallColor), list, (d) => { d.position.y = 0.06; return null; }, { cast: false });
    else if (kind === 'bones') inst(geo.bone || (geo.bone = new THREE.CapsuleGeometry(0.04, 0.4, 4, 8).rotateZ(Math.PI / 2).translate(0, 0.05, 0)), sharedMat('boneMat', () => new THREE.MeshStandardMaterial({ color: '#f3ead6', roughness: 0.7 })), list, (d, lx, ly) => { d.rotation.y = h01(lx, ly) * 6; return null; });
    else if (kind === 'spores') inst(geo.spore || (geo.spore = new THREE.SphereGeometry(0.05, 6, 4)), glowMat('#ffffff', 0.7), list, (d, lx, ly) => { d.position.y = 0.4 + h01(lx, ly) * 0.8; return null; }, { cast: false });
    else {
      if (!geo.flowers) {
        const parts = [];
        for (let i = 0; i < 5; i++) { const s = new THREE.SphereGeometry(0.06, 8, 6); s.translate(Math.cos(i * 1.3) * 0.22, 0.12, Math.sin(i * 1.3) * 0.22); parts.push(s); }
        geo.flowers = mergeGeos(parts);
      }
      const cols = ['#ff5a7a', '#ffffff', '#ffd23f', '#a07aff'];
      inst(geo.flowers, sharedMat('flowerMat', () => new THREE.MeshStandardMaterial({ roughness: 0.6 })), list, (d, lx, ly, i, c) => { d.rotation.y = h01(lx, ly) * 6; return c.set(cols[Math.floor(h01(lx, ly, 5) * 4)]); }, { cast: false });
    }
  }

  function propInst(th, theme, list, inst, h01, group) {
    const std = (key, c, o) => sharedMat('prop:' + key, () => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, o)));
    switch (th.prop) {
      case 'vaporator':
        inst(geo.vap || (geo.vap = new THREE.CylinderGeometry(0.12, 0.16, 1.6, 16).translate(0, 0.8, 0)), std('vap', '#a8aeb4', { metalness: 0.7, roughness: 0.3 }), list, () => null);
        inst(geo.vapRing || (geo.vapRing = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 20).translate(0, 1.0, 0)), std('vapr', '#c8cdd2', { metalness: 0.7, roughness: 0.3 }), list, () => null);
        break;
      case 'pipe': inst(lib('pipe'), MAT.gloss, list, () => null); break;
      case 'tardis': inst(lib('tardis'), MAT.skin, list, (d, lx, ly) => { d.rotation.y = Math.floor(h01(lx, ly) * 4) * Math.PI / 2; return null; }); break;
      case 'pot': inst(geo.pot || (geo.pot = new THREE.SphereGeometry(0.3, 16, 12).translate(0, 0.28, 0)), std('pot', '#8a5a3a'), list, () => null); break;
      case 'blocktree':
        inst(geo.btTrunk || (geo.btTrunk = new THREE.BoxGeometry(0.3, 1.2, 0.3).translate(0, 0.6, 0)), std('btt', '#6b4a2a'), list, () => null);
        inst(geo.btLeaf || (geo.btLeaf = new THREE.BoxGeometry(1.1, 0.8, 1.1).translate(0, 1.5, 0)), std('btl', '#3c8a2a', { roughness: 0.9 }), list, () => null);
        break;
      case 'tree2': inst(lib('tree_round:#3f6a2a'), MAT.skin, list, (d, lx, ly) => { d.scale.setScalar(0.7 + h01(lx, ly) * 0.3); return null; }); break;
      case 'palm': inst(lib('tree_palm'), MAT.skin, list, (d, lx, ly) => { d.rotation.y = h01(lx, ly) * 6; return null; }); break;
      case 'lamp': case 'candle': {
        const candle = th.prop === 'candle';
        inst(geo[th.prop] || (geo[th.prop] = new THREE.CylinderGeometry(candle ? 0.07 : 0.04, candle ? 0.07 : 0.06, candle ? 0.5 : 2.2, 10).translate(0, candle ? 0.25 : 1.1, 0)), std(th.prop, candle ? '#f2ead6' : '#222', { metalness: candle ? 0 : 0.6 }), list, () => null);
        inst(geo.bulb || (geo.bulb = new THREE.SphereGeometry(0.09, 10, 8)), glowMat(candle ? '#ffcc4a' : '#ffe9a8'), list, (d) => { d.position.y = candle ? 0.58 : 2.25; return null; }, { cast: false });
        for (const [lx, ly] of list) { const h = halo(candle ? '#ffb040' : '#ffe2a0', candle ? 1.0 : 2.2); h.position.set(lx + 0.5, candle ? 0.58 : 2.25, ly + 0.5); group.add(h); }
        break;
      }
      case 'fence':
        inst(geo.post || (geo.post = new THREE.BoxGeometry(0.15, 1.6, 0.15).translate(0, 0.8, 0)), std('post', '#555', { metalness: 0.5 }), list, () => null);
        inst(geo.wire || (geo.wire = new THREE.BoxGeometry(1, 0.03, 0.03)), glowMat('#ffd23f'), list, (d) => { d.position.y = 1.2; return null; }, { cast: false });
        break;
      case 'console':
        inst(geo.console || (geo.console = new THREE.BoxGeometry(0.8, 0.7, 0.5).translate(0, 0.35, 0)), std('console', '#4a4c58', { metalness: 0.4 }), list, () => null);
        inst(geo.consoleTop || (geo.consoleTop = new THREE.BoxGeometry(0.7, 0.04, 0.4)), glowMat('#f7a83a'), list, (d) => { d.position.y = 0.72; return null; }, { cast: false });
        break;
      case 'statue': {
        const castle = th.gen === 'castle', g = lib(castle ? 'statue:' + th.wallColor : 'statue');
        if (!g) break;
        inst(g, MAT.gloss, list, () => null);
        const cols = castle ? ['#ff2a4a', '#ff9b3d', '#b06aff'] : ['#4fc3ff', '#ffe23a', '#ff4a3a', '#3fcf8e', '#2b3cff', '#ff9a3a'];
        list.forEach(([lx, ly], i) => {
          const m = new THREE.Mesh(geo.ico || (geo.ico = new THREE.IcosahedronGeometry(0.35, 1)), glowMat(cols[i % cols.length]));
          m.position.set(lx + 0.5, 1.6, ly + 0.5); m.userData.spin = true; group.add(m);
          const h = halo(cols[i % cols.length], 2.2); h.position.copy(m.position); group.add(h);
        });
        break;
      }
      default: inst(boxGeo(), std('generic', '#888'), list, (d) => { d.scale.set(0.6, 0.8, 0.6); return null; });
    }
  }

  // IOI forcefield: translucent additive curtains on every FORCE edge that faces a non-FORCE tile,
  // plus a faint lid. Instanced per chunk; no shadows, no depth writes; pulsed in animateTerrain().
  const FORCE_H = 2.5;
  let forceMats = null;
  function forceMaterials() {
    if (forceMats) return forceMats;
    const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false };
    const curtain = canvasTex('force', 32, 128, (x, w, h) => {
      const g = x.createLinearGradient(0, h, 0, 0);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.12, '#a8a8a8'); g.addColorStop(0.7, '#3a3a3a'); g.addColorStop(1, '#202020');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.35)'; for (let y = 8; y < h; y += 16) x.fillRect(0, y, w, 1);
      x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(0, 0, 1, h);
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, 3);
    });
    const flow = canvasTex('forceFlow', 8, 64, (x, w, h) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      for (const [y, a] of [[6, 0.9], [26, 0.5], [44, 0.7]]) { const g = x.createLinearGradient(0, y - 5, 0, y + 5); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, y - 5, w, 10); }
    }, { repeat: [1, 2] });
    forceMats = {
      wall: new THREE.MeshBasicMaterial(Object.assign({ color: '#ff9b3d', map: curtain, opacity: 0.42 }, add)),
      flow: new THREE.MeshBasicMaterial(Object.assign({ color: '#ff9b3d', map: flow, opacity: 0.3 }, add)),
      lid: new THREE.MeshBasicMaterial(Object.assign({ color: '#ff7a1a', opacity: 0.07 }, add)),
    };
    return forceMats;
  }
  function forceInst(list, tiles, inst) {
    const M = forceMaterials();
    const isF = (x, y) => x >= 0 && y >= 0 && x < S && y < S && tiles[y * S + x] === T.FORCE;
    const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];   // rotation.y = k * PI/2 turns the +z edge onto each side
    const edges = [];
    for (const [lx, ly] of list) DIRS.forEach(([dx, dy], k) => { if (!isF(lx + dx, ly + dy)) edges.push([lx, ly, k]); });
    const eg = geo.forceEdge || (geo.forceEdge = new THREE.PlaneGeometry(1, FORCE_H).translate(0, FORCE_H / 2, 0.5));
    const turn = (d, lx, ly, i, c, it) => { d.rotation.y = it[2] * Math.PI / 2; return null; };
    for (const mat of [M.wall, M.flow]) for (const m of inst(eg, mat, edges, turn, { cast: false }) || []) { m.receiveShadow = false; m.renderOrder = 2; }
    for (const m of inst(geo.forceLid || (geo.forceLid = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, FORCE_H, 0)), M.lid, list, () => null, { cast: false }) || []) { m.receiveShadow = false; m.renderOrder = 2; }
  }

  function gateMesh() {
    const g = new THREE.Group();
    geo.gateRings = geo.gateRings || [0, 1, 2].map((i) => new THREE.TorusGeometry(0.55 - i * 0.12, 0.035, 8, 40));
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(geo.gateRings[i], glowMat(['#ff4fd8', '#4ff3ff', '#ffd23f'][i]));
      m.position.y = 1.0; m.userData.ring = i; g.add(m);
    }
    const h = halo('#c070ff', 1.3); h.position.y = 1.0; g.add(h);
    const base = new THREE.Mesh(geo.gateBase || (geo.gateBase = new THREE.CylinderGeometry(0.6, 0.7, 0.1, 32)), sharedMat('gateBase', () => new THREE.MeshStandardMaterial({ color: '#2a2440', metalness: 0.6, roughness: 0.3 })));
    base.position.y = 0.05; base.receiveShadow = true; g.add(base);
    g.userData.gate = true;
    return g;
  }
  function altarMesh() {
    const egg = instance('egg');
    if (!egg) { request('egg', true); return null; }
    const g = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.5, 32), sharedMat('ped', () => new THREE.MeshStandardMaterial({ color: '#4a4070', metalness: 0.5, roughness: 0.3 })));
    ped.position.y = 0.25; ped.castShadow = true; ped.receiveShadow = true; g.add(ped);
    g.add(egg.root);
    const h = halo('#ffe28a', 3.5); h.position.y = 1.2; g.add(h);
    g.userData.egg = egg;
    return g;
  }
  // Anorak's altar: a stepped obsidian dais with crimson rune rings and an empty cradle (the Egg waits beside it).
  function castleAltarMesh() {
    const g = new THREE.Group();
    const obs = sharedMat('altarObs', () => new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a1a3a').convertSRGBToLinear(), roughness: 0.2, metalness: 0.3, envMap: R3D.envMap, envMapIntensity: 0.5 }));
    const part = (geom, mat, y) => { const m = new THREE.Mesh(geom, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    if (!geo.altarC) geo.altarC = [new THREE.CylinderGeometry(1.2, 1.35, 0.2, 8), new THREE.CylinderGeometry(0.85, 0.95, 0.2, 8), new THREE.CylinderGeometry(0.34, 0.46, 0.75, 8), new THREE.CylinderGeometry(0.55, 0.4, 0.14, 8),
      new THREE.TorusGeometry(1.24, 0.03, 6, 48).rotateX(Math.PI / 2), new THREE.TorusGeometry(0.9, 0.025, 6, 40).rotateX(Math.PI / 2), new THREE.TorusGeometry(0.32, 0.04, 8, 32).rotateX(Math.PI / 2)];
    const [a, b, c, d, r1, r2, r3] = geo.altarC;
    part(a, obs, 0.1); part(b, obs, 0.3); part(c, obs, 0.775); part(d, obs, 1.22);
    const rings = [[r1, 0.21, '#ff2a4a'], [r2, 0.41, '#ff2a4a'], [r3, 1.3, '#ffb070']].map(([gm, y, col]) => { const m = new THREE.Mesh(gm, glowMat(col)); m.position.y = y; g.add(m); return m; });
    const h = halo('#ff4a3a', 1.3); h.position.y = 1.45; g.add(h);
    g.userData.castleAltar = rings;
    return g;
  }

  function floorTexture(sx, sy, sec, th) {
    const P = 4, N = S * P;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data;
    const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const f0 = rgb(th.floor[0]), f1 = rgb(th.floor[1]), road = rgb(th.road), water = rgb(th.waterColor || '#3d8fd6').map((v) => v * 0.6);
    const grid = th.gen === 'grid', hub = th.gen === 'hub', city = th.gen === 'city', castle = th.gen === 'castle';
    const line = hub ? [123, 92, 255] : castle ? [120, 50, 170] : rgb(th.wallColor), force = [170, 80, 24];
    let seed = NX.hash(sx, sy, 31);
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let ty = 0; ty < S; ty++) for (let tx = 0; tx < S; tx++) {
      const t = sec.tiles[ty * S + tx];
      let base = ((tx * 7 + ty * 13) & 1) ? f0 : f1;
      if (t === T.ROAD || t === T.GATE || t === T.ALTAR) base = road;
      else if (t === T.WATER) base = water;
      else if (t === T.GRASS) base = base.map((v) => v * 0.85);
      else if (t === T.FORCE) base = force;
      const tileNoise = (rnd() - 0.5) * 10;
      for (let py = 0; py < P; py++) for (let px = 0; px < P; px++) {
        const i = ((ty * P + py) * N + tx * P + px) * 4;
        const n = tileNoise * 0.7 + (rnd() - 0.5) * 6;
        let r = base[0] + n, g = base[1] + n, b = base[2] + n;
        if ((grid || hub || (castle && t !== T.ROAD)) && (px === 0 || py === 0)) { r = r * 0.6 + line[0] * 0.4; g = g * 0.6 + line[1] * 0.4; b = b * 0.6 + line[2] * 0.4; }
        if (city && t === T.ROAD && (px === 0 || py === 0)) { r *= 0.85; g *= 0.85; b *= 0.85; }
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
    return tex;
  }
  function waterMask(sec) {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), img = x.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const v = sec.tiles[i] === T.WATER ? 255 : 0; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
  }

  function mergeGeos(list) {
    let total = 0, itotal = 0;
    for (const g of list) { total += g.attributes.position.count; itotal += g.index.count; }
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), idx = new Uint32Array(itotal);
    let vo = 0, io = 0;
    for (const g of list) {
      pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3);
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i++) idx[io + i] = ix[i] + vo;
      vo += g.attributes.position.count; io += ix.length;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }

  function disposeSector(s) {
    scene.remove(s.group);
    s.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.userData.own) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); if (o.material.alphaMap) o.material.alphaMap.dispose(); o.material.dispose(); }
    });
  }

  R3D.tileChanged = (tx, ty, oldT, newT) => {
    const sx = Math.floor(tx / S), sy = Math.floor(ty / S);
    const s = sectors.get(sx + ',' + sy);
    if (!s) return;
    const li = (ty - sy * S) * S + (tx - sx * S);
    if ((oldT === T.PELLET || oldT === T.POWER) && newT === T.FLOOR && s.pellets.has(li)) {
      const [m, i] = s.pellets.get(li);
      const Dm = dummy(); Dm.position.set(0, -10, 0); Dm.rotation.set(0, 0, 0); Dm.scale.setScalar(0); Dm.updateMatrix();
      m.setMatrixAt(i, Dm.matrix); m.instanceMatrix.needsUpdate = true;
      s.pellets.delete(li);
      return;
    }
    s.dirty = true;
  };
  // Mark one built sector dirty so syncSectors() rebuilds it from W.sector() (e.g. the forcefield dropped).
  R3D.refreshSector = (sx, sy) => { const s = sectors.get(sx + ',' + sy); if (s) s.dirty = true; };

  function syncSectors(budget) {
    const want = new Set(NX.Game.activeSectors());
    for (const [k, s] of sectors) if (!want.has(k)) { disposeSector(s); sectors.delete(k); }
    const t0 = performance.now();
    const P = NX.Game.P, psx = Math.floor(P.x / TS / S), psy = Math.floor(P.y / TS / S);
    const dist = (k) => { const [x, y] = k.split(',').map(Number); return Math.abs(x - psx) + Math.abs(y - psy); };
    const order = [...want].sort((a, b) => dist(a) - dist(b));
    let builtOne = false;
    for (const k of order) {
      const s = sectors.get(k);
      const ready = s && s.needs.size && [...s.needs].every((m) => built.has(m));
      if (s && !s.dirty && !ready) continue;
      if (builtOne && performance.now() - t0 > budget) break;
      const [sx, sy] = k.split(',').map(Number);
      const b = buildSector(sx, sy);
      if (s) disposeSector(s);
      scene.add(b.group);
      sectors.set(k, b);
      builtOne = true;
    }
  }

  // ---------- Entities ----------
  const objs = new Map();   // entity -> view
  let frameId = 0;
  const tints = ['#4a9cff', '#ff4f8b', '#ffd23f', '#5be0a6', '#b06aff', '#ff8a3a', '#18e0ff', '#e84a4a'];
  const PK = new Set(['coin', 'heart', 'grenade', 'mushroom', 'extralife', 'star', 'masterball', 'relic', 'mount', 'pokeballs', 'egg']);
  function modelKey(e) {
    switch (e.kind) {
      case 'enemy': case 'pet': return e.type;
      case 'npc': return e.role === 'gunter' ? 'gunter:' + tints[(e.seed || e.id) % tints.length] : e.look;
      case 'site': return e.role === 'cabinet' ? 'cabinet' : 'gatedoor:' + NX.CAMPAIGN.acts[e.act].color;
      case 'chest': return 'chest';
      case 'pickup':
        if (PK.has(e.item)) return 'pk_' + e.item;
        if (e.item === 'key') return 'pk_key:' + NX.KEYS[e.key].color;
        if (e.item === 'weapon') return 'weapon:' + e.weapon;
        return 'pk_coin';
    }
    return null;
  }

  function makeView(e, key) {
    if (key.startsWith('weapon:')) {
      const id = key.slice(7), w = propMesh(id, NX.WEAPONS[id].color);
      const root = new THREE.Group(), body = new THREE.Group();
      if (w) { w.scale.setScalar(1.6); w.position.y = 0.6; body.add(w); }
      const h = halo(NX.WEAPONS[id].color, 1.4); h.position.y = 0.6; body.add(h);
      root.add(body);
      return { root, body, rig: { root: body }, spec: { rig: 'spin', height: 0.8 }, meshes: [], key };
    }
    const v = instance(key);
    if (!v) return null;
    if (e.kind === 'pickup' && (e.item === 'relic' || e.item === 'key' || e.item === 'mount' || e.item === 'star')) { const h = halo(e.item === 'key' ? NX.KEYS[e.key].color : '#ffd23f', 1.6); h.position.y = 0.45; v.body.add(h); }
    if (e.kind === 'pickup' && e.item === 'egg') { const h = halo('#ffe8a0', 2.6); h.position.y = 0.55; v.body.add(h); const g = halo('#c070ff', 1.2); g.position.y = 0.55; v.body.add(g); }
    if (e.kind === 'site') siteView(v, e);
    if (e.kind === 'pet') { const ring = new THREE.Mesh(geo.petRing || (geo.petRing = new THREE.RingGeometry(0.42, 0.5, 32).rotateX(-Math.PI / 2)), glowMat('#5bff9a', 0.7)); ring.position.y = 0.03; v.root.add(ring); }
    if (e.def && e.def.boss) { const ring = new THREE.Mesh(geo.bossRing || (geo.bossRing = new THREE.RingGeometry(0.9, 1.0, 48).rotateX(-Math.PI / 2)), glowMat(e.def.color || '#ff3030', 0.6)); ring.position.y = 0.03; v.root.add(ring); v.bossRing = ring; }
    if (e.tier === 'gold') { const h = halo('#ffd23f', 2.2); h.position.y = 0.4; v.root.add(h); }
    return v;
  }

  function placeholder(e) {
    const root = new THREE.Group(), body = new THREE.Group();
    const col = (e.def && (e.def.color || (e.def.colors && e.def.colors.body))) || '#8a8aa8';
    const m = new THREE.Mesh(geo.ph || (geo.ph = new THREE.CapsuleGeometry(0.25, 0.5, 4, 12).translate(0, 0.5, 0)), sharedMat('ph:' + col, () => new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, transparent: true, opacity: 0.55 })));
    body.add(m); root.add(body);
    return { root, body, rig: { root: body }, spec: { rig: 'static', height: 1.2 }, meshes: [], key: null, placeholder: true };
  }

  function entityScale(e) {
    if (e.def && e.def.boss) return (e.r / 14) * 0.85;
    if (e.def && e.def.generator) return 1.15;
    if (e.kind === 'pickup' && e.item === 'egg') return 1.4;
    return 1;
  }

  // ---------- Campaign sites (arcade cabinets, gate portals); states are derived each frame ----------
  const dimMat = () => sharedMat('siteDim', () => new THREE.MeshStandardMaterial({ vertexColors: true, color: '#1e1c28', roughness: 0.3 }));
  const gateMat = (col, open, kind) => sharedMat(`gate:${kind}:${col}:${open}`, () => (kind === 'ring'
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.85, envMap: R3D.envMap, envMapIntensity: 0.6, emissive: col, emissiveIntensity: open ? 0.45 : 0 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, color: open ? '#ffffff' : '#6a6a78', roughness: 0.15, emissive: col, emissiveIntensity: open ? 1.0 : 0.05, transparent: true, opacity: open ? 0.92 : 0.75 })));
  function siteView(v, e) {
    const col = NX.CAMPAIGN.acts[e.act].color, at = (o, x, y, z) => { o.position.set(x, y, z); v.body.add(o); return o; };
    if (e.role === 'cabinet') {
      v.glow = at(halo(col, 1.2), 0.34, 1.74, 0);
      v.scrHalo = at(halo('#6a9aff', 0.9), 0.3, 1.33, 0);
      v.beacon = at(new THREE.Mesh(geo.ico || (geo.ico = new THREE.IcosahedronGeometry(0.35, 1)), glowMat(col)), 0, 2.6, 0);
      v.beacon.scale.setScalar(0.5); v.beacon.add(halo(col, 3.4));
    } else v.halo = at(halo(col, 3), 0.15, 1.75, 0);
  }
  function syncSite(v, e, t) {
    const G = NX.Game, r = v.rig;
    if (e.role === 'cabinet') {
      const id = `${e.act}_clue_${e.index}`, st = G.isDone(id) ? 'done' : G.stageId() === id ? 'live' : 'dark';
      if (v.st !== st) {
        v.st = st;
        for (const m of [r.screen, r.marquee]) if (m) m.material = m.userData.baseMat = st === 'dark' ? dimMat() : MAT.glowSoft;
        v.glow.visible = v.scrHalo.visible = st !== 'dark'; v.beacon.visible = st === 'live';
        v.scrHalo.material = haloMat(st === 'done' ? '#5bff9a' : '#6a9aff');
      }
      if (st === 'live') { v.beacon.rotation.set(t * 0.7, t * 2, 0); v.beacon.position.y = 2.6 + Math.sin(t * 2.5) * 0.12; v.glow.scale.setScalar(1.2 + Math.sin(t * 5) * 0.3); }
      else if (st === 'done') v.scrHalo.scale.setScalar(0.9 + Math.sin(t * 3) * 0.08);
    } else {
      const open = G.isDone(e.act + '_gate'), col = NX.CAMPAIGN.acts[e.act].color;
      if (v.open !== open) {
        v.open = open;
        if (r.ring) r.ring.material = r.ring.userData.baseMat = gateMat(col, open, 'ring');
        if (r.membrane) r.membrane.material = r.membrane.userData.baseMat = gateMat(col, open, 'membrane');
        if (r.chevrons) r.chevrons.material = r.chevrons.userData.baseMat = open ? MAT.glowSoft : dimMat();
        if (r.swirlMat) r.swirlMat.opacity = open ? 0.8 : 0.16;
      }
      v.halo.scale.setScalar((open ? 4.6 : 2.4) + Math.sin(t * 2) * 0.25);
    }
  }

  function animate(v, e, dt, t, moving, walk) {
    const r = v.rig, spec = v.spec;
    v.mv = (v.mv || 0) + ((moving ? 1 : 0) - (v.mv || 0)) * Math.min(1, dt * 10);
    const k = v.mv, sw = Math.sin(walk), id = e.id || 0;
    v.body.position.y = 0;
    switch (spec.rig) {
      case 'biped':
        if (r.legL) r.legL.rotation.z = sw * 0.7 * k;
        if (r.legR) r.legR.rotation.z = -sw * 0.7 * k;
        if (r.armL) r.armL.rotation.z = -sw * 0.5 * k;
        if (r.armR && !(v.swing > 0)) r.armR.rotation.z = sw * 0.5 * k;
        v.body.position.y = Math.abs(Math.cos(walk)) * 0.04 * k;
        break;
      case 'robe':
        v.body.position.y = Math.abs(Math.sin(walk * 0.5)) * 0.04 * k + Math.sin(t * 2 + id) * 0.02;
        if (r.armL) r.armL.rotation.z = -sw * 0.25 * k;
        if (r.armR && !(v.swing > 0)) r.armR.rotation.z = sw * 0.25 * k;
        break;
      case 'hop': v.body.position.y = Math.abs(sw) * 0.15 * k; break;
      case 'waddle': v.body.rotation.x = sw * 0.12 * k; if (r.legL) r.legL.rotation.z = sw * 0.6 * k; if (r.legR) r.legR.rotation.z = -sw * 0.6 * k; break;
      case 'quad': case 'quadStiff': for (let i = 0; i < 4; i++) if (r['leg' + i]) r['leg' + i].rotation.z = (i === 0 || i === 3 ? sw : -sw) * 0.6 * k; break;
      case 'spider': { let i = 0; for (const n of Object.keys(r)) if (n.startsWith('leg')) r[n].rotation.y = Math.sin(walk * 1.5 + i++) * 0.25 * k; break; }
      case 'fly': {
        v.body.position.y = 0.7 + Math.sin(t * 3 + id) * 0.08;
        const f = Math.sin(t * (spec.height > 1.2 ? 5 : 16) + id);
        if (r.wingL) r.wingL.rotation.x = -f * 0.55;
        if (r.wingR) r.wingR.rotation.x = f * 0.55;
        break;
      }
      case 'float': v.body.position.y = 0.2 + Math.sin(t * 2 + id) * 0.08; break;
      case 'glide': break;
      case 'roll': if (r.wheel) r.wheel.rotation.z -= dt * 12 * k; break;
      case 'sway': if (r.head) r.head.rotation.z = Math.sin(t * 2.5) * 0.18; if (r.body && spec.height > 2) r.body.rotation.z = Math.sin(t * 0.8) * 0.12; break;
      case 'spin': v.body.rotation.y = t * 2 + id; v.body.position.y = 0.1 + Math.sin(t * 3 + id) * 0.06; break;
      case 'chest': if (r.lid) r.lid.rotation.z += ((e.open ? 1.9 : 0) - r.lid.rotation.z) * Math.min(1, dt * 6); break;
      case 'gate': if (r.swirl) r.swirl.rotation.x = -t * 0.9; break;
      case 'pylon':
        if (r.ringA) r.ringA.rotation.y = t * 1.4 + id;
        if (r.ringB) r.ringB.rotation.y = -t * 1.1;
        if (r.ringC) r.ringC.rotation.set(Math.sin(t * 0.9) * 0.3, t * 2.3, 0);
        if (r.orb) r.orb.position.y = r.orb.userData.pivot[1] + Math.sin(t * 2.2 + id) * 0.05;
        break;
    }
    if (r.tail) r.tail.rotation.y = Math.sin(t * 3 + id) * 0.3;
    if (r.flame) r.flame.scale.setScalar(0.85 + Math.random() * 0.3);
    if (r.aura) { r.aura.material.opacity = 0.1 + Math.sin(t * 4) * 0.05; r.aura.rotation.y = t; }
    if (v.swing > 0 && r.armR) { v.swing -= dt; const p = 1 - Math.max(0, v.swing) / 0.22; r.armR.rotation.z = -2.2 + p * 3.0; r.armR.rotation.x = -0.4 * Math.sin(p * Math.PI); }
  }

  function setMaterial(v, mat) {
    for (const m of v.meshes) if (!m.userData.ghost) m.material = mat || m.userData.baseMat;
  }

  function syncEntities(dt, t) {
    frameId++;
    const G = NX.Game;
    for (const e of G.ents) {
      if (e.kind === 'portal') { syncPortal(e); continue; }
      const key = modelKey(e);
      if (!key) continue;
      let v = objs.get(e);
      if (!v || (v.placeholder && (key.startsWith('weapon:') || request(key)))) {
        const nv = makeView(e, key);
        if (nv) { if (v) scene.remove(v.root); v = nv; objs.set(e, v); scene.add(v.root); }
        else if (!v) { request(key, true); v = placeholder(e); objs.set(e, v); scene.add(v.root); }
      }
      v.seen = frameId;
      const x = e.x / TS, z = e.y / TS;
      const dx = x - (v.px ?? x), dz = z - (v.pz ?? z);
      const moving = Math.hypot(dx, dz) > 0.002;
      v.px = x; v.pz = z;
      if (e.kind === 'site') v.heading = Math.PI / 2;   // face south, toward the approach road and the camera
      else if (moving) v.heading = Math.atan2(dz, dx);
      else if ((e.kind === 'enemy' && e.def && (e.def.ai === 'turret' || e.def.ai === 'shooter' || e.def.boss)) || e.kind === 'npc') v.heading = Math.atan2(G.P.y / TS - z, G.P.x / TS - x);
      v.root.position.set(x, 0, z);
      if (v.h == null) v.h = v.heading || 0;
      v.h += NX.angleDiff(v.h, v.heading ?? v.h) * Math.min(1, dt * 10);
      v.root.rotation.y = -v.h;
      v.root.scale.setScalar(entityScale(e));
      v.root.visible = !e.capturing;
      animate(v, e, dt, t, moving, e.walk || t * 4);
      let mat = null;
      if (e.flash > 0 || (e.fuse > 0 && Math.floor(t * 12) % 2)) mat = MAT.flash;
      else if (e.scared > 0 && e.def && e.def.tag === 'ghost') mat = e.scared < 2 && Math.floor(t * 6) % 2 ? MAT.scaredBlink : MAT.scared;
      if (mat !== v.mat) { setMaterial(v, mat); v.mat = mat; }
      if (v.bossRing) v.bossRing.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
      if (e.kind === 'site' && !v.placeholder) syncSite(v, e, t);
    }
    for (const [e, v] of objs) if (v.seen !== frameId) { scene.remove(v.root); objs.delete(e); }
  }

  // ---------- Player ----------
  let pv = null;
  function syncPlayer(dt, t) {
    const G = NX.Game, P = G.P, g = G.G;
    const key = 'player:' + g.color;
    if (!pv || pv.key !== key) {
      const v = instance(key);
      if (!v) {
        // stand-in capsule until the sculpted avatar is ready
        request(key, true);
        if (!R3D._stand) { R3D._stand = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.6, 4, 12).translate(0, 0.55, 0), new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.4 })); scene.add(R3D._stand); }
        R3D._stand.position.set(P.x / TS, 0, P.y / TS);
        return;
      }
      if (R3D._stand) { scene.remove(R3D._stand); R3D._stand = null; }
      if (pv) scene.remove(pv.group);
      const group = new THREE.Group();
      group.add(v.root);
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 40).rotateX(-Math.PI / 2), glowMat('#4ff3ff', 0.8));
      marker.position.y = 0.03; group.add(marker);
      // x-ray silhouette (follows the animated parts) so the avatar stays visible behind walls
      const ghostMat = new THREE.MeshBasicMaterial({ color: '#4ff3ff', transparent: true, opacity: 0.22, depthTest: false, depthWrite: false });
      for (const m of v.meshes) { const gm = new THREE.Mesh(m.geometry, ghostMat); gm.renderOrder = 10; gm.userData.ghost = true; m.add(gm); }
      pv = Object.assign(v, { group, marker, weapon: null, mountObj: null, mountKey: null });
      scene.add(group);
    }
    pv.group.position.set(P.x / TS, 0, P.y / TS);
    if (pv.weapon !== g.weapon) {
      if (pv.rig.prop) pv.rig.armR.remove(pv.rig.prop);
      const w = propMesh(g.weapon, NX.WEAPONS[g.weapon].color);
      if (w && pv.rig.armR) { w.position.set(0.07, -0.36, -0.06); pv.rig.armR.add(w); pv.rig.prop = w; }
      pv.weapon = g.weapon;
    }
    const mk = P.mount || null;
    if (pv.mountKey !== mk) {
      if (pv.mountObj) pv.group.remove(pv.mountObj.root);
      pv.mountObj = null; pv.mountKey = null;
      if (mk) { const mv = instance('mount_' + mk); if (mv) { pv.mountObj = mv; pv.group.add(mv.root); pv.mountKey = mk; } else request('mount_' + mk, true); }
    }
    const m = mk && NX.MOUNTS[mk], car = m && m.car, fly = m && m.fly;
    const moving = Math.hypot(P.vx || 0, P.vy || 0) > 5;
    const aiming = performance.now() - NX.Input.mouse.lastMove < 2500 || NX.Input.down('attack') || NX.Input.mouse.down;
    const target = aiming ? P.aim : P.moveAng;
    if (pv.hd == null) pv.hd = target;
    pv.hd += NX.angleDiff(pv.hd, target) * Math.min(1, dt * 14);
    pv.root.rotation.y = -pv.hd;
    pv.root.visible = !car && !G.dead;
    if (pv.mountObj) {
      pv.mountObj.root.rotation.y = car ? -P.carAngle : -pv.hd;
      pv.mountObj.root.position.y = fly ? 0.9 + Math.sin(t * 3) * 0.08 : 0;
      if (pv.mountObj.rig.flame) pv.mountObj.rig.flame.visible = !car || P.speedFrac > 0.85;
    }
    if (P.cd > (pv.lastCd || 0) + 0.05 && NX.WEAPONS[g.weapon].kind === 'melee') pv.swing = 0.22;
    pv.lastCd = P.cd;
    animate(pv, { id: 0 }, dt, t, moving && !fly, P.walk);
    pv.root.position.y = fly ? 0.9 + Math.sin(t * 3) * 0.08 : 0;
    const blink = P.iframes > 0 && Math.floor(t * 16) % 2;
    for (const mesh of pv.meshes) mesh.visible = !blink;
    const mat = P.star > 0 ? MAT.flash : null;
    if (mat !== pv.mat) { setMaterial(pv, mat); pv.mat = mat; }
    pv.marker.visible = !G.dead;
  }

  // ---------- Shots, beams, hazards, FX ----------
  const shotObjs = new Map(), fxObjs = new Map(), hazObjs = new Map(), portalObjs = new Map();
  let particles, beamA, beamB;
  function initPools() {
    const N = 3000;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setDrawRange(0, 0);
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    particles = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.18, vertexColors: true, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    particles.frustumCulled = false;
    scene.add(particles);
    const beam = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).rotateZ(Math.PI / 2).translate(0.5, 0, 0), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); m.visible = false; scene.add(m); return m; };
    beamA = { outer: beam(), inner: beam() };
    beamB = { outer: beam(), inner: beam() };
  }

  function shotView(s) {
    const g = new THREE.Group();
    const col = s.color || '#ffffff';
    switch (s.kind) {
      case 'ball': { const v = instance(s.master ? 'pk_masterball' : 'pk_pokeballs'); if (v) { v.body.position.y = -0.3; g.add(v.root); } break; }
      case 'grenade': { const v = instance('pk_grenade'); if (v) { v.body.position.y = -0.3; g.add(v.root); } break; }
      case 'disc': case 'hammer': case 'shield': case 'batarang': {
        const w = propMesh({ disc: 'lightdisc', hammer: 'mjolnir', shield: 'capshield', batarang: 'batarang' }[s.kind]);
        if (w) { if (s.kind === 'shield') w.rotation.z = Math.PI / 2; g.add(w); }
        g.userData.spin = true;
        g.add(halo(col, 1.2));
        break;
      }
      case 'saberthrow': g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.9, 4, 8).rotateZ(Math.PI / 2), glowMat(col)), halo(col, 1.6)); g.userData.spin = true; break;
      case 'rock': g.add(new THREE.Mesh(geo.rockShot || (geo.rockShot = new THREE.DodecahedronGeometry(0.14)), sharedMat('rockShot', () => new THREE.MeshStandardMaterial({ color: '#9a8a7a', roughness: 0.9 })))); break;
      case 'arrow': g.add(new THREE.Mesh(geo.arrow || (geo.arrow = new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6).rotateZ(Math.PI / 2)), sharedMat('arrow', () => new THREE.MeshStandardMaterial({ color: '#ccc' })))); break;
      case 'leaf': g.add(new THREE.Mesh(geo.leaf || (geo.leaf = new THREE.SphereGeometry(0.14, 10, 6).scale(1, 0.25, 0.5)), sharedMat('leaf' + col, () => new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })))); g.userData.spin = true; break;
      case 'bubble': g.add(new THREE.Mesh(geo.bub || (geo.bub = new THREE.SphereGeometry(0.2, 16, 12)), sharedMat('bub' + col, () => new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0.2 })))); break;
      case 'web': g.add(new THREE.Mesh(geo.web || (geo.web = new THREE.IcosahedronGeometry(0.14, 0)), sharedMat('web', () => new THREE.MeshBasicMaterial({ color: '#fff', wireframe: true })))); break;
      default: {
        const round = s.kind === 'fireball' || s.kind === 'orb' || s.kind === 'zap' || s.kind === 'spell' || s.kind === 'portalshot';
        if (!round) {
          const len = s.kind === 'swordbeam' ? 0.7 : 0.55;
          g.add(new THREE.Mesh(geo['boltC' + len] || (geo['boltC' + len] = new THREE.CapsuleGeometry(0.045, len, 4, 8).rotateZ(Math.PI / 2)), glowMat('#ffffff')));
          g.add(new THREE.Mesh(geo['boltO' + len] || (geo['boltO' + len] = new THREE.CapsuleGeometry(0.11, len, 4, 8).rotateZ(Math.PI / 2)), glowMat(col, 0.55)));
        } else {
          const rr = (s.r || 5) / TS * 1.4;
          g.add(new THREE.Mesh(new THREE.SphereGeometry(rr * 0.6, 12, 8), glowMat('#ffffff')));
          g.add(new THREE.Mesh(new THREE.SphereGeometry(rr, 16, 12), glowMat(col, 0.6)));
        }
        g.add(halo(col, round ? 1.4 : 1.0));
      }
    }
    return g;
  }
  function syncShots(t) {
    const seen = new Set();
    for (const s of NX.Game.shots) {
      let o = shotObjs.get(s);
      if (!o) { o = shotView(s); shotObjs.set(s, o); scene.add(o); }
      seen.add(s);
      let y = 0.75;
      if (s.kind === 'grenade') y = 0.4 + Math.sin(Math.min(1, s.age / s.flight) * Math.PI) * 1.4;
      o.position.set(s.x / TS, y, s.y / TS);
      o.rotation.y = -Math.atan2(s.vy, s.vx) + (o.userData.spin ? t * 18 : 0);
    }
    for (const [s, o] of shotObjs) if (!seen.has(s)) { scene.remove(o); shotObjs.delete(s); }
  }

  function syncBeam(pair, b, t) {
    if (!b || b.x1 == null) { pair.outer.visible = pair.inner.visible = false; return; }
    const x1 = b.x1 / TS, z1 = b.y1 / TS, x2 = b.x2 / TS, z2 = b.y2 / TS, len = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(z2 - z1, x2 - x1);
    const w = (b.width || 6) / TS;
    for (const [m, r, col, op] of [[pair.outer, w * (1.1 + Math.sin(t * 40) * 0.15), b.color, 0.45], [pair.inner, w * 0.35, '#ffffff', 0.95]]) {
      m.visible = true; m.position.set(x1, 0.75, z1); m.rotation.set(0, -a, 0); m.scale.set(len, r, r);
      m.material.color.set(col); m.material.opacity = op;
    }
  }

  function syncHazards(t) {
    const seen = new Set();
    for (const h of NX.Game.haz) {
      let o = hazObjs.get(h);
      if (!o) {
        o = new THREE.Group();
        if (h.type === 'laser') {
          const warn = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0), new THREE.MeshBasicMaterial({ color: '#ff2020', transparent: true, opacity: 0.3, depthWrite: false }));
          warn.position.y = 0.05; warn.scale.set(h.len / TS, 1, h.width / TS); o.add(warn); o.userData.warn = warn;
          const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).rotateZ(Math.PI / 2).translate(0.5, 0, 0), new THREE.MeshBasicMaterial({ color: h.color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
          beam.position.y = 0.8; beam.scale.set(h.len / TS, h.width / TS * 0.6, h.width / TS * 0.6); beam.visible = false; o.add(beam); o.userData.beam = beam;
        } else if (h.type === 'stomp') {
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: h.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
          ring.position.y = 0.08; o.add(ring); o.userData.ring = ring;
        } else if (h.type === 'meteor') {
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff4a2a', transparent: true, opacity: 0.7, depthWrite: false }));
          ring.position.y = 0.05; ring.scale.setScalar(h.r / TS); o.add(ring);
          const rock = new THREE.Group();
          rock.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), new THREE.MeshStandardMaterial({ color: '#5a3a2a', emissive: '#ff4a1a', emissiveIntensity: 0.8 })), halo('#ff7a2a', 2.5));
          o.add(rock); o.userData.rock = rock;
        }
        hazObjs.set(h, o); scene.add(o);
      }
      seen.add(h);
      o.position.set(h.x / TS, 0, h.y / TS);
      if (h.type === 'laser') {
        o.rotation.y = -h.a;
        o.userData.warn.visible = h.warn > 0; o.userData.warn.material.opacity = 0.2 + 0.2 * Math.sin(t * 30);
        o.userData.beam.visible = h.warn <= 0;
      } else if (h.type === 'stomp') o.userData.ring.scale.setScalar(h.r / TS);
      else if (h.type === 'meteor') { o.userData.rock.position.set(h.warn * 4, 0.3 + h.warn * 9, 0); o.visible = h.warn < 1.6; }
    }
    for (const [h, o] of hazObjs) if (!seen.has(h)) { scene.remove(o); o.traverse((c) => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } }); hazObjs.delete(h); }
  }

  function syncFx(t) {
    const seen = new Set();
    const pos = particles.geometry.attributes.position.array, col = particles.geometry.attributes.color.array, c = new THREE.Color();
    let n = 0;
    for (const f of NX.Game.fx) {
      if (f.type === 'part') {
        if (n >= 3000) continue;
        if (f.up == null) { f.up = 0.5 + Math.random() * 2.5; f.h0 = 0.4 + Math.random() * 0.6; }
        const k = 1 - f.life / f.max;
        pos[n * 3] = f.x / TS; pos[n * 3 + 1] = Math.max(0.05, f.h0 + f.up * k - 2.5 * k * k); pos[n * 3 + 2] = f.y / TS;
        c.set(f.color); const a = f.life / f.max;
        col[n * 3] = c.r * a; col[n * 3 + 1] = c.g * a; col[n * 3 + 2] = c.b * a;
        n++;
        continue;
      }
      if (f.type === 'text') continue;
      let o = fxObjs.get(f);
      if (!o) {
        const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false };
        switch (f.type) {
          case 'ring': o = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial(Object.assign({ color: f.color }, add))); o.position.y = 0.1; break;
          case 'slash': o = new THREE.Mesh(new THREE.RingGeometry(f.range / TS * 0.45, f.range / TS * 1.05, 32, 1, -f.arc / 2, f.arc).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial(Object.assign({ color: f.color }, add))); o.position.y = 0.75; break;
          case 'fist': o = new THREE.Mesh(new THREE.BoxGeometry(f.r / TS * 1.4, f.r / TS * 1.1, f.r / TS * 1.2), new THREE.MeshBasicMaterial(Object.assign({ color: f.color, opacity: 0.5 }, add))); o.position.y = 0.8; break;
          case 'web': o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: '#fff', wireframe: true, transparent: true })); o.position.y = 0.6; break;
          case 'bolt': {
            const pts = [];
            for (let i = 0; i <= 6; i++) { const j = i % 6 ? 1 : 0; pts.push(new THREE.Vector3(f.x1 / TS + (f.x2 - f.x1) / TS * i / 6 + j * (Math.random() - 0.5) * 0.4, 0.8 + j * (Math.random() - 0.5) * 0.4, f.y1 / TS + (f.y2 - f.y1) / TS * i / 6 + j * (Math.random() - 0.5) * 0.4)); }
            o = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: f.color, transparent: true, toneMapped: false }));
            break;
          }
          case 'capture': { const v = instance('pk_pokeballs'); o = new THREE.Group(); if (v) { v.body.position.y = -0.15; o.add(v.root); } o.add(halo('#ffffff', 1.2)); break; }
          default: continue;
        }
        fxObjs.set(f, o); scene.add(o);
      }
      seen.add(f);
      const k = Math.max(0, f.life / f.max);
      if (f.type !== 'bolt') { o.position.x = f.x / TS; o.position.z = f.y / TS; }
      if (o.material) o.material.opacity = f.type === 'fist' ? k * 0.6 : k;
      if (f.type === 'ring') o.scale.setScalar(Math.max(0.05, f.r / TS * (1 - k) + 0.2));
      if (f.type === 'slash' || f.type === 'fist') o.rotation.y = -f.a;
      if (f.type === 'capture') { o.rotation.z = Math.sin(t * 18) * (f.life > 0.2 ? 0.4 : 0); o.position.y = 0.3; }
    }
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;
    particles.geometry.setDrawRange(0, n);
    for (const [f, o] of fxObjs) if (!seen.has(f)) { scene.remove(o); if (o.geometry) { o.geometry.dispose(); o.material.dispose(); } fxObjs.delete(f); }
  }

  function syncPortal(e) {
    let o = portalObjs.get(e);
    if (!o) {
      const col = e.color ? '#ff9a1a' : '#3a9aff';
      o = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 12, 48), glowMat(col)); ring.scale.set(0.7, 1.1, 1); ring.position.y = 0.9; o.add(ring);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.52, 40), new THREE.MeshBasicMaterial({ color: '#05050a', transparent: true, opacity: 0.85 })); disc.scale.set(0.7, 1.1, 1); disc.position.y = 0.9; o.add(disc);
      const h = halo(col, 2.4); h.position.y = 0.9; o.add(h);
      portalObjs.set(e, o); scene.add(o);
    }
    o.userData.seen = frameId;
    o.position.set(e.x / TS, 0, e.y / TS);
    o.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z);
  }
  function sweepPortals() { for (const [e, o] of portalObjs) if (o.userData.seen !== frameId) { scene.remove(o); portalObjs.delete(e); } }

  // ---------- Theme lighting ----------
  let look = null;
  const tmp = () => R3D._c || (R3D._c = new THREE.Color());
  function syncLook(dt) {
    const P = NX.Game.P, sx = Math.floor(P.x / TS / S), sy = Math.floor(P.y / TS / S);
    const L = LOOK[W.inBounds(sx, sy) ? W.themeOf(sx, sy) : 'hub'] || LOOK.hub;
    const fl = L.fill || FILL, sunH = L.sunH || 26;
    if (!look) look = { sky: new THREE.Color(L.sky), fog: new THREE.Color(L.fog || L.sky), hs: new THREE.Color(L.hemi[0]), hg: new THREE.Color(L.hemi[1]), sun: new THREE.Color(L.sun[0]), si: L.sun[1], ex: L.exposure, fill: new THREE.Color(fl[0]), fi: fl[1], sh: sunH };
    const k = Math.min(1, dt * 1.5);
    look.sky.lerp(tmp().set(L.sky), k); look.fog.lerp(tmp().set(L.fog || L.sky), k); look.hs.lerp(tmp().set(L.hemi[0]), k); look.hg.lerp(tmp().set(L.hemi[1]), k); look.sun.lerp(tmp().set(L.sun[0]), k);
    look.fill.lerp(tmp().set(fl[0]), k); look.fi += (fl[1] - look.fi) * k; look.sh += (sunH - look.sh) * k;
    look.si += (L.sun[1] - look.si) * k; look.ex += (L.exposure - look.ex) * k;
    scene.background.copy(look.sky); scene.fog.color.copy(look.fog);
    hemi.color.copy(look.hs); hemi.groundColor.copy(look.hg); hemi.intensity = 0.38 + look.si * 0.1;
    sun.color.copy(look.sun); sun.intensity = look.si;
    fill.color.copy(look.fill); fill.intensity = look.fi;
    renderer.toneMappingExposure = look.ex * 0.92;
  }

  // ---------- Camera ----------
  let camZoom = 1;
  R3D.zoom = (d) => { camZoom = NX.clamp(camZoom * (d > 0 ? 1.1 : 0.9), 0.55, 1.7); };
  function syncCamera(dt) {
    const G = NX.Game, P = G.P;
    const tx = P.x / TS, tz = P.y / TS;
    const dist = 14.5 * camZoom, pitch = 0.96;
    const wx = tx, wy = Math.sin(pitch) * dist, wz = tz + Math.cos(pitch) * dist;
    if (!R3D._camInit) { camera.position.set(wx, wy, wz); R3D._camInit = true; }
    const k = Math.min(1, dt * 6);
    camera.position.x += (wx - camera.position.x) * k; camera.position.y += (wy - camera.position.y) * k; camera.position.z += (wz - camera.position.z) * k;
    const sh = G.cam.shake ? (Math.random() - 0.5) * G.cam.shake * 0.02 : 0;
    camera.lookAt(camera.position.x + sh, 0.6 + sh, camera.position.z - Math.cos(pitch) * dist);
    sun.position.set(tx + 12, look ? look.sh : 26, tz + 8); sun.target.position.set(tx, 0, tz);
    fill.position.set(tx - 10, 12, tz - 12);
    scene.fog.near = 26 * camZoom; scene.fog.far = 64 * camZoom;
  }

  let frustum, projScreen;
  function syncCulling() {
    if (!frustum) { frustum = new THREE.Frustum(); projScreen = new THREE.Matrix4(); }
    camera.updateMatrixWorld();
    projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreen);
    for (const s of sectors.values()) for (const c of s.group.children) if (c.userData.cull) c.visible = frustum.intersectsSphere(c.userData.cull) && !(s.blinkOff && s.power && s.power.includes(c));
  }

  function animateTerrain(t) {
    for (const s of sectors.values()) {
      for (const a of s.anim) {
        if (a.userData.gate) for (const c of a.children) if (c.userData.ring != null) { c.rotation.y = t * (0.6 + c.userData.ring * 0.4); c.rotation.x = t * (0.4 + c.userData.ring * 0.3); }
        if (a.userData.egg) { a.userData.egg.body.rotation.y = t * 0.6; a.userData.egg.body.position.y = 0.55 + Math.sin(t * 2) * 0.06; }
        if (a.userData.castleAltar) { const [r1, r2, r3] = a.userData.castleAltar, p = 1 + Math.sin(t * 1.6) * 0.025; r1.scale.set(p, 1, p); r2.scale.set(2 - p, 1, 2 - p); r3.position.y = 1.3 + Math.sin(t * 2) * 0.04; }
      }
      s.blinkOff = Math.floor(t * 4) % 2 === 1;
      for (const c of s.group.children) if (c.userData.spin) { c.rotation.y = t; c.rotation.x = t * 0.6; c.position.y = 1.6 + Math.sin(t * 2 + c.position.x) * 0.1; }
    }
    if (forceMats) {
      const p = Math.sin(t * 2.4);
      forceMats.wall.opacity = 0.42 + p * 0.12; forceMats.lid.opacity = 0.07 + p * 0.03;
      forceMats.flow.map.offset.y = -t * 0.35;
    }
  }

  // ---------- Public API ----------
  R3D.resize = (w, h, dpr) => {
    if (!renderer) return;
    renderer.setPixelRatio(Math.min(dpr, Q.pixelRatio));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 60 : 42;
    camera.updateProjectionMatrix();
  };
  let V;
  R3D.project = (xpx, ypx, h = 0) => {
    const v = (V || (V = new THREE.Vector3())).set(xpx / TS, h, ypx / TS).project(camera);
    return { x: (v.x + 1) / 2 * NX.view.W, y: (1 - v.y) / 2 * NX.view.H, visible: v.z < 1 && v.z > -1 };
  };
  R3D.screenToWorld = (mx, my) => {
    raycaster.setFromCamera(new THREE.Vector2(mx / NX.view.W * 2 - 1, -(my / NX.view.H * 2 - 1)), camera);
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, p)) return null;
    return { x: p.x * TS, y: p.z * TS };
  };

  R3D.render = (dt) => {
    const t = NX.Game.time;
    const t0 = performance.now();
    pumpBuild(Q.budgetMs);
    syncSectors(Math.max(2, Q.budgetMs - (performance.now() - t0)));
    syncLook(dt);
    syncPlayer(dt, t);
    syncEntities(dt, t);
    sweepPortals();
    syncShots(t);
    const b = NX.Game.beams();
    syncBeam(beamA, b.beam, t);
    syncBeam(beamB, b.big, t);
    syncHazards(t);
    syncFx(t);
    animateTerrain(t);
    syncCamera(dt);
    syncCulling();
    renderer.render(scene, camera);
  };

  R3D.snap = () => { R3D._camInit = false; };

  R3D.reset = () => {
    for (const s of sectors.values()) disposeSector(s);
    sectors.clear();
    for (const v of objs.values()) scene.remove(v.root);
    objs.clear();
    for (const m of [shotObjs, fxObjs, hazObjs, portalObjs]) { for (const o of m.values()) scene.remove(o); m.clear(); }
    if (pv) { scene.remove(pv.group); pv = null; }
    R3D._camInit = false; look = null;
  };
  R3D.stats = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures });
})();
