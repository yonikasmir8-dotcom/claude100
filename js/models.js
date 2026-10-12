// MODELS — sculpted (SDF) high-poly models for every character, boss, pickup and prop.
// Model space: feet on y = 0, facing +X, Z is left/right, 1 unit = 1 tile.
// A spec is { parts: [{ name, prims, pivot, mat, res }], extras: [...], rig, scale, height }.
// Parts named legL/legR/armL/armR/wingL/wingR/tail/head are animated by js/render3d.js.
(() => {
  'use strict';
  const NX = window.NX;
  const { sph, ell, cap, box, tor, cyl } = NX.SDF;
  const P = { op: 'paint' }, SUB = { op: 'sub' };
  const paint = (o) => Object.assign({ op: 'paint' }, o);
  const sub = (o) => Object.assign({ op: 'sub' }, o);
  const M = { mirror: true };
  const pm = (o) => Object.assign({ op: 'paint', mirror: true }, o);

  const DEFS = NX.MODEL_DEFS = {};
  const def = (key, fn) => { DEFS[key] = fn; };

  // ---------- Humanoid generator ----------
  // o: { skin, suit, pants, boots, gloves, sleeves, head, hair, eyes, visor, robe, cape, hood, wings, tail,
  //      horns, ears, crown, belt, emblem, pads, build, mat, headMat, glowEyes, glowVisor, prop, propColor, scale }
  function humanoid(o) {
    const bw = { normal: 1, bulky: 1.28, slim: 0.84, puffy: 1.35 }[o.build || 'normal'];
    const skin = o.skin || '#f0c8a0', suit = o.suit || '#4a6ad0', pants = o.pants || suit, boots = o.boots || '#2a2a33';
    const sleeves = o.sleeves || suit, hands = o.gloves || skin;
    const torso = [
      ell([0, 0.6, 0], [0.16 * bw, 0.13, 0.2 * bw], pants),
      ell([0, 0.83, 0], [0.19 * bw, 0.25, 0.25 * bw], suit, { k: 0.1 }),
      cap([0, 0.95, 0], [0.01, 1.06, 0], 0.075, o.neck || skin, { k: 0.05 }),
    ];
    if (o.build === 'puffy') torso.push(sph([0.05, 0.78, 0], 0.3, suit, { k: 0.12 }), sph([0, 1.0, 0], 0.24, suit, { k: 0.1 }));
    if (o.belt) torso.push(box([0, 0.66, 0], [0.3, 0.03, 0.3], 0, o.belt, P));
    if (o.emblem) torso.push(ell([0.2 * bw, 0.86, 0], [0.04, 0.06, 0.06], o.emblem, P));
    if (o.chest) torso.push(ell([0.08, 0.86, 0], [0.16 * bw, 0.18, 0.23 * bw], o.chest, { k: 0.03 }));
    if (o.pads) torso.push(ell([0, 1.0, 0.27 * bw], [0.13, 0.08, 0.12], o.pads, { mirror: true, k: 0.04 }));
    if (o.cape) torso.push(box([-0.22 * bw, 0.66, 0], [0.025, 0.42, 0.26 * bw], 0.02, o.cape, { k: 0.02, rot: [0, 0, -0.1] }));
    if (o.pack) torso.push(ell([-0.24, 0.85, 0], [0.12, 0.22, 0.18], o.pack, { k: 0.04 }));
    if (o.robe) torso.push(cap([0, 0.95, 0], [0, 0.05, 0], [0.18 * bw, 0.34 * bw], o.robe, { k: 0.08 }));
    torso.push(...head(o, skin));

    const parts = [{ name: 'torso', prims: torso, pivot: [0, 0, 0], mat: o.mat || 'skin', res: 0.02 }];
    if (!o.robe) for (const s of [1, -1]) parts.push({
      name: s > 0 ? 'legL' : 'legR', pivot: [0, 0.55, 0.11 * s * bw], mat: o.mat || 'skin', res: 0.022,
      prims: [cap([0, 0.56, 0.11 * s * bw], [0.01, 0.16, 0.12 * s * bw], [0.09, 0.075], pants), ell([0.05, 0.09, 0.12 * s * bw], [0.13, 0.085, 0.095], boots, { k: 0.05 })],
    });
    for (const s of [1, -1]) parts.push({
      name: s > 0 ? 'armL' : 'armR', pivot: [0, 0.98, 0.27 * s * bw], mat: o.mat || 'skin', res: 0.02,
      prims: [cap([0, 0.98, 0.26 * s * bw], [0.04, 0.72, 0.31 * s * bw], [0.075 * bw, 0.065 * bw], sleeves),
        sph([0.06, 0.63, 0.32 * s * bw], 0.072 * bw, hands, { k: 0.04 })],
    });
    if (o.wings) for (const s of [1, -1]) parts.push({
      name: s > 0 ? 'wingL' : 'wingR', pivot: [-0.2, 0.95, 0.12 * s], mat: 'skin', res: 0.025,
      prims: [ell([-0.32, 1.12, 0.42 * s], [0.06, 0.34, 0.36], o.wings, { rot: [0.7 * s, 0, 0.3] }),
        cap([-0.2, 0.95, 0.12 * s], [-0.36, 1.4, 0.6 * s], [0.04, 0.015], o.wingBone || o.wings, { k: 0.03 })],
    });
    if (o.tail) parts.push({ name: 'tail', pivot: [-0.15, 0.6, 0], mat: 'skin', res: 0.022, prims: [cap([-0.15, 0.6, 0], [-0.45, 0.35, 0], [0.08, 0.05], o.tail), cap([-0.45, 0.35, 0], [-0.7, 0.45, 0], [0.05, 0.03], o.tail, { k: 0.04 })] });
    const extras = [];
    if (o.glowEyes) extras.push({ to: 'torso', glow: o.glowEyes, kind: 'eyes', at: o.head === 'hood' ? [0.17, 1.2, 0.06] : [0.2, 1.22, 0.075] });
    if (o.glowVisor) extras.push({ to: 'torso', glow: o.glowVisor, kind: 'visor', at: [0.2, 1.22, 0] });
    if (o.prop) extras.push({ to: 'armR', kind: 'prop', prop: o.prop, color: o.propColor, at: [0.07, 0.6, -0.33 * bw] });
    if (o.aura) extras.push({ to: 'root', kind: 'aura', glow: o.aura });
    return { parts, extras, rig: o.robe ? 'robe' : 'biped', scale: o.scale || 1, height: 1.45 };
  }

  function head(o, skin) {
    const hc = o.headCol || skin, out = [];
    const eyes = (col = '#1a1a22', y = 1.22, spread = 0.08) => [ell([0.205, y, spread], [0.025, 0.045, 0.032], col, pm({}))];
    switch (o.head) {
      case 'trooper':
        out.push(sph([0.02, 1.2, 0], 0.22, '#f4f4f4'), sph([-0.01, 1.15, 0.19], 0.07, '#f4f4f4', M), ell([0.14, 1.09, 0], [0.09, 0.07, 0.11], '#f4f4f4', { k: 0.05 }),
          box([0.2, 1.23, 0], [0.06, 0.035, 0.15], 0.01, '#111', P), box([0.21, 1.14, 0], [0.06, 0.06, 0.035], 0.01, '#222', P), box([0.2, 1.08, 0], [0.05, 0.02, 0.09], 0, '#555', P));
        break;
      case 'darklord':
        out.push(sph([0.02, 1.22, 0], 0.22, '#111'), cap([0, 1.14, 0], [-0.02, 0.98, 0], [0.24, 0.3], '#151515', { k: 0.03 }),
          box([0.21, 1.12, 0], [0.06, 0.08, 0.07], 0.01, '#3a3a3a', P), ell([0.2, 1.22, 0.075], [0.03, 0.04, 0.05], '#252525', pm({})));
        break;
      case 'hood':
        out.push(ell([0, 1.2, 0], [0.26, 0.3, 0.27], o.hood || '#111'), cap([0.02, 1.4, 0], [-0.12, 1.55, 0], [0.12, 0.02], o.hood || '#111', { k: 0.06 }),
          ell([0.21, 1.17, 0], [0.15, 0.17, 0.15], '#040404', sub({ k: 0.03 })));
        break;
      case 'skull':
        out.push(sph([0.02, 1.21, 0], 0.21, '#e8e4d8'), ell([0.1, 1.08, 0], [0.12, 0.07, 0.13], '#e8e4d8', { k: 0.05 }),
          sph([0.2, 1.24, 0.075], 0.05, '#111', sub({ k: 0.01, mirror: true })), cap([0.22, 1.15, 0], [0.24, 1.12, 0], 0.02, '#111', sub({ k: 0.01 })),
          box([0.19, 1.05, 0], [0.04, 0.012, 0.07], 0, '#333', P));
        break;
      case 'boar':
        out.push(sph([0.02, 1.2, 0], 0.22, hc), ell([0.22, 1.13, 0], [0.11, 0.085, 0.1], o.snout || '#d89a8a', { k: 0.05 }),
          sph([0.33, 1.13, 0.035], 0.02, '#2a1a1a', sub({ mirror: true, k: 0.01 })),
          cap([0.24, 1.06, 0.07], [0.3, 1.2, 0.1], [0.025, 0.008], '#f2ead0', { mirror: true, k: 0.01 }),
          ell([-0.02, 1.38, 0.15], [0.05, 0.11, 0.07], hc, { mirror: true, rot: [0.5, 0, 0] }), ...eyes(o.eyes || '#ff2a2a', 1.26, 0.09));
        break;
      case 'alien':
        out.push(ell([-0.03, 1.2, 0], [0.3, 0.17, 0.17], hc), cap([0.15, 1.08, 0.06], [0.3, 1.02, 0.09], [0.04, 0.015], hc, { mirror: true, k: 0.03 }),
          ...eyes(o.eyes || '#ffd23f', 1.25, 0.09));
        break;
      case 'petal': {
        out.push(cap([0, 1.0, 0], [0.06, 1.12, 0], 0.07, hc));
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2;
          out.push(ell([0.14, 1.22 + Math.sin(a) * 0.15, Math.cos(a) * 0.15], [0.035, 0.15, 0.08], o.petals || '#a24a4a', { rot: [a - Math.PI / 2, 0, -0.5], k: 0.03 }));
        }
        out.push(sph([0.1, 1.22, 0], 0.08, '#5a0a14', { k: 0.03 }));
        break;
      }
      case 'dome':
        out.push(sph([0.02, 1.21, 0], 0.21, hc), tor([0, 1.24, 0.21], 0.07, 0.022, hc, { ax: 'z', mirror: true }),
          ell([0.2, 1.23, 0.075], [0.03, 0.035, 0.03], '#111', sub({ mirror: true, k: 0.01 })), box([0.21, 1.1, 0], [0.03, 0.012, 0.06], 0, '#111', P));
        break;
      case 'grunt':
        out.push(sph([0.02, 1.16, 0], 0.2, hc), cap([0.15, 1.1, 0], [0.33, 1.06, 0], [0.09, 0.06], o.mask || '#4a6a8a', { k: 0.04 }), ...eyes(o.eyes || '#ffb03a', 1.22, 0.1));
        break;
      case 'lich':   // gaunt, long face with deep eye sockets (pair with glowEyes)
        out.push(ell([0.03, 1.21, 0], [0.18, 0.22, 0.165], hc), ell([0.1, 1.06, 0], [0.1, 0.08, 0.09], hc, { k: 0.06 }),
          sph([0.17, 1.23, 0.072], 0.048, '#140004', sub({ k: 0.015, mirror: true })), ell([0.16, 1.12, 0.1], [0.05, 0.05, 0.04], hc, sub({ mirror: true, k: 0.03 })),
          box([0.2, 1.16, 0], [0.02, 0.035, 0.012], 0, '#3a3430', P), box([0.19, 1.06, 0], [0.03, 0.008, 0.05], 0, '#2a2420', P));
        if (o.beard) out.push(cap([0.12, 1.02, 0], [0.16, 0.82, 0], [0.07, 0.015], o.beard, { k: 0.05 }));
        break;
      default:
        out.push(sph([0.02, 1.2, 0], 0.22, hc, { mat: o.headMat }));
        if (o.hair) out.push(ell([-0.03, 1.3, 0], [0.22, 0.14, 0.235], o.hair, { k: 0.03 }), ell([0.13, 1.33, 0], [0.09, 0.06, 0.18], o.hair, { k: 0.04 }));
        if (o.cap) out.push(ell([0, 1.33, 0], [0.23, 0.11, 0.24], o.cap, { k: 0.02 }), ell([0.18, 1.3, 0], [0.12, 0.02, 0.15], o.cap, { k: 0.02 }));
        if (o.visor) out.push(box([0.17, 1.22, 0], [0.07, 0.05, 0.17], 0.03, o.visor, P));
        else out.push(...eyes(o.eyes));
        if (o.mouth) out.push(box([0.21, 1.1, 0], [0.03, 0.014, 0.06], 0, o.mouth, P));
        if (o.beard) out.push(ell([0.12, 1.06, 0], [0.12, 0.1, 0.16], o.beard, { k: 0.05 }));
        if (o.stache) out.push(cap([0.23, 1.13, 0], [0.2, 1.11, 0.16], [0.04, 0.02], o.stache, { mirror: true, k: 0.03 }));
        if (o.ridges) for (let i = 0; i < 3; i++) out.push(cap([0.12 - i * 0.07, 1.34, -0.1], [0.12 - i * 0.07, 1.34, 0.1], 0.025, hc, { k: 0.02 }));
    }
    if (o.ears) out.push(ell([0.0, 1.22, 0.21], [0.05, 0.08, 0.04], o.ears, { mirror: true, k: 0.03 }));
    if (o.horns) out.push(cap([0, 1.32, 0.14], [-0.08, 1.55, 0.28], [0.05, 0.012], o.horns, { mirror: true, k: 0.03 }));
    if (o.crown) for (let i = -2; i <= 2; i++) out.push(cap([0.02 + Math.cos(i * 0.6) * 0.17, 1.36, Math.sin(i * 0.6) * 0.17], [0.03 + Math.cos(i * 0.6) * 0.2, 1.5, Math.sin(i * 0.6) * 0.2], [0.03, 0.008], o.crown, { k: 0.02 }));
    if (o.helm) out.push(ell([0, 1.27, 0], [0.235, 0.17, 0.24], o.helm, { k: 0.02 }));
    return out;
  }

  // ---------- Humanoid roster ----------
  const H = {
    player: (c) => humanoid({ suit: c, pants: '#2a2a3a', skin: '#f0c8a0', hair: '#3a2a20', visor: '#0d1a2a', glowVisor: '#4ff3ff', belt: '#1a1a22', gloves: '#2a2a3a' }),
    stormtrooper: () => humanoid({ suit: '#f4f4f4', pants: '#f0f0f0', boots: '#f4f4f4', gloves: '#222', head: 'trooper', belt: '#333', mat: 'gloss', chest: '#f8f8f8', prop: 'blaster' }),
    tusken: () => humanoid({ suit: '#c8a878', robe: '#b89868', skin: '#d8c09a', head: 'hood', hood: '#c8b088', glowEyes: '#3a2a1a', prop: 'gaffi', gloves: '#8a6a4a' }),
    moblin: () => humanoid({ suit: '#7a4a2a', skin: '#c07a5a', head: 'boar', build: 'bulky', prop: 'spear', belt: '#3a2a1a', scale: 1.1 }),
    zombie: () => humanoid({ suit: '#2f8fae', pants: '#3a3aa0', skin: '#4fae4a', eyes: '#111', boots: '#555' }),
    skeleton: () => humanoid({ suit: '#d8d4c8', pants: '#d0ccc0', skin: '#e8e4d8', head: 'skull', build: 'slim', boots: '#ccc', prop: 'bow' }),
    marshmallow: () => humanoid({ suit: '#ffffff', pants: '#ffffff', skin: '#fffaf2', build: 'puffy', eyes: '#222', mouth: '#222', cap: '#f2f2f2', emblem: '#e23636', boots: '#f4f4f4', gloves: '#fff' }),
    program: () => humanoid({ suit: '#0a1a24', pants: '#0a1a24', skin: '#0f2633', head: 'default', helm: '#0a1a24', visor: '#18e0ff', glowVisor: '#18e0ff', mat: 'gloss', boots: '#0a1a24', gloves: '#18e0ff', aura: null }),
    agent: () => humanoid({ suit: '#1a1a1a', pants: '#111', skin: '#e8c4a0', hair: '#2a2018', visor: '#050505', boots: '#0a0a0a', prop: 'pistol' }),
    chitauri: () => humanoid({ suit: '#5a5a4a', pants: '#4a4a3a', skin: '#8a8a7a', head: 'alien', glowEyes: '#5fffd0', pads: '#6a6a5a', mat: 'metal', prop: 'rifle', propColor: '#5fffd0' }),
    ultron: () => humanoid({ suit: '#b8bcc4', pants: '#a8acb4', skin: '#c8ccd4', head: 'dome', headCol: '#c8ccd4', mat: 'metal', glowEyes: '#ff3030', chest: '#c0c4cc', boots: '#9a9ea6', gloves: '#c8ccd4' }),
    hydra: () => humanoid({ suit: '#222', pants: '#1a1a1a', skin: '#e0c0a0', cap: '#1a1a1a', visor: '#111', emblem: '#e23636', pads: '#2a2a2a', prop: 'rifle' }),
    goon: () => humanoid({ suit: '#7a3aa8', pants: '#3a2a4a', skin: '#f6f6f2', hair: '#3aa83a', eyes: '#111', mouth: '#e02a2a', prop: 'bat' }),
    parademon: () => humanoid({ suit: '#5a5a3a', pants: '#4a4a2a', skin: '#6a6a4a', head: 'alien', headCol: '#5a5a3a', glowEyes: '#ffd23f', wings: '#3a3a2a', mat: 'skin' }),
    deatheater: () => humanoid({ suit: '#0f0f0f', robe: '#0a0a0a', head: 'hood', hood: '#121212', skin: '#ddd', prop: 'wand', propColor: '#d8ccb0', glowEyes: '#c8c8c8' }),
    orc: () => humanoid({ suit: '#4a3a2a', pants: '#3a2a1a', skin: '#6a7a4a', head: 'default', eyes: '#ff3030', build: 'bulky', pads: '#555', prop: 'scimitar', mouth: '#2a1a0a' }),
    uruk: () => humanoid({ suit: '#222', pants: '#1a1a1a', skin: '#5a4a3a', helm: '#333', eyes: '#ff3030', emblem: '#f2f2f2', build: 'bulky', prop: 'bow' }),
    nazgul: () => humanoid({ suit: '#080808', robe: '#060606', head: 'hood', hood: '#0a0a0a', glowEyes: '#9ab', prop: 'sword', scale: 1.1 }),
    grunt: () => humanoid({ suit: '#6a5aa8', pants: '#4a3a2a', skin: '#8a7a6a', head: 'grunt', pack: '#ff9a2a', build: 'bulky', scale: 0.8, prop: 'plasma', propColor: '#7affb0' }),
    elite: () => humanoid({ suit: '#3a4aa8', pants: '#2a3a8a', skin: '#5a5a6a', head: 'alien', pads: '#4a5ab8', mat: 'gloss', build: 'slim', scale: 1.15, prop: 'plasma', propColor: '#5fa0ff' }),
    borg: () => humanoid({ suit: '#2a2a2a', pants: '#1a1a1a', skin: '#c8c4bc', head: 'default', eyes: '#111', glowEyes: '#ff2020', pads: '#3a3a3a', mat: 'metal', chest: '#333' }),
    klingon: () => humanoid({ suit: '#4a3a2a', pants: '#2a2a2a', skin: '#a87a5a', hair: '#1a1008', ridges: true, beard: '#1a1008', belt: '#d8b040', prop: 'batleth', build: 'bulky' }),
    cyberman: () => humanoid({ suit: '#b8bcc4', pants: '#b0b4bc', skin: '#d0d4dc', head: 'dome', headCol: '#d0d4dc', mat: 'metal', chest: '#c8ccd4', boots: '#a8acb4', gloves: '#c0c4cc' }),
    angel: () => humanoid({ suit: '#9a9a94', robe: '#8f8f89', skin: '#a8a8a2', hair: '#8a8a84', eyes: '#6a6a64', wings: '#b0b0aa', mat: 'stone' }),
    saibaman: () => humanoid({ suit: '#3a8a3a', pants: '#2a6a2a', skin: '#4aa04a', head: 'default', headCol: '#4aa04a', eyes: '#ff3030', scale: 0.75, ridges: true }),
    friezasoldier: () => humanoid({ suit: '#3a3a5a', pants: '#2a2a3a', skin: '#e8c0a0', hair: '#2a1a10', chest: '#f2ead8', pads: '#e8d8b0', visor: '#2aff6a', glowVisor: '#2aff6a', belt: '#d8c040' }),
    demogorgon: () => humanoid({ suit: '#7a6a6a', pants: '#6a5a5a', skin: '#7a6a6a', head: 'petal', petals: '#b85a5a', build: 'slim', scale: 1.2 }),
    sixer: () => humanoid({ suit: '#6a6f7a', pants: '#4a4f5a', skin: '#8a8f9a', helm: '#5a5f6a', visor: '#ff9b3d', glowVisor: '#ff9b3d', emblem: '#ff9b3d', mat: 'gloss', prop: 'rifle', propColor: '#ff9b3d' }),
    // bosses & NPCs
    darklord: () => humanoid({ suit: '#111', pants: '#0a0a0a', head: 'darklord', cape: '#050505', chest: '#1a1a1a', belt: '#888', mat: 'gloss', prop: 'saber', propColor: '#ff2a2a', gloves: '#111', boots: '#111' }),
    ganon: () => humanoid({ suit: '#2a1a3a', pants: '#1a1028', skin: '#3a7a3a', head: 'boar', snout: '#4a8a4a', eyes: '#ffd23f', pads: '#5a4a6a', cape: '#5a1a1a', build: 'bulky', prop: 'trident' }),
    mewtwo: () => humanoid({ suit: '#d8c8e0', pants: '#a888c0', skin: '#e0d0e8', eyes: '#7a2ad0', ears: '#e0d0e8', tail: '#a888c0', build: 'slim', aura: '#c070ff' }),
    staypuft: () => humanoid({ suit: '#ffffff', pants: '#ffffff', skin: '#fffaf2', build: 'puffy', eyes: '#222', mouth: '#222', cap: '#f2f2f2', emblem: '#e23636', boots: '#f4f4f4', gloves: '#fff' }),
    smith: () => humanoid({ suit: '#141414', pants: '#111', skin: '#e8c4a0', hair: '#3a2a18', visor: '#050505', prop: 'pistol', aura: '#3aff6a' }),
    thanos: () => humanoid({ suit: '#2a3aa8', pants: '#d8b040', skin: '#9a6ad0', head: 'default', eyes: '#2a1a3a', ridges: true, pads: '#d8b040', chest: '#d8b040', gloves: '#9a6ad0', build: 'bulky', aura: '#c070ff', prop: 'gauntlet' }),
    darkseid: () => humanoid({ suit: '#2a2a3a', pants: '#1a1a2a', skin: '#6a6a6a', head: 'default', eyes: '#ff3a1a', glowEyes: '#ff3a1a', ridges: true, belt: '#3a5aa8', build: 'bulky', aura: '#ff3a1a', mat: 'stone' }),
    voldemort: () => humanoid({ suit: '#0a0a0a', robe: '#060606', skin: '#e8e8e0', eyes: '#ff3030', glowEyes: '#ff3030', build: 'slim', prop: 'wand', propColor: '#f2ead0' }),
    balrog: () => humanoid({ suit: '#2a0f08', pants: '#1a0a05', skin: '#2a0a05', head: 'default', eyes: '#ffb03a', glowEyes: '#ffb03a', horns: '#120604', wings: '#140804', build: 'bulky', aura: '#ff6a1a', prop: 'whip' }),
    zealot: () => humanoid({ suit: '#d8b040', pants: '#a88a20', skin: '#5a5a6a', head: 'alien', pads: '#e8c050', mat: 'metal', build: 'slim', prop: 'esword', propColor: '#7ab0ff' }),
    borgqueen: () => humanoid({ suit: '#1a1a1a', pants: '#0a0a0a', skin: '#d0c8c0', eyes: '#111', crown: '#5a5a5a', mat: 'gloss', build: 'slim', aura: '#5fff5f' }),
    frieza: () => humanoid({ suit: '#f2f2f2', pants: '#e8e8e8', skin: '#f2f2f2', eyes: '#c0302a', tail: '#f2f2f2', chest: '#a03ad0', helm: '#a03ad0', build: 'slim', mat: 'gloss', scale: 0.95 }),
    curator: () => humanoid({ suit: '#5a3a8a', robe: '#3a2a5a', skin: '#d8c0a0', hair: '#e8e8e8', beard: '#e8e8e8', cape: '#2a1a4a', eyes: '#111', prop: 'staff', propColor: '#ffd23f' }),
    shop: () => humanoid({ suit: '#ff4fd8', pants: '#333', skin: '#e8c0a0', hair: '#18e0ff', eyes: '#111', belt: '#18e0ff' }),
    garage: () => humanoid({ suit: '#f2f2f2', pants: '#555', skin: '#f0d0b0', hair: '#f4f4f4', eyes: '#111', belt: '#888', prop: 'wrench' }),
    score: () => humanoid({ suit: '#ffd23f', pants: '#333', skin: '#e0b890', visor: '#ff4fd8', glowVisor: '#ff4fd8' }),
    gunter: (c) => humanoid({ suit: c || '#4a9cff', pants: '#333', skin: '#e0b890', hair: '#5a3a20', visor: '#0d1a2a', glowVisor: '#ffd23f' }),
  };
  for (const k of Object.keys(H)) def(k, H[k]);

  // ---------- Creatures ----------
  def('pikachu', () => ({
    rig: 'hop', height: 0.95, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.016, prims: [
      ell([0, 0.3, 0], [0.24, 0.27, 0.23], '#ffd83a'),
      sph([0.06, 0.66, 0], 0.22, '#ffd83a', { k: 0.12 }),
      cap([0.0, 0.8, 0.1], [-0.05, 1.2, 0.2], [0.065, 0.02], '#ffd83a', { mirror: true, k: 0.03 }),
      cap([-0.03, 1.08, 0.165], [-0.05, 1.2, 0.2], [0.045, 0.02], '#1a1a1a', pm({})),
      cap([0.15, 0.28, 0.13], [0.22, 0.38, 0.17], 0.045, '#ffd83a', { mirror: true }),
      ell([0.06, 0.04, 0.12], [0.1, 0.05, 0.07], '#ffd83a', { mirror: true }),
      sph([0.24, 0.7, 0.085], 0.035, '#1a1a1a', pm({})), sph([0.255, 0.715, 0.075], 0.012, '#ffffff', pm({})),
      sph([0.22, 0.58, 0.15], 0.05, '#ff4a3a', pm({})), sph([0.28, 0.64, 0], 0.012, '#3a1a1a', P),
      ell([-0.12, 0.42, 0], [0.04, 0.05, 0.1], '#c8962a', P),
    ] }, { name: 'tail', pivot: [-0.2, 0.25, 0], res: 0.018, prims: [
      box([-0.3, 0.38, 0], [0.04, 0.12, 0.025], 0.015, '#ffd83a', { rot: [0, 0, 0.5] }),
      box([-0.38, 0.55, 0], [0.12, 0.05, 0.025], 0.015, '#ffd83a', { rot: [0, 0, -0.3] }),
      box([-0.42, 0.72, 0], [0.16, 0.1, 0.025], 0.015, '#ffd83a', { rot: [0, 0, 0.4] }),
      box([-0.24, 0.27, 0], [0.04, 0.05, 0.025], 0.01, '#c8962a', { k: 0.02 }),
    ] }],
  }));
  def('charmander', () => ({
    rig: 'hop', height: 1, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.016, prims: [
      ell([0, 0.33, 0], [0.22, 0.29, 0.21], '#ff8a3a'),
      sph([0.08, 0.72, 0], 0.22, '#ff8a3a', { k: 0.1 }), ell([0.24, 0.66, 0], [0.12, 0.09, 0.13], '#ff8a3a', { k: 0.06 }),
      ell([0.12, 0.3, 0], [0.13, 0.22, 0.15], '#ffe0a0', P),
      cap([0.12, 0.42, 0.16], [0.24, 0.36, 0.19], 0.05, '#ff8a3a', { mirror: true }),
      ell([0.06, 0.05, 0.12], [0.11, 0.06, 0.08], '#ff8a3a', { mirror: true }),
      ell([0.26, 0.78, 0.09], [0.03, 0.05, 0.035], '#1a2a4a', pm({})), sph([0.27, 0.8, 0.085], 0.012, '#fff', pm({})),
    ] }, { name: 'tail', pivot: [-0.18, 0.25, 0], res: 0.018, prims: [cap([-0.18, 0.25, 0], [-0.45, 0.2, 0], [0.08, 0.05], '#ff8a3a'), cap([-0.45, 0.2, 0], [-0.55, 0.4, 0], [0.05, 0.035], '#ff8a3a', { k: 0.03 })] }],
    extras: [{ to: 'tail', kind: 'flame', at: [-0.56, 0.48, 0], glow: '#ff6a1a', size: 0.09 }],
  }));
  def('squirtle', () => ({
    rig: 'hop', height: 0.95, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.016, prims: [
      ell([-0.04, 0.34, 0], [0.24, 0.27, 0.25], '#a0612a'), tor([-0.04, 0.34, 0], 0.24, 0.035, '#f2f2d8', { ax: 'x', k: 0.02 }),
      ell([0.08, 0.33, 0], [0.16, 0.22, 0.2], '#f2e0a0', { k: 0.03 }),
      sph([0.1, 0.72, 0], 0.21, '#6ab4ff', { k: 0.08 }), ell([0.25, 0.68, 0], [0.1, 0.08, 0.12], '#6ab4ff', { k: 0.06 }),
      cap([0.08, 0.45, 0.2], [0.2, 0.36, 0.24], 0.05, '#6ab4ff', { mirror: true }),
      ell([0.06, 0.06, 0.13], [0.11, 0.06, 0.08], '#6ab4ff', { mirror: true }),
      ell([0.27, 0.78, 0.09], [0.03, 0.05, 0.035], '#5a1a1a', pm({})),
      sph([0.08, 0.36, 0], 0.17, '#c89a50', { op: 'paint', soft: 0.003 }),
    ] }, { name: 'tail', pivot: [-0.25, 0.2, 0], res: 0.018, prims: [tor([-0.36, 0.26, 0], 0.08, 0.04, '#6ab4ff', { ax: 'z' })] }],
  }));
  def('bulbasaur', () => ({
    rig: 'quad', height: 0.95, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.017, prims: [
      ell([0, 0.32, 0], [0.3, 0.2, 0.22], '#5fc8a0'),
      sph([0.3, 0.42, 0], 0.19, '#5fc8a0', { k: 0.1 }), ell([0.42, 0.38, 0], [0.1, 0.08, 0.13], '#5fc8a0', { k: 0.06 }),
      sph([-0.04, 0.6, 0], 0.22, '#2f9a4a', { k: 0.05 }),
      cap([-0.04, 0.82, 0], [-0.04, 0.6, 0], 0.03, '#1f6a2a', sub({ k: 0.02 })),
      ell([0.42, 0.5, 0.1], [0.03, 0.04, 0.035], '#c03030', pm({})),
      sph([0.1, 0.4, 0.15], 0.045, '#2f8a6a', pm({})), sph([-0.12, 0.3, 0.19], 0.04, '#2f8a6a', pm({})),
      ell([0.32, 0.6, 0.12], [0.04, 0.05, 0.03], '#5fc8a0', { mirror: true }),
    ] }, ...quadLegs('#5fc8a0', 0.18, 0.15, 0.08, 0.2)],
  }));
  def('pidgey', () => bird('#b0844f', '#f2dcb0', '#e8a030', 0.9));
  def('goomba', () => ({
    rig: 'waddle', height: 0.85, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.016, prims: [
      ell([0, 0.32, 0], [0.2, 0.18, 0.2], '#f2d2a0'),
      ell([0, 0.52, 0], [0.34, 0.24, 0.34], '#9a5a2a', { k: 0.05 }),
      ell([0.2, 0.48, 0.09], [0.05, 0.075, 0.045], '#fafafa', pm({ soft: 0.004 })), ell([0.23, 0.47, 0.085], [0.025, 0.045, 0.03], '#111', pm({ soft: 0.003 })),
      box([0.25, 0.58, 0.09], [0.04, 0.012, 0.06], 0.005, '#2a1a10', pm({ rot: [0.4, 0, 0] })),
      box([0.3, 0.33, 0], [0.03, 0.01, 0.08], 0.005, '#2a1a10', P),
    ] }, { name: 'legL', pivot: [0, 0.15, 0.1], res: 0.018, prims: [ell([0.04, 0.07, 0.11], [0.12, 0.07, 0.09], '#2a1a10')] },
    { name: 'legR', pivot: [0, 0.15, -0.1], res: 0.018, prims: [ell([0.04, 0.07, -0.11], [0.12, 0.07, 0.09], '#2a1a10')] }],
  }));
  def('koopa', () => koopa(false));
  def('bowser', () => koopa(true));
  def('piranha', () => ({
    rig: 'sway', height: 1.2, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.018, prims: [
      cap([0, 0, 0], [0, 0.6, 0], 0.05, '#2a9a3a'),
      ell([0.1, 0.18, 0.12], [0.16, 0.03, 0.08], '#3cbc4c', { mirror: true, rot: [0.4, 0.5, 0] }),
      ell([0.02, 0.15, 0], [0.18, 0.06, 0.18], '#1f8a2f', { k: 0.03 }),
    ] }, { name: 'head', pivot: [0, 0.6, 0], res: 0.016, prims: [
      sph([0.08, 0.82, 0], 0.27, '#e0302a'),
      box([0.3, 0.82, 0], [0.22, 0.04, 0.3], 0.02, '#fff', sub({ k: 0.03 })),
      tor([0.1, 0.82, 0], 0.24, 0.025, '#f8f4e8', { ax: 'y', k: 0.02 }),
      sph([0.0, 1.02, 0.12], 0.05, '#fff', pm({})), sph([-0.12, 0.9, 0.2], 0.045, '#fff', pm({})), sph([0.15, 1.0, -0.1], 0.04, '#fff', pm({})),
    ] }],
  }));
  def('octorok', () => ({
    rig: 'waddle', height: 0.8, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.016, prims: [
      sph([0, 0.42, 0], 0.28, '#d83a3a'),
      cap([0.2, 0.4, 0], [0.38, 0.4, 0], [0.1, 0.11], '#d83a3a', { k: 0.05 }),
      cyl([0.39, 0.4, 0], 0.07, 0.05, '#4a1010', sub({ rot: [0, 0, Math.PI / 2], k: 0.01 })),
      ell([0.18, 0.55, 0.13], [0.06, 0.07, 0.05], '#fff', pm({})), ell([0.22, 0.56, 0.13], [0.03, 0.04, 0.03], '#111', pm({})),
    ] }, ...[0, 1, 2, 3].map((i) => {
      const a = i * Math.PI / 2 + Math.PI / 4;
      return { name: 'leg' + i, pivot: [Math.cos(a) * 0.15, 0.2, Math.sin(a) * 0.15], res: 0.02, prims: [cap([Math.cos(a) * 0.15, 0.2, Math.sin(a) * 0.15], [Math.cos(a) * 0.25, 0.03, Math.sin(a) * 0.25], [0.07, 0.05], '#b02a2a')] };
    })],
  }));
  def('keese', () => bat('#2a1a3a', '#ff3030', 0.75));
  def('enderdragon', () => dragon());
  for (const [k, c] of [['blinky', '#ff2020'], ['pinky', '#ffb8ff'], ['inky', '#00ffff'], ['clyde', '#ffb852'], ['bigghost', '#ff2020']]) def(k, () => pacGhost(c));
  def('creeper', () => ({
    rig: 'quadStiff', height: 1.3, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.02, prims: [
      box([0, 0.7, 0], [0.14, 0.32, 0.17], 0.03, '#4fae4a'),
      box([0, 1.15, 0], [0.19, 0.19, 0.19], 0.03, '#5abf55', { k: 0.01 }),
      box([0.19, 1.2, 0.07], [0.02, 0.04, 0.04], 0, '#111', pm({ soft: 0.002 })), box([0.19, 1.09, 0], [0.02, 0.04, 0.035], 0, '#111', P),
      box([0.19, 1.04, 0.05], [0.02, 0.05, 0.025], 0, '#111', pm({ soft: 0.002 })),
      box([0.0, 0.8, 0.17], [0.08, 0.06, 0.01], 0, '#3a8a36', pm({})), box([0.0, 0.55, -0.17], [0.06, 0.05, 0.01], 0, '#6ac865', P),
    ] }, ...[[0.1, 0.1], [0.1, -0.1], [-0.1, 0.1], [-0.1, -0.1]].map(([x, z], i) => ({ name: 'leg' + i, pivot: [x, 0.38, z], res: 0.02, prims: [box([x, 0.19, z], [0.08, 0.19, 0.08], 0.02, '#3a8a36')] }))],
  }));
  def('slimer', () => ({
    rig: 'float', height: 1.0, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'ghost', res: 0.02, prims: [
      ell([0, 0.55, 0], [0.32, 0.3, 0.3], '#8fe04a'),
      ell([-0.2, 0.3, 0], [0.18, 0.18, 0.18], '#8fe04a', { k: 0.15 }), cap([-0.25, 0.28, 0], [-0.45, 0.15, 0], [0.12, 0.03], '#8fe04a', { k: 0.1 }),
      cap([0.05, 0.5, 0.28], [0.25, 0.4, 0.38], [0.06, 0.05], '#8fe04a', { mirror: true }),
      ell([0.28, 0.5, 0], [0.1, 0.12, 0.18], '#3a6a1a', sub({ k: 0.03 })),
      ell([0.22, 0.72, 0.1], [0.06, 0.07, 0.06], '#fff', pm({})), sph([0.27, 0.73, 0.1], 0.025, '#111', pm({})),
    ] }],
  }));
  def('libraryghost', () => robeGhost('#d8e8ff', '#e8f0ff', null));
  def('dementor', () => robeGhost('#0a0a10', '#050508', '#9ab0ff'));
  def('acromantula', () => spider('#2a2420', '#ff3030', 1));
  def('mindflayer', () => spider('#140a10', '#ff3a5a', 1, true));
  def('raptor', () => dino({ body: '#8a7a4a', stripe: '#5a4a2a', belly: '#c8b88a' }, 'raptor'));
  def('dilophosaurus', () => dino({ body: '#6a9a3a', stripe: '#3a5a2a', belly: '#d8e0a0', frill: '#ff7a3a' }, 'dilo'));
  def('compy', () => dino({ body: '#9ab04a', stripe: '#6a8a3a', belly: '#e0e8b0' }, 'compy'));
  def('trex', () => dino({ body: '#6a5a3a', stripe: '#4a3a2a', belly: '#a89a7a' }, 'trex'));
  def('godzilla', () => dino({ body: '#3a463a', stripe: '#2a342a', belly: '#4a564a', spines: '#9adfff' }, 'godzilla'));
  def('flood', () => ({
    rig: 'float', height: 0.6, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.016, prims: [
      sph([0, 0.32, 0], 0.17, '#d8c08a'), ell([0.05, 0.45, 0], [0.12, 0.08, 0.12], '#c8a87a', { k: 0.05 }),
      ...[0, 1, 2, 3, 4, 5].map((i) => { const a = i / 6 * Math.PI * 2; return cap([Math.cos(a) * 0.1, 0.25, Math.sin(a) * 0.1], [Math.cos(a) * 0.32, 0.05, Math.sin(a) * 0.32], [0.04, 0.015], '#a89060', { k: 0.03 }); }),
      sph([0.1, 0.48, 0.05], 0.03, '#6a8a3a', P),
    ] }],
  }));
  def('dalek', () => dalek(false));
  def('dalekemperor', () => dalek(true));
  def('motobug', () => ({
    rig: 'roll', height: 0.75, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.016, prims: [
      ell([0, 0.4, 0], [0.3, 0.24, 0.24], '#e8302a'),
      sph([0.08, 0.55, 0.12], 0.06, '#111', pm({})), sph([-0.1, 0.5, -0.14], 0.06, '#111', pm({})), sph([-0.12, 0.6, 0.06], 0.05, '#111', P),
      sph([0.3, 0.42, 0], 0.13, '#3a5aa8', { k: 0.04 }), sph([0.4, 0.46, 0.05], 0.035, '#fff', pm({})),
      cap([0.36, 0.52, 0.05], [0.42, 0.7, 0.1], 0.015, '#666', { mirror: true }),
    ] }, { name: 'wheel', pivot: [0, 0.12, 0], res: 0.016, prims: [tor([0, 0.12, 0], 0.08, 0.04, '#333', { ax: 'z' })] }],
  }));
  def('buzzbomber', () => ({
    rig: 'fly', height: 0.6, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.016, prims: [
      ell([0, 0.4, 0], [0.32, 0.12, 0.12], '#3a5aa8'),
      box([0.05, 0.4, 0], [0.04, 0.13, 0.13], 0, '#ffd23f', P), box([-0.12, 0.4, 0], [0.04, 0.13, 0.13], 0, '#ffd23f', P),
      sph([0.3, 0.44, 0], 0.1, '#5a7ac8', { k: 0.04 }), sph([0.38, 0.47, 0.04], 0.03, '#ff3030', pm({})),
      cap([-0.25, 0.36, 0], [-0.32, 0.18, 0], [0.04, 0.02], '#aaa', { k: 0.02 }),
    ] }, { name: 'wingL', pivot: [0, 0.5, 0.06], mat: 'ghost', res: 0.02, prims: [ell([-0.02, 0.56, 0.26], [0.12, 0.02, 0.2], '#dff0ff')] },
    { name: 'wingR', pivot: [0, 0.5, -0.06], mat: 'ghost', res: 0.02, prims: [ell([-0.02, 0.56, -0.26], [0.12, 0.02, 0.2], '#dff0ff')] }],
  }));
  def('demodog', () => ({
    rig: 'quad', height: 0.75, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.017, prims: [
      ell([0, 0.42, 0], [0.32, 0.16, 0.14], '#5a4a4a'), ell([-0.1, 0.45, 0], [0.18, 0.12, 0.12], '#4a3a3a', { k: 0.08 }),
      cap([0.25, 0.48, 0], [0.4, 0.55, 0], 0.08, '#5a4a4a', { k: 0.05 }),
      ...[0, 1, 2, 3, 4].map((i) => { const a = i / 5 * Math.PI * 2; return ell([0.48, 0.56 + Math.sin(a) * 0.09, Math.cos(a) * 0.09], [0.025, 0.09, 0.05], '#a24a4a', { rot: [a - Math.PI / 2, 0, -0.6], k: 0.02 }); }),
      sph([0.45, 0.56, 0], 0.05, '#4a0a10', { k: 0.02 }),
    ] }, ...quadLegs('#4a3a3a', 0.22, 0.09, 0.05, 0.32)],
  }));
  def('turret', () => ({
    rig: 'static', height: 1.0, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.016, prims: [
      ell([0, 0.6, 0], [0.14, 0.3, 0.14], '#f4f4f4'), box([0, 0.6, 0], [0.16, 0.3, 0.01], 0, '#bbb', P),
      ...[[0.12, 0.08], [0.12, -0.08], [-0.13, 0]].map(([x, z]) => cap([x * 0.5, 0.35, z * 0.5], [x * 1.6, 0.0, z * 1.6], 0.018, '#888')),
    ] }],
    extras: [{ to: 'body', kind: 'eyes', glow: '#ff2020', at: [0.14, 0.68, 0], single: true }],
  }));
  def('sentrybot', () => ({
    rig: 'float', height: 0.8, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.016, prims: [
      sph([0, 0.5, 0], 0.22, '#e8e8e8'), tor([0, 0.5, 0], 0.22, 0.03, '#9aa0a8', { ax: 'z' }),
      sph([0.2, 0.5, 0], 0.08, '#2a6aff', { k: 0.02 }),
    ] }],
    extras: [{ to: 'body', kind: 'eyes', glow: '#3a9aff', at: [0.25, 0.5, 0], single: true }],
  }));
  def('probedroid', () => probe('#1e1e1e', 'gloss'));
  def('robopenguin', () => ({
    rig: 'waddle', height: 0.7, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.016, prims: [
      ell([0, 0.36, 0], [0.18, 0.3, 0.17], '#1a1a1a'), ell([0.06, 0.32, 0], [0.13, 0.24, 0.13], '#f2f2f2', P),
      cap([0.15, 0.52, 0], [0.3, 0.5, 0], [0.04, 0.01], '#ff9a1a', { k: 0.02 }),
      sph([0.13, 0.58, 0.07], 0.025, '#ff2020', pm({})),
      ell([0, 0.36, 0.17], [0.08, 0.18, 0.03], '#1a1a1a', { mirror: true }),
      cyl([-0.05, 0.72, 0], 0.03, 0.05, '#666'),
    ] }, { name: 'legL', pivot: [0, 0.08, 0.07], res: 0.018, prims: [ell([0.06, 0.03, 0.08], [0.09, 0.03, 0.05], '#ff9a1a')] },
    { name: 'legR', pivot: [0, 0.08, -0.07], res: 0.018, prims: [ell([0.06, 0.03, -0.08], [0.09, 0.03, 0.05], '#ff9a1a')] }],
  }));
  def('eggman', () => ({
    rig: 'float', height: 1.6, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.02, prims: [
      ell([0, 0.45, 0], [0.5, 0.25, 0.42], '#c8ccd2'), box([0, 0.5, 0], [0.55, 0.035, 0.46], 0, '#e8302a', P),
      ell([-0.05, 0.85, 0], [0.32, 0.36, 0.3], '#e8302a', { k: 0.08 }),
      sph([0.08, 1.2, 0], 0.2, '#f0c8a0', { k: 0.05 }), ell([-0.02, 1.32, 0], [0.18, 0.08, 0.2], '#f0c8a0', { k: 0.03 }),
      cap([0.26, 1.15, 0], [0.24, 1.12, 0.22], [0.05, 0.025], '#a05a2a', { mirror: true, k: 0.03 }),
      ell([0.2, 1.27, 0.07], [0.05, 0.05, 0.05], '#2a4a8a', pm({})),
      sph([0.3, 1.18, 0], 0.06, '#e8a080', { k: 0.03 }),
    ] }],
    extras: [{ to: 'body', kind: 'flame', at: [-0.1, 0.12, 0], glow: '#ffb03a', size: 0.14 }],
  }));
  def('glados', () => ({
    rig: 'sway', height: 2.4, parts: [{ name: 'body', pivot: [0, 2.4, 0], mat: 'gloss', res: 0.025, prims: [
      cap([0, 2.6, 0], [0, 1.9, 0], 0.08, '#333'),
      box([0, 1.7, 0], [0.22, 0.3, 0.22], 0.12, '#e8e8e8', { k: 0.06 }),
      box([0.12, 1.25, 0], [0.18, 0.28, 0.16], 0.12, '#d4d4d4', { k: 0.05, rot: [0, 0, 0.3] }),
      cyl([0.3, 1.1, 0], 0.11, 0.04, '#222', { rot: [0, 0, Math.PI / 2 + 0.3], k: 0.02 }),
    ] }],
    extras: [{ to: 'body', kind: 'eyes', glow: '#ffd23f', at: [0.36, 1.1, 0], single: true, size: 0.07 }],
  }));

  // ---------- Generators for families ----------
  function quadLegs(col, x, z, r, h) {
    return [[x, z], [x, -z], [-x, z], [-x, -z]].map(([lx, lz], i) => ({
      name: 'leg' + i, pivot: [lx, h, lz], res: 0.018,
      prims: [cap([lx, h, lz], [lx + 0.02, 0.05, lz * 1.05], [r, r * 0.85], col), ell([lx + 0.05, 0.04, lz * 1.05], [r * 1.3, r * 0.6, r * 1.1], col, { k: 0.03 })],
    }));
  }
  function bird(body, belly, beak, s) {
    return { rig: 'fly', height: 0.7 * s, scale: s, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.016, prims: [
      ell([0, 0.45, 0], [0.24, 0.2, 0.19], body), sph([0.18, 0.62, 0], 0.15, body, { k: 0.08 }),
      ell([0.1, 0.4, 0], [0.16, 0.14, 0.15], belly, P),
      cap([0.3, 0.62, 0], [0.42, 0.6, 0], [0.04, 0.01], beak, { k: 0.02 }),
      ell([0.27, 0.67, 0.08], [0.025, 0.035, 0.025], '#111', pm({})),
      ell([-0.28, 0.45, 0], [0.16, 0.03, 0.1], body, { k: 0.05, rot: [0, 0, 0.3] }),
      cap([0.02, 0.28, 0.07], [0.04, 0.05, 0.08], 0.02, beak, { mirror: true }),
    ] }, { name: 'wingL', pivot: [0, 0.5, 0.15], res: 0.018, prims: [ell([-0.05, 0.52, 0.32], [0.16, 0.03, 0.2], body)] },
    { name: 'wingR', pivot: [0, 0.5, -0.15], res: 0.018, prims: [ell([-0.05, 0.52, -0.32], [0.16, 0.03, 0.2], body)] }] };
  }
  function bat(body, eye, s) {
    return { rig: 'fly', height: 0.6 * s, scale: s, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.016, prims: [
      sph([0, 0.45, 0], 0.13, body), ell([0.02, 0.6, 0.08], [0.03, 0.08, 0.04], body, { mirror: true, k: 0.02 }),
      sph([0.11, 0.48, 0.05], 0.02, eye, pm({})),
    ] }, { name: 'wingL', pivot: [0, 0.48, 0.1], res: 0.018, prims: [ell([-0.02, 0.48, 0.36], [0.12, 0.02, 0.28], body), cap([0, 0.48, 0.1], [0.05, 0.5, 0.6], 0.015, body)] },
    { name: 'wingR', pivot: [0, 0.48, -0.1], res: 0.018, prims: [ell([-0.02, 0.48, -0.36], [0.12, 0.02, 0.28], body), cap([0, 0.48, -0.1], [0.05, 0.5, -0.6], 0.015, body)] }] };
  }
  function dragon() {
    const c = '#141018';
    return { rig: 'fly', height: 1.4, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.025, prims: [
      ell([0, 0.7, 0], [0.5, 0.22, 0.24], c), cap([0.4, 0.75, 0], [0.85, 1.0, 0], [0.13, 0.08], c, { k: 0.08 }),
      ell([1.0, 1.02, 0], [0.22, 0.09, 0.11], c, { k: 0.05 }), cap([-0.4, 0.68, 0], [-1.3, 0.55, 0], [0.16, 0.03], c, { k: 0.08 }),
      ...[0, 1, 2, 3, 4].map((i) => cap([-0.5 + i * 0.25, 0.86, 0], [-0.48 + i * 0.25, 1.0, 0], [0.04, 0.005], '#2a2430', { k: 0.02 })),
      ell([1.08, 1.06, 0.07], [0.04, 0.02, 0.025], '#d070ff', pm({})),
      cap([0.2, 0.5, 0.15], [0.25, 0.1, 0.2], [0.06, 0.04], c, { mirror: true }), cap([-0.25, 0.5, 0.15], [-0.2, 0.1, 0.2], [0.06, 0.04], c, { mirror: true }),
    ] }, { name: 'wingL', pivot: [0.05, 0.85, 0.2], res: 0.025, prims: [ell([-0.1, 0.9, 0.85], [0.35, 0.025, 0.7], '#1f1a26', { rot: [0, 0.3, 0] }), cap([0.05, 0.85, 0.2], [0.2, 0.95, 1.4], 0.03, c)] },
    { name: 'wingR', pivot: [0.05, 0.85, -0.2], res: 0.025, prims: [ell([-0.1, 0.9, -0.85], [0.35, 0.025, 0.7], '#1f1a26', { rot: [0, -0.3, 0] }), cap([0.05, 0.85, -0.2], [0.2, 0.95, -1.4], 0.03, c)] }],
      extras: [{ to: 'body', kind: 'eyes', glow: '#d070ff', at: [1.1, 1.07, 0.06] }] };
  }
  function pacGhost(color) {
    const prims = [sph([0, 0.62, 0], 0.32, color), cyl([0, 0.38, 0], 0.32, 0.24, color, { k: 0.04 })];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; prims.push(sph([Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3], 0.1, color, sub({ k: 0.04 }))); }
    prims.push(cap([0, 0.2, 0], [0, 0.0, 0], 0.22, color, sub({ k: 0.08 })));
    for (const s of [1, -1]) prims.push(ell([0.24, 0.66, 0.12 * s], [0.08, 0.11, 0.08], '#fff', { k: 0.02 }), sph([0.31, 0.65, 0.12 * s], 0.045, '#2121de', P));
    return { rig: 'float', height: 1.0, ghostColor: color, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.018, prims }] };
  }
  function robeGhost(robe, head, eye) {
    return { rig: 'float', height: 1.4, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'ghost', res: 0.02, prims: [
      cap([0, 1.0, 0], [-0.05, 0.15, 0], [0.18, 0.32], robe),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => { const a = i / 7 * Math.PI * 2; return sph([Math.cos(a) * 0.3 - 0.05, 0.08, Math.sin(a) * 0.3], 0.09, robe, sub({ k: 0.05 })); }),
      sph([0.02, 1.25, 0], 0.2, head, { k: 0.06 }),
      eye ? ell([0.18, 1.22, 0], [0.12, 0.15, 0.13], '#000', sub({ k: 0.03 })) : sph([0.2, 1.28, 0.06], 0.025, '#334', pm({})),
      cap([0.05, 0.85, 0.2], [0.35, 0.75, 0.3], [0.06, 0.03], robe, { mirror: true, k: 0.05 }),
    ] }] };
  }
  function spider(body, eye, s, giant) {
    const parts = [{ name: 'body', pivot: [0, 0, 0], mat: giant ? 'ghost' : 'skin', res: 0.02, prims: [
      ell([-0.25, 0.45, 0], [0.32, 0.26, 0.26], body), sph([0.12, 0.42, 0], 0.17, body, { k: 0.06 }),
      ...[[0.27, 0.48, 0.05], [0.27, 0.48, -0.05], [0.25, 0.42, 0.09], [0.25, 0.42, -0.09]].map((c) => sph(c, 0.025, eye, P)),
      cap([0.28, 0.36, 0.04], [0.36, 0.28, 0.06], [0.025, 0.01], '#111', { mirror: true }),
      ell([-0.3, 0.6, 0], [0.14, 0.06, 0.12], giant ? '#3a0a1a' : '#4a3a2a', P),
    ] }];
    for (let i = 0; i < 4; i++) for (const sg of [1, -1]) {
      const x = 0.12 - i * 0.08, a = (-0.6 + i * 0.4);
      const kx = x + Math.cos(a) * 0.15, kz = sg * (0.25 + Math.abs(Math.sin(a)) * 0.05);
      parts.push({ name: `leg${i}${sg > 0 ? 'L' : 'R'}`, pivot: [x, 0.42, sg * 0.1], res: 0.02, prims: [cap([x, 0.42, sg * 0.1], [kx, 0.62, kz], 0.035, body), cap([kx, 0.62, kz], [kx + Math.cos(a) * 0.15, 0.0, sg * 0.55], [0.03, 0.012], body, { k: 0.02 })] });
    }
    return { rig: 'spider', height: 0.9, scale: s, parts, extras: giant ? [{ to: 'body', kind: 'eyes', glow: eye, at: [0.27, 0.48, 0.05] }] : [] };
  }
  function dino(c, kind) {
    const big = kind === 'trex' || kind === 'godzilla', upright = kind === 'godzilla';
    const s = { raptor: 1, dilo: 1, compy: 0.55, trex: 1.0, godzilla: 1.0 }[kind];
    const body = [];
    if (upright) {
      body.push(ell([0, 0.95, 0], [0.32, 0.45, 0.3], c.body), ell([0.12, 0.9, 0], [0.22, 0.38, 0.24], c.belly, P),
        sph([0.18, 1.55, 0], 0.2, c.body, { k: 0.1 }), ell([0.35, 1.5, 0], [0.18, 0.1, 0.13], c.body, { k: 0.06 }),
        cap([0.1, 1.15, 0.24], [0.32, 1.0, 0.3], [0.07, 0.05], c.body, { mirror: true }),
        ell([0.36, 1.62, 0.09], [0.03, 0.025, 0.03], '#ffd23f', pm({})));
      for (let i = 0; i < 5; i++) body.push(cap([-0.25 - i * 0.02, 1.45 - i * 0.18, 0], [-0.42 - i * 0.03, 1.55 - i * 0.18, 0], [0.07, 0.01], c.spines, { k: 0.02 }));
    } else {
      const hy = big ? 0.95 : 0.7;
      body.push(ell([0, hy - 0.05, 0], [0.42, 0.22, 0.2], c.body), ell([0.05, hy - 0.12, 0], [0.32, 0.12, 0.16], c.belly, P),
        cap([0.3, hy, 0], [0.5, hy + 0.25, 0], [0.12, 0.09], c.body, { k: 0.08 }),
        ell([0.65, hy + 0.3, 0], big ? [0.3, 0.17, 0.16] : [0.22, 0.1, 0.1], c.body, { k: 0.06 }),
        box([0.82, hy + 0.24, 0], [0.18, 0.012, 0.15], 0, '#300', sub({ k: 0.01 })),
        ell([0.68, hy + 0.38, 0.08], [0.03, 0.025, 0.025], '#111', pm({})),
        cap([0.3, hy - 0.05, 0.12], [0.42, hy - 0.2, 0.15], [0.04, 0.025], c.body, { mirror: true }));
      for (let i = 0; i < 4; i++) body.push(box([-0.1 + i * 0.12, hy + 0.12, 0], [0.025, 0.08, 0.22], 0, c.stripe, P));
      if (c.frill) body.push(tor([0.5, hy + 0.3, 0], 0.18, 0.03, c.frill, { ax: 'x', k: 0.02 }), ell([0.5, hy + 0.3, 0], [0.02, 0.18, 0.18], c.frill, { k: 0.02 }));
    }
    const hip = upright ? 0.75 : big ? 0.75 : 0.55;
    const parts = [{ name: 'body', pivot: [0, 0, 0], res: big ? 0.022 : 0.018, prims: body }];
    for (const sg of [1, -1]) parts.push({ name: sg > 0 ? 'legL' : 'legR', pivot: [-0.05, hip, 0.14 * sg], res: 0.02, prims: [
      ell([-0.05, hip - 0.1, 0.15 * sg], [0.14, 0.2, 0.1], c.body), cap([-0.08, hip - 0.25, 0.15 * sg], [0.0, 0.05, 0.15 * sg], [0.06, 0.045], c.body, { k: 0.04 }),
      ell([0.08, 0.04, 0.15 * sg], [0.13, 0.04, 0.07], c.body, { k: 0.03 })] });
    parts.push({ name: 'tail', pivot: [-0.35, upright ? 0.75 : hip + 0.15, 0], res: 0.02, prims: [cap([-0.3, upright ? 0.75 : hip + 0.15, 0], [-1.1, upright ? 0.2 : hip + 0.25, 0], [0.16, 0.03], c.body)] });
    return { rig: 'biped', height: upright ? 1.9 : big ? 1.4 : 1.1, scale: s, parts, extras: upright ? [{ to: 'body', kind: 'spines', glow: c.spines }] : [] };
  }
  function koopa(boss) {
    const shellC = boss ? '#3a8a2a' : '#2fae3a', skin = boss ? '#e8b040' : '#f2d23a';
    const body = [
      ell([-0.05, 0.5, 0], [0.32, 0.3, 0.3], shellC), tor([-0.05, 0.42, 0], 0.3, 0.04, '#f2f2d0', { ax: 'y', k: 0.02 }),
      ell([0.08, 0.45, 0], [0.22, 0.26, 0.24], '#f2e8a0', { k: 0.03 }),
      sph([0.26, 0.85, 0], boss ? 0.22 : 0.17, skin, { k: 0.06 }), ell([0.4, 0.8, 0], [0.12, 0.08, 0.1], skin, { k: 0.05 }),
      ell([0.34, 0.92, 0.07], [0.03, 0.05, 0.03], '#111', pm({})),
    ];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; body.push(box([-0.1 + Math.cos(a) * 0.15, 0.68, Math.sin(a) * 0.15], [0.05, 0.01, 0.05], 0, '#1f7a28', P)); }
    if (boss) {
      for (const [x, z] of [[-0.05, 0.12], [-0.05, -0.12], [-0.2, 0], [0.08, 0], [-0.15, 0.2], [-0.15, -0.2]]) body.push(cap([x, 0.72, z], [x - 0.04, 0.9, z * 1.2], [0.05, 0.005], '#f2f2e0', { k: 0.02 }));
      body.push(cap([0.2, 1.0, 0.1], [0.1, 1.2, 0.18], [0.04, 0.01], '#f2f2e0', { mirror: true }), ell([0.2, 1.05, 0], [0.12, 0.08, 0.16], '#e8501a', { k: 0.03 }));
    }
    const parts = [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.018, prims: body }];
    for (const sg of [1, -1]) parts.push({ name: sg > 0 ? 'legL' : 'legR', pivot: [0, 0.25, 0.14 * sg], res: 0.02, prims: [cap([0, 0.25, 0.14 * sg], [0.03, 0.06, 0.15 * sg], 0.07, skin), ell([0.08, 0.05, 0.15 * sg], [0.1, 0.05, 0.07], skin, { k: 0.03 })] });
    return { rig: 'biped', height: boss ? 1.3 : 1.05, parts, shell: true };
  }
  function dalek(emp) {
    const col = emp ? '#d8b040' : '#a8401a', trim = emp ? '#8a6a20' : '#5a1a0a';
    const prims = [
      cap([0, 0.15, 0], [0.05, 0.75, 0], [0.34, 0.24], col),
      box([0, 0.08, 0], [0.38, 0.08, 0.36], 0.04, '#333', { k: 0.03 }),
      cyl([0.05, 0.86, 0], 0.22, 0.1, '#888', { k: 0.02 }),
      sph([0.05, 1.0, 0], 0.2, '#9aa0a8', { k: 0.03 }),
    ];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) {
      const a = -1.2 + i * 0.48, rr = 0.33 - r * 0.025, y = 0.22 + r * 0.13;
      prims.push(sph([0.02 + Math.cos(a) * rr, y, Math.sin(a) * rr], 0.035, trim, { k: 0.01 }));
    }
    prims.push(cap([0.18, 1.04, 0], [0.42, 1.08, 0], 0.02, '#666'), cap([0.22, 0.75, 0.08], [0.48, 0.73, 0.1], 0.02, '#555'), cap([0.22, 0.75, -0.08], [0.45, 0.74, -0.1], 0.025, '#333'),
      cyl([0.48, 0.74, -0.1], 0.05, 0.02, '#222', { rot: [0, 0, Math.PI / 2] }));
    return { rig: 'glide', height: 1.2, scale: emp ? 1 : 1, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'metal', res: 0.02, prims }],
      extras: [{ to: 'body', kind: 'eyes', glow: '#5fd0ff', at: [0.43, 1.08, 0], single: true }, { to: 'body', kind: 'eyes', glow: '#ffd23f', at: [0.05, 1.2, 0.08] }] };
  }
  function probe(c, mat) {
    return { rig: 'float', height: 1.0, parts: [{ name: 'body', pivot: [0, 0, 0], mat, res: 0.018, prims: [
      sph([0, 0.75, 0], 0.2, c), ...[0, 1, 2, 3, 4].map((i) => { const a = i / 5 * Math.PI * 2; return cap([Math.cos(a) * 0.08, 0.6, Math.sin(a) * 0.08], [Math.cos(a) * 0.15, 0.2, Math.sin(a) * 0.15], [0.02, 0.01], '#333', { k: 0.02 }); }),
      cap([0, 0.9, 0], [0, 1.15, 0], 0.012, '#555'),
    ] }], extras: [{ to: 'body', kind: 'eyes', glow: '#ff3030', at: [0.19, 0.78, 0], single: true }] };
  }

  // ---------- Pickups, items & props ----------
  def('pk_coin', () => ({ rig: 'spin', height: 0.4, parts: [{ name: 'body', pivot: [0, 0.35, 0], mat: 'gold', res: 0.012, prims: [cyl([0, 0.35, 0], 0.16, 0.03, '#ffd23f', { rot: [Math.PI / 2, 0, 0], rr: 0.02 }), cyl([0, 0.35, 0.035], 0.1, 0.01, '#e8b020', { rot: [Math.PI / 2, 0, 0], op: 'sub', mirror: true })] }] }));
  def('pk_heart', () => ({ rig: 'spin', height: 0.4, parts: [{ name: 'body', pivot: [0, 0.35, 0], mat: 'gloss', res: 0.012, prims: [sph([0, 0.42, 0.08], 0.11, '#ff3b5c', M), cap([0, 0.38, 0.12], [0, 0.2, 0], [0.09, 0.02], '#ff3b5c', { mirror: true, k: 0.05 })] }] }));
  def('pk_pokeballs', () => pokeball('#e83a3a'));
  def('pk_masterball', () => pokeball('#7a3ad0'));
  def('pk_grenade', () => ({ rig: 'spin', height: 0.4, parts: [{ name: 'body', pivot: [0, 0.3, 0], mat: 'gold', res: 0.012, prims: [sph([0, 0.3, 0], 0.14, '#e8c040'), cap([0, 0.42, 0], [0, 0.62, 0], 0.02, '#e8c040'), cap([0, 0.55, -0.06], [0, 0.55, 0.06], 0.02, '#e8c040'), tor([0, 0.3, 0], 0.14, 0.015, '#c8a020', { ax: 'z' })] }] }));
  def('pk_mushroom', () => ({ rig: 'spin', height: 0.4, parts: [{ name: 'body', pivot: [0, 0.2, 0], res: 0.012, prims: [cyl([0, 0.15, 0], 0.09, 0.1, '#f2e0c0', { rr: 0.04 }), ell([0, 0.3, 0], [0.19, 0.14, 0.19], '#e8302a', { k: 0.03 }), sph([0.12, 0.38, 0], 0.05, '#fff', P), sph([-0.06, 0.4, 0.1], 0.05, '#fff', P), sph([-0.06, 0.4, -0.1], 0.05, '#fff', P), ell([0.09, 0.17, 0.035], [0.015, 0.03, 0.015], '#111', pm({}))] }] }));
  def('pk_extralife', () => ({ rig: 'spin', height: 0.4, parts: [{ name: 'body', pivot: [0, 0.35, 0], mat: 'metal', res: 0.012, prims: [cyl([0, 0.35, 0], 0.15, 0.02, '#d0d4da', { rot: [Math.PI / 2, 0, 0], rr: 0.01 }), tor([0, 0.35, 0], 0.15, 0.012, '#a8acb2', { ax: 'z' })] }] }));
  def('pk_key', (c) => ({ rig: 'spin', height: 0.6, parts: [{ name: 'body', pivot: [0, 0.4, 0], mat: 'metal', res: 0.012, prims: [tor([0, 0.55, 0], 0.09, 0.028, c || '#e08a4a', { ax: 'z' }), cap([0, 0.46, 0], [0, 0.12, 0], 0.025, c || '#e08a4a'), box([0, 0.18, 0.05], [0.015, 0.02, 0.05], 0.01, c || '#e08a4a'), box([0, 0.26, 0.04], [0.015, 0.02, 0.04], 0.01, c || '#e08a4a')] }] }));
  def('pk_relic', () => ({ rig: 'spin', height: 0.6, parts: [{ name: 'body', pivot: [0, 0.4, 0], mat: 'gold', res: 0.014, prims: [ell([0, 0.4, 0], [0.13, 0.2, 0.13], '#ffd23f'), tor([0, 0.4, 0], 0.17, 0.02, '#ffe98a', { ax: 'y' })] }] }));
  def('pk_mount', () => ({ rig: 'spin', height: 0.6, parts: [{ name: 'body', pivot: [0, 0.4, 0], mat: 'metal', res: 0.014, prims: [box([0, 0.4, 0], [0.22, 0.08, 0.12], 0.05, '#18e0ff'), tor([0.12, 0.33, 0.12], 0.05, 0.02, '#333', { ax: 'z', mirror: true }), tor([-0.12, 0.33, 0.12], 0.05, 0.02, '#333', { ax: 'z', mirror: true })] }] }));
  def('pk_star', () => ({ rig: 'spin', height: 0.5, parts: [{ name: 'body', pivot: [0, 0.4, 0], mat: 'glowSoft', res: 0.012, prims: [0, 1, 2, 3, 4].map((i) => { const a = i / 5 * Math.PI * 2 + Math.PI / 2; return cap([0, 0.4, 0], [0, 0.4 + Math.sin(a) * 0.22, Math.cos(a) * 0.22], [0.08, 0.02], '#ffe23a', { k: 0.04 }); }) }] }));
  def('chest', () => ({ rig: 'chest', height: 0.6, parts: [
    { name: 'body', pivot: [0, 0, 0], res: 0.02, prims: [box([0, 0.2, 0], [0.24, 0.18, 0.36], 0.03, '#8a5a2a'), box([0, 0.2, 0], [0.25, 0.03, 0.37], 0.01, '#ffd23f', { k: 0.005 }), box([0.25, 0.3, 0], [0.02, 0.06, 0.05], 0.01, '#ffd23f')] },
    { name: 'lid', pivot: [-0.24, 0.38, 0], res: 0.02, prims: [cyl([0, 0.38, 0], 0.24, 0.36, '#9a6a3a', { rot: [Math.PI / 2, 0, 0], rr: 0.03 }), box([0, 0.2, 0], [0.4, 0.18, 0.5], 0, '#000', sub({ k: 0.01 })), tor([0, 0.38, 0.3], 0.24, 0.02, '#ffd23f', { ax: 'z', mirror: true, k: 0.01 })] },
  ] }));
  function pokeball(top) {
    return { rig: 'spin', height: 0.4, parts: [{ name: 'body', pivot: [0, 0.3, 0], mat: 'gloss', res: 0.012, prims: [
      sph([0, 0.3, 0], 0.15, '#f4f4f4'), box([0, 0.38, 0], [0.2, 0.08, 0.2], 0, top, P),
      tor([0, 0.3, 0], 0.15, 0.018, '#222', { ax: 'y' }), cyl([0.15, 0.3, 0], 0.045, 0.012, '#f4f4f4', { rot: [0, 0, Math.PI / 2], k: 0.01 }),
    ] }] };
  }

  // Trees & props for terrain instancing (lower resolution: they are drawn thousands of times).
  def('tree_round', (c) => ({ parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.11, prims: [cap([0, 0, 0], [0, 0.9, 0], [0.12, 0.08], '#6b4423'), sph([0, 1.2, 0], 0.48, c || '#2f8a3a', { k: 0.2 }), sph([0.25, 1.0, 0.15], 0.32, c || '#2f8a3a', { k: 0.2 }), sph([-0.2, 1.05, -0.2], 0.3, c || '#2f8a3a', { k: 0.2 })] }] }));
  def('tree_pine', (c) => ({ parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.11, prims: [cap([0, 0, 0], [0, 0.6, 0], 0.09, '#5a3a20'), cap([0, 0.5, 0], [0, 1.1, 0], [0.5, 0.05], c || '#2a6a3a', { k: 0.05 }), cap([0, 0.95, 0], [0, 1.6, 0], [0.38, 0.02], c || '#2a6a3a', { k: 0.05 }), cap([0, 1.4, 0], [0, 2.0, 0], [0.25, 0.01], c || '#2a6a3a', { k: 0.05 })] }] }));
  def('tree_palm', () => ({ parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.08, prims: [cap([0, 0, 0], [0.1, 1.4, 0], [0.09, 0.06], '#8a5a2a'), ...[0, 1, 2, 3, 4, 5].map((i) => { const a = i / 6 * Math.PI * 2; return ell([0.1 + Math.cos(a) * 0.4, 1.35, Math.sin(a) * 0.4], [0.4, 0.04, 0.12], '#2fa83a', { rot: [0, -a, -0.35], k: 0.05 }); })] }] }));
  def('bush', (c) => ({ parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.09, prims: [sph([0, 0.3, 0], 0.35, c || '#2f9a3c'), sph([0.2, 0.25, 0.1], 0.25, c || '#2f9a3c', { k: 0.15 }), sph([-0.15, 0.4, -0.1], 0.25, c || '#3aaa48', { k: 0.15 })] }] }));
  def('rock', (c) => ({ parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.09, prims: [ell([0, 0.3, 0], [0.48, 0.38, 0.44], c || '#888'), sph([0.2, 0.45, 0.1], 0.25, c || '#888', { k: 0.15 }), sph([-0.15, 0.2, -0.2], 0.28, c || '#888', { k: 0.12 })] }] }));
  def('egg', () => ({ rig: 'spin', height: 1.2, parts: [{ name: 'body', pivot: [0, 0.9, 0], mat: 'gold', res: 0.02, prims: [ell([0, 0.9, 0], [0.32, 0.42, 0.32], '#fff3c4'), tor([0, 0.85, 0], 0.32, 0.03, '#ffd23f', { ax: 'y', k: 0.02 })] }] }));
  def('pipe', () => ({ parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.07, prims: [cyl([0, 0.5, 0], 0.36, 0.5, '#1f9e2f'), cyl([0, 1.05, 0], 0.46, 0.14, '#2ec43f', { rr: 0.04 }), cyl([0, 1.2, 0], 0.32, 0.2, '#0a3a10', sub({}))] }] }));
  def('tardis', () => ({ parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.07, prims: [box([0, 0.95, 0], [0.4, 0.95, 0.4], 0.03, '#1f4fa8'), box([0, 1.95, 0], [0.36, 0.08, 0.36], 0.02, '#163a80'), cyl([0, 2.1, 0], 0.07, 0.08, '#cfe8ff'), box([0.41, 1.5, 0], [0.01, 0.12, 0.3], 0, '#cfe0ff', P), box([0.41, 0.95, 0], [0.01, 0.4, 0.008], 0, '#163a80', P)] }] }));
  def('statue', (c) => ({ parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.06, prims: [box([0, 0.3, 0], [0.38, 0.3, 0.38], 0.05, c || '#4a4070'), cyl([0, 0.7, 0], 0.18, 0.15, c ? mix(c, '#ffffff', 0.15) : '#5a5088', { rr: 0.04 })] }] }));

  // ---------- Campaign: arcade cabinet, gate portal, IOI pylon, IOI-655321, Anorak, the Egg ----------
  // Parts named screen/marquee/membrane/orb/ring* are restyled or animated by js/render3d.js.
  const mix = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  def('cabinet', () => {
    const body = '#2a2244', trim = '#3c3466';
    // points on the tilted screen face / control deck (local u = up the face, z = across)
    const scr = (u, z) => [0.188 - 0.199 * u, 1.334 + 0.98 * u, z];
    const deck = (u, z, dy = 0) => [0.171 + 0.976 * u, 0.969 - 0.218 * u + dy, z];
    const screen = [box([0.17, 1.33, 0], [0.02, 0.21, 0.25], 0.01, '#14286e', { rot: [0, 0, 0.2] }),
      box(scr(0.15, 0), [0.03, 0.012, 0.2], 0, '#f2f2f2', { op: 'paint', rot: [0, 0, 0.2] }),
      box(scr(0.06, 0), [0.03, 0.007, 0.23], 0, '#3a6aff', { op: 'paint', rot: [0, 0, 0.2] }), box(scr(-0.15, 0), [0.03, 0.007, 0.23], 0, '#3a6aff', { op: 'paint', rot: [0, 0, 0.2] }),
      sph(scr(-0.045, 0.13), 0.045, '#ffe23a', P), sph(scr(-0.045, -0.15), 0.04, '#ff3030', P), sph(scr(-0.03, -0.18), 0.012, '#ffffff', P)];
    for (let i = 0; i < 5; i++) screen.push(sph(scr(-0.045, 0.06 - i * 0.04), 0.011, '#ffd8b0', P));
    const marquee = [box([0.265, 1.74, 0], [0.02, 0.075, 0.32], 0.01, '#ffcf3a'), box([0.29, 1.8, 0], [0.03, 0.01, 0.32], 0, '#fff4c0', P), box([0.29, 1.68, 0], [0.03, 0.01, 0.32], 0, '#fff4c0', P)];
    for (let i = 0; i < 6; i++) marquee.push(box([0.29, 1.74, -0.22 + i * 0.088], [0.03, 0.035, 0.026], 0.008, i % 2 ? '#ff3a6a' : '#e0287a', P));
    const knobs = [cyl(deck(0.05, 0.16), 0.045, 0.012, '#111'), cap(deck(0.05, 0.16), [0.235, 1.07, 0.16], 0.013, '#222'), sph([0.238, 1.085, 0.16], 0.036, '#e83a3a', { k: 0.01 })];
    ['#ffd23f', '#3aff6a', '#3a9aff', '#ff3a3a', '#ff4fd8', '#f2f2f2'].forEach((col, i) => knobs.push(sph(deck(i < 3 ? 0.08 : 0.0, -0.01 - (i % 3) * 0.085, -0.012), 0.03, col, { k: 0.005 })));
    return { rig: 'static', height: 1.9, parts: [
      { name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.032, prims: [
        box([-0.02, 0.45, 0], [0.3, 0.45, 0.33], 0.03, body),
        box([-0.1, 1.3, 0], [0.22, 0.5, 0.33], 0.03, body, { k: 0.02 }),
        box([0.16, 0.92, 0], [0.18, 0.05, 0.35], 0.025, trim, { rot: [0, 0, -0.22], k: 0.02 }),
        box([0.12, 1.32, 0], [0.06, 0.28, 0.31], 0.03, body, { rot: [0, 0, 0.2], k: 0.03 }),
        box([0.08, 1.74, 0], [0.18, 0.1, 0.35], 0.02, trim, { k: 0.02 }),
        box([-0.02, 1.86, 0], [0.33, 0.03, 0.37], 0.015, body, { k: 0.01 }),
        box([0.29, 0.06, 0], [0.04, 0.06, 0.34], 0.01, '#0c0a16', { k: 0.01 }),
        box([0, 1.02, 0.342], [0.3, 0.035, 0.01], 0, '#ff4fd8', pm({ rot: [0, 0, 0.75] })),
        box([0, 0.8, 0.342], [0.3, 0.035, 0.01], 0, '#4ff3ff', pm({ rot: [0, 0, 0.75] })),
        box([0.29, 0.48, 0], [0.03, 0.14, 0.12], 0.01, '#3a3456', P),
        box([0.3, 0.52, 0.05], [0.02, 0.025, 0.012], 0, '#ff9b3d', pm({})),
      ] },
      { name: 'deck', pivot: [0, 0, 0], mat: 'gloss', res: 0.012, prims: knobs },
      { name: 'screen', pivot: [0, 0, 0], mat: 'glowSoft', res: 0.015, prims: screen },
      { name: 'marquee', pivot: [0, 0, 0], mat: 'glowSoft', res: 0.014, prims: marquee },
    ] };
  });
  // A massive ring portal on a stone plinth, tinted by the act colour, facing +X.
  def('gatedoor', (c) => {
    c = c || '#e08a4a';
    const lite = mix(c, '#ffffff', 0.55), dark = mix(c, '#14121c', 0.6), stone = '#4a4658', stone2 = '#5c586c', Y = 1.75, R = 1.2;
    const ring = [tor([0, Y, 0], R, 0.17, c, { ax: 'x' }), tor([0, Y, 0], R - 0.16, 0.055, dark, { ax: 'x', k: 0.03 }), tor([0.13, Y, 0], R + 0.02, 0.03, lite, { ax: 'x', op: 'paint' })];
    const chev = [];
    for (let i = 0; i < 9; i++) {
      const a = Math.PI / 2 + (i - 4) * 0.62, y = Y + Math.sin(a) * R, z = Math.cos(a) * R, rot = [Math.PI / 2 - a, 0, 0];
      ring.push(box([0.06, y, z], [0.14, 0.1, 0.13], 0.03, dark, { rot, k: 0.03 }));
      chev.push(box([0.2, y + Math.sin(a) * 0.04, z + Math.cos(a) * 0.04], [0.02, 0.045, 0.07], 0.01, lite, { rot }));
    }
    const plinth = [
      box([0, 0.14, 0], [0.8, 0.14, 1.95], 0.04, stone),
      box([0, 0.34, 0], [0.6, 0.07, 1.75], 0.03, stone2, { k: 0.02 }),
      box([0.72, 0.18, 0], [0.18, 0.05, 0.7], 0.02, stone2, { k: 0.02 }),
      box([0, 0.55, 0], [0.32, 0.17, 0.42], 0.04, stone, { k: 0.04 }),
      box([0, 1.3, 1.62], [0.17, 0.92, 0.17], 0.03, stone, { mirror: true, k: 0.03 }),
      box([0, 2.28, 1.62], [0.13, 0.13, 0.13], 0.02, stone2, { mirror: true, rot: [0, 0.785, 0], k: 0.03 }),
      box([0.81, 0.14, 0], [0.02, 0.03, 1.5], 0, c, P), box([0.33, 0.55, 0], [0.02, 0.05, 0.3], 0, c, P),
      box([0.18, 1.3, 1.62], [0.02, 0.7, 0.04], 0, c, pm({})),
    ];
    for (const s of [1, -1]) chev.push(sph([0, 2.48, 1.62 * s], 0.09, lite));
    const membrane = [ell([0, Y, 0], [0.07, R - 0.12, R - 0.12], mix(c, '#ffffff', 0.25)), sph([0, Y, 0], 0.22, '#ffffff', P)];
    for (let i = 0; i < 4; i++) membrane.push(tor([0, Y, 0], 0.32 + i * 0.22, 0.05 + i * 0.008, i % 2 ? c : lite, { ax: 'x', op: 'paint' }));
    return { rig: 'gate', height: 3, parts: [
      { name: 'plinth', pivot: [0, 0, 0], mat: 'stone', res: 0.06, prims: plinth },
      { name: 'ring', pivot: [0, Y, 0], mat: 'metal', res: 0.045, prims: ring },
      { name: 'chevrons', pivot: [0, Y, 0], mat: 'glowSoft', res: 0.02, prims: chev },
      { name: 'membrane', pivot: [0, Y, 0], mat: 'glowSoft', res: 0.065, prims: membrane },
    ], extras: [{ to: 'membrane', kind: 'portal', glow: c, at: [0, Y, 0], size: R - 0.1 }, { kind: 'glow', glow: c, at: [0, 2.48, 1.62], size: 1.1 }, { kind: 'glow', glow: c, at: [0, 2.48, -1.62], size: 1.1 }] };
  });
  // IOI shield pylon: tapered tower, orange orb on top, floating rings.
  def('shieldgen', () => {
    const steel = '#5c606b', dark = '#34373f', or = '#ff9b3d';
    const body = [
      cyl([0, 0.07, 0], 0.5, 0.07, dark, { rr: 0.03 }),
      cyl([0, 0.17, 0], 0.4, 0.05, steel, { rr: 0.03, k: 0.03 }),
      cap([0, 0.2, 0], [0, 2.02, 0], [0.27, 0.11], steel, { k: 0.06 }),
      box([0, 0.62, 0], [0.5, 0.035, 0.5], 0, or, P), box([0, 1.14, 0], [0.5, 0.03, 0.5], 0, or, P), box([0, 1.58, 0], [0.5, 0.025, 0.5], 0, or, P),
      box([0, 1.1, 0], [0.5, 0.8, 0.02], 0, or, P), box([0, 1.1, 0], [0.02, 0.8, 0.5], 0, or, P),
      tor([0, 2.04, 0], 0.14, 0.045, dark, { k: 0.03 }),
    ];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2, x = Math.cos(a), z = Math.sin(a);
      body.push(cap([x * 0.44, 0.1, z * 0.44], [x * 0.17, 1.0, z * 0.17], [0.075, 0.03], dark, { k: 0.05 }), sph([x * 0.46, 0.16, z * 0.46], 0.05, or, P),
        cap([x * 0.12, 2.0, z * 0.12], [x * 0.25, 2.3, z * 0.25], [0.035, 0.014], steel, { k: 0.03 }));
    }
    const ringPart = (name, y, R, r, rot, col) => ({ name, pivot: [0, y, 0], mat: 'glowSoft', res: 0.024, prims: [tor([0, y, 0], R, r, col, { rot })] });
    return { rig: 'pylon', height: 2.6, parts: [
      { name: 'body', pivot: [0, 0, 0], mat: 'metal', res: 0.034, prims: body },
      { name: 'orb', pivot: [0, 2.34, 0], mat: 'glowSoft', res: 0.02, prims: [sph([0, 2.34, 0], 0.19, '#ffb45a')] },
      ringPart('ringA', 1.3, 0.56, 0.04, [0.25, 0, 0.1], or), ringPart('ringB', 1.84, 0.43, 0.035, [-0.2, 0, -0.25], or), ringPart('ringC', 2.34, 0.33, 0.03, [1.1, 0, 0.4], '#ffd29a'),
    ], extras: [{ to: 'orb', kind: 'glow', glow: or, at: [0, 2.34, 0], size: 1.8 }] };
  });
  // IOI-655321: an upgraded Sixer in grey/black armour with orange trim, a visor helmet and an orange cape.
  def('ioi655321', () => {
    const h = humanoid({ suit: '#5a5f6a', pants: '#2c2f36', skin: '#5a5f6a', helm: '#3a3e47', visor: '#ff9b3d', glowVisor: '#ff9b3d', chest: '#3a3e47', pads: '#2c2f36', belt: '#1c1e24', boots: '#1c1e24', gloves: '#1c1e24', build: 'bulky', mat: 'gloss', prop: 'rifle', propColor: '#ff9b3d' });
    const bw = 1.28, or = '#ff9b3d', blk = '#1c1e24';
    h.parts[0].prims.push(
      tor([-0.02, 1.02, 0], 0.17, 0.05, blk, { k: 0.05 }),                                      // collar
      box([0.22, 0.92, 0], [0.04, 0.1, 0.025], 0, or, P), box([0.22, 0.83, 0.04], [0.04, 0.02, 0.06], 0, or, P),   // chest "6" flash
      cap([0.14, 1.43, 0], [-0.16, 1.42, 0], [0.035, 0.02], or, { k: 0.03 }),                   // helmet crest
      tor([0, 1.0, 0.27 * bw], 0.1, 0.02, or, { mirror: true, op: 'paint' }),                   // pad trim
      box([0.19, 0.66, 0], [0.04, 0.035, 0.06], 0.01, or, P),                                   // buckle
    );
    // a draped cape: an ellipsoid shell behind the shoulders
    h.parts.push({ name: 'cape', pivot: [0, 1, 0], mat: 'skin', res: 0.022, prims: [
      ell([-0.13, 0.6, 0], [0.15, 0.58, 0.33], '#ff8a2a'), ell([-0.02, 0.6, 0], [0.17, 0.66, 0.29], '#b8501a', sub({ k: 0.02 })),
      box([-0.15, 1.38, 0], [0.4, 0.34, 0.5], 0, '#b8501a', sub({ k: 0.03 })), box([-0.2, 0.1, 0], [0.4, 0.035, 0.5], 0, '#c85a10', P)] });
    for (const p of h.parts) {
      if (p.name.startsWith('leg')) { const s = p.name === 'legL' ? 1 : -1; p.prims.push(ell([0.07, 0.33, 0.12 * s * bw], [0.04, 0.055, 0.065], or, { k: 0.02 })); }
      if (p.name.startsWith('arm')) { const s = p.name === 'armL' ? 1 : -1; p.prims.push(cap([0.02, 0.84, 0.3 * s * bw], [0.04, 0.74, 0.31 * s * bw], 0.09, blk, { k: 0.03 }), box([0.04, 0.79, 0.31 * s * bw], [0.1, 0.012, 0.1], 0, or, P)); }
    }
    return h;
  });
  // Anorak: a tall robed lich-wizard in black and crimson with glowing red eyes, a crown and long sleeves.
  def('anorak', () => {
    const robe = '#140c14', crim = '#8e0c22', face = '#8e887e', gold = '#d8a83a';
    const h = humanoid({ suit: robe, robe, skin: face, gloves: face, head: 'lich', beard: '#5a5650', glowEyes: '#ff2a2a', build: 'slim', prop: 'staff', propColor: '#ff2a3a', scale: 1.32 });
    h.parts[0].prims.push(
      cap([0, 1.0, 0], [0, 0.03, 0], [0.19, 0.42], robe, { k: 0.12 }),
      box([0, 0.04, 0], [0.6, 0.06, 0.6], 0, crim, P),
      box([0.3, 0.5, 0], [0.2, 0.5, 0.05], 0, crim, { op: 'paint', rot: [0, 0, 0.36] }),
      box([0.3, 0.5, 0], [0.2, 0.5, 0.012], 0, gold, { op: 'paint', rot: [0, 0, 0.36] }),
      ell([-0.01, 1.0, 0], [0.2, 0.09, 0.28], crim, { k: 0.06 }),                                 // shoulder mantle
      box([0.0, 0.66, 0], [0.32, 0.03, 0.32], 0, crim, P),
      box([0, -0.5, 0], [0.8, 0.5, 0.8], 0, crim, sub({ k: 0.02 })),                            // flat hem on the ground
    );
    h.parts[0].res = 0.023;
    // hood with a crimson lining, crowned
    const hood = [ell([-0.02, 1.24, 0], [0.25, 0.31, 0.26], robe), cap([-0.08, 1.12, 0], [-0.2, 0.86, 0], [0.18, 0.12], robe, { k: 0.08 }),
      ell([0.22, 1.18, 0], [0.15, 0.22, 0.165], crim, sub({ k: 0.03 })), tor([0.0, 1.46, 0], 0.19, 0.026, gold, { k: 0.01 }), sph([0.19, 1.47, 0], 0.032, '#ff2030', { k: 0.004 })];
    for (let i = 0; i < 9; i++) { const a = (i - 4) * 0.42; hood.push(cap([Math.cos(a) * 0.18, 1.47, Math.sin(a) * 0.18], [Math.cos(a) * 0.2, 1.6 + (i % 2 ? 0 : 0.06), Math.sin(a) * 0.2], [0.028, 0.006], gold, { k: 0.02 })); }
    h.parts.push({ name: 'hood', pivot: [0, 1.2, 0], mat: 'skin', res: 0.024, prims: hood });
    for (const p of h.parts) if (p.name.startsWith('arm')) {
      const s = p.name === 'armL' ? 1 : -1, z = (v) => v * s * 0.84;
      p.prims[0] = cap([0, 0.98, z(0.26)], [0.05, 0.64, z(0.34)], [0.07, 0.12], robe, { k: 0.04 });
      p.prims[1] = sph([0.08, 0.6, z(0.33)], 0.05, face, { k: 0.03 });
      p.prims.push(ell([0.0, 0.56, z(0.34)], [0.1, 0.13, 0.085], robe, { k: 0.05 }), tor([0.05, 0.64, z(0.34)], 0.115, 0.02, crim, { rot: [0, 0, -0.15], op: 'paint' }),
        ell([0.0, 0.5, z(0.34)], [0.11, 0.06, 0.09], crim, P));
    }
    return h;
  });
  // The Egg as a pickup: jewelled silver with gold bands.
  def('pk_egg', () => {
    const Y = 0.55, silver = '#e2e6ee', gold = '#ffc93a', gems = ['#ff1f3d', '#2a7aff', '#1fd070'];
    const shell = [ell([0, Y, 0], [0.2, 0.27, 0.2], silver), sph([0, Y - 0.07, 0], 0.195, silver, { k: 0.12 }),
      tor([0, Y - 0.03, 0], 0.203, 0.016, gold, { k: 0.01 }), tor([0, Y + 0.16, 0], 0.152, 0.011, gold, { k: 0.01 }), tor([0, Y - 0.19, 0], 0.15, 0.011, gold, { k: 0.01 }),
      box([0, Y, 0], [0.01, 0.32, 0.3], 0, gold, P), box([0, Y, 0], [0.3, 0.32, 0.01], 0, gold, P),
      sph([0, Y + 0.275, 0], 0.035, gold, { k: 0.02 }), cap([0, Y + 0.29, 0], [0, Y + 0.34, 0], [0.012, 0.004], gold, { k: 0.01 })];
    const jewels = [];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; jewels.push(sph([Math.cos(a) * 0.212, Y - 0.03, Math.sin(a) * 0.212], 0.024, gems[i % 3], { k: 0.004 })); }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; jewels.push(sph([Math.cos(a) * 0.168, Y + 0.14, Math.sin(a) * 0.168], 0.02, gems[(i + 1) % 3], { k: 0.004 }), sph([Math.cos(a) * 0.176, Y - 0.17, Math.sin(a) * 0.176], 0.02, gems[(i + 2) % 3], { k: 0.004 })); }
    return { rig: 'spin', height: 0.9, parts: [{ name: 'body', pivot: [0, Y, 0], mat: 'metal', res: 0.015, prims: shell }, { name: 'jewels', pivot: [0, Y, 0], mat: 'gloss', res: 0.01, prims: jewels }] };
  });

  // ---------- Mounts ----------
  const wheels = (x, z, r, col = '#1a1a1a') => [tor([x, r, z], r * 0.7, r * 0.3, col, { ax: 'z', mirror: true, k: 0.01 }), tor([-x, r, z], r * 0.7, r * 0.3, col, { ax: 'z', mirror: true, k: 0.01 })];
  def('mount_delorean', () => ({ rig: 'static', height: 0.9, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'metal', res: 0.025, prims: [
    box([0, 0.38, 0], [0.85, 0.16, 0.42], 0.08, '#c9ced6'), box([-0.1, 0.62, 0], [0.38, 0.13, 0.36], 0.1, '#c9ced6', { k: 0.06 }),
    box([0.12, 0.64, 0], [0.12, 0.1, 0.34], 0.06, '#1a2430', P), box([-0.25, 0.64, 0], [0.16, 0.08, 0.37], 0.04, '#1a2430', P),
    box([-0.75, 0.42, 0], [0.12, 0.06, 0.4], 0.02, '#333', P), box([0.86, 0.38, 0.28], [0.02, 0.04, 0.08], 0.01, '#fffbe0', pm({})),
    box([-0.86, 0.4, 0.28], [0.02, 0.04, 0.1], 0.01, '#ff2a2a', pm({})),
    ...wheels(0.52, 0.42, 0.17),
  ] }], extras: [{ to: 'body', kind: 'flame', at: [-0.95, 0.35, 0], glow: '#ff7a1a', size: 0.12 }, { to: 'body', kind: 'eyes', glow: '#5fd0ff', at: [-0.3, 0.75, 0], single: true, size: 0.05 }] }));
  def('mount_batmobile', () => ({ rig: 'static', height: 0.8, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.025, prims: [
    box([0, 0.32, 0], [1.0, 0.13, 0.46], 0.08, '#18181c'), box([0.5, 0.36, 0], [0.5, 0.08, 0.3], 0.06, '#1f1f24', { k: 0.08 }),
    ell([-0.15, 0.55, 0], [0.32, 0.14, 0.24], '#101014', { k: 0.05 }), ell([-0.1, 0.6, 0], [0.22, 0.08, 0.2], '#2a3a4a', P),
    box([-0.75, 0.62, 0.38], [0.18, 0.2, 0.02], 0.02, '#18181c', { mirror: true, rot: [0, 0, 0.5], k: 0.04 }),
    ...wheels(0.6, 0.46, 0.2, '#0a0a0a'),
  ] }], extras: [{ to: 'body', kind: 'flame', at: [-1.08, 0.33, 0], glow: '#ff6a1a', size: 0.16 }] }));
  def('mount_ecto1', () => ({ rig: 'static', height: 1.0, parts: [{ name: 'body', pivot: [0, 0, 0], mat: 'gloss', res: 0.025, prims: [
    box([0, 0.4, 0], [1.0, 0.18, 0.42], 0.08, '#f2f2f2'), box([-0.15, 0.68, 0], [0.5, 0.14, 0.38], 0.08, '#f2f2f2', { k: 0.05 }),
    box([0.2, 0.7, 0], [0.1, 0.1, 0.36], 0.04, '#1a2430', P), box([-0.85, 0.55, 0.36], [0.2, 0.18, 0.02], 0.02, '#e23636', { mirror: true, rot: [0, 0, 0.4] }),
    box([-0.2, 0.88, 0], [0.4, 0.05, 0.3], 0.02, '#c8ccd2', { k: 0.02 }), box([0.3, 0.42, 0.42], [0.25, 0.1, 0.01], 0, '#e23636', pm({})),
    ...wheels(0.6, 0.42, 0.18),
  ] }], extras: [{ to: 'body', kind: 'eyes', glow: '#ff3030', at: [-0.05, 0.98, 0.12] }] }));
  def('mount_nimbus', () => ({ rig: 'static', height: 0.4, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.015, prims: [
    cap([0.75, 0.42, 0], [-0.35, 0.38, 0], 0.035, '#7a4a20'),
    ...[-0.06, -0.03, 0, 0.03, 0.06].map((z) => cap([-0.35, 0.38, z * 0.5], [-0.85, 0.36 + z * 0.8, z * 2.2], [0.03, 0.015], '#d8b060', { k: 0.02 })),
    tor([-0.33, 0.38, 0], 0.05, 0.015, '#d8b040', { ax: 'x' }),
  ] }] }));
  def('mount_elytra', () => ({ rig: 'static', height: 0.4, parts: [{ name: 'body', pivot: [0, 0, 0], res: 0.02, prims: [
    ell([-0.3, 1.0, 0.35], [0.06, 0.38, 0.32], '#8a8aa8', { mirror: true, rot: [0.5, 0, 0.35] }),
    cap([-0.18, 1.15, 0.1], [-0.4, 1.2, 0.6], 0.03, '#6a6a88', { mirror: true }),
  ] }] }));

  // ---------- Model assembly (geometry cache + rig lookup) ----------
  NX.Models = {
    cache: new Map(),   // key -> { spec, geoms: [BufferGeometry per part] }
    has: (key) => !!DEFS[key.split(':')[0]],
    spec(key) {
      const [base, arg] = key.split(':');
      const fn = DEFS[base];
      return fn ? fn(arg) : null;
    },
  };
})();
