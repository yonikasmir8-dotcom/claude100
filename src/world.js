// Background (baked nebula sky, stars, planet, moon, sun), asteroid field and space dust.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './models.js';

const NOISE = /* glsl */`
float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.02+vec3(13.1,7.7,3.3); a*=.5;} return s; }
`;

export const SUN_DIR = new THREE.Vector3(0.55, 0.4, -0.6).normalize();
export const PLANET_DIR = new THREE.Vector3(-0.52, -0.36, -0.78).normalize();

function bakeSky(renderer) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uEnv: { value: 0 }, uSun: { value: SUN_DIR }, uPlanet: { value: PLANET_DIR } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: NOISE + /* glsl */`
      varying vec3 vDir; uniform float uEnv; uniform vec3 uSun; uniform vec3 uPlanet;
      void main(){
        vec3 d=normalize(vDir);
        vec3 axis=normalize(vec3(.35,.9,.25));
        float band=exp(-pow(dot(d,axis)*2.4,2.));
        float n1=fbm(d*1.7+3.);
        float n2=fbm(d*3.1+vec3(n1*1.9));
        float n3=fbm(d*2.3+9.+n2);
        float neb=smoothstep(.36,.9,n2)*(.18+band);
        vec3 col=vec3(.0025,.004,.009);
        vec3 tint=mix(vec3(.04,.13,.55), vec3(.62,.10,.36), smoothstep(.32,.72,n3));
        tint=mix(tint, vec3(.05,.45,.5), smoothstep(.62,.9,fbm(d*1.3+40.))*.7);
        col+=tint*neb*.55;
        col+=vec3(1.,.55,.22)*pow(smoothstep(.5,1.,n2),3.)*band*.55;
        col*=1.-.8*smoothstep(.48,.78,fbm(d*4.6+20.))*band;
        // unresolved star dust
        vec3 c=floor(d*300.); float h=hash(c);
        col+=vec3(.9,.95,1.)*smoothstep(.9965,1.,h)*(.25+1.2*band)*.5;
        col+=vec3(.16,.2,.32)*band*band*.06;
        if(uEnv>.5){
          col+=vec3(1.,.9,.75)*(pow(max(dot(d,uSun),0.),900.)*260.+pow(max(dot(d,uSun),0.),12.)*.5);
          col+=vec3(.12,.3,.7)*pow(max(dot(d,uPlanet),0.),3.)*.9;
          col+=vec3(.02,.025,.04);
        }
        gl_FragColor=vec4(col,1.);
      }`,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(5, 48, 32), mat));
  const bake = (size, env) => {
    mat.uniforms.uEnv.value = env;
    const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
    new THREE.CubeCamera(0.1, 20, rt).update(renderer, scene);
    return rt;
  };
  const bg = bake(1024, 0);
  const envRT = bake(256, 1);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromCubemap(envRT.texture).texture;
  envRT.dispose(); pmrem.dispose(); mat.dispose();
  return { background: bg.texture, environment: env };
}

function makeStars(pixelRatio) {
  const rnd = mulberry32(11), N = 3800;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([s * Math.cos(a) * 5e4, u * 5e4, s * Math.sin(a) * 5e4], i * 3);
    const t = rnd(), m = Math.pow(rnd(), 7);
    const b = 0.22 + m * 4.5;
    col.set([(0.75 + 0.5 * t) * b, (0.82 + 0.1 * Math.sin(t * 3)) * b, (1.25 - 0.55 * t) * b], i * 3);
    size[i] = 1.1 + m * 2.6 + rnd() * 0.7;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uPR: { value: pixelRatio } }, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aColor; attribute float aSize; uniform float uPR; varying vec3 vC; void main(){ vC=aColor; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*uPR; }',
    fragmentShader: 'varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=smoothstep(1.,0.,d); gl_FragColor=vec4(vC*a*a,1.); }',
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 0;
  return p;
}

