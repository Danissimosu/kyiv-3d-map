// Living city: statistically simulated population (manifest.pop) + traffic on the real OSM road network.
// Only a nearby subset is rendered: pedestrians (instanced low-poly humanoids, walk cycle in the vertex shader),
// people inside active interiors, instanced cars lane-following the road polylines, and distant traffic as moving light points.
import * as THREE from 'three';
import { CarFleet, CAR_MODELS, pickCarModel } from './design.js';
import { isOpen, crowd, STAFF_K, CUST_K } from './venues.js';

const CLS_SPEED = [0, 5, 8.5, 11, 14, 17, 21];            // m/s by road class (0 = footway ... 6 = motorway/trunk)
const CLS_DENS = [0, 7, 13, 22, 30, 40, 52];               // cars per km of road, by class (before the local-population factor)
const CAR_COLS = [0xd9d9d9, 0xf2f2f2, 0x2b2f36, 0x15181c, 0x7b8794, 0xa31f24, 0x1f4e8c, 0x3d6b3a, 0xc9a227, 0x6b3b1e, 0xb8bcc2, 0xe4e4e0, 0x8c1c13, 0x2d4a6e];
const SHIRT = [0xc0392b, 0x2c5aa0, 0x2e7d4f, 0xe0b030, 0x8e44ad, 0x444a52, 0xe8e8e8, 0xd35400, 0x16a085, 0x7f8c8d, 0x1f2a44, 0xb8860b];
const PANTS = [0x20242c, 0x2f3b52, 0x4a4036, 0x6b6b6b, 0x14181e, 0x3a4a3a, 0x56463a];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const keyOf = (x, z) => Math.round(x / 1.5) + ',' + Math.round(z / 1.5);
// venue NPCs: staff in brand uniforms at the stations of service counters / checkouts, customers that come in through the door, queue / shop / sit
// and leave again (routes on a per-hall flow field), all following the opening hours and the hour-of-day crowd level (js/venues.js)
const VENUE = new Set(['sushi', 'market', 'fastfood', 'dining', 'diy', 'mcd', 'puzata', 'silpo', 'epicentr', 'apteka', 'kava']);
const UNIFORM = { mcd: [0xc8102e, 0x1b1b1d], silpo: [0xf27820, 0x2a2a2e], market: [0x2f6fc0, 0x1f2633], epicentr: [0x4caf3c, 0x2a2f2a], puzata: [0xf2efe6, 0x5a2a20], sushi: [0x1b1b1d, 0x1b1b1d], fastfood: [0xc0392b, 0x1b1b1d], dining: [0xf2efe6, 0x1b1b1d], diy: [0xe07a20, 0x2a2f2a], apteka: [0xf4f7f5, 0x2f7a52], kava: [0x4a3022, 0x1b1b1d], retail: [0x3d5a80, 0x22252a] };
// straight walk between two points of level k: free of solid furniture (uv footprints, margin m) and of the walls (polygon test)
export function venueWalkable(I, k, x0, z0, x1, z1, m = 0.3) {
  const R = (I.solidUV && I.solidUV[k]) || [], a = I.uvOf(x0, z0), b = I.uvOf(x1, z1), L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 0.25));
  for (let i = 1; i < n; i++) { const u = a[0] + (b[0] - a[0]) * i / n, v = a[1] + (b[1] - a[1]) * i / n; for (const r of R) if (u > r[0] - m && u < r[1] + m && v > r[2] - m && v < r[3] + m) return false;
    if (I.toXZ && I.inside_fn) { const q = I.toXZ(u, v); if (!I.inside_fn(q[0], q[1])) return false; } }
  if (I.pieces && I.pieces.length) for (const pc of I.pieces) if (!pc.l && segCross(x0, z0, x1, z1, pc.x1, pc.z1, pc.x2, pc.z2, 0.2)) return false;   // partition walls (doorways = lintel pieces stay open)
  return true;
}
// does segment A (a->b) pass within r of wall segment W (c->d)?  (proper crossing, or an endpoint of A closer than r to W)
const sd = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
export function segCross(ax, az, bx, bz, cx, cz, dx, dz, r) {
  const o = (px, pz, qx, qz, rx, rz) => Math.sign((qx - px) * (rz - pz) - (qz - pz) * (rx - px));
  if (o(ax, az, bx, bz, cx, cz) * o(ax, az, bx, bz, dx, dz) < 0 && o(cx, cz, dx, dz, ax, az) * o(cx, cz, dx, dz, bx, bz) < 0) return true;
  return sd(bx, bz, cx, cz, dx, dz) < r || sd(cx, cz, ax, az, bx, bz) < r * 0.5 || sd(dx, dz, ax, az, bx, bz) < r * 0.5;
}
export function venuePed(I, p, sp, staff) {
  const uni = UNIFORM[I.cat] || [0x334455, 0x222222];
  return { inside: true, plan: p, I, x: sp.x, z: sp.z, y: sp.y, yaw: sp.yaw || 0, phase: Math.random() * 6.28, shirt: staff ? uni[0] : pick(SHIRT), pants: staff ? uni[1] : pick(PANTS), state: 'idle', hp: 3, path: { tile: p.key }, scale: rnd(0.92, 1.05), t: 0, staff: !!staff, spot: null, wait: rnd(4, 14), moving: 0, venue: true };
}

