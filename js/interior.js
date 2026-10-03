// Procedural, deterministic building interiors (no real interior data exists in OSM).
//  * plan (tile build time): door position on the street-facing wall, wall thickness (inner offset ring), floors count
//  * activation (runtime, only within ~60 m of the player): inner skin, floor slabs, ceilings, partition walls with doorways,
//    U-shaped staircase, railings; all in ONE atlas material (no lights; baked vertex shading). Disposed when far.
import * as THREE from 'three';
import { makeInteriorAtlas, INT_RECT } from './textures.js';
import { STYLE, classify, assignTypes, furnish } from './rooms.js';

export const DOOR_W = 1.6, DOOR_H = 2.3, WALL_T = 0.3, SLAB = 0.25;
const DOOR_W_IN = 1.6;

export function hash01(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function rngFrom(seed) { let a = (seed * 2654435761) >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function sArea(r) { let s = 0; for (let i = 0, n = r.length / 2; i < n; i++) { const j = (i + 1) % n; s += r[2 * i] * r[2 * j + 1] - r[2 * j] * r[2 * i + 1]; } return s / 2; }
export function pip(r, x, z) { let inside = false; for (let i = 0, n = r.length / 2, j = n - 1; i < n; j = i++) { const xi = r[2 * i], zi = r[2 * i + 1], xj = r[2 * j], zj = r[2 * j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; } return inside; }

// offset ring toward the LEFT of travel (solid side for CCW outer rings and CW hole rings) by t metres (mitered)
export function offsetRing(r, t) {
  const n = r.length / 2, o = new Array(r.length);
  for (let i = 0; i < n; i++) {
    const p = (i + n - 1) % n, q = (i + 1) % n;
    let d1x = r[2 * i] - r[2 * p], d1z = r[2 * i + 1] - r[2 * p + 1], l1 = Math.hypot(d1x, d1z) || 1; d1x /= l1; d1z /= l1;
    let d2x = r[2 * q] - r[2 * i], d2z = r[2 * q + 1] - r[2 * i + 1], l2 = Math.hypot(d2x, d2z) || 1; d2x /= l2; d2z /= l2;
    const n1x = -d1z, n1z = d1x, n2x = -d2z, n2z = d2x; let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz);
    if (ml < 1e-6) { mx = n1x; mz = n1z; } else { mx /= ml; mz /= ml; }
    const k = t / Math.max(0.4, mx * n1x + mz * n1z);
    o[2 * i] = r[2 * i] + mx * k; o[2 * i + 1] = r[2 * i + 1] + mz * k;
  }
  return o;
}
function distSeg(px, pz, x1, z1, x2, z2) { const dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz; let t = L2 > 0 ? ((px - x1) * dx + (pz - z1) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - x1 - t * dx, pz - z1 - t * dz); }
function triangulate(ring, holes) {
  const v2 = r => { const a = []; for (let i = 0; i < r.length; i += 2) a.push(new THREE.Vector2(r[i], r[i + 1])); return a; };
  const c = v2(ring), hs = (holes || []).map(v2);
  const faces = THREE.ShapeUtils.triangulateShape(c, hs); return { pts: c.concat(...hs), faces };
}

// ------------------------------------------------------------------------------------------ planning (tile build time)
// roadSegs: flat [x1,z1,x2,z2,...] of streets in the tile; others: [{b:[x0,z0,x1,z1], ring}] neighbours
export function planBuilding(ring, holes, g, eave, levelsTag, roadSegs, others, selfIdx, heightAt) {
  const n = ring.length / 2, area = sArea(ring);
  if (n < 3 || area < 16) return null;
  let inner = null;
  for (const t of [WALL_T, 0.12]) {
    const ir = offsetRing(ring, t); const ia = sArea(ir);
    if (!(ia > 0.45 * area) || ia < 8) continue;
    const ih = holes.map(h => offsetRing(h, t)); let ok = true;
    for (let k = 0; k < holes.length; k++) { const a0 = sArea(holes[k]), a1 = sArea(ih[k]); if (!(a1 < 0) || Math.abs(a1) < Math.abs(a0)) ok = false; }
    if (!ok) continue;
    // all inner points must be inside original outer ring (cheap self-intersection sanity)
    for (let i = 0; i < n; i++) if (!pip(ring, ir[2 * i], ir[2 * i + 1])) { ok = false; break; }
    if (ok) { inner = { ring: ir, holes: ih, t }; break; }
  }
  if (!inner) return null;
  try { const tr = triangulate(inner.ring, inner.holes); if (!tr.faces.length) return null; } catch (e) { return null; }
  // door edge = street-facing: nearest road, not blocked by neighbours
  const cands = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = ring[2 * i], az = ring[2 * i + 1], bx = ring[2 * j], bz = ring[2 * j + 1], L = Math.hypot(bx - ax, bz - az);
    if (L < DOOR_W + 1.4) continue;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, nx = (bz - az) / L, nz = -(bx - ax) / L;
    let d = 60; for (let k = 0; k < roadSegs.length; k += 4) d = Math.min(d, distSeg(mx + nx * 1.5, mz + nz * 1.5, roadSegs[k], roadSegs[k + 1], roadSegs[k + 2], roadSegs[k + 3]));
    let pen = 0, blockedNear = false;
    for (const [dist, hard] of [[1.3, true], [2.6, false], [4.5, false]]) { const qx = mx + nx * dist, qz = mz + nz * dist;
      for (let k = 0; k < others.length; k++) { if (k === selfIdx) continue; const o = others[k]; if (qx < o.b[0] || qx > o.b[2] || qz < o.b[1] || qz > o.b[3]) continue; if (pip(o.ring, qx, qz)) { if (hard) blockedNear = true; else pen += 25; break; } } }
    if (blockedNear) continue;
    cands.push({ i, L, mx, mz, nx, nz, score: d - Math.min(L, 12) * 0.15 + pen });
  }
  cands.sort((a, b) => a.score - b.score);
  let door = null;
  for (let c = 0; c < Math.min(cands.length, 6); c++) {
    const e = cands[c]; let blocked = false; const px = e.mx + e.nx * 1.3, pz = e.mz + e.nz * 1.3;
    for (let k = 0; k < others.length; k++) { if (k === selfIdx) continue; const o = others[k]; if (px < o.b[0] || px > o.b[2] || pz < o.b[1] || pz > o.b[3]) continue; if (pip(o.ring, px, pz)) { blocked = true; break; } }
    if (!blocked) { door = e; break; }
  }
  if (!door) return null;
  const F0 = heightAt(door.mx + door.nx * 0.8, door.mz + door.nz * 0.8);
  if (eave - F0 < 2.8) return null;
  let nl = Math.max(1, levelsTag | 0), sh = (eave - F0) / nl;
  if (sh > 4.4) { nl = Math.ceil((eave - F0) / 3.6); sh = (eave - F0) / nl; } else if (sh < 2.6) { nl = Math.max(1, Math.floor((eave - F0) / 2.8)); sh = (eave - F0) / nl; }
  if (nl > 40) { nl = 40; sh = (eave - F0) / nl; }
  const f0 = (door.L / 2 - DOOR_W / 2) / door.L, f1 = (door.L / 2 + DOOR_W / 2) / door.L;
  return { ring, holes, inner, door: { edge: door.i, L: door.L, f0, f1, mx: door.mx, mz: door.mz, nx: door.nx, nz: door.nz }, F0, eave, g, n: nl, sh, area };
}

// ------------------------------------------------------------------------------------------ geometry builder
class IB {
  constructor() { this.p = []; this.uv = []; this.c = []; this.r = []; this.i = []; this.n = 0; }
  v(x, y, z, u, v, rect, c) { this.p.push(x, y, z); this.uv.push(u, v); this.c.push(c[0], c[1], c[2]); this.r.push(rect[0], rect[1], rect[2], rect[3]); return this.n++; }
  quad(P, UV, rect, c, cs) { const q = i => cs ? cs[i] : c; const a = this.v(P[0][0], P[0][1], P[0][2], UV[0][0], UV[0][1], rect, q(0)), b = this.v(P[1][0], P[1][1], P[1][2], UV[1][0], UV[1][1], rect, q(1)), d = this.v(P[2][0], P[2][1], P[2][2], UV[2][0], UV[2][1], rect, q(2)), e = this.v(P[3][0], P[3][1], P[3][2], UV[3][0], UV[3][1], rect, q(3)); this.i.push(a, b, d, a, d, e); }
  get empty() { return this.n === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('aRect', new THREE.Float32BufferAttribute(this.r, 4));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1)); g.computeBoundingSphere(); return g;
  }
}
// vertical quad between (ax,az)-(bx,bz), from y0 to y1; u in metres/3 from s0, v = (y - yb)/sh
function vq(B, ax, az, bx, bz, y0, y1, s0, s1, yb, sh, rect, c, ct) {
  B.quad([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], [[s0 / 3, (y0 - yb) / sh], [s1 / 3, (y0 - yb) / sh], [s1 / 3, (y1 - yb) / sh], [s0 / 3, (y1 - yb) / sh]], rect, c, ct ? [c, c, ct, ct] : null);
}
function horiz(B, ring, holes, y, rect, c, scale = 2) {
  const tr = triangulate(ring, holes);
  const base = B.n;
  for (const p of tr.pts) B.v(p.x, y, p.y, p.x / scale, p.y / scale, rect, c);
  for (const f of tr.faces) B.i.push(base + f[0], base + f[1], base + f[2]);
}