function makePlanet() {
  const R = 30000;
  const group = new THREE.Group();
  group.position.copy(PLANET_DIR).multiplyScalar(62000);
  const uniforms = { uSun: { value: SUN_DIR }, uTime: { value: 0 } };
  const vs = /* glsl */`varying vec3 vObj; varying vec3 vN; varying vec3 vW;
    void main(){ vObj=normalize(position); vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
  const surf = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false, vertexShader: vs,
    fragmentShader: NOISE + /* glsl */`
      varying vec3 vObj; varying vec3 vN; varying vec3 vW; uniform vec3 uSun; uniform float uTime;
      void main(){
        vec3 p=vObj; vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vW);
        float h=fbm(p*2.3+fbm(p*4.2)*.7);
        float h2=fbm(p*11.);
        h+= (h2-.5)*.07;
        float land=smoothstep(.5,.53,h);
        vec3 ocean=mix(vec3(.004,.022,.075), vec3(.01,.085,.16), smoothstep(.36,.5,h));
        vec3 lc=mix(vec3(.035,.09,.03), vec3(.2,.16,.085), smoothstep(.54,.68,h+ (h2-.5)*.2));
        lc=mix(lc, vec3(.32,.3,.28), smoothstep(.7,.82,h));
        float ice=smoothstep(.72,.86,abs(p.y)+(h2-.5)*.25);
        vec3 alb=mix(mix(ocean,lc,land), vec3(.8,.86,.92), ice);
        vec3 cp=p*3.4+vec3(uTime*.004,0.,uTime*.002);
        float cl=fbm(cp+fbm(p*7.+uTime*.003)*.55);
        float clouds=smoothstep(.47,.74,cl);
        float ndl=dot(N,uSun);
        float day=smoothstep(-.12,.22,ndl);
        vec3 sunC=vec3(1.,.95,.86)*1.15;
        vec3 col=alb*max(ndl,0.)*sunC;
        vec3 H=normalize(uSun+V);
        col+=(1.-land)*(1.-clouds)*pow(max(dot(N,H),0.),90.)*vec3(1.,.85,.6)*1.2*day;
        // cloud shadow + clouds, warm tint at the terminator
        vec3 cc=mix(vec3(1.,.55,.3), vec3(1.), smoothstep(0.,.35,ndl))*max(ndl,0.)*.74;
        col=mix(col, cc, clouds*.92);
        float city=land*(1.-ice)*smoothstep(.55,.8,noise(p*90.))*smoothstep(.5,.62,fbm(p*14.+5.));
        col+=city*(1.-day)*(1.-clouds*.8)*vec3(1.6,.95,.4)*1.1;
        float fres=pow(1.-max(dot(N,V),0.),2.6);
        col+=vec3(.2,.45,1.)*fres*smoothstep(-.25,.35,ndl)*.55;
        col+=vec3(.9,.35,.12)*fres*smoothstep(.25,0.,abs(ndl))*.5;
        gl_FragColor=vec4(col,1.);
      }`,
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), surf);
  planet.rotation.set(0.4, 1.2, 0.2); planet.renderOrder = 3;
  const atmo = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, vertexShader: vs,
    fragmentShader: /* glsl */`varying vec3 vN; varying vec3 vW; uniform vec3 uSun;
      void main(){ vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vW);
        float d=clamp(-dot(N,V)/.39,0.,1.); float halo=pow(d,3.2);
        float lit=smoothstep(-.35,.45,dot(N,uSun));
        vec3 c=mix(vec3(1.,.4,.15), vec3(.22,.5,1.), smoothstep(-.1,.4,dot(N,uSun)));
        gl_FragColor=vec4(c*halo*lit*.6,1.); }`,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R * 1.085, 96, 64), atmo); shell.renderOrder = 2;
  group.add(shell, planet);

  const moonMat = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false, vertexShader: vs,
    fragmentShader: NOISE + /* glsl */`varying vec3 vObj; varying vec3 vN; uniform vec3 uSun;
      void main(){ float h=fbm(vObj*5.); float cr=smoothstep(.55,.6,noise(vObj*9.))*.25;
        vec3 a=mix(vec3(.2,.19,.18), vec3(.5,.47,.43), h)-cr*.3;
        vec3 n=normalize(vN+ (vec3(noise(vObj*30.),noise(vObj*30.+7.),noise(vObj*30.+13.))-.5)*.5);
        gl_FragColor=vec4(a*max(dot(n,uSun),0.)*2.6,1.); }`,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3400, 48, 32), moonMat);
  moon.position.set(52000, 9000, 30000); moon.renderOrder = 3;
  return { group, moon, uniforms, planet };
}

function makeSun(glowTex) {
  const g = new THREE.Group();
  g.position.copy(SUN_DIR).multiplyScalar(80000);
  const mk = (sx, sy, color, tex) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true }));
    s.scale.set(sx, sy, 1); s.renderOrder = 4; g.add(s); return s;
  };
  mk(7000, 7000, new THREE.Color(40, 32, 20), glowTex);
  mk(36000, 36000, new THREE.Color(0.5, 0.34, 0.2), glowTex);
  mk(120000, 1100, new THREE.Color(0.5, 0.8, 1.5), glowTex);
  return g;
}

// ---- asteroids -------------------------------------------------------------
function h3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let xf = x - xi, yf = y - yi, zf = z - zi;
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), xf), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), xf), yf),
    l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), xf), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), xf), yf), zf);
}
function rockGeometry(seed, detail) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position, v = new THREE.Vector3();
  const sx = 0.75 + h3(seed, 1, 2) * 0.5, sy = 0.6 + h3(seed, 3, 4) * 0.45, sz = 0.75 + h3(seed, 5, 6) * 0.5;
  const col = new Float32Array(p.count * 3), o = seed * 17.3;
  const n3 = (f, k) => vnoise(v.x * f + o + k, v.y * f + k, v.z * f - k);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const big = n3(1.3, 0) * 0.55 + n3(2.9, 3) * 0.25;
    const fine = n3(6.5, 7) * 0.1 + n3(14, 11) * 0.045 + n3(31, 5) * 0.02;
    const ridge = (1 - Math.abs(n3(3.4, 20) * 2 - 1)) * 0.07;
    const crater = Math.max(0, n3(2.2, 40) - 0.6) * 0.95;
    const r = 0.6 + big * 0.75 + fine + ridge - crater;
    const shade = 0.5 + fine * 3.2 + ridge * 2 - crater * 1.4 + n3(1.1, 60) * 0.35;
    col[i * 3] = shade * 1.04; col[i * 3 + 1] = shade * 0.97; col[i * 3 + 2] = shade * (0.86 + n3(2, 80) * 0.14);
    p.setXYZ(i, v.x * r * sx, v.y * r * sy, v.z * r * sz);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function makeAsteroids(scene, keepOut) {
  const rnd = mulberry32(42);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d8277, roughness: 0.96, metalness: 0.04, vertexColors: true });
  const variants = [rockGeometry(1, 11), rockGeometry(2, 11), rockGeometry(3, 11), rockGeometry(4, 5)];
  const COUNT = 380, per = Math.ceil(COUNT / variants.length);
  const meshes = variants.map((g) => { const m = new THREE.InstancedMesh(g, mat, per); m.count = 0; m.frustumCulled = false; scene.add(m); return m; });
  const list = [];
  let guard = 0;
  while (list.length < COUNT && guard++ < 20000) {
    const a = rnd() * Math.PI * 2, rr = 500 + Math.pow(rnd(), 0.7) * 5200;
    const pos = new THREE.Vector3(Math.cos(a) * rr, (rnd() + rnd() + rnd() - 1.5) * 620, Math.sin(a) * rr);
    const big = rnd();
    const radius = big > 0.94 ? 110 + rnd() * 120 : big > 0.6 ? 30 + rnd() * 55 : 7 + rnd() * 22;
    if (keepOut.some((k) => pos.distanceTo(k.pos) < k.r + radius)) continue;
    if (list.some((o) => o.pos.distanceTo(pos) < o.r + radius + 20)) continue;
    const vi = radius < 16 ? 3 : list.length % 3;
    const mesh = meshes[vi];
    if (mesh.count >= per) continue;
    list.push({
      pos, r: radius * 0.9, scale: radius, mesh, index: mesh.count++,
      axis: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), spin: (rnd() - 0.5) * 0.25 * (30 / (radius + 20)),
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)),
    });
  }
  const m4 = new THREE.Matrix4(), dq = new THREE.Quaternion(), sc = new THREE.Vector3();
  const update = (dt) => {
    for (const o of list) {
      dq.setFromAxisAngle(o.axis, o.spin * dt); o.quat.premultiply(dq);
      m4.compose(o.pos, o.quat, sc.setScalar(o.scale));
      o.mesh.setMatrixAt(o.index, m4);
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { list, update };
}

function makeDust(scene) {
  const rnd = mulberry32(99), N = 900, B = 700;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) pos[i] = rnd() * B;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3() }, uScale: { value: 600 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform vec3 uCam; uniform float uScale; varying float vA;
      void main(){ vec3 p=mod(position-uCam+${B / 2}.,${B}.)-${B / 2}.; vec4 mv=viewMatrix*vec4(p+uCam,1.); gl_Position=projectionMatrix*mv;
        float d=-mv.z; vA=smoothstep(${B / 2}.,${B / 4}.,length(p))*smoothstep(4.,30.,d); gl_PointSize=clamp(.55*uScale/d,1.,6.); }`,
    fragmentShader: 'varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; gl_FragColor=vec4(vec3(.55,.7,1.)*smoothstep(1.,.2,d)*vA*.55,1.); }',
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p);
  return m;
}

export function createWorld(renderer, scene, bgScene, glowTex, keepOut) {
  const sky = bakeSky(renderer);
  bgScene.background = sky.background;
  scene.environment = sky.environment;
  scene.environmentIntensity = 1.4;
  const stars = makeStars(renderer.getPixelRatio());
  const planet = makePlanet();
  bgScene.add(stars, planet.group, planet.moon, makeSun(glowTex));

  const sun = new THREE.DirectionalLight(0xfff0dc, 3.4); sun.position.copy(SUN_DIR);
  const bounce = new THREE.DirectionalLight(0x4f86ff, 0.55); bounce.position.copy(PLANET_DIR);
  scene.add(sun, bounce, new THREE.AmbientLight(0x1c2738, 0.5));

  const asteroids = makeAsteroids(scene, keepOut);
  const dust = makeDust(scene);
  return {
    asteroids, dust, stars,
    update(dt, time, camera) {
      planet.uniforms.uTime.value = time;
      planet.planet.rotation.y += dt * 0.002;
      asteroids.update(dt);
      dust.uniforms.uCam.value.copy(camera.position);
    },
  };
}
