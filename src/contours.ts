import type {ContourDensity,Overlay} from './experiment';
import type {Result,Setup} from './model';
import type {Grid,XY} from './plots';
import {fmt,toDisplay,fromDisplay,unit} from './units.ts';
import type {Units} from './units';

export const contourValue=(r:Result,overlay:Overlay,s:Setup)=>overlay==='none'?NaN:overlay==='deflection'?r.deflection/s.limits.deflection:r[overlay];
const contourQuantity=(overlay:Overlay)=>overlay==='mrr'?'mrr':overlay==='chip'?'chip':'length';
const ratioOverlay=(overlay:Overlay)=>overlay==='utilization'||overlay==='deflection';
export const contourUnit=(overlay:Overlay,u:Units)=>ratioOverlay(overlay)?'%':unit(contourQuantity(overlay),u);
export const contourNumber=(v:number,overlay:Overlay,u:Units)=>ratioOverlay(overlay)?v*100:toDisplay(v,contourQuantity(overlay),u);
export function contourLabel(v:number,overlay:Overlay,u:Units,includeUnits=true){return `${fmt(contourNumber(v,overlay,u),ratioOverlay(overlay)?2:u==='imperial'?6:5)}${ratioOverlay(overlay)?'%':includeUnits?' '+contourUnit(overlay,u):''}`;}

export function niceCeiling(n:number){
 if(!Number.isFinite(n)||n<=0)return 1;
 const power=10**Math.floor(Math.log10(n)),fraction=n/power;
 return ([1,2,2.5,5,10].find(x=>x>=fraction-1e-10)??10)*power;
}
export interface ContourLevels {values:number[];step:number;adjusted:boolean;}
/** Both plots share an interval. MRR uses the smaller varying slice so neither plot loses its contours to the other range. */
export function contourLevels(grids:Grid[],overlay:Overlay,density:ContourDensity,s:Setup,u:Units):ContourLevels{
 if(overlay==='none')return {values:[],step:0,adjusted:false};
 const values=grids.flatMap(g=>g.samples.map(r=>contourValue(r,overlay,s))).filter(Number.isFinite);
 if(!values.length)return {values:[],step:0,adjusted:false};
 const lo=Math.max(0,Math.min(...values)),hi=Math.max(...values);
 const reference=toDisplay(s.limits.chipMax-s.limits.chipMin,'length',u);
 const spans=grids.map(g=>g.samples.map(r=>contourValue(r,overlay,s)).filter(Number.isFinite)).filter(a=>a.length).map(a=>Math.max(...a)-Math.min(...a)).filter(n=>n>1e-10);
 const mrrReference=spans.length?Math.min(...spans):Math.max(hi,1);
 const wanted=overlay==='mrr'?fromDisplay(niceCeiling(toDisplay(mrrReference,'mrr',u)/({coarse:4,standard:8,fine:16}[density])),'mrr',u):ratioOverlay(overlay)?({coarse:.5,standard:.25,fine:.1}[density]):fromDisplay(niceCeiling(reference/({coarse:2.5,standard:5,fine:10}[density])),'length',u);
 // Keep extreme imported domains bounded; report the actual widened interval.
 const needed=(hi-lo)/160;
 const step=needed>wanted?(ratioOverlay(overlay)?niceCeiling(needed):fromDisplay(niceCeiling(toDisplay(needed,contourQuantity(overlay),u)),contourQuantity(overlay),u)):wanted;
 const start=Math.max(1,Math.ceil(lo/step-1e-9)),end=Math.floor(hi/step+1e-9);
 return {values:Array.from({length:Math.max(0,Math.min(161,end-start+1))},(_,i)=>Number(((start+i)*step).toPrecision(12))),step,adjusted:step>wanted*1.00001};
}

export interface LabelBox {x:number;y:number;width:number;height:number;}
export interface ContourLine {value:number;text:string;segments:XY[][];path:string;}
export interface PlacedLabel extends LabelBox {text:string;value:number;angle:number;}
function pointAlong(points:XY[],distance:number):XY{
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(distance>length){distance-=length;continue;}
  const t=length?distance/length:0;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 }
 return points[points.length-1];
}
export function placeContourLabels(lines:ContourLine[],bounds:{left:number;top:number;width:number;height:number},avoid:LabelBox[]=[]):PlacedLabel[]{
 const placed:PlacedLabel[]=[];
 const budget=Math.max(4,Math.min(14,Math.floor(bounds.width*bounds.height/6500)));
 const overlaps=(a:LabelBox,b:LabelBox)=>Math.abs(a.x-b.x)<(a.width+b.width)/2+6&&Math.abs(a.y-b.y)<(a.height+b.height)/2+5;
 for(const line of lines){
  if(placed.length>=budget)break;
  const textWidth=line.text.length*7+4,textHeight=16;
  const runs=line.segments.map(points=>({points,length:points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0)})).sort((a,b)=>b.length-a.length);
  let found=false;
  for(const run of runs){
   if(run.length<textWidth+12)continue;
   for(const fraction of [.5,.3,.7,.15,.85,.4,.6]){
    const distance=run.length*fraction;
    if(distance<textWidth/2+4||run.length-distance<textWidth/2+4)continue;
    const point=pointAlong(run.points,distance);
    // Measure a local tangent in screen coordinates, smoothing cell-scale kinks.
    const span=Math.min(12,textWidth/2),a=pointAlong(run.points,distance-span),b=pointAlong(run.points,distance+span);
    let angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
    if(angle>90)angle-=180;if(angle< -90)angle+=180;
    const radians=angle*Math.PI/180,cos=Math.abs(Math.cos(radians)),sin=Math.abs(Math.sin(radians));
    const width=textWidth*cos+textHeight*sin,height=textWidth*sin+textHeight*cos;
    const box={x:point[0],y:point[1],width,height};
    if(box.x-width/2>=bounds.left+4&&box.x+width/2<=bounds.left+bounds.width-4&&box.y-height/2>=bounds.top+4&&box.y+height/2<=bounds.top+bounds.height-4&&!placed.some(p=>overlaps(p,box))&&!avoid.some(p=>overlaps(p,box))){placed.push({...box,text:line.text,value:line.value,angle});found=true;}
    if(found)break;
   }
   if(found)break;
  }
 }
 return placed;
}
