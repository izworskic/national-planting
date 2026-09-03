# Master Execution Prompt: National Planting Decision Engine v3

## Mission

Maintain one canonical national planting tool at `/national-tools/planting/` that answers the question serious gardeners actually have throughout the year:

**What can I still plant today, by which method, what can I plant again, when does the opportunity close, what can I realistically harvest, and what should use the bed next?**

This is not a frost-date translator and not a spring-only calendar. It is a whole-season garden decision engine.

Do not create thin city/ZIP doorway pages. Do not use USDA hardiness zones as planting dates. Do not touch sibling repositories except through their documented versioned/public contracts.

## User jobs

The page must solve these jobs before presenting a large crop table:

1. Direct sow now.
2. Transplant now.
3. Start indoors now.
4. Identify last-call plantings.
5. Identify legitimate quick-harvest alternatives when full maturity no longer fits.
6. Show conditional next succession dates.
7. Surface fall and overwinter opportunities.
8. Let a gardener override generic maturity with cultivar packet days.
9. Explain what can follow the current crop in the same bed.

## Product truth

A useful planting recommendation is a constrained time-to-harvest problem, not a month label.

Evaluate:

- local freeze probability climatology;
- current NWS cold and heat risk;
- crop frost tolerance;
- method-specific time to harvest;
- direct sow versus transplant versus indoor-start behavior;
- user-entered measured soil temperature when available;
- fall slowdown from cooling temperatures and shortening days;
- heat and bolting limits;
- cultivar maturity override;
- alternate legitimate harvest modes (baby leaf, greens, young roots);
- succession cadence;
- onion photoperiod where relevant;
- bed turnover after projected harvest.

USDA hardiness zone describes extreme winter minimums for perennial survival. It may be displayed as context but must never drive the annual vegetable planting calendar.

## Evidence hierarchy

1. NOAA/NCEI 1991–2020 freeze-probability normals for local spring/fall anchors.
2. National Weather Service hourly forecast for current cold/heat conditions.
3. Cooperative Extension and land-grant university crop guidance.
4. Cultivar seed-packet maturity supplied by the gardener.
5. Future enhancement: GDD/soil/climatological heat layers where a defensible national contract exists.

Core source families:
- University of Minnesota Extension continuous-harvest intervals, cold hardiness, season length and crop planning.
- University of Illinois Extension succession strategies and the fall slowdown factor.
- Michigan State University Extension cool/warm crop timing and frost behavior.
- Penn State Extension seed/transplant timing and method-specific maturity context.
- Oregon State University Extension vegetable germination soil temperatures.
- Nebraska Extension onion photoperiod.

## Crop-rule contract

Each crop supports, where biologically relevant:

`id`, `name`, `category`, `season`, `sow_methods`, `indoor_weeks`,
`setout_offset_days`, `direct_sow_offset_days`, `transplant_sensitive`,
`hardening_days`, `maturity_days`, `method_days`, `harvest_style`,
`harvest_modes`, `succession_interval_days`, `soil_temp_min_f`,
`soil_temp_opt_f`, `frost_tolerance`, `cold_extension_days`,
`fall_slowdown_factor`, `fall_safety_days`, `heat_caution_f`,
`heat_stop_f`, `bolting_risk`, `photoperiod`, `overwinter`,
`follow_with`, `note`, `sources`.

A crop may have alternate `harvest_modes` only when the alternate is a genuine harvest target, not a trick to make a late planting appear viable.

## Decision model

### 1. Method-specific runway

Do not use one maturity number for all methods.

For a planting method `m` and harvest target `h`:

`runway_days = method_days(crop, m, h, cultivar_override) × seasonal_factor`

Indoor start includes the indoor growing period plus the post-transplant time needed to harvest.

### 2. Cold deadline

For frost-limited climates:

`cold_deadline = local_first_32F_probability_anchor + crop_cold_extension`

Tender crops receive no cold extension. Hardy crops may receive a conservative extension because the first 32°F event is not their universal biological end.

The extension is a planning allowance, not a guaranteed survival temperature.

### 3. Last viable start

`last_viable_start = cold_deadline - ceil(runway_days) - fall_safety_days`

If today equals the last viable start, the crop is a **last-call** planting. Do not reject it simply because there is zero spare margin.

