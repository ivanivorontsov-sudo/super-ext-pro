// Super Ext Pro — фоновые функции Pro. Без телеметрии.
const P = {
  async get(k, d) { return (await chrome.storage.local.get(k))[k] ?? d; },
  set(k, v) { return chrome.storage.local.set({[k]: v}); },
  host(u) { try { return new URL(u).hostname; } catch { return ''; } }
};
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({id: 'pro-translate', title: 'Перевести «%s»', contexts: ['selection']}, () => chrome.runtime.lastError);
  chrome.contextMenus.create({id: 'pro-tmpbm', title: 'Временная закладка (7 дней)', contexts: ['page', 'link']}, () => chrome.runtime.lastError);
  chrome.alarms.create('pro-tick', {periodInMinutes: 1});
});
chrome.contextMenus.onClicked.addListener(async (i, tab) => {
  if (i.menuItemId === 'pro-translate') {
    const tl = (await P.get('pro', {})).lang || 'ru';
    chrome.tabs.create({url: `https://translate.google.com/?sl=auto&tl=${tl}&text=${encodeURIComponent(i.selectionText)}&op=translate`, index: tab.index + 1});
  }
  if (i.menuItemId === 'pro-tmpbm') proBg.tmpAdd(i.linkUrl || tab.url, i.linkUrl ? i.linkUrl : tab.title, 7);
});
const proBg = {
  async tmpAdd(url, title, days) { const l = await P.get('tmpbm', []); l.unshift({url, title, exp: Date.now() + days * 864e5}); await P.set('tmpbm', l); return l; },
  async tmpClean() { const l = await P.get('tmpbm', []); const k = l.filter(b => b.exp > Date.now()); if (k.length !== l.length) await P.set('tmpbm', k); return k; },
  async suspend(minutes, exceptTabId) {
    const now = Date.now(), wl = (await P.get('pro', {})).suspendWhitelist || [];
    let n = 0;
    for (const t of await chrome.tabs.query({})) {
      if (t.active || t.discarded || t.audible || t.pinned || t.id === exceptTabId || !/^https?:/.test(t.url || '')) continue;
      if (wl.some(d => P.host(t.url).endsWith(d))) continue;
      if (minutes && now - (t.lastAccessed || now) < minutes * 6e4) continue;
      try { await chrome.tabs.discard(t.id); n++; } catch {}
    }
    return n;
  },
  async applyGroupRules(tab) {
    const rules = await P.get('groupRules', []); if (!tab?.url || tab.groupId > -1 && !tab._force) return;
    const h = P.host(tab.url), r = rules.find(r => r.pattern && (h === r.pattern || h.endsWith('.' + r.pattern) || tab.url.includes(r.pattern)));
    if (!r) return;
    const gs = await chrome.tabGroups.query({windowId: tab.windowId, title: r.name});
    if (gs[0]) await chrome.tabs.group({tabIds: tab.id, groupId: gs[0].id});
    else { const g = await chrome.tabs.group({tabIds: tab.id, createProperties: {windowId: tab.windowId}}); await chrome.tabGroups.update(g, {title: r.name, color: r.color || 'blue'}); }
    return true;
  },
  async userCode(tabId, url) {
    const all = await P.get('userCode', []), h = P.host(url);
    for (const c of all.filter(c => c.on !== false && (c.site === '*' || h === c.site || h.endsWith('.' + c.site)))) {
      if (c.css) await chrome.scripting.insertCSS({target: {tabId}, css: c.css}).catch(() => {});
      if (c.js) await chrome.scripting.executeScript({target: {tabId}, world: 'MAIN', args: [c.js], func: code => {
        const s = document.createElement('script'); s.textContent = code; (document.head || document.documentElement).append(s); s.remove(); }}).catch(() => {});
    }
  },
  async autosave() {
    const tabs = (await chrome.tabs.query({})).filter(t => /^https?:/.test(t.url));
    if (!tabs.length) return;
    const l = await P.get('autoSessions', []);
    l.unshift({date: Date.now(), tabs: tabs.map(t => ({url: t.url, title: t.title}))});
    await P.set('autoSessions', l.slice(0, 10));
  }
};
chrome.tabs.onUpdated.addListener((id, ch, tab) => {
  if (ch.status === 'complete' && /^https?:/.test(tab.url)) { proBg.userCode(id, tab.url); proBg.applyGroupRules(tab).catch(() => {}); }
});
chrome.alarms.onAlarm.addListener(async a => {
  if (a.name !== 'pro-tick') return;
  const s = await P.get('pro', {});
  proBg.tmpClean();
  if (s.suspendMin > 0) proBg.suspend(s.suspendMin);
  const m = new Date().getMinutes();
  if (s.autosave !== false && m % 30 === 0) proBg.autosave();
});
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg.cmd?.startsWith('pro.')) return;
  (async () => {
    switch (msg.cmd) {
      case 'pro.suspend': return proBg.suspend(msg.minutes || 0, msg.except);
      case 'pro.tmpAdd': return proBg.tmpAdd(msg.url, msg.title, msg.days || 7);
      case 'pro.tmpClean': return proBg.tmpClean();
      case 'pro.groupNow': { let n = 0; for (const t of await chrome.tabs.query({windowId: msg.windowId})) { t._force = true; if (await proBg.applyGroupRules(t)) n++; } return n; }
      case 'pro.autosave': await proBg.autosave(); return P.get('autoSessions', []);
      case 'pro.ads': {
        if (msg.on !== undefined) await chrome.declarativeNetRequest.updateEnabledRulesets(msg.on ? {enableRulesetIds: ['ads']} : {disableRulesetIds: ['ads']});
        return {on: (await chrome.declarativeNetRequest.getEnabledRulesets()).includes('ads')};
      }
      case 'pro.cookies': return chrome.cookies.getAll({url: msg.url});
      case 'pro.delCookie': return chrome.cookies.remove({url: msg.url, name: msg.name});
      case 'pro.capture': return chrome.tabs.captureVisibleTab(msg.windowId, {format: 'png'});
    }
  })().then(reply, e => reply({error: String(e)}));
  return true;
});
