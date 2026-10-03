// Small UI toolkit shared by pois.js / game.js / crime.js: panels, toasts, buttons, modal state.
export const $ = id => document.getElementById(id);
export const UI = { modal: 0, onModal: null, IS_TOUCH: false };
const style = document.createElement('style');
style.textContent = `
.gp{position:fixed;inset:0;z-index:12;background:rgba(8,14,22,.94);color:#fff;font:15px/1.35 -apple-system,system-ui,sans-serif;display:none;overflow:auto;-webkit-overflow-scrolling:touch;padding:calc(14px + env(safe-area-inset-top)) 14px calc(20px + env(safe-area-inset-bottom));touch-action:pan-y}
.gp h2{margin:0 0 8px;font-size:19px;font-weight:650;display:flex;align-items:center;justify-content:space-between}
.gp .x{font-size:20px;padding:4px 12px;background:rgba(255,255,255,.14);border-radius:10px}
.gp .row{display:flex;align-items:center;gap:8px;padding:10px;margin:5px 0;background:rgba(255,255,255,.1);border-radius:10px}
.gp .row .t{flex:1;min-width:0}.gp .row .t b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gp .row .t small{opacity:.7}
.gp .btn,.gb{display:inline-block;padding:9px 13px;border-radius:10px;background:#2d7ff9;color:#fff;font-weight:600;text-align:center;user-select:none;-webkit-user-select:none;cursor:pointer}
.gp .btn.g{background:rgba(255,255,255,.18)}.gp .btn.r{background:#c0392b}.gp .btn.off{opacity:.4;pointer-events:none}
.gp .chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 8px}.gp .chip{padding:6px 11px;border-radius:16px;background:rgba(255,255,255,.14);font-size:14px}.gp .chip.on{background:#ffd966;color:#111}
.gp .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.gp .cell{aspect-ratio:1;background:rgba(255,255,255,.12);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:26px;position:relative}
.gp .cell small{font-size:10px;opacity:.8;text-align:center;line-height:1.1}.gp .cell i{position:absolute;right:5px;bottom:2px;font-size:12px;font-style:normal;font-weight:700}.gp .cell.sel{outline:3px solid #ffd966}
#toasts{position:fixed;left:50%;top:calc(96px + env(safe-area-inset-top));transform:translateX(-50%);z-index:15;pointer-events:none;display:flex;flex-direction:column;gap:6px;align-items:center;width:90vw}
body.touch #toasts{top:calc(36px + env(safe-area-inset-top))}body.touch #toasts div{font-size:12px;padding:3px 9px;max-width:70vw}
#toasts div{background:rgba(10,16,24,.66);color:#fff;padding:5px 11px;border-radius:12px;font:600 13px -apple-system,system-ui,sans-serif;max-width:92vw;text-align:center;animation:tin .18s}
@keyframes tin{from{opacity:0;transform:translateY(-6px)}to{opacity:1}}
.gbtn{position:fixed;z-index:7;width:40px;height:40px;border-radius:50%;background:rgba(12,18,26,.4);border:2px solid rgba(255,255,255,.4);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none}
.gbtn.on{background:rgba(255,217,102,.85);color:#111}
`;
document.head.appendChild(style);
export function el(tag, cls, html, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
// tap that works for mouse and touch without double firing
export function tap(e, fn) { let t0 = 0; e.addEventListener('touchend', ev => { ev.preventDefault(); t0 = performance.now(); fn(ev); }, { passive: false }); e.addEventListener('click', ev => { if (performance.now() - t0 < 500) return; fn(ev); }); return e; }
let tbox = null;
export function toast(msg, ms = 2400) {
  if (!tbox) tbox = el('div', '', '', document.body), tbox.id = 'toasts';
  const d = el('div', '', msg, tbox); while (tbox.children.length > 2) tbox.firstChild.remove();
  setTimeout(() => d.remove(), ms);
}
export function panel(id, title) {
  const root = el('div', 'gp', '', document.body); root.id = id;
  const h = el('h2', '', `<span>${title}</span>`, root), x = el('span', 'x', '✕', h); const body = el('div', '', '', root);
  const p = { root, body, titleEl: h.firstChild, isOpen: false, onOpen: null, onClose: null,
    open() { if (p.isOpen) return; p.isOpen = true; root.style.display = 'block'; root.scrollTop = 0; UI.modal++; for (const k in window.__kyiv?.keys || {}) window.__kyiv.keys[k] = false; if (document.pointerLockElement) document.exitPointerLock(); p.onOpen && p.onOpen(); },
    close() { if (!p.isOpen) return; p.isOpen = false; root.style.display = 'none'; UI.modal = Math.max(0, UI.modal - 1); p.onClose && p.onClose(); UI.onModal && UI.onModal(UI.modal); },
    toggle() { p.isOpen ? p.close() : p.open(); } };
  tap(x, () => p.close());
  return p;
}
