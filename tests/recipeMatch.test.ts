import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchRecipes,machineRelation} from '../src/recipeMatch.ts';
import type {WizardChoice} from '../src/recipeMatch.ts';
import {buildConfiguration} from '../src/wizardApply.ts';
import {fresh,MACHINES} from '../src/experiment.ts';
import {asShared,builtinLibrary,machineFromItem,machineRefId,parseLibrary} from '../src/library.ts';
import type {Library} from '../src/library.ts';
import type {Tool} from '../src/model.ts';

const read=(path:string)=>parseLibrary(readFileSync(new URL(path,import.meta.url),'utf8'));
const NOVA=read('../public/libraries/nova-labs.json'),DMC2=read('../examples/dmc2-mini-library.json'),ONEFINITY=read('../examples/onefinity-elite-journeyman-polycarbonate-library.json');
const BUILTIN=builtinLibrary();
const quarter2f=BUILTIN.tools.find(t=>t.id==='quarter-2f-carbide')!.tool;
const choose=(libraries:Library[],choice:WizardChoice)=>{const {config}=buildConfiguration(libraries,choice,fresh());return matchRecipes(libraries,choice,config,'imperial');};

test('Big Blue in plywood with the quarter-inch two-flute matches the reported 300 IPM cut exactly and the four-flute cut as related',()=>{
 const libs=[BUILTIN,NOVA],matches=choose(libs,{machineId:'lib:nova-labs/big-blue',materialId:'plywood',tool:quarter2f,operation:'roughing'});
 assert.deepEqual(matches.map(m=>[m.recipe.id,m.tier]),[['bigblue-plywood-300ipm','exact'],['bigblue-plywood-200ipm','related']]);
 const [exact,related]=matches;
 assert.equal(exact.machine,'same');assert.equal(exact.own.status,'inside');assert.equal(exact.onYourMachine,undefined);
 assert.deepEqual(exact.reasons,['Same machine (Big Blue)','Same workpiece (Plywood)','Same tool: 1/4 in · 2-flute Carbide']);assert.deepEqual(exact.differences,[]);
 assert.ok(related.differences.some(d=>/4-flute/.test(d)&&/2-flute/.test(d)));
 // Choosing finishing notes the difference without excluding anything.
 const fine=choose(libs,{machineId:'lib:nova-labs/big-blue',materialId:'plywood',tool:quarter2f,operation:'finishing'});
 assert.equal(fine[0].tier,'exact');assert.ok(fine[0].differences.some(d=>/Saved as roughing; you chose finishing/.test(d)));
});

test('the ShopSabre RC4 is a similar machine to Big Blue, so its recipes are related and also evaluated on the chosen machine',()=>{
 const libs=[BUILTIN,NOVA],matches=choose(libs,{machineId:'lib:nova-labs/shopsabre-rc4',materialId:'plywood',tool:quarter2f,operation:'roughing'});
 assert.equal(matches.length,2);
 for(const m of matches){assert.equal(m.tier,'related');assert.equal(m.machine,'similar');assert.ok(m.onYourMachine);assert.ok(m.differences.some(d=>/Recorded on Big Blue/.test(d)));}
 // 18,000 RPM on the RC4 is inside its range; the 300 IPM cut therefore evaluates the same way there.
 assert.equal(matches[0].onYourMachine?.status,'inside');
 assert.equal(machineRelation('a',{...MACHINES['spindle-router-example']},'b',{...MACHINES['desktop-mill-example']}),'different');
 assert.equal(machineRelation('a',{...MACHINES['spindle-router-example']},'b',{...MACHINES['spindle-router-example'],name:'Other'}),'same');
});

