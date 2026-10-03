import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { World } from './world.js';

const $ = id => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const LAT0 = 50.4501, LON0 = 30.5234, R = 6371008.8;
const KX = Math.PI / 180 * R * Math.cos(LAT0 * Math.PI / 180), KY = Math.PI / 180 * R;
const ll2xz = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KY];
const xz2ll = (x, z) => [LAT0 - z / KY, LON0 + x / KX];

const LANDMARKS = [
  ['Майдан Незалежности', 50.4501, 30.5234], ['Софийский собор', 50.4529, 30.5144], ['Золотые ворота', 50.4489, 30.5139],
  ['Михайловский Златоверхий', 50.4547, 30.5189], ['Мариинский дворец', 50.4474, 30.5365], ['Владимирская горка', 50.4573, 30.5283],
  ['Андреевский спуск (верх)', 50.4590, 30.5170], ['Киево-Печерская лавра', 50.4347, 30.5576], ['Бессарабка', 50.4440, 30.5222],
];

const IS_TOUCH = (qs.get('touch') === '1') || (qs.get('touch') !== '0' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches);
if (IS_TOUCH) document.body.classList.add('touch');
const MOB = IS_TOUCH;   // mobile performance profile
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', e => { if (IS_TOUCH && e.target.closest && !e.target.closest('#big, #places')) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());