function humanoidGeometry() {   // low-poly rounded figure (~420 tris): ellipsoid head, tapered torso / limbs, round hands; part ids drive tint + animation in the shader
  const parts = [];
  const push = (g, id, pivot, col) => {
    const n = g.attributes.position.count, pa = new Float32Array(n * 2), ca = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pa[2 * i] = id; pa[2 * i + 1] = pivot; ca[3 * i] = col[0]; ca[3 * i + 1] = col[1]; ca[3 * i + 2] = col[2]; }
    g.setAttribute('aPart', new THREE.BufferAttribute(pa, 2)); g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); parts.push(g);
  };
  const add = (w, h, d, x, y, z, id, pivot, col) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); push(g, id, pivot, col); };
  const cyl = (rt, rb, h, x, y, z, id, pivot, col, seg = 7, sx = 1, sz = 1) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1); g.scale(sx, 1, sz); g.translate(x, y, z); push(g, id, pivot, col); };
  const ell = (rx, ry, rz, x, y, z, id, pivot, col, ws = 8, hs = 6, th = Math.PI) => { const g = new THREE.SphereGeometry(1, ws, hs, 0, Math.PI * 2, 0, th); g.scale(rx, ry, rz); g.translate(x, y, z); push(g, id, pivot, col); };
  const skin = [0.8, 0.6, 0.47], w = [1, 1, 1], tr = [0.9, 0.9, 0.9], hair = [0.16, 0.11, 0.08], shoe = [0.12, 0.11, 0.11];
  ell(0.105, 0.128, 0.115, 0, 1.655, 0.005, 0, 0, skin);                               // head
  ell(0.112, 0.07, 0.122, 0, 1.715, -0.01, 10, 0, hair, 8, 4, Math.PI * 0.55);          // hair cap (own id: per-person hair shade)
  ell(0.1, 0.1, 0.05, 0, 1.64, -0.075, 10, 0, hair, 7, 4);                             // hair back
  cyl(0.045, 0.05, 0.12, 0, 1.5, 0, 0, 0, skin, 6);                                    // neck
  cyl(0.215, 0.17, 0.56, 0, 1.2, 0, 1, 0, w, 9, 1, 0.58);                              // torso: wide shoulders, narrower waist
  ell(0.215, 0.07, 0.125, 0, 1.475, 0, 1, 0, w, 9, 3, Math.PI / 2);                     // rounded shoulders
  cyl(0.058, 0.046, 0.55, -0.265, 1.2, 0, 2, 1.46, w, 6); cyl(0.058, 0.046, 0.55, 0.265, 1.2, 0, 3, 1.46, w, 6);     // arms (shirt), pivot at the shoulder
  cyl(0.18, 0.19, 0.1, 0, 0.93, 0, 1, 0, [0.15, 0.13, 0.12], 9, 1, 0.62);              // belt / hips (dark)
  cyl(0.088, 0.062, 0.86, -0.095, 0.47, 0, 4, 0.88, tr, 7); cyl(0.088, 0.062, 0.86, 0.095, 0.47, 0, 5, 0.88, tr, 7);  // legs (trousers), pivot at the hip
  ell(0.05, 0.06, 0.05, -0.265, 0.89, 0, 6, 1.46, skin, 5, 3); ell(0.05, 0.06, 0.05, 0.265, 0.89, 0, 7, 1.46, skin, 5, 3);   // hands
  const shoeG = x => { const g = new THREE.SphereGeometry(1, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(0.07, 0.085, 0.14); g.translate(x, 0.0, 0.04); return g; };
  push(shoeG(-0.095), 8, 0.88, shoe); push(shoeG(0.095), 9, 0.88, shoe);                // shoes
  add(0.28, 0.32, 0.11, 0, 1.22, -0.165, 1, 0, [0.55, 0.55, 0.55]);                     // backpack (shirt-tinted, darker)
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
    this.grid = new Map(); this.stamp = 0; this.carSeq = 0; this.stuckKilled = 0; this.killWhy = {}; this.spawnRej = 0;
    this.spawnT = 0; this.seenTiles = new Set(); this.interiorPeds = new Map(); this.venues = new Map(); this.clock = null;
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
    this.capIn = (M ? [4, 8, 12, 20] : [8, 16, 28, 40])[l]; this.capV = (M ? [5, 8, 12, 16] : [10, 16, 24, 32])[l];
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
          if (pid > 0.5 && pid < 3.5) vColor.rgb *= aShirt; else if (pid > 3.5 && pid < 5.5) vColor.rgb *= aPants;
          else if (pid > 9.5) { float hh = fract(sin(aAnim.x * 91.7) * 437.5); vColor.rgb = hh < 0.16 ? vec3(0.6, 0.48, 0.3) : hh < 0.26 ? vec3(0.42, 0.19, 0.09) : hh < 0.38 ? vec3(0.52, 0.52, 0.5) : hh < 0.7 ? vec3(0.19, 0.12, 0.07) : vec3(0.07, 0.055, 0.045); }   // blond / red / grey / brown / black
          else if (pid < 0.5 || (pid > 5.5 && pid < 7.5)) vColor.rgb *= 0.84 + 0.24 * fract(sin(aAnim.x * 53.1) * 917.3);   // skin tone`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          if (aAnim.y > 0.0 && pid > 1.5 && pid < 9.5) {
            float sgn = (pid == 2.0 || pid == 5.0 || pid == 6.0 || pid == 8.0) ? 1.0 : -1.0;
            float a = sin(uTime * aAnim.y + aAnim.x) * ((pid > 3.5 && pid < 5.5 || pid > 7.5) ? 0.62 : 0.5) * sgn * aAnim.z;
            float c = cos(a), s = sin(a), py = aPart.y;
            float yy = transformed.y - py, zz = transformed.z;
            transformed.y = py + yy * c - zz * s; transformed.z = yy * s + zz * c;
          }
          if (aAnim.w > 0.5) {   // poses of venue NPCs: 1 = sitting (legs forward, forearms on the table), 2 = working at a counter (hands busy)
            bool leg = (pid > 3.5 && pid < 5.5) || (pid > 7.5 && pid < 9.5), arm = (pid > 1.5 && pid < 3.5) || (pid > 5.5 && pid < 7.5);
            float a = 0.0;
            if (aAnim.w < 1.5) a = leg ? -1.5 : arm ? -0.55 : 0.0;
            else if (arm) a = -0.8 + 0.16 * sin(uTime * 4.0 + aAnim.x + pid * 1.7);
            if (a != 0.0) { float c = cos(a), s = sin(a), py = aPart.y, yy = transformed.y - py, zz = transformed.z; transformed.y = py + yy * c - zz * s; transformed.z = yy * s + zz * c; }
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
    this.tilePaths.set(t.key, list); this.gver = (this.gver || 0) + 1;
  }
  _dropTile(key) { this.gver = (this.gver || 0) + 1;
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
  // full A* over the junction graph from the end of c's current path to dest {path, s}: returns the list of edges {path, end} to take (null = no route in the streamed graph)
  planRoute(c, dest) {
    const p = c.path, dp = dest.path, keyEnd = (q, atEnd) => { const j = atEnd ? q.n - 1 : 0; return keyOf(q.pts[2 * j], q.pts[2 * j + 1]); }, xzE = (q, atEnd) => { const j = atEnd ? q.n - 1 : 0; return [q.pts[2 * j], q.pts[2 * j + 1]]; };
    if (p === dp && (dest.s - c.s) * c.dir > 1) return [];
    const k0 = keyEnd(p, c.dir > 0), gA = keyEnd(dp, false), gB = keyEnd(dp, true), tx = dest.x !== undefined ? dest.x : xzE(dp, false)[0], tz = dest.z !== undefined ? dest.z : xzE(dp, false)[1];
    const h = (x, z) => Math.hypot(x - tx, z - tz), g = new Map([[k0, 0]]), prev = new Map(), pos = new Map([[k0, xzE(p, c.dir > 0)]]), open = [[h(...xzE(p, c.dir > 0)), k0]], done = new Set();
    let best = Infinity, bestK = null, bestEnd = false, ex = 0;
    while (open.length && ex++ < 9000) {
      let mi = 0; for (let q = 1; q < open.length; q++) if (open[q][0] < open[mi][0]) mi = q; const [f, k] = open.splice(mi, 1)[0]; if (f >= best) break; if (done.has(k)) continue; done.add(k); const gk = g.get(k);
      if (k === gA && gk + dest.s < best) { best = gk + dest.s; bestK = k; bestEnd = false; }
      if (k === gB && gk + (dp.len - dest.s) < best) { best = gk + dp.len - dest.s; bestK = k; bestEnd = true; }
      const from = prev.get(k); const edges = this.nodes.get(k) || [];
      for (const e of edges) {
        if (e.path.cls < 1 || (from && e.path === from.e.path) || (!from && e.path === p)) continue;
        const nk = keyEnd(e.path, !e.end), ng = gk + e.path.len; if (g.has(nk) && g.get(nk) <= ng) continue; g.set(nk, ng); prev.set(nk, { k, e }); const pp = xzE(e.path, !e.end); pos.set(nk, pp); open.push([ng + h(pp[0], pp[1]), nk]);
      }
    }
    this.lastPlan = { ex, done: done.size, k0e: (this.nodes.get(k0) || []).length, gAe: (this.nodes.get(gA) || []).length, gBe: (this.nodes.get(gB) || []).length, k0, gA, gB, open: open.length };
    if (bestK === null) return null;
    const route = []; let k = bestK; while (k !== k0) { const pr = prev.get(k); if (!pr) return null; route.push(pr.e); k = pr.k; } route.reverse();
    // finally enter the destination path from the cheaper end
    const last = route.length ? route[route.length - 1] : null; const enterEdge = (this.nodes.get(bestK) || []).find(e => e.path === dp && !!e.end === bestEnd);
    if (enterEdge && !(last && last.path === dp)) route.push(enterEdge);
    return route;
  }
  routeFor(c, dest) {   // planRoute, and if there is none in the current direction (dead end ahead) turn the car around and try the other way
    let r = this.planRoute(c, dest); if (r) return r;
    c.dir = -c.dir; this._placeCar(c); r = this.planRoute(c, dest); if (r) { c.speed = Math.min(c.speed, 2); return r; }
    c.dir = -c.dir; this._placeCar(c); return null;
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
    if (parked) { c.s = pt.s; c.off = (p.w / 2 + 1.1) * (Math.random() < 0.5 ? 1 : -1); } else { c.off = Math.max(p.oneway ? 0.95 : 1.4, p.w / 4); c.speed = c.vmax * 0.7; }
    this._placeCar(c); if (!this._spawnOK(c)) { this.spawnRej++; return false; } this.cars.push(c); this._gAdd(c); return true;
  }
  _spawnOK(c) {   // no overlap with other cars, buildings, trunks, lamps, shelters
    if (this.overlapAt(c.x, c.z, c.yaw, c)) return false;
    for (const k of [-1.4, 0, 1.4]) { const q = { x: c.x + Math.sin(c.yaw) * k, z: c.z + Math.cos(c.yaw) * k }, x0 = q.x, z0 = q.z; this.world.collide(q, 0.95, c.y, 1.3); const pp = this.world.collideCar(q, 0.95, true); if (Math.hypot(q.x - x0, q.z - z0) + pp > 0.05) return false; }
    return true;
  }
  compOf(path) {   // connected component of the (junction-endpoint) road graph, cached per graph version
    if (path.cv === this.gver) return path.comp; const comp = { n: 0 }, q = [path]; path.cv = this.gver; path.comp = comp;
    while (q.length) { const p = q.pop(); comp.n++; for (const atEnd of [false, true]) { const j = atEnd ? p.n - 1 : 0, a = this.nodes.get(keyOf(p.pts[2 * j], p.pts[2 * j + 1])); if (a) for (const e of a) { const o = e.path; if (o.cv !== this.gver && o.cls >= 1) { o.cv = this.gver; o.comp = comp; q.push(o); } } } }
    return comp;
  }
  nearestRoad(x, z, maxD = 90, minCls = 2, comp = null) {   // closest drivable road point {path, s, x, z, d}; prefers well-connected roads (or the given component)
    const T = this.world.TILE; let best = null, bestSc = Infinity;
    for (let i = Math.floor((x - maxD) / T); i <= Math.floor((x + maxD) / T); i++) for (let j = Math.floor((z - maxD) / T); j <= Math.floor((z + maxD) / T); j++) {
      const l = this.tilePaths.get(i + '_' + j); if (!l) continue;
      for (const p of l) { if (p.cls < minCls || p.cls > 6 || p.bridge) continue;
        const pen = comp ? (this.compOf(p) === comp ? 0 : 1e6) : (this.compOf(p).n < 12 ? 1e5 : 0);
        for (let k = 0; k + 1 < p.n; k++) { const x0 = p.pts[2 * k], z0 = p.pts[2 * k + 1], dx = p.pts[2 * k + 2] - x0, dz = p.pts[2 * k + 3] - z0, L2 = dx * dx + dz * dz || 1;
          let t = ((x - x0) * dx + (z - z0) * dz) / L2; t = Math.max(0, Math.min(1, t)); const qx = x0 + dx * t, qz = z0 + dz * t, d2 = (qx - x) ** 2 + (qz - z) ** 2, sc = d2 + pen;
          if (d2 <= maxD * maxD && sc < bestSc) { bestSc = sc; best = { path: p, s: p.cum[k] + t * (p.cum[k + 1] - p.cum[k]), x: qx, z: qz, d: Math.sqrt(d2) }; } } }
    }
    if (best && comp && bestSc >= 1e6) return null;
    return best;
  }
  spawnTaxiNPC(dest, rMin, rMax, P) {   // a yellow Camry taxi (NPC driver) on the dest road network, rMin..rMax of road distance away; the route is planned by the caller (planRoute)
    const dp = dest.road ? dest.road.path : null; if (!dp) return null;
    const dist = new Map([[dp, 0]]), q = [dp], cand = [];
    while (q.length) { const p = q.shift(), d0 = dist.get(p); if (d0 > rMax) continue;
      for (const atEnd of [false, true]) { const j = atEnd ? p.n - 1 : 0, a = this.nodes.get(keyOf(p.pts[2 * j], p.pts[2 * j + 1])); if (!a) continue; for (const e of a) { const o = e.path; if (o.cls < 1 || dist.has(o)) continue; dist.set(o, d0 + p.len); q.push(o); } } }
    for (const [p, d] of dist) if (d + p.len >= rMin && d <= rMax && p.cls >= 2 && p.cls <= 6 && p.w >= 3.2 && !p.bridge) cand.push(p);
    for (let tries = 0; tries < 30 && cand.length; tries++) {
      const p = cand[(Math.random() * cand.length) | 0], o = {}, s0 = Math.random() * p.len; City.at(p, s0, 1, 0, o); if (P && Math.hypot(o.x - P.x, o.z - P.z) < 45) continue;
      for (const dir of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
        const c = { path: p, s: s0, dir, speed: 4, vmax: CLS_SPEED[p.cls] * 1.05, col: new THREE.Color(0xf1c40f), wait: 0, x: 0, y: 0, z: 0, yaw: 0, parked: false, hp: 100, kind: 'taxi', model: 5, factory: false, keep: true, taxiNpc: true, toward: { x: dest.x, z: dest.z }, off: Math.max(p.oneway ? 0.95 : 1.4, p.w / 4) };
        c.dest = dest.road; c.route = this.planRoute(c, c.dest); if (!c.route) continue;
        this._placeCar(c); if (!this._spawnOK(c)) continue; this.cars.push(c); this._gAdd(c); return c;
      }
    }
    return null;
  }
  spawnPolice(P) {   // a police car on a road 80-200 m away, driving along the road graph towards this.chaseTarget
    const pt = this._randomPoint(P, 80, Math.min(this.carR, 200), 2, 6) || this._randomPoint(P, 50, this.carR, 1, 6); if (!pt) return null;
    const p = pt.path, T = this.chaseTarget || P, o = {};
    const c = { path: p, s: pt.s, dir: 1, speed: 0, vmax: 21, col: new THREE.Color(0xffffff), wait: 0, x: 0, y: 0, z: 0, yaw: 0, parked: false, hp: 100, kind: 'police', police: true, model: 3, factory: false, off: Math.max(p.oneway ? 0.95 : 1.4, p.w / 4) };
    City.at(p, 0, 1, 0, o); const d0 = Math.hypot(o.x - T.x, o.z - T.z); City.at(p, p.len, 1, 0, o); const d1 = Math.hypot(o.x - T.x, o.z - T.z);
    c.dir = d1 < d0 ? 1 : -1; c.speed = 8; this._placeCar(c); if (!this._spawnOK(c)) return null; this.cars.push(c); this._gAdd(c); return c;
  }
  spawnSaved(d) {   // restore a (stolen) car from a save: parked exactly where it was left
    let best = null, bd = 1e9; const T = this.world.TILE, ti = Math.floor(d.x / T), tj = Math.floor(d.z / T), o = {};
    for (let i = ti - 1; i <= ti + 1; i++) for (let j = tj - 1; j <= tj + 1; j++) { const l = this.tilePaths.get(i + '_' + j); if (l) for (const p of l) if (p.cls >= 1) { for (let k = 0; k < p.n; k++) { const q = (p.pts[2 * k] - d.x) ** 2 + (p.pts[2 * k + 1] - d.z) ** 2; if (q < bd) { bd = q; best = p; } } } }
    if (!best) return null;
    const c = { path: best, s: 0, dir: 1, speed: 0, vmax: 14, col: new THREE.Color(d.color !== undefined ? d.color : 0x888888), wait: 0, x: d.x, y: d.y, z: d.z, yaw: d.yaw, parked: true, hp: d.hp || 100, dmg: d.dmg || 0, kind: d.kind || 'car', model: d.model || 0, off: 0 };
    c.factory = !!d.fac;
    this.cars.push(c); return c;
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
    this._buildGrid(P);
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
    for (const c of this.cars) if (!c.player && !c.job && !c.keep && Math.hypot(c.x - P.x, c.z - P.z) > R + 30) c.dead = true;
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
    // venues first (own budget capV, nearest hall first), then a few residents / office workers elsewhere (budget capIn)
    const ord = [...act].filter(([p]) => !this.interiorPeds.has(p)).map(e => { const c = e[1].sp || e[1].inPt; e.d = c ? Math.hypot(c[0] - P.x, c[1] - P.z) : 1e9; return e; }).sort((A, B) => A.d - B.d);
    for (const [p, I] of ord) {
      if (!p.poi && I.cat === 'retail' && !(I.spots && I.spots[0])) continue;   // street shop: wait for the ground floor (spots)
      if (I.spots && this._isVenue(p, I)) { const sp = I.spots[0]; if (!sp) continue; this.interiorPeds.set(p, this._venuePeds(p, I, sp)); continue; }   // venues: wait until the hall level (spots) is built
      if (p.poi && VENUE.has(I.cat)) continue;
      if (this.peds.filter(a => a.inside && !a.venue).length >= this.capIn) continue;
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
  // ================================================================ venue NPCs (shops / food halls / street shops)
  _isVenue(p, I) { if (p.poi) return VENUE.has(I.cat); const sp = I.spots && I.spots[0]; return I.cat === 'retail' && !!sp && sp.some(q => q.k === 'cash'); }
  _vcaps(V) { const L = this.level, M = this.mob, st = V.key === 'street';
    return { s: st ? 1 : (M ? [1, 2, 2, 3] : [2, 3, 4, 5])[L], c: st ? (M ? [1, 1, 2, 2] : [1, 2, 3, 3])[L] : (M ? [2, 3, 5, 6] : [4, 6, 9, 12])[L] }; }
  _venuePeds(p, I, spots) {
    const key = p.poi ? p.poi.key : 'street', V = { p, I, key, list: [], t: 0.5, spawnT: rnd(1.5, 4) }, h = this.clock ? this.clock.hour : 12, open = isOpen(key, h), cap = this._vcaps(V);
    this.venues.set(p, V); for (const q of spots) q.busy = null;
    const inside = () => this.peds.filter(a => a.venue).length;
    if (open) {   // staff at the stations (one per counter piece first, then the second register / till)
      const capS = Math.min(cap.s, Math.max(0, this.capV - inside())), byPid = new Set();
      for (const pass of [0, 1]) for (const k of STAFF_K) for (const q of spots) {
        if (V.list.length >= capS) break; if (q.k !== k || q.busy || q.player) continue; if (pass === 0 && byPid.has(q.pid)) continue;
        byPid.add(q.pid); this._staffAt(V, q);
      }
      // customers already inside when the hall streams in (crowd level of the hour)
      const want = Math.min(Math.round(cap.c * crowd(key, h)), Math.max(0, this.capV - inside() - 0)), cs = spots.filter(q => CUST_K.has(q.k) && !q.busy && !q.player);
      for (let i = cs.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [cs[i], cs[j]] = [cs[j], cs[i]]; }
      for (const q of cs) { if (V.list.filter(a => !a.staff).length >= want) break; if (q.k === 'queue' && Math.random() < 0.5) continue; const a = venuePed(I, p, q, false); this.peds.push(a); V.list.push(a); this._arrive(a, q); a.stay = this._stayOf(q) * rnd(0.2, 1); }
    }
    return V.list;
  }
  _staffAt(V, q, fromDoor) {
    const a = venuePed(V.I, V.p, fromDoor ? this._doorPt(V.I) : q, true); a.roam = (a) => this._staffRoam(a); this.peds.push(a); V.list.push(a);
    if (fromDoor) this._walkTo(a, q); else this._arrive(a, q); return a;
  }
  _doorPt(I) { const d = I.inPt || I.sp0 || I.sp; return { x: d[0], z: d[1], y: I.F0, yaw: 0 }; }
  _stayOf(q) { return q.k === 'seat' ? rnd(45, 140) : q.k === 'shelf' ? rnd(7, 18) : q.k === 'queue' ? rnd(6, 14) : rnd(10, 26); }
  _arrive(a, q) {   // ped stands at (or sits on) spot q
    if (a.spot && a.spot !== q && a.spot.busy === a) a.spot.busy = null;
    a.spot = q; q.busy = a; a.x = q.x; a.z = q.z; a.yaw = q.yaw; a.sit = !!q.seat; a.y = q.y - (q.seat ? 0.42 : 0); a.moving = 0; a.arrived = true; a.station = a.staff && STAFF_K.includes(q.k);
  }
  // walk along a flow-field route to spot q (or to the door when leaving)
  _walkTo(a, q, done) {
    const I = a.I, pts = this.venueRoute(I, a.x, a.z, q.x, q.z); if (!pts) return false;
    if (a.spot && a.spot !== q && a.spot.busy === a) a.spot.busy = null; if (q.k) { q.busy = a; a.spot = q; }
    a.sit = false; a.station = false; a.arrived = false; a.y = I.F0 + (q.y !== undefined ? q.y - I.F0 : 0); a.route = pts; a.goal = { q, done }; a.moving = 2; return true;
  }
  _leave(a) {
    if (a.leaving) return; a.leaving = true; a.job = null; const q = a.spot; if (q && q.busy === a) q.busy = null; a.spot = null;
    const d = this._doorPt(a.I); if (!this._walkTo(a, d, (a) => { a.dead = true; })) a.dead = true;
  }
  _staffRoam(a) {   // staff step between the stations of their own counter (register <-> prep table), along the staff aisle
    const I = a.I, sp = I.spots && I.spots[0]; if (!sp || a.job || !a.spot || a.route) return;
    const c = sp.filter(q => q !== a.spot && q.pid === a.spot.pid && !q.busy && !q.player && STAFF_K.includes(q.k) && q.k !== 'till'); if (!c.length) return;
    const q = pick(c); if (!venueWalkable(I, 0, a.x, a.z, q.x, q.z, 0.12)) return; a.spot.busy = null; q.busy = a; a.spot = q; a.route = [[q.x, q.z]]; a.goal = { q }; a.station = false; a.moving = 2;
  }
  _spawnCustomer(V, q, opts = {}) {
    const I = V.I, sp = I.spots && I.spots[0]; if (!sp) return null;
    if (!q) { const c = sp.filter(s => CUST_K.has(s.k) && !s.busy && !s.player && (s.k !== 'queue' || Math.random() < 0.4) && (s.k !== 'pickup' || Math.random() < 0.3)); if (!c.length) return null; q = pick(c); }
    if (q.busy && q.busy !== true) { const o = q.busy; if (o.staff) return null; this._leave(o); }
    const a = venuePed(I, V.p, this._doorPt(I), false); if (!this._walkTo(a, q, opts.done)) return null;
    a.stay = opts.stay !== undefined ? opts.stay : this._stayOf(q); a.job = opts.job || null; this.peds.push(a); V.list.push(a); return a;
  }
  _venueTick(dt) {   // every 0.5 s per venue: customers come / go by the crowd of the hour, staff leave when the shop closes
    for (const [p, V] of this.venues) {
      if (!this.world.interiors.active.has(p)) { this.venues.delete(p); continue; }
      if ((V.t -= dt) > 0) continue; V.t = 0.5;
      const h = this.clock ? this.clock.hour : 12, open = isOpen(V.key, h), cap = this._vcaps(V); V.list = V.list.filter(a => !a.dead); this.interiorPeds.set(p, V.list);
      const custs = V.list.filter(a => !a.staff && !a.leaving), staff = V.list.filter(a => a.staff && !a.leaving);
      if (!open) { for (const a of V.list) if (!a.job && !a.leaving && Math.random() < 0.25) this._leave(a); continue; }
      V.staffT = (V.staffT || 0) - 0.5;   // shop opened while the player is inside (or a worker went on break): staff walks in, one every ~12 s up to the cap
      if (!V.noStaff && staff.length < cap.s && (!staff.length || V.staffT <= 0) && this.peds.filter(a => a.venue).length < this.capV) {
        V.staffT = 12; const sp0 = V.I.spots[0] || [], used = new Set(staff.map(a => a.spot && a.spot.pid));
        const q = sp0.find(s => STAFF_K.includes(s.k) && !s.busy && !s.player && !used.has(s.pid)) || sp0.find(s => STAFF_K.includes(s.k) && !s.busy && !s.player); if (q) this._staffAt(V, q, true); else if (!staff.length) V.noStaff = true;
      }
      const want = Math.round(cap.c * crowd(V.key, h));
      if ((V.spawnT -= 0.5) <= 0) { V.spawnT = rnd(3, 8) / Math.max(0.35, crowd(V.key, h)); if (custs.filter(a => !a.job).length < want && this.peds.filter(a => a.venue).length < this.capV) this._spawnCustomer(V); }
      for (const a of custs) {
        if (a.job || a.route || a.state !== 'idle') continue;
        if ((a.stay -= 0.5) > 0) continue;
        if (a.spot && a.spot.k === 'shelf' && (a.roams = (a.roams || 0) + 1) <= 2 && this._custRoam(a)) { a.stay = rnd(6, 16); continue; }
        this._leave(a);
      }
    }
  }
  _custRoam(a) {   // shoppers browse: walk to another free shelf spot nearby
    const I = a.I, sp = I.spots && I.spots[0]; if (!sp) return false; const c = sp.filter(q => !q.busy && !q.player && q.k === 'shelf' && Math.hypot(q.x - a.x, q.z - a.z) < 14); if (!c.length) return false;
    return this._walkTo(a, pick(c));
  }
  // ---- per-hall flow field (0.4 m grid, BFS distance to the entrance) -> routes between any two points avoid the furniture
  _flow(I) {
    if (I._flowF !== undefined) return I._flowF; I._flowF = null;
    const sol = (I.solidUV && I.solidUV[0]) || [], rooms = I.rooms; if (!rooms || !rooms.length || !I.inPt) return null;
    let u0 = 1e9, v0 = 1e9, u1 = -1e9, v1 = -1e9; for (const r of rooms) { u0 = Math.min(u0, r.u0); v0 = Math.min(v0, r.v0); u1 = Math.max(u1, r.u1); v1 = Math.max(v1, r.v1); }
    let cs = 0.4; if ((u1 - u0) * (v1 - v0) / (cs * cs) > 70000) cs = Math.sqrt((u1 - u0) * (v1 - v0) / 70000);
    const gw = Math.ceil((u1 - u0) / cs), gh = Math.ceil((v1 - v0) / cs), N = gw * gh, blk = new Uint8Array(N), m = 0.27;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const u = u0 + (i + 0.5) * cs, v = v0 + (j + 0.5) * cs; let ok = true;
      for (const [du, dv] of [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]]) { const q = I.toXZ(u + du, v + dv); if (!I.inside_fn(q[0], q[1])) { ok = false; break; } } if (!ok) blk[j * gw + i] = 1; }
    for (const r of sol) { const i0 = Math.max(0, Math.floor((r[0] - m - u0) / cs)), i1 = Math.min(gw - 1, Math.floor((r[1] + m - u0) / cs)), j0 = Math.max(0, Math.floor((r[2] - m - v0) / cs)), j1 = Math.min(gh - 1, Math.floor((r[3] + m - v0) / cs));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const u = u0 + (i + 0.5) * cs, v = v0 + (j + 0.5) * cs; if (u > r[0] - m && u < r[1] + m && v > r[2] - m && v < r[3] + m) blk[j * gw + i] = 1; } }
    if (I.pieces) for (const pc of I.pieces) { if (pc.l) continue;   // partition walls of multi-room interiors: rasterise (doorways stay open)
      const L = Math.hypot(pc.x2 - pc.x1, pc.z2 - pc.z1), n = Math.max(1, Math.ceil(L / (cs * 0.5))), wr = Math.max(0.17, cs * 0.5 + 0.03), rr = Math.ceil(wr / cs) + 1;
      for (let k = 0; k <= n; k++) { const x = pc.x1 + (pc.x2 - pc.x1) * k / n, z = pc.z1 + (pc.z2 - pc.z1) * k / n, w = I.uvOf(x, z), ci = Math.floor((w[0] - u0) / cs), cj = Math.floor((w[1] - v0) / cs);
        for (let j = cj - rr; j <= cj + rr; j++) for (let i = ci - rr; i <= ci + rr; i++) { if (i < 0 || j < 0 || i >= gw || j >= gh) continue; const q = I.toXZ(u0 + (i + 0.5) * cs, v0 + (j + 0.5) * cs); if (sd(q[0], q[1], pc.x1, pc.z1, pc.x2, pc.z2) < wr) blk[j * gw + i] = 1; } } }
    const F = { u0, v0, cs, gw, gh, blk, dist: new Uint16Array(N).fill(65535) };
    const d = I.uvOf(I.inPt[0], I.inPt[1]), c0 = this._freeCell(F, d[0], d[1], 6); if (c0 < 0) return null;
    const qu = new Int32Array(N); let h = 0, t = 0; qu[t++] = c0; F.dist[c0] = 0;
    while (h < t) { const c = qu[h++], i = c % gw, j = (c / gw) | 0, dd = F.dist[c] + 1;
      if (i > 0 && !blk[c - 1] && F.dist[c - 1] > dd) { F.dist[c - 1] = dd; qu[t++] = c - 1; } if (i < gw - 1 && !blk[c + 1] && F.dist[c + 1] > dd) { F.dist[c + 1] = dd; qu[t++] = c + 1; }
      if (j > 0 && !blk[c - gw] && F.dist[c - gw] > dd) { F.dist[c - gw] = dd; qu[t++] = c - gw; } if (j < gh - 1 && !blk[c + gw] && F.dist[c + gw] > dd) { F.dist[c + gw] = dd; qu[t++] = c + gw; } }
    return (I._flowF = F);
  }
  _freeCell(F, u, v, r, reach) {   // nearest free (and reached, if asked) cell to (u, v) within r cells
    const ci = Math.floor((u - F.u0) / F.cs), cj = Math.floor((v - F.v0) / F.cs); let best = -1, bd = 1e9;
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) { if (i < 0 || j < 0 || i >= F.gw || j >= F.gh) continue; const c = j * F.gw + i; if (F.blk[c] || (reach && F.dist[c] === 65535)) continue; const dd = (i - ci) ** 2 + (j - cj) ** 2; if (dd < bd) { bd = dd; best = c; } }
    return best;
  }
  _descend(F, c) { const out = [c], gw = F.gw; let g = 0; while (F.dist[c] > 0 && g++ < 4000) { const dd = F.dist[c] - 1, i = c % gw; let n = -1; for (const k of [c - 1, c + 1, c - gw, c + gw]) { if (k < 0 || k >= F.dist.length || (k === c - 1 && i === 0) || (k === c + 1 && i === gw - 1)) continue; if (F.dist[k] === dd) { n = k; break; } } if (n < 0) break; c = n; out.push(c); } return out; }
  venueRoute(I, x0, z0, x1, z1) {   // -> [[x, z], ...] ending at (x1, z1), or null
    if (venueWalkable(I, 0, x0, z0, x1, z1, 0.22)) return [[x1, z1]];
    const F = this._flow(I); if (!F) return null;
    const a = I.uvOf(x0, z0), b = I.uvOf(x1, z1), ca = this._freeCell(F, a[0], a[1], 4, true), cb = this._freeCell(F, b[0], b[1], 4, true); if (ca < 0 || cb < 0) return null;
    const pa = this._descend(F, ca), pb = this._descend(F, cb), ib = new Map(pb.map((c, i) => [c, i]));
    let ia = pa.findIndex(c => ib.has(c)); if (ia < 0) return null;
    const cells = pa.slice(0, ia + 1).concat(pb.slice(0, ib.get(pa[ia])).reverse());
    const pts = cells.map(c => I.toXZ(F.u0 + (c % F.gw + 0.5) * F.cs, F.v0 + (((c / F.gw) | 0) + 0.5) * F.cs)); pts.push([x1, z1]);
    const out = []; let cx = x0, cz = z0, i = 0;   // string pulling: farthest directly reachable point (window of 30 cells)
    while (i < pts.length) { let j = Math.min(pts.length - 1, i + 30); while (j > i && !venueWalkable(I, 0, cx, cz, pts[j][0], pts[j][1], 0.18)) j--; out.push(pts[j]); cx = pts[j][0]; cz = pts[j][1]; i = j + 1; }
    return out;
  }
  // ---- API for venue jobs (jobs.js)
  venueOf(plan) { return this.venues.get(plan) || null; }
  venueCustomer(plan, q, opts) { const V = this.venues.get(plan); return V ? this._spawnCustomer(V, q, opts) : null; }
  venueSend(a, q) { if (!a || a.dead || a.staff) return false; const o = q.busy; if (o && o !== true && o !== a) { if (o.staff || o.job) return false; this._leave(o); } a.leaving = false; return this._walkTo(a, q); }
  venueLeave(a) { if (a && !a.dead) this._leave(a); }
  venueReserve(plan, q) {   // the player takes station q: the NPC working there goes on a break (walks out)
    q.player = true; const a = q.busy; if (a && a !== true && a.staff) { q.busy = null; a.spot = null; this._leave(a); }
  }
  venueRelease(plan, q) { if (q) q.player = false; }
  _simInside(dt) {   // venue NPCs: follow a.route (≈0.9 m/s), then idle / sit / work at the spot; staff occasionally step between stations
    this._venueTick(dt);
    for (const a of this.peds) {
      if (!a.inside || a.dead || a.state !== 'idle' || !a.venue) continue;
      if (a.route) {
        const t = a.route[0], dx = t[0] - a.x, dz = t[1] - a.z, d = Math.hypot(dx, dz), st = 0.95 * dt;
        if (d <= st) { a.x = t[0]; a.z = t[1]; a.route.shift();
          if (!a.route.length) { a.route = null; const g = a.goal; a.goal = null; a.moving = 0; if (g && g.q && g.q.k) this._arrive(a, g.q); a.wait = rnd(6, 16); if (g && g.done) g.done(a); } }
        else { a.x += dx / d * st; a.z += dz / d * st; a.yaw = Math.atan2(dx, dz); a.moving = 2; }
      } else if (a.roam && !a.leaving && (a.wait -= dt) <= 0) { a.wait = rnd(8, 20); a.roam(a); }
    }
  }
  _simPeds(P, dt) {
    const o = City._o || (City._o = {}); this._simInside(dt);
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
  // ---------------------------------------------------------------- car collisions (spatial grid, 8 m cells)
  _gk(x, z) { return (Math.floor(x / 8) + 4096) * 8192 + Math.floor(z / 8) + 4096; }
  _buildGrid(P) {
    const G = this.grid; G.clear(); this.pl = P;
    for (const c of this.cars) { if (c.dead) continue; if (!c.id) c.id = ++this.carSeq; this._gAdd(c); }
  }
  _gAdd(c) { const k = this._gk(c.x, c.z); let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); } a.push(c); }
  // do two cars (4.5 x 1.85 m, modelled as 3 circles each) overlap? returns penetration depth (0 = apart)
  static carPen(ax, az, ayaw, bx, bz, byaw) {
    const dx = bx - ax, dz = bz - az; if (dx * dx + dz * dz > 25) return 0;
    const sa = Math.sin(ayaw), ca = Math.cos(ayaw), sb = Math.sin(byaw), cb = Math.cos(byaw); let m = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const px = ax + sa * i * 1.45, pz = az + ca * i * 1.45, qx = bx + sb * j * 1.45, qz = bz + cb * j * 1.45, d = Math.hypot(px - qx, pz - qz), pen = 2.0 - d; if (pen > m) m = pen;
    }
    return m;
  }
  overlapAt(x, z, yaw, self) {   // first car whose body overlaps a car placed at (x,z,yaw) – used on spawn
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = this.grid.get(this._gk(x + i * 8, z + j * 8)); if (a) for (const d of a) if (d !== self && !d.dead && City.carPen(x, z, yaw, d.x, d.z, d.yaw) > 0) return d; }
    return null;
  }
  carHits(c, x, z, yaw, out) {   // all cars overlapping car c placed at (x,z,yaw): [{d, pen, nx, nz}] (normal points from d to c)
    out.length = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = this.grid.get(this._gk(x + i * 8, z + j * 8)); if (a) for (const d of a) { if (d === c || d.dead) continue; const pen = City.carPen(x, z, yaw, d.x, d.z, d.yaw); if (pen > 0) { let nx = x - d.x, nz = z - d.z; const l = Math.hypot(nx, nz) || 1; out.push({ d, pen, nx: nx / l, nz: nz / l }); } } }
    return out;
  }
  _ahead(c, L) {   // distance (bumper to obstacle) to the nearest car / pedestrian / player in the lane corridor ahead, or Infinity
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = fz, rz = -fx, st = ++this.stamp; let best = Infinity, who = null;
    for (let s = 0; s <= L; s += 7) {
      const cx = c.x + fx * s, cz = c.z + fz * s;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const a = this.grid.get(this._gk(cx + i * 8, cz + j * 8)); if (!a) continue;
        for (const d of a) {
          if (d === c || d._st === st || d.dead) continue; d._st = st;
          const ex = d.x - c.x, ez = d.z - c.z; let f = ex * fx + ez * fz; const l = ex * rx + ez * rz;
          if (f < 0.3 && f > -3.5 && Math.abs(l) < 1.6 && (d.id < c.id || d.parked) && Math.sin(d.yaw) * fx + Math.cos(d.yaw) * fz > 0.3) f = 0.3;   // already overlapping a car heading the same way: the later id waits
          if (f < 0.3 || f > L + 4.5) continue;
          const al = Math.abs(l); if (al > 1.8) continue;
          if (!d.parked && al > 1.2 && d.speed > 1 && Math.sin(d.yaw) * fx + Math.cos(d.yaw) * fz < -0.5) continue;   // oncoming car passing in its own lane
          const g = f - 4.5; if (g < best) { best = g; who = d; }
        }
      }
    }
    const P = this.pl, test = (x, z, r, extra) => { const ex = x - c.x, ez = z - c.z; if (ex > L + 8 || ex < -L - 8 || ez > L + 8 || ez < -L - 8) return; const f = ex * fx + ez * fz, l = ex * rx + ez * rz; if (f < 0.3 || f > L + 2.4 || Math.abs(l) > r) return; const g = f - 2.4 - extra; if (g < best) { best = g; who = null; } };
    for (const a of this.peds) if (!a.inside && !a.dead) test(a.x, a.z, 1.15, 0);
    if (P && !(this.carDriven && this.carDriven.player)) test(P.x, P.z, 1.15, 0);
    c.blocker = who; return best;
  }
  _simCars(P, dt) {
    const o = City._o2 || (City._o2 = {});
    for (const c of this.cars) {
      if (c.parked || c.player) continue;
      const p = c.path; let target = c.vmax;
      if (c.police && this.chaseTarget && Math.hypot(c.x - this.chaseTarget.x, c.z - this.chaseTarget.z) < 30) { target = 0; c.arrived = true; } else if (c.police && c.arrived) target = 0;
      c.why = ''; if (c.hold) target = 0;
      else if (c.toward) {   // taxi NPC: arrive at the target point, wait for tiles ahead to stream in
        const dd = Math.hypot(c.x - c.toward.x, c.z - c.toward.z);
        if (dd < 13 || c.arrived) { target = 0; if (c.speed < 0.6 && dd < 22) c.arrived = true; } else if (dd < 60) target = Math.min(target, Math.sqrt(2 * 3 * Math.max(0, dd - 12)) + 0.5);
        const ax = c.x + Math.sin(c.yaw) * 70, az = c.z + Math.cos(c.yaw) * 70, TT = this.world.TILE, tl = this.world.tiles.get(Math.floor(ax / TT) + '_' + Math.floor(az / TT)); if (this.world.manifestTiles.has(Math.floor(ax / TT) + '_' + Math.floor(az / TT)) && !(tl && tl.h)) target = 0;
      }
      // car following (same path & direction) + simple stop at junctions
      for (const d of this.cars) {
        if (d === c || d.path !== p || d.parked) continue;
        const gap = (d.s - c.s) * c.dir; if (gap > 0 && gap < 16 && (d.dir === c.dir)) target = Math.min(target, Math.max(0, (gap - 5.5) * 1.2));
      }
      // collision avoidance: stop behind whatever is in the lane ahead (cars incl. parked/player/police, pedestrians, the player)
      if (c.ghost > 0) c.ghost -= dt;
      else { const gap = this._ahead(c, 5 + c.speed * 1.5); if (gap < 1e8) { const tg = gap < 0.8 ? 0 : Math.sqrt(2 * 6 * (gap - 0.6)); if (tg < target) { target = tg; if (tg < 0.3) c.why = c.blocker ? 'car' : 'ped'; } } }
      // fixed obstacles (walls / trunks / lamp posts / shelters) 3.5 m ahead, sampled 4 Hz per car
      c.obsT = (c.obsT || Math.random() * 0.25) - dt;
      if (c.obsT <= 0) { c.obsT = 0.25; const q = { x: c.x + Math.sin(c.yaw) * (3.6 + c.speed * 0.25), z: c.z + Math.cos(c.yaw) * (3.6 + c.speed * 0.25) }, q0 = { x: q.x, z: q.z }; const pp = this.world.collideCar(q, 0.8, true); c.obs = pp > 0.1; if (c.obs) c.obsN = (c.obsN || 0) + 1; else c.obsN = 0; }
      if (c.obs && !(c.obsN > 32)) { target = 0; c.why = 'obs'; }   // 8 s blocked by a lamp / trunk the road graph passes -> squeeze by
      const distEnd = c.dir > 0 ? p.len - c.s : c.s;
      if (c.wait > 0) { c.wait -= dt; target = 0; }
      else if (distEnd < 7 && p.cls <= 4 && !c.police) {
        const nxt = this.nodes.get(keyOf(p.pts[c.dir > 0 ? 2 * (p.n - 1) : 0], p.pts[c.dir > 0 ? 2 * (p.n - 1) + 1 : 1]));
        if (nxt && nxt.length >= 3 && !c.passed) {
          target = Math.min(target, Math.max(1.2, distEnd * 0.9));
          // give way to cross traffic already in / closer to the junction (strict order: distance, then id -> no deadlock)
          let yield_ = false;
          if (distEnd > 0.6 && distEnd < 8) { const ei = c.dir > 0 ? 2 * (p.n - 1) : 0, jx = p.pts[ei], jz = p.pts[ei + 1], fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); let yield_ = false;
            for (let i = -1; i <= 1 && !yield_; i++) for (let j = -1; j <= 1 && !yield_; j++) { const a2 = this.grid.get(this._gk(jx + i * 8, jz + j * 8)); if (!a2) continue;
              for (const d of a2) { if (d === c || d.dead || d.parked || d.path === p) continue; const dn = Math.hypot(d.x - jx, d.z - jz); if (dn > 9) continue;
                const hx = Math.sin(d.yaw), hz = Math.cos(d.yaw); if (hx * fx + hz * fz < -0.8) continue;   // oncoming: passes in its own lane
                if (dn >= 4 && (jx - d.x) * hx + (jz - d.z) * hz < 0) continue;   // already left the junction
                if (dn < distEnd - 1.5 || (Math.abs(dn - distEnd) <= 1.5 && d.id < c.id)) { yield_ = true; break; } } }
            if (yield_) { target = Math.min(target, Math.max(0, (distEnd - 2.0) * 0.8)); if (target < 0.3) c.why = 'yield'; } }
          if (distEnd < 1.8 && !(yield_ && distEnd > 0.6 && (c.stuck || 0) < 6)) { c.wait = rnd(0.7, 2.4); c.passed = true; } }
      }
      if (c.hitT > 0) { c.hitT -= dt; target = 0; }
      if (target < 0.2 && c.speed < 0.3) { c.stuck = (c.stuck || 0) + dt; if (c.stuck > 28 && !c.keep && Math.hypot(c.x - P.x, c.z - P.z) > 40) { c.dead = true; this.stuckKilled++; this.killWhy[c.why || '?'] = (this.killWhy[c.why || '?'] || 0) + 1; continue; } if (c.stuck > 14 && c.blocker && !c.blocker.parked && !c.obs) c.ghost = 2; else if (c.stuck > 16) c.ghost = Math.max(c.ghost || 0, 1.8); } else c.stuck = 0;
      const acc = target > c.speed ? 3.0 : 7.0; c.speed += Math.sign(target - c.speed) * Math.min(Math.abs(target - c.speed), acc * dt);
      c.s += c.dir * c.speed * dt;
      if (c.s <= 0 || c.s >= p.len) {
        let nx;
        if (c.dest && c.route) { if (!c.route.length) c.route = this.routeFor(c, c.dest) || []; nx = c.route.length ? { e: c.route.shift(), deg: 3 } : null; }
        if (!nx) nx = this._next(p, c.s >= p.len ? 1 : 0, 1, c.police ? this.chaseTarget : (c.toward || null));
        if (nx) { const e = nx.e; c.path = e.path; c.s = e.end ? e.path.len - 0.02 : 0.02; c.dir = e.end ? -1 : 1; c.passed = false; c.off = Math.max(e.path.oneway ? 0.95 : 1.4, e.path.w / 4); c.vmax = c.police ? 21 : CLS_SPEED[e.path.cls] * rnd(0.8, 1.1); }
        else if (c.toward) { c.s = Math.max(0.02, Math.min(p.len - 0.02, c.s)); c.wait = 0.8; }   // graph not streamed in yet: hold
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
    for (const a of this.extra.concat(this.peds)) {   // extra (police, guards, dealers) first: never cut by the instance cap
      if (n >= pm.instanceMatrix.count) break;
      q.setFromAxisAngle(up, a.yaw); let y = a.y;
      if (a.state === 'down') { qa.setFromAxisAngle(xa, -1.5); q.multiply(qa); y += 0.18; } else if (a.state === 'stagger') { qa.setFromAxisAngle(xa, -0.25); q.multiply(qa); }
      pv.set(a.x, y, a.z); sv.set(a.scale || 1, a.scale || 1, a.scale || 1); M.compose(pv, q, sv); pm.setMatrixAt(n, M);
      const moving = a.state === 'walk' || a.state === 'flee' || a.moving;
      const pose = moving || a.state !== 'idle' ? 0 : a.sit ? 1 : a.station ? 2 : 0;
      this.animArr.set([a.phase, moving ? (a.state === 'flee' ? 11 : a.moving ? 3.2 * a.moving : 6.5 * (a.speed || 1.2)) : 0, (a.state === 'flee' || a.moving) ? 1.5 : 1, pose], n * 4);
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
      if (fl.add(c.model | 0, c.factory, c.dmg ? col.copy(c.col).multiplyScalar(0.7) : c.col, M, !c.parked)) n++;
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
