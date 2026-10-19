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
  sushi:    { name: 'суши-бар', floor: 'plank', wall: 'plaster', ceil: 'ceiling', wallT: [1.0, 0.8, 0.76], ceilT: [0.8, 0.72, 0.7], floorT: [0.9, 0.78, 0.7], win: true },
  mcd:      { name: 'McDonald\'s-стиль: зал', floor: 'tiles', wall: 'plaster', ceil: 'ceiling', wallT: [1.0, 0.86, 0.74], ceilT: [0.9, 0.88, 0.86], floorT: [0.9, 0.9, 0.95], win: true },
  puzata:   { name: 'столовая (раздача)', floor: 'plank', wall: 'plaster', ceil: 'plank', wallT: [0.74, 0.92, 0.7], ceilT: [0.95, 0.82, 0.7], floorT: [1, 0.9, 0.78], win: true },
  silpo:    { name: 'супермаркет', floor: 'stone', wall: 'plaster', ceil: 'ceiling', wallT: [0.9, 1.0, 0.92], ceilT: [0.66, 0.68, 0.68], floorT: [1.12, 1.12, 1.1], win: true },
  epicentr: { name: 'гипермаркет для дома', floor: 'stone', wall: 'plaster', ceil: 'ceiling', wallT: [1.0, 0.97, 0.72], ceilT: [0.78, 0.8, 0.8], floorT: [0.95, 0.95, 0.92], win: true },
  apteka:   { name: 'аптека', floor: 'tiles', wall: 'walltile', ceil: 'ceiling', wallT: [0.95, 1.02, 0.98], ceilT: [1.08, 1.1, 1.1], floorT: [1.12, 1.14, 1.14], win: true },
  kava:     { name: 'кав\'ярня', floor: 'parquet', wall: 'brick', ceil: 'ceiling', wallT: [0.95, 0.8, 0.68], ceilT: [0.62, 0.5, 0.42], floorT: [0.9, 0.82, 0.74], win: true },
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
const THEMES = { apteka: 'apteka', kava: 'kava', market: 'market', fastfood: 'fastfood', dining: 'dining', diy: 'diy', sushi: 'sushi', mcd: 'mcd', puzata: 'puzata', silpo: 'silpo', epicentr: 'epicentr', util: 'wkoffice', depot: 'wkdepot', prison: 'cell' };
const PUBLIC = new Set(['apteka', 'kava', 'sushi', 'market', 'fastfood', 'dining', 'diy', 'mcd', 'puzata', 'silpo', 'epicentr']);
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
  if (level > 0) return leaves.map(() => pub ? ((cat === 'market' || cat === 'silpo' || cat === 'diy' || cat === 'epicentr') ? 'wkdepot' : 'staff') : cat === 'depot' ? 'staff' : 'office');   // shops: storage / staff rooms upstairs
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
// NPC / job spots in piece-local coords: k = kind (staff stations: reg/grill/fryer/prep/drinks/till/serve/kitchen/cash/rice/roll/cut;
// customers: cust/queue/pickup/pay/line/shelf/seat; stock), (a, b) position, (fa, fb) facing; seat = sitting (y lowered)
const SP = (k, a, b, fa, fb, seat) => ({ k, a, b, fa, fb, seat: !!seat });
const STEEL = [0.66, 0.68, 0.72];
const withSpots = (pc, spots) => { pc.spots = spots; return pc; };
// staff aisle of the service lines widened (player radius 0.4 must pass behind the counter, also with a phone joystick): the counter part
// (b >= 1.4) moves away from the back unit, the closed aisle end grows with it; staff spots facing the counter move along, those facing the back stay
const widen = (pc, add = 0.3) => { for (const b of pc.boxes) { if (b.b0 >= 1.4) { b.b0 += add; b.b1 += add; } else if (b.b1 >= 1.45) b.b1 += add; }
  for (const q of pc.spots || []) if (q.b >= 1.4 || q.fb > 0) q.b += add; for (const g of pc.signs || []) if (g.b >= 1.4) g.b += add; pc.d += add; return pc; };
// compact variant of a service line for small halls: no queue area in front, the counter 0.1 m closer to the back (aisle stays >= 1.1 m)
const compact = (pc, cut = 0.1) => { for (const b of pc.boxes) { if (b.b0 >= 1.5) { b.b0 -= cut; b.b1 -= cut; } else if (b.b1 >= 1.55) b.b1 -= cut; }
  pc.spots = (pc.spots || []).filter(q => q.k !== 'queue').map(q => q.b >= 1.5 ? Object.assign(q, { b: q.b - cut }) : q); for (const g of pc.signs || []) if (g.b >= 1.5) g.b -= cut; pc.d -= cut + 0.7; return pc; };
