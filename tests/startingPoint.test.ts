import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startingPoint,STARTING_ENGAGEMENT,TARGET_FRACTION,FEED_FRACTION} from '../src/startingPoint.ts';
import {fresh,MACHINES,MATERIALS,setWorkpieceMaterial,setCutterMaterial,setOperation,applyCuttingPreset,setupFor,parseExperiment} from '../src/experiment.ts';
import type {Configuration,Experiment,MachineId,MaterialId} from '../src/experiment.ts';
import {builtinLibrary,parseLibrary,machineFromItem} from '../src/library.ts';
import {calculate} from '../src/model.ts';
import type {Operation} from '../src/model.ts';

const NOVA=parseLibrary(readFileSync(new URL('../public/libraries/nova-labs.json',import.meta.url),'utf8'));
const TOOLS=builtinLibrary().tools;
function configure(machine:MachineId,material:MaterialId,toolId:string,operation:Operation):Configuration{
 const e=fresh();e.machineId=machine;e.config.machine={...MACHINES[machine]};
 const tool=TOOLS.find(t=>t.id===toolId)!.tool;e.config.tool={...tool};
 setWorkpieceMaterial(e,material);setCutterMaterial(e,tool.material);setOperation(e,operation);applyCuttingPreset(e);
 const {point:_p,...rest}=e;void _p;return structuredClone(rest.config);
}
function check(config:Configuration,outcome:ReturnType<typeof startingPoint>){
 assert.ok(outcome.ok,`expected a starting point: ${!outcome.ok?outcome.reasons.join(' '):''}`);
 if(!outcome.ok)return;
 const r=calculate(outcome.cut,{...config,cut:outcome.cut});
 assert.equal(r.status,'inside');assert.ok(r.zone==='comfortable'||r.zone==='caution');
 assert.deepEqual(outcome.result.constraints,r.constraints);
 assert.ok(outcome.cut.rpm>=config.machine.rpmMin&&outcome.cut.rpm<=config.machine.rpmMax);
 if(config.tool.maxRpm)assert.ok(outcome.cut.rpm<=config.tool.maxRpm);
 assert.ok(outcome.cut.feed<=config.machine.feedMax);
 assert.ok(outcome.cut.doc<=Math.min(config.tool.fluteLength,config.tool.stickout));
 assert.ok(outcome.cut.woc<=config.tool.diameter&&outcome.cut.woc>0&&outcome.cut.doc>0);
 assert.ok(Math.abs(outcome.point.docRatio*config.tool.diameter-outcome.cut.doc)<1e-9);
 assert.ok(Math.abs(outcome.point.wocRatio*config.tool.diameter-outcome.cut.woc)<1e-9);
}

test('the default experiment gets a comfortable, snapped, deterministic starting point inside every limit',()=>{
 const config=structuredClone(fresh().config),a=startingPoint(config),b=startingPoint(config);
 check(config,a);assert.deepEqual(a,b);
 if(!a.ok)return;
 const target=(config.limits.caution??.75)*TARGET_FRACTION;
 assert.equal(a.result.zone,'comfortable');assert.ok(a.result.softRatio<=target);
 assert.equal(a.cut.rpm%100,0);assert.ok(Math.abs(a.cut.feed/10-Math.round(a.cut.feed/10))<1e-9);
 assert.ok(Math.abs(a.point.docRatio/.05-Math.round(a.point.docRatio/.05))<1e-9);
 assert.ok(a.cut.feed<=FEED_FRACTION*config.machine.feedMax+5);
 assert.ok(a.steps.length>=4);assert.match(a.steps[0],/Spindle speed/);assert.match(a.steps[1],/Chipload target/);
 const surfaceRpm=target*config.limits.surfaceMax*1000/(Math.PI*config.tool.diameter);
 assert.ok(a.cut.rpm<=Math.min(config.machine.rpmMax,surfaceRpm)+1e-9);
});

test('every built-in machine, workpiece, starter tool and operation either yields a point inside the limits or an explained failure',()=>{
 let ok=0,failed=0;
 for(const machine of Object.keys(MACHINES) as MachineId[])for(const material of Object.keys(MATERIALS) as MaterialId[])for(const tool of TOOLS)for(const operation of ['roughing','finishing'] as Operation[]){
  const config=configure(machine,material,tool.id,operation),outcome=startingPoint(config);
  if(outcome.ok){check(config,outcome);ok++;}
  else{failed++;assert.ok(outcome.reasons.length>0&&outcome.reasons.every(r=>r.length>20));}
  // The derived experiment must be a valid Cutspace experiment.
  if(outcome.ok){const e:Experiment={...fresh(),config,point:outcome.point};assert.doesNotThrow(()=>parseExperiment(JSON.stringify(e)));}
 }
 assert.ok(ok>failed*2,`most combinations should succeed (ok ${ok}, failed ${failed})`);
});

