# Prototype 2 implementation status

27 October 2026 · application 0.2.0 · model illustrative-static-3 (originally illustrative-static-2) · file schema 2

## Implemented

- Reversed engagement axes, percentage-primary scales and optional opposite physical axes.
- Metric/imperial display and numeric input, including simple fractions. Canonical data stay metric; engagement ratios persist through cutter-size changes.
- Compact desktop setup and selected-cut controls, eight results, inspector and responsive stacked plots.
- Independent fill/contour metrics, shared automatic/fixed scales, explicit constant-contour notes, no synthetic frame boundary, keyboard/pointer selection and undo.
- Two distinct illustrative machine profiles and six distinct illustrative material starters, editable experiment assumptions and unavailable-model flags.
- One locally autosaved experiment, explicit Save, validated JSON import/export, full A/B/C configuration snapshots and restore.
- Explicit computed/geometry/estimate labels, warnings and documented approximation formulas. No chatter prediction.

## Validation

- `npm test`: 22 passing automated checks. Covers baseline formulas, chip-thinning and torque/power transitions, cubic bending scaling, thresholds, zero/invalid/unknown states, both plot mappings, constant-contour perimeter removal, scale fallback, fit-domain bounds, unit round trips, retained ratios, file round trips and malformed/unsupported-file rejection.
- `npm run build`: TypeScript and optimized Vite production build pass.
- Browser checks: imperial 1/4-inch cutter entry preserves 20%D WOC and 50%D DOC; local reload restores the experiment; switching machine/material produces distinct assumptions; A/B snapshots survive switches and restore the full configuration; arrow-key engagement selection, click selection and Undo; constant feed/tooth contours are labeled; invalid diameter is rejected; disabling capacity yields an unknown classification; malformed file import is rejected without replacing the setup.
- Desktop measurement: default workspace fits a 1366 × 768 CSS-pixel viewport without vertical scrolling. Both plots, controls, all eight outputs and status are visible in the saved desktop screenshot.
- Narrow-screen check: at 390 × 844 CSS pixels the plots and controls stack, secondary physical axes hide when space is insufficient, and no horizontal page overflow occurs. No console errors were captured during these browser checks.
- File serialization and valid import parsing are covered by automated round-trip tests. The complete valid-file chooser/download round trip is not claimed as a completed browser test.

## Remaining production work

The production specification remains the target, not a statement that this prototype is release-ready.

- Acquire and qualify actual machine configurations, operating ranges, spindle-output curves and provenance. Both named machines currently contain fictional demonstration capacities.
- Replace fictional material coefficients and generic thresholds with qualified data/model applicability, particularly for wood and plywood; verify machine/material combinations.
- Add bounded measured-curve interpolation, configuration provenance beyond the current illustrative/user-override label and migrations between model/file versions.
- Add adaptive boundary refinement, worker scheduling if profiling warrants it, narrow-envelope checks, sustained interaction performance tests and visual regression coverage.
- Complete cross-browser, touch and accessibility qualification. Native dialogs and numeric alternatives are present but are not a complete accessibility audit.
- Add a multi-experiment library and richer experiment management if retained in the release specification. Current persistence is one active experiment plus portable files.

## Explicitly deferred features

Scenario sensitivity bands and user-defined additional machines are tracked in `backlog.md` and are excluded from this prototype. They are feature decisions, separate from the production qualification work above.

## Preservation

`docs/archive/prototype-v1.tar.gz` preserves the first prototype's source, tests, configuration and README. Generated dependencies/build outputs are not included. The second prototype is the active project.

## Contextual-help update

Explanatory hover help covers main controls, all 30 numeric fields, outputs, plot areas/axes, legends, status messages, comparison values and inspector controls. Focusable controls expose the same explanation as an accessible description and a keyboard-focus bubble. Escape dismisses the bubble before a native dialog; pointer selection hides help so it does not obscure a drag. The bubble renders in the dialog’s top layer when appropriate and stays within the viewport.

