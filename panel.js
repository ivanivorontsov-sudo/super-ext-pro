const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const isPopup = location.pathname.endsWith('popup.html');
let settings = {threads: 6}, found = null, net = [];
const human = n => !n ? '' : n > 1 << 30 ? (n / (1 << 30)).toFixed(2) + ' ГБ' : n > 1 << 20 ? (n / (1 << 20)).toFixed(1) + ' МБ' : (n / 1024).toFixed(0) + ' КБ';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function tab() { const [t] = await chrome.tabs.query({active: true, lastFocusedWindow: true}); return t; }
async function send(cmd, extra = {}) { const t = await tab(); return chrome.runtime.sendMessage({cmd, tabId: t.id, ...extra}); }
async function toTab(msg) { const t = await tab(); try { return await chrome.tabs.sendMessage(t.id, msg); }
  catch { await chrome.scripting.executeScript({target: {tabId: t.id}, files: ['content.js']}); return chrome.tabs.sendMessage(t.id, msg); } }
function show(t) { $$('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); $$('section').forEach(s => s.classList.toggle('on', s.id === t)); if (t === 'tabs') renderSessions(); }
$$('nav button').forEach(b => b.onclick = () => show(b.dataset.t));
if (location.hash) show(location.hash.slice(1));
$('#openPanel').onclick = async () => { const t = await tab(); await chrome.sidePanel.open({windowId: t.windowId}); if (isPopup) close(); };
if (!isPopup) $('#openPanel').hidden = true;
chrome.storage.local.get('settings').then(r => settings = {threads: 6, ...r.settings});

// ---------- Загрузки ----------
async function scan() {
  const t = await tab(); $('#scanInfo').textContent = 'Сканирую…';
  if (!/^https?:/.test(t.url)) { $('#scanInfo').textContent = 'Эта страница недоступна расширениям.'; return; }
  try { found = await toTab({cmd: 'scan'}); } catch (e) { found = {images: [], media: [], docs: [], tables: []}; }
  net = await send('getMedia') || [];
  const yt = /(^|\.)youtube\.com$|youtu\.be$/.test(new URL(t.url).hostname);
  $('#ytNote').hidden = !yt;
  if (yt) { const info = await toTab({cmd: 'ytInfo'}).catch(() => null);
    $('#ytNote').innerHTML = `<b>YouTube</b>: видеопотоки YouTube зашифрованы/обфусцированы и запрещены к скачиванию правилами сервиса, поэтому расширение их не качает. Доступно: превью в максимальном качестве${info?.id ? ` — <a class="btn" target="_blank" href="https://i.ytimg.com/vi/${info.id}/maxresdefault.jpg">открыть</a>` : ''}. Для своих/разрешённых видео используйте консольную программу <b>yt-dlp</b>: <code>yt-dlp ${esc(t.url)}</code> <button id="cpy">Копировать команду</button>`;
    $('#cpy')?.addEventListener('click', () => navigator.clipboard.writeText(`yt-dlp "${t.url}"`)); }
  const c = {media: net.length + found.media.length, images: found.images.length, docs: found.docs.length, tables: found.tables.length};
  $('#scanInfo').textContent = `Медиа: ${c.media} · картинки: ${c.images} · файлы: ${c.docs} · таблицы: ${c.tables}`;
  render();
}
function render() {
  if (!found) return; const f = $('#filter').value, L = $('#list'); let h = '';
  const media = [...net, ...found.media.filter(m => !net.some(n => n.url === m.url))];
  if (f === 'all' || f === 'media') { h += `<div class="card"><h3>🎬 Видео и аудио (${media.length})</h3>` + (media.length ? media.map((m, i) =>
    `<div class="item"><span class="tag">${m.kind.toUpperCase()}</span><span class="u" title="${esc(m.url)}">${esc(m.url)}</span><span class="mut">${human(m.size)}</span>
     ${m.kind === 'dash' ? `<button data-copy="${esc(m.url)}" title="DASH: скопировать адрес для yt-dlp/ffmpeg">Копировать</button>` : `<button data-dl="${i}" data-src="m">⬇</button>`}</div>`).join('') : '<p class="mut">Начните воспроизведение видео и нажмите «Найти» ещё раз — потоки HLS/DASH ловятся по сетевым запросам.</p>') + '</div>'; }
  if (f === 'all' || f === 'images') { h += `<div class="card"><div class="row"><h3 class="grow">🖼 Картинки (${found.images.length})</h3>${found.images.length ? '<button id="allImg">Скачать все</button>' : ''}</div>` +
    found.images.slice(0, 200).map((m, i) => `<div class="item"><img src="${esc(m.url)}" loading="lazy"><span class="u">${esc(m.url)}</span><span class="mut">${m.w ? m.w + '×' + m.h : ''}</span><button data-dl="${i}" data-src="i">⬇</button></div>`).join('') + '</div>'; }
  if (f === 'all' || f === 'docs') { h += `<div class="card"><h3>📄 Документы и файлы (${found.docs.length})</h3>` +
    found.docs.map((m, i) => `<div class="item"><span class="u" title="${esc(m.url)}">${esc(m.name || m.url)}</span><button data-dl="${i}" data-src="d">⬇</button></div>`).join('') + '</div>'; }
  if (f === 'all' || f === 'tables') { h += `<div class="card"><h3>📊 Таблицы (${found.tables.length})</h3>` +
    found.tables.map((t, i) => `<div class="item"><span class="u">${esc(t.caption || 'Таблица ' + (i + 1))} — ${t.rows}×${t.cols}</span><button data-csv="${i}">CSV</button><button data-json="${i}">JSON</button></div>`).join('') + '</div>'; }
  L.innerHTML = h;
  L.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => { const s = b.dataset.src, i = +b.dataset.dl;
    const m = s === 'm' ? media[i] : s === 'i' ? found.images[i] : found.docs[i]; download(m.url, m.kind); });
  L.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => navigator.clipboard.writeText(b.dataset.copy));
  L.querySelectorAll('[data-csv]').forEach(b => b.onclick = () => SA.save(new Blob([SA.csv(found.tables[+b.dataset.csv].data)], {type: 'text/csv'}), `table-${+b.dataset.csv + 1}.csv`));
  L.querySelectorAll('[data-json]').forEach(b => b.onclick = () => { const d = found.tables[+b.dataset.json].data, [hd, ...rows] = d;
    SA.save(new Blob([JSON.stringify(rows.map(r => Object.fromEntries(hd.map((k, j) => [k || 'col' + j, r[j] ?? '']))), null, 2)], {type: 'application/json'}), `table-${+b.dataset.json + 1}.json`); });
  $('#allImg')?.addEventListener('click', () => found.images.forEach((m, i) => setTimeout(() => chrome.downloads.download({url: m.url, filename: 'images/' + SA.fileName(m.url, 'jpg')}), i * 150)));
}
$('#scan').onclick = scan; $('#filter').onchange = render;
async function download(url, kind) {
  const box = document.createElement('div'); box.className = 'card';
  box.innerHTML = `<div class="row"><span class="u grow">${esc(SA.fileName(url))}</span><span class="st mut">старт…</span><button class="x">✕</button></div><progress max="1" value="0"></progress>`;
  $('#jobs').prepend(box); const ac = new AbortController(); box.querySelector('.x').onclick = () => ac.abort();
  const st = box.querySelector('.st'), pr = box.querySelector('progress'), t0 = Date.now();
  const prog = (a, b, seg) => { pr.value = b ? a / b : 0; st.textContent = seg ? `сегмент ${a}/${b}` : `${human(a)}${b ? ' / ' + human(b) : ''} · ${human(a / ((Date.now() - t0) / 1000 + .01))}/с`; };
  if (isPopup) st.textContent = 'не закрывайте окно (для больших файлов — боковая панель)';
  try {
    const n = Math.max(1, Math.min(16, +settings.threads || 6));
    if (kind === 'hls') { const b = await SA.hls(url, n, prog, ac.signal); await SA.save(b, SA.fileName(url).replace(/\.m3u8$/i, '') + (b.type === 'video/mp4' ? '.mp4' : '.ts')); }
    else { const b = await SA.fast(url, n, prog, ac.signal); await SA.save(b, SA.fileName(url, (b.type.split('/')[1] || 'bin').split(';')[0])); }
    st.textContent = 'готово ✓'; box.classList.add('ok');
  } catch (e) { // запасной путь — встроенный загрузчик браузера
    if (kind !== 'hls' && !ac.signal.aborted) { chrome.downloads.download({url}); st.textContent = 'передано загрузчику браузера'; }
    else st.textContent = 'ошибка: ' + e.message; box.classList.add('bad'); }
}

