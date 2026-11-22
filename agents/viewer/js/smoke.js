await V.view('far'); await new Promise(r => setTimeout(r, 1500));
return { renderer: V.RENDERER, walls: V.load.walls, blame: V.load.blame, decl: { shown: V.declutter.shown, hidden: V.declutter.hidden, moved: V.declutter.moved }, stats: { draws: V.stats.draws, inst: V.stats.inst, skipped: V.stats.skipped }, mode: V.mode };