test('finishing starts no deeper or wider than roughing for the same setup',()=>{
 for(const material of ['plywood','aluminum','hardwood'] as MaterialId[]){
  const rough=startingPoint(configure('spindle-router-example',material,'quarter-2f-carbide','roughing')),fine=startingPoint(configure('spindle-router-example',material,'quarter-2f-carbide','finishing'));
  assert.ok(rough.ok&&fine.ok);if(!rough.ok||!fine.ok)return;
  assert.ok(fine.point.docRatio<=rough.point.docRatio+1e-9);assert.ok(fine.point.wocRatio<=rough.point.wocRatio+1e-9);
  assert.ok(fine.point.wocRatio<=STARTING_ENGAGEMENT.finishing.woc+1e-9);
 }
});

test('missing cutting data, an unavailable capacity curve or an unavailable force model are refused with a reason',()=>{
 const base=configure('spindle-router-example','plywood','quarter-2f-carbide','roughing');
 const noChip=structuredClone(base);noChip.limits.cuttingDataKnown=false;
 const a=startingPoint(noChip);assert.ok(!a.ok);if(!a.ok)assert.match(a.reasons[0],/chip-thickness or surface-speed limits/);
 const noCurve=structuredClone(base);noCurve.machine.known=false;
 const b=startingPoint(noCurve);assert.ok(!b.ok);if(!b.ok)assert.match(b.reasons[0],/capacity curve/);
 const noForce=structuredClone(base);noForce.material.known=false;
 const c=startingPoint(noForce);assert.ok(!c.ok);if(!c.ok)assert.match(c.reasons[0],/force\/power model/);
});

test('HSS in mild steel on a fast hobby router fails on surface speed against the minimum RPM',()=>{
 const config=configure('hobby-router-example','steel','quarter-2f-hss','roughing'),outcome=startingPoint(config);
 assert.ok(!outcome.ok);if(outcome.ok)return;
 assert.match(outcome.reasons[0],/surface-speed limit/);assert.match(outcome.reasons[0],/minimum is 10,000 RPM/);
});

test('a tool rating below the machine maximum caps the spindle speed',()=>{
 const config=configure('spindle-router-example','plywood','quarter-2f-carbide','roughing');config.tool.maxRpm=16000;
 const outcome=startingPoint(config);check(config,outcome);
 if(outcome.ok){assert.ok(outcome.cut.rpm<=16000);assert.match(outcome.steps[0],/16,000 RPM rating/);}
});

test('a long slender tool backs off depth because of deflection and records each step, or fails with the nearest point',()=>{
 const config=configure('spindle-router-example','aluminum','eighth-2f-carbide','finishing');config.tool.stickout=80;config.tool.fluteLength=12;
 const outcome=startingPoint(config);
 if(outcome.ok){check(config,outcome);assert.ok(outcome.steps.some(s=>/Tool deflection/.test(s)));}
 else{assert.ok(outcome.nearest);assert.match(outcome.reasons[0],/deflection|limits/i);}
 assert.ok(outcome.steps.length>0);
});

test('Big Blue with the quarter-inch two-flute in plywood gets a starting point, and imperial units snap the feed to whole inches per minute',()=>{
 const e=fresh();e.config.machine=machineFromItem(NOVA.machines.find(m=>m.id==='big-blue')!);e.config.tool={...TOOLS.find(t=>t.id==='quarter-2f-carbide')!.tool};
 setWorkpieceMaterial(e,'plywood');setOperation(e,'roughing');applyCuttingPreset(e);
 const config=structuredClone(e.config),metric=startingPoint(config,'metric'),imperial=startingPoint(config,'imperial');
 check(config,metric);check(config,imperial);
 if(imperial.ok){const ipm=imperial.cut.feed/25.4;assert.ok(Math.abs(ipm-Math.round(ipm))<1e-9);assert.match(imperial.steps.join(' '),/in\/min/);}
 if(metric.ok)assert.match(metric.steps.join(' '),/mm\/min/);
 // The explorer's own evaluation of the chosen point agrees with the solver's.
 if(metric.ok){const s=setupFor({...e,point:metric.point});assert.equal(calculate(s.cut,s).status,'inside');}
});
