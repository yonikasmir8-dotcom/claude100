#!/usr/bin/env node
// Feedback loop, part 2: analyse.
// Reads every export in feedback/inbox/*.json and writes feedback/SUMMARY.md: aggregate play
// telemetry, campaign pacing, debrief votes, comments, and suggested changes that point at
// config.js / content.js. It never touches browser globals: the campaign shape comes from each
// session's own `campaign` record (Game.campaignInfo()), knob values from config.js if it loads.
//
//   node feedback/summarize.mjs                       # summarize the inbox
//   node feedback/summarize.mjs --archive             # ...then move the inbox files to feedback/processed/
//   node feedback/summarize.mjs a.json dir/ --out x.md  # summarize specific exports / folders instead
import { readdirSync, readFileSync, writeFileSync, renameSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const inbox = join(here, 'inbox'), processed = join(here, 'processed');
const argv = process.argv.slice(2), outAt = argv.indexOf('--out');
const outFile = outAt >= 0 && argv[outAt + 1] ? resolve(argv[outAt + 1]) : join(here, 'SUMMARY.md');
const inputs = argv.filter((a, i) => !a.startsWith('--') && !(outAt >= 0 && i === outAt + 1));
const jsonIn = (dir) => readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f));
const paths = inputs.length
  ? inputs.flatMap((p) => (existsSync(p) && statSync(p).isDirectory() ? jsonIn(p) : [resolve(p)]))
  : (existsSync(inbox) ? jsonIn(inbox) : []);
const files = paths.map((p) => basename(p));
if (!paths.length) {
  console.log('feedback/inbox/ is empty — play THE NEXUS, open the pause menu, click "Export feedback", and drop the file here.');
  process.exit(0);
}

// Merge exports; the same session/debrief can appear in several exports, keep the newest.
const sessions = new Map(), feedback = new Map();
for (const p of paths) {
  let data;
  try { data = JSON.parse(readFileSync(p, 'utf8')); } catch (err) { console.warn(`Skipping ${p}: ${err.message}`); continue; }
  for (const s of (data && data.sessions) || []) { if (!s || !s.id) continue; const old = sessions.get(s.id); if (!old || (s.updatedAt || '') > (old.updatedAt || '')) sessions.set(s.id, s); }
  for (const fb of (data && data.feedback) || []) if (fb) feedback.set(`${fb.at}|${fb.sessionId}`, fb);
}
const S = [...sessions.values()], F = [...feedback.values()];

// Current knob values (only to print "0.08 → 0.07"); the summary works without them.
let CFG = null;
try { const box = { window: {} }; vm.runInNewContext(readFileSync(join(here, '..', 'config.js'), 'utf8'), box, { timeout: 1000 }); CFG = box.window.NX_CONFIG || null; } catch { CFG = null; }
const knob = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), CFG);

// ---------- helpers ----------
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const med = (xs) => { const v = xs.filter(num); return v.length ? median(v) : null; };   // null when there is no data
const r1 = (x) => (x == null ? '—' : String(Math.round(x * 10) / 10));
const minus = (x) => String(x).replace('-', '−');
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
const eggRate = S.length ? S.filter((s) => s.egg).length / S.length : 0;
const deathsBy = T('deathsBy'), deathsIn = T('deathsIn'), damageBy = T('damageBy'), kills = T('kills');
const themeTime = T('themeTime'), weaponUse = T('weaponUse'), weaponsFound = T('weaponsFound'), captured = T('captured');
const bossesDefeated = T('bossesDefeated'), bossAttempts = T('bossAttempts'), eventsSeen = T('eventsSeen'), mountTime = T('mountTime'), streaks = T('streaks');
const relicsFound = T('relicsFound'), bought = T('bought'), trialStarts = T('trialStarts'), trialFails = T('trialFails');
const sectorsDisc = Cn('sectorsDiscovered'), deaths = Cn('deaths'), warps = Cn('warps');

const fun = F.map((f) => f.fun).filter((x) => x != null);
const diff = tally(F.map((f) => f.difficulty)), scale = tally(F.map((f) => f.scale)), fav = tally(F.map((f) => f.favorite));
const fandoms = tally(F.flatMap((f) => f.fandoms || [])), features = tally(F.flatMap((f) => f.features || []));
const other = F.map((f) => f.fandomOther).filter(Boolean);
const moments = tally(F.map((f) => f.moment));

