const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../public/assets/national-planting-engine.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/data/national-planting-crops.json'),'utf8'));
const page=fs.readFileSync(path.join(__dirname,'../public/national-tools/planting/index.html'),'utf8');
const crop=id=>data.crops.find(c=>c.id===id);

test('crop dataset carries expert-grade biology fields',()=>{
  assert.equal(data.version,'2.0.0');
  assert.ok(data.crops.length>=20);
  for(const c of data.crops.filter(c=>c.id!=='garlic')){
    assert.ok(c.maturity_days?.default>0,c.id+' maturity');
    assert.ok(Array.isArray(c.sow_methods)&&c.sow_methods.length,c.id+' sow methods');
    assert.ok(c.fall_slowdown_factor>=1,c.id+' fall slowdown');
    assert.ok(Array.isArray(c.follow_with),c.id+' bed turnover');
  }
  assert.equal(crop('carrot').transplant_sensitive,true);
  assert.equal(crop('spinach').soil_temp_min_f,35);
  assert.ok(crop('onion').photoperiod);
});

test('fall cutoff runs backward with slowdown and cultivar override',()=>{
  const fall=new Date(2026,9,15,12);
  const lettuce=crop('lettuce');
  const normal=E.fallLastViable(lettuce,fall);
  const slow=E.fallLastViable(lettuce,fall,60);
  assert.ok(normal<fall);
  assert.ok(slow<normal);
  assert.equal(E.diffDays(fall,normal),Math.ceil(45*1.15)+7);
});

test('succession stops when the next sowing is beyond last viable date',()=>{
  const radish=crop('radish');
  const start=new Date(2026,7,1,12),today=new Date(2026,8,10,12),last=new Date(2026,8,11,12);
  assert.equal(E.nextSuccession(radish,start,today,last),null);
});

test('heat-limited climates do not require a fake frost anchor',()=>{
  assert.equal(E.heatMode(25.76,null),'heat-limited');
  assert.equal(E.heatMode(47.6,new Date(2026,9,20)),'frost-limited');
});

test('onion latitude guidance changes by photoperiod',()=>{
  const onion=crop('onion');
  assert.match(E.onionFit(onion,44),/Long-day/);
  assert.match(E.onionFit(onion,29),/Short-day/);
});

test('page exposes whole-year decisions without new doorway canonicals',()=>{
  assert.match(page,/<title>Planting Calendar by Location \| Chris Izworski<\/title>/);
  assert.match(page,/What should I do now\?/);
  assert.match(page,/Next succession/);
  assert.match(page,/Fall garden/);
  assert.match(page,/Cultivar days/);
  assert.match(page,/national-planting-engine\.js/);
  assert.match(page,/rel="canonical" href="https:\/\/chrisizworski\.com\/national-tools\/planting\/"/);
  assert.doesNotMatch(page,/USDA hardiness zone.*primary planting-date/i);
});
