import { City } from './city.js';
import { PoiLayer } from './pois.js';
import { Game } from './game.js';
import { Crime } from './crime.js';
import { Transit } from './transit.js';
import { UI } from './ui.js';
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { World } from './world.js';

const $ = id => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const LAT0 = 50.4501, LON0 = 30.5234, R = 6371008.8;
const KX = Math.PI / 180 * R * Math.cos(LAT0 * Math.PI / 180), KY = Math.PI / 180 * R;
const ll2xz = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KY];
const xz2ll = (x, z) => [LAT0 - z / KY, LON0 + x / KX];

// start / respawn point: square in front of the main entrance of Kyiv-Pasazhyrskyi central railway station (50.4411N 30.4891E), facing the building
const START = { x: -2363.5, z: 1036.3, yaw: 131 };
// debug spawn: ?lat=..&lon=.. or ?at=palladina11|troieshchyna|darnytsia|... (explicit x/z still win)
const AT = { palladina11: [50.4620881, 30.3526914], troieshchyna: [50.5137, 30.6065], darnytsia: [50.4558, 30.6129], pozniaky: [50.3971, 30.6339], obolon: [50.5033, 30.4985], sizo: [50.4608, 30.4795] };
const ATLL = qs.has('lat') ? [parseFloat(qs.get('lat')), parseFloat(qs.get('lon'))] : (AT[qs.get('at')] || null);
const ATXZ = ATLL ? ll2xz(ATLL[0], ATLL[1]) : null;
const SPX = parseFloat(qs.get('x') ?? (ATXZ ? ATXZ[0] : START.x)), SPZ = parseFloat(qs.get('z') ?? (ATXZ ? ATXZ[1] : START.z));   // yaw in degrees, 0 = north
const lmXZ = l => l[3] !== undefined ? [l[3], l[4]] : ll2xz(l[1], l[2]);
const LANDMARKS = [
  ['Ж/д вокзал Киев-Пассажирский (старт)', 50.4411, 30.4891, START.x, START.z],
  ['Майдан Незалежности', 50.4501, 30.5234], ['Софийский собор', 50.4529, 30.5144], ['Золотые ворота', 50.4489, 30.5139],
  ['Михайловский Златоверхий', 50.4547, 30.5189], ['Мариинский дворец', 50.4474, 30.5365], ['Владимирская горка', 50.4573, 30.5283],
  ['Андреевский спуск (верх)', 50.4590, 30.5170], ['Киево-Печерская лавра', 50.4347, 30.5576], ['Бессарабка', 50.4440, 30.5222],
  // районы города (центры жилых массивов)
  ['Подол (Контрактовая пл.)', 50.4659, 30.5161], ['Оболонь', 50.5010, 30.4980], ['Троещина', 50.5160, 30.6020], ['Дарница', 50.4325, 30.6330],
  ['Позняки', 50.3975, 30.6340], ['Левобережная', 50.4520, 30.5980], ['Святошино', 50.4540, 30.3680], ['Борщаговка', 50.4310, 30.3750],
  ['Голосеево (ВДНХ)', 50.3790, 30.4780], ['Теремки', 50.3560, 30.4650], ['Лесной массив', 50.4950, 30.6450], ['Пуща-Водица', 50.5330, 30.3600],
];

const IS_TOUCH = (qs.get('touch') === '1') || (qs.get('touch') !== '0' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches);
if (IS_TOUCH) document.body.classList.add('touch');
const MOB = IS_TOUCH;   // mobile performance profile
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', e => { if (IS_TOUCH && e.target.closest && !e.target.closest('#big, #places')) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());

