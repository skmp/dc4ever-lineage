const A = V.attract, it = A.items.filter(it => it.picked).find(it => it.kind==='line'&&it.stops.some((s,k)=>V.F.frames[s[0]].lane==='flycast'&&it.stop_files[k].date<'2018-08')); if (!it) return 'none';
const k = Math.max(0, it.stops.findIndex((s,k)=>V.F.frames[s[0]].lane==='flycast'&&it.stop_files[k].date<'2018-08')); await A.showItem(it, k); await new Promise(r => setTimeout(r, 1500));
return { text: (it.text || it.title).slice(0, 60), k, stop_file: it.stop_files[k], frame: V.F.frames[it.stops[k][0]], caption: document.getElementById('caption').innerText };
