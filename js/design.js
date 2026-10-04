// Design pack: 6 distinct low-poly car models (instanced, one shared paint atlas), facade kits for the branded places
// (McDonald's / Puzata Hata / Silpo / Epicentr + office / warehouse job points) and the sheets used by signs and interiors.
// Assets are compressed sheets from tools/build_design_assets.py (assets/design/*.jpg). Pack images are AI references, not official brand material.
import * as THREE from 'three';
import { NIGHT, coneGeometry, additive, coneVS, coneFS } from './fx.js';

const BASE = 'assets/design/';
const imgCache = {};
export function designImage(name) {   // Promise<HTMLImageElement>, cached; resolves null on failure (everything falls back to flat colours)
  return imgCache[name] || (imgCache[name] = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = BASE + name; }));
}
const texCache = {};
export function designTex(name) {
  if (texCache[name]) return texCache[name];
  const t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  designImage(name).then(im => { if (im) { t.image = im; t.needsUpdate = true; } });
  return texCache[name] = t;
}

// ---------------------------------------------------------------- tiny merged-box builder (position, normal, uv, color, aBody)
class MB {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.b = []; this.i = []; this.k = 0; }
  // geo: BufferGeometry (indexed, with normal/uv); opts: col [r,g,b], body (paint-tinted: keeps its own uv), uv0 [u,v] (absolute atlas point), cell [k, cols] (remap uv into a cell of a 1-row sheet)
  add(geo, col, o = {}) {
    const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, n = P.count;
    for (let j = 0; j < n; j++) {
      this.p.push(P.getX(j), P.getY(j), P.getZ(j)); this.n.push(N.getX(j), N.getY(j), N.getZ(j)); this.c.push(col[0], col[1], col[2]);
      let u = U.getX(j), v = U.getY(j);
      if (o.uv0) { u = o.uv0[0]; v = o.uv0[1]; } else if (o.cell) { const [k, cols] = o.cell; u = (k + 0.06 + u * 0.88) / cols; v = 0.06 + v * 0.88; }
      this.u.push(u, v); this.b.push(o.body ? 1 : (o.lamp || 0));
    }
    for (const x of geo.index.array) this.i.push(x + this.k); this.k += n;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('aBody', new THREE.Float32BufferAttribute(this.b, 1)); g.setIndex(this.i); g.computeBoundingSphere(); return g;
  }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function boxG(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) { _e.set(rx, ry, rz); g.applyMatrix4(_m.makeRotationFromQuaternion(_q.setFromEuler(_e))); }
  g.translate(x, y, z); return g;
}
// frustum: bottom w x d, top wt x dt (top shifted along z by `shift`), height h, bottom at yb, centred at (0, zc)
function hullG(wb, wt, db, dt, h, yb, zc, shift) {
  const g = new THREE.BoxGeometry(1, 1, 1), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const top = P.getY(i) > 0, sx = P.getX(i), sz = P.getZ(i);
    P.setXYZ(i, sx * (top ? wt : wb), yb + (top ? h : 0), zc + (top ? shift : 0) + sz * (top ? dt : db));
  }
  g.computeVertexNormals(); return g;
}

// ---------------------------------------------------------------- cars
// paint atlas (paints.jpg): 4x4 cells of 128 px; 0 vaz, 1 bmw, 2 bmw stripe, 3 mercedes/neutral, 4 skoda, 5 vw, 6 toyota, 7 toyota accent, 8 white
const WHITE_UV = [0.125, 1 - 2.5 / 4];
const GLASS = [0.1, 0.13, 0.17], CHROME = [0.8, 0.82, 0.84], BLACK = [0.05, 0.05, 0.06], TAIL = [0.72, 0.05, 0.05], HEAD = [0.97, 0.96, 0.85], WHT = [1, 1, 1];
export const CAR_MODELS = [
  { id: 'vaz', name: 'ВАЗ 2107', cell: 0, share: 22, factory: 0.7, paint: 0xc4b08e },
  { id: 'bmw', name: 'BMW 3', cell: 1, share: 12, factory: 0.9, paint: 0xeceef0, accent: 0x0066b2 },
  { id: 'mercedes', name: 'Mercedes E', cell: 3, share: 12, factory: 0.8, paint: 0xbabec2 },
  { id: 'skoda', name: 'Skoda Octavia', cell: 4, share: 20, factory: 0.7, paint: 0x125c3e },
  { id: 'vw', name: 'Volkswagen Golf', cell: 5, share: 21, factory: 0.7, paint: 0x163a7a },
  { id: 'toyota', name: 'Toyota Camry', cell: 6, share: 13, factory: 0.9, paint: 0xf4f4f2, accent: 0xba1820 },
];
const SHARE_SUM = CAR_MODELS.reduce((s, m) => s + m.share, 0);
export function pickCarModel(r = Math.random()) { let x = r * SHARE_SUM; for (let i = 0; i < CAR_MODELS.length; i++) { x -= CAR_MODELS[i].share; if (x < 0) return i; } return 0; }
const hex = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];

