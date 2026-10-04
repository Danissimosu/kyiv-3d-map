// Room types, styles (textures / palette / lighting tone) and procedural furniture (boxes in the oriented uv frame).
// Furniture boxes are returned as {u0,u1,v0,v1,y0,y1,rect,color,solid} and rendered as ONE InstancedMesh per level.

export const STYLE = {
  living:   { name: 'гостиная', floor: 'parquet', wall: 'plaster', ceil: 'ceiling', wallT: [1.0, 0.92, 0.78], ceilT: [1.0, 0.93, 0.8], floorT: [1.0, 0.94, 0.86], win: true },
  bedroom:  { name: 'спальня', floor: 'carpet', wall: 'wallpaper', ceil: 'ceiling', wallT: [0.78, 0.86, 1.0], ceilT: [1.0, 0.95, 0.9], floorT: [0.95, 0.9, 1.0], win: true },
  kitchen:  { name: 'кухня', floor: 'ktile', wall: 'plaster', ceil: 'ceiling', wallT: [1.0, 0.94, 0.62], ceilT: [1.0, 1.0, 0.95], floorT: [1, 1, 1], win: true },
  bathroom: { name: 'санузел', floor: 'tiles', wall: 'walltile', ceil: 'ceiling', wallT: [0.86, 1.0, 1.0], ceilT: [0.92, 1.0, 1.0], floorT: [0.9, 1.0, 1.0], win: false },
  office:   { name: 'офис', floor: 'offcarpet', wall: 'plaster', ceil: 'ceiling', wallT: [0.9, 0.95, 1.0], ceilT: [0.94, 0.98, 1.05], floorT: [1, 1, 1], win: true },
  meeting:  { name: 'переговорная', floor: 'offcarpet', wall: 'wallpaper', ceil: 'ceiling', wallT: [0.8, 0.95, 0.85], ceilT: [0.94, 0.98, 1.05], floorT: [0.9, 1, 0.95], win: true },
  shop:     { name: 'магазин', floor: 'checker', wall: 'plaster', ceil: 'ceiling', wallT: [1.0, 1.0, 1.0], ceilT: [1.05, 1.05, 1.05], floorT: [1, 1, 1], win: true, brand: true },
  cafe:     { name: 'кафе', floor: 'plank', wall: 'brick', ceil: 'ceiling', wallT: [1.0, 0.82, 0.66], ceilT: [0.75, 0.6, 0.48], floorT: [1, 0.9, 0.8], win: true },
  market:   { name: 'торговый зал', floor: 'checker', wall: 'plaster', ceil: 'ceiling', wallT: [1.0, 1.0, 1.0], ceilT: [1.08, 1.08, 1.08], floorT: [1.05, 1.05, 1.05], win: true, brand: true },
  fastfood: { name: 'фастфуд', floor: 'tiles', wall: 'plaster', ceil: 'ceiling', wallT: [1.0, 0.9, 0.75], ceilT: [1.08, 1.05, 1.0], floorT: [1.0, 0.95, 0.9], win: true, brand: true },
  dining:   { name: 'зал ресторана', floor: 'plank', wall: 'brick', ceil: 'ceiling', wallT: [1.0, 0.85, 0.7], ceilT: [0.8, 0.66, 0.55], floorT: [1, 0.92, 0.84], win: true, brand: true },
  mcd:      { name: 'McDonald\'s-стиль: зал', floor: 'tiles', wall: 'plaster', ceil: 'ceiling', wallT: [1.0, 0.86, 0.74], ceilT: [0.9, 0.88, 0.86], floorT: [0.9, 0.9, 0.95], win: true },
  puzata:   { name: 'столовая (раздача)', floor: 'plank', wall: 'plaster', ceil: 'plank', wallT: [0.74, 0.92, 0.7], ceilT: [0.95, 0.82, 0.7], floorT: [1, 0.9, 0.78], win: true },
  silpo:    { name: 'супермаркет', floor: 'stone', wall: 'plaster', ceil: 'ceiling', wallT: [0.9, 1.0, 0.92], ceilT: [0.66, 0.68, 0.68], floorT: [1.12, 1.12, 1.1], win: true },
  epicentr: { name: 'гипермаркет для дома', floor: 'stone', wall: 'plaster', ceil: 'ceiling', wallT: [1.0, 0.97, 0.72], ceilT: [0.78, 0.8, 0.8], floorT: [0.95, 0.95, 0.92], win: true },
  wkoffice: { name: 'офис (open-space)', floor: 'offcarpet', wall: 'plaster', ceil: 'ceiling', wallT: [0.92, 0.96, 1.0], ceilT: [0.96, 1.0, 1.05], floorT: [0.85, 0.88, 0.92], win: true },
  wkdepot:  { name: 'склад (доки)', floor: 'stone', wall: 'plaster', ceil: 'ceiling', wallT: [0.72, 0.75, 0.78], ceilT: [0.8, 0.82, 0.84], floorT: [0.8, 0.8, 0.82], win: true },
  staff:    { name: 'бытовка', floor: 'stone', wall: 'plaster', ceil: 'ceiling', wallT: [0.97, 0.97, 0.95], ceilT: [1, 1, 1], floorT: [0.82, 0.82, 0.82], win: true },
  diy:      { name: 'торговый склад', floor: 'stone', wall: 'plaster', ceil: 'ceiling', wallT: [0.9, 0.92, 0.95], ceilT: [1.0, 1.0, 1.05], floorT: [0.95, 0.95, 0.95], win: true },
  depot:    { name: 'депо / склад', floor: 'stone', wall: 'plaster', ceil: 'ceiling', wallT: [0.78, 0.8, 0.82], ceilT: [0.9, 0.9, 0.92], floorT: [0.85, 0.85, 0.85], win: true },
  reception:{ name: 'приёмная', floor: 'stone', wall: 'plaster', ceil: 'ceiling', wallT: [0.8, 0.88, 0.8], ceilT: [0.95, 1.0, 0.95], floorT: [0.9, 0.9, 0.9], win: false },
  cell:     { name: 'камера', floor: 'stone', wall: 'plaster', ceil: 'ceiling', wallT: [0.62, 0.68, 0.64], ceilT: [0.8, 0.84, 0.8], floorT: [0.7, 0.7, 0.7], win: false },
  hallway:  { name: 'холл', floor: 'stone', wall: 'plaster', ceil: 'ceiling', wallT: [0.97, 0.94, 0.88], ceilT: [1, 0.97, 0.9], floorT: [1, 1, 1], win: true },
};

