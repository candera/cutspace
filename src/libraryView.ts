import {ITEM_KINDS,PROVENANCE_LABEL} from './library.ts';
import type {ItemBase,ItemKind,Library,MachineItem,MaterialItem,RecipeItem,ToolItem} from './library.ts';
import {CUTTER_MATERIALS} from './model.ts';
import type {CutterMaterial,Tool} from './model.ts';
import type {Units} from './units.ts';

/** Browse state for the Library tab: which kinds to show, a free-text filter and a sort order. Pure so it can be tested without the DOM. */
export type KindFilter=ItemKind|'all';
export const KIND_FILTERS:KindFilter[]=['all',...ITEM_KINDS];
export type SortOrder='library'|'name'|'updated';
export const SORT_LABEL:Record<SortOrder,string>={library:'Library order',name:'Name',updated:'Recently updated'};
export interface KindGroup {kind:ItemKind;items:ItemBase[]}
export interface LibraryGroup {library:Library;kinds:KindGroup[];total:number}

const trim=(n:number,digits=3)=>Number(n.toFixed(digits)).toString();
/** Nearest fractional inch for a metric diameter, when one is within 0.0015 in: 6.35 mm → "1/4". */
export function inchFraction(mm:number):string|undefined{
 const inches=mm/25.4;
 for(const den of [1,2,4,8,16,32,64]){const n=Math.round(inches*den);if(n>0&&Math.abs(n/den-inches)<.0015)return den===1?`${n}`:`${n}/${den}`;}
 return undefined;
}
function toolText(t:Tool){
 const frac=inchFraction(t.diameter);
 return `${trim(t.diameter)} mm ${trim(t.diameter/25.4)} in${frac?` ${frac} in ${frac}"`:''} ${t.flutes} flute ${CUTTER_MATERIALS[t.material].name}`;
}
/** Everything a search may match for an item: name, provenance, and the numbers people remember it by, in both unit systems. Lower case. */
export function searchText(kind:ItemKind,item:ItemBase):string{
 const parts=[item.name,PROVENANCE_LABEL[item.provenance.source],item.provenance.note??''];
 if(kind==='machines'){const m=(item as MachineItem).machine;parts.push(`${m.rpmMin} ${m.rpmMax} rpm ${trim(m.power,0)} w`);}
 else if(kind==='materials'){const m=item as MaterialItem;parts.push(...Object.keys(m.cutting??{}).map(k=>CUTTER_MATERIALS[k as CutterMaterial].name),`kc ${trim(m.material.kc,0)}`);}
 else if(kind==='tools')parts.push(toolText((item as ToolItem).tool));
 else{const r=item as RecipeItem,c=r.snapshot.config;parts.push(c.machine.name,c.material.name,toolText(c.tool),r.notes,`${Math.round(r.snapshot.point.rpm)} rpm`);}
 return parts.join(' ').toLowerCase();
}
/** Whitespace-separated terms, lower case; every term must appear somewhere in the item's search text. */
export function queryTerms(query:string):string[]{return query.toLowerCase().split(/\s+/).filter(Boolean);}
export function matches(kind:ItemKind,item:ItemBase,terms:string[]):boolean{
 if(!terms.length)return true;
 const hay=searchText(kind,item);return terms.every(t=>hay.includes(t));
}
/** Library order is the order the file lists items in, which for generated libraries follows the source sheet. Name sorting is numeric-aware so 2 mm sorts before 10 mm. */
export function sortItems<T extends ItemBase>(items:T[],order:SortOrder):T[]{
 if(order==='library')return items;
 const copy=[...items];
 if(order==='name')copy.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
 else copy.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 return copy;
}
/** Every library in order, each holding only the kinds and items that pass the kind filter and the query. Libraries with no matches keep total 0 so the view can decide whether to show them. */
export function groupLibraries(libraries:Library[],kind:KindFilter,query:string,sort:SortOrder):LibraryGroup[]{
 const terms=queryTerms(query);
 return libraries.map(library=>{
  const kinds=ITEM_KINDS.filter(k=>kind==='all'||k===kind).map(k=>({kind:k,items:sortItems((library[k] as ItemBase[]).filter(i=>matches(k,i,terms)),sort)})).filter(g=>g.items.length>0);
  return {library,kinds,total:kinds.reduce((n,g)=>n+g.items.length,0)};
 });
}
/** Matches per kind across all libraries for the current query, so the kind tabs can show where the hits are. */
export function kindCounts(libraries:Library[],query:string):Record<KindFilter,number>{
 const terms=queryTerms(query);
 const counts={all:0,machines:0,materials:0,tools:0,recipes:0};
 for(const library of libraries)for(const k of ITEM_KINDS){const n=(library[k] as ItemBase[]).filter(i=>matches(k,i,terms)).length;counts[k]+=n;counts.all+=n;}
 return counts;
}
const KIND_NOUN:Record<ItemKind,[string,string]>={machines:['machine','machines'],materials:['material','materials'],tools:['tool','tools'],recipes:['recipe','recipes']};
/** "2 machines · 1 tool · 32 recipes", omitting empty kinds; "empty" when nothing is there. */
export function contentsSummary(library:Library):string{
 const parts=ITEM_KINDS.filter(k=>library[k].length>0).map(k=>`${library[k].length} ${KIND_NOUN[k][library[k].length===1?0:1]}`);
 return parts.length?parts.join(' · '):'empty';
}
/** Short tool name for people: "1/4 in · 2-flute Carbide" when the diameter is a clean inch fraction (or the display is imperial), otherwise "6 mm · 3-flute Carbide". */
export function toolLabel(t:Tool,units:Units):string{
 const frac=inchFraction(t.diameter),wholeMm=Math.abs(t.diameter-Math.round(t.diameter))<1e-6;
 const size=units==='imperial'?(frac?`${frac} in`:`${trim(t.diameter/25.4)} in`):(frac&&!wholeMm?`${frac} in`:`${trim(t.diameter)} mm`);
 return `${size} · ${t.flutes}-flute ${CUTTER_MATERIALS[t.material].name}`;
}