function buildCar(i) {
  const B = new MB(), M = CAR_MODELS[i];
  const body = (g) => B.add(g, WHT, { body: true });
  const dark = (g, c = BLACK) => B.add(g, c, { uv0: WHITE_UV, lamp: c === HEAD ? 2 : c === TAIL ? 3 : 0 });
  const bx = (w, h, d, x, y, z, c, rot) => dark(boxG(w, h, d, x, y, z, ...(rot || [])), c);
  const wheels = (W, L, zf, zr) => { for (const sx of [-1, 1]) for (const z of [zf, zr]) { bx(0.24, 0.62, 0.62, sx * (W / 2 - 0.1), 0.31, z, [0.05, 0.05, 0.05]); bx(0.27, 0.34, 0.34, sx * (W / 2 - 0.1), 0.31, z, [0.62, 0.64, 0.66]); } };
  // spec: W,L, body height/centre, cabin hull params, details
  const S = [
    { W: 1.62, L: 4.15, by: 0.58, bh: 0.55, cab: [1.46, 1.4, 2.1, 1.82, 0.56, 0.855, -0.12, -0.02], gl: [0.40, 0.88, 0.86] },
    { W: 1.82, L: 4.7, by: 0.56, bh: 0.5, cab: [1.6, 1.42, 2.5, 1.55, 0.52, 0.81, -0.2, -0.1], gl: [0.40, 0.92, 0.9] },
    { W: 1.85, L: 4.9, by: 0.58, bh: 0.55, cab: [1.64, 1.5, 2.4, 1.75, 0.53, 0.855, -0.3, -0.05], gl: [0.40, 0.92, 0.88] },
    { W: 1.8, L: 4.7, by: 0.58, bh: 0.56, cab: [1.6, 1.46, 2.9, 2.0, 0.55, 0.88, -0.25, -0.4], gl: [0.40, 0.92, 0.9] },
    { W: 1.8, L: 4.26, by: 0.58, bh: 0.56, cab: [1.62, 1.5, 2.6, 2.1, 0.58, 0.87, -0.35, -0.3], gl: [0.43, 0.92, 0.88] },
    { W: 1.84, L: 4.9, by: 0.58, bh: 0.56, cab: [1.64, 1.46, 2.5, 1.7, 0.5, 0.86, -0.3, -0.15], gl: [0.38, 0.92, 0.88] },
  ][i];
  const { W, L } = S, hl = L / 2;
  body(boxG(W, S.bh, L, 0, S.by, 0));
  const [wb, wt, db, dt, h, yb, zc, sh] = S.cab;
  body(hullG(wb, wt, db, dt, h, yb, zc, sh));
  { const g = S.gl, hg = h * g[0] / 0.56 * 0.9, f0 = 0.03 / h, f1 = Math.min(1, f0 + hg / h), lerp = (a, b, f) => a + (b - a) * f;
    dark(hullG(lerp(wb, wt, f0) + 0.025, lerp(wb, wt, f1) + 0.025, lerp(db, dt, f0) * g[1], lerp(db, dt, f1) * g[2], hg, yb + 0.03, zc + sh * f0, sh * (f1 - f0)), GLASS); }
  wheels(W, L, hl - 0.85, -hl + 0.8);
  const fz = hl + 0.01;
  if (i === 0) {          // VAZ 2107: chrome bumpers, round-ish lights, black trim, antenna
    bx(1.7, 0.14, 0.16, 0, 0.42, hl - 0.02, CHROME); bx(1.7, 0.14, 0.16, 0, 0.42, -hl + 0.02, CHROME);
    for (const s of [-1, 1]) { bx(0.3, 0.22, 0.06, s * 0.55, 0.7, fz, HEAD); bx(0.3, 0.2, 0.06, s * 0.55, 0.72, -fz, TAIL); bx(0.1, 0.06, 0.06, s * 0.78, 0.6, fz, [0.95, 0.6, 0.1]); }
    bx(0.62, 0.18, 0.06, 0, 0.7, fz, CHROME); bx(0.5, 0.12, 0.07, 0, 0.7, fz + 0.005, BLACK);
    bx(W + 0.02, 0.05, 3.1, 0, 0.64, 0, [0.08, 0.08, 0.09]); bx(0.025, 0.5, 0.025, 0.55, 1.62, -0.1, BLACK);
  } else if (i === 1) {   // BMW: blue stripe, kidney grille, slim lights
    bx(W + 0.02, 0.07, L * 0.92, 0, 0.5, 0, hex(M.accent));
    bx(0.22, 0.15, 0.06, -0.14, 0.6, fz, BLACK); bx(0.22, 0.15, 0.06, 0.14, 0.6, fz, BLACK);
    for (const s of [-1, 1]) { bx(0.4, 0.1, 0.06, s * 0.64, 0.68, fz, HEAD); bx(0.46, 0.12, 0.06, s * 0.6, 0.7, -fz, TAIL); }
    bx(W - 0.1, 0.12, 0.1, 0, 0.4, hl - 0.03, BLACK); bx(W - 0.1, 0.12, 0.1, 0, 0.4, -hl + 0.03, BLACK);
  } else if (i === 2) {   // Mercedes E: big chrome grille, ornament, chrome strips
    bx(0.72, 0.3, 0.07, 0, 0.7, fz, CHROME); bx(0.6, 0.2, 0.08, 0, 0.7, fz + 0.005, [0.2, 0.2, 0.22]); bx(0.05, 0.14, 0.05, 0, 0.92, hl - 0.4, CHROME);
    for (const s of [-1, 1]) { bx(0.42, 0.12, 0.06, s * 0.68, 0.72, fz, HEAD); bx(0.5, 0.14, 0.06, s * 0.62, 0.74, -fz, TAIL); }
    bx(W - 0.04, 0.06, 0.1, 0, 0.45, hl - 0.03, CHROME); bx(W - 0.04, 0.06, 0.1, 0, 0.45, -hl + 0.03, CHROME); bx(W + 0.01, 0.025, L * 0.8, 0, 0.55, 0, CHROME);
  } else if (i === 3) {   // Skoda Octavia: liftback, roof rails, tail lights on the hatch
    for (const s of [-1, 1]) { bx(0.36, 0.12, 0.06, s * 0.62, 0.72, fz, HEAD); bx(0.3, 0.22, 0.06, s * 0.7, 0.78, -fz, TAIL); bx(0.03, 0.04, 2.1, s * 0.7, 1.45, -0.25, CHROME); }
    bx(0.6, 0.22, 0.06, 0, 0.66, fz, [0.12, 0.13, 0.14]); bx(0.66, 0.04, 0.07, 0, 0.78, fz, CHROME);
    bx(W - 0.1, 0.12, 0.1, 0, 0.4, hl - 0.03, BLACK); bx(W - 0.1, 0.12, 0.1, 0, 0.4, -hl + 0.03, BLACK);
  } else if (i === 4) {   // VW Golf: short hatch, roof spoiler, thin grille bar
    for (const s of [-1, 1]) { bx(0.42, 0.1, 0.06, s * 0.6, 0.72, fz, HEAD); bx(0.35, 0.2, 0.06, s * 0.68, 0.78, -fz, TAIL); }
    bx(0.8, 0.1, 0.06, 0, 0.66, fz, BLACK); bx(0.8, 0.025, 0.07, 0, 0.7, fz, CHROME); bx(1.4, 0.06, 0.32, 0, 1.47, -1.62, BLACK);
    bx(W - 0.1, 0.12, 0.1, 0, 0.4, hl - 0.03, BLACK); bx(W - 0.1, 0.12, 0.1, 0, 0.4, -hl + 0.03, BLACK);
  } else {                // Toyota Camry: thin red line, wide dark grille
    bx(W + 0.02, 0.05, L * 0.9, 0, 0.66, 0, hex(M.accent));
    bx(0.95, 0.2, 0.06, 0, 0.64, fz, [0.1, 0.1, 0.11]); bx(0.95, 0.04, 0.07, 0, 0.75, fz, CHROME);
    for (const s of [-1, 1]) { bx(0.52, 0.1, 0.06, s * 0.7, 0.77, fz, HEAD); bx(0.6, 0.1, 0.06, s * 0.58, 0.78, -fz, TAIL); }
    bx(W - 0.1, 0.12, 0.1, 0, 0.4, hl - 0.03, BLACK); bx(W - 0.1, 0.12, 0.1, 0, 0.4, -hl + 0.03, BLACK);
  }
  // common detail: door shut-lines + handles, mirrors, number plates, exhaust, rocker panels
  { const sd = W / 2 + 0.006, DK = [0.03, 0.03, 0.035];
    for (const sx of [-1, 1]) {
      for (const zz of [hl * 0.34, -hl * 0.1, -hl * 0.4]) bx(0.012, 0.42, 0.014, sx * sd, 0.62, zz, DK);
      for (const zz of [hl * 0.22, -hl * 0.22]) bx(0.02, 0.025, 0.14, sx * (sd + 0.006), 0.74, zz, CHROME);
      bx(0.1, 0.07, 0.05, sx * (wb / 2 + 0.1), 0.93, zc + 0.5, DK); bx(0.03, 0.03, 0.05, sx * (wb / 2 + 0.03), 0.91, zc + 0.5, DK);
      bx(0.03, 0.09, L * 0.55, sx * (W / 2 - 0.02), 0.27, 0, DK); }
    bx(0.52, 0.11, 0.02, 0, 0.36, hl + 0.015, [0.93, 0.93, 0.9]); bx(0.54, 0.13, 0.015, 0, 0.36, hl + 0.008, DK);
    bx(0.52, 0.11, 0.02, 0, 0.62, -hl - 0.015, [0.93, 0.93, 0.9]); bx(0.54, 0.13, 0.015, 0, 0.62, -hl - 0.008, DK);
    bx(0.07, 0.07, 0.2, W * 0.32, 0.26, -hl - 0.05, [0.3, 0.3, 0.32]); }
  return B.build();
}

