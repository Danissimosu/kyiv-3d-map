// Procedural textures (canvas 2D). Nothing is downloaded: all facade/road/ground textures are generated at start-up.
import * as THREE from 'three';
import { designImage } from './design.js';

function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function grain(ctx, w, h, amt, seed = 1, mono = true) {
  const id = ctx.getImageData(0, 0, w, h), d = id.data, r = rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amt;
    if (mono) { d[i] += n; d[i + 1] += n; d[i + 2] += n; } else { d[i] += (r() - 0.5) * amt; d[i + 1] += (r() - 0.5) * amt; d[i + 2] += (r() - 0.5) * amt; }
  }
  ctx.putImageData(id, 0, 0);
}
function tex(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function streaks(ctx, w, h, seed, n = 18, col = 'rgba(40,30,20,0.10)') {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * w, ww = 4 + r() * 18, g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x, 0, ww, h);
  }
}
let EM = null;   // emissive mask context (r = glass that can light up at night, g = always-lit shop glass) filled while a facade is drawn
function emRect(x, y, w, h, g = 0) { if (!EM) return; EM.fillStyle = `rgb(255,${g ? 255 : 0},0)`; EM.fillRect(x, y, w, h); }
function emClear(x, y, w, h) { if (!EM) return; EM.fillStyle = '#000'; EM.fillRect(x, y, w, h); }
// window: x,y,w,h in px
function win(ctx, x, y, w, h, o = {}) {
  const frame = o.frame || '#f2efe6', fw = o.fw || Math.max(4, w * 0.09);
  if (o.surround) { ctx.fillStyle = o.surround; ctx.fillRect(x - o.sw, y - o.sw, w + 2 * o.sw, h + 2 * o.sw); }
  ctx.fillStyle = frame; ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, o.g0 || '#7f9bb0'); g.addColorStop(0.45, o.g1 || '#3b4d5e'); g.addColorStop(1, o.g2 || '#27323f');
  ctx.fillStyle = g; ctx.fillRect(x + fw, y + fw, w - 2 * fw, h - 2 * fw);
  emRect(x + fw, y + fw, w - 2 * fw, h - 2 * fw);
  ctx.fillStyle = frame;
  if (o.cross !== false) { ctx.fillRect(x + w / 2 - fw / 2, y, fw, h); emClear(x + w / 2 - fw / 2, y, fw, h); if (h > w * 1.2) { ctx.fillRect(x, y + h * 0.33, w, fw); emClear(x, y + h * 0.33, w, fw); } }
  // recess: shadow of the reveal on top/left, brighter sky reflection in the upper pane, curtains / blinds
  { const gx = x + fw, gy = y + fw, gw = w - 2 * fw, gh = h - 2 * fw; ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(gx, gy, gw, Math.max(3, gh * 0.07)); ctx.fillRect(gx, gy, Math.max(3, gw * 0.05), gh);
    const sk = ctx.createLinearGradient(0, gy, 0, gy + gh * 0.55); sk.addColorStop(0, 'rgba(190,215,235,0.30)'); sk.addColorStop(1, 'rgba(190,215,235,0)'); ctx.fillStyle = sk; ctx.fillRect(gx, gy, gw, gh * 0.55);
    const r = ((x * 73856093) ^ (y * 19349663)) >>> 0, q = (r % 100) / 100;
    if (o.curt !== false && q < 0.4) { ctx.fillStyle = ['rgba(236,226,200,0.78)', 'rgba(205,150,140,0.72)', 'rgba(150,175,150,0.7)', 'rgba(225,225,235,0.8)'][r % 4]; const cw = gw * (q < 0.2 ? 0.34 : 0.5); ctx.fillRect(gx, gy, cw, gh * (0.55 + q)); if (q < 0.2) ctx.fillRect(gx + gw - cw, gy, cw, gh * (0.55 + q)); }
    else if (o.curt !== false && q < 0.55) { ctx.fillStyle = 'rgba(225,222,212,0.8)'; ctx.fillRect(gx, gy, gw, gh * 0.45); ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let yy = gy + 3; yy < gy + gh * 0.45; yy += 5) ctx.fillRect(gx, yy, gw, 1); } }
  // reflection glint
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath(); ctx.moveTo(x + fw, y + h - fw); ctx.lineTo(x + w * 0.55, y + fw); ctx.lineTo(x + w * 0.8, y + fw); ctx.lineTo(x + fw + w * 0.2, y + h - fw); ctx.fill();
  if (o.sill) { ctx.fillStyle = o.sill; ctx.fillRect(x - 5, y + h, w + 10, 7); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 5, y + h + 7, w + 10, 3);
    const dg = ctx.createLinearGradient(0, y + h + 10, 0, y + h + 46); dg.addColorStop(0, 'rgba(50,40,30,0.20)'); dg.addColorStop(1, 'rgba(50,40,30,0)'); ctx.fillStyle = dg; ctx.fillRect(x + 2, y + h + 10, w - 4, 36); }
  if (o.ac && ((x * 31 + y * 17) % 3) === 0) { const ax = x + w * 0.6, ay = y + h + 12; ctx.fillStyle = '#d8d9d6'; ctx.fillRect(ax, ay, 34, 22); ctx.fillStyle = '#9a9c9a'; ctx.fillRect(ax + 4, ay + 5, 18, 12); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(ax, ay + 22, 34, 3); }
  if (o.arch) { ctx.fillStyle = o.sill || '#e8e2d2'; ctx.fillRect(x - 8, y - 12, w + 16, 12); }
}
function bricks(ctx, w, h, base, bw, bh, seed, vary = 28, mortar = 'rgba(210,205,195,0.9)') {
  const r = rng(seed); ctx.fillStyle = mortar; ctx.fillRect(0, 0, w, h);
  const col = base.match(/\d+/g).map(Number);
  for (let y = 0, row = 0; y < h; y += bh, row++) {
    for (let x = -(row % 2) * bw / 2; x < w; x += bw) {
      const v = (r() - 0.5) * vary;
      ctx.fillStyle = `rgb(${col[0] + v | 0},${col[1] + v * 0.8 | 0},${col[2] + v * 0.7 | 0})`;
      ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    }
  }
}

