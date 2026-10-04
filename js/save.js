// Save system: two slots in localStorage ('manual' + 'auto'), full game snapshot (player, survival, money, inventory, wanted level,
// job shift, game clock, stolen cars). Pure data in / out; main.js wires it to the live systems.
import { WD, hhmm } from './clock.js';
const KEYS = { manual: 'kyiv.save.manual.v1', auto: 'kyiv.save.auto.v1' };
export const SLOT_NAMES = { manual: 'Ручное сохранение', auto: 'Автосохранение' };
const VER = 1;

export function readSlot(slot) {
  try { const s = JSON.parse(localStorage.getItem(KEYS[slot])); if (s && s.v === VER && s.P && s.S && typeof s.S.hp === 'number') return s; } catch (e) {}
  return null;
}
export function listSaves() { return ['manual', 'auto'].map(k => ({ slot: k, save: readSlot(k) })).filter(x => x.save).sort((a, b) => b.save.at - a.save.at); }
export function newestSave() { const l = listSaves(); return l.length ? l[0] : null; }
export function writeSlot(slot, data) { try { localStorage.setItem(KEYS[slot], JSON.stringify(data)); return true; } catch (e) { console.warn('save failed', e); return false; } }
export function deleteAll() { for (const k of Object.values(KEYS)) { try { localStorage.removeItem(k); } catch (e) {} } }
export function hasSave() { return !!newestSave(); }
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
export function fmtWhen(at) {
  const d = new Date(at), p = n => String(n).padStart(2, '0'), now = new Date();
  const same = d.toDateString() === now.toDateString();
  return (same ? 'сегодня' : `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`) + ` ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function describe(s) {
  const m = s.meta || {}, c = s.clock || {};
  return { when: fmtWhen(s.at), money: Math.round(s.S.money), game: `${WD[c.wk | 0] || 'пн'} ${hhmm((c.t || 0) / 60)} · день ${(c.day | 0) + 1}`, hp: Math.round(s.S.hp), place: m.place || '' };
}

export class SaveSystem {
  constructor(c) { Object.assign(this, c); this.lastAt = 0; }   // {P, game, crime, jobs, transit, clock, city, pois, teleport, world, defaults}
  carDesc(c) { return { x: r1(c.x), z: r1(c.z), y: r1(c.y), yaw: r2(c.yaw), kind: c.kind, model: c.model, color: c.col && c.col.getHex ? c.col.getHex() : undefined, dmg: c.dmg ? 1 : 0, fac: c.factory ? 1 : 0, hp: c.hp, taxi: c.taxi ? 1 : 0 }; }
  canSave() { const g = this.game, k = this.crime; return !(g.dead || k.jail || (this.transit && this.transit.busy)); }
  snapshot() {
    const { P, game, crime, jobs, clock, city } = this, S = JSON.parse(JSON.stringify(game.S));
    const stolen = [];
    for (const c of city.cars) if (!c.dead && c.stolen && !c.player && !c.job) stolen.push(this.carDesc(c));
    const drv = crime.driving ? this.carDesc(crime.driving) : null;
    const sh = jobs.sh, job = sh && sh.impl && !sh.impl.drive ? { key: sh.key, px: sh.poi.x, pz: sh.poi.z, worked: sh.worked, ot: sh.ot, idle: sh.idle, off: sh.off, brk: sh.brk, brkUsed: sh.brkUsed, brkDone: sh.brkDone, bonus: sh.bonus, pen: sh.pen, done: sh.done, log: sh.log.slice(-30), startAbs: sh.startAbs, startWk: sh.startWk, otAsked: sh.otAsked } : null;
    let place = ''; try { place = this.placeName ? this.placeName() : ''; } catch (e) {}
    return { v: VER, at: Date.now(), P: { x: r1(P.x), y: r2(P.y), z: r1(P.z), yaw: r2(P.yaw), pitch: r2(P.pitch), fly: P.fly ? 1 : 0 }, S, clock: { t: clock.t, wk: clock.wk, day: clock.day | 0 },
      crime: { heat: r2(crime.heat) }, drv, stolen, job, meta: { place } };
  }
  save(slot = 'manual') { if (!this.canSave()) return false; const ok = writeSlot(slot, this.snapshot()); if (ok) this.lastAt = performance.now(); return ok; }
  // -------------------------------------------------------------------------------- restore
  _resetWorld() {
    const { game, crime, jobs, transit, city } = this;
    if (this.taxi) this.taxi.reset(true);
    if (jobs.sh) jobs.end('abort');
    if (transit && transit.busy && transit.abort) try { transit.abort(); } catch (e) {}
    if (crime.driving) crime.exitCar(true);
    if (crime.jail) crime._release && crime._release(true);
    crime.heat = 0; crime._clearCops && crime._clearCops(); game.dead = false;
    for (const c of city.cars) if (c.stolen) { c.stolen = false; c.keep = false; }
    if (game.phoneP && game.phoneP.close) game.phoneP.close();
  }
  newGame() {
    this._resetWorld(); const { game, clock, P } = this;
    game.S = this.defaults(); game.dirty = 1; game.refresh(); clock.set(0, 8 * 60); clock.day = 0;
    const s = this.START; P.fly = false; this.teleport(s.x, s.z, s.yaw * Math.PI / 180, 0); if (this.rent) this.rent.afterLoad();
    this.dropClones && this.dropClones();
  }
  load(s) {
    this._resetWorld(); const { game, clock, P, crime, city } = this;
    game.S = Object.assign(this.defaults(), s.S); game.dirty = 1; game.refresh();
    clock.wk = s.clock.wk | 0; clock.t = s.clock.t || 0; clock.day = s.clock.day | 0;
    P.fly = !!s.P.fly; this.teleport(s.P.x, s.P.z, s.P.yaw, s.P.pitch);
    P.restoreY = P.wait ? s.P.y : undefined; P.y = s.P.y; P.eye = P.y + 1.7;     // exact height (teleport() lands on the highest surface = roofs)
    crime.heat = s.crime ? s.crime.heat : 0;
    if (this.rent) { this.rent.afterLoad(); this.rent.applyLoadSpawn(s); }
    this.pending = s;                                         // cars / job are restored once the tiles around the player exist
    this.applyPending();
  }
  applyPending() {
    const s = this.pending; if (!s) return; const { city, crime, jobs, P, world } = this;
    const tk = Math.floor(P.x / 500) + '_' + Math.floor(P.z / 500), t = world.tiles.get(tk); if (!t || !t.h) return;
    this.pending = null;
    for (const d of s.stolen || []) { const c = city.spawnSaved && city.spawnSaved(d); if (c) { c.stolen = true; c.keep = true; } }
    if (s.drv && city.spawnSaved) { const c = city.spawnSaved(s.drv); if (c) { c.stolen = true; c.keep = true; crime.enterCar(c, true); P.x = c.x; P.z = c.z; P.y = s.P.y; P.eye = P.y + 1.7; } }
    if (s.job && jobs.pois) {
      const poi = jobs.pois.items.find(p => p.key === s.job.key && Math.hypot(p.x - s.job.px, p.z - s.job.pz) < 5);
      if (poi) { jobs.begin(poi); const sh = jobs.sh; if (sh) { for (const k of ['worked', 'ot', 'idle', 'off', 'brk', 'brkUsed', 'brkDone', 'bonus', 'pen', 'done', 'startAbs', 'startWk', 'otAsked']) if (s.job[k] !== undefined) sh[k] = s.job[k]; sh.log = s.job.log || []; } }
    }
  }
}
