import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findMachine,parseLibrary} from '../src/library.ts';
import {fresh,fitView,setupFor} from '../src/experiment.ts';
import type {Experiment} from '../src/experiment.ts';
import {calculate} from '../src/model.ts';
import type {Setup} from '../src/model.ts';
import {envelopeBounds,gridFor} from '../src/plots.ts';
import {AGGRESSIVE,CHART,DIAMETERS,FLUTES,RAW} from '../scripts/dmc2-mini-data.ts';
import type {Row,Workpiece} from '../scripts/dmc2-mini-data.ts';

const lib=parseLibrary(readFileSync(new URL('../examples/dmc2-mini-library.json',import.meta.url),'utf8'));
const machine=lib.machines[0];
const toolId=(w:Workpiece,d:number)=>`${w==='aluminum'?'al-3f':'st-4f'}-${d}mm`;
const recipeFor=(r:Row)=>lib.recipes.find(x=>x.id===`chart-${r.workpiece}-${r.diameter}mm-${r.mode}`)!;
/** A row evaluated with the library machine and the limits the library's recipes store for that tool. */
function evaluate(row:Row){
 const recipe=recipeFor({...row,mode:'profile'}),c=recipe.snapshot.config;
 const setup:Setup={tool:c.tool,material:c.material,machine:c.machine,limits:c.limits,cut:{rpm:row.rpm,feed:row.feed,doc:row.doc,woc:row.woc}};
 return calculate(setup.cut,setup);
}

test('the DMC2 library holds the fitted machine, the 17 tools from the sheet and the 32 chart recipes',()=>{
 assert.equal(lib.id,'dmc2-mini');assert.equal(lib.machines.length,1);assert.equal(lib.tools.length,17);assert.equal(lib.recipes.length,32);assert.equal(lib.materials.length,0);
 assert.equal(machine.id,'dmc2-mini');assert.equal(machine.name,'DMC2 Mini');
 assert.deepEqual(machine.machine,{rpmMin:6000,rpmMax:24000,feedMax:10000,power:950,torque:.378,utilization:.75,known:true});
 assert.match(machine.provenance.note??'',/not the 2\.2 kW nameplate/);assert.match(machine.provenance.url??'',/docs\.google\.com/);
 for(const w of ['aluminum','steel'] as Workpiece[])for(const d of DIAMETERS){
  const t=lib.tools.find(x=>x.id===toolId(w,d))!;assert.equal(t.tool.diameter,d);assert.equal(t.tool.flutes,FLUTES[w]);assert.equal(t.tool.material,'carbide');assert.equal(t.provenance.source,'user');
  const deepest=Math.max(...[...CHART,...AGGRESSIVE,...RAW].filter(r=>r.workpiece===w&&r.diameter===d).map(r=>r.doc));assert.ok(t.tool.fluteLength>=deepest,`${t.id} flute length covers ${deepest} mm`);
 }
 const insert=lib.tools.find(t=>t.id==='insert-mill-10mm-1f')!;assert.equal(insert.tool.flutes,1);assert.equal(insert.tool.modulus,210);
 for(const recipe of lib.recipes){
  assert.equal(recipe.snapshot.machineId,'lib:dmc2-mini/dmc2-mini');assert.equal(findMachine([lib],recipe.snapshot.machineId)?.item.id,'dmc2-mini');
  assert.ok(['aluminum','steel'].includes(recipe.snapshot.materialId));assert.equal(recipe.provenance.source,'manufacturer');assert.equal(recipe.snapshot.config.limits.operation,'roughing');
  const e:Experiment={...fresh(),...structuredClone(recipe.snapshot)};assert.doesNotThrow(()=>setupFor(e));
 }
 // Both recipes for a tool share one limit set, and the limits are the tool's demonstrated values, not the diameter-scaled generic preset.
 for(const w of ['aluminum','steel'] as Workpiece[])for(const d of DIAMETERS){
  const profile=recipeFor({workpiece:w,mode:'profile',diameter:d} as Row),slot=recipeFor({workpiece:w,mode:'slot',diameter:d} as Row);
  assert.deepEqual(profile.snapshot.config.limits,slot.snapshot.config.limits);assert.deepEqual(profile.snapshot.config.tool,slot.snapshot.config.tool);
  assert.equal(profile.snapshot.config.limits.preset,undefined);
 }
});

