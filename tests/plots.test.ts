import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,setupFor} from '../src/experiment.ts';
import {cutAt,gridFor,NX,NY,autoScale,contourPath} from '../src/plots.ts';
test('engagement axes are WOC horizontal and DOC vertical in percentage diameter',()=>{
 const e=fresh(),s=setupFor(e),g=gridFor(s,'engagement',e.view);
 const c=cutAt(g,s.cut,.2,1-50/275);
 assert.ok(Math.abs(c.woc-1.2)<1e-12);assert.ok(Math.abs(c.doc-3)<1e-12);
 assert.equal(c.rpm,10000);assert.equal(c.feed,1200);
 assert.equal(g.samples.length,NX*NY);
});
test('speed slice preserves engagement; sampling retains precision',()=>{
 const e=fresh(),s=setupFor(e),g=gridFor(s,'speed',e.view),c=cutAt(g,s.cut,.1234567,.3333333);
 assert.equal(c.doc,s.cut.doc);assert.equal(c.woc,s.cut.woc);
 assert.notEqual(c.rpm,Math.round(c.rpm));assert.notEqual(c.feed,Math.round(c.feed));
});
test('origin is a real zero-engagement state; DOC extends beyond 100 percent',()=>{
 const e=fresh(),s=setupFor(e),g=gridFor(s,'engagement',e.view);
 assert.equal(cutAt(g,s.cut,0,1).woc,0);assert.equal(cutAt(g,s.cut,0,1).doc,0);
 assert.equal(cutAt(g,s.cut,1,0).doc,16.5);
});
test('shared automatic scale covers all visible valid samples independently of passing limits',()=>{
 const e=fresh(),s=setupFor(e);const grids=[gridFor(s,'speed',e.view),gridFor(s,'engagement',e.view)];
 const scale=autoScale(grids,'mrr'),values=grids.flatMap(g=>g.samples).map(r=>r.mrr);
 assert.equal(scale.basis,'visible-range');assert.equal(scale.min,Math.min(...values));assert.equal(scale.max,Math.max(...values));
 s.limits.deflection=1e-12;
 assert.deepEqual(autoScale([gridFor(s,'speed',e.view),gridFor(s,'engagement',e.view)],'mrr'),scale);
 s.material.known=false;assert.equal(autoScale([gridFor(s,'speed',e.view)],'power').basis,'unavailable');
});
test('contours omit synthetic frame edges and have finite coordinates',()=>{
 assert.equal(contourPath(Array(NX*NY).fill(1),.5,400,200),'');
 const values=Array.from({length:NX*NY},(_,i)=>i%NX>NX/2?1:0);
 const path=contourPath(values,.5,400,200);assert.ok(path.startsWith('M'));assert.ok(!/NaN|Infinity/.test(path));
});
