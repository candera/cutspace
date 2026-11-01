/**
 * Builds examples/dmc2-mini-library.json from the transcribed DMC2 Mini speeds-and-feeds sheet (scripts/dmc2-mini-data.ts).
 *   node scripts/build-dmc2-library.ts            # writes the library and prints the validation table
 *   node scripts/build-dmc2-library.ts --check    # prints only
 *
 * What is derived, and from what:
 *  - Machine. RPM ceiling and feed ceiling are Shariff's published 24,000 RPM and 10,000 mm/min. The RPM floor is set to
 *    6,000 so every chart row (lowest 6,600 RPM) passes the hard RPM check. The power/torque plateau is NOT the 2.2 kW
 *    nameplate: under Cutspace's constant-coefficient force model it is the effective constant-torque output that puts
 *    the aggressive test cuts at or below usable output and the recorded high-feed spindle bog-downs beyond it.
 *  - Tools. The operator's set: 3-flute uncoated carbide (aluminium) and 4-flute coated carbide (steel) in 1–12 mm plus a
 *    10 mm single-insert mill. Flute length is the deepest depth the tests ran; stickout is assumed (see GEOMETRY).
 *  - Per-tool cutting limits, stored in each recipe: the chip ceiling is the largest maximum-chip-thickness any
 *    successful test reached, or 1.25× the chart's value when the chart is heavier; the chip floor is half the lightest
 *    chart or successful chip; the roughing deflection allowance is the largest model deflection any successful test
 *    reached with the assumed stickout. The surface-speed ceiling per workpiece is the fastest successful test.
 *  - Recipes. The 32 "derived from manufacturer chart" rows (the normal numbers), each with the validation result
 *    against the fitted envelope written into its notes.
 */
import {writeFileSync} from 'node:fs';
import {calculate,constraintInfo} from '../src/model.ts';
import type {Machine,Setup,Tool} from '../src/model.ts';
import {MATERIALS} from '../src/experiment.ts';
import type {Snapshot} from '../src/experiment.ts';
import {parseLibrary} from '../src/library.ts';
import type {Library,MachineItem,RecipeItem,ToolItem} from '../src/library.ts';
import {AGGRESSIVE,CHART,DIAMETERS,FLUTES,INSERT_AGGRESSIVE,INSERT_DIAMETER,INSERT_FLUTES,INSERT_RAW,RAW,SHEET_URL} from './dmc2-mini-data.ts';
import type {Row,RawRow,Workpiece} from './dmc2-mini-data.ts';

const UPDATED='2026-10-31T00:00:00.000Z';
export const LIBRARY_ID='dmc2-mini',MACHINE_ID='dmc2-mini';
const MACHINE_REF=`lib:${LIBRARY_ID}/${MACHINE_ID}`;
/** [flute length, stickout] in mm per diameter. Flute length = deepest tested depth; stickout is an assumption to measure. */
const GEOMETRY:Record<number,[number,number]>={1:[3,6],2:[6,9],3:[9,12],4:[12,18],6:[16,22],8:[25,32],10:[30,38],12:[35,45]};
const INSERT_GEOMETRY:[number,number]=[8,35];
/** Chart RPM before the DMC2 manufacturer capped it at 24,000. */
const CHART_RPM:Record<Workpiece,Record<number,number>>={aluminum:{1:40000,2:40000,3:26500},steel:{1:40000,2:40000,3:32000}};
const WORKPIECE_LABEL:Record<Workpiece,string>={aluminum:'Aluminum',steel:'Mild steel'};
const CHART_COLUMN:Record<Workpiece,string>={aluminum:'“Aluminum and aluminum alloy” column of the 3-flute chart',steel:'“Pre-hardened steel 40–50 HRC” column of the 4-flute coated chart'};

const POWER=950;
export const MACHINE:Machine={name:'DMC2 Mini',rpmMin:6000,rpmMax:24000,feedMax:10000,power:POWER,torque:Number((POWER*60/(2*Math.PI*24000)).toPrecision(3)),utilization:.75,known:true};
const MACHINE_NOTE=`Fitted to the operator’s DMC2 Mini test log, not a specification. 24,000 RPM and the 10,000 mm/min feed ceiling are Shariff’s published figures. The 6,000 RPM floor admits the manufacturer-chart rows down to 6,600 RPM; the slowest tested speed was 10,000 RPM and low-speed spindle cooling is not modelled. The ${POWER} W / ${MACHINE.torque} N·m plateau is not the 2.2 kW nameplate: it is the effective constant-torque output under Cutspace’s constant-coefficient force model, chosen so the aggressive test cuts sit at or below usable output (3 mm aluminium at 22,000 RPM and 4 mm steel at 16,000 RPM reach about 92–95%) and the recorded high-feed spindle bog-downs at 24,000 RPM sit beyond it. It folds in thin-chip force effects and whatever the spindle really delivers. Deep, thin-radial stalls with 10–12 mm tools are not power events in this model; the per-tool deflection allowances in the recipes capture those.`;