test('chart rows for 1–6 mm tools land inside the fitted envelope; 8–12 mm chart rows exceed it at the chart’s low RPM, as the recipe notes say',()=>{
 let inside=0;
 for(const row of CHART){
  const recipe=recipeFor(row),e:Experiment={...fresh(),...structuredClone(recipe.snapshot)};e.view=fitView(e);const s=setupFor(e),r=calculate(s.cut,s);
  assert.ok(Math.abs(s.cut.rpm-row.rpm)<1e-9&&Math.abs(s.cut.feed-row.feed)<1e-9&&Math.abs(s.cut.doc-row.doc)<1e-6&&Math.abs(s.cut.woc-row.woc)<1e-6,`${recipe.id} reproduces the chart row`);
  if(row.diameter<=6){
   assert.equal(r.status,'inside',`${recipe.id}: ${r.constraints.filter(c=>c.ratio>1).map(c=>c.key).join(',')}`);inside++;
   assert.match(recipe.notes,/inside the fitted DMC2 envelope/);
   assert.ok(envelopeBounds(gridFor(s,'speed',e.view),s.cut)&&envelopeBounds(gridFor(s,'engagement',e.view),s.cut),`${recipe.id} has a visible envelope`);
  }else{
   assert.equal(r.status,'outside',recipe.id);assert.ok(r.hardOk,`${recipe.id} fails only soft limits`);
   assert.ok(r.constraints.some(c=>c.ratio>1&&(c.key==='torque'||c.key==='deflection')),`${recipe.id} exceeds torque or deflection`);
   assert.match(recipe.notes,/Outside the fitted DMC2 envelope/);
  }
 }
 assert.equal(inside,20);
});

test('aggressive test cuts sit at or inside the envelope, and the recorded high-feed spindle bog-downs sit beyond it',()=>{
 for(const row of AGGRESSIVE){const r=evaluate(row);assert.equal(r.status,'inside',`${row.workpiece} ${row.mode} ${row.diameter} mm: ${r.constraints.filter(c=>c.ratio>1).map(c=>`${c.key} ${c.ratio.toFixed(3)}`).join(',')}`);}
 for(const row of RAW.filter(r=>r.outcome==='good'))assert.equal(evaluate(row).status,'inside',`${row.diameter} mm ${row.workpiece} ${row.mode} ${row.note}`);
 // Bog-downs at or near 24,000 RPM with 3–4 mm tools exceed the fitted power/torque; deep thin-radial stalls exceed the per-tool deflection allowance.
 const bogged=RAW.filter(r=>/bog/i.test(r.note??'')&&r.workpiece==='aluminum'&&r.mode==='profile'&&(r.diameter===3||r.diameter===4)&&r.feed>=2880);
 assert.ok(bogged.length>=3);for(const row of bogged)assert.ok(evaluate(row).constraints.some(c=>(c.key==='power'||c.key==='torque')&&c.ratio>1),row.note);
 const stalls=RAW.filter(r=>/stall/i.test(r.note??''));assert.ok(stalls.length>=3);
 for(const row of stalls)assert.ok(evaluate(row).constraints.find(c=>c.key==='deflection')!.ratio>1,`${row.diameter} mm ${row.workpiece} ${row.note}`);
 // The model cannot separate every failure: the constant-coefficient force model keeps some bog-downs with thin chips inside. Record how many it catches so a regression is visible.
 const fails=RAW.filter(r=>r.outcome==='fail'),caught=fails.filter(r=>evaluate(r).status==='outside').length;
 assert.ok(caught>=12&&caught<=fails.length,`${caught} of ${fails.length} failures outside`);
});
