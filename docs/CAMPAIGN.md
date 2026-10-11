# THE NEXUS — Campaign "The Three Gates" (v0.2 final design + interface contract)

Player decision (feedback round 1): **the egg hunt should take 10+ hours.**
Target: a median of **~12 h** from New Game to the Egg for a player who explores, levels up and
fights raid bosses along the way. Every number below is a knob in `config.js → campaign` / `world`,
so the feedback loop can tune pacing from real telemetry.

This document is the **contract**. It was reviewed by a design panel (fun, pacing and softlock lenses).
The 20 resulting amendments (A01–A20) are already folded in, and the amendment tags are kept as
cross-references. Where code disagrees with this file, this file wins.

---

## 0. File ownership and cross-file API

| Owner | Files | Provides |
|---|---|---|
| **A** | `config.js`, `js/world.js` | all knobs (§3); `World.quest`, `World.sites`, `siteAt`, `nearSite`, `naturalTheme`, `forceDown`, `dropForcefield`, `landingPos`, castle generation and overlays |
| **B** | `js/content.js`, `js/game.js` | `T.FORCE`, `NX.CAMPAIGN`, castle theme, `shieldgen`/`ioi655321`, `NX.RIVALS`; the quest state machine, trials, sites, migration, all `Game.*` helpers below |
| **C** | `js/ui.js`, `feedback.js`, `feedback/summarize.mjs`, `FEEDBACK_LOOP.md`, `README.md` | Curator/Anorak dialogue, `UI.riddle`, HUD objective/trial/arrow, map markers, scoreboard, prices in menus, debrief moments, pacing report |
| **D** | `js/render3d.js`, `js/models.js`, `js/art.js` | FORCE wall, castle look, obsidian walls, site/pylon/boss/NPC/egg models, `R3D.refreshSector`, 2D fallbacks |

Cross-file calls (exact names; implement on the provider side, call only these from the consumer side):

```
World (A):  World.quest, World.sites, World.siteAt(sx,sy), World.nearSite(sx,sy), World.naturalTheme(sx,sy),
            World.forceDown, World.dropForcefield(), World.landingPos(sx,sy) -> {x,y} (world px),
            World.gatePos / gateWorld (castle: (HALF, HALF+6)), World.keySectors (== quest keys)
R3D (D):    NX.R3D.refreshSector(sx, sy)   // mark one sector dirty -> rebuilt next frame (no-op if not built)
Game (B):   Game.stageId(), Game.stageIdx(id), Game.isDone(id), Game.objective(), Game.questMarkers(),
            Game.trial(), Game.answerRiddle(i), Game.riddleState(), Game.questEvent(name), Game.price(id),
            Game.recLevel(d), Game.fmtQuest(str, target?), Game.campaignInfo(), Game.rivalStatus(),
            Game.playerRaceProgress(), Game.prompt(), (existing) Game.buy(id) -> error string | undefined
UI (C):     UI.riddle() (async), UI.talk(n) roles 'curator' | 'anorak' | ..., UI.debrief('gate_copper'|'gate_jade'|'gate_crystal'|'egg'),
            existing UI.say / UI.menu / UI.banner / UI.toast / UI.flash
```

`G.clues`, `G.eggAt` and `C.keys` no longer exist. Nobody may read them.

---

## 1. Structure

| Stage id (`G.quest.stage`) | Goal | Where (Chebyshev sector distance from hub) | Completed by |
|---|---|---|---|
| `intro` | Talk to the Curator | hub | first Curator talk → `Game.questEvent('curator')` |
| `copper_clue_0..2` | Win 3 **Clue Trials** at arcade cabinets (twist: *rift*) | d 3, 6, 9 | clue trial won |
| `copper_key` | Defeat **The Dark Lord**, pick up the Copper Key | d 12 (Star Wars desert) | `collect('key')` |
| `copper_gate` | **Copper Gate Trial**: 5 waves, then an echo of the Dark Lord | d 10 | gate trial won |
| `jade_clue_0..2` | 3 Clue Trials (twist: *meteors*) | d 14, 18, 21 | clue trial won |
| `jade_key` | Defeat **Ganon** on an island ringed by a data-moat (needs Nimbus 2000 / Elytra / Portal Gun) | d 25 (Hyrule) | `collect('key')` |
| `jade_gate` | **Jade Gate Trial**: boss rush of 3 echoes (Mewtwo, Voldemort, Zealot) | d 22 | gate trial won |
| `crystal_clue_0..2` | 3 Clue Trials (twist: *pellets*) | d 28, 32, 35 | clue trial won |
| `crystal_key` | Defeat **Blinky XL** in a power-pellet fight | d 38 (Pac-Maze) | `collect('key')` |
| `crystal_gate` | **Crystal Gate**: Final Riddle, then 3 waves + an echo of Blinky XL | d 36 | gate trial won |
| `castle_gens` | Destroy the 3 **IOI Shield Pylons** around Anorak's Castle | castle ± 2–3 sectors | `checkStage()` once all 3 are down |
| `castle` | Breach Anorak's Castle and defeat **IOI-655321** | d 42 | `checkStage()` once `G.quest.castle` is set |
| `egg` | Speak with **Anorak** at the altar, then take the Egg | castle | `collect('egg')` → victory |
| `done` | Free roam: raid bosses, relics | — | — |

`NX.CAMPAIGN.stages` = `['intro','copper_clue_0','copper_clue_1','copper_clue_2','copper_key','copper_gate','jade_clue_0','jade_clue_1','jade_clue_2','jade_key','jade_gate','crystal_clue_0','crystal_clue_1','crystal_clue_2','crystal_key','crystal_gate','castle_gens','castle','egg','done']`.

### Pacing (A13, A19)
- Normal enemies: HP/XP/coins ×(1 + 0.12·d), damage ×(1 + 0.08·d). So d38 means 5.6× HP and 4.0× damage.
  Bosses: HP/XP/coins ×(1 + 0.05·d), damage ×(1 + 0.03·d).
