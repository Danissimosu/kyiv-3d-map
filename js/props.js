// Street furniture templates (benches, bins, bollards, hydrants, mail boxes, bike racks, crossing signs, traffic lights) as merged vertex-coloured geometry,
// stamped into per-tile mesh builders (one draw call per tile). Local frame: +z = front (faces the street), y up, origin on the ground.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
function part(g, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  g.deleteAttribute('uv'); if (rx || ry || rz) g.applyMatrix4(_m.makeRotationFromQuaternion(_q.setFromEuler(_e.set(rx, ry, rz)))); g.translate(x, y, z);
  const n = g.attributes.position.count, a = new Float32Array(n * 3), col = new THREE.Color(c); for (let i = 0; i < n; i++) { a[3 * i] = col.r; a[3 * i + 1] = col.g; a[3 * i + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const box = (w, h, d, c, x, y, z, rx, ry, rz) => part(new THREE.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz);
const cyl = (r0, r1, h, c, x, y, z, seg = 6) => part(new THREE.CylinderGeometry(r0, r1, h, seg), c, x, y, z);
const M = parts => mergeGeometries(parts);

let TPL = null;
export function propTemplates() {
  if (TPL) return TPL;
  const WOOD = 0x8a5a32, METAL = 0x2d3033, GREEN = 0x2f5a3a, GREY = 0x8d8f91;
  const bench = M([box(1.7, 0.06, 0.45, WOOD, 0, 0.46, 0), box(1.7, 0.06, 0.1, WOOD, 0, 0.62, -0.2), box(1.7, 0.06, 0.1, WOOD, 0, 0.78, -0.22), box(0.07, 0.46, 0.4, METAL, -0.78, 0.23, 0), box(0.07, 0.46, 0.4, METAL, 0.78, 0.23, 0), box(0.06, 0.4, 0.06, METAL, -0.78, 0.66, -0.2), box(0.06, 0.4, 0.06, METAL, 0.78, 0.66, -0.2)]);
  const bin = M([cyl(0.22, 0.2, 0.75, GREEN, 0, 0.45, 0), cyl(0.25, 0.25, 0.06, 0x23402b, 0, 0.84, 0), box(0.04, 0.5, 0.04, METAL, 0, 0.2, 0)].slice(0, 2));
  const bollard = M([cyl(0.07, 0.07, 0.8, GREY, 0, 0.4, 0, 6), cyl(0.075, 0.075, 0.1, 0xe8c020, 0, 0.7, 0, 6)]);
  const hydrant = M([cyl(0.13, 0.15, 0.62, 0xb02a24, 0, 0.31, 0, 8), cyl(0.15, 0.15, 0.06, 0x8a1f1a, 0, 0.64, 0, 8), box(0.34, 0.1, 0.1, 0xb02a24, 0, 0.45, 0)]);
  const mailbox = M([box(0.5, 0.9, 0.4, 0x2058a8, 0, 0.8, 0), box(0.56, 0.08, 0.44, 0x16407e, 0, 1.28, 0), box(0.1, 0.35, 0.1, METAL, -0.15, 0.17, 0), box(0.1, 0.35, 0.1, METAL, 0.15, 0.17, 0), box(0.3, 0.05, 0.02, 0xf0f0f0, 0, 1.0, 0.205)]);
  const rack = []; for (let i = 0; i < 3; i++) { rack.push(part(new THREE.TorusGeometry(0.3, 0.025, 3, 6, Math.PI), METAL, (i - 1) * 0.45, 0.05, 0, 0, 0, 0)); }
  const bikerack = M(rack.map(g => { g.rotateZ(0); return g; }));
  const crossSign = M([cyl(0.04, 0.04, 2.5, METAL, 0, 1.25, 0, 6), box(0.6, 0.6, 0.03, 0x1f58b8, 0, 2.35, 0.04), box(0.5, 0.5, 0.032, 0xf3f3f3, 0, 2.35, 0.045), part(new THREE.ConeGeometry(0.22, 0.4, 3), 0x1f58b8, 0, 2.38, 0.06, Math.PI / 2, 0, 0), box(0.1, 0.2, 0.034, 0xf3f3f3, 0, 2.32, 0.065)]);
  const tlight = M([cyl(0.06, 0.06, 3.3, METAL, 0, 1.65, 0, 6), box(0.3, 0.9, 0.22, 0x17191b, 0, 3.2, 0.12), part(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8), 0xd02020, 0, 3.5, 0.24, Math.PI / 2), part(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8), 0xe0b020, 0, 3.2, 0.24, Math.PI / 2), part(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8), 0x20c040, 0, 2.9, 0.24, Math.PI / 2)]);
  return TPL = { bench, bin, bollard, hydrant, mailbox, bikerack, crossSign, tlight };
}
// append `geo` to the MB-style builder `B` (v(x,y,z,nx,ny,nz,u,v,r,g,b) / tri) with yaw, uniform scale at (x, y, z)
export function stamp(B, geo, x, y, z, yaw, s = 1) {
  const P = geo.attributes.position, N = geo.attributes.normal, C = geo.attributes.color, I = geo.index.array, n = P.count, c = Math.cos(yaw), sn = Math.sin(yaw), base = B.vc;
  for (let i = 0; i < n; i++) {
    const px = P.getX(i) * s, py = P.getY(i) * s, pz = P.getZ(i) * s, nx = N.getX(i), nz = N.getZ(i);
    B.v(x + px * c + pz * sn, y + py, z - px * sn + pz * c, nx * c + nz * sn, N.getY(i), -nx * sn + nz * c, 0, 0, C.getX(i), C.getY(i), C.getZ(i));
  }
  for (let i = 0; i < I.length; i += 3) B.tri(base + I[i], base + I[i + 1], base + I[i + 2]);
}
