const it = V.attract.items.find(i => i.picked && (i.note || '').startsWith("The 2021 restoration swapped"));
await V.attract.showItem(it); await new Promise(r => setTimeout(r, 800));
const c = document.getElementById('caption');
return { lanes: it.lanes, unique: it.unique, stops: it.stops.length, cap: c.classList.contains('hidden') ? null : c.textContent.slice(0, 200) };