// ---------- campaign pacing (docs/CAMPAIGN.md §7 + §9) ----------
// NX.CAMPAIGN.stages, copied here so the script never needs the browser.
const STAGES = ['intro', 'copper_clue_0', 'copper_clue_1', 'copper_clue_2', 'copper_key', 'copper_gate', 'jade_clue_0', 'jade_clue_1', 'jade_clue_2', 'jade_key', 'jade_gate',
  'crystal_clue_0', 'crystal_clue_1', 'crystal_clue_2', 'crystal_key', 'crystal_gate', 'castle_gens', 'castle', 'egg', 'done'];
const RACE_IDS = ['copper_key', 'copper_gate', 'jade_key', 'jade_gate', 'crystal_key', 'crystal_gate', 'castle_gens', 'egg'];   // fallback when no session carries `campaign`
const ECHO_ACT = { darklord: 'copper', mewtwo: 'jade', voldemort: 'jade', zealot: 'jade', bigghost: 'crystal' };          // acts.<act>.gateTrial.bosses
const stageIdx = (id) => { const i = STAGES.indexOf(id); return i < 0 ? 99 : i; };
const msMin = (s, id) => (num(s['ms_' + id]) ? s['ms_' + id] / 60 : null);      // ms_<id> is seconds of play
const lvAt = (s, id) => (num(s['lv_' + id]) ? s['lv_' + id] : null);
const hasMs = (s) => Object.keys(s).some((k) => k.startsWith('ms_') && num(s[k]));
const CS = S.filter((s) => s.campaign && Array.isArray(s.campaign.ids));
const campAt = (s, key, id) => { const c = s.campaign, i = c && Array.isArray(c.ids) ? c.ids.indexOf(id) : -1; return i >= 0 && Array.isArray(c[key]) && num(c[key][i]) ? c[key][i] : null; };
const targetHours = med(CS.map((s) => s.campaign.targetHours)) ?? (num(knob('campaign.targetHours')) ? knob('campaign.targetHours') : 12);
const cfgMinutes = (id) => { const m = knob(`campaign.milestoneMinutes.${id}`); return num(m) ? Math.round(m * targetHours / 12) : null; };
const campIds = (CS.length ? [...new Set(CS.flatMap((s) => s.campaign.ids))] : S.some(hasMs) ? RACE_IDS : []).sort((a, b) => stageIdx(a) - stageIdx(b));
const pace = campIds.map((id) => {
  const got = S.filter((s) => msMin(s, id) != null);
  return {
    id, n: got.length, time: med(got.map((s) => msMin(s, id))), target: med(CS.map((s) => campAt(s, 'minutes', id))) ?? cfgMinutes(id),
    level: med(got.map((s) => lvAt(s, id))), rec: med(CS.map((s) => campAt(s, 'rec', id))), dist: med(CS.map((s) => campAt(s, 'dist', id))),
  };
});
const paceOf = (id) => pace.find((p) => p.id === id) || { target: cfgMinutes(id), rec: null };
// Segments: I start → copper_gate · II → jade_gate · III → crystal_gate · IV → egg. A verdict needs ≥ 3 sessions.
const SEGMENTS = [
  { name: 'I', act: 'copper', from: null, to: 'copper_gate' }, { name: 'II', act: 'jade', from: 'copper_gate', to: 'jade_gate' },
  { name: 'III', act: 'crystal', from: 'jade_gate', to: 'crystal_gate' }, { name: 'IV', act: 'castle', from: 'crystal_gate', to: 'egg' },
];
const segs = SEGMENTS.map((g) => {
  const got = S.filter((s) => msMin(s, g.to) != null && (!g.from || msMin(s, g.from) != null));
  const tTo = paceOf(g.to).target, tFrom = g.from ? paceOf(g.from).target : 0;
  const target = num(tTo) && num(tFrom) ? tTo - tFrom : null, time = med(got.map((s) => msMin(s, g.to) - (g.from ? msMin(s, g.from) : 0)));
  const level = med(got.map((s) => lvAt(s, g.to))), rec = paceOf(g.to).rec;
  const ratio = got.length >= 3 && num(time) && target > 0 ? time / target : null, gap = num(level) && num(rec) ? level - rec : null;
  const verdict = ratio == null ? `needs ≥ 3 sessions (${got.length})` : ratio > 1.25 ? (gap != null && gap <= -3 ? 'long · under-levelled' : 'long · navigation') : ratio < 0.75 ? 'short' : 'on pace';
  return { ...g, n: got.length, time, target, level, rec, ratio, gap, verdict };
});
// Furthest stage per session: the stage after the last ms_<id> it recorded (or s.stage if a build sends it).
const stageReached = (s) => {
  if (typeof s.stage === 'string' && STAGES.includes(s.stage)) return STAGES.indexOf(s.stage);
  let best = -1;
  STAGES.forEach((id, i) => { if (msMin(s, id) != null) best = i; });
  return Math.min(best + 1, STAGES.length - 1);
};
const reachedIdx = S.filter((s) => s.campaign || hasMs(s)).map(stageReached);
const medStage = reachedIdx.length ? Math.floor(median(reachedIdx)) : null;
const eggMins = S.map((s) => msMin(s, 'egg') ?? (num(s.eggAt) ? s.eggAt / 60 : null)).filter(num);
// Knob step text, with the current → new value when config.js loads: `world.dmgPerSector` −0.01 (0.08 → 0.07)
const fmtV = (v) => (Array.isArray(v) ? `[${v.join(', ')}]` : String(v));
const step = (path, delta) => {
  const v = knob(path), d = `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`;
  const nv = num(v) ? +(v + delta).toFixed(3) : Array.isArray(v) && v.length && v.every(num) ? v.map((x) => Math.max(1, +(x + delta).toFixed(3))) : null;
  return nv == null ? `\`${path}\` ${d}` : `\`${path}\` ${d} (${fmtV(v)} → ${fmtV(nv)})`;
};
const momentVotes = (m) => {
  const fs = F.filter((f) => (f.moment || 'manual') === m), d = tally(fs.map((f) => f.difficulty)), sc = tally(fs.map((f) => f.scale)), fu = fs.map((f) => f.fun).filter((x) => x != null);
  return { n: fs.length, fun: fu.length ? avg(fu) : null, easy: d.too_easy || 0, right: d.just_right || 0, hard: d.too_hard || 0, empty: sc.too_empty || 0, epic: sc.just_right || 0, over: sc.overwhelming || 0 };
};
const MOMENTS = [...new Set(['gate_copper', 'gate_jade', 'gate_crystal', 'egg', 'death', 'manual', ...Object.keys(moments)])].filter((m) => moments[m]);

