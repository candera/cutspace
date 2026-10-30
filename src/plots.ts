import {contours} from 'd3-contour';
import {calculate,metricValue,clamp} from './model.ts';
import type {Setup,Metric,Result,Cut} from './model.ts';
import type {View} from './experiment.ts';
export const NX=72,NY=48;
export interface Grid {kind:'speed'|'engagement';samples:Result[];xMin:number;xMax:number;yMin:number;yMax:number;diameter:number;}
export interface Scale {min:number;max:number;basis:'visible-range'|'categories'|'fixed'|'unavailable'}
export function gridFor(s:Setup,kind:Grid['kind'],view:View):Grid{
 const speed=kind==='speed';
 const grid:Grid={kind,samples:[],xMin:speed?view.rpmMin:(view.wocMin??0),xMax:speed?view.rpmMax:view.wocMax,yMin:speed?(view.feedMin??0):(view.docMin??0),yMax:speed?view.feedMax:view.docMax,diameter:s.tool.diameter};
 for(let j=0;j<NY;j++)for(let i=0;i<NX;i++)grid.samples.push(calculate(cutAt(grid,s.cut,(i+.5)/NX,(j+.5)/NY),s));
 return grid;
}
/** No rounding/clamping: zero is a real no-cut boundary. UI validation owns admissible edits. */
export function cutAt(g:Grid,c:Cut,x:number,y:number):Cut{
 const a=g.xMin+x*(g.xMax-g.xMin),b=g.yMax-y*(g.yMax-g.yMin);
 return g.kind==='speed'?{...c,rpm:a,feed:b}:{...c,woc:a/100*g.diameter,doc:b/100*g.diameter};
}
/** Shared visible-data range, independent of feasibility. Invalid cells are drawn gray. */
export function autoScale(grids:Grid[],metric:Metric):Scale{
 if(metric==='constraint'||metric==='zone')return {min:0,max:1,basis:'categories'};
 const values=grids.flatMap(g=>g.samples).filter(r=>r.status!=='invalid').map(r=>metricValue(r,metric)).filter(Number.isFinite);
 if(!values.length)return {min:0,max:1,basis:'unavailable'};
 let min=Math.min(...values),max=Math.max(...values);
 // Constant/zero fields need a nonzero denominator, without inventing variation.
 if(max===min){const pad=Math.max(Math.abs(min)*.01,1e-6);min=metric==='margin'?min-pad:Math.max(0,min-pad);max+=pad;}
 return {min,max,basis:'visible-range'};
}
export function heatColor(value:number){
 const stops=[[21,43,57],[32,88,101],[60,144,137],[162,198,149],[238,209,132]];
 const v=clamp(value,0,1)*4,i=Math.min(3,Math.floor(v)),f=v-i;
 return `rgb(${stops[i].map((a,k)=>Math.round(a+(stops[i+1][k]-a)*f)).join(',')})`;
}
export type XY=[number,number];
/** Real contour runs, with synthetic frame edges removed. Shared by paths and labels. */
export function contourSegments(values:number[],threshold:number,w:number,h:number,left=0,top=0):XY[][]{
 const shape=contours().size([NX,NY]).thresholds([threshold])(values)[0];
 if(!shape)return [];
 const segments:XY[][]=[];
 const at=(p:number[]):XY=>[left+p[0]/NX*w,top+p[1]/NY*h];
 for(const poly of shape.coordinates)for(const ring of poly){let run:XY[]=[];
  const flush=()=>{if(run.length>1)segments.push(run);run=[];};
  for(let i=1;i<ring.length;i++){
   const a=ring[i-1],b=ring[i];
   const onEdge=(p:number[])=>p[0]===0||p[0]===NX||p[1]===0||p[1]===NY;
   const corner=onEdge(a)&&onEdge(b)&&Math.abs(a[0]-b[0])<=1&&Math.abs(a[1]-b[1])<=1;
   const border=corner||(a[0]===0&&b[0]===0)||(a[0]===NX&&b[0]===NX)||(a[1]===0&&b[1]===0)||(a[1]===NY&&b[1]===NY);
   if(border){flush();continue;}
   if(!run.length)run.push(at(a));run.push(at(b));
  }flush();
 }return segments;
}
export function segmentsPath(segments:XY[][]){return segments.map(run=>run.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('')).join('');}
export function contourPath(values:number[],threshold:number,w:number,h:number,left=0,top=0){return segmentsPath(contourSegments(values,threshold,w,h,left,top));}

/** Fit sampled passing cells plus the selected point, with cell-sized padding. No input changes. */
export function envelopeBounds(g:Grid,c:Cut){
 const passing=g.samples.flatMap((r,i)=>r.feasible?[i]:[]);
 if(!passing.length)return null;
 const dx=(g.xMax-g.xMin)/NX,dy=(g.yMax-g.yMin)/NY;
 const xs=passing.map(i=>g.xMin+(i%NX+.5)*dx),ys=passing.map(i=>g.yMax-(Math.floor(i/NX)+.5)*dy);
 const px=g.kind==='speed'?c.rpm:c.woc/g.diameter*100,py=g.kind==='speed'?c.feed:c.doc/g.diameter*100;
 const x0=Math.min(...xs,px),x1=Math.max(...xs,px),y0=Math.min(...ys,py),y1=Math.max(...ys,py);
 const padX=Math.max(dx,(x1-x0)*.06),padY=Math.max(dy,(y1-y0)*.06);
 return {xMin:Math.max(g.xMin,x0-padX),xMax:Math.min(g.xMax,x1+padX),yMin:Math.max(g.yMin,y0-padY),yMax:Math.min(g.yMax,y1+padY)};
}

/** Zoom a plot axis about a focus value: factor < 1 zooms in, > 1 zooms out. The span is clamped to [minSpan, hi-lo] and the window is shifted back inside [lo, hi]. */
export function zoomRange(min:number,max:number,factor:number,focus:number,lo:number,hi:number,minSpan:number){
 const span=Math.min(hi-lo,Math.max(minSpan,(max-min)*factor));
 const t=clamp((focus-min)/(max-min),0,1);
 let next=clamp(focus,min,max)-t*span;
 next=Math.max(lo,Math.min(next,hi-span));
 return {min:next,max:next+span};
}
