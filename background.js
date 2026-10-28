importScripts("pro-bg.js");
// Super Ext Pro — фоновый сервис. Никакой телеметрии: сетевые запросы только к сайтам, которые вы открыли, и к returnyoutubedislikeapi.com.
const media = {}; // tabId -> Map(url -> info)
const MEDIA_RE = /\.(m3u8|mpd|mp4|webm|mkv|mov|m4v|mp3|m4a|aac|ogg|opus|wav|flac)(\?|#|$)/i;
const CT_RE = /^(video|audio)\/|mpegurl|dash\+xml/i;

function addMedia(tabId, info) {
  if (tabId < 0) return;
  if (!media[tabId]) media[tabId] = new Map();
  const m = media[tabId];
  if (m.has(info.url)) Object.assign(m.get(info.url), info); else m.set(info.url, info);
  if (m.size > 300) m.delete(m.keys().next().value);
  chrome.action.setBadgeText({tabId, text: String(m.size)}).catch(()=>{});
  chrome.action.setBadgeBackgroundColor({tabId, color: '#6366f1'}).catch(()=>{});
}
function kindOf(url, ct='') {
  if (/m3u8|mpegurl/i.test(url+ct)) return 'hls';
  if (/\.mpd|dash\+xml/i.test(url+ct)) return 'dash';
  if (/^audio\//.test(ct) || /\.(mp3|m4a|aac|ogg|opus|wav|flac)/i.test(url)) return 'audio';
  return 'video';
}
chrome.webRequest.onResponseStarted.addListener(d => {
  if (d.url.startsWith('blob:') || d.url.startsWith('data:')) return;
  const h = Object.fromEntries((d.responseHeaders||[]).map(x => [x.name.toLowerCase(), x.value]));
  const ct = h['content-type'] || '';
  if (!(MEDIA_RE.test(d.url) || CT_RE.test(ct))) return;
  // фрагменты HLS/DASH не показываем — только плейлисты и цельные файлы
  if (/\.(ts|m4s)(\?|$)/i.test(d.url) || /video\/mp2t/i.test(ct)) return;
  if (/googlevideo\.com/.test(d.url)) return; // YouTube: потоки защищены, см. README
  addMedia(d.tabId, {url: d.url, kind: kindOf(d.url, ct), type: ct, size: +h['content-length'] || 0, src: 'сеть'});
}, {urls: ['<all_urls>'], types: ['media','xmlhttprequest','other','object']}, ['responseHeaders']);

chrome.tabs.onRemoved.addListener(id => delete media[id]);
chrome.webNavigation?.onCommitted?.addListener?.(d => { if (d.frameId === 0) delete media[d.tabId]; });
chrome.tabs.onUpdated.addListener((id, ch) => { if (ch.status === 'loading' && ch.url) delete media[id]; });

let lastShot = null; // данные для редактора скриншота

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({id:'shot', title:'Super Ext Pro: скриншот области', contexts:['page']});
  chrome.contextMenus.create({id:'cleanlink', title:'Super Ext Pro: копировать ссылку без трекеров', contexts:['link','page']});
  chrome.contextMenus.create({id:'savetabs', title:'Super Ext Pro: сохранить все вкладки в сессию', contexts:['page']});
  chrome.storage.local.get('settings').then(r => { if (!r.settings) chrome.storage.local.set({settings: {threads: 6, ryd: true, ytControls: true, unlock: false}}); });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'shot') startRegion(tab.id);
  if (info.menuItemId === 'cleanlink') {
    const u = cleanUrl(info.linkUrl || info.pageUrl);
    chrome.scripting.executeScript({target:{tabId:tab.id}, func: t => navigator.clipboard.writeText(t), args:[u]});
  }
  if (info.menuItemId === 'savetabs') saveSession(true);
});

const TRACK = /^(utm_\w+|fbclid|gclid|yclid|dclid|msclkid|mc_[ce]id|igshid|si|ref_src|_openstat|from|spm|ysclid|vero_id|_hs\w+|oly_\w+)$/i;
function cleanUrl(u) {
  try { const x = new URL(u);
    if (/google\.[^/]+\/url$/.test(x.host + x.pathname) && x.searchParams.get('q')) return cleanUrl(x.searchParams.get('q'));
    [...x.searchParams.keys()].forEach(k => TRACK.test(k) && x.searchParams.delete(k));
    return x.toString(); } catch { return u; }
}

async function saveSession(close=false) {
  const tabs = await chrome.tabs.query({currentWindow: true});
  const s = {name: new Date().toLocaleString('ru-RU'), tabs: tabs.filter(t=>/^https?:/.test(t.url)).map(t => ({title: t.title, url: t.url}))};
  const {sessions=[]} = await chrome.storage.local.get('sessions');
  sessions.unshift(s); await chrome.storage.local.set({sessions});
  if (close) { const keep = await chrome.tabs.create({url: chrome.runtime.getURL('panel.html#tabs')});
    chrome.tabs.remove(tabs.filter(t => t.id !== keep.id && /^https?:/.test(t.url)).map(t=>t.id)); }
  return s;
}

