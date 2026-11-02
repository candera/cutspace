/** Canonical units: mm, mm/min, RPM, N, W, Nm, µm. No empirical validation implied. */
export const MODEL_VERSION = 'illustrative-static-7';
export const CUTTER_MATERIALS = {
 carbide:{name:'Carbide',modulus:600},
 hss:{name:'HSS',modulus:219},
} as const;
export type CutterMaterial=keyof typeof CUTTER_MATERIALS;
/** What the shank and body are made of; it sets the bending modulus. Carbide-tipped and insert bits have steel bodies whatever their edges are. */
export const BODY_MATERIALS = {
 carbide:{name:'Solid carbide',modulus:600},
 steel:{name:'Steel body (carbide-tipped or insert)',modulus:210},
 hss:{name:'Solid HSS',modulus:219},
} as const;
export type BodyMaterial=keyof typeof BODY_MATERIALS;
/**
 * Cutter geometry classes. `modelled` says how far the straight-flute peripheral-milling model applies: `full` means the
 * class is a cylinder of its cutting diameter (helix and chip direction are not modelled, but nothing is misrepresented);
 * `as-flat` means the real cutting diameter varies with depth and the estimates refer to the nominal diameter.
 * Notes are qualitative shop guidance, not model outputs.
 */
export const GEOMETRIES = {
 flat:{label:'Flat end mill',short:'flat end mill',modelled:'full',note:'Square-end milling cutter with helical or straight flutes: the geometry Cutspace models directly.'},
 upcut:{label:'Upcut spiral',short:'upcut',modelled:'full',note:'Spiral flutes carry chips up and out of the cut. The same lift pulls on the workpiece and can fray the top edge of wood, so hold the work down well. Modelled as a flat end mill; the helix does not change the estimates.'},
 downcut:{label:'Downcut spiral',short:'downcut',modelled:'full',note:'Spiral flutes push chips down, leaving a clean top edge and pressing the work onto the table. Chips pack in slots and pockets, so heat and burning rise with depth: keep slot passes to about one diameter deep and clear the chips. Modelled as a flat end mill.'},
 compression:{label:'Compression spiral',short:'compression',modelled:'full',note:'Upcut flutes at the tip and downcut flutes above them, for clean edges on both faces of sheet goods. The first pass must be deeper than the upcut section (enter it as Upcut length) or the top edge is cut upcut-style. Modelled as a flat end mill.'},
 straight:{label:'Straight flute',short:'straight',modelled:'full',note:'Straight flutes with no helix, often carbide tips brazed to a steel body. Chips are neither lifted nor pushed, so slots clear poorly and entry is harsher than with a spiral. Cutspace’s force model already assumes straight flutes; set the body to steel for a tipped bit.'},
 'o-flute':{label:'O-flute',short:'O-flute',modelled:'full',note:'One (sometimes two) polished flutes with a large open gullet, for plastics and aluminium; runs heavy chiploads to keep the chip from melting. Modelled as a flat end mill with that flute count.'},
 ball:{label:'Ball nose',short:'ball nose',modelled:'as-flat',note:'Hemispherical tip for 3D contours. Below centre height the effective cutting diameter is smaller than nominal, so the surface speed and chipload at the edge are lower than shown here. Modelled as a flat end mill of its nominal diameter.'},
 v:{label:'V-bit',short:'V-bit',modelled:'as-flat',note:'Conical tip for engraving and V-carving. The cutting diameter grows with depth and is near zero at the point, so chipload, surface speed and %D shown here refer to the nominal (largest) diameter and overstate what the tip sees. Modelled as a flat end mill of its nominal diameter.'},
 surfacing:{label:'Surfacing / fly cutter',short:'surfacing',modelled:'full',note:'Large-diameter head on a small shank, usually a steel body with carbide inserts or tips, for flattening spoilboards and slabs at a millimetre or two of depth. The bit’s RPM rating matters more than surface speed (enter it as Tool max RPM). Set the body to steel and the shank diameter to the actual shank.'},
} as const satisfies Record<string,{label:string;short:string;modelled:'full'|'as-flat';note:string}>;
export type Geometry=keyof typeof GEOMETRIES;
/**
 * `material` is the edge material and selects the cutting data; `body` is the shank/body material and selects the bending
 * modulus (editable as `modulus`). `shankDiameter` may differ from the cutting `diameter`; `fluteLength` is the cutting
 * length. `upcutLength` applies to compression spirals only.
 */
