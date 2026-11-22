const r = await V.view('read-mid');
return { r, bench: typeof V.devRecord, errors: V.stats.frames };
