import {explain} from './help';
import {GEOMETRIES} from './model';
import type {Tool} from './model';
import {toolLayout,DRAWING} from './toolLayout';
import type {Segment} from './toolLayout';
import {fmt,toDisplay,unit} from './units';
import type {Units} from './units';

/**
 * Helical flute grooves as slanted bands across the fluted section, clipped to the cutter outline. About half the flutes are
 * visible on the near face, so the band pitch is 2·width/flutes; a 30° helix slants each band by 0.58 of its height. Upcut
 * grooves rise to the right, downcut grooves fall, straight flutes are vertical, an O-flute is one wide groove.
 */
function grooves(seg:Segment,flutes:number,kind:'up'|'down'|'straight'|'single',key:string,offset=0){
 if(seg.height<=0||seg.width<=0)return [];
 const pitch=kind==='single'?seg.width*1.6:Math.max(6,2*seg.width/Math.max(1,flutes)),grooveWidth=kind==='single'?seg.width*.55:pitch*.48;
 const shift=kind==='straight'?0:(kind==='down'?-1:1)*seg.height*.58;
 const yb=seg.y+seg.height,yt=seg.y,bands=[];
 // Bands start from the cutter's left edge (offset so a groove sits in view) and run far enough to cover the slant.
 const from=seg.x+offset+pitch*.3-Math.max(0,shift)-pitch*Math.ceil((Math.max(0,shift)+Math.abs(offset)+pitch)/pitch),to=seg.x+seg.width+Math.max(0,-shift)+Math.abs(offset)+grooveWidth;
 for(let x=from,i=0;x<=to;x+=pitch,i++){
  bands.push(<path key={`${key}-${i}`} className="groove" d={`M${x},${yb} H${x+grooveWidth} L${x+grooveWidth+shift},${yt} H${x+shift} Z`}/>);
  bands.push(<path key={`${key}-h${i}`} className="land-edge" d={`M${x+grooveWidth},${yb} L${x+grooveWidth+shift},${yt}`}/>);
 }
 return bands;
}
/** Side view of the tool in its collet, drawn to one scale, with the dimensions each field refers to. */
export default function ToolDrawing({tool,units:u}:{tool:Tool;units:Units}){
 const l=toolLayout(tool),g=tool.geometry,info=GEOMETRIES[g];
 const len=(x:number)=>`${fmt(toDisplay(x,'length',u),u==='imperial'?3:2)} ${unit('length',u)}`;
 const f=l.flutes,cx=l.axis,tip=l.tip;
 // The fluted outline: a rectangle, a rectangle with a rounded tip, or a cone.
 const body=g==='v'?`M${f.x},${f.y} H${f.x+f.width} L${cx},${tip} Z`:g==='ball'?`M${f.x},${f.y} H${f.x+f.width} V${tip-f.width/2} A${f.width/2},${f.width/2} 0 0 1 ${f.x},${tip-f.width/2} Z`:`M${f.x},${f.y} H${f.x+f.width} V${tip} H${f.x} Z`;
 // A compression bit reverses its helix at the upcut length; without one entered the drawing reverses halfway down the flutes.
 const upcutSeg=g==='compression'?l.upcut??{...f,y:tip-f.height/2,height:f.height/2}:undefined,downSeg=upcutSeg?{...f,height:f.height-upcutSeg.height}:f;
 const decoration=g==='compression'&&upcutSeg?[...grooves(downSeg,tool.flutes,'down','d'),...grooves(upcutSeg,tool.flutes,'up','u',-upcutSeg.height*.58),<line key="split" className="split" x1={f.x} y1={upcutSeg.y} x2={f.x+f.width} y2={upcutSeg.y}/>]
  :g==='downcut'?grooves(f,tool.flutes,'down','f'):g==='straight'?grooves(f,tool.flutes,'straight','f'):g==='o-flute'&&tool.flutes===1?grooves(f,1,'single','f'):g==='surfacing'?[]:grooves(f,tool.flutes,'up','f');
 const inserts=g==='surfacing'?[<rect key="i1" className="insert" x={f.x+2} y={tip-Math.min(f.height,10)-1} width={Math.max(4,f.width*.14)} height={Math.min(f.height,10)}/>,<rect key="i2" className="insert" x={f.x+f.width-2-Math.max(4,f.width*.14)} y={tip-Math.min(f.height,10)-1} width={Math.max(4,f.width*.14)} height={Math.min(f.height,10)}/>]:[];
 const ids={clip:`tool-clip-${g}-${Math.round(f.width)}-${Math.round(f.height)}`};
 const description=`${info.label}: ${len(tool.diameter)} cutting diameter on a ${len(tool.shankDiameter)} shank, ${len(tool.stickout)} stickout, ${len(tool.fluteLength)} flute length${tool.upcutLength?`, ${len(tool.upcutLength)} upcut section`:''}. Drawn to one scale from the entered values.`;
 return <figure className="tool-drawing" data-help={`A side view of the tool in its collet, drawn to scale from the fields: ${description}`}>
  <svg viewBox={`0 0 ${DRAWING.width} ${DRAWING.height}`} role="img" aria-label={description} {...explain(description)}>
   <g className="holder"><path d={`M${l.collet.x},${l.collet.y} H${l.collet.x+l.collet.width} V${l.collet.y+l.collet.height-8} L${l.collet.x+l.collet.width-10},${l.collet.y+l.collet.height} H${l.collet.x+10} L${l.collet.x},${l.collet.y+l.collet.height-8} Z`}/><rect x={l.collet.x+10} y={l.collet.y-10} width={l.collet.width-20} height={10}/></g>
   <defs>
    <clipPath id={ids.clip}><path d={body}/></clipPath>
    <linearGradient id={`${ids.clip}-shade`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#000" stopOpacity=".28"/><stop offset=".28" stopColor="#fff" stopOpacity=".22"/><stop offset=".55" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity=".38"/></linearGradient>
   </defs>
   <g className={`tool-body ${tool.body}`}>
    {l.shank.height>0&&<><rect className="shank" x={l.shank.x} y={l.shank.y} width={l.shank.width} height={l.shank.height}/><rect x={l.shank.x} y={l.shank.y} width={l.shank.width} height={l.shank.height} fill={`url(#${ids.clip}-shade)`}/></>}
    <path d={body} className="flutes"/>
    <g clipPath={`url(#${ids.clip})`}>{decoration}<rect x={f.x} y={f.y} width={f.width} height={tip-f.y} fill={`url(#${ids.clip}-shade)`}/></g>
    <path d={body} className="outline"/>
    {inserts}
    {l.shank.height>0&&f.width>l.shank.width&&<line className="shoulder" x1={f.x} y1={f.y} x2={f.x+f.width} y2={f.y}/>}
   </g>
   <g className="dimensions">{l.dimensions.map(d=>{
    const v=d.orientation==='vertical';
    return <g key={d.key} className={`dimension ${d.key}`}>
     <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}/>
     {v?<><line x1={d.x1-4} y1={d.y1} x2={d.x1+4} y2={d.y1}/><line x1={d.x2-4} y1={d.y2} x2={d.x2+4} y2={d.y2}/></>:<><line x1={d.x1} y1={d.y1-4} x2={d.x1} y2={d.y1+4}/><line x1={d.x2} y1={d.y2-4} x2={d.x2} y2={d.y2+4}/></>}
     <text x={d.labelX} y={d.labelY} textAnchor="middle" transform={v?`rotate(90 ${d.labelX} ${d.labelY})`:undefined}>{d.label} {len(d.value)}</text>
    </g>;})}</g>
  </svg>
  <figcaption>{info.label} · {tool.flutes} flute{tool.flutes===1?'':'s'} · {tool.body==='steel'?'steel body, carbide edges':tool.body==='hss'?'solid HSS':'solid carbide'}{info.modelled==='as-flat'?' · modelled at nominal diameter':''}</figcaption>
 </figure>;
}
