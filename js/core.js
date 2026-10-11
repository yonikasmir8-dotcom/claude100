// Core utilities shared by every module: seeded RNG + noise, math, storage, sound, input.
(() => {
  'use strict';
  const NX = window.NX = window.NX || {};
  const C = NX.C = window.NX_CONFIG;

  // ---------- Seeded randomness ----------
  NX.hash = (...ns) => {
    let h = (2166136261 ^ C.world.seed) >>> 0;
    for (const n of ns) {
      h = Math.imul(h ^ (n | 0), 16777619);
      h ^= h >>> 13;
      h = Math.imul(h, 0x5bd1e995);
      h ^= h >>> 15;
    }
    return h >>> 0;
  };
  NX.h01 = (...ns) => NX.hash(...ns) / 4294967296;
  NX.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  NX.noise = (x, y, salt = 0) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), w = smooth(y - yi);
    const a = NX.h01(xi, yi, salt), b = NX.h01(xi + 1, yi, salt), c = NX.h01(xi, yi + 1, salt), d = NX.h01(xi + 1, yi + 1, salt);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  NX.fbm = (x, y, salt = 0) => NX.noise(x, y, salt) * 0.6 + NX.noise(x * 2.1, y * 2.1, salt + 7) * 0.3 + NX.noise(x * 4.3, y * 4.3, salt + 13) * 0.1;

  // ---------- Math ----------
  NX.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  NX.rand = (a, b) => a + Math.random() * (b - a);
  NX.randi = (a, b) => Math.floor(NX.rand(a, b + 1));
  NX.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  NX.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  NX.angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  NX.angleDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  NX.weighted = (pairs) => {
    let total = 0;
    for (const [, w] of pairs) total += w;
    let r = Math.random() * total;
    for (const [v, w] of pairs) { r -= w; if (r < 0) return v; }
    return pairs[pairs.length - 1][0];
  };
  NX.fmt = (n) => Math.floor(n).toLocaleString('en-US');

  NX.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
  };

  // ---------- Sound: a tiny WebAudio synth, no assets ----------
  const Sound = NX.Sound = {
    ac: null, noiseBuf: null, muted: NX.store.get('nx_muted', false), lastPlay: {},
    init() {
      if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
      try {
        this.ac = new (window.AudioContext || window.webkitAudioContext)();
        const len = this.ac.sampleRate;
        this.noiseBuf = this.ac.createBuffer(1, len, len);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch { this.ac = null; }
    },
    ok(name, gap = 0.04) {
      if (this.muted || !this.ac) return false;
      const now = this.ac.currentTime;
      if (this.lastPlay[name] && now - this.lastPlay[name] < gap) return false;
      this.lastPlay[name] = now;
      return true;
    },
    tone(f1, f2, dur, type = 'square', vol = 0.04, delay = 0) {
      const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ac.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol, freq) {
      const t = this.ac.currentTime, s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
      s.buffer = this.noiseBuf;
      f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(this.ac.destination);
      s.start(t); s.stop(t + dur);
    },
    notes(seq, type = 'square', vol = 0.04) {
      let d = 0;
      for (const [f, len] of seq) { if (f) this.tone(f, f, len, type, vol, d); d += len; }
    },
    play(name) {
      if (!this.ok(name)) return;
      switch (name) {
        case 'swing': this.noise(0.08, 0.06, 3000); break;
        case 'saber': this.tone(110, 160, 0.18, 'sawtooth', 0.04); break;
        case 'laser': this.tone(1400, 220, 0.1, 'square', 0.025); break;
        case 'zap': this.tone(900, 1800, 0.08, 'square', 0.02); break;
        case 'fire': this.tone(300, 120, 0.15, 'triangle', 0.05); break;
        case 'disc': this.tone(600, 900, 0.12, 'sine', 0.05); break;
        case 'beam': this.tone(180, 220, 0.12, 'sawtooth', 0.02); break;
        case 'enemyShot': this.tone(500, 140, 0.12, 'sawtooth', 0.012); break;
        case 'hit': this.tone(220, 90, 0.08, 'square', 0.04); break;
        case 'hurt': this.tone(260, 60, 0.25, 'sawtooth', 0.06); break;
        case 'kill': this.noise(0.25, 0.12, 2500); break;
        case 'boom': this.noise(0.9, 0.35, 1400); break;
        case 'coin': this.notes([[988, 0.06], [1319, 0.12]], 'square', 0.03); break;
        case 'pickup': this.notes([[523, 0.06], [659, 0.06], [784, 0.1]], 'triangle', 0.06); break;
        case 'chest': this.notes([[392, 0.08], [523, 0.08], [659, 0.08], [1047, 0.2]], 'triangle', 0.06); break;
        case 'throw': this.tone(400, 800, 0.15, 'triangle', 0.04); break;
        case 'wobble': this.tone(300, 260, 0.1, 'triangle', 0.05); break;
        case 'caught': this.notes([[659, 0.1], [784, 0.1], [1047, 0.25]], 'square', 0.04); break;
        case 'levelup': this.notes([[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.24]], 'square', 0.04); break;
        case 'key': this.notes([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.12], [1319, 0.4]], 'triangle', 0.08); break;
        case 'warp': this.tone(200, 1600, 0.5, 'sine', 0.07); break;
        case 'pellet': this.tone(500, 700, 0.04, 'square', 0.015); break;
        case 'power': this.tone(200, 900, 0.4, 'square', 0.04); break;
        case 'block': this.notes([[660, 0.05], [990, 0.08]], 'square', 0.04); break;
        case 'break': this.noise(0.15, 0.1, 1800); break;
        case 'car': this.tone(80, 160, 0.3, 'sawtooth', 0.04); break;
        case 'talk': this.tone(700, 700, 0.03, 'square', 0.015); break;
        case 'boss': this.notes([[110, 0.3], [104, 0.3], [98, 0.6]], 'sawtooth', 0.07); break;
        case 'menu': this.tone(880, 880, 0.04, 'square', 0.02); break;
        case 'egg': this.notes([[523, 0.15], [659, 0.15], [784, 0.15], [1047, 0.15], [784, 0.15], [1047, 0.6]], 'square', 0.06); break;
      }
    },
    toggle() { this.muted = !this.muted; NX.store.set('nx_muted', this.muted); return this.muted; },
  };

  // ---------- Input: keyboard, mouse, touch (virtual stick + buttons) ----------
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Space: 'attack', KeyJ: 'attack', KeyE: 'interact', Enter: 'interact', KeyQ: 'prev', Tab: 'next', KeyR: 'next',
    KeyC: 'ball', KeyG: 'grenade', KeyV: 'drive', KeyF: 'ability', KeyM: 'map', Escape: 'pause', KeyP: 'pause',
  };
  for (let i = 1; i <= 9; i++) KEYMAP['Digit' + i] = 'slot' + i;

  const Input = NX.Input = {
    held: new Set(), edge: new Set(),
    mouse: { x: 0, y: 0, down: false, lastMove: -1e9 },
    stick: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
    touchUsed: false,
    buttons: [],             // [{name, x, y, r}] laid out by the HUD each frame (logical px)
    pointers: new Map(),     // pointerId -> 'stick' | 'aim' | button name
    toLogical: (cx, cy) => ({ x: cx, y: cy }),
    onAnyPress: null,

    down(name) {
      if (this.held.has(name)) return true;
      for (const v of this.pointers.values()) if (v === name) return true;
      return false;
    },
    hit(name) { if (this.edge.has(name)) { this.edge.delete(name); return true; } return false; },
    endFrame() { this.edge.clear(); },
    clear() { this.held.clear(); this.edge.clear(); this.pointers.clear(); this.stick.id = null; this.mouse.down = false; },

    move() {
      let x = 0, y = 0;
      if (this.down('left')) x -= 1;
      if (this.down('right')) x += 1;
      if (this.down('up')) y -= 1;
      if (this.down('down')) y += 1;
      if (this.stick.id != null) {
        const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy, d = Math.hypot(dx, dy);
        if (d > 8) { const m = Math.min(1, d / 50); x = dx / d * m; y = dy / d * m; }
      }
      const len = Math.hypot(x, y);
      return len > 1 ? { x: x / len, y: y / len } : { x, y };
    },
  };

  const typing = (e) => e.target && e.target.closest && e.target.closest('input, textarea, select');
  addEventListener('keydown', (e) => {
    if (typing(e)) return;
    const a = KEYMAP[e.code];
    if (!a) return;
    if (['up', 'down', 'left', 'right', 'attack', 'next'].includes(a)) e.preventDefault();
    Sound.init();
    if (!Input.held.has(a)) Input.edge.add(a);
    Input.held.add(a);
    Input.touchUsed = false;
  });
  addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) Input.held.delete(a); });
  addEventListener('blur', () => Input.clear());

  NX.bindPointer = (canvas) => {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      Sound.init();
      canvas.setPointerCapture(e.pointerId);
      const p = Input.toLogical(e.clientX, e.clientY);
      if (Input.onAnyPress && Input.onAnyPress(p, e)) return;
      if (e.pointerType === 'mouse') {
        Input.touchUsed = false;
        Input.mouse.x = p.x; Input.mouse.y = p.y; Input.mouse.lastMove = performance.now();
        if (e.button === 0) { Input.mouse.down = true; Input.edge.add('attack'); Input.edge.add('click'); }
        return;
      }
      Input.touchUsed = true;
      const btn = Input.buttons.find((b) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r);
      if (btn) { Input.pointers.set(e.pointerId, btn.name); Input.edge.add(btn.name); return; }
      Input.edge.add('click');
      Input.mouse.x = p.x; Input.mouse.y = p.y;
      if (p.x < NX.view.W * 0.45 && Input.stick.id == null) {
        Input.stick.id = e.pointerId; Input.stick.ox = Input.stick.x = p.x; Input.stick.oy = Input.stick.y = p.y;
        Input.pointers.set(e.pointerId, 'stick');
      } else {
        Input.pointers.set(e.pointerId, 'attack');
        Input.edge.add('attack');
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = Input.toLogical(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') { Input.mouse.x = p.x; Input.mouse.y = p.y; Input.mouse.lastMove = performance.now(); return; }
      if (Input.stick.id === e.pointerId) { Input.stick.x = p.x; Input.stick.y = p.y; }
    });
    const up = (e) => {
      if (e.pointerType === 'mouse') { Input.mouse.down = false; return; }
      if (Input.stick.id === e.pointerId) Input.stick.id = null;
      Input.pointers.delete(e.pointerId);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  };

  NX.view = { W: 960, H: 540, zoom: 1, dpr: 1 };
})();
