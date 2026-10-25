# Measured soil near you (soil-temperature-ready), October 25, 2026

**Page:** `/national-tools/planting/soil-temperature-ready/` (URL and canonical unchanged) · **Tests:** `tests/soil-station.test.js`

## Why

The owner asked to take the Michigan garden tools national without eroding the Michigan pages. The Michigan soil tool (chrisizworski.com `/michigan-soil-temperature/`, MSU Enviroweather data) is the model. This page was the national owner of the soil-readiness intent but measured nothing: it asked for a thermometer reading. Autocomplete, used as a demand proxy (not search volume), shows the national question is ZIP-shaped and live: "soil temperature map", "soil temperature by zip code", "soil temperature near me", "soil temps near me". The page now answers that, and keeps its thermometer verdict unchanged.

## What changed (additive)

- A "measured soil near you" panel above the existing verdict: the nearest federal soil station's reading about 2 inches down, a 16-day forecast, the date the soil should stay at or above the chosen crop's minimum, a chart, and the station's past springs.
- Title, description and H1 now lead with "Soil temperature by ZIP code". Canonical, robots, structured data shape, location form, crop list, thermometer verdict and every existing test are kept.
- `garden-fall-decisions-page.js` broadcasts the chosen place (`garden:place`) so the panel can listen; nothing else in that script changed.

## Data

| Source | What | Browser access |
|---|---|---|
| USDA NRCS SCAN via AWDB REST (`wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data`) | Daily soil temperature at -2 in (element STO), °F | Open CORS, no key; documented federal API |
| NOAA USCRN daily01 files (`ncei.noaa.gov/pub/data/uscrn/products/daily01/`) | Daily average soil temperature at 5 cm, °C | Open CORS |
| Open-Meteo forecast API | Hourly soil temperature at 6 cm, 7 past and 16 forecast days | Open CORS; free for non-commercial use, CC BY 4.0 |
| Location | The existing `/api/national-geocode` the page already used | unchanged |

319 stations in 45 states have at least one usable spring (Connecticut, Delaware and New Jersey have none of their own). Median distance between neighbouring stations is 37 miles, but coverage is uneven: about half of the lower 48 is within 75 miles of a station.

**Distance rule.** Within 75 miles the station's reading is used and the model is read at the station and shifted by the average station-minus-model gap over the last 7 days (the shift is printed). Past 40 miles the page says to read it as a rough guide. Beyond 75 miles the answer comes from the model at the visitor's location, unadjusted, and says it is a model estimate, not a measurement.

**Crop minimums** are the page's existing crop table (University of Maryland Extension), which matches the minimums in J. F. Harrington's soil-temperature table published by Oregon State University Extension for every crop listed (peas, radishes, carrots, beets 40°F; spinach, lettuce 35°F; sweet corn 50°F; beans, cucumbers, squash, melons 60°F). A test pins that agreement.

**The rule** (this site's, disclosed): soil counts as warm enough from the first day its daily average stays at the minimum or warmer for the rest of the data, at least 3 days. Same rule for live data and history.

## History

`scripts/fetch-soil-history.mjs` downloaded Jan 1 to Jun 30, 2016 to 2026 for every active lower-48 SCAN station and every USCRN station (one request at a time). `data/soil-2in-daily.json` (2.4 MB) keeps the daily values; `scripts/build-soil-history.mjs` builds `_data/soil/stations.json` plus one small file per station (217 KB in all; the page loads the index and one station). The test rebuilds and compares byte for byte.

Quality checks: days outside 10 to 110°F dropped (309); a day is a sensor fault when its gap to the median of the nearest stations within 150 miles departs more than 12°F from that station's usual gap that spring (2,976 days). Comparing departures, not raw gaps, matters: a first version compared raw values and flagged every day at Stovepipe Wells in Death Valley, which is simply hotter than its neighbours. Springs need 165 of 181 days, no gap over 7 days and no more than 10 fault days: 2,796 kept, 389 dropped.

What the record says (stations with five or more springs, middle date per station):

| Minimum | Stations | Middle station | Most stations (10th to 90th percentile) | Spread at one station, earliest to latest spring |
|---|---:|---|---|---|
| 35°F | 292 | Feb 14 | before Jan 1 to Apr 3 | 38 days |
| 40°F | 292 | Mar 6 | before Jan 1 to Apr 21 | 38 days |
| 50°F | 292 | Apr 12 | Feb 17 to May 20 | 34 days |
| 60°F | 290 | May 12 | Mar 24 to Jun 17 | 32 days |

The spread inside one station, about a month, is the case for a live reading over a calendar date.

## Michigan

The national copy (title, description, H1, lede) never mentions Michigan; a test enforces it, so this page does not compete with the Michigan soil page for Michigan searches. A Michigan location gets a first line pointing to `/michigan-soil-temperature/?place=<ZIP>`, where MSU's ~100 stations give a closer reading (the nearest federal station to Bay City is 98 miles away).

## Limits

- The adjusted forecast is not validated against later readings yet.
- SCAN's daily value and USCRN's daily average are both daily means but are computed differently; neither is the morning low a gardener's thermometer reads.
- Lower 48 only. Alaska, Hawaii and Puerto Rico get the model, unadjusted.
- A station map ("soil temperature map") is the next step and is not in this change.