const round=(x:number,digits=3)=>Number(x.toPrecision(digits));
const ceilTo=(x:number,step:number)=>Math.ceil(x/step-1e-9)*step;
/** Rounds a derived ceiling up at three significant figures so the cut it came from stays at or below 100%. */
const ceilSig=(x:number,digits=3)=>{const step=10**(Math.floor(Math.log10(x))-digits+1);return Number(ceilTo(x,step).toPrecision(digits));};
const fmt=(x:number,d=0)=>x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});

function tool(workpiece:Workpiece,diameter:number):Tool{const [fluteLength,stickout]=GEOMETRY[diameter];return {material:'carbide',diameter,flutes:FLUTES[workpiece],stickout,fluteLength,modulus:600,stiffness:.45};}
const INSERT_TOOL:Tool={material:'carbide',diameter:INSERT_DIAMETER,flutes:INSERT_FLUTES,stickout:INSERT_GEOMETRY[1],fluteLength:INSERT_GEOMETRY[0],modulus:210,stiffness:.45};
const toolId=(workpiece:Workpiece,diameter:number)=>`${workpiece==='aluminum'?'al-3f':'st-4f'}-${diameter}mm`;
const toolName=(workpiece:Workpiece,diameter:number)=>`${diameter} mm · ${FLUTES[workpiece]} flute ${workpiece==='aluminum'?'uncoated':'coated'} carbide (${workpiece} set)`;
const material=(workpiece:Workpiece)=>({name:MATERIALS[workpiece].name,kc:MATERIALS[workpiece].kc,powerFactor:1.25,forceFactor:1.3,known:true});

function setupFor(row:Row,t:Tool,limits:Setup['limits']):Setup{return {tool:t,material:material(row.workpiece),machine:MACHINE,limits,cut:{rpm:row.rpm,feed:row.feed,doc:row.doc,woc:row.woc}};}
const OPEN_LIMITS:Setup['limits']={cuttingDataKnown:true,chipMin:1e-5,chipMax:5,deflection:5000,surfaceMax:10000,caution:.75,operation:'roughing'};
const result=(row:Row,t:Tool,limits=OPEN_LIMITS)=>calculate({rpm:row.rpm,feed:row.feed,doc:row.doc,woc:row.woc},setupFor(row,t,limits));

/** Successful cuts: the aggressive summary rows plus raw rows the operator called good. */
const successes=(workpiece:Workpiece,diameter:number)=>[...AGGRESSIVE,...RAW.filter(r=>r.outcome==='good')].filter(r=>r.workpiece===workpiece&&r.diameter===diameter);
const chartRows=(workpiece:Workpiece,diameter:number)=>CHART.filter(r=>r.workpiece===workpiece&&r.diameter===diameter);

interface ToolLimits {chipMin:number;chipMax:number;deflection:number;deepest:Row}
function toolLimits(workpiece:Workpiece,diameter:number):ToolLimits{
 const t=tool(workpiece,diameter),won=successes(workpiece,diameter),chart=chartRows(workpiece,diameter);
 const hm=(r:Row)=>result(r,t).chipMax,bend=(r:Row)=>result(r,t).deflection;
 const chipMax=ceilSig(Math.max(...won.map(hm),1.25*Math.max(...chart.map(hm))));
 const chipMin=round(.5*Math.min(...won.map(hm),...chart.map(hm)),2);
 const deepest=won.reduce((a,b)=>bend(b)>bend(a)?b:a);
 return {chipMin,chipMax,deflection:ceilSig(bend(deepest)),deepest};
}
const SURFACE_MAX:Record<Workpiece,number>={aluminum:0,steel:0};
for(const workpiece of ['aluminum','steel'] as Workpiece[])SURFACE_MAX[workpiece]=ceilTo(Math.max(...DIAMETERS.flatMap(d=>successes(workpiece,d).map(r=>result(r,tool(workpiece,d)).surface))),10);

