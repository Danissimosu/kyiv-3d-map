// Living city: statistically simulated population (manifest.pop) + traffic on the real OSM road network.
// Only a nearby subset is rendered: pedestrians (instanced low-poly humanoids, walk cycle in the vertex shader),
// people inside active interiors, instanced cars lane-following the road polylines, and distant traffic as moving light points.
import * as THREE from 'three';
import { CarFleet, CAR_MODELS, pickCarModel } from './design.js';

const CLS_SPEED = [0, 5, 8.5, 11, 14, 17, 21];            // m/s by road class (0 = footway ... 6 = motorway/trunk)
const CLS_DENS = [0, 7, 13, 22, 30, 40, 52];               // cars per km of road, by class (before the local-population factor)
const CAR_COLS = [0xd9d9d9, 0xf2f2f2, 0x2b2f36, 0x15181c, 0x7b8794, 0xa31f24, 0x1f4e8c, 0x3d6b3a, 0xc9a227, 0x6b3b1e, 0xb8bcc2, 0xe4e4e0, 0x8c1c13, 0x2d4a6e];
const SHIRT = [0xc0392b, 0x2c5aa0, 0x2e7d4f, 0xe0b030, 0x8e44ad, 0x444a52, 0xe8e8e8, 0xd35400, 0x16a085, 0x7f8c8d, 0x1f2a44, 0xb8860b];
const PANTS = [0x20242c, 0x2f3b52, 0x4a4036, 0x6b6b6b, 0x14181e, 0x3a4a3a, 0x56463a];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const keyOf = (x, z) => Math.round(x / 1.5) + ',' + Math.round(z / 1.5);

function humanoidGeometry() {
  const parts = [];
  const add = (w, h, d, x, y, z, id, pivot, col) => {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
    const n = g.attributes.position.count, pa = new Float32Array(n * 2), ca = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pa[2 * i] = id; pa[2 * i + 1] = pivot; ca[3 * i] = col[0]; ca[3 * i + 1] = col[1]; ca[3 * i + 2] = col[2]; }
    g.setAttribute('aPart', new THREE.BufferAttribute(pa, 2)); g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g.deleteAttribute('uv'); parts.push(g);
  };
  const skin = [0.86, 0.68, 0.55], w = [1, 1, 1];
  add(0.22, 0.24, 0.22, 0, 1.64, 0, 0, 0, skin);               // head
  add(0.42, 0.58, 0.24, 0, 1.2, 0, 1, 0, w);                    // torso (shirt tint)
  add(0.11, 0.55, 0.12, -0.27, 1.2, 0, 2, 1.46, w);             // arms (shirt tint), pivot at the shoulder
  add(0.11, 0.55, 0.12, 0.27, 1.2, 0, 3, 1.46, w);
  add(0.16, 0.86, 0.17, -0.1, 0.43, 0, 4, 0.88, [0.9, 0.9, 0.9]); // legs (trouser tint), pivot at the hip
  add(0.16, 0.86, 0.17, 0.1, 0.43, 0, 5, 0.88, [0.9, 0.9, 0.9]);
  const m = parts[0]; const merged = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'aPart', 'color']) { const arrs = parts.map(g => g.attributes[k]); const sz = arrs[0].itemSize; const tot = arrs.reduce((s, a) => s + a.count, 0); const out = new Float32Array(tot * sz); let o = 0; for (const a of arrs) { out.set(a.array, o); o += a.array.length; } merged.setAttribute(k, new THREE.BufferAttribute(out, sz)); }
  let off = 0; const idx = []; for (const g of parts) { for (const i of g.index.array) idx.push(i + off); off += g.attributes.position.count; } merged.setIndex(idx);
  return merged;
}

