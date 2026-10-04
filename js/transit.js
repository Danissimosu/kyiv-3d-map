// Kyiv public transport from the real GTFS feed (Київпастранс), compiled by tools/build_transit.py into tiles/transit.json:
// stops (shelter + sign), schedule-driven instanced trams/buses/trolleybuses along map-matched route shapes, riding, driver jobs.
import * as THREE from 'three';
import { $, UI, el, tap, toast, panel } from './ui.js';

const COL = { 0: 0xa01818, 3: 0x1565c0, 11: 0x2e8b4a }, TNAME = { 0: 'Трамвай', 3: 'Автобус', 11: 'Тролейбус' }, TICON = { 0: '🚋', 3: '🚌', 11: '🚎' };
const FARE = 8, BL = 11.8, UNIT = 14.4, TL = 28.8, LAT = 1.8, DWELL = 22, ATLAS_C = 8, ATLAS_R = 21, SIGN_C = 4, SIGN_R = 8;
const CAPV = { d: [8, 14, 24, 40], m: [5, 9, 14, 22] }, RADV = { d: [200, 280, 360, 450], m: [150, 200, 240, 280] };
const CAPS = { d: [10, 16, 24, 32], m: [8, 12, 18, 26] }, RADS = { d: [130, 180, 240, 300], m: [100, 140, 180, 220] };
const rnd = (a, b) => a + Math.random() * (b - a);
const fmt = t => { t = ((t % 86400) + 86400) % 86400; return String(Math.floor(t / 3600)).padStart(2, '0') + ':' + String(Math.floor(t / 60) % 60).padStart(2, '0'); };

// ---------------------------------------------------------------- tiny merged-box geometry builder (vertex colours)
class GB {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.u = []; }
  add(g, col) {
    const base = this.p.length / 3, pa = g.attributes.position.array, na = g.attributes.normal.array, c = new THREE.Color(col);
    for (let k = 0; k < pa.length; k += 3) { this.p.push(pa[k], pa[k + 1], pa[k + 2]); this.n.push(na[k], na[k + 1], na[k + 2]); this.c.push(c.r, c.g, c.b); }
    if (g.attributes.uv) for (const v of g.attributes.uv.array) this.u.push(v);
    for (const v of g.index.array) this.i.push(v + base); return this;
  }
  box(w, h, d, x, y, z, col, rx = 0) { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z); return this.add(g, col); }
  build(uv) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setIndex(this.i); return g;
  }
}
const W = 0xffffff, WIN = 0x1c2630, DARK = 0x16181b;
function busGeo(trolley) {   // model space: +z forward, door (right) side is local -x
  const b = new GB(), L = BL;
  b.box(2.5, 1.1, L, 0, 0.85, 0, W); b.box(2.52, 1.0, L - 0.3, 0, 1.9, 0, WIN); b.box(2.46, 0.5, L, 0, 2.65, 0, W);
  b.box(2.3, 0.3, L - 0.6, 0, 0.35, 0, 0x30343a); b.box(1.6, 0.22, 2.6, 0, 3.0, -1.2, 0x9aa0a6);
  for (const z of [3.5, -3.0]) for (const x of [-1.1, 1.1]) b.box(0.32, 1.0, 1.0, x, 0.5, z, DARK);
  b.box(0.5, 0.18, 0.06, 0.8, 0.8, L / 2 + 0.01, 0xfff2b0); b.box(0.5, 0.18, 0.06, -0.8, 0.8, L / 2 + 0.01, 0xfff2b0);
  b.box(0.5, 0.18, 0.06, 0.8, 0.8, -L / 2 - 0.01, 0xd02020); b.box(0.5, 0.18, 0.06, -0.8, 0.8, -L / 2 - 0.01, 0xd02020);
  if (trolley) for (const x of [-0.45, 0.45]) b.box(0.07, 0.07, 6.2, x, 3.1 + 1.55, -3.6 - 2.7, 0x222222, 0.5).box(0.1, 0.1, 0.5, x, 3.1, -3.6, 0x222222);
  return b.build();
}
function tramGeo() {
  const b = new GB(), L = UNIT - 0.3;
  b.box(2.4, 1.05, L, 0, 0.9, 0, W); b.box(2.42, 1.0, L - 0.3, 0, 1.92, 0, WIN); b.box(2.36, 0.45, L, 0, 2.65, 0, W);
  b.box(2.2, 0.3, L, 0, 0.45, 0, 0x30343a);
  for (const z of [4.3, -4.3]) b.box(2.0, 0.45, 2.4, 0, 0.28, z, 0x222222);
  b.box(1.5, 0.2, 2.4, 0, 3.0, 1.0, 0x9aa0a6);
  b.box(0.06, 0.5, 0.06, 0, 3.35, 1.0, 0x222222).box(1.0, 0.05, 0.06, 0, 3.62, 1.0, 0x222222);
  b.box(0.5, 0.18, 0.06, 0.8, 0.8, UNIT / 2 - 0.1, 0xfff2b0); b.box(0.5, 0.18, 0.06, -0.8, 0.8, UNIT / 2 - 0.1, 0xfff2b0);
  return b.build();
}
function shelterGeo() {    // open side faces local +z (towards the road)
  const b = new GB();
  b.box(3.4, 0.1, 1.7, 0, 2.5, 0, 0x2b3f57); b.box(3.2, 1.6, 0.05, 0, 1.4, -0.7, 0xa9c9d6); b.box(0.05, 1.6, 1.3, -1.6, 1.4, -0.05, 0xa9c9d6); b.box(0.05, 1.6, 1.3, 1.6, 1.4, -0.05, 0xa9c9d6);
  for (const x of [-1.62, 1.62]) b.box(0.08, 2.5, 0.08, x, 1.25, -0.7, 0x333a42), b.box(0.08, 2.5, 0.08, x, 1.25, 0.7, 0x333a42);
  b.box(2.6, 0.08, 0.45, 0, 0.5, -0.45, 0x7a5a38); b.box(2.2, 0.35, 0.03, 0, 1.4, -0.66, 0xffffff);
  return b.build();
}
function plateGeo(w, h, two) {
  const g = new GB(), a = new THREE.PlaneGeometry(w, h);
  if (two) { const b = new THREE.PlaneGeometry(w, h); b.rotateY(Math.PI); b.translate(0, 0, -0.03); a.translate(0, 0, 0.03); g.add(a, W).add(b, W); } else g.add(a, W);
  return g.build(true);
}
function interiorGeo(L) {
  const b = new GB(), SEAT = 0x2f5d9a, WALL = 0xc9ced4;
  b.box(2.4, 0.08, L, 0, 0.75, 0, 0x4a4d52); b.box(2.4, 0.06, L, 0, 2.6, 0, 0xeeeeee); b.box(0.9, 0.02, L - 0.4, 0, 2.565, 0, 0xfff7d6);
  for (const s of [-1, 1]) {
    b.box(0.08, 0.7, L, s * 1.2, 1.15, 0, WALL); b.box(0.08, 0.3, L, s * 1.2, 2.45, 0, WALL);
    for (let z = -L / 2 + 0.8; z < L / 2 - 0.5; z += 1.7) b.box(0.1, 0.8, 0.12, s * 1.2, 1.9, z, 0xb4bac1);
  }
  b.box(2.4, 1.0, 0.1, 0, 1.3, -L / 2, WALL); b.box(2.4, 0.3, 0.1, 0, 2.45, -L / 2, WALL);
  b.box(2.4, 0.8, 0.45, 0, 1.18, L / 2 - 0.25, 0x30343a); b.box(2.4, 0.3, 0.1, 0, 2.45, L / 2, WALL);   // dashboard + upper front frame (windscreen stays open)
  const dz1 = L / 2 - 2.5, dz2 = -L / 2 + 3.4;
  for (let z = -L / 2 + 1.3; z < L / 2 - 3.2; z += 1.45) {
    if (Math.abs(z - dz2) < 1.1 || Math.abs(z - dz1) < 1.1 || (L > 20 && Math.abs(Math.abs(z) - 3.0) < 1.7)) continue;
    b.box(0.85, 0.1, 0.5, 0.75, 1.2, z, SEAT).box(0.85, 0.55, 0.08, 0.75, 1.55, z - 0.27, SEAT).box(0.08, 0.4, 0.5, 1.1, 1.0, z, 0x30343a);
    b.box(0.45, 0.1, 0.5, -0.9, 1.2, z, SEAT).box(0.45, 0.55, 0.08, -0.9, 1.55, z - 0.27, SEAT);
  }
  for (let z = -L / 2 + 1; z < L / 2 - 1; z += 2.4) b.box(0.05, 1.85, 0.05, 0.0, 1.7, z, 0xffd24a);
  b.box(0.05, 0.05, L - 1, 0.35, 2.4, 0, 0xffd24a); b.box(0.05, 0.05, L - 1, -0.35, 2.4, 0, 0xffd24a);
  b.box(0.5, 0.1, 0.5, 0.55, 1.1, L / 2 - 1.4, 0x222222).box(0.5, 0.55, 0.08, 0.55, 1.4, L / 2 - 1.62, 0x222222);   // driver seat
  b.box(0.38, 0.04, 0.38, 0.55, 1.6, L / 2 - 0.65, 0x111111, 0.8);
  return b.build();
}
function atlasMat(map, cols, rows) {
  const m = new THREE.MeshBasicMaterial({ map, side: THREE.FrontSide });
  m.onBeforeCompile = s => { s.vertexShader = 'attribute vec2 aCell;\n' + s.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * vec2(${(1 / cols).toFixed(6)}, ${(1 / rows).toFixed(6)}) + aCell;\n#endif`); };
  return m;
}
const mkCanvasTex = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return { c, g: c.getContext('2d'), t }; };