test('DMC2 sheet recipes match their own tool exactly, nearby diameters as related, and far diameters not at all',()=>{
 const libs=[BUILTIN,DMC2],id='lib:dmc2-mini/dmc2-mini',tool3=DMC2.tools.find(t=>t.id==='al-3f-3mm')!.tool;
 const exact=choose(libs,{machineId:id,materialId:'aluminum',tool:tool3,operation:'roughing'});
 assert.deepEqual(exact.filter(m=>m.tier==='exact').map(m=>m.recipe.id).sort(),['chart-aluminum-3mm-profile','chart-aluminum-3mm-slot']);
 assert.ok(exact.every(m=>m.recipe.snapshot.materialId==='aluminum'));
 for(const m of exact)assert.equal(m.own.status,'inside');
 const eight=DMC2.tools.find(t=>t.id==='al-3f-8mm')!.tool,big=choose(libs,{machineId:id,materialId:'aluminum',tool:eight,operation:'roughing'});
 assert.ok(big.some(m=>m.recipe.id==='chart-aluminum-8mm-profile'&&m.own.status==='outside'),'the 8 mm chart row is outside the fitted envelope');
 // 6.35 mm against the 6 mm rows is related; 12.7 mm finds nothing within 25% besides the 10 and 12 mm rows.
 const quarter=choose(libs,{machineId:id,materialId:'aluminum',tool:{...tool3,diameter:6.35},operation:'roughing'});
 assert.ok(quarter.length>0&&quarter.every(m=>m.tier==='related'));assert.ok(quarter.some(m=>m.recipe.id==='chart-aluminum-6mm-profile'&&m.differences.some(d=>/0\.236 in · 3-flute/.test(d))));
 const half=choose(libs,{machineId:id,materialId:'aluminum',tool:{...tool3,diameter:12.7},operation:'roughing'});
 assert.ok(half.every(m=>[10,12].includes(m.recipe.snapshot.config.tool.diameter)));
 assert.ok(!choose(libs,{machineId:id,materialId:'aluminum',tool:{...tool3,diameter:3},operation:'roughing'}).some(m=>m.recipe.snapshot.config.tool.diameter>=6));
});

test('a different workpiece or cutter material excludes a recipe',()=>{
 const libs=[BUILTIN,NOVA];
 assert.deepEqual(choose(libs,{machineId:'lib:nova-labs/big-blue',materialId:'hardwood',tool:quarter2f,operation:'roughing'}),[]);
 const hss:Tool={...quarter2f,material:'hss',modulus:219};
 assert.deepEqual(choose(libs,{machineId:'lib:nova-labs/big-blue',materialId:'plywood',tool:hss,operation:'roughing'}),[]);
 assert.deepEqual(choose(libs,{machineId:'spindle-router-example',materialId:'plywood',tool:quarter2f,operation:'roughing'}),[],'a generic router is not similar enough to Big Blue');
});

test('a personal library imported as a shared copy still matches its recipes through machine and material names',()=>{
 const shared=asShared({...structuredClone(ONEFINITY),id:'onefinity-shared'}),libs=[BUILTIN,shared];
 const machineId=machineRefId(shared.id,'onefinity-elite-journeyman-gen1-makita-rt0701c'),materialId=machineRefId(shared.id,'polycarbonate-o-flute-starter');
 const hozly=shared.tools.find(t=>t.id==='hozly-eighth-single-flute-dlc-b09ztw9v5d')!.tool;
 const matches=choose(libs,{machineId,materialId,tool:hozly,operation:'roughing'});
 assert.ok(matches.length>0);
 assert.equal(matches[0].recipe.id,'reported-polycarbonate-slot-makita-hozly-eighth');assert.equal(matches[0].tier,'exact');assert.equal(matches[0].machine,'same');
 assert.ok(matches[0].recipe.snapshot.machineId.startsWith('lib:personal/'),'the recipe still carries its personal-library id');
 assert.ok(machineFromItem(shared.machines[0]).name.includes('Makita'));
});

test('matching is deterministic and ordered exact-first',()=>{
 const libs=[BUILTIN,NOVA,DMC2],choice:WizardChoice={machineId:'lib:nova-labs/big-blue',materialId:'plywood',tool:quarter2f,operation:'roughing'};
 const a=choose(libs,choice),b=choose(libs,choice);
 assert.deepEqual(a.map(m=>m.recipe.id),b.map(m=>m.recipe.id));
 for(let i=1;i<a.length;i++)assert.ok(a[i-1].score<=a[i].score);
});
