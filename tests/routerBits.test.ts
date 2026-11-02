import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BODY_MATERIALS,GEOMETRIES,calculate,cloneDefaults,steppedCompliance,toolNotices,withBody,withCutterMaterial,withDiameter} from '../src/model.ts';
import type {Geometry,Tool} from '../src/model.ts';
import {fresh,parseExperiment,readTool,setBody,setCutterMaterial,setGeometry,setupFor,snapshot,applyCuttingPreset,setWorkpieceMaterial,setOperation} from '../src/experiment.ts';
import {builtinLibrary,parseLibrary,parseToolValues,exportLibrary} from '../src/library.ts';
import {matchRecipes} from '../src/recipeMatch.ts';
import {buildConfiguration} from '../src/wizardApply.ts';
import {startingPoint} from '../src/startingPoint.ts';
import {matches,queryTerms,toolLabel} from '../src/libraryView.ts';
import {noticeText} from '../src/limitGuidance.ts';

const close=(a:number,b:number,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const result=(e:ReturnType<typeof fresh>)=>{const s=setupFor(e);return calculate(s.cut,s);};
const BUILTIN=builtinLibrary();
const NOVA=parseLibrary(readFileSync(new URL('../public/libraries/nova-labs.json',import.meta.url),'utf8'));

test('a tool whose shank equals its cutting diameter reproduces the single-cylinder bending estimate exactly',()=>{
 const s=cloneDefaults(),t=s.tool,EI=t.modulus*1000*(t.stiffness*Math.PI*t.diameter**4/64),L=t.stickout;
 const single=L**3/(3*EI);
 close(steppedCompliance(t),single,1e-15);
 // The cut spreads its load over the 3 mm depth: single-section δ/F = L³/3 − dL²/4 + d³/24 over EI.
 close(calculate(s.cut,s).deflection,124.8*(L**3/3-3*L**2/4+27/24)/EI*1000);
 close(steppedCompliance(t,3),(L**3/3-3*L**2/4+27/24)/EI,1e-15);
 // Flute length longer than the stickout also collapses to the single cylinder.
 close(steppedCompliance({...t,fluteLength:t.stickout*3}),single,1e-15);
});

test('spreading the load along the engaged flute bends less than a tip load, and never beyond the flute length',()=>{
 const t=cloneDefaults().tool,tip=steppedCompliance(t);
 // Uniform load over the whole length of a single-section beam: 3/8 of the tip-loaded value.
 const whole={...t,fluteLength:t.stickout};close(steppedCompliance(whole,t.stickout)/steppedCompliance(whole),3/8,1e-12);
 // Compliance falls monotonically with the loaded length up to the flute length, then holds.
 let last=tip;for(const d of [1,3,6,10,15])assert.ok(steppedCompliance(t,d)<last,`d=${d}`),last=steppedCompliance(t,d);
 close(steppedCompliance(t,15),steppedCompliance(t,40),1e-15);close(steppedCompliance(t,-5),tip,1e-15);
 // The default 6 mm tool, 20 mm stickout and 15 mm flutes: a full-flute cut sees about half the tip-loaded compliance.
 close(steppedCompliance(t,15)/tip,.49,.005);
 // Deflection still rises with depth, since force is proportional to it, but sub-linearly.
 const s=cloneDefaults(),at=(doc:number)=>calculate({...s.cut,doc},s).deflection;
 assert.ok(at(6)>at(3)&&at(6)<2*at(3)&&at(12)>at(6)&&at(12)<2*at(6));
});

test('a shank smaller than the cutting diameter bends more, a larger shank less, and a steel body bends by the modulus ratio',()=>{
 const s=cloneDefaults(),base=calculate(s.cut,s).deflection;
 const thin=calculate(s.cut,{...s,tool:{...s.tool,shankDiameter:3}}).deflection,thick=calculate(s.cut,{...s,tool:{...s.tool,shankDiameter:12}}).deflection;
 assert.ok(thin>base&&thick<base,`${thin} > ${base} > ${thick}`);
 // Hand formula for the stepped beam: a = flute length 15 of a 20 mm stickout, load spread over the 3 mm depth.
 const t={...s.tool,shankDiameter:3},E=t.modulus*1000,a=15,L=20,d=3,iF=t.stiffness*Math.PI*6**4/64,iS=t.stiffness*Math.PI*3**4/64;
 close(thin,124.8*((a**3/3-d*a**2/4+d**3/24)/(E*iF)+((L**3-a**3)/3-d*(L**2-a**2)/4)/(E*iS))*1000);
 close(steppedCompliance(t),(a**3/(E*iF)+(L**3-a**3)/(E*iS))/3,1e-15);
 const steel=withBody(s.tool,'steel');assert.equal(steel.modulus,210);assert.equal(steel.body,'steel');
 close(calculate(s.cut,{...s,tool:steel}).deflection/base,600/210,1e-12);
 for(const k of ['surface','chip','chipMax','mrr','power','torque','force'] as const)assert.equal(calculate(s.cut,{...s,tool:steel})[k],calculate(s.cut,s)[k]);
 // A carbide-tipped 1/2 in straight bit on a 1/4 in shank is far more flexible than a solid 1/2 in carbide end mill.
 const tipped=BUILTIN.tools.find(x=>x.id==='half-2f-straight-tipped')!.tool,solid=BUILTIN.tools.find(x=>x.id==='half-2f-carbide')!.tool;
 const cut={rpm:16000,feed:3000,doc:6,woc:6};
 const bendTipped=calculate(cut,{...s,tool:tipped,cut}).deflection,bendSolid=calculate(cut,{...s,tool:{...solid,stickout:tipped.stickout,fluteLength:tipped.fluteLength},cut}).deflection;
 assert.ok(bendTipped>bendSolid*5,`${bendTipped} vs ${bendSolid}`);
});

test('edge, body and diameter helpers keep the rules: steel bodies survive an edge change, matching shanks follow the diameter',()=>{
 const t=cloneDefaults().tool;
 const hss=withCutterMaterial(t,'hss');assert.equal(hss.body,'hss');assert.equal(hss.modulus,219);
 const back=withCutterMaterial(hss,'carbide');assert.equal(back.body,'carbide');assert.equal(back.modulus,600);
 const steel=withBody(t,'steel'),steelHss=withCutterMaterial(steel,'hss');assert.equal(steelHss.body,'steel');assert.equal(steelHss.modulus,210);assert.equal(steelHss.material,'hss');
 assert.deepEqual(withDiameter(t,8),{...t,diameter:8,shankDiameter:8});
 assert.deepEqual(withDiameter({...t,shankDiameter:3},8),{...t,diameter:8,shankDiameter:3});
 const e=fresh();setBody(e,'steel');assert.equal(e.config.tool.modulus,210);setCutterMaterial(e,'hss');assert.equal(e.config.tool.body,'steel');assert.equal(e.config.tool.modulus,210);
 setGeometry(e,'compression');e.config.tool.upcutLength=5;setGeometry(e,'downcut');assert.equal(e.config.tool.upcutLength,undefined);
 assert.equal(BODY_MATERIALS.steel.modulus,210);
});

test('files from before model 6 load as flat end mills with a matching body and shank, with identical results',()=>{
 const e=fresh();e.config.tool.modulus=475;e.pins.push(snapshot(e));const before=result(e);
 const old:any=structuredClone(e);old.modelVersion='illustrative-static-5';
 for(const p of [old,...old.pins]){delete p.config.tool.geometry;delete p.config.tool.body;delete p.config.tool.shankDiameter;}
 const migrated=parseExperiment(JSON.stringify(old));
 assert.equal(migrated.config.tool.geometry,'flat');assert.equal(migrated.config.tool.body,'carbide');assert.equal(migrated.config.tool.shankDiameter,6);assert.equal(migrated.config.tool.modulus,475);
 assert.deepEqual(result(migrated),before);assert.deepEqual(migrated.pins[0],e.pins[0]);
 // An HSS tool gets an HSS body; the old DMC2 insert-mill hack (carbide, 210 GPa) keeps its override.
 const hss=readTool({material:'hss',diameter:6,flutes:2,stickout:20,fluteLength:15,modulus:219,stiffness:.45});assert.equal(hss.body,'hss');assert.equal(hss.shankDiameter,6);
 const insert=readTool({material:'carbide',diameter:10,flutes:1,stickout:35,fluteLength:8,modulus:210,stiffness:.45});assert.equal(insert.body,'carbide');assert.equal(insert.modulus,210);
 // Example files from earlier releases still load.
 for(const file of ['envelope-study','big-blue-plywood-300-ipm','big-blue-plywood-shared-200-ipm'])assert.doesNotThrow(()=>parseExperiment(readFileSync(new URL(`../examples/${file}.json`,import.meta.url),'utf8')));
 assert.equal(NOVA.recipes[0].snapshot.config.tool.geometry,'flat');
});

test('unknown geometry or body, a bad shank and an upcut longer than the flutes are rejected; new fields round-trip',()=>{
 for(const mutate of [(t:any)=>t.geometry='spiral',(t:any)=>t.body='titanium',(t:any)=>t.shankDiameter=0,(t:any)=>t.shankDiameter='6',(t:any)=>{t.upcutLength=t.fluteLength+1;}]){
  const e:any=fresh();mutate(e.config.tool);assert.throws(()=>parseExperiment(JSON.stringify(e)));
  const lib:any=exportLibrary(BUILTIN);mutate(lib.tools[0].tool);assert.throws(()=>parseLibrary(JSON.stringify(lib)));
 }
 const e=fresh();e.config.tool={...e.config.tool,geometry:'compression',body:'steel',shankDiameter:6.35,upcutLength:5,modulus:210};e.pins.push(snapshot(e));
 const restored=parseExperiment(JSON.stringify(e));assert.deepEqual(restored,e);
 assert.deepEqual(parseToolValues(JSON.parse(JSON.stringify(e.config.tool))),e.config.tool);
 assert.deepEqual(parseLibrary(JSON.stringify(BUILTIN)),BUILTIN);
});

test('the built-in starters include router bits with honest construction, and every geometry has a label and note',()=>{
 const byId=(id:string)=>BUILTIN.tools.find(t=>t.id===id)!;
 const comp=byId('quarter-2f-compression').tool,tipped=byId('half-2f-straight-tipped').tool,surf=byId('one-inch-surfacing').tool;
 assert.equal(comp.geometry,'compression');assert.equal(comp.body,'carbide');assert.equal(comp.upcutLength,6.35);assert.ok(comp.upcutLength!<comp.fluteLength);
 assert.equal(tipped.geometry,'straight');assert.equal(tipped.body,'steel');assert.equal(tipped.modulus,210);assert.equal(tipped.shankDiameter,6.35);assert.equal(tipped.diameter,12.7);
 assert.equal(surf.geometry,'surfacing');assert.equal(surf.body,'steel');assert.equal(surf.shankDiameter,12.7);assert.equal(surf.maxRpm,16000);
 for(const t of BUILTIN.tools){assert.equal(t.provenance.source,'illustrative');if(t.tool.body==='steel')assert.equal(t.tool.modulus,210);else assert.equal(t.tool.modulus,BODY_MATERIALS[t.tool.body].modulus);}
 for(const g of Object.keys(GEOMETRIES) as Geometry[]){const info=GEOMETRIES[g];assert.ok(info.label.length>1&&info.note.length>40);assert.ok(['full','as-flat'].includes(info.modelled));}
 assert.equal(GEOMETRIES.ball.modelled,'as-flat');assert.equal(GEOMETRIES.v.modelled,'as-flat');assert.equal(GEOMETRIES.compression.modelled,'full');
});

test('labels and search name the geometry and a tipped body, and flat end mills read as before',()=>{
 const quarter=BUILTIN.tools.find(t=>t.id==='quarter-2f-carbide')!,comp=BUILTIN.tools.find(t=>t.id==='quarter-2f-compression')!,tipped=BUILTIN.tools.find(t=>t.id==='half-2f-straight-tipped')!;
 assert.equal(toolLabel(quarter.tool,'imperial'),'1/4 in · 2-flute Carbide');
 assert.equal(toolLabel(comp.tool,'imperial'),'1/4 in · 2-flute compression · Carbide');
 assert.equal(toolLabel(tipped.tool,'metric'),'1/2 in · 2-flute straight · Carbide-tipped');
 assert.ok(matches('tools',comp,queryTerms('compression 1/4')));assert.ok(matches('tools',tipped,queryTerms('carbide-tipped straight')));assert.ok(matches('tools',tipped,queryTerms('steel body')));
 assert.ok(!matches('tools',quarter,queryTerms('compression')));
});

test('recipe matching treats a different geometry as related and says so',()=>{
 const libs=[BUILTIN,NOVA],quarter2f=BUILTIN.tools.find(t=>t.id==='quarter-2f-carbide')!.tool;
 const comp:Tool={...quarter2f,geometry:'compression',upcutLength:6.35};
 const choice={machineId:'lib:nova-labs/big-blue',materialId:'plywood',tool:comp,operation:'roughing' as const};
 const {config}=buildConfiguration(libs,choice,fresh()),found=matchRecipes(libs,choice,config,'imperial');
 assert.ok(found.length===2);
 for(const m of found)assert.equal(m.tier,'related');
 const first=found.find(m=>m.recipe.id==='bigblue-plywood-300ipm')!;
 assert.ok(first.differences.some(d=>/Recipe used a 1\/4 in · 2-flute Carbide; you chose a 1\/4 in · 2-flute compression · Carbide/.test(d)),first.differences.join(' | '));
 const flat={...choice,tool:quarter2f},exact=matchRecipes(libs,flat,buildConfiguration(libs,flat,fresh()).config,'imperial');
 assert.equal(exact[0].tier,'exact');assert.ok(exact[0].score<first.score);
});

test('a compression spiral seeds its depth at least as deep as the upcut section and the shallow-pass notice is explained',()=>{
 const e=fresh();e.config.tool={...BUILTIN.tools.find(t=>t.id==='quarter-2f-compression')!.tool};
 setWorkpieceMaterial(e,'plywood');setOperation(e,'finishing');applyCuttingPreset(e);
 const config=structuredClone(e.config),outcome=startingPoint(config,'imperial');
 assert.ok(outcome.ok,!outcome.ok?outcome.reasons.join(' '):'');
 if(outcome.ok){
  // Finishing starts at 50%D, so the seed is raised to the upcut length; the limits may still push it back, and then the steps say so.
  assert.ok(outcome.steps.some(s=>/Compression spiral: depth raised to 100%D/.test(s)),outcome.steps.join('\n'));
  const covered=outcome.cut.doc>=config.tool.upcutLength!-1e-9,notices=toolNotices({...config,cut:outcome.cut});
  if(covered)assert.equal(notices.length,0);else{assert.equal(notices.length,1);assert.ok(outcome.steps.some(s=>/Depth ended below the 0\.25 in upcut length/.test(s)));}
 }
 // Roughing starts at 100%D, which already covers the upcut; when a limit binds, stepover gives way before depth drops below it.
 setOperation(e,'roughing');applyCuttingPreset(e);const rough=startingPoint(structuredClone(e.config),'imperial');
 assert.ok(rough.ok);if(rough.ok){assert.ok(rough.cut.doc>=6.35-1e-9);assert.equal(toolNotices({...e.config,cut:rough.cut}).length,0);}
 const heavy=structuredClone(e.config);heavy.tool.stickout=45;const held=startingPoint(heavy,'imperial');
 if(held.ok&&held.steps.some(s=>/stepover reduced/.test(s)))assert.ok(held.steps.some(s=>/depth held over the upcut section/.test(s)),held.steps.join('\n'));
 const shallow={...e.config,cut:{rpm:18000,feed:5000,doc:3,woc:6.35}};
 const notices=toolNotices(shallow);assert.equal(notices.length,1);assert.equal(notices[0].key,'compression-shallow');
 assert.match(noticeText(notices[0],'imperial'),/0\.118 in is below the 0\.25 in upcut length/);
 assert.match(noticeText(notices[0],'metric'),/3 mm is below the 6\.35 mm upcut length/);
 assert.equal(toolNotices({...shallow,tool:{...shallow.tool,geometry:'downcut'}}).length,0);
 assert.equal(toolNotices({...shallow,cut:{...shallow.cut,doc:0}}).length,0);
});
