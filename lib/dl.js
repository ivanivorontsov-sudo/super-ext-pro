// Быстрая загрузка: несколько параллельных Range-запросов, сборка в памяти, сохранение через chrome.downloads.
// HLS: параллельная загрузка сегментов (поддержан AES-128; SAMPLE-AES/DRM — нет, намеренно).
const SA = {};
SA.fileName = (url, ext) => { try { let n = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file'); n = n.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
  if (ext && !/\.\w{2,5}$/.test(n)) n += '.' + ext; return n || 'file'; } catch { return 'file' + (ext ? '.' + ext : ''); } };
SA.save = async (blob, name) => { const u = URL.createObjectURL(blob); await chrome.downloads.download({url: u, filename: name, saveAs: false}); setTimeout(() => URL.revokeObjectURL(u), 120000); };
async function pool(n, tasks, onDone) { let i = 0; const res = new Array(tasks.length);
  await Promise.all(Array.from({length: Math.min(n, tasks.length)}, async () => { while (i < tasks.length) { const k = i++; res[k] = await tasks[k](); onDone && onDone(k); } })); return res; }
async function retry(fn, n = 3) { for (let t = 0; ; t++) { try { return await fn(); } catch (e) { if (t >= n) throw e; await new Promise(r => setTimeout(r, 500 * (t + 1))); } } }
SA.fast = async (url, threads, onProg, signal) => {
  let size = 0, ranges = false, type = '';
  try { const h = await fetch(url, {method: 'HEAD', signal, credentials: 'include'}); size = +h.headers.get('content-length') || 0; ranges = /bytes/i.test(h.headers.get('accept-ranges') || ''); type = h.headers.get('content-type') || ''; } catch {}
  if (!ranges || size < 4 * 1024 * 1024) { // мелкий файл или сервер без Range — одним потоком
    const r = await fetch(url, {signal, credentials: 'include'}); if (!r.ok) throw new Error('HTTP ' + r.status);
    const total = +r.headers.get('content-length') || size, rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const {done, value} = await rd.read(); if (done) break; parts.push(value); got += value.length; onProg(got, total); }
    return new Blob(parts, {type: r.headers.get('content-type') || type}); }
  const chunk = Math.max(2 * 1024 * 1024, Math.ceil(size / (threads * 4))), tasks = []; let got = 0;
  for (let s = 0; s < size; s += chunk) { const e = Math.min(size - 1, s + chunk - 1);
    tasks.push(() => retry(async () => { const r = await fetch(url, {headers: {Range: `bytes=${s}-${e}`}, signal, credentials: 'include'});
      if (r.status !== 206) throw new Error('Сервер не отдал диапазон'); const b = await r.arrayBuffer(); got += b.byteLength; onProg(got, size); return b; })); }
  return new Blob(await pool(threads, tasks), {type});
};
function parseM3u8(text, base) { const L = text.split(/\r?\n/), out = {variants: [], segs: [], key: null}; let inf = null, key = null, seq = 0;
  for (let i = 0; i < L.length; i++) { const l = L[i].trim();
    if (l.startsWith('#EXT-X-STREAM-INF')) { const bw = +(/BANDWIDTH=(\d+)/.exec(l)||[])[1] || 0, res = (/RESOLUTION=(\d+x\d+)/.exec(l)||[])[1] || ''; out.variants.push({bw, res, url: new URL(L[++i].trim(), base).href}); }
    else if (l.startsWith('#EXT-X-MEDIA-SEQUENCE')) seq = +l.split(':')[1];
    else if (l.startsWith('#EXT-X-KEY')) { const m = /METHOD=([\w-]+)/.exec(l)[1]; key = m === 'NONE' ? null : {method: m, uri: new URL((/URI="([^"]+)"/.exec(l)||[])[1] || '', base).href, iv: (/IV=0x([0-9a-f]+)/i.exec(l)||[])[1]}; }
    else if (l.startsWith('#EXT-X-MAP')) out.map = new URL(/URI="([^"]+)"/.exec(l)[1], base).href;
    else if (l && !l.startsWith('#')) out.segs.push({url: new URL(l, base).href, key, n: seq + out.segs.length}); }
  return out; }
SA.hlsInfo = async url => { const t = await (await fetch(url, {credentials: 'include'})).text(); return parseM3u8(t, url); };
SA.hls = async (url, threads, onProg, signal) => {
  let p = await SA.hlsInfo(url);
  if (p.variants.length) { p.variants.sort((a, b) => b.bw - a.bw); p = await SA.hlsInfo(p.variants[0].url); }
  if (p.segs.some(s => s.key && s.key.method !== 'AES-128')) throw new Error('Поток защищён DRM (SAMPLE-AES/Widevine) — такое расширение не обходит.');
  const keys = {}; let done = 0;
  const tasks = p.segs.map(s => () => retry(async () => { let b = await (await fetch(s.url, {signal, credentials: 'include'})).arrayBuffer();
    if (s.key) { keys[s.key.uri] ??= fetch(s.key.uri, {credentials: 'include'}).then(r => r.arrayBuffer()).then(k => crypto.subtle.importKey('raw', k, 'AES-CBC', false, ['decrypt']));
      const iv = new Uint8Array(16); if (s.key.iv) { const h = s.key.iv.padStart(32, '0'); for (let i = 0; i < 16; i++) iv[i] = parseInt(h.substr(i * 2, 2), 16); } else new DataView(iv.buffer).setUint32(12, s.n);
      b = await crypto.subtle.decrypt({name: 'AES-CBC', iv}, await keys[s.key.uri], b); }
    onProg(++done, p.segs.length, true); return b; }));
  const parts = await pool(threads, tasks); if (p.map) parts.unshift(await (await fetch(p.map)).arrayBuffer());
  return new Blob(parts, {type: p.map ? 'video/mp4' : 'video/mp2t'});
};
SA.csv = rows => '\ufeff' + rows.map(r => r.map(c => /[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(';')).join('\r\n');
