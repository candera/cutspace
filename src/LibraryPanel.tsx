import {useRef,useState} from 'react';
import {ChevronDown,ChevronRight,Copy,Download,RefreshCw,Search,Trash2,Upload,X} from 'lucide-react';
import {explain} from './help';
import {ITEM_KINDS,PERSONAL_ID,PROVENANCE_LABEL,asShared,conflictsBetween,exportLibrary,fetchLibrary,machineFromItem,machineItem,machineRefId,materialItem,mergeLibrary,parseLibrary,recipeItem,removeItem,replaceLibrary,toolItem,uniqueId,upsertLibrary,withItem} from './library';
import type {ConflictPolicy,ItemBase,ItemKind,Library,MachineItem,MaterialItem,RecipeItem,Selection,ToolItem} from './library';
import {KIND_FILTERS,SORT_LABEL,contentsSummary,groupLibraries,kindCounts} from './libraryView';
import type {KindFilter,SortOrder} from './libraryView';
import {snapshot} from './experiment';
import type {Experiment} from './experiment';
import {CUTTER_MATERIALS} from './model';
import type {Machine,Tool} from './model';
import {fmt,toDisplay,unit} from './units';
import type {Units} from './units';

interface Props {libraries:Library[];preloaded?:Library[];experiment:Experiment;units:Units;onChange:(libraries:Library[])=>void;onUseMachine:(machineId:string,machine:Machine)=>void;onUseMaterial:(materialId:string,item:MaterialItem)=>void;onUseTool:(tool:Tool)=>void;onLoadRecipe:(recipe:RecipeItem)=>void;notify:(message:string)=>void}
type Pending={incoming:Library;target:string;policy:ConflictPolicy;conflicts:string[]};
const KIND_LABEL:Record<ItemKind,string>={machines:'Machines',materials:'Workpiece materials',tools:'Tools',recipes:'Cut recipes'};
const FILTER_LABEL:Record<KindFilter,string>={all:'All',machines:'Machines',materials:'Materials',tools:'Tools',recipes:'Recipes'};
const message=(err:unknown)=>err instanceof Error?err.message:String(err);
/** The browse state outlives the component, so switching to another inspector tab and back keeps the search and kind filter for the rest of the page load. */
let remembered={kind:'all' as KindFilter,query:'',sort:'library' as SortOrder};

