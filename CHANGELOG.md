# Changelog

All notable changes to Cutspace will be recorded here. Dates use `YYYY-MM-DD`.

Cutspace remains an illustrative exploration tool, not a source of validated cutting parameters. Entries describe software behavior and the provenance carried by included data; they do not certify a machine, material, cutter, or cut.

## [Unreleased]

### Added

- **Chart picker on each plot.** The dropdown in a plot's header chooses which two quantities are its axes; the other two named quantities are held at their current values and shown beside it. Besides the existing Speed / feed and Engagement charts there are **Removal rate / depth** (RPM and chipload held; stepover absorbs the removal rate, so the plot shows deep-and-narrow against shallow-and-wide at a given MRR), **Removal rate / surface speed** (chipload and depth held, the book values as inputs), **Removal rate / chipload** and **Surface speed / chipload** (depth and stepover held, the speed/feed slice re-plotted so chipload limits are horizontal). Removal rate, chipload and surface speed are each a product of powers of RPM, feedrate, depth and stepover, so any grid point on any chart is one cut and the fill, contours, limit boundaries, probe, zoom, Fit envelope and saved markers work as before. Dragging on a removal-rate chart moves the same cut the other plot shows. The first time an axis is used its range is fitted to the chart's passing envelope; ranges are then saved with the experiment, and the View tab gains MRR, chipload and surface-speed axis fields. Experiments saved earlier open with the default charts.

### Changed

- Model `illustrative-static-7`. The static bending estimate now spreads the cutting force uniformly along the engaged flute, from the tip over the depth of cut, instead of applying all of it at the tip. The stepped two-segment cantilever, section factor and body modulus are unchanged; the closed-form compliance reduces to the earlier tip-loaded one at zero depth and to L³/(8EI), three eighths of the tip-loaded value, for a single section loaded over its whole length. Deflection still rises with depth because force does, but less than in proportion: a full-flute cut on the default 6 mm tool now bends about half what the tip-loaded estimate gave, and the shallow default cut about 11% less. The engagement chart therefore favours deep, narrow cuts the way shop practice does. Files from model 6 load unchanged in their inputs; their deflection estimates fall accordingly.
- The DMC2 Mini example library is regenerated under the new model. Its per-tool roughing deflection allowances are derived from the deepest successful test cut, so they fall with the estimate; the three recorded stalls still sit beyond them and 20 of 32 chart rows remain inside.

## [0.6.0] - 2026-11-02

### Added

- **Router bits.** A tool now records its geometry class (flat end mill; upcut, downcut, compression and straight router bits; O-flute; ball nose; V-bit; surfacing bit), a cutting-edge material separate from a body material (solid carbide, steel body for carbide-tipped and insert bits, or HSS), a shank diameter and, for compression spirals, an upcut length. The geometry is chosen in the setup strip and the Tool tab, appears in tool labels, library search, recipe matching (a different geometry is a related match, not an exact one) and the guided start, and carries shop notes: hold-down for upcut, chip packing in downcut slots, first-pass depth for compression, shallow passes and the bit's RPM rating for surfacing bits. Ball nose and V-bits are flagged as modelled at their nominal diameter. A compression pass shallower than the upcut length is reported as a notice in the Tool and Limits tabs and in the guided-start result; the guided start seeds a compression bit's depth to cover the upcut section and reduces stepover before depth while that holds.
- Three illustrative starter tools: a 1/4 in solid-carbide compression spiral, a carbide-tipped 1/2 in straight bit on a 1/4 in shank, and a 1 in surfacing bit on a 1/2 in shank. Example geometry to measure against, not catalogue data.
- **Tool drawing.** The Tool tab and the guided start's tool step show a side view of the bit in its collet, drawn to one scale from the entered values, with dimension callouts for stickout, flute length, cutting diameter, shank diameter and, for compression bits, the upcut section. Spiral direction, straight flutes, the O-flute gullet, ball and V tips and a surfacing head are drawn for their geometry class.
- The setup strip's Cutter column is now a summary button: geometry, size, flutes and edge material on one line, body and shank on the second. It opens the Tool tab. A "check shank" hint appears for straight and surfacing bits whose shank still equals the cutting diameter.
- The Tool deflection result tile names the shank diameter and a steel body when they differ from the defaults, beside the force and section factors it already showed.

### Changed

- Model `illustrative-static-6`. The static bending estimate is a tip-loaded two-segment cantilever: the fluted length at the cutting diameter, then the shank at its own diameter, with one body modulus (solid carbide 600 GPa, steel body 210 GPa, HSS 219 GPa). The effective section factor applies to both segments, so a tool whose shank equals its cutting diameter gives exactly the earlier estimate. Saved experiments, pins and library tools from earlier versions load as flat end mills whose body matches the edge material and whose shank equals the cutting diameter; their estimates are unchanged until those fields are edited.
- Changing the cutting diameter now moves a shank that matched it; a distinct shank stays. Changing the edge material keeps a steel body.
- The DMC2 Mini example library's single-insert mill now states a steel body instead of overriding the modulus on a “carbide” tool. Its 32 recipe verdicts are unchanged.

## [0.5.0] - 2026-11-02

### Added

- Added **Guided start** (header button, and **Find a starting cut** in the welcome banner): a five-step flow that asks for machine, tool, workpiece and operation, then offers saved cuts from the loaded libraries that match those choices (same workpiece and cutter material, same or similar machine, tool within 25% in diameter; exact when machine, diameter and flutes all agree) and a starting point derived from the configured limits and checked with the forward model, with the derivation listed step by step. Applying either lands in the explorer at that cut with Undo; closing applies nothing. Every input shows its provenance, matched recipes show how they evaluate against their own stored limits, and the wording says starting point, not recommendation: the derived points come from the provisional presets and library notes, not validated tooling data. When no point can pass (no cutting data for the cutter and material, a model marked unavailable, or a surface-speed limit below the machine’s minimum RPM) the result explains why and can still apply the setup without a cut.

