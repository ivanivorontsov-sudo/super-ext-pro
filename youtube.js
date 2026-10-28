// YouTube: петля целиком / A-B, скорость, дизлайки (Return YouTube Dislike API — оценка, а не официальные данные).
(() => {
let st = {loop: false, a: null, b: null}, vid = null, settings = {};
const $ = s => document.querySelector(s);
const fmt = t => t == null ? '—' : `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const nf = n => n == null ? '?' : n >= 1e6 ? (n/1e6).toFixed(1)+' млн' : n >= 1e3 ? (n/1e3).toFixed(1)+' тыс.' : String(n);
function videoId() { const u = new URL(location.href); return u.searchParams.get('v') || (u.pathname.match(/\/shorts\/([\w-]{11})/)||[])[1]; }
function video() { return $('video.html5-main-video') || $('video'); }
function build() {
  const host = $('#above-the-fold #title') || $('ytd-watch-metadata #title') || $('#info-contents');
  if (!host || $('#sa-yt')) return;
  const p = document.createElement('div'); p.id = 'sa-yt';
  p.innerHTML = `<button data-k="loop" title="Повторять всё видео">🔁 Петля</button>
   <button data-k="a" title="Начало отрезка = текущее время">A: <b>—</b></button>
   <button data-k="b" title="Конец отрезка = текущее время">B: <b>—</b></button>
   <button data-k="clear">✕ A-B</button>
   <select data-k="rate" title="Скорость">${[0.25,0.5,0.75,1,1.25,1.5,1.75,2,2.5,3,4,8,16].map(r=>`<option value="${r}" ${r==1?'selected':''}>${r}×</option>`).join('')}</select>
   <span class="sa-dis" title="Оценка Return YouTube Dislike">👍 <b class="l">…</b> 👎 <b class="d">…</b><span class="sa-bar"><i></i></span></span>`;
  host.after(p);
  p.onclick = e => { const k = e.target.closest('button')?.dataset.k, v = video(); if (!k || !v) return;
    if (k === 'loop') st.loop = !st.loop;
    if (k === 'a') st.a = v.currentTime;
    if (k === 'b') st.b = v.currentTime;
    if (k === 'clear') st.a = st.b = null;
    if (st.a != null && st.b != null && st.b < st.a) [st.a, st.b] = [st.b, st.a];
    render(); };
  p.querySelector('select').onchange = e => { const v = video(); if (v) v.playbackRate = +e.target.value; };
  render(); loadDislikes();
}
function render() {
  const p = $('#sa-yt'); if (!p) return;
  p.querySelector('[data-k=loop]').classList.toggle('on', st.loop);
  p.querySelector('[data-k=a] b').textContent = fmt(st.a);
  p.querySelector('[data-k=b] b').textContent = fmt(st.b);
  p.querySelector('[data-k=a]').classList.toggle('on', st.a != null);
  p.querySelector('[data-k=b]').classList.toggle('on', st.b != null);
  const v = video(); if (v) v.loop = st.loop && st.b == null;
}
async function loadDislikes() {
  const p = $('#sa-yt'), id = videoId(); if (!p || !id || settings.ryd === false) { p?.querySelector('.sa-dis')?.remove(); return; }
  const r = await chrome.runtime.sendMessage({cmd: 'dislikes', id});
  if (!r || $('#sa-yt') !== p) { p.querySelector('.d').textContent = 'н/д'; return; }
  p.querySelector('.l').textContent = nf(r.likes); p.querySelector('.d').textContent = nf(r.dislikes);
  const tot = (r.likes||0) + (r.dislikes||0); p.querySelector('.sa-bar i').style.width = tot ? (100*r.likes/tot)+'%' : '0';
}
setInterval(() => {
  const id = videoId();
  if (id !== vid) { vid = id; st = {loop: false, a: null, b: null}; $('#sa-yt')?.remove(); }
  if (id && settings.ytControls !== false) build();
  const v = video();
  if (v && st.a != null && st.b != null && (v.currentTime >= st.b || v.currentTime < st.a - 0.5)) v.currentTime = st.a;
}, 250);
chrome.storage.local.get('settings').then(r => settings = r.settings || {});
chrome.runtime.onMessage.addListener((m, s, reply) => { if (m.cmd === 'ytInfo') reply({id: videoId(), title: document.title.replace(/ - YouTube$/, '')}); });
})();
