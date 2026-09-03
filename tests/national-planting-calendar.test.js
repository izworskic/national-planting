const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const E=require("../public/assets/national-planting-engine.js");
const baseData=JSON.parse(fs.readFileSync(path.join(__dirname,"../public/data/national-planting-crops.json"),"utf8"));
const v3=JSON.parse(fs.readFileSync(path.join(__dirname,"../public/data/national-planting-v3.json"),"utf8"));
function mergeCropData(base,sup){
  const crops=(base.crops||[]).map(c=>{
    const raw=sup.overrides?.[c.id]||{}, extraSources=raw.v3_sources||[];
    const o={...raw};delete o.v3_sources;
    return {...c,...o,sources:[...new Set([...(c.sources||[]),...extraSources])]};
  }).concat(sup.add_crops||[]);
  return {...base,version:sup.version,crops,sources:[...(base.sources||[]),...(sup.sources||[])]};
}
const data=mergeCropData(baseData,v3);
const benchmark=JSON.parse(fs.readFileSync(path.join(__dirname,"../benchmarks/national-planting-calendar.json"),"utf8"));
const page=fs.readFileSync(path.join(__dirname,"../public/national-tools/planting/index.html"),"utf8");
const pageScript=fs.readFileSync(path.join(__dirname,"../public/assets/national-planting-page-v3.js"),"utf8");
const crop=id=>data.crops.find(c=>c.id===id);
const date=(y,m,d)=>new Date(y,m-1,d,12);
const mildForecast=(lo=50,hi=78)=>({periods:[{temp_f:lo},{temp_f:hi}]});
const ctx=(over={})=>({
  today:date(2026,9,3),
  springAnchor:date(2026,5,10),
  fallAnchor:date(2026,10,15),
  latitude:43.6,
  freezeLevel:"none",
  currentForecast:mildForecast(),
  maturityOverride:{},
  soilTempF:null,
  ...over
});

test("dataset is a source-traceable whole-year v3 crop model",()=>{
  assert.equal(v3.version,"3.0.0");
  assert.equal(data.version,"3.0.0");
  assert.ok(data.crops.length>=35);
  assert.ok(data.sources.length>=8);
  for(const c of data.crops){
    assert.ok(c.maturity_days?.default>0,c.id+" maturity");
    assert.ok(Array.isArray(c.sow_methods)&&c.sow_methods.length,c.id+" sow methods");
    assert.ok(Array.isArray(c.sources)&&c.sources.length,c.id+" sources");
    assert.ok(Array.isArray(c.follow_with),c.id+" follow-with");
    if(c.id!=="garlic")assert.ok(c.fall_slowdown_factor>=1,c.id+" fall slowdown");
  }
  for(const id of ["carrot","beet","radish","turnip"])assert.deepEqual(crop(id).sow_methods,["direct"]);
  assert.equal(crop("lettuce").succession_interval_days,7);
  assert.equal(crop("bean").succession_interval_days,10);
  assert.equal(crop("broccoli").succession_interval_days,14);
  assert.equal(crop("carrot").succession_interval_days,21);
  assert.equal(crop("swiss-chard").succession_interval_days,30);
});

test("a crop with exactly 90 days of tender-crop runway is still plantable today",()=>{
  const synthetic={
    id:"ninety-day",name:"90-day crop",season:"warm",sow_methods:["direct"],
    maturity_days:{default:90},method_days:{direct:90},fall_slowdown_factor:1,
    fall_safety_days:0,cold_extension_days:0,harvest_style:"single",follow_with:[]
  };
  const c=ctx({today:date(2026,7,1),fallAnchor:date(2026,9,29),springAnchor:date(2026,5,1),currentForecast:mildForecast(65,85)});
  const ev=E.evaluateMethod(synthetic,"direct",c);
  assert.equal(E.diffDays(c.fallAnchor,c.today),90);
  assert.equal(ev.state,"last-chance");
  assert.equal(E.diffDays(ev.projectedHarvest,c.today),90);
  assert.equal(ev.marginDays,0);
});

test("Great Lakes September scenario finds real fall actions instead of an empty calendar",()=>{
  const plan=E.build(data.crops,ctx());
  const direct=new Map(plan.now.direct.map(r=>[r.crop.id,r.direct]));
  for(const id of ["radish","spinach","arugula","mustard-greens","bok-choy"])assert.ok(direct.has(id),id+" should be actionable");
  assert.equal(direct.get("lettuce").harvestMode,"baby");
  assert.equal(direct.get("beet").harvestMode,"greens");
  assert.ok(!direct.has("tomato"));
  assert.ok(plan.now.fall.length>=10);
});

test("method-specific maturity lets a broccoli transplant fit later than direct seed",()=>{
  const b=crop("broccoli");
  const c=ctx({today:date(2026,8,1),fallAnchor:date(2026,10,15),currentForecast:mildForecast(55,79)});
  const directLatest=E.latestStart(b,c,"direct","full");
  const transplantLatest=E.latestStart(b,c,"transplant","full");
  assert.ok(transplantLatest>directLatest);
  assert.ok(E.diffDays(transplantLatest,directLatest)>=10);
});