## [0.4.0] - 2026-11-01

### Changed

- On screens wider than 1000 px the Model & limits inspector is now a docked side panel instead of a modal dialog. It stays open while you work with the plots, scrolls independently, can be resized by dragging its left edge (or with the arrow keys on the handle), and remembers its width, open state and current tab in this browser. The Model & limits and Library buttons toggle it. The plots reflow to the space beside the panel, using the same layouts they use in a narrower window. Narrower screens keep the modal sheet, and Compare remains a dialog everywhere.
- Reworked the Library tab to handle libraries with dozens or hundreds of entries. A sticky toolbar holds a search box that filters every library at once (names, provenance notes, and the values an item is known by: a tool's diameter in millimetres, inches or as a fraction, its flutes and cutter material; a recipe's machine, workpiece and RPM), kind tabs (All, Machines, Materials, Tools, Recipes) with match counts, and a sort control (library order, name with numeric ordering, recently updated). Each library is a collapsible group whose header shows its contents and keeps Export, Refresh and Remove. Items are compact single-line rows that expand on click to show the full description and provenance; the machine and material in use are marked. The save, import and add-shared controls sit in a disclosure that opens by default only while My library is empty. The search and filter survive switching inspector tabs within a page load.

### Fixed

- Exporting selected items now respects the material selection; earlier every material was exported regardless of which were checked.

## [0.3.0] - 2026-11-01

### Added

- Added a preloaded, removable **Nova Labs** shared library (`public/libraries/nova-labs.json`, published beside the app) holding the ShopSabre RC4 and Big Blue profiles and the two reported Big Blue plywood recipes. It illustrates URL-based shared libraries: Refresh re-fetches it, a newer bundled copy replaces the stored one, and removing it is remembered.
- Added an importable **DMC2 Mini** library (`examples/dmc2-mini-library.json`) generated from the operator’s speeds-and-feeds sheet: a machine profile fitted to the aggressive test cuts and recorded spindle bog-downs, the 17 tools from the sheet, and 32 recipes for the manufacturer-chart rows, each carrying per-tool limits derived from the tests and a note saying whether the chart row lands inside the fitted envelope. Rows for 8–12 mm tools at the chart’s low RPM do not.
- Added a generic **2.2 kW spindle router (example)** built-in profile, now the default for a fresh experiment.
- The Machine tab shows the active profile’s provenance note.
- The ShopSabre RC4 profile now uses the user-supplied 18,000 RPM maximum; Big Blue keeps its 24,000 RPM placeholder.

### Changed

- Removed DMC2 Mini, ShopSabre RC4 and Big Blue from the built-in machines; built-ins are generic examples only. Saved experiments that reference the old ids are redirected to the corresponding library items and keep their own values.
- Provenance notes may now be up to 1,500 characters.

## [0.2.2] - 2026-10-31

### Added

- Added an in-app Changelog tab and footer shortcut, rendered directly from this file so release notes have one canonical source.

## [0.2.1] - 2026-10-31

### Added

- Added importable Onefinity Elite Journeyman Gen 1 machine profiles for the Makita RT0701C and Redline 1.5/2.2 kW spindle options.
- Added an importable polycarbonate material starter, two single-flute cutter definitions, and recipes including the reported Makita/HOZLY full-slot cut. Provenance distinguishes firsthand results, published specifications, inferences, and unvalidated assumptions.
- Added selectable black–green–yellow–red and teal–gold plot palettes. The selection persists with saved experiments.
- Added workpiece materials to reusable libraries alongside machines, tools, and recipes.

### Changed

- Replaced the abrupt flute-count deflection approximation with a continuous phase-resolved peak-force model that vector-sums simultaneous straight-flute loads.
- Corrected the built-in DMC2 Mini profile to a 10,000–24,000 RPM range, 2.2 kW rating, and 10,000 mm/min feed/rapid ceiling. Published, user-supplied, derived, and illustrative values remain labeled separately.
- Anchored automatic tool-deflection colors to the configured deflection limit and spindle-utilization colors to 100% capacity, so zooming does not change a cut point's apparent safety level. Comparative quantities such as MRR retain visible-range scaling.
- Made the Limit zone safety palette semantic: black is very safe, green safe, yellow borderline, and red beyond the configured soft limit.

### Fixed

- Restored a visible exploratory envelope for the DMC2 Mini with brass and a small carbide cutter by correcting the machine profile and provisional-limit behavior.
- Removed artificial contour turns where the contour renderer closed a line along an internal missing-data boundary, including the false vertical deflection knee just beyond 100% WOC.
- Kept full-width slots valid while marking engagement wider than the cutter invalid.

## [0.2.0] - 2026-10-30

### Added

- Released Cutspace Explorer 02 with linked speed/feed and engagement plots, editable illustrative limits, contour overlays, comparison points, import/export, local persistence, reusable libraries, contextual help, and the beginner tutorial.
- Added metric and imperial display, diameter-relative DOC/WOC entry, provisional cutter/workpiece presets, and roughing/finishing deflection allowances.

### Changed

- Added plot zoom, envelope fitting, labeled contours, categorical limit/constraint fills, and explicit unavailable-data handling during the Explorer 02 review cycle.