function carGeometry() {
  const parts = [];
  const box = (w, h, d, x, y, z, col) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); const n = g.attributes.position.count, ca = new Float32Array(n * 3); for (let i = 0; i < n; i++) { ca[3 * i] = col[0]; ca[3 * i + 1] = col[1]; ca[3 * i + 2] = col[2]; } g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g.deleteAttribute('uv'); parts.push(g); };
  box(1.8, 0.62, 4.3, 0, 0.62, 0, [1, 1, 1]);            // body (tinted by instanceColor)
  box(1.55, 0.5, 2.1, 0, 1.17, -0.15, [0.85, 0.9, 0.95]); // cabin
  box(1.58, 0.36, 1.9, 0, 1.2, -0.15, [0.12, 0.15, 0.2]); // glass band
  for (const sx of [-0.86, 0.86]) for (const sz of [-1.35, 1.35]) box(0.22, 0.56, 0.56, sx, 0.28, sz, [0.05, 0.05, 0.06]);
  const merged = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'color']) { const arrs = parts.map(g => g.attributes[k]); const sz = arrs[0].itemSize; const tot = arrs.reduce((s, a) => s + a.count, 0); const out = new Float32Array(tot * sz); let o = 0; for (const a of arrs) { out.set(a.array, o); o += a.array.length; } merged.setAttribute(k, new THREE.BufferAttribute(out, sz)); }
  let off = 0; const idx = []; for (const g of parts) { for (const i of g.index.array) idx.push(i + off); off += g.attributes.position.count; } merged.setIndex(idx);
  return merged;
}

