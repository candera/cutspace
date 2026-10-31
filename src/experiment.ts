import {cuttingPreset,CUTTING_PRESET_VERSION,OPERATION_INFO} from './cuttingPresets.ts';
import {cloneDefaults, MODEL_VERSION, CUTTER_MATERIALS} from './model.ts';
import type {Setup, Metric, CutterMaterial, Operation} from './model.ts';
import type {Units} from './units.ts';
const RC4_PROFILE={name:'ShopSabre RC4',rpmMin:6000,rpmMax:24000,feedMax:10000,power:1500,torque:.9,utilization:.75,known:true};
export const MACHINES={
 dmc2:{name:'DMC2 Mini',rpmMin:10000,rpmMax:24000,feedMax:10000,power:2200,torque:.875,utilization:.75,known:true},
 rc4:{...RC4_PROFILE},
 bigblue:{...RC4_PROFILE,name:'Big Blue'},
 'desktop-mill-example':{name:'Desktop mill (example)',rpmMin:2000,rpmMax:10000,feedMax:2500,power:500,torque:.6,utilization:.75,known:true},
 'hobby-router-example':{name:'Hobby router (example)',rpmMin:10000,rpmMax:30000,feedMax:5000,power:900,torque:.4,utilization:.75,known:true},
 'industrial-router-example':{name:'4×4 industrial router (example)',rpmMin:6000,rpmMax:24000,feedMax:15000,power:3000,torque:1.6,utilization:.75,known:true},
};
/** All capacities and coefficients below are fictional demonstration inputs, not specifications. */
export const MATERIALS={
 aluminum:{name:'Aluminum · 6061',kc:1000,note:'Illustrative effective coefficient; alloy/temper and tool data require qualification.'},
 plywood:{name:'Plywood',kc:100,note:'Uncalibrated generic panel assumption. Product, layup, grain and orientation are not modeled.'},
 softwood:{name:'Soft wood',kc:80,note:'Uncalibrated demonstration coefficient; species, moisture and grain direction are not modeled.'},
 hardwood:{name:'Hard wood',kc:150,note:'Uncalibrated demonstration coefficient; species, moisture and grain direction are not modeled.'},
 steel:{name:'Mild steel',kc:1800,note:'Uncalibrated effective coefficient; grade, tool and cutting-condition data required.'},
 brass:{name:'Brass',kc:850,note:'Uncalibrated effective coefficient; alloy, condition and tool data required.'},
};
export type MachineId=keyof typeof MACHINES;
export type MaterialId=keyof typeof MATERIALS;
export type Configuration=Omit<Setup,'cut'>;
export interface Point {rpm:number;feed:number;docRatio:number;wocRatio:number}
/** Machine and material ids are built-in ids, or lib:<library>/<item> references; the config snapshot always carries the values used. */
export interface Snapshot {machineId:string;materialId:string;config:Configuration;point:Point}
export type Overlay='none'|'mrr'|'utilization'|'chipMax'|'chip'|'deflection';
export type ContourDensity='coarse'|'standard'|'fine';
export type ColorScheme='safety'|'teal';
export interface View {fill:Metric;overlay:Overlay;colorScheme:ColorScheme;contourDensity?:ContourDensity;physicalAxes:boolean;fixed:boolean;scaleMin:number;scaleMax:number;rpmMin:number;rpmMax:number;feedMax:number;wocMax:number;docMax:number;feedMin?:number;wocMin?:number;docMin?:number}
export interface Experiment extends Snapshot {schemaVersion:2;modelVersion:typeof MODEL_VERSION;name:string;units:Units;view:View;pins:Snapshot[];provenance:'illustrative / user overrides';}
export function fresh():Experiment{
 const s=cloneDefaults();s.limits=cuttingPreset('aluminum','carbide',{diameter:s.tool.diameter,flutes:s.tool.flutes});const {cut,...config}=s;
 return {schemaVersion:2,modelVersion:MODEL_VERSION,name:'Untitled exploration',machineId:'dmc2',materialId:'aluminum',config,point:{rpm:cut.rpm,feed:cut.feed,docRatio:.5,wocRatio:.2},units:'metric',view:{fill:'mrr',overlay:'utilization',colorScheme:'safety',contourDensity:'standard',physicalAxes:true,fixed:false,scaleMin:0,scaleMax:10,rpmMin:1500,rpmMax:19800,feedMax:3600,wocMax:100,docMax:275},pins:[],provenance:'illustrative / user overrides'};
}
/** Built-in materials load explicit provisional limits. A custom material needs its library cutting data supplied by the caller. */
export function applyCuttingPreset(e:Experiment){
 if(!Object.hasOwn(MATERIALS,e.materialId)){e.config.limits.cuttingDataKnown=false;delete e.config.limits.preset;return;}
 e.config.limits=cuttingPreset(e.materialId as MaterialId,e.config.tool.material,{caution:e.config.limits.caution,diameter:e.config.tool.diameter,flutes:e.config.tool.flutes,operation:e.config.limits.operation});
}
/** Switching operation rescales the deflection allowance; a preset is re-applied, custom values keep their ratio. */
export function setOperation(e:Experiment,operation:Operation){
 const previous=e.config.limits.operation;if(previous===operation)return;
 e.config.limits.operation=operation;
 if(e.config.limits.preset)applyCuttingPreset(e);
 else e.config.limits.deflection=Number((e.config.limits.deflection*OPERATION_INFO[operation].deflection/OPERATION_INFO[previous].deflection).toPrecision(6));
}
export function editLimit(e:Experiment,key:keyof Configuration['limits'],value:number|boolean){
 (e.config.limits as unknown as Record<string,unknown>)[key]=value;
 if(key!=='caution'&&key!=='operation')delete e.config.limits.preset;
}
export function setCutterMaterial(e:Experiment,material:CutterMaterial){
 if(e.config.tool.material===material)return;
 e.view.fixed=false;
 e.config.tool.material=material;
 e.config.tool.modulus=CUTTER_MATERIALS[material].modulus;
 applyCuttingPreset(e);
}
export function setWorkpieceMaterial(e:Experiment,id:MaterialId){
 const changed=e.materialId!==id;
 e.materialId=id;
 e.config.material={name:MATERIALS[id].name,kc:MATERIALS[id].kc,powerFactor:1.25,forceFactor:1.3,known:true};
 if(changed){e.view.fixed=false;applyCuttingPreset(e);}
}
export function setupFor(s:Snapshot):Setup{return {...s.config,cut:{rpm:s.point.rpm,feed:s.point.feed,doc:s.point.docRatio*s.config.tool.diameter,woc:s.point.wocRatio*s.config.tool.diameter}};}
export function snapshot(e:Snapshot):Snapshot{return structuredClone({machineId:e.machineId,materialId:e.materialId,config:e.config,point:e.point});}
export function fitView(e:Experiment):View{return {...e.view,feedMin:0,wocMin:0,docMin:0,rpmMin:Math.max(1,Math.min(e.config.machine.rpmMin*.5,e.point.rpm*.95)),rpmMax:Math.min(200000,Math.max(e.config.machine.rpmMax*1.1,e.point.rpm*1.05)),feedMax:Math.min(200000,Math.max(e.config.machine.feedMax*1.2,e.point.feed*1.05)),wocMax:Math.min(200,Math.max(100,e.point.wocRatio*105)),docMax:Math.min(10000,Math.max(100,e.config.tool.fluteLength/e.config.tool.diameter*110,e.point.docRatio*105))};}
function object(x:unknown):Record<string,unknown>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Expected an object.');return x as Record<string,unknown>;}
function num(o:Record<string,unknown>,k:string,min:number,max:number){const n=o[k];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error(`${k} must be between ${min} and ${max}.`);return n;}
function known(o:Record<string,unknown>){if(typeof o.known!=='boolean')throw Error('Missing model availability flag.');return o.known;}
export function readSnapshot(value:unknown,legacy=false):Snapshot{
 const s=object(value),c=object(s.config),t=object(c.tool),m=object(c.machine),a=object(c.material),l=object(c.limits),p=object(s.point);
 if(typeof s.machineId!=='string'||!s.machineId.trim()||s.machineId.length>200)throw Error('Unsupported machine reference.');
 if(typeof s.materialId!=='string'||!s.materialId.trim()||s.materialId.length>200)throw Error('Unsupported material reference.');
 const machineId=s.machineId,materialId=s.materialId;
 const machineName=Object.hasOwn(MACHINES,machineId)?MACHINES[machineId as MachineId].name:m.name;
 if(typeof machineName!=='string'||!machineName.trim()||machineName.length>120)throw Error('This machine is not built in and the file does not name it.');
 const materialName=Object.hasOwn(MATERIALS,materialId)?MATERIALS[materialId as MaterialId].name:a.name;
 if(typeof materialName!=='string'||!materialName.trim()||materialName.length>120)throw Error('This material is not built in and the file does not name it.');
 const cutterMaterial=legacy?'carbide':t.material;
 if(typeof cutterMaterial!=='string'||!Object.hasOwn(CUTTER_MATERIALS,cutterMaterial))throw Error('Unsupported cutter material. Choose Carbide or HSS.');
 if(!legacy&&typeof l.cuttingDataKnown!=='boolean')throw Error('Missing chip and surface-speed limit availability.');
 const tool={material:cutterMaterial as CutterMaterial,diameter:num(t,'diameter',.1,200),flutes:num(t,'flutes',1,24),stickout:num(t,'stickout',.1,500),fluteLength:num(t,'fluteLength',.1,500),modulus:num(t,'modulus',1,1000),stiffness:num(t,'stiffness',.01,1),...(t.maxRpm===undefined?{}:{maxRpm:num(t,'maxRpm',0,200000)})};
 if(!Number.isInteger(tool.flutes))throw Error('Flutes must be a whole number.');
 const machine={name:machineName,rpmMin:num(m,'rpmMin',1,100000),rpmMax:num(m,'rpmMax',2,200000),feedMax:num(m,'feedMax',1,200000),power:num(m,'power',.1,100000),torque:num(m,'torque',.001,1000),utilization:num(m,'utilization',.01,1),known:known(m)};
 if(machine.rpmMin>=machine.rpmMax)throw Error('Minimum RPM must be less than maximum RPM.');
 const material={name:materialName,kc:num(a,'kc',1,10000),powerFactor:num(a,'powerFactor',1,5),forceFactor:num(a,'forceFactor',1,5),known:known(a)};
 if(l.preset!==undefined&&l.preset!==CUTTING_PRESET_VERSION)throw Error('Unknown cutting-limit preset version.');
 const limits={...(l.preset===CUTTING_PRESET_VERSION?{preset:CUTTING_PRESET_VERSION}:{}),cuttingDataKnown:legacy?true:l.cuttingDataKnown as boolean,chipMin:num(l,'chipMin',.00001,1),chipMax:num(l,'chipMax',.00002,5),deflection:num(l,'deflection',.01,5000),surfaceMax:num(l,'surfaceMax',1,10000),caution:l.caution===undefined?.75:num(l,'caution',.1,.99),operation:(l.operation===undefined?'roughing':l.operation) as Operation};
 if(limits.operation!=='roughing'&&limits.operation!=='finishing')throw Error('Operation must be roughing or finishing.');
 if(limits.chipMin>=limits.chipMax)throw Error('Minimum chip thickness must be less than maximum.');
 return {machineId,materialId,config:{tool,machine,material,limits},point:{rpm:num(p,'rpm',1,200000),feed:num(p,'feed',0,200000),docRatio:num(p,'docRatio',0,100),wocRatio:num(p,'wocRatio',0,2)}};
}
const OLD_DMC2={name:'DMC2 Mini',rpmMin:3000,rpmMax:18000,feedMax:3000,power:250,torque:.3,utilization:.75,known:true};
function migrateMachineProfile(snapshot:Snapshot,modelVersion:unknown){
 if(!['illustrative-static-2','illustrative-static-3','illustrative-static-4'].includes(String(modelVersion))||snapshot.machineId!=='dmc2')return snapshot;
 if(Object.entries(OLD_DMC2).every(([key,value])=>snapshot.config.machine[key as keyof typeof OLD_DMC2]===value))snapshot.config.machine={...MACHINES.dmc2};
 return snapshot;
}
export function parseExperiment(text:string):Experiment{
 const o=object(JSON.parse(text));if(o.schemaVersion!==2)throw Error('Unsupported file version. This prototype imports version 2 experiments only.');
 const legacy=o.modelVersion==='illustrative-static-2',previous=legacy||o.modelVersion==='illustrative-static-3'||o.modelVersion==='illustrative-static-4';
 if(!previous&&o.modelVersion!==MODEL_VERSION)throw Error('Model version does not match. No automatic reinterpretation was performed.');
 if(typeof o.name!=='string'||o.name.length>120)throw Error('Experiment name must be 120 characters or fewer.');
 if(o.units!=='metric'&&o.units!=='imperial')throw Error('Unsupported unit system.');
 const v=object(o.view);if(!['mrr','power','chip','chipMax','deflection','utilization','margin','constraint','zone'].includes(String(v.fill)))throw Error('Unknown fill metric.');
 if(!['none','mrr','utilization','chipMax','chip','deflection'].includes(String(v.overlay)))throw Error('Unknown contour metric.');
 const colorScheme=v.colorScheme??'safety';if(colorScheme!=='safety'&&colorScheme!=='teal')throw Error('Unknown color scheme.');
 if(v.contourDensity!==undefined&&(typeof v.contourDensity!=='string'||!['coarse','standard','fine'].includes(v.contourDensity)))throw Error('Unknown contour spacing.');
 if(typeof v.fixed!=='boolean'||typeof v.physicalAxes!=='boolean')throw Error('Invalid view settings.');
 const view:View={fill:v.fill as Metric,overlay:v.overlay as Overlay,colorScheme,...(v.contourDensity===undefined?{}:{contourDensity:v.contourDensity as ContourDensity}),physicalAxes:v.physicalAxes,fixed:v.fixed,scaleMin:num(v,'scaleMin',-1e9,1e9),scaleMax:num(v,'scaleMax',-1e9,1e9),rpmMin:num(v,'rpmMin',1,199999),rpmMax:num(v,'rpmMax',2,200000),feedMax:num(v,'feedMax',1,200000),wocMax:num(v,'wocMax',1,200),docMax:num(v,'docMax',1,10000),...(v.feedMin===undefined?{}:{feedMin:num(v,'feedMin',0,199999)}),...(v.wocMin===undefined?{}:{wocMin:num(v,'wocMin',0,199)}),...(v.docMin===undefined?{}:{docMin:num(v,'docMin',0,9999)})};
 if(view.feedMax<=(view.feedMin??0)||view.wocMax<=(view.wocMin??0)||view.docMax<=(view.docMin??0)||view.scaleMax<=view.scaleMin||view.rpmMax<=view.rpmMin)throw Error('Scale and axis maximums must exceed minimums.');
 if(!Array.isArray(o.pins)||o.pins.length>3)throw Error('At most three comparison points are supported.');
 return {...migrateMachineProfile(readSnapshot(o,legacy),o.modelVersion),schemaVersion:2,modelVersion:MODEL_VERSION,name:o.name,units:o.units,view,pins:o.pins.map(p=>migrateMachineProfile(readSnapshot(p,legacy),o.modelVersion)),provenance:'illustrative / user overrides'};
}
export const STORAGE_KEY='cutspace-experiment-v2';
