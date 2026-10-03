import { chromium } from 'playwright';
import fs from 'node:fs';

const deviceUrl = process.env.DEVICE_URL;
const email = process.env.VERCEL_EMAIL;
if (!deviceUrl || !email) throw new Error('Missing DEVICE_URL or VERCEL_EMAIL');

const browser = await chromium.launch({headless:true});
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(deviceUrl, {waitUntil:'domcontentloaded', timeout:120000});
await page.waitForTimeout(3000);
fs.writeFileSync('auth-page-before.txt', await page.locator('body').innerText().catch(()=>'')); 

let emailInput = page.locator('input[type="email"]');
if (await emailInput.count() === 0) {
  emailInput = page.locator('input').first();
}
if (await emailInput.count() === 0) throw new Error('Email input not found on Vercel device page');
await emailInput.first().fill(email);

const buttons = page.getByRole('button');
let clicked = false;
for (const rx of [/continue with email/i,/continue/i,/send/i,/email/i]) {
  const b = buttons.filter({hasText:rx}).first();
  if (await b.count() && await b.isVisible().catch(()=>false)) {
    await b.click();
    clicked = true;
    break;
  }
}
if (!clicked) {
  await emailInput.first().press('Enter');
}
await page.waitForTimeout(5000);
fs.writeFileSync('auth-page-after.txt', await page.locator('body').innerText().catch(()=>'')); 
const sessionState = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage))).catch(()=>({}));
fs.writeFileSync('session-storage.json', JSON.stringify(sessionState));
await context.storageState({path:'storage-state.json'});
await page.screenshot({path:'auth-page-after.png', fullPage:true}).catch(()=>{});
await browser.close();