export class CarFleet {
  constructor(scene, cap = 128) {
    this.cap = cap; this.scene = scene;
    const mat = this.mat = new THREE.MeshStandardMaterial({ map: designTex('paints.jpg'), vertexColors: true, roughness: 0.42, metalness: 0.3 });
    mat.onBeforeCompile = s => {
      s.uniforms.uNight = NIGHT;
      s.vertexShader = 'attribute vec2 aCell; attribute float aBody; varying float vLamp;\n' + s.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n vLamp = aBody > 1.5 ? aBody - 1.0 : 0.0;\n#ifdef USE_MAP\n if (aBody > 0.5 && aBody < 1.5) vMapUv = (vMapUv * 0.9 + 0.05) * 0.25 + aCell;\n#endif`);
      s.fragmentShader = 'varying float vLamp; uniform float uNight;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n if (vLamp > 0.5) totalEmissiveRadiance += (vLamp < 1.5 ? vec3(1.0, 0.95, 0.8) * (0.25 + 2.6 * uNight) : vec3(1.0, 0.07, 0.04) * (0.12 + 1.3 * uNight));`);
    };
    mat.customProgramCacheKey = () => 'kyivCars';
    this.cones = new THREE.InstancedMesh(coneGeometry(), additive(coneVS, coneFS, 0xffffff), cap * 2); this.cones.count = 0; this.cones.frustumCulled = false; this.cones.visible = false; this.cones.renderOrder = 4; scene.add(this.cones); this._cm = new THREE.Matrix4(); this._lm = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.08, 2.2), new THREE.Quaternion(), new THREE.Vector3(1, 1, 11));
    this.meshes = CAR_MODELS.map((m, i) => {
      const g = buildCar(i); g.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2));
      const im = new THREE.InstancedMesh(g, mat, cap); im.count = 0; im.frustumCulled = false; im.castShadow = false;
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); scene.add(im); return im;
    });
  }
  begin() { for (const m of this.meshes) m.count = 0; this.total = 0; this.cones.count = 0; this.cones.visible = NIGHT.value > 0.05; }
  // cell: paint cell index (-1 = neutral silver, tinted by `col`)
  add(model, factory, col, M, lit = true) {
    const m = this.meshes[model]; if (!m || m.count >= this.cap) return false;
    const i = m.count++, cell = factory ? CAR_MODELS[model].cell : 3;
    m.setMatrixAt(i, M); const a = m.geometry.attributes.aCell; a.setXY(i, (cell % 4) / 4, 1 - ((cell >> 2) + 1) / 4);
    if (factory) m.instanceColor.setXYZ(i, col.r, col.g, col.b); else m.instanceColor.setXYZ(i, col.r * 1.3, col.g * 1.3, col.b * 1.3);
    this.total++; if (lit && this.cones.visible && this.cones.count < this.cap * 2 - 1) this.cones.setMatrixAt(this.cones.count++, this._cm.multiplyMatrices(M, this._lm));
    return true;
  }
  end() { this.cones.instanceMatrix.needsUpdate = true; for (const m of this.meshes) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.geometry.attributes.aCell.needsUpdate = true; } }
}

