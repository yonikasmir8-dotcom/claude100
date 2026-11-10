// ECLIPSE VANGUARD — an original space-combat game built on three.js.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWorld } from './world.js';
import { makeMaterials, buildInterceptor, buildWasp, buildCapital, buildTurret } from './models.js';
import { Particles, Bolts, Shockwaves, segSphere } from './fx.js';
import { Sfx } from './audio.js';
import { Hud } from './hud.js';

const $ = (id) => document.getElementById(id);
const rand = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- renderer
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene(), bgScene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.8, 40000);
const bgCamera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 100, 400000);

const M = makeMaterials(renderer.capabilities.getMaxAnisotropy());

const CARRIER_POS = V(-520, -150, 620), DREAD_POS = V(520, 130, -2900), START = V(0, 0, 1500);
const world = createWorld(renderer, scene, bgScene, M.glowTex, [
  { pos: START, r: 420 }, { pos: CARRIER_POS, r: 900 }, { pos: DREAD_POS, r: 1200 }, { pos: V(0, 0, 400), r: 300 },
]);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(bgScene, bgCamera));
const mainPass = new RenderPass(scene, camera); mainPass.clear = false; composer.addPass(mainPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 1.0);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAb: { value: 0.012 }, uDamage: { value: 0 }, uShield: { value: 0 }, uFlash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uAb,uDamage,uShield,uFlash; varying vec2 vUv;
    void main(){ vec2 c=vUv-.5; float r2=dot(c,c); vec2 o=c*r2*uAb;
      vec3 col=vec3(texture2D(tDiffuse,vUv+o).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-o).b);
      col*=mix(1.,.3,smoothstep(.12,.62,r2));
      col=mix(col, col*vec3(.94,1.,1.07)+vec3(0.,.002,.006), .6);
      col+=uDamage*vec3(.9,.04,0.)*smoothstep(.06,.5,r2)+uShield*vec3(.05,.4,.9)*smoothstep(.1,.5,r2);
      col+=uFlash*vec3(1.,.9,.8);
      float n=fract(sin(dot(vUv*vec2(1920.,1080.)+fract(uTime)*91.7,vec2(12.9898,78.233)))*43758.5453);
      col*=1.+(n-.5)*.07;
      gl_FragColor=vec4(col,1.); }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

const particles = new Particles(scene), bolts = new Bolts(scene), shocks = new Shockwaves(scene);
const sfx = new Sfx(), hud = new Hud($('hud'));
hud.resize(innerWidth, innerHeight);

const lights = [];
for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffb070, 0, 0, 2); scene.add(l); lights.push(l); }
let lightIdx = 0;

// ---------------------------------------------------------------- game state
const ships = [], statics = [], missiles = [], capitals = [];
let obstacles = [];
let player = null, state = 'loading', time = 0, shake = 0;
let foes = [], friends = [];
const G = {
  shield: 100, boost: 1, throttle: 0.6, missiles: 6, maxMissiles: 6, score: 0, kills: 0, lastHit: -99,
  wave: -1, waveActive: false, waveTimer: 0, escortTimer: 0, message: null, target: null, lockT: 0, locked: false,
  dread: null, endTimer: 0, dmgFlash: 0, shieldFlash: 0, flash: 0, bumpCd: 0, assist: false, warn: '',
};
const WAVES = [
  { foes: 4, aces: 0, text: 'RAIDERS INBOUND', sub: 'DEFEND THE CARRIER AURORA' },
  { foes: 6, aces: 1, text: 'SECOND WING', sub: 'ACE PILOT DETECTED' },
  { foes: 7, aces: 2, text: 'THIRD WING', sub: 'HOLD THE LINE' },
  { boss: true },
];
const COL = {
  ally: new THREE.Color(0.3, 2.3, 7), foe: new THREE.Color(7.5, 1.3, 0.25), ace: new THREE.Color(5, 0.5, 7), turret: new THREE.Color(7, 0.5, 3.4),
  shock: new THREE.Color(2.6, 1.7, 0.9), shockBlue: new THREE.Color(1, 2.2, 4),
};

