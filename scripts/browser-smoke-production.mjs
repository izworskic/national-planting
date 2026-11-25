import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { readPlantingContract, isMeasurementHost } from './planting-smoke-contract.mjs';

const origin='https://chrisizworski.com/national-tools/planting/';
const expected=readPlantingContract(readFileSync(new URL('../public/national-tools/planting/index.html',import.meta.url),'utf8'));
const cases=[
  {name:'desktop',context:{viewport:{width:1280,height:720}}},
  {name:'mobile',context:{viewport:{width:412,height:915},userAgent:'Mozilla/5.0 (Linux; Android 17; Pixel 10 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',isMobile:true,hasTouch:true}}
];
const browser=await chromium.launch({headless:true});
let failed=false;
try {
  for (const testCase of cases) {
    const context=await browser.newContext(testCase.context);
    // Never generate ad impressions or analytics events from a synthetic visit.
    // This monitor verifies the visitor answer, not ad delivery.
    await context.route('**/*',route=>isMeasurementHost(new URL(route.request().url()).hostname)?route.abort():route.continue());
    const page=await context.newPage();
    const errors=[];
    let runtimeLoaded=false;
    page.on('pageerror',err=>errors.push(String(err.message||err)));
    page.on('requestfailed',req=>{
      const url=new URL(req.url());
      if(!isMeasurementHost(url.hostname))errors.push('Request failed: '+req.method()+' '+url.origin+url.pathname+' '+(req.failure()?.errorText||''));
    });
    page.on('response',response=>{
      const url=new URL(response.url());
      if(url.origin===new URL(origin).origin && url.pathname+url.search===expected.script && response.ok())runtimeLoaded=true;
      if(url.origin===new URL(origin).origin && response.status()>=400)errors.push('HTTP '+response.status()+' '+url.pathname);
    });
    try {
      const response=await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});
      if(response?.status()!==200 || page.url()!==origin)throw new Error('Canonical page did not return HTTP 200');
      const ui=await page.locator('body').getAttribute('data-planting-ui');
      const script=await page.locator('script[src*="national-planting-page-v3.js"]').getAttribute('src');
      if(ui!==expected.ui || script!==expected.script || !runtimeLoaded)throw new Error('Canonical runtime does not match owning source: '+ui+' '+script);
      await page.locator('#loc input').fill('48706');
      await page.locator('#loc button[type="submit"]').click();
      await page.locator('#result:not([hidden])').waitFor({state:'visible',timeout:30000});
      await page.waitForFunction(()=>/48706|Bay City/i.test(document.querySelector('#answer')?.textContent||''),{},{timeout:30000});
      const answer=(await page.locator('#answer').textContent())?.trim();
      console.log(testCase.name.toUpperCase(),'ANSWER',answer);
    } catch(error) {errors.push(String(error.message||error));}
    finally {
      console.log(testCase.name.toUpperCase(),'ERRORS',JSON.stringify(errors));
      if(errors.length)failed=true;
      await context.close();
    }
  }
} finally {await browser.close();}
if(failed)process.exit(1);
