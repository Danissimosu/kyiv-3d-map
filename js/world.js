// World: streams 500 m tiles, builds merged geometry per tile, answers height / collision queries.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { InteriorManager, planBuilding, sArea, offsetRing, DOOR_W, DOOR_H } from './interior.js';
import { pbrMaps, makeDoorTexture, DOOR_RECT, makeFacadeTextures, FACADE_PROPS, makeRoofTextures, makeGroundTextures, roadTexture, waterNormal } from './textures.js';

const FLOOR_H = 3.1, GF_H = 4.2, CELL = 32;

class MB {  // mesh builder (merged geometry)
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; this.vc = 0; }
  v(x, y, z, nx, ny, nz, u, v, r, g, b) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v); this.c.push(r, g, b); return this.vc++; }
  tri(a, b, c) { this.i.push(a, b, c); }
  get empty() { return this.vc === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.vc > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
// flat triangle with normal forced to face `ref`
function ftri(B, a, b, c, ref, ua, ub, uc, col) {
  let ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], bx = c[0] - a[0], by = c[1] - a[1], bz = c[2] - a[2];
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return; nx /= l; ny /= l; nz /= l;
  if (nx * ref[0] + ny * ref[1] + nz * ref[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; nx = -nx; ny = -ny; nz = -nz; }
  const i0 = B.v(a[0], a[1], a[2], nx, ny, nz, ua[0], ua[1], col[0], col[1], col[2]);
  const i1 = B.v(b[0], b[1], b[2], nx, ny, nz, ub[0], ub[1], col[0], col[1], col[2]);
  const i2 = B.v(c[0], c[1], c[2], nx, ny, nz, uc[0], uc[1], col[0], col[1], col[2]);
  B.tri(i0, i1, i2);
}
const UP = [0, 1, 0];
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function signedArea(r) { let s = 0; for (let i = 0, n = r.length / 2; i < n; i++) { const j = (i + 1) % n; s += r[2 * i] * r[2 * j + 1] - r[2 * j] * r[2 * i + 1]; } return s / 2; }
function orientRing(r, ccw) { if ((signedArea(r) > 0) === ccw) return r; const o = []; for (let i = r.length / 2 - 1; i >= 0; i--) o.push(r[2 * i], r[2 * i + 1]); return o; }
function pip(r, x, z) { let inside = false; for (let i = 0, n = r.length / 2, j = n - 1; i < n; j = i++) { const xi = r[2 * i], zi = r[2 * i + 1], xj = r[2 * j], zj = r[2 * j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; } return inside; }
function triangulate(ring, holes) {
  const v2 = r => { const a = []; for (let i = 0; i < r.length; i += 2) a.push(new THREE.Vector2(r[i], r[i + 1])); return a; };
  const c = v2(ring), hs = (holes || []).map(v2);
  const faces = THREE.ShapeUtils.triangulateShape(c, hs);
  const all = c.concat(...hs);
  return { pts: all, faces };
}

export class World {
  constructor(scene, manifest, opts = {}) {
    this.scene = scene; this.man = manifest; this.tiles = new Map(); this.TILE = manifest.tile; this.NG = manifest.ng; this.GRID = manifest.grid;
    this.cells = new Map(); this.loading = new Set(); this.ready = []; this.loadR = opts.loadR || 1500; this.unloadR = opts.unloadR || 2300;
    this.detailR = opts.detailR || 600; this.shadows = opts.shadows !== false; this.treeKeep = opts.treeKeep ?? 1; this.lampKeep = opts.lampKeep ?? 1;
    this.facadeTex = makeFacadeTextures();
    const PBR = opts.pbr !== false, ns = opts.normalScale ?? 1.0;
    this.facadeMat = this.facadeTex.map((t, i) => { const m = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, ...FACADE_PROPS[i] });
      if (PBR) { const p = pbrMaps(t, { strength: 2.4, rLo: 0.28, rHi: 1.0 }); m.normalMap = p.normalMap; m.roughnessMap = p.roughnessMap; m.normalScale.set(ns, ns); m.roughness = Math.min(1, FACADE_PROPS[i].roughness * 1.05); } return m; });
    const rt = makeRoofTextures();
    this.roofMat = [new THREE.MeshStandardMaterial({ map: rt[0], vertexColors: true, roughness: 0.95 }),
                    new THREE.MeshStandardMaterial({ map: rt[1], vertexColors: true, roughness: 0.5, metalness: 0.3 })];
    if (PBR) rt.forEach((t, i) => { const p = pbrMaps(t, { strength: 3.0, rLo: 0.5, rHi: 1.0, glossDark: false }); this.roofMat[i].normalMap = p.normalMap; this.roofMat[i].roughnessMap = p.roughnessMap; this.roofMat[i].normalScale.set(ns, ns); });
    this.concreteMat = new THREE.MeshStandardMaterial({ map: roadTexture('concrete'), vertexColors: true, roughness: 0.95 });
    if (PBR) { const p = pbrMaps(this.concreteMat.map, { strength: 2.5, rLo: 0.6, rHi: 1.0, glossDark: false }); this.concreteMat.normalMap = p.normalMap; this.concreteMat.roughnessMap = p.roughnessMap; }
    this.pbr = PBR; this.normalScale = ns;
    this.gt = makeGroundTextures();
    this.roadMats = {};
    this.waterN = waterNormal(); this.waterN.repeat.set(1, 1);
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x1f4f62, roughness: 0.06, metalness: 0.15, normalMap: this.waterN, normalScale: new THREE.Vector2(0.55, 0.55), transparent: true, opacity: 0.9, envMapIntensity: 1.3 });
    this.treeGeo = this._treeGeos();
    this.treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    this.lampGeo = (() => { const a = new THREE.CylinderGeometry(0.06, 0.08, 6, 6); a.translate(0, 3, 0); const b = new THREE.BoxGeometry(1.0, 0.12, 0.3); b.translate(0.5, 6.0, 0); return mergeGeometries([a, b]); })();
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.6, metalness: 0.5 });
    this.stats = { buildings: 0, tris: 0 };
    this.base = opts.base || 'tiles/'; this.v2 = manifest.v === 2;
    this.manifestTiles = new Map(manifest.tiles.map(t => [t[0] + '_' + t[1], t]));
    { const d = new Uint8Array([0, 0, 0, 255]); this.flatSplat = new THREE.DataTexture(d, 1, 1); this.flatSplat.needsUpdate = true; this.flatSplat.userData = { shared: true }; }
    this.bounds = manifest.bounds;
    this.interiors = new InteriorManager(this, scene);
  }

  // ---------------------------------------------------------------- heights
  heightAt(x, z) {
    const T = this.TILE, ix = Math.floor(x / T), iz = Math.floor(z / T);
    let t = this.tiles.get(ix + '_' + iz);
    if (!t || !t.h) {
      // not loaded: clamp to nearest loaded neighbour edge (best effort)
      const b = this.bounds; if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) { x = Math.min(Math.max(x, b[0]), b[2] - 0.01); z = Math.min(Math.max(z, b[1]), b[3] - 0.01); return this.heightAt(x, z); }
      return this._lastH || 100;
    }
    const G = this.GRID, NG = this.NG;
    const fx = (x - ix * T) / G, fz = (z - iz * T) / G;
    let i = Math.min(Math.floor(fx), NG - 2), j = Math.min(Math.floor(fz), NG - 2); const u = fx - i, v = fz - j, h = t.h;
    const a = h[j * NG + i], b = h[j * NG + i + 1], c = h[(j + 1) * NG + i], d = h[(j + 1) * NG + i + 1];
    return this._lastH = (u + v <= 1) ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d);
  }
  _cell(x, z, create) { const k = Math.floor(x / CELL) + ',' + Math.floor(z / CELL); let c = this.cells.get(k); if (!c && create) { c = { walls: [], roofs: [], decks: [], floors: [] }; this.cells.set(k, c); } return c; }
  _addCollider(tileKey, kind, obj, x0, z0, x1, z1) {
    const t = this.tiles.get(tileKey);
    for (let cx = Math.floor(Math.min(x0, x1) / CELL); cx <= Math.floor(Math.max(x0, x1) / CELL); cx++)
      for (let cz = Math.floor(Math.min(z0, z1) / CELL); cz <= Math.floor(Math.max(z0, z1) / CELL); cz++) {
        const k = cx + ',' + cz; let c = this.cells.get(k); if (!c) { c = { walls: [], roofs: [], decks: [], floors: [] }; this.cells.set(k, c); }
        c[kind].push(obj); t.cellKeys.add(k);
      }
  }
  addColliderOwner(owner, kind, obj, x0, z0, x1, z1) {   // dynamic colliders (interiors), removed by removeOwner(owner)
    for (let cx = Math.floor(Math.min(x0, x1) / CELL); cx <= Math.floor(Math.max(x0, x1) / CELL); cx++)
      for (let cz = Math.floor(Math.min(z0, z1) / CELL); cz <= Math.floor(Math.max(z0, z1) / CELL); cz++) {
        const k = cx + ',' + cz; let c = this.cells.get(k); if (!c) { c = { walls: [], roofs: [], decks: [], floors: [] }; this.cells.set(k, c); }
        c[kind].push(obj); owner.cellKeys.add(k);
      }
  }
  removeOwner(owner) {
    for (const k of owner.cellKeys) { const c = this.cells.get(k); if (!c) continue; for (const a of ['walls', 'decks', 'floors']) c[a] = c[a].filter(o => o.owner !== owner); if (!c.walls.length && !c.roofs.length && !c.decks.length && !c.floors.length) this.cells.delete(k); }
    owner.cellKeys.clear();
  }
  setDoorLeaf(plan, visible) {
    const t = plan.tile, a = t.doorGeo && t.doorGeo.attributes.position; if (!a || plan.leafStart === undefined) return;
    for (let i = 0; i < plan.leafOrig.length; i++) a.array[(plan.leafStart + i) * 3 + 1] = visible ? plan.leafOrig[i] : -1e4;
    a.needsUpdate = true;
  }
  groundAt(x, z, feet) {
    let g = this.heightAt(x, z);
    const c = this._cell(x, z, false); if (!c) return g;
    if (c.floors.length) {   // interior floors override the terrain (the floor is the walkable surface inside a building)
      let fy = -1e9;
      for (const f of c.floors) if (f.y <= feet + 0.6 && f.y > fy && x >= f.b[0] && x <= f.b[2] && z >= f.b[1] && z <= f.b[3] && pip(f.ring, x, z)) {
        let inH = false; if (f.holes) for (const h of f.holes) if (pip(h, x, z)) { inH = true; break; } if (!inH) fy = f.y; }
      if (fy > -1e9) g = fy;
    }
    for (const r of c.roofs) if (r.top <= feet + 0.6 && r.top > g && x >= r.b[0] && x <= r.b[2] && z >= r.b[1] && z <= r.b[3] && pip(r.ring, x, z)) {
      let inH = false; if (r.holes) for (const h of r.holes) if (pip(h, x, z)) { inH = true; break; } if (!inH) g = r.top; }
    for (const d of c.decks) {
      const dx = d.x2 - d.x1, dz = d.z2 - d.z1, L2 = dx * dx + dz * dz; if (L2 < 1e-6) continue;
      let t = ((x - d.x1) * dx + (z - d.z1) * dz) / L2; if (t < 0 || t > 1) continue;
      const px = d.x1 + t * dx - x, pz = d.z1 + t * dz - z; if (px * px + pz * pz > d.hw * d.hw) continue;
      const y = d.y1 + t * (d.y2 - d.y1); if (y <= feet + 0.6 && y > g) g = y;
    }
    return g;
  }
  deckAt(x, z, feet) {   // highest bridge/ramp deck surface at (x,z) not above `feet` (or -1e9)
    const c = this._cell(x, z, false); if (!c) return -1e9; let g = -1e9;
    for (const d of c.decks) {
      const dx = d.x2 - d.x1, dz = d.z2 - d.z1, L2 = dx * dx + dz * dz; if (L2 < 1e-6) continue;
      const t = ((x - d.x1) * dx + (z - d.z1) * dz) / L2; if (t < 0 || t > 1) continue;
      const px = d.x1 + t * dx - x, pz = d.z1 + t * dz - z; if (px * px + pz * pz > d.hw * d.hw) continue;
      const y = d.y1 + t * (d.y2 - d.y1); if (y <= feet && y > g) g = y;
    }
    return g;
  }
  collide(p, r, feet, height) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (let cx = Math.floor((p.x - r) / CELL); cx <= Math.floor((p.x + r) / CELL); cx++)
        for (let cz = Math.floor((p.z - r) / CELL); cz <= Math.floor((p.z + r) / CELL); cz++) {
          const c = this.cells.get(cx + ',' + cz); if (!c) continue;
          for (const w of c.walls) {
            if (feet + 0.55 >= w.y1 || feet + height <= w.y0) continue;
            const dx = w.x2 - w.x1, dz = w.z2 - w.z1, L2 = dx * dx + dz * dz; if (L2 < 1e-9) continue;
            let t = ((p.x - w.x1) * dx + (p.z - w.z1) * dz) / L2; t = Math.max(0, Math.min(1, t));
            const qx = w.x1 + t * dx, qz = w.z1 + t * dz; let ox = p.x - qx, oz = p.z - qz; const d2 = ox * ox + oz * oz;
            if (d2 < r * r) {
              let d = Math.sqrt(d2);
              if (d < 1e-5) { ox = w.nx; oz = w.nz; d = 0; } else { ox /= d; oz /= d; }
              p.x += ox * (r - d); p.z += oz * (r - d); moved = true;
            }
          }
        }
      if (!moved) break;
    }
  }
  waterAt(x, z) {
    const T = this.TILE, t = this.tiles.get(Math.floor(x / T) + '_' + Math.floor(z / T)); if (!t || !t.waters) return null;
    for (const w of t.waters) if (pip(w.ring, x, z)) { let hole = false; if (w.holes) for (const h of w.holes) if (pip(h, x, z)) { hole = true; break; } if (!hole) return w.level; }
    return null;
  }

  // ---------------------------------------------------------------- streaming
  update(cam, dt, budgetMs = 6) {
    const T = this.TILE, px = cam.x, pz = cam.z;
    const want = [], R = this.loadR, R2 = this.unloadR;
    const a0 = Math.floor((px - R) / T), a1 = Math.floor((px + R) / T), b0 = Math.floor((pz - R) / T), b1 = Math.floor((pz + R) / T);
    for (let ix = a0; ix <= a1; ix++) for (let iz = b0; iz <= b1; iz++) {
      const key = ix + '_' + iz; if (!this.manifestTiles.has(key) || this.tiles.has(key) || this.loading.has(key)) continue;
      const d = Math.hypot((ix + 0.5) * T - px, (iz + 0.5) * T - pz); if (d < R) want.push([d, ix, iz, key]);
    }
    for (const [key, t] of this.tiles) {
      const d = Math.hypot((t.ix + 0.5) * T - px, (t.iz + 0.5) * T - pz);
      if (d > R2) { this.unloadTile(key); continue; }
      t.group.visible = d < R + 400;
      if (t.treeGroup) t.treeGroup.visible = d < 700;
      if (t.detail) t.detail.visible = d < this.detailR;
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const w of want) { if (this.loading.size >= 4) break; this.loadTile(w[1], w[2], w[3]); }
    const t0 = performance.now();
    while (this.ready.length && performance.now() - t0 < budgetMs) {
      const r = this.ready.shift(); this.loading.delete(r.key); this.buildTile(r.ix, r.iz, r.key, r.data, r.splat);
    }
  }
  async loadTile(ix, iz, key) {
    this.loading.add(key);
    try {
      const me = this.manifestTiles.get(key), hasSplat = !this.v2 || (me && me[5]);
      const [data, splat] = await Promise.all([
        fetch(`${this.base}t_${ix}_${iz}.json`).then(r => { if (!r.ok) throw new Error('tile ' + key + ' ' + r.status); return r.json(); }),
        hasSplat ? new Promise((res) => { new THREE.TextureLoader().load(`${this.base}t_${ix}_${iz}.png`, t => res(t), undefined, () => res(null)); }) : Promise.resolve(this.flatSplat)]);
      if (data.v === 2) this._denorm(data, ix * this.TILE, iz * this.TILE);
      this.ready.push({ ix, iz, key, data, splat });
    } catch (e) { console.error(e); this.loading.delete(key); this.tiles.set(key, { failed: true, ix, iz, group: new THREE.Group(), cellKeys: new Set() }); }
  }
  // tile format v2: coordinates are tile-local, heights quantised -> absolute world coordinates (in place)
  _denorm(d, ox, oz) {
    const sh = a => { if (a) for (let i = 0; i + 1 < a.length; i += 2) { a[i] += ox; a[i + 1] += oz; } };
    const h = new Float32Array(d.h.length); for (let i = 0; i < h.length; i++) h[i] = d.hb + d.h[i] / 10; d.h = h;
    for (const b of d.b || []) { sh(b.p); if (b.i) b.i.forEach(sh); }
    for (const r of d.r || []) sh(r.p);
    for (const w of d.w || []) { sh(w.p); if (w.i) w.i.forEach(sh); }
    for (const w of d.wl || []) sh(w.p);
    if (d.t) for (let i = 0; i < d.t.length; i += 4) { d.t[i] += ox; d.t[i + 1] += oz; }
    sh(d.l);
  }
  unloadTile(key) {
    const t = this.tiles.get(key); if (!t) return;
    t.alive = false; if (this.interiors) this.interiors.disposeTile(t);
    this.scene.remove(t.group); if (t.treeGroup) this.scene.remove(t.treeGroup);
    for (const g of [t.group, t.treeGroup]) if (g) g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.userData.ownMat) { o.material.dispose(); } if (o.userData.splat && !(o.userData.splat.userData && o.userData.splat.userData.shared)) o.userData.splat.dispose(); });
    for (const k of t.cellKeys) { const c = this.cells.get(k); if (!c) continue; for (const a of ['walls', 'roofs', 'decks']) c[a] = c[a].filter(o => o.tile !== key); if (!c.walls.length && !c.roofs.length && !c.decks.length && !c.floors.length) this.cells.delete(k); }
    this.tiles.delete(key);
  }
  get loadedCount() { let n = 0; for (const t of this.tiles.values()) if (t.h) n++; return n; }

  // ---------------------------------------------------------------- tile construction
  buildTile(ix, iz, key, d, splat) {
    const T = this.TILE, ox = ix * T, oz = iz * T;
    const group = new THREE.Group(); group.name = 'tile' + key;
    const t = { ix, iz, key, group, h: Float32Array.from(d.h), cellKeys: new Set(), waters: [], ox, oz, alive: true, plans: [], roads: d.r || [], blds: d.b || [] };
    this.tiles.set(key, t);
    const add = (geo, mat, o = {}) => { const m = new THREE.Mesh(geo, mat); m.castShadow = !!o.cast; m.receiveShadow = o.receive !== false; if (o.order) m.renderOrder = o.order; m.matrixAutoUpdate = false; group.add(m); return m; };
    // terrain
    { const NG = this.NG, G = this.GRID, pos = new Float32Array(NG * NG * 3), nor = new Float32Array(NG * NG * 3);
      for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) { const k = j * NG + i, x = ox + i * G, z = oz + j * G; pos[3 * k] = x; pos[3 * k + 1] = t.h[k]; pos[3 * k + 2] = z; }
      this._tmpTile = t;
      for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) {
        const k = j * NG + i, x = ox + i * G, z = oz + j * G;
        const hl = i > 0 ? t.h[k - 1] : this.heightAt(x - G, z), hr = i < NG - 1 ? t.h[k + 1] : this.heightAt(x + G, z);
        const hu = j > 0 ? t.h[k - NG] : this.heightAt(x, z - G), hd = j < NG - 1 ? t.h[k + NG] : this.heightAt(x, z + G);
        let nx = hl - hr, ny = 2 * G, nz = hu - hd; const l = Math.hypot(nx, ny, nz); nor[3 * k] = nx / l; nor[3 * k + 1] = ny / l; nor[3 * k + 2] = nz / l;
      }
      const idx = []; for (let j = 0; j < NG - 1; j++) for (let i = 0; i < NG - 1; i++) { const a = j * NG + i, b = a + 1, c = a + NG, dd = c + 1; idx.push(a, c, b, b, c, dd); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(idx);
      g.computeBoundingSphere(); g.computeBoundingBox();
      const m = add(g, this._terrainMat(ox, oz, splat), { receive: true }); m.userData.ownMat = true; m.userData.splat = splat;
    }
    // buildings
    this._buildBuildings(t, d.b || [], key, add, d.r || []);
    this._buildRoads(t, d.r || [], key, add);
    this._buildWater(t, d.w || [], d.wl || [], add);
    // trees + lamps
    const tg = new THREE.Group(); t.treeGroup = tg;
    if (d.t && d.t.length) this._buildTrees(t, d.t, tg);
    if (d.l && d.l.length) { const keepL = []; for (let i = 0; i < d.l.length; i += 2) if (this.lampKeep >= 1 || hash(d.l[i] * 0.37 + d.l[i + 1]) < this.lampKeep) keepL.push(d.l[i], d.l[i + 1]); d.l = keepL; const n = d.l.length / 2, im = new THREE.InstancedMesh(this.lampGeo, this.lampMat, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
      for (let i = 0; i < n; i++) { const x = d.l[2 * i], z = d.l[2 * i + 1]; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(x * 7 + z) * 6.28); p.set(x, this.heightAt(x, z), z); m.compose(p, q, s); im.setMatrixAt(i, m); }
      im.castShadow = this.shadows; im.frustumCulled = false; tg.add(im); }
    this.scene.add(group); this.scene.add(tg);
  }

  _terrainMat(ox, oz, splat) {
    if (splat && !(splat.userData && splat.userData.shared)) { splat.flipY = false; splat.colorSpace = THREE.NoColorSpace; splat.wrapS = splat.wrapT = THREE.ClampToEdgeWrapping; splat.minFilter = THREE.LinearMipmapLinearFilter; splat.generateMipmaps = true; splat.needsUpdate = true; }
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const gt = this.gt, T = this.TILE;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.tSplat = { value: splat }; sh.uniforms.tGrass = { value: gt.grass }; sh.uniforms.tForest = { value: gt.forest };
      sh.uniforms.tPave = { value: gt.pave }; sh.uniforms.tDirt = { value: gt.dirt }; sh.uniforms.uOrg = { value: new THREE.Vector2(ox, oz) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(transformed,1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vWXZ; uniform sampler2D tSplat, tGrass, tForest, tPave, tDirt; uniform vec2 uOrg;`)
        .replace('#include <map_fragment>', `
vec3 sp = texture2D(tSplat, (vWXZ - uOrg) / ${T.toFixed(1)}).rgb;
vec3 g1 = texture2D(tGrass, vWXZ * 0.23).rgb, g2 = texture2D(tGrass, vWXZ * 0.031 + 0.37).rgb;
vec3 grass = g1 * (0.6 + 0.8 * g2);
vec3 forest = texture2D(tForest, vWXZ * 0.31).rgb * (0.7 + 0.6 * g2) * 1.2;
vec3 pave = texture2D(tPave, vWXZ * 0.33).rgb;
vec3 dirt = texture2D(tDirt, vWXZ * 0.19).rgb * (0.7 + 0.6 * g2);
vec3 urban = mix(dirt, grass, 0.62);
vec3 col = mix(urban, grass * 1.05, clamp(sp.r * 1.6, 0.0, 1.0));
col = mix(col, forest, sp.g);
col = mix(col, pave, sp.b);
diffuseColor.rgb *= col * 1.25;`);
    };
    m.customProgramCacheKey = () => 'kyivTerrain';
    return m;
  }

  // ------------------------------------------------------------- buildings
  _buildBuildings(t, list, key, add, roadsRaw) {
    const W = this.facadeTex.map(() => new MB()), R0 = new MB(), R1 = new MB(), DB = new MB(), DT = new MB();
    // ---- interior planning: door on the street-facing wall (nearest road), inner wall offset, levels
    const roadSegs = []; for (const r of roadsRaw) { if (r.b || typeof r.c !== 'number' || r.c < 1) continue; const p = r.p; for (let i = 0; i + 3 < p.length; i += 2) roadSegs.push(p[i], p[i + 1], p[i + 2], p[i + 3]); }
    const others = list.map(b => { const r = orientRing(b.p, true); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); } return { b: [x0, z0, x1, z1], ring: r }; });
    const pm = this.poiMap && this.poiMap.get(key); if (pm) for (const [pbi, poi] of pm) { const bb = list[pbi]; if (bb && poi.brand !== undefined) { bb.c = poi.brand; if (poi.cat.svc === 'shop') bb.pshop = 1; } }
    const planOf = new Map(); const SKIPK = /^(roof|carport|constructio|ruins|bunker|greenhouse|cabin|hut|kiosk|toilets|static_cara|container|silo|tank|tower|chimney|bridge)/;
    for (let bi = 0; bi < list.length; bi++) {
      const b = list[bi]; if (b.m || SKIPK.test(b.k || '')) continue;
      try {
        const ring = orientRing(b.p, true), holes = (b.i || []).map(h => orientRing(h, false)), eave = b.g + b.h - (b.rh || 0);
        const pl = planBuilding(ring, holes, b.g, eave, b.f, roadSegs, others, bi, (x, z) => this.heightAt(x, z)); if (!pl) continue;
        const o = others[bi]; pl.kind = b.k || "yes"; pl.bi = bi; pl.bid = key + ':' + bi; pl.tile = t; pl.key = key; pl.cx = (o.b[0] + o.b[2]) / 2; pl.cz = (o.b[1] + o.b[3]) / 2; pl.radius = Math.hypot(o.b[2] - o.b[0], o.b[3] - o.b[1]) / 2;
        pl.seed = Math.floor(hash(ring[0] * 13.1 + ring[1] * 7.7) * 1e6) + 1; pl.bb = o.b;
        if (pm && pm.has(bi)) { pl.poi = pm.get(bi); pl.poi.pl = pl; pl.poi.built = true; }
        const d = pl.door, i = d.edge, j = (i + 1) % (ring.length / 2), ir = pl.inner.ring;
        const pt = (r, f) => [r[2 * i] + (r[2 * j] - r[2 * i]) * f, r[2 * i + 1] + (r[2 * j + 1] - r[2 * i + 1]) * f];
        pl.doorOut0 = pt(ring, d.f0); pl.doorOut1 = pt(ring, d.f1); pl.doorIn0 = pt(ir, d.f0); pl.doorIn1 = pt(ir, d.f1); pl.doorIn = pt(ir, 0.5);
        planOf.set(bi, pl);
      } catch (e) { console.warn('plan fail', e); }
    }
    // a footprint inside a bigger planned footprint (building:part etc.) stays solid
    for (const [bi, pl] of [...planOf]) for (const [bj, q] of planOf) if (bj !== bi && q.area > pl.area && q.bb[0] <= pl.cx && q.bb[2] >= pl.cx && q.bb[1] <= pl.cz && q.bb[3] >= pl.cz && pip(q.ring, pl.cx, pl.cz)) { planOf.delete(bi); break; }
    const doorTex = this.doorTex || (this.doorTex = makeDoorTexture());
    const col = new THREE.Color();
    for (let bi = 0; bi < list.length; bi++) {
      const b = list[bi];
      const ring = orientRing(b.p, true), holes = (b.i || []).map(h => orientRing(h, false));
      const n = ring.length / 2; if (n < 3) continue;
      const g = b.g, top = g + b.h, rh = b.rh || 0, eave = top - rh, mh = b.m || 0;
      const bottom = mh ? g + mh : g - 1.2;
      const seed = ring[0] * 13.1 + ring[1] * 7.7;
      const tj = 0.86 + 0.16 * hash(seed);
      let wr = tj, wg = tj, wb = tj;
      if (b.c !== undefined) { col.setHex(b.c); const k = 0.55; wr = (1 - k + k * col.r * 1.35) * tj; wg = (1 - k + k * col.g * 1.35) * tj; wb = (1 - k + k * col.b * 1.35) * tj; }
      const wcol = [wr, wg, wb];
      col.setHex(b.rc); const rcol = [col.r, col.g, col.b];
      // wall bands
      const useGF = b.gf && eave - g > 7 && !mh;
      const ref = mh ? g + mh : g;
      const levels = Math.max(1, b.f), fh = Math.max(2.4, (eave - ref) / levels);
      const bands = [];
      if (b.pshop && !mh) {   // POI shop / fast food: tall storefront glass on the ground floor + a strongly brand-coloured fascia band above (readable from the street)
        const sf = Math.max(1.8, Math.min(3.6, eave - g - 1.3));
        bands.push({ y0: bottom, y1: g + sf, st: (hash(seed + 5) < 0.6 ? 8 : 9), v0: 0, v1: 1, tint: [1, 1, 1] });
        const k2 = 0.9, bc = new THREE.Color(b.c), bt = [1 - k2 + k2 * bc.r * 1.45, 1 - k2 + k2 * bc.g * 1.45, 1 - k2 + k2 * bc.b * 1.45].map(v => Math.min(1.25, v) * tj);
        bands.push({ y0: g + sf, y1: eave, st: b.s, v0: 0, v1: (eave - g - sf) / fh, tint: bt });
      } else if (useGF) {
        bands.push({ y0: bottom, y1: g + GF_H, st: (hash(seed + 5) < 0.6 ? 8 : 9), v0: 0, v1: 1, tint: [1, 1, 1] });
        bands.push({ y0: g + GF_H, y1: eave, st: b.s, v0: 0, v1: (eave - g - GF_H) / fh, tint: wcol });
      } else bands.push({ y0: bottom, y1: eave, st: b.s, v0: (bottom - ref) / fh, v1: (eave - ref) / fh, tint: wcol });
      const walls = [ring, ...holes];
      for (let wi = 0; wi < walls.length; wi++) {
        const r = walls[wi], m = r.length / 2;
        for (let i = 0; i < m; i++) {
          const j = (i + 1) % m, ax = r[2 * i], az = r[2 * i + 1], bx = r[2 * j], bz = r[2 * j + 1];
          const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.05) continue;
          const nx = dz / L, nz = -dx / L, u1 = L / 6;
          const pl = planOf.get(bi), isDoor = pl && wi === 0 && i === pl.door.edge;
          const strip = (bd, fa, fb, ya, yb) => {
            if (yb - ya < 0.02 || fb - fa < 1e-4) return;
            const B = W[bd.st], c = bd.tint, k = (bd.v1 - bd.v0) / (bd.y1 - bd.y0);
            const x0 = ax + dx * fa, z0 = az + dz * fa, x1 = ax + dx * fb, z1 = az + dz * fb, ua = -u1 * fa, ub = -u1 * fb;   // u runs along the wall edge = right-to-left for a viewer outside: negate so lettering (МАГАЗИН · КАФЕ) reads correctly
            const segs = []; let y = ya;     // baked ambient occlusion: dark at the ground, darker under the cornice
            if (bd === bands[0] && ya <= bd.y0 + 0.01) { const ym = Math.min(yb, ya + 3.2); segs.push([ya, ym, 0.64, 1]); y = ym; }
            if (y < yb) { if (bd === bands[bands.length - 1] && yb >= bd.y1 - 0.01 && yb - y > 1.2) { const ym = yb - 0.9; segs.push([y, ym, 1, 1], [ym, yb, 1, 0.82]); } else segs.push([y, yb, 1, 1]); }
            for (const [s0, s1, f0, f1] of segs) {
              const va = bd.v0 + (s0 - bd.y0) * k, vb = bd.v0 + (s1 - bd.y0) * k;
              const a = B.v(x0, s0, z0, nx, 0, nz, ua, va, c[0] * f0, c[1] * f0, c[2] * f0), a2 = B.v(x0, s1, z0, nx, 0, nz, ua, vb, c[0] * f1, c[1] * f1, c[2] * f1);
              const b0 = B.v(x1, s0, z1, nx, 0, nz, ub, va, c[0] * f0, c[1] * f0, c[2] * f0), b2 = B.v(x1, s1, z1, nx, 0, nz, ub, vb, c[0] * f1, c[1] * f1, c[2] * f1);
              B.tri(a, b2, b0); B.tri(a, a2, b2);
            }
          };
          for (const bd of bands) {
            if (bd.y1 - bd.y0 < 0.05) continue;
            if (!isDoor) { strip(bd, 0, 1, bd.y0, bd.y1); continue; }
            const d = pl.door, yd0 = pl.F0, yd1 = pl.F0 + DOOR_H;
            strip(bd, 0, d.f0, bd.y0, bd.y1); strip(bd, d.f1, 1, bd.y0, bd.y1);
            strip(bd, d.f0, d.f1, bd.y0, Math.min(bd.y1, yd0)); strip(bd, d.f0, d.f1, Math.max(bd.y0, yd1), bd.y1);
          }
          if (isDoor) {
            const d = pl.door, P = (f) => [ax + dx * f, az + dz * f], A0 = P(d.f0), A1 = P(d.f1), y0 = pl.F0, y1 = pl.F0 + DOOR_H, n3 = [nx, 0, nz];
            const dq = (p0, p1, p2, p3, rect, off) => {   // p: [x,y,z] corners (bl, br, tr, tl); offset along outward normal
              const q = [p0, p1, p2, p3].map(p => [p[0] + nx * off, p[1], p[2] + nz * off]); const st = DB.vc;
              const uvs = [[rect[0] + rect[2], rect[1]], [rect[0], rect[1]], [rect[0], rect[1] + rect[3]], [rect[0] + rect[2], rect[1] + rect[3]]];   // edge direction runs right-to-left for a viewer outside
              const ids = q.map((p, k) => DB.v(p[0], p[1], p[2], n3[0], 0, n3[2], uvs[k][0], uvs[k][1], 1, 1, 1));
              const cx_ = (q[1][0] - q[0][0]) * 0 , crossY = (q[1][2] - q[0][2]) * 0; void cx_; void crossY;
              // orientation: (p1-p0) x (p3-p0) must face outward
              const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], e2 = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
              const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
              if (cr[0] * nx + cr[2] * nz > 0) { DB.tri(ids[0], ids[1], ids[2]); DB.tri(ids[0], ids[2], ids[3]); } else { DB.tri(ids[0], ids[2], ids[1]); DB.tri(ids[0], ids[3], ids[2]); }
              return st;
            };
            const L = Math.hypot(dx, dz), jw = 0.14 / L, fr = DOOR_RECT.frame, sg = DOOR_RECT.sign;
            // leaf (recessed behind the wall plane, visible through the opening)
            pl.leafStart = dq([A0[0], y0, A0[1]], [A1[0], y0, A1[1]], [A1[0], y1, A1[1]], [A0[0], y1, A0[1]], DOOR_RECT.leaf, -0.03);
            pl.leafOrig = []; for (let k = 0; k < 4; k++) pl.leafOrig.push(DB.p[(pl.leafStart + k) * 3 + 1]);
            // frame: left jamb, right jamb, header
            const J0 = P(d.f0 - jw), J1 = P(d.f1 + jw);
            dq([J0[0], y0, J0[1]], [A0[0], y0, A0[1]], [A0[0], y1 + 0.14, A0[1]], [J0[0], y1 + 0.14, J0[1]], fr, 0.035);
            dq([A1[0], y0, A1[1]], [J1[0], y0, J1[1]], [J1[0], y1 + 0.14, J1[1]], [A1[0], y1 + 0.14, A1[1]], fr, 0.035);
            dq([A0[0], y1, A0[1]], [A1[0], y1, A1[1]], [A1[0], y1 + 0.14, A1[1]], [A0[0], y1 + 0.14, A0[1]], fr, 0.035);
            // sign above the door
            const S0 = P(0.5 - 0.5 / L), S1 = P(0.5 + 0.5 / L);
            dq([S0[0], y1 + 0.25, S0[1]], [S1[0], y1 + 0.25, S1[1]], [S1[0], y1 + 0.75, S1[1]], [S0[0], y1 + 0.75, S0[1]], sg, 0.04);
          }
          if (isDoor) { const d = pl.door, P = (f) => [ax + dx * f, az + dz * f], A0 = P(d.f0), A1 = P(d.f1);
            this._addCollider(key, 'walls', { x1: ax, z1: az, x2: A0[0], z2: A0[1], y0: bottom, y1: top, nx, nz, tile: key }, ax, az, A0[0], A0[1]);
            this._addCollider(key, 'walls', { x1: A1[0], z1: A1[1], x2: bx, z2: bz, y0: bottom, y1: top, nx, nz, tile: key }, A1[0], A1[1], bx, bz);
          } else
          this._addCollider(key, 'walls', { x1: ax, z1: az, x2: bx, z2: bz, y0: bottom, y1: top, nx, nz, tile: key }, ax, az, bx, bz);
        }
      }
      // roof
      const rs = b.r || 0;
      const flat = () => {
        const tr = triangulate(ring, holes);
        for (const f of tr.faces) { const p = f.map(k => tr.pts[k]); ftri(R0, [p[0].x, eave, p[0].y], [p[1].x, eave, p[1].y], [p[2].x, eave, p[2].y], UP, [p[0].x / 6, p[0].y / 6], [p[1].x / 6, p[1].y / 6], [p[2].x / 6, p[2].y / 6], [tj * 0.95, tj * 0.95, tj * 0.95]); }
        return true;
      };
      let flatRoof = false;
      if (rs === 5 || !rs || rh < 0.3) flatRoof = flat();
      else if (rs === 4) { flat(); this._dome(R1, ring, eave, rh, rcol); }
      else if (holes.length) flatRoof = flat();
      else if ((rs === 1 || rs === 2) && n === 4) this._rectRoof(R1, W[b.s], ring, eave, rh, rs, rcol, wcol, fh, ref, levels);
      else if (this._convex(ring)) this._pyramid(R1, ring, eave, rh, rcol);
      else flatRoof = flat();
      // colliders for walking on flat roofs
      if (flatRoof) {
        let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (let i = 0; i < n; i++) { x0 = Math.min(x0, ring[2 * i]); x1 = Math.max(x1, ring[2 * i]); z0 = Math.min(z0, ring[2 * i + 1]); z1 = Math.max(z1, ring[2 * i + 1]); }
        this._addCollider(key, 'roofs', { ring, holes: holes.length ? holes : null, b: [x0, z0, x1, z1], top: eave, tile: key }, x0, z0, x1, z1);
      }
      if (!mh) { try { this._addDetails(DT, { ring, holes, g, eave, ref, fh, levels, useGF, flatRoof, seed, kind: b.k || '', doorEdge: planOf.has(bi) ? planOf.get(bi).door.edge : -1, key, bottom, style: b.s }); } catch (e) { console.warn('detail', e); } }
    }
    const add2 = (B, mat, cast = true) => { if (B.empty) return; const m = add(B.build(), mat, { cast: cast && this.shadows }); this.stats.tris += B.i.length / 3; };
    W.forEach((B, i) => add2(B, this.facadeMat[i])); add2(R0, this.roofMat[0]); add2(R1, this.roofMat[1]);
    if (!DB.empty) { const g = DB.build(); t.doorGeo = g; const m = add(g, this._doorMat(doorTex), { cast: false }); m.userData.doors = true; this.stats.tris += DB.i.length / 3; }
    if (!DT.empty) { const m = add(DT.build(), this._detailMat(doorTex), { cast: false }); t.detail = m; this.stats.tris += DT.i.length / 3; }
    t.plans = [...planOf.values()];
    this.stats.buildings += list.length;
  }
  _detailMat(tex) { return this._dtm || (this._dtm = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.85 })); }
  // exterior details: plinth, cornice, belt courses at the floor lines, balconies, flat-roof parapet + roof boxes (one merged mesh per tile)
  _addDetails(DT, o) {
    const { ring, eave, g, ref, fh, doorEdge, flatRoof, seed, key } = o, n = ring.length / 2, H = eave - ref, UVc = DOOR_RECT.frame, uc = UVc[0] + UVc[2] / 2, vc = UVc[1] + UVc[3] / 2;
    if (H < 5) return;
    const quad = (p0, p1, p2, p3, nrm, c) => {   // flat colour quad (door-atlas 'frame' cell is plain), winding forced toward nrm
      const ids = [p0, p1, p2, p3].map(p => DT.v(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], uc, vc, c[0], c[1], c[2]));
      const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (cr[0] * nrm[0] + cr[1] * nrm[1] + cr[2] * nrm[2] > 0) { DT.tri(ids[0], ids[1], ids[2]); DT.tri(ids[0], ids[2], ids[3]); } else { DT.tri(ids[0], ids[2], ids[1]); DT.tri(ids[0], ids[3], ids[2]); }
    };
    const edge = (r, i) => { const m = r.length / 2, j = (i + 1) % m, ax = r[2 * i], az = r[2 * i + 1], bx = r[2 * j], bz = r[2 * j + 1], L = Math.hypot(bx - ax, bz - az) || 1; return { ax, az, bx, bz, L, nx: (bz - az) / L, nz: -(bx - ax) / L }; };
    // moulding: ring edge -> mitered outward ring, between y0..y1
    const moulding = (off, y0, y1, c, skipDoor, bottom = false) => {
      const orr = offsetRing(ring, -off);
      for (let i = 0; i < n; i++) { if (skipDoor && i === doorEdge) continue; const e = edge(ring, i); if (e.L < 1.2) continue; const j = (i + 1) % n, oa = [orr[2 * i], orr[2 * i + 1]], ob = [orr[2 * j], orr[2 * j + 1]];
        if (Math.hypot(oa[0] - e.ax, oa[1] - e.az) > off * 3.5 || Math.hypot(ob[0] - e.bx, ob[1] - e.bz) > off * 3.5) continue;
        quad([oa[0], y0, oa[1]], [ob[0], y0, ob[1]], [ob[0], y1, ob[1]], [oa[0], y1, oa[1]], [e.nx, 0, e.nz], c);
        quad([e.ax, y1, e.az], [e.bx, y1, e.bz], [ob[0], y1, ob[1]], [oa[0], y1, oa[1]], [0, 1, 0], c.map(v => v * 1.08));
        if (bottom) quad([e.ax, y0, e.az], [e.bx, y0, e.bz], [ob[0], y0, ob[1]], [oa[0], y0, oa[1]], [0, -1, 0], c.map(v => v * 0.55)); }
    };
    const tone = 0.9 + 0.1 * hash(seed + 7), stone = [0.86 * tone, 0.83 * tone, 0.77 * tone];
    moulding(0.08, g - 0.3, g + 0.85, stone.map(v => v * 0.82), true);                                  // plinth
    if (H > 8) moulding(0.42, eave - 0.55, eave + 0.04, stone, false, true);                                  // cornice
    const nl = Math.round(H / fh);
    if (nl >= 3 && nl <= 14) { const base = o.useGF ? g + GF_H : ref; let cnt = 0; for (let y = o.useGF ? base : base + fh; y < eave - 1.0 && cnt < 12; y += fh, cnt++) moulding(0.06, y - 0.1, y + 0.1, stone.map(v => v * 0.95), true); }
    // balconies on long street-ish walls of residential-looking buildings
    if (nl >= 4 && /^(apartments|residential|dormitory|yes|hotel|)$/.test(o.kind) && o.style !== 4) {
      const base = o.useGF ? g + GF_H : ref, k0 = o.useGF ? 0 : 1; let total = 0;
      for (let i = 0; i < n && total < 14; i++) { if (i === doorEdge) continue; const e = edge(ring, i); if (e.L < 9 || hash(seed + i * 3.7) > 0.3) continue;
        const par = hash(seed + i) < 0.5 ? 0 : 1, ex = (e.bx - e.ax) / e.L, ez = (e.bz - e.az) / e.L;
        for (let j = par; 1.5 + 3 * j < e.L - 1.6; j += 2) { const s0 = 1.5 + 3 * j; if (s0 < 1.6) continue;
          for (let kf = k0; base + kf * fh < eave - 2.2; kf += (hash(seed + j * 1.3 + i) < 0.5 ? 2 : 3)) {
            const yl = base + kf * fh, cx = e.ax + ex * s0, cz = e.az + ez * s0, bcol = [0.8 * tone, 0.78 * tone, 0.72 * tone], rcol = [0.2, 0.22, 0.24];
            const P = (a, b, y) => [cx + ex * a + e.nx * b, y, cz + ez * a + e.nz * b];
            const box = (a0, a1, b0, b1, y0, y1, c) => {
              quad(P(a0, b1, y0), P(a1, b1, y0), P(a1, b1, y1), P(a0, b1, y1), [e.nx, 0, e.nz], c.map(v => v * 0.95));
              quad(P(a0, b0, y1), P(a1, b0, y1), P(a1, b1, y1), P(a0, b1, y1), [0, 1, 0], c.map(v => v * 1.08));
              quad(P(a0, b0, y0), P(a1, b0, y0), P(a1, b1, y0), P(a0, b1, y0), [0, -1, 0], c.map(v => v * 0.5));
              quad(P(a0, b0, y0), P(a0, b1, y0), P(a0, b1, y1), P(a0, b0, y1), [-ex, 0, -ez], c.map(v => v * 0.8));
              quad(P(a1, b0, y0), P(a1, b1, y0), P(a1, b1, y1), P(a1, b0, y1), [ex, 0, ez], c.map(v => v * 0.8));
            };
            quad(P(-1.1, 1.15, yl - 0.12), P(1.1, 1.15, yl - 0.12), P(1.1, 1.15, yl + 0.06), P(-1.1, 1.15, yl + 0.06), [e.nx, 0, e.nz], bcol);            // slab front / top / underside
            quad(P(-1.1, -0.02, yl + 0.06), P(1.1, -0.02, yl + 0.06), P(1.1, 1.15, yl + 0.06), P(-1.1, 1.15, yl + 0.06), [0, 1, 0], bcol.map(v => v * 1.08));
            quad(P(-1.1, -0.02, yl - 0.12), P(1.1, -0.02, yl - 0.12), P(1.1, 1.15, yl - 0.12), P(-1.1, 1.15, yl - 0.12), [0, -1, 0], bcol.map(v => v * 0.5));
            quad(P(-1.1, 1.12, yl + 0.06), P(1.1, 1.12, yl + 0.06), P(1.1, 1.12, yl + 1.05), P(-1.1, 1.12, yl + 1.05), [e.nx, 0, e.nz], rcol);          // railing (front + two sides)
            quad(P(-1.1, 0, yl + 0.06), P(-1.1, 1.12, yl + 0.06), P(-1.1, 1.12, yl + 1.05), P(-1.1, 0, yl + 1.05), [-ex, 0, -ez], rcol); quad(P(1.1, 0, yl + 0.06), P(1.1, 1.12, yl + 0.06), P(1.1, 1.12, yl + 1.05), P(1.1, 0, yl + 1.05), [ex, 0, ez], rcol);
            total++;
          } } }
    }
    // flat roof: parapet + roof boxes (stair hatches, vents) with collision
    if (flatRoof) {
      const area = Math.abs(signedArea(ring)); if (area < 40) return;
      const ir = offsetRing(ring, 0.22), ia = signedArea(ir); if (!(ia > area * 0.5)) return;
      const ph = 0.75, pc = [0.78 * tone, 0.76 * tone, 0.72 * tone];
      for (let i = 0; i < n; i++) { const e = edge(ring, i); if (e.L < 0.3) continue; const j = (i + 1) % n, ia_ = [ir[2 * i], ir[2 * i + 1]], ib = [ir[2 * j], ir[2 * j + 1]];
        quad([e.ax, eave, e.az], [e.bx, eave, e.bz], [e.bx, eave + ph, e.bz], [e.ax, eave + ph, e.az], [e.nx, 0, e.nz], pc);
        quad([ia_[0], eave, ia_[1]], [ib[0], eave, ib[1]], [ib[0], eave + ph, ib[1]], [ia_[0], eave + ph, ia_[1]], [-e.nx, 0, -e.nz], pc.map(v => v * 0.8));
        quad([e.ax, eave + ph, e.az], [e.bx, eave + ph, e.bz], [ib[0], eave + ph, ib[1]], [ia_[0], eave + ph, ia_[1]], [0, 1, 0], pc.map(v => v * 1.05));
        this._addCollider(key, 'walls', { x1: e.ax, z1: e.az, x2: e.bx, z2: e.bz, y0: eave - 0.1, y1: eave + ph, nx: e.nx, nz: e.nz, tile: key }, e.ax, e.az, e.bx, e.bz); }
      const ir2 = offsetRing(ring, 1.5); if (!(signedArea(ir2) > area * 0.25)) return;
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (let i = 0; i < n; i++) { x0 = Math.min(x0, ring[2 * i]); x1 = Math.max(x1, ring[2 * i]); z0 = Math.min(z0, ring[2 * i + 1]); z1 = Math.max(z1, ring[2 * i + 1]); }
      const nb = Math.min(3, 1 + Math.floor(area / 250)); const holes = o.holes || [];
      for (let k = 0; k < nb; k++) {
        const w = 1.4 + 1.8 * hash(seed + k * 5.1), d2 = 1.4 + 1.8 * hash(seed + k * 7.7), hh = 0.9 + 1.4 * hash(seed + k * 3.3), cx = x0 + (x1 - x0) * hash(seed + k * 11.3 + 1), cz = z0 + (z1 - z0) * hash(seed + k * 13.9 + 2);
        const cs = [[-w / 2, -d2 / 2], [w / 2, -d2 / 2], [w / 2, d2 / 2], [-w / 2, d2 / 2]].map(([a, b]) => [cx + a, cz + b]);
        if (!cs.every(c => pip(ir2, c[0], c[1]) && !holes.some(h => pip(h, c[0], c[1])))) continue;
        const bc = [0.56 + 0.12 * hash(seed + k), 0.56 + 0.1 * hash(seed + k + 1), 0.55];
        for (let e = 0; e < 4; e++) { const a = cs[e], b = cs[(e + 1) % 4], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / l, nz = -(b[0] - a[0]) / l;
          quad([a[0], eave, a[1]], [b[0], eave, b[1]], [b[0], eave + hh, b[1]], [a[0], eave + hh, a[1]], [nx, 0, nz], bc.map(v => v * (0.75 + 0.25 * Math.abs(nx))));
          this._addCollider(key, 'walls', { x1: a[0], z1: a[1], x2: b[0], z2: b[1], y0: eave - 0.1, y1: eave + hh, nx, nz, tile: key }, a[0], a[1], b[0], b[1]); }
        quad([cs[0][0], eave + hh, cs[0][1]], [cs[1][0], eave + hh, cs[1][1]], [cs[2][0], eave + hh, cs[2][1]], [cs[3][0], eave + hh, cs[3][1]], [0, 1, 0], bc.map(v => v * 1.1));
      }
    }
  }
  _doorMat(tex) { return this._dm || (this._dm = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); }
  _convex(r) { const n = r.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n, k = (i + 2) % n; const cr = (r[2 * j] - r[2 * i]) * (r[2 * k + 1] - r[2 * j + 1]) - (r[2 * j + 1] - r[2 * i + 1]) * (r[2 * k] - r[2 * j]); if (cr < -0.5) return false; } return true; }
  _pyramid(B, ring, eave, rh, col) {
    const n = ring.length / 2; let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += ring[2 * i]; cz += ring[2 * i + 1]; } cx /= n; cz /= n;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; ftri(B, [ring[2 * i], eave, ring[2 * i + 1]], [ring[2 * j], eave, ring[2 * j + 1]], [cx, eave + rh, cz], UP, [ring[2 * i] / 3, ring[2 * i + 1] / 3], [ring[2 * j] / 3, ring[2 * j + 1] / 3], [cx / 3, cz / 3], col); }
  }
  _dome(B, ring, eave, rh, col) {
    const n = ring.length / 2; let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += ring[2 * i]; cz += ring[2 * i + 1]; } cx /= n; cz /= n;
    let rad = 0; for (let i = 0; i < n; i++) rad += Math.hypot(ring[2 * i] - cx, ring[2 * i + 1] - cz); rad = Math.min(rad / n, 14);
    const S = 14, K = 5, gold = [0.78, 0.55, 0.14];
    for (let k = 0; k < K; k++) for (let s = 0; s < S; s++) {
      const a0 = k / K * Math.PI / 2, a1 = (k + 1) / K * Math.PI / 2, s0 = s / S * 6.2832, s1 = (s + 1) / S * 6.2832;
      const P = (a, sa) => [cx + Math.cos(a) * Math.cos(sa) * rad, eave + Math.sin(a) * rh * (1 + 0.0), cz + Math.cos(a) * Math.sin(sa) * rad];
      const p00 = P(a0, s0), p01 = P(a0, s1), p10 = P(a1, s0), p11 = P(a1, s1);
      const ref = [p00[0] - cx, 0.6, p00[2] - cz];
      ftri(B, p00, p01, p11, ref, [0, 0], [1, 0], [1, 1], gold); if (k < K - 1) ftri(B, p00, p11, p10, ref, [0, 0], [1, 1], [0, 1], gold);
    }
  }
  _rectRoof(B, WB, ring0, eave, rh, rs, rcol, wcol, fh, ref, levels) {
    let r = ring0.slice();
    const e01 = Math.hypot(r[2] - r[0], r[3] - r[1]), e12 = Math.hypot(r[4] - r[2], r[5] - r[3]);
    if (e12 > e01) r = [r[2], r[3], r[4], r[5], r[6], r[7], r[0], r[1]];
    const P = i => [r[2 * i], eave, r[2 * i + 1]];
    const p0 = P(0), p1 = P(1), p2 = P(2), p3 = P(3);
    const mid = (a, b, y) => [(a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2];
    const top = eave + rh, uv = p => [p[0] / 3, p[2] / 3];
    const wTop = hypot2(p1, p2); // short side length
    let Ra, Rb;
    const Ma = mid(p1, p2, top), Mb = mid(p3, p0, top);
    if (rs === 1) { Ra = Ma; Rb = Mb; }
    else { const dx = Mb[0] - Ma[0], dz = Mb[2] - Ma[2], L = Math.hypot(dx, dz) || 1, ins = Math.min(wTop / 2, L * 0.45);
      Ra = [Ma[0] + dx / L * ins, top, Ma[2] + dz / L * ins]; Rb = [Mb[0] - dx / L * ins, top, Mb[2] - dz / L * ins]; }
    const q = (a, b, c, d, refn) => { ftri(B, a, b, c, refn, uv(a), uv(b), uv(c), rcol); ftri(B, a, c, d, refn, uv(a), uv(c), uv(d), rcol); };
    q(p0, p1, Ra, Rb, UP); q(p2, p3, Rb, Ra, UP);
    if (rs === 2) { ftri(B, p1, p2, Ra, UP, uv(p1), uv(p2), uv(Ra), rcol); ftri(B, p3, p0, Rb, UP, uv(p3), uv(p0), uv(Rb), rcol); }
    else {   // gable triangles on the wall material
      for (const [a, b, m] of [[p1, p2, Ma], [p3, p0, Mb]]) {
        const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, outv = [dz / L, 0, -dx / L];
        const vv = y => (y - ref) / fh;
        ftri(WB, a, b, m, outv, [0, vv(eave)], [L / 6, vv(eave)], [L / 12, vv(top)], wcol);
      }
    }
  }

  // ------------------------------------------------------------- roads
  _roadMat(kind, deck) {
    const k = kind + (deck ? 'D' : '');
    if (this.roadMats[k]) return this.roadMats[k];
    const m = new THREE.MeshStandardMaterial({ map: roadTexture(kind), roughness: kind === 'rail' ? 1 : 0.92, color: 0xffffff, polygonOffset: !deck, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: !!deck });
    if (this.pbr) { const p = pbrMaps(m.map, { strength: kind === 'side' || kind === 'path' ? 3.2 : 1.6, rLo: kind[0] === 'a' || kind === 'plain' ? 0.55 : 0.7, rHi: 1.0, glossDark: false, maxSize: 512 }); m.normalMap = p.normalMap; m.roughnessMap = p.roughnessMap; m.normalScale.set(this.normalScale, this.normalScale); }
    return this.roadMats[k] = m;
  }
  _buildRoads(t, list, key, add) {
    const mbs = {};   // matkey -> {mb, order}
    const get = (kind, order, deck) => { const k = kind + (deck ? 'D' : ''); return mbs[k] || (mbs[k] = { mb: new MB(), kind, order, deck }); };
    const concrete = new MB();
    const piers = new MB();
    for (const r of list) {
      const cls = r.c, pts = r.p, np = pts.length / 2;
      let kind, order, hw = r.w / 2;
      if (cls === 'rail') { kind = 'rail'; order = 6; } else if (cls === 'tram') { kind = 'tram'; order = 6; }
      else if (cls === 0) { kind = 'path'; order = 2; } else if (r.n) { kind = 'a' + r.n; order = 4; } else { kind = 'plain'; order = 3; }
      // densify
      const step = r.b ? 6 : 4, P = []; // [x,z,y]
      for (let i = 0; i < np - 1; i++) {
        const x0 = pts[2 * i], z0 = pts[2 * i + 1], x1 = pts[2 * i + 2], z1 = pts[2 * i + 3], L = Math.hypot(x1 - x0, z1 - z0), ns = Math.max(1, Math.ceil(L / step));
        for (let s = 0; s < ns; s++) { const f = s / ns, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f; P.push([x, z, r.b ? r.y[i] + (r.y[i + 1] - r.y[i]) * f : this.heightAt(x, z) + 0.17]); }
      }
      { const x = pts[2 * np - 2], z = pts[2 * np - 1]; P.push([x, z, r.b ? r.y[np - 1] : this.heightAt(x, z) + 0.17]); }
      if (P.length < 2) continue;
      // sidewalks along streets
      if (!r.b && typeof cls === 'number' && cls >= 2 && cls <= 6) this._ribbon(get('side', 1, false).mb, P, hw + 1.6, 0, 4, -0.03);
      const deck = !!r.b;
      const M = get(kind, order, deck).mb;
      const e = this._ribbon(M, P, hw, 0, kind === 'rail' ? 4.8 : 9, 0);
      if (deck) {
        // girder sides, underside, parapets
        const gh = 1.3, c = [0.82, 0.82, 0.8];
        for (let i = 0; i < P.length - 1; i++) {
          const Lc = e.L[i], Ln = e.L[i + 1], Rc = e.R[i], Rn = e.R[i + 1];
          const len = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]), u1 = len / 4;
          const side = (A, Bn, outv) => {
            const a = concrete.v(A[0], A[1], A[2], outv[0], 0, outv[2], 0, 1, ...c), a2 = concrete.v(A[0], A[1] - gh, A[2], outv[0], 0, outv[2], 0, 0, ...c);
            const b = concrete.v(Bn[0], Bn[1], Bn[2], outv[0], 0, outv[2], u1, 1, ...c), b2 = concrete.v(Bn[0], Bn[1] - gh, Bn[2], outv[0], 0, outv[2], u1, 0, ...c);
            // orientation fix via normal test
            const ex = Bn[0] - A[0], ez = Bn[2] - A[2]; const nx = -ez, nz = ex; // candidate normal of tri (a,b,a2)? use dot
            if ((ez * 0 + 1) && (( (Bn[0]-A[0])*0 )) === 0) {
              // tri (a, a2, b) has normal = (a2-a)x(b-a) = (0,-gh,0)x(ex,*,ez) = (-gh*ez, 0, gh*ex)
              const dot = (-ez) * outv[0] + ex * outv[2];
              if (dot > 0) { concrete.tri(a, a2, b); concrete.tri(b, a2, b2); } else { concrete.tri(a, b, a2); concrete.tri(b, b2, a2); }
            }
          };
          const nx = P[i + 1][1] - P[i][1], nz = -(P[i + 1][0] - P[i][0]); const nl = Math.hypot(nx, nz) || 1; // right normal (dz,-dx) → here (dz,-dx) with d=(dx,dz)
          const dxx = P[i + 1][0] - P[i][0], dzz = P[i + 1][1] - P[i][1];
          const rightN = [dzz / (nl), 0, -dxx / nl], leftN = [-dzz / nl, 0, dxx / nl];
          // which of L/R is geometric left: ribbon L = P + leftN*hw (see _ribbon)
          side(Lc, Ln, leftN); side(Rc, Rn, rightN);
          // underside (faces down)
          const ua = concrete.v(Lc[0], Lc[1] - gh, Lc[2], 0, -1, 0, 0, 0, ...c), ub = concrete.v(Rc[0], Rc[1] - gh, Rc[2], 0, -1, 0, 1, 0, ...c), uc = concrete.v(Ln[0], Ln[1] - gh, Ln[2], 0, -1, 0, 0, u1, ...c), ud = concrete.v(Rn[0], Rn[1] - gh, Rn[2], 0, -1, 0, 1, u1, ...c);
          concrete.tri(ua, ub, uc); concrete.tri(ub, ud, uc);
          if (cls !== 'rail' && cls !== 'tram') {
            // parapet (outer + inner face + top) inset 0.2
            for (const sgn of [1, -1]) {
              const nrm = sgn > 0 ? leftN : rightN, S0 = sgn > 0 ? Lc : Rc, S1 = sgn > 0 ? Ln : Rn;
              const o0 = [S0[0] - nrm[0] * 0.2, S0[1], S0[2] - nrm[2] * 0.2], o1 = [S1[0] - nrm[0] * 0.2, S1[1], S1[2] - nrm[2] * 0.2];
              const i0 = [o0[0] - nrm[0] * 0.25, o0[1], o0[2] - nrm[2] * 0.25], i1 = [o1[0] - nrm[0] * 0.25, o1[1], o1[2] - nrm[2] * 0.25];
              const ph = 1.0;
              for (const [A, Bn, outv] of [[o0, o1, nrm], [i0, i1, [-nrm[0], 0, -nrm[2]]]]) {
                const a = A, b = Bn; const ex = b[0] - a[0], ez = b[2] - a[2];
                const v0 = concrete.v(a[0], a[1], a[2], outv[0], 0, outv[2], 0, 0, ...c), v1 = concrete.v(a[0], a[1] + ph, a[2], outv[0], 0, outv[2], 0, 0.3, ...c);
                const v2 = concrete.v(b[0], b[1], b[2], outv[0], 0, outv[2], u1, 0, ...c), v3 = concrete.v(b[0], b[1] + ph, b[2], outv[0], 0, outv[2], u1, 0.3, ...c);
                const dot = (-ez) * outv[0] + ex * outv[2];   // normal of (v0,v1,v2) = (0,ph,0)x(ex,*,ez)=(ph*ez,0,-ph*ex) → negative of this
                if (-dot > 0) { concrete.tri(v0, v1, v2); concrete.tri(v2, v1, v3); } else { concrete.tri(v0, v2, v1); concrete.tri(v2, v3, v1); }
              }
              const t0 = concrete.v(o0[0], o0[1] + ph, o0[2], 0, 1, 0, 0, 0, ...c), t1 = concrete.v(i0[0], i0[1] + ph, i0[2], 0, 1, 0, 0.1, 0, ...c), t2 = concrete.v(o1[0], o1[1] + ph, o1[2], 0, 1, 0, 0, u1, ...c), t3 = concrete.v(i1[0], i1[1] + ph, i1[2], 0, 1, 0, 0.1, u1, ...c);
              const tn = (t3 && 0); // top cap: choose winding to face up
              const ax = o1[0] - o0[0], az = o1[2] - o0[2], bx = i0[0] - o0[0], bz = i0[2] - o0[2]; // (o1-o0)x(i0-o0) y comp = az*bx - ax*bz
              if (az * bx - ax * bz > 0) { concrete.tri(t0, t2, t1); concrete.tri(t1, t2, t3); } else { concrete.tri(t0, t1, t2); concrete.tri(t1, t3, t2); }
              // collider walls (outer parapet edge)
              const ln = Math.hypot(ex_(o0, o1), ez_(o0, o1)) || 1;
              this._addCollider(key, 'walls', { x1: o0[0], z1: o0[2], x2: o1[0], z2: o1[2], y0: Math.min(o0[1], o1[1]) - gh, y1: Math.max(o0[1], o1[1]) + ph, nx: -nrm[0], nz: -nrm[2], tile: key }, o0[0], o0[2], o1[0], o1[2]);
            }
          }
          this._addCollider(key, 'decks', { x1: P[i][0], z1: P[i][1], x2: P[i + 1][0], z2: P[i + 1][1], y1: P[i][2], y2: P[i + 1][2], hw, tile: key }, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]);
        }
        // piers
        let acc = 0;
        for (let i = 0; i < P.length - 1; i++) {
          acc += Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
          if (acc > 38) {
            acc = 0; const gy = this.heightAt(P[i][0], P[i][1]), top = P[i][2] - gh;
            if (top - gy > 3.5) this._pier(piers, P[i], P[i + 1], hw, gy - 0.5, top);
          }
        }
      }
    }
    for (const k in mbs) { const o = mbs[k]; if (o.mb.empty) continue; const m = add(o.mb.build(), this._roadMat(o.kind, o.deck), { cast: false, order: o.deck ? 0 : o.order }); if (o.deck) { m.castShadow = this.shadows; } }
    if (!concrete.empty) add(concrete.build(), this.concreteMat, { cast: this.shadows });
    if (!piers.empty) add(piers.build(), this.concreteMat, { cast: this.shadows });
  }
  _pier(B, a, b, hw, y0, y1) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, px = -uz, pz = ux;
    const w = Math.max(1.2, hw * 0.8), dd = 1.2, c = [0.75, 0.75, 0.73];
    const C = [[a[0] + px * w + ux * dd, a[1] + pz * w + uz * dd], [a[0] + px * w - ux * dd, a[1] + pz * w - uz * dd], [a[0] - px * w - ux * dd, a[1] - pz * w - uz * dd], [a[0] - px * w + ux * dd, a[1] - pz * w + uz * dd]];
    for (let i = 0; i < 4; i++) {
      const A = C[i], Bn = C[(i + 1) % 4], ex = Bn[0] - A[0], ez = Bn[1] - A[1], l = Math.hypot(ex, ez), nx = ez / l, nz = -ex / l;
      // C is traversed so that outward normal = (ez,-ex)/l or its negative; orient by center test
      const cx = (C[0][0] + C[2][0]) / 2, cz = (C[0][1] + C[2][1]) / 2; let sn = ((A[0] - cx) * nx + (A[1] - cz) * nz) > 0 ? 1 : -1;
      const ox = nx * sn, oz = nz * sn;
      const v0 = B.v(A[0], y0, A[1], ox, 0, oz, 0, 0, ...c), v1 = B.v(A[0], y1, A[1], ox, 0, oz, 0, (y1 - y0) / 4, ...c), v2 = B.v(Bn[0], y0, Bn[1], ox, 0, oz, l / 4, 0, ...c), v3 = B.v(Bn[0], y1, Bn[1], ox, 0, oz, l / 4, (y1 - y0) / 4, ...c);
      const dot = (-ez) * ox + ex * oz;   // (v0,v1,v2) normal = (0,h,0)x(ex,0,ez) = (h*ez,0,-h*ex)
      if (-dot > 0) { B.tri(v0, v1, v2); B.tri(v2, v1, v3); } else { B.tri(v0, v2, v1); B.tri(v2, v3, v1); }
    }
  }
  // ribbon of half-width hw along P=[[x,z,y]...]; returns left/right edge point arrays
  _ribbon(B, P, hw, lift, vRep, ylift) {
    const n = P.length, L = [], R = [], dirs = [];
    for (let i = 0; i < n - 1; i++) { const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz) || 1; dirs.push([dx / l, dz / l]); }
    let cum = 0, base = B.vc;
    for (let i = 0; i < n; i++) {
      const d0 = dirs[Math.max(0, i - 1)], d1 = dirs[Math.min(n - 2, i)];
      let tx = d0[0] + d1[0], tz = d0[1] + d1[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      let nx = -tz, nz = tx;           // left normal in (x,z): for d=(1,0) → (0,1)?? see note below
      const cosv = Math.max(0.55, nx * (-d1[1]) + nz * d1[0]); const w = hw / cosv;
      if (i > 0) cum += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      const y = P[i][2] + (ylift || 0);
      const lp = [P[i][0] + nx * w, y, P[i][1] + nz * w], rp = [P[i][0] - nx * w, y, P[i][1] - nz * w];
      L.push(lp); R.push(rp);
      B.v(lp[0], lp[1], lp[2], 0, 1, 0, 0, cum / vRep, 1, 1, 1); B.v(rp[0], rp[1], rp[2], 0, 1, 0, 1, cum / vRep, 1, 1, 1);
    }
    // winding: L = P + (-tz, tx)*w. For d=(1,0): L is at +z (south) which is the RIGHT-hand side seen from above (north=-z).
    // tri (L_i, R_i, L_{i+1}) normal=(R-L)x(L1-L): R-L=(0,0,-2w), L1-L=(l,0,0) → (0*0-(-2w)*0, (-2w)*l-0, 0)=(0,-2wl,0) down. So flip.
    for (let i = 0; i < n - 1; i++) { const a = base + 2 * i, b = a + 1, c = a + 2, d = a + 3; B.tri(a, c, b); B.tri(b, c, d); }
    return { L, R };
  }

  // ------------------------------------------------------------- water & trees
  _buildWater(t, polys, lines, add) {
    const B = new MB();
    for (const w of polys) {
      const ring = orientRing(w.p, true), holes = (w.i || []).map(h => orientRing(h, false));
      t.waters.push({ ring, holes: holes.length ? holes : null, level: w.l });
      const tr = triangulate(ring, holes);
      for (const f of tr.faces) { const p = f.map(k => tr.pts[k]); ftri(B, [p[0].x, w.l, p[0].y], [p[1].x, w.l, p[1].y], [p[2].x, w.l, p[2].y], UP, [p[0].x / 24, p[0].y / 24], [p[1].x / 24, p[1].y / 24], [p[2].x / 24, p[2].y / 24], [1, 1, 1]); }
    }
    for (const l of lines) {   // streams
      const np = l.p.length / 2, P = []; for (let i = 0; i < np; i++) P.push([l.p[2 * i], l.p[2 * i + 1], this.heightAt(l.p[2 * i], l.p[2 * i + 1]) + 0.05]);
      if (P.length > 1) this._ribbon(B, P, l.w / 2, 0, 24, 0);
    }
    if (!B.empty) { const m = add(B.build(), this.waterMat, { cast: false, receive: false }); m.renderOrder = 8; }
  }
  _treeGeos() {
    const col = (g, c, jit = 0.12) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); const cc = new THREE.Color(c);
      for (let i = 0; i < n; i++) { const j = 1 + (hash(i * 3.7 + c) - 0.5) * jit * 2; a[3 * i] = cc.r * j; a[3 * i + 1] = cc.g * j; a[3 * i + 2] = cc.b * j; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const strip = g => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; };
    const trunk = col(strip(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 6, 1, true)), 0x5a4332); trunk.translate(0, 1.6, 0);
    const crown = strip(new THREE.IcosahedronGeometry(2.7, 1)); { const p = crown.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (hash(p.getX(i) * 12.3 + p.getY(i) * 7.1 + p.getZ(i) * 3.3) - 0.5) * 0.35; p.setXYZ(i, p.getX(i) * k * 1.05, p.getY(i) * k * 1.2, p.getZ(i) * k * 1.05); } crown.computeVertexNormals(); }
    col(crown, 0x4c7a2f, 0.25); crown.translate(0, 5.3, 0);
    const decid = mergeGeometries([trunk, crown]);
    const trunk2 = col(strip(new THREE.CylinderGeometry(0.14, 0.22, 2.0, 6, 1, true)), 0x4d3a2c); trunk2.translate(0, 1.0, 0);
    const cone = col(strip(new THREE.ConeGeometry(2.0, 8.5, 8, 1, true)), 0x2f5a37, 0.18); cone.translate(0, 2 + 4.25, 0);
    const conif = mergeGeometries([trunk2, cone]);
    return [decid, conif];
  }
  _buildTrees(t, arr, group) {
    const per = [[], []]; for (let i = 0; i < arr.length; i += 4) { if (this.treeKeep < 1 && hash(arr[i] * 0.731 + arr[i + 1] * 1.913) > this.treeKeep) continue; per[arr[i + 3] ? 1 : 0].push(i); }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), yaxis = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    for (let ty = 0; ty < 2; ty++) {
      const ids = per[ty]; if (!ids.length) continue;
      const im = new THREE.InstancedMesh(this.treeGeo[ty], this.treeMat, ids.length);
      ids.forEach((i, k) => {
        const x = arr[i], z = arr[i + 1], sc = arr[i + 2];
        q.setFromAxisAngle(yaxis, hash(x * 3.1 + z) * 6.28); s.set(sc, sc * (0.9 + 0.3 * hash(z + x * 0.3)), sc); p.set(x, this.heightAt(x, z) - 0.1, z); m.compose(p, q, s); im.setMatrixAt(k, m);
        const j = hash(x * 1.7 + z * 9.1); c.setRGB(0.85 + 0.3 * j, 0.85 + 0.25 * hash(j * 17), 0.8 + 0.3 * hash(j * 31)); im.setColorAt(k, c);
      });
      im.castShadow = this.shadows; im.receiveShadow = false; im.frustumCulled = true; im.computeBoundingSphere(); group.add(im);
    }
  }
}
function hypot2(a, b) { return Math.hypot(a[0] - b[0], a[2] - b[2]); }
function ex_(a, b) { return b[0] - a[0]; }
function ez_(a, b) { return b[2] - a[2]; }