const FACADES = {
  // 0: yellow brick, ornate (old Kyiv)
  0() { const [c, x] = mk(512, 256); bricks(x, 512, 256, 'rgb(212,184,128)', 22, 8, 11, 20, 'rgba(225,215,190,0.85)');
    x.fillStyle = 'rgba(240,232,214,0.95)'; x.fillRect(0, 0, 512, 14); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 14, 512, 4);
    for (const cx of [128, 384]) win(x, cx - 38, 40, 76, 150, { frame: '#f4f0e4', sill: '#efe9d8', arch: true, surround: '#e9dfc4', sw: 8 });
    x.fillStyle = '#d9cba8'; for (const cx of [128, 384]) { x.beginPath(); x.moveTo(cx - 9, 24); x.lineTo(cx + 9, 24); x.lineTo(cx + 6, 40); x.lineTo(cx - 6, 40); x.fill(); } x.fillStyle = 'rgba(120,95,60,0.35)'; for (let i = 4; i < 512; i += 12) x.fillRect(i, 18, 6, 7);
    x.fillStyle = '#e9dfc4'; x.fillRect(0, 248, 512, 8); streaks(x, 512, 256, 3); grain(x, 512, 256, 14, 5); return c; },
  // 1: red brick
  1() { const [c, x] = mk(512, 256); bricks(x, 512, 256, 'rgb(158,78,58)', 22, 8, 21, 44);
    for (const cx of [128, 384]) win(x, cx - 46, 56, 92, 120, { frame: '#efece4', sill: '#cfc9bc', ac: true });
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 250, 512, 6); streaks(x, 512, 256, 4); grain(x, 512, 256, 12, 7); return c; },
  // 2: Soviet panel
  2() { const [c, x] = mk(512, 256); x.fillStyle = '#c4c0b4'; x.fillRect(0, 0, 512, 256);
    x.fillStyle = 'rgba(80,80,75,0.55)'; x.fillRect(0, 252, 512, 4); x.fillRect(0, 0, 3, 256); x.fillRect(255, 0, 3, 256);
    x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, 0, 512, 6);
    win(x, 66, 70, 124, 112, { frame: '#e9e6dc', sill: '#aaa69a', ac: true });
    // loggia
    x.fillStyle = '#6c6a63'; x.fillRect(310, 52, 148, 160); x.fillStyle = '#8f98a0'; x.fillRect(322, 64, 124, 80);
    emRect(322, 64, 124, 80); x.fillStyle = '#d9d6cc'; x.fillRect(310, 150, 148, 62); x.fillStyle = '#9a978d'; for (let i = 0; i < 12; i++) x.fillRect(316 + i * 12, 154, 3, 50);
    x.fillStyle = '#d9d6cc'; x.fillRect(310, 144, 148, 8);
    streaks(x, 512, 256, 5, 22, 'rgba(60,55,45,0.13)'); grain(x, 512, 256, 18, 9); return c; },
  // 3: Stalin-era plaster (warm cream / ochre) with architraves
  3() { const [c, x] = mk(512, 256); x.fillStyle = '#e2cf9f'; x.fillRect(0, 0, 512, 256);
    x.fillStyle = 'rgba(255,255,240,0.5)'; x.fillRect(0, 0, 512, 10); x.fillStyle = 'rgba(120,90,50,0.22)'; x.fillRect(0, 10, 512, 5);
    for (const cx of [128, 384]) win(x, cx - 40, 42, 80, 152, { frame: '#f6f3ea', surround: '#f2e8cf', sw: 12, sill: '#f6f0dc', arch: true });
    x.fillStyle = 'rgba(255,250,235,0.55)'; for (const px of [0, 250]) x.fillRect(px, 15, 12, 241); x.fillStyle = 'rgba(100,80,50,0.25)'; for (const px of [12, 262]) x.fillRect(px, 15, 3, 241);
    streaks(x, 512, 256, 6, 16, 'rgba(70,50,20,0.12)'); grain(x, 512, 256, 16, 13); return c; },
  // 4: modern glass curtain wall
  4() { const [c, x] = mk(512, 256);
    const g = x.createLinearGradient(0, 0, 512, 256); g.addColorStop(0, '#9fc1d8'); g.addColorStop(0.5, '#4f7690'); g.addColorStop(1, '#2d4458');
    x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#2c3640'; x.fillRect(0, 0, 512, 30); x.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 128 + 20, 256); x.lineTo(i * 128 + 90, 30); x.lineTo(i * 128 + 110, 30); x.lineTo(i * 128 + 44, 256); x.fill(); }
    x.fillStyle = '#c9ced1'; for (let i = 0; i <= 4; i++) x.fillRect(i * 128 - 2, 0, 4, 256); x.fillRect(0, 28, 512, 4);
    emRect(0, 34, 512, 220); for (let i = 0; i <= 4; i++) emClear(i * 128 - 2, 0, 4, 256);
    grain(x, 512, 256, 8, 15); return c; },
  // 5: concrete / ribbon windows
  5() { const [c, x] = mk(512, 256); x.fillStyle = '#b9b7b0'; x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#3d4a56'; x.fillRect(0, 62, 512, 112); const g = x.createLinearGradient(0, 62, 512, 174);
    g.addColorStop(0, 'rgba(160,190,210,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 62, 512, 112);
    emRect(0, 64, 512, 108); for (let i = 0; i <= 4; i++) emClear(i * 128 - 3, 62, 6, 112);
    x.fillStyle = '#e4e2dc'; for (let i = 0; i <= 4; i++) x.fillRect(i * 128 - 3, 62, 6, 112); x.fillRect(0, 58, 512, 6); x.fillRect(0, 172, 512, 6);
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 252, 512, 4); streaks(x, 512, 256, 8, 20, 'rgba(50,50,50,0.12)'); grain(x, 512, 256, 20, 17); return c; },
  // 6: industrial cladding
  6() { const [c, x] = mk(512, 256); x.fillStyle = '#b3b6b2'; x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 128; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; x.fillRect(i * 4, 0, 4, 256); }
    x.fillStyle = '#4d5a63'; for (const cx of [80, 280, 440]) { x.fillRect(cx, 170, 70, 36); emRect(cx, 170, 70, 36); }
    x.fillStyle = '#d7d9d4'; x.fillRect(0, 0, 512, 10); x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(0, 250, 512, 6);
    streaks(x, 512, 256, 9, 20, 'rgba(60,50,40,0.18)'); grain(x, 512, 256, 18, 19); return c; },
  // 7: low-rise pastel plaster
  7() { const pal = ['#e7dcc2', '#e8d9a2', '#d8e0c8', '#e6cfc4', '#d9e1e8']; const [c, x] = mk(512, 256); x.fillStyle = pal[(Math.random() * 0) | 0]; x.fillRect(0, 0, 512, 256);
    for (const cx of [128, 384]) { win(x, cx - 38, 62, 76, 100, { frame: '#faf7f0', sill: '#ddd6c6', ac: true }); x.fillStyle = '#6e8f6a'; x.fillRect(cx - 38 - 22, 62, 18, 100); x.fillRect(cx + 38 + 4, 62, 18, 100); }
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 250, 512, 6); streaks(x, 512, 256, 10, 14, 'rgba(60,50,30,0.12)'); grain(x, 512, 256, 14, 23); return c; },
  // 8: shop front (ground floor)
  8() { const [c, x] = mk(512, 256); x.fillStyle = '#4a4a4c'; x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#d8d2c4'; x.fillRect(0, 0, 512, 52); x.fillStyle = '#2a3a48'; x.fillRect(16, 10, 480, 32); emRect(16, 10, 480, 32, 1);
    x.fillStyle = '#f0ece0'; x.font = 'bold 22px sans-serif'; x.fillText('МАГАЗИН · КАФЕ', 150, 33);
    for (let i = 0; i < 2; i++) { const px = 12 + i * 250; const g = x.createLinearGradient(px, 70, px + 236, 240); g.addColorStop(0, '#a6c4d6'); g.addColorStop(0.5, '#53697a'); g.addColorStop(1, '#2d3b47');
      x.fillStyle = g; x.fillRect(px, 70, 236, 170); emRect(px + 4, 78, 228, 150, 1); x.fillStyle = '#26282b'; x.fillRect(px, 70, 236, 6); x.fillRect(px + 116, 70, 6, 170); emClear(px + 114, 70, 10, 170); x.fillRect(px, 234, 236, 8); }
    x.fillStyle = 'rgba(255,230,160,0.18)'; x.fillRect(20, 150, 220, 80);
    grain(x, 512, 256, 14, 29); return c; },
  // 9: stone plinth w/ small windows (ground floor)
  9() { const [c, x] = mk(512, 256); x.fillStyle = '#9b9488'; x.fillRect(0, 0, 512, 256);
    x.strokeStyle = 'rgba(40,36,30,0.45)'; x.lineWidth = 2; for (let y = 0; y < 256; y += 42) { x.beginPath(); x.moveTo(0, y); x.lineTo(512, y); x.stroke(); }
    for (let y = 0, r = 0; y < 256; y += 42, r++) for (let xx = (r % 2) * 40; xx < 512; xx += 80) { x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + 42); x.stroke(); }
    for (const cx of [128, 384]) win(x, cx - 40, 70, 80, 110, { frame: '#3a2f28', g0: '#6d7f8c', sill: '#c9c2b2' });
    grain(x, 512, 256, 26, 31); return c; },
};
export const FACADE_PROPS = [
  { roughness: 0.85, metalness: 0.0 }, { roughness: 0.9, metalness: 0.0 }, { roughness: 0.9, metalness: 0.0 }, { roughness: 0.88, metalness: 0.0 },
  { roughness: 0.25, metalness: 0.35 }, { roughness: 0.8, metalness: 0.05 }, { roughness: 0.6, metalness: 0.25 }, { roughness: 0.9, metalness: 0.0 },
  { roughness: 0.55, metalness: 0.1 }, { roughness: 0.85, metalness: 0.0 }];

