# Cutspace backlog

## CS B01 Scenario sensitivity bands

Status: Deferred to a future version by user decision on 27 October 2026. Not included in the initial release or prototype 2.

### Purpose and behavior

A scenario sensitivity band answers: **does this cut pass the configured checks only because an uncertain input was given a favorable value?** Instead of drawing one boundary from one assumed input, calculate the boundaries for several explicitly named input scenarios and distinguish where their classifications disagree.

Hypothetical example, unrelated to either named machine: at the selected RPM, usable spindle output might be 150, 200 or 250 W under three assumptions. A cut requiring an estimated 180 W fails the power check in the 150 W scenario and passes it in the other two. All other input values and checks are held fixed for that comparison. On the plots, classify each sample as:

- Passing in every evaluated scenario: intersection of the scenarios' within-limit regions.
- Passing in some but not all scenarios: the sensitivity band, equal to the union of those regions minus their intersection.
- Passing in no evaluated scenario: outside every scenario's within-limit region.

The band can be irregular or disconnected when different constraints dominate; do not assume it is always a neat strip between two nested curves. Label it `Scenario-dependent` and expose the actual assumptions. A point passing in two of three scenarios does **not** have a two-thirds probability of working. These are assumption comparisons, not statistical confidence intervals or chatter predictions. Passing every tested scenario covers only those scenarios, not every possible machine condition.

Other possible inputs are the effective cutting-force coefficient, force allowance or tool/holder stiffness estimate. Start with one uncertain parameter at a time; keep tool geometry, other inputs and color scales fixed. Scenario ranges need evidence or explicit user-assumption labels. Do not invent percentage uncertainty merely to draw a band. For non-monotonic models, evaluating a few parameter values is not a bound over the whole continuous range.

### Candidate implementation

Optional, off by default. Choose one uncertain parameter and explicit low/reference/high assumptions. Use common plot/color scales, identify the source of each value, and show pass-all / scenario-dependent / pass-none regions. Do not invent uncertainty ranges or interpret scenario counts as probabilities.

### Future acceptance criteria

- Scenarios share all inputs except the explicitly varied parameter.
- The shaded band equals the union of passing regions minus their intersection.
- Selected-point results identify exactly which scenarios pass/fail.
- Saved experiments retain scenario assumptions and model version.
- Unknown values, non-nested boundaries and constant-in-view cases are represented correctly.
- The default compact workspace is unaffected while the feature is off.

## CS B02 Additional machine definitions

Status: Largely superseded on 30 October 2026 by libraries (`src/library.ts`): any machine edited in the Machine tab can be saved to a personal library with provenance, exported, imported and shared by URL, and four generic example machines ship built in. Since 31 October 2026 named machines live only in libraries (preloaded Nova Labs; importable DMC2 Mini). Still open: a dedicated machine editor with curve applicability and measured-curve points rather than editing the active experiment then saving; a preload list that users can extend themselves.


## CS B03 Router bits and other cutter geometries

Status: Requested 28 October 2026. Partly delivered 2 November 2026 (model illustrative-static-6): tools carry a geometry class (flat, upcut, downcut, compression, straight, O-flute, ball, V, surfacing) with shop notes, separate cutting-edge and body materials, a shank diameter and an optional upcut length; bending is a two-segment cantilever (fluted length at the cutting diameter, shank above it, body modulus), so carbide-tipped and insert bits are no longer modelled as solid-carbide cylinders; labels, search, recipe matching and the guided start use the geometry; a compression pass shallower than the upcut length is a notice. No new coefficients were introduced and older files reproduce their estimates.

Still open:

- **Depth-dependent engagement.** Ball, V and tapered bits cut at an effective diameter that depends on depth. Today they are flagged as modelled at nominal diameter. Supporting them means an effective-diameter model for surface speed, chipload and the %D axes, a chip-thinning form for the ball, and a decision about what %D means for a V-bit. Design the plot semantics before changing the model.
- **Geometry-keyed cutting data.** Manufacturer chipload charts are stated per bit series and material. `MaterialItem.cutting` is keyed by edge material only; extend it (or CS B04's catalogue) by geometry class, with provenance, before the presets learn anything geometry-specific. The provisional presets still scale by diameter and flute count only.
- **Axial force and chip evacuation** stay qualitative notes; do not model them without evidence.
- **Effective section factor on the shank.** The 0.45 factor is applied to the shank segment as well as the fluted one so existing estimates did not move; a solid shank is stiffer than that. Revisit together with CS B05 calibration rather than alone.

## CS B04 Qualified cutter/workpiece cutting data

Provide sourced surface-speed and chip-thickness starter data for supported end mills and workpieces, with grade/coating, diameter/geometry, operation and cooling applicability. Keep manufacturer starting parameters separate from physical failure limits. The prototype now supplies provisional-1 editable placeholders for all cutter/workpiece pairs. These are not the qualified catalog described here. Material changes load provisional limits; saved overrides are preserved until explicitly replaced. Do not invent a universal HSS-to-carbide speed or chip multiplier.


## CS B06 Machine rigidity / maximum cutting force

Hobby forums identify frame rigidity and cutting force, not spindle power, as the usual limiter on hobby routers. Add an optional per-machine maximum cutting force (or stiffness in N/mm) checked as a soft limit against the estimated force, with provenance. Sienci's LongMill stiffness tests and HSMAdvisor's machine max-force field are reference points.

## CS B07 Sourced starting-chipload band

Show a manufacturer-sourced starting chipload band (e.g. Onsrud, Amana, Freud public charts for 1/8, 1/4 and 1/2 in bits in plywood, soft and hard wood) as an optional overlay on the Speed / feed plot, separate from the failure-style limits, with per-row provenance. Depends on CS B04.

## CS B05 Calibration against reported working cuts

Use the two Big Blue plywood examples documented in calibration-cases.md as initial evidence. Confirm actual machine configuration, exact tools, plywood product and quality/tolerance outcomes before fitting Kc, force allowances or deflection tolerances. Separate parameter fitting from held-out validation; do not tune multiple uncertain inputs solely to make a single working point pass. The old generic chip and deflection limits caused both observed false exclusions; provisional presets address that UI/model-input mismatch, not full calibration.

## CS B08 Guided start follow-ups

Status: Opened 2 November 2026 with the first Guided start release. The flow (`src/Wizard.tsx`, `src/recipeMatch.ts`, `src/startingPoint.ts`, `src/wizardApply.ts`) derives a starting point from the configured limits and matches library recipes; these are the gaps it leaves.

- Material-aware engagement conventions. The seed starts every roughing cut at 50%D stepover / 100%D depth and every finishing cut at 10%D / 50%D, then backs off. Wood roughing is often deeper than one diameter and metals shallower; sourced conventions per material family would shorten the back-off and read more naturally.
- Router-bit geometry in the tool step: delivered with CS B03 on 2 November 2026 (geometry, body and shank choices; compression depth seeding). Ball and V bits are still flagged as modelled at nominal diameter.
- Sourced starting-chipload bands (CS B07) would replace the preset-derived chipload seed with manufacturer-backed values and per-row provenance.
- Save the derived starting point as a recipe from the result screen, carrying the derivation steps as its note.
- Matching across cutter materials (for example a carbide recipe as context for an HSS choice) is deliberately excluded for now; revisit once CS B04 supplies qualified data.