export default function LibraryPanel({libraries,preloaded=[],experiment:e,units:u,onChange,onUseMachine,onUseMaterial,onUseTool,onLoadRecipe,notify}:Props){
 const [name,setName]=useState(''),[url,setUrl]=useState(''),[busy,setBusy]=useState(false);
 const [selection,setSelection]=useState<Record<string,Selection>>({});
 const [pending,setPending]=useState<Pending|null>(null);
 const [kind,setKindState]=useState(remembered.kind),[query,setQueryState]=useState(remembered.query),[sort,setSortState]=useState(remembered.sort);
 const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const importer=useRef<HTMLInputElement>(null);
 const personal=libraries.find(l=>l.id===PERSONAL_ID)??libraries.find(l=>!l.readOnly);
 const [toolsOpen,setToolsOpen]=useState(()=>!personal||ITEM_KINDS.every(k=>personal[k].length===0));
 const writable=libraries.filter(l=>!l.readOnly);
 const setKind=(k:KindFilter)=>{remembered={...remembered,kind:k};setKindState(k);};
 const setQuery=(q:string)=>{remembered={...remembered,query:q};setQueryState(q);};
 const setSort=(s:SortOrder)=>{remembered={...remembered,sort:s};setSortState(s);};
 const update=(lib:Library)=>onChange(replaceLibrary(libraries,lib));
 const label=(fallback:string)=>name.trim()||fallback;
 const toolName=(t:Tool)=>`${fmt(toDisplay(t.diameter,'length',u),u==='imperial'?4:2)} ${unit('length',u)} · ${t.flutes} flute ${CUTTER_MATERIALS[t.material].name}`;
 const describe=(kind:ItemKind,item:ItemBase)=>{
  if(kind==='machines'){const m=(item as MachineItem).machine;return `${fmt(m.rpmMin,0)}–${fmt(m.rpmMax,0)} RPM · ${fmt(toDisplay(m.power,'power',u),u==='imperial'?2:0)} ${unit('power',u)} · feed ≤ ${fmt(toDisplay(m.feedMax,'feed',u),0)} ${unit('feed',u)}`;}
  if(kind==='materials'){const m=item as MaterialItem,cutters=Object.keys(m.cutting??{}).map(k=>CUTTER_MATERIALS[k as keyof typeof CUTTER_MATERIALS].name).join(' / ');return `Kc ${fmt(m.material.kc,0)} N/mm² · power ×${fmt(m.material.powerFactor,2)} · force ×${fmt(m.material.forceFactor,2)}${cutters?` · cutting starter: ${cutters}`:' · no cutting-data starter'}`;}
  if(kind==='tools'){const t=(item as ToolItem).tool;return `${toolName(t)} · stickout ${fmt(toDisplay(t.stickout,'length',u),u==='imperial'?3:1)} ${unit('length',u)}${t.maxRpm?` · max ${fmt(t.maxRpm,0)} RPM`:''}`;}
  const r=item as RecipeItem,s=r.snapshot;return `${s.config.machine.name} · ${s.config.material.name} · ${toolName(s.config.tool)} · ${fmt(s.point.rpm,0)} RPM · ${fmt(toDisplay(s.point.feed,'feed',u),0)} ${unit('feed',u)} · ${fmt(s.point.wocRatio*100)}%D / ${fmt(s.point.docRatio*100)}%D${r.notes?` · ${r.notes}`:''}`;
 };
 function save(kind:ItemKind){
  if(!personal)return;
  try{
   const item=kind==='machines'?machineItem(personal,label(e.config.machine.name),e.config.machine):kind==='materials'?materialItem(personal,label(e.config.material.name),e.config.material,e.config.limits,e.config.tool.material):kind==='tools'?toolItem(personal,label(toolName(e.config.tool)),e.config.tool):recipeItem(personal,label(e.name||'Untitled cut'),snapshot(e),u);
   update(withItem(personal,kind,item as never));notify(`${item.name} saved to ${personal.name}.`);setName('');
  }catch(err){notify(message(err));}
 }
 function download(lib:Library,fileName:string){const blob=new Blob([JSON.stringify(lib,null,2)],{type:'application/json'});const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
 const selectedCount=(libId:string)=>ITEM_KINDS.reduce((n,k)=>n+(selection[libId]?.[k]?.length??0),0);
 const toggle=(libId:string,kind:ItemKind,id:string,checked:boolean)=>setSelection(s=>{const cur=s[libId]??{};const list=new Set(cur[kind]??[]);if(checked)list.add(id);else list.delete(id);return {...s,[libId]:{...cur,[kind]:[...list]}};});
 async function importFile(file?:File){
  if(!file)return;
  try{if(file.size>2_000_000)throw Error('File exceeds the 2 MB limit.');const incoming=parseLibrary(await file.text());const target=personal?.id??'__new';setPending({incoming,target,policy:'skip',conflicts:personal?conflictsBetween(personal,incoming):[]});}
  catch(err){notify(`Import rejected: ${message(err)}`);}
  finally{if(importer.current)importer.current.value='';}
 }
 const retarget=(target:string)=>setPending(p=>{if(!p)return p;const lib=libraries.find(l=>l.id===target);return {...p,target,conflicts:lib?conflictsBetween(lib,p.incoming):[]};});
 function applyImport(){
  if(!pending)return;const {incoming,target,policy}=pending;
  try{
   if(target==='__new'){onChange(upsertLibrary(libraries,asShared(incoming,incoming.sourceUrl)));notify(`Added ${incoming.name} as a read-only shared library.`);}
   else{const lib=libraries.find(l=>l.id===target);if(!lib)return;const result=mergeLibrary(lib,incoming,policy);update(result.library);notify(`Imported into ${lib.name}: ${result.added} added, ${result.replaced} replaced, ${result.skipped} skipped.`);}
   setPending(null);
  }catch(err){notify(`Import failed: ${message(err)}`);}
 }
 async function addFromUrl(refreshOf?:Library){
  const address=refreshOf?.sourceUrl??url.trim();if(!address)return;
  setBusy(true);
  try{const lib=await fetchLibrary(address);onChange(upsertLibrary(libraries,refreshOf?{...lib,id:refreshOf.id}:lib));notify(`${refreshOf?'Refreshed':'Added'} shared library ${lib.name}: ${contentsSummary(lib)}.`);if(!refreshOf)setUrl('');}
  catch(err){notify(`Could not load library: ${message(err)}`);}
  finally{setBusy(false);}
 }
 const copyToMine=(kind:ItemKind,item:ItemBase)=>{if(!personal)return;const copy={...structuredClone(item),id:uniqueId(item.id,(personal[kind] as ItemBase[]).map(i=>i.id)),updatedAt:new Date().toISOString()};update(withItem(personal,kind,copy as never));notify(`Copied ${item.name} to ${personal.name}.`);};
 const use=(lib:Library,kind:ItemKind,item:ItemBase)=>{if(kind==='machines')onUseMachine(machineRefId(lib.id,item.id),machineFromItem(item as MachineItem));else if(kind==='materials')onUseMaterial(machineRefId(lib.id,item.id),item as MaterialItem);else if(kind==='tools')onUseTool((item as ToolItem).tool);else onLoadRecipe(item as RecipeItem);};
 const inUse=(lib:Library,kind:ItemKind,item:ItemBase)=>(kind==='machines'&&machineRefId(lib.id,item.id)===e.machineId)||(kind==='materials'&&machineRefId(lib.id,item.id)===e.materialId);
 const isPreloaded=(lib:Library)=>preloaded.some(p=>p.sourceUrl===lib.sourceUrl);

 const searching=query.trim().length>0;
 const groups=groupLibraries(libraries,kind,query,sort),counts=kindCounts(libraries,query);
 // Libraries with nothing to show stay visible only in the unfiltered All view, where their Export, Refresh and Remove actions must remain reachable.
 const visible=groups.filter(g=>g.total>0||(!searching&&kind==='all'));
 const shown=visible.reduce((n,g)=>n+g.total,0);
 return <div className="library-panel">
  <h3>Libraries</h3>
  <p>Reusable machines, workpiece materials, tools and cut recipes. Shared libraries are read-only; copy an item into My library to edit it. Experiments keep their own values, so later library edits never change a saved cut or pin.</p>
  <details className="lib-disclosure" open={toolsOpen} onToggle={ev=>setToolsOpen(ev.currentTarget.open)}>
   <summary {...explain('Save the current machine, workpiece material, tool or whole cut into your personal library, import a library file, or add a shared library from a web address.')}>Save, import and share</summary>
   <div>
    <div className="library-tools" data-help="Saves the current machine, workpiece material, tool or whole cut into your personal library under the name you type, or a generated name when the box is empty.">
     <input type="text" aria-label="Name for the saved item" placeholder="Name (optional)" maxLength={120} value={name} onChange={ev=>setName(ev.target.value)}/>
     <button {...explain('Save the active machine profile, including any edits made in the Machine tab, to your personal library.')} disabled={!personal} onClick={()=>save('machines')}>Save machine</button>
     <button {...explain('Save the active workpiece coefficient and the current cutter material’s enabled chip, speed and finishing-deflection starter to your personal library.')} disabled={!personal} onClick={()=>save('materials')}>Save material</button>
     <button {...explain('Save the active tool geometry and cutter material to your personal library.')} disabled={!personal} onClick={()=>save('tools')}>Save tool</button>
     <button {...explain('Save the whole current cut as a recipe: machine, workpiece, tool, limits and the selected RPM, feed, stepover and depth. Loading a recipe later replaces the active experiment; Undo restores it.')} disabled={!personal} onClick={()=>save('recipes')}>Save cut as recipe</button>
    </div>
    <div className="library-tools">
     <button {...explain('Open a Cutspace library file (.json). You choose which library receives its items and what happens to items with the same id.')} onClick={()=>importer.current?.click()}><Upload size={13}/> Import library file</button>
     <input ref={importer} type="file" accept=".json,application/json" hidden onChange={ev=>void importFile(ev.target.files?.[0])}/>
     <input type="text" aria-label="Shared library address" placeholder="https://… shared library address" value={url} onChange={ev=>setUrl(ev.target.value)}/>
     <button {...explain('Fetch a library file published at a web address and keep it as a read-only shared library. Refresh later to pick up changes; your copy stays if the fetch fails.')} disabled={busy||!url.trim()} onClick={()=>void addFromUrl()}>Add shared</button>
    </div>
   </div>
  </details>
  {pending&&<div className="import-panel" role="status">
   <strong>Import “{pending.incoming.name}”</strong> · {contentsSummary(pending.incoming)}
   <label>Into <select value={pending.target} onChange={ev=>retarget(ev.target.value)}>{writable.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}<option value="__new">a new read-only shared library</option></select></label>
   {pending.target!=='__new'&&pending.conflicts.length>0&&<fieldset><legend>{pending.conflicts.length} item{pending.conflicts.length===1?' has':'s have'} the same id as an existing item</legend>
    {(['skip','replace','keep-both'] as ConflictPolicy[]).map(p=><label key={p}><input type="radio" name="conflict-policy" checked={pending.policy===p} onChange={()=>setPending({...pending,policy:p})}/> {p==='skip'?'Skip those items':p==='replace'?'Replace mine with the imported ones':'Keep both (imported copies get a new id)'}</label>)}
   </fieldset>}
   <div className="lib-actions"><button onClick={applyImport}>Import</button><button onClick={()=>setPending(null)}>Cancel</button></div>
  </div>}
  <div className="lib-toolbar">
   <div className="lib-search" role="search" {...explain('Filter every library at once. Matches names, provenance notes and the values items are known by: a tool matches its diameter in millimetres, inches or as a fraction, its flute count and cutter material; a recipe also matches its machine, workpiece and RPM. Several words must all match.')}>
    <Search size={13} aria-hidden="true"/>
    <input type="search" aria-label="Search library items" placeholder="Search all libraries…" value={query} onChange={ev=>setQuery(ev.target.value)}/>
    {query&&<button type="button" aria-label="Clear search" onClick={()=>setQuery('')}><X size={13}/></button>}
   </div>
   <select aria-label="Sort items" {...explain('Library order keeps the sequence the library file lists, which for generated libraries follows the source sheet. Name sorts numerically aware, so 2 mm comes before 10 mm. Recently updated puts the newest saves first.')} value={sort} onChange={ev=>setSort(ev.target.value as SortOrder)}>{(Object.keys(SORT_LABEL) as SortOrder[]).map(s=><option key={s} value={s}>{SORT_LABEL[s]}</option>)}</select>
   <div className="lib-kinds" role="group" aria-label="Show item kinds">{KIND_FILTERS.map(f=><button key={f} type="button" aria-pressed={kind===f} onClick={()=>setKind(f)}>{FILTER_LABEL[f]}<span aria-label={`${counts[f]}${searching?' matching':''}`}>{counts[f]}</span></button>)}</div>
  </div>
  {shown===0&&<p className="lib-empty">{searching?<>No {kind==='all'?'items':FILTER_LABEL[kind].toLowerCase()} match “{query.trim()}”. <button type="button" onClick={()=>setQuery('')}>Clear search</button></>:<>No {FILTER_LABEL[kind].toLowerCase()} in any library yet. Open Save, import and share above to add the current one.</>}</p>}
  {visible.map(group=>{const lib=group.library,open=searching||!collapsed[lib.id],sel=selectedCount(lib.id);
   return <section key={lib.id} className="library-block" aria-label={`${lib.name} library`}>
    <div className="library-head">
     <button type="button" className="lib-collapse" aria-expanded={open} disabled={searching} {...(searching?{}:explain(open?'Collapse this library to a single line. Searching always shows matches from every library.':'Expand this library.'))} onClick={()=>setCollapsed(c=>({...c,[lib.id]:!c[lib.id]}))}>{open?<ChevronDown size={14}/>:<ChevronRight size={14}/>}<span className="lib-title"><strong>{lib.name}</strong><small><span className="lib-kind">{lib.kind==='builtin'?'built in':lib.kind}{lib.readOnly?' · read-only':''}</span> · {searching?`${group.total} match${group.total===1?'':'es'}`:contentsSummary(lib)}</small></span></button>
     <div className="lib-actions">
      <button {...explain('Download this whole library as a JSON file that others can import.')} onClick={()=>{download(exportLibrary(lib),`cutspace-library-${lib.id}.json`);notify(`Exported ${lib.name}.`);}}><Download size={12}/> Export</button>
      {sel>0&&<button onClick={()=>{const s=selection[lib.id]??{};download(exportLibrary(lib,{machines:s.machines??[],materials:s.materials??[],tools:s.tools??[],recipes:s.recipes??[]}),`cutspace-${lib.id}-selection.json`);notify(`Exported ${sel} selected items.`);}}>Export {sel} selected</button>}
      {lib.sourceUrl&&<button disabled={busy} {...explain('Fetch this library again from its address. Your copy stays if the fetch fails.')} onClick={()=>void addFromUrl(lib)}><RefreshCw size={12}/> Refresh</button>}
      {lib.kind==='shared'&&<button aria-label={`Remove ${lib.name}`} {...explain(isPreloaded(lib)?'Remove this preloaded shared library. It will not be added again automatically; Add shared with its address brings it back.':'Remove this shared library. Items you copied to your own library stay.')} onClick={()=>{onChange(libraries.filter(l=>l.id!==lib.id));notify(`Removed shared library ${lib.name}. Items copied to your library stay${isPreloaded(lib)?'; it will not be preloaded again':''}.`);}}><Trash2 size={12}/></button>}
     </div>
    </div>
    {open&&lib.sourceUrl&&<small className="lib-source">{isPreloaded(lib)?'Preloaded from ':'Shared from '}{lib.sourceUrl}</small>}
    {open&&group.kinds.map(g=><div key={g.kind}>
     {kind==='all'&&<h5>{KIND_LABEL[g.kind]} <span>{g.items.length}</span></h5>}
     <ul className="lib-items">{g.items.map(item=>{const key=`${lib.id}/${g.kind}/${item.id}`,isOpen=!!expanded[key],active=inUse(lib,g.kind,item);
      return <li key={item.id} className={`lib-row${active?' in-use':''}`}>
       <div className="lib-row-line">
        <input type="checkbox" aria-label={`Select ${item.name} for export`} checked={selection[lib.id]?.[g.kind]?.includes(item.id)??false} onChange={ev=>toggle(lib.id,g.kind,item.id,ev.target.checked)}/>
        <button type="button" className="lib-row-main" aria-expanded={isOpen} onClick={()=>setExpanded(x=>({...x,[key]:!x[key]}))}>
         <b><span className="lib-name">{item.name}</span>{active&&<em>in use</em>}</b>
         {!isOpen&&<small>{describe(g.kind,item)}</small>}
        </button>
        <div className="lib-actions"><button onClick={()=>use(lib,g.kind,item)}>{g.kind==='recipes'?'Load':'Use'}</button>{lib.readOnly?<button aria-label={`Copy ${item.name} to my library`} {...explain('Copy this item into My library, where you can edit or delete it.')} onClick={()=>copyToMine(g.kind,item)}><Copy size={12}/></button>:<button aria-label={`Delete ${item.name}`} onClick={()=>update(removeItem(lib,g.kind,item.id))}><Trash2 size={12}/></button>}</div>
       </div>
       {isOpen&&<div className="lib-row-detail">
        <small>{describe(g.kind,item)}</small>
        <small>{PROVENANCE_LABEL[item.provenance.source]}{item.provenance.note?` · ${item.provenance.note}`:''}{item.provenance.url?<> · <a href={item.provenance.url} target="_blank" rel="noreferrer">source</a></>:null}</small>
       </div>}
      </li>;})}</ul>
    </div>)}
    {open&&group.total===0&&<p className="small">Empty. Open Save, import and share above to add the current machine, material, tool or cut.</p>}
   </section>;})}
 </div>;
}