export interface Tool { material:CutterMaterial; geometry:Geometry; body:BodyMaterial; diameter: number; shankDiameter: number; flutes: number; stickout: number; fluteLength: number; modulus: number; stiffness: number; maxRpm?: number; upcutLength?: number }
/** A tool with its edge material changed: a steel body stays steel, otherwise the body follows the edge and the modulus is reset to the body's default. */
export function withCutterMaterial(tool:Tool,material:CutterMaterial):Tool{
 if(tool.material===material)return {...tool};
 const body:BodyMaterial=tool.body==='steel'?'steel':material;
 return {...tool,material,body,modulus:tool.body==='steel'?tool.modulus:BODY_MATERIALS[body].modulus};
}
/** A tool with a new cutting diameter; a shank that matched the old cutting diameter follows it, a distinct shank stays. */
export function withDiameter(tool:Tool,diameter:number):Tool{return {...tool,diameter,shankDiameter:tool.shankDiameter===tool.diameter?diameter:tool.shankDiameter};}
/** A tool with its body material changed and the modulus reset to that body's default. */
export function withBody(tool:Tool,body:BodyMaterial):Tool{return tool.body===body?{...tool}:{...tool,body,modulus:BODY_MATERIALS[body].modulus};}
/** Notices about the tool at this cut that are not limits; today only the compression first-pass depth. The UI formats them in display units. */
export interface ToolNotice {key:'compression-shallow';doc:number;upcutLength:number}
export function toolNotices(s:Setup):ToolNotice[]{
 const {tool:t,cut:c}=s,notices:ToolNotice[]=[];
 if(t.geometry==='compression'&&t.upcutLength&&c.doc>0&&c.doc<t.upcutLength)notices.push({key:'compression-shallow',doc:c.doc,upcutLength:t.upcutLength});
 return notices;
}
export interface Material { name: string; kc: number; powerFactor: number; forceFactor: number; known?: boolean }
export interface Machine { name: string; rpmMin: number; rpmMax: number; feedMax: number; power: number; torque: number; utilization: number; known?: boolean }
/** Operation sets how much tool bending the cut may accept; it is a multiplier on the finishing deflection allowance, not a second set of limits. */
export type Operation='roughing'|'finishing';
export interface Limits { preset?:'provisional-1'; cuttingDataKnown:boolean; chipMin: number; chipMax: number; deflection: number; surfaceMax: number; caution:number; operation:Operation }
export interface Cut { rpm: number; feed: number; doc: number; woc: number }
export interface Setup { tool: Tool; material: Material; machine: Machine; limits: Limits; cut: Cut }
export const defaults: Setup = {
 tool:{material:'carbide',geometry:'flat',body:'carbide',diameter:6,shankDiameter:6,flutes:3,stickout:20,fluteLength:15,modulus:600,stiffness:.45},
 material:{name:'Aluminum · 6061',kc:1000,powerFactor:1.25,forceFactor:1.3,known:true},
 machine:{name:'2.2 kW spindle router (example)',rpmMin:8000,rpmMax:24000,feedMax:10000,power:2200,torque:.875,utilization:.75,known:true},
 limits:{cuttingDataKnown:true,chipMin:.008,chipMax:.055,deflection:25,surfaceMax:450,caution:.75,operation:'finishing'},
 cut:{rpm:10000,feed:1200,doc:3,woc:1.2},
};
export const cloneDefaults=():Setup=>structuredClone(defaults);
/** Soft limits are editable allowances with a caution band below them; hard limits are pass/fail machine or reach bounds. */
export const constraintInfo = {
 chipHigh:{label:'Chipload too high',color:'#d79560',kind:'soft'},chipLow:{label:'Chipload too low',color:'#ad9fe0',kind:'soft'},
 power:{label:'Spindle power',color:'#e0c479',kind:'soft'},torque:{label:'Spindle torque',color:'#da94b2',kind:'soft'},
 deflection:{label:'Tool deflection',color:'#81b5df',kind:'soft'},surface:{label:'Surface speed',color:'#a9c880',kind:'soft'},
 rpm:{label:'RPM range',color:'#c4aa92',kind:'hard'},feed:{label:'Machine feed',color:'#6ec6c7',kind:'hard'},geometry:{label:'Tool reach',color:'#c7a9dd',kind:'hard'},
} satisfies Record<string,{label:string;color:string;kind:'hard'|'soft'}>;
export type Zone='comfortable'|'caution'|'beyond'|'unknown';
export const zoneInfo:Record<Zone,{label:string;color:string}>={comfortable:{label:'Comfortable',color:'#3f8f6e'},caution:{label:'Caution',color:'#d9a441'},beyond:{label:'Beyond a soft limit',color:'#b8503c'},unknown:{label:'Outside / unknown',color:'#283443'}};
export type ConstraintKey=keyof typeof constraintInfo;
export interface Constraint {key:ConstraintKey;ratio:number}
export function availablePower(rpm:number,m:Machine){return m.known===false ? NaN : Math.min(m.power,m.torque*2*Math.PI*rpm/60)*m.utilization;}
const TAU=2*Math.PI,FORCE_PHASE_SAMPLES=96;
const forceFactorCache=new Map<string,number>();
/**
 * Peak lateral cutter load, expressed as an equivalent multiple of feed per tooth.
 * Each straight flute contributes its instantaneous chip thickness in its tangential
 * direction; the resultant is sampled over one tooth-passing period. Helix, runout,
 * radial/axial force coefficients and dynamic response are deliberately not modeled.
 */
