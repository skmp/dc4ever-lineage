V.attract.start('test');
const seen = [];
for (let i = 0; i < 16; i++) { await new Promise(r => setTimeout(r, 2500)); const c = document.getElementById('caption'); seen.push([Math.round(V.X), V.dateOfX(V.X), c.classList.contains('hidden') ? '' : c.innerText.slice(0, 80), V.cam.p.map(Math.round).join(',')]); }
const on = V.attractOn; V.emit('input', {}); 
return { on, after: V.attractOn, seen };