// ------------------------------------------------------------------------------------------ manager
let SHARED = null;
function sharedMat() {
  if (SHARED) return SHARED;
  const tex = makeInteriorAtlas();
  const m = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aRect; varying vec4 vRect;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRect = aRect;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vRect;')
      .replace('#include <map_fragment>', 'vec2 fu = fract(vMapUv); vec2 ua = vRect.xy + (fu * 0.992 + 0.004) * vRect.zw; diffuseColor *= texture2D(map, ua);');
  };
  m.customProgramCacheKey = () => 'kyivInterior';
  return SHARED = m;
}

export class InteriorManager {
  constructor(world, scene) {
    this.world = world; this.scene = scene; this.active = new Map(); this.queue = []; this.t = 0; this.activateR = 60; this.disposeR = 85; this.nearest = null;
    this.mat = sharedMat(); this.stats = { active: 0, tris: 0 };
  }
  plans() { const out = []; for (const t of this.world.tiles.values()) if (t.plans) for (const p of t.plans) out.push(p); return out; }
  plansNear(x, z, R) {
    const T = this.world.TILE, out = [], ix0 = Math.floor((x - R) / T), ix1 = Math.floor((x + R) / T), iz0 = Math.floor((z - R) / T), iz1 = Math.floor((z + R) / T);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) { const t = this.world.tiles.get(ix + '_' + iz); if (t && t.plans) for (const p of t.plans) { if (Math.hypot(p.cx - x, p.cz - z) - p.radius < R) out.push(p); } }
    return out;
  }
  update(P, dt, budgetMs = 5) {
    this.t += dt;
    if (this.t > 0.25) {
      this.t = 0;
      const near = this.plansNear(P.x, P.z, this.activateR);
      for (const p of near) if (!this.active.has(p) && !this.queue.includes(p) && !p.failed) this.queue.push(p);
      this.queue = this.queue.filter(p => p.tile.alive && Math.hypot(p.cx - P.x, p.cz - P.z) - p.radius < this.activateR);
      this.queue.sort((a, b) => Math.hypot(a.cx - P.x, a.cz - P.z) - Math.hypot(b.cx - P.x, b.cz - P.z));
      for (const [p, I] of this.active) if (!p.tile.alive || Math.hypot(p.cx - P.x, p.cz - P.z) - p.radius > this.disposeR) this.dispose(p);
      // nearest door hint
      let best = null, bd = 12;
      for (const p of this.plansNear(P.x, P.z, 14)) { const d = Math.hypot(p.door.mx - P.x, p.door.mz - P.z); if (d < bd) { bd = d; best = p; } }
      const inside = best ? pip(best.ring, P.x, P.z) : false; this.nearest = best ? { plan: best, dist: bd, inside } : null;
    }
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < budgetMs) {
      const p = this.queue.shift(); if (this.active.has(p) || !p.tile.alive) continue;
      try { this.activate(p); } catch (e) { console.error('interior activate failed', e); p.failed = true; }
    }
    // levels
    for (const [p, I] of this.active) {
      const inside = pip(I.plan.ring, P.x, P.z) && P.y > I.F0 - 2.5 && P.y < I.topY + 2;
      let lo = 0, hi = 0;
      if (inside) { const cur = Math.max(0, Math.min(I.n - 1, Math.floor((P.y - I.F0 + 0.5) / I.sh))); lo = Math.max(0, cur - 1); hi = Math.min(I.n - 1, cur + 1); I.cur = cur; }
      I.inside = inside;
      for (let k = lo; k <= hi; k++) if (!I.levels.has(k)) { if (performance.now() - t0 > budgetMs) break; this.buildLevel(I, k); }
      for (const k of [...I.levels.keys()]) if (k < lo - 1 || k > hi + 1) this.disposeLevel(I, k);
    }
  }
  forceBuild(P) {   // synchronous (tests / teleports)
    for (const p of this.plansNear(P.x, P.z, this.activateR)) if (!this.active.has(p) && !p.failed) { try { this.activate(p); } catch (e) { console.error(e); p.failed = true; } }
    this.update(P, 0.3, 1e9);
  }
  disposeTile(tile) { for (const [p, I] of this.active) if (p.tile === tile) this.dispose(p); }
  dispose(p) {
    const I = this.active.get(p); if (!I) return;
    for (const k of [...I.levels.keys()]) this.disposeLevel(I, k);
    this.world.removeOwner(I.owner); this.scene.remove(I.group); I.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    if (p.tile.alive) this.world.setDoorLeaf(p, true);
    this.active.delete(p); this.stats.active = this.active.size;
  }
  disposeLevel(I, k) { const L = I.levels.get(k); if (!L) return; this.world.removeOwner(L.owner); I.group.remove(L.mesh); L.mesh.geometry.dispose(); if (L.fmesh) { I.group.remove(L.fmesh); L.fmesh.geometry.dispose(); L.fmesh.dispose(); } I.levels.delete(k); }

  // ------------------------------------------------------------------ activation: shell + stairs + partition
  activate(p) {
    const rng = rngFrom(p.seed);
    const W = this.world, inner = p.inner, F0 = p.F0, ring = inner.ring, holes = inner.holes;
    const inside = (x, z) => { if (!pip(ring, x, z)) return false; for (const h of holes) if (pip(h, x, z)) return false; return true; };
    // frame: longest outer edge
    let bl = 0, ux = 1, uz = 0; const on = p.ring.length / 2;
    for (let i = 0; i < on; i++) { const j = (i + 1) % on, dx = p.ring[2 * j] - p.ring[2 * i], dz = p.ring[2 * j + 1] - p.ring[2 * i + 1], l = Math.hypot(dx, dz); if (l > bl) { bl = l; ux = dx / l; uz = dz / l; } }
    const vx = -uz, vz = ux;
    let minU = 1e9, maxU = -1e9, minV = 1e9, maxV = -1e9;
    for (let i = 0; i < ring.length; i += 2) { const u = ring[i] * ux + ring[i + 1] * uz, v = ring[i] * vx + ring[i + 1] * vz; minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v); }
    const toXZ = (u, v) => [u * ux + v * vx, u * uz + v * vz];
    const d = p.door;
    const dIn = [p.doorIn[0] - d.nx * 0.0, p.doorIn[1]];      // inner door centre
    const inPt = [dIn[0] - d.nx * 0.9, dIn[1] - d.nz * 0.9];     // point 0.9 m inside

    // ---- stairs (U-shaped, two flights + landing)
    let stair = null;
    const tryStair = (slope) => {
      const half = p.sh / 2, Lf = half / slope, bw = 1.2, A = Lf + 1.3, B = 2 * bw + 0.15;
      let best = null, bs = 1e9;
      const step = Math.max(0.75, Math.sqrt(((maxU - minU) * (maxV - minV)) / 1200));
      for (let ou = minU; ou < maxU; ou += step) for (let ov = minV; ov < maxV; ov += step) {
        const c = toXZ(ou, ov); const dd = Math.hypot(c[0] - inPt[0], c[1] - inPt[1]); if (dd > 30 || !inside(c[0], c[1])) continue;
        for (const [eaU, eaV] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const sg of [1, -1]) {
          const eax = eaU * ux + eaV * vx, eaz = eaU * uz + eaV * vz, ebx = -eaz * sg, ebz = eax * sg;
          const pt = (a, b) => [c[0] + a * eax + b * ebx, c[1] + a * eaz + b * ebz];
          // rect with clearance: a in [-1.4, A+0.5], b in [-0.5, B+0.5]
          let ok = true;
          for (let a = -1.4; a <= A + 0.5 + 1e-6 && ok; a += 0.9) for (let b = -0.5; b <= B + 0.5 + 1e-6; b += 0.7) { const q = pt(a, b); if (!inside(q[0], q[1])) { ok = false; break; } }
          if (!ok) continue;
          // not on top of the entrance
          const dl = (inPt[0] - c[0]) * eax + (inPt[1] - c[1]) * eaz, dbv = (inPt[0] - c[0]) * ebx + (inPt[1] - c[1]) * ebz;
          if (dl > -2.2 && dl < A + 1.2 && dbv > -1.6 && dbv < B + 1.6) continue;
          const s = Math.abs(dd - 6); if (s < bs) { bs = s; best = { c, eax, eaz, ebx, ebz, Lf, bw, A, B, half, slope }; }
        }
        if (bs < 0.4) break;
      }
      return best;
    };
    if (p.n > 1) stair = tryStair(0.55) || tryStair(0.8);
    const n = stair ? p.n : 1, sh = stair ? p.sh : Math.min(p.sh * p.n, 3.4), topY = F0 + n * sh;
    const I = { plan: p, group: new THREE.Group(), levels: new Map(), owner: { cellKeys: new Set() }, F0, n, sh, topY, stair, cur: 0, ux, uz, vx, vz, inside: false };
    I.group.name = 'interior'; I.rng = rng; I.inside_fn = inside;

    // ---- partition walls (BSP on the oriented bounding box) with doorways
    const zoneBlocked = (x, z) => {
      if (Math.hypot(x - inPt[0], z - inPt[1]) < 2.2) return true;
      if (stair) { const dx = x - stair.c[0], dz = z - stair.c[1], a = dx * stair.eax + dz * stair.eaz, b = dx * stair.ebx + dz * stair.ebz; if (a > -1.7 && a < stair.A + 0.9 && b > -0.9 && b < stair.B + 0.9) return true; }
      return false;
    };
    const lines = [], leaves = []; const maxLines = 40;
    const areaOf = (u0, v0, u1, v1) => { let a = 0; for (let u = u0 + 0.5; u < u1; u += 1) for (let v = v0 + 0.5; v < v1; v += 1) { const q = toXZ(u, v); if (inside(q[0], q[1])) a++; } return a; };
    const queue = [{ u0: minU, v0: minV, u1: maxU, v1: maxV, depth: 0 }];
    while (queue.length) {
      const r = queue.shift(), w = r.u1 - r.u0, h = r.v1 - r.v0, ar = areaOf(r.u0, r.v0, r.u1, r.v1);
      const leaf = () => leaves.push({ u0: r.u0, v0: r.v0, u1: r.u1, v1: r.v1 });
      if (ar < 38 || lines.length >= maxLines || r.depth > 7 || (w < 6.8 && h < 6.8)) { leaf(); continue; }
      const alongU = w >= h ? true : false;
      if (alongU) { if (w < 6.8) { leaf(); continue; } let c = r.u0 + w * (0.4 + 0.2 * rng()); c = Math.round(c * 2) / 2; if (c - r.u0 < 3.2 || r.u1 - c < 3.2) { leaf(); continue; } lines.push({ o: 0, c, a: r.v0, b: r.v1 }); queue.push({ u0: r.u0, v0: r.v0, u1: c, v1: r.v1, depth: r.depth + 1 }, { u0: c, v0: r.v0, u1: r.u1, v1: r.v1, depth: r.depth + 1 }); }
      else { if (h < 6.8) { leaf(); continue; } let c = r.v0 + h * (0.4 + 0.2 * rng()); c = Math.round(c * 2) / 2; if (c - r.v0 < 3.2 || r.v1 - c < 3.2) { leaf(); continue; } lines.push({ o: 1, c, a: r.u0, b: r.u1 }); queue.push({ u0: r.u0, v0: r.v0, u1: r.u1, v1: c, depth: r.depth + 1 }, { u0: r.u0, v0: c, u1: r.u1, v1: r.v1, depth: r.depth + 1 }); }
    }
    const pieces = []; // {x1,z1,x2,z2, lintel:bool}
    for (const ln of lines) {
      const pts = []; let run = null;
      for (let t = ln.a; t <= ln.b + 1e-6; t += 0.25) {
        const P0 = ln.o === 0 ? toXZ(ln.c, t) : toXZ(t, ln.c);
        const off = ln.o === 0 ? toXZ(0.25, 0) : toXZ(0, 0.25);
        const ok = inside(P0[0], P0[1]) && inside(P0[0] + off[0], P0[1] + off[1]) && inside(P0[0] - off[0], P0[1] - off[1]) && !zoneBlocked(P0[0], P0[1]);
        if (ok) { if (!run) run = [t, t]; else run[1] = t; } else if (run) { pts.push(run); run = null; }
      }
      if (run) pts.push(run);
      for (const r of pts) {
        const len = r[1] - r[0]; if (len < 1.5) continue;
        const A = (t) => ln.o === 0 ? toXZ(ln.c, t) : toXZ(t, ln.c);
        if (len < 2.8) continue;     // too short: leave open
        const dc = r[0] + len * (0.3 + 0.4 * rng()), d0 = dc - 0.55, d1 = dc + 0.55;
        let a0 = A(r[0]), a1 = A(d0), b0 = A(d1), b1 = A(r[1]), m0 = A(d0), m1 = A(d1);
        pieces.push({ x1: a0[0], z1: a0[1], x2: a1[0], z2: a1[1], l: false }, { x1: b0[0], z1: b0[1], x2: b1[0], z2: b1[1], l: false }, { x1: m0[0], z1: m0[1], x2: m1[0], z2: m1[1], l: true });
      }
    }
    // connectivity check: flood fill from the door; stair entries must be reachable, else drop partitions (open plan)
    const CS = 0.5, gw = Math.ceil((maxU - minU) / CS) + 2, gh = Math.ceil((maxV - minV) / CS) + 2;
    const flood = (pcs) => {
      if (gw * gh > 250000) return true;
      const blocked = new Uint8Array(gw * gh), seen = new Uint8Array(gw * gh);
      const cellOf = (x, z) => { const u = x * ux + z * uz, v = x * vx + z * vz; return [Math.floor((u - minU) / CS) + 1, Math.floor((v - minV) / CS) + 1]; };
      for (const q of pcs) { if (q.l) continue; const L = Math.hypot(q.x2 - q.x1, q.z2 - q.z1), ns = Math.ceil(L / 0.25);
        for (let s = 0; s <= ns; s++) { const x = q.x1 + (q.x2 - q.x1) * s / ns, z = q.z1 + (q.z2 - q.z1) * s / ns; for (const [ox, oz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) { const [cu, cv] = cellOf(x + ox, z + oz); if (cu >= 0 && cv >= 0 && cu < gw && cv < gh) blocked[cv * gw + cu] = 1; } } }
      const st = cellOf(inPt[0], inPt[1]); const stack = [st[1] * gw + st[0]]; seen[stack[0]] = 1;
      while (stack.length) { const k = stack.pop(), cu = k % gw, cv = (k / gw) | 0; for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nu = cu + du, nv = cv + dv; if (nu < 0 || nv < 0 || nu >= gw || nv >= gh) continue; const kk = nv * gw + nu; if (seen[kk] || blocked[kk]) continue;
        const u = minU + (nu - 1 + 0.5) * CS, v = minV + (nv - 1 + 0.5) * CS, xz = toXZ(u, v); if (!inside(xz[0], xz[1])) continue; seen[kk] = 1; stack.push(kk); } }
      if (!stair) return true;
      const e1 = [stair.c[0] - 0.7 * stair.eax + stair.bw / 2 * stair.ebx, stair.c[1] - 0.7 * stair.eaz + stair.bw / 2 * stair.ebz];
      const e2 = [stair.c[0] - 0.7 * stair.eax + (stair.B - stair.bw / 2) * stair.ebx, stair.c[1] - 0.7 * stair.eaz + (stair.B - stair.bw / 2) * stair.ebz];
      return [e1, e2].every(e => { const c = cellOf(e[0], e[1]); return seen[c[1] * gw + c[0]]; });
    };
    I.partitionsDropped = false;
    if (pieces.length && !flood(pieces)) { pieces.length = 0; I.partitionsDropped = true; }
    I.pieces = pieces;
    // ---- rooms: BSP leaves (a single open room when the partitions were dropped / not generated)
    let rooms = leaves; if (!pieces.length || !lines.length) rooms = [{ u0: minU, v0: minV, u1: maxU, v1: maxV }];
    const uvOf = (x, z) => [x * ux + z * uz, x * vx + z * vz];
    const leafAt = (x, z) => { const [u, v] = uvOf(x, z); let bi = 0, bd = 1e9; for (let i = 0; i < rooms.length; i++) { const r = rooms[i], du = Math.max(r.u0 - u, 0, u - r.u1), dv = Math.max(r.v0 - v, 0, v - r.v1), d = du * du + dv * dv; if (d < bd) { bd = d; bi = i; } } return bi; };
    for (const r of rooms) { let a = 0; for (let u = r.u0 + 0.5; u < r.u1; u += 1) for (let v = r.v0 + 0.5; v < r.v1; v += 1) { const q = toXZ(u, v); if (inside(q[0], q[1])) a++; } r.area = a; r.door = false; r.stair = false; }
    rooms[leafAt(inPt[0], inPt[1])].door = true;
    if (stair) { const e = [stair.c[0] - 0.6 * stair.eax + stair.bw / 2 * stair.ebx, stair.c[1] - 0.6 * stair.eaz + stair.bw / 2 * stair.ebz]; rooms[leafAt(e[0], e[1])].stair = true;
      const e2 = [stair.c[0] + (stair.A + 0.3) * stair.eax + stair.B / 2 * stair.ebx, stair.c[1] + (stair.A + 0.3) * stair.eaz + stair.B / 2 * stair.ebz]; rooms[leafAt(e2[0], e2[1])].stair = true; }
    I.rooms = rooms; I.leafAt = leafAt; I.toXZ = toXZ; I.uvOf = uvOf;
    I.cat = classify(p.kind, hash01(p.seed * 0.37)); I.brand = [0.75 + 0.25 * hash01(p.seed + 1.1), 0.75 + 0.25 * hash01(p.seed + 2.3), 0.75 + 0.25 * hash01(p.seed + 3.7)];
    // keep-clear spots for furniture (uv): door, doorways, stairs
    const clear = [[...uvOf(inPt[0], inPt[1]), 2.0]];
    for (const pc of pieces) if (pc.l) { const m = uvOf((pc.x1 + pc.x2) / 2, (pc.z1 + pc.z2) / 2); clear.push([m[0], m[1], 1.45]); }
    if (stair) for (let a = -1.6; a <= stair.A + 1.0; a += 0.8) for (let b = -1.0; b <= stair.B + 1.0; b += 0.8) { const c = uvOf(stair.c[0] + a * stair.eax + b * stair.ebx, stair.c[1] + a * stair.eaz + b * stair.ebz); clear.push([c[0], c[1], 0.95]); }
    I.clear = clear;

    // ---- door reveal (jambs, lintel soffit, threshold): part of the permanent "frame" mesh
    const B = new IB(); const rects = INT_RECT;
    { const o0 = p.doorOut0, o1 = p.doorOut1, i0 = p.doorIn0, i1 = p.doorIn1, c = [0.7, 0.68, 0.64], pl = rects.plaster, y0 = F0, y1 = F0 + DOOR_H;
      B.quad([[o0[0], y0, o0[1]], [i0[0], y0, i0[1]], [i0[0], y1, i0[1]], [o0[0], y1, o0[1]]], [[0, 0], [0.3, 0], [0.3, 0.7], [0, 0.7]], pl, c);
      B.quad([[o1[0], y0, o1[1]], [i1[0], y0, i1[1]], [i1[0], y1, i1[1]], [o1[0], y1, o1[1]]], [[0, 0], [0.3, 0], [0.3, 0.7], [0, 0.7]], pl, c);
      B.quad([[o0[0], y1, o0[1]], [o1[0], y1, o1[1]], [i1[0], y1, i1[1]], [i0[0], y1, i0[1]]], [[0, 0], [0.5, 0], [0.5, 0.2], [0, 0.2]], pl, c);
      B.quad([[o0[0], y0 + 0.01, o0[1]], [o1[0], y0 + 0.01, o1[1]], [i1[0], y0 + 0.01, i1[1]], [i0[0], y0 + 0.01, i0[1]]], [[0, 0], [0.5, 0], [0.5, 0.2], [0, 0.2]], rects.dark, [0.8, 0.8, 0.8]); }
    const shell = new THREE.Mesh(B.build(), this.mat); shell.matrixAutoUpdate = false; I.group.add(shell); I.shell = shell;
    // shell colliders: inner ring (with door gap), courtyard rings
    const addWallC = (owner, x1, z1, x2, z2, y0, y1) => { const L = Math.hypot(x2 - x1, z2 - z1) || 1; W.addColliderOwner(owner, 'walls', { x1, z1, x2, z2, y0, y1, nx: (z2 - z1) / L, nz: -(x2 - x1) / L, owner }, x1, z1, x2, z2); };
    I.addWallC = addWallC;
    const ringC = (rr, isOuter) => { const m = rr.length / 2; for (let i = 0; i < m; i++) { const j = (i + 1) % m, ax = rr[2 * i], az = rr[2 * i + 1], bx = rr[2 * j], bz = rr[2 * j + 1];
      if (isOuter && i === d.edge) { const px = f => [ax + (bx - ax) * f, az + (bz - az) * f], A0 = px(d.f0), A1 = px(d.f1); addWallC(I.owner, ax, az, A0[0], A0[1], F0 - 1, topY + 1); addWallC(I.owner, A1[0], A1[1], bx, bz, F0 - 1, topY + 1); }
      else addWallC(I.owner, ax, az, bx, bz, F0 - 1, topY + 1); } };
    ringC(ring, true); for (const h of holes) ringC(h, false);
    this.scene.add(I.group); this.active.set(p, I); this.stats.active = this.active.size;
    W.setDoorLeaf(p, false);
  }

  // ------------------------------------------------------------------ one level: skin, floors, ceilings, partitions, stairs, furniture
  buildLevel(I, k) {
    const p = I.plan, W = this.world, rects = INT_RECT, B = new IB(), owner = { cellKeys: new Set() };
    const { F0, sh, n, stair } = I; const Fk = F0 + k * sh, ceilY = (k < n - 1) ? F0 + (k + 1) * sh - SLAB : I.topY - 0.1, yTop = (k < n - 1) ? F0 + (k + 1) * sh : I.topY;
    const rng = rngFrom(p.seed * 31 + k * 7 + 1);
    const ring = p.inner.ring, holes = p.inner.holes, d = p.door, rooms = I.rooms;
    const types = assignTypes(I.cat, k, n, rooms, rng);
    const sty = rooms.map((r, i) => { const S = STYLE[types[i]]; return { S, wallT: S.brand ? S.wallT.map((c, j) => c * I.brand[j]) : S.wallT }; });
    I.types = I.types || {}; I.types[k] = types;
    const mul = (a, b, f = 1) => [a[0] * b[0] * f, a[1] * b[1] * f, a[2] * b[2] * f];
    // stair hole
    if (stair) {
      const q = (a, b) => [stair.c[0] + a * stair.eax + b * stair.ebx, stair.c[1] + a * stair.eaz + b * stair.ebz];
      const a0 = 0.0, a1 = stair.A, b0 = 0, b1 = stair.B;
      const P0 = q(a0, b0), P1 = q(a1, b0), P2 = q(a1, b1), P3 = q(a0, b1);
      let poly = [P0[0], P0[1], P1[0], P1[1], P2[0], P2[1], P3[0], P3[1]]; if (sArea(poly) < 0) poly = [P3[0], P3[1], P2[0], P2[1], P1[0], P1[1], P0[0], P0[1]];
      I.holePoly = poly; I.holeQ = q;
    }
    const hasHoleFloor = !!(stair && k > 0), hasHoleCeil = !!(stair && k < n - 1);
    const ownHoles = holes.slice();
    let floorHoles = hasHoleFloor ? ownHoles.concat([I.holePoly]) : ownHoles, ceilHoles = hasHoleCeil ? ownHoles.concat([I.holePoly]) : ownHoles;
    // ---- wall skin (per level, tinted per room, 3 m window bays)
    const skin = (rr, isOuter) => {
      const m = rr.length / 2; let sCum = 0;
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % m, ax = rr[2 * i], az = rr[2 * i + 1], bx = rr[2 * j], bz = rr[2 * j + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        const ex = (bx - ax) / L, ez = (bz - az) / L, nx = ez, nz = -ex;
        const yA = k === 0 ? F0 - 0.2 : Fk, nCh = Math.max(1, Math.round(L / 3));
        const isDoor = isOuter && i === d.edge && k === 0, dA = L * d.f0, dB = L * d.f1;
        for (let c = 0; c < nCh; c++) {
          const t0 = L * c / nCh, t1 = L * (c + 1) / nCh, mx = ax + ex * (t0 + t1) / 2, mz = az + ez * (t0 + t1) / 2;
          const ri = I.leafAt(mx + nx * 0.6, mz + nz * 0.6), st = sty[ri], col = mul(st.wallT, [0.97, 0.97, 0.97]), ct = mul(st.wallT, [1, 1, 1], 1.0), cb = col.map(c2 => c2 * 0.78);
          const rect = st.S.win ? rects.window : rects[st.S.wall];
          const emit = (ta, tb, y0, y1) => { if (tb - ta < 0.02 || y1 - y0 < 0.02) return; const qa = [ax + ex * ta, az + ez * ta], qb = [ax + ex * tb, az + ez * tb];
            const sA = (sCum + ta) / 3, sB = (sCum + tb) / 3, vA = (y0 - Fk) / sh, vB = (y1 - Fk) / sh;
            B.quad([[qa[0], y0, qa[1]], [qb[0], y0, qb[1]], [qb[0], y1, qb[1]], [qa[0], y1, qa[1]]], [[sA, vA], [sB, vA], [sB, vB], [sA, vB]], rect, null, [y0 <= Fk + 0.01 ? cb : col, y0 <= Fk + 0.01 ? cb : col, ct, ct]); };
          if (isDoor) { const a = Math.max(t0, Math.min(t1, dA)), b = Math.max(t0, Math.min(t1, dB)); emit(t0, a, yA, yTop); emit(b, t1, yA, yTop); emit(a, b, F0 + DOOR_H, yTop); }
          else emit(t0, t1, yA, yTop);
        }
        sCum += L;
      }
    };
    skin(ring, true); for (const h of holes) skin(h, false);
    // ---- floors and ceilings split per room (triangles clipped against room rects)
    const { ux, uz, vx, vz } = I;
    const clipRoomTris = (rg, hl, y, rectOf, colOf, scale) => {
      let tr; try { tr = triangulate(rg, hl); } catch (e) { tr = triangulate(rg, holes); }
      for (const f of tr.faces) {
        const pts = f.map(i => tr.pts[i]), tri = pts.map(q => [q.x * ux + q.y * uz, q.x * vx + q.y * vz]);
        for (let ri = 0; ri < rooms.length; ri++) {
          const R = rooms[ri]; let poly = tri;
          for (const [axis, val, keepGreater] of [[0, R.u0, true], [0, R.u1, false], [1, R.v0, true], [1, R.v1, false]]) {
            const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], da = keepGreater ? a[axis] - val : val - a[axis], db = keepGreater ? b[axis] - val : val - b[axis];
              if (da >= 0) out.push(a); if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
            poly = out; if (poly.length < 3) break;
          }
          if (poly.length < 3) continue;
          const base = B.n, col = colOf(ri), rc = rectOf(ri);
          for (const [u, v] of poly) { const x = u * ux + v * vx, z = u * uz + v * vz; B.v(x, y, z, x / scale, z / scale, rc, col); }
          for (let i = 1; i < poly.length - 1; i++) B.i.push(base, base + i, base + i + 1);
        }
      }
    };
    const tone = 0.9 + 0.08 * hash01(p.seed + k);
    clipRoomTris(ring, floorHoles, Fk, ri => rects[sty[ri].S.floor], ri => mul(sty[ri].S.floorT, [tone, tone, tone]), 2);
    clipRoomTris(ring, ceilHoles, ceilY, ri => rects[sty[ri].S.ceil], ri => sty[ri].S.ceilT, 2);
    // floor collider
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (let i = 0; i < ring.length; i += 2) { x0 = Math.min(x0, ring[i]); x1 = Math.max(x1, ring[i]); z0 = Math.min(z0, ring[i + 1]); z1 = Math.max(z1, ring[i + 1]); }
    W.addColliderOwner(owner, 'floors', { ring, holes: floorHoles.length ? floorHoles : null, y: Fk, b: [x0, z0, x1, z1], owner }, x0, z0, x1, z1);
    if (hasHoleCeil) { const h = I.holePoly; for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; vq(B, h[2 * i], h[2 * i + 1], h[2 * j], h[2 * j + 1], ceilY, ceilY + SLAB, 0, 1, Fk, sh, rects.dark, [0.8, 0.8, 0.8]); } }
    // ---- partition walls: each face takes the style of the room on that side
    for (const pc of I.pieces) {
      const dx = pc.x2 - pc.x1, dz = pc.z2 - pc.z1, L = Math.hypot(dx, dz); if (L < 0.05) continue;
      const ex = dx / L, ez = dz / L, nx0 = -ez, nz0 = ex, nx = nx0 * 0.07, nz = nz0 * 0.07, y0 = pc.l ? Fk + 2.1 : Fk, y1 = ceilY;
      const mx = (pc.x1 + pc.x2) / 2, mz = (pc.z1 + pc.z2) / 2;
      const rA = sty[I.leafAt(mx + nx0 * 0.4, mz + nz0 * 0.4)], rB = sty[I.leafAt(mx - nx0 * 0.4, mz - nz0 * 0.4)];
      const cA = rA.wallT, cB = rB.wallT, ra = rects[rA.S.wall], rb = rects[rB.S.wall], wd = [0.88, 0.88, 0.88];
      const c1 = [pc.x1 + nx, pc.z1 + nz, pc.x2 + nx, pc.z2 + nz], c2 = [pc.x1 - nx, pc.z1 - nz, pc.x2 - nx, pc.z2 - nz];
      vq(B, c1[0], c1[1], c1[2], c1[3], y0, y1, 0, L, Fk, sh, ra, cA.map(c => c * 0.8), cA); vq(B, c2[0], c2[1], c2[2], c2[3], y0, y1, 0, L, Fk, sh, rb, cB.map(c => c * 0.8), cB);
      vq(B, c1[0], c1[1], c2[0], c2[1], y0, y1, 0, 0.14, Fk, sh, rects.plaster, wd); vq(B, c1[2], c1[3], c2[2], c2[3], y0, y1, 0, 0.14, Fk, sh, rects.plaster, wd);
      if (!pc.l) I.addWallC(owner, pc.x1, pc.z1, pc.x2, pc.z2, Fk - 0.05, ceilY); else I.addWallC(owner, pc.x1, pc.z1, pc.x2, pc.z2, Fk + 2.1, ceilY);
    }
    // stairs + railing
    if (stair) {
      const q = I.holeQ, rect = [rects.wood, rects.dark];
      const flight = (bC, aFrom, aTo, yFrom, yTo) => {  // steps along a from aFrom -> aTo (rising from yFrom to yTo), lateral centre bC
        const N = Math.max(4, Math.round(Math.abs(yTo - yFrom) / 0.18)), da = (aTo - aFrom) / N, dy = (yTo - yFrom) / N, hw = stair.bw / 2;
        for (let s = 0; s < N; s++) {
          const aa = aFrom + s * da, ab = aa + da, yt = yFrom + (s + 0.5) * dy, yp = yFrom + (s - 0.5) * dy;
          const A = q(aa, bC - hw), Bq = q(aa, bC + hw), C = q(ab, bC + hw), D = q(ab, bC - hw);
          B.quad([[A[0], yt, A[1]], [Bq[0], yt, Bq[1]], [C[0], yt, C[1]], [D[0], yt, D[1]]], [[0, 0], [1, 0], [1, 0.3], [0, 0.3]], rects.wood, [0.95, 0.95, 0.95]);
          const ys = Math.min(yp, yt); B.quad([[A[0], yt, A[1]], [Bq[0], yt, Bq[1]], [Bq[0], ys - 0.0, Bq[1]], [A[0], ys, A[1]]], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], rects.dark, [0.9, 0.9, 0.9]);
        }
        // soffit and side stringers
        const A0 = q(aFrom, bC - hw), A1 = q(aFrom, bC + hw), T0 = q(aTo, bC - hw), T1 = q(aTo, bC + hw), th = 0.35;
        B.quad([[A0[0], yFrom - th, A0[1]], [A1[0], yFrom - th, A1[1]], [T1[0], yTo - th, T1[1]], [T0[0], yTo - th, T0[1]]], [[0, 0], [1, 0], [1, 2], [0, 2]], rects.dark, [0.8, 0.8, 0.8]);
        B.quad([[A0[0], yFrom - th, A0[1]], [T0[0], yTo - th, T0[1]], [T0[0], yTo, T0[1]], [A0[0], yFrom, A0[1]]], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], rects.dark, [0.8, 0.8, 0.8]);
        B.quad([[A1[0], yFrom - th, A1[1]], [T1[0], yTo - th, T1[1]], [T1[0], yTo, T1[1]], [A1[0], yFrom, A1[1]]], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], rects.dark, [0.8, 0.8, 0.8]);
      };
      if (k < n - 1) {
        const yM = Fk + stair.half, yT = Fk + sh, b1c = stair.bw / 2, b2c = stair.B - stair.bw / 2;
        flight(b1c, 0, stair.Lf, Fk, yM);          // flight 1: up, away from the entrance side
        flight(b2c, stair.Lf, 0, yM, yT);          // flight 2: back, to the next floor
        // landing slab
        const L0 = q(stair.Lf, 0), L1 = q(stair.A, 0), L2 = q(stair.A, stair.B), L3 = q(stair.Lf, stair.B);
        B.quad([[L0[0], yM, L0[1]], [L1[0], yM, L1[1]], [L2[0], yM, L2[1]], [L3[0], yM, L3[1]]], [[0, 0], [1, 0], [1, 2], [0, 2]], rects.wood, [0.95, 0.95, 0.95]);
        // colliders: ramps and landing
        const w1a = q(0, b1c), w1b = q(stair.Lf, b1c), w2a = q(stair.Lf, b2c), w2b = q(0, b2c);
        W.addColliderOwner(owner, 'decks', { x1: w1a[0], z1: w1a[1], x2: w1b[0], z2: w1b[1], y1: Fk, y2: yM, hw: stair.bw / 2, owner }, w1a[0], w1a[1], w1b[0], w1b[1]);
        W.addColliderOwner(owner, 'decks', { x1: w2a[0], z1: w2a[1], x2: w2b[0], z2: w2b[1], y1: yM, y2: yT, hw: stair.bw / 2, owner }, w2a[0], w2a[1], w2b[0], w2b[1]);
        const lp = [L0[0], L0[1], L1[0], L1[1], L2[0], L2[1], L3[0], L3[1]]; const lring = sArea(lp) < 0 ? [L3[0], L3[1], L2[0], L2[1], L1[0], L1[1], L0[0], L0[1]] : lp;
        const lx = [L0[0], L1[0], L2[0], L3[0]], lz = [L0[1], L1[1], L2[1], L3[1]];
        W.addColliderOwner(owner, 'floors', { ring: lring, holes: null, y: yM, b: [Math.min(...lx), Math.min(...lz), Math.max(...lx), Math.max(...lz)], owner }, Math.min(...lx), Math.min(...lz), Math.max(...lx), Math.max(...lz));
      }
      // railings around the hole in this level's floor
      if (k > 0) {
        const rail = (aA, bA, aB, bB) => { const P0 = q(aA, bA), P1 = q(aB, bB);
          const dx = P1[0] - P0[0], dz = P1[1] - P0[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * 0.03, nz = dx / L * 0.03;
          vq(B, P0[0] + nx, P0[1] + nz, P1[0] + nx, P1[1] + nz, Fk, Fk + 1.0, 0, L, Fk, 1, rects.dark, [0.85, 0.85, 0.85]); vq(B, P0[0] - nx, P0[1] - nz, P1[0] - nx, P1[1] - nz, Fk, Fk + 1.0, 0, L, Fk, 1, rects.dark, [0.85, 0.85, 0.85]);
          I.addWallC(owner, P0[0], P0[1], P1[0], P1[1], Fk, Fk + 1.0); };
        const a0 = 0.0, A = stair.A, Bw = stair.B;
        rail(A, 0, A, Bw); rail(a0, 0, A, 0); rail(a0, Bw, A, Bw);
        if (k === n - 1) rail(a0, 0, a0, stair.bw + 0.05);
      }
    }
    // blocked space under the stairs (collision + dark panels) so that nobody walks under the flights
    if (stair && k === 0) {
      const q = I.holeQ, yM = Fk + stair.half, yT = Fk + sh;
      I.addWallC(owner, ...q(0, 0), ...q(stair.A, 0), Fk - 0.05, Fk + 1.0);
      I.addWallC(owner, ...q(stair.A, 0), ...q(stair.A, stair.B), Fk - 0.05, Fk + 1.0);
      I.addWallC(owner, ...q(0, stair.B), ...q(stair.A, stair.B), Fk - 0.05, Fk + 1.0);
      const ac = 1.5, wt = yT - ac * stair.slope - 0.4;
      I.addWallC(owner, ...q(ac, stair.bw + 0.075), ...q(ac, stair.B), Fk - 0.05, Fk + 1.2);
      const dk = [0.45, 0.4, 0.36], vv = (a0, b0, a1, b1, ya, yb) => { const P0 = q(a0, b0), P1 = q(a1, b1); vq(B, P0[0], P0[1], P1[0], P1[1], ya, yb, 0, 1, Fk, sh, rects.dark, dk); };
      vv(ac, stair.bw + 0.075, ac, stair.B, Fk, wt); vv(stair.A, 0, stair.A, stair.B, Fk, yM); vv(stair.Lf, 0, stair.A, 0, Fk, yM); vv(stair.Lf, stair.B, stair.A, stair.B, Fk, yM);
    }
    // ---- furniture: boxes in the uv frame, rendered as one InstancedMesh per level
    const boxes = [];
    for (let ri = 0; ri < rooms.length; ri++) {
      const R = rooms[ri]; if (R.area < 6) continue;
      const placed = [];
      const ctx = { rng: rngFrom(p.seed * 131 + k * 17 + ri), inside: (u, v) => { const q = I.toXZ(u, v); return I.inside_fn(q[0], q[1]); }, clear: I.clear, placed };
      for (const b of furnish(types[ri], R, ctx)) boxes.push(b);
    }
    let fmesh = null;
    if (boxes.length) {
      const geo = furnBase().clone(), N = boxes.length, ra = new Float32Array(N * 4), ic = new Float32Array(N * 3);
      const mesh = new THREE.InstancedMesh(geo, this.mat, N), M4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      qq.setFromAxisAngle(up, Math.atan2(-uz, ux));
      boxes.forEach((b, i) => {
        const cu = (b.u0 + b.u1) / 2, cv = (b.v0 + b.v1) / 2; ps.set(cu * ux + cv * vx, Fk + b.y0, cu * uz + cv * vz); sc.set(Math.max(0.02, b.u1 - b.u0), Math.max(0.02, b.y1 - b.y0), Math.max(0.02, b.v1 - b.v0));
        M4.compose(ps, qq, sc); mesh.setMatrixAt(i, M4);
        const r = rects[b.rect]; ra.set(r, i * 4); ic.set(b.color, i * 3);
        if (b.solid) { const c = [[b.u0, b.v0], [b.u1, b.v0], [b.u1, b.v1], [b.u0, b.v1]].map(([u, v]) => I.toXZ(u, v)); for (let e = 0; e < 4; e++) { const a = c[e], bb = c[(e + 1) % 4]; I.addWallC(owner, a[0], a[1], bb[0], bb[1], Fk + b.y0, Fk + b.y1); } }
      });
      geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(ra, 4)); mesh.instanceColor = new THREE.InstancedBufferAttribute(ic, 3); mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; I.group.add(mesh); fmesh = mesh;
    }
    const mesh = new THREE.Mesh(B.build(), this.mat); mesh.matrixAutoUpdate = false; I.group.add(mesh);
    I.levels.set(k, { mesh, fmesh, owner });
  }
}

let FURN = null;
function furnBase() {
  if (FURN) return FURN;
  const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
  const nr = g.attributes.normal, col = new Float32Array(nr.count * 3);
  for (let i = 0; i < nr.count; i++) { const y = nr.getY(i), x = Math.abs(nr.getX(i)); const v = y > 0.5 ? 1.0 : y < -0.5 ? 0.45 : (x > 0.5 ? 0.78 : 0.66); col[3 * i] = col[3 * i + 1] = col[3 * i + 2] = v; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('normal'); return FURN = g;
}