// ---------------------------------------------------------------- facade kits (door-local frame: x along the wall, y up from the door sill, z outward)
// brand sheet cells: 0 mcd red, 1 mcd yellow, 2 puzata green, 3 silpo green, 4 silpo orange, 5 epicentr yellow, 6 epicentr green, 7 white
const CELLS = 8;
function kitBuild(key) {
  const B = new MB();
  const part = (w, h, d, x, y, z, col, cell = -1, rot) => { const g = boxG(w, h, d, x, y + h / 2, z, ...(rot || [])); B.add(g, col, cell >= 0 ? { cell: [cell, CELLS] } : { cell: [7, CELLS] }); };
  const R = [1, 1, 1], DG = [0.2, 0.21, 0.23], WOOD = [0.42, 0.17, 0.1], GOLD = [0.77, 0.64, 0.42], CREAM = [0.96, 0.9, 0.78];
  if (key === 'mcd') {
    part(5.6, 1.4, 0.06, 0, 2.5, 0.03, R, 0); part(5.6, 0.07, 0.16, 0, 2.45, 0.08, R, 1); part(5.6, 0.1, 0.12, 0, 3.9, 0.06, [0.15, 0.15, 0.16]);
    for (const s of [-1, 1]) { part(0.28, 2.5, 0.2, s * 2.9, 0, 0.1, DG); part(1.5, 0.9, 0.07, s * 1.95, 0, 0.035, R, 0); part(1.2, 0.5, 0.4, s * 3.7, 0, 0.35, [0.3, 0.2, 0.12]); part(1.1, 0.35, 0.34, s * 3.7, 0.5, 0.35, [0.25, 0.5, 0.22]); }
    part(0.5, 0.85, 0.05, 1.55, 0, 1.25, [0.95, 0.95, 0.95], -1, [0, 0.4, 0]); part(0.5, 0.3, 0.06, 1.55, 0.55, 1.25, R, 0, [0, 0.4, 0]);
  } else if (key === 'puzata') {
    part(5.6, 1.5, 0.06, 0, 2.4, 0.03, R, 2); part(5.6, 0.34, 0.1, 0, 3.9, 0.05, CREAM);
    for (let i = 0; i < 14; i++) part(0.16, 0.16, 0.03, -2.6 + i * 0.4, 3.99, 0.11, [0.75, 0.1, 0.1]);
    part(3.9, 0.1, 1.5, 0, 2.58, 0.7, WOOD, -1, [0.22, 0, 0]); part(3.9, 0.14, 0.08, 0, 2.28, 1.44, CREAM);
    for (const s of [-1, 1]) { part(0.16, 2.6, 0.16, s * 1.85, 0, 1.3, GOLD); part(0.12, 0.5, 0.12, s * 1.7, 2.1, 1.12, GOLD, -1, [0, 0, s * 0.6]); part(0.2, 0.32, 0.2, s * 1.45, 2.2, 0.15, [1, 0.85, 0.4]);
      part(1.2, 0.26, 0.34, s * 3.35, 0.85, 0.25, WOOD); for (let k = 0; k < 4; k++) part(0.2, 0.22, 0.2, s * 3.35 - 0.45 + k * 0.3, 1.11, 0.25, [[0.9, 0.2, 0.3], [0.95, 0.75, 0.15], [0.3, 0.6, 0.25], [0.9, 0.4, 0.7]][k]); }
  } else if (key === 'silpo') {
    for (const s of [-1, 1]) { part(0.34, 4.3, 0.34, s * 2.95, 0, 0.18, [0.06, 0.22, 0.14]); part(0.6, 0.4, 0.5, s * 2.3, 0, 1.6, [0.82, 0.83, 0.85], -1, [0, s * 0.3, 0]); part(0.56, 0.32, 0.5, s * 2.3, 0.4, 1.6, [0.75, 0.76, 0.78], -1, [0, s * 0.3, 0]); part(0.52, 0.05, 0.05, s * 2.3, 0.55, 1.4, [0.8, 0.1, 0.1], -1, [0, s * 0.3, 0]); }
    part(5.8, 0.12, 1.6, 0, 2.55, 0.8, R, 3); part(5.8, 0.24, 0.05, 0, 2.38, 1.6, R, 4); part(6.0, 0.34, 0.1, 0, 3.7, 0.06, R, 4);
    part(5.6, 0.2, 0.06, 0, 4.05, 0.04, [0.06, 0.22, 0.14]);
    // cart corral, pylon sign and painted parking bays in front of the store
    for (let k = 0; k < 3; k++) part(0.6, 0.85, 0.9, -3.6 + k * 0.1, 0, 2.2 + k * 0.05, [0.72, 0.74, 0.76]); part(1.8, 0.05, 1.3, -3.6, 0.85, 2.2, [0.2, 0.22, 0.24]);
    part(0.55, 5.4, 0.45, 6.6, 0, 5.2, [0.06, 0.22, 0.14]); part(1.8, 1.3, 0.5, 6.6, 5.4, 5.2, R, 3);
    for (let k = -3; k <= 3; k++) part(0.12, 0.02, 4.8, k * 2.6, 0.02, 9.5, [0.95, 0.95, 0.95]);
  } else if (key === 'atb') {
    const BL = [0.13, 0.4, 0.78];
    part(5.8, 1.1, 0.07, 0, 2.55, 0.035, BL); part(5.8, 0.18, 0.1, 0, 3.7, 0.05, [0.95, 0.5, 0.1]); part(5.8, 0.12, 1.5, 0, 2.5, 0.75, BL); part(5.8, 0.2, 0.05, 0, 2.3, 1.5, [0.95, 0.5, 0.1]);
    for (const s of [-1, 1]) part(0.3, 3.9, 0.3, s * 2.95, 0, 0.18, [0.1, 0.18, 0.3]);
    for (let k = 0; k < 3; k++) part(0.6, 0.85, 0.9, -3.8 + k * 0.1, 0, 2.2 + k * 0.05, [0.72, 0.74, 0.76]); part(1.8, 0.05, 1.3, -3.8, 0.85, 2.2, [0.2, 0.22, 0.24]);
    part(0.55, 5.2, 0.45, 6.4, 0, 5.2, [0.1, 0.18, 0.3]); part(1.8, 1.3, 0.5, 6.4, 5.2, 5.2, BL);
    for (let k = -3; k <= 3; k++) part(0.12, 0.02, 4.8, k * 2.6, 0.02, 9.5, [0.95, 0.95, 0.95]);
  } else if (key === 'sushi') {
    const RD = [0.77, 0.08, 0.24], DK = [0.14, 0.12, 0.12];
    part(4.8, 0.14, 1.2, 0, 2.55, 0.6, RD); part(4.8, 0.26, 0.06, 0, 2.29, 1.2, DK); for (const s of [-1, 1]) part(0.1, 2.5, 0.1, s * 2.3, 0, 1.15, DK);
    for (let k = 0; k < 3; k++) { part(0.34, 0.48, 0.34, -1.1 + k * 1.1, 2.02, 0.7, [0.96, 0.9, 0.78]); part(0.38, 0.04, 0.38, -1.1 + k * 1.1, 2.5, 0.7, RD); }
    part(1.0, 0.5, 0.5, 3.1, 0, 0.5, [0.35, 0.25, 0.16]); part(1.0, 0.4, 0.4, -3.1, 0, 0.5, [0.2, 0.45, 0.2]);
  } else if (key === 'epicentr') {
    part(6.6, 1.1, 0.07, 0, 0, 0.035, R, 6); part(6.6, 1.5, 0.06, 0, 2.5, 0.03, R, 5); part(6.6, 0.12, 0.08, 0, 2.4, 0.06, R, 6);
    part(4.2, 0.14, 1.7, 0, 2.5, 0.85, R, 6); for (const s of [-1, 1]) part(0.16, 2.5, 0.16, s * 2.0, 0, 1.6, DG);
    part(1.0, 5.2, 0.5, 4.5, 0, 1.9, R, 5); part(1.04, 1.3, 0.54, 4.5, 5.2, 1.9, R, 6); part(0.8, 0.5, 0.02, 4.5, 3.0, 2.17, [0.1, 0.1, 0.1]);
    for (let k = 0; k < 3; k++) part(1.7, 0.13, 0.9, -4.1, k * 0.2 + 0.15, 1.9, [0.72 - k * 0.05, 0.5 - k * 0.03, 0.3]); for (let k = 0; k < 4; k++) part(1.7, 0.09, 0.9, -4.1, 0.75 + k * 0.1, 1.9, [0.78, 0.56, 0.34]);
    part(1.2, 0.8, 0.9, -4.1, 1.15, 1.9, [0.62, 0.3, 0.2]); part(1.3, 0.12, 1.0, -4.1, 0.0, 1.9, [0.55, 0.4, 0.25]);
  } else if (key === 'office') {   // glass entrance with a steel canopy
    part(3.6, 0.12, 1.5, 0, 2.55, 0.75, [0.55, 0.78, 0.9]); part(3.7, 0.18, 0.08, 0, 2.38, 1.5, DG);
    for (const s of [-1, 1]) { part(0.09, 2.55, 0.09, s * 1.75, 0, 1.45, [0.55, 0.57, 0.6]); part(0.14, 2.2, 0.14, s * 1.15, 0, 0.1, DG); part(0.05, 2.0, 1.1, s * 1.78, 0.2, 0.75, [0.7, 0.86, 0.95]); }
    part(2.4, 0.14, 0.14, 0, 2.2, 0.08, DG); part(0.55, 0.34, 0.03, 1.8, 1.3, 0.04, [0.15, 0.4, 0.7]);
    part(1.5, 0.45, 0.5, -3.2, 0, 0.8, [0.62, 0.62, 0.6]); part(1.3, 0.55, 0.4, -3.2, 0.45, 0.8, [0.28, 0.5, 0.26]);
  } else if (key === 'depot') {    // dock shutters, bollards, service door
    for (const s of [-1, 1]) {
      part(2.7, 2.7, 0.1, s * 3.4, 0, 0.05, [0.13, 0.14, 0.16]); for (let k = 0; k < 6; k++) part(2.6, 0.04, 0.13, s * 3.4, 0.35 + k * 0.4, 0.06, [0.26, 0.27, 0.3]);
      part(2.9, 0.16, 0.16, s * 3.4, 2.7, 0.08, [0.95, 0.78, 0.1]); part(0.14, 2.7, 0.16, s * 2.0, 0, 0.08, [0.95, 0.78, 0.1]); part(0.14, 2.7, 0.16, s * 4.8, 0, 0.08, [0.95, 0.78, 0.1]);
      part(0.2, 0.95, 0.2, s * 2.4, 0, 1.4, [0.95, 0.78, 0.1]); part(0.2, 0.95, 0.2, s * 4.4, 0, 1.4, [0.95, 0.78, 0.1]); part(2.2, 0.35, 0.3, s * 3.4, 0, 0.3, [0.08, 0.08, 0.09]);
    }
    part(1.2, 0.3, 0.04, 0, 2.2, 0.04, [0.1, 0.5, 0.25]); part(2.4, 0.14, 0.12, 0, 2.22 + 0.3, 0.06, [0.3, 0.32, 0.34]);
    part(0.12, 1.8, 0.7, 1.0, 0, 0.35, [0.16, 0.36, 0.7]); part(0.12, 1.8, 0.7, -1.0, 0, 0.35, [0.16, 0.36, 0.7]);
    for (let k = 0; k < 3; k++) part(2.1, 0.06, 0.7, 0, 0.3 + k * 0.6, 0.35, [0.9, 0.5, 0.15]); part(0.7, 0.4, 0.5, -0.4, 0.36, 0.35, [0.7, 0.55, 0.33]);
  }
  return B.build();
}
export const KIT_FOR = { mcd: 'mcd', puzata: 'puzata', silpo: 'silpo', atb: 'atb', sushi: 'sushi', epicentr: 'epicentr', dvornik: 'office', kurier: 'office', taxi: 'office', gruzchik: 'depot', bus: 'depot', tram: 'depot' };
export const POSTER_FOR = { mcd: 0, puzata: 2, silpo: 4, epicentr: 6, dvornik: 8, kurier: 8, taxi: 8, gruzchik: 10, bus: 10, tram: 10 };   // exterior picture cell in posters.jpg (4x3)