async function main() {
  const manifest = await (await fetch('tiles/manifest.json')).json();
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

  const world = (() => { const loadR = parseFloat(qs.get('dist') || (MOB ? '1050' : '1500')); return new World(scene, manifest, { shadows: true, loadR, unloadR: loadR + (MOB ? 500 : 800), treeKeep: parseFloat(qs.get('trees') || (MOB ? '0.5' : '1')), lampKeep: MOB ? 0.5 : 1, detailR: DETAILR[qLevel], normalScale: MOB ? 1.0 : 1.0 }); })();

  // ---- player
  const P = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, fly: false, grounded: false, eye: 0, inWater: false, wl: null };
  const keys = {};
  const T = { jx: 0, jy: 0, jump: false, run: false, down: false };
  const teleport = (x, z, yaw, pitch) => { P.x = x; P.z = z; P.vx = P.vz = P.vy = 0; if (yaw !== undefined) P.yaw = yaw; if (pitch !== undefined) P.pitch = pitch;
    const gy = world.heightAt(x, z); P.y = Math.max(world.groundAt(x, z, gy + 300), gy) + (P.fly ? 1.7 : 3); P.eye = P.y + 1.7; };
  let started = false, locked = false, spawned = false;
  const gotoDoor = (pl, dist = 5, yawOff = 0) => { const d = pl.door; P.fly = false; teleport(d.mx + d.nx * dist, d.mz + d.nz * dist, Math.atan2(d.nx, d.nz) + yawOff, 0); P.y = world.heightAt(P.x, P.z); P.eye = P.y + 1.7; world.interiors.forceBuild(P); return pl; };
  const spawn = () => {
    const sx = parseFloat(qs.get('x') ?? '0'), sz = parseFloat(qs.get('z') ?? '0');
    P.fly = qs.get('fly') === '1';
    teleport(sx, sz, THREE.MathUtils.degToRad(parseFloat(qs.get('yaw') ?? '0')), THREE.MathUtils.degToRad(parseFloat(qs.get('pitch') ?? '0')));
    if (qs.has('h')) { P.y = parseFloat(qs.get('h')); P.eye = P.y + 1.7; }
    if (qs.has('door')) {   // debug: stand ~5 m in front of the nearest enterable building's door (door=1; &minlv=N to need N+ floors)
      const minlv = parseInt(qs.get('minlv') || '1'), plans = world.interiors.plans().filter(p => p.n >= minlv && p.tile.alive);
      let best = null, bd = 1e9; for (const p of plans) { const d = Math.hypot(p.door.mx - sx, p.door.mz - sz); if (d < bd) { bd = d; best = p; } }
      if (best) gotoDoor(best, 5);
    }
    spawned = true;
  };

  let manualShadow = manualShadow0;
  function setShadows(on) { if (sun.castShadow === on) return; sun.castShadow = on; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); $('bShade').classList.toggle('on', on); }
  function toggleShadows() { manualShadow = true; setShadows(!sun.castShadow); }
  const gov = { t: 0, n: 0, good: 0, lastChange: performance.now(), start: performance.now(), fps: 60 };
  function setLevel(l) {
    qLevel = Math.max(0, Math.min(3, l)); renderer.setPixelRatio(prFor(qLevel)); renderer.setSize(innerWidth, innerHeight, false);
    world.detailR = DETAILR[qLevel]; world.interiors.activateR = ACTR[qLevel]; world.interiors.disposeR = ACTR[qLevel] + 25;
    if (!manualShadow) setShadows(qLevel >= 2);
    gov.lastChange = performance.now(); gov.good = 0;
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
    if (e.code === 'KeyR') teleport(0, 0, 0, 0);
    if (e.code === 'KeyH') $('help').style.display = $('help').style.display === 'none' ? '' : 'none';
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'KeyG') toggleShadows();
    if (e.code.startsWith('Digit')) { const i = +e.code.slice(5) - 1; if (LANDMARKS[i]) { const [x, z] = ll2xz(LANDMARKS[i][1], LANDMARKS[i][2]); teleport(x, z); } }
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  document.addEventListener('pointerlockchange', () => { if (IS_TOUCH) return; locked = document.pointerLockElement === canvas; if (!locked && started) $('overlay').style.display = 'flex', $('go').style.display = 'block', $('msg').textContent = 'Пауза'; });
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
  const mm = manifest.minimap, mimg = new Image(); mimg.src = 'tiles/' + mm.file; let mmOK = false; mimg.onload = () => { mmOK = true; };
  const mctx = $('minicv').getContext('2d');
  function drawMini() {
    if (!mmOK) return; const W = 200, view = 500, sp = view / mm.mpp, cx = (P.x - mm.x0) / mm.mpp, cz = (P.z - mm.z0) / mm.mpp;
    mctx.fillStyle = '#9ab'; mctx.fillRect(0, 0, W, W);
    mctx.drawImage(mimg, cx - sp / 2, cz - sp / 2, sp, sp, 0, 0, W, W);
    mctx.save(); mctx.translate(W / 2, W / 2); mctx.rotate(-P.yaw);   // arrow: yaw 0 = north (up)
    mctx.fillStyle = '#e33'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 2; mctx.beginPath(); mctx.moveTo(0, -9); mctx.lineTo(6, 7); mctx.lineTo(0, 3); mctx.lineTo(-6, 7); mctx.closePath(); mctx.fill(); mctx.stroke(); mctx.restore();
    mctx.fillStyle = '#000'; mctx.font = 'bold 11px sans-serif'; mctx.fillText('С', 94, 12);
  }
  let mapOpen = false; const bigcv = $('bigcv'), bctx = bigcv.getContext('2d');
  function drawBig() {
    bigcv.width = innerWidth; bigcv.height = innerHeight; const s = Math.min(innerWidth / mimg.width, innerHeight / mimg.height) * 0.96;
    const ox = (innerWidth - mimg.width * s) / 2, oy = (innerHeight - mimg.height * s) / 2; bigcv._t = { s, ox, oy };
    bctx.drawImage(mimg, ox, oy, mimg.width * s, mimg.height * s);
    const toS = (x, z) => [ox + (x - mm.x0) / mm.mpp * s, oy + (z - mm.z0) / mm.mpp * s];
    bctx.font = '13px sans-serif'; LANDMARKS.forEach((l, i) => { const [x, z] = ll2xz(l[1], l[2]), [sx, sy] = toS(x, z); bctx.fillStyle = '#c22'; bctx.beginPath(); bctx.arc(sx, sy, 5, 0, 7); bctx.fill(); bctx.fillStyle = '#012'; bctx.fillText((i + 1) + ' ' + l[0], sx + 8, sy + 4); });
    const [px, py] = toS(P.x, P.z); bctx.fillStyle = '#06f'; bctx.strokeStyle = '#fff'; bctx.lineWidth = 2; bctx.beginPath(); bctx.arc(px, py, 6, 0, 7); bctx.fill(); bctx.stroke();
  }
  function toggleMap() { $('bClose').style.display = !mapOpen ? 'flex' : 'none'; mapOpen = !mapOpen; $('big').style.display = $('bigtip').style.display = mapOpen ? 'block' : 'none'; if (mapOpen) { if (document.pointerLockElement) document.exitPointerLock(); drawBig(); } }
  const mapTap = e => { const t = bigcv._t; if (!t) return; const pt = e.changedTouches ? e.changedTouches[0] : e; const x = (pt.clientX - t.ox) / t.s * mm.mpp + mm.x0, z = (pt.clientY - t.oy) / t.s * mm.mpp + mm.z0; teleport(x, z); toggleMap(); };
  bigcv.addEventListener('click', mapTap);
  $('bClose').addEventListener('touchstart', e => { e.preventDefault(); if (mapOpen) toggleMap(); }, { passive: false }); $('bClose').addEventListener('click', () => { if (mapOpen) toggleMap(); });
  setupTouch();

  if (IS_TOUCH) $('gotxt').textContent = 'Коснитесь экрана, чтобы начать';
  $('help').innerHTML = `<b>WASD</b> — ходьба · <b>мышь</b> — взгляд · <b>Shift</b> — бег · <b>Пробел</b> — прыжок<br>
    <b>F</b> — полёт/ходьба (в полёте: Пробел вверх, Ctrl/C вниз, Shift — ускорение)<br>
    <b>1–9</b> — телепорт к местам · <b>M</b> — карта (клик = телепорт) · <b>R</b> — на Майдан · <b>G</b> — тени · <b>H</b> — скрыть подсказку<br>
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
    LANDMARKS.forEach(l => mk(l[0], () => { const [x, z] = ll2xz(l[1], l[2]); teleport(x, z); }));
    mk('Закрыть', () => {}); document.body.appendChild(list);
    tstart($('bMore'), () => { list.style.display = 'block'; });
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
    world.update(P, dt, spawned ? (MOB ? 3 : 6) : 40);
    if (spawned) world.interiors.update(P, dt, MOB ? 3 : 5);
    if (!spawned) {
      // wait until the ring of tiles around the spawn is built
      const sx = parseFloat(qs.get('x') ?? '0'), sz = parseFloat(qs.get('z') ?? '0');
      const need = []; for (let ix = Math.floor((sx - 500) / 500); ix <= Math.floor((sx + 500) / 500); ix++) for (let iz = Math.floor((sz - 500) / 500); iz <= Math.floor((sz + 500) / 500); iz++) if (world.manifestTiles.has(ix + '_' + iz) && Math.hypot((ix + 0.5) * 500 - sx, (iz + 0.5) * 500 - sz) < world.loadR) need.push(ix + '_' + iz);
      const have = need.filter(k => world.tiles.get(k)?.h).length;
      $('bar').firstElementChild.style.width = (100 * have / Math.max(1, need.length)) + '%'; $('msg').textContent = `Загрузка тайлов: ${have}/${need.length}…`;
      world.update({ x: sx, z: sz }, dt, 40);
      if (have >= need.length) { spawn(); updateHud(); $('msg').textContent = 'Готово'; $('go').style.display = 'block'; $('bar').style.display = 'none'; if (qs.has('autostart')) { started = true; $('overlay').style.display = 'none'; } }
    } else if (started || qs.has('autostart') || true) {
      if (started && !mapOpen) physics(dt);
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
  function updateHud() {
    const [lat, lon] = xz2ll(P.x, P.z);
    $('hud').innerHTML = `<b>${P.fly ? 'ПОЛЁТ' : P.inWater ? 'ВОДА' : 'ХОДЬБА'}</b> · ${fps.toFixed(0)} fps · Q${qLevel}<br>
      X(восток) ${P.x.toFixed(0)} м · Z(юг) ${P.z.toFixed(0)} м<br>
      ${lat.toFixed(5)}°N ${lon.toFixed(5)}°E<br>
      высота над ур. моря: ${P.y.toFixed(1)} м<br>
      тайлов: ${world.loadedCount} · зданий: ${world.stats.buildings}`;
  }
  window.__kyiv = { quality: { get level() { return qLevel; }, set: l => setLevel(l), gov }, P, keys, T, simulate, renderNow, gotoDoor, interiors: world.interiors, world, camera, scene, renderer, teleport, spawn, ll2xz, get ready() { return spawned; }, setStarted(v) { started = v; } };
  requestAnimationFrame(frame);
}
main().catch(e => { console.error(e); const m = document.getElementById('msg'); if (m) m.textContent = 'Ошибка: ' + e.message; });
