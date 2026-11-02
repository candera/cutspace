import {useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import Field from './Field';
import ToolDrawing from './ToolDrawing';
import {explain,wizardHelp} from './help';
import {MATERIALS} from './experiment';
import type {Configuration,Experiment,Point} from './experiment';
import {findMachine,findMaterial,machineRefId,PROVENANCE_LABEL} from './library';
import type {Library,MachineItem,ToolItem} from './library';
import {toolLabel} from './libraryView';
import {constraintInfo,CUTTER_MATERIALS,BODY_MATERIALS,GEOMETRIES,toolNotices,withBody,withCutterMaterial,withDiameter} from './model';
import type {BodyMaterial,CutterMaterial,Geometry,Operation,Result,Tool} from './model';
import {noticeText} from './limitGuidance';
import {OPERATION_INFO} from './cuttingPresets';
import {matchRecipes} from './recipeMatch';
import type {RecipeMatch,WizardChoice} from './recipeMatch';
import {startingPoint} from './startingPoint';
import type {StartingPointOutcome} from './startingPoint';
import {buildConfiguration,buildExperiment} from './wizardApply';
import type {WizardPick} from './wizardApply';
import {fmt,toDisplay,unit} from './units';
import type {Units} from './units';

interface Props {libraries:Library[];experiment:Experiment;units:Units;onApply:(experiment:Experiment,notice:string)=>void;notify:(message:string)=>void}
type Outcome={error:string;config?:undefined}|{error?:undefined;config:Configuration;limitsBasis:string;matches:RecipeMatch[];solved:StartingPointOutcome};
const STEPS=['Machine','Tool','Workpiece','Operation','Result'];

/** Guided start: four questions, then a starting point drawn from matching library recipes or derived from the configured limits. Internal state lives only while the dialog is open. */
export default function Wizard({libraries,experiment:e,units:u,onApply,notify}:Props){
 const [step,setStep]=useState(0);
 const [machineId,setMachineId]=useState(()=>findMachine(libraries,e.machineId)?e.machineId:'');
 const [tool,setTool]=useState<Tool>(()=>({...e.config.tool}));
 const [toolItem,setToolItem]=useState<{library:Library;item:ToolItem}|null>(null);
 const [materialId,setMaterialId]=useState(()=>Object.hasOwn(MATERIALS,e.materialId)||findMaterial(libraries,e.materialId)?e.materialId:'');
 const [operation,setOperation]=useState<Operation>(e.config.limits.operation);
 const cutter=CUTTER_MATERIALS[tool.material].name;
 const outcome=useMemo<Outcome|null>(()=>{
  if(step!==4)return null;
  const choice:WizardChoice={machineId,materialId,tool,operation};
  try{const {config,limitsBasis}=buildConfiguration(libraries,choice,e);return {config,limitsBasis,matches:matchRecipes(libraries,choice,config,u),solved:startingPoint(config,u)};}
  catch(err){return {error:err instanceof Error?err.message:String(err)};}
 },[step,libraries,machineId,materialId,tool,operation,e,u]);

 const len=(x:number,d=u==='imperial'?3:2)=>`${fmt(toDisplay(x,'length',u),d)} ${unit('length',u)}`;
 const describeMachine=(m:MachineItem)=>`${fmt(m.machine.rpmMin,0)}–${fmt(m.machine.rpmMax,0)} RPM · ${fmt(toDisplay(m.machine.power,'power',u),u==='imperial'?2:0)} ${unit('power',u)} · feed ≤ ${fmt(toDisplay(m.machine.feedMax,'feed',u),0)} ${unit('feed',u)}`;
 const describeTool=(t:Tool)=>`stickout ${len(t.stickout,u==='imperial'?2:1)} · flute length ${len(t.fluteLength,u==='imperial'?2:1)}${t.shankDiameter!==t.diameter?` · ${len(t.shankDiameter,u==='imperial'?3:2)} shank`:''}${t.upcutLength?` · ${len(t.upcutLength,u==='imperial'?2:1)} upcut`:''}${t.maxRpm?` · max ${fmt(t.maxRpm,0)} RPM`:''}`;
 const setToolField=(patch:Partial<Tool>)=>{setTool(t=>({...t,...patch}));setToolItem(null);return null;};
 const updateTool=(f:(t:Tool)=>Tool)=>{setTool(f);setToolItem(null);return null;};
 const geometry=GEOMETRIES[tool.geometry];
 const apply=(pick:WizardPick)=>{try{const {experiment,notice}=buildExperiment(e,libraries,{machineId,materialId,tool,operation},pick,u);onApply(experiment,notice);}catch(err){notify(`Could not apply this choice: ${err instanceof Error?err.message:String(err)}`);}};
 const canNext=step===0?!!machineId:step===2?!!materialId:true;

 const zoneBadge=(r:Result,prefix:string)=>{
  if(r.status==='inside')return <span className={`zone${r.zone==='caution'?' caution':''}`}>{prefix}: {r.zone==='caution'?'caution, near a soft limit':'within the limits'}</span>;
  const over=r.constraints.filter(c=>c.ratio>1).map(c=>`${constraintInfo[c.key].label.toLowerCase()} ${fmt(c.ratio*100,0)}%`);
  return <span className="zone outside">{prefix}: {r.status==='outside'?`outside (${over.join(', ')})`:r.status==='unknown'?'some checks unavailable':r.status==='no-cut'?'no material removal':'invalid engagement'}</span>;
 };
 const values=(point:Point,t:Tool)=>{
  const chip=point.feed/(point.rpm*t.flutes);
  return <div className="result-values">
   <div><span>Spindle speed</span><strong>{fmt(point.rpm,0)}<small>RPM</small></strong></div>
   <div><span>Feedrate</span><strong>{fmt(toDisplay(point.feed,'feed',u),0)}<small>{unit('feed',u)}</small></strong></div>
   <div><span>Chipload</span><strong>{fmt(toDisplay(chip,'chip',u),u==='imperial'?4:3)}<small>{unit('chip',u)}</small></strong></div>
   <div><span>Stepover (WOC)</span><strong>{fmt(point.wocRatio*100,0)}<small>%D</small></strong><em>{len(point.wocRatio*t.diameter)}</em></div>
   <div><span>Depth of cut (DOC)</span><strong>{fmt(point.docRatio*100,0)}<small>%D</small></strong><em>{len(point.docRatio*t.diameter)}</em></div>
  </div>;
 };
 const result=outcome&&outcome.config?outcome:null;
 const recipeCard=(m:RecipeMatch)=><article key={`${m.library.id}/${m.recipe.id}`} className="result-card recipe" data-help={wizardHelp.recipe}>
  <header><b>{m.recipe.name}</b><small>{m.library.name} · {PROVENANCE_LABEL[m.recipe.provenance.source]}</small></header>
  {values(m.recipe.snapshot.point,m.recipe.snapshot.config.tool)}
  <div>{zoneBadge(m.own,'Against its stored limits')}{m.onYourMachine&&zoneBadge(m.onYourMachine,`On ${result?result.config.machine.name:'your machine'}`)}</div>
  <ul>{m.reasons.map(r=><li key={r}>{r}</li>)}{m.differences.map(d=><li key={d} className="differs">{d}</li>)}</ul>
  {m.recipe.notes&&<p>{m.recipe.notes}</p>}
  {m.recipe.provenance.note&&<p><small>{m.recipe.provenance.note}</small></p>}
  <div className="actions"><button className="primary" {...explain(wizardHelp.apply)} onClick={()=>apply({kind:'recipe',recipe:m.recipe})}>Start from this cut</button></div>
 </article>;

 const exact=result?.matches.filter(m=>m.tier==='exact')??[],related=result?.matches.filter(m=>m.tier==='related')??[];
 const machineFound=findMachine(libraries,machineId),materialFound=findMaterial(libraries,materialId),builtinMaterial=Object.hasOwn(MATERIALS,materialId);
 const solved=result?.solved;

 return <>
  <div className="wizard-body" data-help={wizardHelp.dialog}>
   <ol className="wizard-steps" aria-label="Steps">{STEPS.map((s,i)=><li key={s} className={i<step?'done':''} aria-current={i===step?'step':undefined}>{i+1}. {s}</li>)}</ol>
   {step===0&&<section aria-labelledby="gs-machine" data-help={wizardHelp.machine}>
    <h3 id="gs-machine">What machine are you using?</h3>
    <p>Its speed range, feed limit and spindle curve bound everything else. Library machines carry provenance notes saying where their numbers came from.</p>
    {libraries.filter(l=>l.machines.length).map(lib=><div key={lib.id}><h4>{lib.kind==='builtin'?'Generic examples · pick the closest, edit later':lib.name}</h4><div className="choice-list">{lib.machines.map(item=>{const id=machineRefId(lib.id,item.id);return <button key={id} className="choice" aria-pressed={machineId===id} {...explain(`${item.name}: ${describeMachine(item)}. ${item.provenance.note??''}`)} onClick={()=>setMachineId(id)}><b>{item.name}</b><small>{describeMachine(item)}</small><em>{PROVENANCE_LABEL[item.provenance.source]}</em></button>;})}</div></div>)}
    <p className="wizard-note">Not listed? Pick the generic example that is closest. You can edit its numbers in Model &amp; limits → Machine afterwards and save it to My library, or add a shared library such as a makerspace list in the Library tab.</p>
   </section>}
   {step===1&&<section aria-labelledby="gs-tool" data-help={wizardHelp.tool}>
    <h3 id="gs-tool">What bit or end mill?</h3>
    <p>Pick a saved tool or enter yours. Every class is evaluated as a straight-fluted cylinder of its cutting diameter; the geometry names the bit, shapes the starting point and carries shop notes. Carbide-tipped bits are modelled with their steel body and actual shank.</p>
    <h4>Geometry</h4>
    <div className="geometry-toggle" role="group" aria-label="Cutter geometry">{(Object.keys(GEOMETRIES) as Geometry[]).map(id=><button key={id} aria-pressed={tool.geometry===id} {...explain(`${GEOMETRIES[id].label}: ${GEOMETRIES[id].note}`)} onClick={()=>updateTool(t=>({...t,geometry:id,...(id==='compression'?{}:{upcutLength:undefined})}))}>{GEOMETRIES[id].label}</button>)}</div>
    <p className={`wizard-note${geometry.modelled==='as-flat'?' caution':''}`}>{geometry.note}</p>
    <h4>Cutting-edge material and body</h4>
    <div className="cutter-toggle" role="group" aria-label="Cutter material">{Object.entries(CUTTER_MATERIALS).map(([id,m])=><button key={id} aria-pressed={tool.material===id} {...explain(wizardHelp.cutter)} onClick={()=>updateTool(t=>withCutterMaterial(t,id as CutterMaterial))}>{m.name}</button>)}</div>
    <div className="cutter-toggle" role="group" aria-label="Body material">{(Object.keys(BODY_MATERIALS) as BodyMaterial[]).filter(id=>id!=='hss'||tool.material==='hss').map(id=><button key={id} aria-pressed={tool.body===id} {...explain(wizardHelp.body)} onClick={()=>updateTool(t=>withBody(t,id))}>{BODY_MATERIALS[id].name}</button>)}</div>
    {libraries.filter(l=>l.tools.length).map(lib=><div key={lib.id}><h4>{lib.kind==='builtin'?'Starter tools':lib.name}</h4><div className="choice-list">{lib.tools.map(item=><button key={item.id} className="choice" aria-pressed={toolItem?.item===item} {...explain(`${item.name}: ${toolLabel(item.tool,u)}, ${describeTool(item.tool)}. ${item.provenance.note??''}`)} onClick={()=>{setTool({...item.tool});setToolItem({library:lib,item});}}><b>{item.name}</b><small>{toolLabel(item.tool,u)} · {describeTool(item.tool)}</small><em>{PROVENANCE_LABEL[item.provenance.source]}</em></button>)}</div></div>)}
    <h4>{toolItem?'Adjust it':'Or enter it yourself'}</h4>
    <div className="wizard-fields">
     <Field label="Diameter" value={tool.diameter} quantity="length" units={u} min={.1} max={200} onChange={value=>updateTool(t=>withDiameter(t,value))}/>
     <Field label="Shank diameter" value={tool.shankDiameter} quantity="length" units={u} min={.1} max={200} onChange={value=>setToolField({shankDiameter:value})}/>
     <Field label="Flutes" value={tool.flutes} min={1} max={24} integer onChange={value=>setToolField({flutes:value})}/>
     <Field label="Stickout" value={tool.stickout} quantity="length" units={u} min={.1} max={500} onChange={value=>setToolField({stickout:value})}/>
     <Field label="Flute length" value={tool.fluteLength} quantity="length" units={u} min={.1} max={500} onChange={value=>setToolField({fluteLength:value})}/>
     {tool.geometry==='compression'&&<Field label="Upcut length" value={tool.upcutLength??0} quantity="length" units={u} min={0} max={tool.fluteLength} onChange={value=>setToolField(value>0?{upcutLength:value}:{upcutLength:undefined})}/>}
     <Field label="Tool max RPM" value={tool.maxRpm??0} min={0} max={200000} suffix="RPM" onChange={value=>setToolField(value>0?{maxRpm:value}:{maxRpm:undefined})}/>
    </div>
    <ToolDrawing tool={tool} units={u}/>
    <p className="wizard-note">Current choice: {toolLabel(tool,u)}, {describeTool(tool)}. Measure stickout from the collet face to the tip and flute length on the actual tool; fractions such as 1/4 are accepted.{tool.geometry==='compression'&&!tool.upcutLength?' Enter the upcut length so the starting depth can cover it.':''}</p>
   </section>}
   {step===2&&<section aria-labelledby="gs-material" data-help={wizardHelp.material}>
    <h3 id="gs-material">What are you cutting?</h3>
    <p>Built-in materials load Cutspace’s provisional cutting presets for {cutter}; library materials use their stored starters when they have one for that cutter material.</p>
    <h4>Built in</h4>
    <div className="choice-list">{Object.entries(MATERIALS).map(([id,m])=><button key={id} className="choice" aria-pressed={materialId===id} {...explain(`${m.name}. ${m.note}`)} onClick={()=>setMaterialId(id)}><b>{m.name}</b><small>{m.note}</small><em>provisional preset for {cutter}</em></button>)}</div>
    {libraries.filter(l=>l.materials.length).map(lib=><div key={lib.id}><h4>{lib.name}</h4><div className="choice-list">{lib.materials.map(item=>{const id=machineRefId(lib.id,item.id),has=!!item.cutting?.[tool.material];return <button key={id} className="choice" aria-pressed={materialId===id} {...explain(`${item.name}. ${item.provenance.note??''} ${has?`Includes a cutting starter for ${cutter}.`:`No cutting data for ${cutter}: chip and speed checks would be off.`}`)} onClick={()=>setMaterialId(id)}><b>{item.name}</b><small>{item.provenance.note??PROVENANCE_LABEL[item.provenance.source]}</small><em>{has?`cutting starter for ${cutter}`:`no cutting data for ${cutter}`}</em></button>;})}</div></div>)}
   </section>}
   {step===3&&<section aria-labelledby="gs-operation" data-help={wizardHelp.operation}>
    <h3 id="gs-operation">What kind of cut?</h3>
    <p>The same bit does both. What changes is how much tool bending you accept and how deep and wide the starting point begins.</p>
    <div className="choice-list wide">{(Object.keys(OPERATION_INFO) as Operation[]).map(op=><button key={op} className="choice" aria-pressed={operation===op} {...explain(`${OPERATION_INFO[op].label}. ${OPERATION_INFO[op].note}`)} onClick={()=>setOperation(op)}><b>{OPERATION_INFO[op].label}</b><small>{OPERATION_INFO[op].note}</small></button>)}</div>
   </section>}
   {step===4&&<section aria-labelledby="gs-result">
    <h3 id="gs-result">Your starting point</h3>
    {outcome?.error&&<p className="caution">{outcome.error}</p>}
    {result&&<>
     <p>{result.config.machine.name} · {toolLabel(tool,u)} · {result.config.material.name} · {OPERATION_INFO[operation].label.toLowerCase()}</p>
     {exact.length>0&&<><h4>Saved cuts that match your choices</h4>{exact.map(recipeCard)}</>}
     <h4>{exact.length?'Or a point derived from your limits':solved?.ok?'A starting point inside your limits':'Derived from your limits'}</h4>
     {solved?.ok?<article className="result-card" data-help={wizardHelp.startingPoint}>
      <header><b>Derived from your configured limits</b>{zoneBadge(solved.result,'Checks')}</header>
      {values(solved.point,result.config.tool)}
      {toolNotices({...result.config,cut:solved.cut}).map(n=><p key={n.key} className="caution">{noticeText(n,u)}</p>)}
      <p>Nearest soft limit: {solved.result.softLimiting?`${constraintInfo[solved.result.softLimiting.key].label.toLowerCase()} at ${fmt(solved.result.softLimiting.ratio*100,0)}%`:'none'} · estimated {fmt(toDisplay(solved.result.power,'power',u),u==='imperial'?2:0)} {unit('power',u)} spindle power, {fmt(toDisplay(solved.result.deflection,'deflection',u),u==='imperial'?4:1)} {unit('deflection',u)} tool deflection.</p>
      <details data-help={wizardHelp.derivation}><summary>How this was derived</summary><ol>{solved.steps.map((s,i)=><li key={i}>{s}</li>)}</ol><p>{result.limitsBasis}</p></details>
      <div className="actions"><button className="primary" {...explain(wizardHelp.apply)} onClick={()=>apply({kind:'computed',point:solved.point})}>Start here</button></div>
     </article>:solved&&<article className="result-card" data-help={wizardHelp.startingPoint}>
      <header><b>No starting point could be derived</b></header>
      <ul>{solved.reasons.map(r=><li key={r}>{r}</li>)}</ul>
      {solved.nearest&&<><p>The closest the solver got:</p>{values(solved.nearest.point,result.config.tool)}<div>{zoneBadge(solved.nearest.result,'Checks')}</div></>}
      {solved.steps.length>0&&<details data-help={wizardHelp.derivation}><summary>What was tried</summary><ol>{solved.steps.map((s,i)=><li key={i}>{s}</li>)}</ol><p>{result.limitsBasis}</p></details>}
      <div className="actions"><button {...explain(wizardHelp.none)} onClick={()=>apply({kind:'none'})}>Open the explorer with this setup</button></div>
     </article>}
     {related.length>0&&<details data-help={wizardHelp.related}><summary>Related saved cuts ({related.length})</summary>{related.map(recipeCard)}</details>}
     <h4>Where these numbers come from</h4>
     <dl className="provenance">
      <dt>Machine</dt><dd>{result.config.machine.name}: {machineFound?`${machineFound.library.name} · ${PROVENANCE_LABEL[machineFound.item.provenance.source]}. ${machineFound.item.provenance.note??''}`:'from a file without a matching library entry.'}</dd>
      <dt>Workpiece</dt><dd>{result.config.material.name}: {builtinMaterial?`built-in example category. ${MATERIALS[materialId as keyof typeof MATERIALS].note}`:materialFound?`${materialFound.library.name} · ${PROVENANCE_LABEL[materialFound.item.provenance.source]}. ${materialFound.item.provenance.note??''}`:'from a file without a matching library entry.'}</dd>
      <dt>Cutting limits</dt><dd>{result.limitsBasis}</dd>
      <dt>Tool</dt><dd>{toolLabel(tool,u)}: {toolItem?`${toolItem.item.name} from ${toolItem.library.name} · ${PROVENANCE_LABEL[toolItem.item.provenance.source]}. ${toolItem.item.provenance.note??''}`:'entered by you. The bending estimate uses a representative section stiffness; measure stickout and flute length on the actual tool.'} {BODY_MATERIALS[tool.body].name}{tool.shankDiameter!==tool.diameter?` on a ${len(tool.shankDiameter,u==='imperial'?3:2)} shank`:''}.{geometry.modelled==='as-flat'?` ${geometry.note}`:''}</dd>
     </dl>
     <p className="caution">These are starting points for exploring, derived from example presets, library notes and a simplified forward model. They are not verified cutting recommendations. Check the Limits tab and your tool maker’s data, and start with light passes.</p>
    </>}
   </section>}
  </div>
  <footer className="wizard-footer">
   <button disabled={step===0} {...explain(wizardHelp.back)} onClick={()=>setStep(s=>Math.max(0,s-1))}><ChevronLeft size={14}/> Back</button>
   <span>{step<4?`Step ${step+1} of ${STEPS.length}`:''}</span>
   {step<4?<button className="primary" disabled={!canNext} {...explain(wizardHelp.next)} onClick={()=>setStep(s=>Math.min(4,s+1))}>Next <ChevronRight size={14}/></button>:<button {...explain(wizardHelp.none)} onClick={()=>apply({kind:'none'})}>Apply setup only</button>}
  </footer>
 </>;
}
