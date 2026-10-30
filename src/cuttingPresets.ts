import type {CutterMaterial,Limits} from './model.ts';
import type {MaterialId} from './experiment.ts';

/** Exploration placeholders referenced to a 6 mm flat end mill, NOT tool-maker recommendations.
 * Chip values are maximum chip thickness (mm) at 6 mm and scale with diameter when a preset is applied;
 * deflection is an allowance (µm), not failure. Wood surface-speed ceilings are set high because wood routing
 * is governed by chipload, burning and the bit's maximum RPM rating rather than by surface speed.
 * Numeric choices are documented in README. No cutting-force or machine-capacity fitting.
 */
export const PRESET_REFERENCE_DIAMETER=6;
/** Chip bands scale linearly with diameter, within a bounded range, from the 6 mm reference. */
export const chipScale=(diameter:number)=>Math.min(2.5,Math.max(.4,diameter/PRESET_REFERENCE_DIAMETER));
export const CUTTING_PRESET_VERSION='provisional-1' as const;
type Values=Pick<Limits,'chipMin'|'chipMax'|'deflection'|'surfaceMax'>;
const values=(chipMin:number,chipMax:number,deflection:number,surfaceMax:number):Values=>({chipMin,chipMax,deflection,surfaceMax});
export const CUTTING_PRESETS:Record<MaterialId,Record<CutterMaterial,Values>>={
 aluminum:{carbide:values(.008,.055,25,450),hss:values(.008,.055,25,120)},
 plywood:{carbide:values(.025,.30,100,1500),hss:values(.025,.25,100,1000)},
 softwood:{carbide:values(.025,.35,100,1500),hss:values(.025,.28,100,1000)},
 hardwood:{carbide:values(.020,.25,75,1500),hss:values(.020,.20,75,1000)},
 steel:{carbide:values(.005,.040,25,120),hss:values(.005,.040,25,30)},
 brass:{carbide:values(.008,.070,25,200),hss:values(.008,.070,25,70)},
};
export function cuttingPreset(material:MaterialId,cutter:CutterMaterial,caution=.75,diameter=PRESET_REFERENCE_DIAMETER):Limits{
 const base=CUTTING_PRESETS[material][cutter],k=chipScale(diameter);
 return {...base,chipMin:Number((base.chipMin*k).toPrecision(6)),chipMax:Number((base.chipMax*k).toPrecision(6)),cuttingDataKnown:true,preset:CUTTING_PRESET_VERSION,caution};
}
