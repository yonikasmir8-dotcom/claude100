# THE NEXUS — A World Beyond Worlds

A Ready Player One–style multifandom action RPG in 3D. One universe, **10,201 procedurally generated
sectors**, **20 fandoms** (Star Wars, Marvel, DC, Pokémon, Mario, Zelda, Pac-Man, Minecraft,
Ghostbusters, TRON × The Matrix, Harry Potter, Lord of the Rings, Jurassic Park, Halo, Star Trek,
Doctor Who, Sonic, Stranger Things, Dragon Ball Z, Portal), and **one Easter egg**.

Solve the Curator's riddles, beat the three key guardians, and open the Egg altar before the rival
gunters (and IOI's Sixers) get there first.

## Play

No build step, no install — everything (including Three.js) is vendored.

- Open `index.html` in a browser, **or**
- `./launch.sh` (serves on http://127.0.0.1:8080), **or**
- `python3 -m http.server` and open http://localhost:8000

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Move | WASD / arrows | Left thumb (virtual stick) |
| Attack | Space or left click (aim with mouse) | Right side / ATK (auto-aim) |
| Switch weapon | Q / R / Tab, or 1–9 | ⟳ button |
| Poké Ball (catch anything weakened) | C | Ball button |
| Holy Hand Grenade | G | BOOM |
| Ride (DeLorean, Batmobile, Ecto-1, Nimbus 2000, Elytra) | V | RIDE |
| Infinity Gauntlet snap | F | SNAP |
| Talk / interact | E | TALK |
| Map & warp | M | MAP |
| Zoom | Mouse wheel | — |
| Pause (squad, relics, feedback) | Esc / P | ❚❚ |

## What's in it

- **3D world** rendered with Three.js: per-fandom terrain (Gotham skyscrapers with lit windows, a neon
  Pac-Maze, Minecraft stone, Hyrule forests…), dynamic lighting and fog per sector, shadows, weather.
- **High-poly sculpted models** for 80+ characters, bosses and items. They are built in-engine from
  signed-distance-field primitives (Blender-metaball style) and meshed with Surface Nets — no asset
  files. Browse them all in [`tools/gallery.html`](tools/gallery.html).
- **25 crossover weapons** — Lightsaber (deflects bolts), Mjölnir (chain lightning), Captain's Shield
  (ricochets), Web Shooters (root), Batarang, Lasso of Truth, Lantern Ring, Elder Wand (homing),
  Kamehameha (charge beam), Portal Gun (real portals), Proton Pack, Atomic Breath…
- **Catch anything**: weaken any enemy — a Stormtrooper, a Dalek, a Weeping Angel — and recruit it.
- **17 raid bosses** (Thanos, Darkseid, Voldemort, the Balrog, Godzilla…) with relics: Infinity
  Gauntlet, Mother Box, Mithril, Borg implant, Regeneration…
- **World events**: kaiju landfall, dimensional rifts, IOI raids, meteor showers, supply drops.
- **Rivals & scoreboard**, kill-streak announcer, pets/squad, save/continue.

## Improving the game (feedback loop)

Every session records telemetry and asks short debrief questions (on death, key found, egg found, or
from the pause menu). Export → `feedback/inbox/` → `node feedback/summarize.mjs` → change knobs or
content → ship. See **[FEEDBACK_LOOP.md](FEEDBACK_LOOP.md)**.

## Dev flags & tools

- `?2d` — classic 2D renderer (also the automatic fallback when WebGL is unavailable)
- `tools/gallery.html` — turntable of every sculpted model (`?only=dalek,thanos`, `?still`)

## Files

| File | What |
|---|---|
| `index.html`, `style.css` | Page shell, title, pause menu, debrief form |
| `config.js` | Every balance / scale knob + version |
| `js/content.js` | Fandoms, enemies, bosses, weapons, relics, mounts, events, dialogue |
| `js/world.js` | Procedural multiverse (sectors, regions, key & raid placement) |
| `js/game.js` | Simulation: player, weapons, AI, bosses, pets, loot, events, saves |
| `js/sdf.js` | SDF sculpting + Surface Nets mesher |
| `js/models.js` | Every sculpted model (data) |
| `js/render3d.js` | Three.js renderer |
| `js/art.js` | 2D art (HUD icons, 2D fallback renderer) |
| `js/ui.js` | HUD, minimap, multiverse map, dialogue, shops, touch controls |
| `js/main.js` | Boot, title, pause, main loop |
| `feedback.js` | Telemetry + debrief capture/export |
| `feedback/summarize.mjs` | Turns exports into `feedback/SUMMARY.md` |
| `vendor/three.min.js` | Three.js r149 (MIT) |

_Unofficial, non-commercial fan project. All franchises belong to their respective owners._
