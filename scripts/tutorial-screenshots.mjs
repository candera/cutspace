// Capture tutorial screenshots from headless Chrome over the DevTools protocol.
// usage: node shoot.mjs <appUrl> <outDir> <exampleJsonPath>
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const [url,outDir,examplePath]=process.argv.slice(2);
const chrome=process.env.CHROME??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile=mkdtempSync(join(tmpdir(),'cutspace-shots-'));
const proc=spawn(chrome,['--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--window-size=1265,773','about:blank'],{stdio:['ignore','pipe','pipe']});
const wsUrl=await new Promise((resolve,reject)=>{let buf='';proc.stderr.on('data',d=>{buf+=d;const m=buf.match(/DevTools listening on (ws:\/\/\S+)/);if(m)resolve(m[1]);});proc.on('exit',c=>reject(new Error('chrome exited '+c)));setTimeout(()=>reject(new Error('no devtools url: '+buf)),15000);});
const ws=new WebSocket(wsUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map();const events=[];
ws.onmessage=ev=>{const msg=JSON.parse(ev.data);if(msg.id&&pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(new Error(JSON.stringify(msg.error))):resolve(msg.result);}else events.push(msg);};
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));});
const {targetId}=await send('Target.createTarget',{url:'about:blank'});
const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
const cdp=(method,params)=>send(method,params,sessionId);
await cdp('Page.enable');await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride',{width:1265,height:773,deviceScaleFactor:1,mobile:false});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evaluate=async expr=>{const r=await cdp('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const example=JSON.parse(readFileSync(examplePath,'utf8'));
async function openWith(experiment,prefs={tips:true,welcomed:true}){
 const seed=`localStorage.setItem('cutspace-experiment-v2',${JSON.stringify(JSON.stringify(experiment))});localStorage.setItem('cutspace-prefs-v1',${JSON.stringify(JSON.stringify(prefs))});`;
 const {identifier}=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:seed});
 await cdp('Page.navigate',{url});
 await sleep(1600);
 await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier});
}
async function shot(name){const {data}=await cdp('Page.captureScreenshot',{format:'png'});writeFileSync(join(outDir,name),Buffer.from(data,'base64'));console.log('saved',name);}
const clone=()=>structuredClone(example);
// 1. starting setup
await openWith(clone());await shot('01-start-v2.png');
// 2. deflection fill with MRR contours
{const e=clone();e.view.fill='deflection';e.view.overlay='mrr';await openWith(e);await shot('02-read-plots-v2.png');}
// 3. 12,000 RPM with the Limits inspector open on the exceeded chip check
{const e=clone();e.view.fill='deflection';e.view.overlay='mrr';e.point.rpm=12000;await openWith(e);
 await evaluate(`document.querySelector('button.status').click();`);await sleep(600);await evaluate(`document.activeElement&&document.activeElement.blur();true`);
 await evaluate(`(()=>{const el=document.querySelector('.limit-check.exceeded');if(el)el.scrollIntoView({block:'start'});return !!el;})()`);await sleep(400);
 await shot('03-limit-v2.png');}
// 4. shallower pass with pin A
{const e=clone();e.view.fill='deflection';e.view.overlay='mrr';const a={machineId:e.machineId,materialId:e.materialId,config:structuredClone(e.config),point:structuredClone(e.point)};e.pins=[a];e.point.docRatio=.25;await openWith(e);await shot('04-shallower-v2.png');}
// 5. compare A, B, C
{const e=clone();e.view.fill='deflection';e.view.overlay='mrr';const snap=p=>({machineId:e.machineId,materialId:e.materialId,config:structuredClone(e.config),point:p});
 e.pins=[snap({...e.point}),snap({...e.point,docRatio:.25}),snap({...e.point,docRatio:.25,feed:5080})];e.point={...e.point,docRatio:.25,feed:5080};await openWith(e);
 await evaluate(`[...document.querySelectorAll('.header-actions button')].find(b=>/Compare/.test(b.textContent)).click();`);await sleep(600);await evaluate(`document.activeElement&&document.activeElement.blur();true`);await sleep(200);await shot('05-compare-v2.png');}
ws.close();proc.kill();
