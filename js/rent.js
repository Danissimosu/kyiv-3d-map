// Apartment rental («Жильё» phone app). Data: assets/rent.json (compacted data/rent_pack.json: 39 Kyiv locations, rent min/median/max for 1/2/3 rooms,
// utilities ranges, bot rules). Listings are generated deterministically per location; a signed contract lives in game.S.home (so it is saved/loaded with
// the normal save slots). The rented flat is a real procedural interior: a residential building near the location gets plan.home (see interior.js:
// room types, guaranteed bed + fridge, locked entrance). Home functions: sleep (advances the game clock), fridge stash, save point, spawn at home,
// monthly billing on the 1st (utilities by season), late fee 1%/day, eviction, termination.
import * as THREE from 'three';
import { el, tap, toast, panel, UI } from './ui.js';
import { classify } from './rooms.js';
import { hash01 } from './interior.js';
import { MON, MONG } from './clock.js';
import { ITEMS } from './game.js';

const WINTER = [1, 0.95, 0.7, 0.4, 0.2, 0.1, 0.05, 0.05, 0.15, 0.4, 0.7, 0.95];   // share of the (min..max) utilities range by calendar month (heating season)
const EVICT_DAYS = 14, KEY_COPY = 300, STASH_MAX = 24, FARE_BASE = 45, FARE_KM = 18;
const TAGRU = { premium: 'премиум', center: 'центр', center_adjacent: 'у центра', quiet_streets: 'тихо', embassies: 'посольства', quiet: 'тихо', park: 'парк', green: 'зелень', forest: 'лес', lake: 'озеро', dnieper_view: 'вид на Днепр', embankment: 'набережная', hills: 'холмы', old_town: 'старый город', old_fund: 'старый фонд', new_build: 'новостройки', panel: 'панельки', students: 'студенты', university: 'вуз', kpi: 'КПИ', nightlife: 'ночная жизнь', tourists: 'туристы', market: 'рынок', metro: 'метро', no_metro: 'без метро', far_from_metro: 'далеко от метро', far_from_center: 'далеко от центра', left_bank: 'левый берег', private_sector: 'частный сектор', dachas: 'дачи', industrial: 'промзона', industrial_edge: 'у промзоны', noisy: 'шумно', noise: 'шумно', traffic: 'трафик', railway: 'ж/д', airport: 'аэропорт', bridge: 'мост', canal: 'канал', botanical_garden: 'ботсад', business: 'бизнес', budget: 'бюджет', mid: 'средний', high: 'высокий' };
const ADJ = ['Светлая', 'Уютная', 'Тихая', 'После ремонта', 'С мебелью', 'Просторная', 'Тёплая', 'С видом во двор', 'Евроремонт', 'От хозяина'];
const R10 = n => Math.round(n / 10) * 10, R100 = n => Math.round(n / 100) * 100;
export const money = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009') + '\u2009₴';
const seedOf = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = s => { let a = seedOf(s) + 0x6D2B79F5; a = Math.imul(a ^ (a >>> 15), a | 1); a ^= a + Math.imul(a ^ (a >>> 7), a | 61); return ((a ^ (a >>> 14)) >>> 0) / 4294967296; };
const pip = (ring, x, z) => { let c = false; const n = ring.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = ring[2 * i], zi = ring[2 * i + 1], xj = ring[2 * j], zj = ring[2 * j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };

export class Rent {
  constructor(ctx) {
    this.ctx = ctx; this.game = ctx.game; this.world = ctx.world; this.P = ctx.P; this.clock = ctx.clock; this.ll2xz = ctx.ll2xz; this.IS_TOUCH = ctx.IS_TOUCH;
    this.data = null; this.loaded = false; this.cache = new Map(); this.plan = null; this.t = 0; this.pinned = null; this.travel = null; this.signSprite = null;
    this.f = { rooms: 0, max: 0, dist: '' }; this.sel = { v: 'locs', loc: null, L: null };
    this.view = { x: 0, z: 0, k: 0.0085 };
    this.sleepP = panel('sleepP', '🛏 Кровать'); this.fridgeP = panel('fridgeP', '🧊 Холодильник'); this.noteP = panel('noteP', 'Жильё');
    this.fade = el('div', '', '', document.body); this.fade.style.cssText = 'position:fixed;inset:0;background:#000;z-index:14;opacity:0;pointer-events:none;transition:opacity .6s;display:flex;align-items:center;justify-content:center;color:#fff;font:600 20px system-ui;text-align:center;padding:20px';
    addEventListener('keydown', e => { if (e.code === 'Escape') for (const p of [this.sleepP, this.fridgeP, this.noteP]) p.close(); });
    this.game.rent = this; this.game.addProvider((P, g) => this.provider(P, g));
    this.clock.dayCbs.push(() => this.sync());
    this.load();
  }
  async load() {
    try { const r = await fetch('assets/rent.json'); if (!r.ok) throw new Error(r.status); this.data = await r.json(); } catch (e) { console.warn('rent.json', e); return; }
    for (const L of this.data.locs) { const [x, z] = this.ll2xz(L.lat, L.lon); L.x = x; L.z = z; }
    this.byId = Object.fromEntries(this.data.locs.map(L => [L.id, L])); this.rules = this.data.rules;
    const c = this.ll2xz(50.4501, 30.5234); this.view.x = c[0]; this.view.z = c[1]; this.loaded = true; this.render();
  }
  get H() { return this.game.S.home; }
  get rules_() { return this.rules || { deposit_months: 1, agency_fee_share_of_month: 0.5, min_rent_term_months: 6, payment_day: 1, bargain_discount: [0.05, 0.15], late_fee_share_per_day: 0.01 }; }
  // ------------------------------------------------------------------ listings (deterministic)
  listings(L) {
    let a = this.cache.get(L.id); if (a) return a; a = [];
    [1, 1, 1, 2, 2, 3].forEach((rooms, i) => {
      const id = `${L.id}:${rooms}:${i}`, [mn, md, mx] = L.r[rooms], q = (rnd(id + 'a') + rnd(id + 'b')) / 2;
      const price = R100(q < 0.5 ? mn + (md - mn) * q * 2 : md + (mx - md) * (q - 0.5) * 2), AR = [[28, 46], [46, 68], [66, 98]][rooms - 1];
      const area = Math.round(AR[0] + (AR[1] - AR[0]) * Math.min(1, Math.max(0, 0.55 * q + 0.45 * rnd(id + 'c')))), tot = 5 + Math.floor(rnd(id + 'd') * 12);
      const floor = 1 + Math.floor(Math.pow(rnd(id + 'e'), 1.3) * tot), tags = L.tags.slice().sort((x, y) => rnd(id + x) - rnd(id + y)).slice(0, 2).map(t => TAGRU[t] || t);
      a.push({ id, lid: L.id, rooms, price, q, area, floor, tot, ulo: L.u[rooms][0], uhi: L.u[rooms][1], title: `${ADJ[Math.floor(rnd(id + 'f') * ADJ.length)]} ${rooms}-комн.`, tags, unit: 1 + Math.floor(rnd(id + 'g') * 8) + 4 * (floor - 1) });
    });
    a.sort((x, y) => x.price - y.price); this.cache.set(L.id, a); return a;
  }
  priceOf(l) { const b = (this.game.S.rentB || {})[l.id]; return b && b.pct ? R100(l.price * (1 - b.pct / 100)) : l.price; }
  utilFor(rec, m) { const f = WINTER[m]; return Math.min(rec.uhi, Math.max(rec.ulo, R10(rec.ulo + (rec.uhi - rec.ulo) * f))); }
  matches(l) { const f = this.f; return (!f.rooms || l.rooms === f.rooms) && (!f.max || this.priceOf(l) <= f.max); }
  locMatches(L) { if (this.f.dist && L.d !== this.f.dist) return []; return this.listings(L).filter(l => this.matches(l)); }
  fareTo(x, z) { const km = Math.hypot(x - this.P.x, z - this.P.z) / 1000; return Math.round((FARE_BASE + FARE_KM * km) / 5) * 5; }
  // ------------------------------------------------------------------ bargain + contract
  bargain(l) {
    const S = this.game.S; S.rentB = S.rentB || {}; if (S.rentB[l.id] !== undefined) return S.rentB[l.id];
    const [lo, hi] = this.rules_.bargain_discount, ok = Math.random() < 0.3 + 0.5 * l.q;
    const r = ok ? { pct: Math.round((lo + Math.random() * (hi - lo)) * 100) } : { pct: 0 }; S.rentB[l.id] = r; this.game.dirty = 1; return r;
  }
  terms(l) { const rent = this.priceOf(l), r = this.rules_; return { rent, deposit: Math.round(rent * r.deposit_months), fee: Math.round(rent * r.agency_fee_share_of_month) }; }
  sign(l) {
    const g = this.game, S = g.S, L = this.byId[l.lid], T = this.terms(l);
    if (S.home) { toast('У вас уже есть договор аренды'); return false; }
    if (S.money < T.deposit + T.fee) { toast('Не хватает денег'); return false; }
    if (S.inv.length >= 12 && !S.inv.some(s => s.id === 'homekey')) { /* SLOTS checked by add() */ }
    if (!g.pay(T.deposit + T.fee)) return false;
    if (!g.add('homekey', 1)) { g.earn(T.deposit + T.fee); toast('Освободите слот в рюкзаке для ключа'); return false; }
    const dt = this.clock.date, rb = (S.rentB || {})[l.id];
    S.home = { lid: L.id, lname: L.n, did: L.d, listing: l.id, rooms: l.rooms, area: l.area, floor: l.floor, unit: l.unit, fl: Math.max(0, l.floor - 1), tot: l.tot, title: l.title,
      rent: T.rent, ulo: l.ulo, uhi: l.uhi, deposit: T.deposit, fee: T.fee, pct: rb ? rb.pct : 0, signDay: this.clock.day, lastDay: this.clock.day, signU: Date.UTC(dt.y, dt.m, dt.d), endU: Date.UTC(dt.y, dt.m + this.rules_.min_rent_term_months, dt.d),
      bills: [], autopay: true, spawnHome: true, bid: null, bx: L.x, bz: L.z, door: null, spot: null, stash: [{ id: 'bread', n: 1 }, { id: 'water', n: 1 }], hist: [`Договор подписан ${dt.d} ${MON[dt.m]} ${dt.y}`], bad: [] };
    g.dirty = 1; g.refresh(); toast(`🏠 Договор подписан: ${L.n}, кв. ${l.unit}. Ключ в рюкзаке`, 4200); this.sel = { v: 'home', loc: null, L: null }; this.render(); return true;
  }
  terminate() {
    const H = this.H; if (!H) return; const g = this.game, early = this.nowU() < H.endU, debt = H.bills.filter(b => !b.paid).reduce((s, b) => s + b.rent + b.util + b.fee, 0);
    const refund = early ? 0 : Math.max(0, H.deposit - debt); if (refund) g.earn(refund);
    let back = 0; for (const s of H.stash) { if (g.add(s.id, s.n)) back += s.n; }
    this._clear(); g.take('homekey', 99);
    this.note('Договор расторгнут', early ? `Расторжение раньше минимального срока (${this.rules_.min_rent_term_months} мес.): залог <b>${money(H.deposit)}</b> не возвращается.${debt ? ' Долги по платежам списаны.' : ''}` : `Залог ${money(H.deposit)}${debt ? ' минус долги ' + money(debt) : ''}: возвращено <b>${money(refund)}</b>.`, back ? `Вещи из холодильника возвращены в рюкзак (${back}).` : '');
  }
  evict() {
    const H = this.H; if (!H) return; this._clear(); this.game.take('homekey', 99);
    this.note('Выселение', `Просрочка платежа больше ${EVICT_DAYS} дней. Договор расторгнут, залог <b>${money(H.deposit)}</b> удержан, вещи в квартире (холодильник) потеряны, ключ изъят.`);
  }
  _clear() {
    const H = this.H, pl = this.plan; this._outside(); this.game.S.home = null; this.game.dirty = 1; this._detach(); if (this.sel.v === 'home') this.sel.v = 'locs'; this.render(); this.game.refresh();
    if (pl) this.world.interiors.dispose(pl);
  }
  note(title, html, extra) { const p = this.noteP; p.titleEl.textContent = title; p.body.innerHTML = ''; el('div', '', `<p style="font-size:16px;line-height:1.45">${html}</p>${extra ? `<p style="opacity:.8">${extra}</p>` : ''}`, p.body); tap(el('div', 'btn', 'OK', p.body), () => p.close()); p.open(); }
  // ------------------------------------------------------------------ calendar billing
  nowU() { const d = this.clock.date; return Date.UTC(d.y, d.m, d.d); }
  sync() {
    let H = this.H; if (!H) return; const ck = this.clock; if (ck.day < H.lastDay) H.lastDay = ck.day;
    for (let n = 0; H && H.lastDay < ck.day && n < 4000; n++) { H.lastDay++; this._tick(H, H.lastDay); H = this.H; }
  }
  _tick(H, day) {
    const d = this.clock.dateOf(day), g = this.game, mi = d.y * 12 + d.m;
    if (d.d === 1 && day > H.signDay && !H.bills.some(b => b.mi === mi)) {
      const b = { mi, day, label: `${MON[d.m]} ${d.y}`, rent: H.rent, util: this.utilFor(H, d.m), fee: 0, paid: false }; H.bills.push(b);
      if (H.autopay && g.S.money >= b.rent + b.util) { g.pay(b.rent + b.util); b.paid = true; b.pday = day; H.hist.push(`${d.d} ${MON[d.m]}: оплачено ${money(b.rent + b.util)}`); toast(`🏠 Аренда за ${MONG[d.m]} списана: ${money(b.rent + b.util)} (коммунальные ${money(b.util)})`, 4200); }
      else toast(`🏠 Счёт за ${MONG[d.m]}: ${money(b.rent + b.util)}. Оплатите в 📱 → Жильё (пени 1%/день)`, 5200);
    }
    for (const b of H.bills) if (!b.paid && b.day < day) {
      b.fee += Math.round((b.rent + b.util) * this.rules_.late_fee_share_per_day); const age = day - b.day;
      if (age >= EVICT_DAYS) { this.evict(); return; }
      if (age === 3 || age === 7 || age === 11) toast(`⚠ Просрочка ${age} дн.: долг ${money(b.rent + b.util + b.fee)}. Выселение через ${EVICT_DAYS - age} дн.`, 5000);
    }
    this._hc = null;
  }
  billTotal(b) { return b.rent + b.util + b.fee; }
  debt() { const H = this.H; return H ? H.bills.filter(b => !b.paid).reduce((s, b) => s + this.billTotal(b), 0) : 0; }
  payBill(b) { const t = this.billTotal(b); if (b.paid) return; if (!this.game.pay(t)) { toast('Не хватает денег: ' + money(t)); return; } b.paid = true; b.pday = this.clock.day; this.H.hist.push(`Оплачено ${money(t)} (${b.label})`); toast(`✅ Оплачено ${money(t)}`); this._hc = null; this.render(); }
  nextBill() {
    const H = this.H; if (!H) return null; if (this._nb && this._nb.day === this.clock.day && this._nb.h === H) return this._nb;
    let k = 1; const ck = this.clock; for (; k <= 32; k++) { if (ck.dateOf(ck.day + k).d === 1) break; }
    const dd = ck.dateOf(ck.day + k); return this._nb = { day: ck.day, h: H, in: k, m: dd.m, y: dd.y, d: dd.d, amount: H.rent + this.utilFor(H, dd.m) };
  }
  hud() {
    const H = this.H; if (!H) return null; if (this._hc && this._hc.day === this.clock.day && this._hc.s === H.bills.length + ':' + this.debt()) return this._hc.v;
    let v = null; const un = H.bills.filter(b => !b.paid);
    if (un.length) { const age = this.clock.day - un[0].day; v = { text: `🏠 Долг ${money(this.debt())} · выселение через ${Math.max(0, EVICT_DAYS - age)} дн.`, warn: true }; }
    else { const n = this.nextBill(); if (n && n.in <= 3) v = { text: `🏠 Аренда ${money(n.amount)} через ${n.in} дн.`, warn: false }; }
    this._hc = { day: this.clock.day, s: H.bills.length + ':' + this.debt(), v }; return v;
  }
  // ------------------------------------------------------------------ the building: pick, attach, lock, door sign
  _tilesReady(x, z) {
    const T = this.world.TILE, ix = Math.floor(x / T), iz = Math.floor(z / T); let have = 0, need = 0;
    for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) { const k = a + '_' + b; if (!this.world.manifestTiles.has(k)) continue; need++; const t = this.world.tiles.get(k); if (t && t.plans) have++; }
    return have >= need && need > 0;
  }
  _pick(H) {
    const IM = this.world.interiors, L = this.byId[H.lid], need = Math.max(38, 24 * H.rooms);
    for (const R of [420, 900]) {
      let best = null, bs = 1e9;
      for (const p of IM.plansNear(L.x, L.z, R)) {
        if (p.poi || p.failed || !p.door || !p.inner || (H.bad || []).includes(p.bid) || classify(p.kind, hash01(p.seed * 0.37)) !== 'res') continue;
        const a = p.area || 0; if (a < 38 || a > 2500) continue;
        const d = Math.hypot(p.cx - L.x, p.cz - L.z), sc = d + (a < need ? 260 : 0) + (H.rooms > 1 && p.n < 2 ? 70 : 0) + (p.n > 25 ? 60 : 0) + (a > 500 ? Math.min(450, (a - 500) * 0.5) : 0) + hash01(p.seed + 3.3) * 50;
        if (sc < bs) { bs = sc; best = p; }
      }
      if (best) return best;
    }
    return null;
  }
  _doorstep(p) { const d = p.door; return { x: d.mx + d.nx * 2.4, z: d.mz + d.nz * 2.4, yaw: Math.atan2(d.nx, d.nz) }; }
  _attach() {
    const H = this.H, IM = this.world.interiors;
    if (!H) { if (this.plan) this._detach(); return; }
    if (this.plan && (!this.plan.tile.alive || this.plan.bid !== H.bid)) this._detach();
    if (!H.bid) {
      const L = this.byId[H.lid]; if (!L || Math.hypot(this.P.x - L.x, this.P.z - L.z) > 1500) return;
      this._rw = (this._rw || 0) + 0.5; if (!this._tilesReady(L.x, L.z) && this._rw < 8) return;
      const p = this._pick(H); if (!p) { if (this._rw > 30) { this._rw = 0; toast('Не нашли подходящий дом рядом — подождите, ищем...'); } return; }
      this._rw = 0; H.bid = p.bid; H.bx = p.cx; H.bz = p.cz; H.door = this._doorstep(p); H.fl = Math.max(0, Math.min(H.fl, Math.max(0, p.n - 1)));
      this._bind(p); this.game.dirty = 1;
      if (this.travel) { const T = this.travel; this.travel = null; this._place(H.door.x, H.door.z, H.door.yaw); setTimeout(() => { this.fade.style.opacity = 0; }, 400); }
      return;
    }
    if (!this.plan) { for (const p of IM.plansNear(H.bx, H.bz, 200)) if (p.bid === H.bid) { this._bind(p); break; } }
    const pl = this.plan; if (pl && pl.failed) { (H.bad = H.bad || []).push(pl.bid); H.bid = null; H.spot = null; this._detach(); return; }
  }
  _bind(p) {
    const IM = this.world.interiors, wasActive = IM.active.has(p);
    p.home = { fl: this.H.fl }; p.locked = true; this.plan = p; if (wasActive) IM.dispose(p);   // re-activates next frame as the furnished home
    this._unlockT = 0; this._sign(p);
  }
  _detach() {
    const p = this.plan; this.plan = null;
    if (p) { p.home = null; p.locked = false; const IM = this.world.interiors; if (IM.active.has(p)) { IM.setLock(p, false); IM.dispose(p); } }
    if (this.signSprite) this.signSprite.visible = false;
  }
  _sign(p) {
    const H = this.H; if (!this.signSprite) { this.signSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); this.signSprite.scale.set(2.2, 0.55, 1); this.signSprite.renderOrder = 4; this.ctx.scene.add(this.signSprite); }
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(20,70,45,.92)'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(2, 2, 252, 60);
    g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`🏠 кв. ${H.unit} · эт. ${H.floor}`, 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; this.signSprite.material.map = t; this.signSprite.material.needsUpdate = true; const d = p.door;
    this.signSprite.position.set(d.mx + d.nx * 0.25, p.F0 + 2.75, d.mz + d.nz * 0.25); this.signSprite.visible = true;
  }
  inside() { const p = this.plan; return !!p && pip(p.ring, this.P.x, this.P.z) && this.P.y > p.F0 - 2.5; }
  update(P, dt) {
    this.t += dt;
    if (this.pinned) { const pn = this.pinned; pn.t += dt; if (pn.t > 12 || this.world.groundAt(P.x, P.z, P.y + 0.6) >= pn.y - 0.3) this.pinned = null; else if (P.y < pn.y) { P.y = pn.y; P.vy = 0; P.eye = P.y + 1.7; } }
    if (this.t < 0.5) return; this.t = 0;
    if (this.H) this.sync();
    this._attach();
    const p = this.plan, IM = this.world.interiors;
    if (p) {
      const d = p.door, dd = Math.hypot(d.mx - P.x, d.mz - P.z), I = IM.active.get(p);
      if (I && I.homeSpots && I.homeSpots.spawn && this.H && (!this.H.spot || Math.abs(this.H.spot.x - I.homeSpots.spawn.x) > 0.01)) { const s = I.homeSpots.spawn; this.H.spot = { x: +s.x.toFixed(2), z: +s.z.toFixed(2), y: +s.y.toFixed(2) }; this.game.dirty = 1; }
      if (!p.locked && dd > 9 && !this.inside()) IM.setLock(p, true);
      if (this.signSprite) this.signSprite.visible = dd < 90 && !this.inside();
    }
  }
  // ------------------------------------------------------------------ positions: travel / respawn / continue
  _place(x, z, yaw, y) {
    const P = this.P; this.ctx.teleport(x, z, yaw, 0);
    if (y !== undefined) { P.restoreY = P.wait ? y + 0.05 : undefined; P.y = y + 0.05; P.eye = P.y + 1.7; P.vy = 0; this.pinned = { y: y + 0.05, t: 0 }; }
  }
  respawnHome() { const H = this.H; if (!H) return false; if (H.spot) { this._place(H.spot.x, H.spot.z, this.P.yaw, H.spot.y); toast('🏠 Вы очнулись дома'); return true; } if (H.door) { this._place(H.door.x, H.door.z, H.door.yaw); return true; } return false; }
  applyLoadSpawn(s) {
    const H = this.H; if (!H || !H.spawnHome || s.job || s.drv) return false;
    if (H.spot) { this._place(H.spot.x, H.spot.z, this.P.yaw, H.spot.y); toast('🏠 Вы дома (старт у дома включён в 📱 → Жильё)', 3600); return true; }
    if (H.door) { this._place(H.door.x, H.door.z, H.door.yaw); return true; } return false;
  }
  afterLoad() { this._detach(); this._nb = null; this._hc = null; this.pinned = null; this.sel = { v: 'locs', loc: null, L: null }; this.render(); }
  _outside() { const p = this.plan; if (p && this.inside()) { const s = this._doorstep(p); this.ctx.teleport(s.x, s.z, s.yaw, 0); } }
  go(x, z, yaw, label) {   // «taxi»: fare by distance, black fade, teleport
    const fare = this.fareTo(x, z); if (this.game.S.money < fare) { toast(`Не хватает на такси: ${money(fare)}`); return; }
    this.game.pay(fare); this.game.phoneP.close(); this.fade.textContent = `🚕 ${label}…`; this.fade.style.opacity = 1;
    setTimeout(() => { this._place(x, z, yaw); const H = this.H; if (H && !H.bid) this.travel = { t: 0 }; else setTimeout(() => { this.fade.style.opacity = 0; }, 500); }, 700);
    setTimeout(() => { if (this.travel) { this.travel = null; } this.fade.style.opacity = 0; }, 14000);
  }
  // ------------------------------------------------------------------ home actions: providers, sleep, fridge
  hasKey() { return this.game.count('homekey') > 0; }
  provider(P, game) {
    const H = this.H, p = this.plan; if (!H || !p || game.dead) return null; const IM = this.world.interiors, I = IM.active.get(p); if (!I) return null;
    const d = p.door, dd = Math.hypot(d.mx - P.x, d.mz - P.z);
    if (p.locked && dd < 3 && Math.abs(P.y - I.F0) < 2.5) return this.hasKey() ? { label: `🔑 Открыть дверь (кв. ${H.unit})`, run: () => { IM.setLock(p, false); toast('🔓 Дверь открыта'); } } : { label: '🔒 Закрыто — нужен ключ (📱 → Жильё)', run: () => toast('Без ключа не войти. Дубликат — в 📱 → Жильё') };
    const S = I.homeSpots; if (!S || !I.inside) return null;
    if (S.bed && Math.hypot(S.bed.x - P.x, S.bed.z - P.z) < 2.4 && Math.abs(P.y - S.level * I.sh - I.F0) < 2.6) return { label: '🛏 Лечь спать / сохранить', run: () => this.openSleep() };
    if (S.fridge && Math.hypot(S.fridge.x - P.x, S.fridge.z - P.z) < 1.9 && Math.abs(P.y - S.level * I.sh - I.F0) < 2.6) return { label: '🧊 Холодильник', run: () => this.openFridge() };
    return null;
  }
  sleepBlock() {
    const g = this.game, c = this.ctx; if (g.dead) return 'Вы без сознания';
    if (c.jobs && c.jobs.sh) return 'Идёт рабочая смена — сначала закончите её'; if (c.crime && c.crime.heat > 0) return '★ Вас разыскивает полиция — не до сна'; if (c.crime && (c.crime.driving || c.crime.jail)) return 'Сейчас нельзя';
    if (c.taxi && c.taxi.st !== 'idle') return 'Сначала закончите поездку на такси'; if (c.transit && c.transit.busy) return 'Сначала выйдите из транспорта'; return null;
  }
  openSleep() {
    const p = this.sleepP, b = p.body, g = this.game, ck = this.clock; b.innerHTML = ''; const S = g.S, blk = this.sleepBlock();
    el('div', '', `<div style="margin:4px 0 10px"><b>${ck.text}</b> · ${ck.dateText} · ❤ ${Math.round(S.hp)} · 🍖 ${Math.round(S.food)} · 💧 ${Math.round(S.water)}</div>`, b);
    if (blk) el('div', '', `<p style="color:#ffb3a8">⚠ ${blk}</p>`, b);
    const to7 = ((7 * 3600 - ck.t) % 86400 + 86400) % 86400 / 3600;
    const opts = [[1, '😴 Вздремнуть 1 ч'], [4, '🌙 Поспать 4 ч'], [8, '🛌 Выспаться 8 ч']]; if (to7 >= 1 && to7 <= 14) opts.push([to7, `⏰ До 07:00 (${to7.toFixed(1)} ч)`]);
    for (const [h, t] of opts) { const r = el('div', 'row', '', b); el('div', 't', `<b>${t}</b><small>❤ +${Math.round(12 * h)} · еда/вода тратятся медленно</small>`, r); tap(el('span', 'btn' + (blk ? ' off' : ''), 'Спать', r), () => this.doSleep(h)); }
    el('div', '', '<p style="font-size:12px;opacity:.65;margin:6px 0">Время и платежи за аренду идут во время сна; транспорт и магазины подстраиваются под время.</p>', b);
    const sv = this.ctx.getSaves && this.ctx.getSaves();
    if (sv) tap(el('div', 'btn g', '💾 Сохранить игру (здесь — точка сохранения)', b), () => { toast(sv.save('manual') ? '💾 Игра сохранена' : 'Сейчас сохранить нельзя'); });
    else el('div', '', '<small style="opacity:.6">Сохранение доступно из главного меню (⏸)</small>', b);
    p.open();
  }
  doSleep(h) {
    if (this.sleeping || this.sleepBlock()) return; this.sleeping = true; this.sleepP.close(); this.fade.textContent = `💤 Сон… ${h >= 1.5 ? Math.round(h) + ' ч' : '1 ч'}`; this.fade.style.opacity = 1;
    setTimeout(() => {
      const g = this.game, S = g.S, ck = this.clock, c = this.ctx; ck.advance(Math.round(h * 3600));
      const real = h * 3600 / (ck.rate || 60); S.hp = Math.min(100, S.hp + 12 * h); S.food = Math.max(Math.min(S.food, 6), S.food - 0.012 * real * 0.6); S.water = Math.max(Math.min(S.water, 6), S.water - 0.02 * real * 0.6);
      const tr = c.transit; if (tr && tr.loaded && !tr.busy) { tr.cT = ck.t; tr.wk = ck.wk; tr.veh && tr.veh.clear(); tr.t1 = 9; }
      g.dirty = 1; g.refresh(); this.sync(); const sv = c.getSaves && c.getSaves(); if (sv) sv.save('auto');
      this.fade.textContent = `☀ Вы проспали ${h >= 1.5 ? Math.round(h) : 1} ч · ${ck.text} · ${ck.dateText}`;
      setTimeout(() => { this.fade.style.opacity = 0; this.sleeping = false; }, 900);
    }, 750);
  }
  openFridge() {
    const p = this.fridgeP, H = this.H, g = this.game; if (!H) return; const b = p.body; b.innerHTML = '';
    const total = () => H.stash.reduce((s, x) => s + x.n, 0);
    el('div', '', `<div style="margin:4px 0 8px"><b>Холодильник</b> · ${total()}/${STASH_MAX} · 🍖 ${Math.round(g.S.food)} · 💧 ${Math.round(g.S.water)}</div>`, b);
    if (!H.stash.length) el('div', '', '<p style="opacity:.7">Пусто. Положите сюда еду из рюкзака — она не пропадёт.</p>', b);
    for (const s of H.stash.slice()) { const it = ITEMS[s.id], r = el('div', 'row', '', b); el('div', 't', `<b>${it.icon} ${it.n} × ${s.n}</b><small>${[it.food ? '🍖 +' + it.food : '', it.water ? '💧 +' + it.water : ''].filter(Boolean).join('  ')}</small>`, r);
      tap(el('span', 'btn', 'Съесть', r), () => { g.S.food = Math.min(100, g.S.food + (it.food || 0)); g.S.water = Math.min(100, g.S.water + (it.water || 0)); s.n--; if (!s.n) H.stash.splice(H.stash.indexOf(s), 1); g.dirty = 1; g.refresh(); toast(`${it.icon} ${it.n}`); this.openFridge(); });
      tap(el('span', 'btn g', 'В рюкзак', r), () => { if (g.add(s.id, 1)) { s.n--; if (!s.n) H.stash.splice(H.stash.indexOf(s), 1); this.openFridge(); } else toast('Рюкзак полон'); }); }
    el('div', '', '<div style="margin:12px 0 4px;opacity:.75">Положить из рюкзака:</div>', b);
    for (const s of g.S.inv.slice()) { const it = ITEMS[s.id]; if (!(it.food || it.water) ) continue; const r = el('div', 'row', '', b); el('div', 't', `<b>${it.icon} ${it.n} × ${s.n}</b>`, r);
      tap(el('span', 'btn g' + (total() >= STASH_MAX ? ' off' : ''), 'Положить', r), () => { g.take(s.id, 1); const e = H.stash.find(x => x.id === s.id); if (e) e.n++; else H.stash.push({ id: s.id, n: 1 }); g.dirty = 1; this.openFridge(); }); }
    p.open();
  }
  // ------------------------------------------------------------------ phone app
  fillPhone(div) { this.div = div; this.render(); }
  tick() { /* map redraw only */ }
  render() {
    const d = this.div; if (!d) return; const keep = d.parentElement ? d.parentElement.scrollTop : 0; d.innerHTML = '';
    if (!this.loaded) { el('p', '', 'Загрузка объявлений…', d); return; }
    const S = this.game.S, H = this.H, sel = this.sel, row = (h) => el('div', 'row', h, d), btn = (parent, t, cls, fn) => tap(el('span', 'btn ' + cls, t, parent), fn);
    el('div', '', `<div style="margin:2px 0 6px;font-size:13px"><b>🏠 Жильё</b> · ₴ ${Math.floor(S.money)} · ${this.clock.dateText}${H ? '' : ' · договора нет'}</div>`, d);
    const nav = el('div', 'chips', '', d);
    tap(el('span', 'chip' + (sel.v === 'locs' || sel.v === 'loc' || sel.v === 'det' ? ' on' : ''), '🔍 Объявления', nav), () => { this.sel = { v: 'locs', loc: null, L: null }; this.render(); });
    if (H) tap(el('span', 'chip' + (sel.v === 'home' ? ' on' : ''), '🏠 Мой дом', nav), () => { this.sel = { v: 'home', loc: null, L: null }; this.render(); });
    if (sel.v === 'locs' || sel.v === 'loc') this._filters(d);
    if (sel.v === 'locs') this._locs(d);
    else if (sel.v === 'loc') this._loc(d, row, btn);
    else if (sel.v === 'det') this._det(d, row, btn);
    else if (sel.v === 'home' && H) this._home(d, row, btn);
    else this._locs(d);
    if (d.parentElement) d.parentElement.scrollTop = keep;
  }
  _filters(d) {
    const f = this.f, c1 = el('div', 'chips', '<span style="opacity:.7;align-self:center">Комнат:</span>', d);
    for (const [v, t] of [[0, 'любое'], [1, '1'], [2, '2'], [3, '3']]) tap(el('span', 'chip' + (f.rooms === v ? ' on' : ''), t, c1), () => { f.rooms = v; this.render(); });
    const c2 = el('div', 'chips', '<span style="opacity:.7;align-self:center">Цена до:</span>', d);
    for (const [v, t] of [[0, 'любая'], [12000, '12k'], [18000, '18k'], [25000, '25k'], [40000, '40k']]) tap(el('span', 'chip' + (f.max === v ? ' on' : ''), t, c2), () => { f.max = v; this.render(); });
    const sl = el('select', '', '<option value="">Все районы</option>' + Object.entries(this.data.districts).map(([k, v]) => `<option value="${k}"${f.dist === k ? ' selected' : ''}>${v.n}</option>`).join(''), d);
    sl.style.cssText = 'width:100%;padding:9px;border-radius:10px;background:rgba(255,255,255,.14);color:#fff;border:0;font-size:15px;margin:0 0 6px'; sl.addEventListener('change', () => { f.dist = sl.value; this.render(); });
  }
  _locs(d) {
    let n = 0; const list = this.data.locs.map(L => ({ L, m: this.locMatches(L) })).filter(x => x.m.length).sort((a, b) => a.m[0].price - b.m[0].price);
    el('div', '', `<div style="font-size:12px;opacity:.7;margin:2px 0 4px">Районов с подходящими объявлениями: ${list.length}. Нажмите точку на карте или строку.</div>`, d);
    for (const { L, m } of list) { n++; const r = el('div', 'row', `<div class="t"><b>${L.n}</b><small>${this.data.districts[L.d].n} · ${L.metro.length ? 'м. ' + L.metro.join(', ') : 'без метро'}</small></div><div style="text-align:right;font-size:13px">от <b>${money(this.priceOf(m[0]))}</b><br><small style="opacity:.7">${m.length} объявл.</small></div>`, d);
      tap(r, () => { this.sel = { v: 'loc', loc: L.id, L }; this.view.x = L.x; this.view.z = L.z; this.view.k = Math.max(this.view.k, 0.03); this.render(); }); }
    if (!n) el('p', '', 'Ничего не найдено — ослабьте фильтры.', d);
  }
  _loc(d, row, btn) {
    const L = this.sel.L; btn(el('div', '', '', d), '‹ К списку', 'g', () => { this.sel = { v: 'locs', loc: null, L: null }; this.render(); });
    el('div', '', `<div style="margin:8px 0 4px"><b style="font-size:17px">${L.n}</b><br><small style="opacity:.75">${this.data.districts[L.d].n} р-н · ${L.metro.length ? 'м. ' + L.metro.join(', ') : 'без метро'}<br>${L.tags.map(t => TAGRU[t] || t).join(' · ')}</small></div>`, d);
    const ls = this.listings(L).filter(l => this.matches(l)); if (!ls.length) el('p', '', 'Нет объявлений под фильтры.', d);
    for (const l of ls) { const b = (this.game.S.rentB || {})[l.id], r = el('div', 'row', `<div class="t"><b>${l.title} · ${l.area} м²</b><small>${l.floor}/${l.tot} эт. · коммун. ~${money(l.ulo)}–${money(l.uhi)}${b && b.pct ? ' · скидка ' + b.pct + '%' : ''}</small></div><div style="font-weight:700">${money(this.priceOf(l))}</div>`, d);
      tap(r, () => { this.sel = { v: 'det', loc: L.id, L, l }; this.render(); }); }
  }
  _det(d, row, btn) {
    const { L, l } = this.sel, H = this.H, S = this.game.S, T = this.terms(l), b = (S.rentB || {})[l.id], tot = T.deposit + T.fee, R = this.rules_;
    btn(el('div', '', '', d), '‹ ' + L.n, 'g', () => { this.sel = { v: 'loc', loc: L.id, L }; this.render(); });
    el('div', '', `<div style="margin:8px 0"><b style="font-size:18px">${l.title}</b><br><span style="opacity:.8">${L.n}, ${this.data.districts[L.d].n} р-н</span></div>`, d);
    row(`<div class="t"><b>${money(T.rent)} / мес${b && b.pct ? ` <span style="color:#7fe08f">−${b.pct}%</span>` : ''}</b><small>${l.rooms}-комн. · ${l.area} м² · ${l.floor}-й из ${l.tot} эт. · кв. ${l.unit}<br>Коммунальные: ${money(l.ulo)}–${money(l.uhi)} / мес (зимой дороже)<br>${l.tags.join(' · ')}</small></div>`);
    if (b === undefined) btn(el('div', '', '', d), '🤝 Торговаться', 'g', () => { const r = this.bargain(l); toast(r.pct ? `🤝 Хозяин уступил ${r.pct}%!` : '🙅 Хозяин не согласился снижать цену', 3200); this.render(); });
    else el('div', '', `<small style="opacity:.75">${b.pct ? '🤝 Торг удался: −' + b.pct + '%' : '🙅 Торг не удался (повторно нельзя)'}</small>`, d);
    el('div', '', `<div style="margin:10px 0;font-size:13px;line-height:1.5"><b>При подписании:</b> залог ${money(T.deposit)} (${R.deposit_months} мес.) + комиссия агентства ${money(T.fee)} (${R.agency_fee_share_of_month} мес.) = <b>${money(tot)}</b><br><b>Договор:</b> минимум ${R.min_rent_term_months} мес.; платёж ${R.payment_day}-го числа (аренда + коммунальные); просрочка — пени ${R.late_fee_share_per_day * 100}%/день, выселение через ${EVICT_DAYS} дн.; досрочно — залог не возвращается.<br>Первый платёж — 1-го числа следующего месяца (до этого проживание бесплатно).</div>`, d);
    const cant = H ? 'Уже есть договор (расторгните его)' : S.money < tot ? `Не хватает ${money(tot - S.money)}` : '';
    btn(el('div', '', '', d), '✍ Подписать договор · ' + money(tot), cant ? 'off' : '', () => this.sign(l)); if (cant) el('div', '', `<small style="color:#ffb3a8">${cant}</small>`, d);
    const r2 = el('div', 'chips', '', d); r2.style.marginTop = '8px';
    btn(r2, '📍 Метка', 'g', () => { this.ctx.pois.setTrack({ name: L.n, x: L.x, z: L.z, cat: { icon: '🏠' }, brand: 0x66e08a }); this.game.phoneP.close(); });
    btn(r2, `🚕 В район · ${money(this.fareTo(L.x, L.z))}`, 'g', () => this.go(L.x, L.z, undefined, 'Едем в ' + L.n));
  }
  _home(d, row, btn) {
    const H = this.H, ck = this.clock, n = this.nextBill(), end = new Date(H.endU), early = this.nowU() < H.endU, g = this.game, debt = this.debt();
    el('div', '', `<div style="margin:6px 0"><b style="font-size:18px">🏠 ${H.lname}, кв. ${H.unit}</b><br><small style="opacity:.8">${H.title} · ${H.area} м² · ${H.floor} эт.</small></div>`, d);
    row(`<div class="t"><b>Аренда ${money(H.rent)} / мес</b><small>Коммунальные сейчас ≈ ${money(this.utilFor(H, ck.date.m))} (диапазон ${money(H.ulo)}–${money(H.uhi)}, зимой выше)<br>Залог ${money(H.deposit)} · договор до ${end.getUTCDate()} ${MON[end.getUTCMonth()]} ${end.getUTCFullYear()}${early ? '' : ' (мин. срок прошёл)'}</small></div>`);
    row(`<div class="t"><b>Следующий платёж: ${n.d} ${MON[n.m]} (через ${n.in} дн.)</b><small>≈ ${money(n.amount)} · автоплатёж ${H.autopay ? 'вкл' : 'выкл'}${debt ? ' · <span style="color:#ff9d90">долг ' + money(debt) + '</span>' : ''}</small></div>`);
    for (const b of H.bills.filter(x => !x.paid)) { const r = row(`<div class="t"><b style="color:#ff9d90">Счёт ${b.label}: ${money(this.billTotal(b))}</b><small>аренда ${money(b.rent)} + комм. ${money(b.util)} + пени ${money(b.fee)} · просрочка ${Math.max(0, ck.day - b.day)} дн.</small></div>`); btn(r, 'Оплатить', g.S.money < this.billTotal(b) ? 'off' : '', () => this.payBill(b)); }
    const c1 = el('div', 'chips', '', d); c1.style.marginTop = '6px';
    btn(c1, H.autopay ? '💳 Автоплатёж: вкл' : '💳 Автоплатёж: выкл', 'g', () => { H.autopay = !H.autopay; g.dirty = 1; this.render(); });
    btn(c1, H.spawnHome ? '🏠 «Продолжить» у дома: вкл' : '🏠 «Продолжить» у дома: выкл', 'g', () => { H.spawnHome = !H.spawnHome; g.dirty = 1; this.render(); });
    const c2 = el('div', 'chips', '', d); const tgt = H.door || { x: H.bx, z: H.bz, yaw: undefined };
    btn(c2, `🚕 Домой · ${money(this.fareTo(tgt.x, tgt.z))}`, 'g', () => this.go(tgt.x, tgt.z, tgt.yaw, 'Едем домой'));
    btn(c2, '📍 Метка', 'g', () => { this.ctx.pois.setTrack({ name: `Дом: ${H.lname}, кв. ${H.unit}`, x: tgt.x, z: tgt.z, cat: { icon: '🏠' }, brand: 0x66e08a }); this.game.phoneP.close(); });
    if (!this.hasKey()) btn(c2, `🔑 Дубликат · ${money(KEY_COPY)}`, g.S.money < KEY_COPY ? 'off' : '', () => { if (g.S.money >= KEY_COPY && g.add('homekey', 1)) { g.pay(KEY_COPY); toast('🔑 Новый ключ получен'); this.render(); } else toast('Нет места в рюкзаке'); });
    el('div', '', `<div style="font-size:12px;opacity:.7;margin:8px 0">Дома: <b>E</b> у кровати — сон и сохранение; у холодильника — еда. Ключ нужен, чтобы открыть дверь.${H.bid ? '' : ' Дом будет подобран, когда вы приедете в район.'}</div>`, d);
    const t = el('div', 'btn r', this._confirmT ? '⚠ Нажмите ещё раз — расторгнуть договор' : '📄 Расторгнуть договор', d); t.style.marginTop = '8px';
    tap(t, () => { if (!this._confirmT) { this._confirmT = 1; this.render(); setTimeout(() => { this._confirmT = 0; if (this.sel.v === 'home') this.render(); }, 5000); toast(early ? `Досрочно: залог ${money(H.deposit)} не вернётся` : 'Залог вернётся за вычетом долгов', 4000); } else { this._confirmT = 0; this.terminate(); } });
    if (H.hist.length) el('div', '', `<div style="font-size:11px;opacity:.55;margin-top:10px">${H.hist.slice(-5).reverse().join('<br>')}</div>`, d);
  }
  // ------------------------------------------------------------------ map layer for the phone
  drawMarkers(g, W, Hh, cx, cz, k, big) {
    if (!this.loaded) return; const sx = x => W / 2 + (x - cx) * k, sy = z => Hh / 2 + (z - cz) * k; g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    this._hit = [];
    for (const L of this.data.locs) { const m = this.locMatches(L); if (!m.length) continue; const x = sx(L.x), y = sy(L.z); if (x < -20 || y < -20 || x > W + 20 || y > Hh + 20) continue;
      const on = this.sel.loc === L.id; g.fillStyle = on ? '#ffd966' : '#2d7ff9'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, on ? 11 : 8, 0, 7); g.fill(); g.stroke();
      g.fillStyle = on ? '#111' : '#fff'; g.font = 'bold 9px sans-serif'; g.fillText(Math.round(this.priceOf(m[0]) / 1000), x, y + 0.5);
      if (on || k > 0.02) { g.font = 'bold 11px sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(L.n, x, y + 17); g.fillStyle = '#fff'; g.fillText(L.n, x, y + 17); }
      this._hit.push([x, y, L]); }
    this.drawHome(g, W, Hh, cx, cz, k); g.restore();
  }
  drawHome(g, W, Hh, cx, cz, k) {
    const H = this.H; if (!H) return; const x = W / 2 + ((H.door ? H.door.x : H.bx) - cx) * k, y = Hh / 2 + ((H.door ? H.door.z : H.bz) - cz) * k; if (x < -20 || y < -20 || x > W + 20 || y > Hh + 20) return;
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2e9e4f'; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); g.stroke(); g.font = '14px sans-serif'; g.fillStyle = '#fff'; g.fillText('🏠', x, y + 1); g.restore();
  }
  mapTap(px, py) {
    if (!this._hit) return; let best = null, bd = 26; for (const [x, y, L] of this._hit) { const d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = L; } }
    if (best) { this.sel = { v: 'loc', loc: best.id, L: best }; this.render(); } else { this.view.x += (px - 160) / this.view.k; this.view.z += (py - 160) / this.view.k; }
  }
}
