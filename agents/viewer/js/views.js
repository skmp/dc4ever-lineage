const out = {};
for (const v of (V.Q.get('views') || 'far').split(',')) { out[v] = await V.view(v); }
return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { ms: Math.round(v.ms), inst: v.stats.inst, decl: [V.declutter.shown, V.declutter.hidden, V.declutter.moved] }]));
