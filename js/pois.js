// Commercial / job / special points of Kyiv (tiles/pois.json from tools/build_pois.py): facade tint, signs above entrances,
// themed interiors (via pl.poi), map markers, tracking beacon, "Места" panel.
import * as THREE from 'three';
import { $, UI, el, tap, toast, panel } from './ui.js';
import { designImage, FacadeKits, KIT_FOR } from './design.js';

export const CAT_INFO = {
  puzata:   { icon: '🍲', brand: 0x3e6e3e, theme: 'puzata',   svc: 'shop' },
  mcd:      { icon: '🍔', brand: 0xda291c, theme: 'mcd', svc: 'shop' },
  silpo:    { icon: '🛒', brand: 0x008c46, theme: 'silpo',   svc: 'shop' },
  atb:      { icon: '🛒', brand: 0x2f6fc0, theme: 'market',   svc: 'shop' },
  epicentr: { icon: '🛠', brand: 0xf4c418, theme: 'epicentr',      svc: 'shop' },
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


// sign boards: pack palettes (design pack manifest) + pack paint texture as the background; the brand name is plain text, not an official logo
function drawSign(g, c, img) {
  const key = c.key, W = 512, H = 128, col = c.brand === undefined ? '#555' : '#' + c.brand.toString(16).padStart(6, '0');
  const tile = (cell, alpha = 0.55) => { if (!img) return; g.save(); g.globalAlpha = alpha; for (let x = 0; x < W; x += 128) g.drawImage(img, cell * 128, 0, 128, 128, x, 0, 128, 128); g.restore(); };
  const text = (str, x, y, fill, maxW, fs = 64, align = 'center') => { g.fillStyle = fill; g.textAlign = align; g.textBaseline = 'middle'; g.font = `bold ${fs}px sans-serif`; while (g.measureText(str).width > maxW && fs > 22) { fs -= 4; g.font = `bold ${fs}px sans-serif`; } g.fillText(str, x, y); };
  g.clearRect(0, 0, W, H);
  if (key === 'mcd') {
    g.fillStyle = '#da291c'; g.fillRect(0, 0, W, H); tile(0, 0.5);
    g.strokeStyle = '#ffc72c'; g.lineWidth = 14; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); const cx = 84; g.moveTo(cx - 44, 104); g.lineTo(cx - 44, 48); g.bezierCurveTo(cx - 44, 6, cx - 6, 6, cx, 56); g.bezierCurveTo(cx + 6, 6, cx + 44, 6, cx + 44, 48); g.lineTo(cx + 44, 104); g.stroke();
    text("McDonald's", 300, 66, '#fff', 350, 62); g.fillStyle = '#ffc72c'; g.fillRect(0, H - 10, W, 10);
  } else if (key === 'puzata') {
    g.fillStyle = '#3e6e3e'; g.fillRect(0, 0, W, H); tile(2, 0.6);
    g.strokeStyle = '#c4a46a'; g.lineWidth = 9; g.strokeRect(6, 6, W - 12, H - 12); g.strokeStyle = '#6b2a1a'; g.lineWidth = 3; g.strokeRect(15, 15, W - 30, H - 30);
    text('ПУЗАТА ХАТА', 256, 58, '#f4e6c8', 400, 56);
    for (let x = 22; x < W - 22; x += 20) { g.fillStyle = (x / 20) % 2 ? '#c8261c' : '#f4e6c8'; g.fillRect(x, H - 30, 12, 10); }
  } else if (key === 'silpo') {
    g.fillStyle = '#008c46'; g.fillRect(0, 0, W, H); tile(3, 0.55);
    g.fillStyle = '#f27820'; g.fillRect(0, H - 26, W, 14); g.strokeStyle = '#f5f5f5'; g.lineWidth = 5; g.strokeRect(5, 5, W - 10, H - 10);
    text('СІЛЬПО', 256, 52, '#f5f5f5', 400, 66);
  } else if (key === 'epicentr') {
    g.fillStyle = '#f4c418'; g.fillRect(0, 0, W, H); tile(5, 0.5); g.fillStyle = '#006e37'; g.fillRect(0, H - 32, W, 32);
    text('ЕПІЦЕНТР', 256, 48, '#1a1a1a', 420, 66); g.fillStyle = '#f4c418'; g.fillRect(0, H - 32, W, 5);
  } else {
    g.fillStyle = col; g.fillRect(0, 0, W, H); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 116);
    text(c.sign, 256, 68, (key === 'taxi') ? '#1a1a1a' : '#fff', 450, 64);
  }
}

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
    this.kits = new FacadeKits(this.scene, this.ctx.IS_TOUCH ? 14 : 28);
    this.signMeshes = this.cats.map(c => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d');
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const draw = (img) => { drawSign(g, c, img); tex.needsUpdate = true; };
      draw(null); designImage('brand.jpg').then(im => { if (im) draw(im); });
      const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), 60);
      m.count = 0; m.frustumCulled = false; m.renderOrder = 2; this.scene.add(m); return m;
    });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  _updateSigns(P) {
    const cnt = this.cats.map(() => 0), R2 = this.signR * this.signR; let tot = 0; this.kits.begin();
    for (const poi of this.items) {
      const pl = poi.pl; if (!pl || !pl.tile || !pl.tile.alive) continue;
      const d = pl.door, dx = d.mx - P.x, dz = d.mz - P.z; if (dx * dx + dz * dz > R2 || tot >= this.maxSign) continue;
      const m = this.signMeshes[poi.ci], n = cnt[poi.ci]; if (n >= 60) continue;
      const w = poi.key === 'sizo' ? 5 : 3.6; const y = (pl.F0 || 0) + 2.75 + (poi.key === 'sizo' ? 0.4 : 0);
      this._q.setFromAxisAngle(this._up, Math.atan2(d.nx, d.nz)); this._p.set(d.mx + d.nx * 0.09, y + 0.45, d.mz + d.nz * 0.09); this._s.set(w, w / 4, 1);
      this._m.compose(this._p, this._q, this._s); m.setMatrixAt(n, this._m); cnt[poi.ci]++; tot++;
      if (KIT_FOR[poi.key]) this.kits.add(poi.key, d, pl.F0 || 0);
    }
    this.kits.end();
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
