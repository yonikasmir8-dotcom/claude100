// ART — everything is drawn procedurally with canvas shapes (no image assets).
(() => {
  'use strict';
  const NX = window.NX, T = NX.T;
  const TS = NX.C.world.tile;
  const Art = NX.Art = {};

  const circle = (ctx, x, y, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const ellipse = (ctx, x, y, rx, ry, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
  const rrect = (ctx, x, y, w, h, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
  Art.circle = circle; Art.rrect = rrect;

  // ---------- Tiles ----------
  // nb(dx,dy) returns the neighbouring tile type (used for edge-aware neon walls).
  Art.tile = (ctx, th, type, x, y, h, t, nb) => {
    const floor = th.floor[h & 1];
    switch (type) {
      case T.FLOOR:
        ctx.fillStyle = floor; ctx.fillRect(x, y, TS, TS);
        if (th.gen === 'grid') { ctx.fillStyle = th.gridLine || 'rgba(24,224,255,0.10)'; ctx.fillRect(x, y, TS, 1); ctx.fillRect(x, y, 1, TS); }
        else if (th.gen === 'hub') { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x + 1, y + 1, TS - 2, TS - 2); }
        else if ((h & 7) === 0) { ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(x + (h >> 3) % 24, y + (h >> 5) * 4 % 24, 4, 4); }
        return;
      case T.ROAD:
        ctx.fillStyle = th.road; ctx.fillRect(x, y, TS, TS);
        if (th.gen === 'grid') { ctx.fillStyle = 'rgba(24,224,255,0.25)'; ctx.fillRect(x, y + 15, TS, 2); }
        else if (th.gen === 'hub') { ctx.fillStyle = 'rgba(123,92,255,0.25)'; ctx.fillRect(x + 14, y + 14, 4, 4); }
        return;
      case T.WATER: {
        ctx.fillStyle = th.waterColor || '#3d8fd6'; ctx.fillRect(x, y, TS, TS);
        const o = Math.sin(t * 2 + h) * 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x + 6 + o, y + 10); ctx.lineTo(x + 14 + o, y + 10); ctx.moveTo(x + 16 - o, y + 22); ctx.lineTo(x + 26 - o, y + 22); ctx.stroke();
        return;
      }
      case T.WALL: return wall(ctx, th, x, y, h, t, nb, floor);
      case T.BREAK: return breakable(ctx, th, x, y, h, floor);
      case T.QBLOCK: {
        rrect(ctx, x + 1, y + 1, TS - 2, TS - 2, 3, '#f5b829');
        ctx.fillStyle = '#c7861a'; ctx.fillRect(x + 1, y + TS - 5, TS - 2, 4);
        ctx.fillStyle = (Math.floor(t * 3) % 3 === 0) ? '#fff6c8' : '#7a4a10';
        ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', x + TS / 2, y + TS / 2 + 1);
        return;
      }
      case T.USED:
        rrect(ctx, x + 1, y + 1, TS - 2, TS - 2, 3, '#8a5a2b');
        for (const [a, b] of [[5, 5], [TS - 8, 5], [5, TS - 8], [TS - 8, TS - 8]]) circle(ctx, x + a + 1.5, y + b + 1.5, 1.6, '#4a2a10');
        return;
      case T.PELLET:
        ctx.fillStyle = floor; ctx.fillRect(x, y, TS, TS);
        circle(ctx, x + TS / 2, y + TS / 2, 3, '#ffcfb0');
        return;
      case T.POWER:
        ctx.fillStyle = floor; ctx.fillRect(x, y, TS, TS);
        if (Math.floor(t * 4) % 2) circle(ctx, x + TS / 2, y + TS / 2, 9, '#ffcfb0');
        return;
      case T.GATE: {
        ctx.fillStyle = th.road; ctx.fillRect(x, y, TS, TS);
        const cx = x + TS / 2, cy = y + TS / 2;
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = `hsla(${(t * 120 + i * 60) % 360},100%,65%,${0.9 - i * 0.25})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(cx, cy, 13 - i * 3.5 + Math.sin(t * 4 + i) * 1.5, 13 - i * 3.5, t * (i + 1), 0, Math.PI * 2); ctx.stroke();
        }
        return;
      }
      case T.VOID:
        ctx.fillStyle = '#000'; ctx.fillRect(x, y, TS, TS);
        if ((h & 15) === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x + (h >> 4) % 30, y + (h >> 2) % 30, 1, 1); }
        return;
      case T.GRASS:
        ctx.fillStyle = floor; ctx.fillRect(x, y, TS, TS);
        ctx.fillStyle = '#3e9e3a';
        for (let i = 0; i < 4; i++) {
          const bx = x + 3 + i * 7 + ((h >> i) & 3), by = y + 8 + ((i & 1) ? 10 : 0), sway = Math.sin(t * 2 + i + h) * 1.5;
          ctx.beginPath(); ctx.moveTo(bx, by + 10); ctx.lineTo(bx + 3 + sway, by); ctx.lineTo(bx + 6, by + 10); ctx.fill();
        }
        return;
      case T.PROP:
        ctx.fillStyle = floor; ctx.fillRect(x, y, TS, TS);
        return prop(ctx, th, x, y, h, t);
      case T.DECOR:
        ctx.fillStyle = floor; ctx.fillRect(x, y, TS, TS);
        return decor(ctx, th, x, y, h, t);
      case T.ALTAR: {
        ctx.fillStyle = th.road; ctx.fillRect(x, y, TS, TS);
        rrect(ctx, x + 2, y + 6, TS - 4, TS - 8, 4, '#4a4070');
        const glow = 0.5 + Math.sin(t * 3) * 0.3;
        ellipse(ctx, x + TS / 2, y + 10, 9, 12, `rgba(255,230,120,${glow})`);
        ellipse(ctx, x + TS / 2, y + 11, 6, 8, '#fff3c4');
        return;
      }
    }
  };

  function wall(ctx, th, x, y, h, t, nb, floor) {
    switch (th.wall) {
      case 'mesa':
        ctx.fillStyle = th.wallColor; ctx.fillRect(x, y, TS, TS);
        ctx.fillStyle = th.wallTop; ctx.fillRect(x, y, TS, 10 + (h & 3));
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + (h % 20), y + 16, 8, 2);
        return;
      case 'tree':
        ctx.fillStyle = floor; ctx.fillRect(x, y, TS, TS);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(x + 13, y + 20, 6, 10);
        circle(ctx, x + 16, y + 14, 14, th.wallColor);
        circle(ctx, x + 11, y + 10, 6, 'rgba(255,255,255,0.12)');
        return;
      case 'brick':
        rrect(ctx, x, y, TS, TS, 2, th.wallColor);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 2, y + 2, TS - 4, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 2, y + TS - 5, TS - 4, 3);
        return;
      case 'neon':
      case 'gridwall':
      case 'neonwall': {
        const color = th.wallColor;
        ctx.fillStyle = th.wall === 'neonwall' ? '#1d1a33' : '#020208'; ctx.fillRect(x, y, TS, TS);
        ctx.strokeStyle = color; ctx.lineWidth = th.wall === 'gridwall' ? 3 : 2.5;
        if (th.wall === 'gridwall') { ctx.shadowColor = color; ctx.shadowBlur = 8; }
        ctx.beginPath();
        const W = T.WALL, i = 5;
        if (nb(0, -1) !== W) { ctx.moveTo(x, y + i); ctx.lineTo(x + TS, y + i); }
        if (nb(0, 1) !== W) { ctx.moveTo(x, y + TS - i); ctx.lineTo(x + TS, y + TS - i); }
        if (nb(-1, 0) !== W) { ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + TS); }
        if (nb(1, 0) !== W) { ctx.moveTo(x + TS - i, y); ctx.lineTo(x + TS - i, y + TS); }
        ctx.stroke();
        ctx.shadowBlur = 0;
        return;
      }
      case 'stone':
        ctx.fillStyle = th.wallColor; ctx.fillRect(x, y, TS, TS);
        for (let k = 0; k < 5; k++) {
          const v = (h >> k) & 7;
          ctx.fillStyle = v > 3 ? '#6b6b6b' : '#959595';
          ctx.fillRect(x + ((h * (k + 3)) % 26), y + ((h * (k + 7)) % 26), 6, 6);
        }
        return;
      case 'building':
        ctx.fillStyle = th.wallColor; ctx.fillRect(x, y, TS, TS);
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          const lit = ((h >> (i + j * 2)) & 3) === 0;
          ctx.fillStyle = lit ? (th.windows || '#ffd76a') : 'rgba(0,0,0,0.35)';
          ctx.fillRect(x + 6 + i * 13, y + 6 + j * 13, 7, 8);
        }
        return;
      case 'castle':
      case 'brickhouse': {
        ctx.fillStyle = th.wallColor; ctx.fillRect(x, y, TS, TS);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        for (let r = 0; r < 4; r++) {
          ctx.fillRect(x, y + r * 8 + 7, TS, 1);
          const off = r % 2 ? 0 : (th.wall === 'castle' ? 10 : 8);
          for (let c = 0; c < 3; c++) ctx.fillRect(x + off + c * (th.wall === 'castle' ? 20 : 16), y + r * 8, 1, 7);
        }
        if (th.wall === 'castle' && (h & 7) === 0) { ctx.fillStyle = '#ffd76a'; ctx.fillRect(x + 12, y + 9, 6, 10); }
        return;
      }
      case 'forerunner':
        ctx.fillStyle = th.wallColor; ctx.fillRect(x, y, TS, TS);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, TS, 4);
        ctx.fillStyle = `rgba(80,220,255,${0.45 + 0.3 * Math.sin(t * 2 + h)})`; ctx.fillRect(x + 4, y + 14, TS - 8, 2);
        if (h & 1) ctx.fillRect(x + 14, y + 6, 2, 20);
        return;
      case 'lcars': {
        ctx.fillStyle = th.wallColor; ctx.fillRect(x, y, TS, TS);
        const cols = ['#f7a83a', '#c08ad8', '#8ab0ff', '#e0705a'];
        rrect(ctx, x + 3, y + 5, TS - 6, 7, 3, cols[h & 3]);
        rrect(ctx, x + 3, y + 16, 12, 10, 3, cols[(h >> 2) & 3]);
        return;
      }
      case 'checker': {
        const a = '#c8762e', b = '#8a4a1a';
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { ctx.fillStyle = (i + j) % 2 ? a : b; ctx.fillRect(x + i * 16, y + j * 16, 16, 16); }
        ctx.fillStyle = '#5cd04a'; ctx.fillRect(x, y, TS, 5);
        return;
      }
      case 'vines':
        ctx.fillStyle = floor; ctx.fillRect(x, y, TS, TS);
        ctx.strokeStyle = th.wallColor; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y + 8 + (h & 7)); ctx.quadraticCurveTo(x + 16, y + 30, x + TS, y + 10 + (h & 15)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 6 + (h & 7), y); ctx.quadraticCurveTo(x + 28, y + 16, x + 10, y + TS); ctx.stroke();
        circle(ctx, x + 16, y + 16, 9, '#3a0f18');
        return;
      case 'panel':
        ctx.fillStyle = '#5a6068'; ctx.fillRect(x, y, TS, TS);
        rrect(ctx, x + 2, y + 2, TS - 4, TS - 4, 2, th.wallColor);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 4, y + 4, TS - 8, 3);
        return;
    }
    ctx.fillStyle = '#555'; ctx.fillRect(x, y, TS, TS);
  }

  function breakable(ctx, th, x, y, h, floor) {
    ctx.fillStyle = floor; ctx.fillRect(x, y, TS, TS);
    if (th.breakStyle === 'bush') {
      circle(ctx, x + 16, y + 17, 12, '#2f9a3c');
      circle(ctx, x + 11, y + 13, 5, '#58c25a'); circle(ctx, x + 21, y + 15, 4, '#58c25a');
    } else if (th.breakStyle === 'brick') {
      ctx.fillStyle = '#b8562a'; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#2b1408';
      for (let r = 0; r < 4; r++) {
        ctx.fillRect(x, y + r * 8 + 7, TS, 1);
        const off = r % 2 ? 0 : 8;
        for (let c = 0; c < 3; c++) ctx.fillRect(x + off + c * 16, y + r * 8, 1, 7);
      }
    } else if (th.breakStyle === 'ore') {
      ctx.fillStyle = '#8a8a8a'; ctx.fillRect(x, y, TS, TS);
      const ore = ['#5ef2e5', '#ffd23f', '#e0302a', '#2a2a2a'][h & 3];
      for (let k = 0; k < 5; k++) { ctx.fillStyle = ore; ctx.fillRect(x + ((h * (k + 2)) % 24) + 2, y + ((h * (k + 5)) % 24) + 2, 5, 5); }
    }
  }

  function prop(ctx, th, x, y, h, t) {
    const cx = x + TS / 2;
    switch (th.prop) {
      case 'vaporator':
        ctx.fillStyle = '#9aa0a6'; ctx.fillRect(cx - 4, y + 2, 8, 28);
        ctx.fillStyle = '#c8cdd2'; ctx.fillRect(cx - 9, y + 8, 18, 4); ctx.fillRect(cx - 7, y + 18, 14, 3);
        return;
      case 'pipe':
        ctx.fillStyle = '#1f9e2f'; ctx.fillRect(x + 6, y + 10, TS - 12, TS - 10);
        rrect(ctx, x + 2, y + 2, TS - 4, 10, 2, '#2ec43f');
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x + 9, y + 12, 3, TS - 14);
        return;
      case 'pot':
        ellipse(ctx, cx, y + 19, 10, 10, '#8a5a3a'); ellipse(ctx, cx, y + 9, 6, 3, '#5a3a24');
        return;
      case 'blocktree':
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(cx - 4, y + 14, 8, 18);
        ctx.fillStyle = '#3c8a2a'; ctx.fillRect(x + 2, y, TS - 4, 16);
        ctx.fillStyle = '#4fa83a'; ctx.fillRect(x + 6, y + 3, 8, 6);
        return;
      case 'lamp':
        ctx.fillStyle = '#222'; ctx.fillRect(cx - 2, y + 6, 4, 26);
        circle(ctx, cx, y + 6, 10, 'rgba(255,220,120,0.25)'); circle(ctx, cx, y + 6, 4, '#ffe9a8');
        return;
      case 'candle': {
        const fl = Math.sin(t * 10 + h) * 1.2;
        circle(ctx, cx, y + 10, 9, 'rgba(255,200,90,0.2)');
        ctx.fillStyle = '#f2ead6'; ctx.fillRect(cx - 3, y + 12, 6, 14);
        ellipse(ctx, cx + fl * 0.5, y + 9, 2.5, 4 + fl * 0.3, '#ffcc4a');
        return;
      }
      case 'tree2':
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(cx - 3, y + 16, 6, 14);
        circle(ctx, cx, y + 12, 11, '#3f6a2a'); circle(ctx, cx - 5, y + 8, 6, '#557f3a');
        return;
      case 'fence':
        ctx.fillStyle = '#555'; ctx.fillRect(cx - 3, y + 2, 6, 28);
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x + TS, y + 8); ctx.moveTo(x, y + 18); ctx.lineTo(x + TS, y + 18); ctx.stroke();
        if (Math.floor(t * 6 + h) % 7 === 0) { ctx.strokeStyle = '#9af0ff'; ctx.beginPath(); ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + 10, y + 13); ctx.lineTo(x + 16, y + 8); ctx.stroke(); }
        return;
      case 'console':
        rrect(ctx, x + 3, y + 8, TS - 6, 18, 3, '#4a4c58');
        for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#f7a83a', '#c08ad8', '#8ab0ff', '#e0705a'][(i + Math.floor(t * 2) + h) & 3]; ctx.fillRect(x + 6 + i * 6, y + 12, 4, 3); }
        return;
      case 'tardis':
        rrect(ctx, x + 6, y + 1, TS - 12, TS - 2, 2, '#1f4fa8');
        ctx.fillStyle = '#163a80'; ctx.fillRect(x + 6, y + 1, TS - 12, 5);
        ctx.fillStyle = '#cfe0ff'; ctx.fillRect(x + 9, y + 8, 5, 4); ctx.fillRect(x + 18, y + 8, 5, 4);
        circle(ctx, cx, y, 2, Math.floor(t * 2) % 2 ? '#fff' : '#9ab');
        return;
      case 'palm':
        ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, y + 30); ctx.quadraticCurveTo(cx + 4, y + 18, cx, y + 8); ctx.stroke();
        ctx.fillStyle = '#2fa83a';
        for (let i = 0; i < 5; i++) { const a = i * 1.26 + Math.sin(t + h) * 0.1; ellipse(ctx, cx + Math.cos(a) * 8, y + 8 + Math.sin(a) * 5, 8, 3, '#2fa83a'); }
        return;
      case 'statue': {
        rrect(ctx, x + 4, y + 18, TS - 8, 12, 2, '#4a4070');
        const icons = ['#4fc3ff', '#ffe23a', '#ff4a3a', '#3fcf8e', '#2b3cff', '#ff9a3a'];
        const c = icons[h % icons.length], bob = Math.sin(t * 2 + h) * 2;
        ctx.globalAlpha = 0.85;
        circle(ctx, cx, y + 10 + bob, 8, c);
        ctx.globalAlpha = 1;
        return;
      }
    }
  }

  function decor(ctx, th, x, y, h, t) {
    switch (th.decor || th.gen) {
      case 'bones':
        ctx.strokeStyle = '#f3ead6'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(x + 8, y + 20); ctx.lineTo(x + 22, y + 14); ctx.moveTo(x + 10, y + 12); ctx.lineTo(x + 18, y + 24); ctx.stroke();
        return;
      case 'flowers': {
        const cols = ['#ff5a7a', '#ffffff', '#ffd23f', '#a07aff'];
        for (let i = 0; i < 3; i++) circle(ctx, x + 6 + ((h >> i) % 20), y + 6 + ((h >> (i + 2)) % 20), 2.5, cols[(h + i) & 3]);
        return;
      }
      case 'hub': {
        const a = 0.25 + 0.2 * Math.sin(t * 2 + h);
        ctx.fillStyle = `rgba(255,79,216,${a})`; ctx.fillRect(x + 2, y + 2, TS - 4, TS - 4);
        return;
      }
      case 'grid':
        circle(ctx, x + 16, y + 16, 2, th.wallColor || '#18e0ff');
        return;
      case 'spores':
        for (let i = 0; i < 3; i++) circle(ctx, x + 6 + ((h >> i) % 20), y + 8 + ((h >> (i + 3)) % 18) + Math.sin(t + i + h) * 2, 1.6, 'rgba(255,255,255,0.5)');
        return;
      default:
        circle(ctx, x + 16, y + 16, 3, 'rgba(255,255,255,0.25)');
    }
  }

  // ---------- Characters ----------
  // A chunky top-down humanoid. o: { body, head, legs, arms, visor, eyes, hat, cape, hood, wings, aura,
  //   horns, petals, gauntlet, tail, belt, prop, propColor, badge }
  function humanoid(ctx, o, walk, face, s = 1, t = 0) {
    ctx.save(); ctx.scale(face < 0 ? -s : s, s);
    const sw = Math.sin(walk) * 3;
    if (o.aura) { ctx.globalAlpha = 0.35 + Math.sin(t * 8) * 0.1; ellipse(ctx, 0, -2, 18, 22, o.aura); ctx.globalAlpha = 1; }
    if (o.wings) {
      const f = Math.sin(t * 14) * 5;
      ctx.fillStyle = o.wings; ctx.beginPath();
      ctx.moveTo(-6, -4); ctx.lineTo(-22, -16 - f); ctx.lineTo(-16, 4); ctx.lineTo(-6, 4);
      ctx.moveTo(6, -4); ctx.lineTo(22, -16 - f); ctx.lineTo(16, 4); ctx.lineTo(6, 4); ctx.fill();
    }
    if (o.tail) { ctx.strokeStyle = o.tail; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-4, 8); ctx.quadraticCurveTo(-16, 12 + sw, -18, 0); ctx.stroke(); }
    if (o.cape) rrect(ctx, -9, -6, 18, 20, 4, o.cape);
    if (o.robe) { ctx.fillStyle = o.robe; ctx.beginPath(); ctx.moveTo(-9, -6); ctx.lineTo(9, -6); ctx.lineTo(12 + sw * 0.4, 16); ctx.lineTo(-12 - sw * 0.4, 16); ctx.fill(); }
    else { ctx.fillStyle = o.legs; ctx.fillRect(-6, 6 + sw * 0.3, 5, 9); ctx.fillRect(1, 6 - sw * 0.3, 5, 9); }
    rrect(ctx, -8, -6, 16, 15, 4, o.body);
    if (o.belt) { ctx.fillStyle = o.belt; ctx.fillRect(-8, 4, 16, 3); }
    ctx.fillStyle = o.arms || o.body; ctx.fillRect(-11, -4 + sw * 0.3, 4, 10); ctx.fillRect(7, -4 - sw * 0.3, 4, 10);
    if (o.gauntlet) circle(ctx, 9, 7 - sw * 0.3, 4, o.gauntlet);
    switch (o.prop) {
      case 'stick': ctx.strokeStyle = o.propColor || '#7a5a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(10, 10); ctx.stroke(); break;
      case 'spear': ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -18); ctx.lineTo(10, 10); ctx.stroke(); circle(ctx, 10, -18, 2.5, '#ccc'); break;
      case 'bow': ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(12, 0, 8, -1.3, 1.3); ctx.stroke(); break;
      case 'gun': ctx.fillStyle = o.propColor || '#222'; ctx.fillRect(9, 0, 9, 3); break;
      case 'wand': ctx.strokeStyle = o.propColor || '#e8e0d0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(10, 4); ctx.lineTo(18, -6); ctx.stroke(); break;
      case 'blade': ctx.strokeStyle = o.propColor || '#ccc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(10, 6); ctx.lineTo(16, -14); ctx.stroke(); break;
      case 'whip': ctx.strokeStyle = o.propColor || '#ff6a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, 4); ctx.quadraticCurveTo(24, 10 + sw * 2, 30, -4); ctx.stroke(); break;
      case 'saber': ctx.strokeStyle = o.propColor; ctx.lineWidth = 3; ctx.shadowColor = o.propColor; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(10, 4); ctx.lineTo(18, -18); ctx.stroke(); ctx.shadowBlur = 0; break;
    }
    if (o.hood) { ctx.fillStyle = o.hood; ctx.beginPath(); ctx.moveTo(-9, -4); ctx.quadraticCurveTo(-10, -24, 0, -24); ctx.quadraticCurveTo(10, -24, 9, -4); ctx.fill(); ctx.fillStyle = '#000'; ellipse(ctx, 0, -12, 5, 6, '#050505'); if (o.eyes) { circle(ctx, -2, -13, 1.2, o.eyes); circle(ctx, 2, -13, 1.2, o.eyes); } }
    else if (o.petals) {
      const op = 0.6 + Math.sin(t * 3) * 0.4;
      ctx.fillStyle = o.petals;
      for (let i = 0; i < 5; i++) { const a = i * 1.257 - Math.PI / 2; ellipse(ctx, Math.cos(a) * 7 * op, -13 + Math.sin(a) * 7 * op, 4, 6, o.petals); }
      circle(ctx, 0, -13, 4, '#3a0a10');
    } else {
      rrect(ctx, -7, -19, 14, 14, 5, o.head);
      if (o.visor) { ctx.fillStyle = o.visor; ctx.fillRect(-5, -14, 10, 4); }
      if (o.eyes) { ctx.fillStyle = o.eyes; ctx.fillRect(-4, -14, 3, 3); ctx.fillRect(2, -14, 3, 3); }
      if (o.mouth) { ctx.fillStyle = o.mouth; ctx.fillRect(-4, -9, 8, 2); }
      if (o.hat) { ctx.fillStyle = o.hat; ctx.fillRect(-8, -21, 16, 5); }
      if (o.crown) { ctx.fillStyle = o.crown; ctx.beginPath(); ctx.moveTo(-7, -18); ctx.lineTo(-5, -25); ctx.lineTo(-2, -20); ctx.lineTo(0, -26); ctx.lineTo(2, -20); ctx.lineTo(5, -25); ctx.lineTo(7, -18); ctx.fill(); }
      if (o.horns) { ctx.fillStyle = o.horns; ctx.beginPath(); ctx.moveTo(-6, -17); ctx.lineTo(-12, -27); ctx.lineTo(-3, -19); ctx.moveTo(6, -17); ctx.lineTo(12, -27); ctx.lineTo(3, -19); ctx.fill(); }
      if (o.ears) { ctx.fillStyle = o.ears; ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(-11, -22); ctx.lineTo(-4, -19); ctx.moveTo(6, -16); ctx.lineTo(11, -22); ctx.lineTo(4, -19); ctx.fill(); }
      if (o.jaw) { ctx.fillStyle = o.jaw; ctx.fillRect(-7, -8, 3, 5); ctx.fillRect(4, -8, 3, 5); }
    }
    if (o.badge) { ctx.fillStyle = o.badge; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('6', 0, 2); }
    if (o.emblem) circle(ctx, 0, 1, 3, o.emblem);
    ctx.restore();
  }
  Art.humanoid = humanoid;

  const H = Art.HUMANOIDS = {
    trooper: { body: '#f2f2f2', head: '#f7f7f7', legs: '#e0e0e0', visor: '#111', prop: 'gun', belt: '#333' },
    tusken: { body: '#c8a878', head: '#d8c09a', legs: '#a88a5a', eyes: '#222', prop: 'stick', robe: '#b89868' },
    moblin: { body: '#8a5a3a', head: '#c07a5a', legs: '#5a3a24', eyes: '#ff3030', prop: 'spear', ears: '#c07a5a' },
    zombie: { body: '#2f8fae', head: '#4fae4a', legs: '#3a3aa0', arms: '#4fae4a', eyes: '#111' },
    skeleton: { body: '#d8d8d8', head: '#e8e8e8', legs: '#bbb', eyes: '#222', prop: 'bow' },
    marshmallow: { body: '#ffffff', head: '#fff8f0', legs: '#f0f0f0', eyes: '#222', hat: '#3a62c8', emblem: '#e23636' },
    program: { body: '#0a1a24', head: '#0f2633', legs: '#0a1a24', visor: '#18e0ff', arms: '#18e0ff', belt: '#18e0ff' },
    agent: { body: '#1a1a1a', head: '#e8c4a0', legs: '#111', visor: '#000', prop: 'gun' },
    sixer: { body: '#6a6f7a', head: '#8a8f9a', legs: '#4a4f5a', visor: '#ff9b3d', badge: '#ff9b3d', prop: 'gun' },
    darklord: { body: '#111', head: '#1a1a1a', legs: '#0a0a0a', visor: '#333', cape: '#000', prop: 'saber', propColor: '#ff2a2a', belt: '#888' },
    chitauri: { body: '#6a6a5a', head: '#8a8a7a', legs: '#4a4a3a', eyes: '#5fffd0', prop: 'gun', propColor: '#5fffd0', jaw: '#5a5a4a' },
    hydra: { body: '#2a2a2a', head: '#e0c0a0', legs: '#1a1a1a', visor: '#222', emblem: '#e23636', prop: 'gun' },
    goon: { body: '#7a3aa8', head: '#f2f2f2', legs: '#2a2a2a', eyes: '#111', mouth: '#e23636', prop: 'stick', propColor: '#555' },
    parademon: { body: '#5a5a3a', head: '#6a6a4a', legs: '#3a3a2a', eyes: '#ffd23f', wings: '#3a3a2a' },
    deatheater: { body: '#111', head: '#ddd', legs: '#111', robe: '#0a0a0a', hood: '#141414', eyes: '#ccc', prop: 'wand' },
    orc: { body: '#4a4a3a', head: '#6a7a4a', legs: '#3a3a2a', eyes: '#ff3030', prop: 'blade', propColor: '#888', jaw: '#ddd' },
    uruk: { body: '#2a2a2a', head: '#5a4a3a', legs: '#1a1a1a', eyes: '#ff3030', prop: 'bow', emblem: '#f2f2f2' },
    nazgul: { body: '#0a0a0a', head: '#000', legs: '#000', robe: '#050505', hood: '#0a0a0a', eyes: '#9ab', prop: 'blade', propColor: '#aaa' },
    grunt: { body: '#6a5aa8', head: '#8a7a6a', legs: '#5a4a3a', eyes: '#ffb03a', visor: '#2a2a3a', prop: 'gun', propColor: '#7affb0', cape: '#ffb03a' },
    elite: { body: '#3a4aa8', head: '#5a5a6a', legs: '#2a3a8a', eyes: '#ffd23f', jaw: '#3a3a4a', prop: 'gun', propColor: '#5fa0ff' },
    borg: { body: '#2a2a2a', head: '#b8b8b0', legs: '#1a1a1a', eyes: '#ff3030', arms: '#3a3a3a', belt: '#5fff5f' },
    klingon: { body: '#4a3a2a', head: '#a87a5a', legs: '#2a2a2a', eyes: '#111', belt: '#d8b040', prop: 'blade', propColor: '#ccc', hat: '#2a1a10' },
    cyberman: { body: '#b8bcc4', head: '#d0d4dc', legs: '#9aa0a8', eyes: '#111', mouth: '#111', ears: '#d0d4dc' },
    angel: { body: '#9a9a94', head: '#a8a8a2', legs: '#8a8a84', robe: '#8f8f89', wings: '#b0b0aa', arms: '#a8a8a2' },
    saibaman: { body: '#3a8a3a', head: '#4aa04a', legs: '#2a6a2a', eyes: '#ff3030' },
    friezasoldier: { body: '#3a3a5a', head: '#e8c0a0', legs: '#2a2a3a', visor: '#3aff6a', arms: '#f2e8d0', belt: '#d8c040' },
    demogorgon: { body: '#7a6a6a', head: '#7a6a6a', legs: '#5a4a4a', arms: '#6a5a5a', petals: '#c04a4a' },
    mewtwo: { body: '#d8c8e0', head: '#e0d0e8', legs: '#a888c0', eyes: '#7a2ad0', tail: '#a888c0', ears: '#e0d0e8', aura: '#c070ff' },
    smith: { body: '#1a1a1a', head: '#e8c4a0', legs: '#111', visor: '#000', prop: 'gun', aura: '#3aff6a' },
    thanos: { body: '#2a3aa8', head: '#9a6ad0', legs: '#d8b040', arms: '#9a6ad0', eyes: '#111', gauntlet: '#ffd23f', hat: '#d8b040', aura: '#c070ff' },
    darkseid: { body: '#2a2a3a', head: '#6a6a6a', legs: '#1a1a2a', eyes: '#ff3a1a', aura: '#ff3a1a', belt: '#3a5aa8' },
    voldemort: { body: '#0a0a0a', head: '#e8e8e0', legs: '#000', robe: '#050505', eyes: '#ff3030', prop: 'wand', propColor: '#f2ead0' },
    balrog: { body: '#3a1a10', head: '#2a0a05', legs: '#1a0a05', eyes: '#ffb03a', horns: '#1a0a05', wings: '#1a0a05', aura: '#ff6a1a', prop: 'whip' },
    zealot: { body: '#d8b040', head: '#5a5a6a', legs: '#a88a20', eyes: '#ffd23f', jaw: '#3a3a4a', prop: 'saber', propColor: '#7ab0ff' },
    borgqueen: { body: '#1a1a1a', head: '#d0c8c0', legs: '#0a0a0a', eyes: '#111', arms: '#3a3a3a', crown: '#5a5a5a', aura: '#5fff5f' },
    frieza: { body: '#f2f2f2', head: '#f2f2f2', legs: '#e8e8e8', eyes: '#c0302a', tail: '#f2f2f2', emblem: '#a03ad0', crown: '#a03ad0' },
    staypuft: { body: '#ffffff', head: '#fff8f0', legs: '#f0f0f0', eyes: '#222', hat: '#3a62c8', emblem: '#e23636', mouth: '#222' },
  };

  // ---------- Enemies / pets ----------
  Art.enemy = (ctx, e, t) => {
    const d = e.def, walk = e.walk || 0, face = e.face || 1, flash = e.flash > 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (!e.flying) ellipse(ctx, 0, e.r * 0.9, e.r * 0.8, e.r * 0.3, 'rgba(0,0,0,0.25)');
    else ellipse(ctx, 0, e.r + 6, e.r * 0.6, e.r * 0.22, 'rgba(0,0,0,0.18)');
    if (e.flying) ctx.translate(0, Math.sin(t * 6 + e.id) * 3 - 6);
    if (e.fuse > 0 && Math.floor(t * 12) % 2) ctx.filter = 'brightness(3)';
    else if (flash) ctx.filter = 'brightness(2.5)';
    else if (e.adapted) ctx.filter = 'hue-rotate(80deg)';
    if (e.root > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 1.25) * e.r * 1.4, Math.sin(i * 1.25) * e.r * 1.4); ctx.stroke(); } }
    const s = (d.boss ? e.r / 14 : 1) * (d.scale || 1);
    if (H[d.art]) humanoid(ctx, H[d.art], walk, face, s, t);
    else drawSpecial(ctx, e, d, t, walk, face, s);
    ctx.filter = 'none';
    if (e.shieldHp > 0) { ctx.strokeStyle = `rgba(95,160,255,${0.4 + Math.sin(t * 10) * 0.2})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -2, e.r + 5, 0, Math.PI * 2); ctx.stroke(); }
    if (e.stun > 0) for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; circle(ctx, Math.cos(a) * 10, -e.r - 10 + Math.sin(a) * 3, 2, '#ffe23a'); }
    ctx.restore();
  };

  function drawSpecial(ctx, e, d, t, walk, face, s) {
    ctx.scale(s, s);
    switch (d.art) {
      case 'probe':
      case 'ultron': {
        const body = d.art === 'ultron' ? '#b8bcc4' : '#1e1e1e';
        circle(ctx, 0, 0, 10, body); circle(ctx, 3 * face, -2, 3, '#ff3030');
        ctx.strokeStyle = d.art === 'ultron' ? '#8a8e96' : '#333'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = -2; i <= 2; i++) { ctx.moveTo(i * 3, 8); ctx.lineTo(i * 4, 18 + Math.sin(t * 5 + i) * 2); }
        ctx.stroke(); return;
      }
      case 'critter': return critter(ctx, d, t, walk, face);
      case 'bird': {
        const flap = Math.sin(t * 18) * 6;
        ellipse(ctx, 0, 0, 10, 8, d.colors.body); ellipse(ctx, 0, 3, 6, 4, d.colors.belly);
        ctx.fillStyle = d.colors.body; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-18, -4 - flap); ctx.lineTo(-8, 4); ctx.moveTo(6, 0); ctx.lineTo(18, -4 - flap); ctx.lineTo(8, 4); ctx.fill();
        circle(ctx, 4 * face, -3, 1.8, '#111'); ctx.fillStyle = '#e8a030'; ctx.fillRect(7 * face - (face < 0 ? 3 : 0), -2, 3, 2);
        return;
      }
      case 'goomba':
        ctx.fillStyle = '#2a1a10'; ctx.fillRect(-9 + Math.sin(walk) * 2, 7, 7, 5); ctx.fillRect(2 - Math.sin(walk) * 2, 7, 7, 5);
        ellipse(ctx, 0, 4, 8, 6, '#f2d2a0');
        ctx.fillStyle = '#9a5a2a'; ctx.beginPath(); ctx.ellipse(0, -2, 13, 10, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-13, -2, 26, 3);
        ctx.fillStyle = '#fff'; ctx.fillRect(-6, -1, 4, 6); ctx.fillRect(2, -1, 4, 6);
        ctx.fillStyle = '#111'; ctx.fillRect(-5, 1, 2, 3); ctx.fillRect(3, 1, 2, 3);
        ctx.fillRect(-7, -4, 5, 1.5); ctx.fillRect(2, -4, 5, 1.5);
        return;
      case 'koopa':
      case 'bowser': {
        if (e.shell) { shell(ctx, t * 20, '#2fae3a'); return; }
        const big = d.art === 'bowser';
        ctx.fillStyle = big ? '#e8b040' : '#f2d23a'; ctx.fillRect(-7, 6 + Math.sin(walk) * 1.5, 5, 6); ctx.fillRect(2, 6 - Math.sin(walk) * 1.5, 5, 6);
        shell(ctx, 0, big ? '#3a8a2a' : '#2fae3a', big);
        circle(ctx, 10 * face, -8, big ? 8 : 6, big ? '#e8b040' : '#f2d23a'); circle(ctx, 12 * face, -9, 1.6, '#111');
        if (big) {
          ctx.fillStyle = '#e8501a'; ctx.fillRect(6 * face - 4, -18, 8, 5);
          ctx.fillStyle = '#f2f2e0'; ctx.beginPath(); ctx.moveTo(7 * face, -14); ctx.lineTo(4 * face, -22); ctx.lineTo(10 * face, -15); ctx.moveTo(13 * face, -14); ctx.lineTo(16 * face, -22); ctx.lineTo(15 * face, -12); ctx.fill();
        }
        return;
      }
      case 'piranha': {
        const open = (Math.sin(t * 6) + 1) * 0.35;
        ctx.fillStyle = '#2a9a3a'; ctx.fillRect(-2, 0, 4, 14);
        ellipse(ctx, -7, 10, 6, 3, '#3cbc4c'); ellipse(ctx, 7, 10, 6, 3, '#3cbc4c');
        ctx.fillStyle = '#e0302a'; ctx.beginPath(); ctx.arc(0, -4, 12, open, Math.PI * 2 - open); ctx.lineTo(0, -4); ctx.fill();
        for (const [a, b] of [[-5, -10], [3, -12], [-2, 2]]) circle(ctx, a, b, 2, '#fff');
        return;
      }
      case 'octorok':
        circle(ctx, 0, 0, 11, '#d83a3a');
        ctx.fillStyle = '#d83a3a'; ctx.fillRect(face > 0 ? 8 : -14, -3, 6, 6);
        for (let i = -1; i <= 1; i++) { ctx.fillStyle = '#b02a2a'; ctx.fillRect(i * 6 - 2, 9 + Math.sin(walk + i) * 1.5, 4, 5); }
        circle(ctx, -3 + face * 2, -3, 2.5, '#fff'); circle(ctx, 4 + face * 2, -3, 2.5, '#fff');
        return;
      case 'bat':
      case 'enderdragon': {
        const big = d.art === 'enderdragon', flap = Math.sin(t * (big ? 6 : 20)) * 7;
        ctx.fillStyle = big ? '#141018' : '#2a1a3a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-16, -6 + flap); ctx.lineTo(-8, 4); ctx.lineTo(0, 2); ctx.lineTo(8, 4); ctx.lineTo(16, -6 + flap); ctx.fill();
        if (big) { ctx.fillStyle = '#141018'; ctx.fillRect(-2, 2, 4, 12); ellipse(ctx, 0, -6, 4, 6, '#1f1a24'); }
        circle(ctx, 0, 0, 5, big ? '#1f1a24' : '#3a2a4a');
        const eye = big ? '#d070ff' : '#ff3030';
        circle(ctx, -2, big ? -8 : -1, 1.2, eye); circle(ctx, 2, big ? -8 : -1, 1.2, eye);
        return;
      }
      case 'pacghost':
      case 'bigghost': {
        const scared = e.scared > 0;
        const body = scared ? (e.scared < 2 && Math.floor(t * 6) % 2 ? '#fff' : '#2121de') : (d.color || '#ff2020');
        ctx.fillStyle = body; ctx.beginPath();
        ctx.arc(0, -2, 12, Math.PI, 0); ctx.lineTo(12, 11);
        for (let i = 0; i < 4; i++) { const x0 = 12 - i * 6; ctx.lineTo(x0 - 3, 11 - 4 * ((Math.floor(t * 8) + i) % 2)); ctx.lineTo(x0 - 6, 11); }
        ctx.closePath(); ctx.fill();
        if (scared) { ctx.fillStyle = '#ffb8ae'; ctx.fillRect(-5, -4, 3, 3); ctx.fillRect(2, -4, 3, 3); ctx.fillRect(-7, 4, 14, 1.5); }
        else {
          const lx = Math.cos(e.look || 0) * 2, ly = Math.sin(e.look || 0) * 2;
          for (const ex of [-5, 5]) { ellipse(ctx, ex, -3, 3.5, 4.5, '#fff'); circle(ctx, ex + lx, -3 + ly, 2, '#2121de'); }
        }
        return;
      }
      case 'creeper':
        ctx.fillStyle = '#4fae4a'; ctx.fillRect(-7, -16, 14, 30);
        ctx.fillStyle = '#3a8a36'; ctx.fillRect(-7, 6, 6, 8); ctx.fillRect(1, 6, 6, 8); ctx.fillRect(-4, -10, 3, 3);
        ctx.fillStyle = '#111'; ctx.fillRect(-5, -12, 4, 4); ctx.fillRect(1, -12, 4, 4); ctx.fillRect(-2, -8, 4, 3); ctx.fillRect(-4, -5, 8, 3);
        return;
      case 'slimer':
        ctx.globalAlpha = 0.85;
        ellipse(ctx, 0, 0, 14, 12, '#8fe04a'); ellipse(ctx, 0, 4, 8, 5, '#3a6a1a');
        circle(ctx, -5, -5, 3, '#fff'); circle(ctx, 5, -5, 3, '#fff'); circle(ctx, -5, -5, 1.5, '#111'); circle(ctx, 5, -5, 1.5, '#111');
        ctx.globalAlpha = 1; return;
      case 'libraryghost':
      case 'dementor': {
        const dm = d.art === 'dementor';
        ctx.globalAlpha = dm ? 0.9 : 0.7;
        ctx.fillStyle = dm ? '#0a0a10' : '#d8e8ff'; ctx.beginPath(); ctx.moveTo(-10, 14);
        for (let i = 0; i < 5; i++) ctx.lineTo(-10 + i * 5, 14 + ((i + Math.floor(t * 6)) % 2) * 4);
        ctx.quadraticCurveTo(12, -6, 0, -12); ctx.quadraticCurveTo(-12, -6, -10, 14); ctx.fill();
        if (dm) { ellipse(ctx, 0, -6, 5, 6, '#000'); ctx.strokeStyle = 'rgba(160,200,255,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 18 + Math.sin(t * 4) * 3, 0, Math.PI * 2); ctx.stroke(); }
        else { circle(ctx, 0, -14, 7, '#e8f0ff'); circle(ctx, -2, -15, 1.5, '#334'); circle(ctx, 2, -15, 1.5, '#334'); }
        ctx.globalAlpha = 1; return;
      }
      case 'ganon':
        ctx.fillStyle = '#2a1a3a'; ctx.fillRect(-10, -4, 20, 18);
        ellipse(ctx, 0, -10, 10, 9, '#3a7a3a');
        ctx.fillStyle = '#f2e0c0'; ctx.fillRect(-7, -6, 3, 5); ctx.fillRect(4, -6, 3, 5);
        circle(ctx, -4, -12, 2, '#ffd23f'); circle(ctx, 4, -12, 2, '#ffd23f');
        ctx.strokeStyle = '#d8b040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, -18); ctx.lineTo(14, 14); ctx.moveTo(10, -18); ctx.lineTo(18, -18); ctx.stroke();
        return;
      case 'penguin':
        ellipse(ctx, 0, 2, 9, 11, '#1a1a1a'); ellipse(ctx, 1, 4, 5, 7, '#f2f2f2');
        ctx.fillStyle = '#ff9a1a'; ctx.fillRect(5 * face - (face < 0 ? 4 : 0), -4, 4, 2);
        circle(ctx, 3 * face, -5, 1.5, '#ff3030');
        ctx.fillStyle = '#666'; ctx.fillRect(-2, -14, 4, 4); if (Math.floor(t * 6) % 2) circle(ctx, 0, -15, 2, '#ff3030');
        return;
      case 'spider':
      case 'mindflayer': {
        const mf = d.art === 'mindflayer', col = mf ? '#140a10' : d.colors.body;
        ctx.strokeStyle = col; ctx.lineWidth = mf ? 3 : 2.5; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) for (const sg of [-1, 1]) {
          const a = -0.9 + i * 0.6, w = Math.sin(walk * 2 + i) * 3;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sg * 14, -10 + i * 6 + w, sg * 20, -6 + i * 8 + w); ctx.stroke();
        }
        if (mf) { ctx.globalAlpha = 0.4; circle(ctx, 0, 0, 18, '#3a0a1a'); ctx.globalAlpha = 1; }
        ellipse(ctx, 0, 4, 9, 11, col); circle(ctx, 0, -8, 6, col);
        const ec = mf ? '#ff3a5a' : d.colors.eye;
        for (const [x, y] of [[-2, -10], [2, -10], [-3, -7], [3, -7]]) circle(ctx, x, y, 1.1, ec);
        return;
      }
      case 'dino':
      case 'trex':
      case 'godzilla': {
        const c = d.colors || (d.art === 'godzilla' ? { body: '#3a4a3a', stripe: '#2a3a2a', spine: '#4ad0ff' } : { body: '#6a5a3a', stripe: '#4a3a2a' });
        ctx.scale(face, 1);
        ctx.fillStyle = c.body;
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-20, -2, -26, 6 + Math.sin(walk) * 2); ctx.lineTo(-6, 6); ctx.fill();
        ellipse(ctx, 0, 2, 11, 8, c.body);
        if (c.spine || d.art === 'godzilla') { ctx.fillStyle = c.spine || '#4ad0ff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-8 + i * 5, -5); ctx.lineTo(-6 + i * 5, -11 - (i % 2) * 2); ctx.lineTo(-4 + i * 5, -5); ctx.fill(); } }
        ctx.fillStyle = c.stripe; ctx.fillRect(-6, -2, 2, 6); ctx.fillRect(-1, -3, 2, 6);
        ctx.fillStyle = c.body; ctx.fillRect(-4, 8 + Math.sin(walk) * 2, 4, 7); ctx.fillRect(3, 8 - Math.sin(walk) * 2, 4, 7);
        ellipse(ctx, 11, -6, 8, 5, c.body);
        if (c.frill) { ctx.fillStyle = c.frill; ctx.beginPath(); ctx.arc(6, -6, 7 + Math.sin(t * 6), -2.4, -0.8); ctx.lineTo(6, -6); ctx.fill(); }
        circle(ctx, 13, -8, 1.6, d.art === 'godzilla' ? '#ffd23f' : '#111');
        ctx.fillStyle = '#f2f2e0'; ctx.fillRect(14, -4, 4, 1.5);
        return;
      }
      case 'flood':
        ctx.globalAlpha = 0.9;
        for (let i = 0; i < 5; i++) { const a = i * 1.25 + t * 2; ctx.strokeStyle = '#c8b07a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.stroke(); }
        circle(ctx, 0, 0, 7, '#d8c08a'); circle(ctx, 0, 0, 4, '#a89060');
        ctx.globalAlpha = 1; return;
      case 'dalek':
      case 'dalekemperor': {
        const emp = d.art === 'dalekemperor', col = emp ? '#d8b040' : '#a8401a';
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-11, 12); ctx.lineTo(11, 12); ctx.lineTo(7, -6); ctx.lineTo(-7, -6); ctx.fill();
        for (let j = 0; j < 3; j++) for (let i = -1; i <= 1; i++) circle(ctx, i * 6, 2 + j * 4, 1.4, emp ? '#8a6a20' : '#5a1a0a');
        rrect(ctx, -7, -10, 14, 5, 2, '#888');
        ctx.fillStyle = '#9aa'; ctx.beginPath(); ctx.arc(0, -10, 6, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#666'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(4 * face, -12); ctx.lineTo(13 * face, -16); ctx.stroke(); circle(ctx, 13 * face, -16, 1.8, '#5fd0ff');
        ctx.beginPath(); ctx.moveTo(6 * face, -6); ctx.lineTo(14 * face, -4); ctx.stroke();
        circle(ctx, -3, -16, 1.2, Math.floor(t * 4) % 2 ? '#ffd23f' : '#6a5a2a'); circle(ctx, 3, -16, 1.2, Math.floor(t * 4) % 2 ? '#ffd23f' : '#6a5a2a');
        return;
      }
      case 'motobug':
        ellipse(ctx, 0, 0, 12, 9, '#e8302a'); circle(ctx, -4, -2, 2.5, '#111'); circle(ctx, 4, 2, 2.5, '#111');
        circle(ctx, 9 * face, -4, 4, '#3a5aa8'); circle(ctx, 10 * face, -5, 1.5, '#fff');
        circle(ctx, 0, 10, 3 + Math.sin(walk) * 0.5, '#333');
        return;
      case 'buzzbomber': {
        const f = Math.sin(t * 30) * 4;
        ellipse(ctx, -4, -8, 7, 3 + f * 0.3, 'rgba(220,240,255,0.7)'); ellipse(ctx, 4, -8, 7, 3 - f * 0.3, 'rgba(220,240,255,0.7)');
        ellipse(ctx, 0, 0, 12, 6, '#3a5aa8'); ctx.fillStyle = '#ffd23f'; ctx.fillRect(-4, -5, 3, 10); ctx.fillRect(2, -5, 3, 10);
        ctx.fillStyle = '#aaa'; ctx.fillRect(-12, 3, 4, 6); circle(ctx, 9 * face, -2, 2, '#ff3030');
        return;
      }
      case 'turret':
        ellipse(ctx, 0, 0, 7, 13, '#f2f2f2'); ctx.fillStyle = '#ccc'; ctx.fillRect(-1, -12, 2, 24);
        circle(ctx, 0, -2, 2.4, '#ff2020'); circle(ctx, 0, -2, 6, 'rgba(255,0,0,0.15)');
        ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(-8, 16); ctx.moveTo(4, 12); ctx.lineTo(8, 16); ctx.moveTo(0, 12); ctx.lineTo(0, 17); ctx.stroke();
        if (e.aim) { ctx.strokeStyle = 'rgba(255,0,0,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(Math.cos(e.aim) * 200, -2 + Math.sin(e.aim) * 200); ctx.stroke(); }
        return;
      case 'sentry':
        circle(ctx, 0, 0, 10, '#e8e8e8'); circle(ctx, 0, 0, 5, '#3a9aff'); circle(ctx, 0, 0, 2, '#fff');
        ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 12, t * 3, t * 3 + 1.5); ctx.stroke();
        return;
      case 'demodog':
        ctx.scale(face, 1);
        ellipse(ctx, -2, 2, 10, 6, '#5a4a4a'); ctx.fillStyle = '#5a4a4a';
        ctx.fillRect(-9, 6 + Math.sin(walk) * 2, 3, 6); ctx.fillRect(4, 6 - Math.sin(walk) * 2, 3, 6);
        circle(ctx, 9, -2, 5 + Math.sin(t * 6) * 1, '#c04a4a'); circle(ctx, 9, -2, 2, '#3a0a10');
        return;
      case 'eggman': {
        ellipse(ctx, 0, 6, 16, 8, '#c8ccd2'); ctx.fillStyle = '#e8302a'; ctx.fillRect(-16, 5, 32, 3);
        circle(ctx, 0, -6, 10, '#e8302a'); circle(ctx, 0, -12, 7, '#f0c8a0');
        ctx.fillStyle = '#a05a2a'; ctx.fillRect(-7, -9, 14, 2);
        circle(ctx, -3, -14, 2, '#111'); circle(ctx, 3, -14, 2, '#111');
        if (Math.floor(t * 10) % 2) { ctx.fillStyle = '#ffb03a'; ctx.fillRect(-4, 13, 8, 5); }
        return;
      }
      case 'glados': {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -14); ctx.stroke();
        rrect(ctx, -10, -16, 20, 22, 6, '#e8e8e8');
        ctx.save(); ctx.translate(0, 8); ctx.rotate(Math.sin(t * 0.8) * 0.4);
        rrect(ctx, -6, 0, 12, 14, 4, '#d0d0d0'); circle(ctx, 0, 10, 4, '#ffd23f'); circle(ctx, 0, 10, 8, 'rgba(255,210,63,0.2)');
        ctx.restore();
        return;
      }
    }
    circle(ctx, 0, 0, 12, '#f0f');
  }

  function shell(ctx, spin, color, spikes) {
    ctx.save(); ctx.rotate(spin);
    ellipse(ctx, 0, 0, 12, 10, color);
    ctx.strokeStyle = '#f2f2d0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(6, -4); ctx.lineTo(8, 3); ctx.lineTo(-8, 3); ctx.closePath(); ctx.stroke();
    if (spikes) { ctx.fillStyle = '#f2f2e0'; for (const [x, y] of [[-5, -5], [5, -5], [0, 2], [-6, 4], [6, 4]]) { ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x, y - 4); ctx.lineTo(x + 2, y); ctx.fill(); } }
    ctx.restore();
  }

  function critter(ctx, d, t, walk, face) {
    const c = d.colors, hop = Math.abs(Math.sin(walk)) * -2;
    ctx.save(); ctx.translate(0, hop); ctx.scale(face, 1);
    if (c.tail) { ctx.strokeStyle = c.body; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-15, -2); ctx.stroke(); circle(ctx, -16, -5, 3 + Math.sin(t * 12), c.tail); }
    if (c.pika) { ctx.fillStyle = '#c8962a'; ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(-16, -6); ctx.lineTo(-12, -8); ctx.lineTo(-18, -14); ctx.lineTo(-8, -6); ctx.fill(); }
    if (c.shell) ellipse(ctx, -2, 2, 10, 9, c.shell);
    ellipse(ctx, 0, 3, 10, 8, c.body);
    if (c.bulb) { ellipse(ctx, -3, -4, 8, 7, c.bulb); ctx.strokeStyle = '#1f6a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3, -11); ctx.lineTo(-3, 2); ctx.stroke(); }
    if (c.belly) ellipse(ctx, 2, 5, 5, 5, c.belly);
    circle(ctx, 6, -5, 7, c.body);
    if (c.ear) {
      ctx.fillStyle = c.body; ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(0, -21); ctx.lineTo(6, -11); ctx.moveTo(8, -10); ctx.lineTo(12, -21); ctx.lineTo(12, -9); ctx.fill();
      ctx.fillStyle = c.ear; ctx.beginPath(); ctx.moveTo(0.6, -17); ctx.lineTo(0, -21); ctx.lineTo(1.8, -18); ctx.moveTo(11, -17); ctx.lineTo(12, -21); ctx.lineTo(12, -17); ctx.fill();
    }
    circle(ctx, 9, -6, 1.8, '#111');
    if (c.cheek) circle(ctx, 9, -2, 2.2, c.cheek);
    ctx.restore();
  }

  // ---------- Player avatar & NPCs ----------
  Art.player = (ctx, p, t) => {
    ctx.save(); ctx.translate(p.x, p.y);
    const m = p.mount && NX.MOUNTS[p.mount];
    if (m && m.car) { ellipse(ctx, 0, 14, 22, 6, 'rgba(0,0,0,0.3)'); car(ctx, p, m, t); ctx.restore(); return; }
    ellipse(ctx, 0, m && m.fly ? 22 : 13, 10, 4, 'rgba(0,0,0,0.3)');
    if (m && m.fly) ctx.translate(0, -8 + Math.sin(t * 3) * 2);
    if (p.iframes > 0 && Math.floor(t * 16) % 2) ctx.globalAlpha = 0.4;
    if (p.star > 0) ctx.filter = `hue-rotate(${(t * 720) % 360}deg) brightness(1.4)`;
    if (p.mount === 'nimbus') {
      ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-16 * p.face, 10); ctx.lineTo(16 * p.face, 6); ctx.stroke();
      ctx.strokeStyle = '#d8b060'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-14 * p.face, 10); ctx.lineTo(-24 * p.face, 10 + i * 3); ctx.stroke(); }
    }
    if (p.mount === 'elytra') {
      const f = Math.sin(t * 4) * 3;
      ctx.fillStyle = '#8a8aa8'; ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-24, 6 + f); ctx.lineTo(-6, 10); ctx.moveTo(4, -4); ctx.lineTo(24, 6 + f); ctx.lineTo(6, 10); ctx.fill();
    }
    if (p.overshield > 0) { ctx.strokeStyle = `rgba(255,210,63,${0.3 + Math.sin(t * 6) * 0.15})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -2, 20, 0, Math.PI * 2); ctx.stroke(); }
    humanoid(ctx, { body: p.color, head: '#f0d0b0', legs: '#2a2a3a', arms: p.color, visor: '#4ff3ff', gauntlet: p.relics && p.relics.gauntlet ? '#ffd23f' : null }, p.walk, p.face, 1, t);
    ctx.filter = 'none';
    ctx.restore();
  };

  function car(ctx, p, m, t) {
    ctx.rotate(p.carAngle);
    if (p.speedFrac > 0.85) {
      const fire = p.mount === 'delorean';
      for (const dy of [-8, 8]) { ctx.strokeStyle = fire ? `rgba(255,${120 + Math.random() * 100},40,0.8)` : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-22, dy); ctx.lineTo(-44 - Math.random() * 20, dy); ctx.stroke(); }
    }
    if (p.mount === 'batmobile') {
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(10, -13); ctx.lineTo(-24, -14); ctx.lineTo(-18, 0); ctx.lineTo(-24, 14); ctx.lineTo(10, 13); ctx.fill();
      ctx.fillStyle = '#ff6a1a'; if (Math.floor(t * 20) % 2) { ctx.fillRect(-28, -3, 6, 6); }
      ctx.fillStyle = '#2a3a4a'; ctx.fillRect(-2, -6, 10, 12);
      return;
    }
    rrect(ctx, -22, -12, 44, 24, 5, m.color);
    ctx.fillStyle = '#2a3a4a'; ctx.fillRect(-4, -9, 14, 18);
    if (p.mount === 'ecto1') {
      ctx.fillStyle = '#e23636'; ctx.fillRect(-18, -12, 4, 24); ctx.fillRect(14, -12, 3, 24);
      ctx.fillStyle = Math.floor(t * 8) % 2 ? '#ff3030' : '#3060ff'; ctx.fillRect(-10, -4, 5, 8);
    } else { ctx.fillStyle = '#9aa0a8'; ctx.fillRect(-18, -11, 10, 22); }
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(-22, -10, 2, 5); ctx.fillRect(-22, 5, 2, 5);
    ctx.fillStyle = '#fffbe0'; ctx.fillRect(20, -10, 2, 5); ctx.fillRect(20, 5, 2, 5);
    if (p.mount === 'delorean' && Math.floor(t * 8) % 2) { ctx.fillStyle = 'rgba(80,200,255,0.6)'; ctx.fillRect(-20, -1, 6, 2); }
  }

  const NPC_LOOKS = {
    curator: { body: '#5a3a8a', head: '#d8c0a0', legs: '#2a1a3a', cape: '#3a2a5a', hat: '#2a1a3a', eyes: '#111' },
    shop: { body: '#ff4fd8', head: '#e8c0a0', legs: '#333', eyes: '#111', hat: '#18e0ff' },
    garage: { body: '#e8e8e8', head: '#f0d0b0', legs: '#555', eyes: '#111', hat: '#ddd' },
    score: { body: '#ffd23f', head: '#e0b890', legs: '#333', visor: '#ff4fd8' },
    gunter: { body: '#4a9cff', head: '#e0b890', legs: '#333', visor: '#ffd23f' },
  };
  Art.npc = (ctx, n, t) => {
    ctx.save(); ctx.translate(n.x, n.y);
    ellipse(ctx, 0, 13, 10, 4, 'rgba(0,0,0,0.3)');
    const look = Object.assign({}, NPC_LOOKS[n.look] || NPC_LOOKS.gunter);
    if (n.tint) look.body = n.tint;
    humanoid(ctx, look, Math.sin(t * 2 + n.id) * 0.3, n.face || 1, 1, t);
    ctx.restore();
  };

  // ---------- Items ----------
  Art.weaponIcon = (ctx, id, x, y, s = 1) => {
    const w = NX.WEAPONS[id]; if (!w) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineCap = 'round';
    const glow = (c) => { ctx.shadowColor = c; ctx.shadowBlur = 8; };
    if (w.art === 'hammer') {
      ctx.rotate(-0.6); ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-1.5, -2, 3, 14); rrect(ctx, -8, -12, 16, 10, 2, '#9aa4b0'); glow(w.color); ctx.strokeStyle = w.color; ctx.lineWidth = 1; ctx.strokeRect(-8, -12, 16, 10);
    } else if (w.art === 'shield') {
      circle(ctx, 0, 0, 11, '#e23636'); circle(ctx, 0, 0, 8, '#f2f2f2'); circle(ctx, 0, 0, 5.5, '#e23636'); circle(ctx, 0, 0, 3.5, '#2a4aa8');
    } else if (w.art === 'batarang') {
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.moveTo(-12, -2); ctx.quadraticCurveTo(-6, 2, -2, -4); ctx.lineTo(0, 0); ctx.lineTo(2, -4); ctx.quadraticCurveTo(6, 2, 12, -2); ctx.lineTo(0, 6); ctx.fill();
    } else if (id === 'pickaxe') {
      ctx.rotate(-0.7); ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -8); ctx.stroke();
      ctx.strokeStyle = w.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -2, 10, -2.6, -0.5); ctx.stroke();
    } else if (id === 'lasso') {
      ctx.strokeStyle = w.color; ctx.lineWidth = 2; glow(w.color); ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke();
    } else if (id === 'lanternring') {
      glow(w.color); ctx.strokeStyle = w.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 2, 7, 0, Math.PI * 2); ctx.stroke(); rrect(ctx, -5, -12, 10, 8, 2, w.color);
    } else if (id === 'kamehameha') {
      glow(w.color); circle(ctx, 0, 0, 10, 'rgba(95,200,255,0.4)'); circle(ctx, 0, 0, 6, '#dff6ff');
    } else if (id === 'portalgun') {
      rrect(ctx, -10, -5, 20, 10, 4, '#e8e8e8'); circle(ctx, 9, 0, 4, '#3a9aff'); circle(ctx, -6, 0, 2.5, '#ff9a1a');
    } else if (id === 'elderwand') {
      ctx.rotate(-0.7); ctx.strokeStyle = '#d8ccb0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -12); ctx.stroke(); circle(ctx, 0, 6, 2.5, '#d8ccb0');
    } else if (id === 'speedshoes') {
      rrect(ctx, -10, -2, 18, 8, 3, '#e23636'); ctx.fillStyle = '#fff'; ctx.fillRect(-10, 2, 18, 2);
    } else {
      ctx.rotate(-0.7);
      switch (w.kind) {
        case 'melee':
          ctx.strokeStyle = '#555'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 6); ctx.stroke();
          if (id === 'lightsaber' || id === 'energysword' || id === 'sting') glow(w.color);
          ctx.strokeStyle = w.color; ctx.lineWidth = id === 'lightsaber' ? 3.5 : 4; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -13); ctx.stroke();
          ctx.shadowBlur = 0;
          if (id !== 'lightsaber') { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-5, 6); ctx.lineTo(5, 6); ctx.stroke(); }
          break;
        case 'gun':
          if (id === 'fireflower') {
            ctx.rotate(0.7);
            ctx.fillStyle = '#2a9a3a'; ctx.fillRect(-1.5, 0, 3, 10);
            circle(ctx, 0, -4, 8, '#ff7a1a'); circle(ctx, 0, -4, 5, '#fff2a0'); circle(ctx, 0, -4, 2.5, '#ff3a1a');
          } else { ctx.fillStyle = '#222'; ctx.fillRect(-3, -12, 6, 20); ctx.fillRect(-3, 2, 9, 4); ctx.fillStyle = w.color; ctx.fillRect(-1, -14, 2, 4); }
          break;
        case 'beam':
          ctx.rotate(0.7); rrect(ctx, -7, -9, 14, 18, 3, '#4a4a4a'); ctx.fillStyle = w.color; ctx.fillRect(-3, -6, 6, 3); ctx.fillStyle = '#ff3030'; ctx.fillRect(-3, 2, 6, 3);
          break;
        default:
          ctx.rotate(0.7); ctx.strokeStyle = w.color; ctx.lineWidth = 3; glow(w.color);
          ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  };

  // Generic glowing token for relics & mounts (first letters of the name).
  Art.token = (ctx, x, y, label, color, s = 1) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(10,10,30,0.85)'; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = color; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0.5);
    ctx.restore();
  };
  Art.relicIcon = (ctx, id, x, y, s = 1) => {
    if (id === 'gauntlet') {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      rrect(ctx, -8, -6, 16, 16, 4, '#d8b040');
      const stones = ['#ff3030', '#ffd23f', '#3a9aff', '#3aff6a', '#c070ff', '#ff8a1a'];
      for (let i = 0; i < 5; i++) { rrect(ctx, -9 + i * 4, -13, 3, 8, 1.5, '#d8b040'); circle(ctx, -7.5 + i * 4, -10, 1.3, stones[i]); }
      circle(ctx, 0, 2, 2.6, stones[5]);
      ctx.restore(); return;
    }
    const r = NX.RELICS[id];
    Art.token(ctx, x, y, r ? r.name.replace(/[^A-Z]/g, '').slice(0, 2) || r.name.slice(0, 2) : '?', '#ffd23f', s);
  };

  Art.pokeball = (ctx, x, y, r, spin = 0) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
    ctx.fillStyle = '#e83a3a'; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(-r, -1, r * 2, 2); circle(ctx, 0, 0, r * 0.35, '#222'); circle(ctx, 0, 0, r * 0.2, '#fff');
    ctx.restore();
  };

  Art.keyIcon = (ctx, x, y, color, s = 1) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-6, 0, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillRect(-1, -1.5, 14, 3); ctx.fillRect(8, 0, 3, 5); ctx.fillRect(12, 0, 2, 4);
    ctx.restore();
  };

  Art.heart = (ctx, x, y, s, fill) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(0, 4); ctx.bezierCurveTo(-8, -2, -5, -9, 0, -4); ctx.bezierCurveTo(5, -9, 8, -2, 0, 4); ctx.fill();
    ctx.restore();
  };

  Art.pickup = (ctx, p, t) => {
    const bob = Math.sin(t * 4 + p.id) * 2;
    const x = p.x, y = p.y + bob;
    ellipse(ctx, p.x, p.y + 9, 7, 2.5, 'rgba(0,0,0,0.25)');
    switch (p.item) {
      case 'coin': {
        const w = Math.abs(Math.cos(t * 5 + p.id)) * 6 + 1;
        ellipse(ctx, x, y, w, 7, '#ffd23f'); ellipse(ctx, x, y, w * 0.5, 4, '#ffea8a');
        return;
      }
      case 'heart': return Art.heart(ctx, x, y, 1.3, '#ff3b5c');
      case 'pokeballs': return Art.pokeball(ctx, x, y, 7);
      case 'grenade':
        circle(ctx, x, y + 2, 7, '#e8c040'); ctx.fillStyle = '#e8c040'; ctx.fillRect(x - 1, y - 10, 2, 6); ctx.fillRect(x - 3, y - 8, 6, 2);
        return;
      case 'mushroom':
        ctx.fillStyle = '#f2e0c0'; ctx.fillRect(x - 4, y, 8, 7);
        ctx.fillStyle = '#e8302a'; ctx.beginPath(); ctx.arc(x, y + 1, 9, Math.PI, 0); ctx.fill();
        circle(ctx, x - 4, y - 4, 2.2, '#fff'); circle(ctx, x + 4, y - 3, 2, '#fff');
        return;
      case 'star':
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2); ctx.fillStyle = '#ffe23a'; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 9, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.fill(); ctx.restore(); return;
      case 'extralife':
        circle(ctx, x, y, 8, '#c8ccd2'); circle(ctx, x, y, 6, '#e0e4ea');
        ctx.fillStyle = '#7a7f88'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('25¢', x, y + 0.5);
        return;
      case 'weapon':
        circle(ctx, x, y, 14, `hsla(${(t * 90) % 360},90%,60%,0.3)`);
        return Art.weaponIcon(ctx, p.weapon, x, y, 1);
      case 'key':
        circle(ctx, x, y, 16, 'rgba(255,255,255,0.15)');
        return Art.keyIcon(ctx, x - 3, y, NX.KEYS[p.key].color, 1.4);
      case 'relic':
        circle(ctx, x, y, 18, `hsla(${(t * 120) % 360},90%,60%,0.3)`);
        return Art.relicIcon(ctx, p.relic, x, y, 1.2);
      case 'mount':
        circle(ctx, x, y, 18, `hsla(${(t * 120) % 360},90%,60%,0.3)`);
        return Art.token(ctx, x, y, NX.MOUNTS[p.mount].name.slice(0, 3).toUpperCase(), '#18e0ff', 1.2);
      case 'masterball':
        Art.pokeball(ctx, x, y, 8); ctx.fillStyle = 'rgba(120,60,200,0.8)'; ctx.beginPath(); ctx.arc(x, y, 8, Math.PI, 0); ctx.fill();
        return;
    }
  };

  Art.chest = (ctx, c) => {
    const x = c.x, y = c.y;
    ellipse(ctx, x, y + 10, 13, 4, 'rgba(0,0,0,0.3)');
    rrect(ctx, x - 13, y - 6, 26, 16, 2, '#8a5a2a');
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 13, y - 1, 26, 2); ctx.fillRect(x - 2, y - 3, 4, 6);
    if (c.open) { rrect(ctx, x - 13, y - 16, 26, 8, 2, '#6a4420'); ctx.fillStyle = '#2a1a0a'; ctx.fillRect(x - 11, y - 8, 22, 4); }
    else rrect(ctx, x - 13, y - 12, 26, 8, 3, '#9a6a3a');
  };

  // ---------- Projectiles ----------
  Art.shot = (ctx, s, t) => {
    ctx.save();
    switch (s.kind) {
      case 'zap':
        ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
        for (let i = 1; i <= 3; i++) ctx.lineTo(s.x - s.vx * 0.01 * (3 - i) + NX.rand(-4, 4), s.y - s.vy * 0.01 * (3 - i) + NX.rand(-4, 4));
        ctx.stroke(); break;
      case 'bubble':
        ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
        circle(ctx, s.x - 2, s.y - 2, 1.5, '#fff'); break;
      case 'leaf':
        ctx.translate(s.x, s.y); ctx.rotate(t * 12); ellipse(ctx, 0, 0, 7, 3, s.color); break;
      case 'fireball':
        circle(ctx, s.x, s.y, s.r + 3, 'rgba(255,120,30,0.35)'); circle(ctx, s.x, s.y, s.r, s.color); circle(ctx, s.x, s.y, s.r * 0.5, '#fff2a0'); break;
      case 'rock': circle(ctx, s.x, s.y, s.r, s.color); break;
      case 'arrow': {
        const a = Math.atan2(s.vy, s.vx); ctx.translate(s.x, s.y); ctx.rotate(a);
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(3, -3); ctx.lineTo(3, 3); ctx.fill(); break;
      }
      case 'orb': circle(ctx, s.x, s.y, s.r + 4, 'rgba(201,160,255,0.3)'); circle(ctx, s.x, s.y, s.r, s.color); break;
      case 'disc':
        ctx.strokeStyle = s.color; ctx.lineWidth = 3; ctx.shadowColor = s.color; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2); ctx.stroke(); break;
      case 'ball': Art.pokeball(ctx, s.x, s.y, 7, t * 15); break;
      case 'grenade': {
        const lift = Math.sin(Math.min(1, s.age / s.flight) * Math.PI) * 30;
        circle(ctx, s.x, s.y + 6, 5, 'rgba(0,0,0,0.25)');
        circle(ctx, s.x, s.y - lift, 7, '#e8c040'); ctx.fillStyle = '#e8c040'; ctx.fillRect(s.x - 1, s.y - lift - 12, 2, 6);
        break;
      }
      case 'swordbeam': {
        const a = Math.atan2(s.vy, s.vx); ctx.translate(s.x, s.y); ctx.rotate(a);
        ctx.fillStyle = Math.floor(t * 20) % 2 ? '#bfe3ff' : '#fff'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -5); ctx.lineTo(-10, 0); ctx.lineTo(-6, 5); ctx.fill(); break;
      }
      case 'saberthrow':
        ctx.translate(s.x, s.y); ctx.rotate(t * 18); ctx.strokeStyle = s.color; ctx.lineWidth = 4; ctx.shadowColor = s.color; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke(); break;
      default: {
        const sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp * 12, uy = s.vy / sp * 12;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        ctx.strokeStyle = s.color; ctx.globalAlpha = 0.4; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s.x - ux, s.y - uy); ctx.lineTo(s.x, s.y); ctx.stroke();
        ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x - ux, s.y - uy); ctx.lineTo(s.x, s.y); ctx.stroke();
      }
    }
    ctx.restore();
  };
})();
