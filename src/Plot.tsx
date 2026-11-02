import {useEffect,useMemo,useRef,useState,useId} from 'react';
import {ZoomIn,ZoomOut} from 'lucide-react';
import type {KeyboardEvent,PointerEvent} from 'react';
import {calculate,clamp,constraintInfo,metricValue,zoneInfo} from './model';
import type {Cut,Metric,Setup} from './model';
import {contourPath,contourSegments,segmentsPath,cutAt,gridPosition,fillColor,zonePaletteEntry,NX,NY} from './plots';
import {contourLabel,contourValue,placeContourLabels} from './contours';
import type {ContourLevels} from './contours';
import type {Grid,Scale} from './plots';
import type {ColorScheme,Overlay,Snapshot} from './experiment';
import {setupFor} from './experiment';
import {CHART_IDS,CHARTS,COORDINATES,axisText,axisTitle,axisValue,valueText} from './charts';
import type {ChartId,Coordinate} from './charts';
import {explain,help} from './help';
import {fmt,toDisplay,unit} from './units';
import type {Quantity,Units} from './units';
export const metricQuantity=(m:Metric):Quantity=>m==='mrr'?'mrr':m==='power'?'power':m==='chip'?'chip':m==='chipMax'?'length':m==='deflection'?'deflection':m==='utilization'||m==='margin'?'percent':'none';
export const metricDisplay=(v:number,m:Metric,u:Units)=>m==='utilization'||m==='margin'?v*100:toDisplay(v,metricQuantity(m),u);
export const metricUnit=(m:Metric,u:Units)=>unit(metricQuantity(m),u);
const isPercent=(c:Coordinate)=>COORDINATES[c].quantity==='percent';
const same=(a:number,b:number)=>Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a));
interface Props {grid:Grid;setup:Setup;fill:Metric;overlay:Overlay;colorScheme:ColorScheme;levels:ContourLevels;scale:Scale;units:Units;physical:boolean;pins:Snapshot[];onSelect:(c:Cut)=>void;onBegin:()=>void;onEnd:()=>void;onFit:()=>void;onReset:()=>void;onZoom:(factor:number)=>void;onChart:(id:ChartId)=>void;}
export default function Plot({grid:g,setup:s,fill,overlay,colorScheme,levels,scale,units,physical,pins,onSelect,onBegin,onEnd,onFit,onReset,onZoom,onChart}:Props){
 const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),drag=useRef<Cut|null>(null);
 const [width,setWidth]=useState(500),[hover,setHover]=useState<Cut|null>(null);
 const id=useId().replace(/:/g,'');
 useEffect(()=>{if(!host.current)return;const o=new ResizeObserver(entries=>setWidth(Math.round(entries[0].contentRect.width)));o.observe(host.current);return()=>o.disconnect();},[]);
 const chart=g.chart,{x:cx,y:cy}=chart,wide=width>=410;
 // Physical distances accompany a percent-of-diameter axis along the opposite edge.
 const secondaryX=physical&&wide&&isPercent(cx),secondaryY=physical&&wide&&isPercent(cy);
 const left=60,right=secondaryY?(units==='imperial'?78:64):20,top=secondaryX?43:20,bottom=48,height=248,w=Math.max(70,width-left-right),h=height-top-bottom;
 const mapX=(v:number)=>left+(v-g.xMin)/(g.xMax-g.xMin)*w,mapY=(v:number)=>top+(g.yMax-v)/(g.yMax-g.yMin)*h;
 const [px,py]=gridPosition(g,s.cut);
 const inView=px>=g.xMin&&px<=g.xMax&&py>=g.yMin&&py<=g.yMax;
 const boundary=useMemo(()=>contourPath(g.samples.map(r=>r.status!=='invalid'&&r.status!=='no-cut'&&r.hardOk&&!r.unknown.length?1:0),.5,w,h,left,top),[g,w,h,left,top]);
 const zoneLines=useMemo(()=>{
  const vals=g.samples.map(r=>r.status!=='invalid'&&r.status!=='no-cut'&&!r.unknown.length&&Number.isFinite(r.softRatio)?r.softRatio:NaN);
  if(!vals.some(Number.isFinite))return {caution:'',beyond:''};
  const filled=vals.map(v=>Number.isFinite(v)?v:1e6);
  return {caution:contourPath(filled,s.limits.caution??.75,w,h,left,top),beyond:contourPath(filled,1,w,h,left,top)};
 },[g,s.limits.caution,w,h,left,top]);
 const overlayData=useMemo(()=>{
  if(overlay==='none')return {lines:[],note:''};
  const vals=g.samples.map(r=>contourValue(r,overlay,s));
  const finite=vals.filter(Number.isFinite);
  if(!finite.length)return {lines:[],note:'Contour estimate unavailable'};
  const lo=Math.min(...finite),hi=Math.max(...finite);
  if(hi-lo<1e-10)return {lines:[],note:`Contours constant: ${contourLabel(lo,overlay,units)}`};
  const lines=levels.values.filter(v=>v>lo&&v<hi).map(value=>{
   const segments=contourSegments(vals.map(n=>Number.isFinite(n)?n:lo-1),value,w,h,left,top);
   return {value,text:contourLabel(value,overlay,units,false),segments,path:segmentsPath(segments)};
  }).filter(line=>line.path);
  return {lines,note:lines.length?'':'No contour levels in view · try Fine spacing'};
 },[g,overlay,levels,s.limits,units,w,h,left,top]);
 useEffect(()=>{
  const cv=canvas.current;if(!cv)return;const ctx=cv.getContext('2d');if(!ctx)return;
  const ratio=window.devicePixelRatio||1;cv.width=width*ratio;cv.height=height*ratio;ctx.scale(ratio,ratio);ctx.clearRect(0,0,width,height);
  for(let i=0;i<g.samples.length;i++){
   const r=g.samples[i],value=metricValue(r,fill),x=left+(i%NX)/NX*w,y=top+Math.floor(i/NX)/NY*h;
   const known=Number.isFinite(value)&&r.status!=='invalid';
   ctx.fillStyle=!known?'#283443':fill==='constraint'?constraintInfo[r.limiting.key].color:fill==='zone'?zonePaletteEntry(r,colorScheme,s.limits.caution).color:fillColor(value,fill,scale,colorScheme);
   ctx.globalAlpha=fill==='constraint'||fill==='zone'?.8:1;ctx.fillRect(x,y,w/NX+.5,h/NY+.5);
   // Soft-limit zones use texture in the colour of their boundary line: sparse 45° lines (red) beyond a soft limit, a sparse stipple (amber) in the caution band. Each mark sits on a dark halo so it reads over light and dark fills alike.
   const col=i%NX,row=Math.floor(i/NX),cw=w/NX,ch=h/NY;
   if(fill!=='zone'&&r.zone==='beyond'&&((col-row)%3+3)%3===0){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+cw,y+ch);ctx.globalAlpha=.45;ctx.strokeStyle='#0b1722';ctx.lineWidth=2.6;ctx.stroke();ctx.globalAlpha=.8;ctx.strokeStyle='#e8694f';ctx.lineWidth=1;ctx.stroke();}
   if(fill!=='zone'&&r.zone==='caution'&&col%3===1&&row%3===1){ctx.globalAlpha=.5;ctx.fillStyle='#0b1722';ctx.beginPath();ctx.arc(x+cw/2,y+ch/2,2.2,0,2*Math.PI);ctx.fill();ctx.globalAlpha=.9;ctx.fillStyle='#e8b85a';ctx.beginPath();ctx.arc(x+cw/2,y+ch/2,1.3,0,2*Math.PI);ctx.fill();}
   if(r.status==='invalid'||r.status==='no-cut'||!r.hardOk||r.unknown.length){ctx.globalAlpha=.52;ctx.fillStyle='#0b1722';ctx.fillRect(x,y,w/NX+.5,h/NY+.5);ctx.globalAlpha=.22;ctx.strokeStyle='#e1e7dc';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x,y+h/NY);ctx.lineTo(x+w/NX,y);ctx.stroke();}
  }ctx.globalAlpha=1;
 },[g,fill,colorScheme,scale,s.limits.caution,width,w,h,left,top]);
 const read=(e:PointerEvent<SVGRectElement>)=>{const b=e.currentTarget.getBoundingClientRect();return cutAt(g,s.cut,clamp((e.clientX-b.left)/b.width,0,1),clamp((e.clientY-b.top)/b.height,0,1));};
 function key(e:KeyboardEvent<SVGRectElement>){
  if(e.key==='Escape'&&drag.current){onSelect(drag.current);drag.current=null;onEnd();return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();onBegin();const step=e.shiftKey?.05:.01;
  onSelect(cutAt(g,s.cut,clamp((px-g.xMin)/(g.xMax-g.xMin)+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),0,1),clamp(1-(py-g.yMin)/(g.yMax-g.yMin)+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0),0,1)));onEnd();
 }
 // Saved points show only when their configuration matches and they sit on this slice: the held coordinates agree.
 const pinPoints=pins.map((p,i)=>{const q=setupFor(p);const sameConfig=(['tool','material','machine','limits'] as const).every(group=>Object.entries(p.config[group]).every(([key,value])=>value===(s[group] as unknown as Record<string,unknown>)[key]));const sameHeld=chart.held.every(c=>same(axisValue(c,q.cut,s.tool),axisValue(c,s.cut,s.tool)));return {i,q,show:sameConfig&&sameHeld};}).filter(p=>p.show);
 const labels=placeContourLabels(overlayData.lines,{left,top,width:w,height:h},[
  ...(inView?[{x:mapX(px),y:mapY(py),width:22,height:22}]:[]),
  ...pinPoints.map(({q})=>{const [qx,qy]=gridPosition(g,q.cut);return {x:mapX(qx),y:mapY(qy),width:24,height:24};}),
 ]);
 const probe=hover?calculate(hover,s):null;
 const length=(n:number)=>fmt(toDisplay(n,'length',units),units==='metric'?2:4);
 const xText=(n:number)=>axisText(cx,n,units,g.xMax-g.xMin),yText=(n:number)=>axisText(cy,n,units,g.yMax-g.yMin);
 const heldText=chart.held.map(c=>valueText(c,s.cut,s.tool,units)).join(' · ');
 const heldNames=chart.held.map(c=>COORDINATES[c].label.toLowerCase()).join(' and ');
 const plotHelp=`Explore ${COORDINATES[cx].label.toLowerCase()} horizontally and ${COORDINATES[cy].label.toLowerCase()} vertically while ${heldNames} stay fixed. ${chart.note} Click or drag to select a cut; arrow keys move 1% of the axis range, or 5% with Shift. The orange point is the current cut; A/B/C markers are matching saved snapshots. The dashed white line is the hard-limit boundary (RPM range, machine feed, tool reach). The amber dashed line is where a soft limit enters its caution band and the red line is where a soft limit is exceeded. Hatching marks hard-limit failures, invalid, no-cut or unknown regions.`;
 const xHelp=`${COORDINATES[cx].help} Increasing to the right.`,yHelp=`${COORDINATES[cy].help} Increasing upward.`;
 const pickerHelp=`Choose which two quantities this plot uses as axes. The other two named quantities are held at their current values, shown at the right. Removal rate, chipload and surface speed can be axes as well as RPM, feedrate, depth and stepover; every point on any chart is still one cut. ${chart.note}`;
 return <section data-help={plotHelp} className="plot-card" aria-label={`${chart.label} view`}>
  <header><select className="chart-picker" {...explain(pickerHelp)} aria-label="Plot axes" value={chart.id} onChange={ev=>onChart(ev.target.value as ChartId)}>{CHART_IDS.map(k=><option key={k} value={k}>{CHARTS[k].label}</option>)}</select><span data-help="These are the two quantities held fixed while exploring this plot. Changing them, on the other plot or in the setup, updates the slice shown here.">{heldText}</span><div className="plot-view-actions"><button {...explain("Zoom in on this plot by a quarter, centred on the selected cut when it is in view. The cut itself does not change; axis bounds stay within the supported range.")} aria-label="Zoom in" onClick={()=>onZoom(.8)}><ZoomIn size={13}/></button><button {...explain("Zoom out on this plot by a quarter, centred on the selected cut when it is in view. The cut itself does not change; axis bounds stay within the supported range.")} aria-label="Zoom out" onClick={()=>onZoom(1.25)}><ZoomOut size={13}/></button><button {...explain("Zoom this plot to its sampled passing envelope, keeping the selected cut visible even if it fails a check. Cutting inputs do not change. Auto range refits the visible colors; an explicitly fixed scale stays fixed.")} onClick={onFit}>Fit envelope</button><button {...explain("Restore the broader machine/tool view for this plot without changing the cut.")} onClick={onReset}>Reset view</button></div></header>
  <div className="plot-host" ref={host} style={{height}}>
   <canvas ref={canvas} style={{width,height}} aria-hidden="true"/>
   <svg {...explain(plotHelp)} width={width} height={height} role="img" aria-label={`${COORDINATES[cx].label} horizontal and ${COORDINATES[cy].label.toLowerCase()} vertical`}>
    <defs><clipPath id={id}><rect x={left+.6} y={top+.6} width={w-1.2} height={h-1.2}/></clipPath></defs>
    {(width<430?[0,.5,1]:[0,.25,.5,.75,1]).map(t=><g key={t} className="grid-lines"><line x1={left+t*w} x2={left+t*w} y1={top} y2={top+h}/><line x1={left} x2={left+w} y1={top+t*h} y2={top+t*h}/><text data-help={xHelp} x={left+t*w} y={top+h+19} textAnchor={t===0?'start':t===1?'end':'middle'}>{xText(g.xMin+t*(g.xMax-g.xMin))}</text><text data-help={yHelp} x={left-8} y={top+(1-t)*h+4} textAnchor="end">{yText(g.yMin+t*(g.yMax-g.yMin))}</text>{secondaryX&&<text data-help="Physical distance corresponding to the percentage axis below. Changing cutter diameter changes these distances while preserving the percentages." x={left+t*w} y={top-9} textAnchor={t===0?'start':t===1?'end':'middle'}>{length((g.xMin+t*(g.xMax-g.xMin))/100*s.tool.diameter)}</text>}{secondaryY&&<text data-help="Physical distance corresponding to the percentage axis at left. Changing cutter diameter changes these distances while preserving the percentages." x={left+w+8} y={top+(1-t)*h+4}>{length((g.yMin+t*(g.yMax-g.yMin))/100*s.tool.diameter)}</text>}</g>)}
    <text data-help={xHelp} className="axis-title" x={left+w/2} y={height-8} textAnchor="middle">{axisTitle(cx,units)}</text>
    <text data-help={yHelp} className="axis-title" transform={`translate(15 ${top+h/2}) rotate(-90)`} textAnchor="middle">{axisTitle(cy,units)}</text>
    {secondaryX&&<text data-help={help.absolute+` This top axis shows physical ${COORDINATES[cx].short}.`} className="axis-title" x={left+w/2} y={13} textAnchor="middle">{COORDINATES[cx].short} ({unit('length',units)})</text>}
    {secondaryY&&<text data-help={help.absolute+` This right axis shows physical ${COORDINATES[cy].short}.`} className="axis-title" transform={`translate(${width-7} ${top+h/2}) rotate(-90)`} textAnchor="middle">{COORDINATES[cy].short} ({unit('length',units)})</text>}
    <g clipPath={`url(#${id})`}>
     {/* Lines carry a dark halo beneath their colour so they stay legible over the light end of the fill map. */}
     {overlayData.lines.map(line=><path key={`halo-${line.value}`} d={line.path} fill="none" stroke="#0b1722" strokeWidth={((overlay==='utilization'||overlay==='deflection')&&Math.abs(line.value-1)<1e-8?1.8:1.1)+1.6} opacity={.4}/>)}
     {overlayData.lines.map(line=><path key={line.value} d={line.path} className="contour-line" fill="none" stroke="#ebbb75" strokeWidth={(overlay==='utilization'||overlay==='deflection')&&Math.abs(line.value-1)<1e-8?1.8:1.1} opacity={.85}/>)}
     <path d={zoneLines.caution} stroke="#0b1722" fill="none" strokeWidth={3} strokeDasharray="4 3" opacity={.45}/>
     <path d={zoneLines.caution} stroke="#e8b85a" fill="none" strokeWidth={1.4} strokeDasharray="4 3" opacity={.95}/>
     <path d={zoneLines.beyond} stroke="#0b1722" fill="none" strokeWidth={3.4} opacity={.45}/>
     <path d={zoneLines.beyond} stroke="#e8694f" fill="none" strokeWidth={1.7} opacity={.95}/>
     <path d={boundary} stroke="#eff7ed" fill="none" strokeWidth={1.6} strokeDasharray="6 4"/>
     <g className="contour-labels" pointerEvents="none">{labels.map(label=><text key={label.value} transform={`translate(${label.x} ${label.y}) rotate(${label.angle})`} textAnchor="middle" dominantBaseline="central">{label.text}</text>)}</g>
     {pinPoints.map(({i,q})=>{const [qx,qy]=gridPosition(g,q.cut);return <g key={i} transform={`translate(${mapX(qx)} ${mapY(qy)})`}><rect x={-7} y={-7} width={14} height={14} fill="#182a36" stroke="#e8efdc"/><text y={4} textAnchor="middle" fill="#e8efdc" fontSize={10}>{'ABC'[i]}</text></g>;})}
     {inView&&<><line x1={mapX(px)} x2={mapX(px)} y1={top} y2={top+h} stroke="#fff" opacity={.3} strokeDasharray="3 4"/><line x1={left} x2={left+w} y1={mapY(py)} y2={mapY(py)} stroke="#fff" opacity={.3} strokeDasharray="3 4"/><circle cx={mapX(px)} cy={mapY(py)} r={5} fill="#f4b575" stroke="#fff1dd" strokeWidth={2}/></>}
    </g>
    <rect {...explain(plotHelp)} className="plot-hit" role="group" aria-label={`${COORDINATES[cx].label} and ${COORDINATES[cy].label.toLowerCase()} selection`} tabIndex={0} x={left} y={top} width={w} height={h} fill="transparent" onKeyDown={key}
     onPointerDown={e=>{e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={...s.cut};onBegin();onSelect(read(e));}}
     onPointerMove={e=>{const c=read(e);setHover(c);if(drag.current)onSelect(c);}}
     onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);drag.current=null;onEnd();}}
     onPointerCancel={()=>{if(drag.current)onSelect(drag.current);drag.current=null;onEnd();}}
     onPointerLeave={()=>setHover(null)}/>
   </svg>
  </div>
  {overlayData.note&&<div className="contour-note" role="status" data-help="This describes the selected contour metric in this plot slice. Constant values have no separate contour curves; unavailable estimates cannot be contoured.">{overlayData.note}</div>}
  <footer data-help="The probe reports the position under the pointer without changing the selected cut. Click or drag to select it. Saved markers appear only when their configuration and held quantities match this plot slice. Constant contours mean that metric does not change across this slice.">{probe&&hover?<span>Probe · {valueText(cx,hover,s.tool,units)} / {valueText(cy,hover,s.tool,units)} · {fill==='constraint'?constraintInfo[probe.limiting.key].label:fill==='zone'?zonePaletteEntry(probe,colorScheme,s.limits.caution).label:`${fmt(metricDisplay(metricValue(probe,fill),fill,units),fill==='chip'||fill==='chipMax'?5:2)} ${metricUnit(fill,units)}`}{fill!=='zone'&&probe.zone!=='unknown'&&` · ${zoneInfo[probe.zone].label}`}{overlay!=='none'&&` · Contour ${contourLabel(contourValue(probe,overlay,s),overlay,units)}`}</span>:<span>{!inView?'Selection outside view · use Reset view':'Drag to explore · arrow keys to adjust'}</span>}<span>{pinPoints.length?`${pinPoints.length} saved here`:'Linked'}</span></footer>
 </section>;
}