export function makeFacadeTextures() {
  return Object.keys(FACADES).map(k => {
    const [mc, mx] = mk(512, 256); mx.fillStyle = '#000'; mx.fillRect(0, 0, 512, 256); EM = mx;
    const t = tex(FACADES[k]()); EM = null;
    const m = tex(mc, { srgb: false, aniso: 4 }); t.userData.winMask = m; return t;
  });
}

export function makeRoofTextures() {
  // 0: flat bitumen/gravel roof, 1: pitched metal sheet / tiles (tinted by vertex colour)
  let [c, x] = mk(256, 256); x.fillStyle = '#6f706c'; x.fillRect(0, 0, 256, 256); grain(x, 256, 256, 40, 41);
  const r = rng(5); for (let i = 0; i < 10; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},0.07)`; x.fillRect(r() * 200, r() * 200, 20 + r() * 60, 20 + r() * 60); }
  const flat = tex(c);
  [c, x] = mk(256, 256); x.fillStyle = '#b9b9b9'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)'; x.fillRect(i * 16, 0, 16, 256); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(i * 16, 0, 2, 256); }
  grain(x, 256, 256, 22, 43);
  return [flat, tex(c)];
}

export function makeGroundTextures() {
  const out = {};
  let [c, x] = mk(256, 256); x.fillStyle = '#5b7f3a'; x.fillRect(0, 0, 256, 256);
  const r = rng(7);
  for (let i = 0; i < 2600; i++) { const g = 70 + r() * 80; x.strokeStyle = `rgba(${40 + r() * 50},${g},${25 + r() * 30},0.5)`; x.lineWidth = 1; const px = r() * 256, py = r() * 256; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 4, py - 3 - r() * 5); x.stroke(); }
  grain(x, 256, 256, 22, 3, false); out.grass = tex(c);
  [c, x] = mk(256, 256); x.fillStyle = '#4a4630'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${60 + r() * 60},${50 + r() * 40},${20 + r() * 20},0.55)`; x.beginPath(); x.ellipse(r() * 256, r() * 256, 1 + r() * 4, 1 + r() * 2.5, r() * 3, 0, 7); x.fill(); }
  grain(x, 256, 256, 24, 4, false); out.forest = tex(c);
  [c, x] = mk(256, 256); x.fillStyle = '#9a9890'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(40,40,38,0.4)'; x.lineWidth = 2; for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  for (let i = 0; i < 16; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},0.06)`; x.fillRect((i % 4) * 64, ((i / 4) | 0) * 64, 64, 64); }
  grain(x, 256, 256, 26, 5); out.pave = tex(c);
  [c, x] = mk(256, 256); x.fillStyle = '#8a7a5c'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) { x.fillStyle = `rgba(${90 + r() * 80},${80 + r() * 60},${50 + r() * 40},0.5)`; x.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); }
  grain(x, 256, 256, 30, 6, false); out.dirt = tex(c);
  return out;
}

