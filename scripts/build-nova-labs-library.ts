/**
 * Writes public/libraries/nova-labs.json: the Nova Labs makerspace library that Cutspace preloads as a shared library and
 * publishes beside the app, so it also illustrates URL-based shared libraries. Regenerate with:
 *   node scripts/build-nova-labs-library.ts
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {parseExperiment,snapshot} from '../src/experiment.ts';
import {parseLibrary} from '../src/library.ts';
import type {Library,RecipeItem} from '../src/library.ts';

const UPDATED='2026-11-01T00:00:00.000Z';
export const NOVA_LABS_URL='https://www.craigandera.org/software/cutspace/libraries/nova-labs.json';
/** Big Blue keeps the original placeholder set; the RC4 differs only where the user has supplied a real figure. */
const PLACEHOLDER={rpmMin:6000,rpmMax:24000,feedMax:10000,power:1500,torque:.9,utilization:.75,known:true};
const RC4={...PLACEHOLDER,rpmMax:18000};
const example=(file:string)=>snapshot(parseExperiment(readFileSync(new URL(`../examples/${file}`,import.meta.url),'utf8')));
const recipes:RecipeItem[]=[
 {id:'bigblue-plywood-300ipm',name:'Big Blue · plywood · 300 IPM (reported cut)',snapshot:example('big-blue-plywood-300-ipm.json'),units:'imperial',notes:'User-reported successful cut: 1/4 in two-flute carbide, 18,000 RPM, 300 IPM, 50%D depth, full-width slot, about 30 mm stickout. Flute length assumed at 15 mm. Provisional plywood limits.',provenance:{source:'user',note:'Reported by the operator, not instrumented.'},updatedAt:'2026-10-29T00:00:00.000Z'},
 {id:'bigblue-plywood-200ipm',name:'Big Blue · plywood · 200 IPM (shared screenshot)',snapshot:example('big-blue-plywood-shared-200-ipm.json'),units:'imperial',notes:'Shared screenshot: 200 IPM, 10,000 RPM, 1/4 in four-flute tool, 150%D depth, full-width slot, 1 in stickout, 0.8 in flutes. Carbide assumed.',provenance:{source:'user',note:'Reported by another operator as successful; cutter material unconfirmed.'},updatedAt:'2026-10-29T00:00:00.000Z'},
];
const library:Library={schemaVersion:1,id:'nova-labs',name:'Nova Labs',kind:'shared',readOnly:true,sourceUrl:NOVA_LABS_URL,updatedAt:UPDATED,
 machines:[
  {id:'shopsabre-rc4',name:'ShopSabre RC4',machine:{...RC4},provenance:{source:'user',note:'The 18,000 RPM maximum is user-supplied for the Nova Labs machine. The minimum RPM, feed ceiling, 1.5 kW / 0.9 N·m plateaus and usable fraction remain placeholders, not a verified RC4 specification; public resale listings describe RC4s with roughly 4 HP (3 kW) HSD spindles. Confirm the rest from the nameplate before relying on this profile.'},updatedAt:UPDATED},
  {id:'big-blue',name:'Big Blue',machine:{...PLACEHOLDER},provenance:{source:'illustrative',note:'Started as a copy of the ShopSabre RC4 placeholder values at the user’s request; not independently measured. It keeps the 24,000 RPM placeholder ceiling, which the RC4 no longer uses, so its reported 300 IPM plywood cut at 18,000 RPM stays inside.'},updatedAt:UPDATED},
 ],
 materials:[],tools:[],recipes};
for(const recipe of library.recipes)if(recipe.snapshot.machineId!=='lib:nova-labs/big-blue')throw Error(`${recipe.id} must reference the Nova Labs Big Blue profile.`);
parseLibrary(JSON.stringify(library));
writeFileSync(new URL('../public/libraries/nova-labs.json',import.meta.url),JSON.stringify(library,null,1)+'\n');
console.log('wrote public/libraries/nova-labs.json');