const toolItems:ToolItem[]=[];
const limitsByTool=new Map<string,ToolLimits>();
for(const workpiece of ['aluminum','steel'] as Workpiece[])for(const diameter of DIAMETERS){
 const t=tool(workpiece,diameter),limits=toolLimits(workpiece,diameter);limitsByTool.set(toolId(workpiece,diameter),limits);
 toolItems.push({id:toolId(workpiece,diameter),name:toolName(workpiece,diameter),tool:t,provenance:{source:'user',url:SHEET_URL,
  note:`From the DMC2 Mini test log: ${FLUTES[workpiece]}-flute ${workpiece==='aluminum'?'uncoated':'coated'} carbide square end mill used for ${workpiece}. Flute length is set to the deepest depth the tests ran (${t.fluteLength} mm) and ${t.stickout} mm stickout is assumed; measure both on the actual tool. The recipes’ limits for this tool: chip thickness ${limits.chipMin}–${limits.chipMax} mm (demonstrated ceiling or 1.25× the chart), roughing deflection allowance ${limits.deflection} µm (the model’s deflection at the heaviest successful test, ${describe(limits.deepest)}, which scales with stickout cubed), surface speed ≤ ${SURFACE_MAX[workpiece]} m/min.`},updatedAt:UPDATED});
}
toolItems.push({id:'insert-mill-10mm-1f',name:'10 mm · single-insert mill (steel body)',tool:INSERT_TOOL,provenance:{source:'user',url:SHEET_URL,
 note:`From the DMC2 Mini test log: 10 mm indexable mill with one carbide insert. Modelled as “carbide” for the insert’s cutting data, with the modulus set to 210 GPa for its steel body. Effective flute length ${INSERT_GEOMETRY[0]} mm and ${INSERT_GEOMETRY[1]} mm stickout are assumed; measure both. Tests reached ${describe(INSERT_AGGRESSIVE[0])}, ${describe(INSERT_AGGRESSIVE[1])}, ${describe(INSERT_AGGRESSIVE[2])} and ${describe(INSERT_AGGRESSIVE[3])}; no chart rows exist for it, so it has no recipes.`},updatedAt:UPDATED});
function describe(r:Row){return `${r.workpiece} ${r.mode==='slot'?'slot':'profile'} at ${fmt(r.rpm)} RPM, ${fmt(r.feed)} mm/min, ${r.woc} mm stepover × ${r.doc} mm depth`;}

const machineItem:MachineItem={id:MACHINE_ID,name:MACHINE.name,machine:(({name:_n,...v})=>v)(MACHINE),provenance:{source:'user',note:MACHINE_NOTE,url:SHEET_URL},updatedAt:UPDATED};

interface Validation {row:Row;status:string;zone:string;checks:string;limiting:string}
const validations:Validation[]=[];
const recipes:RecipeItem[]=CHART.map(row=>{
 const id=toolId(row.workpiece,row.diameter),t=tool(row.workpiece,row.diameter),l=limitsByTool.get(id)!;
 const limits:Setup['limits']={cuttingDataKnown:true,chipMin:l.chipMin,chipMax:l.chipMax,deflection:l.deflection,surfaceMax:SURFACE_MAX[row.workpiece],caution:.75,operation:'roughing'};
 const r=result(row,t,limits);
 const pct=(k:string)=>`${constraintInfo[k as keyof typeof constraintInfo].label.toLowerCase()} ${fmt(r.constraints.find(c=>c.key===k)!.ratio*100)}%`;
 const exceeded=r.constraints.filter(c=>c.ratio>1).map(c=>pct(c.key)),tightest=pct((r.softLimiting??r.constraints[0]).key);
 const ratioD=row.doc/row.diameter,ratioW=row.woc/row.diameter;
 const capped=CHART_RPM[row.workpiece][row.diameter];
 const chartText=`${CHART_COLUMN[row.workpiece]}${capped?`, ${fmt(capped)} RPM capped at 24,000 by the DMC2 manufacturer with the chart feed kept`:''}: ${fmt(row.rpm)} RPM, ${fmt(row.feed)} mm/min, ${row.woc} mm stepover (${round(ratioW*100,3)}%D) × ${row.doc} mm depth (${round(ratioD*100,3)}%D), ${r.chip.toFixed(4)} mm/tooth.`;
 const verdict=r.status==='inside'?`Lands ${r.zone==='caution'?'inside the fitted DMC2 envelope but near a soft limit':'comfortably inside the fitted DMC2 envelope'}; tightest check ${tightest}.`
  :`Outside the fitted DMC2 envelope: ${exceeded.join(', ')}. The tests never ran this tool this heavily; the heaviest success was ${describe(l.deepest)}. Treat the chart row as unsupported on this machine rather than as a starting point.`;
 validations.push({row,status:r.status,zone:r.zone,checks:exceeded.join(', ')||'—',limiting:tightest});
 const snapshot:Snapshot={machineId:MACHINE_REF,materialId:row.workpiece,config:{tool:t,machine:MACHINE,material:material(row.workpiece),limits},point:{rpm:row.rpm,feed:row.feed,docRatio:round(ratioD,6),wocRatio:round(ratioW,6)}};
 return {id:`chart-${row.workpiece}-${row.diameter}mm-${row.mode}`,name:`${WORKPIECE_LABEL[row.workpiece]} · ${row.diameter} mm · ${row.mode==='slot'?`slot ${round(ratioD,3)}D deep`:`profile ${round(ratioW,3)}D × ${round(ratioD,3)}D`} (chart)`,
  snapshot,units:'metric',notes:`${chartText} ${verdict}`,provenance:{source:'manufacturer',url:SHEET_URL,note:'Cutter manufacturer’s chart as tabulated by the DMC2 manufacturer; the limits stored with the recipe are derived from the operator’s tests, not from the chart.'},updatedAt:UPDATED};
});

