import {MACHINES,readSnapshot} from './experiment.ts';
import type {MachineId,Snapshot} from './experiment.ts';
import {OPERATION_INFO} from './cuttingPresets.ts';
import {CUTTER_MATERIALS} from './model.ts';
import type {CutterMaterial,Limits,Machine,Material,Tool} from './model.ts';
import type {Units} from './units.ts';

/** Libraries hold reusable machines, workpiece materials, tools and cut recipes. Experiments keep their own value snapshots, so editing a library never changes a saved experiment or pin. */
export const LIBRARY_SCHEMA=1 as const;
export const LIBRARIES_KEY='cutspace-libraries-v1';
export const BUILTIN_ID='builtin',PERSONAL_ID='personal';
export type ProvenanceSource='illustrative'|'manufacturer'|'measured'|'user';
export const PROVENANCE_LABEL:Record<ProvenanceSource,string>={illustrative:'example values',manufacturer:'manufacturer data',measured:'measured',user:'entered by a user'};
export interface Provenance {source:ProvenanceSource;note?:string;url?:string}
export interface ItemBase {id:string;name:string;provenance:Provenance;updatedAt:string}
export type MachineValues=Omit<Machine,'name'>;
export type MaterialValues=Omit<Material,'name'>;
export type MaterialCuttingValues=Pick<Limits,'chipMin'|'chipMax'|'deflection'|'surfaceMax'>;
export interface MachineItem extends ItemBase {machine:MachineValues}
export interface MaterialItem extends ItemBase {material:MaterialValues;cutting?:Partial<Record<CutterMaterial,MaterialCuttingValues>>}
export interface ToolItem extends ItemBase {tool:Tool}
export interface RecipeItem extends ItemBase {snapshot:Snapshot;notes:string;units:Units}
export type LibraryKind='builtin'|'shared'|'personal';
export interface Library {schemaVersion:typeof LIBRARY_SCHEMA;id:string;name:string;kind:LibraryKind;readOnly:boolean;sourceUrl?:string;updatedAt:string;machines:MachineItem[];materials:MaterialItem[];tools:ToolItem[];recipes:RecipeItem[]}
export type ItemKind='machines'|'materials'|'tools'|'recipes';
export const ITEM_KINDS:ItemKind[]=['machines','materials','tools','recipes'];
export type ConflictPolicy='replace'|'keep-both'|'skip';
export type Selection=Partial<Record<ItemKind,string[]>>;

const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const now=()=>new Date().toISOString();
function object(x:unknown,what='Library data'):Record<string,unknown>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error(`${what} must be an object.`);return x as Record<string,unknown>;}
function str(o:Record<string,unknown>,k:string,max:number,required=true){const v=o[k];if(v===undefined&&!required)return undefined;if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error(`${k} must be text of at most ${max} characters.`);return v;}
function num(o:Record<string,unknown>,k:string,min:number,max:number){const n=o[k];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error(`${k} must be between ${min} and ${max}.`);return n;}
function bool(o:Record<string,unknown>,k:string,fallback:boolean){const v=o[k];if(v===undefined)return fallback;if(typeof v!=='boolean')throw Error(`${k} must be true or false.`);return v;}
export function slug(name:string){return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'item';}
export function uniqueId(base:string,taken:Iterable<string>){const set=new Set(taken);let id=base,i=2;while(set.has(id))id=`${base}-${i++}`;return id;}

