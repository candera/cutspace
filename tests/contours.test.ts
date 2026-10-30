import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,setupFor,parseExperiment} from '../src/experiment.ts';
import {gridFor,contourSegments,segmentsPath,NX,NY} from '../src/plots.ts';
import {contourLevels,contourLabel,placeContourLabels} from '../src/contours.ts';
import type {ContourLine} from '../src/contours.ts';

test('presets change contour spacing while both plots retain common numerical levels',()=>{
 const e=fresh(),s=setupFor(e),grids=[gridFor(s,'speed',e.view),gridFor(s,'engagement',e.view)];
 const coarse=contourLevels(grids,'utilization','coarse',s,'metric');
 const standard=contourLevels(grids,'utilization','standard',s,'metric');
 const fine=contourLevels(grids,'utilization','fine',s,'metric');
 assert.equal(coarse.step,.5);assert.equal(standard.step,.25);assert.equal(fine.step,.1);
 assert.ok(coarse.values.length<standard.values.length&&standard.values.length<fine.values.length);
 assert.ok(standard.values.includes(1));assert.ok(fine.values.includes(1));
 assert.deepEqual(contourLevels(grids,'utilization','standard',s,'imperial'),standard);
});
test('chip contours use readable unit-aware intervals and correct quantity labels',()=>{
 const e=fresh(),s=setupFor(e),g=[gridFor(s,'speed',e.view)];
 assert.equal(contourLevels(g,'chipMax','standard',s,'metric').step,.01);
 assert.ok(Math.abs(contourLevels(g,'chipMax','standard',s,'imperial').step-.0127)<1e-10);
 assert.equal(contourLabel(.0127,'chipMax','imperial'),'0.0005 in');
 assert.equal(contourLabel(.0127,'chip','imperial'),'0.0005 in/tooth');
 assert.equal(contourLabel(.75,'deflection','metric'),'75%');
 assert.equal(contourLabel(.0127,'chipMax','imperial',false),'0.0005');
 assert.equal(contourLabel(.01,'chip','metric',false),'0.01');
 assert.equal(contourLabel(.75,'deflection','metric',false),'75%');
});
test('unavailable estimates produce no levels and extreme ranges have bounded work',()=>{
 const e=fresh(),s=setupFor(e);s.machine.known=false;
 const unknown=[gridFor(s,'speed',e.view)];
 assert.deepEqual(contourLevels(unknown,'utilization','fine',s,'metric'),{values:[],step:0,adjusted:false});
 s.machine.known=true;s.machine.power=.1;s.cut.doc=100;
 const levels=contourLevels([gridFor(s,'speed',e.view)],'utilization','fine',s,'metric');
 assert.ok(levels.adjusted);assert.ok(levels.values.length<=161);assert.ok(levels.values.every(Number.isFinite));
});
test('labels remain on their contours, inside bounds, and avoid markers and each other',()=>{
 const lines:ContourLine[]=Array.from({length:20},(_,i)=>({value:i,text:`${i*25}%`,path:'',segments:[[[0,10+i*9],[400,10+i*9]]]}));
 const labels=placeContourLabels(lines,{left:0,top:0,width:400,height:200},[{x:200,y:100,width:22,height:22}]);
 assert.ok(labels.length>3);assert.ok(labels.length<lines.length);
 for(const a of labels){
  assert.ok(a.x-a.width/2>=4&&a.x+a.width/2<=396&&a.y-a.height/2>=4&&a.y+a.height/2<=196);
  assert.equal(a.y,10+a.value*9);
  assert.ok(Math.abs(a.x-200)>=(a.width+22)/2+6||Math.abs(a.y-100)>=(a.height+22)/2+5);
  for(const b of labels)if(a!==b)assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2+6||Math.abs(a.y-b.y)>=(a.height+b.height)/2+5);
 }
});
test('labels never get synthetic border segments or fragments too short to label',()=>{
 assert.deepEqual(contourSegments(Array(NX*NY).fill(1),.5,400,200),[]);
 const values=Array.from({length:NX*NY},(_,i)=>i%NX>NX/2?1:0);
 const segments=contourSegments(values,.5,400,200);
 assert.ok(segmentsPath(segments).startsWith('M'));
 const labels=placeContourLabels([{value:1,text:'100%',path:'',segments:[[[10,10],[15,15]]]}],{left:0,top:0,width:400,height:200});
 assert.deepEqual(labels,[]);
});
test('labels follow screen-space contour tangents, remain upright, and fit rotated bounds',()=>{
 for(const segments of [[[[20,20],[180,180]]],[[[180,180],[20,20]]],[[[100,20],[100,180]]]] as [number,number][][][]){
  const labels=placeContourLabels([{value:1,text:'100%',path:'',segments}],{left:0,top:0,width:200,height:200});
  assert.equal(labels.length,1);
  const label=labels[0];
  assert.ok(label.angle>=-90&&label.angle<=90);
  assert.ok(Math.abs(label.angle-(segments[0][0][0]===100?90:45))<1e-8);
  assert.ok(label.x-label.width/2>=4&&label.x+label.width/2<=196);
  assert.ok(label.y-label.height/2>=4&&label.y+label.height/2<=196);
  assert.ok(label.height>16);
 }
});
test('contour spacing persists and older version 2 experiments still import',()=>{
 const e=fresh();e.view.contourDensity='fine';assert.equal(parseExperiment(JSON.stringify(e)).view.contourDensity,'fine');
 delete e.view.contourDensity;assert.equal(parseExperiment(JSON.stringify(e)).view.contourDensity,undefined);
 for(const bad of ['custom',0,null,['fine']]){
  const value=JSON.parse(JSON.stringify(e));value.view.contourDensity=bad;
  assert.throws(()=>parseExperiment(JSON.stringify(value)));
 }
});

