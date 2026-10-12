// The multiverse: a (2r+1)×(2r+1) grid of sectors, each S×S tiles, generated lazily
// from the seed. Fandom regions are Voronoi cells; the campaign sites (docs/CAMPAIGN.md §5)
// — 9 cabinets, 3 keys, 3 gates, Anorak's Castle and its 3 shield pylons — are pinned.
(() => {
  'use strict';
  const NX = window.NX, C = NX.C, T = NX.T, CC = C.campaign;
  const S = C.world.sectorTiles, R = C.world.radius, HALF = S >> 1, DEG = Math.PI / 180;
  // Ring radii (tiles from the sector centre). Guardian/castle boss triggers live in game.js at 13 tiles.
  const TRIGGER = 13, MOAT = [13, 13 + CC.moatWidth], WALL = CC.castleWall, FORCE = [CC.forceRadius, CC.forceRadius + CC.forceThickness];
  const LAND = S - 2;         // jade key / castle warp landing row: on the south road, outside every ring
  const cheb = (a, b) => Math.max(Math.abs(a.sx - b.sx), Math.abs(a.sy - b.sy));
  // Chebyshev ring projection of a bearing θ at distance d.
  const at = (a, d) => {
    const c = Math.cos(a), s = Math.sin(a), m = Math.max(Math.abs(c), Math.abs(s));
    return { sx: Math.round(c / m * d), sy: Math.round(s / m * d) };
  };
  const clueTheme = (act, i) => (NX.CAMPAIGN && NX.CAMPAIGN.acts && NX.CAMPAIGN.acts[act] && NX.CAMPAIGN.acts[act].clueThemes[i]) || null;

  const World = NX.World = {
    S, R, TS: C.world.tile,
    cache: new Map(),         // "sx,sy" -> { sx, sy, theme, tiles }
    mods: new Map(),          // "sx,sy" -> Map(localIndex -> tile)  (mined walls, broken blocks, eaten pellets)
    themeMemo: new Map(),
    quest: null,              // { copper|jade|crystal: { clues: [{sx,sy}×3], key, gate }, castle: { sx, sy, generators: [{sx,sy}×3] } }
    sites: [],                // [{ type: 'clue'|'key'|'gate'|'castle'|'generator', act, index, sx, sy }] — 19 of them
    siteMap: new Map(),       // "sx,sy" -> site
    keySectors: {},           // keyId -> { sx, sy } (=== quest[act].key)
    raidSectors: {},          // themeId -> { sx, sy, boss }
    forceDown: false,         // derived from G.quest.generators by Game.start; generate() writes FORCE only while false
    _last: null,

    init() {
      this.cache.clear(); this.themeMemo.clear(); this._last = null; this.forceDown = false;
      this.placeSites();
      this.themeMemo.clear();
      // Each fandom's raid boss lives on a ring somewhere in that fandom's territory, clear of every campaign site.
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
            if (!taken.has(key) && !this.nearSite(sx, sy) && this.themeOf(sx, sy) === theme) found = { sx, sy };
          }
        }
        if (found) { this.raidSectors[theme] = { ...found, boss: NX.RAIDS[theme].boss }; taken.add(found.sx + ',' + found.sy); }
      }
      this.checkInvariants();
    },

    // §5.1 — keys, cabinets, gates, castle, then pylons. Runs before any themeOf call (themeOf memoizes).
    placeSites() {
      this.sites = []; this.siteMap.clear(); this.keySectors = {};
      const a0 = NX.h01(7, 7, 7) * Math.PI * 2, q = {};
      const steps = (r) => Math.round((r[1] - r[0]) / 5) + 1;          // 5° steps across a [lo, hi] bearing range
      const nb = steps(CC.clueBearing), ng = steps(CC.gateBearing);
      // Keys first: naturalTheme (key ±1 → Voronoi) must see all three before cabinets read it.
      NX.KEY_ORDER.forEach((act) => { q[act] = { clues: [], key: at(a0 + NX.KEYS[act].angle, CC.keyDist[act]), gate: null }; this.keySectors[act] = q[act].key; });
      NX.KEY_ORDER.forEach((act, ai) => {
        const th = a0 + NX.KEYS[act].angle;
        CC.clueDist[act].forEach((d, i) => {
          const want = clueTheme(act, i), sg = i % 2 ? -1 : 1, h = NX.hash(ai, i, 61) % nb;
          let pos = null;
          for (let k = 0; k < nb && !pos; k++) {
            const p = at(th + sg * (CC.clueBearing[0] + ((h + k) % nb) * 5) * DEG, d);
            let ok = true;
            for (let j = -1; j <= 1 && ok; j++) for (let n = -1; n <= 1 && ok; n++) if (this.naturalTheme(p.sx + n, p.sy + j) === want) ok = false;
            if (ok) pos = p;
          }
          q[act].clues.push(pos || at(th + sg * (CC.clueBearing[0] + h * 5) * DEG, d));
        });
        // Clue 2 sits at θ + b, so the gate goes to the other side: θ − g.
        q[act].gate = at(th - (CC.gateBearing[0] + (NX.hash(ai, 67) % ng) * 5) * DEG, CC.gateDist[act]);
      });
      console.assert(CC.castleDist <= R - 2, 'castleDist must be ≤ world.radius − 2');
      q.castle = { ...at(a0 + NX.KEYS.crystal.angle, CC.castleDist), generators: [] };
      // Nudge collisions in priority order (keys, castle, gates, cabinets) so key regions stay put.
      const placed = [];
      const fits = (p) => !(p.sx === 0 && p.sy === 0) && this.inBounds(p.sx, p.sy) && placed.every((o) => cheb(o, p) >= 2);
      const nudge = (p) => {
        if (!fits(p)) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            if (fits({ sx: p.sx + dx, sy: p.sy + dy })) { p.sx += dx; p.sy += dy; break; }
          }
        }
        placed.push(p);
      };
      NX.KEY_ORDER.forEach((act) => nudge(q[act].key));
      nudge(q.castle);
      NX.KEY_ORDER.forEach((act) => nudge(q[act].gate));
      NX.KEY_ORDER.forEach((act) => q[act].clues.forEach(nudge));
      // Pylons: genOffsets rotated by a hashed start; keep the first 3 that fit (in bounds, ≤ R−1, ≥ 2 from every site).
      const offs = CC.genOffsets, o0 = NX.hash(5, 4, 3) % offs.length;
      for (let k = 0; k < offs.length && q.castle.generators.length < 3; k++) {
        const [dx, dy] = offs[(o0 + k) % offs.length], p = { sx: q.castle.sx + dx, sy: q.castle.sy + dy };
        if (this.dist(p.sx, p.sy) <= R - 1 && fits(p)) { q.castle.generators.push(p); placed.push(p); }
      }
      // Fallback (other seeds/radii): widen to the 2..4 rings around the castle.
      for (let d = 2; d <= 4 && q.castle.generators.length < 3; d++) {
        for (let k = 0; k < 8 * d && q.castle.generators.length < 3; k++) {
          const r = ringPos(d, k), p = { sx: q.castle.sx + r.sx, sy: q.castle.sy + r.sy };
          if (this.dist(p.sx, p.sy) <= R - 1 && fits(p)) { q.castle.generators.push(p); placed.push(p); }
        }
      }
      this.quest = q;
      const add = (type, act, index, p) => { const s = { type, act, index, sx: p.sx, sy: p.sy }; this.sites.push(s); this.siteMap.set(p.sx + ',' + p.sy, s); };
      for (const act of NX.KEY_ORDER) {
        q[act].clues.forEach((p, i) => add('clue', act, i, p));
        add('key', act, null, q[act].key);
        add('gate', act, null, q[act].gate);
      }
      add('castle', null, null, q.castle);
      q.castle.generators.forEach((p, i) => add('generator', null, i, p));
    },

    checkInvariants() {
      const q = this.quest, A = console.assert;
      for (const act of NX.KEY_ORDER) {
        A(CC.clueDist[act].every((d) => d < CC.gateDist[act]) && CC.gateDist[act] < CC.keyDist[act], 'clueDist < gateDist < keyDist: ' + act);
      }
      A(this.sites.length === 19 && q.castle.generators.length === 3, 'expected 19 campaign sites (3 pylons), got ' + this.sites.length);
      A(this.siteMap.size === this.sites.length, 'two campaign sites share a sector');
      for (const s of this.sites) A(this.inBounds(s.sx, s.sy) && !(s.sx === 0 && s.sy === 0), 'site out of bounds or on the hub', s);
      for (let i = 0; i < this.sites.length; i++) for (let j = i + 1; j < this.sites.length; j++) {
        A(cheb(this.sites[i], this.sites[j]) >= 2, 'campaign sites closer than 2 sectors', this.sites[i], this.sites[j]);
      }
      A(Object.keys(this.raidSectors).length === Object.keys(NX.RAIDS).length, 'expected ' + Object.keys(NX.RAIDS).length + ' raids, placed ' + Object.keys(this.raidSectors).length);
      // §5.4 ring invariants
      A(TRIGGER <= MOAT[0], 'guardian trigger must sit inside the moat');
      A(TRIGGER < WALL[0] && WALL[0] < WALL[1] && WALL[1] <= FORCE[0], 'castle trigger < wall < forcefield');
      A(FORCE[1] <= HALF - 3, 'forcefield must fit inside the sector');
      A(LAND - HALF >= FORCE[1] && LAND - HALF >= MOAT[1], 'warp landing must sit outside the rings');
    },

    siteAt(sx, sy) { return this.siteMap.get(sx + ',' + sy) || null; },
    // Chebyshev ≤ 1 of any campaign site (pylons and castle included).
    nearSite(sx, sy) {
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (this.siteMap.has((sx + i) + ',' + (sy + j))) return true;
      return false;
    },
    nearKey(sx, sy) { return this.nearSite(sx, sy); },   // legacy alias

    // Natural theme: key ±1 override → Voronoi. Ignores the cabinet and castle overrides (map shows the castle as this until revealed).
    naturalTheme(sx, sy) {
      if (sx === 0 && sy === 0) return 'hub';
      let th = null;
      for (const id of NX.KEY_ORDER) {
        const k = this.keySectors[id];
        if (k && Math.abs(k.sx - sx) <= 1 && Math.abs(k.sy - sy) <= 1) th = NX.KEYS[id].theme;
      }
      if (th) return th;
      const rc = C.world.regionCells, cx = Math.floor(sx / rc), cy = Math.floor(sy / rc);
      let best = Infinity;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const gx = cx + i, gy = cy + j;
        const px = (gx + NX.h01(gx, gy, 1)) * rc, py = (gy + NX.h01(gx, gy, 2)) * rc;
        const d = (px - sx - 0.5) ** 2 + (py - sy - 0.5) ** 2;
        if (d < best) { best = d; th = NX.THEME_LIST[NX.hash(gx, gy, 3) % NX.THEME_LIST.length]; }
      }
      return th;
    },

    // Shield down: rebuild the castle sector without the FORCE ring. Derived state — writes no mods.
    dropForcefield() {
      this.forceDown = true;
      const c = this.quest && this.quest.castle;
      if (!c) return;
      const key = c.sx + ',' + c.sy;
      this.cache.delete(key);
      if (this._last && this._last.key === key) this._last = null;
      if (NX.R3D && NX.R3D.ok && NX.R3D.refreshSector) NX.R3D.refreshSector(c.sx, c.sy);
    },

    // Warp landing (world px, tile centre). Jade key + castle: the south road outside the moat/forcefield;
    // everywhere else just below the sector gate, as before.
    landingPos(sx, sy) {
      const s = this.siteAt(sx, sy);
      let tx, ty;
      if (s && (s.type === 'castle' || (s.type === 'key' && s.act === 'jade'))) { tx = sx * S + HALF; ty = sy * S + LAND; }
      else { const g = this.gatePos(sx, sy); tx = sx * S + g.lx; ty = sy * S + g.ly + 2; }
      const o = this.findOpen(tx, ty);
      return { x: (o.tx + 0.5) * this.TS, y: (o.ty + 0.5) * this.TS };
    },

    raidAt(sx, sy) {
      for (const th of Object.keys(this.raidSectors)) { const r = this.raidSectors[th]; if (r.sx === sx && r.sy === sy) return th; }
      return null;
    },

    inBounds(sx, sy) { return Math.abs(sx) <= R && Math.abs(sy) <= R; },
    sectorOfTile(t) { return Math.floor(t / S); },
    dist(sx, sy) { return Math.max(Math.abs(sx), Math.abs(sy)); },

    keyAt(sx, sy) {
      const s = this.siteMap.get(sx + ',' + sy);
      return s && s.type === 'key' ? s.act : null;
    },

    // Priority: hub → castle → cabinet (that one sector) → key ±1 → Voronoi. Gates and pylons keep their natural theme.
    themeOf(sx, sy) {
      const key = sx + ',' + sy;
      let th = this.themeMemo.get(key);
      if (th) return th;
      const s = this.siteMap.get(key);
      if (sx === 0 && sy === 0) th = 'hub';
      else if (s && s.type === 'castle') th = 'castle';
      else th = (s && s.type === 'clue' && clueTheme(s.act, s.index)) || this.naturalTheme(sx, sy);
      this.themeMemo.set(key, th);
      return th;
    },

    gatePos(sx, sy) {
      const c = this.quest && this.quest.castle;
      return (sx === 0 && sy === 0) || (c && c.sx === sx && c.sy === sy) ? { lx: HALF, ly: HALF + 6 } : { lx: HALF, ly: HALF };
    },
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
    else if (th.gen === 'castle') genCastle(put, rnd);
    else genNatural(th, put, rnd, ox, oy);

    // Roads: a 3-wide cross through every sector meets the neighbours' crosses,
    // so the whole multiverse is always connected.
    if (th.gen !== 'hub') {
      for (let i = 0; i < S; i++) for (let w = -1; w <= 1; w++) {
        if (get(i, HALF + w) !== T.PELLET) put(i, HALF + w, T.ROAD);
        if (get(HALF + w, i) !== T.PELLET) put(HALF + w, i, T.ROAD);
      }
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) put(HALF + i, HALF + j, T.ROAD);
      // Raid sectors get a clear boss arena.
      if (World.raidAt(sx, sy)) keyArena(put);
      // Campaign site overlays go over every tile type (pellets, roads, walls…), after the roads.
      const site = World.siteAt(sx, sy);
      if (site) siteOverlay(site, put);
    }
    const g = World.gatePos(sx, sy);
    if (get(g.lx, g.ly) !== T.ALTAR) put(g.lx, g.ly, T.GATE);
    return { sx, sy, theme, tiles };
  }

  // Rings are measured with d = hypot(i, j) from the centre tile (HALF, HALF).
  const ring = (put, r1, fn) => {
    for (let j = -r1; j <= r1; j++) for (let i = -r1; i <= r1; i++) { const v = fn(Math.hypot(i, j), i, j); if (v != null) put(HALF + i, HALF + j, v); }
  };
  // The classic boss arena (r 11) for key guardians and raid bosses.
  const keyArena = (put, r = 11) => ring(put, r, (d, i, j) => i * i + j * j <= r * r ? (i * i + j * j > (r - 1) * (r - 1) ? T.DECOR : T.FLOOR) : null);
  // Floor disc of radius r with a one-tile decor rim.
  const pad = (put, r) => ring(put, r, (d) => d < r ? T.FLOOR : d < r + 1 ? T.DECOR : null);

  function siteOverlay(site, put) {
    const A = CC.arena;
    if (site.type === 'clue') pad(put, A.clue);
    else if (site.type === 'generator') pad(put, A.generator);
    else if (site.type === 'gate') {
      pad(put, A.gate);
      for (let k = 0; k < 8; k++) put(HALF + Math.round(Math.cos(k * Math.PI / 4) * A.gate), HALF + Math.round(Math.sin(k * Math.PI / 4) * A.gate), T.PROP);
    } else if (site.type === 'key') {
      keyArena(put, A.key);
      // Jade: an island ringed by a data-moat (Nimbus 2000 / Elytra / Portal Gun to cross).
      if (site.act === 'jade') ring(put, MOAT[1], (d) => d >= MOAT[0] && d < MOAT[1] ? T.WATER : null);
    } else if (site.type === 'castle') {
      ring(put, Math.max(FORCE[1], A.castle) + 1, (d, i, j) => {
        if (d < A.castle) return T.FLOOR;
        // Obsidian wall, open only where the south road passes; east/west/north road tiles become wall.
        if (d >= WALL[0] && d < WALL[1]) return Math.abs(i) <= 1 && j > 0 ? T.ROAD : T.WALL;
        if (d >= FORCE[0] && d < FORCE[1] && !World.forceDown) return T.FORCE;
        return null;
      });
      put(HALF, HALF, T.ALTAR);
    }
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

  // Anorak's Castle: obsidian floor with a few statues; walls, altar and forcefield come from siteOverlay.
  function genCastle(put, rnd) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(x, y, rnd() < 0.008 ? T.PROP : T.FLOOR);
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
