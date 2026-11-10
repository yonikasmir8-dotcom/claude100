// Cockpit HUD drawn on a 2D canvas above the WebGL view.
import * as THREE from 'three';

const CY = '#7fe9ff', CY_D = 'rgba(127,233,255,0.35)', RED = '#ff5a48', AMB = '#ffb54a', WHITE = '#eaf8ff';
const FONT = '"Rajdhani","Eurostile","Bank Gothic","Segoe UI",system-ui,sans-serif';
const _v = new THREE.Vector3();

export class Hud {
  constructor(canvas) { this.cv = canvas; this.x = canvas.getContext('2d'); this.w = 1; this.h = 1; }
  resize(w, h) {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = w * d; this.cv.height = h * d; this.w = w; this.h = h;
    this.x.setTransform(d, 0, 0, d, 0, 0);
  }
  // returns {x,y,behind,on}
  project(p, cam, out) {
    _v.copy(p).applyMatrix4(cam.matrixWorldInverse);
    const behind = _v.z > 0;
    out.dx = _v.x; out.dy = _v.y;
    _v.applyMatrix4(cam.projectionMatrix);
    out.x = (_v.x * 0.5 + 0.5) * this.w; out.y = (-_v.y * 0.5 + 0.5) * this.h; out.behind = behind;
    out.on = !behind && out.x > 0 && out.x < this.w && out.y > 0 && out.y < this.h;
    return out;
  }
  text(s, x, y, size, color, align = 'left', weight = 600, spacing = 2) {
    const c = this.x; c.font = `${weight} ${size}px ${FONT}`; c.textAlign = align; c.fillStyle = color;
    try { c.letterSpacing = spacing + 'px'; } catch (e) { /* older browsers */ }
    c.fillText(s, x, y);
  }
  bar(x, y, w, h, frac, color, label, skew = 8) {
    const c = this.x;
    c.save(); c.translate(x, y); c.transform(1, 0, -skew / h, 1, 0, 0);
    c.fillStyle = 'rgba(8,20,30,0.55)'; c.fillRect(0, 0, w, h);
    c.fillStyle = color; c.shadowColor = color; c.shadowBlur = 10; c.fillRect(0, 0, w * Math.max(0, Math.min(1, frac)), h);
    c.shadowBlur = 0; c.strokeStyle = CY_D; c.lineWidth = 1; c.strokeRect(0, 0, w, h);
    c.restore();
    if (label) this.text(label, x - skew, y - 6, 11, 'rgba(200,240,255,0.75)', 'left', 600, 3);
  }
  draw(s) {
    const c = this.x, w = this.w, h = this.h, cam = s.camera, P = {};
    c.clearRect(0, 0, w, h);
    if (!s.active) return;
    c.lineCap = 'round';
    const cx = w / 2, cy = h / 2, u = Math.min(w, h) / 900;

    // contact markers
    for (const e of s.contacts) {
      if (e === s.target || e === s.player) continue;
      this.project(e.pos, cam, P);
      if (!P.on) continue;
      const d = e.pos.distanceTo(cam.position); if (d > 4500) continue;
      const col = e.team === 0 ? CY : RED;
      c.strokeStyle = col; c.globalAlpha = 0.85; c.lineWidth = 1.5;
      const r = 7;
      c.beginPath();
      if (e.team === 0) { c.moveTo(P.x - r, P.y + r * 0.7); c.lineTo(P.x, P.y - r); c.lineTo(P.x + r, P.y + r * 0.7); }
      else { c.moveTo(P.x, P.y - r); c.lineTo(P.x + r, P.y); c.lineTo(P.x, P.y + r); c.lineTo(P.x - r, P.y); c.closePath(); }
      c.stroke(); c.globalAlpha = 1;
    }

    // target bracket, lead marker, off-screen arrow
    const t = s.target;
    if (t) {
      this.project(t.pos, cam, P);
      const dist = t.pos.distanceTo(s.player.pos);
      if (P.on) {
        const r = Math.max(18, Math.min(90, (t.radius * 1500) / dist));
        const col = s.locked ? AMB : RED;
        c.strokeStyle = col; c.lineWidth = 2; c.shadowColor = col; c.shadowBlur = 8;
        const k = r * 0.45;
        c.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          c.moveTo(P.x + sx * r, P.y + sy * (r - k)); c.lineTo(P.x + sx * r, P.y + sy * r); c.lineTo(P.x + sx * (r - k), P.y + sy * r);
        }
        c.stroke(); c.shadowBlur = 0;
        this.text(t.name, P.x + r + 8, P.y - r + 10, 13, col, 'left', 700, 2);
        this.text(Math.round(dist) + ' M', P.x + r + 8, P.y - r + 26, 12, WHITE, 'left', 500, 1);
        c.fillStyle = 'rgba(8,20,30,0.6)'; c.fillRect(P.x - r, P.y + r + 6, r * 2, 4);
        c.fillStyle = col; c.fillRect(P.x - r, P.y + r + 6, r * 2 * Math.max(0, t.hp / t.maxHp), 4);
        if (s.locked) this.text('MISSILE LOCK', P.x, P.y - r - 10, 12, AMB, 'center', 700, 3);
      } else {
        const a = Math.atan2(-P.dy * (P.behind ? 1 : 1), P.dx);
        const ex = cx + Math.cos(a) * (cx - 60), ey = cy + Math.sin(a) * (cy - 60);
        c.save(); c.translate(ex, ey); c.rotate(a); c.fillStyle = RED; c.shadowColor = RED; c.shadowBlur = 10;
        c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -10); c.lineTo(-3, 0); c.lineTo(-8, 10); c.closePath(); c.fill(); c.restore();
      }
      if (s.lead) {
        this.project(s.lead, cam, P);
        if (P.on && dist < 1600) {
          c.strokeStyle = s.assist ? '#9dff8a' : AMB; c.lineWidth = 1.6;
          c.beginPath(); c.arc(P.x, P.y, 7, 0, 7); c.moveTo(P.x - 12, P.y); c.lineTo(P.x - 4, P.y); c.moveTo(P.x + 4, P.y); c.lineTo(P.x + 12, P.y); c.stroke();
        }
      }
    }

    // boresight (where the guns point) and steering cursor
    this.project(s.boresight, cam, P);
    if (!P.behind) {
      c.strokeStyle = CY; c.lineWidth = 1.6; c.shadowColor = CY; c.shadowBlur = 6;
      const g = 9, l = 20;
      c.beginPath();
      c.moveTo(P.x - l, P.y); c.lineTo(P.x - g, P.y); c.moveTo(P.x + g, P.y); c.lineTo(P.x + l, P.y);
      c.moveTo(P.x, P.y - l); c.lineTo(P.x, P.y - g); c.moveTo(P.x, P.y + g); c.lineTo(P.x, P.y + l);
      c.stroke();
      c.beginPath(); c.arc(P.x, P.y, 1.6, 0, 7); c.fillStyle = CY; c.fill(); c.shadowBlur = 0;
    }
    const sr = Math.min(w, h) * 0.3;
    const mx = cx + s.stick.x * sr, my = cy + s.stick.y * sr;
    c.strokeStyle = 'rgba(234,248,255,0.8)'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(mx, my, 11, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(127,233,255,0.14)'; c.setLineDash([3, 9]);
    c.beginPath(); c.arc(cx, cy, sr, 0, 7); c.stroke(); c.setLineDash([]);

    // bottom-left: integrity
    const bx = 56, by = h - 96;
    this.bar(bx, by, 230 * Math.max(0.8, u), 10, s.shield / 100, CY, 'SHIELD');
    this.bar(bx, by + 34, 230 * Math.max(0.8, u), 10, s.hull / 100, s.hull < 35 ? RED : '#9dff8a', 'HULL');
    // bottom-right: drive
    const rw = 230 * Math.max(0.8, u), rx = w - 56 - rw;
    this.bar(rx, by, rw, 10, s.boost, AMB, 'BOOST');
    this.bar(rx, by + 34, rw, 10, s.throttle, WHITE, 'THROTTLE');
    this.text(String(Math.round(s.speed)).padStart(3, '0'), w - 56, by - 34, 34, WHITE, 'right', 700, 2);
    this.text('M/S', w - 56, by - 68, 11, 'rgba(200,240,255,0.7)', 'right', 600, 3);
    this.text('MISSILES', rx - 8, by - 34, 11, 'rgba(200,240,255,0.7)', 'left', 600, 3);
    for (let i = 0; i < s.maxMissiles; i++) {
      c.fillStyle = i < s.missiles ? AMB : 'rgba(255,181,74,0.16)';
      c.fillRect(rx - 8 + i * 11, by - 60, 6, 15);
    }

    // radar: centre = dead ahead, rim = directly behind
    const R = 58 * Math.max(0.85, u), ox = 56 + R, oy = h - 150 - R;
    c.fillStyle = 'rgba(6,18,28,0.55)'; c.beginPath(); c.arc(ox, oy, R, 0, 7); c.fill();
    c.strokeStyle = CY_D; c.lineWidth = 1;
    c.beginPath(); c.arc(ox, oy, R, 0, 7); c.moveTo(ox + R / 2, oy); c.arc(ox, oy, R / 2, 0, 7);
    c.moveTo(ox - R, oy); c.lineTo(ox + R, oy); c.moveTo(ox, oy - R); c.lineTo(ox, oy + R); c.stroke();
    for (const e of s.contacts) {
      if (e === s.player) continue;
      _v.copy(e.pos).sub(s.player.pos); const d = _v.length(); if (d > 5000) continue;
      _v.applyQuaternion(s.invQuat).normalize();
      const ang = Math.acos(Math.max(-1, Math.min(1, -_v.z))) / Math.PI, a = Math.atan2(-_v.y, _v.x);
      const px = ox + Math.cos(a) * ang * R, py = oy + Math.sin(a) * ang * R;
      c.fillStyle = e === s.target ? AMB : e.team === 0 ? CY : RED;
      const z = e.kind === 'turret' || e.kind === 'reactor' ? 2 : 2.8;
      c.fillRect(px - z, py - z, z * 2, z * 2);
    }

    // top: objective + score
    this.text(s.waveLabel, 56, 58, 13, CY, 'left', 700, 5);
    this.text(s.objective, 56, 82, 20, WHITE, 'left', 600, 2);
    this.text('SCORE', w - 56, 58, 13, CY, 'right', 700, 5);
    this.text(String(s.score).padStart(6, '0'), w - 56, 86, 26, WHITE, 'right', 700, 3);
    if (s.boss) {
      const bw = Math.min(520, w * 0.42);
      this.text('DREADNOUGHT  ' + s.boss.name, cx, 52, 13, RED, 'center', 700, 5);
      this.bar(cx - bw / 2, 62, bw, 8, s.boss.frac, RED, null, 6);
      this.text(`REACTORS ${s.boss.reactors}/3`, cx, 92, 12, WHITE, 'center', 600, 3);
    }
    if (s.warn) {
      c.globalAlpha = 0.55 + 0.45 * Math.sin(s.time * 9);
      this.text(s.warn, cx, cy + sr + 44, 16, RED, 'center', 700, 5); c.globalAlpha = 1;
    }
    // announcements
    const m = s.message;
    if (m && m.t > 0) {
      const a = Math.min(1, m.t / 0.6) * Math.min(1, (m.dur - m.t) / 0.4);
      c.globalAlpha = Math.max(0, a);
      c.shadowColor = CY; c.shadowBlur = 24;
      this.text(m.text, cx, h * 0.27, Math.max(26, 46 * u), WHITE, 'center', 700, 12);
      c.shadowBlur = 0;
      if (m.sub) this.text(m.sub, cx, h * 0.27 + 34, Math.max(13, 17 * u), CY, 'center', 600, 5);
      c.globalAlpha = 1;
    }
  }
}