// ---------- Скриншоты / страница ----------
$$('[data-c]').forEach(b => b.onclick = async () => { const r = await send(b.dataset.c); if (r?.error) alert(r.error); if (isPopup && b.dataset.c !== 'saveMHTML') close(); });
$('#pdf').onclick = () => toTab({cmd: 'print'});
$('#singleHtml').onclick = async () => { const t = await tab(), h = await toTab({cmd: 'singleHtml'}); SA.save(new Blob([h], {type: 'text/html'}), (t.title || 'page').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 100) + '.html'); };
$('#readText').onclick = async () => { const t = await tab(); const [{result}] = await chrome.scripting.executeScript({target: {tabId: t.id}, func: () => document.title + '\n' + location.href + '\n\n' + document.body.innerText});
  SA.save(new Blob([result], {type: 'text/plain'}), (t.title || 'page').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 100) + '.txt'); };

// ---------- Инструменты ----------
const msg = t => { $('#toolMsg').textContent = t; setTimeout(() => $('#toolMsg').textContent = '', 3000); };
$('#emu').onclick = async () => { const t = await tab(); chrome.tabs.create({url: 'emulator.html?u=' + encodeURIComponent(t.url)}); };
$('#clean').onclick = async () => { const t = await tab(), u = await send('cleanUrl', {url: t.url}); await navigator.clipboard.writeText(u); msg('Скопировано: ' + u); };
$('#unlock').onclick = async () => { await toTab({cmd: 'unlock'}); msg('Копирование и правый клик разблокированы'); };
$('#unlockAlways').onclick = async () => { const t = await tab(), h = new URL(t.url).hostname, r = await chrome.storage.local.get('settings'), s = r.settings || {};
  s.unlockSites = [...new Set([...(s.unlockSites || []), h])]; await chrome.storage.local.set({settings: s}); await toTab({cmd: 'unlock'}); msg('Всегда разблокировано на ' + h); };
