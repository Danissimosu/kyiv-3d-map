// Commercial / job / special points of Kyiv (tiles/pois.json from tools/build_pois.py): facade tint, signs above entrances,
// themed interiors (via pl.poi), map markers, tracking beacon, "Места" panel.
import * as THREE from 'three';
import { $, UI, el, tap, toast, panel } from './ui.js';

export const CAT_INFO = {
  puzata:   { icon: '🍲', brand: 0xd9a21b, theme: 'dining',   svc: 'shop' },
  mcd:      { icon: '🍔', brand: 0xda291c, theme: 'fastfood', svc: 'shop' },
  silpo:    { icon: '🛒', brand: 0xf58220, theme: 'market',   svc: 'shop' },
  atb:      { icon: '🛒', brand: 0x2f6fc0, theme: 'market',   svc: 'shop' },
  epicentr: { icon: '🛠', brand: 0xf26b21, theme: 'diy',      svc: 'shop' },
  sushi:    { icon: '🍣', brand: 0xc4143c, theme: 'dining',   svc: 'shop' },
  dvornik:  { icon: '🧹', brand: 0x4a8f4e, theme: 'util',     svc: 'job' },
  gruzchik: { icon: '📦', brand: 0x9b7b4b, theme: 'depot',    svc: 'job' },
  kurier:   { icon: '🛵', brand: 0xe0533d, theme: 'util',     svc: 'job' },
  taxi:     { icon: '🚕', brand: 0xf2c40f, theme: 'util',     svc: 'job' },
  bus:      { icon: '🚌', brand: 0x2878c8, theme: 'depot',    svc: 'job' },
  tram:     { icon: '🚋', brand: 0xc23b2e, theme: 'depot',    svc: 'job' },
  sizo:     { icon: '⛓', brand: undefined, theme: 'prison',   svc: 'sizo' },
};
export const GROUPS = { food: ['🍽', 'Еда'], shop: ['🛒', 'Магазины'], job: ['💼', 'Работа'], special: ['⛓', 'СИЗО'] };
const hex2rgb = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];