function parseProvenance(v:unknown):Provenance{
 const o=object(v,'Provenance');const source=o.source;
 if(typeof source!=='string'||!Object.hasOwn(PROVENANCE_LABEL,source))throw Error('Provenance source must be illustrative, manufacturer, measured or user.');
 const url=str(o,'url',500,false);if(url!==undefined&&!/^https?:\/\//.test(url))throw Error('Provenance url must start with http:// or https://.');
 return {source:source as ProvenanceSource,...(str(o,'note',600,false)===undefined?{}:{note:o.note as string}),...(url===undefined?{}:{url})};
}
function parseBase(o:Record<string,unknown>):ItemBase{
 const id=str(o,'id',64)!;if(!ID.test(id))throw Error(`Item id "${id}" may use letters, digits, dot, underscore and hyphen only.`);
 return {id,name:str(o,'name',120)!,provenance:parseProvenance(o.provenance),updatedAt:str(o,'updatedAt',40,false)??now()};
}
export function parseMachineValues(v:unknown):MachineValues{
 const m=object(v,'Machine');
 const machine={rpmMin:num(m,'rpmMin',1,100000),rpmMax:num(m,'rpmMax',2,200000),feedMax:num(m,'feedMax',1,200000),power:num(m,'power',.1,100000),torque:num(m,'torque',.001,1000),utilization:num(m,'utilization',.01,1),known:bool(m,'known',true)};
 if(machine.rpmMin>=machine.rpmMax)throw Error('Minimum RPM must be less than maximum RPM.');
 return machine;
}
export function parseMaterialValues(v:unknown):MaterialValues{
 const m=object(v,'Material');return {kc:num(m,'kc',1,10000),powerFactor:num(m,'powerFactor',1,5),forceFactor:num(m,'forceFactor',1,5),known:bool(m,'known',true)};
}
function parseMaterialCutting(v:unknown):MaterialItem['cutting']{
 if(v===undefined)return undefined;
 const o=object(v,'Material cutting data'),cutting:MaterialItem['cutting']={};
 for(const cutter of Object.keys(CUTTER_MATERIALS) as CutterMaterial[]){
  if(o[cutter]===undefined)continue;const c=object(o[cutter],`${CUTTER_MATERIALS[cutter].name} cutting data`);
  const values={chipMin:num(c,'chipMin',.00001,1),chipMax:num(c,'chipMax',.00002,5),deflection:num(c,'deflection',.01,5000),surfaceMax:num(c,'surfaceMax',1,10000)};
  if(values.chipMin>=values.chipMax)throw Error('Minimum chip thickness must be less than maximum.');cutting[cutter]=values;
 }
 if(Object.keys(cutting).length===0)throw Error('Material cutting data must include Carbide or HSS values.');return cutting;
}
export function parseToolValues(v:unknown):Tool{
 const t=object(v,'Tool');
 if(typeof t.material!=='string'||!Object.hasOwn(CUTTER_MATERIALS,t.material))throw Error('Unsupported cutter material. Choose Carbide or HSS.');
 const tool:Tool={material:t.material as CutterMaterial,diameter:num(t,'diameter',.1,200),flutes:num(t,'flutes',1,24),stickout:num(t,'stickout',.1,500),fluteLength:num(t,'fluteLength',.1,500),modulus:num(t,'modulus',1,1000),stiffness:num(t,'stiffness',.01,1),...(t.maxRpm===undefined?{}:{maxRpm:num(t,'maxRpm',0,200000)})};
 if(!Number.isInteger(tool.flutes))throw Error('Flutes must be a whole number.');
 return tool;
}
function parseItems<T extends ItemBase>(value:unknown,kind:ItemKind,read:(o:Record<string,unknown>,base:ItemBase)=>T):T[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>500)throw Error(`${kind} must be a list of at most 500 items.`);
 const items=value.map(v=>{const o=object(v,'Item');return read(o,parseBase(o));});
 const ids=new Set<string>();for(const item of items){if(ids.has(item.id))throw Error(`Duplicate ${kind} id "${item.id}".`);ids.add(item.id);}
 return items;
}
export function parseLibrary(value:unknown):Library{
 const o=typeof value==='string'?object(JSON.parse(value)):object(value);
 if(o.schemaVersion!==LIBRARY_SCHEMA)throw Error('Unsupported library file version. Cutspace reads version 1 library files.');
 const id=str(o,'id',64)!;if(!ID.test(id))throw Error('Library id may use letters, digits, dot, underscore and hyphen only.');
 const kind=o.kind;if(kind!=='builtin'&&kind!=='shared'&&kind!=='personal')throw Error('Library kind must be builtin, shared or personal.');
 const sourceUrl=str(o,'sourceUrl',500,false);
 return {schemaVersion:LIBRARY_SCHEMA,id,name:str(o,'name',120)!,kind,readOnly:bool(o,'readOnly',kind!=='personal'),...(sourceUrl===undefined?{}:{sourceUrl}),updatedAt:str(o,'updatedAt',40,false)??now(),
  machines:parseItems(o.machines,'machines',(item,base)=>({...base,machine:parseMachineValues(item.machine)})),
  materials:parseItems(o.materials,'materials',(item,base)=>({...base,material:parseMaterialValues(item.material),...(item.cutting===undefined?{}:{cutting:parseMaterialCutting(item.cutting)})})),
  tools:parseItems(o.tools,'tools',(item,base)=>({...base,tool:parseToolValues(item.tool)})),
  recipes:parseItems(o.recipes,'recipes',(item,base)=>{const units=item.units??'metric';if(units!=='metric'&&units!=='imperial')throw Error('Recipe units must be metric or imperial.');return {...base,snapshot:readSnapshot(item.snapshot),notes:str(item,'notes',2000,false)??'',units};}),
 };
}

