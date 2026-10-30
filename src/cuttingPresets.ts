import type {CutterMaterial,Limits,Operation} from './model.ts';
import type {MaterialId} from './experiment.ts';

/** Exploration placeholders referenced to a 6 mm two-flute flat end mill in a finishing cut, NOT tool-maker recommendations.
 * When a preset is applied: chip values (maximum chip thickness, mm) scale with diameter and flute count; the deflection
 * allowance (µm) scales with the chosen operation (roughing accepts more bending than finishing). Deflection is an
 * allowance, not failure. Wood surface-speed ceilings are set high because wood routing is governed by chipload, burning
 * and the bit's maximum RPM rating rather than by surface speed. Numeric choices are documented in README.
 */
export const CUTTING_PRESET_VERSION='provisional-1' as const;
export const PRESET_REFERENCE_DIAMETER=6;
/** Chip bands scale linearly with diameter, within a bounded range, from the 6 mm reference. */
export const chipScale=(diameter:number)=>Math.min(2.5,Math.max(.4,diameter/PRESET_REFERENCE_DIAMETER));
/** Single-flute cutters have one large gullet and run much heavier chiploads than multi-flute tools of the same size; four or more flutes run lighter. */
export const fluteScale=(flutes:number)=>flutes<=1?1.8:flutes<=3?1:.8;
export const OPERATION_INFO:Record<Operation,{label:string;deflection:number;note:string}>={
 roughing:{label:'Roughing',deflection:4,note:'Profiling, pocketing and slotting where a few hundredths of a millimetre of wall error is acceptable. Allows 4× the finishing deflection allowance.'},
 finishing:{label:'Finishing',deflection:1,note:'Final passes where size and wall straightness matter. Uses the base deflection allowance.'},
};
type Values=Pick<Limits,'chipMin'|'chipMax'|'deflection'|'surfaceMax'>;
const values=(chipMin:number,chipMax:number,deflection:number,surfaceMax:number):Values=>({chipMin,chipMax,deflection,surfaceMax});
/** Base values: 6 mm, two flutes, finishing deflection allowance. */
export const CUTTING_PRESETS:Record<MaterialId,Record<CutterMaterial,Values>>={
 aluminum:{carbide:values(.008,.055,25,450),hss:values(.008,.055,25,120)},
 plywood:{carbide:values(.025,.30,25,1500),hss:values(.025,.25,25,1000)},
 softwood:{carbide:values(.025,.35,25,1500),hss:values(.025,.28,25,1000)},
 hardwood:{carbide:values(.020,.25,20,1500),hss:values(.020,.20,20,1000)},
 steel:{carbide:values(.005,.040,25,120),hss:values(.005,.040,25,30)},
 brass:{carbide:values(.008,.070,25,200),hss:values(.008,.070,25,70)},
};
export interface PresetOptions {caution?:number;diameter?:number;flutes?:number;operation?:Operation}
const round=(x:number)=>Number(x.toPrecision(6));
export function cuttingPreset(material:MaterialId,cutter:CutterMaterial,{caution=.75,diameter=PRESET_REFERENCE_DIAMETER,flutes=2,operation='roughing'}:PresetOptions={}):Limits{
 const base=CUTTING_PRESETS[material][cutter],d=chipScale(diameter),f=fluteScale(flutes);
 return {...base,chipMin:round(base.chipMin*d),chipMax:round(base.chipMax*d*f),deflection:round(base.deflection*OPERATION_INFO[operation].deflection),cuttingDataKnown:true,preset:CUTTING_PRESET_VERSION,caution,operation};
}
