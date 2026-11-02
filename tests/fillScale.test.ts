import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fresh,parseExperiment,setupFor,setWorkpieceMaterial,setCutterMaterial} from '../src/experiment.ts';
import {autoScale,automaticFillScale,gridFor,heatColor,fillColor,divergingPosition,legendGradient,scalePosition,zonePalette,zonePaletteEntry} from '../src/plots.ts';
import {BATLOW,VIK} from '../src/colorMaps.ts';
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

const rgb=(hex:string)=>`rgb(${[1,3,5].map(k=>parseInt(hex.slice(k,k+2),16)).join(',')})`;
/** Relative luminance, enough to check that lightness only increases along a sequential map. */
const luminance=(css:string)=>{const [r,g,b]=css.match(/\d+/g)!.map(Number).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};

test('color schemes run dark to light, persist, and the retired black–green–red scheme migrates to batlow',()=>{
 assert.equal(heatColor(0,'batlow'),rgb(BATLOW[0]));assert.equal(heatColor(1,'batlow'),rgb(BATLOW[BATLOW.length-1]));
 assert.equal(heatColor(0,'teal'),'rgb(21,43,57)');assert.notEqual(heatColor(.5,'batlow'),heatColor(.5,'teal'));
 for(const scheme of ['batlow','teal'] as const){let last=-1;for(let i=0;i<=40;i++){const l=luminance(heatColor(i/40,scheme));assert.ok(l>last,`${scheme} lightness must increase at ${i/40}`);last=l;}}
 const e=fresh();assert.equal(e.view.colorScheme,'batlow');e.view.colorScheme='teal';assert.equal(parseExperiment(JSON.stringify(e)).view.colorScheme,'teal');
 const older:any=structuredClone(e);delete older.view.colorScheme;assert.equal(parseExperiment(JSON.stringify(older)).view.colorScheme,'batlow');
 const retired:any=structuredClone(e);retired.view.colorScheme='safety';assert.equal(parseExperiment(JSON.stringify(retired)).view.colorScheme,'batlow');
 const bad:any=structuredClone(e);bad.view.colorScheme='rainbow';assert.throws(()=>parseExperiment(JSON.stringify(bad)),/color scheme/);
});

test('Limit zone classes are ordered samples of the chosen sequential map',()=>{
 const s=setupFor(fresh()),r=calculate(s.cut,s),zones=zonePalette('batlow');
 assert.deepEqual(zones.map(z=>z.label),['Very safe','Safe','Borderline','No good']);
 assert.deepEqual(zones.map(z=>z.color),[.125,.375,.625,.875].map(t=>heatColor(t,'batlow')));
 for(let i=1;i<4;i++)assert.ok(luminance(zones[i].color)>luminance(zones[i-1].color));
 assert.equal(zonePaletteEntry({...r,zone:'comfortable',softRatio:.2},'batlow',.75).label,'Very safe');
 assert.equal(zonePaletteEntry({...r,zone:'comfortable',softRatio:.6},'batlow',.75).label,'Safe');
 assert.equal(zonePaletteEntry({...r,zone:'caution',softRatio:.8},'batlow',.75).label,'Borderline');
 assert.equal(zonePaletteEntry({...r,zone:'beyond',softRatio:1.1},'batlow',.75).color,zones[3].color);
 assert.equal(zonePaletteEntry({...r,zone:'unknown',softRatio:0},'batlow',.75).color,'#283443');
 assert.equal(zonePaletteEntry({...r,zone:'beyond',softRatio:1.1},'teal',.75).color,heatColor(.875,'teal'));
});

test('remaining margin uses the diverging map with zero at the neutral centre and the legend follows the fill',()=>{
 const scale={min:-.5,max:1,basis:'visible-range'} as const;
 assert.equal(divergingPosition(0,scale),.5);assert.equal(divergingPosition(-.5,scale),0);assert.equal(divergingPosition(1,scale),1);assert.equal(divergingPosition(.5,scale),.75);
 assert.equal(fillColor(-.5,'margin',scale,'batlow'),rgb(VIK[VIK.length-1]));assert.equal(fillColor(1,'margin',scale,'batlow'),rgb(VIK[0]));
 assert.equal(fillColor(0,'margin',scale,'batlow'),fillColor(0,'margin',{min:-2,max:.1,basis:'visible-range'},'batlow'));
 assert.equal(divergingPosition(.25,{min:.1,max:.5,basis:'visible-range'}),.75);
 assert.equal(fillColor(.3,'mrr',{min:0,max:1,basis:'visible-range'},'teal'),heatColor(.3,'teal'));
 const gradient=legendGradient('mrr',{min:0,max:1,basis:'visible-range'},'batlow',4);
 assert.equal(gradient,`linear-gradient(90deg,${[0,.25,.5,.75,1].map(t=>heatColor(t,'batlow')).join(',')})`);
 assert.ok(legendGradient('margin',scale,'batlow').startsWith(`linear-gradient(90deg,${rgb(VIK[VIK.length-1])}`));
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
 assert.equal(scalePosition(s.limits.deflection*.75,deflection),.75);
 assert.equal(scalePosition(s.limits.deflection,deflection),1);
});
