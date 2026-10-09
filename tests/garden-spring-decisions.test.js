const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const s=require("../public/national-tools/planting/_assets/garden-spring-decisions-engine.js");
const at=new Date("2026-10-09T21:00:00-04:00");
const base={location:{timeZone:"America/New_York"},hardiness_zone:{zone:"6a"},climate_normals:{dates:{fall_50:{mmdd:"10-20"}}}};
const nws={...base,current_forecast:{updated_at:"2026-10-09T18:00:00-04:00",periods:[{time:"2026-10-09T23:00:00-04:00",temp_f:38,unit:"F"},{time:"2026-10-10T03:00:00-04:00",temp_f:33,unit:"F"}]}};
function t(name,method,args,expected,feed=nws,date=at){test(name,()=>{const o=s[method](args,feed,date);assert.equal(o.code,expected);assert.ok(o.title&&o.lead&&o.actions?.length&&o.why?.length);});}
t("unidentified hydrangea is not pruned","pruneHydrangea",{type:"unknown",goal:"size"},"IDENTIFY_FIRST");
t("old-wood bigleaf in October is protected","pruneHydrangea",{type:"bigleaf",goal:"size"},"DONOT_PRUNE");
t("oakleaf in October protects buds","pruneHydrangea",{type:"oakleaf",goal:"size"},"DONOT_PRUNE");
t("rebloomer cannot be severely pruned in fall","pruneHydrangea",{type:"rebloom",goal:"size"},"DONOT_PRUNE");
t("panicle fall shaping deferred to spring","pruneHydrangea",{type:"panicle",goal:"size"},"WAIT_UNTIL_SPRING");
t("confirmed dead wood sanitation is allowed","pruneHydrangea",{type:"unknown",goal:"cleanup",damaged:"yes"},"SANITIZE");
t("old wood after bloom June has a narrow shaping window","pruneHydrangea",{type:"bigleaf",goal:"size",bloom:"finished"},"PRUNE_LIGHTLY",base,new Date("2027-06-10T19:00:00-04:00"));
t("panicle in March may be shaped","pruneHydrangea",{type:"panicle",goal:"size"},"PRUNE_NOW",base,new Date("2027-03-10T19:00:00-04:00"));
t("no measured soil cannot imply ready","soilReadiness",{crop:"beans",ground:"crumbly",soil:""},"MEASURE_SOIL");
t("beans in cold soil wait","soilReadiness",{crop:"beans",ground:"crumbly",soil:"44"},"WAIT_FOR_WARMTH");
t("soggy even warm seedbed veto","soilReadiness",{crop:"beans",ground:"saturated",soil:"70"},"DO_NOT_SOW");
t("frozen soil veto","soilReadiness",{crop:"peas",ground:"frozen",soil:"42"},"DO_NOT_SOW");
t("beans with imminent frost veto","soilReadiness",{crop:"beans",ground:"crumbly",soil:"68"},"FROST_RISK");
t("peas 50 degree soil ready conditionally","soilReadiness",{crop:"peas",ground:"crumbly",soil:"50"},"READY_CONDITIONAL");
t("dry soil needs moisture","soilReadiness",{crop:"cucumbers",ground:"dry",soil:"74"},"FIX_MOISTURE");
t("seedling day zero starts in shade","hardeningOff",{day:"0",crop:"warm"},"START_SHADED");
t("wind first sheltered","hardeningOff",{day:"5",crop:"warm",exposure:"wind"},"SHELTER_FIRST");
t("frost forecast overrules exposed mid-stage seedlings","hardeningOff",{day:"5",crop:"warm",exposure:"partial"},"PROTECT_FROM_FROST");
t("stale NWS does not imply safe overnight weather","hardeningOff",{day:"5",crop:"cool",exposure:"partial"},"VERIFY_LOCAL_FORECAST",base);
for(const slug of ["prune-hydrangeas","soil-temperature-ready","harden-off-seedlings"]){
test(slug+" is SEO indexable and uses compact 44px location forms",()=>{
 const html=fs.readFileSync(path.join(__dirname,"..","public/national-tools/planting",slug,"index.html"),"utf8");
 assert.ok(html.includes('rel="canonical" href="https://chrisizworski.com/national-tools/planting/'+slug+'/"'));
 assert.match(html,/application\/ld\+json/);
 assert.match(html,/garden-spring-decisions-engine\.js/);
 assert.match(html,/@media\(max-width:760px\)\{\.locator\{flex-direction:column;align-items:stretch\}\.locator input,\.locator button\{flex:0 0 auto;width:100%;height:44px/);
 assert.match(html,/<form class="locator" id="place"/);
 assert.doesNotMatch(html,/<title><\/title>/);
});
}