const front = (pc, k = 'shelf') => withSpots(pc, [SP(k, pc.w / 2, pc.d + 0.55, 0, -1)]);

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
  // street shop counter with a seller behind it: goods shelf at the wall, 1.15 m staff aisle, counter with a till, open end on the right
  // narrow kiosk / strip hall (depth < 3.5 m): small counter across the short wall, seller behind it, open end for the staff
  kioskBar(rng) { const w = 2.0, C = 1.05, bx = [B(0.05, 1.95, 0, 0.35, 0, 1.8, 'wood', [0.6, 0.44, 0.3])];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) bx.push(B(0.12 + i * 0.3, 0.32 + i * 0.3, 0.18, 0.36, 0.3 + r * 0.5, 0.48 + r * 0.5 + rng() * 0.08, 'carpet', [0.45 + rng() * 0.5, 0.35 + rng() * 0.5, 0.25 + rng() * 0.5], false));
    bx.push(B(0, 0.08, 0.35, 1.45, 0, 1.0, 'wood', [0.75, 0.58, 0.4]), B(0, C, 1.45, 2.05, 0, 1.0, 'wood', [0.75, 0.58, 0.4]), B(0, C, 1.4, 2.1, 1.0, 1.05, 'dark', [0.15, 0.15, 0.17], false), B(0.3, 0.7, 1.55, 1.85, 1.05, 1.3, 'dark', PAL.dark, false));
    return { w, d: 2.1, boxes: bx, spots: [SP('cash', 0.5, 1.05, 0, 1), SP('cust', 0.5, 2.6, 0, -1)] }; },
  shopCounter(rng) { const w = 3.0, C = 2.0, bx = [B(0.1, 2.9, 0, 0.35, 0, 1.9, 'wood', [0.62, 0.46, 0.3])];
    for (let r = 0; r < 4; r++) { let a = 0.15; const y = 0.2 + r * 0.42; while (a < 2.8) { const ww = 0.12 + rng() * 0.2; if (a + ww > 2.85) break; bx.push(B(a, a + ww, 0.22, 0.36, y, y + 0.14 + rng() * 0.14, 'carpet', [0.4 + rng() * 0.6, 0.35 + rng() * 0.5, 0.25 + rng() * 0.5], false)); a += ww + 0.04; } }
    bx.push(B(0, 0.08, 0.35, 1.5, 0, 1.0, 'wood', [0.78, 0.6, 0.4]), B(0, C, 1.5, 2.15, 0, 1.0, 'wood', [0.78, 0.6, 0.4]), B(0, C, 1.45, 2.2, 1.0, 1.05, 'dark', [0.15, 0.15, 0.17], false), B(0.75, 1.15, 1.6, 1.9, 1.05, 1.3, 'dark', PAL.dark, false));
    return { w, d: 2.2, boxes: bx, spots: [SP('cash', 0.95, 1.05, 0, 1), SP('cust', 0.95, 2.75, 0, -1)] }; },
  cafeTable(rng) { const c = [[0.65, 0.2, 0.2], [0.2, 0.4, 0.55], [0.3, 0.5, 0.3]][(rng() * 3) | 0]; return withSpots({ w: 1.7, d: 0.95, boxes: [B(0.45, 1.25, 0.1, 0.9, 0.72, 0.77, 'wood', PAL.wood, false), B(0.8, 0.9, 0.45, 0.55, 0, 0.72, 'dark', PAL.dark, false), B(0.15, 0.5, 0.3, 0.7, 0, 0.46, 'carpet', c, false), B(1.2, 1.55, 0.3, 0.7, 0, 0.46, 'carpet', c, false)] }, [SP('seat', 0.32, 0.5, 1, 0, 1), SP('seat', 1.37, 0.5, -1, 0, 1)]); },
  // cafe bar: bottle / cup shelf at the wall, staff aisle, bar counter; the barista takes orders at the till
  bar(rng) { const w = 3.4, C = 2.4, bx = [B(0.1, 3.3, 0, 0.35, 0, 0.9, 'dark', [0.3, 0.2, 0.15]), B(0.1, 3.3, 0, 0.36, 0.9, 0.95, 'wood', [0.8, 0.6, 0.4], false), B(0.3, 3.1, 0, 0.3, 1.5, 1.53, 'wood', PAL.wood, false)];
    for (let i = 0; i < 10; i++) bx.push(B(0.4 + i * 0.27, 0.52 + i * 0.27, 0.08, 0.2, 1.53, 1.75 + (i % 3) * 0.06, 'carpet', [[0.3, 0.55, 0.3], [0.6, 0.3, 0.15], [0.9, 0.85, 0.7]][i % 3], false));
    bx.push(B(0.6, 1.3, 0.05, 0.33, 0.95, 1.35, 'dark', STEEL, false), B(0, 0.08, 0.35, 1.5, 0, 1.08, 'dark', [0.3, 0.2, 0.15]), B(0, C, 1.5, 2.15, 0, 1.08, 'dark', [0.3, 0.2, 0.15]), B(0, C, 1.45, 2.25, 1.08, 1.14, 'wood', [0.8, 0.6, 0.4], false));
    return { w, d: 2.2, boxes: bx, spots: [SP('cash', 1.6, 1.05, 0, 1), SP('barista', 0.95, 0.85, 0, -1), SP('cust', 1.6, 2.75, 0, -1)] }; },
  bench() { return { w: 1.4, d: 0.45, boxes: [B(0, 1.4, 0, 0.45, 0, 0.45, 'wood', PAL.wood, false)] }; },
  console_() { return { w: 1.0, d: 0.35, boxes: [B(0, 1.0, 0, 0.35, 0, 0.8, 'wood', PAL.dwood)] }; },

  marketShelf(rng) { const w = 2.6 + rng() * 0.8, bx = [B(0, w, 0, 0.55, 0, 1.75, 'dark', [0.72, 0.74, 0.78])]; for (let i = 0; i < 4; i++) { const y = 0.22 + i * 0.4; let a = 0.05; while (a < w - 0.3) { const ww = 0.18 + rng() * 0.3; if (a + ww > w - 0.05) break; bx.push(B(a, a + ww, 0.05, 0.5, y, y + 0.28, 'carpet', [0.4 + rng() * 0.6, 0.3 + rng() * 0.6, 0.25 + rng() * 0.6], false)); a += ww + 0.05; } } return { w, d: 0.55, boxes: bx }; },
  fridgeWall() { return { w: 2.4, d: 0.75, boxes: [B(0, 2.4, 0, 0.75, 0, 1.95, 'walltile', [0.78, 0.9, 1.0]), B(0.05, 2.35, 0.7, 0.78, 0.15, 1.85, 'dark', [0.45, 0.6, 0.75], false)] }; },
  checkout() { return { w: 1.7, d: 0.9, boxes: [B(0, 1.7, 0, 0.9, 0, 0.9, 'dark', [0.3, 0.3, 0.34]), B(0, 1.2, 0.05, 0.85, 0.9, 0.95, 'dark', [0.08, 0.08, 0.09], false), B(1.25, 1.6, 0.2, 0.6, 0.95, 1.25, 'dark', [0.15, 0.15, 0.18], false)] }; },
  tray() { return { w: 3.4, d: 0.8, boxes: [B(0, 3.4, 0, 0.8, 0, 1.0, 'wood', [0.85, 0.2, 0.15]), B(0, 3.4, 0, 0.9, 1.0, 1.06, 'dark', [0.85, 0.85, 0.85], false), B(0.3, 3.1, 0.0, 0.1, 1.9, 2.4, 'dark', [0.95, 0.75, 0.1], false)] }; },
  diningTable(rng) { const c = [[0.8, 0.2, 0.15], [0.95, 0.75, 0.15], [0.25, 0.4, 0.3]][(rng() * 3) | 0]; return withSpots({ w: 1.8, d: 1.5, boxes: [B(0.3, 1.5, 0.35, 1.15, 0.72, 0.78, 'wood', PAL.wood, false), B(0.7, 0.8, 0.7, 0.8, 0, 0.72, 'dark', PAL.dark, false), B(0.3, 1.5, 0.0, 0.3, 0, 0.45, 'carpet', c, false), B(0.3, 1.5, 1.2, 1.5, 0, 0.45, 'carpet', c, false)] }, [SP('seat', 0.9, 0.15, 0, 1, 1), SP('seat', 0.9, 1.35, 0, -1, 1)]); },
  diyRack(rng) { const w = 2.4, bx = [B(0, w, 0, 0.9, 0, 2.7, 'dark', [0.9, 0.5, 0.15])]; for (let i = 0; i < 3; i++) { const y = 0.3 + i * 0.8; bx.push(B(0.1, w - 0.1, 0.1, 0.82, y, y + 0.6, 'wood', [0.6 + rng() * 0.3, 0.5, 0.35], false)); } return { w, d: 0.9, boxes: bx }; },
  pallet(rng) { return { w: 1.3, d: 1.3, boxes: [B(0, 1.3, 0, 1.3, 0, 0.15, 'wood', PAL.wood), B(0.05, 1.25, 0.05, 1.25, 0.15, 0.9 + rng() * 0.8, 'wood', [0.7, 0.58, 0.4])] }; },
  workbench() { return { w: 2.0, d: 0.7, boxes: [B(0, 2.0, 0, 0.7, 0, 0.9, 'dark', [0.4, 0.42, 0.45]), B(0, 2.0, 0, 0.75, 0.9, 0.95, 'wood', PAL.wood, false)] }; },
  rack() { return { w: 2.2, d: 0.6, boxes: [B(0, 2.2, 0, 0.6, 0, 2.3, 'dark', [0.55, 0.58, 0.62]), B(0.1, 2.1, 0.05, 0.55, 0.6, 1.0, 'wood', [0.5, 0.4, 0.3], false)] }; },
  barrel() { return { w: 0.7, d: 0.7, boxes: [B(0.05, 0.65, 0.05, 0.65, 0, 0.95, 'dark', [0.2, 0.35, 0.55])] }; },
  bunk() { return { w: 0.95, d: 2.1, boxes: [B(0, 0.95, 0, 2.1, 0.3, 0.42, 'dark', [0.45, 0.47, 0.5]), B(0, 0.95, 0, 2.1, 1.3, 1.42, 'dark', [0.45, 0.47, 0.5]), B(0, 0.08, 0, 0.08, 0, 1.5, 'dark', [0.3, 0.3, 0.32], false), B(0.87, 0.95, 2.02, 2.1, 0, 1.5, 'dark', [0.3, 0.3, 0.32], false)] }; },
  recDesk() { return { w: 2.4, d: 0.8, boxes: [B(0, 2.4, 0, 0.8, 0, 1.1, 'dark', [0.35, 0.4, 0.36]), B(0, 2.4, 0, 0.9, 1.1, 1.15, 'wood', PAL.wood, false)] }; },

  // ---- design pack pieces (brand zones from manifest.json) -------------------------------------------------------------
  poster(rect, w = 1.5, y0 = 1.2) { const h = w / 1.5; return { w, d: 0.06, boxes: [B(-0.04, w + 0.04, 0, 0.03, y0 - 0.04, y0 + h + 0.04, 'dark', [0.12, 0.12, 0.13], false), B(0, w, 0, 0.055, y0, y0 + h, rect, [1.05, 1.05, 1.05], false)] }; },
  sushiBar() { const bx = [B(0, 4.0, 0, 0.8, 0, 1.0, 'wood', [0.45, 0.2, 0.14]), B(0, 4.0, 0, 0.85, 1.0, 1.05, 'dark', [0.1, 0.1, 0.11], false), B(0, 4.0, 0.1, 0.7, 1.05, 1.5, 'bWhite', [0.8, 0.92, 0.95], false)]; const cs = [[0.95, 0.5, 0.35], [0.97, 0.97, 0.95], [0.85, 0.2, 0.2], [0.3, 0.55, 0.3]]; for (let i = 0; i < 10; i++) bx.push(B(0.15 + i * 0.37, 0.4 + i * 0.37, 0.25, 0.5, 1.05, 1.15, 'carpet', cs[i % 4], false)); bx.push(B(0, 4.0, 0, 0.1, 1.9, 2.4, 'bMcdR', [0.9, 0.9, 0.9], false)); return { w: 4.0, d: 0.85, boxes: bx }; },
  // McDonald's: order counter with light-wood front + menu boards, self-order kiosks, red booths with yellow chairs
  mcdCounter() { return { w: 4.0, d: 0.8, boxes: [B(0, 4.0, 0, 0.8, 0, 1.0, 'wood', [1.05, 0.95, 0.8]), B(0, 4.0, 0, 0.85, 1.0, 1.06, 'dark', [0.16, 0.16, 0.18], false), B(0.1, 3.9, 0, 0.1, 1.06, 1.9, 'dark', [0.5, 0.5, 0.52], false),
    B(0.2, 1.2, 0, 0.12, 2.0, 2.5, 'bMcdR', [1, 1, 1], false), B(1.35, 2.55, 0, 0.12, 2.0, 2.5, 'bMcdY', [1, 1, 1], false), B(2.7, 3.8, 0, 0.12, 2.0, 2.5, 'bMcdR', [1, 1, 1], false), B(0.4, 0.8, 0.25, 0.55, 1.06, 1.3, 'dark', [0.08, 0.08, 0.09], false)] }; },
  mcdKiosk() { const bx = []; for (let i = 0; i < 3; i++) { const a = i * 0.75; bx.push(B(a, a + 0.5, 0, 0.3, 0, 1.6, 'dark', [0.12, 0.12, 0.14]), B(a + 0.05, a + 0.45, 0.28, 0.32, 0.95, 1.5, 'bWhite', [0.45, 0.75, 1.1], false), B(a, a + 0.5, 0, 0.3, 1.6, 1.7, 'bMcdR', [1, 1, 1], false)); } return { w: 2.0, d: 0.32, boxes: bx }; },
  redBooth(rng) { const w = 2.0; return withSpots({ w, d: 1.9, boxes: [B(0, w, 0, 0.55, 0, 0.45, 'bMcdR', [1, 0.95, 0.95]), B(0, w, 0, 0.18, 0.45, 1.15, 'bMcdR', [0.95, 0.9, 0.9]), B(0.2, 1.8, 0.7, 1.3, 0.72, 0.78, 'wood', [1.1, 0.98, 0.8], false), B(0.95, 1.05, 0.95, 1.05, 0, 0.72, 'dark', PAL.dark, false), B(0, w, 1.4, 1.9, 0, 0.45, 'bMcdY', [1, 1, 1], false), B(0, w, 1.75, 1.9, 0.45, 0.85, 'bMcdY', [1, 1, 1], false)] }, [SP('seat', 0.6, 0.32, 0, 1, 1), SP('seat', 1.4, 0.32, 0, 1, 1), SP('seat', 0.6, 1.62, 0, -1, 1), SP('seat', 1.4, 1.62, 0, -1, 1)]); },
  yellowTable() { return withSpots({ w: 1.7, d: 1.4, boxes: [B(0.3, 1.4, 0.3, 1.1, 0.72, 0.78, 'wood', [1.1, 0.98, 0.8], false), B(0.8, 0.9, 0.65, 0.75, 0, 0.72, 'dark', PAL.dark, false), B(0.4, 0.8, 0.0, 0.3, 0, 0.8, 'bMcdY', [1, 1, 1], false), B(0.9, 1.3, 1.1, 1.4, 0, 0.8, 'bMcdY', [1, 1, 1], false)] }, [SP('seat', 0.6, 0.15, 0, 1, 1), SP('seat', 1.1, 1.25, 0, -1, 1)]); },
  // Puzata Hata: serving line (glass guard, pots), carved wooden table with benches, embroidery band
  servingLine() { const bx = [B(0, 4.4, 0, 0.8, 0, 0.9, 'bPuz', [0.95, 1, 0.95]), B(0, 4.4, 0, 0.9, 0.9, 0.95, 'dark', [0.8, 0.8, 0.82], false), B(0, 4.4, 0.78, 1.15, 0.75, 0.82, 'wood', [0.9, 0.8, 0.6], false), B(0, 4.4, 0, 0.8, 1.55, 1.6, 'dark', [0.8, 0.9, 0.95], false), B(0, 0.05, 0, 0.8, 0.95, 1.6, 'dark', [0.7, 0.72, 0.75], false), B(4.35, 4.4, 0, 0.8, 0.95, 1.6, 'dark', [0.7, 0.72, 0.75], false)];
    const pots = [[0.8, 0.2, 0.15], [0.95, 0.85, 0.5], [0.85, 0.55, 0.2], [0.95, 0.95, 0.9], [0.7, 0.25, 0.15], [0.45, 0.65, 0.3]]; for (let i = 0; i < 6; i++) bx.push(B(0.2 + i * 0.7, 0.7 + i * 0.7, 0.15, 0.65, 0.95, 1.12, 'dark', pots[i], false));
    bx.push(B(0, 4.4, 0, 0.12, 2.1, 2.45, 'pPuzI', [0.9, 0.9, 0.9], false)); return { w: 4.4, d: 1.15, boxes: bx }; },
  woodTable() { return withSpots({ w: 2.2, d: 1.5, boxes: [B(0.2, 2.0, 0.4, 1.1, 0.72, 0.78, 'wood', [1.0, 0.85, 0.6], false), B(0.3, 0.4, 0.5, 0.6, 0, 0.72, 'dark', PAL.dwood, false), B(1.8, 1.9, 0.9, 1.0, 0, 0.72, 'dark', PAL.dwood, false), B(0.2, 2.0, 0.0, 0.3, 0, 0.46, 'wood', [0.75, 0.55, 0.35], false), B(0.2, 2.0, 1.2, 1.5, 0, 0.46, 'wood', [0.75, 0.55, 0.35], false)] }, [SP('seat', 0.6, 0.15, 0, 1, 1), SP('seat', 1.6, 0.15, 0, 1, 1), SP('seat', 0.6, 1.35, 0, -1, 1), SP('seat', 1.6, 1.35, 0, -1, 1)]); },
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
  plant() { return { w: 0.5, d: 0.5, boxes: [B(0.1, 0.4, 0.1, 0.4, 0, 0.35, 'dark', [0.5, 0.3, 0.2], false), B(0.0, 0.5, 0.0, 0.5, 0.35, 1.3, 'carpet', [0.2, 0.55, 0.25], false)] }; },  // ---- service lines with a staff aisle between the back equipment (at the wall) and the counter; open end at a = w (NPC staff + venue jobs stand in the aisle)
  mcdLine() { const w = 4.6, C = 3.6, bx = [
    B(0.1, 1.1, 0, 0.62, 0, 0.9, 'dark', STEEL), B(0.15, 1.05, 0.05, 0.58, 0.9, 0.94, 'dark', [0.08, 0.08, 0.08], false), B(0.1, 1.1, 0.0, 0.1, 1.45, 1.6, 'dark', STEEL, false),   // grill + hood
    B(1.25, 2.05, 0, 0.62, 0, 0.95, 'dark', [0.72, 0.74, 0.78]), B(1.33, 1.97, 0.1, 0.5, 0.95, 0.97, 'dark', [0.9, 0.68, 0.2], false), B(1.4, 1.62, 0.36, 0.62, 0.97, 1.12, 'dark', [0.45, 0.45, 0.48], false), B(1.7, 1.92, 0.36, 0.62, 0.97, 1.12, 'dark', [0.45, 0.45, 0.48], false),   // fryer
    B(2.2, 3.3, 0, 0.62, 0, 0.9, 'dark', [0.78, 0.8, 0.84]), B(2.2, 3.3, 0.08, 0.5, 1.45, 1.5, 'dark', STEEL, false),   // prep table + heat-lamp shelf
    B(2.35, 2.6, 0.2, 0.45, 0.9, 1.0, 'carpet', [0.8, 0.5, 0.2], false), B(2.7, 2.95, 0.2, 0.45, 0.9, 1.0, 'carpet', [0.8, 0.5, 0.2], false), B(3.0, 3.2, 0.2, 0.45, 0.9, 0.98, 'bMcdY', [1, 1, 1], false),
    B(3.45, 4.45, 0, 0.6, 0, 1.75, 'dark', [0.3, 0.31, 0.35]), B(3.5, 4.4, 0.6, 0.63, 0.95, 1.65, 'bMcdR', [1, 1, 1], false), B(3.6, 4.3, 0.6, 0.7, 0.85, 0.9, 'dark', STEEL, false),   // drinks machine
    B(0.3, 1.4, 0, 0.06, 2.0, 2.45, 'bMcdR', [1, 1, 1], false), B(1.6, 3.0, 0, 0.06, 2.0, 2.45, 'bMcdY', [1, 1, 1], false), B(3.2, 4.3, 0, 0.06, 2.0, 2.45, 'bMcdR', [1, 1, 1], false),   // menu boards
    B(0, 0.08, 0.62, 1.55, 0, 1.0, 'wood', [1.05, 0.95, 0.8]),   // closed end of the aisle
    B(0, C, 1.55, 2.3, 0, 1.0, 'wood', [1.05, 0.95, 0.8]), B(0, C, 1.5, 2.36, 1.0, 1.06, 'dark', [0.16, 0.16, 0.18], false), B(0, C, 2.29, 2.33, 0.25, 0.42, 'bMcdY', [1, 1, 1], false),
    B(0.7, 1.1, 1.7, 2.0, 1.06, 1.32, 'dark', [0.08, 0.08, 0.09], false), B(2.1, 2.5, 1.7, 2.0, 1.06, 1.32, 'dark', [0.08, 0.08, 0.09], false), B(2.95, 3.4, 1.65, 2.1, 1.06, 1.16, 'bMcdR', [0.9, 0.9, 0.9], false)];
    return { w, d: 3.9, boxes: bx, spots: [SP('reg', 0.9, 1.12, 0, 1), SP('reg', 2.3, 1.12, 0, 1), SP('grill', 0.6, 0.95, 0, -1), SP('fryer', 1.65, 0.95, 0, -1), SP('prep', 2.75, 0.95, 0, -1), SP('drinks', 3.95, 0.95, 0, -1),
      SP('cust', 0.9, 2.85, 0, -1), SP('cust', 2.3, 2.85, 0, -1), SP('pickup', 3.2, 2.85, 0, -1), SP('queue', 0.9, 3.65, 0, -1), SP('queue', 2.3, 3.65, 0, -1)], signs: [{ a: 3.2, b: 2.1, y: 2.25, w: 1.3, h: 0.32, t: 'Видача замовлень' }] }; },
  puzLine(rng) { const w = 4.8, C = 3.8, bx = [
    B(0.1, 2.3, 0, 0.6, 0, 0.9, 'dark', [0.76, 0.78, 0.82]), B(0.3, 0.75, 0.1, 0.5, 0.9, 1.25, 'dark', [0.55, 0.55, 0.58], false), B(1.0, 1.45, 0.1, 0.5, 0.9, 1.2, 'dark', [0.6, 0.35, 0.2], false), B(1.7, 2.15, 0.1, 0.5, 0.9, 1.3, 'dark', [0.55, 0.55, 0.58], false),   // stove + pots
    B(2.5, 4.0, 0, 0.45, 0, 1.8, 'wood', [0.62, 0.3, 0.2]), B(2.55, 3.95, 0.4, 0.46, 0.5, 0.75, 'carpet', [0.85, 0.62, 0.3], false), B(2.55, 3.95, 0.4, 0.46, 1.0, 1.25, 'carpet', [0.9, 0.9, 0.85], false),   // bread / plates shelf
    B(0, 4.8, 0, 0.06, 2.0, 2.35, 'pPuzI', [0.9, 0.9, 0.9], false),   // embroidery band
    B(0, 0.08, 0.6, 1.5, 0, 1.0, 'wood', [0.75, 0.55, 0.35]),
    B(0, C, 1.5, 2.3, 0, 0.9, 'bPuz', [0.95, 1, 0.95]), B(0, C, 1.5, 2.3, 0.9, 0.95, 'dark', [0.82, 0.82, 0.84], false), B(0, C, 2.3, 2.62, 0.76, 0.82, 'wood', [0.9, 0.8, 0.6], false),
    B(0, C, 1.9, 2.3, 1.5, 1.54, 'dark', [0.8, 0.9, 0.95], false), B(0, 0.05, 1.9, 2.3, 0.95, 1.5, 'dark', STEEL, false), B(C - 0.05, C, 1.9, 2.3, 0.95, 1.5, 'dark', STEEL, false),
    B(3.15, 3.6, 1.6, 1.95, 0.95, 1.22, 'dark', [0.1, 0.1, 0.11], false)];
    const food = [[0.8, 0.2, 0.15], [0.95, 0.85, 0.5], [0.85, 0.55, 0.2], [0.95, 0.95, 0.9], [0.7, 0.25, 0.15], [0.45, 0.65, 0.3]]; for (let i = 0; i < 5; i++) bx.push(B(0.15 + i * 0.6, 0.65 + i * 0.6, 1.62, 2.15, 0.95, 1.06 + rng() * 0.05, 'dark', food[i], false));
    return { w, d: 3.6, boxes: bx, spots: [SP('serve', 0.8, 1.05, 0, 1), SP('serve', 2.0, 1.05, 0, 1), SP('kitchen', 1.2, 0.95, 0, -1), SP('cash', 3.4, 1.05, 0, 1),
      SP('line', 0.8, 2.95, 0, -1), SP('line', 2.0, 2.95, 0, -1), SP('pay', 3.4, 2.95, 0, -1), SP('queue', 0.35, 3.45, 1, 0)], signs: [{ a: 1.9, b: 2.1, y: 2.2, w: 1.6, h: 0.32, t: 'Перші та другі страви' }] }; },
  sushiLine(rng) { const w = 4.6, C = 3.6, bx = [
    B(0.1, 3.0, 0, 0.6, 0, 0.9, 'walltile', [0.93, 0.93, 0.9]), B(0.25, 0.7, 0.1, 0.5, 0.9, 1.22, 'bWhite', [0.95, 0.95, 0.95], false), B(1.1, 2.6, 0, 0.05, 1.3, 1.42, 'dark', [0.15, 0.12, 0.1], false), B(1.2, 2.0, 0.15, 0.5, 0.9, 0.93, 'wood', [0.9, 0.78, 0.55], false),
    B(3.2, 4.4, 0, 0.65, 0, 1.9, 'walltile', [0.85, 0.9, 0.95]), B(3.25, 4.35, 0.64, 0.68, 0.2, 1.8, 'dark', [0.5, 0.6, 0.7], false),
    B(0.2, 3.4, 0, 0.06, 1.95, 2.3, 'bMcdR', [0.85, 0.85, 0.85], false),   // noren band
    B(0, 0.08, 0.6, 1.5, 0, 1.0, 'wood', [0.45, 0.2, 0.14]),
    B(0, C, 1.5, 2.3, 0, 1.0, 'wood', [0.45, 0.2, 0.14]), B(0, C, 1.45, 2.42, 1.0, 1.05, 'dark', [0.1, 0.1, 0.11], false), B(0.2, 3.4, 1.6, 2.0, 1.05, 1.3, 'bWhite', [0.78, 0.9, 0.95], false)];
    const fish = [[0.95, 0.5, 0.35], [0.97, 0.97, 0.95], [0.85, 0.2, 0.2], [0.3, 0.55, 0.3], [0.95, 0.75, 0.3]]; for (let i = 0; i < 8; i++) bx.push(B(0.3 + i * 0.38, 0.6 + i * 0.38, 1.66, 1.94, 1.05, 1.12, 'carpet', fish[i % 5], false));
    const sp = [SP('rice', 0.5, 0.95, 0, -1), SP('roll', 1.6, 1.1, 0, 1), SP('cut', 2.8, 1.1, 0, 1), SP('pickup', 3.25, 2.75, 0, -1)];
    for (let i = 0; i < 4; i++) { const a = 0.3 + i * 0.8; bx.push(B(a, a + 0.36, 2.55, 2.9, 0, 0.7, 'dark', [0.28, 0.16, 0.1], false)); if (i < 3) sp.push(SP('seat', a + 0.18, 2.72, 0, -1, 1)); }
    return { w, d: 3.2, boxes: bx, spots: sp, signs: [{ a: 1.8, b: 2.0, y: 2.25, w: 1.2, h: 0.3, t: 'Суші-бар' }] }; },
  // checkout lane perpendicular to the wall: customer lane | belt | cashier (o.brand: rect for the stripe/sign)
  lane(rng, o = {}) { const br = o.brand || 'bSilO', bc = o.bcol || [1, 1, 1], bx = [
    B(0.05, 0.9, 0.05, 0.4, 0, 1.3, 'dark', [0.62, 0.64, 0.68]), B(0.1, 0.85, 0.38, 0.42, 0.2, 1.25, 'carpet', [0.9, 0.5, 0.3], false),   // impulse rack at the wall end
    B(0.95, 1.6, 0.15, 2.4, 0, 0.88, 'dark', [0.3, 0.31, 0.34]), B(0.95, 1.6, 0.15, 2.4, 0.88, 0.92, 'dark', [0.07, 0.07, 0.08], false), B(0.93, 0.96, 0.15, 2.4, 0.5, 0.6, br, bc, false),
    B(1.62, 1.95, 1.2, 1.6, 0.92, 1.2, 'dark', [0.12, 0.13, 0.15], false), B(1.98, 2.36, 1.2, 1.6, 0, 0.5, 'dark', [0.2, 0.2, 0.22], false), B(1.6, 2.6, 0.15, 0.5, 0, 0.95, 'dark', [0.55, 0.57, 0.6]),
    B(1.25, 1.3, 2.3, 2.35, 0.92, 2.1, 'dark', STEEL, false), B(1.0, 1.55, 2.29, 2.36, 1.95, 2.25, br, bc, false)];
    return { w: 2.7, d: 3.3, boxes: bx, spots: [SP('till', 2.15, 1.4, -1, 0), SP('pay', 0.47, 1.4, 1, 0), SP('queue', 0.47, 2.35, 0, -1), SP('queue', 0.47, 3.1, 0, -1)], signs: o.sign ? [{ a: 1.27, b: 2.33, y: 2.3, w: 0.8, h: 0.26, t: o.sign }] : [] }; },
  silLane(rng) { return PIECES.lane(rng, { brand: 'bSilO', sign: 'Каса' }); },
  atbLane(rng) { return PIECES.lane(rng, { brand: 'bWhite', bcol: [0.25, 0.45, 0.9], sign: 'Каса' }); },
  epiLane(rng) { return PIECES.lane(rng, { brand: 'bEpiY', sign: 'Каса' }); },
  // ---- centre islands (placed by furnishCenter): double-sided gondola, chest freezer, promo pallet, double tall rack
  gondola(rng, o = {}) { const w = 3.0, rows = o.lite ? 3 : 4, bx = [B(0, w, 0.15, 1.05, 0, 1.65, 'dark', [0.72, 0.74, 0.78]), B(0, w, 0, 1.2, 0, 0.14, 'dark', [0.55, 0.56, 0.6], false)];
    if (o.brand) bx.push(B(0, w, 0.45, 0.75, 1.65, 1.82, o.brand, o.bcol || [1, 1, 1], false));
    for (const side of [0, 1]) for (let i = 0; i < rows; i++) { const y = 0.18 + i * (1.4 / rows); let a = 0.05; while (a < w - 0.3) { const ww = o.lite ? 0.5 + rng() * 0.5 : 0.22 + rng() * 0.3; if (a + ww > w - 0.05) break; const b0 = side ? 1.05 : 0.04, b1 = side ? 1.16 : 0.15;
      bx.push(B(a, a + ww, b0, b1, y, y + 0.22 + rng() * 0.08, 'carpet', [0.35 + rng() * 0.65, 0.3 + rng() * 0.6, 0.25 + rng() * 0.6], false)); a += ww + (o.lite ? 0.08 : 0.04); } }
    return { w, d: 1.2, boxes: bx, spots: [SP('shelf', 0.8, -0.55, 0, 1), SP('shelf', 2.2, -0.55, 0, 1), SP('shelf', 0.8, 1.75, 0, -1), SP('shelf', 2.2, 1.75, 0, -1)], sign: { a: w / 2, b: 0.6, y: 2.3 } }; },
  freezer(rng) { const w = 2.4, bx = [B(0, w, 0, 1.0, 0, 0.85, 'walltile', [0.85, 0.92, 1.0]), B(0.05, w - 0.05, 0.05, 0.95, 0.85, 0.89, 'dark', [0.5, 0.66, 0.82], false)];
    for (let i = 0; i < 5; i++) bx.push(B(0.1 + i * 0.45, 0.48 + i * 0.45, 0.1, 0.9, 0.62, 0.84, 'carpet', [0.4 + rng() * 0.5, 0.5 + rng() * 0.4, 0.7 + rng() * 0.3], false));
    return { w, d: 1.0, boxes: bx, spots: [SP('shelf', 1.2, -0.5, 0, 1), SP('shelf', 1.2, 1.5, 0, -1)], sign: { a: w / 2, b: 0.5, y: 2.2, t: 'Заморожене' } }; },
  promo(rng, o = {}) { const bx = [B(0, 1.3, 0, 1.3, 0, 0.14, 'wood', PAL.wood, false)]; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) bx.push(B(0.05 + i * 0.62, 0.62 + i * 0.62, 0.05 + j * 0.62, 0.62 + j * 0.62, 0.14, 0.6 + rng() * 0.35, 'carpet', [0.8 + rng() * 0.2, 0.3 + rng() * 0.5, 0.15], true));
    bx.push(B(0.62, 0.68, 0.62, 0.68, 0.9, 1.8, 'dark', STEEL, false)); return { w: 1.3, d: 1.3, boxes: bx, spots: [SP('shelf', 0.65, 1.85, 0, -1)], sign: { a: 0.65, b: 0.65, y: 1.75, w: 0.9, h: 0.3, t: o.t || 'Акція' } }; },
  rack2(rng, o = {}) { const w = 2.8, H = Math.min(o.H || 3.0, 3.2), bx = [B(0, 0.1, 0, 1.8, 0, H, 'bEpiG', [1, 1, 1]), B(w - 0.1, w, 0, 1.8, 0, H, 'bEpiG', [1, 1, 1]), B(0.1, w - 0.1, 0.85, 0.95, 0, H, 'dark', [0.55, 0.57, 0.6])];
    const lv = o.lite ? 2 : 3; for (let i = 0; i < lv; i++) { const y = 0.2 + i * (H - 0.6) / lv; bx.push(B(0, w, 0, 1.8, y, y + 0.07, 'bEpiY', [1, 1, 1], false)); for (const [b0, b1] of [[0.08, 0.8], [1.0, 1.72]]) { let a = 0.15; while (a < w - 0.5) { const ww = 0.4 + rng() * 0.5; if (a + ww > w - 0.12) break; bx.push(B(a, a + ww, b0, b1, y + 0.07, y + 0.07 + 0.3 + rng() * 0.3, 'carpet', [0.55 + rng() * 0.4, 0.45 + rng() * 0.3, 0.3 + rng() * 0.3], false)); a += ww + 0.1; } } }
    return { w, d: 1.8, boxes: bx, spots: [SP('shelf', 0.9, -0.55, 0, 1), SP('shelf', 1.9, -0.55, 0, 1), SP('shelf', 0.9, 2.35, 0, -1), SP('shelf', 1.9, 2.35, 0, -1)], sign: { a: w / 2, b: 0.9, y: Math.min(H + 0.25, 3.3) } }; },
  // ---- pharmacy: counter with glass vitrine + drawer cabinets behind the staff aisle, green cross; wall shelves, cosmetic vitrine, BP kiosk
  pharmCounter(rng) { const w = 4.6, C = 3.9, G = [0.12, 0.6, 0.34], bx = [
    B(0.1, 4.5, 0, 0.5, 0, 2.15, 'walltile', [0.96, 1.0, 0.98]), B(0.1, 4.5, 0, 0.53, 2.15, 2.32, 'bWhite', G, false),
    B(0, 0.08, 0.5, 1.5, 0, 1.0, 'walltile', [0.92, 0.96, 0.94]),
    B(0, C, 1.5, 2.2, 0, 0.95, 'walltile', [0.95, 0.98, 0.96]), B(0, C, 1.45, 2.25, 0.95, 1.0, 'dark', [0.82, 0.86, 0.88], false), B(0.15, C - 0.15, 1.62, 2.12, 1.0, 1.32, 'bWhite', [0.72, 0.88, 0.94], false),
    B(0, C, 2.2, 2.24, 0.3, 0.44, 'bWhite', G, false), B(0.85, 1.25, 1.58, 1.88, 1.0, 1.24, 'dark', [0.1, 0.1, 0.12], false), B(2.65, 3.05, 1.58, 1.88, 1.0, 1.24, 'dark', [0.1, 0.1, 0.12], false),
    B(2.05, 2.55, 0, 0.06, 2.36, 2.74, 'bWhite', [0.1, 0.75, 0.35], false), B(1.92, 2.68, 0, 0.065, 2.49, 2.61, 'bWhite', [0.1, 0.75, 0.35], false)];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) { const a = 0.2 + i * 0.47; bx.push(B(a, a + 0.42, 0.5, 0.52, 0.25 + r * 0.45, 0.6 + r * 0.45, 'dark', [0.82, 0.86, 0.84], false), B(a + 0.17, a + 0.25, 0.52, 0.55, 0.4 + r * 0.45, 0.44 + r * 0.45, 'dark', STEEL, false)); }
    const pk = [[0.9, 0.3, 0.3], [0.3, 0.5, 0.9], [0.95, 0.85, 0.3], [0.4, 0.75, 0.45], [0.95, 0.95, 0.95]]; for (let i = 0; i < 9; i++) { const a = 0.25 + i * 0.38; bx.push(B(a, a + 0.24, 1.75 + (i % 2) * 0.15, 1.92 + (i % 2) * 0.15, 1.0, 1.12 + rng() * 0.08, 'carpet', pk[i % 5], false)); }
    return { w, d: 3.4, boxes: bx, at: 'back', spots: [SP('cash', 1.05, 1.15, 0, 1), SP('cash', 2.85, 1.15, 0, 1), SP('drawer', 0.8, 0.85, 0, -1), SP('drawer', 2.3, 0.85, 0, -1), SP('drawer', 3.7, 0.85, 0, -1),
      SP('pay', 1.05, 2.75, 0, -1), SP('pay', 2.85, 2.75, 0, -1), SP('queue', 1.05, 3.5, 0, -1), SP('queue', 2.85, 3.5, 0, -1)], signs: [{ a: 1.0, b: 2.2, y: 2.25, w: 1.2, h: 0.3, t: 'Каса' }, { a: 2.9, b: 2.2, y: 2.25, w: 1.6, h: 0.3, t: 'Рецептурний відділ' }] }; },
  pharmCounterS(rng) { return compact(PIECES.pharmCounter(rng)); },
  coffeeBarS(rng) { return compact(PIECES.coffeeBar(rng)); },
  pharmShelf(rng) { const w = 2.4, bx = [B(0, w, 0, 0.45, 0, 2.0, 'walltile', [0.97, 1.0, 0.98]), B(0, w, 0, 0.47, 2.0, 2.15, 'bWhite', [0.12, 0.6, 0.34], false)];
    for (let r = 0; r < 5; r++) { let a = 0.06; const y = 0.2 + r * 0.36; while (a < w - 0.2) { const ww = 0.1 + rng() * 0.14; if (a + ww > w - 0.06) break; bx.push(B(a, a + ww, 0.3, 0.46, y, y + 0.12 + rng() * 0.12, 'carpet', [0.55 + rng() * 0.45, 0.55 + rng() * 0.45, 0.55 + rng() * 0.45], false)); a += ww + 0.025; } }
    return { w, d: 0.45, boxes: bx, sign: { a: w / 2, b: 0.25, y: 2.45, w: 1.4, h: 0.28, na: 0, nb: 1 } }; },
  pharmVitrine(rng) { const bx = [B(0, 1.6, 0, 0.5, 0, 0.9, 'walltile', [0.95, 0.97, 0.96]), B(0.04, 1.56, 0.04, 0.46, 0.9, 1.85, 'bWhite', [0.75, 0.9, 0.95], false), B(0, 1.6, 0, 0.5, 1.85, 1.95, 'bWhite', [0.12, 0.6, 0.34], false)];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) bx.push(B(0.12 + i * 0.24, 0.28 + i * 0.24, 0.15, 0.35, 0.95 + r * 0.3, 1.08 + r * 0.3, 'carpet', [0.8 + rng() * 0.2, 0.5 + rng() * 0.5, 0.6 + rng() * 0.4], false));
    return { w: 1.6, d: 0.5, boxes: bx }; },
  bpKiosk() { return { w: 0.9, d: 0.6, boxes: [B(0.05, 0.85, 0, 0.5, 0, 0.75, 'walltile', [0.9, 0.95, 1.0]), B(0.1, 0.8, 0, 0.12, 0.75, 1.5, 'bWhite', [0.3, 0.55, 0.9], false), B(0.2, 0.7, 0.1, 0.45, 0.75, 0.82, 'dark', [0.2, 0.2, 0.22], false)] }; },
  // ---- coffee shop: espresso bar (machine, grinder, cups, chalk menu) + pastry vitrine; wall banquettes, book shelf, small round tables
  coffeeBar(rng) { const w = 4.6, C = 3.8, bx = [
    B(0.1, 4.0, 0, 0.6, 0, 0.9, 'wood', [0.55, 0.36, 0.24]), B(0.1, 4.0, 0, 0.62, 0.9, 0.95, 'dark', [0.16, 0.14, 0.13], false),
    B(0.45, 1.35, 0.1, 0.55, 0.95, 1.42, 'dark', STEEL, false), B(0.55, 1.25, 0.5, 0.56, 1.1, 1.3, 'dark', [0.15, 0.15, 0.16], false), B(1.5, 1.72, 0.15, 0.4, 0.95, 1.38, 'dark', [0.12, 0.12, 0.13], false),
    B(2.0, 3.8, 0, 0.3, 1.45, 1.49, 'wood', [0.6, 0.42, 0.28], false), B(0.3, 3.9, 0, 0.04, 1.65, 2.35, 'dark', [0.13, 0.14, 0.13], false),
    B(0, 0.08, 0.6, 1.5, 0, 1.05, 'wood', [0.45, 0.3, 0.2]),
    B(0, C, 1.5, 2.2, 0, 1.0, 'wood', [0.62, 0.42, 0.28]), B(0, C, 1.45, 2.26, 1.0, 1.05, 'dark', [0.2, 0.18, 0.16], false), B(2.2, 3.6, 1.6, 2.15, 1.05, 1.45, 'bWhite', [1.1, 1.0, 0.86], false),
    B(0.6, 1.0, 1.6, 1.9, 1.05, 1.28, 'dark', [0.1, 0.1, 0.12], false)];
    for (let i = 0; i < 9; i++) bx.push(B(0.45 + i * 0.36, 0.7 + i * 0.36, 0.02, 0.05, 1.8 + (i % 3) * 0.17, 1.84 + (i % 3) * 0.17, 'bWhite', [0.92, 0.88, 0.75], false));   // chalk lines
    for (let i = 0; i < 7; i++) bx.push(B(2.05 + i * 0.25, 2.25 + i * 0.25, 0.05, 0.25, 1.49, 1.6, 'bWhite', [0.95, 0.95, 0.92], false));   // cups
    for (let i = 0; i < 5; i++) bx.push(B(2.3 + i * 0.26, 2.5 + i * 0.26, 1.7, 2.0, 1.05 + (i % 2) * 0.18, 1.12 + (i % 2) * 0.18, 'carpet', [0.75, 0.5 - rng() * 0.15, 0.25], false));   // pastries
    return { w, d: 3.6, boxes: bx, at: 'back', spots: [SP('barista', 0.9, 1.0, 0, -1), SP('milk', 1.7, 1.0, 0, -1), SP('cash', 2.9, 1.15, 0, 1), SP('cust', 2.9, 2.8, 0, -1), SP('pickup', 0.9, 2.8, 0, -1), SP('queue', 2.9, 3.5, 0, -1)],
      signs: [{ a: 0.9, b: 2.2, y: 2.25, w: 1.1, h: 0.28, t: 'Видача' }] }; },
  wallBench(rng) { const c = [[0.45, 0.28, 0.18], [0.25, 0.35, 0.3], [0.5, 0.2, 0.2]][(rng() * 3) | 0], bx = [B(0, 3.4, 0, 0.5, 0, 0.45, 'carpet', c), B(0, 3.4, 0, 0.14, 0.45, 1.05, 'carpet', c, false)];
    for (const a of [0.55, 2.25]) bx.push(B(a, a + 0.6, 0.75, 1.35, 0.72, 0.76, 'wood', PAL.wood, false), B(a + 0.27, a + 0.33, 1.02, 1.08, 0, 0.72, 'dark', PAL.dark, false), B(a + 0.1, a + 0.5, 1.6, 1.95, 0, 0.45, 'dark', [0.2, 0.2, 0.22], false));
    return withSpots({ w: 3.4, d: 1.95, boxes: bx }, [SP('seat', 0.85, 0.3, 0, 1, 1), SP('seat', 2.55, 0.3, 0, 1, 1), SP('seat', 0.85, 1.78, 0, -1, 1)]); },
  bookShelf(rng) { const w = 1.6, bx = [B(0, w, 0, 0.32, 0, 2.0, 'wood', PAL.dwood)]; for (let r = 0; r < 4; r++) { let a = 0.05; const y = 0.15 + r * 0.46; while (a < w - 0.1) { const ww = 0.04 + rng() * 0.06; if (a + ww > w - 0.05) break; bx.push(B(a, a + ww, 0.05, 0.3, y, y + 0.22 + rng() * 0.1, 'carpet', [0.3 + rng() * 0.6, 0.2 + rng() * 0.5, 0.15 + rng() * 0.4], false)); a += ww + 0.01; } } return { w, d: 0.32, boxes: bx }; },
  roundTable(rng) { const c = [[0.2, 0.2, 0.22], [0.55, 0.38, 0.25], [0.85, 0.85, 0.82]][(rng() * 3) | 0]; return withSpots({ w: 1.6, d: 0.8, boxes: [B(0.45, 1.15, 0.05, 0.75, 0.72, 0.76, 'wood', [0.8, 0.62, 0.42], false), B(0.77, 0.83, 0.37, 0.43, 0, 0.72, 'dark', PAL.dark, false), B(0.0, 0.36, 0.22, 0.58, 0, 0.46, 'dark', c, false), B(1.24, 1.6, 0.22, 0.58, 0, 0.46, 'dark', c, false)] }, [SP('seat', 0.18, 0.4, 1, 0, 1), SP('seat', 1.42, 0.4, -1, 0, 1)]); },
  // ---- generic street shops (variants): clothes, electronics, flowers
  clothesRack(rng) { const w = 2.4, bx = [B(0, 0.05, 0, 0.6, 0, 1.75, 'dark', STEEL, false), B(w - 0.05, w, 0, 0.6, 0, 1.75, 'dark', STEEL, false), B(0, w, 0.27, 0.33, 1.68, 1.72, 'dark', STEEL, false), B(0, w, 0, 0.6, 0, 0.05, 'dark', [0.3, 0.3, 0.32], false)];
    let a = 0.1; const pal = [[0.15, 0.2, 0.35], [0.8, 0.8, 0.78], [0.55, 0.15, 0.18], [0.2, 0.4, 0.3], [0.85, 0.65, 0.3], [0.1, 0.1, 0.12]]; while (a < w - 0.15) { bx.push(B(a, a + 0.05, 0.05, 0.55, 0.75 + rng() * 0.3, 1.66, 'carpet', pal[(rng() * pal.length) | 0], false)); a += 0.08; }
    return { w, d: 0.6, boxes: bx }; },
  mirror() { return { w: 0.8, d: 0.08, boxes: [B(0, 0.8, 0, 0.06, 0.1, 2.0, 'dark', [0.3, 0.25, 0.2], false), B(0.05, 0.75, 0.03, 0.07, 0.15, 1.95, 'bWhite', [0.75, 0.85, 0.92], false)] }; },
  foldTable(rng) { const bx = [B(0, 1.6, 0, 0.9, 0, 0.78, 'wood', [0.85, 0.75, 0.6])]; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) bx.push(B(0.1 + i * 0.5, 0.5 + i * 0.5, 0.1 + j * 0.4, 0.42 + j * 0.4, 0.78, 0.86 + rng() * 0.12, 'carpet', [0.3 + rng() * 0.6, 0.3 + rng() * 0.5, 0.3 + rng() * 0.5], false));
    return withSpots({ w: 1.6, d: 0.9, boxes: bx }, [SP('shelf', 0.8, -0.5, 0, 1), SP('shelf', 0.8, 1.4, 0, -1)]); },
  techWall(rng) { const w = 2.8, bx = [B(0, w, 0, 0.4, 0, 2.1, 'dark', [0.16, 0.17, 0.2])]; for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) { const a = 0.12 + i * 0.67, y = 0.4 + r * 0.55; bx.push(B(a, a + 0.55, 0.38, 0.42, y, y + 0.35, 'bWhite', [0.15 + rng() * 0.3, 0.35 + rng() * 0.4, 0.75 + rng() * 0.3], false)); }
    bx.push(B(0, w, 0, 0.42, 2.1, 2.25, 'bWhite', [0.9, 0.35, 0.15], false)); return { w, d: 0.42, boxes: bx }; },
  techTable(rng) { const bx = [B(0, 2.0, 0, 0.9, 0, 0.9, 'bWhite', [0.92, 0.92, 0.94])]; for (let i = 0; i < 4; i++) bx.push(B(0.2 + i * 0.45, 0.42 + i * 0.45, 0.3, 0.6, 0.9, 0.92, 'dark', [0.05, 0.05, 0.07], false), B(0.28 + i * 0.45, 0.34 + i * 0.45, 0.42, 0.48, 0.92, 1.05, 'dark', STEEL, false));
    return withSpots({ w: 2.0, d: 0.9, boxes: bx }, [SP('shelf', 0.6, -0.5, 0, 1), SP('shelf', 1.4, 1.4, 0, -1)]); },
  flowerStand(rng) { const w = 2.4, bx = [B(0, w, 0, 0.7, 0, 0.5, 'wood', [0.5, 0.36, 0.24]), B(0, w, 0, 0.3, 0.5, 0.95, 'wood', [0.45, 0.32, 0.2])]; const fl = [[0.9, 0.15, 0.25], [0.98, 0.9, 0.3], [0.95, 0.5, 0.7], [0.95, 0.95, 0.95], [0.6, 0.3, 0.8]];
    for (let i = 0; i < 5; i++) { const a = 0.08 + i * 0.46; bx.push(B(a, a + 0.36, 0.32, 0.66, 0.5, 0.82, 'dark', [0.3, 0.45, 0.55], false), B(a + 0.03, a + 0.33, 0.35, 0.63, 0.82, 1.05, 'carpet', [0.25, 0.55, 0.25], false), B(a, a + 0.36, 0.32, 0.66, 1.05, 1.25 + rng() * 0.15, 'carpet', fl[(rng() * 5) | 0], false)); }
    return { w, d: 0.7, boxes: bx }; },
  sellerDesk() { return { w: 1.8, d: 0.7, boxes: [B(0, 1.8, 0, 0.7, 0, 1.0, 'wood', [0.7, 0.55, 0.38]), B(0, 1.8, 0, 0.75, 1.0, 1.05, 'dark', [0.15, 0.15, 0.17], false), B(0.6, 1.0, 0.15, 0.4, 1.05, 1.28, 'dark', PAL.dark, false)], spots: [SP('cash', 2.25, 0.4, -1, 0), SP('cust', 0.9, 1.25, 0, -1)] }; },
  stockCage() { return { w: 1.4, d: 0.9, boxes: [B(0, 1.4, 0, 0.9, 0, 0.12, 'dark', [0.4, 0.4, 0.42]), B(0.05, 1.35, 0.05, 0.85, 0.12, 1.5, 'dark', [0.62, 0.64, 0.68]), B(0.1, 0.65, 0.92, 1.0, 0.2, 0.7, 'wood', [0.8, 0.62, 0.4], false), B(0.75, 1.3, 0.92, 1.0, 0.2, 0.6, 'wood', [0.78, 0.6, 0.38], false)], spots: [SP('stock', 0.7, 1.45, 0, -1)] }; },
};
for (const n of ['mcdLine', 'puzLine', 'sushiLine', 'coffeeBar', 'pharmCounter']) { const f = PIECES[n]; PIECES[n] = (rng) => widen(f(rng)); }
const PLAN = {
  sushi: ['sushiLine|sushiBar', 'cafeTable', 'cafeTable', 'plant', 'cafeTable', 'plant'],
  mcd: ['mcdLine|mcdCounter', 'mcdKiosk', 'redBooth', 'redBooth', 'poster:pMcdI', 'redBooth', 'mcdKiosk', 'plant', 'plant'],
  puzata: ['puzLine|servingLine', 'embroidery', 'woodTable', 'poster:pPuzI', 'carvedShelf', 'plant', 'carvedShelf'],
  silpo: ['silLane|silCheckout', 'silLane', 'produce', 'silFridge', 'bakery', 'silShelf', 'poster:pSilI', 'stockCage', 'silFridge', 'produce', 'silShelf', 'plant'],
  epicentr: ['epiLane|checkout', 'epiLane', 'paintWall', 'tallRack', 'lightWall', 'poster:pEpiI', 'stockCage', 'lumber', 'tallRack', 'tallRack', 'pallet'],
  wkoffice: ['deskIsland', 'poster:pOffI', 'deskIsland', 'glassWall', 'cabinet', 'waterCooler', 'deskIsland', 'plant'],
  wkdepot: ['dockRack', 'crates', 'poster:pWarE', 'dockRack', 'crates', 'pallet', 'barrel', 'workbench'],
  staff: ['lockers', 'restTable', 'poster:pStaI', 'kettleBar', 'coatRack', 'bench'],
  apteka: ['pharmCounter|pharmCounterS|shopCounter|kioskBar', 'pharmShelf', 'pharmShelf', 'pharmVitrine', 'bpKiosk', 'pharmShelf', 'plant', 'pharmShelf', 'pharmVitrine'],
  kava: ['coffeeBar|coffeeBarS|bar|kioskBar', 'wallBench', 'bookShelf', 'wallBench', 'plant', 'wallBench', 'plant', 'bookShelf'],
  shopClothes: ['sellerDesk', 'clothesRack', 'clothesRack', 'mirror', 'clothesRack', 'clothesRack', 'plant', 'mirror'],
  shopTech: ['sellerDesk', 'techWall', 'techWall', 'techWall', 'plant', 'techWall'],
  shopFlowers: ['sellerDesk', 'flowerStand', 'flowerStand', 'plant', 'flowerStand', 'plant', 'flowerStand'],
  cafeCoffee: ['coffeeBar|coffeeBarS|bar|kioskBar', 'wallBench', 'bookShelf', 'wallBench', 'plant'],
  market: ['atbLane|checkout', 'atbLane', 'fridgeWall', 'marketShelf', 'stockCage', 'marketShelf', 'fridgeWall', 'marketShelf', 'plant'],
  fastfood: ['tray', 'diningTable', 'diningTable', 'diningTable', 'diningTable', 'plant'],
  dining: ['bar|kioskBar', 'diningTable', 'diningTable', 'diningTable', 'diningTable', 'plant'],
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
  shop: ['shopShelf', 'shopShelf', 'shopCounter|kioskBar', 'shopShelf', 'shopShelf', 'plant'],
  cafe: ['bar|kioskBar', 'cafeTable', 'cafeTable', 'cafeTable', 'cafeTable', 'plant'],
  hallway: ['bench', 'console_', 'plant'],
};

