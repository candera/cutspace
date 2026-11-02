import {contours} from 'd3-contour';
import {calculate,metricValue,clamp} from './model.ts';
import type {Setup,Metric,Result,Cut} from './model.ts';
import {sequentialMaps,divergingMap} from './colorMaps.ts';
import type {ColorScheme,View} from './experiment.ts';
import {CHARTS,axisValue,cutOn} from './charts.ts';
import type {Chart,ChartId} from './charts.ts';
export const NX=72,NY=48;
/** A sampled plot: `kind` names the chart; axis bounds are in axis units (percent of diameter for DOC and WOC). */
export interface Grid {kind:ChartId;chart:Chart;samples:Result[];xMin:number;xMax:number;yMin:number;yMax:number;diameter:number;flutes:number;}
export interface Scale {min:number;max:number;basis:'visible-range'|'configured-limit'|'categories'|'fixed'|'unavailable'}
/** Axis bounds for a coordinate from the view's fields; a derived coordinate without a saved range gets the fallback the caller computed. */
function bounds(view:View,c:Chart['x']):[number,number]{
 switch(c){
  case 'rpm':return [view.rpmMin,view.rpmMax];
  case 'feed':return [view.feedMin??0,view.feedMax];
  case 'woc':return [view.wocMin??0,view.wocMax];
  case 'doc':return [view.docMin??0,view.docMax];
  case 'mrr':return [view.mrrMin??0,view.mrrMax??NaN];
  case 'chip':return [view.chipMin??0,view.chipMax??NaN];
  case 'surface':return [view.surfaceMin??0,view.surfaceMax??NaN];
 }
}
/** Sample a chart over the view's ranges for its axes. A view lacking a derived axis range must be completed with `fitView` or `axisRange` first. */
export function gridFor(s:Setup,kind:ChartId,view:View):Grid{
 const chart=CHARTS[kind],[xMin,xMax]=bounds(view,chart.x),[yMin,yMax]=bounds(view,chart.y);
 const grid:Grid={kind,chart,samples:[],xMin,xMax,yMin,yMax,diameter:s.tool.diameter,flutes:s.tool.flutes};
 for(let j=0;j<NY;j++)for(let i=0;i<NX;i++)grid.samples.push(calculate(cutAt(grid,s.cut,(i+.5)/NX,(j+.5)/NY),s));
 return grid;
}
/** The cut at a grid fraction (x right, y down), holding the chart's held coordinates at their values in `c`. No rounding/clamping: zero is a real no-cut boundary. UI validation owns admissible edits. */
export function cutAt(g:Grid,c:Cut,x:number,y:number):Cut{
 const a=g.xMin+x*(g.xMax-g.xMin),b=g.yMax-y*(g.yMax-g.yMin);
 return cutOn(g.chart,c,g,a,b);
}
/** The axis position of a cut on a grid's chart. */
export function gridPosition(g:Grid,c:Cut):[number,number]{return [axisValue(g.chart.x,c,g),axisValue(g.chart.y,c,g)];}
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
/** Metrics with one meaningful upper allowance keep an absolute color range while the plot is zoomed. */
export function automaticFillScale(grids:Grid[],metric:Metric,s:Setup):Scale{
 const visible=autoScale(grids,metric);
 if(visible.basis==='unavailable'||visible.basis==='categories')return visible;
 if(metric==='deflection')return {min:0,max:s.limits.deflection,basis:'configured-limit'};
 if(metric==='utilization')return {min:0,max:1,basis:'configured-limit'};
 return visible;
}
/** Linear position of a value on the scale. The map is never re-spaced to pin a threshold to a colour: the caution and limit lines mark thresholds, so the fill stays perceptually uniform. */
export function scalePosition(value:number,scale:Scale){return (value-scale.min)/(scale.max-scale.min);}
/** Interpolate a colour table (evenly spaced hex stops) at a 0–1 position, clamped at the ends. */
function sampleMap(table:readonly string[],t:number){
 const v=clamp(t,0,1)*(table.length-1),i=Math.min(table.length-2,Math.floor(v)),f=v-i;
 const hex=(c:string)=>[1,3,5].map(k=>parseInt(c.slice(k,k+2),16));
 const a=hex(table[i]),b=hex(table[i+1]);
 return `rgb(${a.map((c,k)=>Math.round(c+(b[k]-c)*f)).join(',')})`;
}
/** Colour of a 0–1 position on the chosen sequential map. */
export function heatColor(value:number,scheme:ColorScheme='batlow'){return sampleMap(sequentialMaps[scheme],value);}
/** Remaining margin is signed, so it uses a diverging map with zero at the neutral centre and each sign scaled to its own extreme (a multi-sequential mapping). Negative margin, past a limit, takes the red side; positive margin the blue side. A scale without a sign change uses only that half. */
export function divergingPosition(value:number,scale:Scale){
 const lo=Math.min(scale.min,0),hi=Math.max(scale.max,0);
 return value<0?(lo<0?.5-.5*value/lo:.5):hi>0?.5+.5*value/hi:.5;
}
/** The fill colour of a numeric metric value on the shared scale. */
export function fillColor(value:number,metric:Metric,scale:Scale,scheme:ColorScheme){
 if(metric==='margin')return sampleMap(divergingMap,1-divergingPosition(value,scale));
 return heatColor(scalePosition(value,scale),scheme);
}
/** CSS gradient for the legend, sampled through the same mapping as the plot fill so the colour bar cannot drift from it. */
export function legendGradient(metric:Metric,scale:Scale,scheme:ColorScheme,steps=24){
 const stops=Array.from({length:steps+1},(_,i)=>fillColor(scale.min+(scale.max-scale.min)*i/steps,metric,scale,scheme));
 return `linear-gradient(90deg,${stops.join(',')})`;
}
const ZONE_LABELS=['Very safe','Safe','Borderline','No good'] as const;
/** Limit zone is four ordered classes, so they are four evenly spaced samples of the sequential map: order survives greyscale and colour-vision deficiency. */
export function zonePalette(scheme:ColorScheme){return ZONE_LABELS.map((label,i)=>({label,color:heatColor((i+.5)/4,scheme)}));}
/** Semantic category for Limit zone. Hard failures and unavailable checks remain hatched/unknown. */
export function zonePaletteEntry(r:Result,scheme:ColorScheme,caution=.75){
 if(r.zone==='unknown')return {label:'Outside / unknown',color:'#283443'} as const;
 const index=r.softRatio<=caution*.5?0:r.softRatio<=caution?1:r.softRatio<=1?2:3;
 return zonePalette(scheme)[index];
}
export type XY=[number,number];
/** Real contour runs, with synthetic frame and missing-data closure edges removed. Shared by paths and labels. */
export function contourSegments(values:number[],threshold:number,w:number,h:number,left=0,top=0):XY[][]{
 const shape=contours().size([NX,NY]).thresholds([threshold])(values)[0];
 if(!shape)return [];
 const segments:XY[][]=[];
 const at=(p:number[]):XY=>[left+p[0]/NX*w,top+p[1]/NY*h];
 const finite=(x:number,y:number)=>x>=0&&x<NX&&y>=0&&y<NY&&Number.isFinite(values[y*NX+x]);
 const missingEdge=(a:number[],b:number[])=>{
  const midX=(a[0]+b[0])/2,midY=(a[1]+b[1])/2;
  if(Math.abs(a[0]-b[0])<1e-9){const x=Math.floor(midX),y=Math.floor(midY);return finite(x,y)!==finite(x+1,y);}
  if(Math.abs(a[1]-b[1])<1e-9){const x=Math.floor(midX),y=Math.floor(midY);return finite(x,y)!==finite(x,y+1);}
  return false;
 };
 for(const poly of shape.coordinates)for(const ring of poly){let run:XY[]=[];
  const flush=()=>{if(run.length>1)segments.push(run);run=[];};
  for(let i=1;i<ring.length;i++){
   const a=ring[i-1],b=ring[i];
   const onEdge=(p:number[])=>p[0]===0||p[0]===NX||p[1]===0||p[1]===NY;
   const corner=onEdge(a)&&onEdge(b)&&Math.abs(a[0]-b[0])<=1&&Math.abs(a[1]-b[1])<=1;
   const border=corner||(a[0]===0&&b[0]===0)||(a[0]===NX&&b[0]===NX)||(a[1]===0&&b[1]===0)||(a[1]===NY&&b[1]===NY);
   if(border||missingEdge(a,b)){flush();continue;}
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
 const [px,py]=gridPosition(g,c);
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
