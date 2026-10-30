export type Units='metric'|'imperial';
export type Quantity='length'|'feed'|'surface'|'chip'|'mrr'|'power'|'torque'|'deflection'|'percent'|'none';
export const quantityUnits:Record<Quantity,[string,string]>={length:['mm','in'],feed:['mm/min','in/min'],surface:['m/min','SFM'],chip:['mm/tooth','in/tooth'],mrr:['cm³/min','in³/min'],power:['W','hp'],torque:['N·m','lbf·in'],deflection:['µm','in'],percent:['%','%'],none:['','']};
const factor:Record<Quantity,number>={length:1/25.4,feed:1/25.4,surface:1/.3048,chip:1/25.4,mrr:1/16.387064,power:1/745.6998715822702,torque:8.850745791327184,deflection:1/25400,percent:1,none:1};
export const toDisplay=(v:number,q:Quantity,u:Units)=>u==='imperial'?v*factor[q]:v;
export const fromDisplay=(v:number,q:Quantity,u:Units)=>u==='imperial'?v/factor[q]:v;
export const unit=(q:Quantity,u:Units)=>quantityUnits[q][u==='metric'?0:1];
export const decimals=(q:Quantity,u:Units)=>q==='chip'?u==='imperial'?5:4:q==='deflection'?u==='imperial'?5:1:q==='length'?u==='imperial'?4:2:q==='power'?u==='imperial'?3:1:q==='torque'?3:q==='mrr'?2:q==='none'?0:1;
/** Display places for an editable field: at least the unit's usual precision, and at least four significant figures. */
export function displayPlaces(x:number,q:Quantity,u:Units){
 if(!Number.isFinite(x)||x===0)return decimals(q,u);
 const needed=Math.max(0,3-Math.floor(Math.log10(Math.abs(x))));
 return Math.min(10,Math.max(decimals(q,u),needed));
}
/** Thousandths of an inch from micrometres. */
export const thou=(um:number)=>um/25.4;
export function fmt(v:number,d=2){return Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';}
export function parseNumeric(s:string){
 const raw=s.trim();
 if(/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(raw)){const n=Number(raw);return Number.isFinite(n)?n:null;}
 const f=raw.match(/^(\d+)\s*\/\s*(\d+)$/);if(f&&Number(f[2])!==0)return Number(f[1])/Number(f[2]);
 return null;
}
