/**
 * Plot charts: which two quantities a plot uses as axes and which two it holds fixed.
 *
 * Every coordinate here is a monomial in the four cut inputs (RPM, feedrate, DOC, WOC): MRR is feed·DOC·WOC/1000, chipload
 * is feed/(RPM·flutes), surface speed is π·D·RPM/1000. Four such coordinates with a nonsingular exponent matrix pin down a
 * unique cut, so any grid point on any chart maps back to a cut and the plot machinery (fill, contours, limit boundaries,
 * probe, pins) keeps working on `calculate` alone. Deflection and maximum chip thickness are not monotone in WOC and are
 * deliberately not coordinates.
 */
import type {Cut} from './model.ts';
import {fmt,toDisplay,unit} from './units.ts';
import type {Quantity,Units} from './units.ts';
import type {Experiment,View} from './experiment.ts';

export type Coordinate='rpm'|'feed'|'doc'|'woc'|'mrr'|'chip'|'surface';
type ToolSize={diameter:number;flutes:number};
export interface CoordinateInfo {
 label:string;short:string;
 /** Display quantity; `percent` means percent of cutter diameter, derived from a physical length. */
 quantity:Quantity|'percent';
 /** Exponents over (rpm, feed, doc, woc) in canonical units, and the tool-dependent factor in front. */
 exponents:[number,number,number,number];factor:(t:ToolSize)=>number;
 /** Supported axis range and the smallest zoom span, in axis units (percent of diameter for DOC and WOC). */
 lo:number;hi:number;minSpan:number;
 help:string;
}
export const COORDINATES:Record<Coordinate,CoordinateInfo>={
 rpm:{label:'Spindle speed',short:'RPM',quantity:'none',exponents:[1,0,0,0],factor:()=>1,lo:1,hi:200000,minSpan:100,help:'Spindle revolutions per minute (RPM). Machine RPM bounds are checked separately.'},
 feed:{label:'Feedrate',short:'Feed',quantity:'feed',exponents:[0,1,0,0],factor:()=>1,lo:0,hi:200000,minSpan:10,help:'Tool advance per minute in the selected measurement system.'},
 doc:{label:'Depth of cut',short:'DOC',quantity:'percent',exponents:[0,0,1,0],factor:()=>1,lo:0,hi:10000,minSpan:1,help:'Depth of cut (DOC, depth per pass) as a percentage of cutter diameter. 100%D equals one cutter diameter; flute length and stickout limit reach.'},
 woc:{label:'Stepover',short:'WOC',quantity:'percent',exponents:[0,0,0,1],factor:()=>1,lo:0,hi:200,minSpan:1,help:'Stepover, also called radial width of cut (WOC), as a percentage of cutter diameter. 100%D is a full-width slot.'},
 mrr:{label:'Removal rate',short:'MRR',quantity:'mrr',exponents:[0,1,1,1],factor:()=>1/1000,lo:0,hi:1e7,minSpan:1e-3,help:'Material removal rate (MRR): feedrate times depth times width of cut. As an axis it is an input; the held quantities and the other axis decide how the cut achieves it.'},
 chip:{label:'Chipload',short:'Chipload',quantity:'chip',exponents:[-1,1,0,0],factor:t=>1/t.flutes,lo:0,hi:100,minSpan:1e-5,help:'Nominal feed per tooth: feedrate divided by RPM and flute count, before radial chip thinning.'},
 surface:{label:'Surface speed',short:'Surface speed',quantity:'surface',exponents:[1,0,0,0],factor:t=>Math.PI*t.diameter/1000,lo:0,hi:1e6,minSpan:1,help:'Cutting-edge speed around the tool circumference: π × diameter × RPM. It is RPM rescaled by the cutter diameter.'},
};
export type ChartId='speed'|'engagement'|'mrr-doc'|'mrr-surface'|'mrr-chip'|'surface-chip';
export interface Chart {id:ChartId;label:string;x:Coordinate;y:Coordinate;held:[Coordinate,Coordinate];note:string;inverse:number[][]}
function invert4(m:number[][]):number[][]|null{
 const a=m.map((row,i)=>[...row,...[0,1,2,3].map(j=>i===j?1:0)]);
 for(let col=0;col<4;col++){
  let pivot=col;for(let r=col+1;r<4;r++)if(Math.abs(a[r][col])>Math.abs(a[pivot][col]))pivot=r;
  if(Math.abs(a[pivot][col])<1e-12)return null;
  [a[col],a[pivot]]=[a[pivot],a[col]];
  const p=a[col][col];for(let k=0;k<8;k++)a[col][k]/=p;
  for(let r=0;r<4;r++){if(r===col)continue;const f=a[r][col];if(f===0)continue;for(let k=0;k<8;k++)a[r][k]-=f*a[col][k];}
 }
 // Exponent matrices are small integers, so inverse entries are simple rationals; snap float noise to exact zeros and integers.
 return a.map(row=>row.slice(4).map(v=>{const n=Math.round(v);return Math.abs(v-n)<1e-9?n:v;}));
}
function chart(id:ChartId,label:string,x:Coordinate,y:Coordinate,held:[Coordinate,Coordinate],note:string):Chart{
 const inverse=invert4([x,y,...held].map(c=>COORDINATES[c].exponents));
 if(!inverse)throw Error(`Chart ${id} does not determine a cut.`);
 return {id,label,x,y,held,note,inverse};
}
/** Named charts. Free choice of four coordinates would allow many degenerate or uninteresting combinations; these cover the real questions. */
export const CHARTS:Record<ChartId,Chart>={
 speed:chart('speed','Speed / feed','rpm','feed',['doc','woc'],'RPM and feedrate at the selected engagement.'),
 engagement:chart('engagement','Engagement','woc','doc',['rpm','feed'],'Stepover and depth at the selected RPM and feedrate.'),
 'mrr-doc':chart('mrr-doc','Removal rate / depth','mrr','doc',['rpm','chip'],'At a fixed RPM and chipload, trade depth against stepover for a given removal rate: deep and narrow or shallow and wide.'),
 'mrr-surface':chart('mrr-surface','Removal rate / surface speed','mrr','surface',['chip','doc'],'Surface speed and chipload as the book values, with stepover absorbing the removal rate at the selected depth.'),
 'mrr-chip':chart('mrr-chip','Removal rate / chipload','mrr','chip',['doc','woc'],'The speed/feed slice re-plotted so chipload limits are horizontal and removal rate reads off the axis.'),
 'surface-chip':chart('surface-chip','Surface speed / chipload','surface','chip',['doc','woc'],'The speed/feed slice in book units: RPM follows surface speed and feedrate follows chipload.'),
};
export const CHART_IDS=Object.keys(CHARTS) as ChartId[];
export const DEFAULT_CHARTS:[ChartId,ChartId]=['speed','engagement'];
export const isChartId=(x:unknown):x is ChartId=>typeof x==='string'&&Object.hasOwn(CHARTS,x);