const MACHINE_NOTES:Record<MachineId,string>={
 dmc2:'Shariff publishes a 2.2 kW, 24,000 RPM ER20 spindle and 10,000 mm/min rapids. The 10,000 RPM minimum is user-supplied; 0.875 N·m is derived from 2.2 kW at 24,000 RPM; the 75% usable-output reserve remains illustrative.',
 rc4:'Placeholder numbers, not a verified RC4 specification. Public resale listings describe RC4s with roughly 4 HP (3 kW) HSD spindles and 18,000 RPM maximum; confirm from the nameplate of the actual machine (for example the Nova Labs RC4) before relying on this profile.',
 bigblue:'Copies the ShopSabre RC4 example values at the user’s request; not independently measured.',
 'desktop-mill-example':'Generic starting point for a small benchtop mill. Edit to match your machine.',
 'hobby-router-example':'Generic starting point for a palm-router or small-spindle hobby router. Edit to match your machine.',
 'industrial-router-example':'Generic starting point for a 4×4 or larger router with a 3 kW class spindle. Edit to match your machine.',
};
const machineValues=(m:Machine):MachineValues=>{const {name:_name,...values}=m;return values;};
const starterTool=(id:string,name:string,tool:Tool,note='Example geometry; measure stickout and flute length on your actual tool.'):ToolItem=>({id,name,tool,provenance:{source:'illustrative',note},updatedAt:'2026-10-30T00:00:00.000Z'});
/** The built-in library is regenerated from code each load; it is never stored. */
export function builtinLibrary(recipes:RecipeItem[]=[]):Library{
 return {schemaVersion:LIBRARY_SCHEMA,id:BUILTIN_ID,name:'Built in',kind:'builtin',readOnly:true,updatedAt:'2026-10-30T00:00:00.000Z',
  machines:(Object.keys(MACHINES) as MachineId[]).map(id=>({id,name:MACHINES[id].name,machine:machineValues(MACHINES[id]),provenance:{source:'illustrative',note:MACHINE_NOTES[id]},updatedAt:'2026-10-30T00:00:00.000Z'})),
  materials:[],
  tools:[
   starterTool('6mm-3f-carbide','6 mm · 3 flute carbide end mill',{material:'carbide',diameter:6,flutes:3,stickout:20,fluteLength:15,modulus:600,stiffness:.45}),
   starterTool('quarter-2f-carbide','1/4 in · 2 flute carbide upcut',{material:'carbide',diameter:6.35,flutes:2,stickout:25.4,fluteLength:19.05,modulus:600,stiffness:.45}),
   starterTool('quarter-1f-carbide','1/4 in · 1 flute O-flute carbide',{material:'carbide',diameter:6.35,flutes:1,stickout:25.4,fluteLength:19.05,modulus:600,stiffness:.5}),
   starterTool('eighth-2f-carbide','1/8 in · 2 flute carbide',{material:'carbide',diameter:3.175,flutes:2,stickout:15,fluteLength:12.7,modulus:600,stiffness:.45}),
   starterTool('half-2f-carbide','1/2 in · 2 flute carbide',{material:'carbide',diameter:12.7,flutes:2,stickout:38.1,fluteLength:31.75,modulus:600,stiffness:.45}),
   starterTool('quarter-2f-hss','1/4 in · 2 flute HSS',{material:'hss',diameter:6.35,flutes:2,stickout:25.4,fluteLength:19.05,modulus:219,stiffness:.45}),
  ],
  recipes};
}
export function personalLibrary():Library{return {schemaVersion:LIBRARY_SCHEMA,id:PERSONAL_ID,name:'My library',kind:'personal',readOnly:false,updatedAt:now(),machines:[],materials:[],tools:[],recipes:[]};}
export function parseStoredLibraries(text:string|null):Library[]{
 if(!text)return [];
 const o=object(JSON.parse(text),'Stored libraries');
 if(o.schemaVersion!==LIBRARY_SCHEMA||!Array.isArray(o.libraries))throw Error('Unsupported stored library format.');
 return o.libraries.map(parseLibrary).filter(l=>l.kind!=='builtin');
}
export function loadLibraries(builtin:Library):{libraries:Library[];error:string}{
 let stored:Library[]=[],error='';
 try{stored=parseStoredLibraries(localStorage.getItem(LIBRARIES_KEY));}catch(e){stored=[];error=`Saved libraries could not be read: ${e instanceof Error?e.message:String(e)}. Starting with an empty personal library.`;}
 if(!stored.some(l=>l.id===PERSONAL_ID))stored=[personalLibrary(),...stored];
 return {libraries:[builtin,...stored],error};
}
export function saveLibraries(libraries:Library[]):string{
 try{localStorage.setItem(LIBRARIES_KEY,JSON.stringify({schemaVersion:LIBRARY_SCHEMA,libraries:libraries.filter(l=>l.kind!=='builtin')}));return '';}
 catch{return 'Libraries were not saved: browser storage is unavailable or full. Export your library to keep a copy.';}
}

