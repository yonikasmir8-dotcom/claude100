// MAIN — boot, title screen, pause menu, resize, and the frame loop.
(() => {
  'use strict';
  const NX = window.NX, C = NX.C, Game = NX.Game, UI = NX.UI, Input = NX.Input, Sound = NX.Sound, Art = NX.Art;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  let state = 'title';
  const params = new URLSearchParams(location.search);
  const R3D = NX.R3D;
  const use3D = !params.has('2d') && R3D.init(document.getElementById('view3d'));
  if (!use3D) document.getElementById('view3d').style.display = 'none';
  NX.use3D = use3D;

  // ---------- Resize: logical view keeps ~540px on the short side ----------
  function resize() {
    const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    const zoom = NX.clamp(Math.min(w, h) / 540, 0.62, 2.4);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    Object.assign(NX.view, { W: w / zoom, H: h / zoom, zoom, dpr });
    if (use3D) R3D.resize(w, h, dpr);
    Input.toLogical = (cx, cy) => { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left) / zoom, y: (cy - r.top) / zoom }; };
  }
  addEventListener('resize', resize);
  resize();
  NX.bindPointer(canvas);
  canvas.addEventListener('wheel', (e) => { if (use3D && state === 'play') { e.preventDefault(); R3D.zoom(e.deltaY); } }, { passive: false });

  // ---------- Title ----------
  const COLORS = ['#4a9cff', '#ff4f8b', '#ffd23f', '#5be0a6', '#b06aff', '#ff8a3a', '#e8e8e8', '#2a2a2a'];
  let suit = NX.store.get('nx_suit', COLORS[0]);
  const N = (2 * C.world.radius + 1) ** 2;
  $('title-stats').textContent = `${NX.fmt(N)} sectors · ${NX.THEME_LIST.length} fandoms · ${Object.keys(NX.ENEMIES).length} enemy types · ${Object.keys(NX.WEAPONS).length} weapons · 3 gates · 1 Easter egg`;
  $('avatar-name').value = NX.store.get('nx_name', '');
  $('swatches').innerHTML = COLORS.map((c) => `<button type="button" style="background:${c}" data-c="${c}" aria-label="Suit color ${c}" aria-pressed="${c === suit}"></button>`).join('');
  // Sculpt the core cast in the background while the title screen is up.
  const prewarm = () => {
    if (!use3D) return;
    // campaign sites: arcade cabinets + one gate door per act colour (models.js keys them 'gatedoor:<color>')
    const gateColors = NX.CAMPAIGN ? NX.KEY_ORDER.map((a) => NX.CAMPAIGN.acts[a].color) : ['#e08a4a', '#3fcf8e', '#bdf4ff'];
    R3D.prewarm(['player:' + suit, 'curator', 'shop', 'garage', 'score', 'gunter:#4a9cff', 'gunter:#ff4f8b', 'gunter:#ffd23f', 'pk_coin', 'pk_heart', 'pk_pokeballs', 'pk_grenade', 'chest', 'cabinet', ...gateColors.map((c) => 'gatedoor:' + c), 'egg', 'statue', 'tree_round:#2f8a3a', 'bush:#2f9a3c']);
    R3D.prewarm(Object.keys(NX.ENEMIES).filter((k) => !NX.ENEMIES[k].boss));   // includes shieldgen
    R3D.prewarm(['pk_mushroom', 'pk_star', 'pk_extralife', 'pk_relic', 'pk_mount', 'pk_masterball', 'mount_delorean', 'mount_batmobile', 'mount_ecto1', 'mount_nimbus', 'mount_elytra']);
    R3D.prewarm(Object.keys(NX.ENEMIES).filter((k) => NX.ENEMIES[k].boss));    // includes ioi655321
    R3D.prewarm(['anorak', 'pk_egg']);
  };
  prewarm();
  $('swatches').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    suit = b.dataset.c; NX.store.set('nx_suit', suit);
    if (use3D) R3D.prewarm(['player:' + suit]);
    for (const x of $('swatches').children) x.setAttribute('aria-pressed', x.dataset.c === suit);
  });

  function showTitle() {
    state = 'title';
    $('title').hidden = false;
    $('pause').hidden = true;
    $('btn-continue').hidden = !Game.hasSave();
    $('btn-new').textContent = Game.hasSave() ? 'New Game (overwrite)' : 'New Game';
  }
  function play() {
    $('title').hidden = true;
    state = 'play';
    Sound.init();
    Input.clear();
  }
  $('title-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (Game.hasSave() && !confirm('Start over? Your current gunter will be replaced.')) return;
    const name = ($('avatar-name').value.trim() || 'Gunter').slice(0, 16);
    NX.store.set('nx_name', name);
    if (use3D) R3D.reset();
    Game.newGame(name, suit);
    play();
    const touch = matchMedia('(pointer: coarse)').matches;
    UI.say('NEXUS OS', [
      `Avatar "${name}" online. Welcome to THE NEXUS — a world beyond worlds.`,
      touch
        ? 'Left thumb: move. Right side: attack (auto-aim). Buttons: Poké Ball, grenade, swap weapon, ride, map — and TALK beside people, arcade cabinets and gates.'
        : 'WASD to move · Space/click to attack (aim with the mouse) · Q/R switch weapons · C Poké Ball · G grenade · V ride · M map · E talk / play a cabinet.',
      'Find THE CURATOR (purple robe) beside the golden altar to begin the hunt. Three gates — copper, jade and crystal — stand between you and the Egg.',
    ]);
  });
  $('btn-continue').addEventListener('click', () => { if (use3D) R3D.reset(); if (Game.load()) { if (use3D) R3D.prewarm(['player:' + Game.G.color]); play(); } });

  // ---------- Pause ----------
  function openPause() {
    if (state !== 'play') return;
    Game.save();
    state = 'paused';
    renderPause();
    $('pause').hidden = false;
  }
  function closePause() { $('pause').hidden = true; state = 'play'; Input.clear(); }
  function renderPause() {
    const G = Game.G;
    $('p-sound').textContent = `Sound: ${Sound.muted ? 'off' : 'on'}`;
    $('p-pets').innerHTML = G.pets.length
      ? G.pets.map((p, i) => `<button class="item" data-pet="${i}" aria-pressed="${p.active}">${NX.ENEMIES[p.type].name}<small>${NX.ENEMIES[p.type].fandom}${p.downUntil > G.playTime ? ' · fainted' : ''}</small></button>`).join('')
      : '<span class="empty">No squad yet. Weaken any enemy and throw a Poké Ball (C).</span>';
    $('p-relics').innerHTML = Object.keys(G.relics).length
      ? Object.keys(G.relics).map((r) => `<span class="item">${NX.RELICS[r].name}<small>${NX.RELICS[r].desc}</small></span>`).join('')
      : '<span class="empty">Beat raid bosses (☠ on the map) to earn relics.</span>';
    $('p-weapons').innerHTML = G.weapons.map((w) => `<button class="item" data-weapon="${w}" aria-pressed="${w === G.weapon}">${NX.WEAPONS[w].name}<small>${NX.WEAPONS[w].fandom}</small></button>`).join('')
      + `<span class="empty">${Object.keys(NX.WEAPONS).length - G.weapons.length} more hidden in chests across the fandoms.</span>`;
    $('p-stats').textContent = `${G.name} · Level ${G.level} · ${Math.round(G.playTime / 60)} min · ${NX.KEY_ORDER.filter((k) => Game.isDone(k + '_gate')).length}/3 gates · ${Game.discoveredCount()} sectors explored · ${G.kills} kills · ${G.deaths} deaths · best streak ${G.bestStreak} · v${C.version}`;
  }
  $('p-pets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pet]'); if (!b) return;
    const r = Game.togglePet(Number(b.dataset.pet));
    if (r === 'full') alert(`Only ${C.player.maxActivePets} squad members can be active. Bench one first.`);
    renderPause();
  });
  $('p-weapons').addEventListener('click', (e) => { const b = e.target.closest('[data-weapon]'); if (b) { Game.equip(b.dataset.weapon); renderPause(); } });
  $('p-resume').addEventListener('click', closePause);
  $('p-map').addEventListener('click', () => { closePause(); UI.openMap(); });
  $('p-feedback').addEventListener('click', () => { closePause(); UI.debrief('manual'); });
  $('p-export').addEventListener('click', () => window.Feedback.exportAll());
  $('p-sound').addEventListener('click', () => { Sound.init(); Sound.toggle(); renderPause(); });
  $('p-quit').addEventListener('click', () => { Game.save(); showTitle(); });

  addEventListener('keydown', (e) => {
    if (state === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) { e.preventDefault(); closePause(); }
  });
  addEventListener('beforeunload', () => { if (state !== 'title') Game.save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play' && !UI.modal) openPause(); });

  // ---------- Title backdrop: warp through the fandom colors ----------
  const stars = Array.from({ length: 260 }, () => ({ x: NX.rand(-1, 1), y: NX.rand(-1, 1), z: Math.random(), c: NX.THEMES[NX.pick(NX.THEME_LIST)].map }));
  function drawTitle(dt) {
    const { W: VW, H: VH } = NX.view;
    ctx.fillStyle = 'rgba(5,4,15,0.35)'; ctx.fillRect(0, 0, VW, VH);
    const cx = VW / 2, cy = VH / 2;
    for (const s of stars) {
      const pz = s.z;
      s.z -= dt * 0.25;
      if (s.z <= 0.02) { s.z = 1; s.x = NX.rand(-1, 1); s.y = NX.rand(-1, 1); }
      const k = 1 / s.z, pk = 1 / pz;
      const x = cx + s.x * VW * 0.5 * k * 0.3, y = cy + s.y * VH * 0.5 * k * 0.3;
      const px = cx + s.x * VW * 0.5 * pk * 0.3, py = cy + s.y * VH * 0.5 * pk * 0.3;
      ctx.strokeStyle = s.c; ctx.globalAlpha = Math.min(1, (1 - s.z) * 1.5); ctx.lineWidth = Math.max(0.5, (1 - s.z) * 3);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // horizon grid
    ctx.strokeStyle = 'rgba(255,79,216,0.25)'; ctx.lineWidth = 1;
    const t = performance.now() / 1000;
    for (let i = 0; i < 12; i++) { const y = VH * 0.72 + Math.pow((i + (t % 1)) / 12, 2) * VH * 0.3; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke(); }
    for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 20, VH * 0.72); ctx.lineTo(cx + i * 160, VH); ctx.stroke(); }
  }

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const { W: VW, H: VH, zoom, dpr } = NX.view;
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, 0, 0);
    if (state === 'title') {
      if (use3D) R3D.prewarmTick(30);
      drawTitle(dt);
    } else {
      if (state === 'play') {
        const consumed = UI.update(dt);
        if (!consumed && !UI.modal) {
          if (Input.hit('pause')) openPause();
          else Game.update(dt);
        }
      }
      if (use3D) {
        R3D.render(dt);
        ctx.clearRect(0, 0, VW, VH);
        Game.drawOverlay(ctx);
      } else {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
        Game.draw(ctx);
      }
      UI.draw(ctx, VW, VH, state === 'play' ? dt : 0);
    }
    if (use3D) {
      // the pill sits top-centre: keep it off the map, menus, boss bars and the trial HUD
      const busy = state !== 'title' && (UI.mapOpen || UI.menuState || Game.trial() || Game.bossList().length);
      const n = R3D.pendingCount(), el = $('loading');
      el.hidden = n === 0 || !!busy;
      if (n) el.textContent = `Sculpting ${n} high-poly model${n === 1 ? '' : 's'}…`;
    }
    Input.endFrame();
    requestAnimationFrame(frame);
  }
  showTitle();
  requestAnimationFrame(frame);

  // Expose for automated playtests (?debug) and console tinkering.
  NX.debug = { Game, UI, start: (name) => { Game.newGame(name || 'Tester', '#4a9cff'); play(); } };
})();
