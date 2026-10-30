import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,cloneDefaults} from '../src/model.ts';
import {limitReading} from '../src/limitGuidance.ts';

test('thin chips and low RPM identify a lower bound, not an overload',()=>{
 const s=cloneDefaults();s.cut.feed=30;
 let reading=limitReading('chipLow',s,calculate(s.cut,s),'metric');
 assert.equal(reading.state,'Below minimum');assert.equal(reading.exceeded,true);
 assert.match(reading.readings[0],/below minimum/);
 s.cut.rpm=1000;
 reading=limitReading('rpm',s,calculate(s.cut,s),'metric');
 assert.equal(reading.state,'Below minimum');assert.match(reading.readings[0],/1,000 RPM · range 3,000–18,000 RPM/);
 s.cut.rpm=20000;
 assert.equal(limitReading('rpm',s,calculate(s.cut,s),'metric').state,'Above maximum');
});
test('no-cut points do not recommend correcting a thin-chip cutting problem',()=>{
 for(const key of ['feed','doc','woc'] as const){
  const s=cloneDefaults();s.cut[key]=0;
  const reading=limitReading('chipLow',s,calculate(s.cut,s),'metric');
  assert.equal(reading.state,'No cut');assert.equal(reading.exceeded,false);
  assert.match(reading.readings[0],/No material/);
 }
});
test('unavailable capacities are not displayed as passing or known numerical limits',()=>{
 const s=cloneDefaults();s.machine.known=false;
 for(const key of ['power','torque'] as const){
  const reading=limitReading(key,s,calculate(s.cut,s),'metric');
  assert.equal(reading.state,'Unavailable');assert.equal(reading.exceeded,false);
  assert.match(reading.readings[0],/not a passing result/);
 }
});
test('geometry identifies each failing dimension and converts both sides to inches',()=>{
 const s=cloneDefaults();s.tool.diameter=25.4;s.tool.fluteLength=12.7;s.tool.stickout=19.05;
 s.cut.woc=50.8;s.cut.doc=25.4;
 const reading=limitReading('geometry',s,calculate(s.cut,s),'imperial');
 assert.equal(reading.exceeded,true);assert.equal(reading.readings.length,2);
 assert.match(reading.readings[0],/1 in · maximum 0.5 in — above maximum/);
 assert.match(reading.readings[1],/1 in · maximum 0.75 in — above maximum/);
 const slot=cloneDefaults();slot.cut.woc=slot.tool.diameter;const sr=calculate(slot.cut,slot);
 assert.notEqual(sr.limiting.key,'geometry');assert.ok(sr.constraints.find(c=>c.key==='geometry')!.ratio<1);assert.ok(sr.hardOk);
});
test('power compares against usable plateau and retains classification across units',()=>{
 const s=cloneDefaults();s.cut.feed=3000;
 const r=calculate(s.cut,s);
 const metric=limitReading('power',s,r,'metric'),imperial=limitReading('power',s,r,'imperial');
 assert.equal(metric.exceeded,true);assert.equal(metric.state,imperial.state);
 assert.match(metric.readings[0],/225 W · maximum 187.5 W/);
 assert.match(imperial.readings[0],/0.302 hp · maximum 0.251 hp/);
});
