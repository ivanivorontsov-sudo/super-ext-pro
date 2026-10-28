// Super Ext Pro — функции на странице: тёмная тема, автообновление, скорость видео, режим чтения, линейка.
(() => {
if (window.__superPro) return; window.__superPro = true;
const H = location.hostname;
const DARK_ID = 'superpro-dark';
function dark(on) {
  let st = document.getElementById(DARK_ID);
  if (!on) { st?.remove(); return false; }
  if (!st) { st = document.createElement('style'); st.id = DARK_ID; (document.head || document.documentElement).append(st); }
  st.textContent = `html{filter:invert(.92) hue-rotate(180deg)!important;background:#fff!important}
img,video,picture,canvas,iframe,svg image,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important}`;
  return true;
}
chrome.storage.local.get(['darkSites', 'userCode']).then(r => { if ((r.darkSites || []).includes(H)) dark(true); });
// Автообновление: интервал хранится в sessionStorage вкладки.
function arm() { const s = +sessionStorage.getItem('superpro-refresh'); clearTimeout(window.__spT); if (s > 0) window.__spT = setTimeout(() => location.reload(), s * 1000); return s; }
arm();
// Скорость видео: Shift+. / Shift+, / Shift+0 на любом сайте
function videos() { return [...document.querySelectorAll('video,audio')]; }
function speed(v) { videos().forEach(m => m.playbackRate = v); toast('Скорость ' + v + '×'); return v; }
addEventListener('keydown', e => {
  if (!e.shiftKey || /INPUT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable) return;
  const cur = videos()[0]?.playbackRate || 1;
  if (e.code === 'Period') speed(Math.min(16, +(cur + .25).toFixed(2)));
  else if (e.code === 'Comma') speed(Math.max(.25, +(cur - .25).toFixed(2)));
  else if (e.code === 'Digit0') speed(1);
}, true);
function toast(t) { const d = document.createElement('div'); d.textContent = t;
  d.style.cssText = 'position:fixed;z-index:2147483647;top:12px;right:12px;background:#222;color:#fff;padding:8px 12px;border-radius:8px;font:14px sans-serif';
  document.documentElement.append(d); setTimeout(() => d.remove(), 1200); }
function reader() {
  if (document.getElementById('superpro-reader')) { document.getElementById('superpro-reader').remove(); return false; }
  let best = document.querySelector('article'), score = best ? best.innerText.length : 0;
  if (!best || score < 500) document.querySelectorAll('main,section,div').forEach(e => {
    const p = e.querySelectorAll(':scope > p').length, l = e.innerText?.length || 0, s = p * 200 + l * (p ? 1 : .1);
    if (s > score) { score = s; best = e; } });
  if (!best) best = document.body;
  const box = document.createElement('div'); box.id = 'superpro-reader';
  const sh = box.attachShadow({mode: 'open'});
  const c = best.cloneNode(true); c.querySelectorAll('script,style,iframe,nav,aside,form,button,[class*=ad],[id*=ad-]').forEach(e => e.remove());
  sh.innerHTML = `<style>:host{all:initial;position:fixed;inset:0;z-index:2147483647;background:#f7f3ea;overflow:auto}
.w{max-width:720px;margin:40px auto;padding:0 20px;font:19px/1.65 Georgia,serif;color:#222}img{max-width:100%;height:auto}
.x{position:fixed;top:10px;right:16px;font:16px sans-serif;cursor:pointer;border:0;background:#ddd;border-radius:6px;padding:6px 10px}</style>
<button class="x">✕ Закрыть</button><div class="w"><h1></h1></div>`;
  sh.querySelector('h1').textContent = document.title; sh.querySelector('.w').append(c);
  sh.querySelector('.x').onclick = () => box.remove();
  document.documentElement.append(box); return true;
}
function ruler() {
  if (document.getElementById('superpro-ruler')) { document.getElementById('superpro-ruler').remove(); return false; }
  const o = document.createElement('div'); o.id = 'superpro-ruler';
  o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,.05)';
  const r = document.createElement('div'), lab = document.createElement('div');
  r.style.cssText = 'position:fixed;border:1px dashed #e11;background:rgba(255,0,0,.08);pointer-events:none';
  lab.style.cssText = 'position:fixed;top:8px;left:8px;background:#111;color:#fff;font:13px monospace;padding:4px 8px;border-radius:4px';
  lab.textContent = 'Линейка: тяните мышью. Esc — выход'; o.append(r, lab);
  let s = null;
  o.onmousedown = e => { s = [e.clientX, e.clientY]; };
  o.onmousemove = e => { if (!s) return; const x = Math.min(s[0], e.clientX), y = Math.min(s[1], e.clientY), w = Math.abs(e.clientX - s[0]), h = Math.abs(e.clientY - s[1]);
    Object.assign(r.style, {left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px'});
    lab.textContent = `${w} × ${h} px · диагональ ${Math.round(Math.hypot(w, h))} px`; };
  o.onmouseup = () => { s = null; };
  addEventListener('keydown', function k(e) { if (e.key === 'Escape') { o.remove(); removeEventListener('keydown', k); } });
  document.documentElement.append(o); return true;
}
chrome.runtime.onMessage.addListener((m, s, reply) => {
  switch (m.cmd) {
    case 'pro.dark': return reply(dark(m.on));
    case 'pro.reader': return reply(reader());
    case 'pro.ruler': return reply(ruler());
    case 'pro.rulerText': return reply(document.querySelector('#superpro-ruler div:last-child')?.textContent);
    case 'pro.speed': return reply(speed(m.v));
    case 'pro.refresh': sessionStorage.setItem('superpro-refresh', m.sec || 0); return reply(arm());
    case 'pro.storage': { const d = s => Object.keys(s).map(k => ({k, v: s.getItem(k)}));
      return reply({local: d(localStorage), session: d(sessionStorage).filter(x => !x.k.startsWith('superpro'))}); }
    case 'pro.delStorage': (m.area === 'session' ? sessionStorage : localStorage).removeItem(m.k); return reply(true);
  }
});
})();
