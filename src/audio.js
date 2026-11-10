// Fully synthesised audio (WebAudio): weapons, explosions, engine, alerts and a generative score.
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; }
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(c.destination);
    const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // engine: filtered noise + low drone
    const n = c.createBufferSource(); n.buffer = this.noise; n.loop = true;
    this.engF = c.createBiquadFilter(); this.engF.type = 'bandpass'; this.engF.frequency.value = 180; this.engF.Q.value = 0.8;
    this.engG = c.createGain(); this.engG.gain.value = 0;
    n.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.master); n.start();
    this.engO = c.createOscillator(); this.engO.type = 'sawtooth'; this.engO.frequency.value = 48;
    const of = c.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 220;
    this.engOG = c.createGain(); this.engOG.gain.value = 0;
    this.engO.connect(of); of.connect(this.engOG); this.engOG.connect(this.master); this.engO.start();
    this._music();
  }
  toggleMute() { this.muted = !this.muted; if (this.ctx) this.master.gain.value = this.muted ? 0 : 0.8; return this.muted; }
  _env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  _tone(type, f0, f1, dur, vol, filt) {
    const c = this.ctx; if (!c || vol < 0.004) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this._env(g, t, 0.004, vol, dur);
    if (filt) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filt; f.Q.value = 1.2; o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  _noise(dur, vol, f0, f1, type = 'lowpass') {
    const c = this.ctx; if (!c || vol < 0.004) return;
    const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; f.type = type;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    this._env(g, t, 0.006, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  laser(kind, vol = 1) {
    if (kind === 0) { this._tone('sawtooth', 1500, 240, 0.16, 0.16 * vol, 1300); this._tone('square', 900, 180, 0.1, 0.06 * vol); }
    else if (kind === 1) { this._tone('square', 620, 110, 0.2, 0.12 * vol, 700); }
    else { this._tone('sawtooth', 300, 60, 0.35, 0.2 * vol, 400); this._noise(0.2, 0.08 * vol, 1200, 200); }
  }
  explosion(vol = 1, size = 1) {
    this._noise(0.9 + size * 0.5, 0.55 * vol, 2600, 60);
    this._tone('sine', 110, 28, 0.7 + size * 0.4, 0.6 * vol);
    this._noise(0.25, 0.3 * vol, 6000, 900, 'bandpass');
  }
  hit() { this._noise(0.14, 0.3, 3000, 400); this._tone('square', 190, 70, 0.14, 0.18); }
  shield() { this._tone('sine', 1100, 320, 0.3, 0.16); this._noise(0.2, 0.12, 5000, 1500, 'bandpass'); }
  ping() { this._noise(0.05, 0.08, 6000, 3000, 'bandpass'); }
  missile() { this._noise(1.1, 0.35, 400, 3000, 'bandpass'); this._tone('sawtooth', 90, 300, 0.7, 0.12); }
  beep(f = 880, vol = 0.1) { this._tone('sine', f, f, 0.09, vol); }
  alarm() { this._tone('square', 520, 520, 0.14, 0.09); setTimeout(() => this._tone('square', 390, 390, 0.16, 0.09), 150); }
  warp() { this._tone('sawtooth', 40, 900, 1.3, 0.25, 500); this._noise(1.6, 0.5, 200, 5000, 'bandpass'); setTimeout(() => this.explosion(0.9, 2), 1250); }
  engine(throttle, boost) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engG.gain.setTargetAtTime(0.05 + throttle * 0.07 + boost * 0.14, t, 0.15);
    this.engF.frequency.setTargetAtTime(140 + throttle * 220 + boost * 500, t, 0.2);
    this.engOG.gain.setTargetAtTime(0.03 + throttle * 0.035 + boost * 0.04, t, 0.15);
    this.engO.frequency.setTargetAtTime(42 + throttle * 26 + boost * 36, t, 0.2);
  }
  engineOff() { if (this.ctx) { this.engG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); this.engOG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); } }
  // Slow minor-key pad with a pulsing bass and sparse arpeggio. Intensity rises in combat.
  _music() {
    const c = this.ctx;
    this.musG = c.createGain(); this.musG.gain.value = 0.5; this.musG.connect(this.master);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(this.musG);
    const delay = c.createDelay(1); delay.delayTime.value = 0.42; const fb = c.createGain(); fb.gain.value = 0.38;
    delay.connect(fb); fb.connect(delay); delay.connect(this.musG);
    const chords = [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 60], [50, 57, 62, 65], [53, 60, 65, 69], [43, 50, 58, 62], [45, 52, 57, 61]];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const BAR = 4.8; let bar = 0, next = c.currentTime + 0.2;
    this.intensity = 0;
    const schedule = () => {
      while (next < c.currentTime + 1.5) {
        const ch = chords[bar % chords.length], t = next;
        for (const m of ch) for (const det of [-6, 7]) {
          const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + 1.6); g.gain.linearRampToValueAtTime(0.0001, t + BAR + 0.8);
          o.connect(g); g.connect(lp); o.start(t); o.stop(t + BAR + 1);
        }
        const steps = 16;
        for (let s = 0; s < steps; s++) {
          const ts = t + (s * BAR) / steps;
          if (this.intensity > 0.3 || s % 4 === 0) { // bass pulse
            const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = hz(ch[0] - 12);
            const v = (s % 4 === 0 ? 0.11 : 0.05) * (0.5 + this.intensity * 0.6);
            g.gain.setValueAtTime(v, ts); g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.26);
            o.connect(g); g.connect(this.musG); o.start(ts); o.stop(ts + 0.3);
          }
          if ((s * 7 + bar * 3) % 5 < 2) { // arpeggio
            const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = hz(ch[(s + bar) % 4] + 24);
            g.gain.setValueAtTime(0.03, ts); g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.5);
            o.connect(g); g.connect(delay); g.connect(this.musG); o.start(ts); o.stop(ts + 0.55);
          }
        }
        next += BAR; bar++;
      }
    };
    schedule(); setInterval(schedule, 400);
  }
}
