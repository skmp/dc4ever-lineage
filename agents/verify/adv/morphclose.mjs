// pickcheck.mjs: open the viewer, fly to given lines, pick at the projected point through V.pick, report origin + tooltip text + pixel colour
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os';
const C = os.homedir()+'/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const wsl = Object.values(os.networkInterfaces()).flat().find(a => a && a.family==='IPv4' && !a.internal && !a.address.startsWith('172.17.')).address;
const udd = fs.mkdtempSync('/home/skmp/projects/nulldc-lineage/agents/verify/adv/.c-');
const p = spawn(C, ['--headless=new','--user-data-dir='+udd,'--remote-debugging-port=0','--no-first-run','--window-size=1280,720','--ignore-gpu-blocklist','--enable-gpu','--use-angle=vulkan','--disable-gpu-vsync','--disable-frame-rate-limit','about:blank'], {env:{...process.env,GALLIUM_DRIVER:'llvmpipe'},stdio:['ignore','ignore','pipe']});
let e=''; const wsu = await new Promise(r=>p.stderr.on('data',d=>{e+=d;const m=e.match(/DevTools listening on (ws:\S+)/);if(m)r(m[1]);}));
const t=(await (await fetch(`http://127.0.0.1:${new URL(wsu).port}/json/list`)).json()).find(t=>t.type==='page');
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pend=new Map();ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}});
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0,500));return r.result.result.value;};
await send('Emulation.setDeviceMetricsOverride',{width:2560,height:1440,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:`http://${wsl}:8742/?shots=1`});
for(let i=0;i<300;i++){await new Promise(r=>setTimeout(r,200));try{if(await ev('!!(window.viewer&&window.viewer.load.firstFrame)'))break;}catch{}}
await ev('window.viewer.whenReady({timeout:90000})');
for (const [name,dist] of [['close',900],['near',2600]]) {
const r = await ev(`(async()=>{const V=window.viewer; await V.view('morph'); const m0=!!V.morph;
 V.fixedQuality=false; const b=V.man.snapshots.findIndex(s=>s.id==='reicast-r7-rc1'); const w=V.W[b], x=V.eventX(V.t);
 V.cam.p=[x-${dist},2900,w.z0+3400]; V.setLook([1,-0.1,0.5]); V.follow=true;
 await new Promise(r=>setTimeout(r,1000)); V.playSpeed=0.3; V.playing=true; const dts=[];const steps=new Set();let mf=0,lines=[];
 const t0=performance.now(); await new Promise(res=>{const f=()=>{dts.push(V.lastRawDt);steps.add(V.quality.step);if(V.morph)mf++;if(performance.now()-t0<10000)requestAnimationFrame(f);else res();};requestAnimationFrame(f);});
 V.playing=false; dts.sort((a,b)=>a-b); const q=p=>dts[Math.min(dts.length-1,Math.floor(p*dts.length))];
 return {m0,n:dts.length,p50:q(.5),p95:q(.95),p99:q(.99),max:dts.at(-1),steps:[...steps],morphFrames:mf};})()`);
console.log(name, JSON.stringify(r));
}
p.kill('SIGKILL'); setTimeout(()=>{fs.rmSync(udd,{recursive:true,force:true});process.exit(0)},500);
