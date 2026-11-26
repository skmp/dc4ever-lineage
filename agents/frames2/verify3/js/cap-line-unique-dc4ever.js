const A = V.attract, it = A.items.filter(it => it.picked).find(it => it.kind==='line'&&it.unique&&it.lanes[0]==='dc4ever'); if (!it) return 'none';
const k = Math.max(0, 0); await A.showItem(it, k); await new Promise(r => setTimeout(r, 1500));
return { text: (it.text || it.title).slice(0, 60), k, stop_file: it.stop_files[k], frame: V.F.frames[it.stops[k][0]], caption: document.getElementById('caption').innerText };