const _a = V(), _b = V(), _c = V(), _d = V(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m4 = new THREE.Matrix4();
const UP = V(0, 1, 0);
const lookQuat = (from, to, out) => out.setFromRotationMatrix(_m4.lookAt(from, to, UP));
const randDir = (out) => { const u = rand() * 2 - 1, a = rand() * 6.283, s = Math.sqrt(1 - u * u); return out.set(s * Math.cos(a), u, s * Math.sin(a)); };

function announce(text, sub = '', dur = 3.6) { G.message = { text, sub, t: dur, dur }; }

// ---------------------------------------------------------------- capital ships
function makeCapital(enemy, pos, rotY) {
  const b = buildCapital(M, enemy, enemy ? 3 : 8);
  b.group.position.copy(pos); b.group.rotation.y = rotY; scene.add(b.group);
  const cap = { ...b, enemy, pos: pos.clone(), active: false, inv: new THREE.Matrix4(), spheres: [], turrets: [], reactors: [], local: V(), hitBox: null };
  capitals.push(cap);
  return cap;
}
function activateCapital(cap) {
  cap.group.updateMatrixWorld(true);
  cap.inv.copy(cap.group.matrixWorld).invert();
  cap.spheres = [];
  const L = cap.enemy ? 800 : 560;
  for (let z = -L; z <= L; z += 230) cap.spheres.push({ pos: V(0, 0, z).applyMatrix4(cap.group.matrixWorld), r: cap.enemy ? 290 : 230 });
  cap.active = true; rebuildObstacles();
}
function rebuildObstacles() {
  obstacles = world.asteroids.list.slice();
  for (const c of capitals) if (c.active) obstacles.push(...c.spheres);
}
function capHit(cap, p, pad) {
  if (!cap.active || p.distanceToSquared(cap.pos) > cap.radius * cap.radius) return null;
  const l = cap.local.copy(p).applyMatrix4(cap.inv);
  for (const bx of cap.boxes) {
    if (l.x > bx.min.x - pad && l.x < bx.max.x + pad && l.y > bx.min.y - pad && l.y < bx.max.y + pad && l.z > bx.min.z - pad && l.z < bx.max.z + pad) return bx;
  }
  return null;
}
const carrier = makeCapital(false, CARRIER_POS, 0.32);
activateCapital(carrier);

// ---------------------------------------------------------------- ships
const KINDS = {
  player: { team: 0, hp: 100, min: 35, max: 170, turn: 1.0, name: 'VANGUARD' },
  ally: { team: 0, hp: 150, min: 60, max: 165, turn: 1.0, name: 'WINGMAN' },
  foe: { team: 1, hp: 42, min: 80, max: 145, turn: 0.82, name: 'RAIDER' },
  ace: { team: 1, hp: 120, min: 90, max: 172, turn: 1.12, name: 'ACE RAIDER' },
};
function spawnShip(kind, pos, quat) {
  const K = KINDS[kind];
  const b = K.team === 0 ? buildInterceptor(M, kind === 'player' ? M.playerAccent : M.wingAccent) : buildWasp(M, kind === 'ace');
  const mesh = new THREE.Group(); mesh.add(b.group);
  mesh.position.copy(pos); mesh.quaternion.copy(quat); scene.add(mesh);
  const scale = b.group.scale.x;
  const s = {
    kind, team: K.team, name: K.name, K, mesh, model: b.group, pos: mesh.position, quat: mesh.quaternion, vel: V(), fwd: V(0, 0, -1),
    speed: K.max * 0.6, hp: K.hp, maxHp: K.hp, radius: b.radius, muzzles: b.muzzles.map((m) => m.multiplyScalar(scale)), engines: b.engines, flares: b.flares,
    cmd: { pitch: 0, yaw: 0, roll: 0, throttle: 0.6, boost: false }, rate: V(), fireCd: rand(), muzzle: 0, alive: true,
    ai: kind === 'player' ? null : { mode: 'attack', timer: 0, target: null, retarget: 0, point: V(), heat: 0, slot: 0 },
  };
  ships.push(s);
  return s;
}
function updateShip(s, dt) {
  const K = s.K, c = s.cmd;
  const k = 1 - Math.exp(-dt * 7);
  s.rate.x += (c.pitch - s.rate.x) * k; s.rate.y += (c.yaw - s.rate.y) * k; s.rate.z += (c.roll - s.rate.z) * k;
  _e.set(s.rate.x * 1.25 * K.turn * dt, s.rate.y * 0.95 * K.turn * dt, s.rate.z * 2.4 * K.turn * dt);
  s.quat.multiply(_q.setFromEuler(_e)).normalize();
  const target = lerp(K.min, K.max, c.throttle) * (c.boost ? 1.75 : 1);
  s.speed += (target - s.speed) * Math.min(1, dt * (c.boost ? 2.2 : 1.3));
  s.fwd.set(0, 0, -1).applyQuaternion(s.quat);
  s.vel.copy(s.fwd).multiplyScalar(s.speed);
  s.pos.addScaledVector(s.vel, dt);
  s.fireCd -= dt;
  // visual bank + engine flare
  s.model.rotation.z = lerp(s.model.rotation.z, s.rate.y * 0.5, k * 0.6);
  const glow = (0.55 + c.throttle * 0.6 + (c.boost ? 1.1 : 0)) * (0.92 + rand() * 0.16);
  const base = s.team === 0 ? 3 : 4;
  for (const f of s.flares) f.scale.setScalar(base * glow);
}
function exhaust(s) {
  if (s.pos.distanceToSquared(camera.position) > 1200 * 1200) return;
  s.mesh.updateMatrixWorld(true);
  const boost = s.cmd.boost ? 1 : 0;
  for (const e of s.engines) {
    _a.copy(e); s.model.localToWorld(_a);
    const j = 3;
    const bx = s.vel.x * 0.25 + (rand() - 0.5) * j, by = s.vel.y * 0.25 + (rand() - 0.5) * j, bz = s.vel.z * 0.25 + (rand() - 0.5) * j;
    if (s.team === 0) particles.spawn(_a.x, _a.y, _a.z, bx, by, bz, 0.03 + boost * 0.12, 0.13 + boost * 0.14, 0.4, 1.2 + boost * 0.8, 0.22 + boost * 0.16, 0, -0.7);
    else particles.spawn(_a.x, _a.y, _a.z, bx, by, bz, 0.5, 0.09, s.kind === 'ace' ? 0.45 : 0.02, 1.5, 0.26, 0, -0.7);
  }
  if (s.hp < s.maxHp * 0.4 && rand() < 0.5) { // battle damage
    randDir(_b);
    particles.spawn(s.pos.x, s.pos.y, s.pos.z, s.vel.x * 0.3 + _b.x * 14, s.vel.y * 0.3 + _b.y * 14, s.vel.z * 0.3 + _b.z * 14, 5, 1.6, 0.3, 1.6 + rand() * 2, 0.5 + rand() * 0.5, 1, 1);
  }
}
function fire(s, aimPoint, spread, speed, damage, color, kind) {
  const m = s.muzzles[s.muzzle]; s.muzzle = (s.muzzle + 1) % s.muzzles.length;
  _a.copy(m).applyQuaternion(s.quat).add(s.pos);
  _b.subVectors(aimPoint, _a).normalize();
  if (spread) { randDir(_c); _b.addScaledVector(_c, spread).normalize(); }
  bolts.spawn(_a, _b, speed, s.team, damage, color, kind === 0 ? 0.55 : 0.6, kind === 0 ? 13 : 11, 1.7, s);
  particles.spawn(_a.x, _a.y, _a.z, s.vel.x, s.vel.y, s.vel.z, color.r, color.g, color.b, 3.2, 0.07);
  const d = _a.distanceTo(camera.position);
  sfx.laser(kind, s === player ? 0.75 : clamp(1 - d / 900, 0, 1) * 0.6);
}

// ---------------------------------------------------------------- effects
function explode(pos, size = 1, quiet = false) {
  const n = Math.min(240, Math.floor(44 * size)), sp = Math.sqrt(size);
  for (let i = 0; i < n; i++) {
    randDir(_c); const v = (14 + rand() * 80) * sp, t = rand();
    particles.spawn(pos.x + _c.x * size * 2, pos.y + _c.y * size * 2, pos.z + _c.z * size * 2, _c.x * v, _c.y * v, _c.z * v,
      t < 0.3 ? 9 : 6, t < 0.3 ? 5.5 : 2.0 + rand(), t < 0.3 ? 2 : 0.35, (4 + rand() * 9) * sp, 0.45 + rand() * 0.95, 2.4, 1.3);
  }
  for (let i = 0; i < n * 0.7; i++) {
    randDir(_c); const v = (110 + rand() * 300) * sp;
    particles.spawn(pos.x, pos.y, pos.z, _c.x * v, _c.y * v, _c.z * v, 10, 6, 2, 0.9 + rand() * 1.1, 0.5 + rand() * 1.3, 0.9, 0);
  }
  particles.spawn(pos.x, pos.y, pos.z, 0, 0, 0, 16, 11, 7, 46 * size, 0.3, 0, 0.6);
  shocks.spawn(pos, 75 * size, 0.55 + size * 0.15, COL.shock);
  const l = lights[lightIdx]; lightIdx = (lightIdx + 1) % lights.length;
  l.position.copy(pos); l.intensity = 5e4 * size * size;
  const d = pos.distanceTo(camera.position);
  if (!quiet) sfx.explosion(clamp(1.15 - d / 2600, 0, 1), size);
  shake += size * clamp(1 - d / 700, 0, 1) * 1.3;
}
function sparks(p, color, n = 7) {
  for (let i = 0; i < n; i++) {
    randDir(_c); const v = 30 + rand() * 90;
    particles.spawn(p.x, p.y, p.z, _c.x * v, _c.y * v, _c.z * v, color.r * 1.2 + 2, color.g * 1.2 + 1.5, color.b * 1.2 + 1, 0.8 + rand() * 0.9, 0.2 + rand() * 0.35, 1.5, 0);
  }
  particles.spawn(p.x, p.y, p.z, 0, 0, 0, color.r, color.g, color.b, 7, 0.1);
}

// ---------------------------------------------------------------- damage
function damage(e, amount, owner) {
  if (!e.alive) return;
  if (e === player) {
    if (state !== 'playing') return;
    G.lastHit = time;
    let d = amount;
    if (G.shield > 0) { const a = Math.min(G.shield, d); G.shield -= a; d -= a; G.shieldFlash = 1; sfx.shield(); }
    if (d > 0) { e.hp -= d; G.dmgFlash = 1; shake += 0.5; sfx.hit(); }
    if (e.hp <= 0) killPlayer();
    return;
  }
  e.hp -= amount;
  if (owner === player) { sfx.ping(); if (e.ai && rand() < 0.4) e.ai.target = player; }
  if (e.hp <= 0) kill(e, owner);
}
function kill(e, owner) {
  e.alive = false;
  const byPlayer = owner === player;
  if (e.kind === 'turret') { explode(e.pos, 1.8); e.obj.removeFromParent(); if (byPlayer) G.score += 150; }
  else if (e.kind === 'reactor') {
    explode(e.pos, 4.5); e.mesh.removeFromParent(); G.score += 500; G.flash = 0.35;
    const left = G.dread.reactors.filter((r) => r.alive).length;
    if (left === 0) startDreadDeath(); else announce(`REACTOR DESTROYED`, `${left} REMAINING`, 2.6);
  } else {
    explode(e.pos, e.kind === 'ace' ? 1.7 : 1.25); scene.remove(e.mesh);
    if (e.team === 1 && byPlayer) { G.score += e.kind === 'ace' ? 250 : 100; G.kills++; }
    if (e.kind === 'ally') announce('WINGMAN DOWN', '', 2.2);
  }
  if (G.target === e) { G.target = null; G.lockT = 0; }
}
function killPlayer() {
  player.alive = false; player.mesh.visible = false;
  explode(player.pos, 2.6); G.flash = 0.5; shake += 3;
  state = 'dead'; G.endTimer = 3.2; sfx.engineOff();
}

// ---------------------------------------------------------------- AI
function pickTarget(s) {
  let best = null, bd = 1e12;
  if (s.team === 1) {
    if (player.alive && state === 'playing') {
      let onPlayer = 0; for (const o of ships) if (o.team === 1 && o.alive && o.ai.target === player) onPlayer++;
      if (onPlayer < 3 && rand() < 0.5) return player;
    }
    for (const o of ships) if (o.team === 0 && o.alive && (o !== player || state === 'playing')) { const d = o.pos.distanceToSquared(s.pos) * (o === player ? 1.6 : 1); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  for (const o of ships) if (o.team === 1 && o.alive) { const d = o.pos.distanceToSquared(s.pos); if (d < bd) { bd = d; best = o; } }
  if (!best) for (const o of statics) if (o.alive && o.kind === 'turret') { const d = o.pos.distanceToSquared(s.pos); if (d < bd && d < 3000 * 3000) { bd = d; best = o; } }
  return best;
}
const _goal = V(), _loc = V();
function think(s, dt) {
  const ai = s.ai; let fireOk = false, throttle = 0.8, boost = false;
  ai.retarget -= dt;
  if (!ai.target || !ai.target.alive || ai.retarget <= 0) { ai.target = pickTarget(s); ai.retarget = 3 + rand() * 4; }
  const t = ai.target;
  if (ai.mode === 'break') {
    ai.timer -= dt; _goal.copy(ai.point); throttle = 1;
    if (ai.timer <= 0) ai.mode = 'attack';
  } else if (t) {
    const dist = s.pos.distanceTo(t.pos), speed = s.team === 0 ? 900 : 620;
    _goal.copy(t.pos).addScaledVector(t.vel, dist / speed);
    const breakDist = t.kind === 'turret' ? 330 : 95;
    if (dist < breakDist) {
      ai.mode = 'break'; ai.timer = 1.4 + rand() * 2.2;
      randDir(_c); ai.point.copy(s.pos).addScaledVector(s.fwd, 300).addScaledVector(_c, 800);
    }
    _loc.subVectors(_goal, s.pos).normalize();
    fireOk = _loc.dot(s.fwd) > 0.9972 && dist < 1050;
    throttle = dist > 500 ? 1 : 0.55;
  } else if (s.team === 0 && player.alive) { // hold formation
    _goal.set(ai.slot * 26, 3, 20).applyQuaternion(player.quat).add(player.pos).addScaledVector(player.fwd, 160);
    const d = s.pos.distanceTo(_goal) - 160;
    throttle = clamp((player.speed - s.K.min) / (s.K.max - s.K.min) + d * 0.01, 0, 1); boost = d > 250;
  } else _goal.copy(s.pos).addScaledVector(s.fwd, 200);

  // obstacle avoidance
  const look = 70 + s.speed * 0.6;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    const dx = o.pos.x - s.pos.x, dy = o.pos.y - s.pos.y, dz = o.pos.z - s.pos.z, rr = o.r + look;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > rr * rr) continue;
    if (d2 < (o.r + 2) * (o.r + 2) && o.scale) { kill(s, null); return; }
    if (dx * s.fwd.x + dy * s.fwd.y + dz * s.fwd.z > 0 || d2 < (o.r + 30) * (o.r + 30)) {
      _goal.set(-dx, -dy, -dz).normalize().multiplyScalar(500).add(s.pos).addScaledVector(s.fwd, 220); fireOk = false; break;
    }
  }
  if (s.pos.lengthSq() > 6200 * 6200) _goal.set(0, 0, 0);

  // steer towards goal
  _loc.subVectors(_goal, s.pos).applyQuaternion(_q.copy(s.quat).invert()).normalize();
  const c = s.cmd;
  if (_loc.z > 0.2) { c.pitch = _loc.y >= 0 ? 1 : -1; c.yaw = clamp(-_loc.x * 2, -1, 1); }
  else { c.pitch = clamp(_loc.y * 3.5, -1, 1); c.yaw = clamp(-_loc.x * 3.5, -1, 1); }
  c.roll = clamp(-_loc.x * 1.6, -1, 1); c.throttle = throttle; c.boost = boost;

  if (ai.heat > 0 && !fireOk) ai.heat = Math.max(0, ai.heat - dt * 2);
  if (fireOk && s.fireCd <= 0 && t) {
    const foe = s.team === 1;
    fire(s, _goal, foe ? 0.022 : 0.012, foe ? 620 : 900, foe ? (s.kind === 'ace' ? 8 : 6) : 9, foe ? (s.kind === 'ace' ? COL.ace : COL.foe) : COL.ally, foe ? 1 : 0);
    s.fireCd = 0.15; ai.heat++;
    if (ai.heat >= 6) { ai.heat = 0; s.fireCd = 0.8 + rand() * 0.6; }
  }
}

// ---------------------------------------------------------------- input
const keys = new Set(), stick = { x: 0, y: 0 };
let hadLock = false, mouseDown = false;
const locked = () => document.pointerLockElement === canvas;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyM') $('mute').textContent = sfx.toggleMute() ? 'SOUND OFF' : 'SOUND ON';
  if (e.code === 'KeyT' && state === 'playing') cycleTarget();
  if ((e.code === 'KeyF' || e.code === 'KeyE') && state === 'playing') fireMissile();
  if (e.code === 'KeyP' && (state === 'playing' || state === 'paused')) { if (state === 'playing') pause(); else resume(); }
  if (e.code === 'Enter' && (state === 'title' || state === 'over')) startGame();
  if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('mousemove', (e) => {
  if (state !== 'playing') return;
  if (locked()) { stick.x += e.movementX * 0.0021; stick.y += e.movementY * 0.0021; }
  else { const r = Math.min(innerWidth, innerHeight) * 0.3; stick.x = (e.clientX - innerWidth / 2) / r; stick.y = (e.clientY - innerHeight / 2) / r; }
  const l = Math.hypot(stick.x, stick.y); if (l > 1) { stick.x /= l; stick.y /= l; }
});
addEventListener('mousedown', (e) => { if (state !== 'playing') return; if (e.button === 0) mouseDown = true; if (e.button === 2) fireMissile(); });
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  if (locked()) hadLock = true; else if (state === 'playing' && hadLock) pause();
});
function grabPointer() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* optional */ } }
function pause() { state = 'paused'; $('pause').hidden = false; sfx.engineOff(); mouseDown = false; keys.clear(); }
function resume() { $('pause').hidden = true; state = 'playing'; grabPointer(); }
$('pause').addEventListener('click', resume);
$('start').addEventListener('click', startGame);
$('again').addEventListener('click', startGame);

