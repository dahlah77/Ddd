import { chromium } from 'playwright';
import fs from 'node:fs';

const magicUrl = process.env.VERCEL_MAGIC_URL;
const deviceUrl = process.env.DEVICE_URL;
if (!magicUrl || !deviceUrl) throw new Error('Missing VERCEL_MAGIC_URL or DEVICE_URL');

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({storageState:'storage-state.json'});
const page = await context.newPage();

await page.goto(magicUrl, {waitUntil:'domcontentloaded', timeout:120000});
await page.waitForTimeout(5000);
fs.writeFileSync('magic-page.txt', await page.locator('body').innerText().catch(()=>'')); 

await page.goto(deviceUrl, {waitUntil:'domcontentloaded', timeout:120000});
await page.waitForTimeout(4000);

for (let round=0; round<4; round++) {
  const body = (await page.locator('body').innerText().catch(()=>'')) || '';
  fs.writeFileSync(`device-page-${round}.txt`, body);
  const candidates = [/authorize/i,/approve/i,/confirm/i,/allow/i,/continue/i,/accept/i];
  let did = false;
  for (const rx of candidates) {
    const btn = page.getByRole('button').filter({hasText:rx}).first();
    if (await btn.count() && await btn.isVisible().catch(()=>false)) {
      await btn.click();
      await page.waitForTimeout(3500);
      did = true;
      break;
    }
    const link = page.getByRole('link').filter({hasText:rx}).first();
    if (await link.count() && await link.isVisible().catch(()=>false)) {
      await link.click();
      await page.waitForTimeout(3500);
      did = true;
      break;
    }
  }
  if (!did) break;
}
await page.screenshot({path:'device-page-final.png', fullPage:true}).catch(()=>{});
await context.storageState({path:'storage-state-final.json'});
await browser.close();
