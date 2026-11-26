const A = V.attract, it = A.items.filter(it => it.picked).find(it => it.stops.some(s=>V.F.frames[s[0]].lane==='polly2')); if (!it) return 'none';
const k = Math.max(0, it.stops.findIndex(s=>V.F.frames[s[0]].lane==='polly2')); await A.showItem(it, k); await new Promise(r => setTimeout(r, 1500));
return { text: (it.text || it.title).slice(0, 60), k, stop_file: it.stop_files[k], frame: V.F.frames[it.stops[k][0]], caption: document.getElementById('caption').innerText };
