# Cutspace production specification

Draft 3 · 27 October 2026

Cutspace is an interactive milling decision-support tool for exploring the operating envelope: how speed, feed, tool geometry, engagement and machine capacity constrain one another. The first production release should make those tradeoffs easy to inspect and compare while keeping model assumptions and data provenance visible.

This specification separates confirmed product direction from a recommended first-release design. It describes target behavior; it does not assert that the existing prototype already implements it. The current application remains a reference implementation of the interaction and approximate physics.

## Decisions and scope

### Confirmed requirements

- Retain the linked RPM/feedrate and engagement plots, a shared selected cutting point, adjustable tool/material/machine configuration, numerical outputs and warnings.
- Reverse the prototype's engagement axes: **horizontal = radial width of cut (WOC); vertical = axial depth of cut (DOC)**. Both increase away from the lower-left origin.
- Express both engagement axes primarily as **percent of cutter diameter**. Absolute distances should remain available; opposite-edge scales are a proposed presentation.
- Explore additional quantities simultaneously rather than replacing one heatmap metric with another as the only comparison mechanism.
- Condense the interface so more relevant controls and both plots can be seen together.
- Preserve explicit distinctions between computed quantities, estimates and unvalidated limits. Do not imply that static bending predicts chatter or that illustrative machine parameters are manufacturer specifications.
- Deliver the initial version in a browser with both metric and imperial input/display options.
- Always preserve percentage DOC and WOC when changing cutter diameter, regardless of the current display or entry units.
- Ship with two built-in machines: **DMC2 Mini** and **ShopSabre RC4**. A facility for defining additional machines is deferred to a later release.
- Scenario sensitivity bands are deferred to a future version; see `backlog.md`, item CS-B01.
- Include these initial material categories: **aluminum, plywood, soft wood, hard wood, mild steel and brass**.

### Recommended first-release boundary

A local-first browser application, initially optimized for straight peripheral milling with flat end mills and the six confirmed material categories. Use the current React/TypeScript foundation, but isolate and version the engineering model before extending it. Include the two built-in machine profiles, reusable tool/material setup data, experiment saving, validated JSON import/export, linked views, metric/imperial unit handling and comparison of a small number of cutting points. A packaged desktop application is not required for this release.

Retain metric physical storage and diameter-relative engagement state internally; convert input and display at the interface boundary. Imperial support is an initial-release requirement, not a deferred feature. Accounts, cloud sharing, custom machine creation, CAM integration, G-code generation, machine control, automatic feed optimization, arbitrary cutter geometries and chatter predictions are outside this first-release scope.

The release can be a dependable exploratory tool before it is a validated process predictor. Illustrative and calibrated setups must be distinguishable throughout the UI and exports.

## Initial machine and material coverage

### Machines

The v1 machine selector contains DMC2 Mini and ShopSabre RC4. Each shipped profile needs an identity/version, applicable machine configuration, RPM range, feed limits, mechanical output/torque representation and provenance for each capacity value. Record installed spindle/drive variants where they affect the profile. Do not assume a model name uniquely identifies all installed hardware.

Verified capacity data must be acquired during implementation/qualification. Until available, label a value illustrative or unknown; the prototype's fictional DMC2 Mini values are not production specifications, and no ShopSabre capacities are asserted here. Selecting either machine must use that profile's data rather than relabel the other profile.

Recommended v1 distinction: experiment-specific overrides of known-machine values remain possible for exploration and are visibly marked and saved with the experiment. They do not create or rename an additional machine in the catalog. A machine builder, arbitrary named custom-machine profiles, and adding machines through import are deferred. Imported experiments referencing an unsupported machine must report that state rather than silently substitute a supported machine.

### Materials

The initial selector must include aluminum, plywood, soft wood, hard wood, mild steel and brass. These are product categories, not six universally valid cutting coefficients. Profiles must state the grade/subtype, supported operation, tool applicability, coefficient source and calibration range wherever those distinctions are used by the model.

| Category | Profile details to represent when known |
|---|---|
| Aluminum | Alloy/temper; retain 6061 as the initial named subtype |
| Plywood | Panel construction/product and relevant cutting orientation |
| Soft wood | Species, moisture condition and cutting orientation |
| Hard wood | Species, moisture condition and cutting orientation |
| Mild steel | Grade/condition and applicable tooling |
| Brass | Alloy/condition and applicable tooling |

Give generic starter assumptions explicit illustrative status when a more specific profile is unavailable. Supporting a category in the selector is not evidence that an aluminum-calibrated force model applies to it. Qualify the force/power assumptions and their validity separately for each category; use an unsupported/unknown estimate state where the model cannot defend the calculation. Geometry-based outputs can remain available when force/power estimates are unavailable. Do not silently reuse aluminum coefficients for the other five categories.

Material coverage and machine coverage are separate: the presence of a material and machine in their selectors does not assert that every combination is qualified. Display applicable model and profile limitations for the selected combination. Release preparation must provide a documented starter profile and evidence status for every required category, plus a coverage matrix for the supported machine/material/tool combinations.

