// GAME — simulation: player, weapons, enemies, bosses, pets, loot, events, saving.
(() => {
  'use strict';
  const NX = window.NX, C = NX.C, T = NX.T, W = NX.World, Art = NX.Art, Sound = NX.Sound, Input = NX.Input;
  const TS = C.world.tile, S = C.world.sectorTiles, HALF = S >> 1;
  const { clamp, rand, randi, pick, dist, angleTo, angleDiff } = NX;
  const tel = () => window.Telemetry;

  // ---------- State ----------
  let G = null;                 // saved progress
  const P = { x: 0, y: 0, r: 11 };  // player runtime
  let ents = [], shots = [], fx = [], haz = [];
  const active = new Set();
  const cam = { x: 0, y: 0, shake: 0 };
  let nid = 1, time = 0, curSx = 99999, curSy = 99999, curTheme = null;
  let streak = 0, lastKillT = -9, combo = 0, comboT = 0, nextEventAt = 0, saveT = 0, rivalT = 0, respawnT = 0;
  const bosses = {};            // arenaKey -> entity
  let beamFx = null, bigBeam = null, dead = 0, victory = 0;
  // Campaign "The Three Gates" (docs/CAMPAIGN.md). Runtime only, never saved: the active trial,
  // guardian keys dropped but not yet picked up, one-shot hints.
  const CC = C.campaign, CAMP = NX.CAMPAIGN, STAGES = CAMP.stages, ACTS = NX.KEY_ORDER;
  let trial = null, trialSeq = 0, castleIntroShown = false;
  const keyDrops = {}, hinted = new Set();

  const Game = NX.Game = {
    get G() { return G; }, P, get ents() { return ents; }, get time() { return time; }, cam,
    get dead() { return dead; }, get victory() { return victory; }, get combo() { return comboT > 0 ? combo : 0; },
    bossList: () => Object.values(bosses).filter((b) => b && !b.dead),
    get shots() { return shots; }, get haz() { return haz; }, get fx() { return fx; },
    beams: () => ({ beam: beamFx, big: bigBeam }),
    activeSectors: () => [...active],
  };
  // Screen <-> world helpers that work for both the 3D renderer and the 2D fallback.
  Game.screenToWorld = (mx, my) => (NX.R3D && NX.R3D.ok ? NX.R3D.screenToWorld(mx, my) : { x: cam.x - NX.view.W / 2 + mx, y: cam.y - NX.view.H / 2 + my });
  Game.screenOf = (x, y, h = 0) => (NX.R3D && NX.R3D.ok ? NX.R3D.project(x, y, h) : { x: x - (Game.view ? Game.view.ox : 0), y: y - (Game.view ? Game.view.oy : 0) - h * 20, visible: true });

  // ---------- Derived stats ----------
  const maxHp = () => C.player.maxHp + (G.level - 1) * C.player.hpPerLevel + G.bonusHp + (G.relics.cake ? 4 : 0);
  const xpNeed = (lvl) => Math.floor(C.player.xpBase * Math.pow(lvl, C.player.xpPow));
  const dmgMult = () => 1 + (G.level - 1) * C.player.dmgPerLevel;
  const isHub = (x, y) => Math.floor(x / TS / S) === 0 && Math.floor(y / TS / S) === 0;
  const sectorOf = (x, y) => ({ sx: Math.floor(x / TS / S), sy: Math.floor(y / TS / S) });
  const skey = (sx, sy) => sx + ',' + sy;
  const tileAt = (sx, sy, lx, ly) => ({ x: (sx * S + lx + 0.5) * TS, y: (sy * S + ly + 0.5) * TS });   // world px of a local tile
  const centreOf = (sx, sy) => tileAt(sx, sy, HALF, HALF);
  const cheb = (a, b) => Math.max(Math.abs(a.sx - b.sx), Math.abs(a.sy - b.sy));
  const owns = (id) => G.weapons.includes(id) || G.mounts.includes(id) || !!G.relics[id];
  const lifeCap = () => C.economy.maxExtraLives + (G.relics.amber ? 2 : 0);
  Game.maxHp = () => maxHp(); Game.xpNeed = () => xpNeed(G.level); Game.isHub = isHub; Game.extraLifeCap = () => lifeCap();

  // ---------- Movement & collision ----------
  function moveCircle(e, dx, dy, mode) {
    // mode: 'walk' | 'fly' (ignores water) | 'ghost' (ignores everything but the void and the IOI forcefield)
    // FORCE is in NX.SOLID, so W.blocked already stops it for walk and fly.
    const r = Math.min(e.r, 14) * 0.85;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
    const sx = dx / steps, sy = dy / steps;
    let hx = false, hy = false;
    const blocked = (x, y) => {
      if (mode !== 'ghost') return W.blocked(x, y, r, mode === 'fly');
      const t = W.tile(Math.floor(x / TS), Math.floor(y / TS));
      return t === T.VOID || t === T.FORCE;
    };
    for (let i = 0; i < steps; i++) {
      if (sx && !hx) { if (blocked(e.x + sx, e.y)) hx = true; else e.x += sx; }
      if (sy && !hy) { if (blocked(e.x, e.y + sy)) hy = true; else e.y += sy; }
    }
    return { hx, hy };
  }
  function los(a, b) {
    const d = dist(a, b), n = Math.ceil(d / 14);
    for (let i = 1; i < n; i++) {
      const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
      if (W.stopsShotAt(x, y)) return false;
    }
    return true;
  }
  function openSpot(x, y, minR, maxR, tries = 20) {
    for (let i = 0; i < tries; i++) {
      const a = Math.random() * Math.PI * 2, r = rand(minR, maxR);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (!W.blocked(px, py, 12)) return { x: px, y: py };
    }
    return null;
  }

  // ---------- FX helpers ----------
  function text(x, y, str, color = '#fff', size = 14, life = 0.9) { fx.push({ type: 'text', x, y, str, color, size, life, max: life, vy: -40 }); }
  function burst(x, y, color, n = 14, speed = 160, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rand(30, speed), life = rand(0.3, 0.8);
      fx.push({ type: 'part', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: rand(size * 0.5, size * 1.4) });
    }
  }
  function ring(x, y, r, color, life = 0.45, w = 3) { fx.push({ type: 'ring', x, y, r, color, life, max: life, w }); }
  const shake = (n) => { cam.shake = Math.max(cam.shake, n); };
  Game.text = text;

  // ---------- New game / load / save ----------
  Game.newGame = (name, color) => {
    const gate = W.gateWorld(0, 0);
    G = {
      v: 2, name: name || 'Gunter', color: color || '#4a9cff',
      x: gate.x, y: gate.y + TS * 1.5,
      hp: C.player.maxHp, level: 1, xp: 0, bonusHp: 0, coins: C.economy.startCoins, score: 0,
      weapons: ['pixelsword'], weapon: 'pixelsword',
      items: { pokeballs: 3, grenades: 1, extralife: 0, masterballs: 0 },
      mounts: [], mount: null, relics: {},
      keys: {}, egg: false, eggRank: null, quest: defaultQuest(),
      raids: {}, revealed: {}, discovered: ['0,0'], opened: [], mods: {}, pets: [],
      playTime: 0, sessionId: null, rivals: {}, lastPromptAt: -999, regenAt: -9999, walkmanAt: -9999, snapAt: -9999,
      kills: 0, deaths: 0, bestStreak: 0, intro: false,
    };
    G.sessionId = tel().begin({ avatar: G.name });
    start();
  };

  // v2 = the Three Gates campaign. v1 saves (the old 3-key hunt) migrate: keep level, gear, relics,
  // raids and pets; restart the quest at the hub; drop tile mods around the new campaign sites.
  Game.load = () => {
    const s = NX.store.get('nx_save', null);
    if (!s || (s.v !== 1 && s.v !== 2)) return false;
    const migrated = s.v === 1;
    if (migrated) {
      W.init();   // World.quest must exist to know which sectors changed
      s.quest = defaultQuest(); s.keys = {}; s.egg = false; s.eggRank = null; s.rivals = {};
      delete s.eggAt; delete s.clues;
      const g = W.gateWorld(0, 0);
      s.x = g.x; s.y = g.y + TS * 1.5;
      const mods = {};
      for (const k of Object.keys(s.mods || {})) { const [sx, sy] = k.split(',').map(Number); if (!W.nearSite(sx, sy)) mods[k] = s.mods[k]; }
      s.mods = mods;
      s.v = 2;
    }
    sanitizeQuest(s);
    G = s;
    if (!tel().resume(G.sessionId)) G.sessionId = tel().begin({ avatar: G.name, resumed: true });
    start();
    if (migrated) { Game.save(); NX.UI.toast('Campaign updated — the Curator has new riddles', '#ffd23f', 6); }
    return true;
  };
  // Guard v2 loads: unknown stage -> intro, missing fields -> defaults.
  function sanitizeQuest(s) {
    const q = s.quest && typeof s.quest === 'object' ? s.quest : {};
    s.quest = Object.assign(defaultQuest(), q);
    if (!STAGES.includes(s.quest.stage)) s.quest.stage = 'intro';
    const g = Array.isArray(s.quest.generators) ? s.quest.generators : [];
    s.quest.generators = [0, 1, 2].map((i) => !!g[i]);
    if (!s.quest.ms || typeof s.quest.ms !== 'object') s.quest.ms = {};
    s.quest.castle = !!s.quest.castle; s.quest.outro = !!s.quest.outro; s.quest.first = !!s.quest.first;
    s.keys = s.keys || {}; s.rivals = s.rivals || {};
  }
  Game.hasSave = () => !!NX.store.get('nx_save', null);
  Game.wipe = () => NX.store.del('nx_save');

  Game.save = () => {
    if (!G) return;
    G.x = P.x; G.y = P.y; G.mount = P.mount || null;
    G.mods = W.exportMods();
    G.discovered = [...discovered];
    G.opened = [...opened];
    NX.store.set('nx_save', G);
    const t = tel();
    t.set('playTimeSec', Math.round(G.playTime)); t.set('level', G.level); t.set('keys', Object.keys(G.keys).length);
    t.set('stage', G.quest.stage); t.set('stageIdx', stageIdx(G.quest.stage));
    t.set('egg', G.egg); t.set('relics', Object.keys(G.relics)); t.set('weapons', G.weapons.slice()); t.set('mounts', G.mounts.slice());
    t.set('raidsDefeated', Object.keys(G.raids)); t.set('pets', G.pets.length); t.set('score', G.score);
    t.flush();
  };

  let discovered = new Set(), opened = new Set();
  function start() {
    W.init();
    W.forceDown = G.quest.generators.every(Boolean);   // the forcefield is derived state, never a tile mod
    W.importMods(G.mods);
    discovered = new Set(G.discovered); opened = new Set(G.opened);
    ents = []; shots = []; fx = []; haz = [];
    active.clear();
    for (const k of Object.keys(bosses)) delete bosses[k];
    trial = null; castleIntroShown = false; hinted.clear();
    for (const k of Object.keys(keyDrops)) delete keyDrops[k];
    Object.assign(P, {
      x: G.x, y: G.y, r: 11, vx: 0, vy: 0, face: 1, walk: 0, aim: -Math.PI / 2, moveAng: -Math.PI / 2, cd: 0,
      iframes: 2, star: 0, power: 0, dash: null, charge: 0, slow: 0, bulletTime: 0, overshield: G.relics.overshield ? 4 : 0, osT: 0, regenT: 0,
      carAngle: 0, speedFrac: 0, portalCd: 0, mount: G.mount, color: G.color, relics: G.relics, said88: false, gunT: 0,
    });
    if (G.mount && !G.mounts.includes(G.mount)) P.mount = null;
    cam.x = P.x; cam.y = P.y;
    curSx = curSy = 99999; curTheme = null; dead = 0; victory = 0;
    nextEventAt = G.playTime + rand(...C.events.everyMinutes) * 60;
    time = 0;
    updateSectors(true);
    spawnPets();
    tel().set('campaign', Game.campaignInfo());
    checkStage();
  }

  // ---------- Sectors ----------
  function updateSectors(force) {
    const { sx, sy } = sectorOf(P.x, P.y);
    if (sx !== curSx || sy !== curSy || force) {
      curSx = sx; curSy = sy;
      enterSector(sx, sy);
      const want = new Set();
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (W.inBounds(sx + i, sy + j)) want.add(skey(sx + i, sy + j));
      for (const k of [...active]) if (!want.has(k)) deactivate(k);
      for (const k of want) if (!active.has(k)) activate(k);
    }
  }
  function enterSector(sx, sy) {
    const k = skey(sx, sy), theme = W.themeOf(sx, sy), th = NX.THEMES[theme], site = W.siteAt(sx, sy);
    if (!discovered.has(k)) { discovered.add(k); tel().add('sectorsDiscovered'); G.score += 25; }
    const d = W.dist(sx, sy);
    tel().max('maxDist', d);
    if (theme !== curTheme) {
      curTheme = theme;
      // Until the Crystal Gate opens, the castle is just a dark ruin behind a forcefield.
      if (theme === 'castle' && !isDone('crystal_gate')) NX.UI.banner('A DARK RUIN', `Something orange hums around it · sector ${sx}, ${sy}`, '#ff9b3d', 'region');
      else NX.UI.banner(th.name.toUpperCase(), `${th.fandom} · sector ${sx}, ${sy}`, th.map, 'region');
      tel().tally('themesEntered', theme);
    }
    if (!site) return;
    if (site.type === 'castle' && !castleIntroShown && stageIdx(stageId()) >= stageIdx('castle_gens') && !G.quest.castle) {
      castleIntroShown = true;
      NX.UI.say('The Curator ◈ transmission', CAMP.castle.intro);
    }
    if (site.type === 'key' && site.act === 'jade' && stageId() === 'jade_key' && !canCross()) {
      NX.UI.toast('A data-moat rings the island. Cross it with the Nimbus 2000 (Wizarding Grounds chest), the Elytra (Ender Dragon raid) or the Portal Gun (Aperture cabinet chest).', '#3fcf8e', 9);
    }
  }
  function activate(k) {
    active.add(k);
    const [sx, sy] = k.split(',').map(Number);
    spawnSector(sx, sy, k);
  }
  function deactivate(k) {
    active.delete(k);
    hinted.delete(k);
    ents = ents.filter((e) => e.sector !== k);
    for (const a of Object.keys(bosses)) if (bosses[a] && bosses[a].sector === k) delete bosses[a];
  }

  function sectorSpot(sx, sy, rnd, avoidCenter = 4) {
    for (let i = 0; i < 40; i++) {
      const lx = 2 + Math.floor(rnd() * (S - 4)), ly = 2 + Math.floor(rnd() * (S - 4));
      if (Math.abs(lx - HALF) < avoidCenter && Math.abs(ly - HALF) < avoidCenter) continue;
      const tx = sx * S + lx, ty = sy * S + ly, t = W.tile(tx, ty);
      if (NX.SOLID.has(t) || t === T.GATE) continue;
      return { x: (tx + 0.5) * TS, y: (ty + 0.5) * TS };
    }
    return null;
  }

  function spawnSector(sx, sy, k) {
    const theme = W.themeOf(sx, sy), th = NX.THEMES[theme], d = W.dist(sx, sy);
    const rnd = NX.rng(NX.hash(sx, sy, 555));
    if (theme === 'hub') return spawnHub(k);
    // Campaign sites: cabinets, gatedoors, clue chests, key drops, pylons, castle extras (before the enemy cap).
    const site = W.siteAt(sx, sy);
    if (site) spawnSite(site, sx, sy, k);
    const special = site || W.raidAt(sx, sy), fortress = site && (site.type === 'castle' || site.type === 'generator');
    // Chest (deterministic, remembered once opened)
    if (!special && rnd() < C.world.chestChance) {
      const p = sectorSpot(sx, sy, rnd);
      if (p) { const id = 'c' + k; ents.push({ kind: 'chest', id: nid++, cid: id, x: p.x, y: p.y, r: 14, open: opened.has(id), theme, sector: k, tier: rnd() < 0.12 ? 'gold' : 'normal', d }); }
    }
    // A wandering gunter with tips and rumours (none at IOI's siege)
    if (rnd() < C.world.npcChance && !fortress) {
      const p = sectorSpot(sx, sy, rnd, 0);
      if (p) ents.push({ kind: 'npc', id: nid++, role: 'gunter', look: 'gunter', tint: `hsl(${Math.floor(rnd() * 360)},70%,55%)`, x: p.x, y: p.y, r: 12, sector: k, theme, seed: Math.floor(rnd() * 1e6) });
    }
    // Enemies
    const nEnemies = ents.reduce((n, e) => n + (e.kind === 'enemy'), 0);
    if (nEnemies >= C.world.maxEnemies) return;
    let count = Math.round(randi(th.count[0], th.count[1]) * C.world.enemyDensity * (special ? 0.4 : 1));
    for (let i = 0; i < count; i++) {
      const p = sectorSpot(sx, sy, Math.random);
      if (!p || dist(p, P) < 300) continue;
      const type = NX.weighted(th.enemies), def = NX.ENEMIES[type];
      const n = def.group ? randi(def.group[0], def.group[1]) : 1;
      for (let j = 0; j < n; j++) {
        const q = j === 0 ? p : (openSpot(p.x, p.y, 20, 60) || p);
        ents.push(makeEnemy(type, q.x, q.y, k, d));
      }
      i += n - 1;
    }
    const keysHeld = Object.keys(G.keys).length;
    if (Math.random() < C.sixers.baseChance + keysHeld * C.sixers.perKey) {
      const p = sectorSpot(sx, sy, Math.random);
      if (p && dist(p, P) > 300) for (let j = 0; j < randi(2, 4); j++) { const q = openSpot(p.x, p.y, 10, 60) || p; ents.push(makeEnemy('sixer', q.x, q.y, k, d)); }
    }
  }

  function spawnHub(k) {
    const at = (lx, ly) => ({ x: (lx + 0.5) * TS, y: (ly + 0.5) * TS });
    const add = (role, look, lx, ly, extra) => ents.push(Object.assign({ kind: 'npc', id: nid++, role, look, r: 12, sector: k, theme: 'hub' }, at(lx, ly), extra || {}));
    add('curator', 'curator', HALF - 2, HALF + 2);
    add('shop', 'shop', 15, 20);
    add('garage', 'garage', 33, 20);
    add('score', 'score', HALF, 16);
    add('gunter', 'gunter', 12, 31, { tint: '#ff4f8b', seed: 1 });
    add('gunter', 'gunter', 36, 31, { tint: '#5be0a6', seed: 2 });
    add('gunter', 'gunter', HALF + 3, 37, { tint: '#ffd23f', seed: 3 });
  }

  function makeEnemy(type, x, y, sector, d) {
    const def = NX.ENEMIES[type], cw = C.world;
    // f scales HP, XP and coins; damage has its own (gentler) per-sector growth.
    const f = def.boss ? 1 + d * cw.bossHpPerSector : 1 + d * cw.difficultyPerSector;
    const hp = Math.max(1, Math.round(def.hp * f * C.combat.enemyHpMult));
    const dmg = Math.max(0.5, Math.round(def.dmg * (1 + d * (def.boss ? cw.bossDmgPerSector : cw.dmgPerSector)) * C.combat.enemyDmgMult * 2) / 2);
    return {
      kind: 'enemy', id: nid++, type, def, x, y, r: def.r || 13, hp, maxHp: hp, dmg, lvl: f, speed: def.speed,
      t: Math.random() * 5, cd: (def.fire || 2) * rand(0.6, 1.3), state: 'idle', st: 0, stun: 0, root: 0, flash: 0, face: 1, walk: 0,
      sector, flying: def.ai === 'flyer' || !!def.fly, provoked: def.ai !== 'critter' || Math.random() < 0.15,
      wa: Math.random() * 6.28, wt: 0, shieldHp: def.shield || 0, shieldT: 0, hits: {}, fuse: 0, tpT: def.teleport || 0,
      pi: 0, pt: 1.5, d,
    };
  }

  // ---------- Pets ----------
  function spawnPets() {
    ents = ents.filter((e) => e.kind !== 'pet');
    for (const rec of G.pets) if (rec.active && !(rec.downUntil > G.playTime)) addPet(rec);
  }
  function addPet(rec) {
    const def = NX.ENEMIES[rec.type];
    const hp = Math.round(def.hp * 3 * (1 + 0.15 * G.level));
    const p = openSpot(P.x, P.y, 30, 60) || { x: P.x, y: P.y };
    ents.push({ kind: 'pet', id: nid++, rec, type: rec.type, def, x: p.x, y: p.y, r: def.r || 12, hp, maxHp: hp, t: 0, cd: 1, face: 1, walk: 0, iframes: 0, flying: def.ai === 'flyer', hitT: 0 });
  }
  Game.togglePet = (i) => {
    const rec = G.pets[i]; if (!rec) return;
    const activeCount = G.pets.filter((p) => p.active).length;
    if (!rec.active && activeCount >= C.player.maxActivePets) return 'full';
    rec.active = !rec.active;
    spawnPets();
    return rec.active;
  };

  // ---------- Player ----------
  function playerSpeed() {
    const m = P.mount && NX.MOUNTS[P.mount];
    return C.player.speed * (m ? m.speed : 1) * (G.relics.chaosemerald ? 1.25 : 1) * (G.relics.speedshoes ? 1.2 : 1) * (P.slow > 0 ? 0.5 : 1);
  }

  function updatePlayer(dt) {
    P.cd -= dt; P.iframes = Math.max(0, P.iframes - dt); P.star = Math.max(0, P.star - dt); P.power = Math.max(0, P.power - dt);
    P.slow = Math.max(0, P.slow - dt); P.bulletTime = Math.max(0, P.bulletTime - dt); P.portalCd = Math.max(0, P.portalCd - dt);
    const mount = P.mount && NX.MOUNTS[P.mount];

    // Relic passives
    if (G.relics.implant) { P.regenT += dt; if (P.regenT > 6) { P.regenT = 0; heal(1, true); } }
    if (G.relics.overshield) { P.osT -= dt; if (P.osT <= 0 && P.overshield < 4) P.overshield = Math.min(4, P.overshield + dt * 1.5); }

    // Movement
    const mv = Input.move();
    const sp = playerSpeed();
    let vx = mv.x * sp, vy = mv.y * sp;
    if (P.dash) { vx = P.dash.vx; vy = P.dash.vy; P.dash.t -= dt; if (P.dash.t <= 0) P.dash = null; }
    const moving = Math.hypot(vx, vy) > 1;
    if (mount && mount.car) {
      // cars accelerate and turn smoothly
      P.vx += (vx - P.vx) * Math.min(1, dt * 3); P.vy += (vy - P.vy) * Math.min(1, dt * 3);
      vx = P.vx; vy = P.vy;
      if (Math.hypot(vx, vy) > 20) P.carAngle += angleDiff(P.carAngle, Math.atan2(vy, vx)) * Math.min(1, dt * 8);
      P.speedFrac = Math.hypot(vx, vy) / (C.player.speed * mount.speed);
      if (P.mount === 'delorean' && P.speedFrac > 0.95 && !P.said88) { P.said88 = true; NX.UI.toast('88 MPH! Great Scott!', '#ff9a1a'); }
    } else { P.vx = vx; P.vy = vy; P.speedFrac = 0; }
    if (moving) {
      P.moveAng = Math.atan2(vy, vx);
      if (Math.abs(vx) > 1) P.face = vx > 0 ? 1 : -1;
      P.walk += dt * 12;
    }
    const before = { x: P.x, y: P.y };
    moveCircle(P, vx * dt, vy * dt, mount && mount.fly ? 'ghost' : 'walk');
    const moved = Math.hypot(P.x - before.x, P.y - before.y);
    tel().add('distanceTiles', moved / TS);
    if (mount) tel().tally('mountTime', P.mount, dt);

    // Aim: mouse if recently used, touch auto-aims, otherwise movement direction.
    const recentMouse = performance.now() - Input.mouse.lastMove < 2500 && !Input.touchUsed;
    const mw = recentMouse ? Game.screenToWorld(Input.mouse.x, Input.mouse.y) : null;
    if (mw) {
      P.aim = Math.atan2(mw.y - P.y, mw.x - P.x);
      P.face = Math.cos(P.aim) >= 0 ? 1 : -1;
    } else {
      const tgt = Input.touchUsed ? nearestEnemy(P, 380) : null;
      P.aim = tgt ? angleTo(P, tgt) : P.moveAng;
    }

    // Tiles underfoot
    const tx = Math.floor(P.x / TS), ty = Math.floor(P.y / TS), tile = W.tile(tx, ty);
    if (tile === T.PELLET) { W.setTile(tx, ty, T.FLOOR); G.score += 10; Sound.play('pellet'); if (Math.random() < 0.08) dropItem(P.x, P.y, 'coin', 1, null); }
    else if (tile === T.POWER) {
      W.setTile(tx, ty, T.FLOOR); P.power = 8; Sound.play('power'); NX.UI.toast('POWER PELLET! Ghosts are edible!', '#ffcfb0');
      for (const e of ents) if (e.kind === 'enemy' && e.def.art === 'pacghost') e.scared = 8;
    }

    // Car ramming & Ecto-1 siren
    if (mount && mount.car && P.speedFrac > 0.45) {
      for (const e of ents) {
        if (e.kind !== 'enemy' || e.dead || dist(e, P) > e.r + 20) continue;
        if (!e.ramT || e.ramT < time) { e.ramT = time + 0.4; damageEnemy(e, mount.ram * dmgMult(), { weapon: P.mount, knock: 4 }); shake(4); }
      }
    }
    if (P.mount === 'ecto1') for (const e of ents) if (e.kind === 'enemy' && e.def.tag === 'ghost' && !e.def.boss && dist(e, P) < 240) e.scared = Math.max(e.scared || 0, 0.5);
    if (P.mount === 'batmobile') {
      P.gunT -= dt;
      const tgt = nearestEnemy(P, 420);
      if (tgt && P.gunT <= 0) { P.gunT = 0.25; fireShot(P.x, P.y, angleTo(P, tgt), { speed: 620, dmg: 2 * dmgMult(), color: '#ffb03a', r: 4, team: 'player', weapon: 'batmobile' }); Sound.play('laser'); }
    }

    // Portals
    if (P.portalCd <= 0) {
      const portals = ents.filter((e) => e.kind === 'portal');
      if (portals.length === 2) for (const pt of portals) {
        if (dist(pt, P) < 18) {
          const other = portals.find((o) => o !== pt);
          P.x = other.x; P.y = other.y; P.portalCd = 0.9; Sound.play('warp'); ring(P.x, P.y, 40, other.color === 0 ? '#3a9aff' : '#ff9a1a');
          updateSectors(); break;
        }
      }
    }

    // Combat input (cars can't swing a sword)
    const canAttack = !mount || mount.attack;
    const wantAttack = Input.down('attack') || Input.mouse.down;
    const w = NX.WEAPONS[G.weapon];
    if (canAttack && w) {
      if (w.kind === 'charge') {
        if (wantAttack) P.charge = Math.min(1.5, P.charge + dt);
        else if (P.charge > 0.15) { releaseCharge(w); P.charge = 0; }
        else P.charge = 0;
      } else if (w.kind === 'beam') {
        if (wantAttack) fireBeam(w, dt); else beamFx = null;
      } else if (wantAttack && P.cd <= 0) useWeapon(G.weapon, w);
    } else beamFx = null;

    if (Input.hit('next')) cycleWeapon(1);
    if (Input.hit('prev')) cycleWeapon(-1);
    for (let i = 1; i <= 9; i++) if (Input.hit('slot' + i) && G.weapons[i - 1]) equip(G.weapons[i - 1]);
    if (Input.hit('ball')) throwBall();
    if (Input.hit('grenade')) throwGrenade();
    if (Input.hit('drive')) cycleMount();
    if (Input.hit('ability')) useAbility();
    if (Input.hit('interact')) interact();
  }

  function cycleWeapon(dir) {
    const i = G.weapons.indexOf(G.weapon);
    equip(G.weapons[(i + dir + G.weapons.length) % G.weapons.length]);
  }
  function equip(id) {
    if (G.weapon === id) return;
    G.weapon = id; P.charge = 0; beamFx = null;
    const w = NX.WEAPONS[id];
    NX.UI.toast(`${w.name} · ${w.fandom}`, w.color);
    Sound.play('menu');
  }
  Game.equip = equip;
  function cycleMount() {
    if (!G.mounts.length) { NX.UI.toast('No ride yet — the hub garage sells a DeLorean.', '#aaa'); return; }
    const list = [null, ...G.mounts];
    const i = list.indexOf(P.mount || null);
    let next = list[(i + 1) % list.length];
    // can't dismount on top of a wall after flying
    if (!next && W.blocked(P.x, P.y, 9)) { NX.UI.toast('Can\'t land here!', '#ff6a6a'); return; }
    P.mount = next; P.vx = P.vy = 0; P.said88 = false;
    if (next) { const m = NX.MOUNTS[next]; NX.UI.toast(`${m.name} (${m.fandom})`, '#18e0ff'); Sound.play('car'); }
    else NX.UI.toast('On foot', '#aaa');
  }
  function useAbility() {
    if (!G.relics.gauntlet) { NX.UI.toast('No ability yet. Thanos has one...', '#aaa'); return; }
    const cdLeft = 90 - (G.playTime - G.snapAt);
    if (cdLeft > 0) { NX.UI.toast(`Gauntlet recharging: ${Math.ceil(cdLeft)}s`, '#c070ff'); return; }
    G.snapAt = G.playTime;
    tel().add('snaps');
    NX.UI.flash('#ffffff', 0.6);
    NX.UI.banner('*SNAP*', 'Perfectly balanced, as all things should be.', '#c070ff');
    Sound.play('boom');
    const near = ents.filter((e) => e.kind === 'enemy' && !e.dead && dist(e, P) < 900);
    near.sort(() => Math.random() - 0.5);
    near.forEach((e, i) => {
      if (e.def.boss) damageEnemy(e, e.hp * 0.5, { weapon: 'gauntlet', silent: false });
      else if (i % 2 === 0) { burst(e.x, e.y, '#8a6a4a', 24, 90, 3); damageEnemy(e, e.hp + 999, { weapon: 'gauntlet' }); }
    });
  }

  // ---------- Weapons ----------
  function useWeapon(id, w) {
    tel().tally('weaponUse', id);
    if (w.kind === 'melee') { P.cd = w.cd; return melee(id, w); }
    if (w.kind === 'gun') {
      P.cd = w.cd;
      const n = w.count || 1;
      for (let i = 0; i < n; i++) {
        const a = P.aim + (n > 1 ? (i - (n - 1) / 2) * (w.spread || 0.1) : rand(-1, 1) * (w.spread || 0));
        fireShot(P.x + Math.cos(P.aim) * 12, P.y + Math.sin(P.aim) * 12 - 4, a, {
          speed: w.speed, dmg: w.dmg * dmgMult(), color: w.color, team: 'player', weapon: id,
          kind: w.shot || 'bolt', r: w.shot === 'fireball' ? 6 : w.shot === 'web' ? 6 : 4, bounces: w.bounces || 0,
          pierce: w.pierce, stun: w.stun, root: w.root, homing: w.homing, bonus: w.bonus, breaks: w.breaks, life: 1.6,
        });
      }
      Sound.play(w.sound || 'laser');
      return;
    }
    if (w.kind === 'disc') {
      if (shots.some((s) => s.boomer && s.weapon === id)) return;
      P.cd = w.cd;
      fireShot(P.x, P.y, P.aim, {
        speed: w.speed, dmg: w.dmg * dmgMult(), color: w.color, team: 'player', weapon: id, kind: w.art || 'disc', r: 10,
        boomer: true, range: w.range, pierce: w.pierce, ricochet: w.ricochet || 0, lightning: w.lightning || 0, curve: w.curve || 0, stun: w.stun, life: 6,
      });
      Sound.play(w.sound || 'disc');
      return;
    }
    if (w.kind === 'portal') {
      P.cd = w.cd;
      fireShot(P.x, P.y, P.aim, { speed: w.speed, dmg: 0, color: G.portalNext ? '#ff9a1a' : '#3a9aff', team: 'player', weapon: id, kind: 'portalshot', r: 6, life: 0.8, portal: G.portalNext ? 1 : 0 });
      G.portalNext = G.portalNext ? 0 : 1;
      Sound.play('zap');
    }
  }

  function melee(id, w) {
    const a = P.aim, mult = dmgMult();
    Sound.play(w.sound || 'swing');
    if (w.lunge) {
      const tgt = nearestEnemy(P, w.lunge, (e) => Math.abs(angleDiff(a, angleTo(P, e))) < 0.8);
      if (tgt) { const la = angleTo(P, tgt); P.dash = { vx: Math.cos(la) * 700, vy: Math.sin(la) * 700, t: Math.max(0.05, (dist(P, tgt) - 30) / 700) }; P.iframes = Math.max(P.iframes, 0.25); P.aim = la; }
    }
    if (w.aoe) {
      const cx = P.x + Math.cos(a) * w.aoe.dist, cy = P.y + Math.sin(a) * w.aoe.dist;
      fx.push({ type: 'fist', x: cx, y: cy, a, life: 0.35, max: 0.35, color: w.color, r: w.aoe.r });
      for (const e of ents) if (e.kind === 'enemy' && !e.dead && Math.hypot(e.x - cx, e.y - cy) < w.aoe.r + e.r) damageEnemy(e, w.dmg * mult, { weapon: id, knock: w.knock || 1, from: { x: cx, y: cy } });
      shake(5);
      return;
    }
    fx.push({ type: 'slash', x: P.x, y: P.y, a, arc: w.arc, range: w.range, color: w.color, life: 0.14, max: 0.14, lasso: !!w.pull });
    for (const e of ents) {
      if (e.kind !== 'enemy' || e.dead) continue;
      const d = dist(P, e);
      if (d > w.range + e.r) continue;
      if (Math.abs(angleDiff(a, angleTo(P, e))) > w.arc / 2 && d > e.r + 10) continue;
      damageEnemy(e, w.dmg * mult, { weapon: id, knock: w.knock || 1, stun: w.stun, bonus: w.bonus });
      if (w.pull && !e.def.boss && !e.dead) { const pa = angleTo(e, P); moveCircle(e, Math.cos(pa) * (d - 30), Math.sin(pa) * (d - 30), 'walk'); }
    }
    if (w.reflect) {
      for (const s of shots) {
        if (s.team !== 'enemy' || dist(s, P) > w.range + 12) continue;
        if (Math.abs(angleDiff(a, angleTo(P, s))) > w.arc / 2) continue;
        const sp = Math.hypot(s.vx, s.vy) * 1.3;
        s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; s.team = 'player'; s.dmg = (s.dmg || 1) * 2 * mult; s.weapon = id; s.color = w.color; s.boomer = false;
        text(s.x, s.y, 'DEFLECT', w.color, 10, 0.4);
      }
    }
    // Hit tiles in front: break bushes/bricks, bump ? blocks, mine walls.
    for (const reach of [26, 42]) {
      const tx = Math.floor((P.x + Math.cos(a) * reach) / TS), ty = Math.floor((P.y + Math.sin(a) * reach) / TS);
      if (hitTile(tx, ty, w.mine)) break;
    }
    if (w.beam && G.hp >= maxHp()) fireShot(P.x, P.y, a, { speed: 520, dmg: w.dmg * 1.5 * mult, color: w.color, team: 'player', weapon: id, kind: 'swordbeam', r: 8, life: 0.8, pierce: true });
  }

  function hitTile(tx, ty, mine) {
    const t = W.tile(tx, ty);
    if (Math.floor(tx / S) === 0 && Math.floor(ty / S) === 0) return false;   // the hub is indestructible
    const cx = (tx + 0.5) * TS, cy = (ty + 0.5) * TS;
    if (t === T.BREAK) {
      W.setTile(tx, ty, T.FLOOR); burst(cx, cy, '#9a7a4a', 10, 120); Sound.play('break');
      if (Math.random() < 0.25) dropItem(cx, cy, pick(['coin', 'coin', 'heart']), 1, curKey());
      return true;
    }
    if (t === T.QBLOCK) {
      W.setTile(tx, ty, T.USED); Sound.play('block');
      const r = Math.random();
      dropItem(cx, cy + 24, r < 0.08 ? 'mushroom' : r < 0.14 ? 'star' : r < 0.2 && !G.weapons.includes('fireflower') ? 'weapon' : 'coin', r < 0.2 ? 1 : 3, curKey(), { weapon: 'fireflower' });
      return true;
    }
    if (mine && (t === T.WALL || t === T.USED || t === T.PROP)) {   // never FORCE, WATER or ALTAR
      W.setTile(tx, ty, T.FLOOR); burst(cx, cy, '#888', 12, 140); Sound.play('break'); tel().add('blocksMined');
      return true;
    }
    return NX.SOLID.has(t);
  }
  const curKey = () => skey(curSx, curSy);

  function beamEnd(x, y, a, range) {
    let ex = x, ey = y;
    for (let d = 8; d <= range; d += 8) {
      const nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d;
      if (W.stopsShotAt(nx, ny)) break;
      ex = nx; ey = ny;
    }
    return { x: ex, y: ey };
  }
  function beamHits(x1, y1, x2, y2, width, fn) {
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
    for (const e of ents) {
      if (e.kind !== 'enemy' || e.dead) continue;
      const tt = clamp(((e.x - x1) * dx + (e.y - y1) * dy) / L2, 0, 1);
      if (Math.hypot(e.x - (x1 + dx * tt), e.y - (y1 + dy * tt)) < e.r + width / 2) fn(e);
    }
  }
  function fireBeam(w, dt) {
    const end = beamEnd(P.x, P.y - 4, P.aim, w.range);
    beamFx = { x1: P.x, y1: P.y - 4, x2: end.x, y2: end.y, color: w.color, width: w.width || 6 };
    if (Math.random() < dt * 8) Sound.play('beam');
    tel().tally('weaponUse', G.weapon, dt);
    beamHits(P.x, P.y, end.x, end.y, w.width || 6, (e) => damageEnemy(e, w.dps * dt * dmgMult(), { weapon: G.weapon, silent: true, bonus: w.bonus, stun: w.stun ? 0.05 : 0 }));
  }
  function releaseCharge(w) {
    const c = P.charge;
    bigBeam = { t: 0.7, max: 0.7, dps: w.dps * (0.5 + c), width: 10 + c * 22, color: w.color };
    shake(6 + c * 6); Sound.play('boom'); tel().tally('weaponUse', G.weapon);
    if (c > 1.2) NX.UI.toast('KA-ME-HA-ME-HAAAA!', w.color);
  }

  function fireShot(x, y, a, o) {
    const s = Object.assign({ x, y, vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed, r: 4, age: 0, life: 2, hit: new Set(), kind: 'bolt', dist: 0, phase: 'out' }, o);
    shots.push(s);
    return s;
  }

  function throwBall() {
    const master = G.items.masterballs > 0;
    if (!master && G.items.pokeballs <= 0) { NX.UI.toast('Out of Poké Balls! The hub shop sells more.', '#ff6a6a'); return; }
    if (master) G.items.masterballs--; else G.items.pokeballs--;
    fireShot(P.x, P.y, P.aim, { speed: 380, dmg: 0, team: 'player', kind: 'ball', r: 8, life: 1.1, ball: true, master });
    Sound.play('throw');
  }
  function throwGrenade() {
    if (G.items.grenades <= 0) { NX.UI.toast('No Holy Hand Grenades left.', '#ff6a6a'); return; }
    G.items.grenades--;
    let tx = P.x + Math.cos(P.aim) * 170, ty = P.y + Math.sin(P.aim) * 170;
    const flight = 0.6;
    fireShot(P.x, P.y, P.aim, { speed: 0, team: 'player', kind: 'grenade', r: 7, life: 1.8, gx0: P.x, gy0: P.y, gx1: tx, gy1: ty, flight, grenade: true });
    NX.UI.toast('One... two... five! THREE, sir!', '#e8c040');
    Sound.play('throw');
  }

  function explode(x, y, r, dmg, team, breakTiles, src) {
    burst(x, y, '#ffb03a', 30, 260, 4); burst(x, y, '#ff5a1a', 20, 180, 3); ring(x, y, r, '#ffd28a', 0.5, 4);
    shake(10); Sound.play('boom');
    for (const e of ents) {
      if (e.dead) continue;
      const d = dist(e, { x, y });
      if (d > r + e.r) continue;
      if (e.kind === 'enemy') damageEnemy(e, dmg * (team === 'player' ? dmgMult() : 1), { weapon: src || 'explosion', knock: 3, from: { x, y } });
      else if (e.kind === 'pet' && team === 'enemy') hurtPet(e, dmg);
    }
    if (team === 'enemy' && dist(P, { x, y }) < r + P.r) hurtPlayer(dmg, src || 'explosion');
    if (breakTiles) {
      const t0x = Math.floor(x / TS), t0y = Math.floor(y / TS), tr = Math.ceil(r / TS);
      for (let j = -tr; j <= tr; j++) for (let i = -tr; i <= tr; i++) {
        if (i * i + j * j > tr * tr) continue;
        const tt = W.tile(t0x + i, t0y + j);
        if (tt === T.BREAK || tt === T.QBLOCK) hitTile(t0x + i, t0y + j, false);
      }
    }
  }

  // ---------- Damage & death ----------
  function damageEnemy(e, dmg, o = {}) {
    if (e.dead || e.capturing) return;
    const d = e.def;
    if (d.ai === 'angel' && e.observed && !o.silent) { text(e.x, e.y - 20, 'stone...', '#aaa', 10, 0.4); dmg *= 0.25; }
    // Crystal guardian: Blinky XL shrugs off anything that isn't powered up by a big dot.
    if (e.type === 'bigghost' && e.keyId && !(P.power > 0)) {
      dmg *= 0.25;
      if (!e.npT || e.npT < time) { e.npT = time + 0.9; text(e.x, e.y - e.r - 22, 'NEED POWER', '#ffd23f', 13, 0.8); }
    }
    if (d.adapt && o.weapon) {
      e.hits[o.weapon] = (e.hits[o.weapon] || 0) + 1;
      if (!e.adapted && e.hits[o.weapon] >= d.adapt * (o.silent ? 30 : 1)) { e.adapted = o.weapon; text(e.x, e.y - 24, 'ADAPTED', '#5fff5f', 12); }
      if (e.adapted === o.weapon) { if (!o.silent) text(e.x, e.y - 20, 'IMMUNE', '#5fff5f', 11, 0.5); return; }
    }
    if (o.bonus && d.tag === o.bonus.tag) dmg *= o.bonus.mult;
    if (d.ai === 'koopa' && !e.shell && e.hp - dmg > 0) {
      e.shell = true; e.shellT = 6; e.provoked = true;
      const from = o.from || P, a = angleTo(from, e);
      e.svx = Math.cos(a) * 420; e.svy = Math.sin(a) * 420; e.safeT = 0.4;
      text(e.x, e.y - 16, 'SHELL!', '#2fae3a', 12);
      Sound.play('block');
      return;
    }
    if (e.shieldHp > 0) { const ab = Math.min(e.shieldHp, dmg); e.shieldHp -= ab; dmg -= ab; e.shieldT = 3; if (!o.silent) text(e.x, e.y - 18, 'SHIELD', '#5fa0ff', 10, 0.4); }
    e.hp -= dmg; e.flash = 0.08; e.provoked = true;
    if (o.stun) e.stun = Math.max(e.stun, d.boss ? Math.min(0.15, o.stun) : o.stun);
    if (o.root) e.root = Math.max(e.root, d.boss ? 0.3 : o.root);
    if (!d.boss && o.knock && !e.shell) { const from = o.from || P, a = angleTo(from, e); moveCircle(e, Math.cos(a) * 7 * o.knock, Math.sin(a) * 7 * o.knock, e.flying ? 'fly' : 'walk'); }
    if (o.silent) {
      e.acc = (e.acc || 0) + dmg;
      if (!e.accT || e.accT < time) { e.accT = time + 0.25; if (e.acc >= 0.5) { text(e.x + rand(-6, 6), e.y - e.r - 6, Math.round(e.acc * 10) / 10 + '', '#ffe9a0', 11, 0.5); e.acc = 0; } }
    } else {
      text(e.x + rand(-6, 6), e.y - e.r - 6, (Math.round(dmg * 10) / 10) + '', dmg >= 6 ? '#ff9a3a' : '#fff', dmg >= 6 ? 16 : 12, 0.6);
      Sound.play('hit');
      combo++; comboT = 1.6;
    }
    if (e.hp <= 0) killEnemy(e, o.weapon);
  }
  Game.damageEnemy = damageEnemy;

  function killEnemy(e, weapon) {
    e.dead = true;
    const d = e.def;
    G.kills++; tel().add('kills'); tel().tally('kills', e.type);
    // Trial foes (echoes included) give reduced XP; the trial pays a bonus on a win instead.
    const xp = Math.round(d.xp * e.lvl * (G.relics.gizmo && d.tag === 'ghost' ? 3 : 1) * (e.trialId != null ? CC.trialXpMult : 1));
    gainXp(xp);
    G.score += xp * 10;
    burst(e.x, e.y, d.color || '#ffb060', d.boss ? 60 : 16, d.boss ? 300 : 170, d.boss ? 5 : 3);
    Sound.play(d.boss ? 'boom' : 'kill');
    // Kill streak announcer
    streak = time - lastKillT < 2.4 ? streak + 1 : 1;
    lastKillT = time;
    G.bestStreak = Math.max(G.bestStreak, streak);
    for (const [n, label] of NX.STREAKS) if (streak === n) { NX.UI.announce(label); tel().tally('streaks', label); }
    // Loot
    let coins = randi(d.coins[0], d.coins[1]) * e.lvl * C.economy.coinMult * (G.relics.goldflower ? 2 : 1);
    const pieces = Math.min(d.boss ? 14 : 4, Math.max(1, Math.round(coins / 4)));
    for (let i = 0; i < pieces; i++) dropItem(e.x + rand(-10, 10), e.y + rand(-10, 10), 'coin', Math.max(1, Math.round(coins / pieces)), e.sector);
    if (!d.boss) {
      const r = Math.random();
      if (r < 0.1) dropItem(e.x, e.y, 'heart', 1, e.sector);
      else if (r < 0.14) dropItem(e.x, e.y, 'pokeballs', 1, e.sector);
      else if (r < 0.16) dropItem(e.x, e.y, 'grenade', 1, e.sector);
    }
    if (d.boss) bossDefeated(e);
    if (e.generatorIndex != null) pylonDown(e);
  }

  function bossDefeated(e) {
    shake(26); NX.UI.flash('#ffffff', 0.4);
    G.score += 5000;
    const tag = e.echo ? 'echo:' + e.type : e.type;   // echoes tally separately so boss-HP tuning skips them
    tel().add('bossKills'); tel().tally('bossesDefeated', tag); tel().event('boss', { boss: tag, level: G.level });
    NX.UI.banner(`${e.echo ? 'ECHO OF ' : ''}${e.def.name.toUpperCase()} DEFEATED`, e.echo ? 'Gate Trial' : e.def.fandom, '#ffd23f');
    for (let i = 0; i < 6; i++) setTimeout(() => { if (G) { burst(e.x + rand(-60, 60), e.y + rand(-60, 60), '#fff2a0', 30, 260, 4); Sound.play('boom'); } }, i * 160);
    // Drops land on a reachable tile: ghosts die inside maze walls, Ganon next to his moat.
    const o = W.findOpen(Math.floor(e.x / TS), Math.floor(e.y / TS)), ox = (o.tx + 0.5) * TS, oy = (o.ty + 0.5) * TS;
    if (e.keyId) { keyDrops[e.keyId] = { x: ox, y: oy }; dropItem(ox, oy, 'key', 1, e.sector, { key: e.keyId, vx: 0, vy: 0 }); }
    if (e.raidTheme) {
      const rw = NX.RAIDS[e.raidTheme].reward;
      G.raids[e.raidTheme] = true;
      if (rw.relic) dropItem(ox - (rw.mount ? 10 : 0), oy, 'relic', 1, e.sector, { relic: rw.relic, vx: 0, vy: 0 });
      if (rw.mount) dropItem(ox + (rw.relic ? 10 : 0), oy, 'mount', 1, e.sector, { mount: rw.mount, vx: 0, vy: 0 });
    }
    if (e.type === 'godzilla' && !G.weapons.includes('atomicbreath')) dropItem(ox, oy, 'weapon', 1, e.sector, { weapon: 'atomicbreath', vx: 0, vy: 0 });
    dropItem(e.x, e.y + 30, 'heart', 1, e.sector); dropItem(e.x + 15, e.y + 30, 'heart', 1, e.sector);
    for (const k of Object.keys(bosses)) if (bosses[k] === e) delete bosses[k];
    // minions flee
    for (const m of ents) if (m.kind === 'enemy' && m.owner === e.id && !m.dead) { burst(m.x, m.y, '#aaa', 8); m.dead = true; }
    if (e.castleBoss) { G.quest.castle = true; spawnCastleExtras(e.sector); checkStage(); }
    NX.UI.save();
  }

  function gainXp(n) {
    G.xp += n;
    let up = false;
    while (G.xp >= xpNeed(G.level)) { G.xp -= xpNeed(G.level); G.level++; up = true; }
    if (up) {
      G.hp = maxHp();
      NX.UI.banner(`LEVEL ${G.level}`, 'Max HP up · damage up · fully healed', '#5bff9a');
      Sound.play('levelup'); ring(P.x, P.y, 60, '#5bff9a', 0.6, 4);
      tel().max('level', G.level);
    }
  }
  function heal(n, quiet) {
    const before = G.hp;
    G.hp = Math.min(maxHp(), G.hp + n);
    if (!quiet && G.hp > before) text(P.x, P.y - 24, '+' + (G.hp - before), '#ff6b8a', 13);
  }

  function hurtPlayer(dmg, src) {
    if (dead || victory || P.iframes > 0 || P.star > 0 || P.dash) return;
    if (G.relics.mithril) dmg *= 0.7;
    tel().tally('damageBy', src, dmg);
    if (P.overshield > 0) { const ab = Math.min(P.overshield, dmg); P.overshield -= ab; dmg -= ab; P.osT = 5; }
    if (dmg <= 0) { P.iframes = 0.3; text(P.x, P.y - 24, 'SHIELD', '#ffd23f', 11, 0.4); return; }
    G.hp -= dmg; P.iframes = C.player.iframes; P.osT = 5;
    shake(7); Sound.play('hurt');
    text(P.x, P.y - 26, '-' + (Math.round(dmg * 10) / 10), '#ff4a4a', 15);
    NX.UI.flash('#ff0000', 0.15);
    if (G.relics.redpill) P.bulletTime = 2;
    if (G.hp > 0) return;
    if (G.relics.walkman && G.playTime - G.walkmanAt > 180) { G.walkmanAt = G.playTime; G.hp = 1; P.iframes = 2; NX.UI.banner('RUNNING UP THAT HILL', 'Max\'s Walkman saved you', '#ff4f8b'); return; }
    if (G.relics.regeneration && G.playTime - G.regenAt > 600) { G.regenAt = G.playTime; G.hp = maxHp(); P.iframes = 3; burst(P.x, P.y, '#ffd23f', 60, 260, 4); NX.UI.banner('REGENERATING', 'New face, same gunter', '#ffd23f'); return; }
    if (G.items.extralife > 0) { G.items.extralife--; G.hp = maxHp(); P.iframes = 3; NX.UI.banner('EXTRA LIFE!', 'Thanks for the quarter', '#c8ccd2'); Sound.play('levelup'); return; }
    die(src);
  }

  function die(src) {
    if (trial) failTrial();
    dead = 3.2;
    G.deaths++;
    const { sx, sy } = sectorOf(P.x, P.y);
    tel().add('deaths'); tel().tally('deathsBy', src); tel().tally('deathsIn', W.themeOf(sx, sy));
    tel().event('death', { by: src, theme: W.themeOf(sx, sy), dist: W.dist(sx, sy), level: G.level });
    burst(P.x, P.y, G.color, 50, 240, 4); Sound.play('boom'); shake(20);
    P.mount = null; beamFx = null; bigBeam = null;
    Game.deathCause = (NX.ENEMIES[src] && NX.ENEMIES[src].name) || src;
  }
  function respawn() {
    const lost = Math.floor(G.coins * C.economy.deathCoinLoss);
    G.coins -= lost;
    const gate = W.gateWorld(0, 0);
    P.x = gate.x; P.y = gate.y + TS * 1.5; G.hp = maxHp(); P.iframes = 3; P.overshield = G.relics.overshield ? 4 : 0;
    shots = []; haz = [];
    if (NX.R3D && NX.R3D.ok) NX.R3D.snap();
    updateSectors(true);
    spawnPets();
    NX.UI.banner('RESPAWNED AT NEXUS PRIME', lost ? `Lost ${lost} coins` : 'Try a different route', '#c9c3ff');
    NX.UI.save();
    if ((G.playTime - G.lastPromptAt) / 60 >= C.feedback.deathPromptMinutes) { G.lastPromptAt = G.playTime; NX.UI.debrief('death'); }
  }

  function hurtPet(p, dmg) {
    if (p.iframes > 0) return;
    p.hp -= dmg; p.iframes = 0.4; p.flash = 0.08;
    if (p.hp <= 0) {
      p.dead = true; p.rec.downUntil = G.playTime + 25;
      burst(p.x, p.y, '#fff', 12); text(p.x, p.y - 20, `${p.def.name} fainted!`, '#ffb0b0', 11);
    }
  }

  // ---------- Items & loot ----------
  function dropItem(x, y, item, value, sector, extra) {
    const a = Math.random() * Math.PI * 2;
    ents.push(Object.assign({ kind: 'pickup', id: nid++, item, value, x, y, r: 10, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, sector: sector || curKey(), born: time }, extra || {}));
  }
  Game.dropItem = dropItem;

  function collect(p) {
    p.dead = true;
    switch (p.item) {
      case 'coin': G.coins += p.value; tel().add('coinsEarned', p.value); Sound.play('coin'); text(p.x, p.y - 10, '+' + p.value, '#ffd23f', 11, 0.5); break;
      case 'heart': heal(2); Sound.play('pickup'); break;
      case 'pokeballs': G.items.pokeballs += p.value * (p.value === 1 ? 1 : 1); Sound.play('pickup'); NX.UI.toast(`+${p.value} Poké Ball`, '#ff6a6a'); break;
      case 'grenade': G.items.grenades += p.value; Sound.play('pickup'); NX.UI.toast('+1 Holy Hand Grenade', '#e8c040'); break;
      case 'mushroom': G.bonusHp += 2; heal(2); Sound.play('levelup'); NX.UI.toast('Super Mushroom! +1 heart container', '#ff4a4a'); break;
      case 'star': P.star = 8; Sound.play('power'); NX.UI.toast('SUPER STAR! Invincible!', '#ffe23a'); break;
      case 'extralife':
        if (G.items.extralife >= lifeCap()) { G.coins += C.economy.extraLifeOverflowCoins; Sound.play('coin'); NX.UI.toast(`Pockets full of quarters · +${C.economy.extraLifeOverflowCoins} coins`, '#ffd23f'); break; }
        G.items.extralife++; Sound.play('pickup'); NX.UI.toast('Extra Life Quarter', '#c8ccd2'); break;
      case 'masterball': G.items.masterballs++; Sound.play('pickup'); break;
      case 'weapon': {
        const w = NX.WEAPONS[p.weapon];
        if (G.weapons.includes(p.weapon)) { G.coins += 25; NX.UI.toast(`Duplicate ${w.name} → 25 coins`, '#ffd23f'); break; }
        G.weapons.push(p.weapon); equip(p.weapon);
        tel().tally('weaponsFound', p.weapon); tel().event('weapon', { id: p.weapon });
        NX.UI.banner(`NEW WEAPON: ${w.name.toUpperCase()}`, `${w.fandom}${w.desc ? ' — ' + w.desc : ''}`, w.color);
        Sound.play('chest');
        break;
      }
      case 'mount': {
        const m = NX.MOUNTS[p.mount];
        if (!G.mounts.includes(p.mount)) G.mounts.push(p.mount);
        tel().tally('mountsFound', p.mount);
        NX.UI.banner(`NEW RIDE: ${m.name.toUpperCase()}`, `${m.fandom} — press V to ride${m.fly ? ' (it flies!)' : ''}`, '#18e0ff');
        Sound.play('chest');
        break;
      }
      case 'relic': {
        const r = NX.RELICS[p.relic];
        G.relics[p.relic] = true;
        if (p.relic === 'amber') G.items.extralife = Math.max(G.items.extralife, Math.min(lifeCap(), G.items.extralife + 2));
        if (p.relic === 'masterball') G.items.masterballs += 3;
        if (p.relic === 'overshield') P.overshield = 4;
        if (p.relic === 'cake') G.hp = maxHp();
        tel().tally('relicsFound', p.relic); tel().event('relic', { id: p.relic });
        NX.UI.banner(`RELIC: ${r.name.toUpperCase()}`, r.desc, '#ffd23f');
        Sound.play('key');
        break;
      }
      case 'key': {
        // The only way a key stage completes (never at the guardian's death).
        const act = p.key, k = NX.KEYS[act];
        G.keys[act] = true; delete keyDrops[act];
        tel().event('key', { key: act, level: G.level }); tel().set('keyAt_' + act, Math.round(G.playTime));
        NX.UI.banner(`THE ${k.name.toUpperCase()}`, `${ACTS.filter((a) => G.keys[a]).length} of 3 keys · the ${actWord(act)} Gate awaits`, k.color);
        Sound.play('key'); shake(12);
        advance(act + '_key');
        NX.UI.say('The Curator ◈ transmission', [Game.fmtQuest(CAMP.acts[act].gateIntro, W.quest[act].gate)]);
        NX.UI.save();
        break;
      }
      case 'egg': {
        // The old altar victory, now at Anorak's altar.
        if (G.egg) break;
        G.egg = true;
        G.eggRank = eggRank();
        tel().event('egg', { time: Math.round(G.playTime), rank: G.eggRank, level: G.level }); tel().set('eggAt', Math.round(G.playTime)); tel().set('eggRank', G.eggRank);
        G.score += 100000;
        victory = 8;
        Sound.play('egg'); NX.UI.flash('#ffffff', 1);
        NX.UI.banner('THE EGG IS YOURS', `${ordinal(G.eggRank)} through the Crystal Gate — first to the Egg`, '#fff3c4');
        Game.save();
        advance('egg');
        break;
      }
    }
  }

  function openChest(c) {
    const again = opened.has(c.cid);   // a clue chest re-closes while its theme loot is still missing: loot only
    c.open = true; opened.add(c.cid);
    Sound.play('chest');
    if (!again) tel().add('chests');
    const th = NX.THEMES[c.theme], f = 1 + c.d * 0.1, gold = c.tier === 'gold';
    burst(c.x, c.y - 8, gold ? '#ffd23f' : '#ffe9a0', 20, 140);
    const missing = (th.loot || []).filter((id) => id === 'pokeballs' || !owns(id));
    if (missing.length && (gold || Math.random() < 0.5)) {
      const id = pick(missing);
      if (id === 'pokeballs') dropItem(c.x, c.y, 'pokeballs', 3, c.sector);
      else if (NX.WEAPONS[id]) dropItem(c.x, c.y, 'weapon', 1, c.sector, { weapon: id });
      else if (NX.MOUNTS[id]) dropItem(c.x, c.y, 'mount', 1, c.sector, { mount: id });
      else if (NX.RELICS[id]) dropItem(c.x, c.y, 'relic', 1, c.sector, { relic: id });
    }
    if (again) return;
    const coins = Math.round(randi(8, 20) * f * C.economy.coinMult * (gold ? 3 : 1));
    for (let i = 0; i < 4; i++) dropItem(c.x, c.y, 'coin', Math.ceil(coins / 4), c.sector);
    const r = Math.random();
    if (r < 0.35) dropItem(c.x, c.y, 'heart', 1, c.sector);
    else if (r < 0.6) dropItem(c.x, c.y, 'pokeballs', 2, c.sector);
    else if (r < 0.78) dropItem(c.x, c.y, 'grenade', 1, c.sector);
    else if (r < 0.88) dropItem(c.x, c.y, 'mushroom', 1, c.sector);
    else if (r < 0.95) dropItem(c.x, c.y, 'star', 1, c.sector);
    else dropItem(c.x, c.y, 'extralife', 1, c.sector);
  }

  // ---------- Interactions (NPCs, campaign sites, altar) ----------
  // Sites are prompted even when locked: touch players only get a TALK button when prompt() is non-null.
  function nearestInteractable(maxD = 56) {
    let best = null, bd = maxD;
    for (const e of ents) if ((e.kind === 'npc' || e.kind === 'site') && !e.dead) { const d = dist(e, P); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  const NPC_VERB = { curator: 'Talk', shop: 'Shop', garage: 'Garage', score: 'Scoreboard', gunter: 'Talk', anorak: 'Talk' };
  Game.prompt = () => {
    if (!G || dead || victory) return null;
    const n = nearestInteractable();
    if (n) return { x: n.x, y: n.y - 30, text: n.kind === 'site' ? (n.role === 'cabinet' ? 'Play' : 'Gate') : NPC_VERB[n.role] || 'Talk' };
    const altar = { x: (HALF + 0.5) * TS, y: (HALF + 0.5) * TS };
    if (isHub(P.x, P.y) && dist(P, altar) < 60) return { x: altar.x, y: altar.y - 30, text: G.egg ? 'The Egg' : 'Altar' };
    return null;
  };
  function interact() {
    const n = nearestInteractable();
    if (n && n.kind === 'site') { if (n.role === 'cabinet') cabinetInteract(n); else gateInteract(n); return; }
    if (n) { NX.UI.talk(n); return; }
    const altar = { x: (HALF + 0.5) * TS, y: (HALF + 0.5) * TS };
    if (isHub(P.x, P.y) && dist(P, altar) < 60) altarInteract();
  }
  // The hub altar only reports progress now; the Egg waits at Anorak's altar.
  function altarInteract() {
    if (G.egg) { NX.UI.say('The Altar', ['The Egg is yours.']); return; }
    const keys = ACTS.filter((a) => G.keys[a]).length, gates = ACTS.filter((a) => isDone(a + '_gate')).length;
    NX.UI.say('The Altar', [`Keys ${keys}/3 · Gates ${gates}/3`, `Next: ${Game.objective().text.replace(/^▶\s*/, '')}`]);
  }
  Game.altarInteract = altarInteract;

  function cabinetInteract(e) {
    const id = `${e.act}_clue_${e.index}`;
    if (stageId() === id && !trial) { startTrial('clue', e.act, e.index); return; }
    if (trial) { NX.UI.toast('Finish your current trial first.', '#ff6a6a'); return; }
    NX.UI.say('Arcade Cabinet', [isDone(id) ? 'Already solved — your initials are on the high-score table.' : 'This cabinet is dark — solve the earlier cabinets first.']);
  }
  function gateInteract(e) {
    const id = e.act + '_gate', who = `The ${actWord(e.act)} Gate`;
    if (stageId() === id) {
      if (trial) { NX.UI.toast('Finish your current trial first.', '#ff6a6a'); return; }
      if (e.act !== 'crystal') { startTrial('gate', e.act, null); return; }
      if (riddleBlocked()) NX.UI.say(who, ['Clear the Sixers first.']);
      else NX.UI.riddle();   // -> Game.answerRiddle(i)
      return;
    }
    NX.UI.say(who, [isDone(id) ? 'The gate stands open.' : `The ${NX.KEYS[e.act].name} fits here — find it first.`]);
  }

  // Prices scale with the act you're in, so the shop stays relevant at d38.
  function actDist() {
    const id = stageId();
    if (stageIdx(id) >= stageIdx('castle_gens')) return CC.castleDist;
    return CC.keyDist[parseStage(id).act || 'copper'];
  }
  Game.price = (id) => {
    const base = C.economy.prices[id];
    if (base == null || !G || !(C.economy.scaledPrices || []).includes(id)) return base;
    return Math.round(base * (1 + C.world.difficultyPerSector * actDist()));
  };

  Game.buy = (id) => {
    const price = Game.price(id);
    if (id === 'delorean' && G.mounts.includes('delorean')) return 'You already own it.';
    if (id === 'blaster' && G.weapons.includes('blaster')) return 'You already own it.';
    if (id === 'extralife' && G.items.extralife >= lifeCap()) return 'Your pockets are full of quarters.';
    if (G.coins < price) return 'Not enough coins.';
    G.coins -= price;
    tel().tally('bought', id);
    switch (id) {
      case 'pokeballs': G.items.pokeballs += 3; break;
      case 'grenade': G.items.grenades += 2; break;
      case 'heal': G.hp = maxHp(); break;
      case 'extralife': G.items.extralife++; break;
      case 'blaster': G.weapons.push('blaster'); equip('blaster'); break;
      case 'delorean': G.mounts.push('delorean'); NX.UI.banner('NEW RIDE: DELOREAN', 'Press V to drive. Hit 88 mph.', '#c9ced6'); break;
    }
    Sound.play('coin');
    return undefined;
  };

  Game.revealRumor = () => {
    const hidden = Object.keys(W.raidSectors).filter((t) => !G.revealed[t] && !G.raids[t]);
    if (!hidden.length) return null;
    const th = pick(hidden);
    G.revealed[th] = true;
    const r = W.raidSectors[th];
    return { theme: th, boss: NX.ENEMIES[r.boss].name, sx: r.sx, sy: r.sy };
  };

  // Map warps and Mother Box boom tubes. Warping out abandons a running trial.
  Game.warp = (sx, sy) => warpTo(sx, sy, false);
  function warpTo(sx, sy, force) {
    const k = skey(sx, sy);
    if (!G || !W.inBounds(sx, sy)) return false;
    if (!force && !discovered.has(k) && !G.relics.motherbox) return false;
    if (trial) failTrial();
    const lp = W.landingPos(sx, sy);   // south road outside the moat/castle rings, else just below the gate
    const o = W.findOpen(Math.floor(lp.x / TS), Math.floor(lp.y / TS));
    P.x = (o.tx + 0.5) * TS; P.y = (o.ty + 0.5) * TS;
    shots = []; haz = [];
    cam.x = P.x; cam.y = P.y;
    if (NX.R3D && NX.R3D.ok) NX.R3D.snap();
    updateSectors(true); spawnPets();
    Sound.play('warp'); NX.UI.flash('#c9c3ff', 0.5);
    tel().add('warps');
    return true;
  }
  Game.isDiscovered = (sx, sy) => discovered.has(skey(sx, sy));
  Game.discoveredCount = () => discovered.size;

  // =====================================================================================
  // Campaign "The Three Gates" — docs/CAMPAIGN.md §6. Stage, cabinet, gate and trial states
  // are always DERIVED from G.quest.stage; there are no stored clue/gate/trial fields.
  // =====================================================================================

  // ---------- Stage machine (§6.1) ----------
  const defaultQuest = () => ({ stage: 'intro', generators: [false, false, false], castle: false, outro: false, ms: {}, first: false });
  const stageId = () => G.quest.stage;
  const stageIdx = (id) => STAGES.indexOf(id);
  const isDone = (id) => stageIdx(stageId()) > stageIdx(id);
  // 'jade_clue_1' -> { act: 'jade', kind: 'clue', index: 1 } · 'castle_gens' -> { act: null, kind: 'castle_gens', index: null }
  const parseStage = (id) => {
    const m = /^(copper|jade|crystal)_(clue|key|gate)(?:_(\d))?$/.exec(id || '');
    return m ? { act: m[1], kind: m[2], index: m[3] != null ? +m[3] : null } : { act: null, kind: id, index: null };
  };
  const actWord = (act) => act[0].toUpperCase() + act.slice(1);
  const canCross = () => G.mounts.includes('nimbus') || G.mounts.includes('elytra') || G.weapons.includes('portalgun');
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  Game.stageId = () => (G ? stageId() : null);
  Game.stageIdx = stageIdx;
  Game.isDone = (id) => !!G && isDone(id);

  // The single mutator. Does nothing unless `id` is the current stage.
  function advance(id) {
    if (!G || stageId() !== id) return;
    const t = Math.round(G.playTime);
    G.quest.ms[id] = t;
    tel().event('milestone', { id, level: G.level }); tel().set('ms_' + id, t); tel().set('lv_' + id, G.level);
    const next = STAGES[stageIdx(id) + 1] || 'done';
    G.quest.stage = next;
    if (CAMP.race.includes(id)) scoreboardCheck();
    onStageEnter(next, id);
    checkStage();
    Game.save();
  }
  // Idempotent: after every advance, pylon kill, castle-boss death and at the end of start().
  function checkStage() {
    if (!G) return;
    const id = stageId(), st = parseStage(id);
    if (id === 'castle_gens' && G.quest.generators.every(Boolean)) advance(id);
    else if (id === 'castle' && G.quest.castle) advance(id);
    else if (st.kind === 'key' && G.keys[st.act]) advance(id);
  }
  function onStageEnter(id, prev) {
    const st = parseStage(id), was = parseStage(prev);
    if (was.kind === 'gate') {
      // A gate just opened: its line, then the next act's intro (or the castle reveal), then the debrief.
      const A = CAMP.acts[was.act];
      (async () => {
        await NX.UI.say(`The ${actWord(was.act)} Gate`, [Game.fmtQuest(A.gateDone)]);
        if (!G) return;
        if (st.act) {
          await NX.UI.say('The Curator ◈ transmission', CAMP.acts[st.act].intro.map((l) => Game.fmtQuest(l)));
          if (G) NX.UI.debrief('gate_' + was.act);
        } else {
          const rv = CAMP.castle.reveal;
          NX.UI.banner(rv.title, Game.fmtQuest(rv.sub, W.quest.castle), '#ff2a4a');
          Sound.play('boss'); shake(16);
          setTimeout(() => G && NX.UI.debrief('gate_' + was.act), 4000);
        }
      })();
    }
    if (id === 'castle_gens') for (const k of active) { const [sx, sy] = k.split(',').map(Number); spawnPylon(sx, sy, k); }
    if (id === 'egg') NX.UI.toast('Anorak is waiting at the altar.', '#ff2a4a', 5);
    // Under-levelled for what comes next? Point at a raid boss for XP.
    const o = Game.objective();
    if (o.rec != null && G.level < o.rec - CC.recSlack) {
      const r = Game.revealRumor();
      if (r) NX.UI.toast(`Word is ${r.boss} is near ${r.sx}, ${r.sy} — good XP.`, '#ffd23f', 6);
    }
  }
  Game.questEvent = (name) => {
    if (!G) return;
    if (name === 'curator') advance('intro');
    else if (name === 'outro') {
      G.quest.outro = true;
      const c = W.quest.castle;
      spawnCastleExtras(skey(c.sx, c.sy));
      Game.save();
    }
  };

  // ---------- Site entities (§6.3, §6.6) ----------
  // { kind: 'site', role: 'cabinet'|'gatedoor', act, index, sector }. Done/open states are derived.
  function spawnSite(site, sx, sy, k) {
    const has = (f) => ents.some((e) => !e.dead && e.sector === k && f(e));
    if (site.type === 'clue') {
      if (!has((e) => e.kind === 'site')) ents.push(Object.assign({ kind: 'site', id: nid++, role: 'cabinet', act: site.act, index: site.index, r: 16, sector: k }, tileAt(sx, sy, HALF, HALF - 2)));
      if (isDone(`${site.act}_clue_${site.index}`)) addClueChest(site, sx, sy, k);
    } else if (site.type === 'gate') {
      if (!has((e) => e.kind === 'site')) ents.push(Object.assign({ kind: 'site', id: nid++, role: 'gatedoor', act: site.act, index: null, r: 16, sector: k }, tileAt(sx, sy, HALF, HALF - 4)));
    } else if (site.type === 'key') {
      // A guardian's key that was dropped but not picked up (this session) waits where it fell.
      const kd = keyDrops[site.act];
      if (kd && !G.keys[site.act] && !has((e) => e.kind === 'pickup' && e.item === 'key')) dropItem(kd.x, kd.y, 'key', 1, k, { key: site.act, vx: 0, vy: 0 });
    } else if (site.type === 'generator') spawnPylon(sx, sy, k);
    else if (site.type === 'castle') spawnCastleExtras(k);
  }
  // Won clue reward: a gold chest. It re-closes while its theme loot is still missing, so a Portal Gun
  // that was dropped and left behind can never softlock the jade moat.
  function addClueChest(site, sx, sy, k) {
    const cid = `clue:${site.act}:${site.index}`;
    if (ents.some((e) => e.kind === 'chest' && e.cid === cid)) return;
    const theme = W.themeOf(sx, sy), missing = (NX.THEMES[theme].loot || []).some((id) => id !== 'pokeballs' && !owns(id));
    ents.push(Object.assign({ kind: 'chest', id: nid++, cid, r: 14, open: opened.has(cid) && !missing, theme, sector: k, tier: 'gold', d: W.dist(sx, sy) }, tileAt(sx, sy, HALF + 2, HALF - 2)));
  }
  // IOI shield pylons, from castle_gens on, until destroyed. No 300 px guard: they're stationary objectives.
  function spawnPylon(sx, sy, k) {
    const site = W.siteAt(sx, sy);
    if (!site || site.type !== 'generator' || stageIdx(stageId()) < stageIdx('castle_gens')) return;
    const i = site.index;
    if (G.quest.generators[i] || ents.some((e) => e.generatorIndex === i && !e.dead)) return;
    const d = W.dist(sx, sy), c = centreOf(sx, sy);
    const g = makeEnemy('shieldgen', c.x, c.y - 3 * TS, k, d);
    g.generatorIndex = i; g.provoked = true;
    ents.push(g);
    for (let j = 0; j < 3 + Math.floor(d / 12); j++) {
      const q = openSpot(c.x, c.y, 3 * TS, 6 * TS);
      if (q) { const m = makeEnemy('sixer', q.x, q.y, k, d); m.provoked = true; ents.push(m); }
    }
  }
  function pylonDown(e) {
    G.quest.generators[e.generatorIndex] = true;
    const n = G.quest.generators.filter(Boolean).length;
    NX.UI.banner(`PYLON ${n}/3 DOWN`, n < 3 ? 'The shield flickers…' : CAMP.castle.name, '#ff9b3d');
    shake(12);
    if (n >= 3) {
      W.dropForcefield();
      NX.UI.banner(CAMP.castle.shieldDown, 'The castle is open', '#ff9b3d');
      shake(24); Sound.play('boom');
      for (const r of [320, 640, 960]) fx.push({ type: 'ring', x: P.x, y: P.y, r, color: '#ff9b3d', life: 1.5, max: 1.5, w: 5 });
    }
    checkStage();
    Game.save();
  }
  // Anorak (once the castle boss falls) and the Egg (after his outro). Never duplicates.
  function spawnCastleExtras(k) {
    const q = W.quest && W.quest.castle;
    if (!G || !q || skey(q.sx, q.sy) !== k || !active.has(k)) return;
    const here = (f) => ents.some((e) => !e.dead && e.sector === k && f(e));
    if (G.quest.castle && !here((e) => e.kind === 'npc' && e.role === 'anorak')) {
      ents.push(Object.assign({ kind: 'npc', id: nid++, role: 'anorak', look: 'anorak', r: 16, sector: k, theme: 'castle' }, tileAt(q.sx, q.sy, HALF, HALF - 2)));
    }
    if (stageId() === 'egg' && G.quest.outro && !G.egg && !here((e) => e.kind === 'pickup' && e.item === 'egg')) {
      const o = W.findOpen(q.sx * S + HALF, q.sy * S + HALF + 2);   // just south of the altar
      dropItem((o.tx + 0.5) * TS, (o.ty + 0.5) * TS, 'egg', 1, k, { vx: 0, vy: 0 });
    }
  }

  // ---------- Trials (§6.4) ----------
  // trial = { seq, kind: 'clue'|'gate', act, index, siteKey, cx, cy, arenaR, wave, waves, phase, twist, pellets, outT, ... }
  // Every trial foe carries trialId = trial.seq; a step is clear when none of them lives.
  const trialFoes = (t) => ents.filter((e) => e.trialId === t.seq && !e.dead);
  const pelletsLeft = (t) => t.pellets.reduce((n, [x, y]) => n + (W.tile(x, y) === T.PELLET), 0);
  const tagTrial = (e, t) => { e.trialId = t.seq; e.provoked = true; e.noFlee = true; return e; };
  function trialSpot(t) {
    const p = openSpot(t.cx, t.cy, 3 * TS, t.arenaR * TS, 40);
    if (p) return p;
    const o = W.findOpen(Math.floor(t.cx / TS), Math.floor(t.cy / TS) - 3);
    return { x: (o.tx + 0.5) * TS, y: (o.ty + 0.5) * TS };
  }
  function startTrial(kind, act, index) {
    const Q = W.quest[act], site = kind === 'clue' ? Q.clues[index] : Q.gate, A = CAMP.acts[act];
    const c = centreOf(site.sx, site.sy), d = W.dist(site.sx, site.sy), theme = W.themeOf(site.sx, site.sy);
    const t = {
      seq: ++trialSeq, kind, act, index, siteKey: skey(site.sx, site.sy), sx: site.sx, sy: site.sy, cx: c.x, cy: c.y, arenaR: CC.arena[kind],
      wave: 1, waves: 1, phase: 'wave', twist: null, pellets: null, outT: null,
      d, theme, steps: [], step: 0, pause: 0, meteorT: 0, color: A.color,
      title: kind === 'clue' ? `${NX.THEMES[theme].fandom} Cabinet` : `${actWord(act)} Gate`,
    };
    t.baseTitle = t.title;
    let sub;
    if (kind === 'clue') {
      t.twist = A.clueTrial.twist; sub = A.clueTrial.banner;
      if (t.twist === 'pellets') t.phase = 'pellets';
      else for (let i = 0; i < CC.clueWaves; i++) t.steps.push({ wave: true });
      if (t.twist === 'rift') { const pool = NX.THEME_LIST.filter((k) => k !== theme); t.riftTheme = pool[NX.hash(site.sx, site.sy, 77) % pool.length]; }
    } else {
      for (let i = 0; i < (CC.gateWaves[act] || 0); i++) t.steps.push({ wave: true });   // jade: none, a pure boss rush
      for (const b of A.gateTrial.bosses) t.steps.push({ echo: b });
      const nw = t.steps.filter((s) => s.wave).length, ne = t.steps.length - nw;
      sub = [nw ? `${nw} waves` : '', ne ? (ne === 1 ? 'an echo' : `${ne} echoes`) : ''].filter(Boolean).join(', then ') + ' — hold the circle';
    }
    t.waves = Math.max(1, t.steps.length);
    trial = t;
    tel().tally('trialStarts', stageId());
    NX.UI.banner(kind === 'clue' ? `CABINET ${index + 1}/3` : `THE ${act.toUpperCase()} GATE TRIAL`, sub, A.color);
    Sound.play('boss'); shake(8); ring(c.x, c.y, t.arenaR * TS, A.color, 0.8, 4);
    if (t.phase === 'pellets') startPellets(t); else runStep(t);
  }
  function runStep(t) {
    const s = t.steps[t.step];
    t.wave = t.step + 1;
    if (!s) return;
    if (s.echo) { spawnEcho(t, s.echo); return; }
    t.phase = 'wave'; t.title = t.baseTitle; t.meteorT = 1.5;
    const n = randi(CC.waveSize[0], CC.waveSize[1]) + Math.floor(t.d / CC.waveSizePerSectors);
    const rift = t.twist === 'rift' && t.step >= 1 ? NX.THEMES[t.riftTheme] : null;   // copper twist: waves 2-3 leak in from another world
    if (rift && t.step === 1) { NX.UI.banner(NX.EVENTS.rift.banner, `${rift.fandom} is spilling into this cabinet`, rift.map); Sound.play('warp'); }
    for (let i = 0; i < n; i++) {
      const p = trialSpot(t);
      const type = t.kind === 'clue' ? NX.weighted((rift || NX.THEMES[t.theme]).enemies)
        : Math.random() < 0.25 ? 'sixer' : NX.weighted(NX.THEMES[pick(NX.THEME_LIST)].enemies);
      ents.push(tagTrial(makeEnemy(type, p.x, p.y, t.siteKey, t.d), t));
      if (rift) ring(p.x, p.y, 36, rift.map, 0.8);
    }
    if (t.step > 0) NX.UI.toast(`Wave ${t.wave}/${t.waves}`, t.color);
  }
  // An echo: a past boss at echoHpMult HP. Boss bar + event suppression via bosses['trial:'+siteKey];
  // never touches G.revealed and drops no key, relic or egg.
  function spawnEcho(t, type) {
    const p = trialSpot(t), e = tagTrial(makeEnemy(type, p.x, p.y, t.siteKey, t.d), t);
    e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * (CC.echoHpMult[t.act] || 1)));
    e.echo = true;
    ents.push(e); bosses['trial:' + t.siteKey] = e;
    t.phase = 'echo'; t.title = `Echo of ${e.def.name}`;
    tel().tally('bossAttempts', 'echo:' + type);
    NX.UI.banner(`ECHO OF ${e.def.name.toUpperCase()}`, 'Gate Trial', e.def.color || t.color);
    Sound.play('boss'); shake(14); ring(p.x, p.y, 60, e.def.color || '#fff', 0.8, 4);
  }
  // Crystal twist: a dot board around the cabinet, four ghosts that keep coming back.
  function startPellets(t) {
    const tx0 = t.sx * S + HALF, ty0 = t.sy * S + HALF, R = CC.pelletRadius, corner = (i, j) => Math.abs(i) === 4 && Math.abs(j) === 4;
    t.pellets = []; t.powers = []; t.ghosts = {};
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      if ((i + j) % 2 !== 0 || Math.hypot(i, j) > R || corner(i, j) || (i === 0 && j === -2)) continue;   // (0,-2) = the cabinet
      const x = tx0 + i, y = ty0 + j, tt = W.tile(x, y);
      if (tt === T.GATE || NX.SOLID.has(tt)) continue;
      W.setTile(x, y, T.PELLET); t.pellets.push([x, y]);
    }
    for (const [i, j] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      const x = tx0 + i, y = ty0 + j, tt = W.tile(x, y);
      if (tt !== T.GATE && !NX.SOLID.has(tt)) { W.setTile(x, y, T.POWER); t.powers.push([x, y]); }
    }
    for (const g of ['blinky', 'pinky', 'inky', 'clyde']) spawnGhost(t, g);
  }
  function spawnGhost(t, type) {
    const p = trialSpot(t), e = tagTrial(makeEnemy(type, p.x, p.y, t.siteKey, t.d), t);
    if (P.power > 0) e.scared = P.power;
    ents.push(e); t.ghosts[type] = { e, at: null };
    ring(p.x, p.y, 30, e.def.color || '#fff', 0.6);
  }
  function dropMeteors(t) {
    const dmg = Math.round(3 * (1 + C.world.dmgPerSector * t.d));
    for (let i = 0; i < CC.meteorCount; i++) {
      const p = openSpot(t.cx, t.cy, 0, t.arenaR * TS);
      if (p) haz.push({ type: 'meteor', x: p.x, y: p.y, warn: 1.2, r: 46, dmg, src: 'meteor' });
    }
  }
  function updateTrial(dt) {
    const t = trial;
    if (!t) return;
    if (!active.has(t.siteKey)) { failTrial(); return; }   // its foes were just unloaded with the sector
    // Leaving: (arenaR + trialLeaveTiles) tiles out for trialLeaveSec seconds fails the trial.
    if (Math.hypot(P.x - t.cx, P.y - t.cy) > (t.arenaR + CC.trialLeaveTiles) * TS) {
      t.outT = t.outT == null ? CC.trialLeaveSec : t.outT - dt;
      if (t.outT <= 0) { failTrial(); return; }
    } else t.outT = null;
    // Leash: foes that stray are pulled back into the arena.
    const foes = trialFoes(t), leash = (t.arenaR + CC.trialLeash) * TS;
    for (const e of foes) if (Math.hypot(e.x - t.cx, e.y - t.cy) > leash) { const q = trialSpot(t); e.x = q.x; e.y = q.y; }
    if (t.phase === 'pellets') {
      for (const g of Object.keys(t.ghosts)) {
        const gh = t.ghosts[g];
        if (!gh.e.dead) continue;
        if (gh.at == null) gh.at = time + 3; else if (time >= gh.at) spawnGhost(t, g);
      }
      if (!pelletsLeft(t)) winTrial();
      return;
    }
    if (foes.length) {
      if (t.twist === 'meteors' && t.phase === 'wave' && (t.meteorT -= dt) <= 0) { t.meteorT = CC.meteorEvery; dropMeteors(t); }
      return;
    }
    if (t.step + 1 >= t.steps.length) { winTrial(); return; }
    if ((t.pause += dt) < 1.2) return;   // a breath between waves
    t.pause = 0; t.step++;
    runStep(t);
  }
  function endTrial(t) {
    for (const e of trialFoes(t)) { e.dead = true; burst(e.x, e.y, '#9aa0c0', 10, 120); }
    delete bosses['trial:' + t.siteKey];
    trial = null;
  }
  function winTrial() {
    const t = trial;
    if (!t) return;
    endTrial(t);
    if (t.pellets) for (const [x, y] of t.pellets) if (W.tile(x, y) === T.PELLET) W.setTile(x, y, T.FLOOR);
    const xp = Math.round(CC.trialBonusLevels * xpNeed(G.level));
    gainXp(xp);
    NX.UI.toast(`TRIAL CLEAR +${xp} XP`, '#5bff9a', 4);
    tel().tally('trialWins', stageId());
    Sound.play('chest'); ring(t.cx, t.cy, t.arenaR * TS, t.color, 0.9, 5);
    if (t.kind === 'clue') {
      advance(`${t.act}_clue_${t.index}`);
      addClueChest({ act: t.act, index: t.index }, t.sx, t.sy, t.siteKey);
      NX.UI.say('The cabinet screen', [Game.fmtQuest(CAMP.acts[t.act].clues[t.index])]);
    } else advance(t.act + '_gate');
  }
  function failTrial() {
    const t = trial;
    if (!t) return;
    endTrial(t);
    for (const [x, y] of [...(t.pellets || []), ...(t.powers || [])]) { const tt = W.tile(x, y); if (tt === T.PELLET || tt === T.POWER) W.setTile(x, y, T.FLOOR); }
    NX.UI.toast('Trial failed — the cabinet resets.', '#ff6a6a', 4);
    tel().tally('trialFails', stageId());
  }
  Game.trial = () => {
    const t = trial;
    if (!t) return null;
    return { title: t.title, wave: t.wave, waves: t.waves, left: t.phase === 'pellets' ? pelletsLeft(t) : trialFoes(t).length, kind: t.kind, twist: t.twist, outT: t.outT == null ? null : Math.max(0, Math.ceil(t.outT)) };
  };

  // ---------- The Final Riddle (crystal gate) ----------
  const riddleBlocked = () => ents.some((e) => e.riddleSquad && !e.dead);
  Game.riddleState = () => ({ blocked: riddleBlocked() });
  Game.answerRiddle = (i) => {
    if (!G || stageId() !== 'crystal_gate' || trial || riddleBlocked()) return undefined;
    const R = CAMP.finalRiddle;
    if (i === R.answer) { NX.UI.toast(R.right, '#bdf4ff', 5); startTrial('gate', 'crystal', null); return true; }
    NX.UI.toast(R.wrong, '#ff6a6a', 5); Sound.play('hurt');
    // A wrong answer summons an IOI squad; the gate stays shut while any of them lives. No other lockout.
    const g = W.quest.crystal.gate, k = skey(g.sx, g.sy), d = W.dist(g.sx, g.sy);
    const door = ents.find((e) => e.kind === 'site' && e.role === 'gatedoor' && e.sector === k) || tileAt(g.sx, g.sy, HALF, HALF - 4);
    for (let j = 0; j < 4; j++) {
      const p = openSpot(door.x, door.y, 3 * TS, 8 * TS);
      if (p) { const m = makeEnemy('sixer', p.x, p.y, k, d); m.provoked = true; m.riddleSquad = true; ents.push(m); ring(p.x, p.y, 30, '#ff9b3d'); }
    }
    return false;
  };

  // ---------- Guidance (§6.7) ----------
  const DIRS = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  const compass = (from, to) => {   // screen-up = north = -y
    const dx = to.sx - from.sx, dy = to.sy - from.sy;
    return dx || dy ? DIRS[(Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) + 8) % 8] : 'here';
  };
  // The dashed hint circle around a cabinet is offset from it by a stable hashed jitter in [-1, 1].
  const clueCentre = (s) => ({ sx: s.sx + (NX.hash(s.sx, s.sy, 61) % 3) - 1, sy: s.sy + (NX.hash(s.sx, s.sy, 62) % 3) - 1 });
  const recLevel = (d) => Math.max(1, Math.round((CC.comfortHits * CC.avgBaseHit * (1 + C.world.dmgPerSector * d) - C.player.maxHp) / C.player.hpPerLevel + 1));
  Game.recLevel = recLevel;
  Game.fmtQuest = (str, target) => {
    if (str == null) return '';
    const p = sectorOf(P.x, P.y);
    let t = target;
    if (!t) { const o = G ? Game.objective() : null; t = o && o.sx != null ? o : p; }
    const name = G ? G.name : 'Gunter';
    return String(str).replace(/\{name\}/g, () => name).replace(/\{n\}/g, () => cheb(p, t)).replace(/\{dir\}/g, () => compass(p, t))
      .replace(/\{x\}/g, () => t.sx).replace(/\{y\}/g, () => t.sy);
  };
  // The real site behind a stage (not the hint circle): used for distances, markers and debug warps.
  function stageSite(id) {
    const Q = W.quest, st = parseStage(id);
    if (st.kind === 'clue') return Q[st.act].clues[st.index];
    if (st.kind === 'key' || st.kind === 'gate') return Q[st.act][st.kind];
    if (id === 'castle_gens') {
      const p = sectorOf(P.x, P.y), left = Q.castle.generators.filter((g, i) => !G.quest.generators[i]);
      return left.sort((a, b) => cheb(p, a) - cheb(p, b))[0] || Q.castle;
    }
    if (id === 'castle' || id === 'egg') return Q.castle;
    return id === 'intro' ? { sx: 0, sy: 0 } : null;
  }
  Game.objective = () => {
    const o = { text: '', sx: null, sy: null, r: 0, riddle: null, rec: null };
    if (!G || !W.quest) return o;
    const id = stageId(), st = parseStage(id), A = st.act ? CAMP.acts[st.act] : null, p = sectorOf(P.x, P.y);
    const at = (s, r = 0) => { o.sx = s.sx; o.sy = s.sy; o.r = r; };
    let site = stageSite(id);
    if (id === 'intro') { at(site); o.text = '▶ Talk to the Curator at Nexus Prime'; }
    else if (st.kind === 'clue') {
      const c = clueCentre(site);
      at(c, CC.hintRadius);
      o.text = p.sx === site.sx && p.sy === site.sy ? '▶ Play the arcade cabinet'
        : cheb(p, c) <= o.r ? '▶ Match the riddle to a map colour'
          : Game.fmtQuest(`▶ Cabinet ${st.index + 1}/3 — {n} sectors {dir}`, c);
      o.riddle = st.index ? A.clues[st.index - 1] : A.intro[A.intro.length - 1];
    } else if (st.kind === 'key') {
      o.riddle = A.clues[2];
      if (st.act === 'jade' && !canCross()) { site = W.quest.jade.clues[2]; at(site); o.text = '▶ Cross the data-moat: Nimbus 2000 · Elytra · Portal Gun'; }
      else { const k = NX.KEYS[st.act]; at(site); o.text = `▶ Defeat ${NX.ENEMIES[k.boss].name} for the ${k.name}`; }
    } else if (st.kind === 'gate') { at(site); o.text = `▶ Open the ${actWord(st.act)} Gate`; o.riddle = Game.fmtQuest(A.gateIntro, site); }
    else if (id === 'castle_gens') { at(site); o.text = `▶ Destroy the IOI shield pylons (${G.quest.generators.filter(Boolean).length}/3)`; o.riddle = CAMP.castle.intro[1]; }
    else if (id === 'castle') { at(site); o.text = '▶ Breach Anorak’s Castle'; o.riddle = CAMP.castle.intro[2]; }
    else if (id === 'egg') { at(site); o.text = G.quest.outro ? '▶ Take the Egg' : '▶ Speak with Anorak'; }
    else { o.text = 'Egg found! Hunt raid bosses for relics.'; return o; }
    o.rec = recLevel(W.dist(site.sx, site.sy));
    if (G.level < o.rec - CC.recSlack) o.text += ` · LV ${o.rec} advised`;
    return o;
  };
  // Map markers: the current target (with its hint radius), finished sites, discovered future cabinets
  // (dim), pylons from castle_gens on, and the castle once the Crystal Gate is open.
  Game.questMarkers = () => {
    const out = [];
    if (!G || !W.quest) return out;
    const Q = W.quest, id = stageId(), o = Game.objective();
    const mk = (s, kind, act, done, current, label, color, r = 0) => out.push({ sx: s.sx, sy: s.sy, r, kind, act, done, current, label, color });
    for (const act of ACTS) {
      const A = CAMP.acts[act], key = NX.KEYS[act];
      Q[act].clues.forEach((s, i) => {
        const sid = `${act}_clue_${i}`, label = `Cabinet ${i + 1}`;
        if (id === sid) mk(o, 'clue', act, false, true, label, A.color, o.r);
        else if (isDone(sid)) mk(s, 'clue', act, true, id === act + '_key' && o.sx === s.sx && o.sy === s.sy, label, A.color);
        else if (discovered.has(skey(s.sx, s.sy))) mk(s, 'clue', act, false, false, label, A.color);
      });
      if (id === act + '_key') mk(Q[act].key, 'key', act, false, true, key.name, key.color);
      else if (isDone(act + '_key')) mk(Q[act].key, 'key', act, true, false, key.name, key.color);
      if (id === act + '_gate') mk(Q[act].gate, 'gate', act, false, true, `${actWord(act)} Gate`, A.color);
      else if (isDone(act + '_gate')) mk(Q[act].gate, 'gate', act, true, false, `${actWord(act)} Gate`, A.color);
    }
    if (stageIdx(id) >= stageIdx('castle_gens')) Q.castle.generators.forEach((g, i) => mk(g, 'generator', null, G.quest.generators[i], id === 'castle_gens' && !G.quest.generators[i], `Pylon ${i + 1}`, '#ff9b3d'));
    if (isDone('crystal_gate')) mk(Q.castle, 'castle', null, isDone('egg'), id === 'castle' || id === 'egg', CAMP.castle.name, NX.THEMES.castle.map);
    return out;
  };

  // ---------- Rivals and rank (§6.8) ----------
  // Rivals follow a schedule, rubber-banded to within one milestone of the player either way.
  const rivalAt = (r, i) => CC.milestoneMinutes[CAMP.race[i]] * r.paceMult * CC.targetHours / 12 / C.rivals.pace;
  const raceProgress = () => CAMP.race.reduce((n, id) => n + (isDone(id) ? 1 : 0), 0);
  function rivalShown(r, p) {
    let sched = 0;
    for (let i = 0; i < CAMP.race.length; i++) if (G.playTime / 60 >= rivalAt(r, i)) sched++;
    return Math.min(CAMP.race.length, clamp(sched, Math.max(0, p - 1), p + 1));
  }
  function rivalsCheck() {
    if (G.egg) return;   // rivals never take the Egg; after yours, they stop reporting
    const p = raceProgress();
    for (const r of NX.RIVALS) {
      const was = G.rivals[r.name] || 0, now = rivalShown(r, p);
      if (now <= was) continue;
      for (let j = was; j < now; j++) NX.UI.toast(`📡 ${r.name} ${CAMP.raceLabels[j]}!`, r.color, 5);
      G.rivals[r.name] = now;
    }
  }
  function scoreboardCheck() {
    const p = raceProgress();
    if (G.quest.first || !p || !NX.RIVALS.every((r) => rivalShown(r, p) < p)) return;
    G.quest.first = true;
    NX.UI.banner('#1 ON THE SCOREBOARD', `${CAMP.raceShort[p - 1]} · ahead of every rival`, '#ffd23f');
    const say = (name, line) => { const r = NX.RIVALS.find((x) => x.name === name); if (r) NX.UI.toast(`📡 ${name}: ${line}`, r.color, 6); };
    say('Artemis', `Who is ${G.name}, and why are they ahead of me?`);
    say('IOI-655321', 'Noted. Escalating.');
  }
  const eggRank = () => {
    const t = (G.quest.ms.crystal_gate != null ? G.quest.ms.crystal_gate : G.playTime) / 60;
    return 1 + NX.RIVALS.filter((r) => rivalAt(r, 5) < t).length;
  };
  Game.playerRaceProgress = () => (G ? raceProgress() : 0);
  Game.rivalStatus = () => {
    if (!G) return [];
    const p = raceProgress();
    return NX.RIVALS.map((r) => {
      const shown = Math.max(G.rivals[r.name] || 0, rivalShown(r, p));
      return { name: r.name, color: r.color, progress: shown, label: CAMP.raceShort[shown - 1] || 'Starting out', corp: !!r.corp };
    });
  };

  // ---------- Telemetry (§6.9) ----------
  Game.campaignInfo = () => {
    const ids = [...CAMP.race, 'egg'];
    const dist = ids.map((id) => { const s = stageSite(id === 'castle_gens' ? 'castle' : id); return W.dist(s.sx, s.sy); });
    return { targetHours: CC.targetHours, ids, minutes: ids.map((id) => Math.round(CC.milestoneMinutes[id] * CC.targetHours / 12)), dist, rec: dist.map(recLevel) };
  };

  // ---------- Enemy AI ----------
  function nearestEnemy(from, maxD, filter) {
    let best = null, bd = maxD;
    for (const e of ents) {
      if (e.kind !== 'enemy' || e.dead || e.capturing) continue;
      if (filter && !filter(e)) continue;
      const d = dist(from, e);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function enemyTarget(e) {
    const aggro = C.combat.aggroRange * (G.relics.cloak ? 0.5 : 1) * (e.def.boss ? 3 : 1);
    if (dead) return null;
    let best = dist(e, P) < aggro || (e.provoked && dist(e, P) < aggro * 1.8) ? P : null, bd = best ? dist(e, P) : aggro;
    for (const p of ents) if (p.kind === 'pet' && !p.dead) { const d = dist(e, p); if (d < bd * 0.8) { bd = d; best = p; } }
    return best;
  }
  function enemyShoot(e, tgt, angleOverride) {
    const d = e.def, s = d.shot || { speed: 240, color: d.color || '#ff3030', r: 5 };
    const a = angleOverride != null ? angleOverride : angleTo(e, tgt) + rand(-1, 1) * (d.jitter || 0.1);
    fireShot(e.x, e.y - 4, a, { speed: s.speed, dmg: e.dmg, color: s.color, r: s.r || 4, kind: s.kind || 'bolt', team: 'enemy', src: e.type, life: 2.5 });
    if (Math.random() < 0.5) Sound.play('enemyShot');
    if (d.shout && (!e.shoutT || e.shoutT < time) && Math.random() < 0.35) { e.shoutT = time + 6; text(e.x, e.y - e.r - 14, d.shout, '#ffe9a0', 11, 1.6); }
  }

  function updateEnemy(e, dt) {
    const d = e.def;
    e.t += dt; e.flash = Math.max(0, e.flash - dt); e.cd -= dt;
    e.root = Math.max(0, e.root - dt);
    if (e.scared > 0) e.scared -= dt;
    if (d.shield && e.shieldHp < d.shield) { e.shieldT -= dt; if (e.shieldT <= 0) e.shieldHp = Math.min(d.shield, e.shieldHp + dt * 2); }
    if (e.stun > 0) { e.stun -= dt; return; }
    const mode = d.passWalls || d.ai === 'ghost' ? 'ghost' : e.flying ? 'fly' : 'walk';
    const tgt = enemyTarget(e);
    const step = (a, sp) => {
      if (e.root > 0 || !sp) return;
      const r = moveCircle(e, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, mode);
      if (Math.abs(Math.cos(a)) > 0.2) e.face = Math.cos(a) > 0 ? 1 : -1;
      e.walk += dt * 10;
      if (r.hx || r.hy) e.wa = Math.random() * 6.28;
    };
    const wander = () => { e.wt -= dt; if (e.wt <= 0) { e.wt = rand(1, 3); e.wa = Math.random() * 6.28; } step(e.wa, e.speed * 0.35); };
    if (d.teleport && tgt) {
      e.tpT -= dt;
      if (e.tpT <= 0) {
        e.tpT = d.teleport * rand(0.8, 1.3);
        const p = openSpot(tgt.x, tgt.y, 80, 150);
        if (p) { burst(e.x, e.y, '#222', 14); e.x = p.x; e.y = p.y; burst(e.x, e.y, '#222', 14); }
      }
    }
    // contact damage
    if (tgt && d.dmg > 0 && !e.shell && d.ai !== 'turret' && dist(e, tgt) < e.r + (tgt.r || 11)) {
      if (tgt === P) { hurtPlayer(e.dmg, e.type); if (d.slows) P.slow = d.slows; }
      else hurtPet(tgt, e.dmg);
    }
    // Power pellet / Ecto-1: ghosts flee and can be eaten
    if (e.scared > 0 && d.tag === 'ghost' && !d.boss) {
      step(angleTo(P, e), e.speed * 0.6);
      if (dist(e, P) < e.r + P.r) { G.score += 200; text(e.x, e.y - 10, '200', '#2121de', 14); Sound.play('pickup'); killEnemy(e, 'pellet'); }
      return;
    }
    switch (d.ai) {
      case 'critter':
        if (!e.provoked || !tgt) { wander(); break; }
        if (d.attack === 'charger') { charger(e, tgt, dt, step); break; }
        shooter(e, tgt, dt, step);
        break;
      case 'chaser':
        if (!tgt) { wander(); break; }
        step(angleTo(e, tgt) + Math.sin(e.t * 3 + e.id) * 0.3, e.speed);
        break;
      case 'shooter':
        if (!tgt) { wander(); break; }
        if (d.flees && !e.noFlee && !ents.some((o) => o !== e && o.kind === 'enemy' && !o.dead && dist(o, e) < 220)) { step(angleTo(tgt, e), e.speed * 1.2); if (Math.random() < dt) text(e.x, e.y - 22, 'AAAH!', '#ffb03a', 10, 0.6); break; }
        shooter(e, tgt, dt, step);
        break;
      case 'charger': if (!tgt) { e.state = 'idle'; wander(); break; } charger(e, tgt, dt, step); break;
      case 'flyer': {
        if (!tgt) { wander(); break; }
        const a = angleTo(e, tgt) + Math.sin(e.t * 2.5 + e.id) * 0.9;
        step(a, e.speed * (dist(e, tgt) > 90 ? 1 : -0.6));
        if (d.fire && e.cd <= 0 && dist(e, tgt) < 340) { e.cd = d.fire * rand(0.8, 1.2); enemyShoot(e, tgt); }
        break;
      }
      case 'ghost':
        if (!tgt) { wander(); break; }
        e.look = angleTo(e, tgt);
        step(angleTo(e, tgt), e.speed * 0.9);
        break;
      case 'turret':
        if (!tgt || !los(e, tgt)) { e.aim = null; break; }
        e.aim = angleTo(e, tgt);
        if (e.cd <= 0 && dist(e, tgt) < 380) {
          e.burstLeft = (e.burstLeft || 0) > 0 ? e.burstLeft - 1 : (d.burst || 1) - 1;
          e.cd = e.burstLeft > 0 ? 0.12 : (d.fire || 1.5) * (d.burst ? 4 : 1) * rand(0.8, 1.2);
          enemyShoot(e, tgt);
        }
        break;
      case 'exploder':
        if (e.fuse > 0) {
          e.fuse -= dt;
          if (e.fuse <= 0) { e.dead = true; explode(e.x, e.y, d.blast.r, d.blast.dmg * (1 + e.d * 0.05), 'enemy', true, e.type); }
          break;
        }
        if (!tgt) { wander(); break; }
        step(angleTo(e, tgt), e.speed);
        if (dist(e, tgt) < 44) { e.fuse = 1.0; Sound.play('wobble'); if (d.art === 'creeper') text(e.x, e.y - 22, 'sssss...', '#4fae4a', 11, 1); }
        break;
      case 'koopa':
        if (e.shell) {
          e.shellT -= dt; e.safeT -= dt;
          const r = moveCircle(e, e.svx * dt, e.svy * dt, 'walk');
          if (r.hx) e.svx *= -1; if (r.hy) e.svy *= -1;
          for (const o of ents) {
            if (o === e || o.kind !== 'enemy' || o.dead || dist(o, e) > o.r + e.r) continue;
            if (!o.shellHit || o.shellHit < time) { o.shellHit = time + 0.4; damageEnemy(o, 4 * dmgMult(), { weapon: 'koopashell', knock: 3, from: e }); }
          }
          if (e.safeT <= 0 && dist(e, P) < e.r + P.r) hurtPlayer(1, 'koopa');
          if (e.shellT <= 0) killEnemy(e, 'koopashell');
          break;
        }
        if (!tgt) { wander(); break; }
        step(angleTo(e, tgt), e.speed);
        break;
      case 'angel': {
        if (!tgt || tgt !== P) { e.observed = true; break; }
        const facing = Math.abs(angleDiff(P.aim, angleTo(P, e))) < 1.1;
        e.observed = facing && dist(e, P) < 700;
        if (!e.observed) step(angleTo(e, P), e.speed);
        break;
      }
      case 'boss': updateBoss(e, dt, step); break;
    }
  }

  function shooter(e, tgt, dt, step) {
    const d = e.def, dd = dist(e, tgt);
    if (d.speed) {
      if (dd > 230) step(angleTo(e, tgt), e.speed);
      else if (dd < 120) step(angleTo(tgt, e), e.speed * 0.8);
      else if (d.strafe || e.id % 2) step(angleTo(e, tgt) + Math.PI / 2 * (Math.sin(e.t * 0.7 + e.id) > 0 ? 1 : -1), e.speed * 0.6);
    }
    if (e.cd <= 0 && dd < 380 && (d.passWalls || los(e, tgt))) { e.cd = (d.fire || 1.5) * rand(0.8, 1.25); enemyShoot(e, tgt); }
  }
  function charger(e, tgt, dt, step) {
    e.st -= dt;
    switch (e.state) {
      case 'windup': e.flash = Math.floor(e.st * 20) % 2 ? 0.05 : 0; if (e.st <= 0) { e.state = 'dash'; e.st = 0.45; e.da = angleTo(e, tgt); } break;
      case 'dash': step(e.da, e.speed * 3.6); if (e.st <= 0) { e.state = 'rest'; e.st = 0.7; } break;
      case 'rest': if (e.st <= 0) e.state = 'idle'; break;
      default:
        step(angleTo(e, tgt), e.speed * 0.8);
        if (dist(e, tgt) < 220) { e.state = 'windup'; e.st = 0.5; }
    }
  }

  // ---------- Bosses ----------
  function updateBoss(e, dt, step) {
    const d = e.def, enraged = e.hp < e.maxHp * 0.5;
    if (!e.enragedShown && enraged) { e.enragedShown = true; NX.UI.toast(`${d.name} is ENRAGED!`, d.color); shake(8); }
    if (dead) return;
    // ongoing pattern state
    if (e.dashT > 0) {
      e.dashT -= dt;
      if (e.dashT <= 0.4 && !e.dashA) e.dashA = angleTo(e, P);
      if (e.dashA != null) moveCircle(e, Math.cos(e.dashA) * 620 * dt, Math.sin(e.dashA) * 620 * dt, d.passWalls || d.fly ? 'ghost' : 'walk');
      else e.flash = 0.05;
      if (e.dashT <= 0) e.dashA = null;
      return;
    }
    if (e.spiral > 0) {
      e.spiral -= dt; e.spT = (e.spT || 0) - dt;
      if (e.spT <= 0) { e.spT = enraged ? 0.06 : 0.09; e.spA = (e.spA || 0) + 0.33; for (const k of [0, Math.PI]) enemyShoot(e, null, e.spA + k); }
      return;
    }
    if (d.speed) {
      const dd = dist(e, P);
      if (dd > 200) step(angleTo(e, P), e.speed);
      else step(angleTo(e, P) + Math.PI / 2, e.speed * 0.5);
    }
    e.pt -= dt;
    if (e.pt > 0) return;
    e.pt = enraged ? 1.5 : 2.3;
    const pat = d.patterns[e.pi++ % d.patterns.length];
    const color = d.color, kind = d.shotKind || 'orb';
    const shoot = (a, speed = 220) => fireShot(e.x, e.y, a, { speed, dmg: e.dmg, color, r: 7, kind, team: 'enemy', src: e.type, life: 3 });
    switch (pat) {
      case 'boomerang':
        fireShot(e.x, e.y, angleTo(e, P), { speed: 380, dmg: e.dmg, color, r: 14, kind: 'saberthrow', team: 'enemy', src: e.type, boomer: true, range: 340, owner: e, life: 4 });
        Sound.play('saber'); break;
      case 'ring': { const n = enraged ? 24 : 16, off = Math.random(); for (let i = 0; i < n; i++) shoot(off + i * Math.PI * 2 / n, 200); Sound.play('enemyShot'); break; }
      case 'spread': { const a = angleTo(e, P), n = enraged ? 9 : 7; for (let i = 0; i < n; i++) shoot(a + (i - (n - 1) / 2) * 0.14, 260); break; }
      case 'dash': e.dashT = 0.9; e.dashA = null; break;
      case 'spiral': e.spiral = 2.2; break;
      case 'summon': {
        const minions = ents.filter((m) => m.owner === e.id && !m.dead).length;
        if (!d.summon || minions >= 8) { e.pt = 0.2; break; }
        for (let i = 0; i < (enraged ? 4 : 2); i++) {
          const p = openSpot(e.x, e.y, 50, 110);
          if (p) { const m = makeEnemy(d.summon, p.x, p.y, e.sector, e.d); m.owner = e.id; m.provoked = true; ents.push(m); ring(p.x, p.y, 30, color); }
        }
        break;
      }
      case 'teleport': {
        const p = openSpot(P.x, P.y, 160, 240);
        if (p) { burst(e.x, e.y, color, 24); e.x = p.x; e.y = p.y; burst(e.x, e.y, color, 24); Sound.play('warp'); }
        const a = angleTo(e, P); for (let i = 0; i < 5; i++) shoot(a + (i - 2) * 0.18, 250);
        break;
      }
      case 'laser': {
        const base = angleTo(e, P), list = enraged ? [base - 0.35, base, base + 0.35] : [base];
        for (const a of list) haz.push({ type: 'laser', x: e.x, y: e.y, a, len: 760, warn: 0.85, life: 0.5, width: 18, dmg: e.dmg + 1, color, src: e.type, owner: e });
        break;
      }
      case 'stomp':
        haz.push({ type: 'stomp', x: e.x, y: e.y, r: 10, speed: 300, max: enraged ? 460 : 360, dmg: e.dmg, color, src: e.type, hit: false });
        shake(12); Sound.play('boom');
        break;
    }
  }

  // Guardians and raid bosses appear when you step into their arena (13 tiles from the sector centre).
  // A key guardian only shows during its own <act>_key stage; before that the arena gives the act's keyHint.
  function bossCheck() {
    for (const k of active) {
      const [sx, sy] = k.split(',').map(Number);
      const site = W.siteAt(sx, sy), keyId = site && site.type === 'key' ? site.act : null, raidTheme = W.raidAt(sx, sy);
      if (site && site.type === 'castle') { castleBossCheck(sx, sy, k); continue; }
      if (!keyId && !raidTheme) continue;
      if (bosses[k] && !bosses[k].dead) continue;
      const c = centreOf(sx, sy), near = dist(P, c) <= 13 * TS;
      if (keyId) {
        if (stageId() !== keyId + '_key' || G.keys[keyId]) {
          if (near && !hinted.has(k) && stageIdx(stageId()) < stageIdx(keyId + '_key')) { hinted.add(k); NX.UI.say('The Curator ◈ transmission', [CAMP.acts[keyId].keyHint]); }
          continue;
        }
        if (ents.some((e) => e.kind === 'pickup' && e.sector === k && e.item === 'key')) continue;
      } else if (G.raids[raidTheme] || ents.some((e) => e.kind === 'pickup' && e.sector === k && e.item === 'relic')) continue;
      if (!near) continue;
      const type = keyId ? NX.KEYS[keyId].boss : NX.RAIDS[raidTheme].boss;
      const b = makeEnemy(type, c.x, c.y - 6 * TS, k, W.dist(sx, sy));
      b.keyId = keyId; b.raidTheme = raidTheme; b.provoked = true;
      ents.push(b); bosses[k] = b;
      // Blinky XL's twist: four big dots around his arena, re-laid every time he appears.
      if (keyId === 'crystal') for (const [i, j] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) W.setTile(sx * S + HALF + i, sy * S + HALF + j, T.POWER);
      bossIntro(b);
    }
  }
  // IOI-655321 holds the castle once the shield is down.
  function castleBossCheck(sx, sy, k) {
    if (stageId() !== 'castle' || G.quest.castle || (bosses.castle && !bosses.castle.dead)) return;
    const c = centreOf(sx, sy);
    if (dist(P, c) > 13 * TS) return;
    const b = makeEnemy(CAMP.castle.boss, c.x, c.y - 6 * TS, k, W.dist(sx, sy));
    b.castleBoss = true; b.provoked = true;
    ents.push(b); bosses.castle = b;
    bossIntro(b);
  }
  function bossIntro(b) {
    const rk = b.raidTheme || b.keyId;
    if (rk) G.revealed[rk] = true;
    tel().tally('bossAttempts', b.type);
    const role = b.keyId ? 'Guardian of the ' + NX.KEYS[b.keyId].name : b.castleBoss ? CAMP.castle.name : 'RAID BOSS';
    NX.UI.banner(b.def.name.toUpperCase(), `${b.def.fandom} · ${role}`, b.def.color || '#ff3030');
    Sound.play('boss'); shake(14);
    if (b.def.shout) setTimeout(() => G && !b.dead && text(b.x, b.y - b.r - 20, b.def.shout, '#fff', 14, 2.5), 900);
  }

  // ---------- World events ----------
  function maybeEvent() {
    if (G.playTime < nextEventAt) return;
    nextEventAt = G.playTime + rand(...C.events.everyMinutes) * 60;
    if (trial || isHub(P.x, P.y) || Game.bossList().length || dead) return;   // never during a trial
    const { sx, sy } = sectorOf(P.x, P.y), d = W.dist(sx, sy);
    const pool = Object.entries(NX.EVENTS).filter(([id, ev]) => !(ev.minDist && d < ev.minDist)).map(([id, ev]) => [id, ev.weight]);
    const id = NX.weighted(pool), ev = NX.EVENTS[id];
    tel().add('events'); tel().tally('eventsSeen', id);
    const k = curKey();
    switch (id) {
      case 'kaiju': {
        const p = openSpot(P.x, P.y, 420, 560, 40);
        if (!p) return;
        const b = makeEnemy('godzilla', p.x, p.y, k, d); b.provoked = true; b.event = true;
        ents.push(b); bosses['event:' + k] = b;
        NX.UI.banner(ev.banner, 'Defeat it for its Atomic Breath', '#4ad0ff');
        Sound.play('boss'); shake(20);
        setTimeout(() => G && !b.dead && text(b.x, b.y - 60, 'SKREEEEOONK!', '#fff', 18, 2), 600);
        return;
      }
      case 'rift': {
        const here = W.themeOf(sx, sy);
        const theme = pick(NX.THEME_LIST.filter((t) => t !== here));
        const th = NX.THEMES[theme];
        NX.UI.banner(ev.banner, `${th.fandom} is spilling into this sector`, th.map);
        for (let i = 0; i < randi(6, 9); i++) {
          const p = openSpot(P.x, P.y, 220, 380); if (!p) continue;
          const m = makeEnemy(NX.weighted(th.enemies), p.x, p.y, k, d); m.provoked = true; ents.push(m);
          ring(p.x, p.y, 36, th.map, 0.8);
        }
        Sound.play('warp');
        return;
      }
      case 'sixers':
        NX.UI.banner(ev.banner, 'IOI wants your keys', '#ff9b3d');
        for (let i = 0; i < 6; i++) { const p = openSpot(P.x, P.y, 320, 440); if (p) { const m = makeEnemy('sixer', p.x, p.y, k, d); m.provoked = true; ents.push(m); } }
        return;
      case 'meteors':
        NX.UI.banner(ev.banner, 'Watch for the red circles', '#ff6a3a');
        for (let i = 0; i < 22; i++) haz.push({ type: 'meteor', x: P.x + rand(-380, 380), y: P.y + rand(-300, 300), warn: 1.2 + i * 0.5, r: 46, dmg: 3, src: 'meteor' });
        return;
      case 'supply': {
        const p = openSpot(P.x, P.y, 120, 220); if (!p) return;
        NX.UI.banner(ev.banner, 'Go get it!', '#ffd23f');
        ents.push({ kind: 'chest', id: nid++, cid: 'evt' + Math.floor(G.playTime), x: p.x, y: p.y, r: 14, open: false, theme: W.themeOf(sx, sy), sector: k, tier: 'gold', d, drop: 1 });
        return;
      }
    }
  }

  // ---------- Update ----------
  Game.update = (dtReal) => {
    if (!G) return;
    const dt = Math.min(dtReal, 0.05);
    time += dt;
    G.playTime += dt;
    if (victory > 0) { victory -= dt; if (Math.random() < dt * 6) burst(P.x + rand(-300, 300), P.y + rand(-200, 100), `hsl(${randi(0, 360)},90%,60%)`, 40, 220, 4); updateFx(dt); if (victory <= 0) { victory = 0; NX.UI.victoryDone(); } return; }
    if (dead > 0) { dead -= dt; updateFx(dt); if (dead <= 0) { dead = 0; respawn(); } return; }

    const edt = dt * (P.bulletTime > 0 ? 0.35 : 1);   // world time (bullet time slows enemies)
    updatePlayer(dt);
    updateSectors();
    const { sx, sy } = sectorOf(P.x, P.y);
    tel().tally('themeTime', W.themeOf(sx, sy), dt);

    for (const e of ents) {
      if (e.dead) continue;
      if (e.kind === 'enemy') updateEnemy(e, edt);
      else if (e.kind === 'pet') updatePet(e, dt);
      else if (e.kind === 'pickup') updatePickup(e, dt);
      else if (e.kind === 'chest' && !e.open && dist(e, P) < 30) openChest(e);
    }
    updateShots(dt, edt);
    updateHazards(edt);
    if (bigBeam) {
      bigBeam.t -= dt;
      const end = beamEnd(P.x, P.y - 4, P.aim, 420);
      bigBeam.x1 = P.x; bigBeam.y1 = P.y - 4; bigBeam.x2 = end.x; bigBeam.y2 = end.y;
      beamHits(P.x, P.y, end.x, end.y, bigBeam.width, (e) => damageEnemy(e, bigBeam.dps * dt * dmgMult(), { weapon: 'kamehameha', silent: true }));
      if (bigBeam.t <= 0) bigBeam = null;
    }
    updateFx(dt);
    ents = ents.filter((e) => !e.dead);
    updateTrial(dt);
    comboT -= dt; if (comboT <= 0) combo = 0;

    // periodic systems
    respawnT -= dt;
    if (respawnT <= 0) {
      respawnT = 1;
      bossCheck(); maybeEvent();
      for (const rec of G.pets) if (rec.active && rec.downUntil && rec.downUntil <= G.playTime) { rec.downUntil = 0; addPet(rec); NX.UI.toast(`${NX.ENEMIES[rec.type].name} is back!`, '#5bff9a'); }
    }
    rivalT -= dt; if (rivalT <= 0) { rivalT = 3; rivalsCheck(); }
    saveT -= dt; if (saveT <= 0) { saveT = 20; Game.save(); }

    // camera
    cam.x += (P.x - cam.x) * Math.min(1, dt * 8);
    cam.y += (P.y - cam.y) * Math.min(1, dt * 8);
    cam.shake = Math.max(0, cam.shake - dt * 30);
  };

  function updatePet(p, dt) {
    p.t += dt; p.cd -= dt; p.iframes = Math.max(0, p.iframes - dt); p.flash = Math.max(0, (p.flash || 0) - dt);
    const d = p.def, mode = d.ai === 'ghost' || d.passWalls ? 'ghost' : p.flying ? 'fly' : 'walk';
    if (dist(p, P) > 700) { const q = openSpot(P.x, P.y, 30, 60); if (q) { p.x = q.x; p.y = q.y; } }
    const dmg = Math.max(1, (d.dmg || 1)) * (1 + 0.1 * G.level);
    const tgt = nearestEnemy(p, 300, (e) => dist(e, P) < 480);
    const step = (a, sp) => { moveCircle(p, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, mode); p.face = Math.cos(a) >= 0 ? 1 : -1; p.walk += dt * 10; };
    if (!tgt) { const dd = dist(p, P); if (dd > 70) step(angleTo(p, P), Math.max(120, d.speed * 1.3) * (dd > 200 ? 1.6 : 1)); return; }
    const ranged = !!d.shot && d.ai !== 'charger';
    if (d.ai === 'exploder') {
      step(angleTo(p, tgt), Math.max(100, d.speed * 1.2));
      if (dist(p, tgt) < 40) { explode(p.x, p.y, d.blast.r, 6 * (1 + 0.1 * G.level), 'player', false, 'pet'); p.dead = true; p.rec.downUntil = G.playTime + 20; }
      return;
    }
    if (ranged) {
      const dd = dist(p, tgt);
      if (dd > 220) step(angleTo(p, tgt), Math.max(90, d.speed));
      if (p.cd <= 0 && dd < 320) {
        p.cd = (d.fire || 1.5) * 0.9;
        fireShot(p.x, p.y - 4, angleTo(p, tgt), { speed: d.shot.speed, dmg, color: d.shot.color, r: d.shot.r || 4, kind: d.shot.kind || 'bolt', team: 'player', weapon: 'pet', life: 2 });
      }
    } else {
      step(angleTo(p, tgt), Math.max(100, (d.speed || 80) * 1.2));
      if (dist(p, tgt) < p.r + tgt.r + 4 && p.cd <= 0) { p.cd = 0.6; damageEnemy(tgt, dmg, { weapon: 'pet', knock: 1, from: p }); }
    }
  }

  function updatePickup(p, dt) {
    p.vx *= 0.9; p.vy *= 0.9;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (time - p.born < 0.4) return;
    const magnet = G.relics.chaosemerald ? 260 : 90, d = dist(p, P);
    if (d < magnet && (p.item === 'coin' || p.item === 'heart')) { const a = angleTo(p, P); p.x += Math.cos(a) * 380 * dt; p.y += Math.sin(a) * 380 * dt; }
    if (d < P.r + p.r + 4) collect(p);
  }

  function updateShots(dt, edt) {
    for (const s of shots) {
      const sdt = s.team === 'enemy' ? edt : dt;
      s.age += sdt;
      if (s.grenade) {
        const k = Math.min(1, s.age / s.flight), gx = s.gx0 + (s.gx1 - s.gx0) * k, gy = s.gy0 + (s.gy1 - s.gy0) * k;
        // lobbed over walls, but never through the IOI forcefield
        if (W.tile(Math.floor(gx / TS), Math.floor(gy / TS)) === T.FORCE) { s.dead = true; explode(s.x, s.y, 95, 9, 'player', true, 'grenade'); continue; }
        s.x = gx; s.y = gy;
        if (s.age >= s.life) { s.dead = true; explode(s.x, s.y, 95, 9, 'player', true, 'grenade'); }
        continue;
      }
      if (s.age > s.life) {
        if (s.portal != null) placePortal(s);
        s.dead = true; continue;
      }
      if (s.homing) { const tgt = nearestEnemy(s, 260); if (tgt) { const sp = Math.hypot(s.vx, s.vy), a = Math.atan2(s.vy, s.vx); const na = a + clamp(angleDiff(a, angleTo(s, tgt)), -s.homing * sdt, s.homing * sdt); s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp; } }
      if (s.curve && s.phase === 'out') { const sp = Math.hypot(s.vx, s.vy), a = Math.atan2(s.vy, s.vx) + s.curve * sdt; s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; }
      if (s.boomer && s.phase === 'back') {
        const home = s.owner || P;
        if (home.dead) { s.dead = true; continue; }
        const a = angleTo(s, home), sp = Math.max(300, Math.hypot(s.vx, s.vy));
        s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
        if (dist(s, home) < 24) { s.dead = true; continue; }
      }
      const nx = s.x + s.vx * sdt, ny = s.y + s.vy * sdt;
      // returning discs fly through walls, but nothing crosses the forcefield
      if (s.boomer && s.phase === 'back' && W.tile(Math.floor(nx / TS), Math.floor(ny / TS)) === T.FORCE) { s.dead = true; burst(s.x, s.y, '#ff9b3d', 5, 80, 2); continue; }
      s.dist += Math.hypot(s.vx, s.vy) * sdt;
      if (s.boomer && s.phase === 'out' && s.dist > s.range) { s.phase = 'back'; s.hit.clear(); }
      if (!(s.boomer && s.phase === 'back') && W.stopsShotAt(nx, ny)) {
        if (s.portal != null) { placePortal(s); s.dead = true; continue; }
        if (s.team === 'player') {
          const tx = Math.floor(nx / TS), ty = Math.floor(ny / TS), tt = W.tile(tx, ty);
          if (tt === T.QBLOCK || (s.breaks && tt === T.BREAK)) hitTile(tx, ty, false);
        }
        if (s.bounces > 0) {
          if (W.stopsShotAt(nx, s.y)) s.vx *= -1; else s.vy *= -1;
          s.bounces--;
          continue;
        }
        if (s.boomer) { s.phase = 'back'; s.hit.clear(); continue; }
        if (s.ball) { s.dead = true; dropItem(s.x, s.y, 'pokeballs', 1, curKey()); continue; }
        s.dead = true; burst(s.x, s.y, s.color || '#fff', 5, 80, 2); continue;
      }
      s.x = nx; s.y = ny;

      if (s.team === 'player') {
        for (const e of ents) {
          if (e.kind !== 'enemy' || e.dead || e.capturing || s.hit.has(e.id)) continue;
          if (dist(s, e) > s.r + e.r) continue;
          if (s.ball) { tryCapture(s, e); break; }
          if (s.portal != null) continue;
          s.hit.add(e.id);
          damageEnemy(e, s.dmg, { weapon: s.weapon, stun: s.stun, root: s.root, bonus: s.bonus, from: s, knock: 1 });
          if (s.kind === 'web') fx.push({ type: 'web', x: e.x, y: e.y, life: 0.5, max: 0.5 });
          if (s.lightning) chainLightning(e, s);
          if (s.ricochet > 0) {
            const next = nearestEnemy(e, 260, (o) => !s.hit.has(o.id) && o !== e);
            s.ricochet--;
            if (next) { const a = angleTo(s, next), sp = Math.hypot(s.vx, s.vy); s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; s.dist = 0; Sound.play('block'); }
            else { s.phase = 'back'; s.hit.clear(); }
            break;
          }
          if (s.boomer && !s.pierce) { s.phase = 'back'; break; }
          if (!s.pierce && !s.boomer) { s.dead = true; break; }
        }
      } else {
        if (!dead && dist(s, P) < s.r + P.r) { hurtPlayer(s.dmg, s.src); if (!s.boomer) s.dead = true; continue; }
        for (const p of ents) if (p.kind === 'pet' && !p.dead && dist(s, p) < s.r + p.r) { hurtPet(p, s.dmg); if (!s.boomer) s.dead = true; break; }
      }
    }
    shots = shots.filter((s) => !s.dead);
  }

  function chainLightning(from, s) {
    let cur = from; const hit = new Set([from.id]);
    for (let i = 0; i < s.lightning; i++) {
      const next = nearestEnemy(cur, 160, (o) => !hit.has(o.id));
      if (!next) break;
      fx.push({ type: 'bolt', x1: cur.x, y1: cur.y, x2: next.x, y2: next.y, life: 0.25, max: 0.25, color: '#9adcff' });
      hit.add(next.id);
      damageEnemy(next, s.dmg * 0.5, { weapon: s.weapon, stun: 0.3 });
      cur = next;
    }
    Sound.play('zap');
  }

  function placePortal(s) {
    // step back to the last open spot along the path
    const a = Math.atan2(s.vy, s.vx);
    let x = s.x, y = s.y;
    for (let i = 0; i < 6 && W.blocked(x, y, 10); i++) { x -= Math.cos(a) * 8; y -= Math.sin(a) * 8; }
    // still blocked (water, wall)? snap to the nearest open tile so a portal is always usable
    if (W.blocked(x, y, 10)) { const o = W.findOpen(Math.floor(x / TS), Math.floor(y / TS)); x = (o.tx + 0.5) * TS; y = (o.ty + 0.5) * TS; }
    ents = ents.filter((e) => !(e.kind === 'portal' && e.color === s.portal));
    ents.push({ kind: 'portal', id: nid++, x, y, r: 16, color: s.portal });
    ring(x, y, 30, s.portal ? '#ff9a1a' : '#3a9aff');
    Sound.play('warp');
  }

  function tryCapture(s, e) {
    s.dead = true;
    const d = e.def;
    if (d.noCatch || d.boss) { text(e.x, e.y - 20, d.boss ? 'Bosses can\'t be caught!' : 'Corporate property. No catching.', '#ff9b3d', 11); dropItem(e.x, e.y, s.master ? 'masterball' : 'pokeballs', 1, e.sector); return; }
    tel().add('catchAttempts'); tel().tally('catchAttempts', e.type);
    const frac = e.hp / e.maxHp;
    const chance = s.master ? 1 : clamp((frac <= C.combat.captureThreshold ? 0.75 : 0.1 + 0.4 * (1 - frac)) * (d.catchBonus || 1), 0.05, 0.98);
    e.capturing = true;
    fx.push({ type: 'capture', x: e.x, y: e.y, life: 1.6, max: 1.6, enemy: e, ok: Math.random() < chance });
    Sound.play('wobble');
  }
  function finishCapture(f) {
    const e = f.enemy;
    if (!f.ok) { e.capturing = false; e.provoked = true; text(e.x, e.y - 22, 'Broke free!', '#ff6a6a', 12); burst(e.x, e.y, '#fff', 10); return; }
    e.dead = true;
    const activeCount = G.pets.filter((p) => p.active).length;
    const rec = { type: e.type, active: activeCount < C.player.maxActivePets, at: Math.round(G.playTime) };
    G.pets.push(rec);
    tel().add('captures'); tel().tally('captured', e.type);
    NX.UI.banner(`GOTCHA! ${e.def.name.toUpperCase()}`, rec.active ? 'joined your squad' : 'sent to your PC (manage pets in the pause menu)', '#ff6a6a');
    Sound.play('caught');
    if (rec.active) addPet(rec);
    gainXp(Math.round(e.def.xp * e.lvl * (e.trialId != null ? CC.trialXpMult : 1)));
  }

  function updateHazards(dt) {
    for (const h of haz) {
      if (h.type === 'laser') {
        if (h.owner && !h.owner.dead) { h.x = h.owner.x; h.y = h.owner.y; }
        if (h.warn > 0) { h.warn -= dt; if (h.warn <= 0) { Sound.play('beam'); shake(6); } continue; }
        h.life -= dt;
        if (h.life <= 0) { h.dead = true; continue; }
        const dx = Math.cos(h.a), dy = Math.sin(h.a);
        const tt = clamp((P.x - h.x) * dx + (P.y - h.y) * dy, 0, h.len);
        if (Math.hypot(P.x - (h.x + dx * tt), P.y - (h.y + dy * tt)) < h.width / 2 + P.r) hurtPlayer(h.dmg, h.src);
      } else if (h.type === 'stomp') {
        h.r += h.speed * dt;
        if (!h.hit && Math.abs(dist(P, h) - h.r) < 14 && !(P.mount && NX.MOUNTS[P.mount].fly)) { h.hit = true; hurtPlayer(h.dmg, h.src); }
        if (h.r > h.max) h.dead = true;
      } else if (h.type === 'meteor') {
        h.warn -= dt;
        if (h.warn <= 0) {
          h.dead = true;
          explode(h.x, h.y, h.r, h.dmg, 'enemy', true, 'meteor');
          if (Math.random() < 0.45) dropItem(h.x, h.y, 'coin', randi(3, 8), curKey());
        }
      }
    }
    haz = haz.filter((h) => !h.dead);
  }

  function updateFx(dt) {
    for (const f of fx) {
      f.life -= dt;
      if (f.type === 'part') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.94; f.vy *= 0.94; }
      else if (f.type === 'text') f.y += f.vy * dt;
      else if (f.type === 'capture' && f.life <= 0) finishCapture(f);
      else if (f.type === 'capture') { const k = Math.floor((f.max - f.life) / 0.45); if (k !== f.k) { f.k = k; if (k > 0 && k < 4) Sound.play('wobble'); } }
    }
    fx = fx.filter((f) => f.life > 0);
  }

  // ---------- Drawing ----------
  Game.draw = (ctx) => {
    const { W: VW, H: VH } = NX.view;
    const ox = Math.round(cam.x - VW / 2 + (cam.shake ? rand(-1, 1) * cam.shake : 0));
    const oy = Math.round(cam.y - VH / 2 + (cam.shake ? rand(-1, 1) * cam.shake : 0));
    Game.view = { ox, oy };
    ctx.save();
    ctx.translate(-ox, -oy);
    drawTiles(ctx, ox, oy, VW, VH);
    drawHubHologram(ctx, ox, oy, VW, VH);

    // ground hazards
    for (const h of haz) {
      if (h.type === 'laser') {
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a);
        if (h.warn > 0) { ctx.fillStyle = `rgba(255,40,40,${0.15 + 0.15 * Math.sin(time * 30)})`; ctx.fillRect(0, -h.width / 2, h.len, h.width); }
        else { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = h.color; ctx.globalAlpha = 0.5; ctx.fillRect(0, -h.width, h.len, h.width * 2); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(0, -h.width / 4, h.len, h.width / 2); }
        ctx.restore();
      } else if (h.type === 'stomp') {
        ctx.strokeStyle = h.color; ctx.globalAlpha = 0.8; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (h.type === 'meteor' && h.warn < 1.4) {
        ctx.strokeStyle = 'rgba(255,60,30,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,60,30,0.18)'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (1 - h.warn / 1.4), 0, Math.PI * 2); ctx.fill();
        const fall = h.warn * 400; Art.circle(ctx, h.x + fall * 0.4, h.y - fall, 9, '#ff8a3a');
      }
    }
    for (const e of ents) if (e.kind === 'portal') {
      const col = e.color ? '#ff9a1a' : '#3a9aff';
      ctx.save(); ctx.translate(e.x, e.y); ctx.shadowColor = col; ctx.shadowBlur = 16;
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 13, 20, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill(); ctx.restore();
    }

    // sorted sprites
    const list = ents.filter((e) => e.kind !== 'portal' && e.x > ox - 80 && e.x < ox + VW + 80 && e.y > oy - 80 && e.y < oy + VH + 80);
    list.push(P);
    list.sort((a, b) => a.y - b.y);
    for (const e of list) {
      if (e === P) { if (!dead) drawPlayer(ctx); continue; }
      switch (e.kind) {
        case 'enemy': if (!e.capturing) { Art.enemy(ctx, e, time); drawHp(ctx, e); } break;
        case 'pet': Art.enemy(ctx, e, time); Art.heart(ctx, e.x, e.y - e.r - 14, 0.7, '#5bff9a'); break;
        case 'npc': Art.npc(ctx, e, time); break;
        case 'site': (Art.site || drawSiteFallback)(ctx, e, time); break;
        case 'chest': Art.chest(ctx, e); if (e.tier === 'gold' && !e.open) Art.circle(ctx, e.x, e.y - 4, 20, 'rgba(255,210,63,0.15)'); break;
        case 'pickup': Art.pickup(ctx, e, time); break;
      }
    }

    for (const s of shots) Art.shot(ctx, s, time);
    drawBeams(ctx);
    drawFx(ctx);
    ctx.restore();
  };

  // 3D mode: everything flat (numbers, name tags, health bars) is drawn on the 2D overlay.
  Game.drawOverlay = (ctx) => {
    const so = Game.screenOf;
    for (const e of ents) {
      if (e.kind !== 'enemy' || e.dead || e.capturing || e.def.boss || e.hp >= e.maxHp) continue;
      const p = so(e.x, e.y, (e.def.scale || 1) * 1.6);
      if (!p.visible) continue;
      const w = 34, x = p.x - w / 2, y = p.y;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
      ctx.fillStyle = e.hp / e.maxHp <= C.combat.captureThreshold ? '#ffd23f' : '#ff4a4a';
      ctx.fillRect(x, y, w * clamp(e.hp / e.maxHp, 0, 1), 4);
    }
    for (const e of ents) if (e.kind === 'pet' && !e.dead) { const p = so(e.x, e.y, 1.7); if (p.visible) Art.heart(ctx, p.x, p.y, 0.8, '#5bff9a'); }
    if (!dead) {
      const p = so(P.x, P.y, P.mount && NX.MOUNTS[P.mount].fly ? 2.9 : 2.0);
      ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(G.name).width + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(p.x - w / 2, p.y - 8, w, 15); ctx.fillStyle = '#fff'; ctx.fillText(G.name, p.x, p.y);
      if (P.charge > 0) {
        const q = so(P.x + Math.cos(P.aim) * 18, P.y + Math.sin(P.aim) * 18, 0.9), r = 6 + P.charge * 16;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        Art.circle(ctx, q.x, q.y, r + 10, 'rgba(95,200,255,0.3)'); Art.circle(ctx, q.x, q.y, r, '#dff6ff');
        ctx.restore();
      }
    }
    for (const f of fx) {
      if (f.type !== 'text') continue;
      const k = Math.max(0, f.life / f.max), p = so(f.x, f.y, 1.4);
      if (!p.visible) continue;
      ctx.globalAlpha = Math.min(1, k * 2); ctx.font = `900 ${f.size + 2}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(f.str, p.x, p.y); ctx.fillStyle = f.color; ctx.fillText(f.str, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  };

  function drawPlayer(ctx) {
    Art.player(ctx, P, time);
    // name tag
    ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; const w = ctx.measureText(G.name).width + 8;
    ctx.fillRect(P.x - w / 2, P.y - 44, w, 13); ctx.fillStyle = '#fff'; ctx.fillText(G.name, P.x, P.y - 32);
    // charge orb
    if (P.charge > 0) {
      const r = 4 + P.charge * 10, x = P.x + Math.cos(P.aim) * 16, y = P.y - 4 + Math.sin(P.aim) * 16;
      Art.circle(ctx, x, y, r + 6, 'rgba(95,200,255,0.3)'); Art.circle(ctx, x, y, r, '#dff6ff');
    }
    // aim indicator
    if (!P.mount || NX.MOUNTS[P.mount].attack) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P.x, P.y, 26, P.aim - 0.2, P.aim + 0.2); ctx.stroke();
    }
  }

  // 2D stand-in for a campaign site until js/art.js provides Art.site(ctx, e, t).
  function drawSiteFallback(ctx, e) {
    const col = CAMP.acts[e.act].color;
    if (e.role === 'cabinet') {
      ctx.fillStyle = '#1a1a2a'; ctx.fillRect(e.x - 11, e.y - 30, 22, 32);
      ctx.fillStyle = isDone(`${e.act}_clue_${e.index}`) ? '#5bff9a' : stageId() === `${e.act}_clue_${e.index}` ? '#ffd23f' : '#333';
      ctx.fillRect(e.x - 8, e.y - 25, 16, 11);
      ctx.fillStyle = col; ctx.fillRect(e.x - 11, e.y - 33, 22, 4);
    } else {
      ctx.strokeStyle = col; ctx.lineWidth = isDone(e.act + '_gate') ? 7 : 4;
      ctx.beginPath(); ctx.ellipse(e.x, e.y - 22, 18, 24, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#4a4458'; ctx.fillRect(e.x - 20, e.y - 2, 40, 6);
    }
  }

  function drawHp(ctx, e) {
    if (e.def.boss || e.hp >= e.maxHp) return;
    const w = Math.max(20, e.r * 2), x = e.x - w / 2, y = e.y - e.r - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = e.hp / e.maxHp <= C.combat.captureThreshold ? '#ffd23f' : '#ff4a4a';
    ctx.fillRect(x, y, w * clamp(e.hp / e.maxHp, 0, 1), 3);
  }

  function drawBeams(ctx) {
    const draw = (b, w) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = b.color; ctx.globalAlpha = 0.35; ctx.lineWidth = w * 2.2;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
      const n = 10;
      for (let i = 1; i <= n; i++) { const k = i / n; ctx.lineTo(b.x1 + (b.x2 - b.x1) * k + rand(-2, 2), b.y1 + (b.y2 - b.y1) * k + rand(-2, 2)); }
      ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = w * 0.6; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.restore();
    };
    if (beamFx) draw(beamFx, beamFx.width);
    if (bigBeam && bigBeam.x1 != null) draw(bigBeam, bigBeam.width * (0.6 + 0.4 * bigBeam.t / bigBeam.max));
  }

  function drawFx(ctx) {
    for (const f of fx) {
      const k = Math.max(0, f.life / f.max);
      switch (f.type) {
        case 'part': ctx.globalAlpha = k; ctx.fillStyle = f.color; ctx.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size); ctx.globalAlpha = 1; break;
        case 'ring': ctx.globalAlpha = k; ctx.strokeStyle = f.color; ctx.lineWidth = f.w; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - k) + 6, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; break;
        case 'text':
          ctx.globalAlpha = Math.min(1, k * 2); ctx.font = `900 ${f.size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(f.str, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.str, f.x, f.y); ctx.globalAlpha = 1; break;
        case 'slash':
          ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = f.color; ctx.lineCap = 'round';
          if (f.lasso) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(f.x + Math.cos(f.a + 0.3) * f.range * 0.6, f.y + Math.sin(f.a + 0.3) * f.range * 0.6, f.x + Math.cos(f.a) * f.range, f.y + Math.sin(f.a) * f.range); ctx.stroke(); }
          else { ctx.shadowColor = f.color; ctx.shadowBlur = 10; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(f.x, f.y - 4, f.range * 0.8, f.a - f.arc / 2 + (1 - k) * 0.5, f.a + f.arc / 2 - (1 - k) * 0.5); ctx.stroke(); }
          ctx.restore(); break;
        case 'fist':
          ctx.save(); ctx.globalAlpha = k * 0.85; ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.shadowColor = f.color; ctx.shadowBlur = 20;
          ctx.fillStyle = 'rgba(58,255,106,0.35)'; ctx.strokeStyle = f.color; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.roundRect(-f.r * 0.6, -f.r * 0.55, f.r * 1.2, f.r * 1.1, 12); ctx.fill(); ctx.stroke();
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(f.r * 0.45, -f.r * 0.5 + i * f.r * 0.27, f.r * 0.35, f.r * 0.22, 5); ctx.stroke(); }
          ctx.restore(); break;
        case 'web':
          ctx.globalAlpha = k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
          for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(i) * 18, f.y + Math.sin(i) * 18); ctx.stroke(); }
          ctx.beginPath(); ctx.arc(f.x, f.y, 10, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; break;
        case 'bolt':
          ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = f.color; ctx.shadowColor = f.color; ctx.shadowBlur = 10; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(f.x1, f.y1);
          for (let i = 1; i < 6; i++) ctx.lineTo(f.x1 + (f.x2 - f.x1) * i / 6 + rand(-8, 8), f.y1 + (f.y2 - f.y1) * i / 6 + rand(-8, 8));
          ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.restore(); break;
        case 'capture': {
          const wob = Math.sin(time * 18) * (f.life > 0.2 ? 0.4 : 0);
          Art.pokeball(ctx, f.x, f.y, 9, wob);
          break;
        }
      }
    }
  }

  function drawHubHologram(ctx, ox, oy, VW, VH) {
    const cx = (HALF + 0.5) * TS, cy = (HALF + 0.5) * TS;
    if (cx < ox - 400 || cx > ox + VW + 400 || cy < oy - 400 || cy > oy + VH + 400) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `hsla(${(time * 40 + i * 120) % 360},100%,60%,0.35)`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, 120 + i * 40, (120 + i * 40) * 0.45, 0, time * (0.3 + i * 0.2), time * (0.3 + i * 0.2) + Math.PI * 1.4); ctx.stroke();
    }
    const g = ctx.createLinearGradient(cx, cy - 220, cx, cy);
    g.addColorStop(0, 'rgba(255,230,140,0)'); g.addColorStop(1, 'rgba(255,230,140,0.25)');
    ctx.fillStyle = g; ctx.fillRect(cx - 14, cy - 220, 28, 220);
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '900 34px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tg = ctx.createLinearGradient(cx - 120, 0, cx + 120, 0);
    tg.addColorStop(0, '#ff4fd8'); tg.addColorStop(0.5, '#ffd23f'); tg.addColorStop(1, '#4ff3ff');
    ctx.globalAlpha = 0.85 + Math.sin(time * 2) * 0.1;
    ctx.fillStyle = tg; ctx.fillText('THE NEXUS', cx, cy - 150 + Math.sin(time) * 4);
    ctx.font = '700 11px system-ui, sans-serif'; ctx.fillStyle = '#c9c3ff'; ctx.fillText('A  WORLD  BEYOND  WORLDS', cx, cy - 124 + Math.sin(time) * 4);
    // orbiting fandom sigils
    NX.THEME_LIST.forEach((k, i) => {
      const a = time * 0.25 + i / NX.THEME_LIST.length * Math.PI * 2;
      const x = cx + Math.cos(a) * 200, y = cy + Math.sin(a) * 90 - 20;
      Art.circle(ctx, x, y, 6, NX.THEMES[k].map);
    });
    ctx.restore();
  }

  const hashT = (x, y) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h >>> 8) & 255; };
  function drawTiles(ctx, ox, oy, VW, VH) {
    const x0 = Math.floor(ox / TS), y0 = Math.floor(oy / TS), x1 = Math.floor((ox + VW) / TS), y1 = Math.floor((oy + VH) / TS);
    let lsx = null, lsy = null, th = null;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const sx = Math.floor(tx / S), sy = Math.floor(ty / S);
        if (sx !== lsx || sy !== lsy) { lsx = sx; lsy = sy; th = NX.THEMES[W.inBounds(sx, sy) ? W.themeOf(sx, sy) : 'hub']; }
        const t = W.tile(tx, ty);
        Art.tile(ctx, th, t, tx * TS, ty * TS, hashT(tx, ty), time, (dx, dy) => W.tile(tx + dx, ty + dy));
      }
    }
  }

  // ---------- Playtest helpers ----------
  // main.js assigns NX.debug = { Game, UI, start } after this file loads; the setter merges these in.
  const campaignDebug = {
    stages: () => STAGES.slice(),
    quest: () => G && JSON.parse(JSON.stringify(Object.assign({ objective: Game.objective(), trial: Game.trial(), keys: G.keys }, G.quest))),
    // Jump to any stage with keys, pylons, castle and outro consistent with it; respawns the nearby sectors and saves.
    setStage(id) {
      if (!G || !STAGES.includes(id)) return 'unknown stage: ' + id;
      if (trial) failTrial();
      const past = (s) => stageIdx(id) > stageIdx(s);
      G.quest.stage = id;
      for (const a of ACTS) { if (past(a + '_key')) G.keys[a] = true; else delete G.keys[a]; delete keyDrops[a]; }
      G.quest.generators = [0, 1, 2].map(() => past('castle_gens'));
      G.quest.castle = past('castle'); G.quest.outro = past('egg'); G.egg = id === 'done';
      if (!G.egg) G.eggRank = null;
      for (const s of STAGES) { if (!past(s)) delete G.quest.ms[s]; else if (G.quest.ms[s] == null) G.quest.ms[s] = Math.round(G.playTime); }
      const c = W.quest.castle, down = G.quest.generators.every(Boolean);
      if (down && !W.forceDown) W.dropForcefield();
      else if (!down && W.forceDown) {
        W.forceDown = false; W.cache.delete(skey(c.sx, c.sy)); W._last = null;
        if (NX.R3D && NX.R3D.ok) NX.R3D.refreshSector(c.sx, c.sy);
      }
      for (const k of [...active]) deactivate(k);
      updateSectors(true);
      Game.save();
      return stageId();
    },
    winTrial() { if (!trial) return false; winTrial(); return true; },
    failTrial() { if (!trial) return false; failTrial(); return true; },
    goto: (sx, sy) => warpTo(sx, sy, true),
    // Warp to the real site of the current stage (cabinet, key, gate, nearest pylon, castle).
    toSite() { const s = G && stageSite(stageId()); return !!s && warpTo(s.sx, s.sy, true); },
    level(n) { G.level = Math.max(1, n | 0); G.xp = 0; G.hp = maxHp(); return G.level; },
    give(id) {
      if (NX.WEAPONS[id]) { if (!G.weapons.includes(id)) G.weapons.push(id); equip(id); }
      else if (NX.MOUNTS[id]) { if (!G.mounts.includes(id)) G.mounts.push(id); }
      else if (NX.RELICS[id]) G.relics[id] = true;
      else return false;
      return true;
    },
    killBosses() { const list = Game.bossList(); for (const b of list) damageEnemy(b, b.hp + 1e6, { weapon: 'debug', silent: true }); return list.length; },
    sites: () => W.sites,
  };
  Game.debug = campaignDebug;
  let debugObj = Object.assign({}, campaignDebug);
  Object.defineProperty(NX, 'debug', { configurable: true, enumerable: true, get: () => debugObj, set: (v) => { debugObj = Object.assign(v || {}, campaignDebug); } });
})();
