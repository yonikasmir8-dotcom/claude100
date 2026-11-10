// GPU-drawn, CPU-simulated effects: additive particles, laser bolts and shockwave rings.
import * as THREE from 'three';

export class Particles {
  constructor(scene, max = 9000) {
    this.max = max; this.head = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.drag = new Float32Array(max); this.grow = new Float32Array(max); this.base = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale; varying vec3 vC;
        void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; vC=aColor*aAlpha;
          gl_PointSize=aAlpha>0. ? min(aSize*uScale/max(-mv.z,1.),900.) : 0.; }`,
      fragmentShader: 'varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=smoothstep(1.,0.,d); gl_FragColor=vec4(vC*a*a,1.); }',
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false; this.points.renderOrder = 10;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, r, g, b, size, life, drag = 0, grow = 0) {
    const i = this.head; this.head = (i + 1) % this.max;
    const j = i * 3;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.col[j] = r; this.col[j + 1] = g; this.col[j + 2] = b;
    this.base[i] = size; this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.drag[i] = drag; this.grow[i] = grow;
  }
  update(dt) {
    const { pos, vel, life, maxLife, alpha, size, base, drag, grow, max } = this;
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      const j = i * 3, k = Math.max(0, 1 - drag[i] * dt);
      vel[j] *= k; vel[j + 1] *= k; vel[j + 2] *= k;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      const t = life[i] / maxLife[i];
      alpha[i] = t * t;
      size[i] = base[i] * (1 + grow[i] * (1 - t));
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.aColor.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = true;
  }
}

const _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);

export class Bolts {
  constructor(scene, max = 800) {
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1); g.rotateX(Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.mesh = new THREE.InstancedMesh(g, m, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
    const c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, c);
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.max = max; this.list = []; this.pool = [];
  }
  spawn(pos, dir, speed, team, damage, color, width, length, life, owner) {
    if (this.list.length >= this.max) return;
    const b = this.pool.pop() || { pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(), color: new THREE.Color() };
    b.pos.copy(pos); b.prev.copy(pos); b.vel.copy(dir).multiplyScalar(speed); b.quat.setFromUnitVectors(_z, dir);
    b.team = team; b.damage = damage; b.color.copy(color); b.width = width; b.length = length; b.life = life; b.owner = owner;
    this.list.push(b);
  }
  // hit(b) returns true when the bolt should be removed
  update(dt, hit) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const b = L[i];
      b.prev.copy(b.pos); b.pos.addScaledVector(b.vel, dt); b.life -= dt;
      if (b.life <= 0 || hit(b)) { this.pool.push(b); L[i] = L[L.length - 1]; L.pop(); }
    }
    for (let i = 0; i < L.length; i++) {
      const b = L[i];
      _m.compose(b.pos, b.quat, _s.set(b.width, b.width, b.length));
      this.mesh.setMatrixAt(i, _m); this.mesh.setColorAt(i, b.color);
    }
    this.mesh.count = L.length;
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.pool.push(...this.list); this.list.length = 0; this.mesh.count = 0; }
}

export class Shockwaves {
  constructor(scene, n = 10) {
    const g = new THREE.RingGeometry(0.86, 1, 64);
    this.items = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 11; scene.add(m);
      this.items.push({ mesh: m, t: 1, dur: 1, size: 1, color: new THREE.Color() });
    }
    this.next = 0;
  }
  spawn(pos, size, dur, color) {
    const it = this.items[this.next]; this.next = (this.next + 1) % this.items.length;
    it.mesh.position.copy(pos); it.t = 0; it.dur = dur; it.size = size; it.color.copy(color); it.mesh.visible = true;
  }
  update(dt, camera) {
    for (const it of this.items) {
      if (!it.mesh.visible) continue;
      it.t += dt / it.dur;
      if (it.t >= 1) { it.mesh.visible = false; continue; }
      const e = 1 - Math.pow(1 - it.t, 3);
      it.mesh.scale.setScalar(it.size * (0.05 + e));
      it.mesh.quaternion.copy(camera.quaternion);
      it.mesh.material.color.copy(it.color).multiplyScalar((1 - it.t) * (1 - it.t));
    }
  }
}

// closest approach of segment p0->p1 to sphere centre c; true when within r
const _ab = new THREE.Vector3(), _ac = new THREE.Vector3();
export function segSphere(p0, p1, c, r) {
  _ab.subVectors(p1, p0); _ac.subVectors(c, p0);
  const l2 = _ab.lengthSq();
  const t = l2 > 0 ? Math.min(1, Math.max(0, _ac.dot(_ab) / l2)) : 0;
  return _ac.addScaledVector(_ab, -t).lengthSq() <= r * r;
}