// place furniture against the walls of a leaf rect (uv). ctx: { inside(u,v), clear: [[u,v,r]], rng, placed: [[u0,u1,v0,v1]] }
export function furnish(type, R, ctx, namesOverride) {
  const out = [], rng = ctx.rng; let names = namesOverride || PLAN[type] || [];
  if (!namesOverride && VARIANTS[type]) { const vs = VARIANTS[type]; const vi = (rng() * vs.length) | 0; names = PLAN[vs[vi]] || names; ctx.variant = vs[vi]; }
  const W = R.u1 - R.u0, H = R.v1 - R.v0; if (W < 2.0 || H < 2.0) return out;
  const maxN = Math.min(names.length, Math.floor((W + H) / 2.2) + 1);
  const sides = [0, 1, 2, 3], door = ctx.door;
  // distance of each side line from the entrance (uv): service lines go to the far ("back") wall, checkout lanes to the entrance ("front") wall
  const sideDist = s => !door ? 0 : s === 0 ? Math.abs(door[1] - R.v0) : s === 1 ? Math.abs(R.v1 - door[1]) : s === 2 ? Math.abs(door[0] - R.u0) : Math.abs(R.u1 - door[0]);
  const fp = (s, a, off, pc) => { let u0, u1, v0, v1;
    if (s === 0) { u0 = R.u0 + a; u1 = u0 + pc.w; v0 = R.v0 + off; v1 = v0 + pc.d; }
    else if (s === 1) { u0 = R.u0 + a; u1 = u0 + pc.w; v1 = R.v1 - off; v0 = v1 - pc.d; }
    else if (s === 2) { v0 = R.v0 + a; v1 = v0 + pc.w; u0 = R.u0 + off; u1 = u0 + pc.d; }
    else { v0 = R.v0 + a; v1 = v0 + pc.w; u1 = R.u1 - off; u0 = u1 - pc.d; }
    return [u0, u1, v0, v1]; };
  // footprint fully inside the room polygon (margin m, smaller margin mw at the wall side)
  const fits = (s, u0, u1, v0, v1) => { const m = 0.2, mw = 0.05, l = s === 2 ? mw : m, r = s === 3 ? mw : m, t = s === 0 ? mw : m, b = s === 1 ? mw : m;
    for (const [pu, pv] of [[u0 - l, v0 - t], [u1 + r, v0 - t], [u1 + r, v1 + b], [u0 - l, v1 + b], [(u0 + u1) / 2, (v0 + v1) / 2], [(u0 + u1) / 2, v0 - t], [(u0 + u1) / 2, v1 + b], [u0 - l, (v0 + v1) / 2], [u1 + r, (v0 + v1) / 2]]) if (!ctx.inside(pu, pv)) return false;
    return true; };
  // a wall really is right behind the piece: >= 2 of 3 probes 0.45 m behind the back edge are outside the room
  const backed = (s, u0, u1, v0, v1) => { let n = 0; for (const t of [0.2, 0.5, 0.8]) { const pu = s < 2 ? u0 + (u1 - u0) * t : s === 2 ? u0 - 0.45 : u1 + 0.45, pv = s >= 2 ? v0 + (v1 - v0) * t : s === 0 ? v0 - 0.45 : v1 + 0.45; if (!ctx.inside(pu, pv)) n++; } return n >= 2; };
  for (let k = 0, n = 0; k < names.length && n < maxN; k++) {
    const alts = names[k].split('|');
    for (let ai = 0; ai < alts.length; ai++) {
    const nm = alts[ai], pc = nm.startsWith('poster:') ? PIECES.poster(nm.slice(7), 1.5 + rng() * 0.3) : PIECES[nm](rng);
    if (!pc.spots && FRONT[nm]) front(pc, FRONT[nm]); if (AT[nm] && !pc.at) pc.at = AT[nm];
    const order = sides.slice(); for (let i = 3; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
    if (door && pc.at === 'back') order.sort((x, y) => sideDist(y) - sideDist(x)); else if (door && pc.at === 'front') order.sort((x, y) => sideDist(x) - sideDist(y));
    let placed = false;
    for (const s of order) {
      const len = (s < 2 ? W : H), depth = (s < 2 ? H : W);
      if (pc.w + 0.5 > len || pc.d + 1.2 > depth) continue;
      const nTry = pc.at ? 14 : 8;
      for (let tries = 0; tries < nTry && !placed; tries++) {
        const a = pc.at === 'back' && tries < 3 ? Math.max(0.3, (len - pc.w) / 2 + (tries - 1) * (len - pc.w) * 0.25) : 0.3 + rng() * Math.max(0.001, len - pc.w - 0.6);
        // slide away from the bounding-box edge until the footprint is inside the polygon (inner walls are inset / not on the bbox)
        let f = null;
        for (let off = WALL_D + 0.03; off < Math.min(3.0, depth / 3); off += 0.15) { const q = fp(s, a, off, pc); if (q[0] < R.u0 + 0.05 || q[1] > R.u1 - 0.05 || q[2] < R.v0 + 0.05 || q[3] > R.v1 - 0.05) break; if (fits(s, ...q)) { f = q; break; } }
        if (!f || !backed(s, ...f)) continue;
        const [u0, u1, v0, v1] = f; let ok = true;
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
          out.push({ u0: bu0, u1: bu1, v0: bv0, v1: bv1, y0: b.y0, y1: b.y1, rect: b.rect, color: b.color, solid: b.solid && b.y1 > 0.5, piece: nm, pid: n });
        }
        const tf = (a, b) => s === 0 ? [u0 + a, v0 + b] : s === 1 ? [u0 + a, v1 - b] : s === 2 ? [u0 + b, v0 + a] : [u1 - b, v0 + a];
        const td = (fa, fb) => s === 0 ? [fa, fb] : s === 1 ? [fa, -fb] : s === 2 ? [fb, fa] : [-fb, fa];
        emitExtras(pc, nm, ctx, tf, td, n);
        placed = true; n++;
      }
      if (placed) break;
    }
    if (placed) break;
    }
  }
  return out;
}
const AT = { mcdLine: 'back', puzLine: 'back', sushiLine: 'back', mcdCounter: 'back', servingLine: 'back', sushiBar: 'back', bar: 'back', tray: 'back', shopCounter: 'back', sellerDesk: 'back', silLane: 'front', atbLane: 'front', epiLane: 'front', checkout: 'front', silCheckout: 'front' };
const VARIANTS = { shop: ['shop', 'shopClothes', 'shopTech', 'shopFlowers', 'shop'], cafe: ['cafe', 'cafeCoffee', 'cafeCoffee'] };
const FRONT = { pharmShelf: 'shelf', pharmVitrine: 'shelf', clothesRack: 'shelf', techWall: 'shelf', flowerStand: 'shelf', bookShelf: 'shelf', marketShelf: 'shelf', silShelf: 'shelf', shopShelf: 'shelf', fridgeWall: 'shelf', silFridge: 'shelf', produce: 'shelf', tallRack: 'shelf', paintWall: 'shelf', lightWall: 'shelf', diyRack: 'shelf', bakery: 'shelf', carvedShelf: 'shelf',
  mcdKiosk: 'cust', checkout: 'pay', silCheckout: 'pay', sushiBar: 'cust', servingLine: 'line', mcdCounter: 'cust', tray: 'cust', bar: 'cust', shopCounter: 'cust', lumber: 'shelf', pallet: 'shelf' };