- The comfortable level is `Game.recLevel(d)` (about 8 average hits to die). A player who skips levelling sits
  10–15 levels below it: risky (about 5 hits to die) but never a wall.
- XP curve: `xpNeed(L) = floor(xpBase · L^xpPow)` with `xpBase 12, xpPow 1.55`.
- recLevel: d3 L4 · d6 L7 · d9 L9 · d10 L10 · d12 L12 · d14 L14 · d18 L17 · d21 L20 · d22 L21 · d25 L23 ·
  d28 L26 · d32 L29 · d35 L32 · d36 L33 · d38 L34 · d42 L38.

| Milestone | Target min | Act share | Expected LV | recLevel (site d) |
|---|---:|---|---:|---|
| copper_key | 90 | | ~10 | 12 (d12) |
| copper_gate | 100 | Act I ~14% | ~10 | 10 (d10) |
| jade_key | 260 | | ~21 | 23 (d25) |
| jade_gate | 275 | Act II ~24% | ~21 | 21 (d22) |
| crystal_key | 545 | | ~32 | 34 (d38) |
| crystal_gate | 560 | Act III ~40% | ~32 | 33 (d36) |
| castle_gens | 680 | | ~36 | 38 (d42) |
| egg | 720 | Castle ~22% | ~36–37 | 38 (d42) |

Model: about 8.3 h of pure play × 1.3–1.45 overhead ≈ 10.8–12 h median. A rushing player takes 4–5 h,
including deaths. Trials make up ≈ 20 min of the total; travel ≈ 45–80 min. Round-2 rule: if the measured
median is under 10 h, raise `dmgPerSector` to 0.09 before touching `xpPow`.

Derived values for review: guardians (HP / dmg per hit) are Dark Lord d12 192 / 2.5 · Ganon d25 405 / 5.5 ·
Blinky XL d38 696 / 6.5 (takes 0.25× damage unless powered up) · IOI-655321 d42 1860 / 7. Echoes: copper Dark
Lord d10 180 · jade d22 Mewtwo 252, Voldemort 302, Zealot 290 · crystal Blinky XL d36 538. Pylons d39–45:
341–384 HP, 4–4.5 per bolt in bursts of 3, plus Sixer defenders.

---

## 3. `config.js` (owner A) — final values

```js
world: {
  seed: 1985, sectorTiles: 48, radius: 50, tile: 32, regionCells: 6,
  difficultyPerSector: 0.12,  // normal enemies: HP, XP, coins ×(1 + 0.12·d)
  dmgPerSector: 0.08,         // NEW: normal-enemy damage ×(1 + 0.08·d) (was hard-coded 0.05)
  bossHpPerSector: 0.05,      // NEW knob (current value): boss HP/XP/coins ×(1 + 0.05·d)
  bossDmgPerSector: 0.03,     // NEW knob (current value): boss damage ×(1 + 0.03·d)
  enemyDensity: 1.0, chestChance: 0.55, npcChance: 0.2, maxEnemies: 70,   // keep existing values for these
},
player: { /* existing */ xpBase: 12, xpPow: 1.55 /* xpGrowth removed */ },
economy: {
  /* existing */
  scaledPrices: ['pokeballs', 'grenade', 'heal', 'extralife'], // × (1 + difficultyPerSector · actDist)
  maxExtraLives: 2,            // +2 with the Mosquito in Amber
  extraLifeOverflowCoins: 25,
},
// keys: REMOVED (use campaign.keyDist)
campaign: {
  targetHours: 12,
  clueDist: { copper: [3, 6, 9], jade: [14, 18, 21], crystal: [28, 32, 35] },
  keyDist:  { copper: 12, jade: 25, crystal: 38 },
  gateDist: { copper: 10, jade: 22, crystal: 36 },
  castleDist: 42,                       // assert ≤ world.radius − 2
  genOffsets: [[0,-3],[3,0],[0,3],[-3,0],[2,-2],[2,2],[-2,2],[-2,-2]], // pylon sectors relative to the castle
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
rivals: { pace: 1.0 },
```
Every other existing key stays as it is (`raids`, `events`, `render`, …). Remove `player.xpGrowth` and `keys`.

---

## 4. `js/content.js` (owner B)

- **Tiles:** `T.FORCE = 15` (IOI forcefield). Add it to `NX.SOLID` and `NX.STOPS_SHOTS`. FORCE blocks every movement
  mode: walk, fly and ghost (`moveCircle` 'ghost' is blocked by `VOID` **or** `FORCE`). It also blocks every
  shot, portal shots included, and is never mined.
- **Castle theme (A18)**, not in `NX.THEME_LIST` (`THEME_LIST` excludes `'hub'` and `'castle'`):
  `NX.THEMES.castle = { name: 'Anorak’s Castle', fandom: 'The Egg Hunt', map: '#ff2a4a', gen: 'castle', safe: false, floor: ['#1b1622','#19141f'], road: '#2b2233', wall: 'obsidian', wallColor: '#2a1a3a', prop: 'statue', enemies: [['sixer',5],['agent',2],['elite',2],['uruk',2]], count: [8,12], loot: [], weather: 'ash', lines: [] }`.
- **Enemies:**
  - `shieldgen: { name: 'IOI Shield Pylon', fandom: 'IOI', hp: 60, speed: 0, dmg: 1, ai: 'turret', fire: 1.6, burst: 3, shot: { speed: 300, color: '#ff9b3d', r: 5 }, jitter: 0.1, art: 'shieldgen', xp: 30, coins: [10,20], r: 18, noCatch: true, tag: 'robot', generator: true }`
  - `ioi655321: boss({ name: 'IOI-655321', fandom: 'IOI', hp: 600, dmg: 3, speed: 80, r: 30, art: 'ioi655321', patterns: ['boomerang','ring','dash','summon','teleport','spread','spiral','laser','stomp'], summon: 'sixer', color: '#ff9b3d', xp: 400, coins: [300,400], shout: <castle.bossShout> })`. It has no `passWalls` and no `fly`.
  - There is **no** `anorak` enemy. Anorak is an NPC (look `'anorak'`).