// ---------------------------------------------------------------- player
function cycleTarget() {
  const list = foes.filter((e) => e.pos.distanceTo(player.pos) < 5000).sort((a, b) => a.pos.distanceToSquared(player.pos) - b.pos.distanceToSquared(player.pos));
  if (!list.length) return;
  G.target = list[(list.indexOf(G.target) + 1) % list.length]; G.lockT = 0; sfx.beep(660, 0.08);
}
function autoTarget() {
  let best = null, bs = 1e9;
  for (const e of foes) {
    _a.subVectors(e.pos, player.pos); const d = _a.length(); if (d > 3800) continue;
    const ang = Math.acos(clamp(_a.dot(player.fwd) / d, -1, 1));
    if (ang > 0.45) continue;
    const sc = ang + d / 30000 + (e.kind === 'turret' ? 0.03 : 0);
    if (sc < bs) { bs = sc; best = e; }
  }
  const cur = G.target;
  if (cur && cur.alive) {
    _a.subVectors(cur.pos, player.pos); const d = _a.length();
    const ang = Math.acos(clamp(_a.dot(player.fwd) / d, -1, 1));
    if (best && best !== cur && bs + 0.07 < ang + d / 30000) { G.target = best; G.lockT = 0; }
    else if (d > 5500) G.target = best;
  } else {
    G.target = best;
    if (!best) { let bd = 1e12; for (const e of foes) { const d = e.pos.distanceToSquared(player.pos); if (d < bd) { bd = d; G.target = e; } } }
    G.lockT = 0;
  }
}
const lead = V(), boresight = V();
function fireMissile() {
  if (!player.alive || G.missiles <= 0 || !G.locked || !G.target) { sfx.beep(180, 0.08); return; }
  G.missiles--;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 3.2, 8).rotateX(-Math.PI / 2), M.allyDark);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.glowTex, color: new THREE.Color(8, 4, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.setScalar(7); glow.position.z = 2; mesh.add(glow);
  mesh.position.copy(player.pos).addScaledVector(_a.set(0, -1.6, 0).applyQuaternion(player.quat), 1);
  scene.add(mesh);
  missiles.push({ mesh, pos: mesh.position, dir: player.fwd.clone(), speed: player.speed + 40, target: G.target, life: 7 });
  sfx.missile();
}
function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i]; m.life -= dt;
    m.speed = Math.min(560, m.speed + 420 * dt);
    let boom = m.life <= 0;
    if (m.target && m.target.alive) {
      const d = m.pos.distanceTo(m.target.pos);
      _a.copy(m.target.pos).addScaledVector(m.target.vel, d / m.speed).sub(m.pos).normalize();
      m.dir.lerp(_a, Math.min(1, dt * 4.2)).normalize();
      if (d < m.target.radius + 9) { damage(m.target, 95, player); boom = true; }
    }
    m.pos.addScaledVector(m.dir, m.speed * dt);
    m.mesh.quaternion.setFromUnitVectors(_b.set(0, 0, -1), m.dir);
    for (let k = 0; k < 2; k++) particles.spawn(m.pos.x, m.pos.y, m.pos.z, (rand() - 0.5) * 8, (rand() - 0.5) * 8, (rand() - 0.5) * 8, 6, 3, 0.8, 2.2, 0.55, 0, 1.2);
    if (!boom) for (const o of obstacles) if (o.scale && m.pos.distanceToSquared(o.pos) < o.r * o.r) { boom = true; break; }
    if (boom) { explode(m.pos, 1.1); scene.remove(m.mesh); missiles.splice(i, 1); }
  }
}
function controlPlayer(dt) {
  const c = player.cmd, dz = 0.05;
  const sx = Math.abs(stick.x) < dz ? 0 : stick.x, sy = Math.abs(stick.y) < dz ? 0 : stick.y;
  c.yaw = -sx; c.pitch = -sy;
  c.roll = (keys.has('KeyA') || keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  if (keys.has('KeyW') || keys.has('ArrowUp')) G.throttle = Math.min(1, G.throttle + dt * 0.7);
  if (keys.has('KeyS') || keys.has('ArrowDown')) G.throttle = Math.max(0, G.throttle - dt * 0.7);
  c.throttle = G.throttle;
  const wantBoost = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && G.boost > 0.02;
  c.boost = wantBoost;
  G.boost = clamp(G.boost + (wantBoost ? -dt * 0.3 : dt * 0.11), 0, 1);

  // out of bounds
  const far = player.pos.length();
  G.warn = far > 6000 ? 'LEAVING COMBAT ZONE — TURN BACK' : player.hp < 30 ? 'HULL CRITICAL' : '';
  if (far > 7200) {
    _loc.copy(player.pos).negate().applyQuaternion(_q.copy(player.quat).invert()).normalize();
    c.yaw = clamp(-_loc.x * 3, -1, 1); c.pitch = _loc.z > 0 ? 1 : clamp(_loc.y * 3, -1, 1);
  }

  autoTarget();
  boresight.copy(player.pos).addScaledVector(player.fwd, 900);
  const t = G.target; G.assist = false;
  if (t) {
    const d = t.pos.distanceTo(player.pos);
    lead.copy(t.pos).addScaledVector(t.vel, d / 950);
    _a.subVectors(lead, player.pos).normalize();
    const dot = _a.dot(player.fwd);
    G.assist = dot > 0.9976 && d < 1500;
    const inCone = _a.subVectors(t.pos, player.pos).normalize().dot(player.fwd) > 0.955 && d < 2800;
    const was = G.locked;
    G.lockT = inCone ? Math.min(1.2, G.lockT + dt) : Math.max(0, G.lockT - dt * 2);
    G.locked = G.lockT >= 1 && G.missiles > 0;
    if (G.locked && !was) sfx.beep(1320, 0.12);
  } else { G.locked = false; G.lockT = 0; }

  if ((mouseDown || keys.has('Space')) && player.fireCd <= 0) {
    fire(player, G.assist ? lead : _a.copy(player.pos).addScaledVector(player.fwd, 650), 0.003, 950, 15, COL.ally, 0);
    player.fireCd = 0.085; shake += 0.03;
  }
  // regen
  if (time - G.lastHit > 4) G.shield = Math.min(100, G.shield + dt * 14);
  G.bumpCd -= dt;
  // collisions
  for (const o of obstacles) {
    if (!o.scale) continue;
    const rr = o.r + 3;
    if (player.pos.distanceToSquared(o.pos) < rr * rr) { bump(_a.subVectors(player.pos, o.pos).normalize(), o.pos, rr); break; }
  }
  for (const cap of capitals) {
    const bx = capHit(cap, player.pos, 4);
    if (!bx) continue;
    const l = cap.local; let best = 1e9; _b.set(0, 0, 0);
    const tests = [[l.x - bx.min.x + 4, -1, 0, 0], [bx.max.x + 4 - l.x, 1, 0, 0], [l.y - bx.min.y + 4, 0, -1, 0], [bx.max.y + 4 - l.y, 0, 1, 0], [l.z - bx.min.z + 4, 0, 0, -1], [bx.max.z + 4 - l.z, 0, 0, 1]];
    for (const [pen, nx, ny, nz] of tests) if (pen < best) { best = pen; _b.set(nx, ny, nz); }
    _b.transformDirection(cap.group.matrixWorld);
    player.pos.addScaledVector(_b, best + 1);
    bump(_b, null, 0);
  }
}
function bump(normal, centre, rr) {
  if (centre) player.pos.copy(centre).addScaledVector(normal, rr + 1);
  // deflect heading away from the surface
  _c.copy(player.fwd).addScaledVector(normal, 1.2 - player.fwd.dot(normal)).normalize();
  player.quat.premultiply(_q.setFromUnitVectors(player.fwd, _c));
  player.speed *= 0.55;
  sparks(player.pos, COL.shock, 24);
  if (G.bumpCd <= 0) { G.bumpCd = 0.5; damage(player, 34, null); shake += 2; }
}

// ---------------------------------------------------------------- dreadnought
function spawnDread() {
  const cap = makeCapital(true, DREAD_POS, -1.05);
  cap.warp = 0; cap.axis = V(0, 0, 1).applyQuaternion(cap.group.quaternion); cap.name = 'KHARON';
  G.dread = cap; sfx.warp();
  announce('WARNING', 'CAPITAL SHIP EXITING SLIPSPACE', 4);
}
function finishDreadWarp(cap) {
  cap.group.position.copy(DREAD_POS); cap.group.scale.set(1, 1, 1);
  activateCapital(cap);
  for (const p of cap.turretSlots) {
    const t = buildTurret(M); t.group.position.copy(p); cap.group.add(t.group);
    cap.group.updateMatrixWorld(true);
    const e = { kind: 'turret', name: 'TURRET', team: 1, pos: t.group.localToWorld(V(0, 9, 0)), vel: V(), radius: 17, hp: 130, maxHp: 130, alive: true, obj: t.group, head: t.head, cd: 1 + rand() * 2, burst: 0 };
    statics.push(e); cap.turrets.push(e);
  }
  for (const p of cap.reactorSlots) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(26, 24, 16), M.reactor); mesh.position.copy(p);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.glowTex, color: new THREE.Color(7, 2.4, 0.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.setScalar(4.5); mesh.add(s); cap.group.add(mesh);
    cap.group.updateMatrixWorld(true);
    const e = { kind: 'reactor', name: 'REACTOR CORE', team: 1, pos: mesh.getWorldPosition(V()), vel: V(), radius: 30, hp: 340, maxHp: 340, alive: true, mesh, glow: s };
    statics.push(e); cap.reactors.push(e);
  }
  shocks.spawn(DREAD_POS, 2600, 1.6, COL.shockBlue); G.flash = 0.45; shake += 1.5;
  announce('DREADNOUGHT KHARON', 'DESTROY ITS THREE REACTOR CORES', 5);
  spawnFoes(4, 1, DREAD_POS); G.escortTimer = 24;
}
function updateDread(dt) {
  const cap = G.dread; if (!cap) return;
  if (cap.warp < 1) {
    cap.warp = Math.min(1, cap.warp + dt / 1.5);
    const e = 1 - Math.pow(1 - cap.warp, 4);
    cap.group.position.copy(DREAD_POS).addScaledVector(cap.axis, (1 - e) * 14000);
    cap.group.scale.set(1, 1, 1 + (1 - e) * 16);
    if (cap.warp >= 1) finishDreadWarp(cap);
    return;
  }
  if (cap.dying !== undefined) {
    cap.dying -= dt;
    if (rand() < dt * 9) {
      const bx = cap.boxes[(rand() * cap.boxes.length) | 0];
      _a.set(lerp(bx.min.x, bx.max.x, rand()), rand() < 0.5 ? bx.max.y : bx.min.y, lerp(bx.min.z, bx.max.z, rand())).applyMatrix4(cap.group.matrixWorld);
      explode(_a, 1.5 + rand() * 3);
    }
    if (cap.dying <= 0) {
      for (let z = -800; z <= 800; z += 200) explode(_a.set((rand() - 0.5) * 200, (rand() - 0.5) * 100, z).applyMatrix4(cap.group.matrixWorld), 7 + rand() * 4, z !== 0);
      shocks.spawn(cap.pos, 3200, 2.2, COL.shock);
      scene.remove(cap.group); cap.active = false; capitals.splice(capitals.indexOf(cap), 1); rebuildObstacles();
      for (const t of cap.turrets) t.alive = false;
      G.dread = null; G.flash = 1; shake += 4; G.score += 5000;
      for (const s of ships) if (s.team === 1 && s.alive) kill(s, null);
      state = 'victory'; G.endTimer = 5;
      announce('DREADNOUGHT DESTROYED', 'THE AURORA IS SAFE', 5);
    }
    return;
  }
  // reactors pulse, turrets track and fire
  for (const r of cap.reactors) if (r.alive) r.glow.scale.setScalar(4.5 + Math.sin(time * 5 + r.pos.x) * 0.8);
  for (const t of cap.turrets) {
    if (!t.alive) continue;
    let tg = null, bd = 2500 * 2500;
    for (const s of friends) { const d = s.pos.distanceToSquared(t.pos); if (d < bd) { bd = d; tg = s; } }
    if (!tg) continue;
    const d = Math.sqrt(bd);
    _a.copy(tg.pos).addScaledVector(tg.vel, d / 520);
    t.head.lookAt(_a);
    t.cd -= dt;
    if (t.cd <= 0) {
      _b.subVectors(_a, t.pos).normalize(); randDir(_c); _b.addScaledVector(_c, 0.03).normalize();
      _d.copy(t.pos).addScaledVector(_b, 24);
      bolts.spawn(_d, _b, 520, 1, 13, COL.turret, 1.7, 28, 4.5, t);
      particles.spawn(_d.x, _d.y, _d.z, 0, 0, 0, 7, 0.5, 3.4, 14, 0.1);
      sfx.laser(2, clamp(1 - _d.distanceTo(camera.position) / 1600, 0, 1) * 0.7);
      t.burst++; t.cd = 0.2;
      if (t.burst >= 3) { t.burst = 0; t.cd = 1.7 + rand() * 1.4; }
    }
  }
  G.escortTimer -= dt;
  if (G.escortTimer <= 0) {
    G.escortTimer = 22;
    if (ships.filter((s) => s.team === 1 && s.alive).length < 4) { spawnFoes(3, 0, DREAD_POS); announce('ESCORTS LAUNCHED', '', 2); }
  }
}
function startDreadDeath() {
  G.dread.dying = 5.5;
  announce('REACTORS CRITICAL', 'GET CLEAR OF THE BLAST', 4);
}

