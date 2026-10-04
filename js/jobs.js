// Active-work jobs. A shift = a window of the weekly schedule on the global game clock (1 game minute = 1 real second). Pay = hourly x game minutes of
// ACTIVE work inside the window (sweeping, carrying, delivering, driving...); idle time, breaks and time outside the schedule are unpaid; a performance
// bonus/penalty comes on top. Wages and schedules: data/extra_spec.json (Kyiv medians, 10.2026).
import * as THREE from 'three';
import { City } from './city.js';
import { el, tap, toast, UI } from './ui.js';
import { WD, hhmm } from './clock.js';

const M = s => { const [h, m] = s.split(':'); return (+h) * 60 + (+m); };
const days = (list) => { const a = [null, null, null, null, null, null, null]; for (const [ds, s, e] of list) for (const d of ds) a[d] = [M(s), M(e)]; return a; };
export const JOBDEFS = {
  dvornik:  { id: 'janitor', title: 'Дворник', hourly: 110, brk: 30, quota: 24, unit: 'куч', color: 0x4a8f4e, days: days([[[0, 1, 2, 3, 4], '07:00', '16:00']]), desc: 'Подметайте кучи мусора и листьев на тротуарах рядом с конторой (метла выдаётся), сдавайте мешки в бак.' },
  gruzchik: { id: 'loader', title: 'Грузчик', hourly: 210, brk: 60, quota: 36, unit: 'ящ.', color: 0x9b7b4b, days: days([[[0, 1, 2, 3, 4], '08:00', '17:00']]), desc: 'Берите ящики на складской площадке и несите (это замедляет) в кузов грузовика, который ждёт на улице.' },
  kurier:   { id: 'courier', title: 'Курьер', hourly: 250, brk: 30, quota: 12, unit: 'зак.', color: 0xe0533d, days: days([[[0, 1, 2, 3, 4, 5], '10:00', '19:00']]), desc: 'Заберите заказ в кафе или магазине и доставьте клиенту пешком или на машине — быстрее значит больше чаевых.' },
  taxi:     { id: 'taxi', title: 'Таксист', hourly: 280, brk: 40, quota: 8, unit: 'поезд.', color: 0xf2c40f, days: days([[[0, 1, 4, 5], '07:00', '19:00']]), desc: 'Возьмите машину из таксопарка, заберите пассажира в точке и довезите до адреса.' },
  bus:      { id: 'bus_driver', title: 'Водитель автобуса', hourly: 260, brk: 45, quota: 40, unit: 'ост.', color: 0x2878c8, days: days([[[0, 1], '05:30', '14:30'], [[4, 5], '13:30', '22:30']]), desc: 'Ведите автобус по реальному маршруту: на каждой остановке остановитесь в зоне и откройте двери кнопкой. Пропуск остановки — штраф.' },
  tram:     { id: 'tram_driver', title: 'Водитель трамвая', hourly: 190, brk: 40, quota: 40, unit: 'ост.', ot: 285, color: 0xc23b2e, days: days([[[0, 1], '05:20', '14:00'], [[4, 5], '14:00', '22:40']]), desc: 'Ведите трамвай по маршруту, останавливайтесь на каждой остановке и открывайте двери. После конца смены можно продолжить — сверхурочные.' },
};
export function scheduleText(J) {
  const segs = []; for (let d = 0; d < 7; d++) { const w = J.days[d]; if (!w) continue; const k = hhmm(w[0]) + '–' + hhmm(w[1]); const last = segs[segs.length - 1]; if (last && last.k === k && last.d1 === d - 1) last.d1 = d; else segs.push({ k, d0: d, d1: d }); }
  return segs.map(s => (s.d0 === s.d1 ? WD[s.d0] : WD[s.d0] + '–' + WD[s.d1]) + ' ' + s.k).join(' · ');
}
const ICON = { dvornik: '🧹', gruzchik: '📦', kurier: '🛵', taxi: '🚕', bus: '🚌', tram: '🚋' };
const matCache = new Map();
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); let m = matCache.get(k); if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o)); matCache.set(k, m); } return m; };
const BOX = new THREE.BoxGeometry(1, 1, 1);
function box(parent, w, h, d, c, x, y, z, ry = 0) { const m = new THREE.Mesh(BOX, mat(c)); m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); m.rotation.y = ry; m.castShadow = false; parent.add(m); return m; }
const rnd = (a, b) => a + Math.random() * (b - a);