- **`NX.KEYS`** keeps `name, color, theme, boss, angle`. `angle` is now used for act bearings; `riddle` is unused and may be deleted.
- **`NX.RIVALS` (A12):**
  ```js
  NX.RIVALS = [
    { name: 'Percival',   color: '#4a9cff', paceMult: 0.90 },
    { name: 'Artemis',    color: '#ff4f8b', paceMult: 1.00 },
    { name: 'IOI-655321', color: '#ff9b3d', paceMult: 1.08, corp: true },
    { name: 'Aitch',      color: '#ffd23f', paceMult: 1.20 },
    { name: 'Sho',        color: '#5be0a6', paceMult: 1.35 },
  ];
  // resolved minutes [copper_key, copper_gate, jade_key, jade_gate, crystal_key, crystal_gate, castle_gens]:
  //   Percival [81,90,234,248,491,504,612] · Artemis [90,100,260,275,545,560,680] · IOI [97,108,281,297,589,605,734]
  //   Aitch [108,120,312,330,654,672,816] · Sho [122,135,351,371,736,756,918]. Rivals never take the Egg.
  ```
- **`NX.CAMPAIGN`** = `{ stages, race, raceLabels, raceShort, acts, castle, finalRiddle }`. The text is verbatim from §10.
  - `race = ['copper_key','copper_gate','jade_key','jade_gate','crystal_key','crystal_gate','castle_gens']`
  - `raceLabels = ['found the Copper Key','opened the Copper Gate','found the Jade Key','opened the Jade Gate','found the Crystal Key','opened the Crystal Gate','is sieging Anorak’s Castle']`
  - `raceShort = ['Copper Key','Copper Gate','Jade Key','Jade Gate','Crystal Key','Crystal Gate','Castle Siege']`
- `NX.TIPS`: replace the "Sixers hunt gunters who hold keys" tip and add one or two campaign tips (cabinets, the moat, the advised level).

---

## 5. `js/world.js` (owner A)

### 5.1 Site placement — `World.init()` (A05)
Do these in order, before any `themeOf` call (`themeOf` memoizes):
1. `a0 = NX.h01(7,7,7)·2π`. Each act's bearing is `θ = a0 + NX.KEYS[act].angle`. `at(θ, d)` is the existing Chebyshev
   ring projection (`m = max(|cos|,|sin|)`, `sx = round(cos/m·d)`, `sy = round(sin/m·d)`).
   - **Key** at `(θ, keyDist[act])`.
   - **Clue i** at `(θ + (−1)^i·b, clueDist[act][i])`. Try `b` from `campaign.clueBearing` [10°,35°] in 5° steps,
     starting from a hashed value and wrapping. Take the first sector whose *natural* theme, and the natural themes
     of its 8 neighbours, all differ from `acts[act].clueThemes[i]`, so the forced clue theme stands out on the map.
     If none qualifies, use the hashed `b`.
   - **Gate** at `(θ − g, gateDist[act])`, with `g` hashed in `gateBearing` [30°,45°]. The sign is chosen so the gate
     is on the side opposite clue 2.
   - **Castle** at `(θ_crystal, castleDist)`. Assert `castleDist ≤ R − 2`.
   - **Pylons:** rotate `campaign.genOffsets` by a hashed start index. Add each offset to the castle and keep the first 3
     that are in bounds, have `dist ≤ R − 1`, and are Chebyshev ≥ 2 from every other site and from each other.
   - Nudging: any site that is the hub, shares a sector with another site or is adjacent to one is nudged through
     `[(1,0),(−1,0),(0,1),(0,−1),(1,1),(−1,1),(1,−1),(−1,−1)]` (first offset that fixes it).
2. `themeMemo.clear()`.
3. Place raids as today, but use `World.nearSite(sx,sy)` (Chebyshev ≤ 1 of any site, pylons and castle included)
   instead of `nearKey`.
4. `console.assert` checks: `clueDist < gateDist < keyDist` per act; every site in bounds; sites pairwise Chebyshev ≥ 2 apart;
   exactly 17 raids placed; the ring invariants in 5.4.

Shapes:
```js
World.quest = {
  copper:  { clues: [{sx,sy},{sx,sy},{sx,sy}], key: {sx,sy}, gate: {sx,sy} },
  jade:    { clues: [...], key: {...}, gate: {...} },
  crystal: { clues: [...], key: {...}, gate: {...} },
  castle:  { sx, sy, generators: [{sx,sy},{sx,sy},{sx,sy}] },
};
World.keySectors[act] = World.quest[act].key;            // existing code relies on it
World.sites = [{ type, act, index, sx, sy }, ...];        // 3×(3 clue + key + gate) + castle + 3 generators = 19
World.siteAt(sx, sy) -> { type: 'clue'|'key'|'gate'|'generator'|'castle', act: 'copper'|'jade'|'crystal'|null, index: number|null } | null
World.nearSite(sx, sy) -> bool                          // Chebyshev ≤ 1 of any site
World.naturalTheme(sx, sy)                               // key ±1 override → Voronoi (ignores clue/castle overrides)
```

### 5.2 Themes
`themeOf` priority: hub → castle sector (`'castle'`) → clue sector (its `clueThemes[i]`, that one sector only) →
key ±1 (`NX.KEYS[act].theme`) → Voronoi. Gates and pylons keep their natural theme.

