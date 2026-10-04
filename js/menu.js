// Main menu / pause menu (DOM). Two modes: 'main' (on load: Новая игра / Загрузить игру / Удалить сохранение) and 'pause'
// (Продолжить / Сохранить игру / В главное меню). Touch friendly, safe-area aware, dark overlay over the live city view.
import { el, tap, toast } from './ui.js';
import { listSaves, describe, SLOT_NAMES, deleteAll, hasSave } from './save.js';
const css = document.createElement('style');
css.textContent = `
#menu{position:fixed;inset:0;z-index:40;display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:-apple-system,system-ui,"Segoe UI",Roboto,sans-serif;
 padding:calc(14px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(14px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left));box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch;
 background:radial-gradient(ellipse at 50% 30%,rgba(18,30,48,.45),rgba(4,8,14,.86) 70%),linear-gradient(180deg,rgba(6,12,20,.55),rgba(4,8,14,.82));-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);user-select:none;-webkit-user-select:none;touch-action:pan-y}
#menu .mbox{display:flex;flex-direction:column;align-items:center;margin:auto 0;width:100%}
#menu .mlogo{font-size:13px;letter-spacing:.32em;text-transform:uppercase;opacity:.7;margin-bottom:6px}
#menu h1{margin:0;font-size:clamp(44px,12vw,84px);font-weight:800;letter-spacing:.01em;line-height:1;background:linear-gradient(180deg,#fff2b8,#ffc933 55%,#ee9b00);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 18px rgba(0,0,0,.6))}
#menu .msub{margin:10px 0 22px;font-size:14px;opacity:.78;text-align:center;max-width:420px}
#menu .mbtn{display:flex;align-items:center;justify-content:center;gap:10px;width:min(86vw,340px);min-height:56px;box-sizing:border-box;margin:7px 0;padding:0 18px;border-radius:16px;font-size:19px;font-weight:650;cursor:pointer;
 background:rgba(255,255,255,.13);border:1.5px solid rgba(255,255,255,.28);color:#fff;-webkit-tap-highlight-color:transparent;box-shadow:0 6px 22px rgba(0,0,0,.35);transition:transform .08s,background .15s}
#menu .mbtn:active{transform:scale(.97)}#menu .mbtn.pri{background:linear-gradient(180deg,#ffd966,#f2b01e);color:#1b1608;border-color:#ffe9a0}
#menu .mbtn.dis{opacity:.4;pointer-events:none}#menu .mbtn.del{min-height:46px;font-size:15px;font-weight:600;background:rgba(160,30,30,.28);border-color:rgba(255,120,120,.4);color:#ffb4b4;margin-top:16px}
#menu .minfo{margin:-2px 0 4px;font-size:12.5px;opacity:.8;text-align:center;line-height:1.35;max-width:340px}
#menu .mload{display:flex;flex-direction:column;align-items:center;margin:4px 0 12px}#menu .mload .mb{width:min(70vw,300px);height:6px;border-radius:3px;background:rgba(255,255,255,.18);overflow:hidden}
#menu .mload .mb i{display:block;height:100%;width:0;background:#ffd966;transition:width .2s}#menu .mload .mt{font-size:12.5px;opacity:.8;margin-top:6px}
#menu .mfoot{margin-top:18px;font-size:11.5px;opacity:.5;text-align:center;max-width:420px}
#mdlg{position:fixed;inset:0;z-index:45;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:20px;box-sizing:border-box}
#mdlg .card{width:min(92vw,360px);background:#14202e;border:1.5px solid rgba(255,255,255,.2);border-radius:18px;padding:20px 18px 14px;color:#fff;font-family:-apple-system,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.6);max-height:84vh;overflow-y:auto}
#mdlg h3{margin:0 0 8px;font-size:19px}#mdlg p{margin:0 0 14px;font-size:14.5px;line-height:1.4;opacity:.88}
#mdlg .row{display:flex;gap:10px}#mdlg .b{flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:13px;font-weight:650;font-size:16px;background:rgba(255,255,255,.14);cursor:pointer}
#mdlg .b.y{background:#ffd966;color:#1b1608}#mdlg .b.r{background:#c0392b}
#mdlg .slot{padding:12px;margin:0 0 10px;border-radius:13px;background:rgba(255,255,255,.1);cursor:pointer;font-size:14px;line-height:1.4}#mdlg .slot b{font-size:16px;display:block}
body.inmenu .svhud,body.inmenu .hl,body.inmenu #hud,body.inmenu #mini,body.inmenu .gbtn,body.inmenu #tui,body.inmenu #help,body.inmenu #doorhint,body.inmenu #cross,body.inmenu #uw{display:none!important}
#toasts{z-index:50!important}
#autosv{position:fixed;left:calc(10px + env(safe-area-inset-left));bottom:calc(8px + env(safe-area-inset-bottom));z-index:9;font:600 11px system-ui;color:#fff;background:rgba(10,16,24,.6);padding:3px 8px;border-radius:9px;opacity:0;transition:opacity .4s;pointer-events:none}
`;
document.head.appendChild(css);

