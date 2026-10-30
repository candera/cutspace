import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fresh,parseExperiment,setupFor,setWorkpieceMaterial,setCutterMaterial} from '../src/experiment.ts';
import {autoScale,gridFor,heatColor} from '../src/plots.ts';
import {metricValue} from '../src/model.ts';
import type {Metric} from '../src/model.ts';

test('plywood examples no longer clip valid visible values to the upper color',()=>{
 for(const file of ['big-blue-plywood-300-ipm','big-blue-plywood-shared-200-ipm']){
  const e=parseExperiment(readFileSync(new URL(`../examples/${file}.json`,import.meta.url),'utf8')),s=setupFor(e),grids=[gridFor(s,'speed',e.view),gridFor(s,'engagement',e.view)];
  for(const metric of ['mrr','power','chip','chipMax','deflection','utilization','margin'] as Metric[]){
   const scale=autoScale(grids,metric),values=grids.flatMap(g=>g.samples).filter(r=>r.status!=='invalid').map(r=>metricValue(r,metric)).filter(Number.isFinite);
   assert.equal(scale.min,Math.min(...values));assert.equal(scale.max,Math.max(...values));
   assert.ok(values.every(v=>v>=scale.min&&v<=scale.max));
   if(metric==='mrr')for(const g of grids){const colors=new Set(g.samples.filter(r=>r.status!=='invalid').map(r=>heatColor((r.mrr-scale.min)/(scale.max-scale.min))));assert.ok(colors.size>20);}
  }
 }
});

test('zoomed nonzero ranges use both ends of the palette, and invalid samples do not skew it',()=>{
 const e=fresh();Object.assign(e.view,{feedMin:2000,feedMax:2500});const s=setupFor(e),g=gridFor(s,'speed',e.view),scale=autoScale([g],'mrr');
 assert.ok(scale.min>0);assert.ok(scale.max>scale.min);
 const invalid={...g.samples[0],status:'invalid' as const,mrr:1e12};
 assert.deepEqual(autoScale([{...g,samples:[...g.samples,invalid]}],'mrr'),scale);
 const narrower=autoScale([gridFor(s,'speed',{...e.view,feedMin:2200,feedMax:2300})],'mrr');assert.ok(narrower.min>scale.min&&narrower.max<scale.max);
});

test('constant and zero fields have finite nonzero ranges, and margin is not clipped at -100 percent',()=>{
 const e=fresh(),s=setupFor(e),g=gridFor(s,'speed',e.view);
 for(const value of [0,5,-5]){const grid={...g,samples:g.samples.map(r=>({...r,margin:value}))},scale=autoScale([grid],'margin');assert.ok(Number.isFinite(scale.min)&&Number.isFinite(scale.max));assert.ok(scale.max>scale.min);assert.ok(scale.min<=value&&scale.max>=value);}
 const scale=autoScale([{...g,samples:g.samples.map((r,i)=>({...r,margin:i%2?-8:.5}))}],'margin');assert.equal(scale.min,-8);assert.equal(scale.max,.5);
});

test('material switches release old fixed ranges without changing numeric limits on import',()=>{
 const e=fresh();e.view.fixed=true;e.view.scaleMin=1;e.view.scaleMax=2;
 assert.deepEqual(parseExperiment(JSON.stringify(e)).view,e.view);
 setWorkpieceMaterial(e,'plywood');assert.equal(e.view.fixed,false);
 e.view.fixed=true;setCutterMaterial(e,'hss');assert.equal(e.view.fixed,false);
});
