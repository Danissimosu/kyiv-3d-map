// Night street dealers ("барыги") — a fictional GTA-style crime mechanic. 22:00–05:00 game time (real Kyiv time), any weekday.
// Spots: picked deterministically from the streamed tile data — parks (dense tree clusters), courtyards (apartment-block sides away from roads),
// metro exits (GTFS stops "ст.м. …"), garage rows (OSM building=garage(s)); one spot per tile on ~55% of tiles, ROTATED every night (seed = night id).
// Buy dialog (марихуана / кокаин, ₴), items go to the backpack; use = short screen tint/wobble + needs effect (cocaine stronger + risky, overdose).
// Consequences: police patrols near some spots see deals (wanted ★★), frisk players who carry (confiscation + fine, SIZO if unable to pay / cocaine at arrest),
// dealers sometimes run off with the money, an undercover cop at metro spots; heavy use → health damage / overdose. Map: only nearby or discovered spots.
// State in game.S (drug, dseen, dsold) — optional fields, old saves load. Debug: ?dealers=all (a dealer on every tile), window.__kyiv.dealers.
import * as THREE from 'three';
import { el, tap, toast, panel, UI } from './ui.js';

export const ENABLED = true;   // feature switch (deploys)
export const DRUGS = { weed: { n: 'Марихуана', unit: '1 г', price: 450, icon: '🌿' }, coke: { n: 'Кокаин', unit: '0,5 г', price: 2200, icon: '❄️' } };
export const FINE = { weed: 850, coke: 3400 };
export const isNight = h => h >= 22 || h < 5;
const hs = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
const KIND = { park: { t: 'в парке', icon: '🌳' }, yard: { t: 'во дворе', icon: '🏢' }, metro: { t: 'у метро', icon: 'Ⓜ' }, garage: { t: 'у гаражей', icon: '🚗' } };
const LINES = {
  park: ['Шо, отдыхаем? Есть шо надо.', 'Тихо, тут бабки с собаками ходят. Говори быстро.'],
  yard: ['Свои? Ну давай, только не светись у подъезда.', 'Я тут живу, если шо. Шо надо?'],
  metro: ['Не стой столбом, менты на выходе бывают. Шо берёшь?', 'Пока метро закрыто — у меня открыто.'],
  garage: ['За гаражами — лучший сервис в районе.', 'Хочешь — бери, не хочешь — иди. Без кипиша.'],
};
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };

