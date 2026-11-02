import {chipScale,cuttingPreset,fluteScale,OPERATION_INFO} from './cuttingPresets.ts';
import {fitView,MATERIALS,parseExperiment,setOperation} from './experiment.ts';
import type {Configuration,Experiment,MaterialId,Point} from './experiment.ts';
import {findMachine,findMaterial,limitsFromMaterialItem,machineFromItem,materialFromItem,PROVENANCE_LABEL} from './library.ts';
import type {Library,RecipeItem} from './library.ts';
import {CUTTER_MATERIALS} from './model.ts';
import type {Limits,Material} from './model.ts';
import type {WizardChoice} from './recipeMatch.ts';
import {toolLabel} from './libraryView.ts';
import {fmt} from './units.ts';
import type {Units} from './units.ts';

/** The configuration a guided-start choice resolves to, plus a sentence saying where its cutting limits came from. */
export function buildConfiguration(libraries:Library[],choice:WizardChoice,e:Experiment):{config:Configuration;limitsBasis:string}{
 const current=e.config.limits,tool={...choice.tool},cutter=CUTTER_MATERIALS[tool.material].name;
 const foundMachine=findMachine(libraries,choice.machineId);
 const machine=foundMachine?machineFromItem(foundMachine.item):choice.machineId===e.machineId?{...e.config.machine}:null;
 if(!machine)throw Error('The chosen machine is not in any library.');
 let material:Material,limits:Limits,limitsBasis:string;
 if(Object.hasOwn(MATERIALS,choice.materialId)){
  const id=choice.materialId as MaterialId;
  material={name:MATERIALS[id].name,kc:MATERIALS[id].kc,powerFactor:1.25,forceFactor:1.3,known:true};
  limits=cuttingPreset(id,tool.material,{caution:current.caution,diameter:tool.diameter,flutes:tool.flutes,operation:choice.operation});
  limitsBasis=`Provisional preset for ${cutter} / ${material.name}: Cutspace's 6 mm two-flute example chip band scaled ×${fmt(chipScale(tool.diameter),2)} for diameter and ×${fmt(fluteScale(tool.flutes),2)} for ${tool.flutes} flute${tool.flutes===1?'':'s'}, with the ${OPERATION_INFO[choice.operation].label.toLowerCase()} deflection allowance (×${OPERATION_INFO[choice.operation].deflection}). Example values, not tool-maker data.`;
 }else{
  const found=findMaterial(libraries,choice.materialId);
  if(found){
   material=materialFromItem(found.item);
   limits=limitsFromMaterialItem(found.item,tool.material,{...current,operation:choice.operation});
   const note=found.item.provenance.note;
   limitsBasis=limits.cuttingDataKnown?`Cutting starter stored with ${found.item.name} in ${found.library.name} (${PROVENANCE_LABEL[found.item.provenance.source]})${note?`: ${note}`:'.'}`:`${found.item.name} has no chip or surface-speed data for ${cutter}, so those checks are off.`;
  }else if(choice.materialId===e.materialId){
   material={...e.config.material};limits={...current,operation:choice.operation};
   limitsBasis='This material came from a file without a matching library entry; its current limits were kept.';
  }else throw Error('The chosen material is not in any library.');
 }
 return {config:{tool,material,machine,limits},limitsBasis};
}
export type WizardPick={kind:'recipe';recipe:RecipeItem}|{kind:'computed';point:Point}|{kind:'none'};
export const experimentName=(c:Configuration,units:Units)=>`${c.material.name} · ${toolLabel(c.tool,units)} on ${c.machine.name}`.slice(0,120);
/**
 * The experiment the guided start hands to the explorer. A recipe pick reproduces the recipe's snapshot (then applies the chosen
 * operation); a computed pick applies the resolved configuration and the solver's point; none applies the configuration and
 * leaves the cut alone. Display units are the user's, not the recipe's. The result is validated like any other edit.
 */
export function buildExperiment(e:Experiment,libraries:Library[],choice:WizardChoice,pick:WizardPick,units:Units):{experiment:Experiment;notice:string}{
 let next:Experiment;
 if(pick.kind==='recipe'){
  const s=pick.recipe.snapshot;
  next={...structuredClone(e),machineId:s.machineId,materialId:s.materialId,config:structuredClone(s.config),point:{...s.point},name:pick.recipe.name};
  setOperation(next,choice.operation);
 }else{
  const {config}=buildConfiguration(libraries,choice,e);
  next={...structuredClone(e),machineId:choice.machineId,materialId:choice.materialId,config,name:experimentName(config,units)};
  if(pick.kind==='computed')next.point={...pick.point};
 }
 next.view=fitView(next);next.view.fixed=false;
 const experiment=parseExperiment(JSON.stringify(next));
 const notice=pick.kind==='recipe'?`Started from the saved cut “${pick.recipe.name}”.`:pick.kind==='computed'?'Started from a point inside your configured limits.':'Machine, tool and workpiece applied; the cut itself was left unchanged.';
 return {experiment,notice:`${notice} Undo restores your previous experiment.`};
}