export class Jobs {
  constructor(ctx) {
    this.ctx = ctx; const { game, transit, scene } = ctx; this.g = game; this.P = ctx.P; this.world = ctx.world; this.city = ctx.city; this.pois = ctx.pois; this.ck = ctx.clock; this.sh = null; this.pulse = 0;
    game.jobs = this; transit.jobs = this; this.grp = new THREE.Group(); scene.add(this.grp);
    this.cam = scene.children.find(o => o.isCamera);
    const bg = new THREE.CylinderGeometry(0.8, 0.8, 70, 12, 1, true); bg.translate(0, 35, 0);
    this.beacon = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffd966, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); this.beacon.visible = false; this.beacon.frustumCulled = false; scene.add(this.beacon);
    this._hud(); game.providers.unshift((P) => this.provider(P));
  }
  // ---------------------------------------------------------------- schedule helpers
  status(J) {
    const ck = this.ck, d = J.days[ck.wk], m = ck.min;
    if (!d) return { ok: false, msg: `Сегодня (${WD[ck.wk]}) выходной по графику: ${scheduleText(J)}. Можно выйти, но часы вне графика не оплачиваются.` };
    if (m < d[0]) return { ok: false, msg: `Смена сегодня с ${hhmm(d[0])}. До начала работа не оплачивается.` };
    if (m >= d[1]) return { ok: false, msg: `Смена сегодня окончена (${hhmm(d[0])}–${hhmm(d[1])}).${J.ot ? ' Работа сверх графика оплачивается как сверхурочные ₴' + J.ot + '/ч.' : ' Часы вне графика не оплачиваются.'}` };
    return { ok: true };
  }
  // sidewalk spot beside a road (right/left kerb), not in a building: {x, z, y, dx, dz, p, s, side}
  spot(cx, cz, rmin, rmax, o = {}) {
    const W = this.world, T = W.TILE, A = {}, B = {}, minC = o.minCls || 1, maxC = o.maxCls || 5, kerb = o.kerb || 2.4;
    this.city._sync && this.city._sync();   // make sure road paths of freshly streamed tiles exist
    const cand = [], i0 = Math.floor((cx - rmax) / T), i1 = Math.floor((cx + rmax) / T), j0 = Math.floor((cz - rmax) / T), j1 = Math.floor((cz + rmax) / T);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = this.city.tilePaths.get(i + '_' + j); if (!l) continue;
      for (const p of l) { if (p.cls < minC || p.cls > maxC || p.bridge || p.len < 8) continue; for (let v = 0; v < p.n; v++) { const d = Math.hypot(p.pts[2 * v] - cx, p.pts[2 * v + 1] - cz); if (d >= rmin && d <= rmax) cand.push([p, v]); } } }
    for (let tr = 0; tr < 60 && cand.length; tr++) {
      const [p, v] = cand[(Math.random() * cand.length) | 0], s = Math.max(2, Math.min(p.len - 2, p.cum[v] + rnd(-3, 3))); City.at(p, s, 1, 0, A);
      const side = o.side || (Math.random() < 0.5 ? 1 : -1); City.at(p, s, 1, side * (p.w / 2 + kerb), B);
      const t = W.tiles.get(Math.floor(B.x / T) + '_' + Math.floor(B.z / T)); if (!t || !t.h) continue;
      const y = W.heightAt(B.x, B.z), q = { x: B.x, z: B.z }; W.collide(q, 0.5, y, 1.7); if (Math.hypot(q.x - B.x, q.z - B.z) > 0.05) continue;
      return { x: B.x, z: B.z, y, dx: A.dx, dz: A.dz, p, s, side };
    }
    for (let tr = 0; tr < 40; tr++) {   // fallback: any free ground in the ring
      const a = Math.random() * 6.283, r = rnd(rmin, rmax), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, t = W.tiles.get(Math.floor(x / T) + '_' + Math.floor(z / T)); if (!t || !t.h) continue;
      const y = W.heightAt(x, z), q = { x, z }; W.collide(q, 0.5, y, 1.7); if (Math.hypot(q.x - x, q.z - z) > 0.05) continue; return { x, z, y, dx: 0, dz: 1, p: null, s: 0, side: 1 };
    }
    return null;
  }
  doorOf(poi, dist = 3) { const pl = poi.pl; if (pl && pl.tile && pl.tile.alive) { const d = pl.door; return { x: d.mx + d.nx * dist, z: d.mz + d.nz * dist, nx: d.nx, nz: d.nz, ok: true }; } return { x: poi.x, z: poi.z, nx: 0, nz: 1, ok: false }; }
  // ---------------------------------------------------------------- HUD (one small line at the top edge; buttons for lunch break and quit)
  _hud() {
    const T = this.ctx.IS_TOUCH, h = this.hud = el('div', '', '', document.body); h.className = 'hl';
    h.style.cssText = `position:fixed;left:50%;transform:translateX(-50%);top:calc(${T ? 58 : 36}px + env(safe-area-inset-top));z-index:6;display:none;background:rgba(14,40,28,.78);color:#fff;font:600 ${T ? 11 : 13}px -apple-system,system-ui,sans-serif;padding:3px 8px;border-radius:12px;max-width:${T ? 74 : 62}vw;pointer-events:none;text-align:center;line-height:1.25`;
    this.hT = el('div', '', '', h); this.hS = el('div', '', '', h); this.hS.style.cssText = 'font-weight:500;opacity:.85;font-size:0.92em'; const bar = el('div', '', '<i style="display:block;height:100%;width:0;background:#ffd966"></i>', h); bar.style.cssText = 'height:3px;background:rgba(255,255,255,.2);border-radius:2px;margin-top:2px;overflow:hidden;display:none'; this.hB = bar;
    const bs = el('div', '', '', h); bs.style.cssText = 'display:flex;gap:6px;justify-content:center;margin-top:3px;pointer-events:auto';
    const mkb = (t, fn) => { const b = el('span', '', t, bs); b.style.cssText = `padding:${T ? '5px 12px' : '2px 9px'};background:rgba(255,255,255,.2);border-radius:10px;font-size:${T ? 12 : 12}px`; tap(b, fn); return b; };
    this.bBrk = mkb('☕ обед', () => this.takeBreak()); this.bQuit = mkb('✕ закончить', () => this.end('quit'));
  }
  takeBreak() { const sh = this.sh; if (!sh) return; if (sh.brkDone) { toast('Обед уже был'); return; } if (sh.brk > 0) return; sh.brkDone = true; sh.brk = sh.J.brk; toast(`☕ Обед ${sh.J.brk} мин — не оплачивается`); }
  est(sh) { const J = sh.J; return Math.max(0, Math.round(J.hourly * sh.worked / 60 + (J.ot || 0) * sh.ot / 60 + sh.bonus - sh.pen)); }
  addBonus(v, why) { const sh = this.sh; if (!sh) return; sh.bonus += v; sh.log.push([why, v]); }
  addPen(v, why) { const sh = this.sh; if (!sh) return; sh.pen += v; sh.log.push([why, -v]); toast(`⚠ ${why}: −₴${v}`); }
  // ---------------------------------------------------------------- shift lifecycle
  begin(poi) {
    if (this.sh) return; const J = JOBDEFS[poi.key]; if (!J) return; const ck = this.ck;
    const sh = { J, key: poi.key, poi, startAbs: ck.abs, startWk: ck.wk, worked: 0, ot: 0, idle: 0, off: 0, brk: 0, brkUsed: 0, brkDone: false, bonus: 0, pen: 0, log: [], done: 0, act: 0, tw: 0, ld: null, lx: this.P.x, lz: this.P.z, spd: 0, tgt: null, hud: '', sub: '', prog: -1, marks: [], working: false, keep: false, otAsked: false };
    this.sh = sh; const mk = { dvornik: Janitor, gruzchik: Loader, kurier: Courier, taxi: Taxi, bus: Drive, tram: Drive }[poi.key];
    sh.impl = new mk(this, sh, poi); const ok = sh.impl.start(); if (ok === false) { this.sh = null; sh.impl.dispose(); return; }
    this.beacon.material.color.setHex(J.color); this.hud.style.display = 'block';
    const st = this.status(J); toast(`${ICON[poi.key]} Смена: ${J.title} · ₴${J.hourly}/ч${st.ok ? '' : ' — вне графика, не оплачивается'}`, 3600);
  }
  end(reason) {
    const sh = this.sh; if (!sh) return; this.sh = null; const g = this.g, P = this.P;
    try { sh.impl.dispose(); } catch (e) { console.warn(e); }
    this.hud.style.display = 'none'; this.beacon.visible = false; this.pois.extra = null; P.slow = undefined;
    const J = sh.J, base = Math.round(J.hourly * sh.worked / 60), ot = Math.round((J.ot || 0) * sh.ot / 60), q = sh.done >= J.quota ? Math.round(base * 0.1) : 0;
    const total = Math.max(0, base + ot + Math.round(sh.bonus) + q - Math.round(sh.pen));
    g.earn(total); if (total > 0 || sh.worked > 5) g.S.jobs = (g.S.jobs || 0) + 1; g.dirty = 1;
    this.last = { total, base, ot, q, reason, worked: sh.worked, idle: sh.idle, off: sh.off, brk: sh.brkUsed, bonus: Math.round(sh.bonus), pen: Math.round(sh.pen), done: sh.done };
    if (reason === 'abort') { toast(`Смена прервана: выплата ₴${total}`, 3500); return; }
    const p = g.jobP; p.titleEl.textContent = `${ICON[sh.key]} Итоги смены — ${J.title}`; const b = p.body; b.innerHTML = '';
    const hm = m => `${Math.floor(m / 60)} ч ${String(Math.round(m % 60)).padStart(2, '0')} мин`; const row = (l, v, c) => el('div', 'row', `<div class="t"><b>${l}</b></div><b style="${c ? 'color:' + c : ''}">${v}</b>`, b);
    el('div', '', `<p style="margin:2px 0 6px;font-size:13px;opacity:.8">${reason === 'schedule' ? 'Смена закончена по графику' : reason === 'done' ? 'Маршрут завершён' : 'Смена завершена'} · ${WD[sh.startWk]} ${hhmm(sh.startAbs % 1440)}–${this.ck.text.slice(3)} · график ${scheduleText(J)}</p>`, b);
    row('Отработано (активная работа)', hm(sh.worked + sh.ot)); row('Простой (не оплачивается)', hm(sh.idle)); row('Перерыв (не оплачивается)', hm(sh.brkUsed)); if (sh.off > 0.5) row('Вне графика (не оплачивается)', hm(sh.off));
    row(`Ставка ₴${J.hourly}/ч × ${(sh.worked / 60).toFixed(2)} ч`, '₴' + base); if (ot) row(`Сверхурочные ₴${J.ot}/ч × ${(sh.ot / 60).toFixed(2)} ч`, '₴' + ot);
    row(`Выполнено: ${sh.done} / ${J.quota} ${J.unit}`, q ? `план +₴${q}` : '—', q ? '#7fe08a' : '');
    for (const [w, v] of this._sumLog(sh.log)) row(w, (v >= 0 ? '+₴' : '−₴') + Math.abs(v), v >= 0 ? '#7fe08a' : '#ff8a80');
    const t = el('div', 'row', `<div class="t"><b style="font-size:18px">Итого к выплате</b></div><b style="font-size:20px;color:#ffd966">₴${total}</b>`, b);
    tap(el('div', 'btn', 'Забрать', b), () => p.close()); el('div', '', '<p style="font-size:11px;opacity:.55;margin-top:8px">Игровые значения на основе медиан по Киеву (Work.ua, Київпастранс, 10.2026). 1 игровая минута = 1 секунда.</p>', b);
    p.open();
  }
  _sumLog(log) { const m = new Map(); for (const [w, v] of log) m.set(w, (m.get(w) || 0) + v); return [...m]; }
  onDriveEnd(why) { if (this.sh && this.sh.impl.drive) this.end(why === 'done' ? 'done' : 'abort'); }
  provider(P) { return this.sh && this.sh.impl.provider ? this.sh.impl.provider(P) : null; }
  // ---------------------------------------------------------------- per-frame
  update(P, dt) {
    const sh = this.sh; if (!sh) return; const g = this.g, ck = this.ck, J = sh.J, dMin = ck.dMin;
    if (g.dead || (g.crime && g.crime.jail)) { this.end('abort'); return; }
    if (ck.wk !== sh.startWk && ck.abs - sh.startAbs > 1) { this.end('schedule'); return; }
    sh.spd = Math.hypot(P.x - sh.lx, P.z - sh.lz) / Math.max(dt, 1e-3); sh.lx = P.x; sh.lz = P.z; if (sh.spd > 60) sh.spd = 0;
    sh.act = 0; sh.tgt = null; sh.hud = ''; sh.sub = ''; sh.prog = -1; sh.impl.tick(dt, P);
    // "working" = an explicit work action this frame, or moving towards the current objective
    let working = sh.act > 0 || sh.actT > 0; if (sh.actT > 0) sh.actT -= dt;
    if (sh.tgt) { const d = Math.hypot(P.x - sh.tgt.x, P.z - sh.tgt.z); if (sh.ld !== null && sh.spd > 0.8 && d < sh.ld - 0.15 * sh.spd * dt) sh.tw = 0.9; sh.ld = d; } else sh.ld = null;
    if (sh.tw > 0) { sh.tw -= dt; working = true; }
    const day = J.days[ck.wk], m = ck.min, inWin = !!day && m >= day[0] && m < day[1], after = !!day && m >= day[1];
    if (sh.brk > 0) { working = false; sh.brk -= dMin; sh.brkUsed += dMin; if (sh.brk <= 0) { sh.brk = 0; toast('☕ Обед окончен'); } }
    else if (working) { if (inWin) sh.worked += dMin; else if (after && J.ot) sh.ot += dMin; else sh.off += dMin; }
    else if (inWin) sh.idle += dMin; else sh.off += dMin;
    sh.working = working;
    if (after && !J.ot) { this.end('schedule'); return; }
    if (after && J.ot && !sh.otAsked) { sh.otAsked = true; toast(`Смена по графику окончена. Работа дальше — сверхурочные ₴${J.ot}/ч. «✕ закончить» — завершить.`, 4500); }
    // HUD
    const est = this.est(sh), left = day && inWin ? hhmm(day[1] - m) : '';
    const state = sh.brk > 0 ? `☕ обед ${Math.ceil(sh.brk)} мин` : !inWin ? (after ? (J.ot ? '⏱ сверхурочные' : '') : (day ? '⏸ до смены ' + hhmm(day[0] - m) : '⏸ выходной') + ' — не оплачивается') : !working ? '⏸ простой — не оплачивается' : '';
    this.hT.textContent = `${ICON[sh.key]} ${J.title} ${sh.done}/${J.quota}${sh.hud ? ' · ' + sh.hud : ''} · ₴${est} · ${ck.text}`;
    let sub = sh.sub; if (sh.tgt) sub += (sub ? ' · ' : '') + this._arrow(P, sh.tgt); if (state) sub += (sub ? ' · ' : '') + state; if (left && !state) sub += (sub ? ' · ' : '') + 'до конца смены ' + left;
    this.hS.textContent = sub;
    if (sh.prog >= 0) { this.hB.style.display = 'block'; this.hB.firstChild.style.width = Math.round(100 * Math.min(1, sh.prog)) + '%'; } else this.hB.style.display = 'none';
    this.hud.style.background = sh.brk > 0 || !working ? 'rgba(40,40,46,.78)' : 'rgba(14,40,28,.78)';
    this.bBrk.style.display = sh.brkDone ? 'none' : 'inline-block';
    if (sh.tgt) { this.beacon.position.set(sh.tgt.x, this.world.heightAt(sh.tgt.x, sh.tgt.z), sh.tgt.z); this.beacon.visible = true; } else this.beacon.visible = false;
    this.pois.extra = sh.marks.length ? sh.marks : null;
  }
  _arrow(P, t) {
    const d = Math.hypot(t.x - P.x, t.z - P.z), a = Math.atan2(-(t.x - P.x), -(t.z - P.z)) - P.yaw; const r = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const ar = Math.abs(r) < 0.4 ? '↑' : Math.abs(r) > 2.7 ? '↓' : r > 0 ? '←' : '→'; return `${ar} ${d < 1000 ? d.toFixed(0) + ' м' : (d / 1000).toFixed(1) + ' км'}`;
  }
}

