/** Canonical units: mm, mm/min, RPM, N, W, Nm, µm. No empirical validation implied. */
export const MODEL_VERSION = 'illustrative-static-3';
export const CUTTER_MATERIALS = {
 carbide:{name:'Carbide',modulus:600},
 hss:{name:'HSS',modulus:219},
} as const;
export type CutterMaterial=keyof typeof CUTTER_MATERIALS;
export interface Tool { material:CutterMaterial; diameter: number; flutes: number; stickout: number; fluteLength: number; modulus: number; stiffness: number; maxRpm?: number }
export interface Material { name: string; kc: number; powerFactor: number; forceFactor: number; known?: boolean }
export interface Machine { name: string; rpmMin: number; rpmMax: number; feedMax: number; power: number; torque: number; utilization: number; known?: boolean }
/** Operation sets how much tool bending the cut may accept; it is a multiplier on the finishing deflection allowance, not a second set of limits. */
export type Operation='roughing'|'finishing';
export interface Limits { preset?:'provisional-1'; cuttingDataKnown:boolean; chipMin: number; chipMax: number; deflection: number; surfaceMax: number; caution:number; operation:Operation }
export interface Cut { rpm: number; feed: number; doc: number; woc: number }
export interface Setup { tool: Tool; material: Material; machine: Machine; limits: Limits; cut: Cut }
export const defaults: Setup = {
 tool:{material:'carbide',diameter:6,flutes:3,stickout:20,fluteLength:15,modulus:600,stiffness:.45},
 material:{name:'Aluminum · 6061',kc:1000,powerFactor:1.25,forceFactor:1.3,known:true},
 machine:{name:'DMC2 Mini',rpmMin:3000,rpmMax:18000,feedMax:3000,power:250,torque:.3,utilization:.75,known:true},
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
export function calculate(c:Cut,s:Setup){
 const {tool:t,material:mat,machine:m,limits:l}=s;
 const inputValid=Object.values(c).every(v=>Number.isFinite(v)&&v>=0)&&c.rpm>0&&Object.hasOwn(CUTTER_MATERIALS,t.material)&&[t.diameter,t.flutes,t.stickout,t.fluteLength,t.modulus,t.stiffness].every(v=>Number.isFinite(v)&&v>0)&&Number.isInteger(t.flutes);
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
 const phi=Math.acos(1-2*engagement);
 const teeth=Math.max(1,Math.ceil(t.flutes*phi/(2*Math.PI)));
 const force=mat.known===false?NaN:noCut?0:mat.kc*c.doc*chipMax*teeth*mat.forceFactor;
 const inertia=Math.PI*t.diameter**4/64*t.stiffness;
 const deflection=force*t.stickout**3/(3*t.modulus*1000*inertia)*1000;
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