## Core workflow

1. Choose DMC2 Mini or ShopSabre RC4, then choose or edit the tool and material setup. Inspect provenance, applicable range and any experiment-specific machine overrides.
2. Select RPM, feed, WOC and DOC using either plot or the cutting controls.
3. Read the modeled envelope, limiting constraints and numerical outputs together.
4. Adjust one variable or compare a saved point to understand the tradeoff.
5. Save the complete experiment, including model version, data sources and unvalidated assumptions.

The primary question is “What changes if I move here?” The interface must also answer “Which constraint is nearest?”, “What assumption creates that boundary?” and “Is the apparent improvement still present under the other plausible inputs?”

## Plot coordinates and linked state

### Speed and feed

Horizontal axis: spindle speed in RPM. Vertical axis: feedrate in the selected distance/time unit. The plot samples RPM and feed while holding the current absolute DOC, WOC, tool, material and machine configuration fixed. Its subtitle states the held engagement in both percent diameter and physical units.

### Engagement

Horizontal axis: WOC, labeled `Radial WOC (%D)`. Vertical axis: DOC, labeled `Axial DOC (%D)`. The plot samples these two quantities while holding RPM, feed, tool, material and machine fixed.

For cutter diameter D > 0:

- WOC percent = 100 × WOC / D; WOC = D × WOC percent / 100.
- DOC percent = 100 × DOC / D; DOC = D × DOC percent / 100.

Example: for a 6 mm cutter, WOC 1.2 mm is **20%D** and DOC 3 mm is **50%D**. The engagement marker is therefore at **x = 20, y = 50**. DOC percentages are relative to diameter, never flute length. DOC must be allowed above 100%D; a 15 mm flute length on a 6 mm tool corresponds to 250%D.

The default WOC domain is 0–100%D for the supported operation. The initial DOC domain includes the usable length limit, the selected point and a modest region beyond the limit where the model remains meaningful. Show flute-length and stickout restrictions as labeled boundaries. Zooming changes the viewport, not the selected cut or physical validity limits.

Zero on an axis is a geometric reference. Zero feed, zero spindle speed and zero engagement are not productive cuts. Hover may describe zero removal, but the classifier must distinguish no-cut/invalid states from within-limit cuts without divisions by zero or fabricated finite replacements.

### Absolute distance on opposite edges

Recommended desktop default: bottom and left axes show %D; top shows absolute WOC and right shows absolute DOC, in mm or inches according to the selected unit system. Each secondary tick is the exact transformation of its primary tick. The two unit systems must not have separately chosen domains or independent zoom states.

A `Physical scales` toggle hides the secondary axes without changing coordinates. On narrow plots, hide only secondary tick labels first; keep paired units in the selected-point readout and tooltip. Do not shrink essential chart text below a readable size to preserve four axes.

### Editing and changes of cutter diameter

Confirmed behavior: **always retain DOC/D and WOC/D when cutter diameter changes**. There is no per-control choice to preserve absolute engagement in v1. Editing engagement in mm or inches first converts that value to its exact diameter ratio; subsequent cutter changes preserve that ratio. Display-unit changes alone preserve both the ratios and the physical cut.

| Cutter change | Engagement before | Engagement after |
|---|---|---|
| 6 to 8 mm | WOC 20%D = 1.2 mm | WOC 20%D = 1.6 mm |
| 6 to 8 mm | DOC 50%D = 3 mm | DOC 50%D = 4 mm |
| 1/4 to 1/2 inch | WOC 20%D = 0.05 in | WOC 20%D = 0.10 in |
| 1/4 to 1/2 inch | DOC 50%D = 0.125 in | DOC 50%D = 0.25 in |

Show paired percentage and absolute values so the consequence is visible. A tool change also updates physical axis labels and recalculates the model. If the resulting physical cut exceeds flute length, stickout or another limit, retain the percentages, identify the violation and offer an explicit adjustment. Do not silently clamp engagement or move the point into the envelope. The fixed retention rule applies only to DOC and WOC; changing diameter does not automatically change RPM, feed or independently entered stickout.

### Metric and imperial units

Provide a visible Metric/Imperial selector in the compact workspace and persist the choice with the experiment. It changes physical axes, editable inputs, selected-point values, output units, tooltips, legends and threshold displays consistently. RPM, flute count, percentages and dimensionless utilization remain unchanged.

| Quantity | Metric presentation | Imperial presentation |
|---|---|---|
| Tool dimensions and absolute DOC/WOC | mm | in |
| Feedrate | mm/min | in/min |
| Surface speed | m/min | ft/min, also labeled SFM where useful |
| Feed/tooth and maximum chip thickness | mm/tooth and mm | in/tooth and in |
| Material removal rate | cm³/min | in³/min |
| Mechanical spindle power | W or kW | mechanical hp |
| Torque | N·m | lbf·in |
| Static deflection | µm | in, with optional thousandths-of-an-inch annotation |

