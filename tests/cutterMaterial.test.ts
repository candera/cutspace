import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fresh,parseExperiment,setCutterMaterial,setWorkpieceMaterial,setupFor,snapshot} from '../src/experiment.ts';
import {cuttingPreset} from '../src/cuttingPresets.ts';
import {calculate,MODEL_VERSION} from '../src/model.ts';
import {gridFor} from '../src/plots.ts';
import {limitReading} from '../src/limitGuidance.ts';
const result=(e:ReturnType<typeof fresh>)=>{const s=setupFor(e);return calculate(s.cut,s);};

test('HSS changes static bending by the modulus ratio without changing cutting geometry or demand',()=>{
 const e=fresh(),before=result(e),point=structuredClone(e.point);
 setCutterMaterial(e,'hss');const after=result(e);
 assert.equal(e.config.tool.modulus,219);assert.deepEqual(e.point,point);
 assert.ok(Math.abs(after.deflection/before.deflection-600/219)<1e-12);
 for(const k of ['surface','chip','chipMax','thinning','mrr','power','torque','force'] as const)assert.equal(after[k],before[k]);
 assert.deepEqual(e.config.limits,cuttingPreset('aluminum','hss'));
 assert.equal(after.status,'outside');assert.equal(after.limiting.key,'deflection');
 assert.deepEqual(after.unknown,[]);
});

test('missing combination limits cannot produce a passing point or sampled envelope',()=>{
 const e=fresh();setCutterMaterial(e,'hss');e.config.tool.stickout=10;e.config.limits.cuttingDataKnown=false;e.config.limits.surfaceMax=450;
 let r=result(e);assert.equal(r.status,'unknown');assert.equal(r.feasible,false);
 for(const kind of ['speed','engagement'] as const)assert.equal(gridFor(setupFor(e),kind,e.view).samples.some(r=>r.feasible),false);
 for(const key of ['chipHigh','chipLow','surface'] as const){const reading=limitReading(key,setupFor(e),r,'imperial');assert.equal(reading.state,'Unavailable');assert.match(reading.readings[0],/cutter\/workpiece/);}
 e.config.limits.cuttingDataKnown=true;r=result(e);assert.equal(r.status,'inside');assert.deepEqual(r.unknown,[]);
 e.config.limits.surfaceMax=100;r=result(e);assert.equal(r.status,'outside');assert.ok(r.constraints.find(c=>c.key==='surface')!.ratio>1);
});

test('material switches load provisional limits and reset modulus only when the cutter changes',()=>{
 const e=fresh();e.config.tool.modulus=580;setCutterMaterial(e,'carbide');assert.equal(e.config.tool.modulus,580);assert.equal(e.config.limits.cuttingDataKnown,true);
 setCutterMaterial(e,'hss');assert.equal(e.config.tool.modulus,219);e.config.tool.modulus=210;e.config.limits.cuttingDataKnown=true;
 setWorkpieceMaterial(e,'steel');assert.equal(e.config.tool.modulus,210);assert.equal(e.config.limits.cuttingDataKnown,true);
 e.config.limits.cuttingDataKnown=true;setCutterMaterial(e,'carbide');assert.equal(e.config.tool.modulus,600);assert.equal(e.config.limits.cuttingDataKnown,true);
});

test('cutter materials, overrides and applicability round-trip in active setup and immutable pins',()=>{
 const e=fresh();e.pins.push(snapshot(e));setCutterMaterial(e,'hss');e.config.tool.modulus=215;e.units='imperial';e.pins.push(snapshot(e));
 const restored=parseExperiment(JSON.stringify(e));assert.deepEqual(restored,e);
 assert.equal(restored.pins[0].config.tool.material,'carbide');assert.equal(restored.pins[0].config.limits.cuttingDataKnown,true);
 assert.equal(restored.pins[1].config.tool.material,'hss');assert.equal(restored.pins[1].config.tool.modulus,215);assert.equal(restored.pins[1].config.limits.cuttingDataKnown,true);
 assert.deepEqual(result(restored),result(e));
});

test('legacy experiments and pins migrate to explicit carbide with identical numerical results',()=>{
 const e=fresh();e.config.tool.modulus=475;e.pins.push(snapshot(e));const before=result(e);
 const old:any=structuredClone(e);old.modelVersion='illustrative-static-2';
 for(const p of [old,...old.pins]){delete p.config.tool.material;delete p.config.limits.cuttingDataKnown;}
 const migrated=parseExperiment(JSON.stringify(old));assert.equal(migrated.modelVersion,MODEL_VERSION);assert.equal(migrated.config.tool.material,'carbide');assert.equal(migrated.config.tool.modulus,475);assert.deepEqual(result(migrated),before);
 assert.deepEqual(migrated.pins[0],e.pins[0]);
 assert.doesNotThrow(()=>parseExperiment(readFileSync(new URL('../examples/envelope-study.json',import.meta.url),'utf8')));
});

test('current experiments reject unsupported or missing cutter materials and nonboolean applicability',()=>{
 for(const value of ['ceramic',null,42,{},undefined]){const e:any=fresh();e.config.tool.material=value;assert.throws(()=>parseExperiment(JSON.stringify(e)),/cutter material/);}
 for(const value of ['true',1,null,undefined]){const e:any=fresh();e.config.limits.cuttingDataKnown=value;assert.throws(()=>parseExperiment(JSON.stringify(e)),/availability/);}
 const e:any=fresh();e.pins.push(snapshot(e));e.pins[0].config.tool.material='router-bit';assert.throws(()=>parseExperiment(JSON.stringify(e)),/cutter material/);
});
