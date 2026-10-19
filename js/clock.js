// Single global game clock. DEFAULT: real Kyiv time (Europe/Kyiv, DST-aware), 1 game second = 1 real second; the calendar is the real
// calendar (day = days since Mon 5.10.2026, so weekday = day % 7). Saves do not change the time (the world always shows "now" in Kyiv).
// Debug / tests (manual mode): ?clock=HH:MM  ?day=wd|we|пн..нд|0..6  ?clockrate=N (game seconds per real second, default 1 in manual mode; 0 = frozen);
// calling set() / advance() from code also switches the clock to manual mode (free-running from that point at `rate`). toReal() goes back.
export const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
export const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'], MONG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const BASE_MONDAY = Date.UTC(2026, 9, 5);   // calendar day 0 = Monday 5 Oct 2026 (the weekday always equals day % 7)
export const CLOCK_V = 2;                          // save format: v2 = clock.day is the absolute calendar day (v1: days since the save's new game)
export const hhmm = (min) => { min = Math.floor(((min % 1440) + 1440) % 1440); return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); };
// Kyiv wall-clock offset from UTC in ms (+2 h winter, +3 h summer); cached, refreshed once a minute by the clock
export function kyivOffset(ms = Date.now()) {
  try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)), g = k => +p.find(x => x.type === k).value;
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(ms / 1000) * 1000; } catch (e) { return 3 * 3600000; }
}
export class GameClock {
  constructor(qs) {
    this.qs = qs; this.dayCbs = []; this.dMin = 0; this.last = performance.now(); this.saveT = 0; this.offT = -1e9;
    this.forced = qs.has('clock') || qs.has('day') || qs.has('clockrate') || qs.has('shot');
    this.rate = qs.has('clockrate') ? parseFloat(qs.get('clockrate')) : (qs.has('shot') && !qs.has('clock') ? 0 : 1);
    this.real = !this.forced; this._syncReal(true);
    if (this.forced) {
      if (qs.has('shot') && !qs.has('clock')) { this.t = 12 * 3600; this._setWk(1); }   // deterministic screenshots / tests
      if (qs.has('clock')) { const m = qs.get('clock').split(':'); this.t = (+m[0]) * 3600 + (+m[1] || 0) * 60; }
      if (qs.has('day')) { const d = qs.get('day'); const i = WD.indexOf(d); this._setWk(i >= 0 ? i : d === 'wd' ? 0 : d === 'we' ? 5 : Math.max(0, Math.min(6, parseInt(d) || 0))); }
    }
  }
  // real Kyiv "now": t (s since local midnight), wk, absolute calendar day
  realNow() { const now = Date.now(); if (now - this.offT > 60000) { this.off = kyivOffset(now); this.offT = now; } const w = now + this.off, dd = Math.floor((w - BASE_MONDAY) / 86400000);
    return { t: (w - BASE_MONDAY - dd * 86400000) / 1000, day: dd, wk: ((dd % 7) + 7) % 7 }; }
  _syncReal(init) { const r = this.realNow(); if (init) { this.t = r.t; this.day = r.day; this.wk = r.wk; return 0; }
    const g = (r.day - this.day) * 86400 + (r.t - this.t); this.t = r.t; this.wk = r.wk; this._dayTo(r.day); return g; }
  _dayTo(d) { if (d - this.day > 400) this.day = d - 400; while (this.day < d) { this.day++; for (const f of this.dayCbs) { try { f(this.day); } catch (e) { console.warn('day cb', e); } } } if (d < this.day) this.day = d; }
  _setWk(wk) { const r = this.realNow().day; this.day = r - ((((r - wk) % 7) + 7) % 7); this.wk = wk; }   // latest calendar day <= today with this weekday
  get min() { return this.t / 60; }                 // minutes since 00:00
  get abs() { return this.wk * 1440 + this.t / 60; }  // minutes since Monday 00:00
  dateOf(day = this.day) { const d = new Date(BASE_MONDAY + day * 86400000); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }; }
  get date() { return this.dateOf(this.day); }
  get dateText() { const q = this.date; return `${q.d} ${MON[q.m]}`; }
  get text() { return `${WD[this.wk]} ${hhmm(this.min)}`; }
  get hour() { return this.t / 3600; }
  manual() { if (this.real) { this.real = false; this.rate = this.qs.has('clockrate') ? parseFloat(this.qs.get('clockrate')) : 1; } }
  toReal() { if (this.forced) return; this.real = true; const r = this.realNow(); this.t = r.t; this.wk = r.wk; this._dayTo(r.day); }
  set(wk, minutes) { this.manual(); this._setWk(wk); this.t = minutes * 60; }
  advance(sec) { this.manual(); this.t += sec; this._roll(); }
  _roll() { while (this.t >= 86400) { this.t -= 86400; this.wk = (this.wk + 1) % 7; this._dayTo(this.day + 1); } }
  update() {
    const now = performance.now(), real = Math.min(0.5, (now - this.last) / 1000); this.last = now;
    if (this.real) { const g = this._syncReal(false); this.dMin = Math.max(0, Math.min(real * 1.5, g)) / 60; return; }   // dMin = game minutes this frame (capped: tab sleep / pause never pays)
    const g = real * this.rate; this.t += g; this.dMin = g / 60; this._roll();
  }
  // sun elevation (deg) for the day/night cycle: sunrise ~06:30, sunset ~19:30 (autumn Kyiv-ish)
  sunElev() { const x = Math.sin(Math.PI * (this.hour - 6.5) / 13); return x > 0 ? 44 * x : 14 * x; }
  sunAz() { const h = this.hour; return 90 + (h - 6.5) / 13 * 180; }   // east -> south -> west (deg, 0 = north)
}