export class Transit {
  constructor(world, scene, ctx) {
    this.world = world; this.scene = scene; this.ctx = ctx; this.P = ctx.P; this.loaded = false; this.mob = !!ctx.IS_TOUCH; this.level = ctx.getLevel ? ctx.getLevel() : 3;
    this.show = { stops: true, veh: true }; this.filt = new Set([0, 3, 11]); this.veh = new Map(); this.act = []; this.near = []; this.ride = null; this.drive = null; this.t1 = 9; this.t2 = 9;
    this.stopInst = []; this.cells = new Map(); this.cellOrder = []; this.sigSet = ''; this.Q0 = new THREE.Quaternion(); this.M = new THREE.Matrix4(); this.M2 = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.V = new THREE.Vector3(); this.S1 = new THREE.Vector3(1, 1, 1); this.UP = new THREE.Vector3(0, 1, 0);
    this.disabled = ctx.qs.get('transit') === '0';
    // game clock: real Kyiv time unless ?clock=HH:MM ; ?clockrate=N speed-up ; ?day=wd|we
    const qs = ctx.qs; let wk = 0, T = 0;
    try { const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()), g = k => parts.find(p => p.type === k)?.value;
      wk = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(g('weekday')); T = (+g('hour')) * 3600 + (+g('minute')) * 60 + (+g('second')); } catch (e) { const d = new Date(); wk = (d.getDay() + 6) % 7; T = d.getHours() * 3600 + d.getMinutes() * 60; }
    if (qs.has('clock')) { const m = qs.get('clock').split(':'); T = (+m[0]) * 3600 + (+m[1] || 0) * 60; }
    if (ctx.clock) { wk = ctx.clock.wk; T = ctx.clock.t; }   // global game clock (60x); vehicles themselves move in real time, see update()
    this.cT = T; this.wk = Math.max(0, wk); this.rate = qs.has('trate') ? parseFloat(qs.get('trate')) : (qs.get('clockrate') === '0' ? 0 : 1); this.dayForce = qs.get('day'); this.last = performance.now();
  }
  get busy() { return !!(this.ride || this.drive); }
  get day() { return this.dayForce === 'wd' || this.dayForce === 'we' ? this.dayForce : (this.wk >= 5 ? 'we' : 'wd'); }
  setLevel(l) { this.level = l; }
  async load(base) {
    if (this.disabled) return;
    let d; try { const r = await fetch(base + 'transit.json'); if (!r.ok) throw new Error(r.status); d = await r.json(); } catch (e) { console.warn('transit.json missing', e); return; }
    this.stops = d.stops.map((s, i) => ({ i, x: s[0], z: s[1], name: s[3], routes: s[4], type: 3, face: 0, ty: 0, sx: s[0], sz: s[1], px: s[0], pz: s[1], pre: s.length >= 8 ? [s[5], s[6], s[7]] : null, pats: [] }));
    this.shapes = d.shapes.map(sh => { const p = sh.p, n = p.length / 2, x = new Float32Array(n), z = new Float32Array(n), cum = new Float32Array(n); let a = p[0], b = p[1]; x[0] = a / 10; z[0] = b / 10;
      for (let i = 1; i < n; i++) { a += p[2 * i]; b += p[2 * i + 1]; x[i] = a / 10; z[i] = b / 10; cum[i] = cum[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]); } return { x, z, cum, n }; });
    const dc = a => { const o = new Uint16Array(a.length); let acc = 0; for (let i = 0; i < a.length; i++) { acc += a[i]; o[i] = acc; } return o; };
    this.routes = d.routes.map((r, i) => {
      const c = new THREE.Color(COL[r.t]), h = { h: 0, s: 0, l: 0 }; c.getHSL(h); const q = (i * 0.618) % 1; c.setHSL(h.h + (q - 0.5) * 0.05, Math.min(1, h.s * (0.85 + 0.3 * ((q * 7) % 1))), h.l * (0.85 + 0.3 * ((q * 13) % 1)));
      const ro = { i, id: r.id, n: r.n, t: r.t, name: r.name, col: c, dirs: [] };
      for (const dd of r.dirs) { const dir = { idx: ro.dirs.length, ro, sh: this.shapes[dd.sh], len: dd.len, to: dd.to, pats: [] };
        for (const p of dd.pat) { const n = p.a.length, si = p.a.map(a => a[0]), s = new Float32Array(p.a.map(a => a[1])), off = new Float32Array(p.a.map(a => a[2])), leave = new Float32Array(n);
          for (let k = 0; k < n; k++) { if (k === 0 || k === n - 1) { leave[k] = off[k]; continue; } leave[k] = off[k] + Math.min(DWELL, (off[k + 1] - off[k]) * 0.4); }
          const pat = { dir, si, s, off, leave, n, dur: off[n - 1], wd: dc(p.wd), we: dc(p.we) }; dir.pats.push(pat);
          si.forEach((sx, k) => this.stops[sx].pats.push({ pat, k })); }
        ro.dirs.push(dir); }
      return ro; });
    // stop orientation / shelter and sign placement from the first route passing the stop
    for (const st of this.stops) {
      st.type = st.routes.length ? this.routes[st.routes[0]].t : 3; const ref = st.pats[0]; if (!ref) continue;
      const sh = ref.pat.dir.sh, a = this._at(sh, ref.pat.s[ref.k]), b = this._at(sh, ref.pat.s[ref.k] + 4); let tx = b.x - a.x, tz = b.z - a.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      let fx = a.x - st.x, fz = a.z - st.z; const cd = Math.hypot(fx, fz); if (cd < 0.6) { fx = tz; fz = -tx; } else { fx /= cd; fz /= cd; }
      const want = Math.max(cd, 5.4), px = st.x - fx * Math.max(0, want - cd) , pz = st.z - fz * Math.max(0, want - cd);
      if (st.pre) { st.sx = st.pre[0]; st.sz = st.pre[1]; st.face = st.pre[2]; st.signYaw = Math.atan2(tx, tz); st.px = st.sx + tx * 2.7; st.pz = st.sz + tz * 2.7; st.rx = a.x; st.rz = a.z; continue; }   // kerb-side placement from tools/place_stops.py
      st.face = Math.atan2(fx, fz); st.sx = px; st.sz = pz; st.signYaw = Math.atan2(tx, tz); st.px = px + tx * 2.7; st.pz = pz + tz * 2.7; st.rx = a.x; st.rz = a.z;
    }
    for (const st of this.stops) if (st.sx !== undefined) this.world.addPole('*', st.sx, st.sz, 1.1);   // shelters are solid for cars
    this._buildGfx(); this._ui(); this.loaded = true;
    this.scan(true);
  }
  // ---------------------------------------------------------------- geometry along a shape
  _find(sh, s) { const c = sh.cum; let lo = 0, hi = sh.n - 1; if (s <= 0) return 0; if (s >= c[hi]) return hi - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; } return lo; }
  _at(sh, s, o = {}) { const i = this._find(sh, s), L = sh.cum[i + 1] - sh.cum[i], t = L > 1e-6 ? Math.max(0, Math.min(1, (s - sh.cum[i]) / L)) : 0; o.x = sh.x[i] + (sh.x[i + 1] - sh.x[i]) * t; o.z = sh.z[i] + (sh.z[i + 1] - sh.z[i]) * t; o.i = i; return o; }
  _pose(sh, s, lat, o) {   // centre point with lateral offset to the right of travel, yaw from the chord s-4 .. s+4
    const a = this._at(sh, Math.max(0, s - 4)), b = this._at(sh, s + 4), c = this._at(sh, s, o); let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    o.yaw = Math.atan2(dx, dz); o.x = c.x - dz * lat; o.z = c.z + dx * lat; return o;
  }
  // schedule state of a trip: s along the shape, doors flag, segment / dwell index
  _state(pat, tt, o) {
    const n = pat.n, off = pat.off, lv = pat.leave, S = pat.s; o.seg = 0; o.dw = -1; o.doors = false; o.moving = false;
    if (tt <= off[0]) { o.s = S[0]; o.doors = true; o.dw = 0; return o; }
    if (tt >= off[n - 1]) { o.s = S[n - 1]; o.doors = true; o.dw = n - 1; o.seg = n - 1; return o; }
    for (let k = 0; k < n - 1; k++) {
      if (tt < lv[k]) { o.s = S[k]; o.doors = true; o.dw = k; o.seg = k; return o; }
      if (tt < off[k + 1]) { const u = (tt - lv[k]) / (off[k + 1] - lv[k]), e = 0.5 * u + 0.5 * u * u * (3 - 2 * u); o.s = S[k] + (S[k + 1] - S[k]) * e; o.seg = k; o.moving = true; return o; }
    }
    o.s = S[n - 1]; return o;
  }
  // ---------------------------------------------------------------- active trips (1 Hz): every vehicle in the city, positions for the minimap
  scan(force) {
    const day = this.day, T = this.cT, seen = new Set(), P = this.P; this.act.length = 0;
    for (const ro of this.routes) for (const dir of ro.dirs) for (let pi = 0; pi < dir.pats.length; pi++) {
      const pat = dir.pats[pi], arr = pat[day]; if (!arr.length) continue;
      for (let bs = 0; bs < 2; bs++) {
        const Tx = T + bs * 86400, lo = (Tx - pat.dur - 1800) / 60, hi = (Tx + 120) / 60; let a = 0, b = arr.length;
        while (a < b) { const m = (a + b) >> 1; if (arr[m] < lo) a = m + 1; else b = m; }
        for (let j = a; j < arr.length && arr[j] <= hi; j++) {
          const key = ro.i + '.' + dir.idx + '.' + pi + '.' + arr[j] + '.' + bs; let v = this.veh.get(key);
          if (!v) { v = { key, ro, dir, pat, t0: arr[j] * 60 - bs * 86400, st: {}, hasY: false, y: 0, yaw: 0, lyaw: null }; this.veh.set(key, v); }
          this._upd(v, T, false);
          // layover at the terminus: a vehicle that finished its trip waits 6 min with open doors (and stays up to 30 min while the player is nearby);
          // it also appears 2 min before departing. So nothing vanishes in front of the player.
          if (v.tt > pat.dur + 30 && v.tt > pat.dur + 360 && Math.hypot(v.x - P.x, v.z - P.z) > 150) { this.veh.delete(key); continue; }
          seen.add(key); this.act.push(v);
        }
      }
    }
    for (const k of [...this.veh.keys()]) if (!seen.has(k)) { const v = this.veh.get(k); if (this.ride && this.ride.v === v) { this._exit(true); } this.veh.delete(k); }
    // near set
    const lv = this.level, R = (this.mob ? RADV.m : RADV.d)[lv], cap = (this.mob ? CAPV.m : CAPV.d)[lv], px = P.x, pz = P.z;
    const c = [], prev = this.near; for (const v of this.act) { if (!this.filt.has(v.ro.t)) continue; const d = Math.hypot(v.x - px, v.z - pz), was = prev.includes(v); if (d < R * (was ? 1.2 : 1)) { v.dp = d * (was ? 0.75 : 1); c.push(v); } }   // hysteresis: a vehicle already drawn is not swapped out at the cap/radius edge
    c.sort((a, b) => a.dp - b.dp); this.near = c.slice(0, cap); if (this.ride && !this.near.includes(this.ride.v)) this.near.push(this.ride.v);
  }
  _upd(v, T, full) {
    const tt = T - v.t0, st = v.st; this._state(v.pat, tt, st); v.s = st.s; v.doors = st.doors; v.seg = st.seg; v.dw = st.dw; v.moving = st.moving; v.tt = tt;
    const lat = v.ro.t === 0 ? 0 : LAT;
    if (full) { const o = this._pose(v.dir.sh, v.s, lat, v.st); v.x = o.x; v.z = o.z; v.yaw = o.yaw; } else { const c = this._at(v.dir.sh, v.s, v.st); v.x = c.x; v.z = c.z; }
  }
  _initY(v) {   // bridge-safe start height: walk back along the route to a deck-free point, then follow ground/decks forward (same rule as normal driving)
    const w = this.world, sh = v.dir.sh, step = 25; let k = 0;
    for (; k < 60; k++) { const sp = Math.max(0, v.s - k * step), c = this._at(sh, sp), h = w.heightAt(c.x, c.z); if (!w.deckAt || w.deckAt(c.x, c.z, h + 70) < -1e8 || sp <= 0) break; }
    let sp = Math.max(0, v.s - k * step), c = this._at(sh, sp), y = w.heightAt(c.x, c.z) + 0.1;
    if (k === 60 || (k > 0 && sp <= 0)) { const d = w.deckAt(c.x, c.z, y + 70); if (d > -1e8) y = d + 0.1; }
    while (sp < v.s) { sp = Math.min(v.s, sp + step); c = this._at(sh, sp); const h = w.heightAt(c.x, c.z) + 0.1, d = w.deckAt(c.x, c.z, y + 1.4); y = d > -1e8 && d + 0.1 > h - 0.5 ? d + 0.1 : h; }
    v.y = y; v.hasY = true;
  }
  _groundY(v, dt) {
    const w = this.world; if (!v.hasY) { this._initY(v); return; }
    const h = w.heightAt(v.x, v.z) + 0.1; let ty = h; const d = w.deckAt(v.x, v.z, v.y + 1.4); if (d > -1e8 && d + 0.1 > h - 0.5) ty = d + 0.1;
    v.y += (ty - v.y) * Math.min(1, dt * 8);
  }
  // ---------------------------------------------------------------- graphics
  _buildGfx() {
    const sc = this.scene, mob = this.mob, mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    const mk = (geo, material, cap, col) => { const m = new THREE.InstancedMesh(geo, material, cap); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); if (col) { m.setColorAt(0, new THREE.Color()); m.instanceColor.setUsage(THREE.DynamicDrawUsage); } sc.add(m); return m; };
    const CV = (mob ? CAPV.m : CAPV.d)[3], CS = (mob ? CAPS.m : CAPS.d)[3];
    this.mBus = mk(busGeo(false), mat, CV + 4, true); this.mTro = mk(busGeo(true), mat, CV + 4, true); this.mTram = mk(tramGeo(), mat, CV * 2 + 4, true);
    this.mDoor = mk(new THREE.BoxGeometry(0.07, 1.5, 1.1), new THREE.MeshBasicMaterial(), CV * 4 + 16, true);
    // route number plates (atlas)
    const A = this.plateAtlas = mkCanvasTex(1024, 1024), g = A.g; g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024); g.textAlign = 'center'; g.textBaseline = 'middle';
    this.routes.forEach((r, i) => { const cx = (i % ATLAS_C) * 128, cy = Math.floor(i / ATLAS_C) * 48; g.fillStyle = '#05070a'; g.fillRect(cx, cy, 128, 48); g.fillStyle = '#ffb21a'; let fs = 40; g.font = `bold ${fs}px sans-serif`; while (g.measureText(r.n).width > 118 && fs > 14) { fs -= 2; g.font = `bold ${fs}px sans-serif`; } g.fillText(r.n, cx + 64, cy + 26); r.cell = [(i % ATLAS_C) / ATLAS_C, 1 - (Math.floor(i / ATLAS_C) + 1) / ATLAS_R]; });
    A.t.needsUpdate = true;
    const pg = plateGeo(1.3, 0.48, false); pg.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array((CV * 3 + 16) * 2), 2)); this.mPlate = mk(pg, atlasMat(A.t, ATLAS_C, ATLAS_R), CV * 3 + 16, false); this.mPlate.geometry.attributes.aCell.setUsage(THREE.DynamicDrawUsage);
    // stops
    const sg = shelterGeo(); this.mShelter = mk(sg, mat, CS, false);
    const pole = new GB().box(0.09, 3.4, 0.09, 0, 1.7, 0, 0x8d949b).box(1.9, 0.07, 0.05, 0, 3.4, 0, 0x2b3f57).build(); this.mPole = mk(pole, mat, CS, false);
    const S = this.signAtlas = mkCanvasTex(1024, 1024); S.g.fillStyle = '#123f77'; S.g.fillRect(0, 0, 1024, 1024); S.t.needsUpdate = true;
    const sp = plateGeo(1.8, 0.9, true); sp.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(CS * 2), 2)); sp.attributes.aCell.setUsage(THREE.DynamicDrawUsage); this.mSign = mk(sp, atlasMat(S.t, SIGN_C, SIGN_R), CS, false);
    this.mSign.material.side = THREE.FrontSide;
    // interiors (one mesh each, shown only while riding / driving)
    const im = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    this.intBus = new THREE.Mesh(interiorGeo(BL), im); this.intTram = new THREE.Mesh(interiorGeo(TL), im);
    for (const m of [this.intBus, this.intTram]) { m.visible = false; m.frustumCulled = false; sc.add(m); }
  }
  _signCell(st) {
    let c = this.cells.get(st.i); if (c !== undefined) { this.cellOrder.splice(this.cellOrder.indexOf(st.i), 1); this.cellOrder.push(st.i); return c; }
    const used = new Set(this.cells.values()); let cell = -1; for (let k = 0; k < SIGN_C * SIGN_R; k++) if (!used.has(k)) { cell = k; break; }
    if (cell < 0) { const old = this.cellOrder.shift(); cell = this.cells.get(old); this.cells.delete(old); }
    this.cells.set(st.i, cell); this.cellOrder.push(st.i); this._drawSign(cell, st); return cell;
  }
  _drawSign(cell, st) {
    const A = this.signAtlas, g = A.g, x = (cell % SIGN_C) * 256, y = Math.floor(cell / SIGN_C) * 128; g.save(); g.beginPath(); g.rect(x, y, 256, 128); g.clip();
    g.fillStyle = '#123f77'; g.fillRect(x, y, 256, 128); g.fillStyle = '#' + COL[st.type].toString(16).padStart(6, '0'); g.fillRect(x, y, 256, 8); g.fillRect(x, y + 120, 256, 8);
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'; let fs = 32; const nm = st.name, mw = 238; g.font = `bold ${fs}px sans-serif`; while (g.measureText(nm).width > mw && fs > 22) { fs -= 1; g.font = `bold ${fs}px sans-serif`; }
    let lines = [nm]; if (g.measureText(nm).width > mw) { fs = 22; g.font = `bold ${fs}px sans-serif`; const w = nm.split(' '); let l1 = ''; let i = 0; while (i < w.length && g.measureText((l1 + ' ' + w[i]).trim()).width <= mw) l1 = (l1 + ' ' + w[i++]).trim(); const l2 = w.slice(i).join(' '); lines = l2 ? [l1 || w[0], l2] : [l1]; for (let q = 0; q < lines.length; q++) { let t = lines[q]; while (t.length > 3 && g.measureText(t).width > mw) t = t.slice(0, -2) + '…'; lines[q] = t; } }
    lines.forEach((t, q) => g.fillText(t, x + 8, y + (lines.length > 1 ? 26 + q * 25 : 36)));
    let cx = x + 8, cy = y + (lines.length > 1 ? 82 : 70); const rs = st.routes.slice().sort((a, b) => this.routes[a].t - this.routes[b].t || (parseInt(this.routes[a].n) || 0) - (parseInt(this.routes[b].n) || 0)); g.font = 'bold 20px sans-serif';
    let shown = 0; for (const ri of rs) { const r = this.routes[ri], w = g.measureText(r.n).width + 12; if (cx + w > x + 250) { cx = x + 8; cy += 27; if (cy > y + 108) break; } g.fillStyle = '#' + COL[r.t].toString(16).padStart(6, '0'); g.fillRect(cx, cy - 11, w, 23); g.fillStyle = '#fff'; g.fillText(r.n, cx + 6, cy + 1); cx += w + 4; shown++; }
    if (shown < rs.length) { g.fillStyle = '#ffd966'; g.fillText('+' + (rs.length - shown), Math.min(cx, x + 220), cy + 1); }
    g.restore(); A.t.needsUpdate = true;
  }
  _updateStops(P) {
    const lv = this.level, R = (this.mob ? RADS.m : RADS.d)[lv], cap = (this.mob ? CAPS.m : CAPS.d)[lv], c = [];
    if (this.show.stopsWorld !== false) for (const s of this.stops) { const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < R) c.push([d, s]); }
    c.sort((a, b) => a[0] - b[0]); const sel = c.slice(0, cap).map(o => o[1]), sig = sel.map(s => s.i).join(',');
    if (sig === this.sigSet) return; this.sigSet = sig; const { M, Q, V, S1, UP } = this; this.stopInst = sel;
    const ca = this.mSign.geometry.attributes.aCell.array;
    sel.forEach((s, k) => {
      const hy = this.world.heightAt(s.sx, s.sz); Q.setFromAxisAngle(UP, s.face); V.set(s.sx, hy, s.sz); M.compose(V, Q, S1); this.mShelter.setMatrixAt(k, M);
      const py = this.world.heightAt(s.px, s.pz); V.set(s.px, py, s.pz); Q.setFromAxisAngle(UP, s.signYaw); M.compose(V, Q, S1); this.mPole.setMatrixAt(k, M);
      V.set(s.px, py + 2.95, s.pz); M.compose(V, Q, S1); this.mSign.setMatrixAt(k, M);
      const cell = this._signCell(s); ca[2 * k] = (cell % SIGN_C) / SIGN_C; ca[2 * k + 1] = 1 - (Math.floor(cell / SIGN_C) + 1) / SIGN_R;
    });
    for (const m of [this.mShelter, this.mPole, this.mSign]) { m.count = sel.length; m.instanceMatrix.needsUpdate = true; } this.mSign.geometry.attributes.aCell.needsUpdate = true;
  }
  // ---------------------------------------------------------------- per-frame
  update(P, dt) {
    if (!this.loaded) return;
    const now = performance.now(); const hold = this.boardP && this.boardP.isOpen;   // the doors stay open while the player decides about the ticket
    if (!hold) this.cT += (now - this.last) / 1000 * this.rate; this.last = now;
    const gc = this.ctx.clock;   // follow the game clock's weekday / time-of-day period (vehicles keep real-time speed: at 60x they would move at ~300 m/s)
    if (gc && this.rate === 1 && ((this.rs = (this.rs || 0) + dt) > 2)) { this.rs = 0; let df = ((gc.t - this.cT) % 86400 + 86400) % 86400; if (df > 43200) df -= 86400;
      if (((gc.wk >= 5) !== (this.wk >= 5) || Math.abs(df) > 6 * 3600) && !this.busy && !this.near.some(v => Math.hypot(v.x - P.x, v.z - P.z) < 160)) { this.cT = gc.t; this.wk = gc.wk; this.veh.clear(); this.t1 = 9; } }   // silent: only while nobody rides and no vehicle is in sight
    if (this.cT >= 86400) { this.cT -= 86400; this.wk = (this.wk + 1) % 7; if (this.ride) this._exit(true); this.veh.clear(); this.t1 = 9; }   // real-time midnight (once per 24 real hours)
    this.t1 += dt; if (this.t1 > (this.rate > 5 ? 0.25 : 1)) { this.t1 = 0; this.scan(); }
    this.t2 += dt; if (this.t2 > 0.4) { this.t2 = 0; this._updateStops(P); }
    if (this.busy) { const g = this.ctx.game, c = g.crime; if (g.dead || (c && (c.jail || c.driving))) this.abort(true); else if (this.ls && Math.hypot(P.x - this.ls[0], P.z - this.ls[1]) > 25) { this._cancel(); } }
    if (this.drive) this._driveStep(P, dt);
    const { M, M2, Q, V, UP } = this; let nb = 0, nt = 0, nr = 0, nd = 0, np = 0; const pa = this.mPlate.geometry.attributes.aCell.array, T = this.cT, ONE = this.S1, DS = this.S2 || (this.S2 = new THREE.Vector3());
    const hide = this.ride ? this.ride.v : this.drive ? this.drive.v : null;
    const list = this.drive ? this.near.concat([this.drive.v]) : this.near;
    for (const v of list) {
      if (!this.drive || v !== this.drive.v) this._upd(v, T, true);
      this._groundY(v, dt); if (v.lyaw !== null) { let d = v.yaw - v.lyaw; d = Math.atan2(Math.sin(d), Math.cos(d)); v.yaw = v.lyaw + d * Math.min(1, dt * 10); } v.lyaw = v.yaw;
      if (v === hide) continue;
      const tram = v.ro.t === 0, units = tram ? 2 : 1, mesh = tram ? this.mTram : v.ro.t === 11 ? this.mTro : this.mBus;
      for (let u = 0; u < units; u++) {
        let o = v; if (u === 1) { o = this._pose(v.dir.sh, Math.max(0, v.s - UNIT), 0, {}); o.y = v.y; }
        const idx = tram ? nt++ : (v.ro.t === 11 ? nr++ : nb++); Q.setFromAxisAngle(UP, o.yaw); V.set(o.x, o.y, o.z); M.compose(V, Q, ONE); mesh.setMatrixAt(idx, M); mesh.setColorAt(idx, v.ro.col);
        const hl = (tram ? UNIT : BL) / 2, dz = tram ? [hl - 3.0, hl - 9.4] : [hl - 2.2, -hl + 3.4], ph = tram ? 2.95 : 2.7, cell = v.ro.cell;
        for (const z of dz) { M2.compose(V.set(-1.27, 1.6, z), this.Q0, DS.set(1, 1, v.doors ? 0.45 : 1)); M2.premultiply(M); this.mDoor.setMatrixAt(nd, M2); this.mDoor.setColorAt(nd, v.doors ? OPENC : SHUT); nd++; }
        const put = (lx, ly, lz, ry) => { Q.setFromAxisAngle(UP, ry); M2.compose(V.set(lx, ly, lz), Q, ONE); M2.premultiply(M); this.mPlate.setMatrixAt(np, M2); pa[2 * np] = cell[0]; pa[2 * np + 1] = cell[1]; np++; };
        if (u === 0) put(0, ph - 0.25, hl + 0.02, 0); if (u === units - 1) put(0, ph - 0.25, -hl - 0.02, Math.PI); if (u === 0) put(-1.27, 2.3, hl - 3.8, -Math.PI / 2);
      }
    }
    for (const [m, n] of [[this.mBus, nb], [this.mTro, nr], [this.mTram, nt], [this.mDoor, nd], [this.mPlate, np]]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.mPlate.geometry.attributes.aCell.needsUpdate = true;
    if (this.ride) this._rideStep(P, dt);
    if (this.hudEl) this._hud();
  }
}
const OPENC = new THREE.Color(0x050505), SHUT = new THREE.Color(0x7fb2dd);

