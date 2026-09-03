# Season extension and hot-climate establishment research — September 2026

## Product question
How should the national planting engine change its advice when a home gardener intentionally uses row cover, frost blanket, low tunnel/cold frame, or temporary shade to stretch a planting window?

## Evidence

### Penn State Extension — Season Extenders and Growing Fall Vegetables
Penn State describes low tunnels, cold frames, hot beds and cloches as tools for extending vegetable production beyond ordinary frost/freeze dates. It emphasizes that the goal is to create a sheltered place for cool-season crops to grow or overwinter and that management effort matters.
Source: https://extension.psu.edu/season-extenders-and-growing-fall-vegetables

### Colorado State University Extension — Frost Protection and Extending the Growing Season
CSU notes that floating row covers can provide frost protection that varies by material and grade, while framed covers must be vented on sunny days to avoid overheating. This supports modeling protection as a management class rather than assuming a universal temperature gain.
Source: https://extension.colostate.edu/resource/frost-protection-and-extending-the-growing-season/

### Colorado State University Extension — Vegetable Gardening in the Mountains
CSU describes floating row covers as a way to gain roughly a couple of weeks on either side of the season, with frost blankets potentially adding another week or two, while plastic-covered low tunnels can add substantially more time. These are broad planning ranges, not guarantees.
Source: https://extension.colostate.edu/resource/vegetable-gardening-in-the-mountains/

### Utah State University Extension — Mulches and Row Covers
USU reports that floating row covers generally make the protected canopy warmer at night and substantially warmer during the day, while also warning about abrasion, overheating and pollination management. The amount of protection depends on the cover and weather.
Source: https://extension.usu.edu/vegetableguide/production/mulches-row-covers

### University of Arizona Cooperative Extension — Maricopa County Vegetable Planting Calendar
Arizona Extension describes two major planting seasons, spring and fall, separated by extreme summer heat. It stresses quick-maturing varieties, soil-temperature checks, avoiding temperature extremes and the use of shade/humidity/other protection to grow outside the core calendar.
Source: https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county

### University of Georgia Extension — Fall Vegetable Gardening
Georgia Extension frames cool-season fall crops as crops that often must be established during lingering late-summer heat. It recommends transplants for broccoli, cauliflower and Brussels sprouts and direct seeding for lettuce, carrots and greens.
Source: https://extension.uga.edu/publications/detail.html?number=C1258&title=fall-vegetable-gardening

### University of Georgia Extension — Home Gardening
UGA recommends keeping garden space occupied through the season, intercropping/relay planting, and successive plantings. This reinforces the product goal of turning protection and establishment tactics into more continuous bed use rather than simply adding frost dates.
Source: https://extension.uga.edu/publications/detail.html?number=B577

## Product rules derived from the evidence

1. **Protection is a user-declared management input, not inferred.**
   - `none`: bare-ground/open-garden baseline.
   - `row-cover`: conservative shoulder-season extension for cool crops.
   - `low-tunnel`: stronger extension for cool crops, with explicit ventilation/management caveat.

2. **Do not convert a row cover into a fake exact local temperature.**
   Protection changes planning runway and the interpretation of light cold risk. Current forecast temperatures remain the outside-air forecast.

3. **Conservative calendar extensions.**
   Use a deliberately conservative planning extension of about 7 days for row cover and 14 days for low tunnel/cold frame. These sit inside the broader ranges described by Extension and reduce false-positive late planting.

4. **Protection applies mainly to cool-season crops.**
   It should not make frost-tender tomatoes, beans, cucumbers or squash magically viable into freezing weather. Tender-crop freeze blocks remain hard blocks unless a future greenhouse/heated-structure mode is explicitly modeled.

5. **Temporary shade is a heat-establishment tactic, not a new climate.**
   When selected, severe heat that would normally pause a cool crop may be downgraded to a managed-risk caution only if enough seasonal runway remains. The UI must explicitly say that shade helps establishment but does not erase high ambient temperatures.

6. **Transplants matter in hot-climate fall establishment.**
   For crops with both direct and transplant methods, heat-stressed fall conditions should prefer transplanting when the direct-seed heat gate is poor and the transplant method remains viable.

7. **Every protection recommendation needs management language.**
   Row covers/low tunnels may require venting on warm sunny days; covers on insect-pollinated crops must be removed when pollination is needed.

## Acceptance tests
- Great Lakes fall lettuce gains a modest later planting window under row cover and a larger one under low tunnel.
- Tender beans remain blocked by an actual freeze forecast even when row cover is selected.
- A heat-stopped cool crop can become `caution` rather than `blocked` when temporary shade is selected and enough runway remains.
- Hot-climate crops with a viable transplant method can surface transplanting even when direct sow is heat-blocked.
- The interface visibly labels protection as an assumption and never rewrites the NWS forecast temperature.
