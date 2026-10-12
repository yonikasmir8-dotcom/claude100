# Changelog

Each entry notes which feedback drove the change (see FEEDBACK_LOOP.md).

## 0.2.0 — The Three Gates (a 10+ hour campaign)
- The egg hunt is now a campaign of 20 stages (design and numbers: `docs/CAMPAIGN.md`). Three acts each follow the same
  path: 3 arcade-cabinet **Clue Trials** → a **key guardian** → a **Gate Trial**. The finale is a siege of
  **Anorak's Castle**: destroy 3 IOI shield pylons, defeat IOI-655321, and take the Egg from Anorak.
- Clue trials get a twist per act: a dimensional rift, meteor storms, or a Pac-Man pellet board with ghosts. Gate trials:
  5 waves plus an echo of the Dark Lord; a boss rush of three echoes; the Final Riddle followed by waves and Blinky XL.
- Each key has a twist. Ganon's island sits behind a data-moat (fly over it, or use the Portal Gun from the Aperture cabinet).
  Blinky XL only takes real damage while you're powered up.
- Riddles name a world, never a sector. You match them to map colours inside a dashed hint circle, and the HUD has a quest arrow.
  An "LV n advised" hint appears with a rumour of a raid boss worth farming.
- Difficulty curve: enemy damage now scales with distance (`world.dmgPerSector`), XP is polynomial (`xpPow`), shop
  consumables cost more each act, and Extra Lives are capped.
- Rivals race you over 7 milestones, and your rank is set at the Crystal Gate. A "#1 ON THE SCOREBOARD" moment if you lead.
- New models: arcade cabinet, gate portals, IOI pylon, IOI-655321, Anorak, the Egg. The IOI forcefield is an energy wall.
- Feedback loop: milestone times and levels are recorded per stage. `summarize.mjs` prints a **Campaign pacing** table against
  the 12 h target and suggests which knob to turn per act. There is a debrief after every gate.
- Old saves migrate. You keep your level, gear, relics and pets, and the campaign starts over at the Curator.
- Feedback that drove it: _the player's answer to "how long should the egg hunt be?" — "10+ hours for egg hunt"._

## 0.1.0 — THE NEXUS, first playable
- 3D multiverse of 10,201 procedural sectors across 20 fandoms, rendered with Three.js (dynamic
  per-fandom lighting, fog, shadows, weather, chunk-culled instanced terrain).
- 80+ high-poly sculpted models (SDF + Surface Nets, built in-engine), plus `tools/gallery.html`.
- The Egg Hunt: Curator riddles, three key guardians (The Dark Lord, Ganon, Blinky XL), the altar.
- 17 raid bosses with relics, Godzilla world event, rifts, IOI raids, meteors, supply drops.
- 25 crossover weapons, 5 mounts, catch-anything Poké Balls and a 3-member squad.
- Rival gunters and scoreboard, kill-streak announcer, shop, save/continue, touch controls.
- Feedback loop: session telemetry, moment-based debriefs, JSON export, `feedback/summarize.mjs`.
- Feedback that drove it: _the initial brief — "Ready Player One style multifandom mix, Marvel, DC,
  the whole kaboodle, expansive, 3D, high-poly models"._