const SIGNS = {
  silpo: ['Овочі та фрукти', 'Молочне', 'Бакалія', 'Напої', 'Солодощі', "М'ясо та риба", 'Побутова хімія', 'Кава та чай', 'Сніданки', 'Консервація'],
  market: ['Бакалія', 'Молочне', 'Напої', 'Овочі', 'Солодощі', 'Побутова хімія', 'Консерви', 'Хліб'],
  epicentr: ['Будматеріали', 'Фарби', 'Інструмент', 'Освітлення', 'Сантехніка', 'Сад і город', 'Електрика', 'Кріплення', 'Декор'],
  diy: ['Інструмент', 'Будматеріали', 'Кріплення', 'Електрика'], shop: ['Товари', 'Новинки', 'Знижки'],
  apteka: ['Вітаміни', 'Ліки без рецепта', 'Косметика', 'Дитяче', 'Гігієна', 'Застуда і грип', 'Ортопедія', 'Знеболюючі'],
};
// spots / signs of a placed piece -> ctx.spots [{k,u,v,du,dv,seat,piece,pid}], ctx.signs [{u,v,y,w,h,t,du,dv}]
function emitExtras(pc, nm, ctx, tf, td, pid) {
  if (ctx.spots && pc.spots) for (const q of pc.spots) { const [u, v] = tf(q.a, q.b), [du, dv] = td(q.fa, q.fb); ctx.spots.push({ k: q.k, u, v, du, dv, seat: q.seat, piece: nm, pid }); }
  if (ctx.signs) {
    const sg = (pc.signs || []).slice();
    if (pc.sign) { const t = pc.sign.t || (ctx.signList && ctx.signList.length ? ctx.signList[(ctx.signI = (ctx.signI || 0) + 1) % ctx.signList.length] : ''); if (t) sg.push(Object.assign({ w: 1.5, h: 0.34, na: 1, nb: 0 }, pc.sign, { t })); }
    for (const g of sg) { const [u, v] = tf(g.a, g.b), [du, dv] = td(g.na ?? 0, g.nb ?? 1), h = g.h || 0.3; ctx.signs.push({ u, v, y: Math.min(g.y, (ctx.ceil || 3) - h / 2 - 0.08), w: g.w || 1.4, h, t: g.t, du, dv }); }
  }
}
// ---- centre islands of commercial halls (gondolas / racks / table grid), placed on a grid with aisles; mobile: fewer + lighter pieces
const CENTER = {
  apteka: { p: ['gondola', 'gondola', 'promo', 'gondola'], aisle: 1.6, o: { brand: 'bWhite', bcol: [0.12, 0.6, 0.34], lite: true, t: 'Знижки' } },
  kava: { p: ['roundTable', 'roundTable', 'roundTable', 'roundTable', 'roundTable', 'roundTable'], aisle: 1.1, o: {} },
  cafeCoffee: { p: ['roundTable', 'roundTable', 'roundTable'], aisle: 1.1, o: {} },
  shopClothes: { p: ['foldTable', 'foldTable', 'foldTable'], aisle: 1.4, o: {} },
  shopTech: { p: ['techTable', 'techTable', 'techTable'], aisle: 1.4, o: {} },
  silpo: { p: ['gondola', 'gondola', 'freezer', 'gondola', 'promo', 'gondola', 'gondola', 'freezer', 'gondola', 'gondola', 'promo', 'gondola'], aisle: 1.8, o: { brand: 'bSilG' } },
  market: { p: ['gondola', 'gondola', 'gondola', 'freezer', 'gondola', 'promo', 'gondola', 'gondola', 'gondola', 'freezer'], aisle: 1.7, o: { brand: 'bWhite', bcol: [0.25, 0.45, 0.9] } },
  epicentr: { p: ['rack2', 'rack2', 'promo', 'rack2', 'rack2', 'rack2', 'promo', 'rack2', 'rack2'], aisle: 2.2, o: {} },
  diy: { p: ['rack2', 'rack2', 'rack2', 'rack2'], aisle: 2.0, o: {} },
  shop: { p: ['gondola', 'gondola', 'gondola'], aisle: 1.6, o: { lite: true } },
  mcd: { p: ['yellowTable', 'yellowTable', 'yellowTable', 'yellowTable', 'yellowTable', 'yellowTable', 'yellowTable', 'yellowTable'], aisle: 1.25, o: {} },
  puzata: { p: ['woodTable', 'woodTable', 'woodTable', 'woodTable', 'woodTable', 'woodTable'], aisle: 1.3, o: {} },
  sushi: { p: ['cafeTable', 'cafeTable', 'cafeTable', 'cafeTable', 'cafeTable', 'cafeTable'], aisle: 1.25, o: {} },
  fastfood: { p: ['diningTable', 'diningTable', 'diningTable', 'diningTable', 'diningTable'], aisle: 1.3, o: {} },
  dining: { p: ['diningTable', 'diningTable', 'diningTable', 'diningTable', 'diningTable'], aisle: 1.3, o: {} },
  cafe: { p: ['cafeTable', 'cafeTable', 'cafeTable'], aisle: 1.2, o: {} },
};
const SHIFTS = [[0, 0], [0, 0.6], [0, -0.6], [0.75, 0], [-0.75, 0], [0, 1.2], [0, -1.2], [0.75, 0.6], [-0.75, -0.6], [0.75, -0.6], [-0.75, 0.6], [1.5, 0], [-1.5, 0]];
export function furnishCenter(type, R, ctx) {
  const cfg = CENTER[ctx.variant] || CENTER[type], out = []; if (!cfg) return out;
  const rng = ctx.rng, W = R.u1 - R.u0, H = R.v1 - R.v0, alongU = W >= H, LA = alongU ? W : H, LB = alongU ? H : W;
  const mob = !!ctx.mob, maxN = Math.min(cfg.p.length, mob ? Math.ceil(cfg.p.length / 2) : cfg.p.length), o = Object.assign({}, cfg.o, mob ? { lite: true } : {}, { H: (ctx.ceil || 3) - 0.35 });
  const proto = PIECES[cfg.p[0]](rng, o), cw = proto.w + 1.5, cd = proto.d + cfg.aisle;
  const nA = Math.floor((LA - 1.6 + 1.5) / cw), nB = Math.floor((LB - 1.6 + cfg.aisle) / cd); if (nA < 1 || nB < 1) return out;
  const offA = (LA - (nA * cw - 1.5)) / 2, offB = (LB - (nB * cd - cfg.aisle)) / 2;
  ctx.signList = SIGNS[type] || null;
  const cells = []; for (let j = 0; j < nB; j++) for (let i = 0; i < nA; i++) cells.push([i, j]);
  cells.sort((p, q) => Math.hypot(p[0] - (nA - 1) / 2, (p[1] - (nB - 1) / 2) * 1.3) - Math.hypot(q[0] - (nA - 1) / 2, (q[1] - (nB - 1) / 2) * 1.3));   // centre-out
  let n = 0, k = 0;
  for (const [i, j] of cells) {
    if (n >= maxN) break; const nm = cfg.p[k % cfg.p.length], pc = PIECES[nm](rng, o);
    let u0, v0, u1, v1, ok = false;
    for (const [sa, sb] of SHIFTS) {
      const a0 = offA + i * cw + (proto.w - pc.w) / 2 + sa, b0 = offB + j * cd + (proto.d - pc.d) / 2 + sb;
      u0 = alongU ? R.u0 + a0 : R.u0 + b0; v0 = alongU ? R.v0 + b0 : R.v0 + a0; u1 = u0 + (alongU ? pc.w : pc.d); v1 = v0 + (alongU ? pc.d : pc.w);
      ok = true; const m = 0.6;
      for (const [pu, pv] of [[u0 - m, v0 - m], [u1 + m, v0 - m], [u1 + m, v1 + m], [u0 - m, v1 + m], [(u0 + u1) / 2, (v0 + v1) / 2], [(u0 + u1) / 2, v0 - m], [(u0 + u1) / 2, v1 + m], [u0 - m, (v0 + v1) / 2], [u1 + m, (v0 + v1) / 2]]) if (!ctx.inside(pu, pv)) { ok = false; break; }
      if (ok) for (const [cu, cv, cr] of ctx.clear) { const du = Math.max(u0 - cu, 0, cu - u1), dv = Math.max(v0 - cv, 0, cv - v1); if (du * du + dv * dv < (cr + 0.9) * (cr + 0.9)) { ok = false; break; } }
      if (ok) for (const q of ctx.placed) if (u0 < q[1] + 1.2 && u1 > q[0] - 1.2 && v0 < q[3] + 1.2 && v1 > q[2] - 1.2) { ok = false; break; }
      if (ok) break;
    }
    if (!ok) continue;
    ctx.placed.push([u0, u1, v0, v1]); k++;
    const tf = (a, b) => alongU ? [u0 + a, v0 + b] : [u0 + b, v0 + a], td = (fa, fb) => alongU ? [fa, fb] : [fb, fa];
    for (const b of pc.boxes) { const [p0u, p0v] = tf(b.a0, b.b0), [p1u, p1v] = tf(b.a1, b.b1); out.push({ u0: Math.min(p0u, p1u), u1: Math.max(p0u, p1u), v0: Math.min(p0v, p1v), v1: Math.max(p0v, p1v), y0: b.y0, y1: b.y1, rect: b.rect, color: b.color, solid: b.solid && b.y1 > 0.5, piece: nm, pid: 100 + n }); }
    emitExtras(pc, nm, ctx, tf, td, 100 + n); n++;
  }
  return out;
}


