(() => {
if (document.getElementById('__sa_region')) return;
const o = document.createElement('div'); o.id = '__sa_region';
o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,.25)';
const b = document.createElement('div'); b.style.cssText = 'position:fixed;border:2px dashed #6366f1;background:rgba(99,102,241,.12);display:none';
const tip = document.createElement('div'); tip.textContent = 'Выделите область мышью (Esc — отмена)';
tip.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:6px 12px;border-radius:8px;font:14px sans-serif';
o.append(b, tip); document.documentElement.appendChild(o);
let sx, sy, r;
o.onmousedown = e => { sx = e.clientX; sy = e.clientY; b.style.display = 'block'; };
o.onmousemove = e => { if (sx == null) return; r = {x: Math.min(sx, e.clientX), y: Math.min(sy, e.clientY), w: Math.abs(e.clientX - sx), h: Math.abs(e.clientY - sy)};
  Object.assign(b.style, {left: r.x+'px', top: r.y+'px', width: r.w+'px', height: r.h+'px'}); };
o.onmouseup = () => { o.remove(); if (r && r.w > 4 && r.h > 4) setTimeout(() => chrome.runtime.sendMessage({cmd:'regionDone', rect: r, dpr: devicePixelRatio}), 120); };
addEventListener('keydown', e => { if (e.key === 'Escape') o.remove(); }, {once: true});
})();
