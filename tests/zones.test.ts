import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,cloneDefaults,constraintInfo} from '../src/model.ts';
import {limitReading} from '../src/limitGuidance.ts';
import {applyCuttingPreset,editLimit,fresh,parseExperiment} from '../src/experiment.ts';

test('soft limits have a caution band; hard limits never do',()=>{
 const s=cloneDefaults();
 let r=calculate(s.cut,s);
 assert.equal(r.status,'inside');assert.equal(r.zone,'caution');assert.equal(r.softLimiting?.key,'deflection');
 assert.ok(r.softRatio>.75&&r.softRatio<1);assert.equal(r.hardOk,true);
 s.limits.caution=.8;r=calculate(s.cut,s);assert.equal(r.zone,'comfortable');
 s.cut.feed=2400;r=calculate(s.cut,s);assert.equal(r.zone,'beyond');assert.equal(r.status,'outside');
 const t=cloneDefaults();t.cut.rpm=t.machine.rpmMax*.97;
 const hard=limitReading('rpm',t,calculate(t.cut,t),'metric');
 assert.equal(hard.state,'Within limit');assert.equal(hard.caution,false);assert.equal(hard.soft,false);
 const soft=limitReading('deflection',cloneDefaults(),calculate(cloneDefaults().cut,cloneDefaults()),'metric');
 assert.equal(soft.state,'Caution');assert.equal(soft.caution,true);
 for(const key of ['rpm','feed','geometry'] as const)assert.equal(constraintInfo[key].kind,'hard');
});
test('a failed hard limit leaves the zone outside even when soft limits are comfortable',()=>{
 const s=cloneDefaults();s.cut.rpm=s.machine.rpmMax*1.2;s.limits.caution=.99;
 const r=calculate(s.cut,s);
 assert.equal(r.status,'outside');assert.equal(r.hardOk,false);assert.equal(r.zone,'unknown');assert.ok(Number.isFinite(r.softRatio));
});
test('caution fraction persists, defaults for older files, and does not clear preset attribution',()=>{
 const e=fresh();assert.equal(e.config.limits.caution,.75);
 const text=JSON.stringify(e);
 const stripped=JSON.parse(text);delete stripped.config.limits.caution;
 assert.equal(parseExperiment(JSON.stringify(stripped)).config.limits.caution,.75);
 editLimit(e,'caution',.6);assert.equal(e.config.limits.preset,'provisional-1');
 assert.equal(parseExperiment(JSON.stringify(e)).config.limits.caution,.6);
 applyCuttingPreset(e);assert.equal(e.config.limits.caution,.6);
 editLimit(e,'chipMax',.1);assert.equal(e.config.limits.preset,undefined);
 const bad=JSON.parse(JSON.stringify(e));bad.config.limits.caution=1.5;assert.throws(()=>parseExperiment(JSON.stringify(bad)));
 e.view.fill='zone';assert.equal(parseExperiment(JSON.stringify(e)).view.fill,'zone');
});
test('provisional chip bands scale with cutter diameter within bounds, and wood ceilings do not flag common router speeds',async()=>{
 const {cuttingPreset,chipScale}=await import('../src/cuttingPresets.ts');
 const six=cuttingPreset('plywood','carbide'),half=cuttingPreset('plywood','carbide',.75,12.7),tiny=cuttingPreset('plywood','carbide',.75,1);
 assert.ok(Math.abs(half.chipMax-six.chipMax*12.7/6)<1e-9);assert.equal(tiny.chipMax,Number((six.chipMax*.4).toPrecision(6)));assert.equal(chipScale(60),2.5);
 const s=cloneDefaults();s.tool.diameter=12.7;s.cut.rpm=18000;s.cut.woc=12.7;s.cut.doc=6;s.cut.feed=7620;s.material.kc=100;s.limits=cuttingPreset('plywood','carbide',.75,12.7);
 const r=calculate(s.cut,s);
 assert.ok(r.constraints.find(c=>c.key==='surface')!.ratio<1);
 const e=fresh();e.config.tool.diameter=12.7;applyCuttingPreset(e);assert.ok(Math.abs(e.config.limits.chipMax-.055*12.7/6)<1e-5);
});
test('every limit explains what the operator would notice',async()=>{
 const {limitGuidance}=await import('../src/limitGuidance.ts');
 for(const g of Object.values(limitGuidance))assert.ok(g.notice.length>20);
});