export class Dealers {
  constructor(ctx) {
    this.ctx = ctx; const { P, world, scene, city, pois, game, crime, transit, clock, qs } = ctx; Object.assign(this, { P, world, scene, city, pois, game, crime, transit, clock });
    game.dealers = this; this.all = qs.get('dealers') === 'all'; this.off = qs.get('dealers') === '0' || (!ENABLED && !qs.has('dealers'));
    this.cands = new Map(); this.active = new Map(); this.patrols = []; this.t = 0; this.scanT = 9; this.friskT = 0; this.night = null; this.rng = Math.random; this.log = [];
    game.addProvider(P => this.provider(P));
    (pois.layers || (pois.layers = [])).push((g, W, H, cx, cz, k, big, x0, x1, z0, z1) => this.drawMarkers(g, W, H, cx, cz, k, big, x0, x1, z0, z1));
    // arrest with drugs in the pocket: confiscation; cocaine => SIZO (wanted counts as >= 3), marijuana => extra fine
    const orig = crime.arrest.bind(crime);
    crime.arrest = (fs) => { const w = game.count('weed'), c = game.count('coke'); if (w || c) { game.take('weed', w); game.take('coke', c);
      if (c) { fs = Math.max(fs || crime.stars, 3); toast(`👮 При задержании изъято: ${c ? '❄️×' + c : ''} ${w ? '🌿×' + w : ''} — статья, СИЗО`, 4200); }
      else { const f = Math.min(Math.floor(game.S.money), FINE.weed); game.S.money -= f; toast(`👮 При задержании изъята марихуана (×${w}), штраф ₴${f}`, 4200); } this._log('arrest-confiscate'); }
      return orig(fs); };
    this._ui(); this._meshes();
  }
  get S() { return this.game.S; }
  _log(e) { this.log.push(e); if (this.log.length > 60) this.log.shift(); }
  nightId() { const c = this.clock; return c.hour < 12 ? c.day - 1 : c.day; }
  get isNight() { return isNight(this.clock.hour); }
  // ---------------------------------------------------------------- UI: bottom-sheet buy dialog + screen effect overlay
  _ui() {
    const T = this.ctx.IS_TOUCH; this.buyP = panel('dealP', '🧥 Барыга');
    Object.assign(this.buyP.root.style, { top: 'auto', bottom: '0', height: 'auto', maxHeight: T ? '62vh' : '70vh', borderRadius: '18px 18px 0 0', background: 'rgba(14,10,22,.93)', boxShadow: '0 -6px 30px rgba(0,0,0,.6)' });
    this.buyP.onClose = () => { this.cur = null; };
    this.fx = el('div', '', '', document.body); this.fx.style.cssText = 'position:fixed;inset:0;z-index:4;pointer-events:none;opacity:0;transition:opacity .8s';
  }
  _meshes() {   // a cigarette ember per dealer (additive sprite) — makes the dark figure readable at night
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(0.25, 'rgba(255,120,30,.9)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    this.emberMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    this.grp = new THREE.Group(); this.scene.add(this.grp);
  }
  // ---------------------------------------------------------------- deterministic candidate spots per tile (cached)
  _ok(x, z) {
    const W = this.world, t = W.tiles.get(Math.floor(x / W.TILE) + '_' + Math.floor(z / W.TILE)); if (!t || !t.h) return null;
    const y = W.heightAt(x, z), q = { x, z }; W.collide(q, 0.5, y, 1.7); if (Math.hypot(q.x - x, q.z - z) > 0.05) return null; if (W.waterAt(x, z) !== null) return null;
    for (const r of t.roads) { const p = r.p, hw = (r.w || 5) / 2 + 0.8; for (let i = 0; i + 3 < p.length; i += 2) if (segD(x, z, p[i], p[i + 1], p[i + 2], p[i + 3]) < hw) return null; }
    return y;
  }
  _roadDist(t, x, z) { let b = 1e9; for (const r of t.roads) { if ((r.c || 0) > 6) continue; const p = r.p; for (let i = 0; i + 3 < p.length; i += 2) b = Math.min(b, segD(x, z, p[i], p[i + 1], p[i + 2], p[i + 3]) - (r.w || 5) / 2); } return b; }
  candidates(key) {
    let c = this.cands.get(key); if (c) return c; const W = this.world, t = W.tiles.get(key); if (!t || !t.h) return null;
    c = []; const push = (kind, x, z, i) => { const y = this._ok(x, z); if (y !== null) c.push({ id: key + ':' + kind + ':' + i, kind, x, z, y }); };
    const edgeOut = (b, off, pick) => {   // midpoint of a polygon edge pushed `off` m outward; pick(x, z) scores the side
      const p = b.p, n = p.length / 2; let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; } cx /= n; cz /= n; let best = null, bs = -1e9;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n, ax = p[2 * i], az = p[2 * i + 1], bx = p[2 * j], bz = p[2 * j + 1], L = Math.hypot(bx - ax, bz - az); if (L < 5) continue;
        let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
        const x = mx + nx * off, z = mz + nz * off, s = pick(x, z, L); if (s > bs) { bs = s; best = [x, z]; } }
      return best && bs > -1e8 ? best : null; };
    let ng = 0, ny = 0;
    t.blds.forEach((b, i) => {
      if (!b.p || b.p.length < 6) return;
      if ((b.k === 'garages' || b.k === 'garage') && ng < 3) { const e = edgeOut(b, 1.6, (x, z, L) => L); if (e) { push('garage', e[0], e[1], i); ng++; } }
      else if ((b.k === 'apartments' || b.k === 'residential' || b.k === 'dormitory') && ny < 4 && hs(key + ':y' + i) < 0.35) {
        const e = edgeOut(b, 3.5, (x, z) => { const d = this._roadDist(t, x, z); return d > 18 ? d : -1e9; }); if (e) { push('yard', e[0], e[1], i); ny++; } }
    });
    if (t.trees && t.trees.length >= 40) {   // parks: trees with >= 9 neighbours within 16 m (grid hash), a few spread-out picks
      const a = t.trees, G = new Map(), cell = (x, z) => Math.floor(x / 16) + ',' + Math.floor(z / 16);
      for (let i = 0; i < a.length; i += 4) { const k = cell(a[i], a[i + 1]); let l = G.get(k); if (!l) G.set(k, l = []); l.push(i); }
      const picks = []; for (let i = 0; i < a.length && picks.length < 3; i += 4 * 7) { const x = a[i], z = a[i + 1]; let n = 0; const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
        for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) for (const j of G.get((cx + u) + ',' + (cz + v)) || []) if (Math.hypot(a[j] - x, a[j + 1] - z) < 16) n++;
        if (n >= 10 && picks.every(p => Math.hypot(p[0] - x, p[1] - z) > 60) && this._roadDist(t, x, z) > 14) { const an = hs(key + i) * 6.283; picks.push([x + Math.cos(an) * 2.4, z + Math.sin(an) * 2.4, i]); } }
      for (const p of picks) push('park', p[0], p[1], p[2]);
    }
    const tr = this.transit; if (tr && tr.stops) { let nm = 0; const x0 = t.ox, z0 = t.oz, T = W.TILE;
      for (const s of tr.stops) { if (nm >= 2 || !/ст\.\s?м\.|метро/i.test(s.name) || s.x < x0 || s.x >= x0 + T || s.z < z0 || s.z >= z0 + T) continue;
        for (let k = 0; k < 6; k++) { const an = hs(s.name + k) * 6.283, r = 9 + k * 2; const x = s.x + Math.cos(an) * r, z = s.z + Math.sin(an) * r; if (this._ok(x, z) !== null) { push('metro', x, z, s.i); nm++; break; } } } }
    this.cands.set(key, c); return c;
  }
  // tonight's dealer of a tile (or null): a kind is drawn first so the night set is varied, then a spot of that kind
  pick(key, night) {
    const c = this.candidates(key); if (!c || !c.length) return null; if (!this.all && hs(key + '|' + night) > 0.55) return null;
    const kinds = [...new Set(c.map(s => s.kind))], kind = kinds[Math.floor(hs(key + '#' + night) * kinds.length)], l = c.filter(s => s.kind === kind);
    return l[Math.floor(hs(key + '@' + night) * l.length)];
  }
  // ---------------------------------------------------------------- per-frame
  update(P, dt) {
    if (this.off) return; this.t += dt; this._effects(P, dt); if (UI.modal && !this.buyP.isOpen) return;
    const night = this.isNight, nid = this.nightId();
    if (this._wasNight && !night) toast('🌅 Рассвет в Киеве — ночные точки закрылись до 22:00', 3500);
    this._wasNight = night;
    if ((this.scanT += dt) > 1.2) { this.scanT = 0; this._scan(P, night, nid); }
    for (const d of this.active.values()) this._dealerStep(d, P, dt);
    this._patrolStep(P, dt);
    this.friskT -= dt; if (this.friskT <= 0) { this.friskT = 3; this._frisk(P); }
  }
  _scan(P, night, nid) {
    const W = this.world, T = W.TILE, ix = Math.floor(P.x / T), iz = Math.floor(P.z / T), want = new Map();
    if (night && !this.crime.jail) for (let a = ix - 1; a <= ix + 1; a++) for (let b = iz - 1; b <= iz + 1; b++) { const s = this.pick(a + '_' + b, nid); if (s && Math.hypot(s.x - P.x, s.z - P.z) < 300) want.set(s.id, s); }
    if (this.night !== nid) { this.night = nid; const S = this.S; if (!S.dsold || S.dsold.n !== nid) S.dsold = { n: nid, m: {} }; }
    for (const [id, d] of this.active) if (!want.has(id) && !(d.npc && d.npc.state === 'flee' && d.ft < 6)) this._drop(d);
    for (const [id, s] of want) if (!this.active.has(id)) this._spawn(s, nid);
  }
  _spawn(s, nid) {
    const S = this.S, sold = (S.dsold && S.dsold.m[s.id]) || 0; if (sold < 0) return;   // -1 = ran off tonight
    const h = hs(s.id + '$' + nid), npc = { x: s.x, z: s.z, y: s.y, yaw: h * 6.28, phase: h * 6, shirt: [0x22252b, 0x2b2236, 0x1e2a24, 0x33302a][Math.floor(h * 4)], pants: 0x17181c, state: 'stand', t: 0, scale: 0.98 + h * 0.06, moving: 0, dealer: true };
    const d = { s, npc, stock: { weed: 3 + Math.floor(h * 4), coke: 1 + Math.floor(hs(s.id + 'c' + nid) * 3) }, ft: 0, line: LINES[s.kind][Math.floor(h * 2)], under: s.kind === 'metro' && hs(s.id + 'u' + nid) < 0.18 };
    d.stock.weed = Math.max(0, d.stock.weed - sold); this.city.extra.push(npc);
    const e = new THREE.Sprite(this.emberMat); e.scale.set(0.16, 0.16, 1); this.grp.add(e); d.ember = e; this.active.set(s.id, d);
    if (hs(s.id + 'p' + nid) < (s.kind === 'metro' ? 0.45 : 0.28)) this._spawnPatrol(d, nid);
  }
  _drop(d) { const k = this.city.extra.indexOf(d.npc); if (k >= 0) this.city.extra.splice(k, 1); if (d.ember) this.grp.remove(d.ember); this.active.delete(d.s.id);
    for (let i = this.patrols.length - 1; i >= 0; i--) if (this.patrols[i].d === d) { const c = this.patrols[i], j = this.city.extra.indexOf(c); if (j >= 0) this.city.extra.splice(j, 1); this.patrols.splice(i, 1); } }
  clear() { for (const d of [...this.active.values()]) this._drop(d); }
  _spawnPatrol(d, nid) {   // a pair of PPS officers walking a loop (r 26–40 m) around the spot
    const r = 26 + hs(d.s.id + 'r' + nid) * 14, a0 = hs(d.s.id + 'a' + nid) * 6.283;
    for (let k = 0; k < 2; k++) { const a = a0 + k * 0.05, x = d.s.x + Math.cos(a) * r, z = d.s.z + Math.sin(a) * r;
      const c = { x, z, y: this.world.heightAt(x, z), yaw: 0, phase: k * 3, shirt: 0x1f3d7a, pants: 0x14181f, state: 'patrol', t: 0, scale: 1.02, cop: true, pps: true, moving: 0.45, stun: 0, d, a, r, dir: 1, off: k * 1.1, stop: 0 };
      this.patrols.push(c); this.city.extra.push(c); }
  }
  _patrolStep(P, dt) {
    for (const c of this.patrols) {
      if (c.stop > 0) { c.stop -= dt; c.moving = 0; c.state = 'stand'; c.yaw = Math.atan2(P.x - c.x, P.z - c.z); continue; }
      c.a += c.dir * 1.25 * dt / c.r; const tx = c.d.s.x + Math.cos(c.a) * c.r + Math.cos(c.a + 1.57) * c.off, tz = c.d.s.z + Math.sin(c.a) * c.r + Math.sin(c.a + 1.57) * c.off;
      const px = c.x, pz = c.z, q = { x: tx, z: tz }; this.world.collide(q, 0.4, c.y, 1.8); c.x = q.x; c.z = q.z; if (Math.hypot(q.x - tx, q.z - tz) > 0.6) c.dir = -c.dir;
      c.y += (this.world.groundAt(c.x, c.z, c.y + 1) - c.y) * Math.min(1, dt * 8); const mv = Math.hypot(c.x - px, c.z - pz); if (mv > 1e-3) c.yaw = Math.atan2(c.x - px, c.z - pz); c.moving = 0.45; c.state = 'patrol';
    }
  }
  _dealerStep(d, P, dt) {
    const n = d.npc, dx = P.x - n.x, dz = P.z - n.z, dist = Math.hypot(dx, dz);
    if (n.state === 'flee') { d.ft += dt; const s = 6.5 * dt; n.x += Math.sin(n.yaw) * s; n.z += Math.cos(n.yaw) * s; const q = { x: n.x, z: n.z }; this.world.collide(q, 0.4, n.y, 1.8); if (Math.hypot(q.x - n.x, q.z - n.z) > 0.01) n.yaw += 0.9; n.x = q.x; n.z = q.z; n.y += (this.world.groundAt(n.x, n.z, n.y + 1) - n.y) * Math.min(1, dt * 8); if (d.ft > 7) this._drop(d); return; }
    if (dist < 14) n.yaw += (((Math.atan2(dx, dz) - n.yaw + Math.PI) % 6.283 + 6.283) % 6.283 - Math.PI) * Math.min(1, dt * 3); else n.yaw += Math.sin(this.t * 0.3 + n.phase) * dt * 0.25;
    if (dist < 30 && this.isNight) { const S = this.S; S.dseen = S.dseen || []; if (!S.dseen.includes(d.s.id)) { S.dseen.push(d.s.id); if (S.dseen.length > 300) S.dseen.shift(); this.game.dirty = 1; toast(`🧥 Кто-то в капюшоне ${KIND[d.s.kind].t}… (отмечено на карте)`, 3000); } }
    const e = d.ember; if (e) { const b = Math.sin(this.t * 0.7 + n.phase), lift = b > 0.6 ? 1.62 : 1.18; e.position.set(n.x + Math.sin(n.yaw + 0.5) * 0.3, n.y + lift * n.scale, n.z + Math.cos(n.yaw + 0.5) * 0.3); e.material.opacity = 1; e.scale.setScalar(0.12 + 0.05 * Math.max(0, Math.sin(this.t * 2.3 + n.phase))); e.visible = dist < 160; }
  }
  nearest(P, r = 2.8) { let b = null, bd = r; for (const d of this.active.values()) { if (d.npc.state === 'flee') continue; const k = Math.hypot(d.npc.x - P.x, d.npc.z - P.z); if (k < bd && Math.abs(d.npc.y - P.y) < 2.5) { bd = k; b = d; } } return b; }
  copNear(P, r) { let b = null, bd = r; const t = (c) => { if (!c || c.dead) return; const k = Math.hypot(c.x - P.x, c.z - P.z); if (k < bd) { bd = k; b = c; } }; this.patrols.forEach(t); (this.crime.cops || []).forEach(t); (this.crime.pcars || []).forEach(t); return b ? { c: b, d: bd } : null; }
  provider(P) { if (!this.isNight || this.crime.driving || this.crime.jail) return null; const d = this.nearest(P); if (!d) return null; return { label: d.under ? '🧥 «Шо надо?»' : '🧥 Барыга: «Шо надо?»', run: () => this.open(d) }; }
  // ---------------------------------------------------------------- buy dialog
  open(d) {
    this.cur = d; const p = this.buyP, b = p.body, S = this.S; b.innerHTML = ''; p.titleEl.textContent = `🧥 Барыга ${KIND[d.s.kind].t}`;
    const cop = this.copNear(this.P, 40);
    el('div', '', `<p style="margin:2px 0 8px;font-style:italic;opacity:.9">«${cop ? 'Шухер, мусора рядом… давай быстро.' : d.line}»</p><div style="font-size:13px;opacity:.8;margin-bottom:6px">₴ ${Math.floor(S.money)} · в рюкзаке: 🌿 ${this.game.count('weed')} · ❄️ ${this.game.count('coke')}</div>`, b);
    for (const id of ['weed', 'coke']) { const D = DRUGS[id], r = el('div', 'row', '', b), left = d.stock[id];
      el('div', 't', `<b>${D.icon} ${D.n} · ${D.unit}</b><small>₴${D.price} · осталось ${left}${id === 'coke' ? ' · сильнее и опаснее' : ''}</small>`, r);
      tap(el('span', 'btn' + (left > 0 && S.money >= D.price ? '' : ' off'), 'Купить', r), () => { const res = this.buy(d, id); if (res === 'ok' && this.buyP.isOpen) this.open(d); }); }
    el('div', '', `<p style="font-size:11px;opacity:.6;margin:8px 0 4px">Игровая механика (вымысел). Рядом с полицией сделку могут заметить; при обыске — изъятие и штраф ₴${FINE.weed}/₴${FINE.coke}; барыга может кинуть.</p>`, b);
    tap(el('div', 'btn g', 'Уйти', b), () => p.close()); p.open();
  }
  buy(d, id) {
    const g = this.game, S = g.S, D = DRUGS[id]; if (!d || !this.active.has(d.s.id) || d.npc.state === 'flee') return 'gone';
    if (!this.isNight) { toast('Уже светает — барыга ушёл'); return 'day'; }
    if (d.stock[id] <= 0) { toast('«Закончилось. Завтра приходи.»'); return 'empty'; }
    if (S.money < D.price) { toast('Не хватает денег'); return 'money'; }
    if (!g.pay(D.price)) return 'money';
    if (d.under) { this.buyP.close(); this.crime.addHeat(2.2, 'контрольная закупка'); toast('👮 «Полиция! Контрольная закупка!» — это был переодетый опер', 4200); d.npc.cop = true; this._log('undercover'); d.under = false; return 'undercover'; }
    if (this.rng() < 0.06) { this.buyP.close(); d.npc.state = 'flee'; d.npc.moving = 1; d.npc.yaw = Math.atan2(d.npc.x - this.P.x, d.npc.z - this.P.z); d.ft = 0; S.dsold.m[d.s.id] = -1; toast(`🏃 Барыга схватил ₴${D.price} и сбежал! Кинули…`, 3600); this._log('scam'); return 'scam'; }
    if (!g.add(id, 1)) { g.earn(D.price); toast('Рюкзак полон'); return 'full'; }
    d.stock[id]--; if (id === 'weed') S.dsold.m[d.s.id] = (S.dsold.m[d.s.id] || 0) + 1; g.dirty = 1;
    const cop = this.copNear(this.P, 38);
    if (cop && this.rng() < 0.65) { this.buyP.close(); this.crime.addHeat(2, 'покупка наркотиков'); toast('👮 Патруль заметил сделку! ★★ — бегите или вас обыщут', 4200); this._log('seen'); return 'seen'; }
    toast(`${D.icon} Куплено: ${D.n} (${D.unit}) за ₴${D.price}`); this._log('buy-' + id); return 'ok';
  }
  // ---------------------------------------------------------------- police frisk (carrying near a patrol)
  _frisk(P) {
    const g = this.game, w = g.count('weed'), c = g.count('coke'); if ((!w && !c) || this.crime.jail || this.crime.heat >= 1) return;
    const cop = this.copNear(P, 7); if (!cop || !cop.c.pps) return; const D = this.S.drug || {};
    const p = 0.12 + (D.k === 'weed' && D.t > 0 ? 0.2 : 0) + (D.k === 'coke' && D.t > 0 ? 0.1 : 0); if (this.rng() > p) return;
    this.frisk(cop.c);
  }
  frisk(cop) {
    const g = this.game, S = g.S, w = g.count('weed'), c = g.count('coke'); if (!w && !c) return false; g.take('weed', w); g.take('coke', c); if (cop) cop.stop = 4;
    const fine = (w ? FINE.weed : 0) + (c ? FINE.coke : 0), what = [c ? '❄️×' + c : '', w ? '🌿×' + w : ''].filter(Boolean).join(' ');
    if (S.money >= fine) { S.money -= fine; g.dirty = 1; g.refresh(); toast(`👮 Обыск ППС: изъято ${what}, штраф ₴${fine}`, 4500); this._log('frisk-fine'); }
    else { toast(`👮 Обыск ППС: изъято ${what}. Штраф ₴${fine} платить нечем — задержаны`, 4500); this._log('frisk-arrest'); this.crime.arrest(3); }
    return true;
  }
  // ---------------------------------------------------------------- using the items: effects + risks
  use(id) {
    const g = this.game, S = g.S; if (!g.count(id) || !DRUGS[id]) return; g.take(id, 1); const D = S.drug || (S.drug = { k: null, t: 0, tol: 0 }); D.tol = D.tol || 0;
    if (id === 'weed') {
      S.hp = Math.min(100, S.hp + 6); S.en = Math.max(0, (S.en ?? 85) - 10); S.food = Math.max(0, S.food - 10); D.tol += 0.7;
      D.t = Math.min(240, (D.k === 'weed' ? D.t : 0) + 95); D.k = 'weed';
      if (D.tol >= 4.2) { g.hurt(8, 'Передозировка'); toast('😵 Перебор: паранойя и тошнота (❤ −8)', 3600); this._log('weed-heavy'); } else toast('🌿 Мир стал мягче… ❤ +6, ⚡ −10, пробило на хавчик', 3200);
      this._log('use-weed');
    } else {
      const risk = Math.min(0.75, Math.max(0, 0.09 * (D.tol - 1.2)) + (D.k === 'coke' && D.t > 0 ? 0.22 : 0)); D.tol += 1.6; S.en = Math.min(100, (S.en ?? 85) + 45);
      if (this.rng() < risk) { D.k = 'od'; D.t = 22; toast('💀 Передозировка! Сердце выпрыгивает — ❤ −55', 5000); this._log('overdose'); g.hurt(55, 'Передозировка кокаином'); }
      else { D.k = 'coke'; D.t = 120; S.hp = Math.max(1, S.hp - 3); toast('❄️ Резкий прилив сил: ⚡ +45, бег быстрее. Потом будет «отходняк»', 3600); this._log('use-coke'); }
    }
    g.dirty = 1; g.refresh();
  }
  sober() { const D = this.S.drug; if (D) { D.k = null; D.t = 0; } this._fxOff(); }
  _fxOff() { const P = this.P; P.wob = null; P.boost = undefined; this.fx.style.opacity = 0; this.fxK = null; }
  _effects(P, dt) {
    const S = this.S, D = S && S.drug; if (!D) { if (this.fxK) this._fxOff(); return; }
    D.tol = Math.max(0, (D.tol || 0) - dt / 600);
    if (!D.k || D.t <= 0) { if (D.k === 'coke') { D.k = 'crash'; D.t = 90; toast('🥶 Отходняк: силы уходят, ⚡ падает', 3000); } else if (D.k) { D.k = null; D.t = 0; } if (!D.k) { if (this.fxK) this._fxOff(); return; } }
    D.t -= dt; const t = this.t, k = D.k, f = Math.min(1, D.t / 8, 1);   // fade out over the last 8 s
    if (this.fxK !== k) { this.fxK = k; this.fx.style.background = k === 'weed' ? 'radial-gradient(ellipse at center, rgba(120,255,140,.10) 30%, rgba(110,40,170,.42) 100%)' : k === 'coke' ? 'radial-gradient(ellipse at center, rgba(255,255,255,0) 35%, rgba(220,240,255,.38) 100%)' : k === 'crash' ? 'linear-gradient(rgba(40,60,90,.28), rgba(20,30,50,.38))' : 'radial-gradient(ellipse at center, rgba(120,0,0,.15) 20%, rgba(90,0,0,.72) 100%)'; }
    if (k === 'weed') { P.wob = { r: 0.04 * Math.sin(t * 0.9) * f, y: 0.015 * Math.sin(t * 0.53) * f, p: 0.012 * Math.sin(t * 0.71) * f }; P.boost = 0.9; this.fx.style.opacity = (0.65 + 0.3 * Math.sin(t * 0.8)) * f; }
    else if (k === 'coke') { const hb = Math.pow(Math.max(0, Math.sin(t * 2 * Math.PI * 1.7)), 6); P.wob = { r: 0.004 * Math.sin(t * 23) * f, y: 0.003 * Math.sin(t * 17), p: 0.003 * Math.sin(t * 19) }; P.boost = 1.22; this.fx.style.opacity = (0.35 + 0.6 * hb) * f; }
    else if (k === 'crash') { P.wob = null; P.boost = 0.85; S.en = Math.max(0, (S.en ?? 85) - 0.26 * dt); this.fx.style.opacity = 0.8 * f; }
    else if (k === 'od') { P.wob = { r: 0.07 * Math.sin(t * 1.3) * f, y: 0.03 * Math.sin(t * 0.8) * f, p: 0.02 * Math.sin(t * 1.1) * f }; P.boost = 0.6; this.fx.style.opacity = (0.6 + 0.4 * Math.sin(t * 4)) * f; }
  }
  // ---------------------------------------------------------------- map: only nearby (< 70 m) or discovered spots, only tonight
  drawMarkers(g, W, H, cx, cz, k, big, x0, x1, z0, z1) {
    if (!this.isNight || !this.active.size) return; const seen = new Set(this.S.dseen || []), P = this.P;
    for (const d of this.active.values()) { const n = d.npc; if (n.state === 'flee') continue; if (!seen.has(d.s.id) && Math.hypot(n.x - P.x, n.z - P.z) > 70) continue; if (n.x < x0 || n.x > x1 || n.z < z0 || n.z > z1) continue;
      const sx = W / 2 + (n.x - cx) * k, sy = H / 2 + (n.z - cz) * k; g.fillStyle = '#5b2a86'; g.strokeStyle = '#d9b3ff'; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, big ? 9 : 6, 0, 7); g.fill(); g.stroke(); g.font = (big ? 12 : 9) + 'px sans-serif'; g.fillStyle = '#fff'; g.fillText('🧥', sx, sy + 1); }
  }
  list() { return [...this.active.values()].map(d => ({ id: d.s.id, kind: d.s.kind, x: d.npc.x, z: d.npc.z, y: d.npc.y, stock: d.stock, under: d.under, state: d.npc.state, patrol: this.patrols.some(c => c.d === d) })); }
}