Store and evaluate with one canonical internal unit system; use exact 25.4 mm/in and derived length/area/volume conversion factors. Define and test the mechanical-horsepower and torque conversions explicitly. Conversion is not a new model evaluation assumption. Never round internal state through displayed values when switching units. Show enough decimal places to preserve useful chip-thickness and deflection resolution.

Accept decimal inches for all applicable fields. Fractional tool-diameter entry such as `1/4` is a recommended convenience; if supported, parse only a documented numeric grammar, not arbitrary expressions. Explicitly label advanced coefficient/modulus units; if an advanced field remains in canonical engineering units, visibly identify that exception rather than presenting it as an imperial value.

### Interaction contract

Maintain one canonical cutting point. Selecting either plot updates both markers, all outputs and all constraint checks in the same state revision. A hover probe is temporary and must be visually distinct from the selected point. Clicking or dragging commits a point. Numeric entry and keyboard plot movement offer equivalent access; Escape cancels an in-progress drag to its starting point.

In v1, changing WOC does not automatically compensate feed for chip thinning, and changing RPM does not automatically preserve feed/tooth. Display held quantities explicitly. Coupled controls such as “hold maximum chip thickness” are a later proposal and must have a visible locked-variable state if added.

## Simultaneous visual dimensions

### Recommended default composition

Use **heatmap fill for MRR**, **one independent contour family for estimated spindle utilization**, and **a distinct envelope boundary plus outside-limit treatment**. Keep the selected point at a fixed marker size. Its detail strip shows feed/tooth, maximum chip thickness, torque, estimated deflection and the nearest limits.

This provides three spatially aligned layers without asking the user to interpret a three-dimensional surface. Color metric and contour metric are selected independently. Users can also choose a single layer or the categorical limiting-constraint view. A contour layer that is constant over a plot must say “constant in this view”; do not draw decorative isolines that imply variation.

### Candidate dimensions and encodings

| Quantity | Encoding | Why it helps | Priority and qualification |
|---|---|---|---|
| MRR | Continuous heatmap | Shows productivity throughout each slice | Default fill; computed from geometry and feed |
| Mechanical spindle utilization | Labeled contours, initially 25/50/75/100% | Relates power demand to available output at each RPM | Default overlay; an estimate based on the active machine curve |
| Maximum chip thickness | Alternative contours or chip-band overlay | Makes radial chip thinning visible on the engagement plot | v1 option; distinguish hmax from nominal feed/tooth |
| Static deflection / user limit | Alternative utilization contours | Exposes stiffness and stickout sensitivity | v1 option; static, uncalibrated unless supported by evidence |
| Limiting constraint | Categorical fill, with all failures listed for selection | Explains what creates different portions of the envelope | v1 alternative view; use stable category identity and text |
| Remaining modeled margin | Alternative fill of 1 − max(constraint ratios) | Shows proximity to the nearest configured threshold | Proposed v1 option; dimensionless, negative outside limits, never a safety probability |
| Tool stickout or cutter diameter | Two or three matched small multiples | Shows an additional independent input without occlusion | After core v1; keep scales and comparison assumptions fixed |
| Uncertain Kc or available spindle output | Scenario boundary band | Reveals how assumptions move the envelope | Backlog CS-B01; excluded from v1 |
| Saved cutting points | A/B/C markers plus compact comparison rows | Compares concrete choices while preserving spatial context | v1; use fixed marker shape/labels, not variable-size bubbles |
| Tooth-passing frequency | Selected-point readout, z × RPM / 60 in Hz | Gives a useful excitation-frequency reference | Optional diagnostic; does not establish resonance or chatter |

Prefer scenario small multiples over a third spatial axis for stickout, diameter or tool alternatives. Animation can help inspect a sweep but should supplement fixed comparison views; it must not become the only way to compare states. Avoid simultaneously encoding unrelated quantities in hue, brightness, bubble size, shape and animation.

Do not label every derived display as a new independent dimension. For example, at constant Kc and power allowance, power is proportional to MRR; feed/tooth is constant over the engagement plot while maximum chip thickness changes with WOC. Warn against redundant or invariant layer combinations through concise labels rather than disabling useful inspections.

### Scenario sensitivity bands deferred

Scenario sensitivity bands are a confirmed backlog feature, excluded from v1 and prototype 2. The explanation, candidate interaction and future acceptance criteria are retained in `backlog.md` under CS-B01.

### Scale and legend rules

- Both linked plots share the fill scale for the same metric and units. A visible legend names the quantity, units, scale bounds and any clipping.
- Offer `Auto envelope` and `Fixed` scales. The current within-limit autoscaling is a useful starting mode, but freeze its bounds during a drag and recompute after commit to avoid apparent improvement caused only by recoloring.
- Comparison points/scenarios use fixed common bounds. Show explicit over-range and under-range treatment; do not silently discard outside-envelope values.
- Labeled contours have a separate legend, fixed physical or ratio values and a line style distinguishable from the envelope boundary. Limit contour count and support disabling them.
- Outside-limit classification must remain legible independently of the fill palette. Use restrained hatching or another texture plus the boundary; color and brightness alone are insufficient.
- No feasible samples, an empty contour set, invalid geometry and unknown machine capacity are explicit states. A full-grid fallback must identify itself.
- Constraint ties must have deterministic display behavior; selected-point detail lists every exceeded constraint, not just the largest one.

