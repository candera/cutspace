# Changelog

All notable changes to Cutspace will be recorded here. Dates use `YYYY-MM-DD`.

Cutspace remains an illustrative exploration tool, not a source of validated cutting parameters. Entries describe software behavior and the provenance carried by included data; they do not certify a machine, material, cutter, or cut.

## [Unreleased]

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