const RES_KINDS = /^(apartments|residential|house|detached|semidetached|terrace|dormitory|yes|hotel)/;
const OFF_KINDS = /^(office|government|civic|public|commercial|college|university|school|service|industrial|warehouse|hospital|kindergarten|church)/;
const RET_KINDS = /^(retail|supermarket|shop|kiosk)/;
export function classify(kind, seedU) {
  kind = kind || 'yes';
  if (RET_KINDS.test(kind)) return 'retail';
  if (OFF_KINDS.test(kind)) return 'office';
  if (/^yes/.test(kind)) return seedU < 0.62 ? 'res' : 'office';
  return 'res';
}

// leaves: [{area, door, stair}] -> types[]
const THEMES = { market: 'market', fastfood: 'fastfood', dining: 'dining', diy: 'diy', mcd: 'mcd', puzata: 'puzata', silpo: 'silpo', epicentr: 'epicentr', util: 'wkoffice', depot: 'wkdepot', prison: 'cell' };
const PUBLIC = new Set(['market', 'fastfood', 'dining', 'diy', 'mcd', 'puzata', 'silpo', 'epicentr']);
export const POI_THEMES = THEMES;
function assignThemed(cat, level, nLevels, leaves, rng) {
  const main = THEMES[cat], pub = PUBLIC.has(cat);
  if (cat === 'prison') {
    if (leaves.length === 1) return [level === 0 ? 'reception' : 'cell'];
    const t = leaves.map(() => 'cell'); const order = leaves.map((l, i) => i).sort((a, b) => leaves[b].area - leaves[a].area);
    leaves.forEach((l, i) => { if (l.door && level === 0) t[i] = 'reception'; else if (l.stair) t[i] = 'hallway'; });
    if (level === 0) { const big = order.find(i => t[i] === 'cell'); if (big !== undefined && leaves.length > 2) t[big] = 'hallway'; }
    return t;
  }
  if (level > 0) return leaves.map(() => 'office');
  if (leaves.length === 1) return [main];
  const types = leaves.map(() => 'hallway'); const order = leaves.map((l, i) => i).sort((a, b) => leaves[b].area - leaves[a].area);
  let bath = false;
  order.forEach((i, n) => {
    const l = leaves[i];
    if (l.area < 3) return;
    if (l.door) { types[i] = main; return; }
    if (l.stair) { types[i] = 'hallway'; return; }
    if (!bath && l.area < 12 && leaves.length >= 3) { types[i] = 'bathroom'; bath = true; return; }
    types[i] = n === 0 ? main : (pub ? (rng() < 0.6 ? main : 'office') : cat === 'depot' ? (rng() < 0.6 ? 'staff' : main) : cat === 'util' ? (rng() < 0.4 ? 'meeting' : main) : (rng() < 0.5 ? 'office' : main));
  });
  return types;
}
export function assignTypes(cat, level, nLevels, leaves, rng) {
  if (THEMES[cat]) return assignThemed(cat, level, nLevels, leaves, rng);
  if (leaves.length === 1) return [cat === 'res' ? 'living' : cat === 'office' ? (level > 0 || leaves[0].area > 14 ? 'office' : 'meeting') : (level === 0 ? 'shop' : 'office')];
  const types = new Array(leaves.length).fill('hallway');
  const idx = leaves.map((l, i) => i).filter(i => leaves[i].area >= 3).sort((a, b) => leaves[a].area - leaves[b].area);   // ascending
  const free = idx.filter(i => !(leaves[i].stair || (leaves[i].door && level === 0 && cat !== 'retail')));
  const hallIdx = idx.filter(i => !free.includes(i));
  hallIdx.forEach(i => types[i] = (cat === 'retail' && level === 0 && leaves[i].door) ? 'shop' : 'hallway');
  const eff = (cat === 'retail' && level > 0) ? 'office' : cat;
  if (eff === 'res') {
    const rest = free.slice();
    const small = rest.filter(i => leaves[i].area < 16);
    if (rest.length >= 2 && small.length) { types[small[0]] = 'bathroom'; rest.splice(rest.indexOf(small[0]), 1); }
    if (rest.length >= 3) { types[rest[0]] = 'kitchen'; rest.shift(); }
    rest.sort((a, b) => leaves[b].area - leaves[a].area);
    rest.forEach((i, n) => types[i] = n === 0 ? 'living' : (n === 1 && free.length < 3 && rng() < 0.4 ? 'kitchen' : 'bedroom'));
    if (free.length === 1) types[free[0]] = rng() < 0.5 ? 'living' : 'bedroom';
  } else if (eff === 'office') {
    const rest = free.slice(); const small = rest.filter(i => leaves[i].area < 14);
    if (rest.length >= 3 && small.length) { types[small[0]] = 'bathroom'; rest.splice(rest.indexOf(small[0]), 1); }
    rest.sort((a, b) => leaves[b].area - leaves[a].area);
    rest.forEach((i, n) => types[i] = (n > 0 && n % 3 === 1 && leaves[i].area > 20) ? 'meeting' : 'office');
  } else {   // retail ground floor
    const rest = free.slice(); const small = rest.filter(i => leaves[i].area < 12);
    if (rest.length >= 3 && small.length) { types[small[0]] = 'bathroom'; rest.splice(rest.indexOf(small[0]), 1); }
    rest.sort((a, b) => leaves[b].area - leaves[a].area);
    rest.forEach((i, n) => types[i] = (n === 0 && !hallIdx.some(h => types[h] === 'shop')) ? 'shop' : (rng() < 0.45 ? 'cafe' : 'shop'));
    if (!types.includes('cafe') && rest.length >= 2 && rng() < 0.7) types[rest[rest.length - 1]] = 'cafe';
  }
  return types;
}

const C = (r, g, b) => [r, g, b];
const PAL = { sofa: [[0.35, 0.45, 0.6], [0.6, 0.35, 0.3], [0.42, 0.55, 0.42], [0.55, 0.5, 0.4]], wood: [0.62, 0.42, 0.26], dwood: [0.35, 0.24, 0.16], white: [0.95, 0.95, 0.93], dark: [0.12, 0.13, 0.15], steel: [0.7, 0.72, 0.75], bed: [[0.8, 0.82, 0.95], [0.9, 0.75, 0.75], [0.75, 0.9, 0.85]] };
const B = (a0, a1, b0, b1, y0, y1, rect, color, solid = true) => ({ a0, a1, b0, b1, y0, y1, rect, color, solid });
const WALL_D = 0.07 + 0.06;