// ---------- suggestions: each one points at a knob or a content file ----------
const out = [];
// campaign pacing first: it is the 10+ hour promise
const slow = [], nav = [], quick = [];
for (const g of segs) {
  if (g.ratio == null) continue;
  const what = `Act ${g.name} (${g.from || 'start'} → ${g.to}) takes ${g.ratio.toFixed(2)}× its target (median ${r1(g.time)} vs ${r1(g.target)} min, ${g.n} sessions)`;
  const lvl = g.gap == null ? 'no level data' : `players finish it at LV ${r1(g.level)}, ${g.gap === 0 ? 'right at' : g.gap > 0 ? `${r1(g.gap)} above` : `${r1(-g.gap)} below`} the advised LV ${r1(g.rec)}`;
  if (g.ratio > 1.25 && g.gap != null && g.gap <= -3) slow.push(`${what}; ${lvl}`);
  else if (g.ratio > 1.25) nav.push(`${what}; ${lvl} → players are lost, not under-powered: ${g.act === 'castle' ? step('campaign.castleDist', -2) : `${step(`campaign.clueDist.${g.act}`, -2)} or ${step('campaign.hintRadius', -1)}`}.`);
  else if (g.ratio < 0.75) quick.push(g);
}
if (slow.length) out.push(`${slow.join('. ')} → enemies outpace levelling: ${step('world.dmgPerSector', -0.01)}.`);
out.push(...nav);
if (quick.length) out.push(`Act${quick.length > 1 ? 's' : ''} ${quick.map((g) => g.name).join(', ')} run${quick.length > 1 ? '' : 's'} short (${quick.map((g) => `${g.ratio.toFixed(2)}×`).join(', ')} of target) → too quick: ${step('world.dmgPerSector', 0.01)}.`);
if (eggMins.length >= 3 && median(eggMins) < 0.83 * targetHours * 60) out.push(`Median time to the Egg is ${(median(eggMins) / 60).toFixed(1)} h, under 0.83 × \`campaign.targetHours\` (${(0.83 * targetHours).toFixed(1)} h) → ${step('world.dmgPerSector', 0.01)} first, before touching \`player.xpPow\`.`);
for (const [stage, n] of Object.entries(trialStarts).sort((a, b) => stageIdx(a[0]) - stageIdx(b[0]))) {
  const f = trialFails[stage] || 0, act = stage.split('_')[0];
  if (n < 3 || f / n <= 0.5) continue;
  if (/_clue_\d+$/.test(stage)) out.push(`Clue trial **${stage}** fails ${pct(f / n)} of the time (${f}/${n}) → ${step('campaign.waveSize', -1)}${act === 'crystal' ? `; the pellet board itself shrinks with ${step('campaign.pelletRadius', -1)}` : ''}.`);
  else if (/_gate$/.test(stage)) out.push(`Gate trial **${stage}** fails ${pct(f / n)} of the time (${f}/${n}) → ${step(`campaign.echoHpMult.${act}`, -0.1)}.`);
}
for (const m of ['gate_copper', 'gate_jade', 'gate_crystal']) {
  const v = momentVotes(m), act = m.slice(5), dv = v.easy + v.right + v.hard, sv = v.empty + v.epic + v.over;
  if (dv >= 3 && v.hard > dv / 2) out.push(`Most **${m}** debriefs say *too hard* (${v.hard}/${dv}) → players stall in the ${act} act: ${step('world.dmgPerSector', -0.01)} or ${step(`campaign.echoHpMult.${act}`, -0.1)}.`);
  if (sv >= 3 && v.over > sv / 2) out.push(`Most **${m}** debriefs call the scale *overwhelming* (${v.over}/${sv}) → ${step(`campaign.clueDist.${act}`, -2)} or ${step('campaign.hintRadius', -1)}.`);
}
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
for (const [boss, n] of top(bossAttempts, 30)) {
  const wins = bossesDefeated[boss] || 0;
  if (n < 3 || wins / n >= 0.3) continue;
  // gate echoes share the real boss's stats: tune the echo multiplier, never the boss
  if (boss.startsWith('echo:')) { const act = ECHO_ACT[boss.slice(5)]; out.push(`Gate echo **${boss}** is beaten only ${pct(wins / n)} of the time (${wins}/${n}) → ${act ? step(`campaign.echoHpMult.${act}`, -0.1) : '`campaign.echoHpMult.<act>` −0.1'}.`); }
  else out.push(`Boss **${boss}** is beaten only ${pct(wins / n)} of the time (${wins}/${n}) → lower its hp in \`js/content.js\`.`);
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
const m0 = (x) => (x == null ? '—' : fmt(x));
const signed = (x) => (x == null ? '—' : `${x > 0 ? '+' : ''}${minus(r1(x))}`);
const pacingMd = () => {
  if (!pace.length) return '_No campaign telemetry yet — these sessions predate The Three Gates or have not completed a stage._\n';
  const rows = pace.map((p) => `| ${p.id} | ${p.n} | ${m0(p.time)} | ${m0(p.target)} | ${num(p.time) && p.target > 0 ? (p.time / p.target).toFixed(2) + '×' : '—'} | ${r1(p.level)} | ${r1(p.rec)} |`);
  const segRows = segs.map((g) => `| ${g.name} | ${g.from || 'start'} → ${g.to} | ${g.n} | ${m0(g.time)} | ${m0(g.target)} | ${g.ratio == null ? '—' : g.ratio.toFixed(2) + '×'} | ${signed(g.gap)} | ${g.verdict} |`);
  return `Target: **${targetHours} h** to the Egg (\`campaign.targetHours\`). Minutes of play since New Game (\`ms_<id>\`); LV = player level when the stage was completed (\`lv_<id>\`); rec = advised level at that site.

| Milestone | Sessions reached | Median min | Target min | vs target | Median LV | Rec LV |
|---|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}

**Acts.** Ratio = median act minutes ÷ target act minutes; LV gap = median level at the act's end − rec. Long (> 1.25×) with a gap ≤ −3 → enemies outpace levelling; long otherwise → navigation; short (< 0.75×) → too easy.

| Act | Span | Sessions | Median min | Target min | Ratio | LV gap | Verdict |
|---|---|---:|---:|---:|---:|---:|---|
${segRows.join('\n')}
`;
};
const trialKeys = Object.keys({ ...trialStarts, ...trialFails }).sort((a, b) => stageIdx(a) - stageIdx(b));
const trialsMd = trialKeys.length
  ? `| Stage | Starts | Fails | Fail rate |\n|---|---:|---:|---:|\n${trialKeys.map((k) => { const n = trialStarts[k] || 0, f = trialFails[k] || 0; return `| ${k} | ${n} | ${f} | ${n ? pct(f / n) : '—'} |`; }).join('\n')}\n`
  : '_none yet_\n';
const momentsMd = MOMENTS.length
  ? `| Moment | Debriefs | Avg fun | Difficulty (easy · right · hard) | Scale (empty · epic · overwhelming) |\n|---|---:|---:|---|---|\n${MOMENTS.map((m) => { const v = momentVotes(m); return `| ${m} | ${v.n} | ${v.fun == null ? '—' : v.fun.toFixed(1)} | ${v.easy} · ${v.right} · ${v.hard} | ${v.empty} · ${v.epic} · ${v.over} |`; }).join('\n')}\n`
  : '_none yet_\n';

const md = `# THE NEXUS — feedback summary

_Generated ${new Date().toISOString()} from ${files.length} export file(s): ${files.join(', ')}_

## At a glance

| Metric | Value |
|---|---|
| Play sessions | ${S.length} |
| Debriefs | ${F.length} (${Object.entries(moments).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}) |
| Game versions | ${[...new Set(S.flatMap((s) => s.versions || [s.version]))].filter(Boolean).join(', ') || '—'} |
| Median / total play time | ${mins(median(playtimes))} / ${mins(playtimes.reduce((a, b) => a + b, 0))} |
| Median sectors explored | ${median(sectorsDisc)} |
| Median max distance from hub | ${median(S.map((s) => (s.maxes || {}).maxDist || 0))} sectors |
| Median player level | ${median(S.map((s) => s.level || 1))} |
| Median campaign stage reached | ${medStage == null ? '—' : `${STAGES[medStage]} (${medStage} of ${STAGES.length - 1} · ${reachedIdx.length} session${reachedIdx.length === 1 ? '' : 's'})`} |
| Egg found | ${pct(eggRate)} of sessions |
| Median time to the Egg | ${eggMins.length ? `${(median(eggMins) / 60).toFixed(1)} h (target ${targetHours} h · ${eggMins.length} session${eggMins.length === 1 ? '' : 's'})` : '—'} |
| Deaths per session (median) | ${median(deaths)} |
| Warps per session (median) | ${median(warps)} |
| Avg fun | ${fun.length ? avg(fun).toFixed(1) + ' / 5' : '—'} |
| Difficulty votes | too easy ${easy} · just right ${right} · too hard ${hard} |
| Scale votes | too empty ${scale.too_empty || 0} · epic ${scale.just_right || 0} · overwhelming ${scale.overwhelming || 0} |

## Suggested changes

${out.map((s) => `- ${s}`).join('\n')}

## Campaign pacing

${pacingMd()}
**Trials** (clue and gate trials; a fail rate above 50% over ≥ 3 starts suggests a trial knob)

${trialsMd}
## Debriefs by moment

The gate debriefs show where players stall, act by act.

${momentsMd}
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

writeFileSync(outFile, md);
console.log(md);
if (argv.includes('--archive')) {
  if (inputs.length) console.log('\n--archive only moves inbox files; nothing archived for explicit inputs.');
  else {
    for (const f of files) renameSync(join(inbox, f), join(processed, f));
    console.log(`\nArchived ${files.length} file(s) to feedback/processed/`);
  }
}
