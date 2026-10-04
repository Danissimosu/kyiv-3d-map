// Single global game clock: 1 game minute = 1 real second (60x), weekday names, state is stored by the save system (save.js).
// Debug: ?clock=HH:MM  ?day=wd|we|пн..нд|0..6  ?clockrate=N (game seconds per real second, default 60; 0 = frozen).
export const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
export const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'], MONG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const BASE_MONDAY = Date.UTC(2026, 9, 5);   // game calendar: day 0 of a new game is Monday 5 Oct 2026 (the weekday always matches clock.wk)
export const hhmm = (min) => { min = Math.floor(((min % 1440) + 1440) % 1440); return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); };
export class GameClock {
  constructor(qs) {
    this.rate = qs.has('clockrate') ? parseFloat(qs.get('clockrate')) : (qs.has('shot') && !qs.has('clock') ? 0 : 60); this.t = 8 * 3600; this.wk = 0; this.dMin = 0; this.last = performance.now(); this.saveT = 0; this.forced = qs.has('clock') || qs.has('day');
    this.day = 0;   // days elapsed since the (new) game started
    this.dayCbs = []; // callbacks(dayNumber) fired for every midnight (also during sleep skips)
    {   // first start: the real Kyiv weekday / time of day
      try { const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()), g = k => parts.find(p => p.type === k)?.value;
        this.wk = Math.max(0, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(g('weekday'))); this.t = (+g('hour')) * 3600 + (+g('minute')) * 60; } catch (e) {}
    }
    if (qs.has('shot') && !qs.has('clock')) { this.t = 12 * 3600; this.wk = 1; }   // deterministic screenshots / tests
    if (qs.has('clock')) { const m = qs.get('clock').split(':'); this.t = (+m[0]) * 3600 + (+m[1] || 0) * 60; }
    if (qs.has('day')) { const d = qs.get('day'); const i = WD.indexOf(d); this.wk = i >= 0 ? i : d === 'wd' ? 0 : d === 'we' ? 5 : Math.max(0, Math.min(6, parseInt(d) || 0)); }
  }
  get min() { return this.t / 60; }                 // minutes since 00:00
  get abs() { return this.wk * 1440 + this.t / 60; }  // minutes since Monday 00:00
  // calendar: date = Monday 5 Oct 2026 + (weekday offset at day 0) + elapsed days; the weekday of the date always equals clock.wk
  dateOf(day = this.day) { const sw = (((this.wk - this.day) % 7) + 7) % 7, d = new Date(BASE_MONDAY + (sw + day) * 86400000); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }; }
  get date() { return this.dateOf(this.day); }
  get dateText() { const q = this.date; return `${q.d} ${MON[q.m]}`; }
  get text() { return `${WD[this.wk]} ${hhmm(this.min)}`; }
  get hour() { return this.t / 3600; }
  set(wk, minutes) { this.wk = wk; this.t = minutes * 60; }
  advance(sec) { this.t += sec; this._roll(); }
  _roll() { while (this.t >= 86400) { this.t -= 86400; this.wk = (this.wk + 1) % 7; this.day++; for (const f of this.dayCbs) { try { f(this.day); } catch (e) { console.warn('day cb', e); } } } }
  update() {
    const now = performance.now(), real = Math.min(0.5, (now - this.last) / 1000); this.last = now;
    const g = real * this.rate; this.t += g; this.dMin = g / 60; this._roll();
  }
  // sun elevation (deg) for the day/night cycle: sunrise ~06:30, sunset ~19:30 (autumn Kyiv-ish)
  sunElev() { const x = Math.sin(Math.PI * (this.hour - 6.5) / 13); return x > 0 ? 44 * x : 14 * x; }
  sunAz() { const h = this.hour; return 90 + (h - 6.5) / 13 * 180; }   // east -> south -> west (deg, 0 = north)
}
