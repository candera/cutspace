import {calculate} from './model.ts';
import type {Machine,Operation,Result,Tool} from './model.ts';
import {setupFor} from './experiment.ts';
import type {Configuration} from './experiment.ts';
import type {Library,ProvenanceSource,RecipeItem} from './library.ts';
import {toolLabel} from './libraryView.ts';
import type {Units} from './units.ts';

/** What the guided start asks for: ids resolve against the loaded libraries, the tool is carried by value. */
export interface WizardChoice {machineId:string;materialId:string;tool:Tool;operation:Operation}
export type MachineRelation='same'|'similar'|'different';
export type MatchTier='exact'|'related';
export interface RecipeMatch {
 library:Library;recipe:RecipeItem;tier:MatchTier;machine:MachineRelation;
 /** Why this recipe is offered, and what differs from the choice; plain sentences for the result screen. */
 reasons:string[];differences:string[];
 /** The recipe's own cut evaluated with its own stored configuration and limits. */
 own:Result;
 /** For a similar machine: the recipe's cut evaluated with the chosen machine's profile instead. */
 onYourMachine?:Result;
 score:number;
}
export const MAX_MATCHES=8;
const within=(a:number,b:number,tol:number)=>Math.abs(a-b)<=tol*Math.max(Math.abs(a),Math.abs(b));
const sameName=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase();
/**
 * Same: identical id, identical name, or every capacity value within 2% (recipes exported from a personal library keep
 * `lib:personal/...` ids, so a shared copy of the same library never matches by id alone). Similar: overlapping RPM
 * ranges with power and feed limit each within a 0.7–1.4 ratio.
 */
export function machineRelation(id:string,m:Machine,recipeId:string,r:Machine):MachineRelation{
 if(id===recipeId||sameName(m.name,r.name))return 'same';
 if((['rpmMin','rpmMax','feedMax','power','torque'] as const).every(k=>within(m[k],r[k],.02)))return 'same';
 const overlap=Math.min(m.rpmMax,r.rpmMax)>=Math.max(m.rpmMin,r.rpmMin),ratio=(a:number,b:number)=>{const q=a/b;return q>=.7&&q<=1.4;};
 return overlap&&ratio(m.power,r.power)&&ratio(m.feedMax,r.feedMax)?'similar':'different';
}
const PROVENANCE_RANK:Record<ProvenanceSource,number>={measured:0,user:1,manufacturer:2,illustrative:3};
/**
 * Recipes in any loaded library that fit the choice: same workpiece and cutter material, the same or a similar machine,
 * and a tool within 25% in diameter. Exact means same machine, same diameter (within 2%), same flute count and the same
 * geometry class; everything else that survives is related and explains its differences. Sorted best first, deterministic.
 */
export function matchRecipes(libraries:Library[],choice:WizardChoice,config:Configuration,units:Units='metric'):RecipeMatch[]{
 const out:RecipeMatch[]=[],myTool=toolLabel(choice.tool,units);
 for(const library of libraries)for(const recipe of library.recipes){
  const s=recipe.snapshot,c=s.config;
  if(!(s.materialId===choice.materialId||sameName(c.material.name,config.material.name))||c.tool.material!==choice.tool.material)continue;
  const machine=machineRelation(choice.machineId,config.machine,s.machineId,c.machine);
  if(machine==='different')continue;
  const dRel=Math.abs(c.tool.diameter-choice.tool.diameter)/choice.tool.diameter,dSame=dRel<=.02||Math.abs(c.tool.diameter-choice.tool.diameter)<=.05;
  if(!dSame&&dRel>.25)continue;
  const flutesSame=c.tool.flutes===choice.tool.flutes,geometrySame=c.tool.geometry===choice.tool.geometry,tier:MatchTier=machine==='same'&&dSame&&flutesSame&&geometrySame?'exact':'related';
  const reasons:string[]=[],differences:string[]=[];
  reasons.push(machine==='same'?`Same machine (${c.machine.name})`:`Similar machine: recorded on ${c.machine.name}`);
  if(machine!=='same')differences.push(`Recorded on ${c.machine.name}, not ${config.machine.name}; loading it switches to that machine profile`);
  reasons.push(`Same workpiece (${c.material.name})`);
  if(dSame&&flutesSame&&geometrySame)reasons.push(`Same tool: ${myTool}`);else differences.push(`Recipe used a ${toolLabel(c.tool,units)}; you chose a ${myTool}`);
  if(c.limits.operation!==choice.operation)differences.push(`Saved as ${c.limits.operation}; you chose ${choice.operation}`);
  const ownSetup=setupFor(s),own=calculate(ownSetup.cut,ownSetup);
  const onYourMachine=machine==='similar'?calculate(ownSetup.cut,{...ownSetup,machine:config.machine}):undefined;
  const score=(tier==='exact'?0:1000)+dRel*100+Math.abs(c.tool.flutes-choice.tool.flutes)*10+(geometrySame?0:20)+(c.limits.operation!==choice.operation?5:0)+PROVENANCE_RANK[recipe.provenance.source];
  out.push({library,recipe,tier,machine,reasons,differences,own,...(onYourMachine?{onYourMachine}:{}),score});
 }
 out.sort((a,b)=>a.score-b.score||b.recipe.updatedAt.localeCompare(a.recipe.updatedAt)||a.recipe.id.localeCompare(b.recipe.id));
 return out.slice(0,MAX_MATCHES);
}
