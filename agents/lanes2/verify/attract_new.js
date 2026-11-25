const it = V.attract.items.find(i => i.picked && (i.note || '').startsWith('No Sega BIOS'));
const it2 = V.attract.items.find(i => i.picked && (i.note || '').startsWith('Wii U sound bends'));
const out = { found: !!it, found2: !!it2, items: V.attract.items.length, picked: V.attract.items.filter(i => i.picked).length };
V.attract.start('button'); await new Promise(r => setTimeout(r, 1500));
try { V.attract.showItem && V.attract.showItem(it); } catch (e) { out.err = String(e); }
await new Promise(r => setTimeout(r, 9000));
const c = document.getElementById('caption'); out.cap = c.classList.contains('hidden') ? null : c.textContent.slice(0, 200); out.on = V.attractOn;
return out;