// ---------------------------------------------------------------- waves
function spawnFoes(n, aces, around) {
  for (let i = 0; i < n + aces; i++) {
    let tries = 0;
    do {
      if (around) randDir(_a).multiplyScalar(700 + rand() * 300).add(around);
      else _a.set((rand() - 0.5) * 2200, (rand() - 0.5) * 500, -2300 - rand() * 900);
    } while (tries++ < 20 && obstacles.some((o) => o.pos.distanceTo(_a) < o.r + 60));
    const s = spawnShip(i < aces ? 'ace' : 'foe', _a, lookQuat(_a, player.pos, _q));
    shocks.spawn(_a, 60, 0.5, COL.shockBlue);
    particles.spawn(_a.x, _a.y, _a.z, 0, 0, 0, 3, 6, 14, 60, 0.35);
    s.ai.retarget = 0;
  }
}
function updateWaves(dt) {
  if (state !== 'playing') return;
  if (!G.waveActive) {
    G.waveTimer -= dt;
    if (G.waveTimer <= 0) {
      G.wave++; G.waveActive = true;
      const w = WAVES[G.wave];
      if (w.boss) spawnDread(); else { spawnFoes(w.foes, w.aces); announce(w.text, w.sub); sfx.alarm(); }
    }
    return;
  }
  const w = WAVES[G.wave];
  if (!w.boss && !ships.some((s) => s.team === 1 && s.alive)) {
    G.waveActive = false; G.waveTimer = 6;
    G.missiles = G.maxMissiles; player.hp = Math.min(100, player.hp + 30);
    announce('WAVE CLEARED', 'REARMED — STAND BY', 3.4);
    sfx.beep(880, 0.12); setTimeout(() => sfx.beep(1320, 0.12), 140);
  }
}