### 5.3 Generation — `generate()` order
themed generator (new branch `th.gen === 'castle'` → `genCastle`: obsidian FLOOR, sparse PROP) → roads → **site overlays** →
`T.GATE` at `gatePos` unless that tile is `ALTAR`. All rings use `d = Math.hypot(i, j)` from the centre tile
`(HALF, HALF)`. They are written over **every** tile type (PELLET, POWER, ROAD, WALL…) **after** the roads.
- clue and pylon sectors: FLOOR where `d < 7`, DECOR where `7 ≤ d < 8`.
- gate: FLOOR where `d < 11`, DECOR where `11 ≤ d < 12`, 8 PROP pillars at `k·45°` on `r = 11`.
- key: today's arena (r 11). **Jade** key also gets WATER where `13 ≤ d < 13 + moatWidth`.
- castle: FLOOR where `d < 12` and `ALTAR` at the centre. `WALL` where `16 ≤ d < 18`, except south-road tiles
  (`|i| ≤ 1, j > 0`), which stay `ROAD`. `FORCE` where `forceRadius ≤ d < forceRadius + forceThickness` (19..21),
  **only while `!World.forceDown`**. The castle has no east, west or north road entrance: those tiles become WALL in
  the wall ring.
- `gatePos(castle) = (HALF, HALF+6)`. Hub is unchanged (HALF, HALF+6). Others: (HALF, HALF).

### 5.4 Forcefield is derived state (A04)
- `World.forceDown` (bool, default false). `generate()` writes FORCE only while it is false.
- `Game.start` sets `W.forceDown = G.quest.generators.every(Boolean)` right after `W.init()`, before `importMods`
  and `updateSectors(true)`.
- `World.dropForcefield()`: set `forceDown = true`, delete the castle sector from `cache` (and `_last` if it matches),
  then call `NX.R3D && NX.R3D.ok && NX.R3D.refreshSector(sx, sy)`. It writes **no** mods.
- Invariants (`console.assert`): guardian trigger 13 ≤ moat inner radius 13; castle trigger 13 < wall inner radius 16 < forceRadius;
  `forceRadius + forceThickness ≤ HALF − 3`.
- `World.landingPos(sx, sy)`: for the jade key sector and the castle sector, local `(HALF, S−2)` on the south road
  (d = 22, outside both rings), as world px of the tile centre. Everywhere else it keeps today's warp landing (just
  below the sector gate: `gateWorld` + 2 tiles south). `Game.warp` and Mother Box warps both use it.

---

## 6. `js/game.js` (owner B)

### 6.1 State machine (A01)
- Saved: `G.quest = { stage: 'intro', generators: [false,false,false], castle: false, outro: false, ms: {}, first: false }`.
  `stage` is the **id string** of the current, not-yet-completed stage. `G.v = 2`.
- `Game.stageId()`; `Game.stageIdx(id) = stages.indexOf(id)`; `Game.isDone(id) = stageIdx(stage) > stageIdx(id)`.
  Cabinet, gate and clue states are always **derived** from `isDone`. There are no stored clue, gate or trial fields.
- Single mutator `advance(id)`. It does nothing unless `stageId() === id`. Otherwise:
  set `G.quest.ms[id] = Math.round(G.playTime)` → telemetry (§6.9) → set the next stage → `onStageEnter(next)`
  (transmissions, rumours, castle reveal, pylon spawn for already-active sectors) → `checkStage()` → `Game.save()`.
- These are the **only** triggers:
  `intro` → `Game.questEvent('curator')` (ui.js, first Curator talk) · `<act>_clue_i` → clue trial won ·
  `<act>_key` → `collect('key')`, which also sets `G.keys[act] = true` (never at boss death) · `<act>_gate` → gate trial won ·
  `castle_gens` and `castle` → `checkStage()` · `egg` → `collect('egg')`.
- `checkStage()` is idempotent. Call it after every advance, after each pylon kill, after the castle boss dies and at the
  end of `start()`. Rules: stage `castle_gens` && `generators.every(Boolean)` → advance · stage `castle` && `G.quest.castle`
  → advance · stage `<act>_key` && `G.keys[act]` → advance.
- `Game.questEvent(name)`: `'curator'` → `advance('intro')`; `'outro'` → set `G.quest.outro = true`, run `spawnCastleExtras`, save.

### 6.2 Interaction (A02)
`nearestInteractable(56)` covers `kind` `'npc' | 'site'`. `Game.prompt()`: NPCs as today. Sites return
`{ x, y: y−30, text: role === 'cabinet' ? 'Play' : 'Gate' }` for every cabinet and gatedoor in range, locked ones included,
because touch players only get a TALK button when `prompt()` is non-null. `interact()` dispatch:
- npc → `UI.talk(n)`. The hub altar is handled as today, but shows progress only (keys 3/3, gates 3/3, next objective).
- cabinet → `cabinetInteract(e)`: start the clue trial if its stage is current. Otherwise one line:
  done → `'Already solved — your initials are on the high-score table.'`; future → `'This cabinet is dark — solve the earlier cabinets first.'`;
  another trial active → `'Finish your current trial first.'`.
- gatedoor → `gateInteract(e)`: if the gate's stage is current — crystal → `UI.riddle()` (unless riddle Sixers live:
  `'Clear the Sixers first.'`), copper/jade → start the gate trial. If not current: done → `'The gate stands open.'`,
  otherwise → `'The {Key name} fits here — find it first.'`.

### 6.3 Site entities (A18)
`{ kind: 'site', id: nid++, role: 'cabinet'|'gatedoor', act, index, x, y, r: 16, sector: k }`. `sector` is mandatory so
deactivation removes them. Done/open states are **derived**, never stored. The cabinet stands at tile (HALF, HALF−2) of its clue sector,
the gatedoor at (HALF, HALF−4) of its gate sector. `spawnSector` adds them, never duplicating one that is already present. Every site
sector is `special`: ambient enemies ×0.4, no random chest.
Won clue reward (A10): a gold chest `{ cid: 'clue:'+act+':'+i, theme: site theme, tier: 'gold' }` at tile (HALF+2, HALF−2).
`spawnSector` adds it while `isDone(that clue stage)`, and it is also pushed at completion. The existing `opened` set
remembers it. Gold chests roll missing theme loot, so the Aperture cabinet (jade clue 2) guarantees the Portal Gun.

