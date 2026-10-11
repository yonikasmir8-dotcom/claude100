#!/usr/bin/env node
// Feedback loop, part 2: analyse.
// Reads every export in feedback/inbox/*.json and writes feedback/SUMMARY.md: aggregate play
// telemetry, debrief votes, comments, and suggested changes that point at config.js / content.js.
//
//   node feedback/summarize.mjs            # summarize the inbox
//   node feedback/summarize.mjs --archive  # ...then move the inbox files to feedback/processed/
import { readdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const inbox = join(here, 'inbox'), processed = join(here, 'processed');
const files = existsSync(inbox) ? readdirSync(inbox).filter((f) => f.endsWith('.json')) : [];
if (!files.length) {
  console.log('feedback/inbox/ is empty — play THE NEXUS, open the pause menu, click "Export feedback", and drop the file here.');
  process.exit(0);
}

// Merge exports; the same session/debrief can appear in several exports, keep the newest.
const sessions = new Map(), feedback = new Map();
for (const f of files) {
  const data = JSON.parse(readFileSync(join(inbox, f), 'utf8'));
  for (const s of data.sessions || []) { const old = sessions.get(s.id); if (!old || (s.updatedAt || '') > (old.updatedAt || '')) sessions.set(s.id, s); }
  for (const fb of data.feedback || []) feedback.set(`${fb.at}|${fb.sessionId}`, fb);
}
const S = [...sessions.values()], F = [...feedback.values()];

// ---------- helpers ----------
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const tally = (items) => items.reduce((m, k) => (k == null || k === '' ? m : ((m[k] = (m[k] || 0) + 1), m)), {});
const merge = (objs) => objs.reduce((m, o) => { for (const [k, v] of Object.entries(o || {})) m[k] = (m[k] || 0) + v; return m; }, {});
const top = (obj, n = 12) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
const pct = (x) => `${Math.round(x * 100)}%`;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const mins = (sec) => `${Math.round(sec / 60)} min`;
const T = (key) => merge(S.map((s) => (s.tallies || {})[key]));
const Cn = (key) => S.map((s) => (s.counters || {})[key] || 0);

// ---------- aggregates ----------
const playtimes = S.map((s) => s.playTimeSec || 0);
const keys = S.map((s) => s.keys || 0);
const eggRate = S.length ? S.filter((s) => s.egg).length / S.length : 0;
const deathsBy = T('deathsBy'), deathsIn = T('deathsIn'), damageBy = T('damageBy'), kills = T('kills');
const themeTime = T('themeTime'), weaponUse = T('weaponUse'), weaponsFound = T('weaponsFound'), captured = T('captured');
const bossesDefeated = T('bossesDefeated'), bossAttempts = T('bossAttempts'), eventsSeen = T('eventsSeen'), mountTime = T('mountTime'), streaks = T('streaks');
const relicsFound = T('relicsFound'), bought = T('bought');
const sectorsDisc = Cn('sectorsDiscovered'), deaths = Cn('deaths'), warps = Cn('warps');
const firstKeyTimes = S.map((s) => s.keyAt_copper || s.keyAt_jade || s.keyAt_crystal).filter(Boolean);

const fun = F.map((f) => f.fun).filter((x) => x != null);
const diff = tally(F.map((f) => f.difficulty)), scale = tally(F.map((f) => f.scale)), fav = tally(F.map((f) => f.favorite));
const fandoms = tally(F.flatMap((f) => f.fandoms || [])), features = tally(F.flatMap((f) => f.features || []));
const other = F.map((f) => f.fandomOther).filter(Boolean);
const moments = tally(F.map((f) => f.moment));

// ---------- suggestions: each one points at a knob or a content file ----------
const out = [];
const hard = diff.too_hard || 0, easy = diff.too_easy || 0, right = diff.just_right || 0, votes = hard + easy + right;
if (votes >= 2 && hard > easy + right / 2) out.push('Players say **too hard** → `player.maxHp` +2, or `world.difficultyPerSector` −0.02, or `combat.enemyDmgMult` 0.85.');
if (votes >= 2 && easy > hard + right / 2) out.push('Players say **too easy** → `world.difficultyPerSector` +0.03, `combat.enemyHpMult` 1.2, or `world.enemyDensity` 1.3.');
if (S.length >= 3 && avg(deaths.map((d, i) => d / Math.max(1, playtimes[i] / 600))) > 3) out.push('More than 3 deaths per 10 minutes on average → soften the early game (`player.iframes`, `combat.enemyDmgMult`).');
const [killer, killerN] = top(deathsBy, 1)[0] || [];
const totalDeaths = Object.values(deathsBy).reduce((a, b) => a + b, 0);
if (killer && totalDeaths >= 4 && killerN / totalDeaths > 0.35) out.push(`**${killer}** causes ${pct(killerN / totalDeaths)} of deaths → tune it in \`js/content.js\` (NX.ENEMIES.${killer}: dmg / fire / speed).`);
const [deadly, deadlyN] = top(deathsIn, 1)[0] || [];
if (deadly && totalDeaths >= 4 && deadlyN / totalDeaths > 0.4) out.push(`Most deaths happen in **${deadly}** → lower its \`count\` range or swap its toughest enemy in \`js/content.js\`.`);
const sc = scale.too_empty || 0, so = scale.overwhelming || 0;
if (sc >= 2 && sc > so) out.push('Scale feels **too empty** → raise `world.enemyDensity`, `world.npcChance`, `world.chestChance`, or shorten `events.everyMinutes`.');
if (so >= 2 && so > sc) out.push('Scale feels **overwhelming** → shrink `world.radius`, raise `world.regionCells` (bigger, calmer regions), or show more map hints.');
if (S.length >= 3 && avg(keys) < 1 && median(playtimes) > 900) out.push('Players play 15+ minutes without a key → move keys closer (`keys.copper`) or make the Curator\'s map hints tighter.');
for (const [boss, n] of top(bossAttempts, 30)) {
  const wins = bossesDefeated[boss] || 0;
  if (n >= 3 && wins / n < 0.3) out.push(`Boss **${boss}** is beaten only ${pct(wins / n)} of the time (${wins}/${n}) → lower its hp in \`js/content.js\`.`);
}
if (fun.length >= 3 && avg(fun) < 3) out.push(`Average fun is ${avg(fun).toFixed(1)}/5 — read the comments below before changing numbers.`);
const [wantFandom] = top(fandoms, 1)[0] || [];
if (wantFandom) out.push(`Most requested new fandom: **${wantFandom}** → follow "Recipe: add a fandom sector" in FEEDBACK_LOOP.md.`);
const [wantFeature] = top(features, 1)[0] || [];
if (wantFeature) out.push(`Most requested feature: **${wantFeature}**.`);
const unused = Object.keys(weaponsFound).filter((w) => !(weaponUse[w] > 5));
if (unused.length) out.push(`Weapons found but barely used: ${unused.join(', ')} → buff them or make their gimmick clearer (\`NX.WEAPONS\`).`);
if (!out.length) out.push('No strong signal yet — collect more sessions and debriefs.');

const table = (obj, h1, h2, n = 12, f = fmt) => {
  const rows = top(obj, n);
  return rows.length ? `| ${h1} | ${h2} |\n|---|---|\n${rows.map(([k, v]) => `| ${k} | ${f(v)} |`).join('\n')}\n` : '_none yet_\n';
};
const comments = (key) => {
  const xs = F.filter((f) => f[key]).map((f) => `- (v${f.version}, ${f.moment}${f.fun ? `, fun ${f.fun}/5` : ''}) ${f[key].replace(/\s+/g, ' ')}`);
  return xs.length ? xs.join('\n') + '\n' : '_none yet_\n';
};

const md = `# THE NEXUS — feedback summary

_Generated ${new Date().toISOString()} from ${files.length} export file(s): ${files.join(', ')}_

## At a glance

| Metric | Value |
|---|---|
| Play sessions | ${S.length} |
| Debriefs | ${F.length} (${Object.entries(moments).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}) |
| Game versions | ${[...new Set(S.flatMap((s) => s.versions || [s.version]))].join(', ')} |
| Median / total play time | ${mins(median(playtimes))} / ${mins(playtimes.reduce((a, b) => a + b, 0))} |
| Median sectors explored | ${median(sectorsDisc)} |
| Median max distance from hub | ${median(S.map((s) => (s.maxes || {}).maxDist || 0))} sectors |
| Median player level | ${median(S.map((s) => s.level || 1))} |
| Avg keys found | ${avg(keys).toFixed(1)} / 3 |
| Egg found | ${pct(eggRate)} of sessions |
| Median time to first key | ${firstKeyTimes.length ? mins(median(firstKeyTimes)) : '—'} |
| Deaths per session (median) | ${median(deaths)} |
| Warps per session (median) | ${median(warps)} |
| Avg fun | ${fun.length ? avg(fun).toFixed(1) + ' / 5' : '—'} |
| Difficulty votes | too easy ${easy} · just right ${right} · too hard ${hard} |
| Scale votes | too empty ${scale.too_empty || 0} · epic ${scale.just_right || 0} · overwhelming ${scale.overwhelming || 0} |

## Suggested changes

${out.map((s) => `- ${s}`).join('\n')}

## Players want next

**Fandoms**

${table(fandoms, 'Fandom', 'Votes')}${other.length ? `\nWrite-ins: ${other.map((o) => `"${o}"`).join(', ')}\n` : ''}
**Features**

${table(features, 'Feature', 'Votes')}
## Favorite sector

${table(fav, 'Sector', 'Votes')}
## Where players spend time

${table(themeTime, 'Sector', 'Minutes', 21, (v) => (v / 60).toFixed(1))}
## What kills players

${table(deathsBy, 'Enemy / cause', 'Deaths')}
**Deaths by sector**

${table(deathsIn, 'Sector', 'Deaths')}
**Damage taken by source**

${table(damageBy, 'Source', 'HP')}
## Bosses

| Boss | Fights started | Defeated |
|---|---|---|
${top(bossAttempts, 40).map(([b, n]) => `| ${b} | ${n} | ${bossesDefeated[b] || 0} |`).join('\n') || '| — | — | — |'}

## Weapons

${table(weaponUse, 'Weapon', 'Uses')}
**Found:** ${Object.keys(weaponsFound).join(', ') || '—'}

## Squads (Poké Ball captures)

${table(captured, 'Captured', 'Count')}
## Everything else

**Kills:** ${top(kills, 10).map(([k, v]) => `${k} ${fmt(v)}`).join(' · ') || '—'}

**Relics:** ${Object.keys(relicsFound).join(', ') || '—'} · **Mount time:** ${top(mountTime, 6).map(([k, v]) => `${k} ${(v / 60).toFixed(1)}m`).join(' · ') || '—'}

**World events seen:** ${top(eventsSeen, 8).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'} · **Kill streaks:** ${top(streaks, 6).map(([k, v]) => `${k} ×${v}`).join(' · ') || '—'}

**Shop:** ${top(bought, 8).map(([k, v]) => `${k} ×${v}`).join(' · ') || '—'}

## Comments — best moment

${comments('liked')}
## Comments — would change

${comments('change')}`;

writeFileSync(join(here, 'SUMMARY.md'), md);
console.log(md);
if (process.argv.includes('--archive')) {
  for (const f of files) renameSync(join(inbox, f), join(processed, f));
  console.log(`\nArchived ${files.length} file(s) to feedback/processed/`);
}