## Compact workspace

### Recommended desktop arrangement

Replace the permanent tall setup sidebar and introductory hero with a **thin application header, compact setup strip, two plots, a cutting-control strip and one numerical results strip**. Use an inspector for less frequent edits. Condense repetition and whitespace before reducing type size.

| Region | Always visible content | Content revealed on demand |
|---|---|---|
| Header | Cutspace, experiment name/save state, Metric/Imperial, save/export | Model documentation and general preferences |
| Setup strip | Built-in machine/material selectors, tool diameter, flutes, stickout, flute length, profile status | Known-machine data/overrides, material coefficients and evidence; no custom machine builder in v1 |
| View toolbar | Fill metric, contour metric, physical-axis toggle, scale mode | Palette details, domain customization and comparison controls |
| Plot pair | Both plots, selected markers, held-variable subtitles, shared compact legends | Hover probe, focus/expand view |
| Cutting strip | RPM, feed, WOC, DOC, paired %D and mm/in values | Scrub/slider affordance and precision options; percentages always retained on diameter changes |
| Results strip | Surface speed, fz, hmax, thinning factor, MRR, power/utilization, torque, deflection | Formula, source, units and uncertainty details for each output |
| Status line | Illustrative/calibrated context, within/outside/unknown status, nearest or exceeded constraint | All constraints, ratios and warnings |

Keep quick tool fields visible because they are frequent experiment inputs. Moving every control into an accordion would reduce visual clutter but fail the request to compare more controls simultaneously. The curve shape, modulus, stiffness factor, allowances and threshold editor can live in a right-hand inspector. Opening it must preserve the selected point and current plot domains.

Use inline paired values such as `WOC 20%D · 1.20 mm` rather than separate cards. Use short plot titles (`Speed / feed`, `Engagement`) and a single evidence legend. Give each output a short Computed/Estimated designation with details on activation; remove repeated explanatory paragraphs from the main workspace, but retain explicit illustrative-profile and limitation status.

An alternative worth testing is a 200–240 px compact left rail for people frequently editing machine/tool details. Its disadvantage is smaller graphs. The proposed default is the setup strip with an on-demand inspector.

### Density and accessibility acceptance target

At a **1366 × 768 CSS-pixel content viewport at 100% zoom**, the default workspace, with the inspector closed, must show both complete plots, four selected-cut fields, four quick tool fields, machine/material selection, layer controls, all eight result groups and primary status without vertical page scrolling. Proposed height budget: header 44, setup 72, toolbar 40, plot row including axes 340, cutting controls 64, results 72, status 28, with about 50 px for spacing. This is a design target, not a measurement of the current prototype.

Use at least 12 px plot labels and secondary annotations, 14 px primary control text, and 16 px editable fields on coarse-pointer devices. Prefer 32 px desktop control heights with larger touch targets. Keyboard focus, labels, values and errors must remain visible. Test 200% zoom with reflow and scrolling rather than forcing the desktop density target at every magnification.

Below approximately 1100 px, stack plots or provide an explicitly labeled focus view while keeping the selected-cut controls nearby. On phones, show a compact setup summary with immediately accessible editing; do not move all setup controls to the end of a long page as the current prototype does. Preserve all functions at narrow widths and avoid horizontal page overflow. The exact breakpoint must be chosen from measured label/control fit.

## Engineering model and evidence

### Separate mathematical validity from empirical validity

Every calculated output should carry quantity, units, evidence class, applicable model, and dependency provenance. Unit tests can verify arithmetic and algorithm behavior; they cannot validate cutting coefficients or a real machine envelope.

Use three independent concepts: `Computed / Estimated` for an output's derivation; `Illustrative / Manufacturer-sourced / Measured / User-entered` for input provenance; and an explicit calibration/validation record for a model within a stated operating range. A manufacturer source is not automatic validation of the complete process model.

### Baseline equations

Preserve these prototype relationships as a traceable initial model, with lengths in mm, speed n in RPM, feed vf in mm/min, flute count z and material coefficient Kc in N/mm²:

- Surface speed = πDn/1000, in m/min.
- Feed/tooth fz = vf/(nz), in mm/tooth.
- MRR Q = DOC × WOC × vf/1000, in cm³/min.
- For r = WOC/D < 0.5, ideal thinning factor s = 2√(r(1−r)); otherwise s = 1. Maximum chip thickness = fz × s.
- Estimated mechanical cutting power = Q × Kc/60 × power allowance, in W.
- Estimated torque = power × 60/(2πn), in Nm.
- Illustrative available output = min(power plateau, torque plateau × 2πn/60) × usable-output fraction.
- Static deflection uses δ = FL³/(3EI), with the prototype's effective section stiffness and peak-load approximation explicitly recorded in the model version.

