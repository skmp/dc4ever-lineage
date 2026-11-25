const it = V.attract.items.find(i => i.picked && (i.note || '').startsWith("Wii U sound bends"));
await V.attract.showItem(it); await new Promise(r => setTimeout(r, 800)); return { lanes: it.lanes, stops: it.stops };