// ================================================================ UI, riding, driving, map hooks
Object.assign(Transit.prototype, {
  _ui() {
    const g = this.ctx.game; this.hudEl = el('div', '', '', document.body);
    this.hudEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom));z-index:6;display:none;background:rgba(10,16,24,.6);color:#fff;font:600 ' + (this.mob ? 11 : 12) + 'px/1.3 -apple-system,system-ui,sans-serif;padding:4px 9px;border-radius:10px;text-align:center;max-width:' + (this.mob ? 46 : 60) + 'vw;pointer-events:none';
    this.bSkip = el('div', 'gbtn', '⏭', document.body); this.bSkip.title = 'Пропустить перегон'; this.bSkip.style.cssText = g.bInv.style.cssText + ';display:none'; this.bSkip.style.right = 'calc(290px + env(safe-area-inset-right))'; this.bSkip.style.setProperty('--slot', 3); this.bSkip.classList.add('slot'); this.bSkip.style.opacity = '.75';
    tap(this.bSkip, () => this.skip());
    this.boardP = panel('boardP', '🚏 Посадка'); this.stopP = panel('stopP', '🚏 Остановка');
    g.transit = this; g.providers.unshift((P) => this.provider(P)); g.providers.push((P) => this.stopProvider(P));
    const prev = g.onRespawn; g.onRespawn = () => { prev && prev(); this.abort(true); };
  },
  hudLine() { return this.loaded ? `🕒 ${fmt(this.cT)} ${this.day === 'we' ? 'вых.' : 'будни'}${this.rate !== 1 ? ' ×' + this.rate : ''} · транспорт: ${this.act.length} на линии, ${this.near.length} рядом, ${this.stopInst.length} ост.` : ''; },
  // ---------------------------------------------------------------- next departures
  nextDeps(st, n = 6, maxMin = 90) {
    const out = [], T = this.cT, day = this.day;
    for (const { pat, k } of st.pats) {
      if (k === pat.n - 1) continue; const arr = pat[day], off = pat.off[k], want = (T - off) / 60; let a = 0, b = arr.length;
      while (a < b) { const m = (a + b) >> 1; if (arr[m] < want) a = m + 1; else b = m; }
      for (let j = a, c = 0; j < arr.length && c < 2; j++, c++) { const t = arr[j] * 60 + off, dm = (t - T) / 60; if (dm > maxMin) break; out.push({ ro: pat.dir.ro, to: pat.dir.to, t, dm }); }
    }
    out.sort((a, b) => a.t - b.t); const seen = new Set(), res = []; for (const o of out) { const k = o.ro.i + '|' + o.to + '|' + Math.round(o.t / 60); if (seen.has(k)) continue; seen.add(k); res.push(o); if (res.length >= n) break; } return res;
  },
  // ---------------------------------------------------------------- E action
  _reach(v, P) {   // distance from the player to the vehicle body (box in vehicle space)
    const L = (v.ro.t === 0 ? TL : BL) / 2, cs = Math.cos(v.yaw), sn = Math.sin(v.yaw); let cx = v.x, cz = v.z; if (v.ro.t === 0) { cx -= sn * UNIT / 2; cz -= cs * UNIT / 2; }
    const dx = P.x - cx, dz = P.z - cz, lz = dx * sn + dz * cs, lx = dx * cs - dz * sn;
    return Math.hypot(Math.max(0, Math.abs(lx) - 1.3), Math.max(0, Math.abs(lz) - L));
  },
  provider(P) {
    if (!this.loaded || UI.modal) return null;
    if (this.drive) return this.doorProvider();
    if (this.ride) { const v = this.ride.v; return v.doors ? { label: 'Выйти', run: () => this._exit() } : null; }
    if (this.game_busy()) return null;
    let best = null, bd = 4.2;
    for (const v of this.near) { if (!v.doors || !this.filt.has(v.ro.t)) continue; const d = this._reach(v, P); if (d < bd) { bd = d; best = v; } }
    if (best) return { label: `Сесть: ${TICON[best.ro.t]} ${best.ro.n} → ${best.dir.to}`, run: () => this.boardPanel(best) };
    return null;
  },
  stopProvider(P) {
    if (!this.loaded || UI.modal || this.busy || this.game_busy()) return null;
    let bs = null, bd = 7; for (const s of this.stopInst) { const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd) { bd = d; bs = s; } }
    if (bs) return { label: `🚏 ${bs.name} — расписание`, run: () => this.stopInfo(bs) };
    return null;
  },
  game_busy() { const c = this.ctx.game.crime; return !!(c && (c.driving || c.jail)) || this.ctx.game.dead; },
  stopInfo(st) {
    const p = this.stopP; p.titleEl.textContent = '🚏 ' + st.name; const b = p.body; b.innerHTML = ''; const rs = st.routes.map(i => this.routes[i]);
    el('div', '', `<small style="opacity:.75">Маршруты: ${rs.map(r => TICON[r.t] + r.n).join(' · ')}<br>Расписание Київпастранс (контрольные остановки) · 🕒 ${fmt(this.cT)}</small>`, b);
    const deps = this.nextDeps(st, 10, 180); if (!deps.length) el('div', 'row', 'Ближайших рейсов нет', b);
    for (const d of deps) el('div', 'row', `<div class="t"><b>${TICON[d.ro.t]} ${d.ro.n} → ${d.to}</b><small>${fmt(d.t)} · ${d.dm < 1 ? 'сейчас' : 'через ' + Math.round(d.dm) + ' мин'}</small></div>`, b);
    tap(el('div', 'btn g', this.ctx.pois.track && this.ctx.pois.track.stop === st ? 'Снять метку' : 'Поставить метку', b), () => { this._trackStop(st); p.close(); }); p.open();
  },
  _trackStop(st) { const pois = this.ctx.pois; pois.setTrack(pois.track && pois.track.stop === st ? null : { x: st.x, z: st.z, name: st.name, cat: { icon: '🚏', sign: 'Остановка' }, group: 'stops', brand: COL[st.type], stop: st }); },
  boardPanel(v) {
    const p = this.boardP, g = this.ctx.game; p.titleEl.textContent = `${TICON[v.ro.t]} ${TNAME[v.ro.t]} ${v.ro.n}`; const b = p.body; b.innerHTML = '';
    el('div', 'row', `<div class="t"><b>→ ${v.dir.to}</b><small>${v.ro.name}<br>Баланс ₴${Math.floor(g.S.money)}</small></div>`, b);
    const buy = el('div', 'btn' + (g.S.money < FARE ? ' off' : ''), `Купить билет — ₴${FARE}`, b); buy.style.marginTop = '6px'; tap(buy, () => { if (g.S.money < FARE) { toast('Не хватает денег'); return; } p.close(); if (this.board(v, true)) g.pay(FARE); });
    const free = el('div', 'btn r', 'Ехать без билета (риск штрафа)', b); free.style.marginTop = '8px'; tap(free, () => { p.close(); this.board(v, false); });
    const c = el('div', 'btn g', 'Отмена', b); c.style.marginTop = '8px'; tap(c, () => p.close()); p.open();
  },
  board(v, ticket) {
    const P = this.P; if (!v.doors && !(v.tt - (v.pat.leave[v.seg] || 0) < 6 && v.moving && this._reach(v, P) < 6)) { toast('Двери уже закрылись — ждите следующий'); return false; }
    this.ls = null; P.fly = false; this.ride = { v, ticket, t: 0, ann: -1, arr: -1, insp: !ticket && Math.random() < 0.55 ? rnd(25, 80) : 1e9 }; this.cur = v;
    toast(ticket ? `🎫 Билет куплен (₴${FARE})` : '⚠ Без билета — возможен контролёр', 2800);
    this._announce(v, true); this.bSkip.style.display = 'flex'; P.yaw = v.yaw + Math.PI; P.pitch = 0; this._rideStep(P, 0);
    return true;
  },
  _announce(v, first) {
    const pat = v.pat, r = this.ride; if (!r) return; const k = v.moving ? v.seg : v.dw;
    if (v.moving && r.ann !== v.seg + 1) { r.ann = v.seg + 1; const nm = this.stops[pat.si[v.seg + 1]].name; toast(v.seg + 1 === pat.n - 1 ? `Наступна зупинка: ${nm} (кінцева)` : `Наступна зупинка: ${nm}`, 2800); }
    else if (!v.moving && k >= 1 && r.arr !== k) { r.arr = k; toast(k === pat.n - 1 ? `Кінцева зупинка: ${this.stops[pat.si[k]].name}. Просимо вийти` : `🚏 ${this.stops[pat.si[k]].name}`, 3200); }
    else if (first && !v.moving && k < pat.n - 1 && r.ann !== k + 1) { r.ann = k + 1; toast(`Наступна зупинка: ${this.stops[pat.si[k + 1]].name}`, 3600); }
  },
  _seat(v, P, lx, lz, eyeAbove) {
    const tram = v.ro.t === 0, int = tram ? this.intTram : this.intBus; let c = v; if (tram) c = this._pose(v.dir.sh, Math.max(0, v.s - UNIT / 2), 0, {}); c.y = v.y;
    this.ls = [P.x, P.z]; int.visible = true; int.position.set(c.x, v.y, c.z); int.rotation.y = c.yaw; this.cInt = int;
    this.V.set(lx, 0, lz).applyAxisAngle(this.UP, c.yaw); P.x = c.x + this.V.x; P.z = c.z + this.V.z; P.y = v.y + 0.79 - 1.7 + eyeAbove; P.vx = P.vz = P.vy = 0; P.grounded = true; this.ls = [P.x, P.z];
  },
  _cancel() {   // the player was teleported away (map tap / debug): leave the vehicle where they are
    this.ride = null; this.drive = null; this.cur = null; this.ls = null; this.intBus.visible = this.intTram.visible = false; this.bSkip.style.display = 'none';
  },
  _rideStep(P, dt) {
    const r = this.ride, v = r.v; r.t += dt; const tram = v.ro.t === 0;
    this._seat(v, P, -0.35, tram ? 8 : 0.4, 1.45); this._announce(v);
    if (r.t > r.insp) { r.insp = 1e9; const fine = Math.min(150, Math.floor(this.ctx.game.S.money)); this.ctx.game.pay(fine); r.ticket = true; toast(`🕵 Контролёр: билет? Штраф ₴${fine}`, 4200); }
    if (v.dw === v.pat.n - 1 && v.tt > v.pat.dur + 12) this._exit(); else if (v.tt > v.pat.dur + 20) this._exit(true);
  },
  _exit(silent) {
    const r = this.ride; if (!r) return; const v = r.v, P = this.P; this.ride = null; this.cur = null; this.ls = null; this.intBus.visible = this.intTram.visible = false; this.bSkip.style.display = this.drive ? 'flex' : 'none';
    const cs = Math.cos(v.yaw), sn = Math.sin(v.yaw); let cx = v.x - (v.ro.t === 0 ? sn * UNIT / 2 : 0), cz = v.z - (v.ro.t === 0 ? cs * UNIT / 2 : 0);
    P.x = cx - cs * 3.4; P.z = cz + sn * 3.4; const gy = this.world.groundAt(P.x, P.z, v.y + 1.2); P.y = Math.max(gy, this.world.heightAt(P.x, P.z)) + 0.05; P.eye = P.y + 1.7; P.vx = P.vz = P.vy = 0; P.yaw = v.yaw + Math.PI + 1.57; P.pitch = 0;
    if (!silent) toast('Вы вышли из транспорта');
  },
  skip() {
    const r = this.ride, v = r ? r.v : null; if (!v) { if (this.drive) toast('Едьте к следующей остановке'); return; }
    const pat = v.pat; let k = v.moving ? v.seg + 1 : Math.min(v.dw + 1, pat.n - 1); if (!v.moving && v.dw === pat.n - 1) return; const target = v.t0 + pat.off[k] - 2.5; if (target > this.cT) this.cT = target;
    this.t1 = 9; toast('⏭ Перегон пропущен');
  },
  abort(silent) { if (this.ride) this._exit(true); if (this.drive) this.stopDriving('abort', silent); },
  _hud() {
    let t = '';
    if (this.ride) { const v = this.ride.v, k = v.moving ? v.seg + 1 : Math.min(v.dw + 1, v.pat.n - 1); t = `${TICON[v.ro.t]} ${v.ro.n} → ${v.dir.to}<br>${v.moving || v.dw < v.pat.n - 1 ? 'След.: ' + this.stops[v.pat.si[k]].name : 'Конечная'} · 🕒 ${fmt(this.cT)}`; }
    else if (this.drive) { const d = this.drive; const nx = d.pat.si[d.k + 1] !== undefined ? this.stops[d.pat.si[d.k + 1]].name : '—', dist = Math.max(0, d.pat.s[d.k + 1] - d.s);
      t = `${TICON[d.ro.t]} Маршрут ${d.ro.n} → ${d.dir.to}<br>След.: ${nx} · ${Math.round(dist)} м · ${Math.round(Math.abs(d.vel) * 3.6)} км/ч · заработано ₴${d.earned}${d.hold > 0 ? '<br>🚪 Посадка пассажиров…' : ''}`; }
    if (t !== this._ht) { this._ht = t; this.hudEl.innerHTML = t; this.hudEl.style.display = t ? 'block' : 'none'; }
  },
  // ---------------------------------------------------------------- map markers + places list
  drawMarkers(g, W, H, cx, cz, k, big) {
    if (!this.loaded) return; const x0 = cx - W / 2 / k - 20, x1 = cx + W / 2 / k + 20, z0 = cz - H / 2 / k - 20, z1 = cz + H / 2 / k + 20;
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    if (this.show.stops && k >= (big ? 0.07 : 0.12)) { const r = big ? (k > 0.3 ? 4.5 : 3) : 2.6;
      for (const s of this.stops) { if (s.x < x0 || s.x > x1 || s.z < z0 || s.z > z1) continue; if (!s.routes.some(i => this.filt.has(this.routes[i].t))) continue;
        const sx = W / 2 + (s.x - cx) * k, sy = H / 2 + (s.z - cz) * k; g.fillStyle = '#' + COL[s.type].toString(16).padStart(6, '0'); g.strokeStyle = '#fff'; g.lineWidth = 1; g.fillRect(sx - r, sy - r, 2 * r, 2 * r); g.strokeRect(sx - r, sy - r, 2 * r, 2 * r);
        if (big && k > 0.45) { g.font = '10px sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(s.name, sx, sy + 11); g.fillStyle = '#fff'; g.fillText(s.name, sx, sy + 11); } } }
    if (this.show.veh && k >= (big ? 0.025 : 0.0)) { const r = big ? (k > 0.2 ? 5 : 3.2) : 3;
      for (const v of this.act) { if (v.x < x0 || v.x > x1 || v.z < z0 || v.z > z1 || !this.filt.has(v.ro.t)) continue; const sx = W / 2 + (v.x - cx) * k, sy = H / 2 + (v.z - cz) * k;
        g.fillStyle = '#' + COL[v.ro.t].toString(16).padStart(6, '0'); g.strokeStyle = '#fff'; g.lineWidth = 1.3; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill(); g.stroke();
        if (big && k > 0.2) { g.font = 'bold 10px sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(v.ro.n, sx, sy - 9); g.fillStyle = '#fff'; g.fillText(v.ro.n, sx, sy - 9); } } }
    g.restore();
  },
  fillStops(list, pn, redraw) {   // body of the «🚏 Остановки» tab of the Places panel
    const row = el('div', 'chips', '', list);
    const tg = (txt, on, fn) => tap(el('span', 'chip' + (on ? ' on' : ''), txt, row), () => { fn(); redraw(); });
    tg('🗺 Остановки на карте', this.show.stops, () => { this.show.stops = !this.show.stops; }); tg('🚌 Транспорт на карте', this.show.veh, () => { this.show.veh = !this.show.veh; });
    const row2 = el('div', 'chips', '', list); for (const t of [0, 3, 11]) tap(el('span', 'chip' + (this.filt.has(t) ? ' on' : ''), TICON[t] + ' ' + TNAME[t], row2), () => { this.filt.has(t) ? this.filt.delete(t) : this.filt.add(t); this.t1 = 9; this.sigSet = ''; redraw(); });
    const P = this.P, arr = this.stops.filter(s => s.routes.some(i => this.filt.has(this.routes[i].t))).map(s => [Math.hypot(s.x - P.x, s.z - P.z), s]).sort((a, b) => a[0] - b[0]).slice(0, 40);
    el('div', '', `<small style="opacity:.65">Реальные остановки Київпастранс (контрольные пункты расписания) · 🕒 ${fmt(this.cT)}</small>`, list);
    for (const [d, s] of arr) {
      const r = el('div', 'row', '', list), nums = s.routes.slice(0, 8).map(i => this.routes[i].n).join(', ') + (s.routes.length > 8 ? '…' : '');
      el('div', 't', `<b>🚏 ${s.name}</b><small>${d < 1000 ? d.toFixed(0) + ' м' : (d / 1000).toFixed(1) + ' км'} · ${nums}</small>`, r);
      tap(el('span', 'btn g', 'метка', r), () => { this._trackStop(s); redraw(); }); tap(el('span', 'btn', 'ТП', r), () => { pn.close(); this.ctx.teleport(s.sx + Math.sin(s.face) * 3, s.sz + Math.cos(s.face) * 3, s.face + Math.PI, 0); });
    }
  },
  fillPhone(div) {
    div.innerHTML = ''; const P = this.P; el('div', '', `<small style="opacity:.7">🕒 ${fmt(this.cT)} · ${this.day === 'we' ? 'выходной' : 'будни'}</small>`, div);
    const arr = this.stops.map(s => [Math.hypot(s.x - P.x, s.z - P.z), s]).sort((a, b) => a[0] - b[0]).slice(0, 4);
    for (const [d, s] of arr) { const deps = this.nextDeps(s, 4, 120);
      el('div', 'row', `<div class="t"><b>🚏 ${s.name}</b><small>${Math.round(d)} м · ${deps.length ? deps.map(x => `${x.ro.n} ${x.dm < 1 ? 'сейчас' : Math.round(x.dm) + ' мин'}`).join(' · ') : 'нет рейсов в ближайшие 2 ч'}</small></div>`, div); }
  },
  // ---------------------------------------------------------------- driver job (arcade): follow the real route, stop at the real stops
  startDriving(poi) {
    const type = poi.key === 'tram' ? 0 : 3; let best = null;
    for (const ro of this.routes) if (ro.t === type) for (const dir of ro.dirs) {
      const pat = dir.pats.reduce((a, b) => (b.s[b.n - 1] - b.s[0] > a.s[a.n - 1] - a.s[0] ? b : a)); if (pat.n < 3 && dir.pats.length > 1) continue;
      let k0 = 0, dm = 1e9; for (let k = 0; k < pat.n - 1; k++) { const st = this.stops[pat.si[k]], d = Math.hypot(st.x - poi.x, st.z - poi.z); if (d < dm) { dm = d; k0 = k; } }
      k0 = Math.max(k0, pat.n - 4); const score = dm - Math.min(pat.n, 8) * 120; if (!best || score < best.score) best = { ro, dir, pat, k: k0, dm, score };
    }
    if (!best) { toast('Нет подходящего маршрута'); return false; }
    const { ro, dir, pat, k } = best, P = this.P; if (this.ride) this._exit(true);
    const v = { key: 'drv', ro, dir, pat, t0: 0, st: {}, hasY: false, y: 0, yaw: 0, lyaw: null, s: Math.max(0, pat.s[k] - 14), doors: false, moving: false, drv: true, dw: -1, seg: 0, tt: 0 };
    const o = this._pose(dir.sh, v.s, ro.t === 0 ? 0 : LAT, {}); Object.assign(v, { x: o.x, z: o.z, yaw: o.yaw }); this.drive = { v, ro, dir, pat, k, s: v.s, vel: 0, hold: 0, earned: 0, served: 0, poi, t: 0 };
    this.cur = v; this.ls = null; P.fly = false; P.yaw = v.yaw + Math.PI; P.pitch = 0; this.ctx.teleport(v.x, v.z); this.bSkip.style.display = 'none'; this.cInt = null;
    toast(`${TICON[ro.t]} Маршрут ${ro.n} → ${dir.to}. W — газ, S — тормоз. На каждой остановке встаньте в зоне и откройте двери (кнопка E); пропуск — штраф`, 5200); return true;
  },
  doorProvider() {   // "open doors" button: only when standing still in the stop zone
    const d = this.drive; if (!d || d.hold > 0 || d.k >= d.pat.n - 1) return null; const dist = d.pat.s[d.k + 1] - d.s;
    if (Math.abs(dist) < 9 && d.vel < 0.5) return { label: 'Открыть двери (остановка ' + this.stops[d.pat.si[d.k + 1]].name + ')', run: () => this._openDoors() };
    return null;
  },
  _openDoors() {
    const d = this.drive; if (!d || d.hold > 0 || d.k >= d.pat.n - 1) return; const dist = d.pat.s[d.k + 1] - d.s; if (Math.abs(dist) >= 9 || d.vel >= 0.5) { toast('Остановитесь в зоне остановки'); return; }
    const j = this.jobs, prec = Math.abs(dist) < 3; d.hold = 4.5; d.vel = 0; d.k++; d.served++; if (j) j.addBonus(prec ? 14 : 6, prec ? 'Точная остановка' : 'Остановка');
    toast(`🚏 ${this.stops[d.pat.si[d.k]].name}${prec ? ' · точно' : ''}`, 2200);
  },
  _nextTrip(d) {   // terminus reached: turn round (opposite direction) or restart the line
    const ro = d.ro, dir = ro.dirs.length > 1 ? ro.dirs[(d.dir.idx + 1) % ro.dirs.length] : d.dir;
    const pat = dir.pats.reduce((a, b) => (b.s[b.n - 1] - b.s[0] > a.s[a.n - 1] - a.s[0] ? b : a));
    d.dir = dir; d.pat = pat; d.k = 0; d.s = pat.s[0]; d.vel = 0; d.v.dir = dir; d.v.pat = pat; toast(`Конечная. Разворот → ${dir.to}`, 3200);
  },
  _driveStep(P, dt) {
    const d = this.drive, v = d.v, K = this.ctx.keys, T = this.ctx.T, tram = d.ro.t === 0; d.t += dt;
    let thr = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0); if (this.ctx.IS_TOUCH && Math.abs(T.jy) > 0.15) thr = -T.jy;
    const brake = K.Space || T.jump, vmax = tram ? 15 : 16.5; let nextS = d.pat.s[d.k + 1]; const dist = nextS - d.s;
    if (d.hold > 0) { d.hold -= dt; d.vel = 0; v.doors = true; if (d.hold <= 0) { v.doors = false; if (d.k >= d.pat.n - 1) this._nextTrip(d); } }
    else {
      let a = thr > 0 ? (tram ? 2.0 : 2.4) * thr : thr < 0 ? 4.6 : -0.5; if (thr === 0 && d.vel < 0.3) { d.vel = 0; a = 0; }
      let vm = vmax; if (dist < 90 && dist > -12 && thr <= 0) vm = Math.min(vm, Math.sqrt(2 * 2.6 * Math.max(0, dist - 0.8)) + 0.05);   // coasting: the approach assist brakes to the stop; holding the throttle overrides it
      d.vel += a * dt; if (brake) d.vel = Math.max(0, d.vel - 6 * dt); d.vel = Math.max(0, Math.min(d.vel, vm));
      d.s += d.vel * dt; const last = d.pat.s[d.pat.n - 1]; if (d.s > last) { d.s = last; d.vel = 0; }
      if (nextS !== undefined && d.k < d.pat.n - 1 && d.s > nextS + 12) {   // drove past the stop without opening the doors
        d.skipped = (d.skipped || 0) + 1; if (this.jobs) this.jobs.addPen(40, 'Пропуск остановки'); d.k++;
        if (d.k >= d.pat.n - 1) { d.hold = 2.5; }
      }
    }
    v.s = d.s; const o = this._pose(d.dir.sh, d.s, tram ? 0 : LAT, v.st); v.x = o.x; v.z = o.z; v.yaw = o.yaw; v.moving = d.vel > 0.2; this._groundY(v, dt); v.lyaw = null;
    this._seat(v, P, 0.55, (tram ? TL : BL) / 2 - 1.35, 1.1);
  },
  stopDriving(why, silent) {
    const d = this.drive; if (!d) return; const P = this.P; this.drive = null; this.cur = null; this.ls = null; this.intBus.visible = this.intTram.visible = false; this.bSkip.style.display = 'none';
    if (this.jobs) this.jobs.onDriveEnd(why);
    const pl = d.poi && d.poi.pl; if (pl && pl.tile && pl.tile.alive && why !== 'abort') this.ctx.gotoDoor(pl, 4.5); else if (why !== 'abort') this.ctx.teleport(d.poi.x + 12, d.poi.z + 12);
    else { const gy = this.world.heightAt(d.v.x, d.v.z); P.y = gy + 0.1; P.eye = P.y + 1.7; }
  },
});