Validation: production build and 22 existing tests pass. Browser inspection found no controls missing help in the main view or any of the six inspector tabs. Confirmed keyboard-focus display, Escape dismissal without dialog closure, help following dialog scroll, and pointer selection dismissing help. No browser console errors were captured.

## Help and envelope navigation fixes · 28 October 2026

- Reworked help placement around target bounding rectangles and the browser visual viewport, with inline fixed-position essentials, scroll/resize tracking and bounded scrolling for long explanations. The original Brave failure was reported by the user; its exact cause was not independently isolated. Floating help in the updated build was observed in Brave.
- Added explicit tap-to-explain Help mode in the main header and inspector. Explanations persist with Close and Done actions; tapping explained controls or plots does not edit the cut. Keyboard activation is intercepted in Help mode too.
- Added per-plot Fit envelope / Reset view. Fit uses a fresh broad-domain grid, includes passing cells and the selected point, pads the bounds and fixes the shared color scale. Unknown/empty envelopes leave the view unchanged. Persisted optional lower-axis bounds retain compatibility with existing schema-2 files.
- Validation: 28 tests pass, including new viewport-position, zoomed/offset viewport, envelope bounds, outside-selection retention, unknown-envelope and nonzero-domain serialization checks. Production build passes. Browser checks confirmed fitting preserves the cutting point, reset restores domains, and tap Help opens a persistent explanation without editing the field. Narrow-viewport checks cover layout and tap-style activation, not a physical-phone certification.


## Explicit Help and beginner limit explanations · 28 October 2026

- Automatic hover and focus bubbles are disabled. Explanations require Help mode and explicit click/tap or Enter/Space. Done removes the bubble immediately and restores normal editing; accessible descriptions remain.
- The Limits inspector now has expandable diagnostics for all nine checks. Each gives actual values and bounds in the current units, meaning, why the limit matters, possible adjustments and tradeoffs, and qualification of the estimate/threshold. Exceeded and unavailable checks start expanded; passing checks stay compact. The status button now explicitly offers Details.
- Low-chip and low-RPM failures say Below minimum. All three engagement/reach comparisons are listed. No-cut points are not classified as thin-chip cutting problems; unavailable results are never presented as passing.
- Validation: 33 tests and the subpath production build pass. New tests cover lower bounds, zero removal, unavailable capacity, imperial geometry comparisons and usable power limits. Browser checks confirmed normal input focus produces no bubble, keyboard activation works in Help mode, Done removes help without changing diameter, three exceeded checks expand with correct values, and the corrected close transition emits no error in the current build. The detected ResizeObserver close race was fixed before deployment. No physics formulas or thresholds changed.


## Contour labels and spacing · 28 October 2026

- Both plots now draw permanent contour value labels with units and dark backplates. Placement follows real contour segments, avoids plot edges and selected/pinned markers, and limits overlapping labels. Some short/crowded lines remain unlabeled; Fit envelope improves separation.
- Coarse / Standard / Fine spacing is shared across plots. Ratio overlays default to 25 percentage-point intervals; chip intervals use readable values based on configured limits and current units. The legend reports the actual spacing and contour value at the selected cut. Extreme ranges widen the interval to bound work and disclose that adjustment.
- Constant slices show the constant value; unavailable and no-level slices have explicit notes. The pointer probe includes the contour value. None disables the spacing control. Spacing persists through autosave and JSON exchange; old version 2 files default to Standard.
- Validation: 39 tests cover unit-aware intervals, shared presets, unavailable/extreme ranges, label placement and collisions, frame-edge removal, and old/new persistence. Production build passes. Browser checks verified Fine adds lines without changing the cutting point, imperial feed-per-tooth labels and the constant engagement slice, persistence after reload, None disabling spacing/removing lines, and both envelope-fit views. A 390 × 844 viewport check showed the new control and unclipped labels; this was not a physical-phone test. No browser errors were captured. Physics and sampling resolution are unchanged.


## Contour label refinement · 28 October 2026

