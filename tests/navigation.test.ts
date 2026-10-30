import test from 'node:test';
import assert from 'node:assert/strict';
import {tooltipPosition} from '../src/tooltipPosition.ts';
import {fresh,fitView,setupFor,parseExperiment} from '../src/experiment.ts';
import {gridFor,envelopeBounds,cutAt,NX,NY} from '../src/plots.ts';
const rect=(left:number,top:number,width:number,height:number)=>({left,top,width,height,right:left+width,bottom:top+height});
test('help anchors to viewport coordinates and flips above near the bottom',()=>{
 const vp={left:0,top:0,width:1000,height:700};
 assert.deepEqual(tooltipPosition(rect(100,100,100,30),340,120,vp),{left:100,top:140});
 assert.deepEqual(tooltipPosition(rect(900,650,80,30),340,120,vp),{left:652,top:520});
});
test('help clamps inside a phone visual viewport, including zoom offsets',()=>{
 const vp={left:40,top:80,width:300,height:500};
 const p=tooltipPosition(rect(290,520,40,30),280,200,vp);
 assert.ok(p.left>=48&&p.left+280<=332);assert.ok(p.top>=88&&p.top+200<=572);
});
test('fitting each envelope includes all passing samples and leaves the selected cut untouched',()=>{
 const e=fresh(),before=JSON.stringify(e),s=setupFor(e);
 for(const kind of ['speed','engagement'] as const){const g=gridFor(s,kind,fitView(e)),b=envelopeBounds(g,s.cut);assert.ok(b);
  g.samples.forEach((r,i)=>{if(!r.feasible)return;const x=g.xMin+(i%NX+.5)/NX*(g.xMax-g.xMin),y=g.yMax-(Math.floor(i/NX)+.5)/NY*(g.yMax-g.yMin);assert.ok(x>=b.xMin&&x<=b.xMax&&y>=b.yMin&&y<=b.yMax);});
  assert.ok(b.yMax-b.yMin<g.yMax-g.yMin);
 }
 assert.equal(JSON.stringify(e),before);
});
test('envelope fitting retains an outside selected point',()=>{
 const e=fresh();e.point.feed=10000;const s=setupFor(e),g=gridFor(s,'speed',fitView(e)),b=envelopeBounds(g,s.cut);assert.ok(b);assert.ok(b.yMax>=10000);assert.ok(b.xMin<=s.cut.rpm&&b.xMax>=s.cut.rpm);
});
test('unknown capacity has no passing envelope to fit',()=>{
 const e=fresh();e.config.machine.known=false;const s=setupFor(e);assert.equal(envelopeBounds(gridFor(s,'speed',e.view),s.cut),null);
});
test('nonzero plot minima map to the right cuts and survive file round trips',()=>{
 const e=fresh();Object.assign(e.view,{rpmMin:4000,feedMin:500,wocMin:10,docMin:20});const s=setupFor(e);
 const speed=gridFor(s,'speed',e.view),engagement=gridFor(s,'engagement',e.view);
 assert.equal(cutAt(speed,s.cut,0,1).feed,500);assert.equal(cutAt(speed,s.cut,0,1).rpm,4000);
 assert.ok(Math.abs(cutAt(engagement,s.cut,0,1).woc-.6)<1e-12);assert.ok(Math.abs(cutAt(engagement,s.cut,0,1).doc-1.2)<1e-12);
 assert.deepEqual(parseExperiment(JSON.stringify(e)).view,e.view);
 assert.equal(fitView(e).docMin,0);assert.equal(fitView(e).feedMin,0);
 e.view.feedMin=e.view.feedMax;assert.throws(()=>parseExperiment(JSON.stringify(e)));
});
