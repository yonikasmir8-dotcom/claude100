# The feedback loop

THE NEXUS improves in rounds: **play → capture → analyse → change → ship**, then measure whether
the change helped.

```
 ┌──────────┐   ┌──────────────────┐   ┌────────────────────┐   ┌──────────────────────┐   ┌─────────┐
 │  Play    │──▶│ Capture          │──▶│ Analyse            │──▶│ Change               │──▶│ Ship    │──┐
 │          │   │ telemetry +      │   │ summarize.mjs      │   │ config.js knobs or   │   │ bump    │  │
 │          │   │ debriefs, export │   │ → SUMMARY.md       │   │ content.js / models  │   │ version │  │
 └──────────┘   └──────────────────┘   └────────────────────┘   └──────────────────────┘   └─────────┘  │
      ▲                                                                                                 │
      └─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 1. Play
Open `index.html` (or `./launch.sh`). The more people play, the better the signal. The campaign
("The Three Gates", [docs/CAMPAIGN.md](docs/CAMPAIGN.md)) targets a median of ~12 h to the Egg, so
long sessions and returning players matter most.

## 2. Capture (automatic)
- **Telemetry** per play session: play time, sectors explored, distance from the hub, time spent per
  fandom, kills / deaths / damage by enemy and sector, boss fights started vs won (gate echoes as
  `echo:<boss>`), weapons found and used, captures, relics, mounts, world events, kill streaks, shop
  purchases, egg timing — and the **campaign**: when each stage was completed (`ms_<id>`, seconds of
  play) at which level (`lv_<id>`), the targets in effect (`campaign` = `Game.campaignInfo()`), and
  trial starts / fails per stage (`trialStarts`, `trialFails`).
- **Debriefs** pop up after a death (at most every few minutes), after each gate opens (Copper, Jade,
  Crystal), after the egg, and any time from **Pause → Give feedback**: fun ★1–5, difficulty, how the
  scale feels, favorite sector, which fandoms to add next (+ write-in), wanted features, best moment,
  what to change.

Everything stays in the browser. **Pause → Export feedback** downloads one JSON file.

## 3. Analyse
Drop exports into `feedback/inbox/` and run:

```bash
node feedback/summarize.mjs                         # writes feedback/SUMMARY.md
node feedback/summarize.mjs --archive               # ...and moves the inbox to feedback/processed/
node feedback/summarize.mjs a.json some/dir --out /tmp/s.md   # specific exports, custom output
```

The summary lists **suggested changes that name the exact knob or file** to touch (with the current
→ new value read from `config.js`).

### Campaign pacing (the 10+ hour promise)
The **Campaign pacing** table has one row per milestone in the sessions' `campaign.ids`
(`copper_key … castle_gens, egg`): sessions that reached it, median minutes, target minutes (the
median of the sessions' `campaign.minutes`), median level when it was completed, and the advised
level (`rec`). The **Median campaign stage reached** row in *At a glance* shows how far people get.

Acts are compared with their targets: **I** start → `copper_gate`, **II** → `jade_gate`, **III** →
`crystal_gate`, **IV** → `egg`. For every act with **≥ 3 sessions**:
`ratio = median act minutes ÷ target act minutes`, `gap = median level at the act's end − rec`.

| Act verdict | Suggestion |
|---|---|
| ratio > 1.25 and gap ≤ −3 (long, under-levelled) | `world.dmgPerSector` −0.01 |
| ratio > 1.25 and gap > −3 (long, players lost) | `campaign.clueDist.<act>` −2 or `campaign.hintRadius` −1 (act IV: `campaign.castleDist` −2) |
| ratio < 0.75 (short) | `world.dmgPerSector` +0.01 |
| median Egg time < 0.83 × `campaign.targetHours` | `world.dmgPerSector` +0.01 (0.08 → 0.09) **before** touching `player.xpPow` |

Trial knobs move only when a stage's `trialFails / trialStarts > 0.5` (over ≥ 3 starts):
`campaign.waveSize` −1 for a clue trial, `campaign.echoHpMult.<act>` −0.1 for a gate trial. Boss rows
named `echo:<boss>` are gate echoes: a rarely beaten echo points at `campaign.echoHpMult.<act>`, never
at the boss's `hp` in `js/content.js`. The **Debriefs by moment** table splits votes by
`gate_copper` / `gate_jade` / `gate_crystal`, so a stall shows up in the act where it happened.

## 4. Change
Ask Claude: _"process the feedback in feedback/inbox"_. The routine:
1. Run the summarizer; read the numbers **and** the comments.
2. Balance → `config.js` (small steps, 10–20%, one idea per knob).
3. Content → `js/content.js` / `js/models.js` (recipes below).
4. Playtest (headless or by hand) with the new build.
5. Bump `version` in `config.js` and add a `CHANGELOG.md` entry naming the feedback that drove each change.
6. Archive the processed exports.

## 5. Ship
Commit and push. Every session records the game `version`, so the next summary shows whether the
change worked (e.g. did "too hard" votes drop after 0.2.0?).

## Cheat sheet: signal → knob

| Signal | Where |
|---|---|
| "Too hard" / dying early | `player.maxHp`, `player.iframes`, `world.difficultyPerSector`, `combat.enemyDmgMult` |
| "Too easy" | `world.difficultyPerSector`, `combat.enemyHpMult`, `world.enemyDensity` |
| One enemy dominates deaths | that enemy in `NX.ENEMIES` (`js/content.js`): `dmg`, `fire`, `speed`, `shot.speed` |
| One sector dominates deaths | that theme's `count` / `enemies` weights in `NX.THEMES` |
| Boss rarely beaten | the boss `hp` / `patterns` in `NX.ENEMIES` (`echo:<boss>` rows → `campaign.echoHpMult.<act>`) |
| Scale "too empty" | `world.enemyDensity`, `world.npcChance`, `world.chestChance`, `events.everyMinutes` |
| Scale "overwhelming" | `world.radius`, `world.regionCells`, map hints in `js/ui.js` |
| Act runs >25% long/short vs target | `world.dmgPerSector`, `campaign.clueDist/keyDist`, `campaign.hintRadius`, `campaign.waveSize/echoHpMult` |
| Egg found in under 10 h (median) | `world.dmgPerSector` 0.08 → 0.09 first, then `player.xpPow` |
| A trial fails > 50% of the time | clue: `campaign.waveSize`; gate: `campaign.echoHpMult.<act>` |
| Weapon found but unused | its stats / gimmick in `NX.WEAPONS` |
| Too poor / too rich | `economy.coinMult`, `economy.prices` |

## Recipe: add a fandom sector (the most-voted request)
1. **Theme** — add an entry to `NX.THEMES` in `js/content.js`: name, fandom, map colour, generator
   (`natural` / `city` / `maze` / `grid`), floor/wall styles, enemies with weights, loot, NPC lines.
2. **Enemies** — add 2–3 entries to `NX.ENEMIES` (reuse an `ai` behaviour; add flags if needed).
3. **Models** — sculpt them in `js/models.js`. Most humanoids are one line with `humanoid({...})`;
   creatures are a handful of SDF primitives. Check them in `tools/gallery.html?only=<key>`.
4. **Raid boss** (optional) — add a boss to `NX.ENEMIES` and an entry to `NX.RAIDS` with a reward.
5. **Lighting** — add a mood to `LOOK` in `js/render3d.js`.
6. **Weapon** (optional) — add to `NX.WEAPONS` and a hand prop in `propMesh()` in `js/render3d.js`.
7. Bump the version, note in `CHANGELOG.md` which votes asked for it.
