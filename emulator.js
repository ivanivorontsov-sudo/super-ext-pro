const D = [
 {n: 'Pixel 8 · Android 15', w: 412, h: 915, ua: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'},
 {n: 'iPhone 15 · iOS 18', w: 393, h: 852, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'},
 {n: 'Galaxy S24 · Android 14', w: 384, h: 832, ua: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'},
 {n: 'Планшет · Android', w: 800, h: 1280, ua: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'}];
let rot = false; const $ = s => document.querySelector(s);
document.querySelectorAll('nav button').forEach(b => b.onclick = () => { document.querySelectorAll('nav button').forEach(z => z.classList.toggle('on', z === b)); document.querySelectorAll('section').forEach(s => s.classList.toggle('on', s.id === b.dataset.t)); });
$('#url').value = new URLSearchParams(location.search).get('u') || 'https://ya.ru';
async function go() { const sel = [...document.querySelectorAll('.d:checked')].map(c => D[+c.value]); if (!sel.length) return;
  // Один UA на вкладку (ограничение правил заголовков) — берём первый выбранный
  await chrome.runtime.sendMessage({cmd: 'frameRules', ua: sel[0].ua});
  const u = /^https?:/.test($('#url').value) ? $('#url').value : 'https://' + $('#url').value;
  $('#stage').innerHTML = ''; const s = Math.min(1, (innerHeight - 220) / Math.max(...sel.map(d => rot ? d.w : d.h)));
  sel.forEach(d => { const w = rot ? d.h : d.w, h = rot ? d.w : d.h, box = document.createElement('div'); box.className = 'dev';
    const f = document.createElement('iframe'); f.width = w; f.height = h; f.src = u; f.style.cssText = `width:${w*s}px;height:${h*s}px`;
    f.style.transform = ''; f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    if (s < 1) { f.style.cssText = `width:${w}px;height:${h}px;transform:scale(${s});transform-origin:0 0`; const wr = document.createElement('div'); wr.style.cssText = `width:${w*s}px;height:${h*s}px;overflow:hidden;border-radius:20px`; wr.append(f); box.append(wr); } else box.append(f);
    const p = document.createElement('p'); p.textContent = `${d.n} — ${w}×${h}`; box.append(p); $('#stage').append(box); }); }
$('#go').onclick = go; $('#rot').onclick = () => { rot = !rot; go(); };
addEventListener('beforeunload', () => chrome.runtime.sendMessage({cmd: 'frameRules', ua: null}));
go();
