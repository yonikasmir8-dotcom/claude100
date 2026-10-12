// UI — HUD, minimap, multiverse map, dialogue & shop menus, banners, touch controls.
(() => {
  'use strict';
  const NX = window.NX, C = NX.C, T = NX.T, W = NX.World, Art = NX.Art, Input = NX.Input, Sound = NX.Sound;
  const Game = NX.Game;
  const { clamp } = NX;
  const TS = C.world.tile, S = C.world.sectorTiles, R = C.world.radius;

  const UI = NX.UI = {
    dialog: null, menuState: null, mapOpen: false, debriefOpen: false,
    banners: [], toasts: [], announceState: null, flashState: null,
    get modal() { return !!(this.dialog || this.menuState || this.mapOpen || this.debriefOpen); },
  };

  const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  // ---------- Notifications ----------
  UI.banner = (title, sub, color = '#fff', kind) => {
    if (kind) UI.banners = UI.banners.filter((b) => b.kind !== kind);
    UI.banners.push({ title, sub, color, kind, t: 0, life: kind === 'region' ? 2.4 : 3.2 });
    if (UI.banners.length > 2) UI.banners.shift();
  };
  UI.toast = (text, color = '#fff', life = 3) => { UI.toasts.push({ text, color, t: 0, life }); if (UI.toasts.length > 6) UI.toasts.shift(); };
  UI.announce = (label) => { UI.announceState = { label, t: 0 }; Sound.play('levelup'); };
  UI.flash = (color, a) => { UI.flashState = { color, a, t: 0 }; };
  UI.save = () => Game.save();

  // ---------- Dialogue & menus (promise based) ----------
  // A say() that arrives while another dialog is open (a transmission mid-conversation) queues
  // behind it, so every awaited say() still resolves.
  const sayQueue = [];
  UI.say = (speaker, lines) => new Promise((res) => {
    const d = { speaker, lines: [].concat(lines).filter((l) => l != null && l !== '').map(String), i: 0, shown: 0, res };
    if (!d.lines.length) res(); else if (UI.dialog) sayQueue.push(d); else UI.dialog = d;
  });
  UI.menu = (title, options, footer) => new Promise((res) => { UI.menuState = { title, options, i: 0, res, footer: footer || '', rects: [] }; });
  // Crystal Gate: the Final Riddle. Esc / ✕ walks away without answering.
  UI.riddle = async () => {
    const fr = NX.CAMPAIGN.finalRiddle;
    const i = await UI.menu(fr.q, fr.options.map((label) => ({ label })), 'Choose wisely · Esc to step back');
    if (i >= 0) Game.answerRiddle(i);
    return i;
  };

  // ---------- Campaign helpers (state lives in game.js; see docs/CAMPAIGN.md) ----------
  const CAMP = () => NX.CAMPAIGN;
  const fq = (s, target) => Game.fmtQuest(s, target);
  const hasCrosser = (G) => G.mounts.includes('nimbus') || G.mounts.includes('elytra') || G.weapons.includes('portalgun');
  const lifeCap = (G) => (Game.extraLifeCap ? Game.extraLifeCap() : C.economy.maxExtraLives + (G.relics.amber ? 2 : 0));
  const MOAT_HINT = 'The Jade Key sits on an island inside a data-moat. Fly over it — the Nimbus 2000 hides in a Wizarding Grounds chest, the Elytra drops from the Ender Dragon raid — or fold it in two with the Portal Gun from the Aperture cabinet\'s chest.';

  function curatorLines(G) {
    const st = Game.stageId(), cp = CAMP(), o = Game.objective();
    if (st === 'intro') return [
      `Welcome to THE NEXUS, ${G.name} — a world beyond worlds.`,
      `${NX.fmt((2 * R + 1) ** 2)} sectors. ${NX.THEME_LIST.length} fandoms. One Easter egg.`,
      ...cp.acts.copper.intro.map((l) => fq(l)),
    ];
    if (st === 'done') return ['You found it. The egg is yours.', 'But look at the map — raid bosses still roam, relics still wait. The NEXUS never ends.'];
    if (st === 'jade_key' && !hasCrosser(G)) return [MOAT_HINT, o.text];
    if (st === 'castle_gens') return [cp.castle.intro[1], o.text, 'Bring your squad. The pylons shoot back, and the Sixers guarding them are no joke.'];
    if (st === 'castle') return ['The shield is down. Anorak\'s Castle is open — the south road runs straight through the gate.', o.text, 'IOI-655321 is inside. Don\'t let them reach the altar first.'];
    if (st === 'egg') return ['You beat IOI. Now go — the castle altar is waiting, and so is its maker.', o.text];
    return [o.riddle, o.text, 'Remember: the legend on your map (M) names every world by its colour.'].filter(Boolean);
  }

  UI.talk = async (n) => {
    const G = Game.G;
    Sound.play('talk');
    switch (n.role) {
      case 'curator': {
        const first = Game.stageId() === 'intro';
        await UI.say('The Curator', curatorLines(G));
        if (first) Game.questEvent('curator');
        break;
      }
      case 'anorak': {
        const cp = CAMP();
        if (!G.quest.outro) {
          await UI.say('Anorak', cp.castle.outro.map((l) => fq(l)));
          Game.questEvent('outro');
        } else await UI.say('Anorak', [fq(cp.castle.after[G.egg ? 1 : 0])]);
        break;
      }
      case 'shop': {
        for (;;) {
          const cap = lifeCap(G);
          const opts = NX.SHOP.map((s) => {
            const price = Game.price(s.id), full = s.id === 'extralife' && G.items.extralife >= cap;
            return { label: `${s.label}`, right: `${price}c`, sub: full ? `Pockets full — ${G.items.extralife}/${cap} quarters${G.relics.amber ? '' : ' (the Mosquito in Amber holds 2 more)'}` : s.desc, disabled: full || G.coins < price };
          });
          const i = await UI.menu('ARCADE SHOP', opts, `Coins: ${NX.fmt(G.coins)}  ·  Esc to leave`);
          if (i < 0) break;
          const err = Game.buy(NX.SHOP[i].id);
          if (err) UI.toast(err, '#ff6a6a'); else UI.toast(`Bought: ${NX.SHOP[i].label}`, '#5bff9a');
        }
        break;
      }
      case 'garage':
        if (G.mounts.includes('delorean')) await UI.say('Doc', ['Great Scott! Take care of her. Press V to drive — and hit 88 miles per hour!', 'Rumour says there\'s a Batmobile somewhere in Gotham, and a broom at the Wizarding Grounds that FLIES over walls.']);
        else {
          const price = Game.price('delorean');
          const i = await UI.menu('DOC\'S GARAGE', [{ label: 'Buy the DeLorean', right: `${price}c`, sub: '2.8× speed. Runs enemies over. Press V to drive.', disabled: G.coins < price }, { label: 'Just looking' }], `Coins: ${NX.fmt(G.coins)}`);
          if (i === 0) { const err = Game.buy('delorean'); if (err) UI.toast(err, '#ff6a6a'); }
        }
        break;
      case 'score': {
        const short = CAMP().raceShort, p = Game.playerRaceProgress();
        const rows = Game.rivalStatus().map((r) => Object.assign({}, r));
        rows.push({ name: `${G.name} (you)`, progress: p, label: G.egg ? 'EGG FOUND' : short[p - 1] || 'Starting out', you: true });
        rows.sort((a, b) => (b.progress - a.progress) || (a.you ? -1 : b.you ? 1 : 0));
        await UI.say('The Scoreboard', [
          rows.map((r, i) => `${i + 1}. ${r.name} — ${r.label} (${r.progress}/${short.length})`).join('\n'),
          `Your score: ${NX.fmt(G.score)} · Level ${G.level} · ${Game.discoveredCount()} sectors explored · ${G.kills} kills`,
        ]);
        break;
      }
      default: {
        const th = NX.THEMES[n.theme];
        const roll = (n.seed * 9301 + Math.floor(Game.time / 30)) % 100;
        if (roll < 35) {
          const r = Game.revealRumor();
          if (r) { await UI.say('Gunter', [`Psst. Word is ${r.boss} was spotted around sector ${r.sx}, ${r.sy} in ${NX.THEMES[r.theme].name}.`, 'I marked it on your map. Bring friends. Or a Poké Ball full of Stormtroopers.']); break; }
        }
        const lines = (th && th.lines) || [];
        await UI.say('Gunter', [roll < 70 && lines.length ? lines[roll % lines.length] : NX.TIPS[roll % NX.TIPS.length]]);
      }
    }
  };

  function updateDialog(dt) {
    const d = UI.dialog;
    const line = d.lines[d.i];
    d.shown = Math.min(line.length, d.shown + dt * 70);
    if (Input.hit('interact') || Input.hit('attack') || Input.hit('click') || Input.hit('pause')) {
      if (d.shown < line.length) d.shown = line.length;
      else if (++d.i >= d.lines.length) { UI.dialog = sayQueue.shift() || null; d.res(); }
      else { d.shown = 0; Sound.play('talk'); }
    }
  }
  function updateMenu() {
    const m = UI.menuState;
    if (Input.hit('up')) { m.i = (m.i + m.options.length - 1) % m.options.length; Sound.play('menu'); }
    if (Input.hit('down')) { m.i = (m.i + 1) % m.options.length; Sound.play('menu'); }
    const choose = (i) => { if (m.options[i].disabled) { Sound.play('hurt'); return; } UI.menuState = null; m.res(i); };
    if (Input.hit('interact') || Input.hit('attack')) { Input.hit('click'); choose(m.i); return; }
    if (Input.hit('click')) {
      const p = Input.mouse;
      const hitR = m.rects.findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
      if (hitR >= 0) { m.i = hitR; choose(hitR); return; }
      if (m.closeRect && p.x >= m.closeRect.x && p.x <= m.closeRect.x + m.closeRect.w && p.y >= m.closeRect.y && p.y <= m.closeRect.y + m.closeRect.h) { UI.menuState = null; m.res(-1); return; }
    }
    if (Input.hit('pause')) { UI.menuState = null; m.res(-1); }
  }

  // ---------- Map ----------
  const map = { cur: { sx: 0, sy: 0 }, base: null, cell: 4, x: 0, y: 0 };
  UI.openMap = () => {
    if (!Game.G) return;
    const p = Game.P;
    map.cur = { sx: Math.floor(p.x / TS / S), sy: Math.floor(p.y / TS / S) };
    buildMapImage();
    UI.mapOpen = true;
  };
  function buildMapImage() {
    const N = 2 * R + 1, cv = document.createElement('canvas');
    cv.width = N; cv.height = N;
    const c = cv.getContext('2d'), img = c.createImageData(N, N);
    const scouter = Game.G.relics.scouter || Game.G.relics.motherbox, circles = hintCircles();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const sx = x - R, sy = y - R, th = mapTheme(sx, sy), rgb = hexRgb(th.map);
      const disc = Game.isDiscovered(sx, sy);
      const k = disc ? 1 : scouter || circles.some((c) => inCircle(c, sx, sy)) ? 0.45 : 0.22, i = (y * N + x) * 4;
      img.data[i] = rgb[0] * k; img.data[i + 1] = rgb[1] * k; img.data[i + 2] = rgb[2] * k; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    map.base = cv;
  }
  function updateMap() {
    if (Input.hit('map') || Input.hit('pause')) { UI.mapOpen = false; return; }
    const step = (dx, dy) => { map.cur.sx = clamp(map.cur.sx + dx, -R, R); map.cur.sy = clamp(map.cur.sy + dy, -R, R); };
    if (Input.hit('left')) step(-1, 0); if (Input.hit('right')) step(1, 0); if (Input.hit('up')) step(0, -1); if (Input.hit('down')) step(0, 1);
    const m = Input.mouse;
    const inMap = m.x >= map.x && m.y >= map.y && m.x < map.x + map.cell * (2 * R + 1) && m.y < map.y + map.cell * (2 * R + 1);
    const hovered = inMap ? { sx: Math.floor((m.x - map.x) / map.cell) - R, sy: Math.floor((m.y - map.y) / map.cell) - R } : null;
    if (hovered && !Input.touchUsed && performance.now() - m.lastMove < 100) map.cur = hovered;
    const tryWarp = () => {
      if (!canWarp(map.cur.sx, map.cur.sy)) { Sound.play('hurt'); UI.toast('You can only warp to sectors you have visited.', '#ff6a6a'); return; }
      UI.mapOpen = false;
      Game.warp(map.cur.sx, map.cur.sy);
    };
    if (Input.hit('interact')) { tryWarp(); return; }
    if (Input.hit('click')) {
      if (map.warpRect && m.x >= map.warpRect.x && m.x <= map.warpRect.x + map.warpRect.w && m.y >= map.warpRect.y && m.y <= map.warpRect.y + map.warpRect.h) { tryWarp(); return; }
      if (map.closeRect && m.x >= map.closeRect.x && m.x <= map.closeRect.x + map.closeRect.w && m.y >= map.closeRect.y && m.y <= map.closeRect.y + map.closeRect.h) { UI.mapOpen = false; return; }
      if (hovered) { if (hovered.sx === map.cur.sx && hovered.sy === map.cur.sy && !Input.touchUsed) tryWarp(); else map.cur = hovered; }
    }
    Input.hit('attack');
  }
  const canWarp = (sx, sy) => Game.isDiscovered(sx, sy) || Game.G.relics.motherbox;
  // Until the Crystal Gate opens, the castle sector hides behind its natural colour.
  const castleHidden = (sx, sy) => { const c = W.quest && W.quest.castle; return !!c && c.sx === sx && c.sy === sy && !Game.isDone('crystal_gate'); };
  const mapTheme = (sx, sy) => NX.THEMES[castleHidden(sx, sy) ? W.naturalTheme(sx, sy) : W.themeOf(sx, sy)];
  const hintCircles = () => Game.questMarkers().filter((m) => m.current && m.r > 0);
  const inCircle = (c, sx, sy) => Math.hypot(sx - c.sx, sy - c.sy) <= c.r + 0.5;

  // Campaign site glyph on a dark disc (readable even when a sector is 4px wide).
  function markIcon(ctx, m, x, y, r) {
    const col = m.color || '#ffd23f';
    ctx.fillStyle = 'rgba(8,8,20,0.9)'; ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    if (m.done) { ctx.fillStyle = '#5bff9a'; ctx.font = `bold ${Math.round(r * 1.7)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✓', x, y + 0.5); return; }
    ctx.fillStyle = col;
    switch (m.kind) {
      case 'key': Art.keyIcon(ctx, x - 1.5 * r / 14, y, col, r / 14); break;
      case 'gate': ctx.lineWidth = Math.max(1.5, r * 0.3); ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.stroke(); break;
      case 'generator': ctx.beginPath(); ctx.moveTo(x, y - r * 0.75); ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.lineTo(x - r * 0.6, y + r * 0.6); ctx.closePath(); ctx.fill(); break;
      case 'castle': {
        const w = r * 0.7;
        ctx.fillRect(x - w, y - r * 0.15, w * 2, r * 0.75);
        for (let i = 0; i < 3; i++) ctx.fillRect(x - w + i * w * 0.8, y - r * 0.6, w * 0.4, r * 0.5);
        break;
      }
      default: // clue cabinet
        ctx.fillRect(x - r * 0.45, y - r * 0.7, r * 0.9, r * 1.4);
        ctx.fillStyle = '#10101c'; ctx.fillRect(x - r * 0.3, y - r * 0.5, r * 0.6, r * 0.5);
    }
  }

  function mapLabel(ctx, text, x, y, col, size) {
    ctx.font = `bold ${Math.max(10, map.cell * 2)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const lw = ctx.measureText(text).width / 2, lx = clamp(x, map.x + lw, map.x + size - lw);
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(text, lx, y); ctx.fillStyle = col; ctx.fillText(text, lx, y);
  }
  // Search lens: the current hint circle magnified in the map corner farthest from it, so the colour
  // of a single sector (a riddle's world) can actually be read when the whole map is 4 px a sector.
  function drawLens(ctx, hc, size) {
    const k = hc.r + 2, n = 2 * k + 1, lc = Math.max(10, map.cell * 3), ls = n * lc, col = hc.color || '#ffd23f';
    const lx = hc.sx > 0 ? map.x + 8 : map.x + size - ls - 8, ly = hc.sy > 0 ? map.y + 8 : map.y + size - ls - 26;
    Art.rrect(ctx, lx - 4, ly - 4, ls + 8, ls + 26, 6, 'rgba(4,4,16,0.92)');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map.base, hc.sx - k + R, hc.sy - k + R, n, n, lx, ly, ls, ls);
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 1; i < n; i++) { ctx.moveTo(lx + i * lc, ly); ctx.lineTo(lx + i * lc, ly + ls); ctx.moveTo(lx, ly + i * lc); ctx.lineTo(lx + ls, ly + i * lc); }
    ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(lx, ly, ls, ls); ctx.clip();
    ctx.strokeStyle = col; ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(lx + ls / 2, ly + ls / 2, (hc.r + 0.5) * lc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const P = Game.P, px = Math.floor(P.x / TS / S) - hc.sx + k, py = Math.floor(P.y / TS / S) - hc.sy + k;
    if (px >= 0 && py >= 0 && px < n && py < n) { ctx.fillStyle = '#4ff3ff'; ctx.beginPath(); ctx.arc(lx + (px + 0.5) * lc, ly + (py + 0.5) * lc, lc * 0.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(lx - 0.5, ly - 0.5, ls + 1, ls + 1);
    ctx.fillStyle = col; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('SEARCH AREA', lx + ls / 2, ly + ls + 5);
  }

  function drawMap(ctx, VW, VH) {
    const G = Game.G, N = 2 * R + 1;
    ctx.fillStyle = 'rgba(4,4,16,0.94)'; ctx.fillRect(0, 0, VW, VH);
    const side = VW > VH * 1.2;
    const avail = side ? Math.min(VH - 70, VW - 300) : Math.min(VW - 24, VH - 230);
    const cell = map.cell = Math.max(2, Math.floor(avail / N));
    const size = cell * N;
    map.x = side ? 20 : Math.floor((VW - size) / 2); map.y = 50;
    ctx.fillStyle = '#fff'; ctx.font = '900 20px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('THE NEXUS — MULTIVERSE MAP', map.x, 16);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map.base, map.x, map.y, size, size);
    ctx.imageSmoothingEnabled = true;
    const cx = (sx) => map.x + (sx + R + 0.5) * cell, cy = (sy) => map.y + (sy + R + 0.5) * cell;
    // hub
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx(0), cy(0), Math.max(3, cell), 0, Math.PI * 2); ctx.fill();
    const scouter = G.relics.scouter, markers = Game.questMarkers();
    // scouter: un-held key sectors (the guardian still waits for its cabinets)
    if (scouter) for (const id of NX.KEY_ORDER) {
      const k = W.keySectors[id];
      if (!G.keys[id] && !markers.some((m) => m.sx === k.sx && m.sy === k.sy)) { ctx.globalAlpha = 0.6; Art.keyIcon(ctx, cx(k.sx) - 3, cy(k.sy), NX.KEYS[id].color, 0.8); ctx.globalAlpha = 1; }
    }
    // campaign: dashed hint circles, exact icons, ✓ for finished sites, dim future cabinets
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 220);
    for (const m of markers) {
      const x = cx(m.sx), y = cy(m.sy), col = m.color || '#ffd23f';
      if (m.r > 0) {
        ctx.strokeStyle = col; ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.globalAlpha = m.current ? 0.7 + 0.3 * pulse : 0.5;
        ctx.beginPath(); ctx.arc(x, y, (m.r + 0.5) * cell, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = m.done ? 0.8 : m.current ? 1 : 0.45;
        markIcon(ctx, m, x, y, Math.max(4.5, cell * 1.3));
        if (m.current) { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = pulse; ctx.beginPath(); ctx.arc(x, y, Math.max(4.5, cell * 1.3) + 3, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      if (m.current && m.label && m.kind !== 'generator') mapLabel(ctx, m.label, x, y + (m.r > 0 ? (m.r + 0.5) * cell : Math.max(4.5, cell * 1.3) + 3) + 5, col, size);
    }
    // the three pylons sit 2–3 sectors apart: one shared label instead of three overlapping ones
    const gens = markers.filter((m) => m.kind === 'generator' && m.current);
    if (gens.length) mapLabel(ctx, `IOI Shield Pylons ${markers.filter((m) => m.kind === 'generator' && m.done).length}/3`, gens.reduce((a, m) => a + cx(m.sx), 0) / gens.length, Math.max(...gens.map((m) => cy(m.sy))) + Math.max(4.5, cell * 1.3) + 7, '#ff9b3d', size);
    // raids
    for (const th of Object.keys(W.raidSectors)) {
      const r = W.raidSectors[th];
      if (!(G.revealed[th] || scouter || Game.isDiscovered(r.sx, r.sy))) continue;
      const done = G.raids[th];
      ctx.fillStyle = done ? '#666' : '#ff3a3a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx(r.sx), cy(r.sy), Math.max(3.5, cell * 0.9), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(7, cell * 1.3)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(done ? '✓' : '☠', cx(r.sx), cy(r.sy) + 0.5);
    }
    // player
    const P = Game.P, psx = Math.floor(P.x / TS / S), psy = Math.floor(P.y / TS / S);
    if (Math.floor(performance.now() / 300) % 2) { ctx.fillStyle = '#4ff3ff'; ctx.beginPath(); ctx.arc(cx(psx), cy(psy), Math.max(3, cell * 0.9), 0, Math.PI * 2); ctx.fill(); }
    // cursor
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(map.x + (map.cur.sx + R) * cell - 1, map.y + (map.cur.sy + R) * cell - 1, cell + 2, cell + 2);
    const hc = markers.find((m) => m.current && m.r > 0);
    if (hc) drawLens(ctx, hc, size);

    // info panel
    const px = side ? map.x + size + 20 : map.x, py = side ? map.y : map.y + size + 12, pw = side ? VW - px - 20 : size;
    const sx = map.cur.sx, sy = map.cur.sy, th = mapTheme(sx, sy), disc = Game.isDiscovered(sx, sy);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = th.map; ctx.font = '900 17px system-ui, sans-serif'; ctx.fillText(disc || scouter ? th.name : '??? Unexplored', px, py);
    ctx.fillStyle = '#aab'; ctx.font = '13px system-ui, sans-serif';
    let y = py + 24;
    const line = (t, col = '#aab') => { ctx.fillStyle = col; for (const l of wrap(ctx, t, pw)) { ctx.fillText(l, px, y); y += 18; } };
    line(`${disc || scouter ? th.fandom + ' · ' : ''}Sector ${sx}, ${sy} · ${W.dist(sx, sy)} from hub`);
    const raid = W.raidAt(sx, sy);
    if (raid && (G.revealed[raid] || scouter || disc)) line(`☠ Raid boss: ${NX.ENEMIES[NX.RAIDS[raid].boss].name}${G.raids[raid] ? ' (defeated)' : ''}`, '#ff8a8a');
    const keyHere = W.keyAt(sx, sy);
    if (keyHere && (scouter || disc)) line(`🔑 ${NX.KEYS[keyHere].name} guardian`, NX.KEYS[keyHere].color);
    for (const m of markers) if (m.r === 0 && m.sx === sx && m.sy === sy && m.label) line(`${m.done ? '✓ ' : '◆ '}${m.label}`, m.color || '#ffd23f');
    y += 6;
    if (canWarp(sx, sy)) {
      map.warpRect = { x: px, y, w: 150, h: 34 };
      Art.rrect(ctx, px, y, 150, 34, 8, '#7b5cff');
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(G.relics.motherbox && !disc ? 'BOOM TUBE ⚡' : 'WARP HERE', px + 75, y + 17);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      y += 46;
    } else { map.warpRect = null; line('Visit a sector to unlock warping there.', '#667'); y += 6; }
    map.closeRect = { x: VW - 50, y: 10, w: 40, h: 36 };
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✕', VW - 30, 28);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    // current objective + the Curator's riddle
    const o = Game.objective();
    ctx.font = 'bold 13px system-ui, sans-serif'; line(o.text, '#ffd23f');
    if (o.riddle) {
      ctx.font = 'italic 12px system-ui, sans-serif'; ctx.fillStyle = '#dde';
      for (const l of wrap(ctx, `“${o.riddle}”`, pw).slice(0, 8)) { ctx.fillText(l, px, y); y += 16; }
    }
    y += 8;
    // legend: every fandom with its map colour (riddles name worlds, the map shows colours)
    if (side || VH - y > 120) {
      ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillStyle = '#889'; ctx.fillText('MAP COLOURS', px, y); y += 16;
      ctx.font = '11px system-ui, sans-serif';
      const cols = Math.max(2, Math.min(4, Math.floor(pw / 170)));
      const colW = pw / cols;
      NX.THEME_LIST.forEach((k, i) => {
        const lx = px + (i % cols) * colW, ly = y + Math.floor(i / cols) * 16;
        if (ly > VH - 30) return;
        ctx.fillStyle = NX.THEMES[k].map; ctx.fillRect(lx, ly + 2, 9, 9);
        ctx.fillStyle = '#ccd'; ctx.fillText(NX.THEMES[k].fandom, lx + 14, ly);
      });
    }
    ctx.fillStyle = '#667'; ctx.font = '12px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${Game.discoveredCount()} / ${NX.fmt(N * N)} sectors explored · arrows/click to select · Enter/click again to warp · M to close`, 20, VH - 8);
  }

  // ---------- Minimap ----------
  const mini = { cv: document.createElement('canvas'), t: 0, n: 100 };
  mini.cv.width = mini.cv.height = mini.n;
  const tileRgb = {};
  function updateMinimap() {
    const P = Game.P, n = mini.n, c = mini.cv.getContext('2d'), img = c.createImageData(n, n);
    const tx0 = Math.floor(P.x / TS) - n / 2, ty0 = Math.floor(P.y / TS) - n / 2;
    let lsx = null, lsy = null, rgb = null;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const tx = tx0 + x, ty = ty0 + y, sx = Math.floor(tx / S), sy = Math.floor(ty / S);
      if (sx !== lsx || sy !== lsy) { lsx = sx; lsy = sy; const th = W.inBounds(sx, sy) ? W.themeOf(sx, sy) : 'hub'; rgb = tileRgb[th] || (tileRgb[th] = hexRgb(NX.THEMES[th].map)); }
      const t = W.tile(tx, ty), i = (y * n + x) * 4;
      let k = 0.32, r = rgb[0], g = rgb[1], b = rgb[2];
      if (t === T.WALL || t === T.BREAK || t === T.PROP || t === T.QBLOCK || t === T.USED) k = 0.85;
      else if (t === T.ROAD) k = 0.55;
      else if (t === T.WATER) { r = 50; g = 110; b = 220; k = 0.8; }
      else if (t === T.VOID) k = 0;
      else if (t === T.GATE || t === T.ALTAR) { r = 255; g = 120; b = 255; k = 1; }
      else if (T.FORCE != null && t === T.FORCE) { r = 255; g = 155; b = 61; k = 1; }
      img.data[i] = r * k; img.data[i + 1] = g * k; img.data[i + 2] = b * k; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }

  // ---------- HUD ----------
  // Phones get a ~540 px wide logical view at ×0.72 zoom, so text under ×0.9 becomes unreadable.
  function hudScale(VW) { return clamp(VW / 900, 0.9, 1.15); }
  // dialogs and menus: larger type on narrow views (they have the whole screen height to grow into)
  const textScale = (VW) => (VW < 720 ? 1.15 : hudScale(VW));

  function drawHUD(ctx, VW, VH, dt) {
    const G = Game.G, P = Game.P, s = hudScale(VW);
    ctx.save();
    // dark outline keeps HUD text readable over bright sectors (snow, desert, Portal's white labs)
    const ink = (t, x, yy, col) => { ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(t, x, yy); ctx.fillStyle = col; ctx.fillText(t, x, yy); };
    // hearts
    const mh = Game.maxHp(), hearts = Math.ceil(mh / 2), perRow = 10;
    for (let i = 0; i < hearts; i++) {
      const x = 22 + (i % perRow) * 19 * s, y = 22 + Math.floor(i / perRow) * 18 * s;
      const v = clamp(G.hp - i * 2, 0, 2);
      Art.heart(ctx, x, y, 1.15 * s, 'rgba(0,0,0,0.5)');
      if (v > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x - 10, y - 10, v === 2 ? 20 : 10, 20); ctx.clip(); Art.heart(ctx, x, y, 1.15 * s, '#ff3b5c'); ctx.restore(); }
    }
    let y = 22 + Math.ceil(hearts / perRow) * 18 * s;
    if (P.overshield > 0) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(12, y - 6, 80, 5); ctx.fillStyle = '#ffd23f'; ctx.fillRect(12, y - 6, 80 * P.overshield / 4, 5); y += 4; }
    // level + xp
    ctx.font = `900 ${13 * s}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ink(`LV ${G.level}`, 12, y, '#5bff9a');
    const xw = 110 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(50 * s, y + 4, xw, 6);
    ctx.fillStyle = '#5bff9a'; ctx.fillRect(50 * s, y + 4, xw * clamp(G.xp / Game.xpNeed(), 0, 1), 6);
    y += 18 * s;
    ink(`● ${NX.fmt(G.coins)}`, 12, y, '#ffd23f');
    ink(`★ ${NX.fmt(G.score)}`, 90 * s, y, '#ccd');
    y += 20 * s;
    // keys (lit once held) · ✓ once that act's gate is open
    NX.KEY_ORDER.forEach((k, i) => {
      ctx.globalAlpha = G.keys[k] ? 1 : 0.25;
      Art.keyIcon(ctx, 20 + i * 30 * s, y + 6, NX.KEYS[k].color, 0.9 * s);
    });
    ctx.globalAlpha = 1;
    if (G.egg) { ctx.fillStyle = '#fff3c4'; ctx.fillText('🥚', 20 + 3 * 30 * s, y - 2); }
    ctx.font = `900 ${9 * s}px system-ui, sans-serif`; ctx.fillStyle = '#5bff9a';
    NX.KEY_ORDER.forEach((k, i) => { if (Game.isDone(k + '_gate')) ctx.fillText('✓', 30 + i * 30 * s, y - 3); });

    // minimap
    mini.t -= dt; if (mini.t <= 0) { mini.t = 0.25; updateMinimap(); }
    const ms = Math.round(130 * s), mx = VW - ms - 12, my = 12;
    ctx.fillStyle = '#000'; ctx.fillRect(mx - 2, my - 2, ms + 4, ms + 4);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(mini.cv, mx, my, ms, ms); ctx.imageSmoothingEnabled = true;
    const k = ms / mini.n / TS;
    ctx.save(); ctx.beginPath(); ctx.rect(mx, my, ms, ms); ctx.clip();
    for (const e of Game.ents) {
      const ex = mx + ms / 2 + (e.x - P.x) * k, ey = my + ms / 2 + (e.y - P.y) * k;
      if (e.kind === 'enemy') { ctx.fillStyle = e.def.boss ? '#ff0' : '#ff4a4a'; ctx.fillRect(ex - (e.def.boss ? 3 : 1), ey - (e.def.boss ? 3 : 1), e.def.boss ? 6 : 2.5, e.def.boss ? 6 : 2.5); }
      else if (e.kind === 'chest' && !e.open) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(ex - 2, ey - 2, 4, 4); }
      else if (e.kind === 'npc') { ctx.fillStyle = '#fff'; ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3); }
      else if (e.kind === 'site') { ctx.fillStyle = (CAMP() && CAMP().acts[e.act] && CAMP().acts[e.act].color) || '#ff4fd8'; ctx.fillRect(ex - 2.5, ey - 2.5, 5, 5); }
      else if (e.kind === 'pet') { ctx.fillStyle = '#5bff9a'; ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3); }
    }
    ctx.restore();
    ctx.fillStyle = '#4ff3ff'; ctx.fillRect(mx + ms / 2 - 2, my + ms / 2 - 2, 4, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(mx - 0.5, my - 0.5, ms + 1, ms + 1);
    const psx = Math.floor(P.x / TS / S), psy = Math.floor(P.y / TS / S), th = NX.THEMES[W.themeOf(psx, psy)];
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = `900 ${12 * s}px system-ui, sans-serif`; ink(th.name, VW - 12, my + ms + 6, th.map);
    ctx.font = `${11 * s}px system-ui, sans-serif`;
    ink(`${th.fandom} · ${psx}, ${psy} · ${W.dist(psx, psy)} from hub`, VW - 12, my + ms + 22 * s, '#c4c4d4');
    // objective (wrapped so it never runs into the hearts on a phone)
    const obj = Game.objective();
    let ty = my + ms + 38 * s;
    if (obj && obj.text) {
      ctx.font = `bold ${12 * s}px system-ui, sans-serif`;
      for (const l of wrap(ctx, obj.text, Math.min(VW * 0.6, 420))) { ink(l, VW - 12, ty, '#ffd23f'); ty += 15 * s; }
    }
    ty += 6 * s;
    // quest arrow on the minimap rim, pointing at the target (hidden inside the target circle — same
    // Chebyshev test game.js uses to switch the objective to 'Match the riddle to a map colour')
    if (obj && obj.sx != null && Math.max(Math.abs(obj.sx - psx), Math.abs(obj.sy - psy)) > (obj.r || 0)) {
      const a = Math.atan2((obj.sy + 0.5) * S * TS - P.y, (obj.sx + 0.5) * S * TS - P.x), c = Math.cos(a), sn = Math.sin(a);
      const e = (ms / 2 - 8) / Math.max(Math.abs(c), Math.abs(sn)), ax = mx + ms / 2 + c * e, ay = my + ms / 2 + sn * e;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6.5); ctx.lineTo(-2.5, 0); ctx.lineTo(-6, 6.5); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
      const label = Game.fmtQuest('{n} {dir}', obj);
      ctx.font = `bold ${10 * s}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lw = ctx.measureText(label).width + 8, lh = 14 * s;
      const lx = clamp(ax - c * 20 * s, mx + lw / 2, mx + ms - lw / 2), ly = clamp(ay - sn * 16 * s, my + lh / 2, my + ms - lh / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(lx - lw / 2, ly - lh / 2, lw, lh);
      ctx.fillStyle = '#ffd23f'; ctx.fillText(label, lx, ly + 0.5);
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    }

    // toasts
    UI.toasts = UI.toasts.filter((t) => (t.t += dt) < t.life);
    ctx.font = `bold ${12 * s}px system-ui, sans-serif`;
    for (const t of UI.toasts) {
      const a = Math.min(1, (t.life - t.t) * 2, t.t * 6);
      ctx.globalAlpha = a;
      const w = ctx.measureText(t.text).width + 14;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(VW - 12 - w, ty, w, 20 * s);
      ctx.fillStyle = t.color; ctx.textBaseline = 'middle'; ctx.fillText(t.text, VW - 19, ty + 10 * s);
      ty += 23 * s;
    }
    ctx.globalAlpha = 1;

    // boss bar (below the MAP / pause buttons on touch)
    const bosses = Game.bossList(), top0 = Input.touchUsed ? 34 * s : 0;
    let topEnd = 0;   // bottom of the boss/trial stack: banners start below it
    bosses.slice(0, 2).forEach((b, i) => {
      const bw = Math.min(460, VW - 340), bx = VW / 2 - bw / 2, by = top0 + 16 + i * 34;
      topEnd = by + 24;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 2, by + 12, bw + 4, 12);
      ctx.fillStyle = b.def.color || '#ff3030'; ctx.fillRect(bx, by + 14, bw * clamp(b.hp / b.maxHp, 0, 1), 8);
      ctx.fillStyle = '#fff'; ctx.font = `900 ${12 * s}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${b.def.name}  ·  ${b.def.fandom}`, VW / 2, by + 11);
    });
    // trial bar (under the boss bars) + the leave countdown
    const tr = Game.trial();
    if (tr) {
      const txt = tr.twist === 'pellets' ? `${tr.title} · ${tr.left} dots left` : `${tr.title} · Wave ${tr.wave}/${tr.waves}${tr.left != null ? ` · ${tr.left} left` : ''}`;
      const by = top0 + 20 + Math.min(2, bosses.length) * 34, bh = 22 * s;
      topEnd = by + bh + (tr.outT != null ? 34 * s : 0);
      ctx.font = `900 ${12 * s}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = Math.min(VW - 24, ctx.measureText(txt).width + 24);
      Art.rrect(ctx, VW / 2 - tw / 2, by, tw, bh, 8, 'rgba(10,10,30,0.82)');
      ctx.strokeStyle = '#4ff3ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(VW / 2 - tw / 2, by, tw, bh, 8); ctx.stroke();
      ctx.fillStyle = '#4ff3ff'; ctx.fillText(txt, VW / 2, by + bh / 2, tw - 16);
      if (tr.outT != null) {
        const warn = `Back to the ${tr.kind === 'gate' ? 'gate' : 'cabinet'}! ${Math.max(0, Math.ceil(tr.outT))}`;
        ctx.font = `900 ${22 * s}px system-ui, sans-serif`; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.globalAlpha = 0.65 + 0.35 * Math.abs(Math.sin(performance.now() / 160));
        ctx.strokeText(warn, VW / 2, by + bh + 20 * s); ctx.fillStyle = '#ff4a4a'; ctx.fillText(warn, VW / 2, by + bh + 20 * s);
        ctx.globalAlpha = 1;
      }
    }

    // hotbar
    const slot = 36 * s, n = G.weapons.length, cur = G.weapons.indexOf(G.weapon);
    const maxShow = Math.max(3, Math.min(n, Math.floor((VW * 0.5) / (slot + 4))));
    const start = clamp(cur - Math.floor(maxShow / 2), 0, Math.max(0, n - maxShow));
    const hbY = VH - slot - 14;
    for (let i = 0; i < Math.min(n, maxShow); i++) {
      const idx = start + i, id = G.weapons[idx], x = 12 + i * (slot + 4);
      Art.rrect(ctx, x, hbY, slot, slot, 6, idx === cur ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.5)');
      if (idx === cur) { ctx.strokeStyle = NX.WEAPONS[id].color; ctx.lineWidth = 2; ctx.strokeRect(x + 1, hbY + 1, slot - 2, slot - 2); }
      Art.weaponIcon(ctx, id, x + slot / 2, hbY + slot / 2, s);
      if (idx < 9) { ctx.fillStyle = '#aab'; ctx.font = `bold ${9 * s}px system-ui`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(idx + 1, x + 3, hbY + 2); }
    }
    const w = NX.WEAPONS[G.weapon];
    ctx.font = `900 ${12 * s}px system-ui`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ink(`${w.name}`, 12, hbY - 4, '#fff');
    const wx = 12 + ctx.measureText(w.name).width + 8;
    ctx.font = `${10 * s}px system-ui`; ink(Input.touchUsed ? w.fandom : `${w.fandom}  ·  Q/R or 1-9 to switch`, wx, hbY - 5, '#aab');

    // consumables row
    const items = [
      [`Poké Balls ${G.items.pokeballs}${G.items.masterballs ? ` + ${G.items.masterballs} Master` : ''}`, '#ff6a6a', 'C'],
      [`Grenades ${G.items.grenades}`, '#e8c040', 'G'],
    ];
    if (G.items.extralife) items.push([`25¢ ×${G.items.extralife}/${lifeCap(G)}`, '#c8ccd2', '']);
    if (G.mounts.length) items.push([P.mount ? NX.MOUNTS[P.mount].name : 'On foot', '#18e0ff', 'V']);
    if (G.relics.gauntlet) { const cdl = Math.ceil(90 - (G.playTime - G.snapAt)); items.push([cdl > 0 ? `SNAP ${cdl}s` : 'SNAP READY', '#c070ff', 'F']); }
    ctx.font = `bold ${12 * s}px system-ui`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    if (!Input.touchUsed) {
      let iy = VH - 34;
      for (const [label, col, key] of items) {
        const tw = ctx.measureText(label).width + (key ? 22 : 10), ix = VW - 12 - tw;
        Art.rrect(ctx, ix, iy, tw, 22, 6, 'rgba(0,0,0,0.55)');
        if (key) { ctx.fillStyle = '#667'; ctx.fillText(key, ix + 5, iy + 11); }
        ctx.fillStyle = col; ctx.fillText(label, ix + (key ? 17 : 5), iy + 11);
        iy -= 26;
      }
    }

    // relic strip
    const relics = Object.keys(G.relics);
    relics.forEach((r, i) => { Art.relicIcon(ctx, r, 20 + i * 26 * s, y + 34 * s, 0.85 * s); });

    // pets
    const pets = Game.ents.filter((e) => e.kind === 'pet');
    if (pets.length) {
      ctx.font = `${10 * s}px system-ui`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#5bff9a';
      ctx.fillText('SQUAD: ' + pets.map((p) => p.def.name).join(', '), 12, y + (relics.length ? 50 : 24) * s);
    }

    // combo
    if (Game.combo >= 5) {
      ctx.font = `900 ${22 * s}px system-ui`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      const txt = `${Game.combo} HITS`;
      ctx.strokeText(txt, VW - 16, VH * 0.55); ctx.fillText(txt, VW - 16, VH * 0.55);
    }

    // banners
    UI.banners = UI.banners.filter((b) => (b.t += dt) < b.life);
    // narrow (portrait) views: the toast column spans most of the width, so banners go below it
    const bannerTop = Math.max(VH * (VW < 720 ? 0.3 : 0.16), topEnd + 24 * s);
    UI.banners.forEach((b, i) => {
      const a = Math.min(1, b.t * 4, (b.life - b.t) * 2);
      const by = bannerTop + i * 54 * s;
      ctx.globalAlpha = a;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.min(30 * s, VW / Math.max(12, b.title.length) * 1.6)}px system-ui, sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(b.title, VW / 2, by);
      ctx.fillStyle = b.color; ctx.fillText(b.title, VW / 2, by);
      if (b.sub) { ctx.font = `600 ${13 * s}px system-ui, sans-serif`; ctx.lineWidth = 3; ctx.strokeText(b.sub, VW / 2, by + 24 * s); ctx.fillStyle = '#eef'; ctx.fillText(b.sub, VW / 2, by + 24 * s); }
    });
    ctx.globalAlpha = 1;

    // announcer
    if (UI.announceState) {
      const an = UI.announceState; an.t += dt;
      if (an.t > 1.6) UI.announceState = null;
      else {
        const pop = an.t < 0.15 ? 0.6 + an.t / 0.15 * 0.6 : 1.2 - Math.min(0.2, (an.t - 0.15));
        ctx.save(); ctx.translate(VW / 2, VH * 0.42); ctx.scale(pop, pop);
        ctx.globalAlpha = Math.min(1, (1.6 - an.t) * 2);
        ctx.font = `900 ${34 * s}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(an.label, 0, 0);
        const g = ctx.createLinearGradient(-150, 0, 150, 0); g.addColorStop(0, '#ff4fd8'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#4ff3ff');
        ctx.fillStyle = g; ctx.fillText(an.label, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // ---------- Weather ----------
  const drops = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() }));
  function drawWeather(ctx, VW, VH, dt) {
    const P = Game.P, th = NX.THEMES[W.themeOf(Math.floor(P.x / TS / S), Math.floor(P.y / TS / S))];
    if (!th.weather) return;
    ctx.save();
    for (const d of drops) {
      if (th.weather === 'rain') { d.y += dt * 1.6 * d.s; d.x -= dt * 0.2 * d.s; }
      else if (th.weather === 'snow') { d.y += dt * 0.12 * d.s; d.x += Math.sin(Game.time + d.s * 10) * dt * 0.03; }
      else { d.y -= dt * 0.05 * d.s; d.x += Math.sin(Game.time * 0.5 + d.s * 10) * dt * 0.02; }
      if (d.y > 1) d.y -= 1; if (d.y < 0) d.y += 1; if (d.x < 0) d.x += 1; if (d.x > 1) d.x -= 1;
      const x = d.x * VW, y = d.y * VH;
      if (th.weather === 'rain') { ctx.strokeStyle = 'rgba(170,190,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14); ctx.stroke(); }
      else if (th.weather === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x, y, 2 * d.s, 2 * d.s); }
      else { ctx.fillStyle = 'rgba(220,220,230,0.45)'; ctx.fillRect(x, y, 1.5 * d.s, 1.5 * d.s); }
    }
    if (th.weather === 'rain' && Math.random() < dt * 0.15) UI.flash('#ffffff', 0.25);
    ctx.restore();
  }

  // ---------- Dialog/menu drawing ----------
  function wrap(ctx, text, maxW) {
    const out = [];
    for (const para of text.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
      }
      out.push(line);
    }
    return out;
  }
  function drawDialog(ctx, VW, VH) {
    const d = UI.dialog, s = textScale(VW);
    const w = Math.min(720, VW - 24), x = (VW - w) / 2;
    ctx.font = `${15 * s}px system-ui, sans-serif`;
    const lines = wrap(ctx, d.lines[d.i].slice(0, Math.floor(d.shown)), w - 36);
    const full = wrap(ctx, d.lines[d.i], w - 36);
    const h = Math.max(96, 54 + full.length * 21 * s), y = VH - h - 16;
    Art.rrect(ctx, x, y, w, h, 12, 'rgba(10,10,30,0.94)');
    ctx.strokeStyle = '#7b5cff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.font = `900 ${13 * s}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(d.speaker.toUpperCase(), x + 18, y + 12);
    ctx.fillStyle = '#eef'; ctx.font = `${15 * s}px system-ui, sans-serif`;
    lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 34 + i * 21 * s));
    if (d.shown >= d.lines[d.i].length && Math.floor(performance.now() / 400) % 2) { ctx.fillStyle = '#7b5cff'; ctx.fillText('▼', x + w - 28, y + h - 24); }
    ctx.fillStyle = '#667'; ctx.font = `${10 * s}px system-ui`; ctx.textAlign = 'right'; ctx.fillText(`${d.i + 1}/${d.lines.length}`, x + w - 14, y + 12);
  }
  function drawMenu(ctx, VW, VH) {
    const m = UI.menuState, s = textScale(VW);
    const w = Math.min(560, VW - 24), x = (VW - w) / 2;
    // Title, labels and subs all wrap (the Final Riddle question is ~300 chars; phones are ~540 logical px wide).
    const long = m.title.length > 80;   // a question, not a heading: lighter and a touch smaller
    const tf = long ? `600 ${16 * s}px system-ui` : `900 ${18 * s}px system-ui`, lf = `bold ${14 * s}px system-ui`, sf = `${11 * s}px system-ui`, rf = `900 ${14 * s}px system-ui`;
    const tlh = (long ? 21 : 22) * s, llh = 18 * s, slh = 14 * s;
    ctx.font = tf;
    const tLines = wrap(ctx, m.title, w - 70);
    const rows = m.options.map((o) => {
      ctx.font = rf; const rw = o.right ? ctx.measureText(o.right).width + 16 : 0;
      ctx.font = lf; const lab = wrap(ctx, String(o.label), w - 48 - rw);
      ctx.font = sf; const sub = o.sub ? wrap(ctx, o.sub, w - 48 - rw) : [];
      const ch = lab.length * llh + (sub.length ? 2 + sub.length * slh : 0);
      return { lab, sub, ch, h: Math.max(46 * s, 14 + ch) };
    });
    const headH = 28 + tLines.length * tlh;
    const h = headH + rows.reduce((a, r) => a + r.h + 6, 0) + 30;
    const y = Math.max(10, (VH - h) / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, VW, VH);
    Art.rrect(ctx, x, y, w, h, 14, 'rgba(10,10,30,0.96)');
    ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.stroke();
    ctx.fillStyle = '#ff4fd8'; ctx.font = tf; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    tLines.forEach((l, i) => ctx.fillText(l, x + 18, y + 16 + i * tlh));
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'right'; ctx.fillText('✕', x + w - 14, y + 12);
    m.closeRect = { x: x + w - 40, y: y + 6, w: 36, h: 32 };
    m.rects = [];
    let ry = y + headH;
    rows.forEach((r, i) => {
      const o = m.options[i];
      m.rects.push({ x: x + 12, y: ry, w: w - 24, h: r.h });
      Art.rrect(ctx, x + 12, ry, w - 24, r.h, 8, i === m.i ? 'rgba(123,92,255,0.45)' : 'rgba(255,255,255,0.05)');
      ctx.globalAlpha = o.disabled ? 0.45 : 1;
      const ty = ry + (r.h - r.ch) / 2;   // label (+ sub) centred in the row
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = lf;
      r.lab.forEach((l, j) => ctx.fillText(l, x + 24, ty + j * llh));
      ctx.fillStyle = '#99a'; ctx.font = sf;
      r.sub.forEach((l, j) => ctx.fillText(l, x + 24, ty + 2 + r.lab.length * llh + j * slh));
      if (o.right) { ctx.textAlign = 'right'; ctx.fillStyle = '#ffd23f'; ctx.font = rf; ctx.fillText(o.right, x + w - 24, ry + r.h / 2 - 8 * s); }
      ctx.globalAlpha = 1;
      ry += r.h + 6;
    });
    ctx.fillStyle = '#889'; ctx.font = `${12 * s}px system-ui`; ctx.textAlign = 'left'; ctx.fillText(m.footer, x + 18, y + h - 22, w - 36);
  }

  // ---------- Touch controls ----------
  function layoutTouch(VW, VH) {
    if (!Input.touchUsed) { Input.buttons = []; return; }
    const G = Game.G, s = hudScale(VW), b = [];
    const r = 34 * s;
    b.push({ name: 'attack', x: VW - 70 * s, y: VH - 80 * s, r: r * 1.35, label: 'ATK' });
    b.push({ name: 'ball', x: VW - 150 * s, y: VH - 50 * s, r: r * 0.8, label: '', icon: 'ball', count: G.items.pokeballs + G.items.masterballs });
    b.push({ name: 'grenade', x: VW - 150 * s, y: VH - 125 * s, r: r * 0.8, label: 'BOOM', count: G.items.grenades });
    b.push({ name: 'next', x: VW - 70 * s, y: VH - 170 * s, r: r * 0.8, label: '', icon: 'weapon' });
    if (G.mounts.length) b.push({ name: 'drive', x: VW - 225 * s, y: VH - 50 * s, r: r * 0.75, label: 'RIDE' });
    if (G.relics.gauntlet) b.push({ name: 'ability', x: VW - 225 * s, y: VH - 125 * s, r: r * 0.75, label: 'SNAP' });
    if (Game.prompt()) b.push({ name: 'interact', x: VW - 150 * s, y: VH - 200 * s, r: r * 0.85, label: 'TALK' });
    b.push({ name: 'map', x: VW / 2 + 30 * s, y: 26 * s, r: 20 * s, label: 'MAP' });
    b.push({ name: 'pause', x: VW / 2 - 30 * s, y: 26 * s, r: 20 * s, label: '❚❚' });
    Input.buttons = b;
  }
  function drawTouch(ctx) {
    if (!Input.touchUsed) return;
    for (const b of Input.buttons) {
      const held = Input.down(b.name);
      ctx.fillStyle = held ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(b.r * (b.label.length > 2 ? 0.42 : 0.8))}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x, b.y + 1);
      if (b.icon === 'ball') Art.pokeball(ctx, b.x, b.y, b.r * 0.45);
      if (b.icon === 'weapon') Art.weaponIcon(ctx, Game.G.weapon, b.x, b.y, b.r / 26);
      if (b.count != null) { ctx.font = 'bold 11px system-ui'; ctx.fillStyle = '#ffd23f'; ctx.fillText(b.count, b.x + b.r * 0.7, b.y - b.r * 0.7); }
    }
    const st = Input.stick;
    if (st.id != null) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(st.ox, st.oy, 50, 0, Math.PI * 2); ctx.stroke();
      const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy), k = d > 50 ? 50 / d : 1;
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(st.ox + dx * k, st.oy + dy * k, 22, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- Frame ----------
  UI.update = (dt) => {
    if (UI.dialog) { updateDialog(dt); return true; }
    if (UI.menuState) { updateMenu(); return true; }
    if (UI.mapOpen) { updateMap(); return true; }
    if (UI.debriefOpen) return true;
    if (Game.dead || Game.victory) return false;
    if (Input.hit('map')) { UI.openMap(); return true; }
    return false;
  };

  UI.draw = (ctx, VW, VH, dt) => {
    const G = Game.G;
    drawWeather(ctx, VW, VH, dt);
    if (Game.P.bulletTime > 0) { ctx.fillStyle = 'rgba(80,255,120,0.08)'; ctx.fillRect(0, 0, VW, VH); }
    if (Game.P.slow > 0) { ctx.fillStyle = 'rgba(80,120,200,0.12)'; ctx.fillRect(0, 0, VW, VH); }
    // interaction prompt
    const pr = !UI.modal && Game.prompt();
    if (pr) {
      const sp = Game.screenOf(pr.x, pr.y + 30, 2.3), x = sp.x, y = sp.y;
      const label = `${Input.touchUsed ? '' : 'E · '}${pr.text}`;
      ctx.font = 'bold 12px system-ui'; const w = ctx.measureText(label).width + 16;
      Art.rrect(ctx, x - w / 2, y - 12, w, 22, 8, 'rgba(10,10,30,0.85)');
      ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
    }
    drawHUD(ctx, VW, VH, dt);
    layoutTouch(VW, VH);
    if (!UI.modal) drawTouch(ctx);
    if (Game.dead) {
      ctx.fillStyle = `rgba(60,0,0,${0.55})`; ctx.fillRect(0, 0, VW, VH);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 46px system-ui'; ctx.fillStyle = '#ff4a4a'; ctx.fillText('ZEROED', VW / 2, VH / 2 - 20);
      ctx.font = '16px system-ui'; ctx.fillStyle = '#fdd'; ctx.fillText(`Taken out by ${Game.deathCause}. Respawning at Nexus Prime...`, VW / 2, VH / 2 + 22);
    }
    if (Game.victory) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, VW, VH);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const g = ctx.createLinearGradient(VW / 2 - 250, 0, VW / 2 + 250, 0);
      g.addColorStop(0, '#ff4fd8'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#4ff3ff');
      ctx.font = `900 ${Math.min(54, VW / 12)}px system-ui`; ctx.fillStyle = g; ctx.fillText('YOU FOUND THE EGG', VW / 2, VH / 2 - 30);
      ctx.font = '18px system-ui'; ctx.fillStyle = '#fff';
      ctx.fillText(`Rank #${G.eggRank} of ${NX.RIVALS.length + 1} · ${Math.round(G.playTime / 60)} minutes · Level ${G.level} · ${NX.fmt(G.score)} points`, VW / 2, VH / 2 + 20);
    }
    if (UI.flashState) {
      const f = UI.flashState; f.t += dt;
      const a = f.a * Math.max(0, 1 - f.t / 0.35);
      if (a <= 0) UI.flashState = null; else { ctx.globalAlpha = a; ctx.fillStyle = f.color; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    }
    if (UI.mapOpen) drawMap(ctx, VW, VH);
    if (UI.menuState) drawMenu(ctx, VW, VH);
    if (UI.dialog) drawDialog(ctx, VW, VH);   // on top: a dialog takes input before a menu
  };

  UI.debrief = (moment) => {
    if (UI.debriefOpen || !window.Feedback || !Game.G) return;
    // never cover a conversation (e.g. the castle-reveal debrief fires on a timer): wait for it to end
    if (UI.dialog || UI.menuState) { setTimeout(() => UI.debrief(moment), 600); return; }
    const G = Game.G;
    UI.debriefOpen = true;
    Input.clear();
    window.Feedback.show({
      moment,
      summary: `Lv ${G.level} · stage ${Game.stageId()} · ${NX.KEY_ORDER.filter((k) => Game.isDone(k + '_gate')).length}/3 gates · ${Game.discoveredCount()} sectors · ${G.kills} kills · ${Math.round(G.playTime / 60)} min played`,
    }, () => { UI.debriefOpen = false; Input.clear(); });
  };
  UI.victoryDone = async () => {
    const G = Game.G;
    await UI.say('The Curator', [
      `Congratulations, ${G.name}. You found the Egg — rank #${G.eggRank} on the Scoreboard.`,
      `${Math.round(G.playTime / 60)} minutes. ${Game.discoveredCount()} sectors. ${G.kills} enemies. ${Object.keys(G.relics).length} relics.`,
      'The NEXUS is yours to keep exploring. Raid bosses still wait at the edges of every fandom.',
    ]);
    UI.debrief('egg');
  };
})();