export class City {
  constructor(world, scene, manifest, opts = {}) {
    this.world = world; this.scene = scene; this.man = manifest; this.mob = !!opts.mobile;
    this.paths = new Map();        // id -> path
    this.tilePaths = new Map();    // tile key -> [path]
    this.nodes = new Map();        // endpoint key -> [{path, end}]
    this.peds = []; this.cars = []; this.far = []; this.extra = [];   // extra: agents driven by crime.js (police)
    this.time = 0; this.level = 3; this.setLevel(3);
    this.pedMesh = this._pedMesh(); this.carMesh = this._carMesh(); this.farPts = this._farPoints();
    this.spawnT = 0; this.seenTiles = new Set(); this.interiorPeds = new Map();
    this.stats = { peds: 0, cars: 0, far: 0, inside: 0, popLocal: 0 };
    this.popTotal = manifest.pop ? manifest.pop.total : 0; this.popScale = manifest.pop ? manifest.pop.scale : 0;
    this.enabled = true;
  }
  // ---------------------------------------------------------------- quality (agent caps are tied to the quality governor)
  setLevel(l) {
    this.level = l;
    const M = this.mob;
    this.capPed = (M ? [12, 28, 48, 80] : [30, 70, 130, 200])[l];
    this.capCar = (M ? [6, 14, 24, 36] : [16, 36, 70, 110])[l];
    this.capFar = (M ? [0, 60, 120, 180] : [60, 160, 280, 400])[l];
    this.capIn = (M ? [0, 6, 12, 20] : [6, 16, 28, 40])[l];
    this.carR = (M ? [110, 150, 190, 230] : [160, 230, 290, 350])[l];
    this.pedR = (M ? [60, 80, 100, 120] : [80, 110, 140, 170])[l];
    if (this.pedMesh) { this.pedMesh.count = Math.min(this.pedMesh.count, this.capPed + this.capIn); }
  }
  _pedMesh() {
    const geo = humanoidGeometry(), N = 280;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    const uTime = { value: 0 }; this.uTime = uTime;
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aPart; attribute vec4 aAnim; attribute vec3 aShirt; attribute vec3 aPants; uniform float uTime;')
        .replace('#include <color_vertex>', `#include <color_vertex>
          float pid = aPart.x;
          if (pid > 0.5 && pid < 3.5) vColor.rgb *= aShirt; else if (pid > 3.5) vColor.rgb *= aPants;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          if (aAnim.y > 0.0 && pid > 1.5) {
            float sgn = (pid == 2.0 || pid == 5.0) ? 1.0 : -1.0;
            float a = sin(uTime * aAnim.y + aAnim.x) * (pid > 3.5 ? 0.62 : 0.5) * sgn * aAnim.z;
            float c = cos(a), s = sin(a), py = aPart.y;
            float yy = transformed.y - py, zz = transformed.z;
            transformed.y = py + yy * c - zz * s; transformed.z = yy * s + zz * c;
          }`);
      // pid must exist in the vertex-colour stage: declare it before use
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'float pid;\nvoid main() {');
      sh.vertexShader = sh.vertexShader.replace('float pid = aPart.x;', 'pid = aPart.x;');
    };
    mat.customProgramCacheKey = () => 'kyivPed';
    const m = new THREE.InstancedMesh(geo, mat, N); m.count = 0; m.frustumCulled = false;
    geo.setAttribute('aAnim', new THREE.InstancedBufferAttribute(this.animArr = new Float32Array(N * 4), 4));
    geo.setAttribute('aShirt', new THREE.InstancedBufferAttribute(this.shirtArr = new Float32Array(N * 3), 3));
    geo.setAttribute('aPants', new THREE.InstancedBufferAttribute(this.pantsArr = new Float32Array(N * 3), 3));
    this.scene.add(m); return m;
  }
  _carMesh() { this.fleet = new CarFleet(this.scene, this.mob ? 64 : 128); return this.fleet.meshes[0]; }   // 6 instanced models (design pack), see design.js
  _paint(c) { c.factory = Math.random() < CAR_MODELS[c.model].factory; if (c.factory) c.col.setHex(0xffffff); }   // factory paint = pack texture of the model; otherwise a neutral silver base tinted by c.col
  _farPoints() {
    const N = 420, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setDrawRange(0, 0);
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
    m.frustumCulled = false; this.scene.add(m); return m;
  }

  // ---------------------------------------------------------------- road network from loaded tiles
  _addTile(t) {
    const list = [];
    for (const r of t.roads) {
      if (typeof r.c !== 'number' || r.c < 0) continue;
      const p = r.p, n = p.length / 2; if (n < 2) continue;
      const pts = new Float32Array(p), cum = new Float32Array(n); let L = 0;
      for (let i = 1; i < n; i++) { L += Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]); cum[i] = L; }
      if (L < 3) continue;
      const path = { id: this._id = (this._id || 0) + 1, pts, cum, len: L, cls: r.c, w: r.w, y: r.b ? r.y : null, n, tile: t.key, oneway: r.w < 6 && r.c <= 2, bridge: !!r.b };
      this.paths.set(path.id, path); list.push(path);
      for (const end of [0, 1]) { const i = end ? n - 1 : 0, k = keyOf(pts[2 * i], pts[2 * i + 1]); let a = this.nodes.get(k); if (!a) this.nodes.set(k, a = []); a.push({ path, end }); }
    }
    this.tilePaths.set(t.key, list);
  }
  _dropTile(key) {
    const list = this.tilePaths.get(key); if (!list) return;
    for (const p of list) { this.paths.delete(p.id); for (const end of [0, 1]) { const i = end ? p.n - 1 : 0, k = keyOf(p.pts[2 * i], p.pts[2 * i + 1]), a = this.nodes.get(k); if (a) { const f = a.filter(e => e.path !== p); if (f.length) this.nodes.set(k, f); else this.nodes.delete(k); } } }
    this.tilePaths.delete(key);
    this.peds = this.peds.filter(a => a.inside || a.path.tile !== key); this.cars = this.cars.filter(c => c.player || c.path.tile !== key); this.far = this.far.filter(c => c.path.tile !== key);
  }
  _sync() {
    for (const [k, t] of this.world.tiles) if (t.roads && !this.tilePaths.has(k) && t.h) this._addTile(t);
    for (const k of [...this.tilePaths.keys()]) { const t = this.world.tiles.get(k); if (!t || !t.alive) this._dropTile(k); }
  }
  // position + heading at distance s along a path (with lateral offset to the right of travel when dir = +1 / left side when -1)
  static at(path, s, dir, off, out) {
    s = Math.max(0, Math.min(path.len, s)); const c = path.cum; let lo = 0, hi = path.n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
    const seg = c[hi] - c[lo] || 1, f = (s - c[lo]) / seg, x0 = path.pts[2 * lo], z0 = path.pts[2 * lo + 1], x1 = path.pts[2 * hi], z1 = path.pts[2 * hi + 1];
    let dx = (x1 - x0) / seg, dz = (z1 - z0) / seg; if (dir < 0) { dx = -dx; dz = -dz; }
    out.x = x0 + (x1 - x0) * f + (-dz) * off; out.z = z0 + (z1 - z0) * f + dx * off; out.dx = dx; out.dz = dz;
    out.y = path.y ? path.y[lo] + (path.y[hi] - path.y[lo]) * f : null; return out;
  }
  _astar(path, i0, k0, firstOpts, T) {
    const keyEnd = (p, atEnd) => { const j = atEnd ? p.n - 1 : 0; return keyOf(p.pts[2 * j], p.pts[2 * j + 1]); };
    const xz = (p, atEnd) => { const j = atEnd ? p.n - 1 : 0; return [p.pts[2 * j], p.pts[2 * j + 1]]; };
    const g = new Map([[k0, 0]]), first = new Map(), open = [[0, k0, 0]], pos = new Map(); let best = null, bh = 1e18, ex = 0;
    const h = (x, z) => Math.hypot(x - T.x, z - T.z);
    while (open.length && ex++ < 700) {
      let mi = 0; for (let q = 1; q < open.length; q++) if (open[q][0] < open[mi][0]) mi = q; const [, k] = open.splice(mi, 1)[0];
      const gk = g.get(k); const p0 = pos.get(k);
      if (p0) { const hh = h(p0[0], p0[1]); if (hh < bh) { bh = hh; best = k; } if (hh < 45) { best = k; break; } }
      const edges = k === k0 ? firstOpts : (this.nodes.get(k) || []);
      for (const e of edges) {
        if (e.path.cls < 1) continue; const fk = keyEnd(e.path, !e.end), ng = gk + e.path.len;
        if (g.has(fk) && g.get(fk) <= ng) continue; g.set(fk, ng); first.set(fk, k === k0 ? e : first.get(k)); const pp = xz(e.path, !e.end); pos.set(fk, pp); open.push([ng + h(pp[0], pp[1]) * 1.1, fk, ng]);
      }
    }
    return best ? first.get(best) || null : null;
  }
  _next(path, end, fromCls, toward) {   // choose a continuation at the path end (end: 1 = reached its end, 0 = reached its start)
    const i = end ? path.n - 1 : 0, k = keyOf(path.pts[2 * i], path.pts[2 * i + 1]), a = this.nodes.get(k); if (!a) return null;
    const opts = a.filter(e => e.path !== path && e.path.cls >= 1 && (fromCls < 1 ? e.path.cls < 2 : true));
    if (!opts.length) return null;
    if (toward) {   // police chase: A* over the junction graph towards the target (bounded), first edge of the best route
      const r = this._astar(path, i, k, opts, toward); if (r) return { e: r, deg: a.length };
    }
    const w = opts.map(e => 1 + (e.path.cls === path.cls ? 1.5 : 0) + e.path.cls * 0.2); let r = Math.random() * w.reduce((s, v) => s + v, 0);
    for (let j = 0; j < opts.length; j++) { r -= w[j]; if (r <= 0) return { e: opts[j], deg: a.length }; }
    return { e: opts[0], deg: a.length };
  }

  // ---------------------------------------------------------------- population statistics
  _localPop(px, pz, R) {   // residents statistically attributed to the circle of radius R (tile population x area share)
    const T = this.world.TILE; let s = 0;
    const i0 = Math.floor((px - R) / T), i1 = Math.floor((px + R) / T), j0 = Math.floor((pz - R) / T), j1 = Math.floor((pz + R) / T);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const e = this.world.manifestTiles.get(i + '_' + j); if (e && e[6]) s += e[6] * Math.min(1, Math.PI * R * R / (T * T)) * 0.6; }
    return s;
  }

  // ---------------------------------------------------------------- spawning
  _randomPoint(P, rMin, rMax, minCls, maxCls) {
    const T = this.world.TILE; const keys = []; const i0 = Math.floor((P.x - rMax) / T), i1 = Math.floor((P.x + rMax) / T), j0 = Math.floor((P.z - rMax) / T), j1 = Math.floor((P.z + rMax) / T);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = this.tilePaths.get(i + '_' + j); if (l) for (const p of l) if (p.cls >= minCls && p.cls <= maxCls && !p.bridge) keys.push(p); }
    if (!keys.length) return null;
    for (let tries = 0; tries < 24; tries++) {
      const p = keys[(Math.random() * keys.length) | 0]; if (Math.random() > 0.35 + p.len / 400) continue;
      const s = Math.random() * p.len, o = {}; City.at(p, s, 1, 0, o); const d = Math.hypot(o.x - P.x, o.z - P.z);
      if (d >= rMin && d <= rMax) return { path: p, s };
    }
    return null;
  }
  _spawnPed(P, near) {
    const pt = this._randomPoint(P, near ? 14 : this.pedR * 0.45, this.pedR, 0, 5); if (!pt) return false;
    const p = pt.path, side = Math.random() < 0.5 ? 1 : -1, off = p.cls === 0 ? rnd(-0.6, 0.6) : side * (p.w / 2 + rnd(1.0, 2.2));
    const a = { path: p, s: pt.s, dir: Math.random() < 0.5 ? 1 : -1, off, speed: rnd(1.0, 1.6), x: 0, y: 0, z: 0, yaw: 0, phase: Math.random() * 6.28, shirt: pick(SHIRT), pants: pick(PANTS), state: 'walk', t: 0, hp: 3, scale: rnd(0.92, 1.06) };
    this.peds.push(a); this._placePed(a); return true;
  }
  _placePed(a) { const o = City._o || (City._o = {}); City.at(a.path, a.s, a.dir, a.off * (a.dir), o); a.x = o.x; a.z = o.z; a.yaw = Math.atan2(o.dx, o.dz); a.y = a.path.y ? o.y : this.world.heightAt(a.x, a.z) + (a.path.cls >= 1 ? 0.2 : 0.05); }
  _spawnCar(P, parked) {
    const pt = this._randomPoint(P, parked ? 20 : this.carR * 0.4, this.carR, parked ? 1 : 1, parked ? 2 : 6); if (!pt) return false;
    const p = pt.path; if (p.cls < 1 || p.cls > 6 || (p.w < 3.2 && !parked)) return false;
    const dens = CLS_DENS[p.cls]; if (Math.random() > 0.2 + dens / 60) return false;
    const c = { path: p, s: pt.s, dir: Math.random() < 0.5 ? 1 : -1, speed: 0, vmax: CLS_SPEED[p.cls] * rnd(0.8, 1.1), col: new THREE.Color(pick(CAR_COLS)), wait: 0, x: 0, y: 0, z: 0, yaw: 0, parked, hp: 100, kind: Math.random() < 0.12 ? 'taxi' : 'car', model: pickCarModel() };
    this._paint(c); if (c.kind === 'taxi') { c.model = 5; c.factory = false; c.col.set(0xf1c40f); }
    if (parked) { c.s = pt.s; c.off = (p.w / 2 + 1.1) * (Math.random() < 0.5 ? 1 : -1); } else { c.off = p.oneway ? 0 : Math.max(1.4, p.w / 4); c.speed = c.vmax * 0.7; }
    this.cars.push(c); this._placeCar(c); return true;
  }
  spawnPolice(P) {   // a police car on a road 80-200 m away, driving along the road graph towards this.chaseTarget
    const pt = this._randomPoint(P, 80, Math.min(this.carR, 200), 2, 6) || this._randomPoint(P, 50, this.carR, 1, 6); if (!pt) return null;
    const p = pt.path, T = this.chaseTarget || P, o = {};
    const c = { path: p, s: pt.s, dir: 1, speed: 0, vmax: 21, col: new THREE.Color(0xffffff), wait: 0, x: 0, y: 0, z: 0, yaw: 0, parked: false, hp: 100, kind: 'police', police: true, model: 3, factory: false, off: p.oneway ? 0 : Math.max(1.4, p.w / 4) };
    City.at(p, 0, 1, 0, o); const d0 = Math.hypot(o.x - T.x, o.z - T.z); City.at(p, p.len, 1, 0, o); const d1 = Math.hypot(o.x - T.x, o.z - T.z);
    c.dir = d1 < d0 ? 1 : -1; if (p.oneway) c.dir = 1; c.speed = 8; this.cars.push(c); this._placeCar(c); return c;
  }
  _placeCar(c) {
    const o = City._o2 || (City._o2 = {}); City.at(c.path, c.s, c.dir, c.parked ? c.off * c.dir : c.off, o); c.x = o.x; c.z = o.z; c.yaw = Math.atan2(o.dx, o.dz);
    c.y = c.path.y ? o.y : this.world.heightAt(c.x, c.z) + 0.17;
  }

  // ---------------------------------------------------------------- per-frame update
  update(P, dt) {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.1); this.time += dt; this.uTime.value = this.time;
    this.spawnT += dt;
    if (this.spawnT > 0.4) { this.spawnT = 0; this._sync(); this._balance(P); this._interiorPeds(P); }
    this._simPeds(P, dt); this._simCars(P, dt); this._simFar(P, dt);
    this._upload();
  }
  _balance(P) {
    const pop = this._localPop(P.x, P.z, this.pedR); this.stats.popLocal = Math.round(pop);
    const wantPed = Math.min(this.capPed, Math.round(pop * 0.035));
    const outs = this.peds.filter(a => !a.inside);
    for (const a of outs) if (Math.hypot(a.x - P.x, a.z - P.z) > this.pedR + 25 && !a.pinned) a.dead = true;
    this.peds = this.peds.filter(a => !a.dead);
    let tries = 0; while (this.peds.filter(a => !a.inside).length < wantPed && tries++ < 4) this._spawnPed(P, false);
    // cars: density from the roads in range
    let km = 0; const T = this.world.TILE; const R = this.carR;
    for (let i = Math.floor((P.x - R) / T); i <= Math.floor((P.x + R) / T); i++) for (let j = Math.floor((P.z - R) / T); j <= Math.floor((P.z + R) / T); j++) { const l = this.tilePaths.get(i + '_' + j); if (l) for (const p of l) if (p.cls >= 1 && !p.bridge) km += p.len / 1000 * CLS_DENS[p.cls] * 0.25; }
    const wantCar = Math.min(this.capCar, Math.round(km * Math.min(1, 0.4 + pop / 800)));
    for (const c of this.cars) if (!c.player && Math.hypot(c.x - P.x, c.z - P.z) > R + 30) c.dead = true;
    this.cars = this.cars.filter(c => !c.dead);
    const moving = this.cars.filter(c => !c.parked && !c.player).length; tries = 0;
    while (moving + tries < wantCar && tries++ < 3) this._spawnCar(P, false);
    const wantPark = Math.min(this.mob ? [0, 6, 10, 14][this.level] : [4, 10, 18, 26][this.level], Math.round(pop / 60)), parkedN = this.cars.filter(c => c.parked).length;
    if (parkedN < wantPark) this._spawnCar(P, true);
    // distant light points on the main roads outside the car radius
    if (this.capFar > 0) {
      for (const f of this.far) if (Math.hypot(f.x - P.x, f.z - P.z) > this.world.loadR + 100 || Math.hypot(f.x - P.x, f.z - P.z) < this.carR * 0.7) f.dead = true;
      this.far = this.far.filter(f => !f.dead); tries = 0;
      while (this.far.length < this.capFar && tries++ < 6) {
        const pt = this._randomPoint(P, this.carR + 30, this.world.loadR, 3, 6); if (!pt) break;
        this.far.push({ path: pt.path, s: pt.s, dir: Math.random() < 0.5 ? 1 : -1, v: CLS_SPEED[pt.path.cls] * rnd(0.8, 1.1), x: 0, y: 0, z: 0, col: Math.random() < 0.5 ? 0 : 1 });
      }
    } else this.far.length = 0;
  }
  _interiorPeds(P) {   // people inside buildings: a few idle residents / customers per active interior
    const act = this.world.interiors.active;
    for (const [p, I] of act) {
      if (this.interiorPeds.has(p)) continue; if (this.peds.filter(a => a.inside).length >= this.capIn) break;
      const rooms = I.rooms; if (!rooms || !rooms.length) continue;
      const people = Math.min(4, Math.max(0, Math.round(Math.sqrt(p.area || 60) / 6 * Math.random() * (I.cat === 'living' ? 0.8 : 1.1))));
      const list = [];
      for (let k = 0; k < people; k++) {
        for (let tr = 0; tr < 10; tr++) {
          const r = rooms[(Math.random() * rooms.length) | 0], u = rnd(r.u0 + 0.8, r.u1 - 0.8), v = rnd(r.v0 + 0.8, r.v1 - 0.8); if (!(r.u1 - r.u0 > 1.8 && r.v1 - r.v0 > 1.8)) continue;
          const xz = I.toXZ(u, v); if (!I.inside_fn(xz[0], xz[1])) continue;
          const a = { inside: true, plan: p, x: xz[0], z: xz[1], y: I.F0, yaw: rnd(0, 6.28), phase: Math.random() * 6.28, shirt: pick(SHIRT), pants: pick(PANTS), state: 'idle', hp: 3, path: { tile: p.key }, scale: rnd(0.92, 1.05), t: 0 };
          this.peds.push(a); list.push(a); break;
        }
      }
      this.interiorPeds.set(p, list);
    }
    for (const [p, list] of [...this.interiorPeds]) if (!act.has(p)) { for (const a of list) a.dead = true; this.interiorPeds.delete(p); }
    if (this.peds.some(a => a.dead)) this.peds = this.peds.filter(a => !a.dead);
    this.stats.inside = this.peds.filter(a => a.inside).length;
  }
  _simPeds(P, dt) {
    const o = City._o || (City._o = {});
    for (const a of this.peds) {
      if (a.inside) continue;
      if (a.state === 'walk' || a.state === 'flee') {
        const sp = a.state === 'flee' ? 4.2 : a.speed; a.s += a.dir * sp * dt;
        // keep a respectful distance from the player on narrow paths: slow down slightly
        if (a.s <= 0 || a.s >= a.path.len) {
          const nx = this._next(a.path, a.s >= a.path.len ? 1 : 0, 0);
          if (nx && Math.random() < 0.85) { const e = nx.e; a.path = e.path; a.s = e.end ? e.path.len - 0.01 : 0.01; a.dir = e.end ? -1 : 1; if (e.path.cls !== 0) a.off = (Math.random() < 0.5 ? 1 : -1) * (e.path.w / 2 + rnd(1.0, 2.2)); else a.off = rnd(-0.6, 0.6); }
          else { a.dir = -a.dir; a.s = Math.max(0.01, Math.min(a.path.len - 0.01, a.s)); }
        }
        this._placePed(a);
      } else if (a.state === 'stagger' || a.state === 'down') { a.t += dt; if (a.t > (a.state === 'stagger' ? 0.6 : 2.5)) { a.state = a.fleeAfter ? 'flee' : 'walk'; a.t = 0; } }
    }
  }
  _simCars(P, dt) {
    const o = City._o2 || (City._o2 = {});
    for (const c of this.cars) {
      if (c.parked || c.player) continue;
      const p = c.path; let target = c.vmax;
      if (c.police && this.chaseTarget && Math.hypot(c.x - this.chaseTarget.x, c.z - this.chaseTarget.z) < 30) { target = 0; c.arrived = true; } else if (c.police && c.arrived) target = 0;
      // car following (same path & direction) + simple stop at junctions
      for (const d of this.cars) {
        if (d === c || d.path !== p || d.parked) continue;
        const gap = (d.s - c.s) * c.dir; if (gap > 0 && gap < 16 && (d.dir === c.dir)) target = Math.min(target, Math.max(0, (gap - 5.5) * 1.2));
      }
      const distEnd = c.dir > 0 ? p.len - c.s : c.s;
      if (c.wait > 0) { c.wait -= dt; target = 0; }
      else if (distEnd < 7 && p.cls <= 4 && !c.police) {
        const nxt = this.nodes.get(keyOf(p.pts[c.dir > 0 ? 2 * (p.n - 1) : 0], p.pts[c.dir > 0 ? 2 * (p.n - 1) + 1 : 1]));
        if (nxt && nxt.length >= 3 && !c.passed) { target = Math.min(target, Math.max(1.2, distEnd * 0.9)); if (distEnd < 1.8) { c.wait = rnd(0.7, 2.4); c.passed = true; } }
      }
      const acc = target > c.speed ? 3.0 : 7.0; c.speed += Math.sign(target - c.speed) * Math.min(Math.abs(target - c.speed), acc * dt);
      c.s += c.dir * c.speed * dt;
      if (c.s <= 0 || c.s >= p.len) {
        const nx = this._next(p, c.s >= p.len ? 1 : 0, 1, c.police ? this.chaseTarget : null);
        if (nx) { const e = nx.e; c.path = e.path; c.s = e.end ? e.path.len - 0.02 : 0.02; c.dir = e.end ? -1 : 1; c.passed = false; c.off = e.path.oneway ? 0 : Math.max(1.4, e.path.w / 4); c.vmax = c.police ? 21 : CLS_SPEED[e.path.cls] * rnd(0.8, 1.1); }
        else { c.dir = -c.dir; c.s = Math.max(0.02, Math.min(p.len - 0.02, c.s)); c.passed = false; }
      }
      this._placeCar(c);
    }
  }
  _simFar(P, dt) {
    const o = City._o3 || (City._o3 = {});
    for (const f of this.far) {
      f.s += f.dir * f.v * dt; const p = f.path;
      if (f.s <= 0 || f.s >= p.len) { const nx = this._next(p, f.s >= p.len ? 1 : 0, 3); if (nx && nx.e.path.cls >= 3) { f.path = nx.e.path; f.s = nx.e.end ? nx.e.path.len - 0.02 : 0.02; f.dir = nx.e.end ? -1 : 1; } else { f.dir = -f.dir; f.s = Math.max(0.02, Math.min(p.len - 0.02, f.s)); } }
      City.at(f.path, f.s, f.dir, f.path.w / 4, o); f.x = o.x; f.z = o.z; f.y = f.path.y ? o.y : this.world.heightAt(o.x, o.z) + 1.0;
    }
  }
  _upload() {
    // pedestrians
    const pm = this.pedMesh, M = this._m || (this._m = new THREE.Matrix4()), q = this._q || (this._q = new THREE.Quaternion()), pv = this._pv || (this._pv = new THREE.Vector3()), sv = this._sv || (this._sv = new THREE.Vector3()), up = this._up || (this._up = new THREE.Vector3(0, 1, 0)), qa = this._qa || (this._qa = new THREE.Quaternion()), xa = this._xa || (this._xa = new THREE.Vector3(1, 0, 0));
    let n = 0; const col = this._c || (this._c = new THREE.Color());
    for (const a of this.peds.concat(this.extra)) {
      if (n >= pm.instanceMatrix.count) break;
      q.setFromAxisAngle(up, a.yaw); let y = a.y;
      if (a.state === 'down') { qa.setFromAxisAngle(xa, -1.5); q.multiply(qa); y += 0.18; } else if (a.state === 'stagger') { qa.setFromAxisAngle(xa, -0.25); q.multiply(qa); }
      pv.set(a.x, y, a.z); sv.set(a.scale || 1, a.scale || 1, a.scale || 1); M.compose(pv, q, sv); pm.setMatrixAt(n, M);
      const moving = a.state === 'walk' || a.state === 'flee' || a.moving;
      this.animArr.set([a.phase, moving ? (a.state === 'flee' ? 11 : a.moving ? 3.2 * a.moving : 6.5 * (a.speed || 1.2)) : 0, (a.state === 'flee' || a.moving) ? 1.5 : 1, 0], n * 4);
      col.setHex(a.shirt); this.shirtArr.set([col.r, col.g, col.b], n * 3); col.setHex(a.pants); this.pantsArr.set([col.r, col.g, col.b], n * 3); n++;
    }
    pm.count = n; pm.instanceMatrix.needsUpdate = true;
    for (const k of ['aAnim', 'aShirt', 'aPants']) pm.geometry.attributes[k].needsUpdate = true;
    this.stats.peds = n;
    // cars
    const fl = this.fleet; n = 0; fl.begin();
    for (const c of this.cars) {
      if (c.hidden) continue;
      let pitch = 0; if (!c.path.y && c.pitchOn !== false) { const h2 = this.world.heightAt(c.x + Math.sin(c.yaw) * 1.8, c.z + Math.cos(c.yaw) * 1.8), h1 = this.world.heightAt(c.x - Math.sin(c.yaw) * 1.8, c.z - Math.cos(c.yaw) * 1.8); pitch = Math.atan2(h1 - h2, 3.6); }
      q.setFromAxisAngle(up, c.yaw); qa.setFromAxisAngle(xa, pitch * 0.8 + (c.tilt || 0)); q.multiply(qa);   // geometry front is +z
      pv.set(c.x, c.y, c.z); sv.set(1, 1, 1); M.compose(pv, q, sv);
      if (fl.add(c.model | 0, c.factory, c.dmg ? col.copy(c.col).multiplyScalar(0.7) : c.col, M)) n++;
    }
    fl.end(); this.stats.cars = n;
    // distant traffic as light points
    const pos = this.farPts.geometry.attributes.position, colA = this.farPts.geometry.attributes.color; n = 0;
    for (const f of this.far) { if (n >= pos.count) break; pos.setXYZ(n, f.x, f.y, f.z); if (f.col) colA.setXYZ(n, 1, 0.25, 0.2); else colA.setXYZ(n, 1, 0.95, 0.75); n++; }
    this.farPts.geometry.setDrawRange(0, n); pos.needsUpdate = true; colA.needsUpdate = true; this.stats.far = n;
  }
  hudLine() {
    const s = this.stats, f = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return `население: ${f(this.popTotal)} <span style="opacity:.7">(статистическая модель; рядом показано ${s.peds} чел. · ${s.cars} авто · ${s.far} огней вдали)</span>`;
  }
  nearestPed(x, z, r) { let b = null, bd = r * r; for (const a of this.peds) { const d = (a.x - x) ** 2 + (a.z - z) ** 2; if (d < bd) { bd = d; b = a; } } return b; }
  nearestCar(x, z, r) { let b = null, bd = r * r; for (const c of this.cars) { if (c.player) continue; const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < bd) { bd = d; b = c; } } return b; }
}
