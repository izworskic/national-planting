import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const origin='https://chrisizworski.com/national-tools/planting/';
const expectedHtml=readFileSync(new URL('../public/national-tools/planting/index.html',import.meta.url),'utf8');
const expectedUi=expectedHtml.match(/data-planting-ui="([^"]+)"/)?.[1];
const expectedScript=expectedHtml.match(/<script src="(\/assets\/national-planting-page-v3\.js\?v=[^"]+)"/)?.[1];
assert.ok(expectedUi && expectedScript,'owner HTML must declare a versioned runtime');
const cases=[
  {name:'desktop',context:{}},
  {name:'mobile',context:{viewport:{width:412,height:915},userAgent:'Mozilla/5.0 (Linux; Android 17; Pixel 10 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',isMobile:true,hasTouch:true}}
];
// Synthetic browser tests must not generate ad impressions or analytics traffic.
// Only recognized advertising/analytics domains are intercepted; all product
// code, public APIs, source assets and other network requests remain live.
const telemetryHosts=['googletagmanager.com','google-analytics.com','analytics.google.com','googlesyndication.com','doubleclick.net','googleadservices.com'];
const telemetry=url=>{const host=new URL(url).hostname;return telemetryHosts.some(h=>host===h||host.endsWith('.'+h));};
const browser=await chromium.launch({headless:true});
let failed=false;
try{
  for(const testCase of cases){
    const context=await browser.newContext(testCase.context);
    await context.route('**/*',route=>telemetry(route.request().url())?route.fulfill({status:200,contentType:route.request().resourceType()==='script'?'application/javascript':'text/plain',body:''}):route.continue());
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',err=>errors.push(String(err.stack||err.message||err)));
    page.on('console',msg=>{if(msg.type()==='error')errors.push('CONSOLE '+msg.text());});
    page.on('requestfailed',req=>{if(!telemetry(req.url()))errors.push('REQUEST FAILED '+req.method()+' '+new URL(req.url()).pathname+' :: '+(req.failure()?.errorText||''));});
    try{
      // Exact canonical URL; wait on the actual visitor interaction, not global network idle.
      const response=await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});
      assert.equal(response?.status(),200);
      assert.equal(page.url(),origin);
      assert.equal(await page.locator('body').getAttribute('data-planting-ui'),expectedUi);
      assert.equal(await page.locator('script[src*="national-planting-page-v3.js"]').getAttribute('src'),expectedScript);
      const submit=page.locator('#loc button[type="submit"]');
      await page.locator('#loc input').fill('48706');
      const geocode=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/national-geocode'&&new URL(r.url()).searchParams.get('q')==='48706'&&r.ok(),{timeout:30000});
      const frost=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/national-frost'&&r.ok(),{timeout:30000});
      await Promise.all([geocode,frost,submit.click()]);
      await page.locator('#result:not([hidden])').waitFor({state:'visible',timeout:30000});
      await page.waitForFunction(()=>/Planting window near 48706/.test(document.querySelector('#answer')?.textContent||''),{},{timeout:30000});
      await page.waitForFunction(()=>!document.querySelector('#loc button[type="submit"]')?.disabled,{},{timeout:30000});
      assert.equal(errors.length,0,errors.join('\n'));
      console.log(testCase.name.toUpperCase(),'PASS',expectedUi,expectedScript,await page.locator('#answer').textContent());
    }catch(error){
      failed=true;
      console.error(testCase.name.toUpperCase(),'FAIL',error.message,JSON.stringify(errors));
    }finally{
      await context.close();
    }
  }
}finally{
  await browser.close();
}
if(failed)process.exit(1);