// piece generators in local (a along the wall, b = depth away from the wall) coordinates; return {w, d, boxes}
const PIECES = {
  sofa(rng) { const c = PAL.sofa[(rng() * 4) | 0], w = 1.9 + rng() * 0.4; return { w, d: 0.95, boxes: [B(0, w, 0, 0.95, 0, 0.42, 'carpet', c), B(0, w, 0, 0.22, 0.42, 0.9, 'carpet', c), B(0, 0.2, 0, 0.95, 0.42, 0.65, 'carpet', c), B(w - 0.2, w, 0, 0.95, 0.42, 0.65, 'carpet', c)] }; },
  tvstand() { return { w: 1.5, d: 0.45, boxes: [B(0, 1.5, 0, 0.45, 0, 0.5, 'wood', PAL.dwood), B(0.35, 1.15, 0.12, 0.2, 0.5, 1.1, 'dark', [0.08, 0.09, 0.1], false)] }; },
  shelf(rng) { const w = 1.0 + rng() * 0.8; return { w, d: 0.38, boxes: [B(0, w, 0, 0.38, 0, 2.0, 'wood', PAL.wood), B(0.04, w - 0.04, 0.34, 0.4, 0.3, 1.9, 'carpet', [0.55 + rng() * .4, 0.35 + rng() * .3, 0.3 + rng() * .3], false)] }; },
  table() { return { w: 1.2, d: 0.8, boxes: [B(0, 1.2, 0, 0.8, 0.72, 0.78, 'wood', PAL.wood, false), B(0.05, 0.12, 0.05, 0.12, 0, 0.72, 'dark', PAL.dwood, false), B(1.08, 1.15, 0.68, 0.75, 0, 0.72, 'dark', PAL.dwood, false)] }; },
  bed(rng) { const bc = PAL.bed[(rng() * 3) | 0]; return { w: 1.7, d: 2.1, boxes: [B(0, 1.7, 0, 2.1, 0, 0.42, 'wood', PAL.dwood), B(0.05, 1.65, 0.05, 2.05, 0.42, 0.62, 'carpet', bc), B(0.1, 0.8, 0.08, 0.5, 0.62, 0.72, 'ktile', [1, 1, 1], false), B(0.9, 1.6, 0.08, 0.5, 0.62, 0.72, 'walltile', [1, 1, 1], false), B(0, 1.7, 0, 0.08, 0.42, 1.0, 'wood', PAL.dwood)] }; },
  wardrobe() { return { w: 1.5, d: 0.6, boxes: [B(0, 1.5, 0, 0.6, 0, 2.1, 'wood', [0.7, 0.55, 0.4]), B(0.74, 0.76, 0.6, 0.62, 0.2, 1.9, 'dark', PAL.dwood, false)] }; },
  nightstand() { return { w: 0.5, d: 0.45, boxes: [B(0, 0.5, 0, 0.45, 0, 0.5, 'wood', PAL.wood)] }; },
  counter(rng) { const w = 2.4 + rng() * 0.8; return { w, d: 0.62, boxes: [B(0, w, 0, 0.62, 0, 0.86, 'walltile', [0.93, 0.93, 0.9]), B(0, w, 0, 0.64, 0.86, 0.92, 'dark', [0.2, 0.2, 0.22], false), B(0.3, 0.9, 0.1, 0.5, 0.92, 0.95, 'dark', [0.05, 0.05, 0.05], false), B(0, w, 0, 0.3, 1.4, 1.9, 'walltile', [0.9, 0.88, 0.8])] }; },
  fridge() { return { w: 0.65, d: 0.65, boxes: [B(0, 0.65, 0, 0.65, 0, 1.85, 'walltile', [0.92, 0.94, 0.95]), B(0.55, 0.6, 0.64, 0.68, 0.9, 1.5, 'dark', PAL.steel, false)] }; },
  bathtub() { return { w: 1.7, d: 0.75, boxes: [B(0, 1.7, 0, 0.75, 0, 0.55, 'walltile', [1, 1, 1]), B(0.08, 1.62, 0.08, 0.67, 0.5, 0.56, 'walltile', [0.7, 0.88, 0.95], false)] }; },
  toilet() { return { w: 0.4, d: 0.65, boxes: [B(0, 0.4, 0, 0.2, 0, 0.75, 'walltile', [1, 1, 1]), B(0.02, 0.38, 0.2, 0.65, 0, 0.4, 'walltile', [1, 1, 1])] }; },
  sink() { return { w: 0.55, d: 0.45, boxes: [B(0.1, 0.45, 0.05, 0.4, 0, 0.8, 'walltile', [1, 1, 1]), B(0, 0.55, 0, 0.45, 0.8, 0.9, 'walltile', [0.95, 0.97, 1])] }; },
  desk(rng) { const w = 1.4 + rng() * 0.3; return { w, d: 0.75, boxes: [B(0, w, 0, 0.75, 0.7, 0.75, 'wood', [0.75, 0.62, 0.45]), B(0.03, 0.08, 0.03, 0.72, 0, 0.7, 'dark', PAL.steel, false), B(w - 0.08, w - 0.03, 0.03, 0.72, 0, 0.7, 'dark', PAL.steel, false), B(w / 2 - 0.25, w / 2 + 0.25, 0.1, 0.15, 0.75, 1.1, 'dark', PAL.dark, false), B(w / 2 - 0.1, w / 2 + 0.1, 0.1, 0.22, 0.75, 0.78, 'dark', PAL.dark, false), B(w / 2 - 0.25, w / 2 + 0.25, 0.85, 1.3, 0.42, 0.5, 'carpet', [0.2, 0.22, 0.28], false), B(w / 2 - 0.25, w / 2 + 0.25, 1.2, 1.3, 0.5, 1.0, 'carpet', [0.2, 0.22, 0.28], false)] }; },
  cabinet() { return { w: 0.9, d: 0.5, boxes: [B(0, 0.9, 0, 0.5, 0, 1.6, 'dark', [0.55, 0.57, 0.6]), B(0.02, 0.88, 0.5, 0.52, 0.5, 0.52, 'dark', PAL.dark, false), B(0.02, 0.88, 0.5, 0.52, 1.0, 1.02, 'dark', PAL.dark, false)] }; },
  meetTable() { return { w: 2.4, d: 1.1, boxes: [B(0, 2.4, 0, 1.1, 0.72, 0.78, 'wood', [0.55, 0.4, 0.3], false), B(0.2, 0.3, 0.3, 0.4, 0, 0.72, 'dark', PAL.dark, false), B(2.1, 2.2, 0.7, 0.8, 0, 0.72, 'dark', PAL.dark, false)] }; },
  shopShelf(rng) { const w = 1.8 + rng() * 0.6; const bx = [B(0, w, 0, 0.42, 0, 1.9, 'dark', [0.7, 0.7, 0.72])]; for (let i = 0; i < 4; i++) { const y = 0.25 + i * 0.42; let a = 0.05; while (a < w - 0.3) { const ww = 0.2 + rng() * 0.3; if (a + ww > w - 0.05) break; bx.push(B(a, a + ww, 0.4, 0.46, y, y + 0.28 + rng() * 0.08, 'carpet', [0.4 + rng() * 0.6, 0.3 + rng() * 0.6, 0.3 + rng() * 0.6], false)); a += ww + 0.06; } } return { w, d: 0.46, boxes: bx }; },
  shopCounter() { return { w: 2.2, d: 0.7, boxes: [B(0, 2.2, 0, 0.7, 0, 1.0, 'wood', [0.78, 0.6, 0.4]), B(0, 2.2, 0, 0.75, 1.0, 1.05, 'dark', [0.15, 0.15, 0.17], false), B(0.8, 1.2, 0.15, 0.4, 1.05, 1.3, 'dark', PAL.dark, false)] }; },
  cafeTable(rng) { const c = [[0.65, 0.2, 0.2], [0.2, 0.4, 0.55], [0.3, 0.5, 0.3]][(rng() * 3) | 0]; return { w: 1.7, d: 0.95, boxes: [B(0.45, 1.25, 0.1, 0.9, 0.72, 0.77, 'wood', PAL.wood, false), B(0.8, 0.9, 0.45, 0.55, 0, 0.72, 'dark', PAL.dark, false), B(0.15, 0.5, 0.3, 0.7, 0, 0.46, 'carpet', c, false), B(1.2, 1.55, 0.3, 0.7, 0, 0.46, 'carpet', c, false)] }; },
  bar() { return { w: 3.0, d: 0.65, boxes: [B(0, 3.0, 0, 0.65, 0, 1.08, 'dark', [0.3, 0.2, 0.15]), B(0, 3.0, 0, 0.75, 1.08, 1.14, 'wood', [0.8, 0.6, 0.4], false), B(0.3, 2.7, 0, 0.3, 1.5, 1.52, 'wood', PAL.wood, false)] }; },
  bench() { return { w: 1.4, d: 0.45, boxes: [B(0, 1.4, 0, 0.45, 0, 0.45, 'wood', PAL.wood, false)] }; },
  console_() { return { w: 1.0, d: 0.35, boxes: [B(0, 1.0, 0, 0.35, 0, 0.8, 'wood', PAL.dwood)] }; },

  marketShelf(rng) { const w = 2.6 + rng() * 0.8, bx = [B(0, w, 0, 0.55, 0, 1.75, 'dark', [0.72, 0.74, 0.78])]; for (let i = 0; i < 4; i++) { const y = 0.22 + i * 0.4; let a = 0.05; while (a < w - 0.3) { const ww = 0.18 + rng() * 0.3; if (a + ww > w - 0.05) break; bx.push(B(a, a + ww, 0.05, 0.5, y, y + 0.28, 'carpet', [0.4 + rng() * 0.6, 0.3 + rng() * 0.6, 0.25 + rng() * 0.6], false)); a += ww + 0.05; } } return { w, d: 0.55, boxes: bx }; },
  fridgeWall() { return { w: 2.4, d: 0.75, boxes: [B(0, 2.4, 0, 0.75, 0, 1.95, 'walltile', [0.78, 0.9, 1.0]), B(0.05, 2.35, 0.7, 0.78, 0.15, 1.85, 'dark', [0.45, 0.6, 0.75], false)] }; },
  checkout() { return { w: 1.7, d: 0.9, boxes: [B(0, 1.7, 0, 0.9, 0, 0.9, 'dark', [0.3, 0.3, 0.34]), B(0, 1.2, 0.05, 0.85, 0.9, 0.95, 'dark', [0.08, 0.08, 0.09], false), B(1.25, 1.6, 0.2, 0.6, 0.95, 1.25, 'dark', [0.15, 0.15, 0.18], false)] }; },
  tray() { return { w: 3.4, d: 0.8, boxes: [B(0, 3.4, 0, 0.8, 0, 1.0, 'wood', [0.85, 0.2, 0.15]), B(0, 3.4, 0, 0.9, 1.0, 1.06, 'dark', [0.85, 0.85, 0.85], false), B(0.3, 3.1, 0.0, 0.1, 1.9, 2.4, 'dark', [0.95, 0.75, 0.1], false)] }; },
  diningTable(rng) { const c = [[0.8, 0.2, 0.15], [0.95, 0.75, 0.15], [0.25, 0.4, 0.3]][(rng() * 3) | 0]; return { w: 1.8, d: 1.5, boxes: [B(0.3, 1.5, 0.35, 1.15, 0.72, 0.78, 'wood', PAL.wood, false), B(0.7, 0.8, 0.7, 0.8, 0, 0.72, 'dark', PAL.dark, false), B(0.3, 1.5, 0.0, 0.3, 0, 0.45, 'carpet', c, false), B(0.3, 1.5, 1.2, 1.5, 0, 0.45, 'carpet', c, false)] }; },
  diyRack(rng) { const w = 2.4, bx = [B(0, w, 0, 0.9, 0, 2.7, 'dark', [0.9, 0.5, 0.15])]; for (let i = 0; i < 3; i++) { const y = 0.3 + i * 0.8; bx.push(B(0.1, w - 0.1, 0.1, 0.82, y, y + 0.6, 'wood', [0.6 + rng() * 0.3, 0.5, 0.35], false)); } return { w, d: 0.9, boxes: bx }; },
  pallet(rng) { return { w: 1.3, d: 1.3, boxes: [B(0, 1.3, 0, 1.3, 0, 0.15, 'wood', PAL.wood), B(0.05, 1.25, 0.05, 1.25, 0.15, 0.9 + rng() * 0.8, 'wood', [0.7, 0.58, 0.4])] }; },
  workbench() { return { w: 2.0, d: 0.7, boxes: [B(0, 2.0, 0, 0.7, 0, 0.9, 'dark', [0.4, 0.42, 0.45]), B(0, 2.0, 0, 0.75, 0.9, 0.95, 'wood', PAL.wood, false)] }; },
  rack() { return { w: 2.2, d: 0.6, boxes: [B(0, 2.2, 0, 0.6, 0, 2.3, 'dark', [0.55, 0.58, 0.62]), B(0.1, 2.1, 0.05, 0.55, 0.6, 1.0, 'wood', [0.5, 0.4, 0.3], false)] }; },
  barrel() { return { w: 0.7, d: 0.7, boxes: [B(0.05, 0.65, 0.05, 0.65, 0, 0.95, 'dark', [0.2, 0.35, 0.55])] }; },
  bunk() { return { w: 0.95, d: 2.1, boxes: [B(0, 0.95, 0, 2.1, 0.3, 0.42, 'dark', [0.45, 0.47, 0.5]), B(0, 0.95, 0, 2.1, 1.3, 1.42, 'dark', [0.45, 0.47, 0.5]), B(0, 0.08, 0, 0.08, 0, 1.5, 'dark', [0.3, 0.3, 0.32], false), B(0.87, 0.95, 2.02, 2.1, 0, 1.5, 'dark', [0.3, 0.3, 0.32], false)] }; },
  recDesk() { return { w: 2.4, d: 0.8, boxes: [B(0, 2.4, 0, 0.8, 0, 1.1, 'dark', [0.35, 0.4, 0.36]), B(0, 2.4, 0, 0.9, 1.1, 1.15, 'wood', PAL.wood, false)] }; },

  // ---- design pack pieces (brand zones from manifest.json) -------------------------------------------------------------
  poster(rect, w = 1.5, y0 = 1.2) { const h = w / 1.5; return { w, d: 0.06, boxes: [B(-0.04, w + 0.04, 0, 0.03, y0 - 0.04, y0 + h + 0.04, 'dark', [0.12, 0.12, 0.13], false), B(0, w, 0, 0.055, y0, y0 + h, rect, [1.05, 1.05, 1.05], false)] }; },
  // McDonald's: order counter with light-wood front + menu boards, self-order kiosks, red booths with yellow chairs
  mcdCounter() { return { w: 4.0, d: 0.8, boxes: [B(0, 4.0, 0, 0.8, 0, 1.0, 'wood', [1.05, 0.95, 0.8]), B(0, 4.0, 0, 0.85, 1.0, 1.06, 'dark', [0.16, 0.16, 0.18], false), B(0.1, 3.9, 0, 0.1, 1.06, 1.9, 'dark', [0.5, 0.5, 0.52], false),
    B(0.2, 1.2, 0, 0.12, 2.0, 2.5, 'bMcdR', [1, 1, 1], false), B(1.35, 2.55, 0, 0.12, 2.0, 2.5, 'bMcdY', [1, 1, 1], false), B(2.7, 3.8, 0, 0.12, 2.0, 2.5, 'bMcdR', [1, 1, 1], false), B(0.4, 0.8, 0.25, 0.55, 1.06, 1.3, 'dark', [0.08, 0.08, 0.09], false)] }; },
  mcdKiosk() { const bx = []; for (let i = 0; i < 3; i++) { const a = i * 0.75; bx.push(B(a, a + 0.5, 0, 0.3, 0, 1.6, 'dark', [0.12, 0.12, 0.14]), B(a + 0.05, a + 0.45, 0.28, 0.32, 0.95, 1.5, 'bWhite', [0.45, 0.75, 1.1], false), B(a, a + 0.5, 0, 0.3, 1.6, 1.7, 'bMcdR', [1, 1, 1], false)); } return { w: 2.0, d: 0.32, boxes: bx }; },
  redBooth(rng) { const w = 2.0; return { w, d: 1.9, boxes: [B(0, w, 0, 0.55, 0, 0.45, 'bMcdR', [1, 0.95, 0.95]), B(0, w, 0, 0.18, 0.45, 1.15, 'bMcdR', [0.95, 0.9, 0.9]), B(0.2, 1.8, 0.7, 1.3, 0.72, 0.78, 'wood', [1.1, 0.98, 0.8], false), B(0.95, 1.05, 0.95, 1.05, 0, 0.72, 'dark', PAL.dark, false), B(0, w, 1.4, 1.9, 0, 0.45, 'bMcdY', [1, 1, 1], false), B(0, w, 1.75, 1.9, 0.45, 0.85, 'bMcdY', [1, 1, 1], false)] }; },
  yellowTable() { return { w: 1.7, d: 1.4, boxes: [B(0.3, 1.4, 0.3, 1.1, 0.72, 0.78, 'wood', [1.1, 0.98, 0.8], false), B(0.8, 0.9, 0.65, 0.75, 0, 0.72, 'dark', PAL.dark, false), B(0.4, 0.8, 0.0, 0.3, 0, 0.8, 'bMcdY', [1, 1, 1], false), B(0.9, 1.3, 1.1, 1.4, 0, 0.8, 'bMcdY', [1, 1, 1], false)] }; },
  // Puzata Hata: serving line (glass guard, pots), carved wooden table with benches, embroidery band
  servingLine() { const bx = [B(0, 4.4, 0, 0.8, 0, 0.9, 'bPuz', [0.95, 1, 0.95]), B(0, 4.4, 0, 0.9, 0.9, 0.95, 'dark', [0.8, 0.8, 0.82], false), B(0, 4.4, 0.78, 1.15, 0.75, 0.82, 'wood', [0.9, 0.8, 0.6], false), B(0, 4.4, 0, 0.8, 1.55, 1.6, 'dark', [0.8, 0.9, 0.95], false), B(0, 0.05, 0, 0.8, 0.95, 1.6, 'dark', [0.7, 0.72, 0.75], false), B(4.35, 4.4, 0, 0.8, 0.95, 1.6, 'dark', [0.7, 0.72, 0.75], false)];
    const pots = [[0.8, 0.2, 0.15], [0.95, 0.85, 0.5], [0.85, 0.55, 0.2], [0.95, 0.95, 0.9], [0.7, 0.25, 0.15], [0.45, 0.65, 0.3]]; for (let i = 0; i < 6; i++) bx.push(B(0.2 + i * 0.7, 0.7 + i * 0.7, 0.15, 0.65, 0.95, 1.12, 'dark', pots[i], false));
    bx.push(B(0, 4.4, 0, 0.12, 2.1, 2.45, 'pPuzI', [0.9, 0.9, 0.9], false)); return { w: 4.4, d: 1.15, boxes: bx }; },
  woodTable() { return { w: 2.2, d: 1.5, boxes: [B(0.2, 2.0, 0.4, 1.1, 0.72, 0.78, 'wood', [1.0, 0.85, 0.6], false), B(0.3, 0.4, 0.5, 0.6, 0, 0.72, 'dark', PAL.dwood, false), B(1.8, 1.9, 0.9, 1.0, 0, 0.72, 'dark', PAL.dwood, false), B(0.2, 2.0, 0.0, 0.3, 0, 0.46, 'wood', [0.75, 0.55, 0.35], false), B(0.2, 2.0, 1.2, 1.5, 0, 0.46, 'wood', [0.75, 0.55, 0.35], false)] }; },
  embroidery() { const w = 3.2, bx = [B(0, w, 0, 0.05, 1.6, 2.0, 'bWhite', [1, 0.97, 0.9], false)]; for (let i = 0; i < 12; i++) bx.push(B(0.05 + i * 0.26, 0.2 + i * 0.26, 0, 0.065, 1.68, 1.92, i % 2 ? 'bMcdR' : 'bPuz', i % 2 ? [0.9, 0.2, 0.2] : [0.7, 0.2, 0.2], false)); return { w, d: 0.07, boxes: bx }; },
  carvedShelf() { return { w: 1.6, d: 0.4, boxes: [B(0, 1.6, 0, 0.4, 0, 1.9, 'wood', [0.62, 0.3, 0.2]), B(0.05, 1.55, 0.35, 0.42, 0.3, 0.62, 'carpet', [0.9, 0.7, 0.3], false), B(0.05, 1.55, 0.35, 0.42, 0.9, 1.2, 'carpet', [0.85, 0.3, 0.25], false), B(0.05, 1.55, 0.35, 0.42, 1.5, 1.8, 'carpet', [0.9, 0.9, 0.8], false)] }; },
  // Silpo: produce bins, green-labelled fridges, checkouts with orange stripe, bakery
  produce(rng) { const w = 2.6, bx = [B(0, w, 0, 0.9, 0, 0.6, 'wood', [0.85, 0.65, 0.4]), B(0, w, 0.9, 1.0, 0.0, 0.9, 'bSilG', [0.9, 1, 0.9], false)]; const cols = [[0.85, 0.15, 0.1], [0.95, 0.65, 0.1], [0.3, 0.65, 0.2], [0.9, 0.8, 0.2], [0.8, 0.3, 0.1]]; for (let i = 0; i < 5; i++) bx.push(B(0.08 + i * 0.5, 0.52 + i * 0.5, 0.1, 0.8, 0.6, 0.75 + rng() * 0.1, 'carpet', cols[i], false)); return { w, d: 1.0, boxes: bx }; },
  silFridge() { return { w: 2.6, d: 0.8, boxes: [B(0, 2.6, 0, 0.8, 0, 1.95, 'walltile', [0.8, 0.92, 1.0]), B(0.05, 2.55, 0.76, 0.84, 0.15, 1.8, 'dark', [0.4, 0.55, 0.7], false), B(0, 2.6, 0.2, 0.8, 1.95, 2.25, 'bSilG', [1, 1, 1], false), B(0.05, 2.55, 0.8, 0.86, 1.82, 1.9, 'bSilO', [1, 1, 1], false)] }; },
  silCheckout() { return { w: 1.8, d: 0.9, boxes: [B(0, 1.8, 0, 0.9, 0, 0.9, 'dark', [0.28, 0.3, 0.32]), B(0, 1.8, 0, 0.9, 0.9, 0.95, 'dark', [0.08, 0.08, 0.09], false), B(0, 1.8, 0, 0.9, 0.55, 0.62, 'bSilO', [1, 1, 1], false), B(1.3, 1.7, 0.2, 0.6, 0.95, 1.25, 'dark', [0.12, 0.14, 0.16], false), B(0.8, 1.0, 0.05, 0.1, 1.9, 2.3, 'bSilG', [1, 1, 1], false)] }; },
  bakery() { return { w: 2.4, d: 0.7, boxes: [B(0, 2.4, 0, 0.7, 0, 0.95, 'wood', [0.9, 0.75, 0.5]), B(0, 2.4, 0, 0.7, 0.95, 1.5, 'dark', [0.85, 0.92, 0.95], false), B(0.2, 0.7, 0.1, 0.6, 0.95, 1.12, 'carpet', [0.82, 0.58, 0.28], false), B(0.9, 1.5, 0.1, 0.6, 0.95, 1.1, 'carpet', [0.9, 0.7, 0.4], false), B(1.7, 2.2, 0.1, 0.6, 0.95, 1.15, 'carpet', [0.7, 0.45, 0.25], false)] }; },
  silShelf(rng) { const p = PIECES.marketShelf(rng); p.boxes.push(B(0, p.w, 0, 0.55, 1.75, 1.95, 'bSilG', [1, 1, 1], false)); return p; },
  // Epicentr: tall racks (yellow beams, green uprights), paint wall, lighting department, lumber
  tallRack(rng) { const w = 2.8, bx = [B(0, 0.1, 0, 0.9, 0, 3.4, 'bEpiG', [1, 1, 1]), B(w - 0.1, w, 0, 0.9, 0, 3.4, 'bEpiG', [1, 1, 1]), B(0, w, 0.85, 0.9, 0, 3.4, 'dark', [0.55, 0.57, 0.6], false)]; for (let i = 0; i < 4; i++) { const y = 0.25 + i * 0.85; bx.push(B(0, w, 0, 0.9, y, y + 0.07, 'bEpiY', [1, 1, 1], false)); let a = 0.15; while (a < w - 0.5) { const ww = 0.35 + rng() * 0.45; if (a + ww > w - 0.12) break; bx.push(B(a, a + ww, 0.08, 0.8, y + 0.07, y + 0.07 + 0.35 + rng() * 0.3, 'carpet', [0.55 + rng() * 0.4, 0.45 + rng() * 0.3, 0.3 + rng() * 0.3], false)); a += ww + 0.08; } } return { w, d: 0.9, boxes: bx }; },
  paintWall(rng) { const w = 3.0, bx = [B(0, w, 0, 0.5, 0, 2.2, 'dark', [0.82, 0.83, 0.85])]; const cols = [[0.9, 0.2, 0.15], [0.2, 0.45, 0.85], [0.95, 0.85, 0.2], [0.2, 0.65, 0.3], [0.95, 0.95, 0.95], [0.8, 0.45, 0.15]]; for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) bx.push(B(0.1 + i * 0.4, 0.4 + i * 0.4, 0.4, 0.55, 0.15 + r * 0.5, 0.45 + r * 0.5, 'carpet', cols[(i + r * 2 + ((rng() * 3) | 0)) % 6], false)); return { w, d: 0.55, boxes: bx }; },
  lightWall() { const bx = [B(0, 3.0, 0, 0.3, 0, 2.2, 'dark', [0.85, 0.86, 0.88])]; for (let i = 0; i < 5; i++) { const a = 0.1 + i * 0.57; bx.push(B(a, a + 0.4, 0.3, 0.55, 1.4 + (i % 2) * 0.3, 1.75 + (i % 2) * 0.3, 'bWhite', [1.2, 1.15, 0.9], false), B(a + 0.15, a + 0.25, 0.3, 0.4, 1.75 + (i % 2) * 0.3, 2.2, 'dark', PAL.dark, false)); } for (let i = 0; i < 5; i++) bx.push(B(0.1 + i * 0.57, 0.5 + i * 0.57, 0.3, 0.5, 0.4, 0.8, 'bWhite', [1.2, 1.2, 1.1], false)); return { w: 3.0, d: 0.55, boxes: bx }; },
  lumber(rng) { const bx = []; for (let k = 0; k < 6; k++) bx.push(B(0, 2.4, 0, 1.0, 0.1 + k * 0.17, 0.25 + k * 0.17, 'wood', [0.85 + rng() * 0.2, 0.7 + rng() * 0.15, 0.5], false)); bx.push(B(0.1, 0.3, 0, 1.0, 0, 0.1, 'dark', PAL.dwood, false), B(2.1, 2.3, 0, 1.0, 0, 0.1, 'dark', PAL.dwood, false)); return { w: 2.4, d: 1.0, boxes: bx }; },
  // Workplaces: open-space with desk islands + glass meeting room, warehouse docks / racks / forklift pallets, staff room with lockers + rest table
  deskIsland(rng) { const bx = []; for (const o of [0, 1.5]) { bx.push(B(o, o + 1.4, 0, 0.75, 0.7, 0.75, 'wood', [1.0, 0.88, 0.7], false), B(o + 0.03, o + 0.08, 0.03, 0.72, 0, 0.7, 'dark', PAL.dark, false), B(o + 1.3, o + 1.35, 0.03, 0.72, 0, 0.7, 'dark', PAL.dark, false), B(o + 0.45, o + 0.95, 0.1, 0.14, 0.75, 1.15, 'dark', [0.08, 0.09, 0.1], false), B(o + 0.45, o + 0.9, 0.85, 1.3, 0, 0.5, 'dark', PAL.dark, false)); } return { w: 2.9, d: 1.3, boxes: bx }; },
  glassWall() { return { w: 2.8, d: 0.08, boxes: [B(0, 2.8, 0, 0.08, 0, 0.1, 'dark', [0.3, 0.32, 0.34], false), B(0, 2.8, 0.02, 0.06, 0.1, 2.1, 'bWhite', [0.62, 0.8, 0.9], false), B(0, 0.06, 0, 0.08, 0, 2.1, 'dark', [0.3, 0.32, 0.34], false), B(2.74, 2.8, 0, 0.08, 0, 2.1, 'dark', [0.3, 0.32, 0.34], false)] }; },
  waterCooler() { return { w: 0.4, d: 0.4, boxes: [B(0, 0.4, 0, 0.4, 0, 0.95, 'bWhite', [0.9, 0.92, 0.95]), B(0.08, 0.32, 0.08, 0.32, 0.95, 1.4, 'bWhite', [0.5, 0.75, 1.0], false)] }; },
  dockRack(rng) { const w = 2.6, bx = [B(0, 0.08, 0, 0.8, 0, 2.7, 'dark', [0.16, 0.36, 0.7]), B(w - 0.08, w, 0, 0.8, 0, 2.7, 'dark', [0.16, 0.36, 0.7])]; for (let i = 0; i < 3; i++) { const y = 0.2 + i * 0.85; bx.push(B(0, w, 0, 0.8, y, y + 0.07, 'dark', [0.9, 0.5, 0.15], false), B(0.15 + rng() * 0.2, 1.1 + rng() * 0.3, 0.08, 0.72, y + 0.07, y + 0.6, 'wood', [0.78, 0.62, 0.42], false), B(1.35, 2.3, 0.08, 0.72, y + 0.07, y + 0.5, 'wood', [0.72, 0.58, 0.4], false)); } return { w, d: 0.8, boxes: bx }; },
  crates(rng) { const bx = [B(0, 1.3, 0, 1.3, 0, 0.15, 'wood', PAL.wood)]; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) bx.push(B(0.05 + i * 0.62, 0.62 + i * 0.62, 0.05 + j * 0.62, 0.62 + j * 0.62, 0.15, 0.75 + rng() * 0.3, 'wood', [0.8, 0.62, 0.4])); return { w: 1.3, d: 1.3, boxes: bx }; },
  lockers() { const bx = []; for (let i = 0; i < 6; i++) bx.push(B(i * 0.45, i * 0.45 + 0.43, 0, 0.5, 0, 1.9, 'dark', [0.82, 0.74, 0.55]), B(i * 0.45 + 0.03, i * 0.45 + 0.4, 0.5, 0.52, 1.2, 1.28, 'dark', [0.4, 0.38, 0.32], false), B(i * 0.45 + 0.34, i * 0.45 + 0.38, 0.5, 0.54, 1.0, 1.12, 'dark', [0.25, 0.25, 0.25], false)); return { w: 2.7, d: 0.54, boxes: bx }; },
  restTable() { return { w: 2.2, d: 1.4, boxes: [B(0.3, 1.9, 0.3, 1.1, 0.72, 0.78, 'dark', [0.55, 0.57, 0.6], false), B(0.4, 0.5, 0.4, 0.5, 0, 0.72, 'dark', PAL.dark, false), B(1.7, 1.8, 0.9, 1.0, 0, 0.72, 'dark', PAL.dark, false), B(0.4, 0.8, 0.0, 0.3, 0, 0.45, 'dark', PAL.dark, false), B(1.2, 1.6, 0.0, 0.3, 0, 0.45, 'dark', PAL.dark, false), B(0.4, 0.8, 1.1, 1.4, 0, 0.45, 'dark', PAL.dark, false), B(1.2, 1.6, 1.1, 1.4, 0, 0.45, 'dark', PAL.dark, false)] }; },
  kettleBar() { return { w: 1.8, d: 0.6, boxes: [B(0, 1.8, 0, 0.6, 0, 0.9, 'walltile', [0.9, 0.9, 0.88]), B(0, 1.8, 0, 0.62, 0.9, 0.95, 'dark', [0.2, 0.2, 0.22], false), B(0.2, 0.5, 0.15, 0.4, 0.95, 1.2, 'bWhite', [0.9, 0.9, 0.95], false), B(1.0, 1.5, 0.1, 0.45, 0.95, 1.3, 'dark', [0.1, 0.1, 0.1], false)] }; },
  coatRack() { return { w: 1.6, d: 0.2, boxes: [B(0, 1.6, 0, 0.04, 1.5, 1.56, 'dark', PAL.dark, false), B(0.1, 0.45, 0.02, 0.2, 0.7, 1.5, 'dark', [0.2, 0.22, 0.3], false), B(0.6, 0.95, 0.02, 0.2, 0.75, 1.5, 'dark', [0.16, 0.2, 0.16], false), B(1.1, 1.45, 0.02, 0.2, 0.7, 1.5, 'dark', [0.3, 0.2, 0.15], false)] }; },
  plant() { return { w: 0.5, d: 0.5, boxes: [B(0.1, 0.4, 0.1, 0.4, 0, 0.35, 'dark', [0.5, 0.3, 0.2], false), B(0.0, 0.5, 0.0, 0.5, 0.35, 1.3, 'carpet', [0.2, 0.55, 0.25], false)] }; },
};
const PLAN = {
  mcd: ['mcdCounter', 'mcdKiosk', 'redBooth', 'redBooth', 'poster:pMcdI', 'yellowTable', 'redBooth', 'mcdKiosk', 'yellowTable', 'plant'],
  puzata: ['servingLine', 'embroidery', 'woodTable', 'woodTable', 'poster:pPuzI', 'carvedShelf', 'woodTable', 'plant'],
  silpo: ['produce', 'silFridge', 'silShelf', 'produce', 'silCheckout', 'poster:pSilI', 'silShelf', 'silCheckout', 'bakery', 'silShelf', 'plant'],
  epicentr: ['tallRack', 'paintWall', 'tallRack', 'lightWall', 'poster:pEpiI', 'lumber', 'tallRack', 'checkout', 'tallRack', 'pallet'],
  wkoffice: ['deskIsland', 'poster:pOffI', 'deskIsland', 'glassWall', 'cabinet', 'waterCooler', 'deskIsland', 'plant'],
  wkdepot: ['dockRack', 'crates', 'poster:pWarE', 'dockRack', 'crates', 'pallet', 'barrel', 'workbench'],
  staff: ['lockers', 'restTable', 'poster:pStaI', 'kettleBar', 'coatRack', 'bench'],
  market: ['marketShelf', 'fridgeWall', 'marketShelf', 'checkout', 'marketShelf', 'marketShelf', 'checkout', 'plant'],
  fastfood: ['tray', 'diningTable', 'diningTable', 'diningTable', 'diningTable', 'plant'],
  dining: ['bar', 'diningTable', 'diningTable', 'diningTable', 'diningTable', 'plant'],
  diy: ['diyRack', 'diyRack', 'pallet', 'diyRack', 'pallet', 'diyRack', 'checkout', 'pallet'],
  depot: ['workbench', 'rack', 'pallet', 'rack', 'barrel', 'pallet'],
  reception: ['recDesk', 'bench', 'cabinet'],
  cell: ['bunk', 'bunk', 'toilet'],
  living: ['sofa', 'tvstand', 'shelf', 'table', 'plant', 'nightstand'],
  bedroom: ['bed', 'wardrobe', 'nightstand', 'shelf', 'plant'],
  kitchen: ['counter', 'fridge', 'table', 'shelf'],
  bathroom: ['bathtub', 'toilet', 'sink'],
  office: ['desk', 'desk', 'cabinet', 'desk', 'plant', 'cabinet', 'desk'],
  meeting: ['meetTable', 'poster:pOffI', 'shelf', 'plant', 'cabinet'],
  shop: ['shopShelf', 'shopShelf', 'shopCounter', 'shopShelf', 'shopShelf', 'plant'],
  cafe: ['bar', 'cafeTable', 'cafeTable', 'cafeTable', 'cafeTable', 'plant'],
  hallway: ['bench', 'console_', 'plant'],
};