// ==================================================================== Janitor: sweep litter piles on the sidewalks, bin the bags
class Janitor {
  constructor(J, sh, poi) { this.J = J; this.sh = sh; this.poi = poi; this.piles = []; this.bag = 0; this.prog = 0; this.auto = 0; this.grp = new THREE.Group(); J.grp.add(this.grp); }
  start() {
    const J = this.J; this.door = J.doorOf(this.poi, 2.5); J.g.add('broom', 1); toast('🧹 Вам выдали метлу. Идите к меткам, держите E — подметать', 3800);
    const b = J.spot(this.door.x, this.door.z, 3, 12, { kerb: 1.6 }) || { x: this.door.x + 2, z: this.door.z + 2, y: J.world.heightAt(this.door.x + 2, this.door.z + 2) };
    this.bin = new THREE.Group(); box(this.bin, 0.9, 1.1, 0.9, 0x2e7d4f, 0, 0, 0); box(this.bin, 1.0, 0.12, 1.0, 0x1f5a37, 0, 1.1, 0); this.bin.position.set(b.x, b.y, b.z); this.grp.add(this.bin);
    for (let i = 0; i < 4; i++) this._spawn();
  }
  _spawn() {
    const J = this.J, s = J.spot(this.door.x, this.door.z, 14, 110, { kerb: 1.8, maxCls: 4 }); if (!s) return;
    const g = new THREE.Group(), cols = [0x7a5a35, 0xb07a2a, 0x5d7a2a, 0x9a9a8a, 0xc9a24a];
    for (let i = 0; i < 9; i++) { const c = cols[i % cols.length], m = box(g, rnd(0.2, 0.5), rnd(0.05, 0.14), rnd(0.2, 0.5), c, rnd(-0.6, 0.6), 0, rnd(-0.6, 0.6), rnd(0, 3)); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.25, 20), new THREE.MeshBasicMaterial({ color: 0xffd966, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    g.position.set(s.x, s.y + 0.02, s.z); this.grp.add(g); this.piles.push({ x: s.x, z: s.z, g });
  }
  provider(P) {
    const near = this._near(P); if (near && near.d < 2.6 && this.bag < 3) return { label: 'Подметать (держите E)', run: () => { this.auto = 1.7; } };
    if (this.bag > 0 && Math.hypot(P.x - this.bin.position.x, P.z - this.bin.position.z) < 3.4) return { label: 'Выбросить мусор в бак', run: () => this._dump() };
    return null;
  }
  _near(P) { let b = null, bd = 1e9; for (const p of this.piles) { const d = Math.hypot(P.x - p.x, P.z - p.z); if (d < bd) { bd = d; b = p; } } return b ? { p: b, d: bd } : null; }
  _dump() { const sh = this.sh, n = this.bag; if (!n) return; this.bag = 0; sh.done += n; this.J.addBonus(10 * n, 'Чистая работа'); sh.actT = 1.2; toast(`♻ Сдано мусора: ${n} куч · +₴${10 * n}`); }
  tick(dt, P) {
    const sh = this.sh, J = this.J, want = sh.J.quota - sh.done - this.bag;
    while (this.piles.length < Math.min(4, want)) { const n = this.piles.length; this._spawn(); if (this.piles.length === n) break; }
    const near = this._near(P), binD = Math.hypot(P.x - this.bin.position.x, P.z - this.bin.position.z);
    if (this.auto > 0) this.auto -= dt;
    const holding = J.g.holdE || this.auto > 0;
    if (near && near.d < 2.6 && this.bag < 3 && holding && !UI.modal) {
      this.prog += dt; sh.act = 1; near.p.g.scale.setScalar(Math.max(0.15, 1 - this.prog / 2.6 * 0.85));
      if (this.prog >= 2.4) { J.grp.remove(near.p.g); near.p.g.parent && near.p.g.parent.remove(near.p.g); this.piles.splice(this.piles.indexOf(near.p), 1); this.bag++; this.prog = 0; this.auto = 0; toast(`🧹 Мешок ${this.bag}/3`, 1200); }
    } else if (this.prog > 0) { this.prog = Math.max(0, this.prog - dt * 1.5); if (near) near.p.g.scale.setScalar(Math.max(0.15, 1 - this.prog / 2.6 * 0.85)); }
    if (this.bag > 0 && binD < 3.4 && holding && !UI.modal) { this._dump(); }
    const toBin = this.bag >= 3 || (this.bag > 0 && !this.piles.length) || (this.bag > 0 && (!near || near.d > 70));
    sh.tgt = toBin ? { x: this.bin.position.x, z: this.bin.position.z } : near ? { x: near.p.x, z: near.p.z } : null;
    sh.hud = `мешок ${this.bag}/3`; sh.sub = toBin ? 'Отнесите мусор в бак' : 'Подметите кучу (держите E)'; sh.prog = this.prog > 0 ? this.prog / 2.4 : -1;
    sh.marks = [...this.piles.map(p => ({ x: p.x, z: p.z, icon: '🧹', col: '#ffd966' })), { x: this.bin.position.x, z: this.bin.position.z, icon: '♻', col: '#4ad07a' }];
  }
  dispose() { const J = this.J; J.grp.remove(this.grp); this.grp.traverse(o => { if (o.geometry && o.geometry !== BOX) o.geometry.dispose(); }); J.g.take('broom', 1); }
}

// ==================================================================== Loader: crates from the dock to the truck (carrying slows you down)
class Loader {
  constructor(J, sh, poi) { this.J = J; this.sh = sh; this.poi = poi; this.crates = []; this.carry = false; this.load = 0; this.grp = new THREE.Group(); J.grp.add(this.grp); this.cm = null; }
  start() {
    const J = this.J; this.door = J.doorOf(this.poi, 5.5); const d = this.door, tx = -d.nz, tz = d.nx;
    const pallet = new THREE.Group(); box(pallet, 5.5, 0.14, 2.4, 0x7a5a35, 0, 0, 0); pallet.position.set(d.x, J.world.heightAt(d.x, d.z) + 0.02, d.z); pallet.rotation.y = Math.atan2(d.nx, d.nz); this.grp.add(pallet);
    for (let i = 0; i < 6; i++) { const x = d.x + tx * (-2 + (i % 3) * 2) + d.nx * (i < 3 ? 0.5 : -0.5), z = d.z + tz * (-2 + (i % 3) * 2) + d.nz * (i < 3 ? 0.5 : -0.5); this.crates.push({ x, z, y: J.world.heightAt(x, z) + 0.16, m: null, back: 0 }); this._show(this.crates[i]); }
    this._truck(); toast('📦 Берите ящики на площадке (E) и несите в грузовик', 3800);
    const cg = new THREE.BoxGeometry(0.55, 0.45, 0.55); this.cm = new THREE.Mesh(cg, mat(0xb98b4a)); this.cm.position.set(0, -0.5, -0.9); this.cm.visible = false; if (J.cam) J.cam.add(this.cm);
  }
  _show(c) { if (c.m) return; const m = new THREE.Mesh(BOX, mat(0xb98b4a)); m.scale.set(0.7, 0.55, 0.6); m.position.set(c.x, c.y + 0.27, c.z); const t = new THREE.Mesh(BOX, mat(0xe8dcc0)); t.scale.set(0.12, 0.02, 0.62); t.position.y = 0.285; m.add(t); this.grp.add(m); c.m = m; }
  _truck() {
    const J = this.J; if (this.truck) { this.grp.remove(this.truck.g); }
    const s = J.spot(this.door.x, this.door.z, 35, 120, { kerb: 3.4, maxCls: 4 }) || { x: this.door.x + 40, z: this.door.z, y: J.world.heightAt(this.door.x + 40, this.door.z), dx: 1, dz: 0 };
    const g = new THREE.Group(); box(g, 2.5, 2.6, 5.6, 0xe8e8ea, 0, 0.7, -0.6); box(g, 2.4, 1.9, 1.7, 0x2b5da8, 0, 0.7, 2.9); box(g, 2.2, 0.8, 0.1, 0x9ac4e8, 0, 1.7, 3.8); for (const sx of [-1, 1]) for (const sz of [-2, 2.8]) box(g, 0.3, 0.8, 0.8, 0x1b1b1d, sx * 1.2, 0, sz);
    g.position.set(s.x, s.y, s.z); g.rotation.y = Math.atan2(s.dx, s.dz); this.grp.add(g); this.truck = { x: s.x, z: s.z, g }; this.load = 0; this.loadMeshes = [];
  }
  provider(P) {
    if (!this.carry) { const c = this._nearCrate(P); if (c && c.d < 2.6) return { label: 'Взять ящик', run: () => this._take(c.c) }; }
    else if (Math.hypot(P.x - this.truck.x, P.z - this.truck.z) < 6.5) return { label: 'Положить ящик в кузов', run: () => this._drop() };
    return null;
  }
  _nearCrate(P) { let b = null, bd = 1e9; for (const c of this.crates) { if (!c.m) continue; const d = Math.hypot(P.x - c.x, P.z - c.z); if (d < bd) { bd = d; b = c; } } return b ? { c: b, d: bd } : null; }
  _take(c) { if (this.carry || !c.m) return; this.grp.remove(c.m); c.m = null; c.back = 3.5; this.carry = true; this.cm.visible = true; this.sh.actT = 0.8; toast('📦 Ящик взят — вы идёте медленнее', 1500); }
  _drop() {
    if (!this.carry) return; this.carry = false; this.cm.visible = false; this.sh.done++; this.load++; this.sh.actT = 1.0; this.J.addBonus(6, 'Погрузка'); toast(`📦 Погружено ${this.sh.done} · +₴6`, 1400);
    const i = this.load - 1, m = new THREE.Mesh(BOX, mat(0xb98b4a)); m.scale.set(0.7, 0.55, 0.6); const g = this.truck.g; m.position.set(-0.6 + (i % 2) * 1.2, 1.55 + Math.floor(i / 8) * 0.55 + 0.27, -2.2 + (Math.floor(i / 2) % 4) * 0.9); g.add(m);
    if (this.load >= 8) { toast('Кузов полон — подъезжает новая машина', 2200); this._truck(); }
  }
  tick(dt, P) {
    const sh = this.sh, J = this.J; for (const c of this.crates) if (!c.m && c.back > 0) { c.back -= dt; if (c.back <= 0) this._show(c); }
    P.slow = this.carry ? 0.58 : undefined;
    const holding = J.g.holdE; const nc = this._nearCrate(P);
    if (!this.carry && nc && nc.d < 2.6 && holding && !UI.modal) this._take(nc.c);
    if (this.carry && Math.hypot(P.x - this.truck.x, P.z - this.truck.z) < 6.5 && holding && !UI.modal) this._drop();
    sh.tgt = this.carry ? { x: this.truck.x, z: this.truck.z } : nc ? { x: nc.c.x, z: nc.c.z } : { x: this.door.x, z: this.door.z };
    sh.hud = this.carry ? 'несёте ящик' : `в кузове ${this.load}/8`; sh.sub = this.carry ? 'Несите в кузов' : 'Возьмите ящик (E)';
    sh.marks = [{ x: this.truck.x, z: this.truck.z, icon: '🚚', col: '#ffd966' }, { x: this.door.x, z: this.door.z, icon: '📦', col: '#c8a060' }];
  }
  dispose() { const J = this.J; J.grp.remove(this.grp); if (this.cm && this.cm.parent) this.cm.parent.remove(this.cm); this.P = null; J.P.slow = undefined; }
}

// ==================================================================== Courier: parcel at a restaurant/shop -> customer within a time limit
class Courier {
  constructor(J, sh, poi) { this.J = J; this.sh = sh; this.poi = poi; this.o = null; this.wait = 2; this.grp = new THREE.Group(); J.grp.add(this.grp); this.n = 0; }
  start() { toast('🛵 Ждите первый заказ — вам придёт метка на карте', 2600); }
  _newOrder(P) {
    const J = this.J, cands = J.pois.items.filter(p => (p.key === 'mcd' || p.key === 'puzata' || p.key === 'sushi' || p.key === 'silpo') && Math.hypot(p.x - P.x, p.z - P.z) > 40 && Math.hypot(p.x - P.x, p.z - P.z) < 700);
    cands.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)); const from = cands[Math.min(cands.length - 1, (Math.random() * 4) | 0)]; if (!from) { this.wait = 3; return; }
    const dp = J.doorOf(from, 2.5), s = J.spot(from.x, from.z, 250, 800, { kerb: 2.0, maxCls: 4 }); if (!s) { this.wait = 3; return; }
    const dist = Math.hypot(s.x - dp.x, s.z - dp.z); this.n++; this.o = { from, dp, s, ph: 'pick', t: 0, limit: 45 + dist / 4.0 + Math.hypot(dp.x - P.x, dp.z - P.z) / 6, dist, num: 1 + ((Math.random() * 90) | 0), dm: null };
    const h = new THREE.Group(); box(h, 3.2, 2.4, 3.0, 0xd9cdb8, 0, 0, 0); box(h, 3.4, 0.4, 3.2, 0x8a3d2e, 0, 2.4, 0); h.position.set(s.x + s.dx * 0, s.y, s.z); this.o.dm = h; this.grp.add(h);
    toast(`🛵 Новый заказ: забрать в «${from.name}», далее ${Math.round(dist)} м`, 3200);
  }
  provider(P) {
    const o = this.o; if (!o) return null;
    if (o.ph === 'pick' && Math.hypot(P.x - o.dp.x, P.z - o.dp.z) < 7) return { label: `Забрать заказ — ${o.from.name}`, run: () => this._pick() };
    if (o.ph === 'drop' && Math.hypot(P.x - o.s.x, P.z - o.s.z) < 5.5) return { label: 'Передать заказ клиенту', run: () => this._drop() };
    return null;
  }
  _pick() {
    const o = this.o; if (!o || o.ph !== 'pick') return; o.ph = 'drop'; o.t = 0; this.J.g.add('parcel', 1); this.sh.actT = 1.2; const P = this.J.P; o.limit = 45 + o.dist / 4.0;
    toast(`📦 Заказ у вас. Доставьте за ${Math.round(o.limit)} с (≈${Math.round(o.dist)} м, GPS на карте 📱)`, 3600);
  }
  _drop() {
    const o = this.o; if (!o || o.ph !== 'drop') return; const f = o.t / o.limit; let tip = f < 0.6 ? 80 : f < 0.85 ? 45 : f < 1 ? 20 : 0; const J = this.J;
    J.g.take('parcel', 1); this.sh.done++; this.sh.actT = 1.2; J.addBonus(30 + tip, tip >= 80 ? 'Заказ + быстрые чаевые' : 'Доставка + чаевые'); if (f >= 1) J.addPen(15, 'Опоздание');
    toast(`✅ Заказ доставлен${tip ? ' · чаевые ₴' + tip : ''}`, 2400); this._clear();
  }
  _clear() { const o = this.o; if (o && o.dm) this.grp.remove(o.dm); this.o = null; this.wait = 3; this.J.g.take('parcel', 1); }
  tick(dt, P) {
    const sh = this.sh, o = this.o;
    if (!o) { this.wait -= dt; sh.sub = 'Ожидание заказа…'; if (this.wait <= 0) this._newOrder(P); sh.marks = []; return; }
    o.t += dt; const J = this.J, t = o.ph === 'pick' ? o.dp : o.s; sh.tgt = { x: t.x, z: t.z };
    if (o.ph === 'drop') { const left = Math.max(0, o.limit - o.t); sh.hud = `${Math.ceil(left)} с`; sh.sub = 'Доставьте клиенту, дом №' + o.num; sh.prog = 1 - left / o.limit; if (o.t > o.limit * 1.7) { J.addPen(30, 'Заказ сорван'); toast('⌛ Клиент отменил заказ'); this._clear(); return; } }
    else { sh.hud = '📦 забрать'; sh.sub = 'Заберите заказ: «' + o.from.name + '» (E у двери)'; if (o.t > 240) { toast('Заказ отменён'); this._clear(); return; } }
    sh.marks = [{ x: t.x, z: t.z, icon: o.ph === 'pick' ? '🍔' : '🏠', col: '#ffd966' }];
    if (J.g.holdE && !UI.modal) { if (o.ph === 'pick' && Math.hypot(P.x - o.dp.x, P.z - o.dp.z) < 7) this._pick(); else if (o.ph === 'drop' && Math.hypot(P.x - o.s.x, P.z - o.s.z) < 5.5) this._drop(); }
  }
  dispose() { this.J.grp.remove(this.grp); this.J.g.take('parcel', 9); }
}

