# Cutspace · prototype 2

A browser-based milling operating-envelope explorer. React + TypeScript + Vite, with canvas heatmaps and SVG axes/contours. Calculations and saved experiments stay local; no backend, machine connection or account is required.

The target behavior is in [the production specification](docs/production-spec.md). This is a second interaction prototype, **not a production-qualified machining calculator**. [Implementation status](docs/prototype-2-status.md) distinguishes implemented behavior from remaining production work. [Backlog](docs/backlog.md) records scenario sensitivity bands and custom machine creation as deferred features. Prototype 1 is preserved in `docs/archive/prototype-v1.tar.gz`.

## Run

Requires Node.js 22.18+ and npm. Dependencies are already installed in the project used to build this prototype.

```sh
cd ~/projects/cutspace
npm install          # only needed on a fresh checkout
npm run dev
```

Open the URL printed by Vite, normally http://127.0.0.1:5173. It binds to loopback only.

```sh
npm test             # numerical, units, persistence, help, limit, zone, library and contour checks
npm run build        # TypeScript checking + production bundle
npm run preview      # serve the built bundle locally
```

## Deploy to craigandera.org

The unlisted prototype lives at https://www.craigandera.org/software/cutspace/.
The site's existing CloudFront redirects also accept
https://craigandera.org/software/cutspace (canonical `www`, then trailing slash).
It has a `noindex, nofollow` meta tag and no site-navigation entry. This is
public link access, not authentication or private hosting.

```sh
cd ~/projects/cutspace
npm run deploy:site
```

`scripts/deploy-site.sh` runs tests and builds with Vite base
`/software/cutspace/`, decrypts the site's existing GPG credentials into the
process environment, and uses the site's account check and infrastructure
state. GPG must already be unlocked. Credentials are never printed or saved.
It uses `aws s3 cp` only under `software/cutspace/`, uploads hashed assets before
HTML, and invalidates only `/software/cutspace*` in CloudFront. It does not run
the main site's deploy or publish unrelated pending content.

The script also copies the bundle into the Hugo site's
`static/software/cutspace/` and current `public/software/cutspace/` so a later
normal site deployment does not delete it. Keep the static bundle in the site
repository when committing that site. Old hashed assets are retained for
already-open browser tabs. The canonical application source remains here.
`npm run build:site` builds without publishing. Preview that subpath build with
`npm run preview -- --base=/software/cutspace/`. The ordinary `build` command
still supports root-path local previews.

Saved experiments belong to each browser origin. Export JSON from localhost
and import at the live URL to carry them across; there is no server storage.

## Explore

The interface uses the terms hobby CNC users use: **chipload** (feed per tooth), **stepover** (radial width of cut, WOC) and **depth of cut** (DOC, depth per pass). Imperial surface speed is shown as SFM. Editable fields show four significant figures rather than raw conversions.

