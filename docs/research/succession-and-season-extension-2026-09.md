# Research Note: Succession Planting and Whole-Season Garden Timing

Updated: 2026-09-03

## Product question

How should a national home-garden tool answer "what can I plant now?" in a way that is more useful than a last-spring-frost calendar?

## Findings

### 1. Succession is not one fixed interval

University of Minnesota Extension publishes crop-specific continuous-harvest intervals. Examples used as primary anchors in the v3 crop data include approximately:

- 7 days: leaf lettuce, spinach, radishes
- 10 days: bush beans, sweet corn, head lettuce, mustard greens
- 14 days: broccoli, beets, cauliflower, kale, turnips
- 21 days: cabbage, carrots, cucumbers, green onions
- 30 days: summer squash and Swiss chard

The same UMN material also distinguishes crop cold hardiness, which matters because a first 32°F event is not the same biological deadline for cabbage, kale or spinach as it is for beans or cucumbers.

Source:
- University of Minnesota Extension, *Climate resilience resources for vegetable growers in Minnesota*
  https://extension.umn.edu/agriculture/specialty-crops/vegetable-farming/climate-resilience-resources-for-vegetable-growers-in-minnesota

### 2. Succession also means replacing one crop with another

UMN's crop and field planning guidance describes succession as putting another crop into the same area after the first matures. It groups leafy greens, radishes and peas as short-season, cold-tolerant crops useful in shoulder seasons; broccoli, cauliflower, beans, beets, carrots and cucumbers as medium-season crops; and tomatoes, peppers, eggplants, winter squash, melons and onions as crops that generally occupy much more of the season.

Illinois Extension's *Nonstop Vegetable Gardening* describes three distinct strategies:
1. sow small amounts of the same crop every 7–10 days;
2. replace spring crops with summer crops and summer crops with fall crops;
3. use early-, mid- and late-maturing cultivars to spread harvest.

Those principles justify both conditional repeat sowing and dynamic same-bed relay suggestions.

Sources:
- University of Minnesota Extension, *Crop and field planning tools for vegetable farmers*
  https://extension.umn.edu/vegetable-growing-guides-farmers/crop-and-field-planning-tools-vegetable-farmers
- Illinois Extension, *Nonstop Vegetable Gardening*
  https://extension.illinois.edu/sites/default/files/vegetable_succession_planting_chart.pdf

### 3. Fall days-to-maturity need extra calendar time

Illinois Extension recommends counting backward from the expected first frost by days to maturity and adding roughly a week or two because fall growth slows as temperatures cool.

That means a simple `first frost - packet DTM` calculation is too optimistic for many fall plantings.

Source:
- Illinois Extension, *Planting a Fall Vegetable Garden*
  https://extension.illinois.edu/blogs/good-growing/2019-08-06-planting-fall-vegetable-garden

### 4. First frost is not a universal crop death date

Illinois Extension separates fall vegetables into semi-hardy and hardy groups. Beets, carrots, cauliflower and lettuce can tolerate light frost around 32°F; broccoli, cabbage, radishes and spinach can tolerate colder conditions around 28°F. UMN similarly distinguishes hardy crops and crops that are killed by frost.

The engine therefore uses crop-specific conservative cold extensions beyond the 32°F climatology anchor. These are planning allowances and must not be presented as guarantees.

### 5. "Can I still plant it?" should use the harvest target

A full head/root/fruit is not the only legitimate harvest target.

UMN's planning tables explicitly distinguish, for example, baby carrots from full-size carrots. Greens such as spinach, arugula and salad mix can be harvested as one or multiple cuts. This supports a transparent fallback where full maturity no longer fits but a genuine baby-leaf, green or young-root harvest still does.

The tool must label these as quick-harvest alternatives and must never imply full maturity.

### 6. Direct sow and transplant cannot share one maturity clock

Penn State's planting/transplanting guidance distinguishes weeks grown indoors and days to crop maturity, and its fall vegetable guidance notes that seed-packet DTM for transplanted crops commonly begins at transplant rather than indoor seeding.

A broccoli transplant can therefore remain viable later than direct-seeded broccoli. The engine needs method-specific timing.

Sources:
- Penn State Extension, *Vegetable Planting and Transplanting Guide*
  https://extension.psu.edu/downloadable/download/sample/sample_id/16580/
- Penn State Extension, *Season Extenders and Growing Fall Vegetables*
  https://extension.psu.edu/season-extenders-and-growing-fall-vegetables

### 7. Root crops should usually remain direct-seeded

Penn State notes that transplanting roots such as carrots, radishes and turnips can deform the harvestable root and recommends direct seeding. The crop schema therefore treats core root crops as direct-seed crops for routine recommendations.

Source:
- Penn State Extension, *Starting Your Summer Vegetable Garden—Seeds or Transplants?*
  https://extension.psu.edu/starting-your-summer-vegetable-garden-seeds-or-transplants

### 8. Soil temperature is a real biological gate

Oregon State Extension publishes minimum/optimum germination temperatures. Representative minimums include beans 60°F, corn 50°F, cucumber 60°F, lettuce about 35°F, peas 40°F, spinach 35°F and tomato 50°F.

The tool should not estimate soil temperature from a calendar date. Instead it exposes an optional measured soil temperature. When entered, that measurement becomes a real direct-sow gate.

Source:
- Oregon State University Extension, *Soil temperature conditions for vegetable seed germination*
  https://extension.oregonstate.edu/catalog/soil-temperature-conditions-vegetable-seed-germination

### 9. Michigan Extension supports two shoulder seasons

Michigan State University Extension describes cool-season vegetables as spring/fall crops that can tolerate some frost, with onions, peas and spinach among the hardiest early plantings. Warm-season cucumbers, melons, squash, peppers and tomatoes are sensitive to cool conditions and frost.

This supports the Great Lakes benchmark: the tool should show useful pre-frost spring planting, summer successions, and a real fall garden—not just garlic.

Source:
- Michigan State University Extension, *How to plant vegetables*
  https://www.canr.msu.edu/ingham/uploads/files/VegetablePlantingGuide.pdf

### 10. Onion latitude matters

Nebraska Extension explains that onion bulb development is photoperiod-driven:
- short day: roughly 11–12 hours,
- intermediate/day-neutral: roughly 12–14 hours,
- long day: roughly 14+ hours.

A national tool must not recommend one bulbing-onion type everywhere.

Source:
- Nebraska Extension, *Onions – Long Day, Short Day or Neutral?*
  https://lancaster.unl.edu/onions-long-day-short-day-or-neutral/

## v3 product implications

The research resolves into five major product changes:

1. **Plant-today runway:** evaluate whether a crop started today can reach a real harvest target.
2. **Conditional succession:** show a next repeat date only if that next planting would still fit.
3. **Quick-harvest fallback:** allow defensible baby-leaf/greens/young-root targets when full maturity closes.
4. **Bed relay:** evaluate likely follow-on crops at the projected harvest date.
5. **Biological gates:** separate current NWS cold/heat, crop cold tolerance, measured soil temperature, method-specific maturity and fall slowdown.

## Deliberate limitations

- Freeze normals are probability anchors, not exact local frost dates.
- A 7-day forecast cannot describe the whole future season.
- Generic crop constants cannot replace a named cultivar's seed packet.
- Soil temperature is user-entered rather than inferred.
- National heat-season logic is intentionally conservative until a defensible climatological heat/GDD layer is integrated.