// ==================================================================== Taxi: take a car at the depot, pick up a passenger, drive to the address
class Taxi {
  constructor(J, sh, poi) { this.J = J; this.sh = sh; this.poi = poi; this.car = null; this.r = null; this.stopT = 0; this.grp = new THREE.Group(); J.grp.add(this.grp); this.wait = 2; this.ph = 'car'; }
  start() {
    const J = this.J, d = J.doorOf(this.poi, 4); let s = null; for (const R of [30, 60, 120, 240]) { s = J.spot(d.x, d.z, 3, R, { kerb: 0, minCls: 1, maxCls: 5, side: 1 }); if (s && s.p) break; s = null; } if (!s) { toast('Нет дороги рядом с таксопарком'); return false; }
    const p = s.p, c = { path: p, s: s.s, dir: 1, speed: 0, vmax: 12, col: new THREE.Color(0xf1c40f), wait: 0, x: 0, y: 0, z: 0, yaw: 0, parked: true, hp: 100, kind: 'taxi', model: 5, factory: false, off: p.w / 2 + 1.1, job: true };
    J.city.cars.push(c); J.city._placeCar(c); this.car = c; this.carMark = { x: c.x, z: c.z, icon: '🚕', col: '#f2c40f' }; toast('🚕 Ваше такси ждёт у обочины — сядьте (E)', 3800);
  }
  provider(P) {
    const c = this.car, cr = this.J.g.crime; if (!c || !cr || cr.driving) return null;
    if (Math.hypot(P.x - c.x, P.z - c.z) < 3.8) return { label: 'Сесть в такси', run: () => { cr.enterCar(c, true); this.sh.actT = 1; } };
    return null;
  }
  _newRide(P) {
    const J = this.J, c = this.car; const a = J.spot(c.x, c.z, 120, 380, { kerb: 2.6, minCls: 2, maxCls: 6 }); if (!a) { this.wait = 3; return; }
    const b = J.spot(a.x, a.z, 450, 1300, { kerb: 2.6, minCls: 2, maxCls: 6 }); if (!b) { this.wait = 3; return; }
    const g = new THREE.Group(); box(g, 0.5, 1.0, 0.3, [0x3a6ea5, 0xa53a3a, 0x3aa56e][(Math.random() * 3) | 0], 0, 0.1, 0); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), mat(0xe0b08a)); hd.position.y = 1.28; g.add(hd); g.position.set(a.x, a.y, a.z); this.grp.add(g);
    this.r = { a, b, ph: 'pick', t: 0, g, dist: Math.hypot(b.x - a.x, b.z - a.z), dmg0: !!c.dmg, off: 0 }; this.ph = 'ride'; toast(`🧍 Пассажир ждёт — ${Math.round(Math.hypot(a.x - c.x, a.z - c.z))} м. Подъезжайте и остановитесь рядом`, 3400);
  }
  tick(dt, P) {
    const sh = this.sh, J = this.J, c = this.car, cr = J.g.crime, inCar = cr && cr.driving === c, r = this.r;
    if (!r) {
      sh.marks = [this.carMark]; if (!inCar) { sh.tgt = { x: c.x, z: c.z }; sh.sub = 'Сядьте в такси (E)'; return; }
      this.wait -= dt; sh.sub = 'Ожидание вызова…'; if (this.wait <= 0) this._newRide(P); return;
    }
    r.t += dt; const slow = inCar && Math.abs(c.vel || 0) < 2.6, tg = r.ph === 'pick' ? r.a : r.b; sh.hud = r.ph === 'pick' ? 'к пассажиру' : 'везёте';
    sh.marks = [{ x: tg.x, z: tg.z, icon: r.ph === 'pick' ? '🧍' : '🏁', col: '#ffd966' }, this.carMark];
    this.carMark.x = c.x; this.carMark.z = c.z;
    if (!inCar) {
      sh.tgt = { x: c.x, z: c.z }; sh.sub = 'Вернитесь в такси (E)'; r.off += dt; if (r.ph === 'ride' && r.off > 50) { J.addPen(40, 'Бросили пассажира'); toast('Пассажир ушёл'); this._end(); } return;
    }
    r.off = 0; sh.tgt = { x: tg.x, z: tg.z }; const dz = Math.hypot(c.x - tg.x, c.z - tg.z);
    sh.sub = (r.ph === 'pick' ? 'Остановитесь у пассажира' : 'Остановитесь у адреса') + (dz < 14 ? ' (стойте)' : '');
    if (r.ph === 'ride') sh.prog = Math.min(1, r.t / r.par);
    if (c.dmg && !r.dmg0) { r.dmg0 = true; J.addPen(20, 'Авария'); }
    if (dz < 10 && slow) { this.stopT += dt; sh.act = 1; sh.prog = this.stopT / 1.3; if (this.stopT > 1.3) { this.stopT = 0; if (r.ph === 'pick') { r.ph = 'ride'; r.t = 0; r.par = r.dist * 1.35 / 9.5 + 25; this.grp.remove(r.g); toast(`🧍 Пассажир в машине. Едем: ${Math.round(r.dist)} м`, 2600); } else this._finish(); } } else this.stopT = 0;
  }
  _finish() { const r = this.r, J = this.J, sh = this.sh; const tb = Math.max(0, (r.par - r.t) / r.par) * 40; const fare = Math.round(25 + r.dist * 0.04 + tb); J.addBonus(fare, tb > 10 ? 'Поездка + быстро' : 'Поездка'); sh.done++; sh.actT = 1.5; toast(`✅ Пассажир доставлен · +₴${fare}`, 2600); this._end(); }
  _end() { if (this.r && this.r.g.parent) this.grp.remove(this.r.g); this.r = null; this.wait = 3; this.stopT = 0; }
  dispose() { const J = this.J, cr = J.g.crime; if (cr && cr.driving === this.car) cr.exitCar(true); if (this.car) { this.car.dead = true; J.city.cars = J.city.cars.filter(c => c !== this.car); } J.grp.remove(this.grp); }
}