Do not promote the prototype's default Kc, power/force multipliers, effective stiffness or threshold values into verified material/tool data. Preserve the conservative intent of allowances while stating that they do not prove upper bounds. The deflection model's integer engaged-tooth approximation creates steps; evaluate these with independent reference cases before changing smoothing or interpretation.

The machine model must support either the illustrative two-parameter curve or measured/sourced RPM/output data. Distinguish spindle mechanical output from electrical power, continuous from intermittent ratings, and reserve from drive efficiency. Outside the supported curve range, report unknown capacity unless an explicitly labeled extrapolation model is selected. Do not interpolate across missing operating bands as if they were measured.

Retain no chatter claim. A future stability model requires dynamics, damping and operating-condition evidence independent of this static model. Also keep machine/holder/workpiece compliance, runout, transient engagement, chip evacuation and wear outside claimed coverage until modeled and validated.

### Classification contract

Separate physical/model invalidity, known exceeded constraints, unknown required data and passing configured checks. When required data are unknown, do not display a complete feasible envelope; known failures may still be shown. Productive samples pass only if all required configured checks are evaluable and satisfied.

Retain checks for chip-thickness band, machine RPM/feed, power/torque capacity, tool engagement, static deflection and surface speed. Thresholds need units, provenance, applicability, enable state and reason. User-disabled checks must be apparent in the status and saved experiment.

No generic green “safe” status. Use language such as `Within illustrative limits`, `Within configured limits` or `Capacity unknown`, with provenance adjacent. Static formulas remain estimates even if an input is measured.

## Data and software architecture

Use a pure, versioned calculation layer independent of React and the canvas renderer. A practical split is input validation/unit conversion, domain model/evaluation, constraint classification, sampling/contouring, state coordination, persistence and presentation. Retain React/TypeScript and Vite unless a later packaging decision justifies replacing them.

An experiment contains:

- Schema version, model version, ID/name, timestamps and notes.
- Machine, tool and material profile IDs **and immutable snapshots** of the actual values used.
- Input provenance, units, operating ranges and validation/calibration references.
- Exact DOC/D and WOC/D ratios as the authoritative engagement state; absolute engagement derived from those ratios and cutter diameter. Exported physical values are a consistency-checked representation, not a second independently editable state.
- Active constraints, allowances, sampling configuration and unsupported-model flags.
- Display units, plot domains, fill/contour selections, scale bounds and saved comparison points.

Keep results derived from the inputs; an export may cache results for readability, but imports must recompute them rather than trust them. Retain full internal precision and round only for display. Parse and validate imported content before changing the active experiment; malformed, nonfinite or unsupported schema/model data must leave the current state intact. Older saved experiments require an explicit migration or compatibility state, not silent reinterpretation.

Local persistence should survive refresh, report save failures and support explicit reset/undo. Built-in profile updates and changes to experiment overrides must not retroactively change saved experiments. No account or network dependency is required for calculation; bundle runtime assets for a production build.

For a changed state, calculate the selected point immediately and schedule grid/contour work separately. Use immutable revision IDs and discard stale asynchronous results. Use a worker when profiling demonstrates that grids interfere with interaction. Never display a new selected-point result against an unlabeled old envelope.

Sampling must use floating-point domain coordinates, not the prototype's rounded pointer-selection helper. Refine around crossings and document resolution. A display contour is an approximation; selected-point classification evaluates the actual cut independently. Do not draw plot-frame edges as if they were discovered physical boundaries.

Proposed performance target: on an agreed reference laptop, 95th-percentile selection feedback under 50 ms and final two-plot update under 250 ms for the default view. Benchmark before fixing a production grid size; expose a visible updating state if a calculation runs longer. These are targets, not current measurements.

## Acceptance scenarios

