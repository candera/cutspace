import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fresh,parseExperiment,setupFor,setWorkpieceMaterial,setCutterMaterial} from '../src/experiment.ts';
import {autoScale,automaticFillScale,gridFor,heatColor,safetyZoneColor,scalePosition,zonePaletteEntry} from '../src/plots.ts';
import {calculate,metricValue} from '../src/model.ts';
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

test('color schemes have distinct endpoints and persist with a safe default for older files',()=>{
 assert.equal(heatColor(0,'safety'),'rgb(0,0,0)');assert.equal(heatColor(1,'safety'),'rgb(205,45,36)');
 assert.notEqual(heatColor(.5,'safety'),heatColor(.5,'teal'));
 const e=fresh();assert.equal(e.view.colorScheme,'safety');e.view.colorScheme='teal';assert.equal(parseExperiment(JSON.stringify(e)).view.colorScheme,'teal');
 const older:any=structuredClone(e);delete older.view.colorScheme;assert.equal(parseExperiment(JSON.stringify(older)).view.colorScheme,'safety');
 const bad:any=structuredClone(e);bad.view.colorScheme='rainbow';assert.throws(()=>parseExperiment(JSON.stringify(bad)),/color scheme/);
});

test('safety Limit zone colors have semantic thresholds',()=>{
 const s=setupFor(fresh()),r=calculate(s.cut,s);
 assert.equal(safetyZoneColor({...r,zone:'comfortable',softRatio:.2},.75),'#000000');
 assert.equal(safetyZoneColor({...r,zone:'comfortable',softRatio:.6},.75),'#009148');
 assert.equal(safetyZoneColor({...r,zone:'caution',softRatio:.8},.75),'#f2cd36');
 assert.equal(safetyZoneColor({...r,zone:'beyond',softRatio:1.1},.75),'#cd2d24');
 assert.equal(safetyZoneColor({...r,zone:'unknown',softRatio:0},.75),'#283443');
 assert.equal(zonePaletteEntry({...r,zone:'beyond',softRatio:1.1},'teal',.75).color,'#eed184');
});

test('deflection and utilization colors stay anchored to configured limits while visible metrics rescale',()=>{
 const e=fresh(),s=setupFor(e),broad=[gridFor(s,'speed',e.view),gridFor(s,'engagement',e.view)];
 const narrowView={...e.view,feedMin:500,feedMax:900,docMin:20,docMax:80,wocMin:10,wocMax:60};
 const narrow=[gridFor(s,'speed',narrowView),gridFor(s,'engagement',narrowView)];
 const deflection=automaticFillScale(broad,'deflection',s),zoomedDeflection=automaticFillScale(narrow,'deflection',s);
 assert.deepEqual(deflection,{min:0,max:s.limits.deflection,basis:'configured-limit'});
 assert.deepEqual(zoomedDeflection,deflection);
 assert.deepEqual(automaticFillScale(narrow,'utilization',s),{min:0,max:1,basis:'configured-limit'});
 assert.notDeepEqual(automaticFillScale(broad,'mrr',s),automaticFillScale(narrow,'mrr',s));
 assert.equal(scalePosition(s.limits.deflection*.75,deflection,.75),.75);
 assert.equal(scalePosition(s.limits.deflection,deflection,.75),1);
});