// ==================================================================== Bus / tram: the route driving itself lives in transit.js; this class only meters it
class Drive {
  constructor(J, sh, poi) { this.J = J; this.sh = sh; this.poi = poi; this.drive = true; }
  start() { const t = this.J.ctx.transit; if (!t.loaded || !t.startDriving(this.poi)) return false; return true; }
  provider() { return this.J.ctx.transit.doorProvider(); }
  tick(dt, P) {
    const t = this.J.ctx.transit, d = t.drive, sh = this.sh; if (!d) { this.J.end('done'); return; }
    sh.done = d.served; sh.act = d.vel > 0.4 || d.hold > 0 ? 1 : 0;
    const nx = d.pat.si[d.k + 1] !== undefined ? t.stops[d.pat.si[d.k + 1]] : null;
    if (nx) { sh.tgt = { x: nx.sx, z: nx.sz }; sh.sub = 'Следующая: ' + nx.name; const dist = d.pat.s[d.k + 1] - d.s; sh.hud = `${d.ro.n}`; if (Math.abs(dist) < 9 && d.vel < 0.5 && d.hold <= 0) sh.sub += ' — откройте двери (E)'; }
    sh.marks = nx ? [{ x: nx.sx, z: nx.sz, icon: '🚏', col: '#ffd966' }] : [];
  }
  dispose() { const t = this.J.ctx.transit; if (t.drive) t.stopDriving('quit', true); }
}
