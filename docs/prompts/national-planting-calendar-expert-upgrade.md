# Master Execution Prompt: National Planting Calendar Expert Upgrade

## Mission
Upgrade the existing canonical `/national-tools/planting/` tool from a spring frost-date translator into an expert-grade, whole-year planting decision engine. A knowledgeable gardener should be able to use it to decide what to direct sow now, what to start indoors, what to transplant, when to sow the next succession, the final viable sowing date, the likely harvest window, and what crop can follow in the same bed.

Do not create a new planting URL. Do not create thin city/ZIP pages. Do not touch the separately launch-blocked Garden Planner product.

## Product truth
USDA hardiness zones describe extreme winter minimums, not planting dates. Planting recommendations must instead synthesize local freeze climatology, current forecast cold risk, crop biology, soil-temperature thresholds, heat/bolting limits, days-to-maturity, transplant behavior, succession cadence, photoperiod where relevant, and late-season slowdown.

Climate normals and live forecast are separate evidence layers. Never present a frost date as certainty.

## Source hierarchy
1. NOAA/NCEI 1991–2020 freeze/climate normals for local climatic anchors.
2. NWS forecast for near-term freeze risk, never as a replacement for climatology.
3. Cooperative Extension / land-grant university publications for crop biology and regional agronomic rules.
4. PRISM / USA-NPN GDD products for future refinement or precomputed regional climatology.
5. USDA hardiness zone only as a coarse fallback/context field, never the primary calendar engine.

Core research references: NOAA NCEI last-spring-freeze guidance; Purdue HO-186 vegetable calendar and germination soil temperatures; University of Minnesota Extension midsummer/fall planting; University of Kentucky Extension succession planting; Nebraska Extension onion photoperiod guidance.

## Required crop-rule schema
Each crop should support, where biologically relevant: `id`, `name`, `category`, `season`, `sow_methods`, `indoor_weeks`, `setout_offset_days`, `direct_sow_offset_days`, `transplant_sensitive`, `hardening_days`, `maturity_days` range/default, `harvest_style`, `succession_interval_days`, `soil_temp_min_f`, `soil_temp_opt_f`, `frost_tolerance`, `kill_temp_f`, `fall_slowdown_factor`, `fall_safety_days`, `heat_caution_f`, `heat_stop_f`, `bolting_risk`, `photoperiod`, `overwinter`, `follow_with`, `notes`, and source keys.

Cultivar packet maturity must be allowed to override the generic default because cultivar variation can be larger than the calendar adjustment.

## Decision algorithms
### Spring
Calculate the crop's calendar anchor from local spring freeze probability, then gate it with crop biology. Direct sow and transplant are separate decisions. Warm crops must be held when live freeze risk exists. Display soil-temperature minimum/optimum as an on-the-ground gate rather than pretending date alone is sufficient.

### Fall
For frost-limited climates, calculate the last viable planting date backward from first fall cold risk:

`last_viable = fall_cold_anchor - ceil(maturity_days * fall_slowdown_factor) - fall_safety_days`

Use a crop-specific cold threshold where available. Explain that shortening days/cooler temperatures can slow fall maturity. Hardy crops can remain harvestable after the first 32°F event; tender crops cannot.

### Succession
Starting from the first viable date, schedule repeated sowings at the crop-specific cadence until the next sowing would exceed the crop's heat stop or last viable fall date. Surface the *next* succession action, not dozens of dates at once.

### Heat-limited climates
When freeze anchors are weak or absent, do not fail. Switch to a heat-limited interpretation. Cool crops should be framed as fall/winter/early-spring crops in hot southern/desert locations, and warm crops should not be described with a fake northern spring-frost season. Label this lower-confidence when temperature climatology is not yet available.

### Photoperiod
For onions, use latitude context to explain short-day/day-neutral/long-day cultivar fit. Do not imply one onion variety works nationally.

### Bed utilization
For each crop, offer a small, agronomically sensible set of follow-on crops based on season and harvest timing. This is bed-turnover guidance, not companion-planting folklore.

## UX contract
The result must answer these before the large crop table:
- Plant outside now
- Start indoors now
- Transplant now
- Sow next succession
- Fall garden opportunities

Each crop row/card should expose:
- method
- spring timing
- fall last viable date when calculable
- maturity/harvest window
- succession cadence
- soil-temperature gate
- heat/cold caution
- what follows

Use progressive disclosure. Keep the top decision panel concise; deeper biology belongs in the table/details.

## Uncertainty
Show whether the climate anchor is 10% late-freeze probability or median fallback, station distance/confidence, and whether current cold forecast is available. If fall freeze normals are absent, explicitly say fall timing is heat-limited/heuristic rather than fabricating a date.

## Edge-case validation
Before release, validate representative cold north, Great Lakes, Mid-Atlantic, Gulf, desert Southwest, maritime Northwest, high-elevation, and frost-light locations. The tool must not become nonsensical simply because a location has a weak frost season.

## Benchmark
Score against `benchmarks/national-planting-calendar.json`. Ship only at >=90/100 overall and >=85 in every critical value function. Automatic-reject conditions in that benchmark are release blockers.

## Search/revenue constraint
Increase the usefulness and query coverage of the single canonical tool for planting-now, succession planting, fall garden, last planting date and by-location intents. Do not manufacture doorway pages. Internal search growth comes from a stronger canonical decision engine and legitimate contextual links.

## Acceptance criteria
- Existing canonical and location workflow remain intact.
- Fall dates are computed, not merely described in an FAQ.
- Succession is computed, not just mentioned.
- Direct sow, indoor start and transplant remain distinct.
- At least the core crop set has maturity, soil temperature, fall slowdown and succession metadata where applicable.
- Hot-climate/no-strong-frost locations fail soft with honest guidance.
- Crop data is source-traceable.
- Decision logic is in a testable module.
- Regression verification is green.
- Merge and production deployment are verified before calling the work complete.