/** Physical value of a coordinate at a cut (DOC and WOC in mm). Raw inputs come back exactly. */
export function coordinateValue(c:Coordinate,cut:Cut,t:ToolSize){
 const info=COORDINATES[c],inputs=[cut.rpm,cut.feed,cut.doc,cut.woc];
 let v=info.factor(t);for(let j=0;j<4;j++)if(info.exponents[j]!==0)v*=Math.pow(inputs[j],info.exponents[j]);
 return v;
}
/** Axis value of a coordinate at a cut: percent of diameter for DOC and WOC, otherwise the physical value. */
export function axisValue(c:Coordinate,cut:Cut,t:ToolSize){const v=coordinateValue(c,cut,t);return COORDINATES[c].quantity==='percent'?v/t.diameter*100:v;}
/** Physical value for an axis value. The percent conversion matches the former engagement plot exactly. */
export function fromAxis(c:Coordinate,axis:number,t:ToolSize){return COORDINATES[c].quantity==='percent'?axis/100*t.diameter:axis;}
/**
 * The cut at axis values (x, y) on a chart, holding the chart's held coordinates at their values in `current`. Each input is a
 * product of powers of the four coordinate values; a zero coordinate gives a zero or infinite input, and 0·∞ gives NaN, which
 * `calculate` reports as invalid. No rounding or clamping: zero is a real no-cut boundary.
 */
export function cutOn(chart:Chart,current:Cut,t:ToolSize,x:number,y:number):Cut{
 const coords=[chart.x,chart.y,...chart.held];
 const values=[fromAxis(chart.x,x,t),fromAxis(chart.y,y,t),coordinateValue(chart.held[0],current,t),coordinateValue(chart.held[1],current,t)].map((v,i)=>v/COORDINATES[coords[i]].factor(t));
 const input=(j:number)=>{let p=1;for(let i=0;i<4;i++){const e=chart.inverse[j][i];if(e!==0)p*=Math.pow(values[i],e);}return p;};
 return {rpm:input(0),feed:input(1),doc:input(2),woc:input(3)};
}

