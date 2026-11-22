await V.view('read');
const X = V.X, c = V.cam.p.map(Math.round);
const st = {...V.stats}; delete st.dt; delete st.cpu; delete st.gpu;
return { X, c, live: V.live.map(l => [l.lane, l.f, Math.round(l.x)]).slice(0, 20), st };
