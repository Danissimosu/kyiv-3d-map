// Single global game clock (task 4): ACCELERATED time — 1 game hour = 30 real seconds (RATE = 120 game seconds per real second), so a game day
// lasts 12 real minutes. The clock only runs while the game is being played (paused menu / background tab = time stands still), it is stored in the
// save (t, wk, day) and restored on load. A new game starts at 08:00 on today's real Kyiv date (calendar day = days since Mon 5.10.2026, so the weekday
// always equals day % 7); after that the calendar runs in game time.
// Debug / tests: ?clock=HH:MM  ?day=wd|we|пн..нд|0..6  ?clockrate=N (game seconds per real second, default RATE; 0 = frozen); ?shot=1 alone = Tue 12:00 frozen.
export const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
export const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'], MONG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const BASE_MONDAY = Date.UTC(2026, 9, 5);   // calendar day 0 = Monday 5 Oct 2026 (the weekday always equals day % 7)
export const CLOCK_V = 2;                          // save format: v2 = clock.day is the absolute calendar day (v1: days since the save's new game)
export const RATE = 120;                           // game seconds per real second: 1 game hour = 30 s, 1 game minute = 0.5 s, 1 game day = 12 min
export const START_MIN = 8 * 60;                   // a new game starts at 08:00 (today's real Kyiv date)
export const hhmm = (min) => { min = Math.floor(((min % 1440) + 1440) % 1440); return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); };
// durations: game minutes → "2 ч 15 мин"; real seconds → "1 мин 8 с"
export const fmtGameMin = (m) => { m = Math.max(0, Math.round(m)); return m < 60 ? m + ' мин' : Math.floor(m / 60) + ' ч' + (m % 60 ? ' ' + (m % 60) + ' мин' : ''); };
export const fmtRealSec = (s) => { s = Math.max(0, Math.round(s)); return s < 60 ? s + ' с' : Math.floor(s / 60) + ' мин' + (s % 60 ? ' ' + (s % 60) + ' с' : ''); };
// Kyiv wall-clock offset from UTC in ms (+2 h winter, +3 h summer)
export function kyivOffset(ms = Date.now()) {
  try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)), g = k => +p.find(x => x.type === k).value;
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(ms / 1000) * 1000; } catch (e) { return 3 * 3600000; }
}
// real Kyiv "now": t (s since local midnight), absolute calendar day, weekday
export function kyivNow() { const now = Date.now(), w = now + kyivOffset(now), dd = Math.floor((w - BASE_MONDAY) / 86400000); return { t: (w - BASE_MONDAY - dd * 86400000) / 1000, day: dd, wk: ((dd % 7) + 7) % 7 }; }
export class GameClock {
  constructor(qs) {
    this.qs = qs; this.dayCbs = []; this.dMin = 0; this.last = performance.now(); this.real = false;
    this.forced = qs.has('clock') || qs.has('day') || qs.has('clockrate') || qs.has('shot');
    this.rate = qs.has('clockrate') ? parseFloat(qs.get('clockrate')) : (qs.has('shot') && !qs.has('clock') ? 0 : RATE);
    this.newGame();
  }
  // new game: 08:00 today (real Kyiv date); test overrides (?clock / ?day / ?shot) win
  newGame() {
    const r = kyivNow(); this.day = r.day; this.wk = r.wk; this.t = START_MIN * 60;
    const qs = this.qs; if (!this.forced) return;
    if (qs.has('shot') && !qs.has('clock')) { this.t = 12 * 3600; this._setWk(1); }   // deterministic screenshots / tests
    if (qs.has('clock')) { const m = qs.get('clock').split(':'); this.t = (+m[0]) * 3600 + (+m[1] || 0) * 60; }
    if (qs.has('day')) { const d = qs.get('day'); const i = WD.indexOf(d); this._setWk(i >= 0 ? i : d === 'wd' ? 0 : d === 'we' ? 5 : Math.max(0, Math.min(6, parseInt(d) || 0))); }
  }
  restore(c) { this.day = c.day | 0; this.wk = ((this.day % 7) + 7) % 7; this.t = Math.max(0, Math.min(86399, +c.t || 0)); }   // from a v2 save (absolute calendar day)
  _dayTo(d) { if (d - this.day > 400) this.day = d - 400; while (this.day < d) { this.day++; for (const f of this.dayCbs) { try { f(this.day); } catch (e) { console.warn('day cb', e); } } } if (d < this.day) this.day = d; }
  _setWk(wk) { const r = kyivNow().day; this.day = r - ((((r - wk) % 7) + 7) % 7); this.wk = wk; }   // latest calendar day <= today with this weekday
  get min() { return this.t / 60; }                 // minutes since 00:00
  get abs() { return this.wk * 1440 + this.t / 60; }  // minutes since Monday 00:00
  dateOf(day = this.day) { const d = new Date(BASE_MONDAY + day * 86400000); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }; }
  get date() { return this.dateOf(this.day); }
  get dateText() { const q = this.date; return `${q.d} ${MON[q.m]}`; }
  get text() { return `${WD[this.wk]} ${hhmm(this.min)}`; }
  get hour() { return this.t / 3600; }
  realSec(gameMin) { return this.rate > 0 ? gameMin * 60 / this.rate : Infinity; }   // real seconds that a game-time span takes at the current speed
  manual() {}                                         // (compat: task-3 real-time mode is gone, the clock is always free-running)
  toReal() { this.newGame(); }                        // (compat)
  set(wk, minutes) { this._setWk(wk); this.t = minutes * 60; }
  advance(sec) { this.t += sec; this._roll(); }
  _roll() { while (this.t >= 86400) { this.t -= 86400; this.wk = (this.wk + 1) % 7; this._dayTo(this.day + 1); } }
  update() {
    const now = performance.now(), real = Math.min(1, (now - this.last) / 1000); this.last = now;   // capped (1 s): a stalled frame / background tab never fast-forwards
    const g = real * this.rate; this.t += g; this.dMin = g / 60; this._roll();
  }
  // sun elevation (deg) for the day/night cycle: sunrise ~06:30, sunset ~19:30 (autumn Kyiv-ish)
  sunElev() { const x = Math.sin(Math.PI * (this.hour - 6.5) / 13); return x > 0 ? 44 * x : 14 * x; }
  sunAz() { const h = this.hour; return 90 + (h - 6.5) / 13 * 180; }   // east -> south -> west (deg, 0 = north)
}
