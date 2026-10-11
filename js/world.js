// The multiverse: a (2r+1)×(2r+1) grid of sectors, each S×S tiles, generated lazily
// from the seed. Fandom regions are Voronoi cells; the three key sectors are pinned.
(() => {
  'use strict';
  const NX = window.NX, C = NX.C, T = NX.T;
  const S = C.world.sectorTiles, R = C.world.radius, HALF = S >> 1;

  const World = NX.World = {
    S, R, TS: C.world.tile,
    cache: new Map(),         // "sx,sy" -> { sx, sy, theme, tiles }
    mods: new Map(),          // "sx,sy" -> Map(localIndex -> tile)  (mined walls, broken blocks, eaten pellets)
    themeMemo: new Map(),
    keySectors: {},           // keyId -> { sx, sy }
    raidSectors: {},          // themeId -> { sx, sy, boss }
    _last: null,

    init() {
      this.cache.clear(); this.themeMemo.clear(); this._last = null;
      const a0 = NX.h01(7, 7, 7) * Math.PI * 2;
      for (const id of NX.KEY_ORDER) {
        const k = NX.KEYS[id], d = C.keys[id], a = a0 + k.angle;
        const c = Math.cos(a), s = Math.sin(a), m = Math.max(Math.abs(c), Math.abs(s));
        this.keySectors[id] = { sx: Math.round(c / m * d), sy: Math.round(s / m * d) };
      }
      // Each fandom's raid boss lives on a ring somewhere in that fandom's territory.
      this.raidSectors = {};
      const taken = new Set();
      for (const theme of Object.keys(NX.RAIDS)) {
        const start = C.raids.minDist + (NX.hash(theme.length, 41, theme.charCodeAt(0)) % 6);
        const a1 = NX.h01(theme.charCodeAt(1), theme.length, 42) * Math.PI * 2;
        let found = null;
        for (let d = start; d <= Math.min(R, C.raids.maxDist) && !found; d++) {
          const n = 8 * d, off = Math.floor(a1 / (Math.PI * 2) * n);
          for (let k = 0; k < n && !found; k++) {
            const { sx, sy } = ringPos(d, (k + off) % n);
            const key = sx + ',' + sy;
            if (!taken.has(key) && !this.nearKey(sx, sy) && this.themeOf(sx, sy) === theme) found = { sx, sy };
          }
        }
        if (found) { this.raidSectors[theme] = { ...found, boss: NX.RAIDS[theme].boss }; taken.add(found.sx + ',' + found.sy); }
      }
    },

    nearKey(sx, sy) {
      for (const id of NX.KEY_ORDER) { const k = this.keySectors[id]; if (Math.abs(k.sx - sx) <= 1 && Math.abs(k.sy - sy) <= 1) return true; }
      return false;
    },
    raidAt(sx, sy) {
      for (const th of Object.keys(this.raidSectors)) { const r = this.raidSectors[th]; if (r.sx === sx && r.sy === sy) return th; }
      return null;
    },

    inBounds(sx, sy) { return Math.abs(sx) <= R && Math.abs(sy) <= R; },
    sectorOfTile(t) { return Math.floor(t / S); },
    dist(sx, sy) { return Math.max(Math.abs(sx), Math.abs(sy)); },

    keyAt(sx, sy) {
      for (const id of NX.KEY_ORDER) { const k = this.keySectors[id]; if (k.sx === sx && k.sy === sy) return id; }
      return null;
    },

    themeOf(sx, sy) {
      const key = sx + ',' + sy;
      let th = this.themeMemo.get(key);
      if (th) return th;
      if (sx === 0 && sy === 0) th = 'hub';
      else {
        for (const id of NX.KEY_ORDER) {
          const k = this.keySectors[id];
          if (Math.abs(k.sx - sx) <= 1 && Math.abs(k.sy - sy) <= 1) th = NX.KEYS[id].theme;
        }
        if (!th) {
          const rc = C.world.regionCells, cx = Math.floor(sx / rc), cy = Math.floor(sy / rc);
          let best = Infinity;
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
            const gx = cx + i, gy = cy + j;
            const px = (gx + NX.h01(gx, gy, 1)) * rc, py = (gy + NX.h01(gx, gy, 2)) * rc;
            const d = (px - sx - 0.5) ** 2 + (py - sy - 0.5) ** 2;
            if (d < best) { best = d; th = NX.THEME_LIST[NX.hash(gx, gy, 3) % NX.THEME_LIST.length]; }
          }
        }
      }
      this.themeMemo.set(key, th);
      return th;
    },

    gatePos(sx, sy) { return sx === 0 && sy === 0 ? { lx: HALF, ly: HALF + 6 } : { lx: HALF, ly: HALF }; },
    gateWorld(sx, sy) {
      const g = this.gatePos(sx, sy);
      return { x: (sx * S + g.lx + 0.5) * this.TS, y: (sy * S + g.ly + 0.5) * this.TS };
    },

    sector(sx, sy) {
      const key = sx + ',' + sy;
      let sec = this.cache.get(key);
      if (sec) return sec;
      sec = generate(sx, sy);
      const m = this.mods.get(key);
      if (m) for (const [i, v] of m) sec.tiles[i] = v;
      if (this.cache.size > 80) {
        // drop the oldest cached sector (Map keeps insertion order)
        const first = this.cache.keys().next().value;
        this.cache.delete(first);
        if (this._last && this._last.key === first) this._last = null;
      }
      sec.key = key;
      this.cache.set(key, sec);
      return sec;
    },

    tile(tx, ty) {
      const sx = Math.floor(tx / S), sy = Math.floor(ty / S);
      if (sx < -R || sx > R || sy < -R || sy > R) return T.VOID;
      let sec = this._last;
      if (!sec || sec.sx !== sx || sec.sy !== sy) { sec = this.sector(sx, sy); this._last = sec; }
      return sec.tiles[(ty - sy * S) * S + (tx - sx * S)];
    },

    setTile(tx, ty, v) {
      const sx = Math.floor(tx / S), sy = Math.floor(ty / S);
      if (!this.inBounds(sx, sy)) return;
      const key = sx + ',' + sy, i = (ty - sy * S) * S + (tx - sx * S);
      const sec = this.sector(sx, sy), old = sec.tiles[i];
      sec.tiles[i] = v;
      if (NX.R3D && NX.R3D.ok) NX.R3D.tileChanged(tx, ty, old, v);
      if (!this.mods.has(key)) this.mods.set(key, new Map());
      this.mods.get(key).set(i, v);
    },

    themeAtTile(tx, ty) { return this.themeOf(Math.floor(tx / S), Math.floor(ty / S)); },
    solidTile(tx, ty) { return NX.SOLID.has(this.tile(tx, ty)); },
    solidAt(x, y) { return this.solidTile(Math.floor(x / this.TS), Math.floor(y / this.TS)); },
    stopsShotAt(x, y) { return NX.STOPS_SHOTS.has(this.tile(Math.floor(x / this.TS), Math.floor(y / this.TS))); },

    // Circle vs solid tiles.
    blocked(x, y, r, ignoreWater) {
      const TS = this.TS;
      const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS);
      const y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const t = this.tile(tx, ty);
        if (!NX.SOLID.has(t) || (ignoreWater && t === T.WATER)) continue;
        const cx = NX.clamp(x, tx * TS, tx * TS + TS), cy = NX.clamp(y, ty * TS, ty * TS + TS);
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
      }
      return false;
    },

    // Find a walkable tile near (tx,ty) — used for spawns and warps.
    findOpen(tx, ty, maxR = 6) {
      for (let r = 0; r <= maxR; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        if (!this.solidTile(tx + i, ty + j)) return { tx: tx + i, ty: ty + j };
      }
      return { tx, ty };
    },

    exportMods() {
      const out = {};
      let n = 0;
      for (const [k, m] of this.mods) { out[k] = [...m]; n += m.size; if (n > 20000) break; }
      return out;
    },
    importMods(obj) {
      this.mods.clear();
      for (const k of Object.keys(obj || {})) this.mods.set(k, new Map(obj[k]));
    },
  };

  // k-th sector (0..8d-1) walking clockwise around the square ring at Chebyshev distance d.
  function ringPos(d, k) {
    const side = 2 * d, s = Math.floor(k / side), o = k % side;
    if (s === 0) return { sx: -d + o, sy: -d };
    if (s === 1) return { sx: d, sy: -d + o };
    if (s === 2) return { sx: d - o, sy: d };
    return { sx: -d, sy: d - o };
  }

  // ---------- Generators ----------
  function generate(sx, sy) {
    const theme = World.themeOf(sx, sy), th = NX.THEMES[theme];
    const tiles = new Uint8Array(S * S);
    const rnd = NX.rng(NX.hash(sx, sy, 99));
    const ox = sx * S, oy = sy * S;
    const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < S && y < S) tiles[y * S + x] = v; };
    const get = (x, y) => tiles[y * S + x];

    if (th.gen === 'maze') genMaze(tiles, put, rnd);
    else if (th.gen === 'city') genCity(put, rnd, sx, sy);
    else if (th.gen === 'grid') genGrid(put, rnd);
    else if (th.gen === 'hub') genHub(put);
    else genNatural(th, put, rnd, ox, oy);

    // Roads: a 3-wide cross through every sector meets the neighbours' crosses,
    // so the whole multiverse is always connected.
    if (th.gen !== 'hub') {
      for (let i = 0; i < S; i++) for (let w = -1; w <= 1; w++) {
        if (get(i, HALF + w) !== T.PELLET) put(i, HALF + w, T.ROAD);
        if (get(HALF + w, i) !== T.PELLET) put(HALF + w, i, T.ROAD);
      }
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) put(HALF + i, HALF + j, T.ROAD);
      // Key and raid sectors get a clear boss arena.
      if (World.keyAt(sx, sy) || World.raidAt(sx, sy)) {
        for (let j = -11; j <= 11; j++) for (let i = -11; i <= 11; i++) {
          if (i * i + j * j <= 121) put(HALF + i, HALF + j, (i * i + j * j > 100) ? T.DECOR : T.FLOOR);
        }
      }
    }
    const g = World.gatePos(sx, sy);
    put(g.lx, g.ly, T.GATE);
    return { sx, sy, theme, tiles };
  }

  function genNatural(th, put, rnd, ox, oy) {
    const sc = th.scale || 0.1;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const gx = ox + x, gy = oy + y;
      const n = NX.fbm(gx * sc, gy * sc, 11);
      let v = T.FLOOR;
      if (th.water && NX.fbm(gx * 0.07, gy * 0.07, 51) > th.water) v = T.WATER;
      else if (n > th.wallAt) v = T.WALL;
      else if (th.breakAt && n > th.breakAt && rnd() < 0.45) v = T.BREAK;
      else if (th.grass && NX.noise(gx * 0.15, gy * 0.15, 81) > th.grass) v = T.GRASS;
      else if (th.qblocks && rnd() < th.qblocks) v = T.QBLOCK;
      else if (th.prop && rnd() < (th.propChance || 0)) v = T.PROP;
      else if (th.decor && rnd() < (th.decorChance || 0)) v = T.DECOR;
      put(x, y, v);
    }
  }

  function genMaze(tiles, put, rnd) {
    tiles.fill(T.WALL);
    const N = Math.floor(S / 3);
    const carve = (cx, cy) => { for (let j = 1; j <= 2; j++) for (let i = 1; i <= 2; i++) put(cx * 3 + i, cy * 3 + j, T.PELLET); };
    const seen = new Uint8Array(N * N);
    const stack = [[0, 0]];
    seen[0] = 1; carve(0, 0);
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
        const nx = cx + dx, ny = cy + dy;
        return nx >= 0 && ny >= 0 && nx < N && ny < N && !seen[ny * N + nx];
      });
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy] = opts[Math.floor(rnd() * opts.length)];
      const nx = cx + dx, ny = cy + dy;
      seen[ny * N + nx] = 1; carve(nx, ny);
      knock(put, cx, cy, nx, ny);
      stack.push([nx, ny]);
    }
    // Extra openings so the maze has loops, Pac-Man style.
    for (let k = 0; k < N * N * 0.18; k++) {
      const cx = Math.floor(rnd() * (N - 1)), cy = Math.floor(rnd() * (N - 1));
      if (rnd() < 0.5) knock(put, cx, cy, cx + 1, cy); else knock(put, cx, cy, cx, cy + 1);
    }
    for (const [x, y] of [[1, 1], [S - 3, 1], [1, S - 3], [S - 3, S - 3]]) put(x, y, T.POWER);
  }
  function knock(put, ax, ay, bx, by) {
    if (bx !== ax) { const x = Math.max(ax, bx) * 3; for (let j = 1; j <= 2; j++) put(x, ay * 3 + j, T.PELLET); }
    else { const y = Math.max(ay, by) * 3; for (let i = 1; i <= 2; i++) put(ax * 3 + i, y, T.PELLET); }
  }

  function genCity(put, rnd, sx, sy) {
    const B = 8;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const street = x % B < 2 || y % B < 2;
      if (street) { put(x, y, (x % B === 0 && y % 4 === 0 && rnd() < 0.5) ? T.PROP : T.FLOOR); continue; }
      const bx = Math.floor(x / B), by = Math.floor(y / B);
      const park = NX.h01(sx * 10 + bx, sy * 10 + by, 5) < 0.22;
      put(x, y, park ? (rnd() < 0.08 ? T.DECOR : T.FLOOR) : T.WALL);
    }
  }

  function genGrid(put, rnd) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(x, y, T.FLOOR);
    for (let k = 0; k < 2; k++) {
      for (let line = 3; line < S; line += 6) {
        let i = 0;
        while (i < S) {
          const len = 3 + Math.floor(rnd() * 6), gap = 2 + Math.floor(rnd() * 4);
          for (let j = 0; j < len && i + j < S; j++) k ? put(line, i + j, T.WALL) : put(i + j, line, T.WALL);
          i += len + gap;
        }
      }
    }
    for (let n = 0; n < 30; n++) put(Math.floor(rnd() * S), Math.floor(rnd() * S), T.DECOR);
  }

  function genHub(put) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
      const opening = Math.abs(x - HALF) <= 1 || Math.abs(y - HALF) <= 1;
      const ring = Math.hypot(x - HALF + 0.5, y - HALF + 0.5);
      let v = T.FLOOR;
      if (edge && !opening) v = T.WALL;
      else if (opening) v = T.ROAD;
      else if (ring > 9 && ring < 10.2) v = T.DECOR;
      put(x, y, v);
    }
    put(HALF, HALF, T.ALTAR);
    for (const [x, y] of [[14, 14], [33, 14], [14, 33], [33, 33], [HALF - 6, 8], [HALF + 6, 8]]) put(x, y, T.PROP);
  }
})();