async function capture(winId) { return chrome.tabs.captureVisibleTab(winId, {format: 'png'}); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fullPage(tab) {
  const [{result: dim}] = await chrome.scripting.executeScript({target:{tabId: tab.id}, func: () => {
    window.__saOldScroll = [scrollX, scrollY];
    return {h: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight||0), vh: innerHeight, w: innerWidth, dpr: devicePixelRatio}; }});
  const H = Math.min(dim.h, 30000), steps = Math.ceil(H / dim.vh);
  const canvas = new OffscreenCanvas(Math.round(dim.w*dim.dpr), Math.round(H*dim.dpr));
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < steps; i++) {
    const y = Math.min(i*dim.vh, H - dim.vh);
    await chrome.scripting.executeScript({target:{tabId: tab.id}, func: (y, i) => {
      scrollTo(0, y);
      if (i === 1) document.querySelectorAll('*').forEach(e => { const p = getComputedStyle(e).position; if (p==='fixed'||p==='sticky') { e.dataset.saHid = e.style.visibility; e.style.visibility='hidden'; } });
    }, args:[y, i]});
    await sleep(600); // лимит Chrome: не больше 2 снимков в секунду
    const url = await capture(tab.windowId);
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    ctx.drawImage(bmp, 0, Math.round(y*dim.dpr));
  }
  await chrome.scripting.executeScript({target:{tabId: tab.id}, func: () => {
    document.querySelectorAll('[data-sa-hid]').forEach(e => { e.style.visibility = e.dataset.saHid; delete e.dataset.saHid; });
    scrollTo(...window.__saOldScroll); }});
  const blob = await canvas.convertToBlob({type:'image/png'});
  return blobToDataUrl(blob);
}
async function blobToDataUrl(blob) {
  const b = new Uint8Array(await blob.arrayBuffer()); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i+0x8000));
  return `data:${blob.type};base64,` + btoa(s);
}
async function openEditor(dataUrl, title) {
  lastShot = {dataUrl, title};
  await chrome.storage.session.set({lastShotTitle: title}).catch(()=>{});
  chrome.tabs.create({url: chrome.runtime.getURL('annotate.html')});
}
async function startRegion(tabId) {
  await chrome.scripting.executeScript({target:{tabId}, files:['region.js']});
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.cmd?.startsWith('pro.')) return;
  (async () => {
    const tab = msg.tabId ? await chrome.tabs.get(msg.tabId) : sender.tab;
    switch (msg.cmd) {
      case 'getMedia': return reply([...(media[msg.tabId]?.values()||[])]);
      case 'addMedia': (msg.items||[]).forEach(i => addMedia(sender.tab.id, i)); return reply(true);
      case 'shotVisible': await openEditor(await capture(tab.windowId), tab.title); return reply(true);
      case 'shotFull': await openEditor(await fullPage(tab), tab.title); return reply(true);
      case 'shotRegion': await startRegion(tab.id); return reply(true);
      case 'regionDone': {
        const url = await capture(sender.tab.windowId);
        const bmp = await createImageBitmap(await (await fetch(url)).blob());
        const r = msg.rect, k = msg.dpr, c = new OffscreenCanvas(Math.max(1,r.w*k), Math.max(1,r.h*k));
        c.getContext('2d').drawImage(bmp, r.x*k, r.y*k, r.w*k, r.h*k, 0, 0, r.w*k, r.h*k);
        await openEditor(await blobToDataUrl(await c.convertToBlob()), sender.tab.title); return reply(true);
      }
      case 'getShot': return reply(lastShot);
      case 'saveMHTML': {
        let data;
        for (let i = 0; ; i++) { try { data = await (await chrome.pageCapture.saveAsMHTML({tabId: tab.id})).arrayBuffer(); break; } catch (e) { if (i >= 3) throw e; await new Promise(r => setTimeout(r, 400)); } }
        const name = (tab.title||'page').replace(/[\\/:*?"<>|]+/g,'_').slice(0,100) + '.mhtml';
        await chrome.downloads.download({url: await blobToDataUrl(new Blob([data], {type:'multipart/related'})), filename: name, saveAs: false});
        return reply(true);
      }
      case 'dislikes': {
        try { const r = await fetch('https://returnyoutubedislikeapi.com/votes?videoId=' + encodeURIComponent(msg.id));
          return reply(r.ok ? await r.json() : null); } catch { return reply(null); }
      }
      case 'saveSession': return reply(await saveSession(msg.close));
      case 'cleanUrl': return reply(cleanUrl(msg.url));
      case 'frameRules': {
        // Только для страниц самого расширения (мобильный вид): разрешаем показ сайта во фрейме и подставляем мобильный User-Agent.
        const ext = chrome.runtime.id;
        await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[1,2], addRules: msg.ua ? [
          {id:1, priority:1, action:{type:'modifyHeaders', responseHeaders:[{header:'x-frame-options',operation:'remove'},{header:'content-security-policy',operation:'remove'}]},
           condition:{initiatorDomains:[ext], resourceTypes:['sub_frame']}},
          {id:2, priority:1, action:{type:'modifyHeaders', requestHeaders:[{header:'user-agent',operation:'set',value:msg.ua}]},
           condition:{tabIds:[sender.tab.id], resourceTypes:['sub_frame','xmlhttprequest','script','image','stylesheet','media','other']}}] : []});
        return reply(true);
      }
    }
    reply(null);
  })().catch(e => reply({error: String(e)}));
  return true;
});

chrome.sidePanel?.setPanelBehavior?.({openPanelOnActionClick: false}).catch(()=>{});