/** Axis ranges live in the view under per-coordinate field names; the four cut inputs keep their original names. */
const RANGE_FIELDS:Record<Coordinate,[keyof View,keyof View]>={rpm:['rpmMin','rpmMax'],feed:['feedMin','feedMax'],doc:['docMin','docMax'],woc:['wocMin','wocMax'],mrr:['mrrMin','mrrMax'],chip:['chipMin','chipMax'],surface:['surfaceMin','surfaceMax']};
export interface Range {min:number;max:number}
/** The broad range for a coordinate: the machine and tool bounds around the selected cut, within the supported axis domain. */
export function broadRange(e:Experiment,c:Coordinate):Range{
 const {machine:m,tool:t,limits:l}=e.config,p=e.point,info=COORDINATES[c];
 const cut:Cut={rpm:p.rpm,feed:p.feed,doc:p.docRatio*t.diameter,woc:p.wocRatio*t.diameter},at=axisValue(c,cut,t);
 const rpm={min:Math.max(1,Math.min(m.rpmMin*.5,p.rpm*.95)),max:Math.min(200000,Math.max(m.rpmMax*1.1,p.rpm*1.05))};
 const cap=(r:Range):Range=>({min:Math.max(info.lo,r.min),max:Math.min(info.hi,Math.max(r.max,r.min+info.minSpan))});
 switch(c){
  case 'rpm':return cap(rpm);
  case 'feed':return cap({min:0,max:Math.max(m.feedMax*1.2,p.feed*1.05)});
  case 'woc':return cap({min:0,max:Math.max(100,p.wocRatio*105)});
  case 'doc':return cap({min:0,max:Math.max(100,t.fluteLength/t.diameter*110,p.docRatio*105)});
  // A one-diameter slot at the machine's top feed is the natural ceiling for removal rate.
  case 'mrr':return cap({min:0,max:Math.max(m.feedMax*1.2*t.diameter*t.diameter/1000,at*1.05)});
  case 'chip':{const limit=Number.isFinite(l.chipMax)&&l.chipMax>0?l.chipMax*2.5:0;return cap({min:0,max:Math.max(limit,at*1.05,Number.isFinite(at)&&at>0?at*4:.1)});}
  case 'surface':{const k=Math.PI*t.diameter/1000;return cap({min:k*rpm.min,max:k*rpm.max});}
 }
}
/** The view's range for a coordinate; a file written before derived axes existed falls back to the broad range. */
export function axisRange(e:Experiment,c:Coordinate):Range{
 const [lo,hi]=RANGE_FIELDS[c],min=e.view[lo] as number|undefined,max=e.view[hi] as number|undefined;
 if(typeof max==='number'&&Number.isFinite(max))return {min:typeof min==='number'&&Number.isFinite(min)?min:0,max};
 return broadRange(e,c);
}
export function setAxisRange(view:View,c:Coordinate,r:Range){const [lo,hi]=RANGE_FIELDS[c];(view as unknown as Record<string,number>)[lo]=r.min;(view as unknown as Record<string,number>)[hi]=r.max;}
export const chartsOf=(view:View):[ChartId,ChartId]=>view.charts??DEFAULT_CHARTS;
/** The view with every axis range present, so any chart can be sampled from it. */
export function completeView(e:Experiment):View{const view={...e.view};for(const c of Object.keys(COORDINATES) as Coordinate[])setAxisRange(view,c,axisRange(e,c));return view;}
/** Whether the view carries a saved range for a coordinate (as opposed to the broad fallback). */
export function hasAxisRange(view:View,c:Coordinate){const max=view[RANGE_FIELDS[c][1]];return typeof max==='number'&&Number.isFinite(max);}

/** Axis tick text in display units. Decimals follow the visible span so small chiploads and large RPM ranges both read cleanly. */
export function axisText(c:Coordinate,n:number,u:Units,span:number){
 const q=COORDINATES[c].quantity;
 if(c==='rpm'||q==='percent')return fmt(n,0);
 if(c==='feed')return fmt(toDisplay(n,'feed',u),u==='metric'?0:1);
 const shown=toDisplay(n,q,u),shownSpan=toDisplay(Math.max(span,1e-12),q,u);
 return fmt(shown,Math.min(6,Math.max(0,2-Math.floor(Math.log10(shownSpan)))));
}
export function axisTitle(c:Coordinate,u:Units){
 switch(c){
  case 'rpm':return 'Spindle speed (RPM)';
  case 'feed':return `Feedrate (${unit('feed',u)})`;
  case 'woc':return 'Stepover / WOC (%D)';
  case 'doc':return 'Depth of cut / DOC (%D)';
  case 'mrr':return `Removal rate / MRR (${unit('mrr',u)})`;
  case 'chip':return `Chipload (${unit('chip',u)})`;
  case 'surface':return `Surface speed (${unit('surface',u)})`;
 }
}
/** A coordinate's value at a cut as it appears in the plot header and probe, with its unit. */
export function valueText(c:Coordinate,cut:Cut,t:ToolSize,u:Units){
 const v=axisValue(c,cut,t),q=COORDINATES[c].quantity;
 if(q==='percent')return `${COORDINATES[c].short} ${fmt(v)}%D`;
 if(c==='rpm')return `${fmt(v,0)} RPM`;
 if(c==='feed')return `${fmt(toDisplay(v,'feed',u),1)} ${unit('feed',u)}`;
 const shown=toDisplay(v,q,u);
 return `${COORDINATES[c].short} ${fmt(shown,c==='chip'?(u==='metric'?4:5):shown>=100?0:2)} ${unit(q,u)}`;
}