export class Menu {
  constructor(h) {   // h: { newGame(), loadSave(save), saveManual(), saveAuto(), resume(), toMain(), isReady(), progress() }
    this.h = h; this.mode = 'main'; this.open = false;
    this.root = el('div', '', '', document.body); this.root.id = 'menu';
    this.dlg = el('div', '', '', document.body); this.dlg.id = 'mdlg'; this.sv = el('div', '', '💾 сохранено', document.body); this.sv.id = 'autosv';
  }
  flash() { this.sv.style.opacity = 1; clearTimeout(this._ft); this._ft = setTimeout(() => { this.sv.style.opacity = 0; }, 1400); }
  show(mode) {
    this.mode = mode; this.open = true; this.root.style.display = 'flex'; this.render(); this.root.scrollTop = 0;
  }
  hide() { this.open = false; this.root.style.display = 'none'; this.dlg.style.display = 'none'; }
  setProgress(p, text) { if (this._bar) this._bar.style.width = (p * 100) + '%'; if (this._txt) this._txt.textContent = text; }
  confirm(title, text, yesLabel, onYes, danger) {
    const d = this.dlg; d.innerHTML = ''; d.style.display = 'flex'; const c = el('div', 'card', `<h3>${title}</h3><p>${text}</p>`, d), r = el('div', 'row', '', c);
    tap(el('div', 'b', 'Отмена', r), () => { d.style.display = 'none'; }); tap(el('div', 'b ' + (danger ? 'r' : 'y'), yesLabel, r), () => { d.style.display = 'none'; onYes(); });
  }
  _line(s) { const d = describe(s); return `${d.when} · ₴${d.money} · ${d.game}`; }
  render() {
    const r = this.root, h = this.h; r.innerHTML = ''; const box = el('div', 'mbox', '', r), saves = listSaves(), ready = h.isReady();
    this._bar = this._txt = null;
    if (this.mode === 'main') {
      el('div', 'mlogo', 'Open world · 1:1', box); el('h1', '', 'Киев 3D', box); el('div', 'msub', 'Прогулка по настоящему Киеву: работа, транспорт, розыск', box);
      if (!ready) { const l = el('div', 'mload', '<div class="mb"><i></i></div><div class="mt">Загрузка города…</div>', box); this._bar = l.querySelector('i'); this._txt = l.querySelector('.mt'); }
      const nb = el('div', 'mbtn pri' + (ready ? '' : ' dis'), '🏙️ Новая игра', box);
      tap(nb, () => { if (!h.isReady()) return; if (hasSave()) this.confirm('Начать новую игру?', 'Прогресс в сохранениях будет перезаписан: автосохранение заменит новая игра уже через 30 секунд. Ручное сохранение останется, пока вы не сохраните поверх него.', 'Новая игра', () => h.newGame()); else h.newGame(); });
      const has = saves.length > 0, lb = el('div', 'mbtn' + (has && ready ? '' : ' dis'), '📂 Загрузить игру', box);
      tap(lb, () => { if (!has || !h.isReady()) return; if (saves.length === 1) h.loadSave(saves[0].save); else this.pickSave(saves); });
      el('div', 'minfo', has ? `Последнее: ${this._line(saves[0].save)}` : 'Нет сохранений', box);
      if (has) tap(el('div', 'mbtn del', '🗑 Удалить сохранение', box), () => this.confirm('Удалить сохранение?', 'Все сохранения (ручное и автосохранение) будут удалены безвозвратно.', 'Удалить', () => { deleteAll(); toast('Сохранения удалены'); this.render(); }, true));
      el('div', 'mfoot', 'Автосохранение каждые 30 секунд и при выходе. Данные OpenStreetMap.', box);
    } else {
      el('div', 'mlogo', 'Пауза', box); el('h1', '', 'Киев 3D', box); el('div', 'msub', h.statusLine ? h.statusLine() : '', box);
      tap(el('div', 'mbtn pri', '▶ Продолжить', box), () => h.resume());
      tap(el('div', 'mbtn', '💾 Сохранить игру', box), () => { if (h.saveManual()) { toast('💾 Игра сохранена'); this.render(); } else toast('Сейчас сохранить нельзя'); });
      const m = saves.find(x => x.slot === 'manual'); el('div', 'minfo', m ? `Сохранено: ${this._line(m.save)}` : 'Ручного сохранения ещё нет', box);
      tap(el('div', 'mbtn', '🏠 В главное меню', box), () => h.toMain());
    }
  }
  pickSave(saves) {
    const d = this.dlg; d.innerHTML = ''; d.style.display = 'flex'; const c = el('div', 'card', '<h3>Загрузить игру</h3>', d);
    for (const { slot, save } of saves) { const x = el('div', 'slot', `<b>${SLOT_NAMES[slot]}</b>${this._line(save)}<br><span style="opacity:.7">❤ ${Math.round(save.S.hp)}%${save.meta && save.meta.place ? ' · ' + save.meta.place : ''}</span>`, c); tap(x, () => { d.style.display = 'none'; this.h.loadSave(save); }); }
    tap(el('div', 'b', 'Назад', el('div', 'row', '', c)), () => { d.style.display = 'none'; });
  }
}
