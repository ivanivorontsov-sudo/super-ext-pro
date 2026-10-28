const c = document.getElementById('c'), x = c.getContext('2d'), hist = []; let tool = 'arrow', title = 'screenshot', start = null, snap = null, pts = [];
const col = () => document.getElementById('col').value, lw = () => +document.getElementById('w').value;
document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tool = b.dataset.t; document.querySelectorAll('[data-t]').forEach(z => z.classList.toggle('pri', z === b)); });
function push() { hist.push(x.getImageData(0, 0, c.width, c.height)); if (hist.length > 30) hist.shift(); }
chrome.runtime.sendMessage({cmd: 'getShot'}, r => { if (!r) { document.getElementById('msg').textContent = 'Снимок не найден — сделайте его заново.'; return; }
  title = (r.title || 'screenshot').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80); const im = new Image(); im.onload = () => { c.width = im.width; c.height = im.height; x.drawImage(im, 0, 0); }; im.src = r.dataUrl; });
const pos = e => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) * c.width / b.width, (e.clientY - b.top) * c.height / b.height]; };
function arrow(a, b) { const [x1, y1] = a, [x2, y2] = b, an = Math.atan2(y2 - y1, x2 - x1), h = 10 + lw() * 3;
  x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); x.beginPath(); x.moveTo(x2, y2);
  x.lineTo(x2 - h * Math.cos(an - .45), y2 - h * Math.sin(an - .45)); x.lineTo(x2 - h * Math.cos(an + .45), y2 - h * Math.sin(an + .45)); x.closePath(); x.fill(); }
function draw(b) { x.putImageData(snap, 0, 0); x.strokeStyle = x.fillStyle = col(); x.lineWidth = lw(); x.lineCap = 'round'; const [sx, sy] = start, [ex, ey] = b;
  if (tool === 'arrow') arrow(start, b);
  if (tool === 'rect' || tool === 'crop') { if (tool === 'crop') { x.setLineDash([8, 6]); x.strokeStyle = '#6366f1'; } x.strokeRect(sx, sy, ex - sx, ey - sy); x.setLineDash([]); }
  if (tool === 'pen' || tool === 'mark') { if (tool === 'mark') { x.globalAlpha = .35; x.lineWidth = lw() * 5; x.strokeStyle = '#facc15'; } x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.stroke(); x.globalAlpha = 1; }
  if (tool === 'blur') { x.strokeStyle = '#888'; x.strokeRect(sx, sy, ex - sx, ey - sy); } }
c.onmousedown = e => { start = pos(e); pts = [start]; push(); snap = x.getImageData(0, 0, c.width, c.height);
  if (tool === 'text') { const t = prompt('Текст:'); if (t) { x.fillStyle = col(); x.font = `bold ${12 + lw() * 4}px system-ui`; x.fillText(t, ...start); } else hist.pop(); start = null; } };
c.onmousemove = e => { if (!start) return; pts.push(pos(e)); draw(pos(e)); };
c.onmouseup = e => { if (!start) return; const b = pos(e), r = [Math.min(start[0], b[0]), Math.min(start[1], b[1]), Math.abs(b[0] - start[0]), Math.abs(b[1] - start[1])];
  if (tool === 'blur' && r[2] > 2 && r[3] > 2) { x.putImageData(snap, 0, 0); const s = 12, d = x.getImageData(...r);
    for (let yy = 0; yy < r[3]; yy += s) for (let xx = 0; xx < r[2]; xx += s) { const i = (yy * r[2] + xx) * 4; x.fillStyle = `rgb(${d.data[i]},${d.data[i + 1]},${d.data[i + 2]})`; x.fillRect(r[0] + xx, r[1] + yy, s, s); } }
  if (tool === 'crop' && r[2] > 4 && r[3] > 4) { x.putImageData(snap, 0, 0); const d = x.getImageData(...r); c.width = r[2]; c.height = r[3]; x.putImageData(d, 0, 0); hist.length = 0; }
  start = null; };
document.getElementById('undo').onclick = () => { const h = hist.pop(); if (h) { c.width = h.width; c.height = h.height; x.putImageData(h, 0, 0); } };
const save = (type, ext) => c.toBlob(b => { const u = URL.createObjectURL(b); chrome.downloads.download({url: u, filename: `${title}.${ext}`, saveAs: false}); }, type, .92);
document.getElementById('png').onclick = () => save('image/png', 'png');
document.getElementById('jpg').onclick = () => save('image/jpeg', 'jpg');
document.getElementById('copy').onclick = () => c.toBlob(async b => { await navigator.clipboard.write([new ClipboardItem({'image/png': b})]); document.getElementById('msg').textContent = 'Скопировано в буфер обмена'; });
