# Eclipse Vanguard

An original space-combat game built with three.js. Fly the lead interceptor of the carrier *Aurora*: clear three raider wings, then destroy the dreadnought *Kharon* by breaking its three reactor cores.

Everything is procedural — models, textures, planet, nebula, sound effects and music are generated at runtime, so there are no asset files.

## Play

Open `index.html` in a desktop browser (Chrome, Edge or Firefox). No server or install is needed; `game.js` is a prebuilt bundle.

| Input | Action |
| --- | --- |
| Mouse | Steer |
| Left click / Space | Lasers |
| Right click / F | Homing missile (needs a lock) |
| W / S | Throttle |
| A / D | Roll |
| Shift | Boost |
| T | Next target |
| P / Esc | Pause |
| M | Sound on/off |

## Rendering

HDR pipeline with 4x MSAA, bloom, ACES tone mapping, chromatic aberration, vignette and film grain. The nebula sky is baked once to a cubemap and reused as the PBR environment; the planet (continents, clouds, city lights, atmosphere) is a live shader. Render scale drops automatically if the frame rate falls.

## Develop

```
npm install
npm run build   # src/ -> game.js
npm run dev     # watch + local server
```

Source lives in `src/`: `main.js` (game loop, AI, waves), `world.js` (sky, planet, asteroids), `models.js` (ships), `fx.js` (particles, bolts), `hud.js`, `audio.js`.