// ---- rented home (js/rent.js): room types for the tenant's level + guaranteed bed / fridge / kitchen counter
// rooms: [{area, door, stair}] -> types[]
export function homeTypes(rooms, rng) {
  const n = rooms.length, types = new Array(n).fill('hallway');
  if (n === 1) return ['living'];
  const idx = rooms.map((r, i) => i).filter(i => rooms[i].area >= 3);
  const free = idx.filter(i => !rooms[i].stair && !rooms[i].door);
  const hall = idx.filter(i => !free.includes(i));
  for (const i of hall) types[i] = rooms[i].area >= 12 ? 'living' : 'hallway';
  const rest = free.slice().sort((a, b) => rooms[a].area - rooms[b].area), m = rest.length;
  const nb = m >= 3 ? Math.max(1, Math.round(m / 7)) : 0, nk = m >= 2 ? Math.max(1, Math.round(m / 9)) : 0, nl = m >= 1 ? Math.max(1, Math.round(m / 10)) : 0;
  const bath = rest.filter(i => rooms[i].area < 16).slice(0, nb); for (const i of bath) { types[i] = 'bathroom'; rest.splice(rest.indexOf(i), 1); }
  for (const i of rest.splice(0, nk)) types[i] = 'kitchen';
  rest.sort((a, b) => rooms[b].area - rooms[a].area);
  rest.forEach((i, k) => { types[i] = k < nl ? 'living' : 'bedroom'; });
  if (!types.includes('bedroom') && !types.includes('living') && free.length) types[free[free.length - 1]] = 'living';
  return types;
}
// a piece placed in the middle of the room without any checks (last resort when furnish() found no free wall)
export function forcePiece(name, R, rng, dx = 0) {
  const pc = PIECES[name](rng), cu = (R.u0 + R.u1) / 2 - pc.w / 2 + dx, cv = (R.v0 + R.v1) / 2 - pc.d / 2, out = [];
  for (const b of pc.boxes) out.push({ u0: cu + b.a0, u1: cu + b.a1, v0: cv + b.b0, v1: cv + b.b1, y0: b.y0, y1: b.y1, rect: b.rect, color: b.color, solid: b.solid && b.y1 > 0.5, piece: name, pid: 0 });
  return out;
}
