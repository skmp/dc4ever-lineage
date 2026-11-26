// three consecutive dc4ever frames, each one whole: SEQ env picks the lane-local index
const ln = V.LN.find(l => l.name === 'dc4ever'), k = +(new URLSearchParams(location.search).get('k') || 20);
return await V.showFrame(ln.frames[k]);
