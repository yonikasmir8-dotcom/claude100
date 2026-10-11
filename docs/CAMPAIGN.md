# THE NEXUS — Campaign "The Three Gates" (v0.2 design + interface contract)

Player decision (feedback round 1): **the egg hunt should take 10+ hours.**
Target: median **~12 h** of play from New Game to the Egg for a player who explores, levels and
does raid bosses along the way. Every number below is a knob in `config.js → campaign` so the
feedback loop can tune pacing from real telemetry.

---

## 1. Structure

| Stage id (`G.quest.stage`) | Goal | Where (Chebyshev sector distance from hub) | Gate / requirement |
|---|---|---|---|
| `intro` | Talk to the Curator | hub | — |
| `copper_clue_0..2` | Clear 3 **Clue Trials** at arcade cabinets | d ≈ 3, 6, 9 | each clue reveals the next site |
| `copper_key` | Defeat **The Dark Lord**, take the Copper Key | d = 12 | guardian only manifests once all 3 copper clues are done |
| `copper_gate` | Clear the **Copper Gate Trial** (5 waves + echo boss) | d = 10 (different bearing) | must hold the Copper Key |
| `jade_clue_0..2` | 3 Clue Trials | d ≈ 14, 18, 21 | |
| `jade_key` | Defeat **Ganon** on an island ringed by a data-moat | d = 25 | moat (WATER ring) → needs a flying mount (Nimbus 2000 / Elytra) **or** Portal Gun |
| `jade_gate` | **Jade Gate Trial**: boss rush of 3 echo raid bosses | d = 22 | Jade Key |
| `crystal_clue_0..2` | 3 Clue Trials | d ≈ 28, 32, 35 | |
| `crystal_gens` | Destroy 3 **IOI Shield Generators** around the Crystal Key sector | key ± 2–3 sectors | each generator defended by Sixers |
| `crystal_key` | Defeat **Blinky XL** inside the (now down) forcefield | d = 38 | FORCE ring drops when all 3 generators die |
| `crystal_gate` | **Crystal Gate Trial**: answer the Final Riddle (menu), then 3 waves + echo boss | d = 36 | Crystal Key |
| `castle` | Reach **Anorak's Castle** and defeat **Anorak** | d = 46 | revealed after the Crystal Gate |
| `egg` | Pick up the Egg in the castle → victory | castle | — |

Stage order is the array `NX.CAMPAIGN.stages` (ids above, `_0.._2` expanded). `G.quest.stage` is an
index into it. Completed = index past it.

### Pacing math (why ~12 h)
- Walking ≈ 5.5 tiles/s → 1 sector ≈ 9 s; mounts 2.2–3.4×; warps to visited sectors are free.
- The real time sink is **power**: enemy stats scale `1 + d·world.difficultyPerSector` (d=38 → 5.6×).
  Players must level and gear up before each act's distance band is survivable.
- XP curve becomes polynomial: `xpNeed(L) = floor(player.xpBase · L^player.xpPow)` with
  `xpBase 12, xpPow 1.55` → ~L15 after Act I, ~L28 after Act II, ~L40+ at the castle.
- Raid bosses give relics that make later acts easier (overshield, mithril, regeneration…), and a
  flight mount is mandatory for Act II's key.
- Rivals now announce 7 milestones (keys + gates + egg); Percival reaches the egg at ~11.7 h.

---

## 2. Interface contract (all implementers must follow this exactly)

### 2.1 `config.js` — new / changed keys
```js
player: { ..., xpBase: 12, xpPow: 1.55, /* xpGrowth removed */ },
campaign: {
  targetHours: 12,
  clueDist: { copper: [3, 6, 9], jade: [14, 18, 21], crystal: [28, 32, 35] },
  keyDist: { copper: 12, jade: 25, crystal: 38 },
  gateDist: { copper: 10, jade: 22, crystal: 36 },
  castleDist: 46,
  clueWaves: 3,            // waves in a clue trial
  gateWaves: 5,            // waves before the echo boss in copper/crystal gate trials
  waveSize: [5, 8],        // enemies per wave (scaled by +1 per 6 sectors of distance)
  echoHpMult: 0.6,         // gate-trial boss echoes
  moatWidth: 4, forceRadius: 14,
},
```
`keys` (old `keys: {copper,jade,crystal}`) is **removed**; use `campaign.keyDist`.

### 2.2 Tiles (`js/content.js`)
- New tile `T.FORCE = 15` — IOI forcefield. Added to `NX.SOLID` and `NX.STOPS_SHOTS`.
- Ghost / flying movement (`moveCircle` mode `'ghost'`) must also be blocked by `T.FORCE`.

