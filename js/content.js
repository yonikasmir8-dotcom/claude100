// CONTENT — every fandom, enemy, weapon, boss, relic, mount and line of dialogue.
// Adding a fandom = add a theme + enemies here (+ art palettes in js/art.js).
// See FEEDBACK_LOOP.md → "Recipe: add a fandom sector".
(() => {
  'use strict';
  const NX = window.NX;

  // ---------- Tiles ----------
  // FORCE = the IOI forcefield around Anorak's Castle: blocks walking, flying, ghosts and every shot; never mined.
  const T = NX.T = { FLOOR: 0, WALL: 1, WATER: 2, ROAD: 3, DECOR: 4, BREAK: 5, QBLOCK: 6, USED: 7, PELLET: 8, POWER: 9, GATE: 10, VOID: 11, GRASS: 12, PROP: 13, ALTAR: 14, FORCE: 15 };
  NX.SOLID = new Set([T.WALL, T.WATER, T.BREAK, T.QBLOCK, T.USED, T.VOID, T.PROP, T.ALTAR, T.FORCE]);
  NX.STOPS_SHOTS = new Set([T.WALL, T.BREAK, T.QBLOCK, T.USED, T.VOID, T.PROP, T.ALTAR, T.FORCE]);

  // ---------- Fandom sectors ----------
  // gen: natural (noise terrain) | maze | city | grid | hub
  // wall styles live in js/art.js. weather: rain | ash | snow | sparks
  NX.THEMES = {
    hub: { name: 'Nexus Prime', fandom: 'The Hub', map: '#c9c3ff', gen: 'hub', safe: true,
      floor: ['#2f3350', '#2b2f4a'], road: '#454b70', wall: 'neonwall', wallColor: '#7b5cff', prop: 'statue', enemies: [], count: [0, 0], loot: [] },

    galaxy: { name: 'Galaxy Far, Far Away', fandom: 'Star Wars', map: '#e0b870', gen: 'natural',
      floor: ['#dcb97e', '#d6b277'], road: '#c39b5e', wall: 'mesa', wallColor: '#a5703f', wallTop: '#c98c55',
      wallAt: 0.66, scale: 0.09, decor: 'bones', decorChance: 0.012, prop: 'vaporator', propChance: 0.006,
      enemies: [['stormtrooper', 6], ['tusken', 3], ['probedroid', 2]], count: [6, 10], loot: ['blaster', 'lightsaber'],
      lines: ['Move along, gunter. These aren\'t the keys you\'re looking for... or are they?', 'I swear the troopers out here have never hit anything.'] },

    pocket: { name: 'Pocket Monster Plains', fandom: 'Pokémon', map: '#7cd65c', gen: 'natural',
      floor: ['#88d468', '#80cc60'], road: '#dcc58c', wall: 'tree', wallColor: '#2f8a3a',
      wallAt: 0.7, scale: 0.12, water: 0.72, waterColor: '#4a9be0', grass: 0.55, decor: 'flowers', decorChance: 0.02,
      enemies: [['pikachu', 3], ['charmander', 3], ['squirtle', 3], ['bulbasaur', 3], ['pidgey', 3]], count: [7, 11], loot: ['pokeballs'],
      lines: ['Gotta catch \'em all — and by "all" I mean ALL. Try a Poké Ball on a Stormtrooper.', 'Something legendary and psychic lives deep in the plains...'] },

    mushroom: { name: 'Mushroom Kingdom', fandom: 'Super Mario', map: '#ff6b5a', gen: 'natural',
      floor: ['#6ccc4c', '#66c446'], road: '#ecc677', wall: 'brick', wallColor: '#c4602c',
      wallAt: 0.7, scale: 0.13, breakAt: 0.64, breakStyle: 'brick', qblocks: 0.006, prop: 'pipe', propChance: 0.005, decor: 'flowers', decorChance: 0.01,
      enemies: [['goomba', 6], ['koopa', 3], ['piranha', 2]], count: [7, 11], loot: ['fireflower'],
      lines: ['Thank you gunter! But your key is in another castle.', 'Kick a Koopa shell into a crowd. Trust me.'] },

    hyrule: { name: 'Hyrule Field', fandom: 'The Legend of Zelda', map: '#3fae6a', gen: 'natural',
      floor: ['#5fbb5a', '#59b354'], road: '#dbc892', wall: 'tree', wallColor: '#1f6e35',
      wallAt: 0.66, scale: 0.1, breakAt: 0.61, breakStyle: 'bush', water: 0.74, waterColor: '#3d8fd6', prop: 'pot', propChance: 0.004, decor: 'flowers', decorChance: 0.01,
      enemies: [['octorok', 5], ['moblin', 3], ['keese', 3]], count: [7, 11], loot: ['mastersword'],
      lines: ['It\'s dangerous to go alone! Take... well, take whatever you find in chests.', 'Cut the bushes. Everyone does it.'] },

    pacmaze: { name: 'Pac-Maze', fandom: 'Pac-Man', map: '#3346ff', gen: 'maze',
      floor: ['#05050f', '#05050f'], road: '#0b0b22', wall: 'neon', wallColor: '#2b3cff',
      enemies: [['blinky', 1], ['pinky', 1], ['inky', 1], ['clyde', 1]], count: [4, 7], loot: [],
      lines: ['Waka waka. The Power Pellets are in the corners.', 'A perfect game wins an extra life. Allegedly.'] },

    blocklands: { name: 'Blocklands', fandom: 'Minecraft', map: '#8b5a2b', gen: 'natural',
      floor: ['#6aa84f', '#64a049'], road: '#9b7653', wall: 'stone', wallColor: '#7f7f7f',
      wallAt: 0.64, scale: 0.08, breakAt: 0.6, breakStyle: 'ore', water: 0.73, waterColor: '#3f76e4', prop: 'blocktree', propChance: 0.012,
      enemies: [['creeper', 4], ['zombie', 4], ['skeleton', 3]], count: [7, 11], loot: ['pickaxe'],
      lines: ['Ssssss... oh, that was just me. Sorry.', 'They say a dragon guards the far edge of the Blocklands. Its wings let you fly.'] },

    ghostcity: { name: 'Spook City', fandom: 'Ghostbusters', map: '#8a5cd6', gen: 'city',
      floor: ['#2c2a35', '#2a2832'], road: '#3b3846', wall: 'building', wallColor: '#4a4458', windows: '#ffd76a', prop: 'lamp',
      enemies: [['slimer', 4], ['marshmallow', 3], ['libraryghost', 2]], count: [6, 10], loot: ['protonpack'], weather: 'ash',
      lines: ['Don\'t cross the streams. Actually — do. It\'s a video game.', 'I saw a 100-foot marshmallow man downtown. Nobody believes me.'] },

    grid: { name: 'The Grid', fandom: 'TRON × The Matrix', map: '#18e0ff', gen: 'grid',
      floor: ['#05121a', '#05121a'], road: '#08202b', wall: 'gridwall', wallColor: '#18e0ff',
      enemies: [['program', 4], ['agent', 3]], count: [6, 9], loot: ['lightdisc'],
      lines: ['There is no spoon. There IS an Identity Disc in a chest somewhere.', 'Agent Smith keeps copying himself out east.'] },

    marvel: { name: 'Marvel Metropolis', fandom: 'Marvel', map: '#e23636', gen: 'city',
      floor: ['#3a3d44', '#373a41'], road: '#4a4d55', wall: 'building', wallColor: '#28324a', windows: '#8fd3ff', prop: 'lamp',
      enemies: [['chitauri', 5], ['ultron', 3], ['hydra', 3]], count: [7, 11], loot: ['mjolnir', 'capshield', 'webshooter', 'repulsors'],
      lines: ['Avengers... assemble? Just me? Okay.', 'A purple titan is collecting shiny stones somewhere out here.'] },

    dc: { name: 'Gotham City', fandom: 'DC', map: '#2f4f7f', gen: 'city',
      floor: ['#24262c', '#222429'], road: '#30333a', wall: 'building', wallColor: '#1c1e26', windows: '#e8c060', prop: 'lamp',
      enemies: [['goon', 5], ['parademon', 3], ['robopenguin', 3]], count: [7, 11], loot: ['batarang', 'lasso', 'lanternring', 'batmobile'], weather: 'rain',
      lines: ['Why so serious? Oh — you\'re hunting the egg. That IS serious.', 'Darkseid opened a boom tube way out past the city limits.'] },

    hogwarts: { name: 'Wizarding Grounds', fandom: 'Harry Potter', map: '#8e6bd6', gen: 'natural',
      floor: ['#4f8a4a', '#4b8446'], road: '#a89a7a', wall: 'castle', wallColor: '#6d6a78',
      wallAt: 0.65, scale: 0.09, water: 0.75, waterColor: '#2d4f7a', prop: 'candle', propChance: 0.006, decor: 'flowers', decorChance: 0.006,
      enemies: [['deatheater', 4], ['dementor', 3], ['acromantula', 3]], count: [7, 10], loot: ['elderwand', 'nimbus'], weather: 'snow',
      lines: ['Ten points to your house for making it this far.', 'He-Who-Must-Not-Be-Named is hiding somewhere in these grounds.'] },

    middleearth: { name: 'Middle-earth', fandom: 'The Lord of the Rings', map: '#9a8a5a', gen: 'natural',
      floor: ['#7f9a5a', '#7a9455'], road: '#b0a070', wall: 'mesa', wallColor: '#6f6a64', wallTop: '#8a857e',
      wallAt: 0.64, scale: 0.07, water: 0.76, waterColor: '#4f7fa8', prop: 'tree2', propChance: 0.01, decor: 'flowers', decorChance: 0.006,
      enemies: [['orc', 5], ['uruk', 3], ['nazgul', 2]], count: [7, 11], loot: ['sting'],
      lines: ['One does not simply walk into the next sector. Okay, you do. It\'s fine.', 'Something of shadow and flame sleeps under the far mountains.'] },

    jurassic: { name: 'Isla Nublar', fandom: 'Jurassic Park', map: '#4f8f2f', gen: 'natural',
      floor: ['#4a8a3a', '#468436'], road: '#9a8a5a', wall: 'tree', wallColor: '#2a6a2a',
      wallAt: 0.62, scale: 0.11, water: 0.74, waterColor: '#3a8a8a', prop: 'fence', propChance: 0.006, grass: 0.6,
      enemies: [['raptor', 4], ['dilophosaurus', 3], ['compy', 3]], count: [7, 11], loot: ['tranqrifle'],
      lines: ['Life, uh, finds a way. So do raptors. Into this sector.', 'Objects in mirror are closer than they appear. Keep moving.'] },

    halo: { name: 'Installation 04', fandom: 'Halo', map: '#5f9ea0', gen: 'natural',
      floor: ['#5a8a7a', '#568474'], road: '#8a9aa0', wall: 'forerunner', wallColor: '#6f7a86',
      wallAt: 0.66, scale: 0.08, water: 0.75, waterColor: '#3f8fb0', decor: 'flowers', decorChance: 0.004,
      enemies: [['grunt', 5], ['elite', 3], ['flood', 3]], count: [7, 11], loot: ['energysword'],
      lines: ['Wort wort wort.', 'Need a weapon? Grab the Energy Sword. Lunge with it.'] },

    startrek: { name: 'Starfleet Deck 7', fandom: 'Star Trek', map: '#f7a83a', gen: 'city',
      floor: ['#30323a', '#2e3038'], road: '#3a3c46', wall: 'lcars', wallColor: '#4a4c58', prop: 'console',
      enemies: [['borg', 4], ['klingon', 3]], count: [6, 10], loot: ['phaser'],
      lines: ['Resistance is futile. Borg drones adapt to the weapon you spam — switch it up!', 'Set phasers to "fun".'] },

    doctorwho: { name: 'Time Vortex London', fandom: 'Doctor Who', map: '#2a5dbf', gen: 'city',
      floor: ['#3a3f48', '#373c45'], road: '#454a55', wall: 'brickhouse', wallColor: '#8a4a3a', prop: 'tardis',
      enemies: [['dalek', 4], ['cyberman', 3], ['angel', 2]], count: [6, 10], loot: ['sonicscrewdriver'],
      lines: ['Don\'t blink. Seriously. Weeping Angels only move when you look away.', 'The blue box is bigger on the inside. Don\'t ask.'] },

    sonic: { name: 'Green Hill Zone', fandom: 'Sonic the Hedgehog', map: '#3fa0ff', gen: 'natural',
      floor: ['#5cd04a', '#56c844'], road: '#d89a4a', wall: 'checker', wallColor: '#b8682a',
      wallAt: 0.68, scale: 0.1, water: 0.76, waterColor: '#3a8aff', prop: 'palm', propChance: 0.008, decor: 'flowers', decorChance: 0.02,
      enemies: [['motobug', 5], ['buzzbomber', 3]], count: [8, 12], loot: ['speedshoes'],
      lines: ['Gotta go fast! The Power Sneakers are around here somewhere.', 'A round guy with a mustache keeps building robots out of animals.'] },

    stranger: { name: 'The Upside Down', fandom: 'Stranger Things', map: '#7a2a3a', gen: 'natural',
      floor: ['#2a2f3a', '#283038'], road: '#3a3640', wall: 'vines', wallColor: '#4a1a24',
      wallAt: 0.63, scale: 0.1, decor: 'spores', decorChance: 0.02, weather: 'ash',
      enemies: [['demogorgon', 3], ['demodog', 5]], count: [7, 11], loot: ['nailbat'],
      lines: ['Friends don\'t lie. The Mind Flayer is real.', 'If the lights start flickering... run.'] },

    namek: { name: 'Planet Namek', fandom: 'Dragon Ball Z', map: '#5fd08a', gen: 'natural',
      floor: ['#6ab8a0', '#64b09a'], road: '#c8c890', wall: 'tree', wallColor: '#2f9a8a',
      wallAt: 0.72, scale: 0.12, water: 0.68, waterColor: '#5fd08a',
      enemies: [['saibaman', 5], ['friezasoldier', 4]], count: [7, 11], loot: ['kamehameha'],
      lines: ['Its power level... it\'s over nine thousand! (It\'s about 40.)', 'Hold attack to charge a Kamehameha. Release. Enjoy.'] },

    portal: { name: 'Aperture Test Chambers', fandom: 'Portal', map: '#e8e8e8', gen: 'grid',
      floor: ['#dfe3e6', '#d8dce0'], road: '#c8cdd2', wall: 'panel', wallColor: '#9aa2aa',
      enemies: [['turret', 5], ['sentrybot', 3]], count: [6, 10], loot: ['portalgun'],
      lines: ['The cake is... well, ask the lady in charge.', 'Portal Gun: fire twice to make a pair. Walk in one, out the other.'] },

    // The campaign finale (pinned by World, never part of the Voronoi pool).
    castle: { name: 'Anorak’s Castle', fandom: 'The Egg Hunt', map: '#ff2a4a', gen: 'castle', safe: false,
      floor: ['#1b1622', '#19141f'], road: '#2b2233', wall: 'obsidian', wallColor: '#2a1a3a', prop: 'statue',
      enemies: [['sixer', 5], ['agent', 2], ['elite', 2], ['uruk', 2]], count: [8, 12], loot: [], weather: 'ash', lines: [] },
  };
  NX.THEME_LIST = Object.keys(NX.THEMES).filter((k) => k !== 'hub' && k !== 'castle');

  // ---------- Enemies ----------
  // ai: chaser | shooter | charger | flyer | ghost | turret | exploder | koopa | critter | angel | boss
  // flags: tag (ghost/robot/orc/dino/alien/undead), passWalls, teleport, adapt, shield, slows, flees, group, shout
  const E = NX.ENEMIES = {
    stormtrooper: { name: 'Stormtrooper', fandom: 'Star Wars', hp: 3, speed: 60, dmg: 1, ai: 'shooter', fire: 1.5, shot: { speed: 230, color: '#ff3030', r: 4 }, jitter: 0.5, art: 'trooper', xp: 3, coins: [1, 3], r: 13, group: [1, 3] },
    tusken: { name: 'Tusken Raider', fandom: 'Star Wars', hp: 4, speed: 75, dmg: 2, ai: 'charger', art: 'tusken', xp: 4, coins: [1, 4], r: 13 },
    probedroid: { name: 'Probe Droid', fandom: 'Star Wars', hp: 2, speed: 85, dmg: 1, ai: 'flyer', fire: 2.4, shot: { speed: 200, color: '#ff6060', r: 3 }, jitter: 0.2, art: 'probe', xp: 3, coins: [1, 2], r: 12, tag: 'robot' },

    pikachu: { name: 'Pikachu', fandom: 'Pokémon', hp: 3, speed: 95, dmg: 1, ai: 'critter', attack: 'shooter', fire: 1.3, shot: { speed: 270, color: '#ffe23a', r: 5, kind: 'zap' }, jitter: 0.15, art: 'critter', colors: { body: '#ffd83a', ear: '#222', cheek: '#ff4a3a', pika: 1 }, xp: 4, coins: [1, 3], r: 12, catchBonus: 1.5 },
    charmander: { name: 'Charmander', fandom: 'Pokémon', hp: 4, speed: 80, dmg: 2, ai: 'critter', attack: 'charger', art: 'critter', colors: { body: '#ff8a3a', belly: '#ffe0a0', tail: '#ff3a1a' }, xp: 4, coins: [1, 3], r: 12, catchBonus: 1.2 },
    squirtle: { name: 'Squirtle', fandom: 'Pokémon', hp: 5, speed: 60, dmg: 1, ai: 'critter', attack: 'shooter', fire: 1.8, shot: { speed: 170, color: '#7fd0ff', r: 7, kind: 'bubble' }, jitter: 0.1, art: 'critter', colors: { body: '#6ab4ff', shell: '#a0612a' }, xp: 4, coins: [1, 3], r: 12, catchBonus: 1.2 },
    bulbasaur: { name: 'Bulbasaur', fandom: 'Pokémon', hp: 5, speed: 55, dmg: 1, ai: 'critter', attack: 'shooter', fire: 1.6, shot: { speed: 220, color: '#5be05b', r: 5, kind: 'leaf' }, jitter: 0.12, art: 'critter', colors: { body: '#5fc8a0', bulb: '#2f9a4a' }, xp: 4, coins: [1, 3], r: 12, catchBonus: 1.2 },
    pidgey: { name: 'Pidgey', fandom: 'Pokémon', hp: 2, speed: 110, dmg: 1, ai: 'flyer', art: 'bird', colors: { body: '#b0844f', belly: '#f2dcb0' }, xp: 2, coins: [1, 2], r: 11, catchBonus: 1.5 },

    goomba: { name: 'Goomba', fandom: 'Super Mario', hp: 2, speed: 50, dmg: 1, ai: 'chaser', art: 'goomba', xp: 2, coins: [1, 3], r: 12, group: [1, 3] },
    koopa: { name: 'Koopa Troopa', fandom: 'Super Mario', hp: 3, speed: 55, dmg: 1, ai: 'koopa', art: 'koopa', xp: 3, coins: [2, 4], r: 12 },
    piranha: { name: 'Piranha Plant', fandom: 'Super Mario', hp: 4, speed: 0, dmg: 1, ai: 'turret', fire: 1.7, shot: { speed: 210, color: '#ff7a1a', r: 6, kind: 'fireball' }, jitter: 0.08, art: 'piranha', xp: 4, coins: [2, 4], r: 13 },

    octorok: { name: 'Octorok', fandom: 'Zelda', hp: 2, speed: 55, dmg: 1, ai: 'shooter', fire: 1.8, shot: { speed: 220, color: '#9a8a7a', r: 5, kind: 'rock' }, jitter: 0.05, art: 'octorok', xp: 3, coins: [1, 3], r: 12 },
    moblin: { name: 'Moblin', fandom: 'Zelda', hp: 6, speed: 65, dmg: 2, ai: 'chaser', art: 'moblin', xp: 5, coins: [2, 5], r: 14, tag: 'orc' },
    keese: { name: 'Keese', fandom: 'Zelda', hp: 1, speed: 150, dmg: 1, ai: 'flyer', art: 'bat', xp: 2, coins: [0, 2], r: 10, group: [2, 4] },

    blinky: { name: 'Blinky', fandom: 'Pac-Man', hp: 4, speed: 88, dmg: 1, ai: 'ghost', art: 'pacghost', color: '#ff2020', tag: 'ghost', xp: 4, coins: [2, 4], r: 13 },
    pinky: { name: 'Pinky', fandom: 'Pac-Man', hp: 4, speed: 82, dmg: 1, ai: 'ghost', art: 'pacghost', color: '#ffb8ff', tag: 'ghost', xp: 4, coins: [2, 4], r: 13 },
    inky: { name: 'Inky', fandom: 'Pac-Man', hp: 4, speed: 78, dmg: 1, ai: 'ghost', art: 'pacghost', color: '#00ffff', tag: 'ghost', xp: 4, coins: [2, 4], r: 13 },
    clyde: { name: 'Clyde', fandom: 'Pac-Man', hp: 4, speed: 72, dmg: 1, ai: 'ghost', art: 'pacghost', color: '#ffb852', tag: 'ghost', xp: 4, coins: [2, 4], r: 13 },

    creeper: { name: 'Creeper', fandom: 'Minecraft', hp: 3, speed: 70, dmg: 0, ai: 'exploder', blast: { r: 72, dmg: 4 }, art: 'creeper', xp: 4, coins: [1, 4], r: 12 },
    zombie: { name: 'Zombie', fandom: 'Minecraft', hp: 5, speed: 45, dmg: 2, ai: 'chaser', art: 'zombie', xp: 4, coins: [1, 3], r: 13, tag: 'undead', group: [1, 3] },
    skeleton: { name: 'Skeleton', fandom: 'Minecraft', hp: 3, speed: 55, dmg: 1, ai: 'shooter', fire: 1.6, shot: { speed: 280, color: '#dddddd', r: 3, kind: 'arrow' }, jitter: 0.1, art: 'skeleton', xp: 4, coins: [1, 3], r: 12, tag: 'undead' },

    slimer: { name: 'Slimer', fandom: 'Ghostbusters', hp: 5, speed: 70, dmg: 1, ai: 'ghost', art: 'slimer', tag: 'ghost', xp: 4, coins: [2, 4], r: 14 },
    marshmallow: { name: 'Stay Puft Minion', fandom: 'Ghostbusters', hp: 4, speed: 55, dmg: 2, ai: 'chaser', art: 'marshmallow', xp: 4, coins: [1, 4], r: 13 },
    libraryghost: { name: 'Library Ghost', fandom: 'Ghostbusters', hp: 6, speed: 50, dmg: 1, ai: 'shooter', passWalls: true, fire: 2.0, shot: { speed: 180, color: '#c9a0ff', r: 6, kind: 'orb' }, jitter: 0.1, art: 'libraryghost', tag: 'ghost', xp: 5, coins: [2, 5], r: 14 },

    program: { name: 'Program', fandom: 'TRON', hp: 4, speed: 85, dmg: 2, ai: 'charger', art: 'program', xp: 4, coins: [2, 4], r: 12, tag: 'robot' },
    agent: { name: 'Agent', fandom: 'The Matrix', hp: 6, speed: 90, dmg: 1, ai: 'shooter', strafe: true, fire: 1.0, shot: { speed: 320, color: '#b6ff9a', r: 3 }, jitter: 0.08, art: 'agent', xp: 6, coins: [3, 6], r: 13, shout: 'Mr. Anderson...' },

    chitauri: { name: 'Chitauri', fandom: 'Marvel', hp: 4, speed: 75, dmg: 1, ai: 'shooter', fire: 1.3, shot: { speed: 260, color: '#5fffd0', r: 4 }, jitter: 0.2, art: 'chitauri', xp: 4, coins: [2, 4], r: 13, tag: 'alien', group: [2, 4] },
    ultron: { name: 'Ultron Sentry', fandom: 'Marvel', hp: 4, speed: 95, dmg: 1, ai: 'flyer', fire: 1.6, shot: { speed: 280, color: '#ff4040', r: 4 }, jitter: 0.12, art: 'ultron', xp: 5, coins: [2, 5], r: 13, tag: 'robot' },
    hydra: { name: 'Hydra Agent', fandom: 'Marvel', hp: 5, speed: 70, dmg: 1, ai: 'shooter', strafe: true, fire: 1.2, shot: { speed: 270, color: '#7ab0ff', r: 4 }, jitter: 0.15, art: 'hydra', xp: 5, coins: [2, 5], r: 13, shout: 'Hail... uh, hi.' },

    goon: { name: 'Joker Goon', fandom: 'DC', hp: 4, speed: 80, dmg: 2, ai: 'chaser', art: 'goon', xp: 4, coins: [2, 5], r: 13, group: [2, 4] },
    parademon: { name: 'Parademon', fandom: 'DC', hp: 4, speed: 115, dmg: 1, ai: 'flyer', art: 'parademon', xp: 5, coins: [2, 5], r: 13, tag: 'alien' },
    robopenguin: { name: 'Robo-Penguin', fandom: 'DC', hp: 2, speed: 85, dmg: 0, ai: 'exploder', blast: { r: 60, dmg: 3 }, art: 'penguin', xp: 3, coins: [1, 3], r: 10, tag: 'robot', group: [2, 3] },

    deatheater: { name: 'Death Eater', fandom: 'Harry Potter', hp: 5, speed: 70, dmg: 1, ai: 'shooter', teleport: 4, fire: 1.4, shot: { speed: 260, color: '#50ff50', r: 4 }, jitter: 0.1, art: 'deatheater', xp: 5, coins: [2, 5], r: 13 },
    dementor: { name: 'Dementor', fandom: 'Harry Potter', hp: 5, speed: 70, dmg: 1, ai: 'ghost', slows: 2, art: 'dementor', tag: 'ghost', xp: 5, coins: [2, 5], r: 14 },
    acromantula: { name: 'Acromantula', fandom: 'Harry Potter', hp: 5, speed: 95, dmg: 2, ai: 'charger', art: 'spider', colors: { body: '#2a2420', eye: '#ff3030' }, xp: 5, coins: [2, 4], r: 14 },

    orc: { name: 'Orc', fandom: 'The Lord of the Rings', hp: 4, speed: 70, dmg: 2, ai: 'chaser', art: 'orc', xp: 4, coins: [1, 4], r: 13, tag: 'orc', group: [2, 4] },
    uruk: { name: 'Uruk-hai Archer', fandom: 'The Lord of the Rings', hp: 5, speed: 60, dmg: 1, ai: 'shooter', fire: 1.5, shot: { speed: 300, color: '#cccccc', r: 3, kind: 'arrow' }, jitter: 0.08, art: 'uruk', xp: 5, coins: [2, 4], r: 13, tag: 'orc' },
    nazgul: { name: 'Nazgûl', fandom: 'The Lord of the Rings', hp: 7, speed: 85, dmg: 2, ai: 'charger', art: 'nazgul', xp: 7, coins: [3, 6], r: 14, tag: 'undead', shout: 'Shhhire... Baggins...' },

    raptor: { name: 'Velociraptor', fandom: 'Jurassic Park', hp: 4, speed: 110, dmg: 2, ai: 'charger', art: 'dino', colors: { body: '#8a7a4a', stripe: '#5a4a2a' }, xp: 5, coins: [2, 4], r: 13, tag: 'dino', group: [2, 3] },
    dilophosaurus: { name: 'Dilophosaurus', fandom: 'Jurassic Park', hp: 4, speed: 55, dmg: 1, ai: 'shooter', fire: 1.7, shot: { speed: 200, color: '#b6ff3a', r: 6, kind: 'orb' }, jitter: 0.1, art: 'dino', colors: { body: '#6a9a3a', stripe: '#3a5a2a', frill: '#ff7a3a' }, xp: 4, coins: [1, 4], r: 13, tag: 'dino' },
    compy: { name: 'Compy', fandom: 'Jurassic Park', hp: 1, speed: 120, dmg: 1, ai: 'chaser', art: 'dino', colors: { body: '#9ab04a', stripe: '#6a8a3a' }, scale: 0.6, xp: 1, coins: [0, 1], r: 8, tag: 'dino', group: [4, 7] },

    grunt: { name: 'Grunt', fandom: 'Halo', hp: 3, speed: 70, dmg: 1, ai: 'shooter', flees: true, fire: 1.4, shot: { speed: 220, color: '#7affb0', r: 5, kind: 'orb' }, jitter: 0.2, art: 'grunt', xp: 3, coins: [1, 3], r: 11, tag: 'alien', group: [2, 4], shout: 'Wort wort wort!' },
    elite: { name: 'Elite', fandom: 'Halo', hp: 6, speed: 85, dmg: 2, ai: 'shooter', strafe: true, shield: 4, fire: 1.1, shot: { speed: 280, color: '#5fa0ff', r: 5, kind: 'orb' }, jitter: 0.08, art: 'elite', xp: 7, coins: [3, 6], r: 14, tag: 'alien' },
    flood: { name: 'Flood Infection', fandom: 'Halo', hp: 1, speed: 105, dmg: 1, ai: 'chaser', art: 'flood', xp: 1, coins: [0, 1], r: 9, tag: 'alien', group: [4, 7] },

    borg: { name: 'Borg Drone', fandom: 'Star Trek', hp: 7, speed: 40, dmg: 2, ai: 'chaser', adapt: 6, art: 'borg', xp: 6, coins: [2, 5], r: 13, tag: 'robot', shout: 'Resistance is futile.' },
    klingon: { name: 'Klingon Warrior', fandom: 'Star Trek', hp: 6, speed: 85, dmg: 2, ai: 'charger', art: 'klingon', xp: 6, coins: [2, 5], r: 14, shout: 'Today is a good day to... lose to you, apparently.' },

    dalek: { name: 'Dalek', fandom: 'Doctor Who', hp: 6, speed: 45, dmg: 2, ai: 'shooter', fire: 1.6, shot: { speed: 330, color: '#5fd0ff', r: 4 }, jitter: 0.06, art: 'dalek', xp: 6, coins: [2, 5], r: 14, tag: 'robot', shout: 'EXTERMINATE!' },
    cyberman: { name: 'Cyberman', fandom: 'Doctor Who', hp: 6, speed: 55, dmg: 2, ai: 'chaser', art: 'cyberman', xp: 5, coins: [2, 5], r: 13, tag: 'robot', shout: 'DELETE. DELETE.' },
    angel: { name: 'Weeping Angel', fandom: 'Doctor Who', hp: 8, speed: 260, dmg: 3, ai: 'angel', art: 'angel', xp: 8, coins: [3, 6], r: 13 },

    motobug: { name: 'Motobug', fandom: 'Sonic', hp: 2, speed: 95, dmg: 1, ai: 'charger', art: 'motobug', xp: 3, coins: [1, 3], r: 12, tag: 'robot', group: [1, 3] },
    buzzbomber: { name: 'Buzz Bomber', fandom: 'Sonic', hp: 2, speed: 110, dmg: 1, ai: 'flyer', fire: 1.6, shot: { speed: 240, color: '#ff8a3a', r: 4 }, jitter: 0.1, art: 'buzzbomber', xp: 3, coins: [1, 3], r: 12, tag: 'robot' },

    demogorgon: { name: 'Demogorgon', fandom: 'Stranger Things', hp: 9, speed: 95, dmg: 3, ai: 'charger', teleport: 5, art: 'demogorgon', xp: 9, coins: [3, 7], r: 15 },
    demodog: { name: 'Demodog', fandom: 'Stranger Things', hp: 3, speed: 115, dmg: 1, ai: 'chaser', art: 'demodog', xp: 3, coins: [1, 3], r: 11, group: [3, 5] },

    saibaman: { name: 'Saibaman', fandom: 'Dragon Ball Z', hp: 3, speed: 100, dmg: 0, ai: 'exploder', blast: { r: 64, dmg: 4 }, art: 'saibaman', xp: 4, coins: [1, 3], r: 11, group: [2, 4] },
    friezasoldier: { name: 'Frieza Soldier', fandom: 'Dragon Ball Z', hp: 5, speed: 75, dmg: 1, ai: 'shooter', fire: 1.2, shot: { speed: 280, color: '#ffe066', r: 5, kind: 'orb' }, jitter: 0.12, art: 'friezasoldier', xp: 5, coins: [2, 5], r: 13, shout: 'His power level is OFF THE CHARTS!' },

    turret: { name: 'Aperture Turret', fandom: 'Portal', hp: 3, speed: 0, dmg: 1, ai: 'turret', fire: 0.35, burst: 4, shot: { speed: 380, color: '#ffd23f', r: 3 }, jitter: 0.12, art: 'turret', xp: 4, coins: [1, 4], r: 11, tag: 'robot', shout: 'I see you.' },
    sentrybot: { name: 'Sentry Bot', fandom: 'Portal', hp: 4, speed: 85, dmg: 1, ai: 'chaser', art: 'sentry', xp: 4, coins: [1, 4], r: 12, tag: 'robot' },

    sixer: { name: 'Sixer', fandom: 'IOI', hp: 5, speed: 72, dmg: 1, ai: 'shooter', fire: 1.2, shot: { speed: 260, color: '#ff9b3d', r: 4 }, jitter: 0.2, art: 'sixer', xp: 6, coins: [3, 7], r: 13, noCatch: true, group: [2, 4] },
    shieldgen: { name: 'IOI Shield Pylon', fandom: 'IOI', hp: 60, speed: 0, dmg: 1, ai: 'turret', fire: 1.6, burst: 3, shot: { speed: 300, color: '#ff9b3d', r: 5 }, jitter: 0.1, art: 'shieldgen', xp: 30, coins: [10, 20], r: 18, noCatch: true, tag: 'robot', generator: true },
  };

  // ---------- Bosses (key guardians, raid bosses, world events) ----------
  // patterns: boomerang | ring | dash | summon | teleport | spread | spiral | laser | stomp
  const boss = (o) => Object.assign({ ai: 'boss', boss: true, noCatch: true, dmg: 2, speed: 75, r: 24 }, o);
  Object.assign(E, {
    darklord: boss({ name: 'The Dark Lord', fandom: 'Star Wars', hp: 120, art: 'darklord', xp: 60, coins: [60, 80], patterns: ['boomerang', 'ring', 'dash', 'summon'], summon: 'stormtrooper', color: '#ff2a2a', shout: 'I find your lack of keys... disturbing.' }),
    ganon: boss({ name: 'Ganon, the Boar King', fandom: 'Zelda', hp: 180, speed: 70, dmg: 3, art: 'ganon', xp: 90, coins: [90, 120], r: 26, patterns: ['teleport', 'ring', 'spread', 'summon'], summon: 'moblin', color: '#ff7a1a' }),
    bigghost: boss({ name: 'Blinky XL', fandom: 'Pac-Man', hp: 240, speed: 95, dmg: 3, art: 'bigghost', xp: 130, coins: [130, 160], r: 30, passWalls: true, patterns: ['spiral', 'dash', 'summon', 'spread'], summon: 'pinky', color: '#ff2020', tag: 'ghost' }),

    mewtwo: boss({ name: 'Mewtwo', fandom: 'Pokémon', hp: 200, art: 'mewtwo', xp: 100, coins: [100, 140], patterns: ['teleport', 'spiral', 'ring', 'summon'], summon: 'pikachu', color: '#c070ff', shout: '...' }),
    bowser: boss({ name: 'Bowser', fandom: 'Super Mario', hp: 220, speed: 65, dmg: 3, art: 'bowser', xp: 110, coins: [150, 200], r: 30, patterns: ['spread', 'stomp', 'dash', 'summon'], summon: 'goomba', color: '#ff7a1a', shotKind: 'fireball', shout: 'BWAHAHAHA!' }),
    enderdragon: boss({ name: 'Ender Dragon', fandom: 'Minecraft', hp: 260, speed: 110, dmg: 3, art: 'enderdragon', xp: 130, coins: [120, 160], r: 32, fly: true, passWalls: true, patterns: ['dash', 'spread', 'ring', 'summon'], summon: 'creeper', color: '#d070ff', shotKind: 'orb' }),
    staypuft: boss({ name: 'Stay Puft Marshmallow Man', fandom: 'Ghostbusters', hp: 260, speed: 55, dmg: 3, art: 'staypuft', xp: 120, coins: [120, 160], r: 34, patterns: ['stomp', 'spread', 'summon', 'stomp'], summon: 'marshmallow', color: '#ffffff', shout: 'He looks... delicious?' }),
    smith: boss({ name: 'Agent Smith (×∞)', fandom: 'The Matrix', hp: 200, speed: 100, art: 'smith', xp: 110, coins: [110, 150], patterns: ['summon', 'spread', 'dash', 'summon'], summon: 'agent', color: '#b6ff9a', shout: 'Me, me, me... me too.' }),
    thanos: boss({ name: 'Thanos', fandom: 'Marvel', hp: 320, speed: 70, dmg: 4, art: 'thanos', xp: 180, coins: [200, 260], r: 30, patterns: ['ring', 'teleport', 'spiral', 'laser', 'summon'], summon: 'chitauri', color: '#c070ff', shout: 'I am... inevitable.' }),
    darkseid: boss({ name: 'Darkseid', fandom: 'DC', hp: 320, speed: 65, dmg: 4, art: 'darkseid', xp: 180, coins: [200, 260], r: 30, patterns: ['laser', 'stomp', 'summon', 'laser', 'teleport'], summon: 'parademon', color: '#ff3a1a', shout: 'DARKSEID IS.' }),
    voldemort: boss({ name: 'He-Who-Must-Not-Be-Named', fandom: 'Harry Potter', hp: 240, speed: 80, art: 'voldemort', xp: 130, coins: [130, 170], patterns: ['spread', 'teleport', 'summon', 'laser'], summon: 'deatheater', color: '#50ff50', shout: 'Avada— no, wait, this is rated E.' }),
    balrog: boss({ name: 'The Balrog', fandom: 'The Lord of the Rings', hp: 300, speed: 60, dmg: 4, art: 'balrog', xp: 160, coins: [160, 220], r: 36, patterns: ['stomp', 'ring', 'dash', 'laser'], color: '#ff6a1a', shotKind: 'fireball', shout: 'YOU SHALL NOT PASS? No — that\'s YOUR line.' }),
    trex: boss({ name: 'Tyrannosaurus Rex', fandom: 'Jurassic Park', hp: 280, speed: 95, dmg: 4, art: 'trex', xp: 150, coins: [150, 200], r: 34, patterns: ['dash', 'stomp', 'summon', 'dash'], summon: 'raptor', color: '#ff3a1a', shout: 'ROOOOOAR' }),
    zealot: boss({ name: 'Elite Zealot', fandom: 'Halo', hp: 230, speed: 110, art: 'zealot', xp: 120, coins: [130, 170], patterns: ['dash', 'spread', 'teleport', 'summon'], summon: 'grunt', color: '#5fa0ff', shotKind: 'orb' }),
    borgqueen: boss({ name: 'The Borg Queen', fandom: 'Star Trek', hp: 260, speed: 50, art: 'borgqueen', xp: 140, coins: [140, 180], adapt: 25, patterns: ['summon', 'laser', 'ring', 'summon'], summon: 'borg', color: '#5fff5f', shout: 'You will be assimilated.' }),
    dalekemperor: boss({ name: 'Dalek Emperor', fandom: 'Doctor Who', hp: 280, speed: 35, dmg: 3, art: 'dalekemperor', xp: 150, coins: [150, 200], r: 32, patterns: ['laser', 'spread', 'summon', 'ring'], summon: 'dalek', color: '#5fd0ff', shout: 'EXTERMINATE! EX-TER-MI-NATE!' }),
    eggman: boss({ name: 'Dr. Eggman', fandom: 'Sonic', hp: 220, speed: 120, art: 'eggman', xp: 120, coins: [200, 260], r: 26, fly: true, patterns: ['dash', 'ring', 'summon', 'spread'], summon: 'motobug', color: '#ff8a3a', shout: 'I hate that hedgehog... and now you!' }),
    mindflayer: boss({ name: 'The Mind Flayer', fandom: 'Stranger Things', hp: 300, speed: 75, dmg: 3, art: 'mindflayer', xp: 160, coins: [160, 220], r: 40, passWalls: true, patterns: ['summon', 'spiral', 'laser', 'stomp'], summon: 'demodog', color: '#ff3a5a' }),
    frieza: boss({ name: 'Frieza', fandom: 'Dragon Ball Z', hp: 280, speed: 115, art: 'frieza', xp: 150, coins: [150, 200], fly: true, patterns: ['laser', 'teleport', 'spread', 'ring'], color: '#ff4af0', shotKind: 'orb', shout: 'This isn\'t even my final form.' }),
    glados: boss({ name: 'GLaDOS', fandom: 'Portal', hp: 240, speed: 0, art: 'glados', xp: 130, coins: [130, 170], r: 30, patterns: ['spiral', 'laser', 'summon', 'ring'], summon: 'turret', color: '#ffd23f', shout: 'Oh. It\'s you.' }),
    godzilla: boss({ name: 'GODZILLA', fandom: 'Godzilla', hp: 420, speed: 70, dmg: 5, art: 'godzilla', xp: 250, coins: [250, 350], r: 44, patterns: ['laser', 'stomp', 'dash', 'laser', 'ring'], color: '#4ad0ff', shout: 'SKREEEEOONK!' }),
    // Castle boss (no passWalls, no fly). Its shout is NX.CAMPAIGN.castle.bossShout (set below).
    ioi655321: boss({ name: 'IOI-655321', fandom: 'IOI', hp: 600, dmg: 3, speed: 80, r: 30, art: 'ioi655321', patterns: ['boomerang', 'ring', 'dash', 'summon', 'teleport', 'spread', 'spiral', 'laser', 'stomp'], summon: 'sixer', color: '#ff9b3d', xp: 400, coins: [300, 400] }),
  });

  // ---------- Weapons ----------
  // kind: melee | gun | beam | charge | disc | portal
  NX.WEAPONS = {
    pixelsword: { name: 'Pixel Sword', fandom: 'Adventure (Atari)', kind: 'melee', dmg: 2, range: 46, arc: 1.7, cd: 0.32, color: '#ffe066' },
    lightsaber: { name: 'Lightsaber', fandom: 'Star Wars', kind: 'melee', dmg: 4, range: 58, arc: 2.4, cd: 0.28, color: '#4fc3ff', reflect: true, sound: 'saber', desc: 'Swings deflect enemy shots back.' },
    blaster: { name: 'E-11 Blaster', fandom: 'Star Wars', kind: 'gun', dmg: 2, cd: 0.2, speed: 560, color: '#ff3b3b', spread: 0.04, sound: 'laser' },
    mastersword: { name: 'Master Sword', fandom: 'Zelda', kind: 'melee', dmg: 3, range: 52, arc: 1.9, cd: 0.3, color: '#bfe3ff', beam: true, desc: 'Fires a sword beam at full health.' },
    fireflower: { name: 'Fire Flower', fandom: 'Super Mario', kind: 'gun', shot: 'fireball', dmg: 3, cd: 0.38, speed: 330, bounces: 4, color: '#ff7a1a', sound: 'fire', breaks: true, desc: 'Bouncing fireballs. Breaks bricks.' },
    pickaxe: { name: 'Diamond Pickaxe', fandom: 'Minecraft', kind: 'melee', dmg: 3, range: 44, arc: 1.3, cd: 0.3, color: '#5ef2e5', mine: true, desc: 'Mines through walls. Any walls.' },
    protonpack: { name: 'Proton Pack', fandom: 'Ghostbusters', kind: 'beam', dps: 7, range: 250, color: '#ff9a3a', bonus: { tag: 'ghost', mult: 3 }, desc: 'Continuous beam. Melts ghosts.' },
    lightdisc: { name: 'Identity Disc', fandom: 'TRON', kind: 'disc', dmg: 4, cd: 0.15, speed: 460, range: 300, color: '#18e0ff', pierce: true, sound: 'disc', desc: 'Thrown, pierces, comes back.' },
    mjolnir: { name: 'Mjölnir', fandom: 'Marvel', kind: 'disc', dmg: 6, cd: 0.2, speed: 420, range: 280, color: '#9adcff', lightning: 3, art: 'hammer', sound: 'disc', desc: 'Thrown hammer. Chain lightning on hit.' },
    capshield: { name: 'Captain\'s Shield', fandom: 'Marvel', kind: 'disc', dmg: 5, cd: 0.2, speed: 480, range: 260, color: '#e23636', ricochet: 5, art: 'shield', sound: 'disc', desc: 'Ricochets between up to 5 enemies.' },
    webshooter: { name: 'Web Shooters', fandom: 'Marvel', kind: 'gun', shot: 'web', dmg: 1, cd: 0.25, speed: 520, color: '#ffffff', root: 2.5, desc: 'Webs stick enemies in place.' },
    repulsors: { name: 'Repulsor Gauntlets', fandom: 'Marvel', kind: 'gun', dmg: 3, cd: 0.16, speed: 640, color: '#9af0ff', count: 2, spread: 0.12, sound: 'zap', desc: 'Twin repulsor blasts.' },
    batarang: { name: 'Batarang', fandom: 'DC', kind: 'disc', dmg: 3, cd: 0.12, speed: 520, range: 240, color: '#333333', curve: 3.5, stun: 1, pierce: true, art: 'batarang', sound: 'disc', desc: 'Curving boomerang. Stuns.' },
    lasso: { name: 'Lasso of Truth', fandom: 'DC', kind: 'melee', dmg: 2, range: 150, arc: 0.6, cd: 0.45, color: '#ffd23f', pull: true, stun: 1.5, desc: 'Long reach. Yanks enemies to you.' },
    lanternring: { name: 'Lantern Ring', fandom: 'DC', kind: 'melee', dmg: 5, range: 0, aoe: { dist: 75, r: 60 }, cd: 0.55, color: '#3aff6a', knock: 2.5, desc: 'Summons a giant green fist construct.' },
    elderwand: { name: 'Elder Wand', fandom: 'Harry Potter', kind: 'gun', shot: 'spell', dmg: 3, cd: 0.28, speed: 420, homing: 4, color: '#ff4040', sound: 'zap', desc: 'Homing Stupefy bolts.' },
    sting: { name: 'Sting', fandom: 'The Lord of the Rings', kind: 'melee', dmg: 3, range: 48, arc: 1.8, cd: 0.24, color: '#8ad8ff', bonus: { tag: 'orc', mult: 3 }, desc: 'Glows blue. Triple damage to orcs.' },
    tranqrifle: { name: 'Tranq Rifle', fandom: 'Jurassic Park', kind: 'gun', dmg: 2, cd: 0.5, speed: 700, color: '#ff4fd8', pierce: true, stun: 2, bonus: { tag: 'dino', mult: 2 }, sound: 'laser', desc: 'Piercing darts. Sleeps dinosaurs.' },
    energysword: { name: 'Energy Sword', fandom: 'Halo', kind: 'melee', dmg: 6, range: 54, arc: 1.6, cd: 0.42, color: '#7ab0ff', lunge: 170, sound: 'saber', desc: 'Lunges at enemies in reach.' },
    phaser: { name: 'Type-2 Phaser', fandom: 'Star Trek', kind: 'gun', dmg: 2, cd: 0.14, speed: 900, color: '#ff8a3a', stun: 0.4, sound: 'zap', desc: 'Set to stun. And also hurt.' },
    sonicscrewdriver: { name: 'Sonic Screwdriver', fandom: 'Doctor Who', kind: 'beam', dps: 4, range: 200, color: '#5fffaf', stun: 0.3, bonus: { tag: 'robot', mult: 3 }, desc: 'Scrambles robots. Doesn\'t do wood.' },
    nailbat: { name: 'Nail Bat', fandom: 'Stranger Things', kind: 'melee', dmg: 5, range: 50, arc: 2.0, cd: 0.45, color: '#b08a5a', knock: 3, desc: 'Massive knockback.' },
    kamehameha: { name: 'Kamehameha', fandom: 'Dragon Ball Z', kind: 'charge', dps: 30, range: 420, color: '#5fc8ff', desc: 'Hold to charge. Release to blast.' },
    portalgun: { name: 'Portal Gun', fandom: 'Portal', kind: 'portal', cd: 0.3, speed: 700, color: '#3a9aff', desc: 'Shoot two portals, walk between them.' },
    atomicbreath: { name: 'Atomic Breath', fandom: 'Godzilla', kind: 'beam', dps: 14, range: 330, color: '#4ad0ff', width: 10, desc: 'The king of all beams.' },
  };
  NX.WEAPON_ORDER = Object.keys(NX.WEAPONS);

  // ---------- Mounts (V cycles) ----------
  NX.MOUNTS = {
    delorean: { name: 'DeLorean', fandom: 'Back to the Future', speed: 2.8, ram: 3, car: true, color: '#c9ced6' },
    batmobile: { name: 'Batmobile', fandom: 'DC', speed: 2.6, ram: 6, car: true, color: '#1a1a1e', guns: true },
    ecto1: { name: 'Ecto-1', fandom: 'Ghostbusters', speed: 2.5, ram: 4, car: true, color: '#f2f2f2', siren: true },
    nimbus: { name: 'Nimbus 2000', fandom: 'Harry Potter', speed: 2.2, fly: true, attack: true },
    elytra: { name: 'Elytra', fandom: 'Minecraft', speed: 3.2, fly: true, attack: true },
  };

  // ---------- Relics (permanent passives / abilities) ----------
  NX.RELICS = {
    gauntlet: { name: 'Infinity Gauntlet', fandom: 'Marvel', desc: 'Press F to SNAP: half of everything nearby turns to dust. 90s cooldown.' },
    motherbox: { name: 'Mother Box', fandom: 'DC', desc: 'Boom tubes: warp to ANY sector on the map, visited or not.' },
    masterball: { name: 'Master Ball ×3', fandom: 'Pokémon', desc: 'Three never-miss Poké Balls. Works on raid minions, not bosses.' },
    goldflower: { name: 'Gold Flower', fandom: 'Super Mario', desc: 'Enemies drop double coins.' },
    redpill: { name: 'Red Pill', fandom: 'The Matrix', desc: 'Taking damage triggers 2s of bullet time.' },
    cloak: { name: 'Invisibility Cloak', fandom: 'Harry Potter', desc: 'Enemies notice you from half as far away.' },
    mithril: { name: 'Mithril Shirt', fandom: 'The Lord of the Rings', desc: 'Take 30% less damage.' },
    amber: { name: 'Mosquito in Amber', fandom: 'Jurassic Park', desc: '+2 Extra Lives.' },
    overshield: { name: 'Overshield', fandom: 'Halo', desc: '4 extra shield points that recharge.' },
    implant: { name: 'Borg Implant', fandom: 'Star Trek', desc: 'Regenerate 1 HP every 6 seconds.' },
    regeneration: { name: 'Regeneration', fandom: 'Doctor Who', desc: 'When zeroed, regenerate at full HP (once every 10 minutes).' },
    chaosemerald: { name: 'Chaos Emerald', fandom: 'Sonic', desc: '+25% speed and a huge pickup magnet.' },
    walkman: { name: 'Max\'s Walkman', fandom: 'Stranger Things', desc: 'Survive a lethal hit at 1 HP (every 3 minutes).' },
    scouter: { name: 'Scouter', fandom: 'Dragon Ball Z', desc: 'Reveals every raid boss and key on the map.' },
    cake: { name: 'The Cake', fandom: 'Portal', desc: '+4 max HP. It was not a lie.' },
    gizmo: { name: 'Proton Trap', fandom: 'Ghostbusters', desc: 'Ghosts drop triple XP.' },
    speedshoes: { name: 'Power Sneakers', fandom: 'Sonic', desc: '+20% move speed. Gotta go fast.' },
  };

  // ---------- The Egg Hunt: "The Three Gates" (docs/CAMPAIGN.md) ----------
  // angle = the act's bearing from the hub (World places its cabinets, key and gate along it).
  NX.KEYS = {
    copper: { name: 'Copper Key', color: '#e08a4a', theme: 'galaxy', boss: 'darklord', angle: 0 },
    jade: { name: 'Jade Key', color: '#3fcf8e', theme: 'hyrule', boss: 'ganon', angle: 2.2 },
    crystal: { name: 'Crystal Key', color: '#bdf4ff', theme: 'pacmaze', boss: 'bigghost', angle: 4.3 },
  };
  NX.KEY_ORDER = ['copper', 'jade', 'crystal'];

  // Stage ids in order; Game keeps G.quest.stage = the current, not-yet-completed one.
  // Text is the contract's §10, verbatim. Game.fmtQuest fills {name} {n} {dir} {x} {y}.
  NX.CAMPAIGN = {
    stages: ['intro', 'copper_clue_0', 'copper_clue_1', 'copper_clue_2', 'copper_key', 'copper_gate', 'jade_clue_0', 'jade_clue_1', 'jade_clue_2', 'jade_key', 'jade_gate',
      'crystal_clue_0', 'crystal_clue_1', 'crystal_clue_2', 'crystal_key', 'crystal_gate', 'castle_gens', 'castle', 'egg', 'done'],
    race: ['copper_key', 'copper_gate', 'jade_key', 'jade_gate', 'crystal_key', 'crystal_gate', 'castle_gens'],
    raceLabels: ['found the Copper Key', 'opened the Copper Gate', 'found the Jade Key', 'opened the Jade Gate', 'found the Crystal Key', 'opened the Crystal Gate', 'is sieging Anorak’s Castle'],
    raceShort: ['Copper Key', 'Copper Gate', 'Jade Key', 'Jade Gate', 'Crystal Key', 'Crystal Gate', 'Castle Siege'],
    acts: {
      copper: {
        name: "The Copper Act", color: "#e08a4a",
        clueThemes: ["mushroom", "ghostcity", "doctorwho"],
        clueTrial: { twist: "rift", banner: "The cabinet glitches — another world is leaking in!" },
        gateTrial: { type: "waves", bosses: ["darklord"] },
        intro: [
          "The Egg sleeps inside Anorak's Castle, somewhere past the last paved road. Three gates stand in the way — copper, jade and crystal — and each one opens only for its own key.",
          "Keys don't sit on signposts. Each one hides behind three arcade cabinets. Beat a cabinet and its screen whispers where the next one stands.",
          "My riddles name a world, never a sector. Match the riddle to a colour on your map (M) — the legend knows who lives where, and the dashed circle tells you how close you are.",
          "Cabinet one is close to home: 'Find the land where bricks hide coins, green pipes are shortcuts and every turtle carries a spare shell. Its mushrooms make you taller. Its plumbers make it look easy.'",
        ],
        clues: [
          "Cabinet two: 'A city that can't sleep because its closets won't stop rattling. The exterminators wear their vacuums on their backs, and the tallest thing downtown would toast nicely over a campfire.'",
          "Cabinet three: 'Rainy streets where a little blue phone box holds more rooms than a palace, armoured pepper-pots shout the same word at everyone, and the statues only creep closer while your eyes are shut.'",
          "The Copper Key: 'A desert lit by one sun too many. Its keeper wears a cape indoors, breathes like a broken air-conditioner and swings a humming red blade. Bring something that bats laser bolts back.'",
        ],
        keyHint: "The Dark Lord won't show himself until all three copper cabinets are beaten. When he does, a blade that bounces lasers back will make him regret the cape.",
        gateIntro: "Scratched into the copper: 'Nearer home, {n} sectors {dir} of here, a circle of stone pillars waits for a key that fits.'",
        gateDone: "The Copper Gate grinds open. Far away, the public scoreboard flickers — and starts spelling your name, {name}.",
      },
      jade: {
        name: "The Jade Act", color: "#3fcf8e",
        clueThemes: ["hogwarts", "blocklands", "portal"],
        clueTrial: { twist: "meteors", banner: "The sky cracks open — dodge the red circles!" },
        gateTrial: { type: "bossrush", bosses: ["mewtwo", "voldemort", "zealot"] },
        intro: [
          "◈ Curator here. Lovely work on that gate — the whole NEXUS watched it open. Unfortunately, so did IOI.",
          "The Jade Key sits on an island wrapped in a data-moat. No bridge, no ferry. You'll need something that flies… or something that cheats.",
          "Funny thing: every jade cabinet stands in a world that knows a way across water. Open the chests they leave behind.",
          "Cabinet one: 'Where the post arrives by owl, the staircases change their minds and the favourite sport is played forty feet up on brooms. Wrap up warm — it snows on that campus.'",
        ],
        clues: [
          "Cabinet two: 'A square world where sheep are boxes, trees come down to a bare fist and the green neighbour hisses right before the hug. A dragon roosts at its far edge — they say it leaves its wings behind.'",
          "Cabinet three: 'A spotless laboratory with a ceiling that talks too much. Its proudest invention shoots doorways instead of bullets. Ignore whatever it promises about dessert.'",
          "The Jade Key: 'A wide green field where a hero in a pointed cap smashes pots for pocket change. Its keeper is a crowned boar with a grudge older than the cartridge. Fly over the water — or fold the distance in two.'",
        ],
        keyHint: "Ganon won't surface until all three jade cabinets are beaten. No wings? The Aperture cabinet's chest holds a Portal Gun: one portal on each shore and the moat becomes a doorway.",
        gateIntro: "Etched in jade: 'Back toward home, {n} sectors {dir}. This gate remembers every monster you've beaten — and it's inviting three of them back.'",
        gateDone: "The Jade Gate unfolds like a lotus made of circuit board. Two gates down. One to go.",
      },
      crystal: {
        name: "The Crystal Act", color: "#bdf4ff",
        clueThemes: ["grid", "namek", "stranger"],
        clueTrial: { twist: "pellets", banner: "Clear every dot on the board. The ghosts will try to stop you." },
        gateTrial: { type: "riddle", bosses: ["bigghost"] },
        intro: [
          "◈ Curator again. Two gates! You are officially a problem for IOI.",
          "The Crystal Key is the last and the farthest — out where even a Goomba hits like a troll. Level up before you wander, and believe your HUD when it says 'advised'.",
          "Cabinet one: 'Inside the machine: neon roads, motorbikes that leave walls behind them, and men in dark glasses who can't stop copy-pasting themselves.'",
        ],
        clues: [
          "Cabinet two: 'A planet with a green sky and teal grass, where seven orange orbs add up to one wish and every fighter shouts for a full minute before throwing a punch.'",
          "Cabinet three: 'A world flipped inside out: the fairy lights spell out messages, spores drift up instead of down, and something with a flower for a face waits in the dark. Bring a baseball bat with a few home improvements.'",
          "The Crystal Key: 'The heart of a blue neon maze where a hungry yellow circle once ruled. Four ghosts still patrol, and the red one grew up. Save the big dots for him — they turn the hunted into the hunter.'",
        ],
        keyHint: "Blinky XL won't appear until all three crystal cabinets are beaten. Then he shrugs off anything that isn't powered up — four big dots wait around the arena. Eat one, then bite back.",
        gateIntro: "Cut into the crystal: '{n} sectors {dir}, nearer home. The last gate asks one question. You've carried the answer since your very first step.'",
        gateDone: "The Crystal Gate shatters into light. Out past the rim of your map, a castle that wasn't there a minute ago is glowing — and something orange is wrapped around it.",
      },
    },
    castle: {
      name: "Anorak's Castle", boss: "ioi655321", npc: "anorak",
      reveal: { title: "ANORAK'S CASTLE HAS APPEARED", sub: "Sector {x}, {y} · follow the orange glow" },
      intro: [
        "◈ Curator: That's Anorak's Castle. And that orange dome around it? IOI got here first — and they brought a shield.",
        "Three pylons hold it up, out in the sectors around the walls. Knock all three over and the whole thing folds like a cheap umbrella.",
        "IOI-655321 is waiting inside. Whatever happens, don't let them reach the altar first.",
      ],
      shieldDown: "THE IOI SHIELD IS DOWN",
      bossShout: "This Egg is now a corporate asset. Please step away from the castle.",
      outro: [
        "A tall figure in black and crimson robes steps out from behind the altar. Even the Sixer wreckage stops smoking, out of respect.",
        "Anorak: 'They brought a shield. You brought curiosity. Curiosity wins more often than people expect.'",
        "Anorak: 'I hid this Egg for whoever would actually go looking. Turns out that was you, {name}.'",
        "Anorak: 'Take it. Look after the NEXUS — and leave a few secrets for the next gunter.'",
      ],
      after: [
        "Anorak: 'The Egg is yours, {name}. Go on — it doesn't bite.'",
        "Anorak: 'Still here? Good. The multiverse is bigger than any castle.'",
      ],
    },
    finalRiddle: {
      q: "Long before any gate or gunter, a programmer hid his own name in a secret room of his game — a room you could only reach by carrying a single grey pixel through a wall. That room is why hidden secrets are called Easter eggs, and the sword you started with comes from the same game. Which game?",
      options: ["Adventure — Atari 2600", "Pac-Man — arcade", "Pong — arcade", "Zork — mainframe text adventure"],
      answer: 0,
      wrong: "The gate buzzes: WRONG — INSERT COIN. Somewhere, IOI heard that.",
      right: "The crystal sings. Echoes rush the gate — hold it!",
    },
  };
  E.ioi655321.shout = NX.CAMPAIGN.castle.bossShout;

  // One raid boss per fandom, hidden somewhere in that fandom's territory.
  NX.RAIDS = {
    pocket: { boss: 'mewtwo', reward: { relic: 'masterball' } },
    mushroom: { boss: 'bowser', reward: { relic: 'goldflower' } },
    blocklands: { boss: 'enderdragon', reward: { mount: 'elytra' } },
    ghostcity: { boss: 'staypuft', reward: { mount: 'ecto1', relic: 'gizmo' } },
    grid: { boss: 'smith', reward: { relic: 'redpill' } },
    marvel: { boss: 'thanos', reward: { relic: 'gauntlet' } },
    dc: { boss: 'darkseid', reward: { relic: 'motherbox' } },
    hogwarts: { boss: 'voldemort', reward: { relic: 'cloak' } },
    middleearth: { boss: 'balrog', reward: { relic: 'mithril' } },
    jurassic: { boss: 'trex', reward: { relic: 'amber' } },
    halo: { boss: 'zealot', reward: { relic: 'overshield' } },
    startrek: { boss: 'borgqueen', reward: { relic: 'implant' } },
    doctorwho: { boss: 'dalekemperor', reward: { relic: 'regeneration' } },
    sonic: { boss: 'eggman', reward: { relic: 'chaosemerald' } },
    stranger: { boss: 'mindflayer', reward: { relic: 'walkman' } },
    namek: { boss: 'frieza', reward: { relic: 'scouter' } },
    portal: { boss: 'glados', reward: { relic: 'cake' } },
  };

  // Rival gunters racing you through the gates. Each reaches NX.CAMPAIGN.race[i] at
  // campaign.milestoneMinutes[race[i]] × paceMult × targetHours/12 / rivals.pace (rubber-banded by Game).
  // Resolved minutes [copper_key, copper_gate, jade_key, jade_gate, crystal_key, crystal_gate, castle_gens]:
  //   Percival [81,90,234,248,491,504,612] · Artemis [90,100,260,275,545,560,680] · IOI [97,108,281,297,589,605,734]
  //   Aitch [108,120,312,330,654,672,816] · Sho [122,135,351,371,736,756,918]. Rivals never take the Egg.
  NX.RIVALS = [
    { name: 'Percival', color: '#4a9cff', paceMult: 0.90 },
    { name: 'Artemis', color: '#ff4f8b', paceMult: 1.00 },
    { name: 'IOI-655321', color: '#ff9b3d', paceMult: 1.08, corp: true },
    { name: 'Aitch', color: '#ffd23f', paceMult: 1.20 },
    { name: 'Sho', color: '#5be0a6', paceMult: 1.35 },
  ];

  NX.SHOP = [
    { id: 'pokeballs', label: '3× Poké Ball', desc: 'Throw (C) at weakened enemies — any fandom — to recruit them.' },
    { id: 'grenade', label: '2× Holy Hand Grenade', desc: 'Count to three. Not five. (G)' },
    { id: 'heal', label: 'Full Heal', desc: 'Restores all hearts.' },
    { id: 'extralife', label: 'Extra Life Quarter', desc: 'Auto-revive once when zeroed.' },
    { id: 'blaster', label: 'E-11 Blaster', desc: 'Reliable ranged weapon.' },
    { id: 'delorean', label: 'DeLorean', desc: '88 mph across the multiverse. Runs things over. (V)' },
  ];

  // World events fire every few minutes outside the hub.
  NX.EVENTS = {
    kaiju: { weight: 2, banner: '⚠ KAIJU ALERT — GODZILLA HAS MADE LANDFALL', minDist: 4 },
    rift: { weight: 4, banner: '⚡ DIMENSIONAL RIFT — another fandom is leaking in!' },
    sixers: { weight: 3, banner: '☢ IOI RAID — a Sixer strike team has your coordinates' },
    meteors: { weight: 3, banner: '☄ METEOR SHOWER — dodge the impacts, grab the loot' },
    supply: { weight: 3, banner: '🎁 SUPPLY DROP — a golden chest is falling nearby' },
  };

  NX.STREAKS = [[2, 'DOUBLE KILL'], [3, 'TRIPLE KILL'], [4, 'MULTI KILL'], [6, 'MEGA KILL'], [8, 'ULTRA KILL'], [10, 'MONSTER KILL'], [14, 'LUDICROUS KILL'], [20, 'GODLIKE'], [30, 'BEYOND GODLIKE'], [50, 'MULTIVERSAL']];

  NX.TIPS = [
    'A Poké Ball works on almost anything low on HP. Yes, even a Stormtrooper. Yes, even a Dalek.',
    'Koopa shells ricochet. Kick one into a crowd.',
    'Eat a Power Pellet in the Pac-Maze and the ghosts get very nervous.',
    'The Diamond Pickaxe mines through walls. Mazes become suggestions.',
    'Press M for the multiverse map. Tap a visited sector to warp there.',
    'Beat an arcade cabinet and its screen whispers a riddle. Match the world it describes to a colour in the map legend.',
    'The Jade Key sits behind a data-moat. A Nimbus 2000, the Elytra or a Portal Gun gets you across.',
    'When the HUD says "LV advised", believe it. Raid bosses and gate trials are the fastest XP around.',
    'Every fandom hides a raid boss. Beat them for relics — Thanos drops the Gauntlet.',
    'Don\'t blink near Weeping Angels. Keep facing them.',
    'Borg drones adapt to whatever weapon you spam. Mix it up.',
    'Grab the DeLorean at the hub garage. Roads? Where we\'re going...',
    'Hold attack with the Kamehameha. Let go when the orb is huge.',
    'Further from the hub = tougher enemies, better loot, bigger XP.',
  ];

  // Options the debrief offers. Votes are aggregated by feedback/summarize.mjs.
  NX.FEEDBACK_OPTIONS = {
    worlds: NX.THEME_LIST.map((k) => ({ value: k, label: `${NX.THEMES[k].name} (${NX.THEMES[k].fandom})` })),
    fandoms: ['Back to the Future', 'Star Trek (starships)', 'Mortal Kombat', 'Street Fighter', 'Fortnite', 'Overwatch', 'Final Fantasy', 'Kingdom Hearts',
      'One Piece', 'Naruto', 'Transformers', 'Ninja Turtles', 'Indiana Jones', 'Alien / Predator', 'Avatar: The Last Airbender', 'The Simpsons', 'SpongeBob', 'Fallout', 'Skyrim', 'Mass Effect'],
    features: [
      ['vehicles', 'More vehicles (X-wing, Hoverboard…)'], ['pvp', 'Multiplayer / co-op'], ['story', 'More story & riddles'],
      ['music', '80s soundtrack'], ['bases', 'Build your own base'], ['avatar', 'Avatar customization'],
      ['bosses', 'More bosses'], ['arcade', 'Playable arcade cabinets'], ['powers', 'Superpowers (flight, super-speed…)'], ['quests', 'Side quests'],
    ],
  };
})();