### 6.4 Trials (A09, A10, A11)
- Module variable `let trial = null`, **never saved**: `{ seq, kind: 'clue'|'gate', act, index, siteKey, cx, cy, arenaR, wave, waves, phase, twist, pellets, outT }`.
- Spawns use `openSpot(centre, 3·TS, arenaR·TS)`. Every trial enemy gets `trialId = trial.seq`, `provoked = true`,
  `noFlee = true` and `sector = siteKey`. The shooter flee check honours `!e.noFlee`.
- Wave size: `randi(waveSize) + floor(d / waveSizePerSectors)` enemies, one per spawn (group sizes ignored). Clue waves draw from the
  site theme. Gate waves: each enemy is a `'sixer'` 25% of the time, otherwise `NX.weighted` from a random THEME_LIST theme.
  A wave is complete when no live entity has `trialId === trial.seq`. Summons, events and ambient enemies don't count.
- Leash, every tick: a trial enemy more than `(arenaR + trialLeash)·TS` from the centre is moved back to
  `openSpot(centre, 3·TS, arenaR·TS)`.
- Failure: the player stays more than `(arenaR + trialLeaveTiles)·TS` away for `trialLeaveSec` (HUD countdown
  `'Back to the cabinet! n'`), dies, or calls `Game.warp`. On failure, remove the trial enemies, toast
  `'Trial failed — the cabinet resets.'` and tally `trialFails`. `maybeEvent()` returns early while a trial is active.
- Clue trials: `campaign.clueWaves` (3) waves, plus the act twist from `acts[act].clueTrial`:
  - copper `'rift'`: waves 2–3 draw from one hashed *other* theme (not the site theme, not castle), with the rift banner and ring FX.
  - jade `'meteors'`: while a wave is alive, push `meteorCount` (4) hazards every `meteorEvery` (5) s:
    `{ type: 'meteor', x, y, warn: 1.2, r: 46, dmg: Math.round(3·(1 + dmgPerSector·d)), src: 'meteor' }` at `openSpot(centre, 0, arenaR·TS)`.
  - crystal `'pellets'`: at the start, `setTile(PELLET)` on walkable tiles with `(i+j)` even and `hypot ≤ pelletRadius` (6),
    skipping the cabinet's tile and GATE tiles, and `setTile(POWER)` at (±4,±4). Four trial ghosts (blinky, pinky, inky, clyde)
    stay alive, each respawning 3 s after it dies. The trial completes when no tile in `trial.pellets` is still PELLET.
    `Game.trial().left` = pellets remaining, `waves = 1`.
  - Banner on start: `acts[act].clueTrial.banner`.
- Gate trials: copper is `gateWaves.copper` (5) waves, then an echo of `darklord`. Jade is 3 sequential echoes
  `['mewtwo','voldemort','zealot']`. Crystal is the riddle, then `gateWaves.crystal` (3) waves, then an echo of `bigghost`.
  Wave counts come **only** from config.
- Echo: `makeEnemy(type)` with `hp` and `maxHp` × `echoHpMult[act]`, `echo = true`, `trialId`, registered as
  `bosses['trial:'+siteKey]` (boss bar, event suppression). Banner `'ECHO OF {NAME}'`, subtitle `'Gate Trial'`.
  It never writes `G.revealed`, tallies `bossAttempts`/`bossesDefeated` under `'echo:'+type`, and drops no key, relic or egg.
- `Game.trial()` → `null` or `{ title, wave, waves, left, kind, outT }`. `outT` is the leave countdown in seconds,
  or null while the player is inside.
- XP (A11): killEnemy multiplies XP by `trialXpMult` (0.3) when `e.trialId != null`, echoes included. On every trial win,
  call `gainXp(Math.round(trialBonusLevels · xpNeed(G.level)))` and toast `'TRIAL CLEAR +{xp} XP'`.
- Final Riddle: `Game.answerRiddle(i)`. Right → toast `finalRiddle.right` and start the crystal gate trial. Wrong → toast
  `finalRiddle.wrong` and spawn 4 provoked Sixers tagged `riddleSquad` at `openSpot(gate, 3·TS, 8·TS)`. While any of them
  lives, the gatedoor answers `'Clear the Sixers first.'`. There is no other lockout. `Game.riddleState()` → `{ blocked: bool }`.

### 6.5 Keys and guardians (A01, A03, A07)
- The `bossCheck` key branch spawns the guardian iff `stageId() === act+'_key' && !G.keys[act]`, no live `bosses[k]` and no
  `'key'` pickup in `k`. Otherwise, entering the key arena (within 13·TS of the centre) shows `acts[act].keyHint` once per visit.
- Jade moat hint: entering the jade key sector during `jade_key` without a nimbus, elytra or portalgun → toast naming Nimbus 2000
  (Wizarding Grounds chest), Elytra (Ender Dragon raid) and the Portal Gun (Aperture cabinet chest).
- Crystal twist: `damageEnemy` multiplies dmg by 0.25 when `e.type === 'bigghost' && e.keyId && !(P.power > 0)`, with a throttled
  `'NEED POWER'` floating text. Each time the guardian spawns, `setTile(T.POWER)` at the 4 tiles (HALF±6, HALF±6) of the crystal
  key sector. Existing pellet code handles eating them.
- Boss drops land on reachable tiles: in `bossDefeated`, `o = W.findOpen(floor(e.x/TS), floor(e.y/TS))`. Drop the key at the centre
  of `o` with extra `{ key, vx: 0, vy: 0 }`, which overrides the drift in `dropItem`. Do the same for raid relic and mount drops.
- On key pickup: show `gateIntro` (formatted with `{n}`/`{dir}` toward the gate) via `UI.say('The Curator ◈ transmission', …)`.
  There is no debrief at key pickup.
