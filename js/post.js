// Post-processing pipeline (WebGL2): HDR scene target (MSAA) -> half-res depth-based AO ("SSAO-lite", bilateral blurred) -> 2-level bloom ->
// composite (AO, bloom, sun glare, ACES tone mapping via the renderer, grading, vignette, dither). Modes: 0 off (direct render), 1 light (bloom+grade), 2 full (+AO).
import * as THREE from 'three';

const VS = `varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const IGN = `float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`;

const AO_FS = (N) => `
varying vec2 vUv; uniform sampler2D tDepth; uniform mat4 uProj, uInvProj; uniform float uRadius, uFade; uniform vec2 uTexel;
${IGN}
vec3 vp(vec2 uv) { float d = texture2D(tDepth, uv).x; vec4 c = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return c.xyz / c.w; }
void main() {
  float d0 = texture2D(tDepth, vUv).x;
  if (d0 > 0.99995) { gl_FragColor = vec4(1.0); return; }
  vec3 p = vp(vUv); float dist = -p.z; if (dist > uFade) { gl_FragColor = vec4(1.0); return; }
  vec3 px = vp(vUv + vec2(uTexel.x, 0.0)), nx = vp(vUv - vec2(uTexel.x, 0.0)), py = vp(vUv + vec2(0.0, uTexel.y)), ny = vp(vUv - vec2(0.0, uTexel.y));
  vec3 dx = abs(px.z - p.z) < abs(nx.z - p.z) ? px - p : p - nx, dy = abs(py.z - p.z) < abs(ny.z - p.z) ? py - p : p - ny;
  vec3 n = normalize(cross(dx, dy)); if (n.z < 0.0) n = -n;
  vec3 t = normalize(cross(n, abs(n.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), b = cross(n, t);
  float ang = ign(gl_FragCoord.xy) * 6.2831853, rad = uRadius * (0.7 + 0.5 * dist * 0.004);
  float occ = 0.0;
  for (int i = 0; i < ${N}; i++) {
    float fi = (float(i) + 0.5) / float(${N}); float a = ang + fi * 6.2831853 * 2.39996; float z = sqrt(fi), rr = sqrt(1.0 - fi);
    vec3 dir = t * cos(a) * rr + b * sin(a) * rr + n * z; float sc = mix(0.12, 1.0, fi * fi);
    vec3 sp = p + dir * rad * sc; vec4 pp = uProj * vec4(sp, 1.0); vec2 uv2 = pp.xy / pp.w * 0.5 + 0.5;
    if (uv2.x < 0.0 || uv2.x > 1.0 || uv2.y < 0.0 || uv2.y > 1.0) continue;
    float sz = vp(uv2).z; float diff = sz - sp.z; float rc = smoothstep(0.0, 1.0, rad / max(0.001, abs(p.z - sz)));
    occ += (diff > 0.04 * (1.0 + dist * 0.02) ? 1.0 : 0.0) * rc;
  }
  float ao = 1.0 - occ / float(${N}) * 1.35; ao = mix(ao, 1.0, smoothstep(uFade * 0.55, uFade, dist));
  gl_FragColor = vec4(vec3(clamp(ao, 0.0, 1.0)), 1.0);
}`;
const AOB_FS = `
varying vec2 vUv; uniform sampler2D tAO, tDepth; uniform vec2 uTexel; uniform float uNear, uFar;
float lz(vec2 uv) { float d = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - d * (uFar - uNear)); }
void main() {
  float z0 = lz(vUv), s = 0.0, w = 0.0;
  for (int j = -1; j <= 2; j++) for (int i = -1; i <= 2; i++) { vec2 uv = vUv + (vec2(float(i), float(j)) - 0.5) * uTexel; float wz = exp(-abs(lz(uv) - z0) / (0.06 * z0 + 0.15)); s += texture2D(tAO, uv).r * wz; w += wz; }
  gl_FragColor = vec4(vec3(s / max(w, 0.0001)), 1.0);
}`;
const BRIGHT_FS = `
varying vec2 vUv; uniform sampler2D tScene; uniform vec2 uTexel; uniform float uThr;
vec3 smp(vec2 uv) { vec3 c = texture2D(tScene, uv).rgb; float l = max(max(c.r, c.g), c.b); float k = clamp((l - uThr) / (uThr * 0.6 + 0.001), 0.0, 1.0); return c * (k * k * (3.0 - 2.0 * k)); }
void main() { vec3 c = smp(vUv + uTexel * vec2(-1.0, -1.0)) + smp(vUv + uTexel * vec2(1.0, -1.0)) + smp(vUv + uTexel * vec2(-1.0, 1.0)) + smp(vUv + uTexel * vec2(1.0, 1.0)); gl_FragColor = vec4(min(c * 0.25, vec3(8.0)), 1.0); }`;
const BLUR_FS = `
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += (texture2D(tSrc, vUv + uDir * 1.3846153846).rgb + texture2D(tSrc, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
  c += (texture2D(tSrc, vUv + uDir * 3.2307692308).rgb + texture2D(tSrc, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;
const COMP_FS = `
varying vec2 vUv; uniform sampler2D tScene, tAO, tBA, tBB, tDepth; uniform float uAO, uBloom, uNight, uGlare, uVig, uTime; uniform vec2 uSunUv, uAspect;
${IGN}
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  if (uAO > 0.0) c *= mix(1.0, texture2D(tAO, vUv).r, uAO);
  vec3 bl = texture2D(tBA, vUv).rgb * 0.75 + texture2D(tBB, vUv).rgb * 1.0; c += bl * uBloom;
  if (uGlare > 0.001) {
    float vis = 0.0; for (int i = 0; i < 9; i++) { vec2 o = vec2(mod(float(i), 3.0) - 1.0, floor(float(i) / 3.0) - 1.0) * 0.012; vec2 q = uSunUv + o; vis += (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0 && texture2D(tDepth, q).x > 0.99995) ? 1.0 : 0.0; }
    vis /= 9.0; vec2 dd = (vUv - uSunUv) * uAspect; float r = length(dd);
    float g = 0.9 / (1.0 + r * r * 70.0) + 0.35 / (1.0 + r * r * 9.0) + 0.05 * exp(-r * 2.0);
    c += vec3(1.0, 0.82, 0.55) * g * vis * uGlare;
  }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  vec3 o = gl_FragColor.rgb; float l = dot(o, vec3(0.2126, 0.7152, 0.0722));
  o = mix(vec3(l), o, 1.09);                                   // saturation
  o = mix(o, o * o * (3.0 - 2.0 * o), 0.2);                    // gentle S-curve
  vec3 tint = mix(vec3(0.95, 0.99, 1.06), vec3(1.05, 1.0, 0.94), smoothstep(0.1, 0.7, l)); o *= mix(vec3(1.0), tint, 0.55);   // cool shadows / warm highlights
  o = mix(o, o * vec3(0.84, 0.93, 1.12), uNight * 0.35);        // night: blue grade
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.9); o *= 1.0 - uVig * smoothstep(0.18, 0.75, dot(q, q) * 2.2);
  gl_FragColor = vec4(max(o, 0.0), 1.0);
  #include <colorspace_fragment>
  gl_FragColor.rgb += (ign(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
}`;

export class Post {
  constructor(renderer, opts = {}) {
    this.r = renderer; this.mob = !!opts.mob; this.mode = 0; this.size = new THREE.Vector2(); this.ok = false;
    const ext = renderer.extensions; this.hdr = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.scn = new THREE.Scene();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(g, null); this.quad.frustumCulled = false; this.scn.add(this.quad);
    const mat = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra });
    const T = null;
    this.mAO = mat(AO_FS(this.mob ? 7 : 10), { tDepth: { value: T }, uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() }, uRadius: { value: 1.3 }, uFade: { value: 140 }, uTexel: { value: new THREE.Vector2() } });
    this.mAOB = mat(AOB_FS, { tAO: { value: T }, tDepth: { value: T }, uTexel: { value: new THREE.Vector2() }, uNear: { value: 0.3 }, uFar: { value: 3000 } });
    this.mBright = mat(BRIGHT_FS, { tScene: { value: T }, uTexel: { value: new THREE.Vector2() }, uThr: { value: 0.85 } });
    this.mBlur = mat(BLUR_FS, { tSrc: { value: T }, uDir: { value: new THREE.Vector2() } });
    this.mComp = mat(COMP_FS, { tScene: { value: T }, tAO: { value: T }, tBA: { value: T }, tBB: { value: T }, tDepth: { value: T }, uAO: { value: 0 }, uBloom: { value: 0.5 }, uNight: { value: 0 }, uGlare: { value: 0 }, uVig: { value: 0.28 }, uTime: { value: 0 },
      uSunUv: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: new THREE.Vector2(1, 1) } });
    this.bloom = 0.5; this.thr = 1.4; this.night = 0; this.glare = 0; this.sunDir = new THREE.Vector3(0, 1, 0); this._v = new THREE.Vector4();
  }
  _rt(w, h, o = {}) { return new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), { type: this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false, colorSpace: THREE.LinearSRGBColorSpace, ...o }); }
  _alloc() {
    this.r.getDrawingBufferSize(this.size); const W = this.size.x, H = this.size.y; if (this.W === W && this.H === H && this.rt) return; this.W = W; this.H = H; this._free();
    const dt = new THREE.DepthTexture(W, H); dt.type = THREE.UnsignedIntType; dt.minFilter = dt.magFilter = THREE.NearestFilter;
    this.rt = this._rt(W, H, { depthBuffer: true, depthTexture: dt, samples: 4 });
    this.ao = this._rt(W / 2, H / 2, { type: THREE.UnsignedByteType }); this.ao2 = this._rt(W / 2, H / 2, { type: THREE.UnsignedByteType });
    this.ba = this._rt(W / 4, H / 4); this.ba2 = this._rt(W / 4, H / 4); this.bb = this._rt(W / 8, H / 8); this.bb2 = this._rt(W / 8, H / 8);
  }
  _free() { for (const k of ['rt', 'ao', 'ao2', 'ba', 'ba2', 'bb', 'bb2']) if (this[k]) { this[k].dispose(); if (this[k].depthTexture) this[k].depthTexture.dispose(); this[k] = null; } }
  setMode(m) { m = m | 0; if (m === this.mode) return; this.mode = m; if (m === 0) { this._free(); this.W = 0; } }
  _pass(mat, target, uniforms) {
    for (const k in uniforms) mat.uniforms[k].value = uniforms[k];
    this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.scn, this.cam);
  }
  render(scene, camera, dt = 0.016) {
    const r = this.r; if (!this.mode) { r.render(scene, camera); return; }
    this._alloc(); const W = this.W, H = this.H, full = this.mode >= 2, info = r.info; info.autoReset = false; info.reset();
    const shadowAuto = r.shadowMap.autoUpdate;
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, camera);
    const depth = this.rt.depthTexture;
    if (full) {
      camera.updateMatrixWorld(); const inv = this.mAO.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse), pr = this.mAO.uniforms.uProj.value.copy(camera.projectionMatrix);
      this._pass(this.mAO, this.ao, { tDepth: depth, uTexel: this.mAO.uniforms.uTexel.value.set(1 / (W / 2), 1 / (H / 2)) });
      this._pass(this.mAOB, this.ao2, { tAO: this.ao.texture, tDepth: depth, uTexel: this.mAOB.uniforms.uTexel.value.set(1 / (W / 2), 1 / (H / 2)), uNear: camera.near, uFar: camera.far });
    }
    // bloom: 1/4 and 1/8 res, separable gaussian
    this._pass(this.mBright, this.ba, { tScene: this.rt.texture, uTexel: this.mBright.uniforms.uTexel.value.set(1 / W, 1 / H), uThr: this.thr });
    const bl = (src, tmp, w, h) => { this._pass(this.mBlur, tmp, { tSrc: src.texture, uDir: this.mBlur.uniforms.uDir.value.set(1 / w, 0) }); this._pass(this.mBlur, src, { tSrc: tmp.texture, uDir: this.mBlur.uniforms.uDir.value.set(0, 1 / h) }); };
    bl(this.ba, this.ba2, W / 4, H / 4);
    this._pass(this.mBlur, this.bb, { tSrc: this.ba.texture, uDir: this.mBlur.uniforms.uDir.value.set(0, 0) }); bl(this.bb, this.bb2, W / 8, H / 8);
    // sun glare position
    let glare = 0; const sunUv = this.mComp.uniforms.uSunUv.value;
    if (this.glare > 0.001) { const v = this._v.set(this.sunDir.x, this.sunDir.y, this.sunDir.z, 0).applyMatrix4(camera.matrixWorldInverse); if (v.z < -0.05) { const c = this._v.set(this.sunDir.x, this.sunDir.y, this.sunDir.z, 0).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix); const w = -v.z; sunUv.set(c.x / w * 0.5 + 0.5, c.y / w * 0.5 + 0.5); glare = this.glare * Math.min(1, -v.z * 2.0); } }
    this._pass(this.mComp, null, { tScene: this.rt.texture, tAO: full ? this.ao2.texture : null, tBA: this.ba.texture, tBB: this.bb.texture, tDepth: depth, uAO: full ? 0.85 : 0, uBloom: this.bloom, uNight: this.night, uGlare: glare, uTime: (performance.now() % 1000) / 1000 * 7,
      uAspect: this.mComp.uniforms.uAspect.value.set(W / H, 1) });
    info.autoReset = true;
  }
}