$('#pip').onclick = async () => { const r = await toTab({cmd: 'pip'}); msg(r === true ? 'Готово' : String(r)); };

// ---------- Вкладки ----------
async function renderSessions() { const {sessions = []} = await chrome.storage.local.get('sessions');
  $('#sessions').innerHTML = sessions.length ? sessions.map((s, i) => `<div class="card"><div class="row"><b class="grow">${esc(s.name)} · ${s.tabs.length} вкл.</b><button data-open="${i}">Открыть все</button><button data-del="${i}">Удалить</button></div>` +
    s.tabs.map((t, j) => `<div class="item"><a class="u" href="${esc(t.url)}" target="_blank">${esc(t.title || t.url)}</a><button data-rm="${i}:${j}">✕</button></div>`).join('') + '</div>').join('') : '<p class="mut">Сессий пока нет.</p>';
  $$('[data-open]').forEach(b => b.onclick = () => sessions[+b.dataset.open].tabs.forEach(t => chrome.tabs.create({url: t.url, active: false})));
  $$('[data-del]').forEach(b => b.onclick = async () => { sessions.splice(+b.dataset.del, 1); await chrome.storage.local.set({sessions}); renderSessions(); });
  $$('[data-rm]').forEach(b => b.onclick = async () => { const [i, j] = b.dataset.rm.split(':').map(Number); sessions[i].tabs.splice(j, 1); if (!sessions[i].tabs.length) sessions.splice(i, 1); await chrome.storage.local.set({sessions}); renderSessions(); });
}
$('#saveTabs').onclick = async () => { await send('saveSession', {close: false}); renderSessions(); };
$('#saveClose').onclick = async () => { await send('saveSession', {close: true}); renderSessions(); };
$('#exportJson').onclick = async () => { const {sessions = []} = await chrome.storage.local.get('sessions'); SA.save(new Blob([JSON.stringify(sessions, null, 2)], {type: 'application/json'}), 'superapp-tabs.json'); };
$('#exportCsv').onclick = async () => { const {sessions = []} = await chrome.storage.local.get('sessions'); SA.save(new Blob([SA.csv([['Сессия', 'Заголовок', 'Адрес'], ...sessions.flatMap(s => s.tabs.map(t => [s.name, t.title || '', t.url]))])], {type: 'text/csv'}), 'superapp-tabs.csv'); };
$('#import').onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(d)) throw 0; const {sessions = []} = await chrome.storage.local.get('sessions'); await chrome.storage.local.set({sessions: [...d, ...sessions]}); renderSessions(); } catch { alert('Неверный файл'); } };
if (!isPopup || true) scan();
