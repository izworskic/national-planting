const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const script=fs.readFileSync(path.join(__dirname,"../public/assets/national-planting-page-v3.js"),"utf8");

test("planting browser bundle parses as JavaScript",()=>{
  assert.doesNotThrow(()=>new Function(script));
});

test("ZIP form has a self-contained binding fallback",()=>{
  assert.match(script,/function fallbackNationalTools\(\)/);
  assert.match(script,/NationalTools\|\|window\.NationalPlantingLocation\|\|fallbackNationalTools\(\)/);
  assert.match(script,/national-geocode\?q=/);
  assert.match(script,/N\.bind\(form,run\)/);
});

test("location form binds before optional packet controls",()=>{
  const bindAt=script.indexOf("N.bind(form,run)");
  const packetAt=script.indexOf('packetCrop.addEventListener("change"');
  assert.ok(bindAt>=0,"location bind must exist");
  assert.ok(packetAt>=0,"packet listener must exist");
  assert.ok(bindAt<packetAt,"ZIP form must bind before optional packet controls");
  assert.match(script,/packetDays\?\.addEventListener/);
  assert.match(script,/packetMethod\?\.addEventListener/);
  assert.match(script,/soil\?\.addEventListener/);
});

test("missing core runtime surfaces a visible load error instead of a dead form",()=>{
  assert.match(script,/if\(!E\|\|!S\|\|!form\)/);
  assert.match(script,/did not finish loading/);
});
