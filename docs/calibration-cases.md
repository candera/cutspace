# Plywood reference cases · 29 October 2026

These are reported successful cuts, not instrumented measurements. They help expose mismatched assumptions and provide regression cases; passing the revised provisional checks does not validate the force, power or deflection model.

Big Blue is a separate machine in the preloaded Nova Labs library (`lib:nova-labs/big-blue`; earlier releases shipped it built in as `bigblue`). At the user's request, every initial numerical machine value is identical to the illustrative ShopSabre RC4 profile. These are not measured Big Blue capacities. Neither example modifies machine power, torque, feed limits, material Kc, force allowance or effective tool stiffness to force agreement.

| Input | User's 300 IPM case | Shared screenshot case |
|---|---|---|
| Source | Direct user report, confirmed carbide and 18,000 RPM | User-supplied screenshot, reported by another operator as successful |
| Machine | Big Blue | Big Blue; screenshot selected ShopSabre RC4 as proxy |
| Workpiece | Plywood, subtype unspecified | Plywood, subtype unspecified |
| Cutter diameter | 1/4 in | 1/4 in |
| Flutes | 2 | 4 |
| Cutter material | Carbide, confirmed | Carbide assumed by the screenshot's model v2; actual substrate unconfirmed |
| RPM | 18,000 | 10,000 |
| Feed | 300 IPM | 200 IPM |
| DOC | 50%D = 0.125 in | 150%D = 0.375 in |
| WOC | 100%D = 0.25 in | 100%D = 0.25 in |
| Stickout | Approximately 30 mm | 1 in |
| Flute length | 15 mm placeholder, not reported | 0.8 in |

## Diagnosis

The earlier app retained the generic aluminum starter limits when the workpiece changed: maximum chip thickness 0.055 mm (0.002165 in) and deflection allowance 25 µm (0.000984 in). Material selection changed Kc but not these thresholds. Later, cutter-material changes disabled chip/speed checks entirely instead of providing a starter set.

With the reported geometries and the existing model:

| Result | 300 IPM case | 200 IPM screenshot case |
|---|---|---|
| Feed/tooth = maximum chip thickness in a full slot | 0.008333 in | 0.005 in |
| Estimated power | 320.06 W | 640.12 W (0.858 hp) |
| Estimated bending | 36.49 µm (0.001437 in) | 79.72 µm (0.003139 in) |
| Old high-chip ratio | 3.85 | 2.31 |
| Old deflection ratio | 1.46 | 3.19 |

The screenshot's displayed power and bending are reproduced without changing the formulas. Both cases fail the old chip and deflection thresholds. They pass the new provisional plywood/carbide set: chip thickness 0.025–0.30 mm at 6 mm (scaled to 0.053–0.635 mm when applied to a 1/4 in tool), deflection allowance 100 µm and a surface-speed ceiling of 1500 m/min (raised from 650 on 30 October 2026 because wood routing is not surface-speed limited). The estimates themselves are unchanged. The 100 µm allowance is a roughing-oriented exploration choice, not a measured tool-breakage threshold or a claim about part accuracy. These provisional values are not fitted measurements.

## References and limitations

