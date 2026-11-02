import type {Tool} from './model.ts';

/**
 * Proportional side-view layout of a tool in a holder, in SVG user units, for the tool drawing. Lengths and diameters share
 * one scale so the picture is honest: a 1/2 in bit on a 1/4 in shank looks top-heavy and a long 1/8 in cutter looks slender.
 * Pure so the proportions can be tested without the DOM.
 */
export const DRAWING={width:300,height:286,top:34,colletHeight:26,colletWidth:92,left:120,maxLength:170,maxWidth:112,minStroke:2} as const;
export interface Segment {x:number;y:number;width:number;height:number}
export interface Dimension {key:'stickout'|'fluteLength'|'upcutLength'|'diameter'|'shankDiameter';label:string;value:number;orientation:'vertical'|'horizontal';x1:number;y1:number;x2:number;y2:number;labelX:number;labelY:number}
export interface ToolLayout {scale:number;axis:number;collet:Segment;shank:Segment;flutes:Segment;tip:number;upcut?:Segment;dimensions:Dimension[]}

export function toolLayout(t:Tool):ToolLayout{
 const L=Math.max(t.stickout,.1),a=Math.min(t.fluteLength,L),D=Math.max(t.diameter,.1),Ds=Math.max(t.shankDiameter,.1);
 const scale=Math.min(DRAWING.maxLength/L,DRAWING.maxWidth/Math.max(D,Ds));
 const axis=DRAWING.left,top=DRAWING.top+DRAWING.colletHeight;
 const w=(d:number)=>Math.max(DRAWING.minStroke,d*scale);
 const collet={x:axis-DRAWING.colletWidth/2,y:DRAWING.top,width:DRAWING.colletWidth,height:DRAWING.colletHeight};
 const shank={x:axis-w(Ds)/2,y:top,width:w(Ds),height:(L-a)*scale};
 const flutes={x:axis-w(D)/2,y:top+(L-a)*scale,width:w(D),height:a*scale};
 const tip=top+L*scale;
 const upcut=t.geometry==='compression'&&t.upcutLength?{x:flutes.x,y:tip-Math.min(t.upcutLength,a)*scale,width:flutes.width,height:Math.min(t.upcutLength,a)*scale}:undefined;
 const right=axis+Math.max(w(D),w(Ds))/2;
 const dimensions:Dimension[]=[
  {key:'stickout',label:'Stickout',value:t.stickout,orientation:'vertical',x1:right+14,y1:top,x2:right+14,y2:tip,labelX:right+20,labelY:(top+tip)/2},
  {key:'fluteLength',label:'Flute length',value:t.fluteLength,orientation:'vertical',x1:right+44,y1:flutes.y,x2:right+44,y2:tip,labelX:right+50,labelY:(flutes.y+tip)/2},
  {key:'diameter',label:'Diameter',value:t.diameter,orientation:'horizontal',x1:flutes.x,y1:tip+16,x2:flutes.x+flutes.width,y2:tip+16,labelX:axis,labelY:tip+30},
  {key:'shankDiameter',label:'Shank diameter',value:t.shankDiameter,orientation:'horizontal',x1:shank.x,y1:top-8,x2:shank.x+shank.width,y2:top-8,labelX:axis,labelY:DRAWING.top-16},
 ];
 if(upcut)dimensions.push({key:'upcutLength',label:'Upcut length',value:t.upcutLength!,orientation:'vertical',x1:right+74,y1:upcut.y,x2:right+74,y2:tip,labelX:right+80,labelY:(upcut.y+tip)/2});
 return {scale,axis,collet,shank,flutes,tip,...(upcut?{upcut}:{}),dimensions};
}
