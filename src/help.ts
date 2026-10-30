import type {Metric,ConstraintKey} from './model';
import {limitGuidance} from './limitGuidance';

/** Shared explanations for explicit Help mode and assistive technology. */
export const explain=(text:string)=>({'data-help':text,'aria-description':text});
export const fieldHelp:Record<string,string>={
 'Diameter':'Cutting diameter of the tool. Changing it preserves DOC and WOC as percentages of diameter, so their physical distances change. RPM, feed and stickout stay unchanged.',
 'Flutes':'Number of cutting edges. At the same RPM and feedrate, more flutes mean a smaller chipload per edge. Also affects the approximate number of engaged teeth used to estimate force.',
 'Stickout':'Unsupported tool length measured from the holder to the tip. Longer stickout sharply increases the static bending estimate; it does not predict chatter.',
 'Flute length':'Usable cutting-edge length. DOC beyond this length fails the engagement check. This is a simple reach limit, not a collision check.',
 'Spindle speed':'Tool revolutions per minute (RPM). Changing RPM changes surface speed, feed per tooth and spindle torque demand while holding feedrate and engagement fixed.',
 'Feedrate':'Distance the cutter advances per minute. Higher feed increases chipload, material removal and estimated cutting demand at the same RPM and engagement.',
 'Stepover (WOC)':'Stepover, also called radial width of cut (WOC): how much of the cutter engages sideways. 100%D is a full-width slot. Narrow engagement thins the chip. The %D / distance buttons choose the entry units.',
 'Depth of cut (DOC)':'Depth of cut per pass, along the cutter axis. 100%D means a depth equal to the cutter diameter; deeper cuts are possible in this model if flute length and stickout permit. Increasing DOC increases removal and estimated demand.',
 'Minimum RPM':'Lower assumed operating-speed limit for this machine. Cuts below it fail the RPM check; this is an illustrative limit, not a verified machine specification.',
 'Maximum RPM':'Upper assumed operating-speed limit for this machine. Cuts above it fail the RPM check. Changing it does not automatically change the selected RPM.',
 'Maximum feedrate':'Assumed machine feed limit. Faster selected cuts fail the feed check. This placeholder does not account for acceleration or path geometry.',
 'Power plateau':'Assumed maximum mechanical spindle output before the usable-output reserve. Available power is the lower of this plateau and the torque-limited output at each RPM.',
 'Torque plateau':'Assumed maximum spindle torque before the usable-output reserve. It limits available power at lower RPM. This is not a verified motor or spindle rating.',
 'Usable output':'Percentage of the assumed power/torque curve available to the cut. For example, 75% leaves a 25% reserve. This reserve is not a measured drive-efficiency correction.',
 'Effective cutting force':'Illustrative specific cutting-force coefficient Kc, in N/mm². A larger value raises estimated power, force and deflection. Real values depend on material, tool and cutting conditions.',
 'Power allowance':'Multiplier applied to the simple cutting-power estimate. Values above 1 add an explicit allowance; they do not establish a validated upper bound.',
 'Force allowance':'Multiplier applied to estimated cutting force and therefore static deflection. Adds conservative intent without proving a worst-case bound.',
 'Tool max RPM':'Maximum spindle speed printed on the bit or in its data sheet, checked together with the machine RPM range. Enter 0 when no rating is known. Router bits are usually rated by maximum RPM rather than by surface speed.',
 'Elastic modulus':'Assumed stiffness of the tool material, in GPa. A higher modulus reduces the static bending estimate. This is separate from the geometry of its fluted cross section. Carbide starts at 600 GPa and HSS at 219 GPa; changing cutter material replaces this override.',
 'Effective stiffness':'Fraction of the bending stiffness of a solid circular section with this diameter. Approximates material removed by the flutes; smaller values increase estimated deflection.',
 'Minimum chip thickness':'Lower illustrative limit on maximum chip thickness after radial chip thinning. Chips below this value fail the low-chip check. It is not a validated rubbing threshold.',
 'Maximum chip thickness':'Upper illustrative limit on maximum chip thickness after radial chip thinning. Chips above it fail the high-chip check. It is not a tool-breakage prediction.',
 'Deflection limit':'Largest permitted static tip-bending estimate for this experiment. Exceeding it fails a configured check; passing does not establish dynamic stability or dimensional accuracy.',
 'Caution starts at':'Fraction of each soft limit where the caution band begins. At 75%, a cut using between 75% and 100% of a soft limit is marked Caution; above 100% it is beyond the limit. Hard limits such as RPM range have no caution band.',
 'Surface speed limit':'Upper illustrative limit on cutting-edge speed around the tool circumference. Depends on diameter and RPM. This is not a material-specific tooling recommendation.',
 'RPM axis minimum':'Left edge of the RPM/feed plot. Changes the visible range only, not the selected cut or the machine RPM limit.',
 'RPM axis maximum':'Right edge of the RPM/feed plot. Changes the visible range only. A selection beyond it remains unchanged and is marked outside the view.',
 'Feed axis minimum':'Bottom edge of the feedrate axis. Changes the visible range only, not the cut or a machine limit.',
 'WOC axis minimum':'Left edge of the radial width axis, as percent of cutter diameter. Reset view returns it to zero.',
 'DOC axis minimum':'Bottom edge of the axial depth axis, as percent of cutter diameter. Reset view returns it to zero.',
 'Feed axis maximum':'Top edge of the feedrate axis. Changes the visible range only, not the machine feed limit or the selected feedrate.',
 'WOC axis maximum':'Right edge of the engagement plot, as a percentage of cutter diameter. Values above 100%D expose regions that are invalid for this milling model.',
 'DOC axis maximum':'Top edge of the engagement plot, as a percentage of cutter diameter. This display bound can exceed 100%D and does not change the flute-length limit.',
 'Color scale minimum':'Value assigned the lowest fill color. Editing it switches to a fixed scale shared by both plots; lower values saturate at that color. Does not change a cutting limit.',
 'Color scale maximum':'Value assigned the highest fill color. Editing it switches to a fixed scale shared by both plots; higher values saturate at that color. Does not change a cutting limit.',
};
export const metricHelp:Record<Metric,string>={
 mrr:'Material removal rate (MRR): DOC × WOC × feedrate. It measures removed volume per minute, not surface finish or cut quality.',
 power:'Estimated mechanical spindle power needed by the cut, from material removal, the illustrative cutting coefficient and power allowance. It is not electrical input power.',
 chip:'Chipload, also called feed per tooth: feedrate divided by RPM and flute count. This is the advance per cutting edge, before radial chip thinning.',
 chipMax:'Maximum chip thickness after ideal radial chip thinning. At less than half-diameter stepover it is smaller than the chipload. No automatic feed increase is applied.',
 deflection:'Estimated static tool-tip bending, using a simplified cantilever and cutting-force estimate. Longer stickout increases it sharply. It does not predict chatter or include holder/machine flexibility.',
 utilization:'Estimated power demand divided by usable spindle output at the selected RPM. 100% reaches the assumed capacity; higher values exceed it. An unknown capacity makes this unavailable.',
 margin:'Remaining margin to the most-used known constraint: 1 minus its ratio. Zero reaches a limit; negative values exceed one. Unknown checks are still unknown, even if this known-check margin is positive.',
 zone:'Soft-limit zone: Comfortable below the caution fraction, Caution between it and the limit, Beyond above it. Hard-limit failures, invalid and unknown points are dark. Zones describe editable allowances, not measured risk.',
 constraint:'The known constraint with the highest demand-to-limit ratio. Inside the envelope it is the nearest configured limit; outside it is the largest relative exceedance. Hatching also marks unknown or invalid regions.',
};
const constraintRatios:Record<ConstraintKey,string>={
 chipHigh:'Maximum chip thickness divided by its upper configured limit. Above 100% the chip is thicker than this illustrative limit allows.',
 chipLow:'Minimum permitted chip thickness divided by actual maximum chip thickness. This ratio rises as chips get thinner; above 100% fails the low-chip check.',
 power:'Estimated cutting power divided by the assumed power plateau after reserve. Above 100% exceeds that branch of the illustrative spindle curve.',
 torque:'Estimated cutting torque divided by the assumed torque plateau after reserve. Above 100% exceeds the torque branch of the illustrative spindle curve.',
 deflection:'Estimated static tip deflection divided by the configured deflection limit. Above 100% fails this check. This is not a chatter criterion.',
 surface:'Computed surface speed divided by its configured maximum. Above 100% exceeds this illustrative surface-speed limit.',
 rpm:'The larger of minimum RPM / selected RPM and selected RPM / maximum RPM. Above 100% means the selected speed is outside the assumed operating range.',
 feed:'Selected feedrate divided by the assumed machine feed limit. Above 100% exceeds the configured limit.',
 geometry:'The larger of DOC / flute length and DOC / stickout. Above 100% exceeds a simple reach limit. A stepover above one diameter is invalid for this model and is hatched rather than counted here.',
};
export const constraintHelp=Object.fromEntries((Object.keys(constraintRatios) as ConstraintKey[]).map(key=>{
 const g=limitGuidance[key];
 return [key,`${g.meaning} Why it matters: ${g.why} What to adjust: ${g.adjust} ${g.qualification} ${constraintRatios[key]}`];
})) as Record<ConstraintKey,string>;
export const sectionHelp:Record<string,string>={
 Machine:'Inspect or edit assumed RPM/feed limits and the illustrative power/torque curve for this experiment.',
 Material:'Inspect or edit the illustrative material coefficient and allowances; mark the force/power model unavailable when it should not be used.',
 Tool:'Inspect assumed tool-material stiffness and the effective fluted cross-section stiffness used for static bending.',
 Limits:'See every configured check at the current cut, then edit the illustrative chip, deflection and surface-speed thresholds.',
 View:'Change plot ranges and fixed color-scale bounds without changing the selected cut.',
 Library:'Save, load, import, export and share machines, tools and cut recipes. Shared libraries are read-only; your own library is editable.',
 About:'Read the formulas, assumptions, example cuts, model limitations and references behind the displayed results.',
};
export const help={
 cutterMaterial:'Material of the flat end mill, distinct from the workpiece. Carbide loads a representative 600 GPa elastic modulus; high-speed steel (HSS) loads 219 GPa, giving more static bending under the same load. Switching replaces a modulus override, preserves geometry, RPM, feed and %DOC/WOC, and loads provisional chip, surface-speed and deflection limits for the new combination, replacing limit overrides. Undo restores the previous setup. This does not model coatings, heat, edge strength or router-bit profiles.',
 cuttingPreset:'Load the provisional chip-thickness band, surface-speed maximum and deflection allowance for this workpiece and cutter material, and enable the cutting checks. Replaces limit overrides only; geometry, cut, machine capacity and force coefficients stay unchanged. These are exploration placeholders for roughly 6 mm end mills, not calibrated cutting recommendations. Undo restores the previous values.',
 cuttingData:'Enable the entered minimum/maximum chip thickness and maximum surface speed for the current cutter/workpiece combination. Turning this off makes those three checks unknown, so no complete passing envelope is shown. Material changes load and enable their provisional preset. You can turn these checks off explicitly. Enabling means use these assumptions, not that Cutspace has validated them. No universal carbide-to-HSS speed or chip multiplier is assumed.', 
 machine:'Choose a machine from the built-in list or from one of your libraries. This replaces machine overrides and fits the plot ranges. Built-in profiles use example values, not manufacturer specifications; check each profile’s note in the Library tab. Big Blue currently copies the ShopSabre RC4 example values.',
 operation:'Roughing or finishing. The same bit does both; what changes is how much tool bending you will accept, so this is a multiplier on the deflection allowance rather than a second set of limits. Roughing allows 4× the finishing allowance. Switching re-applies the preset, or scales a custom allowance by the same ratio, and never changes the cut itself.',
 material:'Choose a material category. This replaces the force/power coefficient and allowances with that category’s illustrative defaults; tool geometry and selected cut stay unchanged. Changing category loads provisional chip, surface-speed and deflection limits for the new combination, replacing limit overrides. Undo restores the previous setup.',
 units:'Switch input and output displays between metric and imperial. Stored physical values and DOC/WOC percentages stay unchanged. Advanced coefficients keep their explicitly labeled units.',
 percent:'Enter DOC and WOC as percentages of cutter diameter. 50%D means half the diameter. Switching entry mode changes presentation only; diameter changes always preserve these ratios.',
 absolute:'Enter DOC and WOC as physical distances in the selected measurement system. Entries are stored as diameter ratios, which remain fixed if you later change cutter diameter.',
 pin:'Save this cut and its complete tool, material and machine configuration as the next A/B/C comparison point. Pinning preserves your color-scaling mode. Choose Fixed scale explicitly if you want to hold colors for comparisons.',
 boundary:'The white dashed line is the hard-limit boundary: RPM range, machine feed and tool reach, where required model inputs are available. It is sampled, not a certified safe operating boundary.',
 caution:'The amber dashed line is where the most-used soft limit (chipload, power, torque, deflection or surface speed) enters its caution band, by default 75% of the limit; the band itself carries a sparse amber dot pattern in the same colour. Edit the fraction in Model & limits → Limits.',
 beyond:'The red line is where a soft limit is exceeded; beyond it the plot shows sparse red diagonal lines in the same colour, at the opposite angle to the dense white hatching of hard-limit failures. Soft limits are editable allowances; crossing one does not mean instant failure, it means the estimate has passed the margin you set.',
 hatch:'Hatching marks hard-limit failures (RPM range, machine feed, tool reach), invalid engagement, no material removal or unknown required model data. An unhatched point is not a safety guarantee.',
 scale:'The same color means the same value in both plots. Auto range spans all finite, geometrically valid samples visible in both plots, including points outside the configured limits. Fixed scale retains its bounds; values beyond them saturate. Bounds freeze during a drag and update when it ends. Fit/Reset view and pinning keep your chosen scaling mode. Switching machine, workpiece or cutter material returns to Auto range.',
 capacity:'Use the fictional spindle-output curve for capacity checks. Turning it off marks capacity-dependent checks unknown; it does not imply unlimited spindle power.',
 force:'Use the illustrative material model to estimate force, power, torque and deflection. Turning it off leaves geometry and removal outputs available but those estimates unknown.',
 curve:'Assumed available spindle output versus RPM: constant torque at lower speed, then constant power, reduced by the usable-output percentage. RPM-range checks separately reject disallowed speeds.',
};