| ID | Scenario | Required observable result |
|---|---|---|
| AX1 | Select WOC 20%D, DOC 50%D with D = 6 mm | Marker at x20/y50; controls read 1.2/3 mm; physical axes agree |
| AX2 | Raise DOC to 150%D with sufficient usable length | Marker above 100%D; DOC = 9 mm; no artificial 100%D cap |
| AX3 | Switch Metric/Imperial or %D/physical presentation | Same physical cut, ratios and classification; every affected displayed unit updates |
| AX4 | Change D from 6 to 8 mm or 1/4 to 1/2 inch | DOC/WOC percentages preserved, absolute values match the table, limit violations remain visible without silent clamping |
| UNIT1 | Enter a 1/4-inch tool, WOC 0.05 in and DOC 0.125 in, then switch units repeatedly | D = 6.35 mm, WOC = 1.27 mm = 20%D, DOC = 3.175 mm = 50%D; no accumulated conversion drift |
| UNIT2 | Display the same experiment in metric and imperial | Feed, surface speed, chip values, MRR, power, torque, deflection, axes and limits convert consistently |
| CATALOG1 | Select each built-in machine and attempt an unsupported-machine import | DMC2 Mini and ShopSabre RC4 use distinct identified profiles; unsupported machines are reported, not added or silently substituted |
| CATALOG2 | Select each of the six material categories | Named starter profile, provenance/applicability and model support state visible; no fallback to aluminum coefficients |
| LINK1 | Move either plot point, including keyboard and numeric entry | Other plot and outputs update coherently; held variables remain fixed |
| LAYER1 | MRR fill with 25/50/75/100% spindle utilization contours | Independent legends and correctly positioned overlays; boundary remains distinguishable |
| LAYER2 | Choose feed/tooth contours on the engagement plot | Explicit constant-in-view state; no invented gradient |
| SCALE1 | Drag, compare A/B, then choose Auto envelope or Fixed | No scale movement during drag; shared fixed comparison scale; visible clipping/fallback |
| MODEL1 | Exercise half-diameter thinning, spindle crossover and stickout changes | Continuous thinning/capacity at applicable boundaries; correct units and cubic beam scaling |
| MODEL2 | Zero or invalid diameter/RPM; missing output-curve interval | No NaN display/crash; invalid or unknown state; no unsupported feasible classification |
| INPUT1 | Enter malformed numbers or import incompatible JSON | Current valid experiment preserved; field-level actionable error |
| STATE1 | Change parameters faster than grid calculations finish | Only latest revision displayed, or stale result explicitly marked updating |
| SAVE1 | Save, refresh, export and reimport | Same input snapshots, exact engagement ratios, display units, sources, model version and recomputed results |
| UI1 | Default desktop at 1366 × 768 | Required plots, controls, results and status visible without page scroll |
| UI2 | Narrow screen, keyboard-only, 200% zoom, reduced motion | No unreachable controls or overlapping axes; equivalent selection/editing access |
| TRUST1 | Illustrative or unknown values in either built-in machine profile | Provenance and unknown capacity clearly presented; no unsupported manufacturer capacity or chatter-free claim |

Production verification requires unit/analytic reference cases, metamorphic tests, import/migration tests, browser interaction tests and visual regression tests for axes/overlays/responsive layouts. Retain the prototype's reference case (6 mm, three flutes, 10000 RPM, 1200 mm/min, DOC 3 mm, WOC 1.2 mm) as an arithmetic regression, not empirical machining validation. Compare sampled boundaries against independent direct evaluations near each crossing.

## Delivery sequence and release gates

1. **Interaction specification review:** carry forward confirmed browser delivery, metric/imperial support, percentage retention, two built-in machines and six material categories. Agree default layers and compact layout; sensitivity bands remain deferred. Approve the detailed model scope independently of illustrative formulas.
2. **Model and state foundation:** isolate validation/conversion/evaluation/classification; version profiles and experiments; prepare both built-in machine profiles and all six material starter profiles; add provenance, analytic reference tests and unknown states. Gate: reproducible results, explicit coverage matrix and no hidden input adjustments.
3. **Compact explorer:** reverse/normalize engagement axes, add physical secondary scales, independent contour layers and condensed controls. Gate: AX/UNIT/LINK/LAYER/UI acceptance scenarios and measured density target.
4. **Durable experiments:** persistence, validated import/export restricted to supported machine identities, immutable profile snapshots and A/B/C comparison. Gate: SAVE/INPUT/STATE/CATALOG scenarios and recovery from failed saves.
5. **Engineering qualification:** review reference formulas; source/verify both machine configurations; document applicability and starter assumptions for all six material categories; characterize specific machine/tool/material combinations using documented measurements. Record conditions and error ranges. Gate: coverage is explicit for both machines and every material category; any advertised calibrated prediction has evidence over its stated range, while unqualified estimates remain visibly illustrative or unavailable. Full empirical validation of every cross-product combination is not implied.

## Decisions still open

- Which installed spindle/drive configurations should the DMC2 Mini and ShopSabre RC4 profiles represent?
- Which initial subtypes/grades or representative assumptions should ship under each material category?
- Which machine/tool/material combinations and measurements will define the first qualification dataset?

## Specification provenance

Confirmed direction comes from the original Cutspace request and the follow-up design requirements of 27 October 2026. Current behavior was checked against the local prototype's README, calculation module and plot mapping. The follow-up confirms imperial support in v1, percentage retention on cutter changes, browser delivery, DMC2 Mini and ShopSabre RC4 as the initial machines, later custom-machine definition, and the six listed material categories. Other new layout, persistence, architecture, model-qualification and release proposals remain draft requirements for review.

The prototype README contains the formula references and detailed baseline approximation notes. Those references support standard relationships; they do not certify Cutspace's demonstration coefficients, limits or machine profile.

## Contextual help requirement · 27 October 2026

Every meaningful control, numeric field, output, status, legend, plot axis and comparison value must provide explanatory hover text. Explain its purpose and effects, not just repeat the label. Cover the inspector and unavailable/disabled states as well as the main workspace. Expose the same explanation on keyboard focus and to assistive technology, allow Escape to dismiss it, and keep help readable without changing the compact layout. Preserve the model’s computed/estimated/illustrative distinctions in help text.

## Help and envelope navigation update · 28 October 2026

