import { chromium } from 'playwright';

const origin='https://chrisizworski.com/national-tools/planting/';
const cases=[
  {name:'desktop',context:{}},
  {name:'mobile',context:{viewport:{width:412,height:915},userAgent:'Mozilla/5.0 (Linux; Android 17; Pixel 10 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',isMobile:true,hasTouch:true}}
];

const browser=await chromium.launch({headless:true});
let failed=false;
try{
  for(const testCase of cases){
    const context=await browser.newContext(testCase.context);
    const page=await context.newPage();
    const errors=[];
    const consoleErrors=[];
    page.on('pageerror',err=>errors.push(String(err.stack||err.message||err)));
    page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
    page.on('requestfailed',req=>errors.push(`REQUEST FAILED ${req.method()} ${req.url()} :: ${req.failure()?.errorText||''}`));
    try{
      const url=origin+'?browser_smoke='+Date.now()+'-'+testCase.name;
      const response=await page.goto(url,{waitUntil:'networkidle',timeout:60000});
      const ui=await page.locator('body').getAttribute('data-planting-ui');
      const script=await page.locator('script[src*="national-planting-page-v3.js"]').getAttribute('src');
      console.log(testCase.name.toUpperCase(),'PAGE',response?.status(),page.url());
      console.log(testCase.name.toUpperCase(),'UI',ui);
      console.log(testCase.name.toUpperCase(),'SCRIPT',script);
      if(ui!=='v3.4')errors.push(`unexpected UI ${ui}`);
      if(!script?.includes('v=20260903-v35'))errors.push(`production is not serving v35 runtime: ${script}`);
      await page.locator('#loc input').fill('48706');
      await page.locator('#loc button[type="submit"]').click();
      await page.locator('#result:not([hidden])').waitFor({state:'visible',timeout:30000}).catch(()=>errors.push('RESULT DID NOT BECOME VISIBLE'));
      const status=(await page.locator('.status').textContent())?.trim();
      const answer=(await page.locator('#answer').textContent())?.trim();
      console.log(testCase.name.toUpperCase(),'STATUS',status);
      console.log(testCase.name.toUpperCase(),'ANSWER',answer);
      console.log(testCase.name.toUpperCase(),'PAGE_ERRORS',JSON.stringify(errors,null,2));
      console.log(testCase.name.toUpperCase(),'CONSOLE_ERRORS',JSON.stringify(consoleErrors,null,2));
      if(!answer||errors.length||consoleErrors.length)failed=true;
    }finally{
      await context.close();
    }
  }
}finally{
  await browser.close();
}
if(failed)process.exit(1);