### 2.3 Content (`js/content.js`)
- `NX.CAMPAIGN = { stages: [...ids], acts: { copper: {...}, jade: {...}, crystal: {...} }, castle: {...}, finalRiddle: { q, options: [4 strings], answer: index } }`
  - each act: `{ name, color, intro: [lines spoken by the Curator when the act starts], clues: [3 riddle strings revealed on each clue], keyHint, gateIntro, gateDone, gateTrial: { type: 'waves'|'bossrush'|'riddle', waves, bosses: [boss ids] } }`
  - `castle: { name: "Anorak's Castle", intro: [...], boss: 'anorak', outro: [...] }`
- `NX.KEYS` stays (name, color, theme, boss) — `angle` and `riddle` may remain but are unused.
- New theme `NX.THEMES.castle` (not in `NX.THEME_LIST`): obsidian floor, dark walls, `gen: 'castle'`, enemies of mixed fandoms (sixers + echoes), `safe: false`.
- New enemies: `shieldgen` (IOI Shield Generator: `ai: 'turret'`, stationary, hp ~60, `noCatch`, `tag: 'robot'`, burst fire, `art: 'shieldgen'`, flag `generator: true`), `anorak` (final boss: `boss: true`, hp ~600, all nine patterns, summons `sixer`, color `#ff2a4a`, `art: 'anorak'`, r 30).
- `NX.RIVALS[i].at` becomes **7** milestone minutes: `[copperKey, copperGate, jadeKey, jadeGate, crystalKey, crystalGate, egg]`, Percival ≈ `[150, 190, 330, 370, 540, 580, 700]`, others progressively slower (IOI-655321 is the "corp" rival).

### 2.4 World (`js/world.js`)
- `World.init()` computes `World.quest`:
  ```js
  World.quest = {
    copper:  { clues: [{sx,sy},{sx,sy},{sx,sy}], key: {sx,sy}, gate: {sx,sy} },
    jade:    { clues: [...], key: {...}, gate: {...} },
    crystal: { clues: [...], key: {...}, gate: {...}, generators: [{sx,sy}×3] },
    castle:  { sx, sy },
  }
  ```
  Deterministic from the seed; every site is a distinct sector, never the hub, never adjacent to
  another site. `World.keySectors[id]` must still equal `World.quest[id].key` (other code uses it).
  Key-sector theme override (key ±1 → `NX.KEYS[id].theme`) stays. The castle sector's theme is
  `'castle'`; gates and clue sites keep their region's theme.
- `World.siteAt(sx, sy)` → `{ type: 'clue'|'key'|'gate'|'generator'|'castle', act: 'copper'|'jade'|'crystal'|null, index: number|null }` or `null`.
- Generation for special sectors (in addition to the existing road cross):
  - clue site: clear arena radius 7 around centre (FLOOR, DECOR ring at r≈7).
  - gate site: clear arena radius 11, ring of `PROP` pillars at r≈11 (8 pillars).
  - key sectors: as today (arena r 11). **Jade** key: `WATER` ring from r=13 to r=13+moatWidth
    (overrides the roads). **Crystal** key: `FORCE` ring at r = forceRadius..forceRadius+1.
  - castle: `gen: 'castle'` — obsidian floor, outer `WALL` ring r≈18 with a south entrance on the
    road, inner arena r 12, `ALTAR` at centre (the egg pedestal).
- `World.dropForcefield()` → converts every `FORCE` tile of the crystal key sector to `FLOOR` via
  `setTile` (so it persists in mods).
- `World.landingPos(sx, sy)` → world-px `{x, y}` where a warp should land. For the jade & crystal
  key sectors and the castle it is on the south road near the sector edge (outside the moat/field);
  otherwise just below the sector gate (current behaviour).
- `World.raidSectors` placement must avoid all quest sites (and their neighbours).

