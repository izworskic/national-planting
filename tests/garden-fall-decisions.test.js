const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const D=require("../public/national-tools/planting/_assets/garden-fall-decisions-engine.js");
const at=new Date("2026-10-09T21:00:00-04:00");
function climate(temps=[50,48,46],zone="6a",updated="2026-10-09T19:00:00-04:00"){
 return {location:{timeZone:"America/New_York"},hardiness_zone:{zone},climate_normals:{dates:{fall_50:{mmdd:"10-20"}},distance_miles:12},
 current_forecast:{updated_at:updated,periods:temps.map((t,i)=>({time:new Date(at.getTime()+i*3600000).toISOString(),temp_f:t,unit:"F"}))}};
}
test("tomato mature green with frost should harvest",()=>assert.equal(D.tomatoes({stage:"mature"},climate([46,35]),at).code,"HARVEST"));
test("color-break tomato without short-term frost has indoor ripening potential",()=>assert.equal(D.tomatoes({stage:"breaker"},climate(),at).code,"PROMISING"));
test("flower tomato near median frost has poor chance",()=>assert.equal(D.tomatoes({stage:"flower"},climate(),at).code,"LOW_CHANCE"));
test("no forecast is explicitly unavailable",()=>assert.equal(D.context(null,at).forecastState,"UNAVAILABLE"));
test("stale weather cannot imply safe forecast",()=>{const f=climate([46,44],"6a","2026-10-06T19:00:00-04:00");assert.equal(D.context(f,at).forecastState,"STALE_OR_INVALID");});
test("missing temperatures do not turn into 32 degree freeze",()=>{const c=D.context(climate([null,null]),at);assert.equal(c.low7d,null);assert.equal(c.nextFreezeAt,null);});
test("winter dahlia in cold zone with frost damaged tops is dug",()=>assert.equal(D.dahlias({foliage:"frosted",soil:"workable"},climate(),at).code,"DIG"));
test("frozen ground overrules dahlia timing",()=>assert.equal(D.dahlias({foliage:"green",soil:"frozen"},climate(),at).code,"GROUND_FROZEN"));
test("dahlia container should be moved",()=>assert.equal(D.dahlias({foliage:"green",setting:"pot"},climate(),at).code,"MOVE_POT"));
test("mild zone with draining ground has conditional overwinter option",()=>assert.equal(D.dahlias({foliage:"green",drainage:"good"},climate([51,47],"9a"),at).code,"OPTION"));
test("wet soil overrides mild zone option",()=>assert.equal(D.dahlias({foliage:"green",drainage:"wet"},climate([51,47],"9a"),at).code,"DIG"));
test("late fall rye remains conditional",()=>assert.equal(D.coverCrop({species:"rye",bed:"clear",ground:"workable"},climate(),at).code,"POSSIBLE"));
test("radish window can be too late",()=>assert.equal(D.coverCrop({species:"radish",bed:"clear",ground:"workable"},climate(),at).code,"LATE_FOR_SPECIES"));
test("buckwheat is not recommended in October",()=>assert.equal(D.coverCrop({species:"buckwheat",bed:"clear",ground:"workable"},climate(),at).code,"TOO_LATE_FOR_SPECIES"));
test("frozen soil vetoes cover crop sowing",()=>assert.equal(D.coverCrop({species:"rye",bed:"clear",ground:"frozen"},climate(),at).code,"GROUND_FROZEN"));
test("spring rye branch provides context without crashing",()=>assert.equal(D.coverCrop({species:"rye",bed:"clear",ground:"workable"},null,new Date("2027-04-09T21:00:00-04:00")).code,"PLAN_FALL"));
test("MM-DD freeze estimate based on local date, not UTC date",()=>{
 const c=D.context(climate(),new Date("2026-10-09T23:40:00-04:00"));
 assert.equal(c.daysToMedianAirFreeze,11);
});
for(const slug of ["tomato-ripening","dig-dahlias","cover-crops"]){
 test(slug+" has unique indexable canonical, correct interactive fields and compact form",()=>{
  const html=fs.readFileSync(path.join(__dirname,"..","public/national-tools/planting",slug,"index.html"),"utf8");
  assert.match(html,new RegExp('rel="canonical" href="https://chrisizworski.com/national-tools/planting/'+slug+'/"'));
  assert.match(html,/application\/ld\+json/);assert.match(html,/data-decision="(?:tomatoes|dahlias|coverCrop)"/);
  assert.match(html,/garden-fall-decisions-engine\.js/);
  assert.match(html,/@media\(max-width:760px\)\{\.locator\{flex-direction:column;align-items:stretch\}\.locator input,\.locator button\{flex:0 0 auto;width:100%;height:44px/);
  assert.doesNotMatch(html,/<title>\s*<\/title>/);
 });
}
