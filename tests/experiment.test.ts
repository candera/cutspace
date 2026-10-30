import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,fitView,setupFor,parseExperiment,snapshot,MACHINES,MATERIALS} from '../src/experiment.ts';
import {calculate} from '../src/model.ts';
import {toDisplay,fromDisplay,parseNumeric} from '../src/units.ts';
const close=(a:number,b:number,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('diameter changes preserve percentage DOC/WOC including imperial entries',()=>{
 const e=fresh();e.config.tool.diameter=8;const s=setupFor(e);close(s.cut.woc,1.6);close(s.cut.doc,4);
 e.config.tool.diameter=6.35;e.point.wocRatio=fromDisplay(.05,'length','imperial')/6.35;e.point.docRatio=fromDisplay(.125,'length','imperial')/6.35;
 e.config.tool.diameter=12.7;close(toDisplay(setupFor(e).cut.woc,'length','imperial'),.1);close(toDisplay(setupFor(e).cut.doc,'length','imperial'),.25);
});
test('metric/imperial conversions round-trip, including cubic units and mechanical power',()=>{
 const vals={length:6.35,feed:1200,surface:188.495559,chip:.04,mrr:4.32,power:90,torque:.08594,deflection:19.37,percent:50,none:10000};
 for(const [q,v]of Object.entries(vals)){const quantity=q as keyof typeof vals;close(fromDisplay(toDisplay(v,quantity,'imperial'),quantity,'imperial'),v);}
 close(toDisplay(25.4,'length','imperial'),1);close(toDisplay(16.387064,'mrr','imperial'),1);close(toDisplay(745.6998715822702,'power','imperial'),1);
});
test('changing units never changes stored inputs or selected-point calculations',()=>{
 const e=fresh(),before=calculate(setupFor(e).cut,setupFor(e));
 for(let i=0;i<100;i++)e.units=i%2?'metric':'imperial';
 const after=calculate(setupFor(e).cut,setupFor(e));assert.deepEqual(before,after);
});
test('file round-trip preserves inputs, snapshots and view; restores recalculated results',()=>{
 const e=fresh();e.pins.push(snapshot(e));e.config.tool.diameter=8;e.units='imperial';e.view.fixed=true;
 const restored=parseExperiment(JSON.stringify(e));assert.deepEqual(restored,e);
 close(setupFor(restored.pins[0]).cut.woc,1.2);close(setupFor(restored).cut.woc,1.6);
});
test('untrusted files cannot introduce machines, invalid physics, unknown versions or bad view bounds',()=>{
 const variants=[(e:any)=>{e.machineId='new-router';e.config.machine.name='';},(e:any)=>e.machineId=42,(e:any)=>e.modelVersion='future',(e:any)=>e.schemaVersion=1,(e:any)=>e.config.tool.diameter=0,(e:any)=>e.point.rpm=null,(e:any)=>e.config.tool.flutes=2.5,(e:any)=>e.view.scaleMax=e.view.scaleMin,(e:any)=>e.config.machine.rpmMin=e.config.machine.rpmMax];
 for(const mutate of variants){const e=fresh();mutate(e);assert.throws(()=>parseExperiment(JSON.stringify(e)));}
});
test('six material starters and six machine presets have explicit illustrative data',()=>{
 assert.equal(Object.keys(MACHINES).length,6);assert.equal(Object.keys(MATERIALS).length,6);
 assert.notEqual(MACHINES.dmc2.power,MACHINES.rc4.power);
 assert.equal(new Set(Object.values(MATERIALS).map(m=>m.kc)).size,6);
 for(const material of Object.values(MATERIALS)){const e=fresh();e.config.material.kc=material.kc;const s=setupFor(e);assert.ok(Number.isFinite(calculate(s.cut,s).power));}
});
test('unknown capacity and unavailable force models never produce a complete passing envelope',()=>{
 const e=fresh();e.config.machine.known=false;let s=setupFor(e),r=calculate(s.cut,s);assert.equal(r.status,'unknown');assert.equal(r.feasible,false);assert.ok(Number.isNaN(r.capacity));
 e.config.material.known=false;s=setupFor(e);r=calculate(s.cut,s);assert.equal(r.feasible,false);assert.ok(Number.isNaN(r.power));close(r.mrr,4.32);
});
test('out-of-domain and no-cut samples are explicit states',()=>{
 const e=fresh(),s=setupFor(e);assert.equal(calculate({...s.cut,woc:7},s).status,'invalid');assert.equal(calculate({...s.cut,rpm:0},s).status,'invalid');assert.equal(calculate({...s.cut,doc:0},s).status,'no-cut');
});
test('fraction parser accepts numeric fractions only',()=>{
 close(parseNumeric('1/4')!, .25);close(parseNumeric('0.125')!, .125);assert.equal(parseNumeric('1/0'),null);assert.equal(parseNumeric('Infinity'),null);assert.equal(parseNumeric('1+2'),null);assert.equal(parseNumeric(''),null);
});

test('fit view includes low-RPM selections and respects supported domain bounds',()=>{
 const e=fresh();e.point.rpm=1;e.view=fitView(e);assert.equal(e.view.rpmMin,1);assert.doesNotThrow(()=>parseExperiment(JSON.stringify(e)));
 e.config.machine.rpmMax=200000;e.config.machine.feedMax=200000;e.config.tool.diameter=.1;e.config.tool.fluteLength=500;e.point.wocRatio=2;e.point.docRatio=100;e.view=fitView(e);
 assert.equal(e.view.rpmMax,200000);assert.equal(e.view.feedMax,200000);assert.equal(e.view.wocMax,200);assert.equal(e.view.docMax,10000);assert.doesNotThrow(()=>parseExperiment(JSON.stringify(e)));
});
