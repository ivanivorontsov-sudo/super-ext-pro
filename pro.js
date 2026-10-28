// Super Ext Pro — страница Pro-функций. Всё работает локально.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const host = u => { try { return new URL(u).hostname; } catch { return ''; } };
const get = async (k, d) => (await chrome.storage.local.get(k))[k] ?? d, put = (k, v) => chrome.storage.local.set({[k]: v});
const bg = msg => chrome.runtime.sendMessage(msg);
// Целевая вкладка — последняя открытая обычная вкладка (не эта страница).
async function tab() {
  const me = (await chrome.tabs.getCurrent())?.id;
  const ts = (await chrome.tabs.query({})).filter(t => t.id !== me && /^https?:|^file:/.test(t.url || '')).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return ts[0];
}
async function toTab(msg) { const t = await tab(); if (!t) throw new Error('Нет подходящей вкладки');
  try { return await chrome.tabs.sendMessage(t.id, msg); }
  catch { await chrome.scripting.executeScript({target: {tabId: t.id}, files: ['pro-content.js', 'content.js']}); return chrome.tabs.sendMessage(t.id, msg); } }
async function showTarget() { const t = await tab(); $('#target').textContent = t ? (t.title || t.url).slice(0, 60) : '—'; $('#noteHost').textContent = t ? host(t.url) : ''; loadNote(); }
$('#refreshTarget').onclick = showTarget;
function show(t) { $$('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); $$('section').forEach(s => s.classList.toggle('on', s.id === t)); showTarget(); }
$$('nav button').forEach(b => b.onclick = () => show(b.dataset.t));
if (location.hash) show(location.hash.slice(1));

// ---------- Вкладки ----------
async function renderTabs() {
  const q = $('#tabSearch').value.toLowerCase(), me = (await chrome.tabs.getCurrent())?.id;
  const ts = (await chrome.tabs.query({})).filter(t => t.id !== me && (!q || (t.title + t.url).toLowerCase().includes(q)));
  $('#tabList').innerHTML = ts.map(t => `<div class="item" data-id="${t.id}"><img src="${esc(t.favIconUrl || 'icons/i16.png')}" style="width:16px;height:16px"><span class="grow">${esc(t.title)}${t.discarded ? ' <span class="tag">💤</span>' : ''}</span><span class="u">${esc(t.url)}</span><button data-a="go">→</button><button data-a="x">✕</button></div>`).join('') || '<p class="mut">Нет вкладок</p>';
}
$('#tabList').onclick = async e => { const id = +e.target.closest('.item')?.dataset.id, a = e.target.dataset.a; if (!id) return;
  if (a === 'go') { const t = await chrome.tabs.update(id, {active: true}); chrome.windows.update(t.windowId, {focused: true}); }
  if (a === 'x') { await chrome.tabs.remove(id); renderTabs(); } };
$('#tabSearch').oninput = renderTabs;
async function closeDupes() { const seen = new Set(), kill = [];
  for (const t of await chrome.tabs.query({})) { const k = (t.url || '').split('#')[0]; if (seen.has(k)) kill.push(t.id); else seen.add(k); }
  if (kill.length) await chrome.tabs.remove(kill); return kill.length; }
$('#dupes').onclick = async () => { const n = await closeDupes(); $('#suspendMsg').textContent = 'Закрыто дубликатов: ' + n; renderTabs(); };
async function groupByDomain() { const by = {}; const w = (await tab())?.windowId;
  for (const t of await chrome.tabs.query({windowId: w})) if (/^https?:/.test(t.url) && !t.pinned) (by[host(t.url)] ??= []).push(t.id);
  let n = 0; for (const [h, ids] of Object.entries(by)) if (ids.length > 1) { const g = await chrome.tabs.group({tabIds: ids}); await chrome.tabGroups.update(g, {title: h.replace(/^www\./, '')}); n++; }
  return n; }
$('#groupDomain').onclick = async () => { $('#suspendMsg').textContent = 'Создано групп: ' + await groupByDomain(); };
$('#sortDomain').onclick = async () => { const w = (await tab())?.windowId; const ts = (await chrome.tabs.query({windowId: w, pinned: false})).sort((a, b) => host(a.url).localeCompare(host(b.url)));
  for (let i = 0; i < ts.length; i++) await chrome.tabs.move(ts[i].id, {index: -1}); renderTabs(); };
$('#tabsCsv').onclick = async () => { const ts = await chrome.tabs.query({}); SA.save(new Blob([SA.csv([['Заголовок', 'Адрес'], ...ts.map(t => [t.title || '', t.url || ''])])], {type: 'text/csv'}), 'tabs.csv'); };
$('#suspendNow').onclick = async () => { const n = await bg({cmd: 'pro.suspend', minutes: 0, except: (await chrome.tabs.getCurrent())?.id}); $('#suspendMsg').textContent = 'Заморожено вкладок: ' + n; renderTabs(); };
$('#saveSuspend').onclick = async () => { const s = await get('pro', {}); s.suspendMin = +$('#suspendMin').value || 0; s.suspendWhitelist = $('#suspendWl').value.split(/[,\s]+/).filter(Boolean); await put('pro', s); $('#suspendMsg').textContent = 'Сохранено'; };
async function renderRules() { const r = await get('groupRules', []); $('#grList').innerHTML = r.map((x, i) => `<div class="item"><span class="grow">${esc(x.pattern)} → <b>${esc(x.name)}</b> (${x.color})</span><button data-i="${i}">✕</button></div>`).join(''); }
$('#grAdd').onclick = async () => { if (!$('#grPat').value || !$('#grName').value) return; const r = await get('groupRules', []); r.push({pattern: $('#grPat').value.trim(), name: $('#grName').value.trim(), color: $('#grColor').value}); await put('groupRules', r); renderRules(); };
$('#grList').onclick = async e => { if (e.target.dataset.i == null) return; const r = await get('groupRules', []); r.splice(+e.target.dataset.i, 1); await put('groupRules', r); renderRules(); };
$('#grApply').onclick = async () => { const n = await bg({cmd: 'pro.groupNow', windowId: (await tab())?.windowId}); $('#suspendMsg').textContent = 'Сгруппировано вкладок: ' + n; };
async function renderTmp() { const l = await bg({cmd: 'pro.tmpClean'}) || [];
  $('#tmpList').innerHTML = l.map((b, i) => `<div class="item"><a class="grow u" href="${esc(b.url)}" target="_blank">${esc(b.title || b.url)}</a><span class="mut">до ${new Date(b.exp).toLocaleDateString('ru')}</span><button data-i="${i}">✕</button></div>`).join(''); }
$('#tmpAdd').onclick = async () => { const t = await tab(); await bg({cmd: 'pro.tmpAdd', url: t.url, title: t.title, days: +$('#tmpDays').value}); renderTmp(); };
$('#tmpList').onclick = async e => { if (e.target.dataset.i == null) return; const l = await get('tmpbm', []); l.splice(+e.target.dataset.i, 1); await put('tmpbm', l); renderTmp(); };
async function renderAuto() { const l = await get('autoSessions', []);
  $('#autoList').innerHTML = l.map((s, i) => `<div class="item"><span class="grow">${new Date(s.date).toLocaleString('ru')} — ${s.tabs.length} вкл.</span><button data-i="${i}">Открыть</button></div>`).join(''); }
$('#autoList').onclick = async e => { const s = (await get('autoSessions', []))[+e.target.dataset.i]; if (s) chrome.windows.create({url: s.tabs.map(t => t.url)}); };
$('#autosaveNow').onclick = async () => { await bg({cmd: 'pro.autosave'}); renderAuto(); };
$('#autosave').onchange = async () => { const s = await get('pro', {}); s.autosave = $('#autosave').checked; put('pro', s); };

// ---------- Страница ----------
const pmsg = t => { $('#refMsg').textContent = t; };
$('#darkOn').onclick = async () => { const t = await tab(), l = await get('darkSites', []); if (!l.includes(host(t.url))) l.push(host(t.url)); await put('darkSites', l); await toTab({cmd: 'pro.dark', on: true}); };
$('#darkOff').onclick = async () => { const t = await tab(); await put('darkSites', (await get('darkSites', [])).filter(h => h !== host(t.url))); await toTab({cmd: 'pro.dark', on: false}); };
$('#reader').onclick = async () => { await toTab({cmd: 'pro.reader'}); const t = await tab(); chrome.tabs.update(t.id, {active: true}); };
$('#ruler').onclick = async () => { await toTab({cmd: 'pro.ruler'}); const t = await tab(); chrome.tabs.update(t.id, {active: true}); };
const archive = {save: u => 'https://web.archive.org/save/' + u, view: u => 'https://web.archive.org/web/*/' + u};
$('#archiveSave').onclick = async () => chrome.tabs.create({url: archive.save((await tab()).url)});
$('#archiveView').onclick = async () => chrome.tabs.create({url: archive.view((await tab()).url)});
$('#refOn').onclick = async () => { const s = +$('#refSec').value; await toTab({cmd: 'pro.refresh', sec: s}); pmsg('Каждые ' + s + ' с (до закрытия вкладки)'); };
$('#refOff').onclick = async () => { await toTab({cmd: 'pro.refresh', sec: 0}); pmsg('Выключено'); };
$('#spd').oninput = async () => { $('#spdV').textContent = $('#spd').value + '×'; await toTab({cmd: 'pro.speed', v: +$('#spd').value}); };
$('#pip2').onclick = () => toTab({cmd: 'pip'});
async function renderUc() { const l = await get('userCode', []); $('#ucList').innerHTML = l.map(c => `${esc(c.site)}: ${c.css ? 'CSS ' : ''}${c.js ? 'JS' : ''}`).join('<br>'); }
$('#ucSite').onfocus = async () => { if (!$('#ucSite').value) $('#ucSite').value = host((await tab())?.url); };
$('#ucSave').onclick = async () => { const site = $('#ucSite').value.trim() || host((await tab()).url); const l = (await get('userCode', [])).filter(c => c.site !== site);
  l.push({site, css: $('#ucCss').value, js: $('#ucJs').value}); await put('userCode', l); const t = await tab(); if (t) await chrome.tabs.reload(t.id); renderUc(); };
$('#ucDel').onclick = async () => { const site = $('#ucSite').value.trim(); await put('userCode', (await get('userCode', [])).filter(c => c.site !== site)); renderUc(); };
let ckData = null;
$('#ckLoad').onclick = async () => { const t = await tab(); const cookies = await bg({cmd: 'pro.cookies', url: t.url}); const st = await toTab({cmd: 'pro.storage'}).catch(() => ({local: [], session: []}));
  ckData = {url: t.url, cookies, ...st};
  $('#ckList').innerHTML = `<h3>Куки (${cookies.length})</h3>` + cookies.map(c => `<div class="item"><b>${esc(c.name)}</b><span class="u">${esc(c.value)}</span><span class="tag">${c.httpOnly ? 'httpOnly ' : ''}${c.secure ? 'secure' : ''}</span><button data-c="${esc(c.name)}">✕</button></div>`).join('')
   + `<h3>localStorage (${st.local.length})</h3>` + st.local.map(x => `<div class="item"><b>${esc(x.k)}</b><span class="u">${esc(x.v)}</span><button data-l="${esc(x.k)}">✕</button></div>`).join('')
   + `<h3>sessionStorage (${st.session.length})</h3>` + st.session.map(x => `<div class="item"><b>${esc(x.k)}</b><span class="u">${esc(x.v)}</span></div>`).join(''); };
$('#ckList').onclick = async e => { const t = await tab();
  if (e.target.dataset.c) { await bg({cmd: 'pro.delCookie', url: t.url, name: e.target.dataset.c}); $('#ckLoad').click(); }
  if (e.target.dataset.l) { await toTab({cmd: 'pro.delStorage', k: e.target.dataset.l}); $('#ckLoad').click(); } };
$('#ckExport').onclick = () => ckData && SA.save(new Blob([JSON.stringify(ckData, null, 1)], {type: 'application/json'}), 'cookies-' + host(ckData.url) + '.json');

// ---------- Медиа ----------
SA.toMp4 = async tsBlob => {
  const t = new muxjs.mp4.Transmuxer({remux: true}); let init = null; const parts = [];
  t.on('data', s => { if (!init) init = s.initSegment; parts.push(s.data); });
  t.push(new Uint8Array(await tsBlob.arrayBuffer())); t.flush();
  if (!init) throw new Error('Не удалось перепаковать поток (кодек не H.264/AAC?)');
  return new Blob([init, ...parts], {type: 'video/mp4'});
};
$('#hlsGo').onclick = async () => { const u = $('#hlsUrl').value.trim(); if (!u) return; $('#hlsMsg').textContent = 'Загружаю…';
  try { let b = await SA.hls(u, 6, (d, n) => { $('#hlsProg').max = n; $('#hlsProg').value = d; });
    if (b.type !== 'video/mp4') { $('#hlsMsg').textContent = 'Перепаковываю в MP4…'; b = await SA.toMp4(b); }
    const name = (u.split('/').pop().split('?')[0].replace(/\.m3u8$/i, '') || 'video') + '.mp4';
    await SA.save(b, name); $('#hlsMsg').textContent = `Готово: ${name} (${(b.size / 1048576).toFixed(2)} МБ)`;
  } catch (e) { $('#hlsMsg').textContent = 'Ошибка: ' + e.message; } };
$('#qGo').onclick = async () => { const urls = $('#qUrls').value.split(/\s+/).filter(u => /^https?:/.test(u)), par = Math.max(1, +$('#qPar').value || 2);
  $('#qList').innerHTML = urls.map((u, i) => `<div class="item"><span class="u">${esc(u)}</span><span id="q${i}" class="tag">ждёт</span></div>`).join('');
  let next = 0; const worker = async () => { while (next < urls.length) { const i = next++; $('#q' + i).textContent = 'качается';
    try { const id = await chrome.downloads.download({url: urls[i], conflictAction: 'uniquify'});
      await new Promise(res => { const f = d => { if (d.id === id && d.state && d.state.current !== 'in_progress') { chrome.downloads.onChanged.removeListener(f); $('#q' + i).textContent = d.state.current === 'complete' ? '✔ готово' : '✖ ошибка'; res(); } }; chrome.downloads.onChanged.addListener(f); });
    } catch (e) { $('#q' + i).textContent = '✖ ' + e.message; } } };
  await Promise.all(Array.from({length: par}, worker)); };

// ---------- Инструменты ----------
async function shot() { const t = await tab(); await chrome.tabs.update(t.id, {active: true}); await new Promise(r => setTimeout(r, 300)); for (let i = 0; i < 4; i++) { const r = await bg({cmd: 'pro.capture', windowId: t.windowId}); if (typeof r === 'string') return r; await new Promise(r => setTimeout(r, 700)); } throw new Error('Не удалось сделать снимок вкладки'); }
let tessWorker = null, tessLang = '';
async function ocr(img) { const lang = $('#ocrLang').value;
  if (!tessWorker || tessLang !== lang) { await tessWorker?.terminate(); tessLang = lang;
    tessWorker = await Tesseract.createWorker(lang.split('+'), 1, {workerPath: chrome.runtime.getURL('lib/tess/worker.min.js'), corePath: chrome.runtime.getURL('lib/tess/'), langPath: chrome.runtime.getURL('lib/tess/lang'), workerBlobURL: false, gzip: true,
      logger: m => { if (m.progress != null) $('#ocrProg').value = m.progress; }}); }
  const {data} = await tessWorker.recognize(img); $('#ocrOut').value = data.text.trim(); return data.text; }
$('#ocrShot').onclick = async () => { $('#ocrOut').value = 'Распознаю…'; try { await ocr(await shot()); } catch (e) { $('#ocrOut').value = 'Ошибка: ' + e.message; } };
$('#ocrFile').onchange = e => e.target.files[0] && ocr(e.target.files[0]);
$('#ocrCopy').onclick = () => navigator.clipboard.writeText($('#ocrOut').value);
function makeQR(text) { const q = qrcode(0, 'M'); q.addData(unescape(encodeURIComponent(text))); q.make(); $('#qrOut').innerHTML = q.createImgTag(6, 12) + `<br><button id="qrSave">Скачать PNG</button>`;
  $('#qrSave').onclick = () => { const i = $('#qrOut img'), c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i, 0, 0); c.toBlob(b => SA.save(b, 'qr.png')); }; return true; }
$('#qrMake').onclick = async () => makeQR($('#qrText').value || (await tab()).url);
async function readQR(src) { const img = await createImageBitmap(src instanceof Blob ? src : await (await fetch(src)).blob());
  const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const r = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
  $('#qrRead').innerHTML = r ? `Найден QR: <b>${esc(r.data)}</b> <button id="qrCp">Копировать</button>` : 'QR-код не найден'; $('#qrCp')?.addEventListener('click', () => navigator.clipboard.writeText(r.data)); return r?.data || null; }
$('#qrScan').onclick = async () => readQR(await shot());
$('#qrFile').onchange = e => e.target.files[0] && readQR(e.target.files[0]);
const hex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
function showColor(h) { $('#color').innerHTML = `<span class="sw" style="background:${h}"></span> <b>${h}</b>`; navigator.clipboard.writeText(h).catch(() => {}); }
$('#eyedrop').onclick = async () => { if (!window.EyeDropper) return alert('EyeDropper не поддерживается — используйте «по снимку»'); const r = await new EyeDropper().open().catch(() => null); if (r) showColor(r.sRGBHex); };
$('#pickShot').onclick = async () => { const url = await shot(), img = new Image(); img.src = url; await img.decode(); const c = $('#pickCv'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); c.hidden = false; c.style.cursor = 'crosshair'; };
$('#pickCv').onclick = e => { const c = e.target, k = c.width / c.clientWidth, d = c.getContext('2d').getImageData(Math.floor(e.offsetX * k), Math.floor(e.offsetY * k), 1, 1).data; showColor(hex(d[0], d[1], d[2])); };
$('#lang').onchange = async () => { const s = await get('pro', {}); s.lang = $('#lang').value; put('pro', s); };

// ---------- Блокировка ----------
async function ads(on) { const r = await bg({cmd: 'pro.ads', on}); $('#adsOn').checked = r.on; $('#adsMsg').textContent = r.on ? 'активна' : 'выключена'; return r.on; }
$('#adsOn').onchange = () => ads($('#adsOn').checked);
$('#adsStat').onclick = async () => { const t = await tab(); try { const r = await chrome.declarativeNetRequest.getMatchedRules({tabId: t.id}); $('#adsList').textContent = `Сработало правил: ${r.rulesMatchedInfo.length}`; } catch (e) { $('#adsList').textContent = 'Статистика недоступна: ' + e.message; } };

// ---------- Заметки ----------
async function loadNote() { const t = await tab(); if (!t) return; const n = await get('notes', {}); $('#note').value = n[host(t.url)]?.text || ''; renderNotes(); }
$('#noteSave').onclick = async () => { const t = await tab(), n = await get('notes', {}); const h = host(t.url); if ($('#note').value) n[h] = {text: $('#note').value, date: Date.now()}; else delete n[h]; await put('notes', n); $('#noteMsg').textContent = 'Сохранено'; renderNotes(); };
async function renderNotes() { const n = await get('notes', {}); $('#notesAll').innerHTML = Object.entries(n).map(([h, v]) => `<div class="card"><b>${esc(h)}</b> <span class="mut">${new Date(v.date).toLocaleString('ru')}</span><div style="white-space:pre-wrap">${esc(v.text)}</div></div>`).join(''); }
$('#notesExport').onclick = async () => { const n = await get('notes', {}); SA.save(new Blob([Object.entries(n).map(([h, v]) => `## ${h}\n\n${v.text}\n`).join('\n')], {type: 'text/markdown'}), 'notes.md'); };

(async () => { const s = await get('pro', {}); $('#suspendMin').value = s.suspendMin || 0; $('#suspendWl').value = (s.suspendWhitelist || []).join(', '); $('#autosave').checked = s.autosave !== false; if (s.lang) $('#lang').value = s.lang;
  ads(); renderTabs(); renderRules(); renderTmp(); renderAuto(); renderUc(); showTarget(); })();
