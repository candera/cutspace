import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,fitView,parseExperiment,setupFor} from '../src/experiment.ts';
import {calculate} from '../src/model.ts';
import {CHARTS,CHART_IDS,COORDINATES,axisRange,axisValue,broadRange,chartsOf,completeView,coordinateValue,cutOn,hasAxisRange,setAxisRange} from '../src/charts.ts';
import type {Coordinate} from '../src/charts.ts';
import {cutAt,gridFor,gridPosition,envelopeBounds,NX,NY} from '../src/plots.ts';
const tool={diameter:6,flutes:3};
const cut={rpm:10000,feed:1200,doc:3,woc:1.2};
const close=(a:number,b:number,rel=1e-9)=>Math.abs(a-b)<=rel*Math.max(1,Math.abs(a),Math.abs(b));
test('coordinates are the model quantities: MRR, chipload and surface speed agree with calculate',()=>{
 const s=setupFor(fresh()),r=calculate(s.cut,s);
 assert.ok(close(coordinateValue('mrr',s.cut,s.tool),r.mrr));
 assert.ok(close(coordinateValue('chip',s.cut,s.tool),r.chip));
 assert.ok(close(coordinateValue('surface',s.cut,s.tool),r.surface));
 assert.equal(coordinateValue('rpm',s.cut,s.tool),s.cut.rpm);assert.equal(coordinateValue('doc',s.cut,s.tool),s.cut.doc);
 assert.equal(axisValue('doc',s.cut,s.tool),s.cut.doc/s.tool.diameter*100);
});
test('every named chart determines a cut and round-trips the current cut through its own axes',()=>{
 for(const id of CHART_IDS){
  const chart=CHARTS[id];assert.equal(chart.inverse.length,4,id);
  const back=cutOn(chart,cut,tool,axisValue(chart.x,cut,tool),axisValue(chart.y,cut,tool));
  for(const k of ['rpm','feed','doc','woc'] as const)assert.ok(close(back[k],cut[k]),`${id} ${k}: ${back[k]} vs ${cut[k]}`);
 }
});
test('the two default charts keep raw inputs exact: held inputs pass through untouched',()=>{
 const speed=cutOn(CHARTS.speed,cut,tool,12345.678,987.654);
 assert.deepEqual(speed,{rpm:12345.678,feed:987.654,doc:3,woc:1.2});
 const engagement=cutOn(CHARTS.engagement,cut,tool,20,50);
 assert.equal(engagement.rpm,10000);assert.equal(engagement.feed,1200);assert.equal(engagement.woc,20/100*6);assert.equal(engagement.doc,50/100*6);
});
test('removal rate / depth holds RPM and chipload and lets stepover absorb the removal rate',()=>{
 const chart=CHARTS['mrr-doc'],c=cutOn(chart,cut,tool,10,25);
 assert.equal(c.rpm,10000);
 assert.ok(close(c.feed/(c.rpm*tool.flutes),1200/(10000*3)),'chipload held');
 assert.ok(close(c.doc,1.5));
 assert.ok(close(c.doc*c.woc*c.feed/1000,10),'MRR is the axis value');
 // Zero removal rate is a real no-cut boundary; zero depth with zero removal is undetermined and invalid.
 assert.equal(cutOn(chart,cut,tool,0,25).woc,0);
 assert.equal(calculate(cutOn(chart,cut,tool,0,25),setupFor(fresh())).status,'no-cut');
 assert.equal(calculate(cutOn(chart,cut,tool,0,0),setupFor(fresh())).status,'invalid');
});
test('removal rate / surface speed holds chipload and depth; surface speed / chipload holds the engagement',()=>{
 const s=setupFor(fresh());
 const a=cutOn(CHARTS['mrr-surface'],s.cut,s.tool,5,250);
 assert.ok(close(Math.PI*s.tool.diameter*a.rpm/1000,250));assert.ok(close(a.feed/(a.rpm*s.tool.flutes),s.cut.feed/(s.cut.rpm*s.tool.flutes)));assert.equal(a.doc,s.cut.doc);assert.ok(close(a.doc*a.woc*a.feed/1000,5));
 const b=cutOn(CHARTS['surface-chip'],s.cut,s.tool,250,.05);
 assert.ok(close(Math.PI*s.tool.diameter*b.rpm/1000,250));assert.ok(close(b.feed/(b.rpm*s.tool.flutes),.05));assert.equal(b.doc,s.cut.doc);assert.equal(b.woc,s.cut.woc);
});
test('grids sample every chart, and a grid position maps back onto the sampled cut',()=>{
 const e=fresh(),s=setupFor(e),view=completeView(e);
 for(const id of CHART_IDS){
  const g=gridFor(s,id,view);assert.equal(g.samples.length,NX*NY,id);assert.ok(g.xMax>g.xMin&&g.yMax>g.yMin,id);
  const c=cutAt(g,s.cut,.37,.61),[px,py]=gridPosition(g,c);
  assert.ok(close(px,g.xMin+.37*(g.xMax-g.xMin),1e-9),`${id} x`);assert.ok(close(py,g.yMax-.61*(g.yMax-g.yMin),1e-9),`${id} y`);
 }
});
test('the default experiment has a passing envelope on every chart',()=>{
 const e=fresh(),s=setupFor(e);e.view=fitView(e);
 for(const id of CHART_IDS)assert.ok(envelopeBounds(gridFor(s,id,e.view),s.cut),id);
});
test('broad ranges stay within each coordinate domain and reproduce the earlier fit for the raw inputs',()=>{
 const e=fresh();
 assert.deepEqual(broadRange(e,'rpm'),{min:Math.max(1,Math.min(e.config.machine.rpmMin*.5,e.point.rpm*.95)),max:Math.min(200000,Math.max(e.config.machine.rpmMax*1.1,e.point.rpm*1.05))});
 assert.deepEqual(broadRange(e,'feed'),{min:0,max:e.config.machine.feedMax*1.2});
 for(const c of Object.keys(COORDINATES) as Coordinate[]){const r=broadRange(e,c),info=COORDINATES[c];assert.ok(r.min>=info.lo&&r.max<=info.hi&&r.max>r.min,c);}
 const surface=broadRange(e,'surface'),rpm=broadRange(e,'rpm');
 assert.ok(close(surface.max/rpm.max,Math.PI*e.config.tool.diameter/1000));
 assert.ok(broadRange(e,'chip').max>=e.config.limits.chipMax*2.5);
 assert.ok(!hasAxisRange(e.view,'mrr'));assert.deepEqual(axisRange(e,'mrr'),broadRange(e,'mrr'));
 setAxisRange(e.view,'mrr',{min:1,max:9});assert.ok(hasAxisRange(e.view,'mrr'));assert.deepEqual(axisRange(e,'mrr'),{min:1,max:9});
 assert.deepEqual(chartsOf(e.view),['speed','engagement']);
});
test('files carry the chosen charts and derived axis ranges, reject unknown charts, and older files keep the default charts',()=>{
 const e=fresh();e.view.charts=['mrr-doc','engagement'];e.view=fitView(e);
 const back=parseExperiment(JSON.stringify(e));
 assert.deepEqual(back.view.charts,['mrr-doc','engagement']);assert.deepEqual(axisRange(back,'mrr'),axisRange(e,'mrr'));assert.deepEqual(axisRange(back,'chip'),axisRange(e,'chip'));
 const raw=JSON.parse(JSON.stringify(e));
 for(const bad of [(v:any)=>v.charts=['speed'],(v:any)=>v.charts=['speed','torque'],(v:any)=>{v.mrrMin=5;v.mrrMax=5;},(v:any)=>{delete v.mrrMax;v.mrrMin=1;},(v:any)=>v.chipMax=-1]){
  const copy=structuredClone(raw);bad(copy.view);assert.throws(()=>parseExperiment(JSON.stringify(copy)));
 }
 const old=structuredClone(raw);delete old.view.charts;for(const k of ['mrrMin','mrrMax','chipMin','chipMax','surfaceMin','surfaceMax'])delete old.view[k];
 const parsed=parseExperiment(JSON.stringify(old));assert.equal(parsed.view.charts,undefined);assert.deepEqual(chartsOf(parsed.view),['speed','engagement']);assert.ok(!hasAxisRange(parsed.view,'mrr'));
});
