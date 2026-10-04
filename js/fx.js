// Night lighting & atmosphere effects (all additive / emissive, no real lights): lit windows (facade shader patch), street-lamp glow + light pools,
// car head/tail lights + headlight cones, plus the shared `NIGHT` uniforms read by other materials.
import * as THREE from 'three';

export const NIGHT = { value: 0 };      // 0 = day … 1 = full night (shared uniform object)
export const LITFRAC = { value: 0.5 };  // share of windows that are lit
export const WET = { value: 0 };        // 0 dry … 1 wet roads (reflective puddles)
export const TIME = { value: 0 };       // seconds, for subtle animation

const GLSL_HASH = `float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`;

// lit windows: patch a facade MeshStandardMaterial (needs map + vertexColors); winMask comes from textures.js (r = glass, g = shop glass)
export function patchFacadeNight(mat, winMask) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = NIGHT; sh.uniforms.uLit = LITFRAC; sh.uniforms.tWin = { value: winMask };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP; uniform float uNight, uLit; uniform sampler2D tWin;\n${GLSL_HASH}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef USE_MAP
  if (uNight > 0.01) {
    vec2 wm = texture2D(tWin, vMapUv).rg;
    if (wm.r > 0.05) {
      vec2 cell = floor(vMapUv * vec2(2.0, 1.0));
      float seed = vColor.r * 91.7 + vColor.g * 53.1 + vColor.b * 17.3;
      float h = h21(cell + seed), h2 = h21(cell * 1.7 + seed + 3.1), h3 = h21(cell * 2.3 + seed + 8.9);
      float on = step(h, uLit * (1.0 + wm.g * 1.6)) ;
      vec3 warm = mix(vec3(1.0, 0.70, 0.36), vec3(1.0, 0.86, 0.62), h2), cool = vec3(0.70, 0.84, 1.0);
      vec3 lc = mix(warm, cool, step(0.86, h3));
      float curtain = 0.55 + 0.45 * smoothstep(0.0, 1.0, fract(vMapUv.y * 1.0 + h2));
      totalEmissiveRadiance += lc * on * wm.r * uNight * (0.9 + 0.9 * h3) * curtain;
    }
  }
#endif`);
  };
  mat.customProgramCacheKey = () => 'kyivFacadeNight';
}

const glowVS = `
varying vec2 vUv; uniform float uNight;
void main() {
  vUv = uv;
  vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(vec3(instanceMatrix[0]));
  vec4 mv = viewMatrix * c; mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
}`;
const glowFS = `
varying vec2 vUv; uniform float uNight; uniform vec3 uCol;
void main() {
  float d = length(vUv - 0.5) * 2.0; float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
  vec3 col = uCol * a * uNight * 1.6;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const poolVS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
const poolFS = `
varying vec2 vUv; uniform float uNight; uniform vec3 uCol;
void main() {
  float d = length(vUv - 0.5) * 2.0; float a = pow(clamp(1.0 - d, 0.0, 1.0), 1.7);
  gl_FragColor = vec4(uCol * a * uNight * 0.55, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const coneVS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
const coneFS = `
varying vec2 vUv; uniform float uNight;
void main() {
  float side = 1.0 - smoothstep(0.35, 1.0, abs(vUv.x - 0.5) * 2.0);
  float fall = pow(1.0 - vUv.y, 1.35) * smoothstep(0.0, 0.08, vUv.y);
  gl_FragColor = vec4(vec3(1.0, 0.92, 0.72) * side * fall * uNight * 0.5, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function additive(vs, fs, col) {
  return new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms: { uNight: NIGHT, uCol: { value: new THREE.Color(col) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
}
export function coneGeometry() {   // ground trapezoid in front of a car: x = lateral, z = forward (0..1), uv.y = distance
  const g = new THREE.BufferGeometry(), w0 = 0.9, w1 = 2.7;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w0, 0, 0, w0, 0, 0, -w1, 0, 1, w1, 0, 1], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2)); g.setIndex([0, 2, 1, 1, 2, 3]);
  g.computeBoundingSphere(); g.boundingSphere.radius = 1e5; return g;
}
export { additive, coneVS, coneFS };

export class FX {
  constructor(scene, world, opts = {}) {
    this.scene = scene; this.world = world; this.mob = !!opts.mob; this.cap = this.mob ? 140 : 320; this.t = 0; this.refT = 99; this.level = 3;
    const quad = new THREE.PlaneGeometry(1, 1), flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.glow = new THREE.InstancedMesh(quad, additive(glowVS, glowFS, 0xffb25a), this.cap); this.pool = new THREE.InstancedMesh(flat, additive(poolVS, poolFS, 0xffa34a), this.cap);
    for (const m of [this.glow, this.pool]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 5; m.visible = false; scene.add(m); }
    this.glow.material.depthTest = true;
  }
  setLevel(l) { this.level = l; this.cap2 = [0, 60, 140, this.cap][l] || 0; }
  setNight(n, lit) { NIGHT.value = n; LITFRAC.value = lit; this.glow.visible = this.pool.visible = n > 0.04 && this.level > 0; }
  update(P, dt) {
    TIME.value += dt; this.refT += dt;
    if (!this.glow.visible || this.refT < 0.8) return; this.refT = 0;
    const lim = Math.min(this.cap, this.cap2 ?? this.cap), R = this.mob ? 160 : 260, list = [];
    for (const t of this.world.tiles.values()) { if (!t.lampPos) continue; const L = t.lampPos;
      for (let i = 0; i < L.length; i += 2) { const dx = L[i] - P.x, dz = L[i + 1] - P.z, d2 = dx * dx + dz * dz; if (d2 < R * R) list.push([d2, L[i], L[i + 1]]); } }
    list.sort((a, b) => a[0] - b[0]); const n = Math.min(lim, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const x = list[i][1], z = list[i][2], a = hash(x * 7 + z) * 6.28, gy = this.world.heightAt(x, z), hx = x + Math.cos(a) * 0.9, hz = z - Math.sin(a) * 0.9;
      p.set(hx, gy + 5.95, hz); s.setScalar(1.7); m.compose(p, q.identity(), s); this.glow.setMatrixAt(i, m);
      p.set(hx, gy + 0.22, hz); s.setScalar(this.level >= 2 ? 11 : 9); m.compose(p, q.identity(), s); this.pool.setMatrixAt(i, m);
    }
    this.glow.count = this.pool.count = n; this.glow.instanceMatrix.needsUpdate = this.pool.instanceMatrix.needsUpdate = true;
  }
}
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
