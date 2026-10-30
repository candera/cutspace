# Plywood reference cases · 29 October 2026

These are reported successful cuts, not instrumented measurements. They help expose mismatched assumptions and provide regression cases; passing the revised provisional checks does not validate the force, power or deflection model.

Big Blue is a separate built-in machine ID (`bigblue`). At the user's request, every initial numerical machine value is identical to the illustrative ShopSabre RC4 profile. These are not measured Big Blue capacities. Neither example modifies machine power, torque, feed limits, material Kc, force allowance or effective tool stiffness to force agreement.

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
