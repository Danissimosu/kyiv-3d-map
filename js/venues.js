// Commercial venues (shops / food): opening hours on the game clock, how busy a venue is by hour, generic street shops.
// Shared by game.js (shop panel), city.js (staff / customer NPCs) and jobs.js (venue jobs). No imports: safe from import cycles.
export const HOURS = { mcd: [0, 24], puzata: [9, 22], sushi: [11, 23], silpo: [8, 23], atb: [8, 23], epicentr: [9, 21], apteka: [8, 22], kava: [7, 21], street: [9, 21] };
export const isOpen = (key, h) => { const o = HOURS[key]; return !o || (h >= o[0] && h < o[1]); };
// 0..1 share of the customer capacity wanted at game hour h (0 when closed): lunch / evening peaks, coffee shops also in the morning
export function crowd(key, h) {
  if (!isOpen(key, h)) return 0;
  const g = (c, w) => Math.exp(-(((h - c) / w) ** 2)), food = key === 'mcd' || key === 'puzata' || key === 'sushi';
  let v = 0.35 + 0.65 * Math.max(g(13, 1.6), g(18.5, 1.9), key === 'kava' ? g(8.5, 1.3) : 0, food ? 0 : g(17.5, 2.5) * 0.9);
  if (h < 6 || h >= 23) v *= 0.3;   // McDonald's at night
  return Math.min(1, v);
}
// staff / customer stand spots emitted by rooms.js pieces (k): service stations vs customer places
export const STAFF_K = ['reg', 'till', 'serve', 'cash', 'roll', 'cut', 'grill', 'fryer', 'prep', 'drinks', 'kitchen', 'rice', 'barista', 'milk', 'drawer'];
export const CUST_K = new Set(['cust', 'queue', 'pickup', 'pay', 'line', 'shelf', 'seat']);