/** Experiments reference built-in machines by their bare id and library machines as lib:<library>/<item>. */
export function machineRefId(libraryId:string,itemId:string){return libraryId===BUILTIN_ID?itemId:`lib:${libraryId}/${itemId}`;}
export function findMachine(libraries:Library[],machineId:string){
 for(const library of libraries)for(const item of library.machines)if(machineRefId(library.id,item.id)===machineId)return {library,item};
 return null;
}
export function findMaterial(libraries:Library[],materialId:string){
 for(const library of libraries)for(const item of library.materials)if(machineRefId(library.id,item.id)===materialId)return {library,item};
 return null;
}
export const machineFromItem=(item:MachineItem):Machine=>({...item.machine,name:item.name});
export const materialFromItem=(item:MaterialItem):Material=>({...item.material,name:item.name});
export function limitsFromMaterialItem(item:MaterialItem,cutter:CutterMaterial,current:Limits):Limits{
 const values=item.cutting?.[cutter];
 if(!values){const next={...current,cuttingDataKnown:false};delete next.preset;return next;}
 return {...values,deflection:Number((values.deflection*OPERATION_INFO[current.operation].deflection).toPrecision(6)),cuttingDataKnown:true,caution:current.caution,operation:current.operation};
}
export function withItem<K extends ItemKind>(library:Library,kind:K,item:Library[K][number]):Library{
 if(library.readOnly)throw Error(`${library.name} is read-only. Copy items to your own library instead.`);
 return {...library,updatedAt:now(),[kind]:[...library[kind],item]};
}
export function removeItem(library:Library,kind:ItemKind,id:string):Library{
 if(library.readOnly)throw Error(`${library.name} is read-only.`);
 return {...library,updatedAt:now(),[kind]:(library[kind] as ItemBase[]).filter(i=>i.id!==id)};
}
export function machineItem(library:Library,name:string,machine:Machine|MachineValues,provenance:Provenance={source:'user'}):MachineItem{
 const {name:_n,...values}=machine as Machine;return {id:uniqueId(slug(name),library.machines.map(m=>m.id)),name,machine:values,provenance,updatedAt:now()};
}
export function materialItem(library:Library,name:string,material:Material|MaterialValues,limits?:Limits,cutter?:CutterMaterial,provenance:Provenance={source:'user'}):MaterialItem{
 const {name:_n,...values}=material as Material;let cutting:MaterialItem['cutting'];
 if(limits?.cuttingDataKnown&&cutter)cutting={[cutter]:{chipMin:limits.chipMin,chipMax:limits.chipMax,deflection:Number((limits.deflection/OPERATION_INFO[limits.operation].deflection).toPrecision(6)),surfaceMax:limits.surfaceMax}};
 return {id:uniqueId(slug(name),library.materials.map(m=>m.id)),name,material:values,...(cutting?{cutting}:{}),provenance,updatedAt:now()};
}
export function toolItem(library:Library,name:string,tool:Tool,provenance:Provenance={source:'user'}):ToolItem{return {id:uniqueId(slug(name),library.tools.map(t=>t.id)),name,tool:structuredClone(tool),provenance,updatedAt:now()};}
export function recipeItem(library:Library,name:string,snapshot:Snapshot,units:Units,notes='',provenance:Provenance={source:'user'}):RecipeItem{return {id:uniqueId(slug(name),library.recipes.map(r=>r.id)),name,snapshot:structuredClone(snapshot),units,notes,provenance,updatedAt:now()};}
/** Copy of a library holding only the selected items (all items when no selection is given). */
export function exportLibrary(library:Library,selection?:Selection):Library{
 const pick=<T extends ItemBase>(items:T[],ids?:string[])=>ids?items.filter(i=>ids.includes(i.id)):items;
 return structuredClone({...library,machines:pick(library.machines,selection?.machines),tools:pick(library.tools,selection?.tools),recipes:pick(library.recipes,selection?.recipes)});
}
export function conflictsBetween(target:Library,incoming:Library){
 return ITEM_KINDS.flatMap(kind=>{const ids=new Set((target[kind] as ItemBase[]).map(i=>i.id));return (incoming[kind] as ItemBase[]).filter(i=>ids.has(i.id)).map(i=>`${kind}:${i.id}`);});
}
export function mergeLibrary(target:Library,incoming:Library,policy:ConflictPolicy){
 if(target.readOnly)throw Error(`${target.name} is read-only.`);
 let added=0,replaced=0,skipped=0;const result={...target,updatedAt:now()};
 for(const kind of ITEM_KINDS){
  const items=[...(target[kind] as ItemBase[])];
  for(const item of incoming[kind] as ItemBase[]){
   const at=items.findIndex(i=>i.id===item.id);const copy=structuredClone(item);
   if(at<0){items.push(copy);added++;}
   else if(policy==='replace'){items[at]=copy;replaced++;}
   else if(policy==='keep-both'){copy.id=uniqueId(item.id,items.map(i=>i.id));items.push(copy);added++;}
   else skipped++;
  }
  (result as unknown as Record<ItemKind,ItemBase[]>)[kind]=items;
 }
 return {library:result,added,replaced,skipped};
}
export function asShared(library:Library,sourceUrl?:string):Library{return {...library,kind:'shared',readOnly:true,...(sourceUrl?{sourceUrl}:{})};}
/** Adds or refreshes a shared library; ids that collide with the built-in or personal library are suffixed. */
export function upsertLibrary(libraries:Library[],library:Library):Library[]{
 const reserved=libraries.filter(l=>l.kind!==library.kind||l.sourceUrl!==library.sourceUrl).map(l=>l.id);
 const id=reserved.includes(library.id)?uniqueId(library.id,libraries.map(l=>l.id)):library.id;
 const next={...library,id};
 const at=libraries.findIndex(l=>l.id===id);
 return at<0?[...libraries,next]:libraries.map((l,i)=>i===at?next:l);
}
export function replaceLibrary(libraries:Library[],library:Library):Library[]{return libraries.map(l=>l.id===library.id?library:l);}
export async function fetchLibrary(url:string):Promise<Library>{
 if(!/^https?:\/\//.test(url))throw Error('Enter an http:// or https:// address.');
 const response=await fetch(url,{cache:'no-store'});
 if(!response.ok)throw Error(`The server answered ${response.status}.`);
 const text=await response.text();if(text.length>2_000_000)throw Error('Library file exceeds the 2 MB limit.');
 return asShared(parseLibrary(text),url);
}
