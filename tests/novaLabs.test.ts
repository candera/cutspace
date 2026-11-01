import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {builtinLibrary,dismissedPreloads,findMachine,parseLibrary,personalLibrary,readLibraryStore,upsertLibrary,withPreloaded,asShared} from '../src/library.ts';
import {fitView,parseExperiment,setupFor} from '../src/experiment.ts';
import {calculate} from '../src/model.ts';
import {envelopeBounds,gridFor} from '../src/plots.ts';

const text=readFileSync(new URL('../public/libraries/nova-labs.json',import.meta.url),'utf8');
const nova=parseLibrary(text);

test('the published Nova Labs library carries the named makerspace machines and the two reported plywood recipes',()=>{
 assert.equal(nova.id,'nova-labs');assert.equal(nova.kind,'shared');assert.equal(nova.readOnly,true);
 assert.equal(nova.sourceUrl,'https://www.craigandera.org/software/cutspace/libraries/nova-labs.json');
 assert.deepEqual(nova.machines.map(m=>m.id),['shopsabre-rc4','big-blue']);
 assert.equal(nova.machines[0].name,'ShopSabre RC4');assert.match(nova.machines[0].provenance.note??'',/nameplate/);
 assert.equal(nova.machines[0].machine.rpmMax,18000);assert.equal(nova.machines[0].provenance.source,'user');
 assert.deepEqual({...nova.machines[1].machine,rpmMax:18000},nova.machines[0].machine);assert.equal(nova.machines[1].machine.rpmMax,24000);
 assert.deepEqual(nova.recipes.map(r=>r.id),['bigblue-plywood-300ipm','bigblue-plywood-200ipm']);
 for(const recipe of nova.recipes){
  assert.equal(recipe.snapshot.machineId,'lib:nova-labs/big-blue');assert.equal(findMachine([nova],recipe.snapshot.machineId)?.item.name,'Big Blue');
  const e={...parseExperiment(JSON.stringify({...JSON.parse(readFileSync(new URL('../examples/big-blue-plywood-300-ipm.json',import.meta.url),'utf8')),...recipe.snapshot}))};e.view=fitView(e);
  const s=setupFor(e);assert.equal(calculate(s.cut,s).status,'inside');assert.ok(envelopeBounds(gridFor(s,'speed',e.view),s.cut));
 }
 // The example experiment files resolve to the same library machine.
 for(const file of ['big-blue-plywood-300-ipm','big-blue-plywood-shared-200-ipm'])assert.equal(parseExperiment(readFileSync(new URL(`../examples/${file}.json`,import.meta.url),'utf8')).machineId,'lib:nova-labs/big-blue');
});

test('preloaded shared libraries are added once, refreshed when the bundle is newer, and stay away once dismissed',()=>{
 const stored=[personalLibrary()];
 const added=withPreloaded(stored,[nova],[]);
 assert.deepEqual(added.map(l=>l.id),['personal','nova-labs']);assert.equal(added[1].kind,'shared');assert.equal(added[1].readOnly,true);
 // Already present: untouched when not newer, replaced in place (keeping the stored id) when newer.
 assert.deepEqual(withPreloaded(added,[nova],[]),added);
 const older={...nova,updatedAt:'2000-01-01T00:00:00.000Z',name:'Nova Labs (old)'};
 assert.equal(withPreloaded(withPreloaded(stored,[older],[]),[nova],[])[1].name,'Nova Labs');
 assert.equal(withPreloaded(added,[older],[])[1].name,'Nova Labs');
 const renamed=upsertLibrary(stored,asShared({...older,id:'personal'},older.sourceUrl));
 assert.equal(renamed[1].id,'personal-2');assert.equal(withPreloaded(renamed,[nova],[])[1].id,'personal-2');
 // Dismissed by address: not re-added; manual re-add via the same address still works.
 assert.deepEqual(withPreloaded(stored,[nova],[nova.sourceUrl!]).map(l=>l.id),['personal']);
 assert.deepEqual(dismissedPreloads(added,stored,[nova]),[nova.sourceUrl]);
 assert.deepEqual(dismissedPreloads(added,added,[nova]),[]);
 assert.deepEqual(dismissedPreloads([...added,asShared({...personalLibrary(),id:'other'},'https://example.org/x.json')],added,[nova]),[]);
 // A library without an address is never preloaded.
 const {sourceUrl:_u,...local}=nova;assert.deepEqual(withPreloaded(stored,[local as typeof nova],[]).map(l=>l.id),['personal']);
});

test('the library store round-trips dismissed addresses and tolerates older stores without them',()=>{
 const store=readLibraryStore(JSON.stringify({schemaVersion:1,libraries:[builtinLibrary(),personalLibrary(),nova],dismissed:[nova.sourceUrl,42]}));
 assert.deepEqual(store.libraries.map(l=>l.id),['personal','nova-labs']);assert.deepEqual(store.dismissed,[nova.sourceUrl]);
 assert.deepEqual(readLibraryStore(JSON.stringify({schemaVersion:1,libraries:[]})).dismissed,[]);
 assert.deepEqual(readLibraryStore(null),{libraries:[],dismissed:[]});
 assert.throws(()=>readLibraryStore('{"schemaVersion":1}'));
});
