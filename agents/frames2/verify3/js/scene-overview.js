V.presMode = 'clock'; V.setPlaying(false); V.setX(V.xMax, { follow: false }); const ov = V.overview(); V.cam.p = ov.p; V.setLook(ov.dir);
await V.whenReady({ timeout: 60000 }); await new Promise(r => setTimeout(r, 2500)); return V.stats;