- `placePortal`: if the spot is still blocked after stepping back, snap to `W.findOpen` so a portal never lands in water or a wall.

### 6.6 Castle (A03, A06)
- Pylons: at the top of `spawnSector`, before the maxEnemies early return and without the 300 px guard: if `W.siteAt(sx,sy)` is
  generator `i`, `stageIdx(stage) ≥ stageIdx('castle_gens')`, `!G.quest.generators[i]` and no live entity has `generatorIndex === i`,
  push `makeEnemy('shieldgen', cx, cy − 3·TS, k, d)` with `generatorIndex = i, provoked = true`, plus `3 + floor(d/12)` provoked
  Sixers at `openSpot(centre, 3·TS, 6·TS)`. `onStageEnter('castle_gens')` runs the same block for sectors that are already active.
- `killEnemy` with `e.generatorIndex != null`: set `G.quest.generators[i] = true`, show banner `'PYLON n/3 DOWN'` and call
  `checkStage()`. When all three are down, call `World.dropForcefield()`, show banner `castle.shieldDown`, `shake(24)` and a
  cosmetic ring sweep over 1.5 s.
- Boss: a `bossCheck` castle branch keyed `bosses['castle']` spawns `'ioi655321'` iff `stageId() === 'castle' && !G.quest.castle`
  and the player is within 13·TS of the castle sector **centre**. Spawn point: centre − 6·TS (north). On death:
  `G.quest.castle = true`, `spawnCastleExtras(k)`, `checkStage()`. It drops coins/XP as a boss but no relic.
- `spawnCastleExtras(k)` is called from `spawnSector(castle)`, after the boss dies and after the outro:
  - Anorak NPC `{ kind: 'npc', role: 'anorak', look: 'anorak', r: 16, sector: k }` at tile (HALF, HALF−2), iff `G.quest.castle`.
  - The `'egg'` pickup iff `stageId() === 'egg' && G.quest.outro && !G.egg`, at `W.findOpen(HALF, HALF+2)` south of the ALTAR,
    with `vx = vy = 0`.
  - Never duplicates an entity that is already present. The Egg is never a boss drop.
- The castle intro (`castle.intro`) plays as a Curator transmission on the first entry into the castle sector while
  `stageIdx ≥ castle_gens` (one-shot per session is fine). Before that the castle is just a dark ruin behind a forcefield.
- `collect('egg')` runs the old altar victory block: `G.egg = true`, eggRank (6.8), telemetry, score, `victory = 8`, sound,
  flash, save, then `advance('egg')`. The victory banner reads `'{ordinal} through the Crystal Gate — first to the Egg'`.
- After victory the hub altar shows `'The Egg is yours.'`.

### 6.7 Guidance (A15)
`Game.objective()` → `{ text, sx, sy, r, riddle, rec }`:
- `intro`: (0,0), r 0, `'▶ Talk to the Curator at Nexus Prime'`.
- `<act>_clue_i`: centre = site + (jx, jy), each in [−1,1] by hash (stable per site); `r = campaign.hintRadius`. Text
  `'▶ Cabinet {i+1}/3 — {n} sectors {dir}'`, which becomes `'▶ Match the riddle to a map colour'` inside the circle and
  `'▶ Play the arcade cabinet'` in the site sector.
- `<act>_key`: exact, `'▶ Defeat {guardian} for the {Key}'`. For `jade_key` with no nimbus, elytra or portalgun, point at jade clue 2
  (the Aperture cabinet, already visited) with `'▶ Cross the data-moat: Nimbus 2000 · Elytra · Portal Gun'`.
- `<act>_gate`: exact, `'▶ Open the {Act} Gate'` (Act = Copper/Jade/Crystal).
- `castle_gens`: nearest unbroken pylon, `'▶ Destroy the IOI shield pylons ({k}/3)'` (k = destroyed).
- `castle`: exact, `'▶ Breach Anorak’s Castle'`.
- `egg`: `'▶ Speak with Anorak'`, then `'▶ Take the Egg'` once the outro has played.
- `done`: `sx: null`, `'Egg found! Hunt raid bosses for relics.'`.
- `{n}` = Chebyshev distance in sectors, `{dir}` = 8-way compass word (north, north-east, …; screen-up = north = −y)
  from the player's sector. `Game.fmtQuest(str, target)` fills `{name}`, `{n}`, `{dir}`, `{x}`, `{y}`.
- `riddle`: the intro's last line for clue 0, `clues[i−1]` for clue i, `clues[2]` for the key, `gateIntro` (formatted) for the gate.
- `rec = Game.recLevel(target distance)`. Text appends `' · LV {rec} advised'` when `G.level < rec − recSlack`. In that case
  `onStageEnter` also calls `Game.revealRumor()` and toasts `'Word is {boss} is near {x}, {y} — good XP.'`.
- `Game.recLevel(d) = max(1, round((comfortHits·avgBaseHit·(1 + dmgPerSector·d) − C.player.maxHp) / C.player.hpPerLevel + 1))`.
- Transmissions: right after `gateDone`, play the next act's intro as `UI.say('The Curator ◈ transmission', intro)`, then
  `UI.debrief('gate_'+act)`. After the crystal gate: `gateDone`, then banner `castle.reveal` (formatted `{x}`,`{y}`), then the debrief.
- `Game.questMarkers()` → `[{ sx, sy, r, kind: 'clue'|'key'|'gate'|'generator'|'castle', act, done, current, label, color }]`:
  the current target (with `r` from objective), finished sites (`done`), discovered future cabinets (dim), pylons during
  `castle_gens`, and the castle once `isDone('crystal_gate')`. The castle is not added to `discovered` by the reveal.