export class PoiLayer {
  constructor(world, scene, ctx) {
    this.world = world; this.scene = scene; this.ctx = ctx; this.items = []; this.cats = []; this.sizo = null; this.loaded = false;
    this.track = null; this.groups = new Set(['food', 'shop', 'job', 'special']); this.pend = null; this.t = 0;
    this.maxSign = ctx.IS_TOUCH ? 80 : 200; this.signR = ctx.IS_TOUCH ? 170 : 320;
  }
  async load(base) {
    try {
      const d = await (await fetch(base + 'pois.json', { cache: 'no-cache' })).json();
      this.cats = d.cats.map(c => Object.assign({}, c, CAT_INFO[c.key] || { icon: '•', theme: 'util', svc: 'job' }));
      this.sizo = d.sizo; const pm = new Map();
      d.items.forEach((it, i) => {
        const c = this.cats[it[0]];
        const poi = { id: i, ci: it[0], key: c.key, cat: c, group: c.group, x: it[1], z: it[2], ix: it[3], iz: it[4], bi: it[5], real: !!it[6], name: it[7], osm: it[8],
          theme: c.theme, brand: c.brand, brandRGB: hex2rgb(c.brand === undefined ? 0x777777 : c.brand), pl: null };
        this.items.push(poi);
        if (poi.bi >= 0) { const k = poi.ix + '_' + poi.iz; let m = pm.get(k); if (!m) pm.set(k, m = new Map()); m.set(poi.bi, poi); }
      });
      this.world.poiMap = pm; this.loaded = true;
    } catch (e) { console.warn('pois.json not loaded', e); this.world.poiMap = new Map(); }
    this._initSigns(); this._initBeacon(); this._initPanel(); return this;
  }
  // ---------------------------------------------------------------- signs
  _initSigns() {
    this.signMeshes = this.cats.map(c => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d');
      const col = c.brand === undefined ? '#555' : '#' + c.brand.toString(16).padStart(6, '0');
      g.fillStyle = col; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 116);
      g.fillStyle = (c.key === 'taxi' || c.key === 'puzata') ? '#1a1a1a' : '#fff'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = 64; g.font = `bold ${fs}px sans-serif`; while (g.measureText(c.sign).width > 450 && fs > 24) { fs -= 4; g.font = `bold ${fs}px sans-serif`; }
      g.fillText(c.sign, 256, 68);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), 60);
      m.count = 0; m.frustumCulled = false; m.renderOrder = 2; this.scene.add(m); return m;
    });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  _updateSigns(P) {
    const cnt = this.cats.map(() => 0), R2 = this.signR * this.signR; let tot = 0;
    for (const poi of this.items) {
      const pl = poi.pl; if (!pl || !pl.tile || !pl.tile.alive) continue;
      const d = pl.door, dx = d.mx - P.x, dz = d.mz - P.z; if (dx * dx + dz * dz > R2 || tot >= this.maxSign) continue;
      const m = this.signMeshes[poi.ci], n = cnt[poi.ci]; if (n >= 60) continue;
      const w = poi.key === 'sizo' ? 5 : 3.6; const y = (pl.F0 || 0) + 2.75 + (poi.key === 'sizo' ? 0.4 : 0);
      this._q.setFromAxisAngle(this._up, Math.atan2(d.nx, d.nz)); this._p.set(d.mx + d.nx * 0.09, y + 0.45, d.mz + d.nz * 0.09); this._s.set(w, w / 4, 1);
      this._m.compose(this._p, this._q, this._s); m.setMatrixAt(n, this._m); cnt[poi.ci]++; tot++;
    }
    this.signMeshes.forEach((m, i) => { m.count = cnt[i]; m.instanceMatrix.needsUpdate = true; });
  }
  // ---------------------------------------------------------------- beacon + tracking
  _initBeacon() {
    const g = new THREE.CylinderGeometry(1.3, 1.3, 140, 14, 1, true); g.translate(0, 70, 0);
    this.beacon = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffd966, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.beacon.visible = false; this.beacon.frustumCulled = false; this.scene.add(this.beacon);
    this.trackEl = el('div', '', '', document.body); this.trackEl.className = 'hl'; this.trackEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(' + (this.ctx.IS_TOUCH ? 76 : 70) + 'px + env(safe-area-inset-top));z-index:6;background:rgba(10,16,24,.7);color:#fff;font:600 13px -apple-system,system-ui,sans-serif;padding:4px 10px;border-radius:12px;display:none;pointer-events:none;white-space:nowrap';
  }
  setTrack(poi) {
    this.track = poi; if (!poi) { this.beacon.visible = false; this.trackEl.style.display = 'none'; return; }
    this.beacon.position.set(poi.x, this.world.heightAt(poi.x, poi.z), poi.z); this.beacon.visible = true;
    const col = poi.brand === undefined ? 0xffd966 : poi.brand; this.beacon.material.color.setHex(col);
    toast(`Метка: ${poi.cat.icon} ${poi.name}`);
  }
  _updateTrack(P) {
    const t = this.track; if (!t) return; const d = Math.hypot(t.x - P.x, t.z - P.z);
    this.beacon.position.y = this.world.heightAt(t.x, t.z);
    if (d < 12) { this.setTrack(null); toast('Вы пришли'); return; }
    const a = Math.atan2(-(t.x - P.x), -(t.z - P.z)) - P.yaw; let r = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const ar = Math.abs(r) < 0.4 ? '↑' : Math.abs(r) > 2.7 ? '↓' : r > 0 ? '←' : '→';
    this.trackEl.textContent = `${ar} ${t.cat.icon} ${t.name} · ${d < 1000 ? d.toFixed(0) + ' м' : (d / 1000).toFixed(1) + ' км'}`; this.trackEl.style.display = 'block';
  }
  // ---------------------------------------------------------------- update
  update(P, dt) {
    this.t += dt;
    if (this.pend) { const pl = this.pend.pl; if (pl && pl.tile && pl.tile.alive) { const q = this.pend; this.pend = null; this.ctx.gotoDoor(pl, 4.5); toast(`${q.cat.icon} ${q.name}`); } else if (performance.now() - this.pendT > 15000) this.pend = null; }
    if (this.t < 0.5) { if (this.track) this._updateTrack(P); return; }
    this.t = 0; this._updateSigns(P); this._updateTrack(P);
  }
  goto(poi) {
    if (poi.pl && poi.pl.tile && poi.pl.tile.alive) { this.ctx.gotoDoor(poi.pl, 4.5); return; }
    this.pend = poi; this.pendT = performance.now(); this.ctx.teleport(poi.x + 14, poi.z + 14);
  }
  nearest(x, z, pred, n = 1) {
    const out = []; for (const p of this.items) { if (pred && !pred(p)) continue; const d = Math.hypot(p.x - x, p.z - z); out.push([d, p]); }
    out.sort((a, b) => a[0] - b[0]); return out.slice(0, n).map(o => ({ poi: o[1], dist: o[0] }));
  }
  // ---------------------------------------------------------------- map markers
  drawMarkers(g, W, H, cx, cz, k, big) {
    if (!this.loaded) return; const minK = big ? 0.1 : 0.0; if (k < minK && !big) return;
    const x0 = cx - W / 2 / k - 20, x1 = cx + W / 2 / k + 20, z0 = cz - H / 2 / k - 20, z1 = cz + H / 2 / k + 20;
    const showAll = k >= 0.1, r = big ? (k > 0.3 ? 6 : 4) : 3.5;
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of this.items) {
      if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
      const special = p.group === 'special' || p === this.track; if (!special && (!showAll || !this.groups.has(p.group))) continue;
      const sx = W / 2 + (p.x - cx) * k, sy = H / 2 + (p.z - cz) * k, col = p.brand === undefined ? '#444' : '#' + p.brand.toString(16).padStart(6, '0');
      if (special) {
        g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(sx, sy, big ? 10 : 7, 0, 7); g.fill(); g.stroke();
        g.font = (big ? 14 : 10) + 'px sans-serif'; g.fillStyle = '#fff'; g.fillText(p.cat.icon, sx, sy + 1);
        if (big) { g.font = 'bold 13px sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText('СИЗО (Дегтярёвская, 13)', sx, sy + 20); g.fillStyle = '#fff'; g.fillText('СИЗО (Дегтярёвская, 13)', sx, sy + 20); }
        continue;
      }
      g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill(); g.stroke();
      if (big && k > 0.45) { g.font = '11px sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(p.cat.sign, sx, sy + 13); g.fillStyle = '#fff'; g.fillText(p.cat.sign, sx, sy + 13); }
    }
    g.restore();
  }
  // ---------------------------------------------------------------- "Места" panel
  _initPanel() {
    const pn = this.panel = panel('placesP', 'Места'); this.sel = 'lm'; const body = pn.body;
    const chips = el('div', 'chips', '', body), list = el('div', '', '', body); this.listEl = list;
    const defs = [['lm', '📍 Достопримечательности'], ['food', '🍽 Еда'], ['shop', '🛒 Магазины'], ['job', '💼 Работа'], ['special', '⛓ СИЗО'], ['stops', '🚏 Остановки']];
    const draw = () => {
      chips.innerHTML = ''; defs.forEach(([k, t]) => { const c = el('span', 'chip' + (this.sel === k ? ' on' : ''), t, chips); tap(c, () => { this.sel = k; if (k !== 'lm') this.groups.add(k); draw(); }); });
      list.innerHTML = '';
      if (this.sel === 'stops') { if (this.transit && this.transit.loaded) this.transit.fillStops(list, pn, draw); else el('div', '', 'Данные транспорта не загружены', list); return; }
      if (this.sel === 'lm') {
        (this.ctx.landmarks || []).forEach(l => { const r = el('div', 'row', '', list); el('div', 't', `<b>${l.name}</b>`, r); tap(el('span', 'btn', 'ТП', r), () => { pn.close(); l.go(); }); });
        const note = el('div', '', '<small style="opacity:.6">Всё остальное — в вкладках: магазины, еда, работа и Киевский СИЗО (Дегтярёвская, 13).</small>', list); return;
      }
      const P = this.ctx.P, g = this.sel; const arr = this.nearest(P.x, P.z, p => p.group === g, 40);
      if (!arr.length) el('div', '', 'Нет точек', list);
      arr.forEach(({ poi, dist }) => {
        const r = el('div', 'row', '', list), tr = this.track === poi;
        el('div', 't', `<b>${poi.cat.icon} ${poi.name}</b><small>${dist < 1000 ? dist.toFixed(0) + ' м' : (dist / 1000).toFixed(1) + ' км'} · ${poi.real ? 'реальный объект OSM' : 'игровая точка (по модели)'}${poi.key === 'sizo' ? ' · вул. Дегтярівська, 13' : ''}</small>`, r);
        tap(el('span', 'btn g', tr ? 'снять' : 'метка', r), () => { this.setTrack(tr ? null : poi); draw(); });
        if (!this.ctx.noTeleport) tap(el('span', 'btn', 'ТП', r), () => { pn.close(); this.goto(poi); });
      });
    };
    pn.onOpen = draw; this.redraw = draw;
  }
}
