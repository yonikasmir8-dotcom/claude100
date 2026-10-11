// Every balance / scale knob lives here so player feedback turns into small,
// reviewable changes. FEEDBACK_LOOP.md maps feedback signals to these keys.
window.NX_CONFIG = {
  version: '0.1.0',

  world: {
    seed: 1985,
    sectorTiles: 48,          // tiles per sector side
    radius: 50,               // sectors from the hub to the edge → (2r+1)^2 = 10,201 sectors
    tile: 32,                 // px per tile
    regionCells: 6,           // fandom regions are roughly this many sectors across
    difficultyPerSector: 0.12,// enemy stat growth per sector of distance from the hub
    enemyDensity: 1.0,
    chestChance: 0.55,
    npcChance: 0.2,
    maxEnemies: 70,
  },

  player: {
    speed: 175,               // px/sec
    maxHp: 10,
    iframes: 0.9,
    xpBase: 12,               // xp for level 2; grows by xpGrowth each level
    xpGrowth: 1.3,
    hpPerLevel: 1,
    dmgPerLevel: 0.12,
    maxActivePets: 3,
  },

  combat: {
    enemyHpMult: 1,
    enemyDmgMult: 1,
    aggroRange: 300,
    captureThreshold: 0.45,   // enemies below this HP fraction are easy to catch
    dropChance: 0.35,
  },

  economy: {
    startCoins: 30,
    coinMult: 2,              // multiplies every coin drop
    deathCoinLoss: 0.5,
    prices: { pokeballs: 15, grenade: 25, heal: 10, extralife: 100, delorean: 200, blaster: 60 },
  },

  keys: { copper: 5, jade: 10, crystal: 16 },  // distance (in sectors) from the hub
  raids: { minDist: 6, maxDist: 30 },          // raid bosses hide this far out in their fandom's territory
  events: { everyMinutes: [2.5, 4.5] },        // world events (kaiju, rifts, meteors...)
  sixers: { baseChance: 0.05, perKey: 0.12 },  // IOI patrol chance per sector, rising with keys held
  rivals: { pace: 1.0 },                       // >1 = rival gunters race faster

  feedback: { deathPromptMinutes: 5 },         // min minutes between death-triggered debriefs
};