Desktop explanations must float adjacent to their target, including in Brave, and stay within the visual viewport under scrolling or browser zoom. Phone access must not depend on hovering: an explicit Help mode allows tapping a control, output or plot for a persistent explanation without triggering its action. Include close/Done controls and keep ordinary editing and scrolling available outside Help mode.

Each plot needs a Fit envelope action and a Reset view action. Fitting uses passing samples in the broader machine/tool domain with padding, includes the selected point even when outside the envelope, and never changes the cutting point. No passing samples or unknown required data must produce an explanation instead of a fabricated region. Preserve the shared color bounds during the view change. Wheel/pinch navigation remains optional; the prototype implements the explicit buttons, and (30 October 2026) per-plot zoom in/out buttons that step the range by a quarter about the selected cut, clamped to supported bounds.


## Help and limit explanations update — 2026-10-28

This supersedes the earlier automatic hover/focus behavior. Visual explanations must appear only after the user enables Help mode with the Help button. Hovering or focusing during normal editing must never open an explanation. In Help mode, click/tap or keyboard Enter/Space shows persistent help without activating the target; Done exits and removes the explanation immediately. Preserve accessible descriptions outside the mode.

The Limits inspector must explain every check in beginner-friendly language: actual value versus bound (metric or imperial), what the quantity measures, why crossing the limit can matter, adjustments to explore and their interacting effects, and model limitations. Exceeded and unavailable checks start expanded; other checks are explicitly expandable. Distinguish below-minimum from above-maximum conditions, show all three geometry comparisons, and distinguish no-cut from thin-chip cutting. Keep the main workspace compact with a visible Details entry point. Never present a fictional threshold as a verified failure boundary or predict chatter from static deflection.


## Contour readability update — 2026-10-28

Provide permanent labels aligned to the local screen-space direction of each contour, rotated to remain upright. On-plot labels omit unit suffixes except `%`; values use the selected unit system and full units remain in the legend/readouts. Do not draw background rectangles behind labels. Avoid overlap with labels, selected/pinned markers and plot edges; omit labels on short or crowded lines. Keep plot selection and explicit Help mode unchanged.

A compact Coarse / Standard / Fine dropdown selects contour spacing. Default to Standard, with 25 percentage-point steps for ratio metrics and readable unit-aware chip intervals based on the configured chip range. Use the same numerical levels for both plots. Show the actual interval and selected-cut contour value in the legend, and report contour values in the pointer probe. Describe constant, unavailable and no-level slices explicitly. Bound work for extreme domains and disclose any widened interval. Preserve spacing through local save and JSON exchange; version 2 files without the setting use Standard. This controls contour density, not physics sampling resolution.


## Cutter-material requirement · 28 October 2026

Initial release supports carbide and HSS flat end mills. Cutter substrate is distinct from workpiece material and is visible in the compact setup strip, Tool inspector and comparisons. Model straight peripheral milling with homogeneous flat end mills; router-bit profiles and carbide-tipped construction are future work (CS B03).

The prototype uses representative elastic modulus defaults (carbide 600 GPa; HSS 219 GPa), with source links and numeric override in Tool. Changing substrate replaces the modulus with its default and preserves all geometry and cutting inputs. Re-selecting the existing substrate preserves overrides. Estimates must distinguish elastic stiffness from hardness, edge strength and temperature capability; no arbitrary power or chip multiplier is introduced.

Cutting data belongs to a cutter/workpiece combination. A substrate or workpiece-category change retains the entered chip/speed limits but makes them unavailable until supplied and enabled for the new combination. Show a persistent status link to Limits, keep direct geometry outputs available, and do not draw a passing envelope while those required checks are unknown. Enabling entered values is an assumption selection, not validation. Future qualified presets need sources, operation applicability, diameter/geometry, grade/coating, cooling and evidence status; no universal HSS/carbide conversion factor.

Persist cutter material, numeric modulus and cutting-data availability in active configurations and immutable pins. The model version is illustrative-static-3; migrate earlier illustrative-static-2 files to explicit carbide without changing numeric overrides or recomputed results. Reject unsupported substrates and malformed availability flags. Test bending ratios, unchanged demand/geometry, unknown-envelope handling, metric/imperial round trips and snapshot restoration.


## Provisional presets and Big Blue · 29 October 2026

This amendment supersedes the previous behavior that disabled limits on every material change. Provide explicit, editable provisional chip/speed/deflection limit sets for all six workpieces × carbide/HSS. A material change loads that set; it must not silently reuse the aluminum starter in plywood. Preserve selected cutting point, geometry and machine capacity. Keep force/deflection formulas unchanged until calibration supports a change. Existing saved experiments retain their limits and offer Use provisional preset; do not silently overwrite user overrides or pinned configurations. Persist preset version and clear its attribution when values are edited. Deflection allowances are tolerance assumptions, not failure limits.

Add Big Blue as a third built-in profile by explicit user request, initially identical numerically to ShopSabre RC4. Preserve a separate ID/name and independent experiment overrides. This does not introduce a general custom-machine editor or assert verified Big Blue capacity. Earlier references to a two-machine initial scope are superseded by this addition.