// place furniture against the walls of a leaf rect (uv). ctx: { inside(u,v), clear: [[u,v,r]], rng, placed: [[u0,u1,v0,v1]] }
export function furnish(type, R, ctx) {
  const out = [], rng = ctx.rng, names = PLAN[type] || [];
  const W = R.u1 - R.u0, H = R.v1 - R.v0; if (W < 2.0 || H < 2.0) return out;
  const maxN = Math.min(names.length, Math.floor((W + H) / 2.2) + 1);
  const sides = [0, 1, 2, 3];
  for (let k = 0, n = 0; k < names.length && n < maxN; k++) {
    const nm = names[k], pc = nm.startsWith('poster:') ? PIECES.poster(nm.slice(7), 1.5 + rng() * 0.3) : PIECES[nm](rng);
    // random start side order
    const order = sides.slice(); for (let i = 3; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
    let placed = false;
    for (const s of order) {
      const len = (s < 2 ? W : H);
      if (pc.w + 0.5 > len) continue;
      for (let tries = 0; tries < 8 && !placed; tries++) {
        const a = 0.3 + rng() * Math.max(0.001, len - pc.w - 0.6);
        // footprint in uv
        let u0, u1, v0, v1; const off = WALL_D + 0.03;
        if (s === 0) { u0 = R.u0 + a; u1 = u0 + pc.w; v0 = R.v0 + off; v1 = v0 + pc.d; }
        else if (s === 1) { u0 = R.u0 + a; u1 = u0 + pc.w; v1 = R.v1 - off; v0 = v1 - pc.d; }
        else if (s === 2) { v0 = R.v0 + a; v1 = v0 + pc.w; u0 = R.u0 + off; u1 = u0 + pc.d; }
        else { v0 = R.v0 + a; v1 = v0 + pc.w; u1 = R.u1 - off; u0 = u1 - pc.d; }
        if (u0 < R.u0 + 0.12 || u1 > R.u1 - 0.12 || v0 < R.v0 + 0.12 || v1 > R.v1 - 0.12) continue;
        // inside polygon (corners + mid) with margin 0.25
        let ok = true; const m = 0.2;
        for (const [pu, pv] of [[u0 - m, v0 - m], [u1 + m, v0 - m], [u1 + m, v1 + m], [u0 - m, v1 + m], [(u0 + u1) / 2, (v0 + v1) / 2], [(u0 + u1) / 2, v0 - m], [(u0 + u1) / 2, v1 + m], [u0 - m, (v0 + v1) / 2], [u1 + m, (v0 + v1) / 2]]) if (!ctx.inside(pu, pv)) { ok = false; break; }
        if (!ok) continue;
        for (const [cu, cv, cr] of ctx.clear) { const du = Math.max(u0 - cu, 0, cu - u1), dv = Math.max(v0 - cv, 0, cv - v1); if (du * du + dv * dv < cr * cr) { ok = false; break; } }
        if (!ok) continue;
        for (const q of ctx.placed) if (u0 < q[1] + 0.35 && u1 > q[0] - 0.35 && v0 < q[3] + 0.35 && v1 > q[2] - 0.35) { ok = false; break; }
        if (!ok) continue;
        ctx.placed.push([u0, u1, v0, v1]);
        for (const b of pc.boxes) {
          let bu0, bu1, bv0, bv1;
          if (s === 0) { bu0 = u0 + b.a0; bu1 = u0 + b.a1; bv0 = v0 + b.b0; bv1 = v0 + b.b1; }
          else if (s === 1) { bu0 = u0 + b.a0; bu1 = u0 + b.a1; bv1 = v1 - b.b0; bv0 = v1 - b.b1; }
          else if (s === 2) { bv0 = v0 + b.a0; bv1 = v0 + b.a1; bu0 = u0 + b.b0; bu1 = u0 + b.b1; }
          else { bv0 = v0 + b.a0; bv1 = v0 + b.a1; bu1 = u1 - b.b0; bu0 = u1 - b.b1; }
          out.push({ u0: bu0, u1: bu1, v0: bv0, v1: bv1, y0: b.y0, y1: b.y1, rect: b.rect, color: b.color, solid: b.solid && b.y1 > 0.5 });
        }
        placed = true; n++;
      }
      if (placed) break;
    }
  }
  return out;
}
