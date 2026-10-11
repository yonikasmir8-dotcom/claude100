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
Open `index.html` (or `./launch.sh`). The more people play, the better the signal.

## 2. Capture (automatic)
- **Telemetry** per play session: play time, sectors explored, distance from the hub, time spent per
  fandom, kills / deaths / damage by enemy and sector, boss fights started vs won, weapons found and
  used, captures, relics, mounts, world events, kill streaks, shop purchases, keys and egg timing.
- **Debriefs** pop up after a death (at most every few minutes), after each key, after the egg, and
  any time from **Pause → Give feedback**: fun ★1–5, difficulty, how the scale feels, favorite sector,
  which fandoms to add next (+ write-in), wanted features, best moment, what to change.

Everything stays in the browser. **Pause → Export feedback** downloads one JSON file.

## 3. Analyse
Drop exports into `feedback/inbox/` and run:

```bash
node feedback/summarize.mjs           # writes feedback/SUMMARY.md
node feedback/summarize.mjs --archive # ...and moves the inbox to feedback/processed/
```

The summary lists **suggested changes that name the exact knob or file** to touch.

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
| Boss rarely beaten | the boss `hp` / `patterns` in `NX.ENEMIES` |
| Scale "too empty" | `world.enemyDensity`, `world.npcChance`, `world.chestChance`, `events.everyMinutes` |
| Scale "overwhelming" | `world.radius`, `world.regionCells`, map hints in `js/ui.js` |
| No keys after 15+ min | `keys.copper/jade/crystal` distances, Curator hints |
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
