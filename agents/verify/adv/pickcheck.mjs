// pickcheck.mjs: open the viewer, fly to given lines, pick at the projected point through V.pick, report origin + tooltip text + pixel colour
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os';
const C = os.homedir()+'/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const wsl = Object.values(os.networkInterfaces()).flat().find(a => a && a.family==='IPv4' && !a.internal && !a.address.startsWith('172.17.')).address;
const udd = fs.mkdtempSync('/home/skmp/projects/nulldc-lineage/agents/verify/adv/.c-');
const p = spawn(C, ['--headless=new','--user-data-dir='+udd,'--remote-debugging-port=0','--no-first-run','--window-size=1280,720','--ignore-gpu-blocklist','--enable-gpu','--use-angle=vulkan','about:blank'], {env:{...process.env,GALLIUM_DRIVER:'llvmpipe'},stdio:['ignore','ignore','pipe']});
let e=''; const wsu = await new Promise(r=>p.stderr.on('data',d=>{e+=d;const m=e.match(/DevTools listening on (ws:\S+)/);if(m)r(m[1]);}));
const t=(await (await fetch(`http://127.0.0.1:${new URL(wsu).port}/json/list`)).json()).find(t=>t.type==='page');
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pend=new Map();ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}});
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0,500));return r.result.result.value;};
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:`http://${wsl}:8742/?shots=1`});
for(let i=0;i<300;i++){await new Promise(r=>setTimeout(r,200));try{if(await ev('!!(window.viewer&&window.viewer.load.firstFrame)'))break;}catch{}}
await ev('window.viewer.whenReady({timeout:90000})');
const cases = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for (const [sid,path,line] of cases) {
  const r = await ev(`(async()=>{const V=window.viewer;const s=V.man.snapshots.findIndex(x=>x.id==${JSON.stringify(sid)});
    const j=V.snapJ? V.snapJ[s]:null; let k=-1; const files=(V.snapJ||[])[s]?.files; if(files) k=files.findIndex(f=>f.p==${JSON.stringify(path)});
    if(k<0) return {err:'no file api', keys:Object.keys(V).slice(0,80)};
    V.fixedQuality=true;V.setQualityStep(0);V.setPres('gallery');V.flight=null;
    const v=V.fileView(s,k,${line}); V.cam.p=[v.p[0],v.p[1]-1,v.p[2]]; V.setLook(v.dir);
    await new Promise(r=>setTimeout(r,1500));
    const cx=innerWidth/2, cy=innerHeight/2; const pk=V.pick(cx,cy);
    if(!pk||pk.kind!=='line') return {err:'pick '+(pk&&pk.kind)};
    const txt=(await V.lineText([pk.id]))[0];
    V.mouse={x:cx,y:cy,over:false}; V.showTip(pk,true); const tip=document.getElementById('tip').innerText;
    return {snap:V.man.snapshots[pk.s].id,file:pk.file.p,line:pk.line,origin:V.man.origins[pk.origin],flags:pk.flags,keep:pk.keep,txt,tip:tip.replace(/\\s+/g,' ').slice(0,400)};})()`);
  const shot = await send('Page.captureScreenshot',{format:'png',clip:{x:600,y:330,width:80,height:60,scale:1}});
  fs.writeFileSync(`/home/skmp/projects/nulldc-lineage/agents/verify/adv/pick-${sid}-${line}.png`,Buffer.from(shot.result.data,'base64'));
  console.log(JSON.stringify({want:[sid,path,line],got:r}));
}
p.kill('SIGKILL'); setTimeout(()=>{fs.rmSync(udd,{recursive:true,force:true});process.exit(0)},500);