### 2.5 Game (`js/game.js`)
- Save field `G.quest = { stage: 0, clues: { copper: 0, jade: 0, crystal: 0 }, gates: { copper: false, jade: false, crystal: false }, generators: [false, false, false], castle: false, trial: null }` (trial is runtime-only → don't persist an active trial; on load set `trial: null`).
  `G.v` becomes **2**. Loading a v1 save migrates: add `G.quest`, clear `G.keys`, keep everything else,
  toast "Campaign updated — the Curator has new riddles".
- Helpers exported on `Game`:
  - `Game.stageId()` → current stage id string.
  - `Game.objective()` → `{ text, sx, sy, r }` (sector + hint radius in sectors, `r = 0` exact, `null` sx when no location) — **the HUD and map read only this**.
  - `Game.questMarkers()` → `[{ sx, sy, r, kind: 'clue'|'key'|'gate'|'generator'|'castle', act, done, label, color }]` for the map.
  - `Game.trial()` → `null` or `{ title, wave, waves, left, kind }` for the HUD.
  - `Game.answerRiddle(index)` → used by UI for the crystal gate's Final Riddle.
- Site entities (spawned by `spawnSector` when `World.siteAt` says so):
  - `{ kind: 'site', role: 'cabinet', act, index, done }` at clue sites (centre). Interact (E) starts
    the clue trial only if it is the **current** stage; otherwise a short line ("Already solved" /
    "This cabinet is dark — solve the earlier clues first").
  - `{ kind: 'site', role: 'gatedoor', act, open }` at gate sites. Interact with the act's key held and
    the act's key stage done → start the gate trial.
  - generators: enemies of type `shieldgen` at generator-site centres, flagged `e.generatorIndex`,
    only while `G.quest.generators[i]` is false. Killing one marks it; all three → `World.dropForcefield()`, banner.
  - castle: `anorak` boss spawns (via the existing `bossCheck` flow) when the crystal gate is done and
    the player is within 13 tiles of the castle centre; defeat drops an `egg` pickup; collecting it runs
    the existing victory flow (`victory = 8`, rank, debrief `'egg'`). The hub altar no longer ends the game:
    it shows campaign progress.
- Trials: one active at a time (`G.quest.trial`). Waves spawn around the site centre from the site
  sector's theme enemies (gate trials: mixed fandoms + sixers), count `waveSize` +1 per 6 sectors of
  distance; next wave when all trial enemies are dead; echo bosses = `makeEnemy(boss)` with
  `hp *= echoHpMult`, `e.echo = true` (no relic/key drops, no `G.raids` change). Leaving the site
  sector (sector deactivates) or dying fails the trial (it can be restarted).
- Key guardians: `bossCheck` only spawns a key guardian when the stage is that act's `_key` stage.
  Otherwise entering the key arena shows a hint toast once per visit.
- Jade moat hint: entering the jade key sector without a flying mount → toast naming Nimbus 2000
  (Wizarding Grounds chest), Elytra (Ender Dragon raid) and the Portal Gun (Aperture chest).
- `Game.warp` uses `World.landingPos`. Boom-tube (Mother Box) warps obey the same rule.
- Milestones: on each stage advance call `tel().event('milestone', { id, level })` and
  `tel().set('ms_' + id, Math.round(G.playTime))`; debrief prompts after each **gate** and the egg.
- Rivals: `rivalsCheck` / `Game.rivalStatus()` use the 7 milestones; status returns
  `{ name, color, progress: 0..7, egg: bool }`.
- XP: `xpNeed(L) = Math.floor(C.player.xpBase * Math.pow(L, C.player.xpPow))`.

### 2.6 UI (`js/ui.js`)
- Curator dialogue is driven by the stage: intro → act intro riddle; mid-act → current clue riddle +
  where to look; `jade_key` → moat hint; `crystal_gens` → generator hint; post-crystal-gate → castle.
- HUD objective line = `Game.objective().text`. Trial banner under the boss bar from `Game.trial()`.
- Map: draw `Game.questMarkers()` (dashed circle when `r > 0`, icon when exact, check when done).
- Final Riddle: `UI.menu(question, 4 options)` → `Game.answerRiddle(i)`.
- Scoreboard shows rival progress as "Copper Gate / Jade Key …".
- Altar interaction text shows the 3 keys + 3 gates progress.

### 2.7 Rendering (`js/render3d.js`, `js/models.js`, `js/art.js`)
- `T.FORCE`: translucent additive orange energy wall, height 2.5, gently pulsing (instanced).
- Castle theme: `LOOK.castle` dark red sky; walls `obsidian` style (dark glossy box, purple emissive seams).
- Models: `cabinet` (arcade cabinet with glowing screen + marquee), `gatedoor` (massive ring portal on a
  plinth, tinted by act colour, glows brighter when open), `shieldgen` (pylon with glowing orb + rings),
  `anorak` (tall robed lich-wizard, black/crimson, glowing red eyes, crown), `pk_egg` (the Egg pickup).
- `modelKey` for `kind: 'site'`: `'cabinet'` or `'gatedoor:' + actColor`.
- 2D fallback (`art.js`): draw FORCE tiles and site entities simply.

---

## 3. Feedback-loop hooks
- Telemetry milestone times (`ms_<stageId>`) → `feedback/summarize.mjs` adds a **Campaign pacing** table
  (median minutes to each milestone vs. `campaign.targetHours`) and suggests which distance / trial knob
  to move when an act runs long or short.
- Debrief after each gate asks the usual questions; the `scale` and `difficulty` votes per act tell us
  where players stall.