// Road textures: u across the road (0..1), v along (one repeat = 9 m).
const roadCache = {};
export function roadTexture(kind) {
  if (roadCache[kind]) return roadCache[kind];
  const W = 256, H = 512; const [c, x] = mk(W, H); const r = rng(77);
  const asphalt = () => { x.fillStyle = '#3a3b3e'; x.fillRect(0, 0, W, H); grain(x, W, H, 34, 51);
    for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; x.fillRect(r() * W, r() * H, 2 + r() * 12, 1 + r() * 3); }
    // darker tyre tracks
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(W * 0.18, 0, W * 0.1, H); x.fillRect(W * 0.72, 0, W * 0.1, H); };
  if (kind === 'plain') { asphalt(); }
  else if (kind.startsWith('a')) {
    const n = +kind.slice(1); asphalt();
    x.fillStyle = 'rgba(235,235,230,0.9)'; x.fillRect(W * 0.03, 0, 5, H); x.fillRect(W * 0.97 - 5, 0, 5, H);
    for (let k = 1; k < n; k++) {
      const px = W * k / n;
      if (n % 2 === 0 && k === n / 2) { x.fillStyle = 'rgba(240,240,235,0.92)'; x.fillRect(px - 5, 0, 3.5, H); x.fillRect(px + 2, 0, 3.5, H); }
      else { x.fillStyle = 'rgba(240,240,235,0.9)'; x.fillRect(px - 2, H * 0.05, 4, H * 0.33); x.fillRect(px - 2, H * 0.55, 4, H * 0.33); }
    }
  } else if (kind === 'path') {  // footway: paving
    x.fillStyle = '#a79f92'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(60,55,45,0.45)'; x.lineWidth = 2;
    for (let yy = 0; yy < H; yy += 32) { x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); for (let xx = ((yy / 32) % 2) * 32; xx < W; xx += 64) { x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx, yy + 32); x.stroke(); } }
    for (let i = 0; i < 80; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},0.07)`; x.fillRect(r() * W, r() * H, 32, 32); }
    grain(x, W, H, 24, 52);
  } else if (kind === 'side') {  // sidewalk slabs
    x.fillStyle = '#b4b0a6'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(60,60,55,0.4)'; x.lineWidth = 2;
    for (let yy = 0; yy < H; yy += 64) { x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
    for (let xx = 0; xx < W; xx += 64) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, H); x.stroke(); }
    x.fillStyle = 'rgba(40,40,40,0.35)'; x.fillRect(0, 0, 6, H); x.fillRect(W - 6, 0, 6, H);
    grain(x, W, H, 26, 53);
  } else if (kind === 'rail') {  // ballast + sleepers + rails
    x.fillStyle = '#6d6a64'; x.fillRect(0, 0, W, H); grain(x, W, H, 60, 54);
    for (let yy = 0; yy < H; yy += 64) { x.fillStyle = '#4a3f35'; x.fillRect(W * 0.12, yy + 20, W * 0.76, 22); }
    x.fillStyle = '#9fa3a6'; x.fillRect(W * 0.3 - 4, 0, 7, H); x.fillRect(W * 0.7 - 3, 0, 7, H);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(W * 0.3 + 3, 0, 4, H); x.fillRect(W * 0.7 + 4, 0, 4, H);
  } else if (kind === 'tram') {
    x.fillStyle = '#55564f'; x.fillRect(0, 0, W, H); grain(x, W, H, 40, 55);
    x.fillStyle = '#a5a7a6'; x.fillRect(W * 0.28 - 4, 0, 7, H); x.fillRect(W * 0.72 - 3, 0, 7, H);
  } else if (kind === 'concrete') {
    x.fillStyle = '#9d9b94'; x.fillRect(0, 0, W, H); grain(x, W, H, 36, 56); streaks(x, W, H, 12, 10, 'rgba(40,40,30,0.18)');
  }
  const t = tex(c, { aniso: 8 }); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  if (kind === 'concrete') t.wrapS = THREE.RepeatWrapping;
  return roadCache[kind] = t;
}

export function waterNormal() {
  const S = 256, [c, x] = mk(S, S); const id = x.createImageData(S, S); const d = id.data;
  const f = []; const r = rng(99);
  for (let k = 0; k < 6; k++) f.push([1 + (r() * 4 | 0), 1 + (r() * 4 | 0), r() * 6.28, r() * 6.28, 0.4 + r() * 0.6]);
  const h = (u, v) => { let s = 0; for (const [a, b, p, q, A] of f) s += A * Math.sin(6.2832 * (a * u + b * v) + p) * Math.cos(6.2832 * (b * u - a * v) + q); return s; };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const e = 1 / S, u = i / S, v = j / S;
    const dx = (h(u + e, v) - h(u - e, v)) * 3, dy = (h(u, v + e) - h(u, v - e)) * 3;
    const n = [-dx, -dy, 1], l = Math.hypot(...n); const o = (j * S + i) * 4;
    d[o] = (n[0] / l * 0.5 + 0.5) * 255; d[o + 1] = (n[1] / l * 0.5 + 0.5) * 255; d[o + 2] = (n[2] / l * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  const t = tex(c, { srgb: false }); return t;
}

// ---------------------------------------------------------------- interior atlas (4x4 cells of 256 px) and door texture
export const INT_RECT = {};   // name -> [u0, v0, du, dv]
export function makeInteriorAtlas() {
  // 1024 x 1664: rows 0-3 procedural 256 px cells; y 1024..1152 brand paints (8 x 128, design pack); y 1152..1662 reference pictures (4 x 3 of 256x170)
  const S = 1024, C = 256, H = 1664, [c, x] = mk(S, H); const r = rng(123);
  const cell = (name, col, row, fn) => { x.save(); x.translate(col * C, row * C); x.beginPath(); x.rect(0, 0, C, C); x.clip(); fn(); x.restore(); INT_RECT[name] = [col / 4, 1 - (row + 1) * C / H, 0.25, C / H]; };
  const noise = (a, seed) => { const id = x.getImageData(0, 0, S, S); void id; };
  cell('plaster', 0, 0, () => { x.fillStyle = '#e9e2d2'; x.fillRect(0, 0, C, C); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '90,70,40'},0.04)`; x.fillRect(r() * C, r() * C, 3 + r() * 14, 3 + r() * 14); }
    x.fillStyle = '#8c7b66'; x.fillRect(0, C - 20, C, 20); x.fillStyle = '#b3a38b'; x.fillRect(0, C - 24, C, 4); x.fillStyle = '#f5f1e6'; x.fillRect(0, 0, C, 8); });
  cell('window', 1, 0, () => { x.fillStyle = '#e9e2d2'; x.fillRect(0, 0, C, C); x.fillStyle = '#8c7b66'; x.fillRect(0, C - 20, C, 20); x.fillStyle = '#b3a38b'; x.fillRect(0, C - 24, C, 4); x.fillStyle = '#f5f1e6'; x.fillRect(0, 0, C, 8);
    const wx = 70, wy = 62, ww = 116, wh = 128; x.fillStyle = '#fbfbf6'; x.fillRect(wx - 8, wy - 8, ww + 16, wh + 16);
    const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#d6ecff'); g.addColorStop(1, '#a9d0f2'); x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
    x.fillStyle = '#fbfbf6'; x.fillRect(wx + ww / 2 - 3, wy, 6, wh); x.fillRect(wx, wy + wh * .38, ww, 6); x.fillStyle = '#d9d2c0'; x.fillRect(wx - 14, wy + wh + 8, ww + 28, 9); });
  cell('parquet', 2, 0, () => { x.fillStyle = '#9a6b3f'; x.fillRect(0, 0, C, C); for (let yy = 0; yy < C; yy += 32) for (let xx = (yy / 32 % 2) * 32; xx < C + 64; xx += 64) { const v = (r() - .5) * 28; x.fillStyle = `rgb(${154 + v | 0},${107 + v * .8 | 0},${63 + v * .6 | 0})`; x.fillRect(xx - 64 + 1, yy + 1, 62, 30); } });
  cell('tiles', 3, 0, () => { for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) { x.fillStyle = (xx + yy) % 2 ? '#cfcac0' : '#a9a69e'; x.fillRect(xx * 64 + 1, yy * 64 + 1, 62, 62); } });
  cell('carpet', 0, 1, () => { x.fillStyle = '#6b5a77'; x.fillRect(0, 0, C, C); for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},0.07)`; x.fillRect(r() * C, r() * C, 2, 2); } });
  cell('ceiling', 1, 1, () => { x.fillStyle = '#f2efe8'; x.fillRect(0, 0, C, C); x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 2; x.strokeRect(1, 1, C - 2, C - 2);
    x.fillStyle = '#ffffff'; x.fillRect(64, 88, 128, 80); x.fillStyle = '#fffbe0'; x.fillRect(72, 96, 112, 64); });
  cell('wood', 2, 1, () => { x.fillStyle = '#a07344'; x.fillRect(0, 0, C, C); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(60,35,10,${0.06 + r() * 0.1})`; x.fillRect(0, r() * C, C, 1 + r() * 2); } });
  cell('dark', 3, 1, () => { x.fillStyle = '#4a382a'; x.fillRect(0, 0, C, C); for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.1})`; x.fillRect(0, r() * C, C, 1 + r() * 2); } });

  cell('wallpaper', 0, 2, () => { x.fillStyle = '#ddd6c8'; x.fillRect(0, 0, C, C); for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(i * 32 + 6, 0, 10, C); x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(i * 32 + 22, 0, 4, C); }
    x.fillStyle = '#8c7b66'; x.fillRect(0, C - 20, C, 20); x.fillStyle = '#b3a38b'; x.fillRect(0, C - 24, C, 4); });
  cell('walltile', 1, 2, () => { x.fillStyle = '#f2f4f4'; x.fillRect(0, 0, C, C); x.fillStyle = 'rgba(70,90,100,0.35)'; for (let i = 0; i <= 8; i++) { x.fillRect(i * 32 - 1, 0, 2, C); x.fillRect(0, i * 32 - 1, C, 2); }
    x.fillStyle = '#7fb4c4'; x.fillRect(0, 96, C, 22); x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(0, 96, C, 4); });
  cell('checker', 2, 2, () => { for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) { x.fillStyle = (xx + yy) % 2 ? '#f0efe9' : '#2d2f33'; x.fillRect(xx * 64, yy * 64, 64, 64); } });
  cell('stone', 3, 2, () => { x.fillStyle = '#9d9a92'; x.fillRect(0, 0, C, C); for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) { const v = (r() - .5) * 26; x.fillStyle = `rgb(${157 + v | 0},${154 + v | 0},${146 + v | 0})`; x.fillRect(xx * 64 + 2, yy * 64 + 2, 60, 60); } });
  cell('offcarpet', 0, 3, () => { x.fillStyle = '#5c6670'; x.fillRect(0, 0, C, C); for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},0.06)`; x.fillRect(r() * C, r() * C, 2, 2); } x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 0, C, 2); x.fillRect(0, 0, 2, C); });
  cell('plank', 1, 3, () => { x.fillStyle = '#4b3022'; x.fillRect(0, 0, C, C); for (let i = 0; i < 6; i++) { const v = (r() - .5) * 20; x.fillStyle = `rgb(${86 + v | 0},${56 + v | 0},${38 + v | 0})`; x.fillRect(0, i * 42 + 1, C, 40); x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(r() * C, i * 42, 2, 42); } });
  cell('ktile', 2, 3, () => { for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) { x.fillStyle = (xx + yy) % 2 ? '#c9774f' : '#b86a44'; x.fillRect(xx * 64 + 2, yy * 64 + 2, 60, 60); } x.fillStyle = '#8a7a68'; });
  cell('brick', 3, 3, () => { x.fillStyle = '#c8bfae'; x.fillRect(0, 0, C, C); for (let yy = 0; yy < 12; yy++) for (let xx = -1; xx < 6; xx++) { const v = (r() - .5) * 34; x.fillStyle = `rgb(${150 + v | 0},${74 + v * .6 | 0},${54 + v * .5 | 0})`; x.fillRect(xx * 44 + (yy % 2) * 22 + 1, yy * 21 + 1, 42, 19); } });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 1;
  // design pack cells: flat fallback colours first, replaced by the compressed pack sheets when they arrive
  const BR = [['bMcdR', '#da291c'], ['bMcdY', '#ffc72c'], ['bPuz', '#3e6e3e'], ['bSilG', '#008c46'], ['bSilO', '#f27820'], ['bEpiY', '#f4c418'], ['bEpiG', '#006e37'], ['bWhite', '#f5f5f5']];
  BR.forEach(([n, col], i) => { x.fillStyle = col; x.fillRect(i * 128, 1024, 128, 128); INT_RECT[n] = [i * 128 / S, 1 - 1152 / H, 128 / S, 128 / H]; });
  const PO = ['pMcdE', 'pMcdI', 'pPuzE', 'pPuzI', 'pSilE', 'pSilI', 'pEpiE', 'pEpiI', 'pOffE', 'pOffI', 'pWarE', 'pStaI'], pc = ['#7a3a30', '#8a5a40', '#2f5a35', '#7a5a3a', '#2d6a4a', '#4a6a5a', '#8a8a30', '#6a6a50', '#5a6a7a', '#6a7280', '#707478', '#807d78'];
  PO.forEach((n, i) => { const px = (i % 4) * 256, py = 1152 + (i >> 2) * 170; x.fillStyle = pc[i]; x.fillRect(px, py, 256, 170); INT_RECT[n] = [px / S, 1 - (py + 170) / H, 256 / S, 170 / H]; });
  designImage('brand.jpg').then(im => { if (im) { x.drawImage(im, 0, 1024, 1024, 128); t.needsUpdate = true; } });
  designImage('posters.jpg').then(im => { if (im) { x.drawImage(im, 0, 1152, 1024, 510); t.needsUpdate = true; } });
  return t;
}
// door atlas: TL leaf, TR frame, BL sign
export const DOOR_RECT = { leaf: [0, 0.5, 0.5, 0.5], frame: [0.5, 0.5, 0.5, 0.5], sign: [0, 0, 0.5, 0.5] };
export function makeDoorTexture() {
  const [c, x] = mk(256, 256);
  // leaf (0..128, 0..128 canvas)
  x.fillStyle = '#5a3a24'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#6e4a2e'; for (const [a, b, w, h] of [[10, 8, 46, 52], [72, 8, 46, 52], [10, 70, 46, 50], [72, 70, 46, 50]]) { x.fillRect(a, b, w, h); x.strokeStyle = '#3a2414'; x.lineWidth = 2; x.strokeRect(a, b, w, h); }
  x.fillStyle = '#d8b24a'; x.beginPath(); x.arc(112, 68, 4, 0, 7); x.fill();
  // frame
  x.fillStyle = '#d9d2c2'; x.fillRect(128, 0, 128, 128);
  // sign
  x.fillStyle = '#1d5e3a'; x.fillRect(0, 128, 128, 128); x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.strokeRect(6, 134, 116, 116);
  x.fillStyle = '#ffffff'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('ВХОД', 64, 202);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------------------------------------------------------- procedural PBR maps (normal + roughness) derived from the albedo canvas
// Heights come from luminance (grout / frames / window recesses become relief); roughness: darker = glossier (glass, wet asphalt).
export function pbrMaps(src, { strength = 2.0, rLo = 0.45, rHi = 1.0, maxSize = 512, glossDark = true } = {}) {
  const img = src.image || src; const w0 = img.width, h0 = img.height, k = Math.min(1, maxSize / Math.max(w0, h0)), w = Math.max(8, Math.round(w0 * k)), h = Math.max(8, Math.round(h0 * k));
  const [c, x] = mk(w, h); x.drawImage(img, 0, 0, w, h); const id = x.getImageData(0, 0, w, h), d = id.data;
  const L = new Float32Array(w * h); for (let i = 0; i < w * h; i++) L[i] = (0.3 * d[4 * i] + 0.59 * d[4 * i + 1] + 0.11 * d[4 * i + 2]) / 255;
  const [cn, xn] = mk(w, h), [cr, xr] = mk(w, h), on = xn.createImageData(w, h), or_ = xr.createImageData(w, h);
  const at = (i, j) => L[((j + h) % h) * w + ((i + w) % w)];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (at(i + 1, j - 1) + 2 * at(i + 1, j) + at(i + 1, j + 1)) - (at(i - 1, j - 1) + 2 * at(i - 1, j) + at(i - 1, j + 1));
    const dy = (at(i - 1, j + 1) + 2 * at(i, j + 1) + at(i + 1, j + 1)) - (at(i - 1, j - 1) + 2 * at(i, j - 1) + at(i + 1, j - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const o = 4 * (j * w + i); on.data[o] = (nx * 0.5 + 0.5) * 255; on.data[o + 1] = (ny * 0.5 + 0.5) * 255; on.data[o + 2] = (nz * 0.5 + 0.5) * 255; on.data[o + 3] = 255;
    const lum = L[j * w + i], rr = glossDark ? rLo + (rHi - rLo) * Math.min(1, lum * 1.6) : rLo + (rHi - rLo) * (1 - lum * 0.5);
    or_.data[o] = 255; or_.data[o + 1] = rr * 255; or_.data[o + 2] = 0; or_.data[o + 3] = 255;
  }
  xn.putImageData(on, 0, 0); xr.putImageData(or_, 0, 0);
  const mkT = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = src.wrapS || THREE.RepeatWrapping; t.wrapT = src.wrapT || THREE.RepeatWrapping; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  return { normalMap: mkT(cn), roughnessMap: mkT(cr) };
}
