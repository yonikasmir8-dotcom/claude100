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
    difficultyPerSector: 0.12,// normal enemies: HP, XP, coins ×(1 + 0.12·d) (d = sectors from the hub)
    dmgPerSector: 0.08,       // normal-enemy damage ×(1 + 0.08·d) — first knob if the egg comes too fast
    bossHpPerSector: 0.05,    // boss HP/XP/coins ×(1 + 0.05·d)
    bossDmgPerSector: 0.03,   // boss damage ×(1 + 0.03·d)
    enemyDensity: 1.0,
    chestChance: 0.55,
    npcChance: 0.2,
    maxEnemies: 70,
  },

  player: {
    speed: 175,               // px/sec
    maxHp: 10,
    iframes: 0.9,
    xpBase: 12,               // xpNeed(L) = floor(xpBase · L^xpPow)
    xpPow: 1.55,
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
    scaledPrices: ['pokeballs', 'grenade', 'heal', 'extralife'], // × (1 + difficultyPerSector · actDist)
    maxExtraLives: 2,         // +2 with the Mosquito in Amber
    extraLifeOverflowCoins: 25,
  },

  // The Three Gates (docs/CAMPAIGN.md). Distances are Chebyshev sectors from the hub.
  campaign: {
    targetHours: 12,
    clueDist: { copper: [3, 6, 9], jade: [14, 18, 21], crystal: [28, 32, 35] },
    keyDist: { copper: 12, jade: 25, crystal: 38 },
    gateDist: { copper: 10, jade: 22, crystal: 36 },
    castleDist: 42,                       // assert ≤ world.radius − 2
    genOffsets: [[0, -3], [3, 0], [0, 3], [-3, 0], [2, -2], [2, 2], [-2, 2], [-2, -2]], // pylon sectors relative to the castle
    clueBearing: [10, 35],                // degrees off the act bearing, alternating sides
    gateBearing: [30, 45],                // degrees off the act bearing, opposite clue 2
    clueWaves: 3,
    gateWaves: { copper: 5, crystal: 3 }, // jade = 3-echo boss rush (acts.jade.gateTrial.bosses)
    waveSize: [5, 8], waveSizePerSectors: 6,   // + floor(d / 6)
    echoHpMult: { copper: 1.0, jade: 0.6, crystal: 0.8 },
    trialXpMult: 0.3, trialBonusLevels: 0.5,
    arena: { clue: 7, gate: 11, key: 11, generator: 7, castle: 12 },
    trialLeash: 6, trialLeaveTiles: 10, trialLeaveSec: 5,
    meteorEvery: 5, meteorCount: 4, pelletRadius: 6,
    moatWidth: 4, forceRadius: 19, forceThickness: 2, castleWall: [16, 18],
    hintRadius: 2,
    comfortHits: 8, avgBaseHit: 1.34, recSlack: 2,  // Game.recLevel(d)
    milestoneMinutes: {                   // median-player targets at targetHours 12 (scaled by targetHours/12)
      copper_key: 90, copper_gate: 100, jade_key: 260, jade_gate: 275,
      crystal_key: 545, crystal_gate: 560, castle_gens: 680, egg: 720,
    },
  },

  raids: { minDist: 6, maxDist: 30 },          // raid bosses hide this far out in their fandom's territory
  events: { everyMinutes: [2.5, 4.5] },        // world events (kaiju, rifts, meteors...)
  sixers: { baseChance: 0.05, perKey: 0.12 },  // IOI patrol chance per sector, rising with keys held
  rivals: { pace: 1.0 },                       // >1 = rival gunters race faster

  feedback: { deathPromptMinutes: 5 },         // min minutes between death-triggered debriefs
};