async function main() {
  const BASE = (qs.get('tiles') || 'tiles').replace(/\/?$/, '/');
  const manifest = await (await fetch(BASE + 'manifest.json')).json();
  const canvas = $('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: qs.get('aa') !== '0', powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('shot') });
  // adaptive quality governor: level 3 = best (iPhone 16: pixel ratio 2, MSAA, soft shadows, full detail); drops a level when fps < ~40
  const GOV = !qs.has('shot') && qs.get('gov') !== '0';
  const PRL = MOB ? [1.0, 1.25, 1.5, 2.0] : [1.0, 1.15, 1.3, 1.5], DETAILR = MOB ? [0, 200, 320, 450] : [150, 300, 450, 600], ACTR = [35, 45, 55, 60];
  const MAXPR = parseFloat(qs.get('pr') || '0');
  let qLevel = qs.has('q') ? Math.max(0, Math.min(3, parseInt(qs.get('q')))) : 3;
  const prFor = l => Math.min(window.devicePixelRatio, MAXPR || PRL[l]);
  renderer.setPixelRatio(prFor(qLevel));
  renderer.setSize(innerWidth, innerHeight, false);
  const manualShadow0 = qs.has('shadow'), shadows = manualShadow0 ? qs.get('shadow') !== '0' : qLevel >= 2;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.68;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(MOB ? 75 : 72, innerWidth / innerHeight, 0.3, MOB ? 3000 : 6000);
  camera.rotation.order = 'YXZ'; scene.add(camera);

  // ---- sky / sun / fog
  const sky = new Sky(); sky.scale.setScalar(4500); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 3.4; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.003; su.mieDirectionalG.value = 0.86;
  const elev = parseFloat(qs.get('sun') || '38'), azim = parseFloat(qs.get('az') || '215');
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(azim));
  su.sunPosition.value.copy(sunDir);
  const fogCol = new THREE.Color(0xc4d7ea);
  scene.fog = new THREE.FogExp2(fogCol, parseFloat(qs.get('fog') || (MOB ? '0.0015' : '0.00095')));
  { const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); const s2 = new Sky(); s2.scale.setScalar(1000); Object.keys(su).forEach(k => { s2.material.uniforms[k].value = su[k].value.clone ? su[k].value.clone() : su[k].value; }); es.add(s2);
    scene.environment = pm.fromScene(es, 0, 1, 2000).texture; scene.environmentIntensity = 0.6; pm.dispose(); }
  scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x77735e, 0.6));
  const sun = new THREE.DirectionalLight(0xffeccc, 3.3);
  const SMAP = 2048; sun.castShadow = shadows; sun.shadow.mapSize.set(SMAP, SMAP);
  let SC = MOB ? 75 : 120; Object.assign(sun.shadow.camera, { left: -SC, right: SC, top: SC, bottom: -SC, near: 1, far: 700 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35; sun.shadow.radius = 3.2;
  scene.add(sun, sun.target);

  const world = (() => { const loadR = parseFloat(qs.get('dist') || (MOB ? '1050' : '1500')); return new World(scene, manifest, { base: BASE, shadows: true, loadR, unloadR: loadR + (MOB ? 500 : 800), treeKeep: parseFloat(qs.get('trees') || (MOB ? '0.5' : '1')), lampKeep: MOB ? 0.5 : 1, detailR: DETAILR[qLevel], normalScale: MOB ? 1.0 : 1.0 }); })();
  const city = new City(world, scene, manifest, { mobile: MOB }); city.enabled = qs.get('city') !== '0'; city.setLevel(qLevel);

  // ---- player
  const P = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, fly: false, grounded: false, eye: 0, inWater: false, wl: null };
  const keys = {};
  const T = { jx: 0, jy: 0, jump: false, run: false, down: false };
  const teleport = (x, z, yaw, pitch) => { if (UI.jail && !UI.jailBypass) return; P.x = x; P.z = z; P.vx = P.vz = P.vy = 0; if (yaw !== undefined) P.yaw = yaw; if (pitch !== undefined) P.pitch = pitch;
    const gy = world.heightAt(x, z); P.y = Math.max(world.groundAt(x, z, gy + 300), gy) + (P.fly ? 1.7 : 3); P.eye = P.y + 1.7; P.px0 = x; P.pz0 = z;
    P.wait = !world.tiles.get(Math.floor(x / 500) + '_' + Math.floor(z / 500))?.h; };   // far teleport: hold the player until the tile under them has loaded
  let started = false, locked = false, spawned = false;
  const gotoDoor = (pl, dist = 5, yawOff = 0) => { const d = pl.door; P.fly = false; teleport(d.mx + d.nx * dist, d.mz + d.nz * dist, Math.atan2(d.nx, d.nz) + yawOff, 0); P.y = world.heightAt(P.x, P.z); P.eye = P.y + 1.7; world.interiors.forceBuild(P); return pl; };
  const spawn = () => {
    const sx = SPX, sz = SPZ;
    P.fly = qs.get('fly') === '1';
    teleport(sx, sz, THREE.MathUtils.degToRad(parseFloat(qs.get('yaw') ?? START.yaw)), THREE.MathUtils.degToRad(parseFloat(qs.get('pitch') ?? '0')));
    if (qs.has('h')) { P.y = parseFloat(qs.get('h')); P.eye = P.y + 1.7; }
    if (qs.has('door')) {   // debug: stand ~5 m in front of the nearest enterable building's door (door=1; &minlv=N to need N+ floors)
      const minlv = parseInt(qs.get('minlv') || '1'), plans = world.interiors.plans().filter(p => p.n >= minlv && p.tile.alive);
      let best = null, bd = 1e9; for (const p of plans) { const d = Math.hypot(p.door.mx - sx, p.door.mz - sz); if (d < bd) { bd = d; best = p; } }
      if (best) gotoDoor(best, 5);
    }
    spawned = true;
  };

  // ---- places / game layer
  const pois = new PoiLayer(world, scene, { P, IS_TOUCH, teleport: (x, z, yaw, pit) => teleport(x, z, yaw, pit), gotoDoor: (pl, d) => gotoDoor(pl, d), noTeleport: false,
    landmarks: LANDMARKS.map(l => ({ name: l[0], go: () => { const [x, z] = lmXZ(l); teleport(x, z); } })) });
  await pois.load(BASE);
  const game = new Game({ P, world, scene, pois, qs, IS_TOUCH, START, teleport: (x, z, yaw, pit) => teleport(x, z, yaw, pit), paintMap: (...a) => paintMap(...a) });
  const crime = new Crime({ P, world, scene, city, pois, game, qs, IS_TOUCH, canvas, keys, T, START, getLevel: () => qLevel, teleport: (x, z, yaw, pit) => teleport(x, z, yaw, pit), gotoDoor: (pl, d) => gotoDoor(pl, d) });
  const transit = new Transit(world, scene, { P, IS_TOUCH, qs, game, pois, keys, T, getLevel: () => qLevel, teleport: (x, z, yaw, pit) => teleport(x, z, yaw, pit), gotoDoor: (pl, d) => gotoDoor(pl, d) });
  try { await transit.load(BASE); } catch (e) { console.warn('transit load failed', e); } pois.transit = transit;
  UI.onModal = n => { if (!n && !IS_TOUCH && started && !game.dead) try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} };

  let manualShadow = manualShadow0;
  function setShadows(on) { if (sun.castShadow === on) return; sun.castShadow = on; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); $('bShade').classList.toggle('on', on); }
  function toggleShadows() { manualShadow = true; setShadows(!sun.castShadow); }
  const gov = { t: 0, n: 0, good: 0, lastChange: performance.now(), start: performance.now(), fps: 60 };
  function setLevel(l) {
    qLevel = Math.max(0, Math.min(3, l)); renderer.setPixelRatio(prFor(qLevel)); renderer.setSize(innerWidth, innerHeight, false);
    world.detailR = DETAILR[qLevel]; world.interiors.activateR = ACTR[qLevel]; world.interiors.disposeR = ACTR[qLevel] + 25;
    if (!manualShadow) setShadows(qLevel >= 2);
    city.setLevel(qLevel); transit.setLevel(qLevel); gov.lastChange = performance.now(); gov.good = 0;
  }
  function governor(raw) {
    if (!GOV || raw > 0.5 || !spawned) return; gov.t += raw; gov.n++;
    if (gov.t < 2.0) return; const f = gov.n / gov.t; gov.fps = f; gov.t = 0; gov.n = 0; const now = performance.now();
    if (now - gov.start < 8000 || world.loading.size > 1) return;
    if (f < 40 && qLevel > 0 && now - gov.lastChange > 2500) setLevel(qLevel - 1);
    else if (f >= 57) { if (++gov.good >= 5 && qLevel < 3 && now - gov.lastChange > 25000) setLevel(qLevel + 1); } else gov.good = 0;
  }
  // ---- input
  addEventListener('keydown', e => {
    if (e.repeat) return; keys[e.code] = true;
    if (e.code === 'KeyF') { P.fly = !P.fly; P.vy = 0; }
    if (e.code === 'KeyR') teleport(START.x, START.z, THREE.MathUtils.degToRad(START.yaw), 0);
    if (e.code === 'KeyH') $('help').style.display = $('help').style.display === 'none' ? '' : 'none';
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'KeyG') toggleShadows();
    if (e.code.startsWith('Digit') && !UI.modal) { const i = +e.code.slice(5) - 1; if (LANDMARKS[i]) { const [x, z] = lmXZ(LANDMARKS[i]); teleport(x, z); } }
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  document.addEventListener('pointerlockchange', () => { if (IS_TOUCH) return; locked = document.pointerLockElement === canvas; if (!locked && started && !UI.modal && !game.dead) $('overlay').style.display = 'flex', $('go').style.display = 'block', $('msg').textContent = 'Пауза'; });
  document.addEventListener('mousemove', e => {
    if (!locked) return;
    P.yaw -= e.movementX * 0.0022; P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch - e.movementY * 0.0022));
  });
  let drag = false;
  canvas.addEventListener('mousedown', () => { drag = true; }); addEventListener('mouseup', () => { drag = false; });
  addEventListener('mousemove', e => { if (drag && !locked) { P.yaw -= e.movementX * 0.004; P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch - e.movementY * 0.004)); } });
  $('overlay').addEventListener('click', () => {
    if (!spawned) return; started = true; $('overlay').style.display = 'none';
    if (!IS_TOUCH) try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
  });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

  // ---- minimap
  const mm = manifest.minimap, OV = mm.overview, ovimg = new Image(); ovimg.src = BASE + OV.file; let mmOK = false; ovimg.onload = () => { mmOK = true; };
  const mmSet = new Set(mm.blocks.map(b => b[0] + '_' + b[1])), blkImg = new Map();
  const getBlk = (bx, bz) => { const k = bx + '_' + bz; if (!mmSet.has(k)) return null; let o = blkImg.get(k); if (!o) { o = { img: new Image(), ok: false }; o.img.onload = () => { o.ok = true; }; o.img.src = BASE + mm.dir + `m_${k}.webp`; blkImg.set(k, o); } return o.ok ? o.img : null; };
  const mctx = $('minicv').getContext('2d');
  // draw the map: detailed 3 km block images where loaded, 16 m/px overview as fallback; k = px per metre, (cx,cz) = world point at canvas centre
  function paintMap(ctx, W, H, cx, cz, k, fine) {
    ctx.fillStyle = '#3a4049'; ctx.fillRect(0, 0, W, H);
    if (mmOK) ctx.drawImage(ovimg, 0, 0, ovimg.width, ovimg.height, W / 2 + (OV.x0 - cx) * k, H / 2 + (OV.z0 - cz) * k, ovimg.width * OV.mpp * k, ovimg.height * OV.mpp * k);
    if (!fine) return;
    const bs = mm.bs, x0 = cx - W / 2 / k, x1 = cx + W / 2 / k, z0 = cz - H / 2 / k, z1 = cz + H / 2 / k;
    for (let bx = Math.floor(x0 / bs); bx <= Math.floor(x1 / bs); bx++) for (let bz = Math.floor(z0 / bs); bz <= Math.floor(z1 / bs); bz++) {
      const im = getBlk(bx, bz); if (im) ctx.drawImage(im, W / 2 + (bx * bs - cx) * k, H / 2 + (bz * bs - cz) * k, bs * k, bs * k);
    }
  }
  function drawMini() {
    const W = 200; paintMap(mctx, W, W, P.x, P.z, W / 500, true); pois.drawMarkers(mctx, W, W, P.x, P.z, W / 500, false); transit.drawMarkers(mctx, W, W, P.x, P.z, W / 500, false);
    mctx.save(); mctx.translate(W / 2, W / 2); mctx.rotate(-P.yaw);   // arrow: yaw 0 = north (up)
    mctx.fillStyle = '#e33'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 2; mctx.beginPath(); mctx.moveTo(0, -9); mctx.lineTo(6, 7); mctx.lineTo(0, 3); mctx.lineTo(-6, 7); mctx.closePath(); mctx.fill(); mctx.stroke(); mctx.restore();
    mctx.fillStyle = '#000'; mctx.font = 'bold 11px sans-serif'; mctx.fillText('С', 94, 12);
  }
  let mapOpen = false; const bigcv = $('bigcv'), bctx = bigcv.getContext('2d');
  const BV = { cx: 0, cz: 0, k: 0.01, kmin: 0.004, w: 0, h: 0 };   // big map view: centre (world m), scale px/m
  function drawBig() {
    if (bigcv.width !== innerWidth || bigcv.height !== innerHeight) { bigcv.width = innerWidth; bigcv.height = innerHeight; }
    const W = bigcv.width, H = bigcv.height; BV.w = W; BV.h = H;
    BV.kmin = Math.min(W / (manifest.bounds[2] - manifest.bounds[0]), H / (manifest.bounds[3] - manifest.bounds[1])) * 0.95;
    BV.k = Math.max(BV.kmin, Math.min(BV.k, 0.6));
    paintMap(bctx, W, H, BV.cx, BV.cz, BV.k, BV.k > 0.03); pois.drawMarkers(bctx, W, H, BV.cx, BV.cz, BV.k, true); transit.drawMarkers(bctx, W, H, BV.cx, BV.cz, BV.k, true);
    const toS = (x, z) => [W / 2 + (x - BV.cx) * BV.k, H / 2 + (z - BV.cz) * BV.k];
    bctx.strokeStyle = 'rgba(255,255,255,.55)'; bctx.lineWidth = 1.5; bctx.beginPath(); manifest.city.forEach((p, i) => { const [sx, sy] = toS(p[0], p[1]); i ? bctx.lineTo(sx, sy) : bctx.moveTo(sx, sy); }); bctx.closePath(); bctx.stroke();
    bctx.font = '13px sans-serif'; LANDMARKS.forEach((l, i) => { const [x, z] = lmXZ(l), [sx, sy] = toS(x, z); bctx.fillStyle = '#c22'; bctx.beginPath(); bctx.arc(sx, sy, 4, 0, 7); bctx.fill(); bctx.lineWidth = 3; bctx.strokeStyle = 'rgba(255,255,255,.85)'; bctx.strokeText(l[0], sx + 7, sy + 4); bctx.fillStyle = '#012'; bctx.fillText(l[0], sx + 7, sy + 4); });
    const [px, py] = toS(P.x, P.z); bctx.fillStyle = '#06f'; bctx.strokeStyle = '#fff'; bctx.lineWidth = 2; bctx.beginPath(); bctx.arc(px, py, 6, 0, 7); bctx.fill(); bctx.stroke();
  }
  function toggleMap() { $('bClose').style.display = !mapOpen ? 'flex' : 'none'; mapOpen = !mapOpen; $('big').style.display = $('bigtip').style.display = mapOpen ? 'block' : 'none'; if (mapOpen) { BV.cx = P.x; BV.cz = P.z; BV.k = Math.max(BV.k, 0.04); $('bigtip').textContent = 'Карта: перетащить — сдвиг · щипок/колесо — масштаб · тап — телепорт · M / Esc — закрыть'; if (document.pointerLockElement) document.exitPointerLock(); drawBig(); } }
  { // big map: drag = pan, wheel / pinch = zoom, tap = teleport
    bigcv.style.touchAction = 'none'; const ptrs = new Map(); let moved = 0, pinch0 = 0, k0 = 0;
    const world2 = (sx, sy) => [BV.cx + (sx - BV.w / 2) / BV.k, BV.cz + (sy - BV.h / 2) / BV.k];
    bigcv.addEventListener('pointerdown', e => { bigcv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); k0 = BV.k; } });
    bigcv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return;
      if (ptrs.size === 1) { const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy); BV.cx -= dx / BV.k; BV.cz -= dy / BV.k; }
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; BV.k = k0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch0); moved += 20; }
      drawBig(); });
    const up = e => { const had = ptrs.has(e.pointerId); ptrs.delete(e.pointerId);
      if (had && ptrs.size === 0 && moved < 8 && e.type === 'pointerup') { const [x, z] = world2(e.clientX, e.clientY); if (world.manifestTiles.has(Math.floor(x / 500) + '_' + Math.floor(z / 500))) { teleport(x, z); toggleMap(); } else { $('bigtip').textContent = 'Здесь нет карты города — выберите точку внутри границы Киева'; } } };
    bigcv.addEventListener('pointerup', up); bigcv.addEventListener('pointercancel', up);
    bigcv.addEventListener('wheel', e => { e.preventDefault(); const [wx, wz] = world2(e.clientX, e.clientY); BV.k *= Math.exp(-e.deltaY * 0.0015); BV.k = Math.max(BV.kmin, Math.min(BV.k, 0.6)); BV.cx = wx - (e.clientX - BV.w / 2) / BV.k; BV.cz = wz - (e.clientY - BV.h / 2) / BV.k; drawBig(); }, { passive: false });
  }
  $('bClose').addEventListener('touchstart', e => { e.preventDefault(); if (mapOpen) toggleMap(); }, { passive: false }); $('bClose').addEventListener('click', () => { if (mapOpen) toggleMap(); });
  setupTouch();

  if (IS_TOUCH) $('gotxt').textContent = 'Коснитесь экрана, чтобы начать';
  $('help').innerHTML = `<b>WASD</b> — ходьба · <b>мышь</b> — взгляд · <b>Shift</b> — бег · <b>Пробел</b> — прыжок<br>
    <b>F</b> — полёт/ходьба (в полёте: Пробел вверх, Ctrl/C вниз, Shift — ускорение)<br>
    <b>1–9</b> — телепорт к местам · <b>M</b> — карта (клик = телепорт) · <b>R</b> — на вокзал (старт) · <b>G</b> — тени · <b>H</b> — скрыть подсказку<br>
    <b>E</b> — действие (купить / работа) · <b>I</b> — рюкзак · <b>T</b> — смартфон · <b>P</b> — места (магазины, работа, СИЗО)<br>
    <span style="opacity:.7">Esc — пауза</span>`;

  // ---- touch controls
  function setupTouch() {
    if (!IS_TOUCH) return;
    const joy = $('joy'), base = $('joybase'), knob = $('joyknob'), look = $('look'); let jid = null, jx0 = 0, jy0 = 0; const JR = 55;
    const tstart = (el, fn) => el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(e); }, { passive: false });
    joy.addEventListener('touchstart', e => { e.preventDefault(); if (jid !== null) return; const t = e.changedTouches[0]; jid = t.identifier; jx0 = t.clientX; jy0 = t.clientY;
      base.style.display = 'block'; base.style.left = jx0 + 'px'; base.style.top = jy0 + 'px'; knob.style.transform = 'translate(0,0)'; $('joyhint').style.display = 'none'; ensureStart(); }, { passive: false });
    joy.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === jid) {
      let dx = t.clientX - jx0, dy = t.clientY - jy0; const l = Math.hypot(dx, dy); if (l > JR) { dx *= JR / l; dy *= JR / l; }
      T.jx = dx / JR; T.jy = dy / JR; knob.style.transform = `translate(${dx}px,${dy}px)`; } }, { passive: false });
    const jend = e => { for (const t of e.changedTouches) if (t.identifier === jid) { jid = null; T.jx = T.jy = 0; base.style.display = 'none'; $('joyhint').style.display = 'flex'; } };
    joy.addEventListener('touchend', jend); joy.addEventListener('touchcancel', jend);
    let lid = null, lx = 0, ly = 0;
    look.addEventListener('touchstart', e => { e.preventDefault(); if (lid !== null) return; const t = e.changedTouches[0]; lid = t.identifier; lx = t.clientX; ly = t.clientY; ensureStart(); }, { passive: false });
    look.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === lid) {
      P.yaw -= (t.clientX - lx) * 0.0052; P.pitch = Math.max(-1.5, Math.min(1.5, P.pitch - (t.clientY - ly) * 0.0052)); lx = t.clientX; ly = t.clientY; } }, { passive: false });
    const lend = e => { for (const t of e.changedTouches) if (t.identifier === lid) lid = null; };
    look.addEventListener('touchend', lend); look.addEventListener('touchcancel', lend);
    const hold = (id, key) => { const el = $(id); tstart(el, () => { T[key] = true; el.classList.add('on'); }); const up = e => { e.preventDefault(); T[key] = false; el.classList.remove('on'); }; el.addEventListener('touchend', up); el.addEventListener('touchcancel', up); };
    hold('bJump', 'jump'); hold('bDown', 'down');
    tstart($('bRun'), () => { T.run = !T.run; $('bRun').classList.toggle('on', T.run); });
    tstart($('bFly'), () => { P.fly = !P.fly; P.vy = 0; $('bFly').classList.toggle('on', P.fly); $('bDown').style.display = P.fly ? 'flex' : 'none'; $('bJump').textContent = P.fly ? 'вверх' : 'прыжок'; });
    tstart($('bMap'), () => toggleMap());
    tstart($('bShade'), () => toggleShadows());
    // landmark list
    const list = document.createElement('div'); list.id = 'places'; list.style.cssText = 'position:fixed;inset:0;z-index:9;background:rgba(8,14,22,.92);display:none;overflow:auto;padding:calc(20px + env(safe-area-inset-top)) 20px 20px;touch-action:pan-y;';
    list.innerHTML = '<div style="font-size:18px;margin-bottom:10px;font-weight:600">Куда телепортироваться?</div>';
    const mk = (txt, fn) => { const b = document.createElement('div'); b.textContent = txt; b.style.cssText = 'padding:14px 12px;margin:6px 0;background:rgba(255,255,255,.12);border-radius:10px;font-size:16px'; b.addEventListener('click', () => { list.style.display = 'none'; fn(); }); list.appendChild(b); };
    LANDMARKS.forEach(l => mk(l[0], () => { const [x, z] = lmXZ(l); teleport(x, z); }));
    mk('Закрыть', () => {}); document.body.appendChild(list);
    tstart($('bMore'), () => { pois.panel.open(); });
    $('bFly').classList.toggle('on', P.fly);
  }
  function ensureStart() { if (spawned && !started) { started = true; $('overlay').style.display = 'none'; } }
  $('overlay').addEventListener('touchend', e => { if (IS_TOUCH && spawned) { e.preventDefault(); ensureStart(); } }, { passive: false });

  // ---- main loop
  const fwd = new THREE.Vector3(); let last = performance.now(), fps = 60, frames = 0, tacc = 0;
  const WALK = 5.0, RUN = 11.0, FLY = 45, FLYFAST = 220, RAD = 0.4, HEIGHT = 1.75, EYE = 1.7, G = 24, JUMP = 7.0;
  const tmp = { x: 0, z: 0 };
  function physics(dt) {
    const k = keys; const f = Math.max(-1, Math.min(1, (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - T.jy)), s = Math.max(-1, Math.min(1, (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + T.jx));
    const run = k.ShiftLeft || k.ShiftRight || T.run; const jumpKey = k.Space || T.jump, downKey = k.ControlLeft || k.KeyC || T.down;
    let sp = P.fly ? (run ? FLYFAST : FLY) : (run ? RUN : WALK); if (!P.fly && P.inWater) sp *= 0.45;
    let wx = 0, wz = 0;
    if (P.fly) { const cp = Math.cos(P.pitch); fwd.set(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp); wx = fwd.x * f + Math.cos(P.yaw) * s; wz = fwd.z * f - Math.sin(P.yaw) * s; }
    else { wx = -Math.sin(P.yaw) * f + Math.cos(P.yaw) * s; wz = -Math.cos(P.yaw) * f - Math.sin(P.yaw) * s; }
    const l = Math.hypot(wx, wz); let wy = 0;
    if (P.fly) { wy = fwd.y * f + ((jumpKey ? 1 : 0) - (downKey ? 1 : 0)); }
    const nrm = Math.hypot(wx, wy, wz) || 1, a = Math.min(1, dt * (P.fly ? 6 : 12));
    const amt = Math.min(1, P.fly ? nrm : l), tx = (P.fly ? wx / nrm : l > 0 ? wx / l : 0) * sp * amt, tz = (P.fly ? wz / nrm : l > 0 ? wz / l : 0) * sp * amt;
    P.vx += (tx - P.vx) * a; P.vz += (tz - P.vz) * a;
    P.x += P.vx * dt; P.z += P.vz * dt;
    const b = manifest.bounds; P.x = Math.min(Math.max(P.x, b[0] + 3), b[2] - 3); P.z = Math.min(Math.max(P.z, b[1] + 3), b[3] - 3);
    if (!world.manifestTiles.has(Math.floor(P.x / 500) + '_' + Math.floor(P.z / 500))) { P.x = P.px0; P.z = P.pz0; P.vx = P.vz = 0; }   // edge of the city: no tile beyond the border
    else { P.px0 = P.x; P.pz0 = P.z; }
    if (P.fly) {
      P.y += (wy / nrm) * sp * dt * Math.min(1, nrm); P.vy = 0;
      const gy = world.groundAt(P.x, P.z, P.y); if (P.y < gy + 0.4) P.y = gy + 0.4; P.grounded = false;
    } else {
      tmp.x = P.x; tmp.z = P.z;
      world.collide(P, RAD, P.y, HEIGHT);
      const gy = world.groundAt(P.x, P.z, P.y); const wl = world.waterAt(P.x, P.z);
      P.inWater = wl !== null && gy < wl - 0.3; P.wl = wl;
      const floor = P.inWater ? Math.max(gy, wl - 1.25) : gy;
      if (jumpKey && P.grounded) { P.vy = P.inWater ? 3.5 : JUMP; P.grounded = false; }
      P.vy -= (P.inWater ? 6 : G) * dt; if (P.inWater && P.vy < -3) P.vy = -3;
      P.y += P.vy * dt;
      if (P.y <= floor) { P.y = floor; P.vy = 0; P.grounded = true; }
      else if (P.grounded && P.vy <= 0 && P.y - floor < 0.6) { P.y = floor; P.vy = 0; }   // stick to slopes / stairs
      else P.grounded = false;
    }
  }
  const lookTmp = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
    governor(raw); frames++; tacc += raw; if (tacc > 0.5) { fps = frames / tacc; frames = 0; tacc = 0; updateHud(); }
    const before = world.tiles.size;
    if (spawned) world.update(P, dt, MOB ? 3 : 6);
    if (spawned) { world.interiors.update(P, dt, MOB ? 3 : 5); city.update(P, dt); pois.update(P, dt); game.update(P, dt); crime.update(P, dt); transit.update(P, dt); }
    if (!spawned) {
      // wait until the ring of tiles around the spawn is built
      const sx = SPX, sz = SPZ;
      const need = []; for (let ix = Math.floor((sx - 500) / 500); ix <= Math.floor((sx + 500) / 500); ix++) for (let iz = Math.floor((sz - 500) / 500); iz <= Math.floor((sz + 500) / 500); iz++) if (world.manifestTiles.has(ix + '_' + iz) && Math.hypot((ix + 0.5) * 500 - sx, (iz + 0.5) * 500 - sz) < world.loadR) need.push(ix + '_' + iz);
      const have = need.filter(k => world.tiles.get(k)?.h).length;
      $('bar').firstElementChild.style.width = (100 * have / Math.max(1, need.length)) + '%'; $('msg').textContent = `Загрузка тайлов: ${have}/${need.length}…`;
      world.update({ x: sx, z: sz }, dt, 40);
      if (have >= need.length) { spawn(); updateHud(); $('msg').textContent = 'Готово'; $('go').style.display = 'block'; $('bar').style.display = 'none'; if (qs.has('autostart')) { started = true; $('overlay').style.display = 'none'; } }
    } else if (started || qs.has('autostart') || true) {
      if (P.wait) { const tt = world.tiles.get(Math.floor(P.x / 500) + '_' + Math.floor(P.z / 500)); if (tt && tt.h) { P.wait = false; const g0 = world.heightAt(P.x, P.z); P.y = Math.max(world.groundAt(P.x, P.z, g0 + 300), g0) + (P.fly ? 1.7 : 3); P.eye = P.y + 1.7; } }
      else if (started && !mapOpen && !UI.modal && !game.dead && !crime.driving && !transit.busy) physics(dt);
    }
    const bob = 0; const targetEye = P.y + EYE; P.eye += (targetEye - P.eye) * Math.min(1, dt * (P.grounded ? 18 : 40)); if (P.fly) P.eye = targetEye;
    camera.position.set(P.x, P.eye, P.z); camera.rotation.set(P.pitch, P.yaw, 0);
    sky.position.copy(camera.position);
    // sun shadow follows the player (snapped to texels)
    { const q = (2 * SC) / SMAP; const sx = Math.round(P.x / q) * q, sz = Math.round(P.z / q) * q, sy = Math.round(P.y / q) * q;
      sun.target.position.set(sx, sy, sz); sun.position.set(sx + sunDir.x * 350, sy + sunDir.y * 350, sz + sunDir.z * 350); sun.target.updateMatrixWorld(); }
    // water animation
    world.waterN.offset.x += dt * 0.012; world.waterN.offset.y += dt * 0.007;
    $('uw').style.display = (P.inWater && P.wl !== null && camera.position.y < P.wl) ? 'block' : 'none';
    renderer.render(scene, camera); if (frames % 5 === 0) doorHint();
    if (mapOpen && (frames % 10 === 0)) drawBig();
    if (frames % (MOB ? 8 : 4) === 0) drawMini();
  }
  const dh = $('doorhint'); let dhTxt = '';
  function doorHint() {
    const nr = world.interiors.nearest; let txt = '';
    if (nr && !P.fly) {
      const I = world.interiors.active.get(nr.plan), d = nr.plan.door;
      if (I && I.inside) txt = `выход — ${nr.dist.toFixed(0)} м${I.n > 1 ? ' · этаж ' + (I.cur + 1) + '/' + I.n : ''}`;
      else if (nr.dist < 14) { const vx = d.mx - P.x, vz = d.mz - P.z, fw = -vx * Math.sin(P.yaw) - vz * Math.cos(P.yaw), rt = vx * Math.cos(P.yaw) - vz * Math.sin(P.yaw), a = Math.atan2(rt, fw), ar = Math.abs(a) < 0.5 ? '↑' : a > 0 ? '→' : '←'; txt = `🚪 вход ${ar} ${nr.dist.toFixed(0)} м`; }
    }
    if (txt !== dhTxt) { dhTxt = txt; dh.textContent = txt; dh.style.display = txt ? 'block' : 'none'; }
  }
  const simulate = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { world.update(P, dt, 40); world.interiors.update(P, dt, 1e9); physics(dt); } P.eye = P.y + EYE; camera.position.set(P.x, P.eye, P.z); camera.rotation.set(P.pitch, P.yaw, 0); sky.position.copy(camera.position); };
  const renderNow = () => { camera.position.set(P.x, P.eye, P.z); camera.rotation.set(P.pitch, P.yaw, 0); sky.position.copy(camera.position); renderer.render(scene, camera); doorHint(); };
  let hudOpen = qs.get('hud') === '1'; $('hud').classList.toggle('open', hudOpen);
  { const hi = $('hudi'), tg = e => { e.preventDefault(); e.stopPropagation(); hudOpen = !hudOpen; $('hud').classList.toggle('open', hudOpen); updateHud(); }; hi.addEventListener('touchend', tg, { passive: false }); hi.addEventListener('click', tg); hi.addEventListener('touchstart', e => e.stopPropagation(), { passive: true }); }
  function updateHud() {
    const [lat, lon] = xz2ll(P.x, P.z);
    const full = `<b>${P.fly ? 'ПОЛЁТ' : P.inWater ? 'ВОДА' : 'ХОДЬБА'}</b> · ${fps.toFixed(0)} fps · Q${qLevel}<br>
      X(восток) ${P.x.toFixed(0)} м · Z(юг) ${P.z.toFixed(0)} м<br>
      ${lat.toFixed(5)}°N ${lon.toFixed(5)}°E<br>
      высота над ур. моря: ${P.y.toFixed(1)} м<br>
      тайлов: ${world.loadedCount} · зданий: ${world.stats.buildings}<br>${city.hudLine()}<br>${transit.hudLine()}`;
    $('hudtxt').innerHTML = IS_TOUCH && !hudOpen ? `${fps.toFixed(0)} fps · Q${qLevel}` : full;
  }
  window.__kyiv = { city, pois, game, crime, transit, quality: { get level() { return qLevel; }, set: l => setLevel(l), gov }, P, keys, T, simulate, renderNow, gotoDoor, interiors: world.interiors, world, camera, scene, renderer, teleport, spawn, ll2xz, get ready() { return spawned; }, setStarted(v) { started = v; } };
  requestAnimationFrame(frame);
}
main().catch(e => { console.error(e); const m = document.getElementById('msg'); if (m) m.textContent = 'Ошибка: ' + e.message; });