export function peakCutterLoadFactor(engagement:number,flutes:number){
 if(!Number.isFinite(engagement)||engagement<0||engagement>1||!Number.isInteger(flutes)||flutes<1)return NaN;
 if(engagement===0)return 0;
 const key=`${flutes}:${engagement}`,cached=forceFactorCache.get(key);if(cached!==undefined)return cached;
 const exit=Math.acos(1-2*engagement),pitch=TAU/flutes;
 const phases=Array.from({length:FORCE_PHASE_SAMPLES},(_,i)=>i*pitch/FORCE_PHASE_SAMPLES);
 // Exact single-tooth maxima and engagement boundaries complement the uniform samples.
 phases.push(exit%pitch,Math.min(exit,Math.PI/2)%pitch);
 let peak=0;
 for(const phase of phases){
  let x=0,y=0;
  for(let flute=0;flute<flutes;flute++){
   const angle=phase+flute*pitch;if(angle>exit+Number.EPSILON*8)continue;
   const thickness=Math.sin(angle);
   x-=thickness*Math.sin(angle);y+=thickness*Math.cos(angle);
  }
  peak=Math.max(peak,Math.hypot(x,y));
 }
 if(forceFactorCache.size>=4096)forceFactorCache.clear();
 forceFactorCache.set(key,peak);return peak;
}
/**
 * Tip deflection per newton for a stepped cantilever of stickout L: the fluted segment a = min(flute length, L) has the
 * cutting diameter, the rest has the shank diameter. The cutting load is spread uniformly over the engaged flute length
 * d = min(DOC, a) measured from the tip; d = 0 is the earlier tip point load. By the unit-load method, with u the distance
 * from the tip, δ/F = (1/d) ∫₀ᵈ ∫ᵤₚᴸ (u − uₚ) u / EI du duₚ, which integrates to
 *   δ/F = [a³/3 − d a²/4 + d³/24] / (E I_flute) + [(L³ − a³)/3 − d (L² − a²)/4] / (E I_shank).
 * At d = 0 this is the tip-loaded [a³/(E I_flute) + (L³ − a³)/(E I_shank)] / 3; for one section loaded over its whole
 * length it is L³/(8EI), three eighths of the tip-loaded L³/(3EI). The effective section factor applies to both segments,
 * as it always has to the whole stickout, so a tool whose shank equals its cutting diameter reproduces the single-cylinder
 * estimate exactly; the shank segment differs only by diameter. One body modulus serves both segments: carbide tips do
 * not stiffen a steel body.
 */
