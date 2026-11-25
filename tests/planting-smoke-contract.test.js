const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('production smoke derives exact UI and cache version from owner HTML',async()=>{
 const {readPlantingContract}=await import('../scripts/planting-smoke-contract.mjs');
 const html=fs.readFileSync(path.join(__dirname,'../public/national-tools/planting/index.html'),'utf8');
 const contract=readPlantingContract(html);
 assert.match(contract.script,/^\/assets\/national-planting-page-v3\.js\?v=.+/);
 assert.deepEqual(readPlantingContract('<body data-planting-ui="next"><script src="/assets/national-planting-page-v3.js?v=future"></script>'),{ui:'next',script:'/assets/national-planting-page-v3.js?v=future'});
 assert.throws(()=>readPlantingContract('<body data-planting-ui="next">'));
});
test('measurement isolation does not block application hosts or deceptive suffixes',async()=>{
 const {isMeasurementHost}=await import('../scripts/planting-smoke-contract.mjs');
 for(const host of ['analytics.google.com','www.google-analytics.com','pagead2.googlesyndication.com','www.googletagmanager.com','ad.doubleclick.net'])assert.equal(isMeasurementHost(host),true);
 for(const host of ['chrisizworski.com','national-planting.vercel.app','google-analytics.com.example.com'])assert.equal(isMeasurementHost(host),false);
});
