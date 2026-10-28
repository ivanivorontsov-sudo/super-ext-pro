// Сканирование страницы по запросу панели. Ничего никуда не отправляет.
(() => {
if (window.__superApp) return; window.__superApp = true;
const abs = u => { try { return new URL(u, location.href).href; } catch { return null; } };
const DOC_RE = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|csv|txt|rtf|epub|zip|rar|7z|tar|gz|apk|exe|msi|dmg|iso|json|xml)(\?|#|$)/i;
function scan() {
  const out = {images: [], media: [], docs: [], tables: []}, seen = new Set();
  const push = (arr, o) => { if (o.url && !seen.has(o.url) && !o.url.startsWith('data:') ) { seen.add(o.url); arr.push(o); } };
  document.querySelectorAll('img').forEach(i => push(out.images, {url: abs(i.currentSrc || i.src), w: i.naturalWidth, h: i.naturalHeight, alt: i.alt}));
  document.querySelectorAll('[style*="background-image"]').forEach(e => { const m = /url\(["']?([^"')]+)/.exec(e.style.backgroundImage); if (m) push(out.images, {url: abs(m[1])}); });
  document.querySelectorAll('meta[property="og:image"],link[rel~="icon"]').forEach(m => push(out.images, {url: abs(m.content || m.href)}));
  document.querySelectorAll('video,audio,video source,audio source').forEach(v => {
    const u = v.currentSrc || v.src; if (u && !u.startsWith('blob:')) push(out.media, {url: abs(u), kind: /audio/i.test(v.tagName + (v.parentElement?.tagName||'')) ? 'audio' : 'video', src: 'страница'}); });
  document.querySelectorAll('a[href]').forEach(a => { const u = abs(a.href); if (!u) return;
    if (/\.(mp4|webm|mp3|m4a|ogg|wav|flac|m3u8|mpd)(\?|$)/i.test(u)) push(out.media, {url: u, kind: /m3u8/.test(u)?'hls':/mpd/.test(u)?'dash':'video', src: 'ссылка'});
    else if (DOC_RE.test(u)) push(out.docs, {url: u, name: (a.textContent||'').trim().slice(0,80)}); });
  document.querySelectorAll('table').forEach((t, i) => {
    const rows = [...t.rows].map(r => [...r.cells].map(c => c.innerText.trim()));
    if (rows.length > 1) out.tables.push({i, rows: rows.length, cols: Math.max(...rows.map(r=>r.length)), data: rows, caption: t.caption?.innerText || ''}); });
  return out;
}
function unlock() {
  const st = document.createElement('style');
  st.textContent = '*{user-select:text!important;-webkit-user-select:text!important}';
  document.documentElement.appendChild(st);
  ['contextmenu','copy','cut','paste','selectstart','dragstart','mousedown','keydown'].forEach(ev =>
    document.addEventListener(ev, e => e.stopPropagation(), true));
}
chrome.runtime.onMessage.addListener((m, s, reply) => {
  if (m.cmd === 'scan') reply(scan());
  if (m.cmd === 'unlock') { unlock(); reply(true); }
  if (m.cmd === 'pip') { const v = [...document.querySelectorAll('video')].sort((a,b)=>b.clientWidth-a.clientWidth)[0];
    if (v) v.requestPictureInPicture().then(()=>reply(true), e=>reply(String(e))); else reply('Видео не найдено'); return true; }
  if (m.cmd === 'print') { setTimeout(() => print(), 100); reply(true); }
  if (m.cmd === 'singleHtml') { reply('<!doctype html>' + document.documentElement.outerHTML.replace('<head>', `<head><base href="${location.href}">`)); }
});
chrome.storage.local.get('settings').then(r => { const s = r.settings || {}; if ((s.unlockSites||[]).includes(location.hostname)) unlock(); });
})();