// ---------------------------------------------------------------- flow
function resetGame() {
  for (const s of ships) scene.remove(s.mesh);
  for (const m of missiles) scene.remove(m.mesh);
  ships.length = 0; statics.length = 0; missiles.length = 0; bolts.clear();
  if (G.dread) { scene.remove(G.dread.group); capitals.splice(capitals.indexOf(G.dread), 1); }
  rebuildObstacles();
  Object.assign(G, { shield: 100, boost: 1, throttle: 0.6, missiles: 6, score: 0, kills: 0, lastHit: -99, wave: -1, waveActive: false, waveTimer: 3, message: null, target: null, lockT: 0, locked: false, dread: null, warn: '' });
  stick.x = stick.y = 0;
  _q.identity();
  player = spawnShip('player', START, _q);
  for (const sx of [-1, 1]) { const a = spawnShip('ally', _a.set(sx * 26, 3, 20).add(START), _q); a.ai.slot = sx; }
  camQuat.copy(player.quat);
}
function startGame() {
  sfx.init();
  resetGame();
  $('title').hidden = true; $('end').hidden = true; $('pause').hidden = true;
  state = 'playing'; hadLock = false; grabPointer();
  announce('LAUNCH', 'ALL WINGS — WEAPONS FREE', 2.8);
}
function showEnd(win) {
  state = 'over';
  if (locked()) document.exitPointerLock();
  $('end-title').textContent = win ? 'VICTORY' : 'SHIP LOST';
  $('end-sub').textContent = win ? 'The dreadnought Kharon is debris. The Aurora sails on.' : `You fell during ${G.wave >= 3 ? 'the dreadnought assault' : 'wave ' + (G.wave + 1)}.`;
  $('end-score').textContent = String(G.score).padStart(6, '0');
  $('end-kills').textContent = G.kills;
  $('end').classList.toggle('win', win);
  $('end').hidden = false; sfx.engineOff();
}

