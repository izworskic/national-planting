import { chromium } from 'playwright';

const url = 'https://chrisizworski.com/national-tools/planting/?browser_smoke=' + Date.now();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
const consoleErrors = [];
page.on('pageerror', err => errors.push(String(err.stack || err.message || err)));
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('requestfailed', req => errors.push(`REQUEST FAILED ${req.method()} ${req.url()} :: ${req.failure()?.errorText || ''}`));

try {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  console.log('PAGE', response?.status(), page.url());
  console.log('UI', await page.locator('body').getAttribute('data-planting-ui'));
  console.log('SCRIPT', await page.locator('script[src*="national-planting-page-v3.js"]').getAttribute('src'));
  await page.locator('#loc input').fill('48706');
  await page.locator('#loc button[type="submit"]').click();
  await page.waitForTimeout(1000);
  const status = (await page.locator('.status').textContent())?.trim();
  console.log('STATUS', status);
  try {
    await page.locator('#result:not([hidden])').waitFor({ state: 'visible', timeout: 30000 });
  } catch (e) {
    errors.push('RESULT DID NOT BECOME VISIBLE');
  }
  const answer = (await page.locator('#answer').textContent())?.trim();
  console.log('ANSWER', answer);
  console.log('PAGE_ERRORS', JSON.stringify(errors, null, 2));
  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors, null, 2));
  if (!answer || errors.length || consoleErrors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