test('MRR contours use cubic display units and persist with the experiment',()=>{
 const e=fresh();e.view.overlay='mrr';assert.equal(parseExperiment(JSON.stringify(e)).view.overlay,'mrr');
 assert.equal(contourLabel(16.387064,'mrr','imperial'),'1 in³/min');
 assert.equal(contourLabel(16.387064,'mrr','imperial',false),'1');
 assert.equal(contourLabel(12.5,'mrr','metric'),'12.5 cm³/min');
 assert.equal(contourLabel(12.5,'mrr','metric',false),'12.5');
});

test('MRR produces labeled horizontal speed contours and curved engagement contours in both unit systems',()=>{
 const e=fresh(),s=setupFor(e),grids=[gridFor(s,'speed',e.view),gridFor(s,'engagement',e.view)];
 for(const units of ['metric','imperial'] as const){
  const coarse=contourLevels(grids,'mrr','coarse',s,units),standard=contourLevels(grids,'mrr','standard',s,units),fine=contourLevels(grids,'mrr','fine',s,units);
  assert.ok(coarse.step>standard.step&&standard.step>fine.step);
  for(const g of grids){
   const vals=g.samples.map(r=>r.mrr),lo=Math.min(...vals),hi=Math.max(...vals);
   const lines=standard.values.filter(v=>v>lo&&v<hi).map(value=>({value,text:contourLabel(value,'mrr',units,false),segments:contourSegments(vals,value,400,200),path:''}));
   assert.ok(lines.length>=3,`${units} ${g.kind} needs multiple levels`);
   assert.ok(placeContourLabels(lines,{left:0,top:0,width:400,height:200}).length>=2);
   // Marching-squares endpoints at the outer frame can shift by part of a cell.
   const points=lines[0].segments.flat().filter(p=>p[0]>400/NX&&p[0]<400-400/NX);assert.ok(points.length>2);
   const ySpan=Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]));
   if(g.kind==='speed')assert.ok(ySpan<1e-8,'MRR is independent of RPM at fixed feed and engagement');
   else assert.ok(ySpan>10,'DOC/WOC contours should curve across the engagement slice');
  }
 }
});

test('MRR contours remain available without the estimated force model and handle zero removal',()=>{
 const e=fresh(),s=setupFor(e);s.material.known=false;s.machine.known=false;
 let grids=[gridFor(s,'speed',e.view),gridFor(s,'engagement',e.view)];
 const levels=contourLevels(grids,'mrr','standard',s,'metric');assert.ok(levels.values.length>0);assert.ok(levels.values.every(Number.isFinite));
 s.cut.feed=0;s.cut.doc=0;grids=[gridFor(s,'speed',e.view),gridFor(s,'engagement',e.view)];
 assert.ok(grids.every(g=>g.samples.every(r=>r.mrr===0)));
 assert.deepEqual(contourLevels(grids,'mrr','standard',s,'imperial').values,[]);
});
