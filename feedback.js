// Feedback loop, part 1: capture.
// - Telemetry records every play session automatically (where players go, what kills them,
//   which weapons/fandoms they use, how far they get in the egg hunt...).
// - Debriefs ask a few quick questions at key moments (death, key found, egg found, or any time).
// - Both live in localStorage and export as ONE JSON file → feedback/inbox/ (see FEEDBACK_LOOP.md).
(() => {
  'use strict';

  const SESS_KEY = 'nx_sessions';
  const FB_KEY = 'nx_feedback';
  const MAX_SESSIONS = 40;
  const MAX_FEEDBACK = 300;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or unavailable */ } },
  };
  const version = () => (window.NX_CONFIG && window.NX_CONFIG.version) || '?';

  const Telemetry = {
    s: null,
    begin(fields) {
      this.s = Object.assign({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        version: version(), versions: [version()],
        startedAt: new Date().toISOString(), updatedAt: null,
        touch: matchMedia('(pointer: coarse)').matches,
        counters: {}, tallies: {}, maxes: {}, events: [],
      }, fields);
      this.flush();
      return this.s.id;
    },
    resume(id) {
      const all = store.get(SESS_KEY, {});
      this.s = (id && all[id]) || null;
      if (this.s && !this.s.versions.includes(version())) this.s.versions.push(version());
      return !!this.s;
    },
    add(k, n = 1) { if (this.s) this.s.counters[k] = (this.s.counters[k] || 0) + n; },
    tally(k, sub, n = 1) {
      if (!this.s || sub == null) return;
      const t = this.s.tallies[k] || (this.s.tallies[k] = {});
      t[sub] = (t[sub] || 0) + n;
    },
    max(k, v) { if (this.s) this.s.maxes[k] = Math.max(this.s.maxes[k] || 0, v); },
    set(k, v) { if (this.s) this.s[k] = v; },
    event(type, data) {
      if (!this.s) return;
      this.s.events.push(Object.assign({ type, at: Math.round(this.s.playTimeSec || 0) }, data));
      if (this.s.events.length > 400) this.s.events.splice(0, 100);
    },
    flush() {
      if (!this.s) return;
      this.s.updatedAt = new Date().toISOString();
      // round float tallies (time, damage) so exports stay readable
      for (const t of Object.values(this.s.tallies)) for (const k of Object.keys(t)) t[k] = Math.round(t[k] * 10) / 10;
      for (const k of Object.keys(this.s.counters)) this.s.counters[k] = Math.round(this.s.counters[k] * 10) / 10;
      const all = store.get(SESS_KEY, {});
      all[this.s.id] = this.s;
      const ids = Object.keys(all).sort((a, b) => (all[b].updatedAt || '').localeCompare(all[a].updatedAt || ''));
      for (const id of ids.slice(MAX_SESSIONS)) delete all[id];
      store.set(SESS_KEY, all);
    },
  };

  // ---------- Debrief form ----------
  const $ = (id) => document.getElementById(id);
  let ctx = null, onDone = null;

  const MOMENT_TITLES = {
    death: 'Zeroed — quick debrief?',
    key: 'Key secured — quick debrief?',
    egg: 'You found the Egg! Final debrief',
    manual: 'Send feedback to the Curator',
  };

  function chips(name, type, options) {
    return `<div class="chips">${options.map((o) => `<label><input type="${type}" name="${name}" value="${o.value}"><span>${o.label}</span></label>`).join('')}</div>`;
  }

  function buildForm() {
    const O = window.NX.FEEDBACK_OPTIONS;
    $('fb-questions').innerHTML = `
      <fieldset><legend>How fun is THE NEXUS right now?</legend>
        ${chips('fun', 'radio', [1, 2, 3, 4, 5].map((n) => ({ value: n, label: '★'.repeat(n) })))}</fieldset>
      <fieldset><legend>Difficulty</legend>
        ${chips('difficulty', 'radio', [{ value: 'too_easy', label: 'Too easy' }, { value: 'just_right', label: 'Just right' }, { value: 'too_hard', label: 'Too hard' }])}</fieldset>
      <fieldset><legend>The world's scale feels…</legend>
        ${chips('scale', 'radio', [{ value: 'too_empty', label: 'Too empty' }, { value: 'just_right', label: 'Epic' }, { value: 'overwhelming', label: 'Overwhelming' }])}</fieldset>
      <fieldset><legend>Favorite fandom sector so far</legend>
        ${chips('favorite', 'radio', O.worlds)}</fieldset>
      <fieldset><legend>Which fandoms should we add next? (pick any)</legend>
        ${chips('fandom', 'checkbox', O.fandoms.map((f) => ({ value: f, label: f })))}
        <input type="text" name="fandomOther" maxlength="120" placeholder="Something else? Type it here"></fieldset>
      <fieldset><legend>What features do you want? (pick any)</legend>
        ${chips('feature', 'checkbox', O.features.map(([v, l]) => ({ value: v, label: l })))}</fieldset>
      <label class="text">What was the best moment?<textarea name="liked" rows="2" maxlength="1000"></textarea></label>
      <label class="text">What would you change?<textarea name="change" rows="2" maxlength="1000"></textarea></label>`;
  }

  function show(context, done) {
    ctx = context || { moment: 'manual' };
    onDone = done;
    $('fb-form').reset();
    $('fb-title').textContent = MOMENT_TITLES[ctx.moment] || MOMENT_TITLES.manual;
    $('fb-summary').textContent = ctx.summary || '';
    $('feedback').hidden = false;
  }

  function hide() {
    $('feedback').hidden = true;
    const cb = onDone; onDone = null;
    if (cb) cb();
  }

  function collect() {
    const d = new FormData($('fb-form'));
    return {
      at: new Date().toISOString(),
      version: version(),
      sessionId: Telemetry.s ? Telemetry.s.id : null,
      moment: ctx ? ctx.moment : 'manual',
      context: ctx ? ctx.summary : '',
      fun: d.get('fun') ? Number(d.get('fun')) : null,
      difficulty: d.get('difficulty') || null,
      scale: d.get('scale') || null,
      favorite: d.get('favorite') || null,
      fandoms: d.getAll('fandom'),
      fandomOther: (d.get('fandomOther') || '').trim(),
      features: d.getAll('feature'),
      liked: (d.get('liked') || '').trim(),
      change: (d.get('change') || '').trim(),
    };
  }

  function exportAll() {
    Telemetry.flush();
    const payload = {
      exportedAt: new Date().toISOString(),
      gameVersion: version(),
      sessions: Object.values(store.get(SESS_KEY, {})),
      feedback: store.get(FB_KEY, []),
    };
    const stamp = payload.exportedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nexus-feedback-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    return payload;
  }

  function counts() { return { sessions: Object.keys(store.get(SESS_KEY, {})).length, feedback: store.get(FB_KEY, []).length }; }

  document.addEventListener('DOMContentLoaded', () => {
    buildForm();
    $('fb-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const entry = collect();
      const empty = entry.fun == null && !entry.difficulty && !entry.scale && !entry.favorite && !entry.fandoms.length && !entry.fandomOther && !entry.features.length && !entry.liked && !entry.change;
      if (!empty) {
        const all = store.get(FB_KEY, []);
        all.push(entry);
        store.set(FB_KEY, all.slice(-MAX_FEEDBACK));
      }
      hide();
    });
    $('fb-skip').addEventListener('click', hide);
  });

  window.Telemetry = Telemetry;
  window.Feedback = { show, hide, exportAll, counts, isOpen: () => !$('feedback').hidden };
})();