export function steppedCompliance(t:Tool,loadedLength=0){
 const E=t.modulus*1000,L=t.stickout,a=Math.min(t.fluteLength,L),d=Math.min(Math.max(loadedLength,0),a);
 const iFlute=Math.PI*t.diameter**4/64*t.stiffness,iShank=Math.PI*t.shankDiameter**4/64*t.stiffness;
 return (a**3/3-d*a**2/4+d**3/24)/(E*iFlute)+((L**3-a**3)/3-d*(L**2-a**2)/4)/(E*iShank);
}
export function calculate(c:Cut,s:Setup){
 const {tool:t,material:mat,machine:m,limits:l}=s;
 const inputValid=Object.values(c).every(v=>Number.isFinite(v)&&v>=0)&&c.rpm>0&&Object.hasOwn(CUTTER_MATERIALS,t.material)&&Object.hasOwn(GEOMETRIES,t.geometry)&&Object.hasOwn(BODY_MATERIALS,t.body)&&[t.diameter,t.shankDiameter,t.flutes,t.stickout,t.fluteLength,t.modulus,t.stiffness].every(v=>Number.isFinite(v)&&v>0)&&Number.isInteger(t.flutes);
 const noCut=c.doc===0||c.woc===0||c.feed===0;
 const geometryValid=c.woc<=t.diameter;
 const surface=inputValid?Math.PI*t.diameter*c.rpm/1000:NaN;
 const chip=inputValid?c.feed/(c.rpm*t.flutes):NaN;
 const engagement=geometryValid&&inputValid?c.woc/t.diameter:NaN;
 const thinning=engagement<.5?2*Math.sqrt(engagement*(1-engagement)):engagement<=1?1:NaN;
 const chipMax=chip*thinning;
 const mrr=inputValid?c.doc*c.woc*c.feed/1000:NaN;
 const power=mat.known===false?NaN:mrr*mat.kc/60*mat.powerFactor;
 const torque=power*60/(2*Math.PI*c.rpm);
 const capacity=availablePower(c.rpm,m);
 const cutterLoad=peakCutterLoadFactor(engagement,t.flutes);
 const force=mat.known===false?NaN:noCut?0:mat.kc*c.doc*chip*cutterLoad*mat.forceFactor;
 // Stepped cantilever, fluted tip segment (cutting diameter, reduced section) on a solid shank segment, one body modulus,
 // with the load spread along the engaged flute length, so a deep cut bends less than the same force applied at the tip.
 const deflection=force*steppedCompliance(t,c.doc)*1000;
 const constraints:Constraint[]=[
  {key:'chipHigh',ratio:l.cuttingDataKnown?chipMax/l.chipMax:NaN},{key:'chipLow',ratio:l.cuttingDataKnown?(chipMax>0?l.chipMin/chipMax:Infinity):NaN},
  {key:'power',ratio:m.known===false?NaN:power/(m.power*m.utilization)},
  {key:'torque',ratio:m.known===false?NaN:torque/(m.torque*m.utilization)},
  {key:'deflection',ratio:deflection/l.deflection},{key:'surface',ratio:l.cuttingDataKnown?surface/l.surfaceMax:NaN},
  {key:'rpm',ratio:Math.max(m.rpmMin/c.rpm,c.rpm/m.rpmMax,t.maxRpm?c.rpm/t.maxRpm:0)},{key:'feed',ratio:c.feed/m.feedMax},
  {key:'geometry',ratio:Math.max(c.doc/t.fluteLength,c.doc/t.stickout)},
 ];
 const known=constraints.filter(c=>!Number.isNaN(c.ratio)).sort((a,b)=>b.ratio-a.ratio);
 const limiting=known[0]??{key:'geometry' as const,ratio:Infinity};
 const unknown=constraints.filter(c=>Number.isNaN(c.ratio)).map(c=>c.key);
 const status: 'invalid'|'no-cut'|'outside'|'unknown'|'inside'=!inputValid||!geometryValid?'invalid':noCut?'no-cut':limiting.ratio>1?'outside':unknown.length?'unknown':'inside';
 const soft=known.filter(c=>constraintInfo[c.key].kind==='soft'),hard=known.filter(c=>constraintInfo[c.key].kind==='hard');
 const softRatio=soft.length?soft[0].ratio:NaN,hardOk=hard.every(c=>c.ratio<=1),caution=l.caution??.75;
 const zone:Zone=status==='invalid'||status==='no-cut'||unknown.length||!hardOk?'unknown':softRatio>1?'beyond':softRatio>caution?'caution':'comfortable';
 return {surface,chip,chipMax,thinning,mrr,power,torque,capacity,force,deflection,utilization:power/capacity,margin:1-limiting.ratio,constraints:known,unknown,limiting,status,feasible:status==='inside',softRatio,hardOk,zone,softLimiting:soft[0]??null};
}
export type Result=ReturnType<typeof calculate>;
export type Metric='mrr'|'power'|'chip'|'chipMax'|'deflection'|'utilization'|'margin'|'constraint'|'zone';
export const metrics:Record<Metric,{label:string;kind:string}>={
 mrr:{label:'Material removal',kind:'Computed'},power:{label:'Spindle power',kind:'Estimated'},
 chip:{label:'Chipload (feed per tooth)',kind:'Computed'},chipMax:{label:'Max chip thickness',kind:'Geometry'},
 deflection:{label:'Tool deflection',kind:'Estimated'},utilization:{label:'Spindle utilization',kind:'Estimated'},
 margin:{label:'Remaining margin',kind:'Your limits'},constraint:{label:'Limiting constraint',kind:'Your limits'},zone:{label:'Limit zone',kind:'Your limits'},
};
export const metricValue=(r:Result,m:Metric)=>m==='constraint'?r.limiting.ratio:m==='zone'?r.softRatio:r[m];
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
