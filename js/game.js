// Survival layer: health / hunger / thirst, money, inventory, smartphone, shops, jobs, interaction prompt. State in localStorage.
import * as THREE from 'three';
import { $, UI, el, tap, toast, panel } from './ui.js';
import { JOBDEFS, scheduleText, perMin, OFFPAY } from './jobs.js';
import { WD, hhmm } from './clock.js';
import { HOURS, isOpen } from './venues.js';
export { isOpen };

export const ITEMS = {
  homekey: { n: 'Ключ от квартиры', icon: '🔑', stack: 1, info: 'Без ключа дверь съёмной квартиры закрыта' },
  phone:   { n: 'Смартфон', icon: '📱', stack: 1, info: 'Карта с GPS, ближайшие места и работа' },
  burger:  { n: 'Бургер', icon: '🍔', food: 32 }, fries: { n: 'Картофель фри', icon: '🍟', food: 18 }, cola: { n: 'Кола', icon: '🥤', water: 30, en: 4 }, coffee: { n: 'Кофе', icon: '☕', water: 12, food: 3, en: 15 },
  borsch:  { n: 'Борщ', icon: '🍲', food: 28, water: 8 }, vareniki: { n: 'Вареники', icon: '🥟', food: 30 }, kompot: { n: 'Компот', icon: '🧃', water: 28 }, deruny: { n: 'Деруны', icon: '🥔', food: 22 },
  rolls:   { n: 'Роллы', icon: '🍣', food: 34 }, miso: { n: 'Мисо-суп', icon: '🍜', food: 15, water: 10 }, tea: { n: 'Зелёный чай', icon: '🍵', water: 25, en: 6 },
  bread:   { n: 'Хлеб', icon: '🍞', food: 18 }, sandwich: { n: 'Бутерброд', icon: '🥪', food: 22 }, water: { n: 'Вода', icon: '💧', water: 35 }, juice: { n: 'Сок', icon: '🧃', water: 28, food: 4 },
  choco:   { n: 'Шоколад', icon: '🍫', food: 12, hp: 2 }, apple: { n: 'Яблоко', icon: '🍎', food: 8, water: 6 }, medkit: { n: 'Аптечка', icon: '🩹', hp: 45 },
  painkill: { n: 'Обезболивающее', icon: '💊', hp: 15 }, vitamins: { n: 'Витамины', icon: '🍊', hp: 8, food: 2 }, bandage: { n: 'Бинт и пластырь', icon: '🧻', hp: 20 },
  latte:   { n: 'Латте', icon: '☕', water: 14, food: 6, en: 12 }, croissant: { n: 'Круассан', icon: '🥐', food: 16 },
  crowbar: { n: 'Монтировка', icon: '🔧', stack: 1, info: 'Инструмент' },
  broom:   { n: 'Метла', icon: '🧹', stack: 1, info: 'Рабочий инструмент дворника (сдаётся после смены)' },
  parcel:  { n: 'Заказ курьера', icon: '📦', stack: 1, info: 'Доставьте клиенту' },
  energy:  { n: 'Энергетик', icon: '🥫', water: 15, en: 25 },
  // street drugs (night dealers, js/dealers.js) — fictional game items; effects/risks in Dealers.use
  weed:    { n: 'Марихуана', icon: '🌿', drug: 1, info: 'Расслабляет: ❤ +6, ⚡ −10, аппетит; экран «плывёт». Хранение — штраф полиции' },
  coke:    { n: 'Кокаин', icon: '❄️', drug: 1, info: 'Резкий прилив сил: ⚡ +45, бег быстрее; потом «отходняк». Риск для здоровья; хранение — СИЗО' },
};
const SHOPS = {
  mcd:      ['burger', 'fries', 'cola', 'coffee'],
  puzata:   ['borsch', 'vareniki', 'deruny', 'kompot'],
  sushi:    ['rolls', 'miso', 'tea'],
  silpo:    ['bread', 'sandwich', 'water', 'juice', 'energy', 'choco', 'apple', 'medkit'],
  atb:      ['bread', 'sandwich', 'water', 'juice', 'energy', 'choco', 'apple', 'medkit'],
  epicentr: ['medkit', 'water', 'crowbar'],
  apteka:   ['medkit', 'painkill', 'vitamins', 'bandage', 'water'],
  kava:     ['coffee', 'latte', 'croissant', 'tea', 'water'],
};
// prices consistent with the wages (Kyiv 2026 medians): a meal 150-300 UAH, groceries 25-100, a first-aid kit ~280
const PRICE = { burger: 165, fries: 85, cola: 65, coffee: 75, borsch: 120, vareniki: 160, kompot: 45, deruny: 110, rolls: 290, miso: 150, tea: 90, bread: 32, sandwich: 85, water: 35, juice: 60, choco: 65, apple: 28, medkit: 280, crowbar: 650, painkill: 95, vitamins: 140, bandage: 55, latte: 85, croissant: 70, energy: 55 };
export const JOBS = JOBDEFS;   // hourly pay / weekly schedules from data/extra_spec.json (see js/jobs.js)
const SLOTS = 20, STACK = 10;

