import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fresh,applyCuttingPreset,editLimit,setCutterMaterial,setWorkpieceMaterial,setupFor,parseExperiment,snapshot,MACHINES,MATERIALS} from '../src/experiment.ts';
import {CUTTING_PRESETS,cuttingPreset} from '../src/cuttingPresets.ts';
import {calculate,CUTTER_MATERIALS} from '../src/model.ts';
import type {MaterialId} from '../src/experiment.ts';
import type {CutterMaterial} from '../src/model.ts';

test('every cutter/workpiece pair has valid, active, isolated provisional limits',()=>{
 for(const material of Object.keys(MATERIALS) as MaterialId[])for(const cutter of Object.keys(CUTTER_MATERIALS) as CutterMaterial[]){
  const e=fresh();setWorkpieceMaterial(e,material);setCutterMaterial(e,cutter);applyCuttingPreset(e);
  assert.deepEqual(e.config.limits,cuttingPreset(material,cutter));assert.equal(e.config.limits.cuttingDataKnown,true);
  assert.doesNotThrow(()=>parseExperiment(JSON.stringify(e)));
  e.config.limits.chipMax=2;assert.notEqual(CUTTING_PRESETS[material][cutter].chipMax,2);
 }
});

test('applying a starter preserves cut, tool, machine and force data; saved overrides are never auto-replaced',()=>{
 const e=fresh();setWorkpieceMaterial(e,'plywood');editLimit(e,'chipMax',.123);editLimit(e,'cuttingDataKnown',false);e.pins.push(snapshot(e));
 const before=structuredClone(e);const read=parseExperiment(JSON.stringify(e));assert.deepEqual(read,e);assert.equal(read.config.limits.preset,undefined);
 applyCuttingPreset(e);assert.deepEqual(e.point,before.point);assert.deepEqual(e.config.tool,before.config.tool);assert.deepEqual(e.config.machine,before.config.machine);assert.deepEqual(e.config.material,before.config.material);assert.deepEqual(e.pins,before.pins);
 assert.equal(e.config.limits.preset,'provisional-1');assert.equal(e.config.limits.cuttingDataKnown,true);
 editLimit(e,'deflection',60);assert.equal(e.config.limits.preset,undefined);assert.equal(e.config.limits.deflection,60);
});

test('reported Big Blue plywood cut exposes inherited chip and deflection thresholds, not a power arithmetic fault',()=>{
 // User-reported working cut: carbide 1/4 in, 2 flutes, 18k RPM, 300 IPM,
 // DOC 50%D, WOC 100%D, approximately 30 mm stickout. RC4 is a profile proxy,
 // NOT measured Big Blue capacity. 15 mm flute length remains an assumed value.
 const e=fresh();e.machineId='bigblue';e.config.machine={...MACHINES.bigblue};setWorkpieceMaterial(e,'plywood');
 Object.assign(e.config.tool,{diameter:6.35,flutes:2,stickout:30});e.point={rpm:18000,feed:7620,docRatio:.5,wocRatio:1};
 const s=setupFor(e),r=calculate(s.cut,s);
 assert.ok(Math.abs(r.chip/25.4-300/(18000*2))<1e-12);
 assert.ok(Math.abs(r.power-320.05984375)<1e-8);assert.ok(Math.abs(r.deflection-36.48828890747707)<1e-8);
 assert.equal(r.status,'inside');
 const inherited=calculate(s.cut,{...s,limits:cuttingPreset('aluminum','carbide',{operation:'finishing'})});
 assert.deepEqual(inherited.constraints.filter(c=>c.ratio>1).map(c=>c.key),['chipHigh','deflection']);
 assert.equal(inherited.power,r.power);assert.equal(inherited.force,r.force);assert.equal(inherited.deflection,r.deflection);
 // The provisional allowances do not erase machine-capacity failures or larger loads.
 const weak=calculate(s.cut,{...s,machine:{...s.machine,power:100}});assert.equal(weak.feasible,false);
 assert.ok(calculate({...s.cut,doc:s.cut.doc*4},s).deflection>e.config.limits.deflection);
});

test('older files without preset metadata retain exact inputs; unsupported preset versions are rejected',()=>{
 const e=fresh();delete e.config.limits.preset;e.config.limits.cuttingDataKnown=false;e.config.limits.chipMax=.11;
 assert.deepEqual(parseExperiment(JSON.stringify(e)),e);
 const bad:any=structuredClone(e);bad.config.limits.preset='future';assert.throws(()=>parseExperiment(JSON.stringify(bad)),/preset/);
});


test('Big Blue shares RC4 initial numbers but is a separate, restorable machine',()=>{
 const {name:rcName,...rc}=MACHINES.rc4,{name:blueName,...blue}=MACHINES.bigblue;
 assert.deepEqual(blue,rc);assert.notEqual(blueName,rcName);
 const e=fresh();e.machineId='bigblue';e.config.machine={...MACHINES.bigblue};e.pins.push(snapshot(e));
 e.config.machine.power=2000;
 const restored=parseExperiment(JSON.stringify(e));assert.equal(restored.config.machine.name,'Big Blue');assert.equal(restored.pins[0].config.machine.power,MACHINES.rc4.power);
 assert.equal(MACHINES.rc4.power,1500);
});


test('both reported plywood example files reproduce their geometry and current estimated demand',()=>{
 for(const [file,flutes,rpm,feed,doc,stickout,deflection,power] of [
  ['big-blue-plywood-300-ipm',2,18000,7620,3.175,30,36.48828890747707,320.05984375],
  ['big-blue-plywood-shared-200-ipm',4,10000,5080,9.525,25.4,39.862395038487775,640.1196875],
 ] as const){
  const e=parseExperiment(readFileSync(new URL(`../examples/${file}.json`,import.meta.url),'utf8')),s=setupFor(e),r=calculate(s.cut,s);
  assert.equal(e.machineId,'bigblue');assert.equal(e.materialId,'plywood');assert.equal(s.tool.flutes,flutes);assert.equal(s.tool.stickout,stickout);
  assert.equal(s.cut.rpm,rpm);assert.equal(s.cut.feed,feed);assert.ok(Math.abs(s.cut.doc-doc)<1e-12);assert.equal(s.cut.woc,6.35);
  assert.ok(Math.abs(r.deflection-deflection)<1e-8);assert.ok(Math.abs(r.power-power)<1e-8);assert.equal(r.status,'inside');
  const old=calculate(s.cut,{...s,limits:cuttingPreset('aluminum','carbide')});assert.equal(old.status,'outside');assert.equal(old.power,r.power);assert.equal(old.deflection,r.deflection);
 }
});
