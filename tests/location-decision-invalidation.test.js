const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync("public/assets/national-planting-page-v3.js",'utf8');
test('A new lookup retires prior decision before awaiting the location and ignores superseded decision responses',()=>{
 assert.match(source,/form.addEventListener\("submit",invalidateDecision,true\)/);
 assert.match(source,/\[data-use-location\],\[data-place-switch\]/);
 assert.match(source,/function invalidateDecision\(\)[\s\S]*?hidden=true/);
 assert.match(source,/if\(ticket!==decisionGeneration\)return/);
});
