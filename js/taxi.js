// Phone «Такси» app (separate from the taxi job): tap the phone's GPS map to set pickup (А) and destination (Б), see fare + ETA, call a yellow
// Camry with an NPC driver that drives the road graph (A*) to the pickup; ride to Б with auto-drive (skip / drop-off anywhere), pay the fare.
import { el, tap, toast } from './ui.js';
const BASE = 45, PER_KM = 18, ROAD_K = 1.3, MAX_PICK = 900;   // ₴ base + ₴/km (incl. time), straight→road distance factor, max pickup distance from the player (streamed roads)
const fareFor = km => Math.round((BASE + PER_KM * km) / 5) * 5;
const NAMES = ['Олег', 'Андрей', 'Сергей', 'Виталий', 'Микола', 'Дмитро', 'Ігор', 'Максим'], PL = 'АА АІ КА КВ КН'.split(' ');
export class TaxiApp {
  constructor(ctx) {
    this.ctx = ctx; this.P = ctx.P; this.city = ctx.city; this.world = ctx.world; this.game = ctx.game; this.mode = 'A'; this.st = 'idle'; this.pick = null; this.dest = null; this.car = null; this.sig = ''; this.t = 0;
    this.drv = null; this.riding = false; this.fare = 0; this.trav = 0; this.lx = 0; this.lz = 0;
    this.hud = el('div', '', '', document.body); this.hud.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom));z-index:6;display:none;background:rgba(40,32,4,.78);color:#ffe27a;font:600 12px/1.3 -apple-system,system-ui,sans-serif;padding:4px 10px;border-radius:10px;text-align:center;max-width:60vw;pointer-events:none';
    this.hud.className = 'hl';
    this.bSkip = el('div', 'gbtn', '⏭', document.body); this.bSkip.style.cssText = this.game.bInv.style.cssText + ';display:none'; this.bSkip.style.right = 'calc(290px + env(safe-area-inset-right))'; this.bSkip.style.setProperty('--slot', 3); this.bSkip.classList.add('slot'); this.bSkip.style.opacity = '.85';
    tap(this.bSkip, () => this.skip());
    this.game.providers.unshift((P) => this.provider(P));
    const prev = this.game.onRespawn; this.game.onRespawn = () => { prev && prev(); this.reset(true); };
  }
  get busy() { return this.riding; }
  get active() { return this.st !== 'idle'; }
  // ---------------------------------------------------------------- map
  mapTap(wx, wz) {
    const g = this.game, P = this.P; if (this.st === 'coming' || this.st === 'waiting') { if (this.mode === 'A') { toast('Такси уже едет — отмените вызов, чтобы сменить точку подачи'); return; } }
    let r = null; if (this.mode === 'B' && this.pick && this.pick.road) r = this.city.nearestRoad(wx, wz, 150, 2, this.city.compOf(this.pick.road.path)) || this.city.nearestRoad(wx, wz, 150, 1, this.city.compOf(this.pick.road.path));
    if (!r) r = this.city.nearestRoad(wx, wz, 150, 2) || this.city.nearestRoad(wx, wz, 150, 1);
    if (!r && this.mode === 'A') { toast('Здесь нет дороги — выберите точку у проезжей части'); return; }
    const pt = r ? { x: r.x, z: r.z, road: r } : { x: wx, z: wz, road: null };   // far destinations: roads are not streamed in yet, the taxi finds its way as tiles load
    if (this.mode === 'A') { if (Math.hypot(r.x - P.x, r.z - P.z) > MAX_PICK) { toast(`Слишком далеко: подача не дальше ${MAX_PICK} м от вас`); return; } this.pick = pt; if (!this.dest) this.mode = 'B'; }
    else { this.dest = pt; if (this.st === 'wait_dest') { /* start button appears */ } }
    this.sig = ''; this.refresh && this.refresh();
  }
  km() { if (!this.pick || !this.dest) return 0; return Math.hypot(this.dest.x - this.pick.x, this.dest.z - this.pick.z) * ROAD_K / 1000; }
  estFare() { return this.dest && (this.pick || this.riding) ? fareFor((this.riding ? Math.hypot(this.dest.x - this.car.x, this.dest.z - this.car.z) * ROAD_K / 1000 : this.km())) : 0; }
  eta() { if (this.car && !this.car.dead && this.st === 'coming') return Math.hypot(this.car.x - this.pick.x, this.car.z - this.pick.z) * ROAD_K / 9; return 75; }
  fmtT(s) { s = Math.max(0, Math.round(s)); return s < 60 ? `${s} с` : `${Math.floor(s / 60)} мин ${String(s % 60).padStart(2, '0')} с`; }
  // ---------------------------------------------------------------- flow
  canUse() {
    const g = this.game, cr = g.crime, jobs = this.ctx.jobs;
    if (g.dead) return false; if (cr && (cr.jail || cr.driving)) { toast('Сейчас вызвать такси нельзя'); return false; }
    if (jobs && jobs.sh) { toast('Вы на смене — закончите её, чтобы вызвать такси'); return false; }
    if (this.ctx.transit && this.ctx.transit.busy) { toast('Сначала выйдите из транспорта'); return false; }
    return true;
  }
  call() {
    if (!this.pick || this.st !== 'idle' || !this.canUse()) return; const g = this.game;
    if (g.S.money < BASE) { toast(`Не хватает денег: минимальная поездка ₴${BASE}`); return; }
    if (this.dest && g.S.money < this.estFare()) { toast(`Не хватает денег: поездка ₴${this.estFare()}`); return; }
    let c = null;
    for (const [a, b2] of [[250, 600], [120, 900], [60, 1400]]) { c = this.city.spawnTaxiNPC(this.pick, a, b2, this.P); if (c) break; }
    if (!c) { toast('Свободных машин рядом нет — попробуйте позже'); return; }
    this.car = c; this.st = 'coming'; this.t = 0; this.drv = { name: NAMES[(Math.random() * NAMES.length) | 0], plate: `${PL[(Math.random() * PL.length) | 0]} ${String(1000 + ((Math.random() * 8999) | 0))} ${'ВКНОРТ'[(Math.random() * 6) | 0]}${'ВКНОРТ'[(Math.random() * 6) | 0]}` };
    toast(`🚕 Camry жёлтая · ${this.drv.plate} · ${this.drv.name} · прибудет через ~${this.fmtT(this.eta())}`, 5200); this.sig = ''; this.refresh && this.refresh();
  }
  release() {   // the driver goes on with normal traffic
    const c = this.car; if (c && !c.dead) { c.toward = null; c.keep = false; c.hold = false; c.arrived = false; c.taxiNpc = false; c.rider = false; c.vmax = 12; } this.car = null;
  }
  reset(silent) {
    if (this.riding) this._detach(); this.release(); this.st = 'idle'; this.pick = this.dest = null; this.mode = 'A'; this.riding = false; this.bSkip.style.display = 'none'; this.hud.style.display = 'none'; this.sig = ''; if (!silent) this.refresh && this.refresh();
  }
  cancel() {
    if (this.st === 'idle') return;
    if (this.riding) { this._finish(true); return; }
    toast('Вызов отменён'); this.reset();
  }
  provider(P) {
    if (this.st === 'waiting' && this.car && !this.car.dead && !this.game.dead) {
      if (Math.hypot(P.x - this.car.x, P.z - this.car.z) < 4.5 && !this.game.crime.driving) return { label: '🚕 Сесть в такси (Camry)', run: () => this.board() };
    }
    if (this.riding) return { label: this.st === 'wait_dest' ? 'Выйти из такси' : '🚕 Остановить поездку и выйти', run: () => this.cancel() };
    return null;
  }
  board() {
    const g = this.game, c = this.car, P = this.P; if (!this.canUse()) return;
    this.riding = true; c.rider = true; c.keep = true; P.fly = false; this.trav = 0; this.lx = c.x; this.lz = c.z;
    P.yaw = c.yaw + Math.PI; P.pitch = 0; this._cy = c.yaw;
    if (this.dest) this._go(); else { this.st = 'wait_dest'; c.hold = true; c.toward = null; this.mode = 'B'; toast('🚕 Куда едем? Откройте 📱 → Такси и отметьте пункт Б на карте', 5000); this.bSkip.style.display = 'none'; g.pTab = 'taxi'; g.phoneP.open(); }
    this.sig = '';
  }
  _go() {
    const c = this.car; this.fare = this.estFare(); if (this.game.S.money < this.fare) { toast(`Не хватает денег на поездку (₴${this.fare})`); this.st = 'wait_dest'; this.dest = null; this.sig = ''; return; }
    this.st = 'ride'; this.sx = c.x; this.sz = c.z; c.hold = false; c.arrived = false; c.toward = { x: this.dest.x, z: this.dest.z }; c.stuck = 0; this.rideT = 0; c.dest = this.dest.road; c.route = c.dest ? this.city.routeFor(c, c.dest) : null; this.bSkip.style.display = 'flex'; toast(`🚕 Поехали! Стоимость ₴${this.fare}`, 3000); this.sig = '';
  }
  _warpNear(c) {   // routing got stuck: re-place the car 45 m before the pickup on its road and let it drive in
    const r = this.pick.road, p = r.path, dir = r.s >= 45 || r.s > p.len - r.s ? 1 : -1, s0 = Math.max(0.5, Math.min(p.len - 0.5, r.s - dir * 45));
    c.path = p; c.s = s0; c.dir = dir; c.route = []; c.dest = null; c.passed = false; c.wait = 0; c.stuck = 0; c.speed = 0; c.hold = false; c.arrived = false; c.toward = { x: this.pick.x, z: this.pick.z }; this.city._placeCar(c);
  }
  start() { if (this.st === 'wait_dest' && this.dest) { this._go(); this.game.phoneP.close(); } }
  skip() {
    if (this.st !== 'ride' || !this.dest) return; const P = this.P, d = this.dest; this.trav = this.km() * 1000 / ROAD_K;
    const c = this.car; if (c) { c.dead = true; this.car = null; } this._detach(true); this.ctx.teleport(d.x + 3, d.z + 3, P.yaw, 0); this._pay(this.fare); toast(`⏭ Вы приехали. Оплачено ₴${this.fare}`, 3200); this.reset(true);
  }
  _pay(v) { const g = this.game; v = Math.min(v, Math.floor(g.S.money)); if (v > 0) g.pay(v); }
  _detach(keepPos) {
    const c = this.car, P = this.P; this.riding = false; if (!c) return; c.rider = false;
    if (keepPos) return;
    const ox = Math.cos(c.yaw) * 2.4, oz = -Math.sin(c.yaw) * 2.4; P.x = c.x + ox; P.z = c.z + oz; const q = { x: P.x, z: P.z }; this.world.collide(q, 0.4, c.y, 1.7); P.x = q.x; P.z = q.z;
    P.y = this.world.groundAt(P.x, P.z, c.y + 1.0) + 0.05; P.eye = P.y + 1.7; P.vx = P.vz = P.vy = 0; P.yaw = c.yaw + Math.PI + 1.57; P.pitch = 0; P.grounded = true;
  }
  _finish(partial) {
    const c = this.car; let fare = this.fare;
    if (partial || this.st === 'wait_dest') { fare = this.st === 'wait_dest' ? 0 : fareFor(this.trav / 1000); if (this.st === 'wait_dest') fare = 0; }
    this._detach(); this._pay(fare); toast(fare ? `🚕 Поездка окончена. Оплачено ₴${fare}` : 'Вы вышли из такси', 3200);
    this.reset(true);
  }
  // ---------------------------------------------------------------- per frame
  update(P, dt) {
    if (this.st === 'idle') return; const g = this.game, c = this.car; this.t += dt;
    if (g.dead || (g.crime && g.crime.jail) || (this.ctx.jobs && this.ctx.jobs.sh)) { this.reset(); return; }
    if (!c || c.dead) { if (this.riding) this._detach(true); toast('🚕 Такси недоступно — вызов отменён'); this.reset(); return; }
    if (this.st === 'coming') {
      const dd = Math.hypot(c.x - this.pick.x, c.z - this.pick.z);
      if (c.arrived || (dd < 16 && c.speed < 0.8)) { this.st = 'waiting'; this.t = 0; c.hold = true; toast(`🚕 Такси прибыло! ${this.drv.plate} · ${this.drv.name}. Подойдите и нажмите E`, 6000); try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) {} this.sig = ''; }
      else if (c.speed < 0.3 && !c.hold) { this.stk = (this.stk || 0) + dt; if (this.stk > 14) { this.stk = 0; this._warpNear(c); } }
      else this.stk = 0;
      if (this.st === 'coming' && this.t > 420) { c.x = this.pick.x; c.z = this.pick.z; c.path = this.pick.road.path; c.s = this.pick.road.s; this.city._placeCar(c); c.speed = 0; c.arrived = true; }   // fallback: routing got stuck
    } else if (this.st === 'waiting') {
      if (this.t > 300) { toast('Водитель не дождался и уехал'); this.reset(); return; }
    } else if (this.st === 'ride' || this.st === 'wait_dest') {
      if (this.riding) {
        const dx = c.x - this.lx, dz = c.z - this.lz; this.trav += Math.hypot(dx, dz); this.lx = c.x; this.lz = c.z;
        const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), px = c.x + cs * 0.35 - sn * 0.45, pz = c.z - sn * 0.35 - cs * 0.45;   // rear right seat
        P.x = px; P.z = pz; P.y = c.y - 0.45; P.vx = P.vz = P.vy = 0; P.grounded = true; P.fly = false; let dy = c.yaw - this._cy; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P.yaw += dy; this._cy = c.yaw;
        if (this.st === 'ride') { this.rideT += dt; if (c.arrived || Math.hypot(c.x - this.dest.x, c.z - this.dest.z) < 13 && c.speed < 1) { this._finish(false); return; } if (this.rideT > 120 + Math.hypot(this.dest.x - this.sx, this.dest.z - this.sz) / 4) { this.skip(); return; } }
      }
    }
    this._hud();
  }
  _hud() {
    let t = '';
    if (this.st === 'coming') t = `🚕 Едет к вам · ${this.fmtT(this.eta())} · ${Math.round(Math.hypot(this.car.x - this.pick.x, this.car.z - this.pick.z))} м`;
    else if (this.st === 'waiting') t = `🚕 Такси ждёт (${Math.round(Math.hypot(this.car.x - this.P.x, this.car.z - this.P.z))} м) · E — сесть`;
    else if (this.st === 'ride') t = `🚕 В пути · осталось ${Math.round(Math.hypot(this.car.x - this.dest.x, this.car.z - this.dest.z) * ROAD_K)} м · ₴${this.fare}`;
    else if (this.st === 'wait_dest') t = '🚕 Выберите пункт Б в 📱 → Такси';
    if (t !== this._ht) { this._ht = t; this.hud.textContent = t; this.hud.style.display = t ? 'block' : 'none'; }
  }
  // ---------------------------------------------------------------- phone UI + map markers
  drawMarkers(g, W, H, cx, cz, k, big) {
    if (this.st === 'idle' && !this.pick && !this.dest) return; const sx = x => W / 2 + (x - cx) * k, sy = z => H / 2 + (z - cz) * k;
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    const pin = (p, label, col) => { if (!p) return; const x = sx(p.x), y = sy(p.z); g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, big ? 11 : 6, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.font = `bold ${big ? 13 : 9}px sans-serif`; g.fillText(label, x, y + 1); };
    if (this.pick && this.dest) { g.setLineDash([6, 5]); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx(this.pick.x), sy(this.pick.z)); g.lineTo(sx(this.dest.x), sy(this.dest.z)); g.stroke(); g.setLineDash([]); }
    pin(this.pick, 'А', '#2e9e4f'); pin(this.dest, 'Б', '#d64040');
    if (this.car && !this.car.dead) { const x = sx(this.car.x), y = sy(this.car.z); if (this.st === 'coming' && this.pick) { g.setLineDash([4, 4]); g.strokeStyle = '#f2c40f'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(sx(this.pick.x), sy(this.pick.z)); g.stroke(); g.setLineDash([]); }
      g.fillStyle = '#f2c40f'; g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, big ? 12 : 8, 0, 7); g.fill(); g.stroke(); g.font = `${big ? 15 : 11}px sans-serif`; g.fillStyle = '#000'; g.fillText('🚕', x, y + 1); }
    g.restore();
  }
  fillPhone(div) {   // controls under the map (rebuilt only when the state changes; dynamic numbers are updated in place)
    this.div = div; const sig = [this.st, this.mode, !!this.pick, !!this.dest, this.pick && Math.round(this.pick.x), this.dest && Math.round(this.dest.x), this.estFare()].join('|');
    if (sig === this.sig && div.firstChild) { this._live(); return; } this.sig = sig; div.innerHTML = '';
    const g = this.game; const row = (h) => el('div', 'row', h, div);
    el('div', '', '<div style="font-size:12px;opacity:.7;margin:2px 0 4px">Нажмите на карту, чтобы выбрать точку. Тариф: подача ₴' + BASE + ' + ₴' + PER_KM + '/км.</div>', div);
    if (this.st === 'idle') {
      const ch = el('div', 'chips', '', div);
      tap(el('span', 'chip' + (this.mode === 'A' ? ' on' : ''), '🟢 А — подача', ch), () => { this.mode = 'A'; this.sig = ''; this.fillPhone(div); });
      tap(el('span', 'chip' + (this.mode === 'B' ? ' on' : ''), '🔴 Б — куда (необяз.)', ch), () => { this.mode = 'B'; this.sig = ''; this.fillPhone(div); });
      tap(el('span', 'chip', '📍 Я здесь', ch), () => { this.mode = 'A'; const r = this.city.nearestRoad(this.P.x, this.P.z, 120, 2) || this.city.nearestRoad(this.P.x, this.P.z, 120, 1); if (r) { this.pick = { x: r.x, z: r.z, road: r }; this.sig = ''; this.fillPhone(div); } else toast('Рядом нет дороги'); });
      if (this.dest) tap(el('span', 'chip', '✕ убрать Б', ch), () => { this.dest = null; this.sig = ''; this.fillPhone(div); });
      row(`<div class="t"><b>🟢 А: ${this.pick ? 'выбрана (' + Math.round(Math.hypot(this.pick.x - this.P.x, this.pick.z - this.P.z)) + ' м от вас)' : 'не выбрана'}</b><small>🔴 Б: ${this.dest ? 'выбрана' : 'выберите после посадки или сейчас'}</small></div>`);
      row(`<div class="t"><b>Стоимость: ${this.dest && this.pick ? '≈ ₴' + this.estFare() + ' (' + this.km().toFixed(1) + ' км)' : 'от ₴' + BASE}</b><small>Подача: ≈ ${this.fmtT(75)} · Баланс ₴${Math.floor(g.S.money)}</small></div>`);
      const b = el('div', 'btn' + (this.pick ? '' : ' off'), '🚕 Вызвать', div); b.style.cssText += ';margin-top:6px;background:#f2c40f;color:#111;width:100%;box-sizing:border-box'; tap(b, () => this.call());
    } else {
      this.live = row(''); const info = this.drv ? `Camry жёлтая · ${this.drv.plate} · ${this.drv.name}` : '';
      el('div', '', `<div style="font-size:12px;opacity:.75;margin:4px 0">${info}</div>`, div);
      if (this.st === 'wait_dest') {
        const ch = el('div', 'chips', '', div); this.mode = 'B';
        row(`<div class="t"><b>🔴 Б: ${this.dest ? 'выбрана' : 'нажмите на карту'}</b><small>${this.dest ? 'Стоимость ≈ ₴' + this.estFare() : 'Любая дорога поблизости'}</small></div>`);
        const b = el('div', 'btn' + (this.dest ? '' : ' off'), '▶ Поехали', div); b.style.cssText += ';margin-top:6px;background:#f2c40f;color:#111;width:100%;box-sizing:border-box'; tap(b, () => this.start());
      }
      if (this.st === 'ride') { const s = el('div', 'btn g', '⏭ Пропустить поездку', div); s.style.cssText += ';margin-top:6px;width:100%;box-sizing:border-box'; tap(s, () => this.skip()); }
      const c = el('div', 'btn r', this.riding ? (this.st === 'wait_dest' ? 'Выйти' : 'Остановить и выйти здесь') : 'Отменить вызов', div); c.style.cssText += ';margin-top:8px;width:100%;box-sizing:border-box'; tap(c, () => this.cancel());
      this._live();
    }
  }
  _live() {
    if (!this.live || !this.car) return; let t = '';
    if (this.st === 'coming') t = `<div class="t"><b>🚕 Едет к точке А</b><small>≈ ${this.fmtT(this.eta())} · ${Math.round(Math.hypot(this.car.x - this.pick.x, this.car.z - this.pick.z))} м</small></div>`;
    else if (this.st === 'waiting') t = `<div class="t"><b>🚕 Такси прибыло!</b><small>Подойдите к машине (${Math.round(Math.hypot(this.car.x - this.P.x, this.car.z - this.P.z))} м) и нажмите E · ждёт ещё ${this.fmtT(300 - this.t)}</small></div>`;
    else if (this.st === 'ride') t = `<div class="t"><b>🚕 В пути к точке Б</b><small>осталось ≈ ${Math.round(Math.hypot(this.car.x - this.dest.x, this.car.z - this.dest.z) * ROAD_K)} м · ₴${this.fare}</small></div>`;
    else t = '<div class="t"><b>🚕 Вы в такси</b><small>Выберите пункт назначения на карте</small></div>';
    if (t !== this._lt) { this._lt = t; this.live.innerHTML = t; }
  }
}