[Onsrud hard-plywood cutting data](https://www.onsrud.com/images/Hard%20Plywood.pdf) and [soft-plywood cutting data](https://www.onsrud.com/images/Soft%20Plywood.pdf) distinguish tool series, diameter and depth. They support treating plywood cutting data separately from a generic aluminum starter. Their published recommendations are tool-specific nominal feed-per-tooth ranges, not universal maximum-chip failure limits; Cutspace's provisional numbers are not copied or validated from those tables. At full slot nominal feed/tooth equals the model's maximum chip thickness; narrow engagement needs separate interpretation.

Further calibration needs actual machine configuration, tool identity and geometry, plywood product, cut quality/tolerance, cutting load and observed deflection. A successful cut alone does not identify Kc, spindle capacity or the acceptable bending threshold independently. General router-bit geometry remains deferred.

Load either JSON from `examples/`, use **About → Load 300 IPM example / Load 200 IPM example**, or load them as recipes from the built-in library. Their settings and assumptions remain separate. Loading is undoable.

## RC4 aluminum slot · 30 October 2026

Reported by the user as a cut they run routinely on the Nova Labs ShopSabre RC4: 4 mm single-flute carbide end mill, 6061 aluminum, 16,000 RPM, 40 IPM (1016 mm/min), full-width slot, 2 mm depth. Stickout and flute length were not reported.

With the model unchanged, chipload is 0.0635 mm/tooth and estimated bending is 130 µm at the default 20 mm stickout (55 µm at 15 mm, 28 µm at 12 mm); power is 169 W against 1125 W usable and surface speed 201 m/min. Before this change the aluminum/carbide preset gave a 0.037 mm chipload ceiling (two-flute band scaled to 4 mm) and a 25 µm allowance, so the cut read 173% and 519%. The ceiling was the two-flute band applied to a single-flute cutter, and the allowance was a finishing tolerance applied to slotting. After the change the roughing preset for this tool gives 0.066 mm and 100 µm; the cut passes the chip band and its deflection reading depends on the actual stickout, which should be measured before this becomes a saved recipe. The estimate itself is unchanged and remains conservative (×1.3 force, 0.45 section factor).

## DMC2 Mini speeds-and-feeds fit · 31 October 2026

Source: the operator’s DMC2 Mini sheet (transcribed in `scripts/dmc2-mini-data.ts`; generator `scripts/build-dmc2-library.ts`; output `examples/dmc2-mini-library.json`). It holds the cutter manufacturer’s charts (3-flute square end mills for aluminium, 4-flute coated square end mills for steel, “pre-hardened steel 40–50 HRC” column), the DMC2 manufacturer’s tabulation of those charts with RPM capped at 24,000 (“normal”), “aggressive parameters from testing”, and the raw test log with outcome notes. The operator’s tools are 3-flute uncoated carbide (aluminium) and 4-flute coated carbide (steel) in 1, 2, 3, 4, 6, 8, 10 and 12 mm, plus a 10 mm single-insert mill. Workpiece Kc stays at the built-in 1000 (aluminium) and 1800 (mild steel) N/mm²; the steel chart column is for 40–50 HRC pre-hardened steel while the tested steel is not identified.

**Machine fit.** Under the constant-coefficient model the aggressive successes top out near 650 W of modelled demand (3 mm aluminium at 22,000 RPM, 0.281 N·m) and the recorded high-feed bog-downs with 3–4 mm tools at 22,000–24,000 RPM sit at 625–933 W, so a constant-torque plateau of 0.378 N·m (950 W at 24,000 RPM) with the usual 75% usable fraction places every aggressive summary row at or inside usable output and the 720–933 W bog-downs beyond it. Bog-downs with thin chips (6 mm at 1.0 mm stepover, slotting at 300–500 W) and the deep, thin-radial stalls with 10–12 mm tools (160–360 W) are not separable by power with a constant Kc; the stalls are instead caught by the per-tool deflection allowances below. Of the 24 raw rows marked break, bog, stall, flames or “too much”, 12 land outside the fitted envelope; the slotting breaks of 1–6 mm tools at fixed chipload and the thin-chip bog-downs do not, which is a limit of the model, not evidence they are safe.

**Per-tool limits (stored in each recipe).** Chip ceiling = largest maximum chip thickness any successful test reached, or 1.25× the chart’s value when heavier; chip floor = half the lightest chart or successful chip; roughing deflection allowance = model deflection at the heaviest successful test with the assumed stickout (flute length = deepest tested depth; stickout 6, 9, 12, 18, 22, 32, 38 and 45 mm for 1–12 mm); surface ceiling = fastest successful test per workpiece (760 m/min aluminium, 610 m/min steel). Derived ceilings round up so the cut they came from stays at or below 100%.

**Validation against the normal (chart) rows.** 20 of 32 land inside; all 12 chart rows for 8–12 mm tools are outside, on spindle torque at the chart’s 6,600–12,000 RPM and, for profiling, on deflection at 3–4× the demonstrated value. The tests never ran those tools near the chart’s radial engagement; the recipe notes say so.

| Workpiece | Tool | Mode | Chart cut | Result | Exceeded | Tightest check |
|---|---|---|---|---|---|---|
| Aluminum | 1 mm 3F | profile | 24,000 RPM · 800 mm/min · 0.1 × 1.5 mm | caution | — | chipload too high 80% |
| Aluminum | 2 mm 3F | profile | 24,000 RPM · 1,200 mm/min · 0.2 × 3 mm | comfortable | — | chipload too low 42% |
| Aluminum | 3 mm 3F | profile | 24,000 RPM · 1,800 mm/min · 0.3 × 4.5 mm | comfortable | — | chipload too low 42% |
| Aluminum | 4 mm 3F | profile | 20,000 RPM · 2,000 mm/min · 0.4 × 6 mm | comfortable | — | chipload too low 41% |
| Aluminum | 6 mm 3F | profile | 13,000 RPM · 1,500 mm/min · 0.6 × 9 mm | comfortable | — | tool deflection 54% |
| Aluminum | 8 mm 3F | profile | 10,000 RPM · 1,650 mm/min · 0.8 × 12 mm | outside | tool deflection 156%, spindle torque 111% | tool deflection 156% |
| Aluminum | 10 mm 3F | profile | 8,000 RPM · 1,900 mm/min · 1 × 15 mm | outside | tool deflection 295%, spindle torque 250% | tool deflection 295% |
| Aluminum | 12 mm 3F | profile | 6,600 RPM · 1,950 mm/min · 1.2 × 18 mm | outside | spindle torque 448%, tool deflection 400%, spindle power 123% | spindle torque 448% |
| Aluminum | 1 mm 3F | slot | 24,000 RPM · 400 mm/min · 1 × 0.5 mm | comfortable | — | chipload too high 67% |
| Aluminum | 2 mm 3F | slot | 24,000 RPM · 600 mm/min · 2 × 1 mm | comfortable | — | chipload too low 50% |
| Aluminum | 3 mm 3F | slot | 24,000 RPM · 900 mm/min · 3 × 1.5 mm | comfortable | — | chipload too low 50% |
| Aluminum | 4 mm 3F | slot | 20,000 RPM · 1,000 mm/min · 4 × 2 mm | comfortable | — | chipload too low 50% |
| Aluminum | 6 mm 3F | slot | 13,000 RPM · 750 mm/min · 6 × 3 mm | comfortable | — | spindle torque 73% |
| Aluminum | 8 mm 3F | slot | 10,000 RPM · 825 mm/min · 8 × 4 mm | outside | spindle torque 185% | spindle torque 185% |
| Aluminum | 10 mm 3F | slot | 8,000 RPM · 950 mm/min · 10 × 5 mm | outside | spindle torque 417%, spindle power 139% | spindle torque 417% |
| Aluminum | 12 mm 3F | slot | 6,600 RPM · 975 mm/min · 12 × 6 mm | outside | spindle torque 746%, spindle power 205%, tool deflection 111% | spindle torque 746% |
| Mild steel | 1 mm 4F | profile | 24,000 RPM · 320 mm/min · 0.05 × 1.5 mm | comfortable | — | chipload too low 50% |
| Mild steel | 2 mm 4F | profile | 24,000 RPM · 800 mm/min · 0.1 × 3 mm | comfortable | — | chipload too low 50% |
| Mild steel | 3 mm 4F | profile | 24,000 RPM · 1,020 mm/min · 0.15 × 4.5 mm | comfortable | — | chipload too low 50% |
| Mild steel | 4 mm 4F | profile | 24,000 RPM · 1,250 mm/min · 0.2 × 6 mm | comfortable | — | surface speed 49% |
| Mild steel | 6 mm 4F | profile | 16,000 RPM · 1,540 mm/min · 0.3 × 9 mm | comfortable | — | chipload too low 50% |
| Mild steel | 8 mm 4F | profile | 12,000 RPM · 1,540 mm/min · 0.4 × 12 mm | outside | tool deflection 373% | tool deflection 373% |
| Mild steel | 10 mm 4F | profile | 9,600 RPM · 1,540 mm/min · 0.5 × 15 mm | outside | tool deflection 421%, spindle torque 152% | tool deflection 421% |
| Mild steel | 12 mm 4F | profile | 8,000 RPM · 1,600 mm/min · 0.6 × 18 mm | outside | tool deflection 345%, spindle torque 273% | tool deflection 345% |
| Mild steel | 1 mm 4F | slot | 24,000 RPM · 160 mm/min · 1 × 0.25 mm | comfortable | — | chipload too low 44% |
| Mild steel | 2 mm 4F | slot | 24,000 RPM · 400 mm/min · 2 × 0.5 mm | comfortable | — | chipload too low 43% |
| Mild steel | 3 mm 4F | slot | 24,000 RPM · 510 mm/min · 3 × 0.75 mm | comfortable | — | chipload too low 43% |
| Mild steel | 4 mm 4F | slot | 24,000 RPM · 625 mm/min · 4 × 1 mm | comfortable | — | surface speed 49% |
| Mild steel | 6 mm 4F | slot | 16,000 RPM · 770 mm/min · 6 × 1.5 mm | comfortable | — | spindle torque 55% |
| Mild steel | 8 mm 4F | slot | 12,000 RPM · 770 mm/min · 8 × 2 mm | outside | spindle torque 130% | spindle torque 130% |
| Mild steel | 10 mm 4F | slot | 9,600 RPM · 770 mm/min · 10 × 2.5 mm | outside | spindle torque 253%, spindle power 101% | spindle torque 253% |
| Mild steel | 12 mm 4F | slot | 8,000 RPM · 800 mm/min · 12 × 3 mm | outside | spindle torque 455%, spindle power 152% | spindle torque 455% |
20 of 32 chart rows inside.

Stickouts are assumptions; the deflection allowances scale with stickout cubed, so measuring the real stickout and regenerating the library is the first refinement. Tool wear, chatter and spindle thermal limits are outside the model, and the sheet itself notes the aggressive rows ran briefly.
