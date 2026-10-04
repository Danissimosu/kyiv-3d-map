// Sky extras drawn over the Sky shader: procedural drifting clouds (lit by the sun), stars and the moon at night.
// A dome that follows the camera, forced to the far plane (z = w) so terrain/buildings always cover it.
import * as THREE from 'three';
import { NIGHT, TIME } from './fx.js';

const VS = `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); gl_Position = p; gl_Position.z = p.w * 0.99999; }`;
const FS = (oct) => `
varying vec3 vDir; uniform vec3 uSun, uMoon, uLit, uShade, uFog; uniform float uNight, uTime, uCover;
float h21(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float h31(vec3 p){ p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < ${oct}; i++) { s += a * vn(p); p = p * 2.03 + 17.3; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir); float up = d.y; if (up < -0.02) discard;
  vec3 sc = vec3(0.0); float sa = 0.0;
  // stars
  { vec3 sp = d * 260.0; vec3 id = floor(sp), f = fract(sp) - 0.5; float r = h31(id); float tw = 0.75 + 0.25 * sin(uTime * 2.3 + r * 60.0);
    float st = step(0.9945, r) * (1.0 - smoothstep(0.0, 0.42, length(f))) * tw * smoothstep(0.03, 0.3, up) * uNight; sc += vec3(0.82, 0.88, 1.0) * st * (0.6 + 1.4 * h31(id + 3.0)); sa += st; }
  // moon
  { float md = dot(d, uMoon); float disc = smoothstep(0.99935, 0.99965, md); float halo = pow(max(md, 0.0), 260.0) * 0.45 + pow(max(md, 0.0), 24.0) * 0.06;
    vec3 mc = vec3(0.86, 0.9, 1.0) * (disc * 2.4 + halo) * uNight; sc += mc; sa += (disc + halo) * uNight; }
  // clouds
  vec2 uv = d.xz / (up + 0.14) * 1.9 + vec2(uTime * 0.0035, uTime * 0.0012);
  float c = fbm(uv * 1.25), dens = smoothstep(0.60 - uCover * 0.6, 0.60 - uCover * 0.6 + 0.2, c);
  float hz = smoothstep(0.0, 0.22, up); float ca = dens * hz;
  float c2 = fbm((uv + uSun.xz * 0.07) * 1.25); float shade = clamp((c - c2) * 3.2 + 0.55, 0.0, 1.0);
  vec3 cc = mix(uShade, uLit, shade); cc += uLit * pow(max(dot(d, uSun), 0.0), 7.0) * 0.28 * (1.0 - uNight);
  cc = mix(cc, uFog, (1.0 - smoothstep(0.0, 0.25, up)) * 0.6);
  float a = clamp(ca + sa, 0.0, 1.0); vec3 col = (cc * ca + sc) / max(0.0001, ca + sa);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class SkyFX {
  constructor(scene, opts = {}) {
    this.u = { uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, -1, 0) }, uLit: { value: new THREE.Color(1.3, 1.25, 1.15) }, uShade: { value: new THREE.Color(0.55, 0.6, 0.7) }, uFog: { value: new THREE.Color(0xc4d7ea) },
      uNight: NIGHT, uTime: TIME, uCover: { value: opts.cover ?? 0.42 } };
    const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS(opts.mob ? 4 : 5), uniforms: this.u, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2000, 28, 14), m); this.mesh.renderOrder = -50; this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  // sunDir: direction to the sun (unit); f: 0 night … 1 day; sunCol: current sun colour; fog: fog colour
  update(cam, sunDir, f, sunCol, fog) {
    this.mesh.position.copy(cam.position); this.u.uSun.value.copy(sunDir); this.u.uMoon.value.set(-sunDir.x, Math.abs(sunDir.y) * 0.6 + 0.35, -sunDir.z).normalize();
    this.u.uLit.value.copy(sunCol).multiplyScalar(0.55 + 0.9 * f).lerp(new THREE.Color(0.06, 0.07, 0.11), 1 - f); this.u.uShade.value.setRGB(0.8, 0.86, 1.0).multiplyScalar((0.25 + 0.75 * f) * 1.0).lerp(new THREE.Color(0.02, 0.025, 0.045), 1 - f);
    this.u.uFog.value.copy(fog);
  }
}