On-plot labels now omit units except percent, have no background rectangles, and rotate along a smoothed local contour tangent in screen coordinates. Text remains upright. Collision and edge checks use the rotated label bounds. Full units remain in the legend and numeric readouts; the displayed values still convert with the unit system. A thin glyph outline preserves contrast without a filled background.

Validation: 40 tests and production build pass. Added coverage for unit-free labels, retained percent signs, diagonal/reversed/vertical tangent orientation and rotated bounds. Browser inspection confirmed no label rectangles, correct rotations, bare imperial chip-thickness numbers with units retained in the legend, and no captured errors.


## Cutter materials · 28 October 2026

Added explicit Carbide/HSS selection in the setup strip and Tool inspector; flat end mills remain the scope. Representative modulus defaults are 600/219 GPa with source links and editable overrides. Static deflection responds to material stiffness; no unsupported substrate multiplier changes force, power, chip load or cutting speed. The workpiece selector is labeled separately.

Cutting-limit availability is now tied to the selected cutter/workpiece combination. Changing either material retains limit numbers but makes chip-high, chip-low and surface-speed checks unavailable. A compact status link opens editable values and their enable control. Unknown required limits prevent a passing envelope. Snapshots preserve material, modulus and availability; comparisons identify the cutter material.

Model illustrative-static-3 retains file schema 2 and the local-storage key. Legacy illustrative-static-2 experiments and pins migrate to explicit carbide, preserving numerical overrides and results. Unsupported substrates or malformed flags are rejected. Router-bit geometry/construction and sourced cutting-data libraries are recorded as backlog items.

Validation: 46 automated tests pass, including stiffness ratio, preserved cut/demand, unknown sampled envelopes, state round trips and legacy migration. Production build passes. Browser checks verified HSS output changes, limit activation, snapshot restore and comparison, imperial display, and the selector/status at 390 px width; no captured console errors. This is browser-sized responsive testing, not physical-phone certification.

## Provisional cutting limits and Big Blue · 29 October 2026

Supersedes the earlier material-switch behavior: all six workpieces × two cutter materials now have explicit provisional-1 chip, speed and deflection allowances. Switching materials loads its preset; an existing saved setup keeps its values and can apply the preset explicitly. User edits clear preset attribution; Undo and snapshots preserve complete settings. Disabled checks remain representable and recover through Use provisional preset. Numerical force, power, torque and bending formulas are unchanged.

Added Big Blue as a separately identified built-in machine with all initial numeric settings identical to ShopSabre RC4, per user request. This is an illustrative proxy, not a calibrated capacity profile. The general custom-machine builder remains deferred.

Added importable and in-app examples for the confirmed 300 IPM / 18,000 RPM two-flute carbide plywood cut and the shared 200 IPM / 10,000 RPM four-flute screenshot. Source observations and assumptions are documented in calibration-cases.md. The screenshot's power and bending values reproduce exactly to its display precision. Old inherited chip/deflection limits fail both cases; the provisional plywood limits pass them without altering estimated demand or machine capacity. This is regression evidence, not experimental validation of the envelope.

Validation: all 52 tests pass. TypeScript/production build passes. Browser checks confirmed both example loaders, Big Blue selection, exact imperial inputs and outputs, passing provisional status, disabled-check recovery, automatic HSS presets and no captured console errors. Screenshot: cutspace-big-blue-plywood.png. Existing user browser setups were not changed during testing.


## MRR contour overlay · 29 October 2026

Added MRR to the shared contour selector and import validation. Both plots receive the overlay and common levels. Cubic metric/imperial units are used for values, legend, spacing and probe; labels keep their existing unit-free, aligned style. MRR spacing adapts to visible ranges with Coarse/Standard/Fine presets, independent of chip limits. Existing constant/unavailable slice notes remain accurate.

Validation: all 55 tests and production build pass. New tests cover cubic-unit labels, persistence, multiple drawable/labeled lines in both slices, horizontal speed contours, curved engagement contours, spacing presets, unavailable force models and zero-removal fields. Browser checks verified both labeled graphs, metric/imperial conversion, spacing changes, persistence after reload and no captured console errors. Screenshot: cutspace-mrr-contours.png.


