import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {builtinLibrary,parseLibrary,personalLibrary,withItem,toolItem,machineItem} from '../src/library.ts';
import type {Library} from '../src/library.ts';
import {MACHINES,fresh} from '../src/experiment.ts';
import {contentsSummary,groupLibraries,inchFraction,kindCounts,matches,queryTerms,searchText,sortItems} from '../src/libraryView.ts';

const dmc2=()=>parseLibrary(readFileSync(new URL('../examples/dmc2-mini-library.json',import.meta.url),'utf8'));
const novaLabs=()=>parseLibrary(readFileSync(new URL('../public/libraries/nova-labs.json',import.meta.url),'utf8'));
const all=():Library[]=>[builtinLibrary(),personalLibrary(),novaLabs(),dmc2()];
const total=(lib:Library)=>lib.machines.length+lib.materials.length+lib.tools.length+lib.recipes.length;

test('fractional inch names are found for common imperial shank sizes and not invented for metric ones',()=>{
 assert.equal(inchFraction(6.35),'1/4');assert.equal(inchFraction(3.175),'1/8');assert.equal(inchFraction(12.7),'1/2');assert.equal(inchFraction(9.525),'3/8');assert.equal(inchFraction(25.4),'1');
 assert.equal(inchFraction(6),undefined);assert.equal(inchFraction(1),undefined);assert.equal(inchFraction(8),undefined);
});
test('search text covers names, provenance and the numbers people know an item by, in both unit systems',()=>{
 const lib=builtinLibrary();
 const quarter=lib.tools.find(t=>t.id==='quarter-2f-carbide')!,six=lib.tools.find(t=>t.id==='6mm-3f-carbide')!;
 for(const q of ['1/4','6.35','0.25 in','2 flute','carbide','example values'])assert.ok(matches('tools',quarter,queryTerms(q)),`quarter-inch tool matches "${q}"`);
 assert.ok(matches('tools',six,queryTerms('6 mm 3 flute')));assert.ok(!matches('tools',six,queryTerms('1/4')));
 const machine=lib.machines[0];assert.ok(matches('machines',machine,queryTerms('edit to match')));assert.ok(matches('machines',machine,queryTerms(String(machine.machine.rpmMax))));
 const recipe=novaLabs().recipes[0];assert.ok(matches('recipes',recipe,queryTerms('big blue plywood')));assert.ok(matches('recipes',recipe,queryTerms(String(Math.round(recipe.snapshot.point.rpm)))));
 assert.ok(!matches('recipes',recipe,queryTerms('big blue titanium')),'every term must match');
 assert.equal(searchText('tools',quarter),searchText('tools',quarter).toLowerCase());
 assert.deepEqual(queryTerms('  Big   BLUE '),['big','blue']);assert.deepEqual(queryTerms(''),[]);
});
test('sorting keeps library order by default, sorts names numerically and puts recent saves first',()=>{
 const tools=dmc2().tools;
 assert.equal(sortItems(tools,'library'),tools,'library order returns the same array');
 const names=sortItems(tools,'name').map(t=>t.name);
 assert.ok(names.indexOf(names.find(n=>n.startsWith('2 mm'))!)<names.indexOf(names.find(n=>n.startsWith('10 mm'))!),'2 mm sorts before 10 mm');
 assert.deepEqual([...names].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'})),names);
 let mine=personalLibrary();const e=fresh();
 mine=withItem(mine,'tools',{...toolItem(mine,'Older',e.config.tool),updatedAt:'2026-01-01T00:00:00.000Z'});
 mine=withItem(mine,'tools',{...toolItem(mine,'Newer',e.config.tool),updatedAt:'2026-06-01T00:00:00.000Z'});
 assert.deepEqual(sortItems(mine.tools,'updated').map(t=>t.name),['Newer','Older']);
 assert.deepEqual(mine.tools.map(t=>t.name),['Older','Newer'],'sorting never mutates the library');
});
test('grouping filters by kind and query across every library and reports per-kind counts',()=>{
 const libraries=all();
 const everything=groupLibraries(libraries,'all','','library');
 assert.deepEqual(everything.map(g=>g.total),libraries.map(total));
 assert.deepEqual(everything.map(g=>g.library.id),libraries.map(l=>l.id),'libraries stay in their original order');
 const toolsOnly=groupLibraries(libraries,'tools','','library');
 for(const g of toolsOnly){assert.ok(g.kinds.every(k=>k.kind==='tools'));assert.equal(g.total,g.library.tools.length);}
 const aluminum=groupLibraries(libraries,'all','aluminum 6 mm','library');
 const d=aluminum.find(g=>g.library.id==='dmc2-mini')!;
 assert.ok(d.total>0&&d.total<total(d.library),'the query narrows the DMC2 library');
 for(const k of d.kinds)for(const i of k.items){const text=searchText(k.kind,i);assert.ok(text.includes('aluminum')&&text.includes('6')&&text.includes('mm'),`${i.name} matches every term`);}
 assert.ok(d.kinds.some(k=>k.kind==='tools')&&d.kinds.some(k=>k.kind==='recipes'),'matches span tools and recipes');
 assert.equal(aluminum.find(g=>g.library.id==='builtin')!.total,0,'no match keeps the library with total 0');
 assert.ok(aluminum.every(g=>g.kinds.every(k=>k.items.length>0)),'empty kinds are dropped');
 const counts=kindCounts(libraries,'');
 assert.equal(counts.machines,libraries.reduce((n,l)=>n+l.machines.length,0));assert.equal(counts.all,libraries.reduce((n,l)=>n+total(l),0));
 const bigBlue=kindCounts(libraries,'big blue');
 assert.equal(bigBlue.machines,1);assert.equal(bigBlue.recipes,2);assert.equal(bigBlue.all,3);assert.equal(bigBlue.tools,0);
 assert.deepEqual(kindCounts(libraries,'no such thing anywhere'),{all:0,machines:0,materials:0,tools:0,recipes:0});
});
test('contents summaries name only the kinds a library holds',()=>{
 assert.equal(contentsSummary(personalLibrary()),'empty');
 assert.equal(contentsSummary(novaLabs()),'2 machines · 2 recipes');
 let mine=personalLibrary();mine=withItem(mine,'machines',machineItem(mine,'Mine',MACHINES['desktop-mill-example']));
 assert.equal(contentsSummary(mine),'1 machine');
 assert.match(contentsSummary(dmc2()),/^1 machine · 17 tools · 32 recipes$/);
});