Provide undoable example loaders for the user's 300 IPM plywood cut and the shared 200 IPM screenshot case. Record observations and missing/assumed data separately in calibration-cases.md. Test exact geometry, legacy-limit failures, unchanged estimated demand, provisional classifications, machine-copy equality and persistence. A passing regression establishes software behavior, not physical validation.


## MRR contours on both plots · 29 October 2026

Add Material removal rate (MRR) to the shared contour selector, independently of the heatmap. Render on both RPM/feed and DOC/WOC views using a common interval. MRR is horizontal in the speed/feed slice and follows constant DOC × WOC curves in the engagement slice. Calculate in cm³/min; convert to in³/min for imperial labels/legend/probes. Preserve unit-free on-plot labels, aligned text and Coarse/Standard/Fine spacing. Choose readable MRR intervals from the smaller varying visible range, with existing extreme-range work bounds. Persist MRR selection. Metrics truly constant in a slice must retain an explicit constant notice instead of fabricated curves.


## Automatic fill range correction · 29 October 2026

Supersedes earlier passing-envelope scaling and implicit color locks. Auto range uses the full finite minimum/maximum of geometrically valid visible samples across both plots, independent of whether constraints pass. Both plots retain one shared linear scale. Exclude unavailable/invalid gray cells; handle constant fields with a finite nonzero span. Do not clamp margin to -100% or force a zero endpoint on a zoomed nonzero range. Color conveys metric value; hatching and the boundary convey feasibility.

Pinning, Fit envelope and Reset view preserve automatic/fixed mode; they must not implicitly lock the scale. Drag freezes the active range until release. Switching machine, workpiece or cutter material returns to automatic scaling. Users can explicitly choose Fixed scale or enter bounds for comparison; saved/imported fixed scales remain intact. Legend shows visible range versus fixed/clipped mode, using appropriate unit precision including imperial deflection.

## Hobbyist review changes · 30 October 2026

Outcome of a review for the beginner-to-intermediate hobbyist audience and a numeric cross-check against public calculators (CustomPartNet horsepower/torque, Machining Doctor chip thinning, Omni cantilever deflection), all of which agreed with Cutspace's formulas.

- **Vocabulary.** Controls and outputs use chipload (feed per tooth), stepover (WOC) and depth of cut (DOC); imperial surface speed reads SFM; the chip-thinning cell is labelled Feed multiplier. Status text no longer says "illustrative"; one status-row chip and the About tab carry the example-values caveat. Editable fields display four significant figures.
- **Margins made visible.** Result cells and the Limits tab state the power allowance, force allowance and section factor already inside the shown estimates, and how much higher they are than a textbook value. Imperial deflection also shows thousandths.
- **Tips preference.** Supersedes the 2026-10-28 rule that explanations appear only in Help mode: a compact tip (first sentence, More… to pin) appears after the mouse rests ~0.7 s on a control, only for fine pointers, never during a drag or in Help mode, and can be switched off in the header or About tab (`cutspace-prefs-v1`). Help mode is unchanged. A one-time welcome banner offers the tutorial, Help and a plywood example.
- **Soft and hard limits.** Constraints carry `kind`. Hard (RPM range incl. tool max RPM, machine feed, reach) keep the white dashed boundary and hatching. Soft (chipload, power, torque, deflection, surface speed) get a caution band from `limits.caution` (default 0.75, editable, persisted, defaulted for older files) to the limit: amber dashed and red contours, texture rather than tint (sparse stipple in the caution band, sparse 45° lines beyond; dense 135° hatching stays reserved for hard-limit failures, invalid and unknown cells), Caution status, per-check Comfortable/Caution states and a Limit zone categorical fill.
- **Reach, not engagement.** WOC ≤ D is a validity condition; the geometry ratio compares DOC with flute length and stickout only, so slotting is no longer "100% of a limit".
- **Presets.** Chip bands scale with diameter (0.4–2.5× of the 6 mm reference) and flute count (1 flute ×1.8, 2–3 ×1, 4+ ×0.8) when applied; wood surface ceilings raised to 1500/1000 m/min; tools gain an optional max RPM rating checked with the RPM range. An **Operation** selector (Roughing default, Finishing) multiplies the finishing deflection allowance by 4 for roughing; it is stored in `limits.operation`, defaults to roughing for older files, re-applies an active preset or scales a custom allowance by the same ratio, and never changes the cut. Base deflection allowances are now finishing values (metals 25 µm, wood 25/20 µm).
- **Libraries.** Personal and shared libraries of machines, tools and recipes with provenance, per-item and batch export, validated import with Skip/Replace/Keep-both conflict handling, URL-fetched read-only shared libraries with refresh, and experiments referencing library machines as `lib:<library>/<item>` while keeping value snapshots. Built-in: DMC2 Mini, ShopSabre RC4 (provenance note: confirm from the Nova Labs nameplate), Big Blue, three generic examples, six starter tools, two reported plywood recipes.
