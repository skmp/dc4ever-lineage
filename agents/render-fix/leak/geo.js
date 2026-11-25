const out = {};
out.lanes = V.LN.map(l => ({ name: l.name, li: l.li, z0: l.z0, width: l.L.width, n: l.frames.length, x0: l.xs[0], x1: l.xs.at(-1), cols: l.cols }));
out.U = V.U; out.X = V.X; out.cam = V.cam.p; out.FOV = V.FOV;
return out;