// ---------------------------------------------------------------- bolts vs world
function boltHit(b) {
  const list = b.team === 0 ? foes : friends;
  const pad = b.owner === player ? 2.5 : 0.5;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.alive && segSphere(b.prev, b.pos, e.pos, e.radius + pad)) { sparks(b.pos, b.color); damage(e, b.damage, b.owner); return true; }
  }
  for (const cap of capitals) if (capHit(cap, b.pos, 0)) { sparks(b.prev, b.color, 5); return true; }
  const p = b.pos, A = world.asteroids.list;
  for (let i = 0; i < A.length; i++) {
    const o = A[i], dx = o.pos.x - p.x, dy = o.pos.y - p.y, dz = o.pos.z - p.z;
    if (dx * dx + dy * dy + dz * dz < o.r * o.r) { sparks(b.prev, b.color, 5); return true; }
  }
  return false;
}

// ---------------------------------------------------------------- camera
const camQuat = new THREE.Quaternion();
let fov = 62;
function updateCamera(dt) {
  if (state === 'title' || state === 'over' && player.alive) {
    const a = time * 0.12 + 2.4;
    camera.position.set(Math.sin(a) * 34, 7 + Math.sin(time * 0.2) * 4, Math.cos(a) * 34).add(player.pos);
    camera.lookAt(_a.copy(player.pos).addScaledVector(player.fwd, 4));
    fov = lerp(fov, 48, dt * 2);
  } else if (!player.alive) {
    camera.position.addScaledVector(_a.subVectors(camera.position, player.pos).normalize(), dt * 12);
    camera.lookAt(player.pos);
  } else {
    camQuat.slerp(player.quat, 1 - Math.exp(-dt * 5.2));
    const boost = clamp((player.speed - 170) / 120, 0, 1);
    camera.position.set(0, 4.4, 21 + boost * 5).applyQuaternion(camQuat).add(player.pos);
    camera.quaternion.copy(camQuat);
    fov = lerp(fov, 62 + boost * 20 + G.throttle * 4, dt * 4);
  }
  if (shake > 0.001) {
    shake = Math.min(shake, 5);
    camera.position.x += (rand() - 0.5) * shake; camera.position.y += (rand() - 0.5) * shake; camera.position.z += (rand() - 0.5) * shake;
    camera.rotateZ((rand() - 0.5) * shake * 0.012);
    shake *= Math.exp(-dt * 5);
  }
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
  bgCamera.quaternion.copy(camera.quaternion); bgCamera.fov = camera.fov; bgCamera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- loop
function update(dt) {
  time += dt;
  foes = []; friends = [];
  for (const s of ships) if (s.alive) (s.team === 1 ? foes : friends).push(s);
  for (const s of statics) if (s.alive) foes.push(s);
  if (state !== 'playing') { const i = friends.indexOf(player); if (i >= 0 && state !== 'title') friends.splice(i, 1); }

  if (state === 'playing' && player.alive) controlPlayer(dt);
  else if (player.alive) { player.cmd.pitch = player.cmd.yaw = player.cmd.roll = 0; player.cmd.throttle = 0.3; player.cmd.boost = false; }
  for (const s of ships) {
    if (!s.alive) continue;
    if (s.ai) think(s, dt);
    if (!s.alive) continue;
    updateShip(s, dt); exhaust(s);
  }
  updateDread(dt);
  updateMissiles(dt);
  bolts.update(dt, boltHit);
  updateWaves(dt);
  for (let i = ships.length - 1; i >= 0; i--) if (!ships[i].alive && ships[i] !== player) ships.splice(i, 1);
  for (let i = statics.length - 1; i >= 0; i--) if (!statics[i].alive) statics.splice(i, 1);

  if (state === 'dead' || state === 'victory') { G.endTimer -= dt; if (G.endTimer <= 0) showEnd(state === 'victory'); }
  if (G.message) { G.message.t -= dt; if (G.message.t <= 0) G.message = null; }
  for (const l of lights) l.intensity *= Math.exp(-dt * 7);
  G.dmgFlash *= Math.exp(-dt * 3); G.shieldFlash *= Math.exp(-dt * 5); G.flash *= Math.exp(-dt * 2.5);

  particles.update(dt);
  world.update(dt, time, camera);
  updateCamera(dt);
  shocks.update(dt, camera);
  if (sfx.ctx) {
    if (state === 'playing') sfx.engine(G.throttle, player.cmd.boost ? 1 : 0);
    sfx.intensity = lerp(sfx.intensity || 0, foes.length ? 1 : 0, dt);
  }
}

const hudState = { contacts: [], invQuat: new THREE.Quaternion(), stick };
function drawHud() {
  const s = hudState;
  s.active = state === 'playing' && player.alive;
  if (s.active) {
    s.camera = camera; s.player = player; s.target = G.target; s.lead = G.target ? lead : null; s.locked = G.locked; s.assist = G.assist;
    s.boresight = boresight; s.contacts = foes.concat(friends); s.invQuat.copy(player.quat).invert();
    s.shield = G.shield; s.hull = player.hp; s.boost = G.boost; s.throttle = G.throttle; s.speed = player.speed;
    s.missiles = G.missiles; s.maxMissiles = G.maxMissiles; s.score = G.score; s.time = time; s.warn = G.warn; s.message = G.message;
    const w = WAVES[Math.max(0, G.wave)];
    s.waveLabel = G.wave < 0 ? 'SORTIE' : w.boss ? 'FINAL ASSAULT' : `WAVE ${G.wave + 1} / ${WAVES.length}`;
    const n = ships.filter((x) => x.team === 1 && x.alive).length;
    s.objective = G.dread && G.dread.warp >= 1 ? 'Destroy the reactor cores' : n ? `${n} hostile${n > 1 ? 's' : ''} remaining` : 'Stand by';
    const d = G.dread;
    s.boss = d && d.warp >= 1 && d.dying === undefined
      ? { name: d.name, reactors: d.reactors.filter((r) => r.alive).length, frac: d.reactors.reduce((a, r) => a + Math.max(0, r.alive ? r.hp : 0), 0) / (340 * 3) } : null;
  }
  hud.draw(s);
}

let last = performance.now(), slow = 0, frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000; last = now;
  const dt = Math.min(raw, 0.05);
  if (state !== 'paused' && state !== 'loading') update(dt);
  grade.uniforms.uTime.value = time; grade.uniforms.uDamage.value = G.dmgFlash + (player && player.alive && player.hp < 30 ? 0.18 + 0.1 * Math.sin(time * 6) : 0);
  grade.uniforms.uShield.value = G.shieldFlash; grade.uniforms.uFlash.value = G.flash;
  const ps = (renderer.domElement.height / 2) / Math.tan((camera.fov * Math.PI) / 360);
  particles.material.uniforms.uScale.value = ps; world.dust.uniforms.uScale.value = ps;
  composer.render();
  drawHud();
  // adaptive resolution: drop render scale if the machine cannot keep up
  frames++;
  if (frames > 90 && state !== 'paused') {
    slow = raw > 1 / 38 ? slow + raw : Math.max(0, slow - raw * 2);
    if (slow > 2.5 && pixelRatio > 0.75) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); slow = 0; applySize(); }
  }
}
function applySize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(pixelRatio); renderer.setSize(w, h);
  composer.setPixelRatio(pixelRatio); composer.setSize(w, h);
  camera.aspect = bgCamera.aspect = w / h; camera.updateProjectionMatrix(); bgCamera.updateProjectionMatrix();
  world.stars.material.uniforms.uPR.value = pixelRatio;
  hud.resize(w, h);
}
addEventListener('resize', applySize);

resetGame();
state = 'title';
$('loading').hidden = true; $('title').hidden = false;
requestAnimationFrame(frame);

// debugging / automated-test hook
window.__ev = { sim(sec) { for (let i = 0; i < sec * 60; i++) if (state !== 'paused') update(1 / 60); }, camera, capitals, G, ships, statics, get state() { return state; }, get player() { return player; }, startGame, damage, kill, stick, keys, set mouse(v) { mouseDown = v; } };
