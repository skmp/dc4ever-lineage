const A = V.attract, it = A.items.filter(it => it.picked).find(it => it.kind==='segment'&&it.stop_files.some(f=>f.label.startsWith('2008-2010'))); if (!it) return 'none';
const k = Math.max(0, it.stop_files.findIndex(f=>f.label.startsWith('2008-2010'))); await A.showItem(it, k); await new Promise(r => setTimeout(r, 1500));
return { text: (it.text || it.title).slice(0, 60), k, stop_file: it.stop_files[k], frame: V.F.frames[it.stops[k][0]], caption: document.getElementById('caption').innerText };