export class Game {
  constructor(ctx) {
    this.ctx = ctx; const { P, world, scene, pois } = ctx; this.P = P; this.world = world; this.pois = pois; this.scene = scene;
    this.decay = parseFloat(ctx.qs.get('decay') || '1'); this.providers = []; this.sitting = null; this.dead = false; this.shift = null; this.act = null; this.t = 0; this.dirty = 0; this.saveT = 0;
    this.S = this._load(); this.minVy = 0; this.lastPos = [P.x, P.z];
    this._ui(); this._pads(); this.addProvider(P => this._benchProvider(P)); this.addProvider(P => this._mailProvider(P)); this.refresh();
    addEventListener('keydown', e => {
      if (e.repeat) return;
      if (e.code === 'Escape') { for (const p of [this.invP, this.phoneP, this.shopP, this.jobP, pois.panel]) p.close(); return; }
      if (this.dead) return;
      if (e.code === 'KeyE') { this.holdE = true; this.doAction(); }
      if (e.code === 'KeyI') this.invP.toggle();
      if (e.code === 'KeyT') this.phoneP.toggle();
      if (e.code === 'KeyP') pois.panel.toggle();
    });
    addEventListener('keyup', e => { if (e.code === 'KeyE') this.holdE = false; }); addEventListener('blur', () => { this.holdE = false; });
    for (const [ev, v] of [['pointerdown', true], ['pointerup', false], ['pointercancel', false], ['pointerleave', false]]) this.bAct.addEventListener(ev, () => { this.holdE = v; });
  }
  _load() {
    const def = { hp: 100, food: 82, water: 82, en: 85, money: 300, inv: [{ id: 'phone', n: 1 }, { id: 'water', n: 1 }, { id: 'bread', n: 1 }], job: null, jobs: 0, home: null };
    return def;
  }
  _save() { this.dirty = 0; }   // persistence lives in save.js (slots)
  defaults() { return this._load(); }
  reset() { this.S = this._load(); this.refresh(); }
  // ---------------------------------------------------------------- items / money
  count(id) { let n = 0; for (const s of this.S.inv) if (s.id === id) n += s.n; return n; }
  add(id, n = 1) {
    const it = ITEMS[id], st = it.stack || STACK;
    for (const s of this.S.inv) if (s.id === id && s.n < st) { const k = Math.min(n, st - s.n); s.n += k; n -= k; if (!n) break; }
    while (n > 0) { if (this.S.inv.length >= SLOTS) { this.dirty = 1; return false; } const k = Math.min(n, st); this.S.inv.push({ id, n: k }); n -= k; }
    this.dirty = 1; this.refresh(); return true;
  }
  take(id, n = 1) { for (let i = this.S.inv.length - 1; i >= 0 && n > 0; i--) { const s = this.S.inv[i]; if (s.id !== id) continue; const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) this.S.inv.splice(i, 1); } this.dirty = 1; this.refresh(); }
  pay(m) { if (this.S.money < m) return false; this.S.money -= m; this.dirty = 1; this.refresh(); return true; }
  earn(m) { this.S.money += m; this.dirty = 1; this.refresh(); }
  use(id) {
    const it = ITEMS[id]; if (!it || !this.count(id)) return;
    if (id === 'phone') { this.invP.close(); this.phoneP.open(); return; }
    if (it.drug) { if (this.dealers) this.dealers.use(id); return; }
    if (it.food === undefined && it.water === undefined && it.hp === undefined && it.en === undefined) { toast(it.info || 'Нельзя использовать'); return; }
    const S = this.S; S.food = Math.min(100, S.food + (it.food || 0)); S.water = Math.min(100, S.water + (it.water || 0)); S.hp = Math.min(100, S.hp + (it.hp || 0)); S.en = Math.min(100, (S.en ?? 85) + (it.en || 0));
    this.take(id, 1); toast(`${it.icon} ${it.n}`); this.dirty = 1;
  }
  hurt(d, why) { if (this.dead || d <= 0) return; this.S.hp = Math.max(0, this.S.hp - d); this.dirty = 1; this.flash = 0.35; if (this.S.hp <= 0) this.die(why); }
  die(why) {
    this.dead = true; if (this.jobs && this.jobs.sh) this.jobs.end('abort'); const S = this.S; const lost = Math.floor(S.money * 0.3); S.money -= lost; this.dirty = 1;
    this.deadP.body.innerHTML = `<p style="font-size:17px">${why || 'Вы потеряли сознание'}.<br>Вас нашли и отвезли на вокзал. Потеряно ₴${lost}.</p>`;
    const b = el('div', 'btn', 'Очнуться', this.deadP.body); tap(b, () => { this.deadP.close(); this.respawn(); }); this.deadP.open();
  }
  respawn() { const S = this.S; S.hp = 50; S.food = Math.max(S.food, 45); S.water = Math.max(S.water, 45); this.dead = false; const s = this.ctx.START; if (!(this.rent && this.rent.respawnHome())) this.ctx.teleport(s.x, s.z, THREE.MathUtils.degToRad(s.yaw), 0); this.dirty = 1; this.refresh(); this.onRespawn && this.onRespawn(); }
  // ---------------------------------------------------------------- UI
  _ui() {
    const { IS_TOUCH } = this.ctx; this.sv = el('div', 'svhud', '', document.body);
    this.sv.style.cssText = (IS_TOUCH ? 'font-size:11px;' : '') + 'position:fixed;left:50%;transform:translateX(-50%);top:calc(8px + env(safe-area-inset-top));z-index:6;display:flex;gap:8px;align-items:center;padding:3px 9px;background:rgba(12,18,26,.62);border-radius:12px;color:#fff;font:600 12px -apple-system,system-ui,sans-serif;pointer-events:none;font-variant-numeric:tabular-nums';
    const bar = (ic, c) => { const w = el('span', '', `<span>${ic}</span><span style="display:inline-block;width:${IS_TOUCH ? 24 : 46}px;height:7px;background:rgba(255,255,255,.2);border-radius:4px;overflow:hidden;vertical-align:middle;margin-left:3px"><i style="display:block;height:100%;width:100%;background:${c}"></i></span>`, this.sv); return w.querySelector('i'); };
    this.bHp = bar('❤', '#e74c3c'); this.bFood = bar('🍖', '#e6a23c'); this.bWater = bar('💧', '#3fa7f0'); this.bEn = bar('⚡', '#f1d23c'); this.moneyEl = el('span', '', '', this.sv); this.clockEl = el('span', '', '', this.sv); this.clockEl.style.cssText = 'opacity:.85;font-size:11px';
    if (IS_TOUCH) {   // iPhone: two compact rows (bars / money + clock) so the HUD never wraps into a tall column next to the minimap
      Object.assign(this.sv.style, { display: 'grid', gridTemplateColumns: 'repeat(4, auto)', columnGap: '7px', rowGap: '1px', padding: '3px 8px', whiteSpace: 'nowrap', justifyItems: 'center' });
      for (const e of this.sv.children) e.style.whiteSpace = 'nowrap';
      this.moneyEl.style.gridColumn = '1 / 2'; this.clockEl.style.gridColumn = '2 / 5'; this.clockEl.style.justifySelf = 'end';
    } this.rentEl = el('div', '', '', document.body); this.rentEl.className = 'hl'; this.rentEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(' + (IS_TOUCH ? 122 : 38) + 'px + env(safe-area-inset-top));z-index:6;display:none;padding:2px 9px;border-radius:10px;font:600 ' + (IS_TOUCH ? 10 : 12) + 'px system-ui;color:#fff;white-space:nowrap;pointer-events:none;background:rgba(255,200,80,.3)';
    this.flashEl = el('div', '', '', document.body); this.flashEl.style.cssText = 'position:fixed;inset:0;z-index:5;pointer-events:none;background:radial-gradient(transparent 40%,rgba(200,0,0,.55));opacity:0;transition:opacity .25s';
    this.actEl = el('div', '', '', document.body); this.actEl.className = 'hl'; this.actEl.style.cssText = IS_TOUCH ? 'position:fixed;top:calc(53px + env(safe-area-inset-top));z-index:6;display:none;background:rgba(255,217,102,.7);color:#111;font:700 11px system-ui;padding:2px 8px;border-radius:10px;white-space:nowrap;pointer-events:none' : 'position:fixed;left:50%;transform:translateX(-50%);top:calc(52px + env(safe-area-inset-top));z-index:6;display:none;background:rgba(255,217,102,.72);color:#111;font:700 13px system-ui;padding:4px 12px;border-radius:14px;white-space:nowrap;pointer-events:none';
    // buttons
    const mkBtn = (txt, right, fn, extra = '') => { const b = el('div', 'gbtn', txt, document.body); b.style.cssText = `right:calc(${right}px + env(safe-area-inset-right));top:calc(8px + env(safe-area-inset-top));--slot:${Math.round((right - 134) / 52)};${extra}`; b.classList.add('slot'); b.style.display = IS_TOUCH ? 'flex' : 'none'; tap(b, fn); return b; };
    this.bInv = mkBtn('🎒', 134, () => this.invP.toggle()); this.bPhone = mkBtn('📱', 186, () => this.phoneP.toggle());
    this.bPause = mkBtn('⏸', 238, () => this.ctx.openPause && this.ctx.openPause());
    this.bAct = el('div', 'gbtn', 'E', document.body); this.bAct.style.cssText = 'right:calc(24px + env(safe-area-inset-right));bottom:calc(226px + env(safe-area-inset-bottom));width:44px;height:44px;font-size:17px;font-weight:700;background:rgba(255,217,102,.6);border-color:rgba(255,255,255,.5);color:#111;display:none';
    tap(this.bAct, () => this.doAction());
    // panels
    this.invP = panel('invP', 'Рюкзак'); this.invP.onOpen = () => this._drawInv(); this.invSel = -1;
    this.phoneP = panel('phoneP', 'Смартфон'); this._phone();
    this.shopP = panel('shopP', 'Магазин'); this.jobP = panel('jobP', 'Работа'); this.deadP = panel('deadP', 'Без сознания'); this.deadP.root.querySelector('.x').style.display = 'none';
  }
  refresh() {
    const S = this.S; if (S.en === undefined) S.en = 85; this.bHp.style.width = S.hp + '%'; this.bFood.style.width = S.food + '%'; this.bWater.style.width = S.water + '%'; this.bEn.style.width = S.en + '%';
    this.moneyEl.textContent = '₴' + Math.floor(S.money); if (this.clockEl) { this.clockEl.textContent = (this.ctx.IS_TOUCH ? '' : '🕒 ') + this.ctx.clock.text + ' · ' + this.ctx.clock.dateText; const h = this.rent && this.rent.hud(); this.rentEl.style.display = h ? '' : 'none'; if (h) { this.rentEl.textContent = h.text; this.rentEl.style.background = h.warn ? 'rgba(231,76,60,.55)' : 'rgba(255,200,80,.25)'; } } if (this.invP && this.invP.isOpen) this._drawInv();
  }
  _drawInv() {
    const b = this.invP.body, S = this.S; b.innerHTML = '';
    el('div', '', `<b>₴ ${Math.floor(S.money)}</b> · ❤ ${Math.round(S.hp)} · 🍖 ${Math.round(S.food)} · 💧 ${Math.round(S.water)} · ⚡ ${Math.round(S.en ?? 85)} · слотов ${S.inv.length}/${SLOTS}` + (S.job ? `<br>Работа: ${JOBS[S.job.key].title} (${S.job.name})` : '<br>Безработный'), b).style.margin = '4px 0 10px';
    const g = el('div', 'grid', '', b);
    for (let i = 0; i < SLOTS; i++) { const s = S.inv[i], c = el('div', 'cell' + (this.invSel === i ? ' sel' : ''), s ? `${ITEMS[s.id].icon}<small>${ITEMS[s.id].n}</small>${s.n > 1 ? `<i>${s.n}</i>` : ''}` : '', g); if (s) tap(c, () => { this.invSel = this.invSel === i ? -1 : i; this._drawInv(); }); }
    const s = S.inv[this.invSel];
    if (s) { const it = ITEMS[s.id], r = el('div', 'row', '', b); r.style.marginTop = '10px'; el('div', 't', `<b>${it.icon} ${it.n}</b><small>${[it.food ? '🍖 +' + it.food : '', it.water ? '💧 +' + it.water : '', it.hp ? '❤ +' + it.hp : '', it.en ? '⚡ +' + it.en : '', it.info || ''].filter(Boolean).join('  ')}</small>`, r);
      tap(el('span', 'btn', s.id === 'phone' ? 'Открыть' : 'Исп.', r), () => { this.use(s.id); if (!this.count(s.id)) this.invSel = -1; this._drawInv(); });
      if (s.id !== 'phone') tap(el('span', 'btn g', 'Выбр.', r), () => { this.take(s.id, 1); if (!this.count(s.id)) this.invSel = -1; this._drawInv(); }); }
  }
  // ---------------------------------------------------------------- smartphone
  _phone() {
    const p = this.phoneP, b = p.body, { P, ctx } = this; this.pk = 0.35;
    const tabs = el('div', 'chips', '', b), cv = document.createElement('canvas'); cv.width = 320; cv.height = 320; cv.style.cssText = 'width:min(100%,62vh);aspect-ratio:1;border-radius:12px;display:block;margin:6px 0;background:#222';
    // CPU-backed 2D context: a GPU-accelerated canvas inside the full-screen panel stalls the compositor for 15-20 s per update under software GL (headless tests) and gains nothing on a 320 px map
    const cg = cv.getContext('2d', { willReadFrequently: true });
    const info = el('div', '', '', b); this.pTab = 'map';
    const nearby = el('div', '', '', b), bal = el('div', '', '', b); b.insertBefore(cv, info);
    const zoomRow = el('div', 'chips', '', b); b.insertBefore(zoomRow, info);
    tap(el('span', 'chip', '＋', zoomRow), () => { if (this.pTab === 'rent' && this.rent) this.rent.view.k = Math.min(1.6, this.rent.view.k * 1.6); else this.pk = Math.min(1.6, this.pk * 1.6); }); tap(el('span', 'chip', '－', zoomRow), () => { if (this.pTab === 'rent' && this.rent) this.rent.view.k = Math.max(0.004, this.rent.view.k / 1.6); else this.pk = Math.max(0.03, this.pk / 1.6); });
    const sh = () => { cv.style.display = zoomRow.style.display = this.pTab === 'map' || this.pTab === 'taxi' || this.pTab === 'rent' ? '' : 'none'; nearby.style.display = this.pTab === 'near' || this.pTab === 'bus' || this.pTab === 'taxi' || this.pTab === 'rent' ? '' : 'none'; bal.style.display = this.pTab === 'bal' ? '' : 'none';
      tabs.innerHTML = ''; [['map', '🗺 GPS'], ['near', '📍 Рядом'], ...(this.transit && this.transit.loaded ? [['bus', '🚏 Транспорт']] : []), ...(this.taxi ? [['taxi', '🚕 Такси']] : []), ...(this.rent ? [['rent', '🏠 Жильё']] : []), ['bal', '💳 Баланс']].forEach(([k, t]) => tap(el('span', 'chip' + (this.pTab === k ? ' on' : ''), t, tabs), () => { this.pTab = k; sh(); fill(); })); };
    const fill = () => {
      if (this.pTab === 'bus') this.transit.fillPhone(nearby);
      else if (this.pTab === 'taxi') this.taxi.fillPhone(nearby);
      else if (this.pTab === 'rent') this.rent.fillPhone(nearby);
      else if (this.pTab === 'near') {
        nearby.innerHTML = ''; for (const grp of ['shop', 'food', 'job']) for (const { poi, dist } of this.pois.nearest(P.x, P.z, q => q.group === grp, 4)) {
          const r = el('div', 'row', '', nearby); el('div', 't', `<b>${poi.cat.icon} ${poi.name}</b><small>${dist < 1000 ? dist.toFixed(0) + ' м' : (dist / 1000).toFixed(1) + ' км'}</small>`, r);
          tap(el('span', 'btn g', this.pois.track === poi ? 'снять' : 'метка', r), () => { this.pois.setTrack(this.pois.track === poi ? null : poi); fill(); }); }
      } else if (this.pTab === 'bal') {
        const S = this.S; bal.innerHTML = `<div class="row"><div class="t"><b>Баланс: ₴ ${Math.floor(S.money)}</b><small>${S.job ? 'Работа: ' + JOBS[S.job.key].title + ' · ₴' + perMin(JOBS[S.job.key]) + '/мин · ' + scheduleText(JOBS[S.job.key]) + ' · смен: ' + (S.jobs || 0) : 'Безработный — найдите вкладку «Работа» в Местах'}</small></div></div><div style="font-size:11px;opacity:.6;margin-top:8px">Игровые значения на основе медиан по Киеву (Work.ua, Київпастранс, живой расчёт таксиста, 10.2026). Время — реальное киевское (1:1); оплата за каждую минуту активной работы.</div>`;
      }
    };
    sh();
    const draw = () => {
      if (!p.isOpen) return; const g = cg, RV = this.pTab === 'rent' && this.rent ? this.rent.view : null, cx = RV ? RV.x : P.x, cz = RV ? RV.z : P.z, kk = RV ? RV.k : this.pk; ctx.paintMap(g, 320, 320, cx, cz, kk, true);
      if (RV) this.rent.drawMarkers(g, 320, 320, cx, cz, kk, true); else { this.pois.drawMarkers(g, 320, 320, cx, cz, kk, true); this.transit && this.transit.drawMarkers(g, 320, 320, cx, cz, kk, true); this.taxi && this.taxi.drawMarkers(g, 320, 320, cx, cz, kk, true); this.rent && this.rent.drawHome(g, 320, 320, cx, cz, kk); }
      g.save(); g.translate(160 + (P.x - cx) * kk, 160 + (P.z - cz) * kk); g.rotate(-P.yaw); g.fillStyle = '#2d7ff9'; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke(); g.restore();
      g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.fillText('С ↑', 6, 14); g.fillText(`${(1 / kk * 40).toFixed(0)} м ▭`, 6, 312);
      if (this.pTab === 'near' || this.pTab === 'bal' || this.pTab === 'bus' || this.pTab === 'taxi') fill();
      else if (this.pTab === 'rent') this.rent.tick();
    };
    tap(cv, ev => { if (this.pTab === 'rent' && this.rent) { const t = ev.changedTouches ? ev.changedTouches[0] : ev, r = cv.getBoundingClientRect(); this.rent.mapTap((t.clientX - r.left) / r.width * 320, (t.clientY - r.top) / r.height * 320); return; } if (this.pTab !== 'taxi' || !this.taxi) return; const t = ev.changedTouches ? ev.changedTouches[0] : ev, r = cv.getBoundingClientRect(); const px = (t.clientX - r.left) / r.width * 320, py = (t.clientY - r.top) / r.height * 320; this.taxi.mapTap(P.x + (px - 160) / this.pk, P.z + (py - 160) / this.pk); draw(); });
    p.onOpen = () => { sh(); fill(); this._ph = setInterval(draw, 400); draw(); }; p.onClose = () => clearInterval(this._ph);
  }
  // ---------------------------------------------------------------- service pads inside shops / job offices
  _pads() {
    this.pads = []; const mats = {};
    for (let i = 0; i < 3; i++) {
      const g = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16, 1, true); g.translate(0, 0.6, 0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffd966, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.visible = false; m.renderOrder = 3;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); sp.scale.set(0.8, 0.8, 1); sp.position.y = 1.7; m.add(sp); this.scene.add(m); this.pads.push(m);
    }
    this.iconTex = {};
    this.getIcon = (ic) => this.iconTex[ic] || (this.iconTex[ic] = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.font = '96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ic, 64, 70); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })());
  }
  // ---------------------------------------------------------------- actions
  addProvider(fn) { this.providers.push(fn); }
  _mailTips = [
    'Київпастранс: трамваї йдуть за реальним розкладом GTFS — дивіться вкладку 🚏.',
    'Вночі (22:00–05:00) на карті з’являються 🧥 — це ігровий кримінал, не реальність.',
    'Оренда: першого числа списується квартплата; можна увімкнути автооплату в 🏠 Жильє.',
    'На скамейці можна відпочити (E) — ⚡ відновлюється.',
    'Реальний час Києва 1:1: якщо згорнули гру надовго — годинник наздожене.',
    'У закладах є вакансії: McDonald’s, Сільпо, кав’ярні… дивіться 💼 у панелі магазину.',
    'Мітки на карті: голод/спрага самі ведуть до найближчого кафе, якщо немає іншої мітки.',
    'Потрібна економія батареї: у фоні вкладки симуляція зупиняється.',
  ];
  _mailProvider(P) {
    if (this.sitting || (this.crime && (this.crime.driving || this.crime.jail))) return null;
    const m = this.world.nearestMailbox(P.x, P.z, 1.9); if (!m) return null;
    return { label: '📬 Почтовый ящик', run: () => this.readMail(m) };
  }
  readMail(m) {
    const tips = this._mailTips, i = Math.floor(Math.random() * tips.length);
    toast('📬 Листовка: ' + tips[i], 5200); this.dirty = 1;
  }
  // sit on a street bench: rest (⚡ recovers), E / stick to stand up
  _benchProvider(P) {
    if (this.sitting || this.crime && (this.crime.driving || this.crime.jail) || this.transit && this.transit.busy) return null;
    const b = this.world.nearestBench(P.x, P.z, 2.1); if (!b) return null;
    return { label: '🪑 Сесть', run: () => this.sit(b) };
  }
  sit(b) {
    if (this.sitting) return; const P = this.P;
    P.x = b.x + Math.sin(b.yaw) * 0.15; P.z = b.z + Math.cos(b.yaw) * 0.15; P.vx = P.vz = P.vy = 0;
    P.y = (b.y !== undefined ? b.y : this.world.heightAt(P.x, P.z)) + 0.42; P.eye = P.y + 1.15; P.yaw = b.yaw + Math.PI; P.pitch = -0.08;
    this.sitting = { b, t0: this.t }; toast('🪑 Отдыхаете на скамейке — ⚡ восстанавливается. E — встать', 3200);
  }
  stand() {
    if (!this.sitting) return; const P = this.P; this.sitting = null;
    P.y = this.world.heightAt(P.x, P.z) + 0.05; P.eye = P.y + 1.7; P.pitch = 0; toast('Встали');
  }
  _poiAction() {
    const { P, world } = this; let best = null, bd = 2.6; let used = 0;
    for (const [pl, I] of world.interiors.active) {
      const poi = pl.poi; if (!poi || !I.sp || !I.inside || used >= 3) continue;
      const pad = this.pads[used++]; pad.visible = true; pad.position.set(I.sp[0], I.F0 + 0.02, I.sp[1]); pad.material.color.setHex(poi.cat.svc === 'job' ? 0x4ad07a : poi.cat.svc === 'sizo' ? 0xaaaaaa : 0xffd966);
      const sp = pad.children[0]; sp.material.map = this.getIcon(poi.cat.icon); sp.material.needsUpdate = true;
      const d = Math.hypot(I.sp[0] - P.x, I.sp[1] - P.z); if (d < bd && Math.abs(P.y - I.F0) < 2.5) { bd = d; best = poi; }
    }
    for (let i = used; i < 3; i++) this.pads[i].visible = false;
    if (!best) return null;
    if (best.cat.svc === 'shop') return { label: `Купить — ${best.name}`, run: () => this.openShop(best) };
    if (best.cat.svc === 'job') return { label: `${JOBS[best.key].title} — ${best.name}`, run: () => this.openJob(best) };
    return null;
  }
  doAction() { if (UI.modal) return; if (this.sitting) { this.stand(); return; } if (this.act) this.act.run(); }
  openShop(poi) {
    if (!isOpen(poi.key, this.ctx.clock.hour)) { const o = HOURS[poi.key]; this.shopP.titleEl.textContent = `${poi.cat.icon} ${poi.name}`; this.shopP.body.innerHTML = `<p style="font-size:16px">🔒 Закрыто. Работает ${hhmm(o[0] * 60)}–${hhmm(o[1] * 60)}. Сейчас ${this.ctx.clock.text}.</p>`;
      { const h = this.ctx.clock.hour, P = this.P, alt = this.pois && this.pois.nearest(P.x, P.z, q => q !== poi && q.group === poi.group && isOpen(q.key, h), 1)[0];   // closed → offer the nearest open place of the same kind
        if (alt) { const r = el('div', 'row', `<div class="t"><b>Открыто сейчас: ${alt.poi.cat.icon} ${alt.poi.name}</b><small>${alt.dist < 1000 ? Math.round(alt.dist) + ' м' : (alt.dist / 1000).toFixed(1).replace('.', ',') + ' км'}</small></div>`, this.shopP.body);
          tap(el('span', 'btn g', 'метка', r), () => { this.pois.setTrack(alt.poi, true); this.shopP.close(); toast(`📍 ${alt.poi.name}`); }); } }
      this._vacancies(poi, this.shopP.body, this.shopP); this.shopP.open(); return; }
    const p = this.shopP; p.titleEl.textContent = `${poi.cat.icon} ${poi.name}`; const b = p.body; const draw = () => {
      b.innerHTML = `<div style="margin:4px 0 8px"><b>₴ ${Math.floor(this.S.money)}</b> · 🍖 ${Math.round(this.S.food)} · 💧 ${Math.round(this.S.water)}</div>`;
      for (const id of SHOPS[poi.key] || []) { const it = ITEMS[id], r = el('div', 'row', '', b); el('div', 't', `<b>${it.icon} ${it.n}</b><small>${[it.food ? '🍖 +' + it.food : '', it.water ? '💧 +' + it.water : '', it.hp ? '❤ +' + it.hp : '', it.info || ''].filter(Boolean).join('  ')}</small>`, r);
        tap(el('span', 'btn' + (this.S.money < PRICE[id] ? ' off' : ''), '₴' + PRICE[id], r), () => { if (this.S.inv.length >= SLOTS && !this.S.inv.some(s => s.id === id && s.n < (it.stack || STACK))) { toast('Рюкзак полон'); return; } if (this.pay(PRICE[id])) { this.add(id, 1); toast(`${it.icon} ${it.n} — куплено`); draw(); } });
        tap(el('span', 'btn g' + (this.S.money < PRICE[id] ? ' off' : ''), (it.hp && !it.food && !it.water ? 'применить' : 'съесть'), r), () => { if (this.pay(PRICE[id])) { this.add(id, 1); this.use(id); draw(); } }); }
      this._vacancies(poi, b, p);
      if (this.crime) { const st = el('div', 'btn r', '🕶 Украсть товар (рискованно)', b); st.style.marginTop = '10px'; tap(st, () => { p.close(); this.crime.steal(poi, SHOPS[poi.key] || []); }); }
    }; draw(); p.open();
  }
  // vacancies of a chain (McDonald's, Сільпо, АТБ, ...): listed in its shop panel; a job of the chain is worked in any of its branches
  _vacancies(poi, b, panel) {
    const list = Object.entries(JOBS).filter(([k, J]) => J.venue === poi.key); if (!list.length) return;
    el('div', '', '<div style="margin:12px 0 4px;font-weight:700">💼 Вакансии</div>', b);
    for (const [k, J] of list) { const mine = this.S.job && this.S.job.key === k, r = el('div', 'row', '', b);
      el('div', 't', `<b>${J.icon} ${J.title}</b><small>₴${perMin(J)}/мин · ${scheduleText(J)}${mine ? ' · <b style="color:#7fe08a">ваша работа</b>' : ''}</small>`, r);
      tap(el('span', 'btn', mine ? 'Смена' : 'Подробнее', r), () => { panel.close(); this.openJob(poi, k); }); }
  }
  openJob(poi, key = poi.key) {
    const p = this.jobP, J = JOBS[key], S = this.S, jobs = this.jobs, ck = this.ctx.clock; if (!J) return; p.titleEl.textContent = `${J.icon || poi.cat.icon} ${J.title} — ${poi.name}`; const b = p.body; b.innerHTML = '';
    el('div', 'row', `<div class="t"><b>${J.title} · ₴${perMin(J)}/мин</b><small>${J.desc}<br>💵 ставка Киева ₴${J.hourly}/ч → в игре ₴${perMin(J)} за каждую минуту активной работы (можно короткую смену)<br>🕒 смена: ${scheduleText(J)} (вне графика — ${Math.round(OFFPAY * 100)}%)<br>☕ перерыв ${Math.max(3, Math.round(J.brk / 6))} мин (не оплачивается)${J.ot ? ' · сверхурочные ₴' + Math.round(J.ot / 2) + '/мин' : ''}<br>Сейчас: ${ck.text}${poi.real ? '' : ' · игровая точка'}</small></div>`, b);
    const mine = S.job && S.job.key === key, inShift = jobs && jobs.sh;
    if (!S.job) tap(el('div', 'btn', 'Устроиться', b), () => { S.job = { key, name: poi.name, pk: poi.key }; this.dirty = 1; toast('Вы приняты: ' + J.title); this.openJob(poi, key); });
    else if (mine) {
      const st = jobs ? jobs.status(J) : { ok: true };
      el('div', '', `<p style="margin:8px 0;font-size:13px;opacity:.9">${inShift ? 'Смена уже идёт.' : st.ok ? '✅ Сегодня рабочий день, смена в графике — оплата за активную работу.' : '⚠ ' + st.msg}<br>Оплата = ₴/мин × минуты <b>активной работы</b> (простой и обед не оплачиваются) + бонус за качество.</p>`, b);
      tap(el('div', 'btn' + (inShift ? ' off' : ''), inShift ? 'Смена уже идёт' : st.ok ? 'Начать смену' : 'Начать смену (подработка ' + Math.round(OFFPAY * 100) + '%)', b), () => { if (jobs.sh) return; p.close(); jobs.begin(poi, key); });
      const q = el('div', 'btn r', 'Уволиться', b); q.style.marginTop = '8px'; tap(q, () => { if (jobs && jobs.sh) jobs.end('quit'); S.job = null; this.dirty = 1; this.openJob(poi, key); });
    } else { el('div', '', `<p>Вы уже работаете: ${JOBS[S.job.key].title}. Чтобы сменить работу, сначала увольтесь.</p>`, b); const q = el('div', 'btn r', 'Уволиться', b); tap(q, () => { S.job = null; this.dirty = 1; this.openJob(poi, key); }); }
    el('div', '', '<p style="font-size:11px;opacity:.6;margin-top:10px">Игровые значения на основе медиан по Киеву (Work.ua, Київпастранс, 10.2026). Время в игре — реальное киевское (1:1). Смена оплачивается поминутно — можно поработать 5 минут.</p>', b);
    p.open();
  }
  // soft beacon to the nearest open shop/food when a need tip fires (does not override an existing player mark)
  _needMark(group) {
    if (!this.pois || this.pois.track) return null; const h = this.ctx.clock.hour, P = this.P;
    // food tip → food group; thirst → cafés/markets (not hardware / pharmacy)
    const pred = group === 'shop'
      ? p => (p.group === 'food' || (p.group === 'shop' && p.key !== 'epicentr' && p.key !== 'apteka')) && isOpen(p.key, h)
      : p => p.group === group && isOpen(p.key, h);
    const hit = this.pois.nearest(P.x, P.z, pred, 1)[0]; if (!hit) return null;
    this.pois.setTrack(hit.poi, true); return hit.poi;
  }
  // ---------------------------------------------------------------- per-frame
  update(P, dt) {
    if (UI.modal && !this.dead) return;
    const S = this.S; this.t += dt;
    if (this.flash > 0) { this.flash -= dt; this.flashEl.style.opacity = Math.max(0, this.flash / 0.35); }
    if (this.dead) return;
    // jump detection: teleports reset the fall tracker
    if (Math.hypot(P.x - this.lastPos[0], P.z - this.lastPos[1]) > 25) this.minVy = 0; this.lastPos = [P.x, P.z];
    if (!P.grounded && !P.fly && !P.inWater) this.minVy = Math.min(this.minVy, P.vy);
    else { if (this.minVy < -13 && P.grounded && !P.fly && !P.inWater) this.hurt((this.minVy * this.minVy - 169) * 0.35, 'Тяжёлое падение'); this.minVy = 0; }
    // decay
    // real-time rates (the clock is 1:1): resting 100->0 food in ~5.5 h / water ~4 h; walking/running/working ~1 h / ~50 min; energy (sleep) ~17 h awake, ~8 h active
    const sp = Math.hypot(P.vx, P.vz), mv = Math.min(1, sp / 3), run = sp > 5.2 ? 1.5 : 1, work = this.jobs && this.jobs.sh ? 1.3 : 1, d = this.decay * dt;
    S.food = Math.max(0, S.food - d * (0.005 + 0.02 * mv * run) * work); S.water = Math.max(0, S.water - d * (0.007 + 0.026 * mv * run) * work);
    if (S.en === undefined) S.en = 85; S.en = Math.max(0, S.en - d * (0.0016 + 0.0018 * mv * run) * work);
    P.tired = S.en < 12 ? 0.72 : undefined; if (S.en < 12 && !this._le) { this._le = 1; toast('⚡ Вы вымотались: бег медленнее. Поспите дома, выпейте кофе или энергетик'); } if (S.en > 20) this._le = 0;
    if (S.food <= 0 || S.water <= 0) { this.hurt(d * ((S.food <= 0) + (S.water <= 0)) * 0.6); if (!this._warn || this.t - this._warn > 20) { this._warn = this.t; toast(S.water <= 0 ? '💧 Вы хотите пить!' : '🍖 Вы голодны!'); } }
    else if (S.hp < 100 && S.food > 40 && S.water > 40) S.hp = Math.min(100, S.hp + d * 0.4);
    if (S.food < 20 && !this._lf) { this._lf = 1; const n = this._needMark('food'); toast(n ? `🍖 Голод: ближайшее — ${n.cat.icon} ${n.name} (метка)` : '🍖 Голод: найдите еду'); } if (S.food > 30) this._lf = 0;
    if (S.water < 20 && !this._lw) { this._lw = 1; const n = this._needMark('shop'); toast(n ? `💧 Жажда: ближайшее — ${n.cat.icon} ${n.name} (метка)` : '💧 Жажда: найдите воду'); } if (S.water > 30) this._lw = 0;
    // sitting on a bench: recover energy, keep pose, offer stand-up
    if (this.sitting) {
      S.en = Math.min(100, (S.en ?? 85) + dt * 0.12); P.vx = P.vz = P.vy = 0; P.eye = P.y + 1.15;  // rest regen ignores ?decay=0 (tests) and is faster than idle drain
      this.act = { label: 'Встать', run: () => this.stand() }; this.actEl.style.display = 'block'; this.actEl.textContent = (this.ctx.IS_TOUCH ? '' : 'E — ') + 'Встать';
      this.bAct.style.display = this.ctx.IS_TOUCH ? 'flex' : 'none'; this.dirty = 1; this.refresh(); return;
    }
    // exhausted + have a rented home → soft mark home for sleep
    if (S.en < 12 && S.home && this.rent && !this.pois.track && !this._he) {
      this._he = 1; const hx = S.home.bx, hz = S.home.bz;
      if (hx != null) { const fake = { x: hx, z: hz, name: 'Ваш дом', cat: { icon: '🏠' }, brand: 0xffd966 }; this.pois.setTrack(fake, true); toast('⚡ Вымотались — метка на ваш дом (спать в кровати)', 3600); }
    }
    if (S.en > 25) this._he = 0;
    this.dirty = 1;
    // action providers (throttled)
    if (((this.fr = (this.fr || 0) + 1) % 4) === 0) {
      let a = this._poiAction(); if (!a) for (const f of this.providers) { a = f(P, this); if (a) break; }
      this.act = a; const lab = a ? a.label : ''; if (lab !== this._actLab) { this._actLab = lab; this._actT = this.t; }
      const showPill = a && this.t - this._actT < (this.ctx.IS_TOUCH ? 4 : 6);   // compact hint pill, auto-hides after a few seconds
      this.actEl.style.display = showPill ? 'block' : 'none'; if (a) this.actEl.textContent = (this.ctx.IS_TOUCH ? '' : 'E — ') + a.label;
      this.bAct.style.display = a && this.ctx.IS_TOUCH ? 'flex' : 'none'; if (a && this.ctx.IS_TOUCH) this.bAct.title = a.label;
      this.refresh();
    }
  }
}