### 6.8 Rivals and rank (A12)
`rivalAt(r, i) = milestoneMinutes[race[i]] · r.paceMult · targetHours / 12 / C.rivals.pace`. Let `p` = the number of race ids the
player has completed (`Game.playerRaceProgress()`). `scheduled(r) = #{ i : playTime/60 ≥ rivalAt(r,i) }`,
`shown(r) = clamp(scheduled(r), max(0, p−1), p+1)`, capped at 7. `G.rivals[name]` stores the last shown count. `rivalsCheck` toasts
`'📡 {name} {raceLabels[j]}!'` for each newly shown j. `eggRank = 1 + #{ r : rivalAt(r, 5) < G.quest.ms.crystal_gate / 60 }`.
`Game.rivalStatus()` → `[{ name, color, progress: shown, label: raceShort[shown−1] || 'Starting out', corp }]`.
The first time (`G.quest.first`) the player completes a race id while every rival's shown < p: banner `'#1 ON THE SCOREBOARD'`
plus toasts from Artemis (`'Who is {name}, and why are they ahead of me?'`) and IOI-655321 (`'Noted. Escalating.'`).
Delete the old "rival found the egg" logic.

### 6.9 Telemetry (A16)
`advance(id)` calls `tel().event('milestone', { id, level })`, `tel().set('ms_'+id, Math.round(G.playTime))` (seconds) and
`tel().set('lv_'+id, G.level)`. `id` is the stage just **completed**. Trials tally `trialStarts` and `trialFails` under `stageId()`.
`start()` calls `tel().set('campaign', Game.campaignInfo())`, where `campaignInfo = { targetHours, ids: [...race, 'egg'],
minutes: ids.map(id => round(milestoneMinutes[id] · targetHours / 12)), dist: ids.map(id => site distance), rec: dist.map(recLevel) }`.

### 6.10 Economy (A14)
`Game.price(id) = round(prices[id] · (1 + difficultyPerSector · actDist))` for ids in `economy.scaledPrices`; others are unscaled.
`actDist = keyDist[act of the current stage]` (`intro` counts as copper), or `castleDist` from `castle_gens` onward.
`Game.buy` uses `Game.price`. Extra lives are capped at `economy.maxExtraLives` (+2 with `amber`). Buying at the cap returns
`'Your pockets are full of quarters.'`. `collect('extralife')` above the cap gives `+extraLifeOverflowCoins` coins instead.
The Amber relic adds lives up to the raised cap.

### 6.11 Difficulty (A13)
`makeEnemy`: `f = def.boss ? 1 + d·bossHpPerSector : 1 + d·difficultyPerSector` for HP/XP/coins. Normal-enemy damage uses
`dmgPerSector`, boss damage `bossDmgPerSector`. The exploder blast keeps its own `(1 + e.d·0.05)`.
`xpNeed(L) = Math.floor(C.player.xpBase * Math.pow(L, C.player.xpPow))`.

### 6.12 Save migration v1 → v2 (A08)
`Game.load` accepts `v` 1 or 2. For v1: call `W.init()` first so `World.quest` exists. Then `s.quest = defaultQuest()`,
`s.keys = {}`, `s.egg = false`, `s.eggRank = null`, delete `s.eggAt` and `s.clues`, `s.rivals = {}`. Move the player to the hub
(`gateWorld(0,0)` + 1.5·TS south). Drop every `s.mods` entry whose sector is within Chebyshev 1 of any `World.quest` site
(castle and pylons included). Set `s.v = 2`. Then `start()`, save immediately and toast
`'Campaign updated — the Curator has new riddles'`. Level, gear, relics, raids and pets are kept. Also guard v2 loads:
unknown or missing `quest.stage` → reset to `'intro'`, and missing fields → filled from `defaultQuest()`.

---

## 7. `js/ui.js` + feedback (owner C)

- **Curator** (A15, A20), driven by `Game.stageId()`:
  - `intro`: the two existing welcome lines, then `acts.copper.intro`. Then call `Game.questEvent('curator')`.
  - mid-act: the current `objective().riddle` plus a one-line hint (`Game.objective().text`), and a reminder that the map legend names worlds.
  - `jade_key` without a flyer/portal: the moat hint. `castle_gens`: the pylon hint. `castle`/`egg`: point to the castle. `done`: the old ending lines.
- **Anorak** (`role: 'anorak'`): if `!G.quest.outro`, `await UI.say('Anorak', castle.outro)` (formatted `{name}`), then
  `Game.questEvent('outro')`. Afterwards he speaks one `castle.after` line.
- **`UI.riddle()`**: `i = await UI.menu(finalRiddle.q, finalRiddle.options.map(label => ({ label })))`. `i < 0` cancels;
  otherwise `Game.answerRiddle(i)`. The menu must wrap a long question (it is ~300 chars) on phones.
- **HUD**: the objective line = `Game.objective().text`. Under the boss bar, a trial bar from `Game.trial()`:
  `'{title} · Wave {wave}/{waves} · {left} left'` (pellets: `'{left} dots left'`), plus a red `'Back to the cabinet! n'` while `outT`
  is set. A **quest arrow** sits at the minimap edge, pointing toward `(sx, sy)` and labelled `'{n} {dir}'`. It shows only while the
  player is outside the target circle.
- **Map**: draw `Game.questMarkers()` — a dashed circle when `r > 0`, an icon when exact, a ✓ when done, dim icons for future
  cabinets. Undiscovered sectors inside the current hint circle are drawn at 0.45 brightness (0.22 elsewhere) so their colours can
  be read. Until `isDone('crystal_gate')`, the castle sector is drawn in its `W.naturalTheme` colour with no marker. The info panel
  shows `objective().riddle`. The legend lists every THEME_LIST fandom with its map colour. Remove `keyHint` and the old key circles.
- **Scoreboard**: rows from `Game.rivalStatus()`, plus the player (`progress = Game.playerRaceProgress()`, label from raceShort, or
  `'EGG FOUND'` once `G.egg`). Sort by progress descending, the player first on ties.