test("quick-harvest modes rescue legitimate greens without pretending full maturity fits",()=>{
  const lettuce=crop("lettuce");
  const c=ctx({today:date(2026,9,12),fallAnchor:date(2026,10,15),currentForecast:mildForecast(46,72)});
  const ev=E.evaluateMethod(lettuce,"direct",c);
  assert.equal(ev.state,"limited");
  assert.equal(ev.harvestMode,"baby");
  assert.match(ev.reason,/Full maturity is too late/i);
});

test("forecast heat can pause cool-season sowing",()=>{
  const c=ctx({today:date(2026,7,1),fallAnchor:date(2026,11,1),currentForecast:mildForecast(75,96)});
  const ev=E.evaluateMethod(crop("lettuce"),"direct",c);
  assert.equal(ev.state,"blocked");
  assert.equal(ev.block,"heat");
});

test("optional measured soil temperature blocks premature warm direct seeding",()=>{
  const c=ctx({today:date(2026,5,20),fallAnchor:date(2026,10,15),springAnchor:date(2026,5,10),soilTempF:52,currentForecast:mildForecast(45,72)});
  const ev=E.evaluateMethod(crop("bean"),"direct",c);
  assert.equal(ev.state,"blocked");
  assert.equal(ev.block,"soil");
});

test("current freeze forecast blocks tender outdoor planting but not indoor starts",()=>{
  const c=ctx({today:date(2026,5,15),freezeLevel:"freeze",currentForecast:mildForecast(29,60)});
  assert.equal(E.evaluateMethod(crop("tomato"),"transplant",c).state,"blocked");
  assert.notEqual(E.evaluateMethod(crop("tomato"),"indoor",c).state,"blocked");
});

test("conditional succession repeats from today and stops when the repeat no longer fits",()=>{
  const radish=crop("radish");
  const good=ctx({today:date(2026,9,1),fallAnchor:date(2026,10,20),currentForecast:mildForecast(45,72)});
  const row=E.actionFor(radish,good);
  assert.ok(row.succession);
  assert.equal(E.diffDays(row.succession.date,good.today),7);

  const edge=ctx({today:date(2026,9,24),fallAnchor:date(2026,10,20),currentForecast:mildForecast(40,68)});
  const edgeRow=E.actionFor(radish,edge);
  assert.equal(edgeRow.succession,null);
});

test("relay recommendations are evaluated at projected harvest rather than copied blindly",()=>{
  const plan=E.build(data.crops,ctx({today:date(2026,5,20),fallAnchor:date(2026,10,15),currentForecast:mildForecast(55,78)}));
  const radish=plan.rows.find(r=>r.crop.id==="radish");
  assert.ok(radish.harvest?.start);
  assert.ok(radish.relays.length>0);
  assert.ok(radish.relays.every(r=>r.date.getTime()===radish.harvest.start.getTime()));
});

test("garlic is handled as a regional fall overwinter window",()=>{
  const garlic=crop("garlic");
  const upcoming=E.evaluateMethod(garlic,"direct",ctx({today:date(2026,9,1),fallAnchor:date(2026,10,15)}));
  const open=E.evaluateMethod(garlic,"direct",ctx({today:date(2026,10,1),fallAnchor:date(2026,10,15)}));
  assert.equal(upcoming.state,"upcoming");
  assert.equal(open.state,"go");
});

test("frost-light and long-season climates use heat-gated cool-season logic",()=>{
  assert.equal(E.heatMode(25.76,null),"heat-limited");
  assert.equal(E.heatMode(29.76,date(2026,12,1)),"long-season");
  const houstonWinter=ctx({today:date(2026,12,15),latitude:29.76,fallAnchor:date(2026,12,1),springAnchor:date(2026,2,15),currentForecast:mildForecast(48,72)});
  const lettuce=E.evaluateMethod(crop("lettuce"),"direct",houstonWinter);
  assert.ok(["go","caution","limited","last-chance"].includes(lettuce.state));
  assert.equal(lettuce.latest,null);
});

test("onion latitude guidance changes with photoperiod",()=>{
  assert.match(E.onionFit(crop("onion"),44),/Long-day/);
  assert.match(E.onionFit(crop("onion"),29),/Short-day/);
});

test("benchmark defines a 100-point value function plus explicit loss function",()=>{
  assert.equal(benchmark.version,"2.0.0");
  assert.equal(benchmark.valueFunctions.reduce((s,x)=>s+x.weight,0),100);
  assert.ok(benchmark.lossFunctions.length>=8);
  assert.ok(benchmark.scenarioMatrix.length>=8);
  assert.ok(benchmark.passScore>=90);
});

test("page leads with plant-today decisions and preserves the single canonical",()=>{
  assert.match(page,/<h1>What can I plant now\?<\/h1>/);
  assert.match(page,/Direct sow now/);
  assert.match(page,/Last call \/ quick harvest/);
  assert.match(page,/If you plant now, sow again/);
  assert.match(page,/Use the bed next/);
  assert.match(page,/Know your soil temperature/);
  assert.match(page,/national-planting-engine\.js\?v=20260903-v3/);
  assert.match(page,/national-planting-page-v3\.js/);
  assert.match(pageScript,/national-planting-v3\.json/);
  assert.match(page,/rel="canonical" href="https:\/\/chrisizworski\.com\/national-tools\/planting\/"/);
  assert.doesNotMatch(page,/\/national-tools\/planting\/[a-z-]+\/["']/);
});