### 4. Quick-harvest fallback

If full maturity no longer fits, test only source-defensible alternate harvest modes.

Examples:
- leaf lettuce → baby leaf;
- spinach → baby leaf;
- beets → beet greens;
- turnips → turnip greens;
- carrots → baby roots;
- kale/chard/arugula → baby leaves.

Label this clearly as `Quick harvest only`. Never imply the full crop will mature.

### 5. Heat and soil gates

Use the NWS 7-day forecast separately from climatology.

- A forecast freeze blocks frost-tender outdoor starts.
- Severe heat can pause cool-season crops.
- Heat near the crop caution threshold remains plantable with a warning.
- If the gardener enters measured soil temperature, direct sowing below the crop minimum is blocked.
- Do not invent soil temperature when no measurement exists.

### 6. Succession planting

Succession output is conditional:

`next_repeat = today + crop.succession_interval_days`

Only show the repeat if the crop would still be viable when that next sowing date arrives.

Phrase it as: **If you plant now, sow again around [date]**.

Do not imply knowledge of the user's previous sowing history.

### 7. Same-bed relay

After calculating the projected harvest of a crop, evaluate its `follow_with` candidates using the projected harvest date as the future planting date.

Only surface a relay crop if it remains biologically and seasonally viable at that future date.

This is bed-utilization planning, not companion-plant folklore.

### 8. Frost-light and long-season climates

When a location is heat-limited or long-season, do not force hardy cool crops to stop at a generic first-32°F date. Use current heat/cold conditions to govern the cool season.

Cool crops should naturally re-emerge in fall/winter/early spring in hot climates. The tool must never respond that no calendar can be built simply because freeze anchors are weak.

### 9. Garlic

Garlic is a fall-planted overwintering crop with a broad regional window around local autumn cold climatology. It is not the sole fall-garden recommendation.

## UX contract

The result begins with:
- number of outdoor crops viable now;
- number of last-call/quick-harvest options;
- number with another succession possible;
- current NWS 7-day temperature range;
- optional measured soil-temperature input.

Then show:
- Direct sow now
- Transplant now
- Start indoors now
- Last call / quick harvest
- If you plant now, sow again…
- Fall & overwinter garden

The full table is progressive disclosure, not the first answer.

Each crop table row exposes:
- today verdict;
- method;
- spring timing;
- fall cutoff;
- harvest estimate;
- repeat cadence;
- same-bed relay;
- soil/heat/cold gates;
- source family;
- cultivar maturity override.

## Search strategy

Grow the usefulness and query coverage of the single canonical page for:
- what can I plant now;
- what vegetables can I plant in [month];
- succession planting;
- fall vegetable garden;
- last planting date for [crop];
- can I still plant [crop];
- second crop after [crop];
- late-season vegetables;
- baby leaf late planting;
- direct sow versus transplant timing.

Do not manufacture hundreds of near-duplicate location pages.

## Benchmark and loss function

Use `benchmarks/national-planting-calendar.json`.

Ship only when:
- final benchmark score >= 92/100;
- every critical value function >= 85;
- no automatic reject is triggered;
- automated decision scenarios pass;
- production smoke test passes.

Key losses include false-positive tender planting, hardiness-as-calendar, spring-only output, transplanting root crops, false empty-now results, ignoring fall slowdown, ignoring heat/soil, fake frost certainty, fake succession dates, and doorway-page SEO.

## Required test scenarios

At minimum:
- exact 90-day crop with exactly 90 days remaining is viable as last-call;
- Great Lakes early spring;
- Great Lakes September fall garden;
- method-specific transplant versus direct timing;
- quick-harvest fallback;
- forecast heat block;
- measured-soil-temperature block;
- current freeze block;
- succession stop;
- same-bed relay evaluation;
- garlic fall window;
- hot/long-season winter cool crops;
- onion photoperiod.

## Release discipline

1. Research before changing crop constants.
2. Keep crop data source-keyed.
3. Keep decision logic testable outside the page.
4. Preserve `/national-tools/planting/`.
5. Run the full repository test suite.
6. Score against the benchmark and record the scorecard.
7. Review the PR diff.
8. Merge only when gates pass.
9. Verify the production canonical and core location workflow after deployment.