## Automatic heatmap range correction · 29 October 2026

Resolved two saturation causes: automatic bounds previously considered only passing samples, and fitting/pinning silently locked the range. Auto range now spans all finite geometrically valid visible samples across both plots, including outside-envelope values. Constant fields remain finite; unavailable/invalid samples are excluded; margin is no longer clipped at -100%. Both plots retain the same color/value mapping.

Fit/Reset and pinning preserve scaling mode; setup selection returns to automatic. Explicit fixed bounds and imported fixed configurations remain supported. Corrected imperial deflection legend precision so small ranges do not display as zero. Cutting inputs, formulas and envelope classification are unchanged.

Validation: 59 tests and production build pass, including both plywood cases across every continuous metric, zoomed nonzero domains, invalid/unknown/constant data, and material-switch recovery from fixed bounds. Browser checks confirmed automatic mode after switching materials, pinning and fitting; explicit fixed mode survives Reset view; plywood MRR has a visible gradient; deflection legend values retain precision. No captured console errors. Screenshot: cutspace-auto-fill-range.png.

## Illustrated beginner tutorial (2026-10-29)

Added `public/tutorial/index.html` and five actual UI screenshots, linked from the app footer in a new tab. Walkthrough covers the reported 300 IPM Big Blue cut, reading both graph slices and color/contour legends, an exceeded chip limit at 12,000 RPM, halving DOC, comparing three immutable snapshots, and saving/verifying a candidate. It distinguishes computed geometry, estimates, provisional limits and reported versus hypothetical cuts. Responsive HTML includes full-size image links, accessible captions/alt text, print styles, and supporting primary sources.

Deployment uploads tutorial HTML with no-cache separately from immutable versioned screenshots. Desktop and phone-width visual checks confirmed readable layout without page-level horizontal overflow; tutorial anchors and image paths checked.

## Hobbyist review follow-up · 30 October 2026

Implemented the review's six workstreams: vocabulary and stale-text fixes with four-significant-figure field display and labelled margins; Tips preference and welcome banner alongside Help mode; soft/hard limit zones with caution fraction, zone contours, tint, status and Limit zone fill; libraries (personal, shared by file or URL, built-in) with import/export and conflict handling, library machine references in experiments and tool max RPM; slot validity instead of a 100% reach ratio, diameter-scaled chip bands and higher wood surface ceilings; locale-based imperial default, example loader in the banner and "What you'd notice" lines in every limit explanation. Numeric cross-check against CustomPartNet, Machining Doctor and Omni calculators matched MRR, power, torque, chip thinning and cantilever deflection.

Validation: 74 automated tests and the production build pass. Browser checks at 1265 × 773: quick tip appears after hover and pins with More…; welcome banner dismisses; Library tab lists built-in items with provenance, Save machine adds to My library, Use tool loads 1/4 in geometry, machine selector groups by library; zone lines and caution status render; result notes wrap without overlap. A 375 × 812 check showed the Library tab stacking without horizontal overflow. Tutorial screenshots were regenerated as `-v2` files with `scripts/tutorial-screenshots.mjs`. Not yet verified: URL-fetched shared libraries against a live host (unit-tested only), and the deployed subpath build.

## Flute count and operation · 30 October 2026

A reported ShopSabre RC4 cut (4 mm single-flute carbide in 6061, 16,000 RPM, 40 IPM, 2 mm deep slot) read 519% of the deflection allowance and 173% of the chipload ceiling because the aluminum preset carried a 1 thou finishing allowance and a two-flute chip band. Presets now scale the chip band by flute count and the deflection allowance by a Roughing/Finishing operation selector in the setup strip. With roughing and a realistic 15 mm stickout the cut sits inside the chipload band and near the deflection allowance; the stickout remains to be confirmed. Validation: 75 tests and the production build pass; browser check of the new selector, Limits text and regenerated screenshots.
