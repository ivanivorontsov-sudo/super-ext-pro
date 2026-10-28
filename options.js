const g = id => document.getElementById(id);
chrome.storage.local.get('settings').then(({settings: s = {}}) => { g('threads').value = s.threads || 6; g('ytControls').checked = s.ytControls !== false; g('ryd').checked = s.ryd !== false; g('unlockSites').value = (s.unlockSites || []).join('\n'); });
g('save').onclick = async () => { const {settings: s = {}} = await chrome.storage.local.get('settings');
  Object.assign(s, {threads: Math.max(1, Math.min(16, +g('threads').value || 6)), ytControls: g('ytControls').checked, ryd: g('ryd').checked, unlockSites: g('unlockSites').value.split(/\s+/).filter(Boolean)});
  await chrome.storage.local.set({settings: s}); g('ok').textContent = 'Сохранено ✓'; };