- Two linked slices: RPM horizontal / feedrate vertical; **radial WOC horizontal / axial DOC vertical**. The engagement axes use percentage of cutter diameter. Physical-unit axes can be shown opposite them when there is room.
- Drag or click a plot to select a cut. Focus the plot and use arrows (1% of the axis; Shift = 5%). Numeric controls offer the same selection. Undo restores an earlier edit or a complete drag. Escape cancels an active drag or a numeric draft.
- Switch metric/imperial at any time. Common lengths, feed, surface speed, chip thickness, MRR, power, torque and deflection convert without changing the stored setup. Simple fractions such as `1/4` are accepted. Advanced coefficients retain explicit N/mm² and GPa units.
- DOC/WOC ratios are authoritative. Changing diameter always retains %D, even after absolute-unit editing. RPM, feed and stickout stay unchanged. For example, 20%D WOC / 50%D DOC on a ¼-inch cutter is 0.05 / 0.125 inch.
- Select an independent heatmap fill and contour overlay. Fills include MRR, power, nominal feed/tooth, maximum chip thickness, deflection, spindle utilization, remaining margin and limiting constraint. The shared contour selector applies to both plots. Contours include MRR, utilization, chip thickness, feed/tooth and deflection relative to its limit. MRR lines are horizontal on RPM/feed (engagement held fixed) and curved on DOC/WOC (feed held fixed). Constant or unavailable contours are identified explicitly.
- Contours have permanent on-plot value labels aligned to the local line direction and kept upright. Labels omit unit suffixes except `%`; numbers still use the selected metric/imperial system, with full units retained in the legend and readouts. There are no background rectangles; a thin glyph outline keeps text legible over the heatmap. **Spacing → Coarse / Standard / Fine** controls the interval. Standard defaults to 25 percentage points for ratio contours; chip intervals are rounded to readable values from the configured chip range and chosen units. MRR intervals adapt to the smaller nonconstant visible slice, rounded in cm³/min or in³/min; cubic conversion is separate from distance conversion. Both plots share the interval, shown beside the gold-line legend together with the contour value at the selected cut. Wider spacing means fewer lines; Fit envelope helps separate dense lines. Labels avoid the marker, plot edges and one another, with a size-dependent budget; some crowded/short contours remain unlabeled. The pointer probe also reports the contour value. Constant or unavailable overlays get an explicit note. Very extreme ranges widen the interval to bound rendering work, and the legend states this. Spacing does not change the 72 × 48 model grid or cutting point; it persists in saved/exported experiments, and older files default to Standard.
- Both plots share one color scale. **Auto range** fits the minimum and maximum finite values across all geometrically valid visible samples, including cuts outside the configured limits. It adapts after edits and zooming, so outside-envelope values no longer collapse into the top color. Invalid gray cells and unavailable values do not affect the range. Constant fields receive a small nonzero range. Bounds freeze only during a drag; pinning and fitting do not silently lock them. Fixed scale remains an explicit choice, with clipping outside its bounds. Changing machine, workpiece or cutter material returns to Auto range. Imported/saved fixed bounds remain fixed until changed explicitly or through such a setup switch. Model & limits → View edits fixed bounds and plot domains. Fit view includes the current cut and the machine/tool domains, within supported input bounds.
- The white dashed boundary approximates passing regions. Hatching identifies outside, invalid, no-cut or unknown regions. A constraint color is the highest known normalized ratio; inside the region it identifies the nearest limit. Unknown checks remain visible and never produce a fully passing classification.
- The compact setup strip exposes machine/material, diameter, flutes, stickout and flute length. Model & limits opens a separate inspector for detailed assumptions, thresholds and display settings. Eight result cells remain visible below the selected-cut strip.
- Pin up to A/B/C and open Compare. A pin retains its full configuration and exact ratios; restoring it restores that configuration. Pins appear on plots only when their configuration and held slice match the active experiment.
- **Soft and hard limits.** Hard limits (RPM range including the tool's own maximum RPM, machine feed, tool reach) draw one white dashed boundary and hatch the outside. Soft limits (chipload high/low, power, torque, deflection, surface speed) do not fail at a single number, so the plots draw an amber dashed line where the most-used soft limit enters its caution band (default 75% of the limit, editable in Model & limits → Limits) and a red line where it is exceeded; the caution band carries a sparse amber dot stipple and the beyond region sparse red 45° lines, each in the colour of its boundary line, so zones use texture rather than a second hue over the fill. The status row reads Within your limits, Caution · near a soft limit, or N limits exceeded, and each check in Limits says Comfortable, Caution or exceeded. A categorical **Limit zone** fill is also available. A full-width slot is a valid cut and is no longer counted as 100% of a limit; a stepover wider than the cutter is invalid.
- **Margins are labelled.** Result cells note the multipliers already inside the shown power, torque and deflection (power allowance, force allowance, section factor), and the Limits tab states how much higher they are than a plain textbook calculator. Imperial deflection also shows thousandths of an inch.

Two ways to read explanations. **Tips** (header toggle, on by default, stored per browser in `cutspace-prefs-v1`) show the first sentence of an item's explanation after the mouse rests on it for about 0.7 s, with More… to pin the full text; tips never appear for touch or pen input, during a drag, or while Help mode is on. **Help** mode gives persistent explanations: click or tap Help, then an item, without activating it or changing the cut. Keyboard users can Tab to an item and press Enter or Space. Close dismisses the explanation; Done exits Help mode; Escape dismisses first, then exits. Accessible descriptions remain available to assistive technology. A one-time welcome banner points new users to the tutorial, Help and a plywood example; a fresh start in a US-English browser begins in imperial units.

Click **limits exceeded · Details** (or Model & limits → Limits) for beginner-oriented diagnostics. Each check shows the selected value and configured bound in the active units, what it measures, why it matters, and adjustments to explore with their tradeoffs. Exceeded/unavailable checks start expanded; others can be expanded explicitly. Lower-bound warnings say “Below minimum.” Geometry lists WOC/diameter, DOC/flute length and DOC/stickout separately. Zero removal is not presented as a thin-chip cutting problem. Guidance is qualitative; fictional thresholds remain unvalidated and deflection is not a chatter prediction.

Explanations draw on [Harvey’s chip-thinning guide](https://www.harveyperformance.com/in-the-loupe/combat-chip-thinning/), [tool deflection guide](https://www.harveyperformance.com/in-the-loupe/tool-deflection-remedies/) and the milling relationships linked in the inspector. These references support mechanisms, not this prototype’s default numbers.

Each plot has **zoom in / zoom out**, **Fit envelope** and **Reset view** buttons. Zoom steps the visible range by a quarter about the selected cut when it is in view (otherwise about the plot centre), clamped to the supported axis bounds with a minimum span; it never changes the cut. Fit envelope samples the broader machine/tool domain, then fits the bounding rectangle of its passing samples plus the current cut, with padding. A point outside the envelope stays visible. Empty or unknown envelopes leave the view unchanged with an explanation. Fitting preserves the chosen scaling mode: automatic colors refit the visible data, while an explicit fixed scale keeps its bounds. It does not change cutting inputs. Reset view restores that plot’s broader domain. Mouse-wheel and pinch plot zoom are not implemented; the buttons work with mouse, keyboard and touch. Sampling can miss very narrow regions, so this is an approximate display fit.

## Save and exchange experiments

The active experiment autosaves under `cutspace-experiment-v2` in this browser's local storage. Save performs an explicit write. Export downloads a versioned JSON file; Import validates a file before replacing the active experiment, with Undo available. Storage failures are shown, and a malformed stored experiment pauses autosave until explicitly replaced.

Files contain inputs, full comparison snapshots, unit/view settings and schema/model versions. Results are always recalculated. Unsupported versions, machines and invalid numeric data are rejected without replacing the active experiment. Older schema-2 / illustrative-static-2 experiments migrate to explicit carbide and active entered cutting limits, preserving numerical overrides and results in active setup and pins. Current model is illustrative-static-3. Prototype 1 exports require migration and are deliberately rejected. Imported numeric overrides keep the illustrative/user-assumption provenance; a file cannot claim empirical validation.

`examples/envelope-study.json` is an importable two-point example. There is one active autosaved experiment, not yet a multi-experiment library. Use exported files for separate studies and backups.

## Libraries

**Library** (header button, or Model & limits → Library) manages machines, tools and cut recipes. The built-in library is regenerated from code and holds the six machines above, six starter tools and the two reported plywood cuts as recipes. **My library** is editable: Save machine, Save tool and Save cut as recipe store the active values with a name; Use loads a machine or tool, Load replaces the experiment with a recipe (undoable). Items carry provenance (example values, manufacturer data, measured, entered by a user) and a note. Experiments keep their own value snapshots, so editing or deleting a library item never changes a saved experiment or pin; a library machine is referenced as `lib:<library>/<item>` and an experiment whose machine is in no library is labelled “from file” and still works.

Export downloads a whole library or the checked items as `cutspace-library-<id>.json` (schema `1`). Import validates a file, then asks which editable library receives it and what to do with items whose ids already exist (Skip, Replace, or Keep both with a new id), or adds it as a new read-only shared library. **Add shared** fetches a library file from a URL (for example a makerspace list hosted as static JSON) and keeps it read-only with Refresh and Copy-to-mine; a failed refresh leaves the stored copy intact. Non-built-in libraries persist in `cutspace-libraries-v1`. See `src/library.ts` for the format.

## Scope and evidence labels

**This is a visualization prototype, not a cut recommendation or safety assessment.** “Within your limits” means only that all configured ratios pass. Default thresholds are unvalidated. Tool breakage, workholding failures, machine compliance and chatter are outside this model.

- **Computed:** algebraic relationships from inputs: surface speed, feed/tooth and MRR.
- **Geometry:** ideal radial chip thinning and maximum chip thickness, without runout or edge effects.
- **Estimated:** power, torque, force, static deflection and spindle output.
- **Illustrative limits:** editable thresholds used to construct the displayed envelope.

All three machine profiles and all six material coefficients are **fictional demonstration inputs, not verified manufacturer specifications or material recommendations**. Distinct profiles exercise the interaction; selecting a machine does not establish its capabilities or its suitability for a material. Power refers to spindle mechanical output, not electrical input. The inspector allows capacity or force models to be marked unavailable. Actual sourced/measured data and qualification remain production prerequisites.

| Built-in machine | RPM range | Feed limit (mm/min) | Power / torque plateaus | Usable fraction |
|---|---:|---:|---:|---:|
| DMC2 Mini | 3000–18000 | 3000 | 250 W / 0.3 N·m | 75% |
| ShopSabre RC4 | 6000–24000 | 10000 | 1500 W / 0.9 N·m | 75% |
| Big Blue | 6000–24000 | 10000 | 1500 W / 0.9 N·m | 75% |
| Desktop mill (example) | 2000–10000 | 2500 | 500 W / 0.6 N·m | 75% |
| Hobby router (example) | 10000–30000 | 5000 | 900 W / 0.4 N·m | 75% |
| 4×4 industrial router (example) | 6000–24000 | 15000 | 3000 W / 1.6 N·m | 75% |

These numbers must not be cited as specifications for any machine. The RC4 entry carries a provenance note in the Library tab: public resale listings describe RC4s with roughly 4 HP (3 kW) HSD spindles and 18,000 RPM maximum, and the values should be confirmed from the nameplate of the actual machine (the Nova Labs RC4) before being relied on. The three generic examples are starting points for people whose machine is not listed; edit them, then save the result to a library.

| Material category | Fictional Kc (N/mm²) |
|---|---:|
| Aluminum · 6061 | 1000 |
| Plywood | 100 |
| Soft wood | 80 |
| Hard wood | 150 |
| Mild steel | 1800 |
| Brass | 850 |

Every category currently uses the same simple constant-coefficient force/power model and generic editable limits. Wood species, moisture, grain, panel construction and metal alloy/temper are not resolved. Distinct numerical examples are not calibrated material models.

## Seed setup

### Cutter material and tool scope

The compact setup strip separates **Workpiece** from **Cutter**. Initial cutter choices are **Carbide** and **HSS**, assuming homogeneous flat end mills. Router bits, carbide-tipped bodies, ball/taper/form tools and coatings are outside this model; router-bit support is recorded in the backlog.

Choosing carbide loads a representative 600 GPa elastic modulus; choosing HSS loads 219 GPa. Switching replaces any modulus override; selecting the existing material does not. The Tool inspector shows the active modulus and whether it differs from its representative default. These are stiffness assumptions, not hardness or breakage limits. [Everloy’s carbide property tables](https://www.everloy-cemented-carbide.com/en/material/kind/) include 600 GPa for some grades and show substantial grade variation. [BÖHLER S600’s data sheet](https://www.voestalpine.com/highperformancemetals/usa/app/uploads/sites/294/2025/08/s600_en_us.pdf) reports 219 GPa at 20°C for that HSS grade. These sources support representative elastic properties only, not this model’s force assumptions or cutting recommendations.

At identical geometry and force, the HSS bending estimate is 600/219 ≈ 2.74 times the carbide estimate. Geometric outputs, MRR and estimated cutting power/force are unchanged: no unsupported substrate multiplier is applied. Cutter-material changes preserve diameter, flutes, stickout, engagement ratios, RPM and feed. Snapshots retain the material and modulus override.

Surface-speed and chip-thickness limits cannot be derived from elastic modulus. Each cutter/workpiece combination has an explicit **provisional preset** referenced to a 6 mm two-flute flat end mill in a finishing cut. When a preset is applied the chipload band is scaled linearly with cutter diameter (bounded to 0.4–2.5×) and by flute count (single flute ×1.8, two or three flutes ×1, four or more ×0.8), and the deflection allowance is scaled by the **Operation** chosen in the setup strip: Finishing uses the base allowance, Roughing allows 4×. Operation is a multiplier, not a second set of numbers; switching it re-applies the preset, or scales a custom allowance by the same ratio. Changing either material loads its chip band, surface-speed ceiling and deflection allowance, replacing prior limit overrides; Undo restores the previous configuration. Geometry, cut and machine settings remain unchanged. The Tool inspector still permits modulus overrides. Editing a limit clears the preset label to `Saved / custom limits`. Explicitly disabled cutting checks still stay unknown until enabled or replaced by a preset.

Saved experiments and pins retain their numbers and availability when loaded; no existing values are silently replaced. To update an older setup, open **Model & limits → Limits → Use provisional preset**. A disabled-checks notice also has that action. Numeric results remain derived from unchanged formulas (model illustrative-static-3); optional `limits.preset` identifies provisional-1. This version adds presets, not a physical-model calibration.

### Provisional limit catalog

These values are deliberately editable engineering placeholders for exploration, not tool-maker recommendations. Chip bands are stated for 6 mm and scale with diameter when applied; nothing scales with depth, and changing diameter afterwards keeps the current limits until Use provisional preset is chosen again. Wood values allow more chip thickness than the generic metal starter, and use a deliberately high surface-speed ceiling because wood routing is governed by chipload, burning and the bit's maximum RPM rating (enter it as Tool max RPM) rather than by surface speed. The low-chip thresholds are illustrative, not measured minimum chip thicknesses. A deflection allowance expresses an assumed tolerance, not a breakage threshold.

| Workpiece | Cutter | Chip band (mm, 6 mm two-flute) | Finishing bending allowance (µm; roughing ×4) | Surface ceiling (m/min) |
|---|---|---|---|---|
| Aluminum | Carbide | 0.008–0.055 | 25 | 450 |
| Aluminum | HSS | 0.008–0.055 | 25 | 120 |
| Plywood | Carbide | 0.025–0.30 | 25 | 1500 |
| Plywood | HSS | 0.025–0.25 | 25 | 1000 |
| Soft wood | Carbide | 0.025–0.35 | 25 | 1500 |
| Soft wood | HSS | 0.025–0.28 | 25 | 1000 |
| Hard wood | Carbide | 0.020–0.25 | 20 | 1500 |
| Hard wood | HSS | 0.020–0.20 | 20 | 1000 |
| Mild steel | Carbide | 0.005–0.040 | 25 | 120 |
| Mild steel | HSS | 0.005–0.040 | 25 | 30 |
| Brass | Carbide | 0.008–0.070 | 25 | 200 |
| Brass | HSS | 0.008–0.070 | 25 | 70 |

Example: a 4 mm single-flute carbide cutter in aluminum, roughing, receives a chip band of 0.005–0.066 mm and a 100 µm bending allowance; the same cutter finishing keeps the band and drops the allowance to 25 µm.

Big Blue is a separately selectable profile with the exact ShopSabre RC4 numerical defaults, at the user's request. It is not independently measured. Two reported successful plywood cuts can be loaded from **Assumptions** or imported from `examples/big-blue-plywood-300-ipm.json` and `examples/big-blue-plywood-shared-200-ipm.json`. [Reference-case notes](docs/calibration-cases.md) distinguish reported settings from assumptions and reproduce the previous failures. Both pass the provisional plywood preset without changing estimated forces or spindle capacity. The examples do not qualify the full operating envelope.


The starting cut uses a 6 mm, three-flute flat carbide end mill, 20 mm stickout, 15 mm usable flute length, 600 GPa modulus and 0.45 effective section stiffness. Power/force allowances are 1.25× / 1.3×; these express conservative intent without proving bounds. The generic chip-thickness band is 0.008–0.055 mm, deflection limit 25 µm and surface-speed limit 450 m/min.

At 10000 RPM, 1200 mm/min, 50%D DOC and 20%D WOC: speed = 188.50 m/min; feed/tooth = 0.0400 mm; maximum chip thickness = 0.0320 mm; MRR = 4.32 cm³/min; estimated power = 90 W; torque = 0.08594 N·m; static deflection ≈19.37 µm. Passing the fictional thresholds is an arithmetic regression, not experimental validation.

## Physics model, units and assumptions

The implementation lives in `src/model.ts` and has no UI dependencies. Symbols below use diameter D, stickout L, axial DOC ap, radial WOC ae in mm; spindle n in RPM; feed vf in mm/min; flute count z. Positive finite inputs are required by the model; the UI constrains them. Direct library callers must validate their own inputs.

### Geometry and material removal

```text
surface speed vc = π D n / 1000                           [m/min]
feed per tooth fz = vf / (n z)                           [mm/tooth]
MRR Q = ap ae vf / 1000                                  [cm³/min]
r = ae / D, 0 ≤ r ≤ 1
chip-thinning factor s = 2 √(r (1-r)) if r < 0.5, else 1
maximum chip thickness hmax = fz s                       [mm]
feed multiplier = 1 / s
```

The thinning formula follows the engagement angle of an ideal cylindrical cutter. Above half-diameter engagement the sweep includes the maximum chip thickness, so the factor stays at one (it does not fall back to zero during slotting). This is straight peripheral milling: no corner-radius, ball-nose, lead-angle, ramping or entry model. The feed multiplier is informational and **never automatically applies a feed increase**. Low-chip warnings use hmax rather than nominal fz. Zero feed, DOC or WOC is a real no-cut state. It cannot pass the operating-envelope check; the UI permits zero without secretly changing it.

### Power and torque

```text
estimated mechanical cutting power P = Q Kc / 60 × powerAllowance  [W]
estimated torque T = P × 60 / (2 π n)                              [Nm]
available power = min(Pplateau, Tplateau × 2 π n / 60) × usableFraction
```

The model uses an effective constant Kc and omits chip-thickness size effects, rake/helix dependence, lubrication, edge wear and changing material properties. The power allowance adds explicit margin. It does not imply a validated upper bound. The machine curve is a constant-torque region followed by a constant-power region. Its crossover follows from the two editable plateaus, not from a manufacturer motor speed. The curve is shown outside the allowed RPM range for illustration; RPM constraints separately exclude those cuts. Separate power and torque ratios are equivalent to comparing demand with the minimum of the two curve branches.

### Static tool deflection estimate

```text
engagement angle φ = acos(1 - 2r)                         [radians]
engaged teeth zEng = max(1, ceil(z φ / (2π)))
estimated lateral force F = Kc ap hmax zEng × forceAllowance  [N]
effective second moment I = stiffnessFactor × π D⁴ / 64   [mm⁴]
static tip deflection δ = F L³ / (3 E I) × 1000            [µm]
```

E is converted from GPa to N/mm² (×1000). Force conservatively sums peak tooth loads, then adds a force allowance. A reduced section stiffness and tip-applied load add further conservatism relative to a solid circular shank and distributed flute load. Neither proves an upper bound on real displacement: geometry, tooth phasing, holder compliance and dynamic response are missing. The integer engaged-tooth count can cause visible steps in the deflection map. This is deliberate and documented, not a stability lobe.

**No chatter prediction.** Static bending cannot establish chatter onset. It does not model modal stiffness, damping, regenerative effects, forced vibration, spindle bearings, machine frames, fixture stiffness, tool pullout, thermal growth, breakage or transient entry/exit loads.

### Envelope

The largest ratio is the limiting constraint. All must be ≤1:

- hmax / maxChip and minChip / hmax (the latter increases when the chip gets too thin).
- P / (powerPlateau × usableFraction).
- T / (torquePlateau × usableFraction).
- Deflection / deflectionLimit and surfaceSpeed / surfaceSpeedLimit.
- max(minRPM / n, n / maxRPM, n / toolMaxRPM when entered), and feed / machineFeedLimit.
- max(DOC / fluteLength, DOC / stickout). WOC > D is an invalid cut, not a ratio.

Chipload, power, torque, deflection and surface speed are **soft** limits with a caution band at `caution` × limit (default 0.75); RPM range, machine feed and reach are **hard**. `calculate` returns `softRatio`, `hardOk` and `zone` (comfortable / caution / beyond / unknown) beside the existing `status`. Geometry thresholds are simple reach checks, not a collision or stiffness model. The grids deliberately extend beyond RPM/feed/DOC limits to make the boundary visible; stepover defaults to one tool diameter. A user can explore beyond it, but those samples are explicitly invalid for this model. Grids sample 72×48 cell centers per panel. D3 marching-squares contours interpolate that field. A narrow feasible region can be missed; the selected-point calculation remains exact relative to these formulas. Axis endpoints at zero are true zero values. Sampling and pointer selection retain floating-point coordinates. Unknown required inputs prevent a complete passing classification. Missing force/power models leave geometry outputs available.

## Sources

These sources support the standard formula forms and qualitative principles, **not Cutspace's default coefficients or thresholds**:

- [Sandvik Coromant — Milling formulas and definitions](https://www.sandvik.coromant.com/en-gb/knowledge/machining-formulas-definitions/milling-formulas-definitions): speed, feed, MRR, net power and torque relationships.
- [Harvey Performance — How to Combat Chip Thinning](https://www.harveyperformance.com/in-the-loupe/combat-chip-thinning/): radial-engagement dependence and feed compensation.
- [MIT OpenCourseWare — Beam mechanics](https://live.ocw.mit.edu/courses/1-050-solid-mechanics-fall-2004/f9a4d5764b9b0f51ffaacbdf69f7aed8_emech10_04.pdf): linear-elastic cantilever bending.

## Extend

- `src/model.ts`: pure calculation and classification. Add qualified material/tool models and an explicitly bounded, sourced/measured spindle curve. Separate missing data from failed checks.
- `src/experiment.ts`: canonical ratios, built-in profiles, snapshots, import validation and view domains. Add explicit migrations and a multi-experiment library here.
- `src/units.ts` and `src/Field.tsx`: reversible unit presentation, fractions and edit validation. Rejected edits retain the last committed calculation and show a “Not applied” message. Inputs are never silently clamped.
- `src/plots.ts` and `src/Plot.tsx`: sampling, shared scales, open contour paths, selection and axes. Adaptive refinement around boundaries and worker scheduling are future production work; selected points already evaluate independently of the coarse grid.
- `src/App.tsx`: workspace, inspector, saved-point comparison and local persistence. `src/styles.css`: responsive layout using system fonts with no external font requests.
- `tests/`: analytic reference cases, unit/ratio invariance, threshold crossings, no-cut/unknown states, file validation, immutable snapshots and contour geometry. See the implementation status for manual browser checks and their limits.

The prototype omits chatter prediction, optimization, G-code, machine control, automatic feed compensation, validated tool recommendations and material-specific empirical models. Sensitivity bands and additional-machine creation are deliberately deferred in the backlog.

## Beginner tutorial

`public/tutorial/index.html` is a standalone, responsive HTML walkthrough linked from the app footer. It follows the reported Big Blue 300 IPM example, then compares two hypothetical lower-load cuts. Five actual interface screenshots live in `public/tutorial/images/`; each opens full-size. The tutorial supports printing and needs no JavaScript or external fonts.

Update screenshots and numerical examples when interface or model behavior changes. `scripts/tutorial-screenshots.mjs` regenerates all five from headless Chrome over the DevTools protocol (it seeds the saved experiment and preferences, then captures each state):

```sh
npm run dev   # in another shell
node scripts/tutorial-screenshots.mjs http://127.0.0.1:5173/ public/tutorial/images examples/big-blue-plywood-300-ipm.json
```

Set `CHROME` to another Chromium-based binary if Google Chrome is not installed. Use a new image filename version when replacing a screenshot because deployment caches these assets as immutable; tutorial HTML is uploaded with `no-cache`. The deployed path is `/software/cutspace/tutorial/`.
