import { chromium } from 'playwright';
import fs from 'node:fs';

const credential = process.env.VERCEL_MAGIC_URL;
const deviceUrl = process.env.DEVICE_URL;
if (!credential || !deviceUrl) throw new Error('Missing VERCEL_MAGIC_URL/code or DEVICE_URL');

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({storageState:'storage-state.json'});
const page = await context.newPage();

if (/^https:\/\//i.test(credential)) {
  await page.goto(credential, {waitUntil:'domcontentloaded', timeout:120000});
  await page.waitForTimeout(4000);
  fs.writeFileSync('magic-page.txt', await page.locator('body').innerText().catch(()=>''));
}

await page.goto(deviceUrl, {waitUntil:'domcontentloaded', timeout:120000});
await page.waitForTimeout(2500);

if (!/^https:\/\//i.test(credential)) {
  const code = credential.trim();
  const inputs = page.locator('input:visible');
  const count = await inputs.count();
  if (count >= code.length && code.length <= 8) {
    for (let i = 0; i < code.length; i++) {
      await inputs.nth(i).fill(code[i]);
    }
  } else if (count > 0) {
    await inputs.last().fill(code);
  } else {
    throw new Error('Verification code input not found');
  }

  const submitPatterns = [/continue/i,/verify/i,/log in/i,/sign in/i,/submit/i,/confirm/i];
  let submitted = false;
  for (const rx of submitPatterns) {
    const btn = page.getByRole('button').filter({hasText:rx}).first();
    if (await btn.count() && await btn.isVisible().catch(()=>false)) {
      await btn.click();
      submitted = true;
      break;
    }
  }
  if (!submitted && count > 0) await inputs.last().press('Enter');
  await page.waitForTimeout(5000);
}

for (let round=0; round<6; round++) {
  const body = (await page.locator('body').innerText().catch(()=>'')) || '';
  fs.writeFileSync(`device-page-${round}.txt`, body);
  const candidates = [/authorize/i,/approve/i,/confirm/i,/allow/i,/continue/i,/accept/i,/grant/i];
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
