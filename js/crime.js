// Crime layer: wanted level, police on foot, punching, pickpocketing, shop theft, car theft + driving,
// Kyiv SIZO (Дегтярівська 13): walled compound built from OSM wall way, arrest at wanted >= 3 -> jail timer -> released at the station.
import * as THREE from 'three';
import { $, UI, el, tap, toast } from './ui.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pipR = (r, x, z) => { let c = false; for (let i = 0, n = r.length / 2, j = n - 1; i < n; j = i++) { const xi = r[2 * i], zi = r[2 * i + 1], xj = r[2 * j], zj = r[2 * j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const WALL_H = 4.8, WALL_T = 0.5;

export class Crime {
  constructor(ctx) {
    this.ctx = ctx; const { P, world, scene, city, pois, game } = ctx; Object.assign(this, { P, world, scene, city, pois, game });
    game.crime = this; this.heat = 0; this.unseen = 0; this.cops = []; this.guards = []; this.pcars = []; this.pcT = 0; this.arrestM = 0; this.jail = null; this.driving = null; this.punchCd = 0; this.cdPick = new WeakMap();
    this.steer = 0; this.dbgQ = ctx.qs; this.sizoPoi = pois.items.find(p => p.key === 'sizo') || null; this.copCapBase = ctx.IS_TOUCH ? [2, 3, 5, 6] : [3, 5, 7, 9];
    this._hud(); this._sizoInit();
    game.addProvider((P, g) => this._provider(P, g));
    game.onRespawn = () => { this.heat = 0; this._clearCops(); if (this.driving) this.exitCar(true); if (this.jail) this._release(true); };
    addEventListener('keydown', e => { if (e.repeat || UI.modal || game.dead) return; if (e.code === 'KeyV') this.punch(); });
    ctx.canvas.addEventListener('mousedown', e => { if (e.button === 0 && document.pointerLockElement === ctx.canvas && !UI.modal) this.punch(); });
    const w = parseFloat(ctx.qs.get('wanted') || '0'); if (w > 0) this.heat = w;
  }
  get stars() { return Math.min(5, Math.ceil(this.heat - 1e-6)); }
  // ---------------------------------------------------------------- HUD
  _hud() {
    const T = this.ctx.IS_TOUCH;
    this.wEl = el('div', 'wst', '', document.body); this.wEl.style.cssText = `position:fixed;right:calc(${T ? 134 : 14}px + env(safe-area-inset-right));top:calc(${T ? 60 : 14}px + env(safe-area-inset-top));z-index:6;font:700 ${T ? 14 : 20}px system-ui;letter-spacing:1px;text-shadow:0 0 4px #000;display:none;pointer-events:none;color:#ff4040`;
    this.jEl = el('div', '', '', document.body); this.jEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(36px + env(safe-area-inset-top));z-index:6;display:none;background:rgba(40,40,40,.88);color:#fff;font:600 14px system-ui;padding:5px 14px;border-radius:12px;pointer-events:none;white-space:nowrap;border:1px solid #888';
    this.fade = el('div', '', '', document.body); this.fade.style.cssText = 'position:fixed;inset:0;background:#000;z-index:14;opacity:0;pointer-events:none;transition:opacity .5s;display:flex;align-items:center;justify-content:center;color:#fff;font:600 20px system-ui;text-align:center;padding:20px';
    if (T) { const b = el('div', 'gbtn', '👊', document.body); b.style.cssText = 'right:calc(238px + env(safe-area-inset-right));top:calc(8px + env(safe-area-inset-top));--slot:2'; b.classList.add('slot'); tap(b, () => this.punch()); }
  }
  addHeat(h, why) { const o = this.stars; this.heat = Math.min(5, this.heat + h); this.unseen = 0; if (this.stars > o) toast(`★ Розыск: ${this.stars}${why ? ' — ' + why : ''}`); }
  witnessed(r = 28) { const P = this.P; if (this.cops.some(c => Math.hypot(c.x - P.x, c.z - P.z) < 45)) return true; for (const a of this.city.peds) if (!a.inside && a.state === 'walk' && Math.hypot(a.x - P.x, a.z - P.z) < r) return true; return false; }
  // ---------------------------------------------------------------- punching NPCs
  punch() {
    if (this.punchCd > 0 || this.driving || this.jail && false || this.game.dead || UI.modal) return; this.punchCd = 0.55; const P = this.P;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let best = null, bd = 2.2;
    const test = (a, cop) => { const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz); if (d > bd || a.state === 'down' || a.inside && false) return; if ((dx * fx + dz * fz) / (d || 1) < 0.35) return; if (Math.abs(a.y - P.y) > 2.2) return; bd = d; best = { a, cop }; };
    for (const a of this.city.peds) test(a, false); for (const a of this.cops) test(a, true); for (const a of this.guards) test(a, true);
    if (!best) return; const { a, cop } = best;
    a.state = cop ? 'stun' : 'stagger'; a.t = 0; a.hp = (a.hp || 3) - 1;
    if (cop) { a.stun = 1.1; a.moving = 0; this.addHeat(a.guard ? 1.2 : 0.6, a.guard ? 'нападение на охранника' : 'нападение на полицейского'); if (a.guard && this.jail) this.jail.t -= 15; return; }
    this.addHeat(this.witnessed() ? 0.35 : 0.1, 'драка');
    if (a.hp <= 0) { a.state = 'down'; a.t = 0; a.hp = 3; a.loot = a.loot === undefined ? Math.round(rnd(25, 110)) : a.loot; }
    for (const b of this.city.peds) if (b !== a && !b.inside && Math.hypot(b.x - a.x, b.z - a.z) < 14 && b.state === 'walk') { b.state = 'flee'; }
    if (Math.random() < 0.25) { this.game.hurt(3 + Math.random() * 3); toast('Прохожий ударил в ответ'); } else a.fleeAfter = true;
  }
  // ---------------------------------------------------------------- context actions (E)
  _provider(P, g) {
    if (this.jail) {
      if (this.driving) return null;
      const near = [...this.world.interiors.active.values()].some(I => I.inside);
      if (!near && this.jail.cd <= 0) return { label: `Отжимания в прогулочном дворе (−5 с срока)`, run: () => { this.jail.cd = 3; this.jail.t += 5; g.S.food = Math.max(0, g.S.food - 1.5); toast('💪 Отжимания: срок короче на 5 с'); } };
      return null;
    }
    if (this.driving) return { label: 'Выйти из машины', run: () => this.exitCar() };
    const prev = this.pickTarget(P); if (prev) return prev;
    const c = this.city.nearestCar(P.x, P.z, 3.4); if (c && !c.dead && Math.abs(c.y - P.y) < 3) return { label: c.parked ? 'Угнать припаркованную машину' : 'Забрать машину у водителя', run: () => this.enterCar(c) };
    return null;
  }
  pickTarget(P) {
    let best = null, bd = 1.7; for (const a of this.city.peds) { if (a.inside) continue; const d = Math.hypot(a.x - P.x, a.z - P.z); if (d < bd && Math.abs(a.y - P.y) < 2 && (a.state === 'walk' || a.state === 'down')) { bd = d; best = a; } }
    if (!best) return null; const a = best;
    if (a.state === 'down') return a.looted ? null : { label: 'Обыскать лежащего', run: () => { a.looted = true; this.game.earn(a.loot || 30); this.addHeat(0.5, 'ограбление'); toast(`₴${a.loot || 30} найдено`); } };
    if (this.cdPick.get(a) > performance.now()) return null;
    return { label: 'Обшарить карманы', run: () => {
      this.cdPick.set(a, performance.now() + 20000); const ok = Math.random() < (this.witnessed(14) ? 0.4 : 0.65);
      if (ok) { const m = Math.round(rnd(12, 90)); this.game.earn(m); toast(`🤫 Карманная кража: +₴${m}`); this.addHeat(0.15); if (Math.random() < 0.3) this.game.add('choco', 1); }
      else { toast('Вас заметили!'); a.state = 'flee'; a.fleeAfter = true; this.addHeat(0.9, 'кража'); }
    } };
  }
  steal(poi, ids) {
    const g = this.game, ok = Math.random() < 0.5;
    if (ok && ids.length) { const id = ids[(Math.random() * ids.length) | 0]; if (g.add(id, 1)) toast(`🕶 Украдено: ${id}`); this.addHeat(0.5, 'кража в магазине'); }
    else { toast('🚨 Охрана подняла тревогу!'); this.addHeat(2.2, 'кража в магазине'); }
  }
  // ---------------------------------------------------------------- police
  _clearCops() { this.cops.length = 0; this.city.extra = this.city.extra.filter(a => a.guard); this.arrestM = 0; }
  _spawnCop(ax, az) {
    const P = this.P, a = Math.random() * 6.28, r = rnd(42, 70), x = ax !== undefined ? ax + rnd(-1.5, 1.5) : P.x + Math.cos(a) * r, z = az !== undefined ? az + rnd(-1.5, 1.5) : P.z + Math.sin(a) * r;
    const t = this.world.tiles.get(Math.floor(x / 500) + '_' + Math.floor(z / 500)); if (!t || !t.h) return;
    const cop = { x, z, y: this.world.heightAt(x, z), yaw: 0, phase: Math.random() * 6, shirt: 0x1f3d7a, pants: 0x14181f, state: 'chase', t: 0, scale: 1.02, cop: true, moving: 1, stun: 0 };
    this.cops.push(cop); this.city.extra.push(cop);
  }
  // ---- police cars (drive along the road graph towards the player, drop two officers nearby, leave)
  _updatePolice(P, dt) {
    const st = this.stars, city = this.city; city.chaseTarget = { x: P.x, z: P.z };
    const want = this.jail ? 0 : st >= 5 ? (this.ctx.IS_TOUCH ? 1 : 2) : st >= 3 ? 1 : 0;
    this.pcars = city.cars.filter(c => c.police && !c.dead);
    this.pcT -= dt;
    if (this.pcars.length < want && this.pcT <= 0 && this.world.tiles.size) { this.pcT = 10; const c = city.spawnPolice(P); if (c) this.pcars.push(c); }
    const flip = Math.floor(performance.now() / 260) % 2;
    for (const c of this.pcars) {
      c.col.setHex(flip ? 0x2255ff : 0xff2a2a);
      const d = Math.hypot(c.x - P.x, c.z - P.z); c.near = (c.near || 0) + (d < 95 ? dt : 0); if (c.near > 6) c.arrived = true;
      if (c.arrived && !c.dropped) { c.dropped = true; c.tdrop = 0; for (let k = 0; k < 2; k++) this._spawnCop(c.x, c.z); toast('🚓 Полицейская машина! Офицеры выходят'); }
      if (c.dropped) { c.tdrop += dt; if (c.tdrop > 20) c.dead = true; }
      if (!want || d > 320) c.dead = true;
    }
  }
  // ---- SIZO guards: 2 at the gate, 2 patrolling the yard along the wall, 1 in the reception hall
  _updateGuards(P, dt) {
    const S = this.sizo, near = S && S.built && Math.hypot(P.x - S.cx, P.z - S.cz) < 380;
    if (!near) { if (this.guards.length) { for (const g of this.guards) { const k = this.city.extra.indexOf(g); if (k >= 0) this.city.extra.splice(k, 1); } this.guards = []; } return; }
    if (!this.guards.length) {
      const mk = (x, z, y, yaw, kind, extra) => { const g = Object.assign({ x, z, y, yaw, phase: Math.random() * 6, shirt: 0x55623f, pants: 0x262b22, state: 'stand', t: 0, scale: 1.03, guard: true, moving: 0, stun: 0, kind }, extra || {}); this.guards.push(g); this.city.extra.push(g); return g; };
      const gt = S.gate, mx = (gt.p0[0] + gt.p1[0]) / 2, mz = (gt.p0[1] + gt.p1[1]) / 2, tx = gt.p1[0] - gt.p0[0], tz = gt.p1[1] - gt.p0[1], tl = Math.hypot(tx, tz) || 1;
      for (const s of [-1, 1]) { const x = mx - gt.nx * 2.5 + tx / tl * 2.3 * s, z = mz - gt.nz * 2.5 + tz / tl * 2.3 * s; mk(x, z, this.world.heightAt(x, z), Math.atan2(gt.nx, gt.nz), 'gate'); }
      const w = S.wall, n = w.length / 2, ring = []; for (let i = 0; i < n; i++) { const x = w[2 * i], z = w[2 * i + 1], dx = S.cx - x, dz = S.cz - z, d = Math.hypot(dx, dz) || 1; ring.push([x + dx / d * 9, z + dz / d * 9]); }
      for (let k = 0; k < 2; k++) { const i = (k * (n >> 1)) % n; mk(ring[i][0], ring[i][1], this.world.heightAt(ring[i][0], ring[i][1]), 0, 'patrol', { state: 'patrol', wp: (i + 1) % n, ring, stuck: 0 }); }
      mk(S.cx, S.cz, 0, 0, 'hall', { hidden: true });
    }
    const pl = this.sizoPoi && this.sizoPoi.pl;
    for (const g of this.guards) {
      if (g.stun > 0) { g.stun -= dt; g.state = 'stagger'; g.moving = 0; if (g.stun <= 0) { g.state = g.kind === 'patrol' ? 'patrol' : 'stand'; } continue; }
      if (g.kind === 'hall') {
        if (pl && pl.tile && pl.tile.alive) { const I = this.world.interiors.active.get(pl); if (I && I.sp) { const d = pl.door; g.x = I.sp[0] - d.nz * 2.1; g.z = I.sp[1] + d.nx * 2.1; g.y = I.F0; g.yaw = Math.atan2(d.nx, d.nz); g.hidden = false; } else g.y = -500; }
        else g.y = -500;
        continue;
      }
      if (g.kind === 'patrol') {
        const wp = g.ring[g.wp], dx = wp[0] - g.x, dz = wp[1] - g.z, d = Math.hypot(dx, dz);
        if (d < 1.5) { g.wp = (g.wp + 1) % g.ring.length; g.stuck = 0; continue; }
        const px = g.x, pz = g.z, s = 1.35 * dt; g.x += dx / d * s; g.z += dz / d * s; const p = { x: g.x, z: g.z }; this.world.collide(p, 0.4, g.y, 1.8); g.x = p.x; g.z = p.z;
        g.yaw = Math.atan2(dx, dz); g.moving = 1; g.state = 'patrol'; g.y += (this.world.groundAt(g.x, g.z, g.y + 1.0) - g.y) * Math.min(1, dt * 10);
        g.stuck += Math.hypot(g.x - px, g.z - pz) < s * 0.3 ? dt : -g.stuck; if (g.stuck > 2.5) { g.wp = (g.wp + 1) % g.ring.length; g.stuck = 0; }
      }
    }
  }
  _updateCops(P, dt) {
    const st = this.stars, cap = this.copCapBase[this.ctx.getLevel()] || 3, want = this.jail ? 0 : Math.min(cap, st ? st + (st >= 4 ? 1 : 0) : 0);
    this.spawnT = (this.spawnT || 0) - dt;
    if (this.cops.length < want && this.spawnT <= 0) { this._spawnCop(); this.spawnT = st >= 3 ? 1.2 : 3; }
    let seen = false, adj = 0; const speed = [0, 6.2, 7.6, 9, 10.2, 10.8][st] || 6;
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i], dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz);
      if (!want || d > 260) { this.cops.splice(i, 1); const k = this.city.extra.indexOf(c); if (k >= 0) this.city.extra.splice(k, 1); continue; }
      if (c.stun > 0) { c.stun -= dt; c.state = 'stagger'; c.moving = 0; if (c.stun <= 0) { c.state = 'chase'; c.moving = 1; } }
      else {
        c.state = 'chase'; c.moving = 1; if (d > 1.2) { const s = Math.min(d - 1.0, speed * dt * (d > 80 ? 1.6 : 1)); c.x += dx / d * s; c.z += dz / d * s; }
        c.yaw = Math.atan2(dx, dz); const p = { x: c.x, z: c.z }; this.world.collide(p, 0.4, c.y, 1.8); c.x = p.x; c.z = p.z;
        const g = this.world.groundAt(c.x, c.z, c.y + 1.0); c.y += (g - c.y) * Math.min(1, dt * 12);
        if (d < 1.9 && Math.abs(c.y - P.y) < 2.2) adj++;
      }
      if (d < 70) seen = true;
    }
    if (seen || st >= 4) this.unseen = 0; else this.unseen += dt;
    if (this.heat > 0 && this.unseen > 6 && !this.driving) { this.heat = Math.max(0, this.heat - dt * 0.12); if (this.heat === 0) toast('Розыск снят'); }
    else if (this.heat > 0 && this.unseen > 9) this.heat = Math.max(0, this.heat - dt * 0.08);
    this.arrestM = adj ? Math.min(1.6, this.arrestM + dt * (0.8 + 0.5 * adj)) : Math.max(0, this.arrestM - dt * 0.8);
    if (this.arrestM >= 1.2 && st >= 1 && !this.jail) this.arrest();
  }
  // ---------------------------------------------------------------- arrest + SIZO jail
  arrest(forceStars) {
    const g = this.game, st = forceStars || this.stars; this.arrestM = 0; if (this.driving) this.exitCar(true);
    this._clearCops();
    if (st < 3) {   // low wanted level: fine on the spot
      const fine = Math.min(Math.floor(g.S.money), 100 * Math.max(1, st)); g.S.money -= fine; g.dirty = 1; this.heat = 0; g.refresh(); toast(`👮 Задержан: штраф ₴${fine}, отпущен`); return;
    }
    const term = 40 + 20 * (st - 3), fine = Math.floor(g.S.money * 0.2); g.S.money -= fine; g.take('crowbar', g.count('crowbar')); g.dirty = 1; g.refresh();
    this.heat = 0; this.jail = { t: 0, term, cd: 0, fine, pend: true, last: null };
    UI.jail = true; for (const p of [g.invP, g.phoneP, g.shopP, g.jobP, this.pois.panel]) p.close();
    this.fade.textContent = `👮 Задержан · Київський СІЗО (вул. Дегтярівська, 13) · срок ${term} с · штраф ₴${fine}`; this.fade.style.opacity = 1;
  }
  _bp(fn) { UI.jailBypass = true; try { return fn(); } finally { UI.jailBypass = false; } }
  _enterJail(P, dt) {
    const j0 = this.jail; j0.pw = (j0.pw || 0) + dt;
    if (!this.sizoPoi || j0.pw > 25) { this._release(true); toast('СИЗО недоступен — вас отпустили'); return; }
    const pl = this.sizoPoi && this.sizoPoi.pl; const j = this.jail;
    if (!pl || !pl.tile || !pl.tile.alive) { if (!j.tpd) { j.tpd = 1; this._bp(() => this.ctx.teleport(this.sizo.cx - 30, this.sizo.cz + 30)); } if (this.sizoPoi) this._tryT = (this._tryT || 0); return; }   // wait for the SIZO tile
    this.P.fly = false; this._bp(() => this.ctx.gotoDoor(pl, 2.0)); const I = this.world.interiors.active.get(pl);
    if (I && I.sp) { const d = pl.door; P.x = I.sp[0] + d.nx * 1.2; P.z = I.sp[1] + d.nz * 1.2; P.y = I.F0 + 0.1; P.eye = P.y + 1.7; P.yaw = Math.atan2(d.nx, d.nz); P.vx = P.vz = P.vy = 0; }
    j.pend = false; j.last = [P.x, P.z, P.y]; this.fade.style.opacity = 0; this._gate(true);
    toast('Оформление в СИЗО. Двор и здания — в пределах периметра. Срок идёт.');
  }
  _updateJail(P, dt) {
    const j = this.jail; if (j.pend) { this._enterJail(P, dt); return; }
    j.t += dt; j.cd = Math.max(0, j.cd - dt); P.fly = false;
    const ring = this.sizo && this.sizo.wall;
    if (ring && !pipR(ring, P.x, P.z) && !(this.driving)) { if (j.last) { P.x = j.last[0]; P.z = j.last[1]; P.vx = P.vz = 0; } } else j.last = [P.x, P.z, P.y];
    this.jEl.style.display = 'block'; this.jEl.textContent = `⛓ СИЗО · осталось ${Math.max(0, Math.ceil(j.term - j.t))} с`;
    if (j.t >= j.term) this._release(false);
  }
  _release(silent) {
    this.jail = null; UI.jail = false; this.jEl.style.display = 'none'; this._gate(false); const s = this.ctx.START;
    this.fade.textContent = silent ? '' : '🔓 Вы освобождены. Вас высадили у вокзала.'; this.fade.style.opacity = 1;
    setTimeout(() => { this.ctx.teleport(s.x, s.z, THREE.MathUtils.degToRad(s.yaw), 0); this.ctx.teleport(s.x, s.z, THREE.MathUtils.degToRad(s.yaw), 0); this.fade.style.opacity = 0; }, 900);
    this.heat = 0; this._clearCops();
  }
  // ---------------------------------------------------------------- car theft / driving
  enterCar(c) {
    const g = this.game; if (this.driving) return; const wasParked = c.parked, wit = this.witnessed(35);
    this.addHeat(wasParked ? (g.count('crowbar') ? 0.15 : (wit ? 1.1 : 0.45)) : 1.6, wasParked ? 'угон' : 'угон с водителем');
    c.player = true; c.parked = false; c.vel = c.speed || 0; c.speed = 0; c.tilt = 0; this.driving = c; this.steer = 0; const P = this.P; P.fly = false;
    P.x = c.x; P.z = c.z; P.vx = P.vz = 0; toast('🚗 W/S — газ/тормоз · A/D — руль · Пробел — ручник · E — выйти'); this.ctx.setDriving && this.ctx.setDriving(true);
  }
  exitCar(silent) {
    const c = this.driving; if (!c) return; const P = this.P; c.player = false; c.parked = true; c.speed = 0; this.driving = null;
    const ox = Math.cos(c.yaw) * 2.3, oz = -Math.sin(c.yaw) * 2.3; P.x = c.x + ox; P.z = c.z + oz; const p = { x: P.x, z: P.z }; this.world.collide(p, 0.4, c.y, 1.7); P.x = p.x; P.z = p.z;
    P.y = this.world.groundAt(P.x, P.z, c.y + 1.0) + 0.05; P.eye = P.y + 1.7; P.vx = P.vz = P.vy = 0; P.yaw = c.yaw + Math.PI; this.ctx.setDriving && this.ctx.setDriving(false);
  }
  _drive(P, dt) {
    const c = this.driving, K = this.ctx.keys, T = this.ctx.T;
    let thr = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), st = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
    if (this.ctx.IS_TOUCH) { if (Math.abs(T.jy) > 0.15) thr = -T.jy; if (Math.abs(T.jx) > 0.1) st = T.jx; }
    const hb = K.Space || T.jump;
    let v = c.vel || 0;
    if (thr > 0) v += (v < 0 ? 14 : 7.5) * dt * thr; else if (thr < 0) v += (v > 0.5 ? -14 : -4.5) * dt; else v -= Math.sign(v) * Math.min(Math.abs(v), 3.2 * dt);
    if (hb) v -= Math.sign(v) * Math.min(Math.abs(v), 16 * dt);
    v = Math.max(-7, Math.min(this.ctx.IS_TOUCH ? 21 : 26, v)); if (c.dmg && v > 15) v = 15;
    this.steer += (st - this.steer) * Math.min(1, dt * 6);
    const ang = this.steer * 0.55 * (1 - Math.min(0.72, Math.abs(v) / 34)); c.yaw -= v * Math.tan(ang) / 2.7 * dt;   // right turn = clockwise seen from above
    const nx = c.x + Math.sin(c.yaw) * v * dt, nz = c.z + Math.cos(c.yaw) * v * dt;
    const f = { x: nx + Math.sin(c.yaw) * 1.6, z: nz + Math.cos(c.yaw) * 1.6 }, b = { x: nx - Math.sin(c.yaw) * 1.4, z: nz - Math.cos(c.yaw) * 1.4 };
    const f0 = { x: f.x, z: f.z }, b0 = { x: b.x, z: b.z }; this.world.collide(f, 1.0, c.y, 1.4); this.world.collide(b, 1.0, c.y, 1.4);
    const corr = Math.hypot(f.x - f0.x, f.z - f0.z) + Math.hypot(b.x - b0.x, b.z - b0.z);
    c.x = (f.x + b.x) / 2 + (Math.sin(c.yaw) * 0.1); c.z = (f.z + b.z) / 2 + Math.cos(c.yaw) * 0.1;
    if (corr > 0.02) { if (Math.abs(v) > 9) { this.game.hurt(Math.max(0, (Math.abs(v) - 9) * 1.6), 'Авария'); c.dmg = true; this.addHeat(0.3, 'ДТП'); } v *= 0.3; }
    c.vel = v; c.speed = v;
    const gy = this.world.groundAt(c.x, c.z, c.y + 1.0) + 0.17; c.y += (gy - c.y) * Math.min(1, dt * 14);
    c.tilt = -this.steer * Math.min(1, Math.abs(v) / 20) * 0.05;
    // run over pedestrians
    if (Math.abs(v) > 4.5) for (const a of this.city.peds) { if (a.inside || a.state === 'down') continue; if (Math.hypot(a.x - c.x - Math.sin(c.yaw) * 1.8 * Math.sign(v), a.z - c.z - Math.cos(c.yaw) * 1.8 * Math.sign(v)) < 1.4) { a.state = 'down'; a.t = 0; a.hp = 3; this.addHeat(0.9, 'наезд'); v *= 0.75; c.vel = v; } }
    P.x = c.x; P.z = c.z; P.y = c.y - 0.45 - 0.0; P.vx = P.vz = P.vy = 0; P.grounded = true; P.yaw = c.yaw + Math.PI + (this.look || 0); P.pitch *= 0.9;
  }
  // ---------------------------------------------------------------- SIZO compound (wall from OSM way, gate, towers)
  _sizoInit() {
    const s = this.pois.sizo; this.sizo = null; if (!s || !s.wall) return;
    const w = s.wall.slice(); let cx = 0, cz = 0; for (let i = 0; i < w.length; i += 2) { cx += w[i]; cz += w[i + 1]; } cx /= w.length / 2; cz /= w.length / 2;
    this.sizo = { wall: w, cx, cz, built: false, owner: { cellKeys: new Set() }, gateOwner: { cellKeys: new Set() }, group: new THREE.Group() };
    this.scene.add(this.sizo.group);
  }
  _concreteTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#b9b6ae'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { const v = 150 + Math.random() * 60; g.fillStyle = `rgba(${v},${v - 2},${v - 8},.35)`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    g.strokeStyle = 'rgba(70,70,70,.55)'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126); g.beginPath(); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  _sizoBuild() {
    const S = this.sizo, W = this.world; if (!S) return;
    const T = W.TILE; const pts = []; for (let i = 0; i < S.wall.length; i += 2) pts.push([S.wall[i], S.wall[i + 1]]);
    for (const [x, z] of pts) { const t = W.tiles.get(Math.floor(x / T) + '_' + Math.floor(z / T)); if (!t || !t.h) return; }   // all wall points need terrain
    // winding -> outward normal
    let area = 0; for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]; }
    const sgn = area > 0 ? 1 : -1;
    // gate: on the segment closest to the reception door (or centroid-south), 5 m opening
    const pl = this.sizoPoi && this.sizoPoi.pl; let gx = S.cx, gz = S.cz + 100; if (pl) { gx = pl.door.mx + pl.door.nx * 6; gz = pl.door.mz + pl.door.nz * 6; }
    let bi = 0, bt = 0.5, bd = 1e9; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; let t = ((gx - a[0]) * dx + (gz - a[1]) * dz) / L2; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(a[0] + dx * t - gx, a[1] + dz * t - gz); if (d < bd) { bd = d; bi = i; bt = t; } }
    const segs = []; // [ax,az,bx,bz,isGate]
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (i === bi && L > 14) { const t0 = Math.max(0.08, bt - 2.6 / L), t1 = Math.min(0.92, bt + 2.6 / L), P = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; const p0 = P(t0), p1 = P(t1); segs.push([a[0], a[1], p0[0], p0[1]], [p1[0], p1[1], b[0], b[1]]); S.gate = { p0, p1, nx: sgn * (b[1] - a[1]) / L, nz: -sgn * (b[0] - a[0]) / L }; }
      else segs.push([a[0], a[1], b[0], b[1]]);
    }
    if (!S.gate) { const a = pts[bi], b = pts[(bi + 1) % pts.length]; S.gate = { p0: a, p1: b, nx: 0, nz: 1 }; }
    const pos = [], uv = [], idx = [], nor = []; const tex = this._concreteTex();
    const quad = (A, B, C, D, n, u0, u1, v1) => { const i0 = pos.length / 3; pos.push(...A, ...B, ...C, ...D); for (let k = 0; k < 4; k++) nor.push(...n); uv.push(u0, 0, u1, 0, u1, v1, u0, v1); idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); };
    const wire = [];
    for (const [ax, az, bx, bz] of segs) {
      const L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue; const ux = (bx - ax) / L, uz = (bz - az) / L, nx = sgn * uz, nz = -sgn * ux;   // outward
      const ha = W.heightAt(ax, az), hb = W.heightAt(bx, bz), h = WALL_H, t2 = WALL_T / 2;
      const o = (x, z, y, s) => [x + nx * t2 * s, y, z + nz * t2 * s];
      const u1 = L / 4, v1 = (h + 0.6) / 4;
      quad(o(ax, az, ha - 0.6, 1), o(bx, bz, hb - 0.6, 1), o(bx, bz, hb + h, 1), o(ax, az, ha + h, 1), [nx, 0, nz], 0, u1, v1);   // outer face
      quad(o(bx, bz, hb - 0.6, -1), o(ax, az, ha - 0.6, -1), o(ax, az, ha + h, -1), o(bx, bz, hb + h, -1), [-nx, 0, -nz], 0, u1, v1);   // inner face
      quad(o(ax, az, ha + h, -1), o(bx, bz, hb + h, -1), o(bx, bz, hb + h, 1), o(ax, az, ha + h, 1), [0, 1, 0], 0, u1, 0.1);   // top
      // end caps are hidden inside neighbours; razor wire zig-zag on top
      for (let d = 0; d < L - 1; d += 1.2) { const x0 = ax + ux * d, z0 = az + uz * d, x1 = ax + ux * (d + 1.2), z1 = az + uz * (d + 1.2), y0 = ha + (hb - ha) * d / L + h, y1 = ha + (hb - ha) * (d + 1.2) / L + h; wire.push(x0, y0 + 0.1, z0, x1, y1 + 0.6, z1, x0, y0 + 0.6, z0, x1, y1 + 0.1, z1); }
      this._wallCol(S.owner, ax, az, bx, bz, ha - 0.5, ha + h, nx, nz);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide })); m.castShadow = m.receiveShadow = true; S.group.add(m);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3)); S.group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2a2a })));
    // watch towers at 4 corners
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: 0x23313a, roughness: 0.4 }), roof = new THREE.MeshStandardMaterial({ color: 0x4a3b34, roughness: 0.9 });
    const step = Math.max(1, Math.floor(pts.length / 4));
    for (let k = 0; k < 4; k++) {
      const [px, pz] = pts[(k * step) % pts.length], y = W.heightAt(px, pz), tw = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.BoxGeometry(1.8, 8, 1.8), mat); pole.position.y = 4; const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 3.2), mat); cab.position.y = 9.1;
      const win = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.9, 3.3), dark); win.position.y = 9.4; const rf = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.35, 3.9), roof); rf.position.y = 10.4;
      tw.add(pole, cab, win, rf); tw.position.set(px, y, pz); tw.traverse(o => { o.castShadow = true; }); S.group.add(tw);
      this._boxCol(S.owner, px, pz, 1.8, y, y + 8);
    }
    // sliding gate leaf (visible + solid while a prisoner is held)
    const gg = S.gate, gl = Math.hypot(gg.p1[0] - gg.p0[0], gg.p1[1] - gg.p0[1]), gy = W.heightAt((gg.p0[0] + gg.p1[0]) / 2, (gg.p0[1] + gg.p1[1]) / 2);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(gl, 3.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x3b4a58, roughness: 0.6, metalness: 0.4 }));
    leaf.position.set((gg.p0[0] + gg.p1[0]) / 2, gy + 1.8, (gg.p0[1] + gg.p1[1]) / 2); leaf.rotation.y = Math.atan2(gg.p1[0] - gg.p0[0], gg.p1[1] - gg.p0[1]) - Math.PI / 2; leaf.visible = false; S.group.add(leaf); S.leaf = leaf; S.gateY = gy;
    S.built = true; S.tile = W.tiles.get(Math.floor(S.cx / T) + '_' + Math.floor(S.cz / T)); S.arch = true;
  }
  _wallCol(owner, ax, az, bx, bz, y0, y1, nx, nz) {
    const W = this.world; W.addColliderOwner(owner, 'walls', { x1: ax, z1: az, x2: bx, z2: bz, y0, y1, nx, nz, owner }, ax, az, bx, bz); W.addColliderOwner(owner, 'walls', { x1: ax, z1: az, x2: bx, z2: bz, y0, y1, nx: -nx, nz: -nz, owner }, ax, az, bx, bz);
  }
  _boxCol(owner, x, z, s, y0, y1) { const h = s / 2; this._wallCol(owner, x - h, z - h, x + h, z - h, y0, y1, 0, -1); this._wallCol(owner, x + h, z - h, x + h, z + h, y0, y1, 1, 0); this._wallCol(owner, x + h, z + h, x - h, z + h, y0, y1, 0, 1); this._wallCol(owner, x - h, z + h, x - h, z - h, y0, y1, -1, 0); }
  _gate(closed) {
    const S = this.sizo; if (!S || !S.built) return; const W = this.world;
    W.removeOwner(S.gateOwner); S.leaf.visible = closed;
    if (closed) { const g = S.gate; this._wallCol(S.gateOwner, g.p0[0], g.p0[1], g.p1[0], g.p1[1], S.gateY - 0.5, S.gateY + 3.6, g.nx, g.nz); }
  }
  _sizoUpdate(P, dt) {
    const S = this.sizo; if (!S) return; const d = Math.hypot(P.x - S.cx, P.z - S.cz);
    if (!S.built) { S._t = (S._t || 0) - dt; if (S._t <= 0 && (d < 1600 || this.jail)) { S._t = 1.5; this._sizoBuild(); } return; }
    S.group.visible = d < 2500;
    const T = this.world.TILE, t = this.world.tiles.get(Math.floor(S.cx / T) + '_' + Math.floor(S.cz / T));
    if (t !== S.tile) { S.owner.cellKeys.forEach(() => {}); this.world.removeOwner(S.owner); this.world.removeOwner(S.gateOwner); S.group.clear(); S.built = false; S.gate = null; S._t = 0; }   // tile reloaded -> rebuild (colliders live in the world cells)
  }
  // ---------------------------------------------------------------- frame
  update(P, dt) {
    if (this.punchCd > 0) this.punchCd -= dt;
    this._sizoUpdate(P, dt);
    if (UI.modal && !this.jail?.pend) { return; }
    if (this.game.dead) return;
    if (this.driving) this._drive(P, dt);
    if (this.jail) this._updateJail(P, dt);
    this._updateCops(P, dt); this._updatePolice(P, dt); this._updateGuards(P, dt);
    // wanted HUD
    const st = this.stars; if (st !== this._st || this._flash) { this._st = st; this.wEl.style.display = st ? 'block' : 'none'; this.wEl.textContent = '★'.repeat(st) + '☆'.repeat(5 - st); }
    if (this.arrestM > 0.2) this.wEl.style.color = Math.floor(performance.now() / 150) % 2 ? '#4aa0ff' : '#ff4040'; else this.wEl.style.color = '#ff4040';
  }
}
