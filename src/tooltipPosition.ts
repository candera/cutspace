export interface Rect {left:number;top:number;right:number;bottom:number;width:number;height:number}
/** All values are viewport CSS pixels, including on a zoomed/scrolled page. */
export function tooltipPosition(anchor:Rect,width:number,height:number,viewport:{left:number;top:number;width:number;height:number}){
 const gap=10,edge=8,leftEdge=viewport.left+edge,topEdge=viewport.top+edge;
 const right=viewport.left+viewport.width-edge,bottom=viewport.top+viewport.height-edge;
 const left=Math.max(leftEdge,Math.min(anchor.left, right-width));
 const below=anchor.bottom+gap,above=anchor.top-height-gap;
 return {left,top:Math.max(topEdge,Math.min(below+height<=bottom?below:above,bottom-height))};
}
