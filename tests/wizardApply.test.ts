import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildConfiguration,buildExperiment,experimentName} from '../src/wizardApply.ts';
import {startingPoint} from '../src/startingPoint.ts';
import {cuttingPreset} from '../src/cuttingPresets.ts';
import {fresh,parseExperiment,setupFor} from '../src/experiment.ts';
import {builtinLibrary,limitsFromMaterialItem,machineRefId,parseLibrary} from '../src/library.ts';
import {calculate} from '../src/model.ts';

const read=(path:string)=>parseLibrary(readFileSync(new URL(path,import.meta.url),'utf8'));
const NOVA=read('../public/libraries/nova-labs.json'),ONEFINITY=read('../examples/onefinity-elite-journeyman-polycarbonate-library.json'),BUILTIN=builtinLibrary();
const quarter2f=BUILTIN.tools.find(t=>t.id==='quarter-2f-carbide')!.tool;

test('a built-in workpiece resolves to the provisional preset for the chosen cutter, tool size and operation',()=>{
 const e=fresh(),libs=[BUILTIN,NOVA];
 const {config,limitsBasis}=buildConfiguration(libs,{machineId:'lib:nova-labs/big-blue',materialId:'plywood',tool:quarter2f,operation:'finishing'},e);
 assert.equal(config.machine.name,'Big Blue');assert.equal(config.machine.rpmMax,24000);
 assert.equal(config.material.name,'Plywood');assert.equal(config.material.kc,100);assert.equal(config.material.powerFactor,1.25);
 assert.deepEqual(config.limits,cuttingPreset('plywood','carbide',{caution:e.config.limits.caution,diameter:6.35,flutes:2,operation:'finishing'}));
 assert.deepEqual(config.tool,quarter2f);
 assert.match(limitsBasis,/Provisional preset for Carbide \/ Plywood/);assert.match(limitsBasis,/finishing deflection allowance/);assert.doesNotMatch(limitsBasis,/recommend/i);
});

test('a library workpiece resolves to its stored cutting starter, or to checks-off when it lacks the cutter',()=>{
 const e=fresh(),libs=[BUILTIN,ONEFINITY],materialId=machineRefId(ONEFINITY.id,'polycarbonate-o-flute-starter'),machineId=machineRefId(ONEFINITY.id,'onefinity-elite-journeyman-gen1-redline-2.2kw');
 const item=ONEFINITY.materials[0];
 const carbide=buildConfiguration(libs,{machineId,materialId,tool:quarter2f,operation:'roughing'},e);
 assert.deepEqual(carbide.config.limits,limitsFromMaterialItem(item,'carbide',{...e.config.limits,operation:'roughing'}));
 assert.equal(carbide.config.limits.cuttingDataKnown,true);assert.match(carbide.limitsBasis,/Cutting starter stored with/);
 const hss=buildConfiguration(libs,{machineId,materialId,tool:{...quarter2f,material:'hss',modulus:219},operation:'roughing'},e);
 assert.equal(hss.config.limits.cuttingDataKnown,false);assert.match(hss.limitsBasis,/no chip or surface-speed data for HSS/);
 const outcome=startingPoint(hss.config);assert.ok(!outcome.ok);
 assert.throws(()=>buildConfiguration(libs,{machineId:'lib:nowhere/none',materialId:'plywood',tool:quarter2f,operation:'roughing'},e),/not in any library/);
});

test('a computed pick produces a valid experiment at the solver point, named after the setup, with the user’s units',()=>{
 const e=fresh();e.units='imperial';e.pins.push({machineId:e.machineId,materialId:e.materialId,config:structuredClone(e.config),point:{...e.point}});
 const libs=[BUILTIN,NOVA],choice={machineId:'lib:nova-labs/big-blue',materialId:'plywood',tool:quarter2f,operation:'roughing' as const};
 const {config}=buildConfiguration(libs,choice,e),solved=startingPoint(config,'imperial');
 assert.ok(solved.ok);if(!solved.ok)return;
 const {experiment,notice}=buildExperiment(e,libs,choice,{kind:'computed',point:solved.point},'imperial');
 assert.deepEqual(experiment,parseExperiment(JSON.stringify(experiment)));
 assert.equal(experiment.machineId,'lib:nova-labs/big-blue');assert.equal(experiment.materialId,'plywood');assert.deepEqual(experiment.point,solved.point);
 assert.equal(experiment.units,'imperial');assert.equal(experiment.pins.length,1,'pins survive');assert.equal(experiment.view.fixed,false);
 assert.equal(experiment.name,experimentName(config,'imperial'));assert.equal(experiment.name,'Plywood · 1/4 in · 2-flute Carbide on Big Blue');
 const s=setupFor(experiment);assert.equal(calculate(s.cut,s).status,'inside');
 assert.match(notice,/Undo restores/);
 // The plot ranges include the new cut.
 assert.ok(experiment.view.rpmMax>=solved.point.rpm&&experiment.view.feedMax>=solved.point.feed);
});

test('a recipe pick reproduces the snapshot, honours the chosen operation and keeps the user’s units; none keeps the cut',()=>{
 const e=fresh(),libs=[BUILTIN,NOVA],recipe=NOVA.recipes[0],choice={machineId:'lib:nova-labs/big-blue',materialId:'plywood',tool:quarter2f,operation:'finishing' as const};
 const {experiment}=buildExperiment(e,libs,choice,{kind:'recipe',recipe},'metric');
 assert.equal(experiment.machineId,recipe.snapshot.machineId);assert.deepEqual(experiment.point,recipe.snapshot.point);assert.deepEqual(experiment.config.tool,recipe.snapshot.config.tool);
 assert.equal(experiment.config.limits.operation,'finishing');assert.equal(experiment.units,'metric');assert.equal(experiment.name,recipe.name);
 assert.ok(experiment.config.limits.deflection<recipe.snapshot.config.limits.deflection,'finishing tightens the deflection allowance');
 const none=buildExperiment(e,libs,{...choice,operation:'roughing'},{kind:'none'},'metric');
 assert.deepEqual(none.experiment.point,e.point);assert.equal(none.experiment.config.machine.name,'Big Blue');assert.match(none.notice,/left unchanged/);
});
