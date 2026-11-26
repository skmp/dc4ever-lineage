// a tour caption: the item / stop picked by ?item=<text prefix>&stop=<k>
const q = new URLSearchParams(location.search), it = V.attract.items.find(i => (i.text || i.title || '').startsWith(q.get('item') || '{//ToDo')) || V.attract.items[0];
await V.attract.showItem(it, +(q.get('stop') || 0)); document.body.classList.add('attract'); await new Promise(r => setTimeout(r, 800));
return { cap: document.getElementById('caption').innerText, stop: it.stops[+(q.get('stop') || 0)], file: it.stop_files[+(q.get('stop') || 0)] };