export class FacadeKits {
  constructor(scene, cap = 24) {
    this.cap = cap; this.kits = {};
    const mat = new THREE.MeshStandardMaterial({ map: designTex('brand.jpg'), vertexColors: true, roughness: 0.65, metalness: 0.05 });
    for (const k of new Set(Object.values(KIT_FOR))) {
      const m = new THREE.InstancedMesh(kitBuild(k), mat, cap); m.count = 0; m.frustumCulled = false; scene.add(m); this.kits[k] = m;
    }
    // framed picture boards (exterior reference pictures) beside the door
    const pg = new THREE.PlaneGeometry(1.9, 1.27); pg.translate(0, 1.27 / 2 + 1.0, 0.1); pg.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(cap * 8 * 2), 2));
    const pm = new THREE.MeshStandardMaterial({ map: designTex('posters.jpg'), roughness: 0.6, emissive: 0x303030, emissiveMap: designTex('posters.jpg') });
    pm.onBeforeCompile = s => { s.vertexShader = 'attribute vec2 aCell;\n' + s.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = (vMapUv * 0.985 + 0.0075) * vec2(0.25, 0.33203) + aCell;\n#endif'); };
    pm.customProgramCacheKey = () => 'kyivPosterBoard';
    this.board = new THREE.InstancedMesh(pg, pm, cap * 8); this.board.count = 0; this.board.frustumCulled = false; scene.add(this.board);
    const fg = new THREE.BoxGeometry(2.04, 1.41, 0.04); fg.translate(0, 1.27 / 2 + 1.0, 0.075);
    this.frame = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6 }), cap * 8); this.frame.count = 0; this.frame.frustumCulled = false; scene.add(this.frame);
    this.cnt = {}; this.nb = 0; this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._m = new THREE.Matrix4(); this._up = new THREE.Vector3(0, 1, 0); this._m2 = new THREE.Matrix4();
  }
  begin() { for (const k in this.kits) this.kits[k].count = 0; this.nb = 0; this.cnt = {}; }
  // door: {mx, mz, nx, nz}; y0 = floor level; sideX: board offset along the wall
  add(key, d, y0) {
    const kit = this.kits[KIT_FOR[key]]; if (!kit || kit.count >= this.cap) return;
    this._q.setFromAxisAngle(this._up, Math.atan2(d.nx, d.nz)); this._p.set(d.mx, y0, d.mz); this._m.compose(this._p, this._q, this._s); kit.setMatrixAt(kit.count++, this._m);
    if (this.nb < this.cap * 8 - 1) {
      const cell = POSTER_FOR[key] || 0, side = key === 'puzata' ? -1 : 1, ox = KIT_FOR[key] === 'depot' ? 0 : side * 2.15;
      if (KIT_FOR[key] === 'depot' || key === 'atb' || key === 'sushi') return;   // the warehouse front is all docks / no reference picture for atb, sushi
      this._p.set(d.mx + d.nz * ox, y0, d.mz - d.nx * ox); this._m.compose(this._p, this._q, this._s);
      this.board.setMatrixAt(this.nb, this._m); this.frame.setMatrixAt(this.nb, this._m);
      this.board.geometry.attributes.aCell.setXY(this.nb, (cell % 4) * 0.25, 1 - ((cell >> 2) + 1) * 170 / 512); this.nb++;
    }
  }
  end() { for (const k in this.kits) this.kits[k].instanceMatrix.needsUpdate = true; this.board.count = this.frame.count = this.nb; this.board.instanceMatrix.needsUpdate = true; this.frame.instanceMatrix.needsUpdate = true; this.board.geometry.attributes.aCell.needsUpdate = true; }
}