- **Shop/garage** show `Game.price(id)` and disable by that price. The Extra Life row is disabled at the cap (`sub` says so).
- **Debrief moments**: `gate_copper`, `gate_jade`, `gate_crystal`, `egg`. `feedback.js` `MOMENT_TITLES` gains
  `gate_copper: 'Copper Gate open — quick debrief?'`, `gate_jade: 'Jade Gate open — quick debrief?'` and
  `gate_crystal: 'Crystal Gate open — quick debrief?'`. Remove `key` if it is unused.
- **`feedback/summarize.mjs`** (A17): delete the "no keys after 15+ min" rule. Add a **Campaign pacing** table with one row per id in
  `session.campaign.ids`: sessions that reached it, median `ms_` in minutes, target (median of the sessions' `campaign.minutes`),
  median `lv_` and rec. Segments: I = start→copper_gate, II = →jade_gate, III = →crystal_gate, IV = →egg. For each segment with ≥ 3
  sessions, `ratio = median segment minutes / target segment minutes` and `gap = median level at the segment end − rec`:
  ratio > 1.25 && gap ≤ −3 → suggest `world.dmgPerSector −0.01`; ratio > 1.25 && gap > −3 → navigation (`campaign.clueDist.<act> −2`
  or `campaign.hintRadius −1`); ratio < 0.75 → `world.dmgPerSector +0.01`. Median egg time < 0.83 · targetHours · 60 →
  `world.dmgPerSector +0.01` before touching `xpPow`. Trial knobs only when `trialFails / trialStarts > 0.5` for a stage
  (`campaign.waveSize −1` for a clue, `campaign.echoHpMult.<act> −0.1` for a gate). The boss-HP rule skips `'echo:'` rows and points
  them at `echoHpMult`. The summary row 'Avg keys found' becomes 'Median campaign stage reached'. summarize never reads browser globals.
- **`FEEDBACK_LOOP.md`**: delete the 'No keys after 15+ min' row. Add 'Act runs >25% long/short vs target' → `world.dmgPerSector`,
  `campaign.clueDist/keyDist`, `campaign.hintRadius`, `campaign.waveSize/echoHpMult`. **README**: the campaign summary.

---

## 8. Rendering (owner D)

- `T.FORCE`: a translucent additive orange (`#ff9b3d`) energy wall, height ~2.5 tiles, gently pulsing, instanced per chunk like
  other tile meshes, `depthWrite: false`. It casts no shadow.
- `R3D.refreshSector(sx, sy)`: marks that sector `dirty` (no-op if not built) so `syncSectors` rebuilds it from `W.sector`.
- `LOOK.castle`: a dark crimson sky, low warm key light, purple fill, red-orange fog. The `obsidian` wall style is a dark glossy block
  with purple emissive seams.
- `PK` gains `'egg'` → model `pk_egg`. `modelKey` for `kind: 'site'`: `'cabinet'`, or `'gatedoor:' + NX.CAMPAIGN.acts[act].color`.
  A gatedoor glows brighter (emissive) when `Game.isDone(act+'_gate')`. NPC `look: 'anorak'` → model `anorak`. Enemies use `art`
  (`shieldgen`, `ioi655321`). `entityScale` makes `ioi655321` giant like other bosses.
- Models (SDF, high-poly like the rest):
  - `cabinet`: an arcade cabinet with a glowing screen and lit marquee, joystick and buttons.
  - `gatedoor:<color>`: a massive ring portal on a stone plinth, tinted by act colour, with a glowing inner membrane.
  - `shieldgen`: an IOI pylon — a tapered dark-grey/orange tower, a glowing orange orb on top and floating rings.
  - `ioi655321`: a humanoid in Sixer armour (grey/black with orange), helmet visor, orange cape.
  - `anorak`: a tall robed lich-wizard in black and crimson, glowing red eyes, a crown and long sleeves.
  - `pk_egg`: a jewelled silver/gold egg with a soft glow.
  - Add them to the gallery list so `tools/gallery.html` shows them.
- `art.js` (2D fallback, `?2d`): draw FORCE tiles (orange translucent), the obsidian wall, castle floor, and simple sprites for
  cabinet, gatedoor, shieldgen, ioi655321, anorak and the egg pickup.

---

## 9. Feedback-loop hooks
- Milestone times (`ms_<id>`, seconds), levels (`lv_<id>`) and `campaign` info → the Campaign pacing table in `summarize.mjs`.
- Gate debriefs (`gate_<act>`) tell us per act where players stall (`scale` and `difficulty` votes).
- First knob to move if the median egg time < 10 h: `world.dmgPerSector` 0.08 → 0.09.

---

## 10. Writing — `NX.CAMPAIGN` text (verbatim)

`Game.fmtQuest()` fills `{name}`, `{n}` (sectors), `{dir}` (compass word), `{x}` and `{y}`. Ordering contract: the intro's last line
points to cabinet 0. `clues[i]` is shown when cabinet i is beaten and points to site i+1. `clues[2]` points to the key sector (theme
`NX.KEYS[act].theme`). `gateIntro` is shown on key pickup. `gateDone` is followed at once by the next act's intro as a Curator
transmission. The copper intro follows the two existing welcome lines.

```js
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
```

---

## 11. Acceptance checks (used by review and playtests)
1. Fresh game: the stage goes `intro` → … → `done` through the triggers in 6.1 only. Every stage can be reached again after
   a death, a reload or leaving the sector (no softlock).
2. Touch: every cabinet and gatedoor produces a `Game.prompt()` and the TALK button.
3. The jade key is reachable with the Portal Gun alone (guaranteed by the Aperture cabinet chest) and with either flyer.
4. FORCE stops walking, flying, ghosts, shots, portal shots and the pickaxe. Reloading after the pylons are down never brings it back.
5. A v1 save loads into v2 at the hub with level, gear and relics kept and `stage === 'intro'`.
6. No page errors in 3D or `?2d`. Every new model builds. Map, HUD and scoreboard render at 390×844 and 1280×800.
7. `feedback/summarize.mjs` runs on an export that contains `ms_*` and `campaign`, and prints the pacing table.