const library:Library={schemaVersion:1,id:LIBRARY_ID,name:'DMC2 Mini · speeds and feeds',kind:'personal',readOnly:false,updatedAt:UPDATED,machines:[machineItem],materials:[],tools:toolItems,recipes};
const parsed=parseLibrary(JSON.stringify(library));
if(parsed.recipes.length!==32||parsed.tools.length!==17)throw Error('Unexpected library contents.');

const table=['| Workpiece | Tool | Mode | Chart cut | Result | Exceeded | Tightest check |','|---|---|---|---|---|---|---|',
 ...validations.map(v=>`| ${WORKPIECE_LABEL[v.row.workpiece]} | ${v.row.diameter} mm ${FLUTES[v.row.workpiece]}F | ${v.row.mode} | ${fmt(v.row.rpm)} RPM · ${fmt(v.row.feed)} mm/min · ${v.row.woc} × ${v.row.doc} mm | ${v.status==='inside'?v.zone:'outside'} | ${v.checks} | ${v.limiting} |`)].join('\n');
console.log(`Machine: ${JSON.stringify(MACHINE)}`);
console.log(`Surface ceilings: ${JSON.stringify(SURFACE_MAX)}`);
for(const [id,l] of limitsByTool)console.log(`${id.padEnd(10)} chip ${l.chipMin}–${l.chipMax} mm  deflection ${l.deflection} µm  (deepest: ${describe(l.deepest)})`);
console.log(table);
console.log(`${validations.filter(v=>v.status==='inside').length} of ${validations.length} chart rows inside.`);
// Aggressive rows and raw outcomes against the same envelope, for the record.
const check=(r:Row,t:Tool,l:ToolLimits,label:string)=>{const res=result(r,t,{...OPEN_LIMITS,chipMin:l.chipMin,chipMax:l.chipMax,deflection:l.deflection,surfaceMax:SURFACE_MAX[r.workpiece]});return `${label.padEnd(9)} ${r.workpiece.padEnd(8)} ${r.mode.padEnd(7)} ${String(r.diameter).padStart(2)} mm  ${res.status==='inside'?res.zone.padEnd(11):'OUTSIDE'.padEnd(11)} ${res.constraints.filter(c=>c.ratio>.75).map(c=>`${c.key} ${fmt(c.ratio*100)}%`).join(', ')} ${r.note??''}`;};
console.log('--- aggressive summary rows');for(const r of AGGRESSIVE)console.log(check(r,tool(r.workpiece,r.diameter),limitsByTool.get(toolId(r.workpiece,r.diameter))!,'aggr'));
console.log('--- raw rows with outcomes');for(const r of RAW)console.log(check(r,tool(r.workpiece,r.diameter),limitsByTool.get(toolId(r.workpiece,r.diameter))!,r.outcome));
console.log('--- insert mill (no per-tool limits derived; open limits)');for(const r of [...INSERT_AGGRESSIVE,...INSERT_RAW])console.log(check(r,INSERT_TOOL,{chipMin:1e-5,chipMax:5,deflection:5000,deepest:r},(r as RawRow).outcome??'aggr'));
if(!process.argv.includes('--check')){writeFileSync(new URL('../examples/dmc2-mini-library.json',import.meta.url),JSON.stringify(library,null,1)+'\n');console.log('wrote examples/dmc2-mini-library.json');}
