import { chromium } from 'playwright';
import fs from 'node:fs';
import { privateDecrypt, constants } from 'node:crypto';

const need = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
};

const deviceUrl = need('DEVICE_URL');
const email = need('VERCEL_EMAIL');
const repo = need('REPO_SLUG');
const authBranch = need('AUTH_BRANCH');
const runId = need('GITHUB_RUN_ID');
const token = need('GH_TOKEN');

const apiUrl = `https://api.github.com/repos/${repo}/contents/joki-pelaihari-v2-auth-${runId}.enc?ref=${encodeURIComponent(authBranch)}`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const snapshot = async (page, name) => {
  fs.writeFileSync(`${name}.txt`, await page.locator('body').innerText().catch(()=>'')); 
  await page.screenshot({path:`${name}.png`, fullPage:true}).catch(()=>{});
};

async function fetchEncryptedCode() {
  for (let i=0; i<420; i++) {
    const res = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Cache-Control': 'no-cache'
      }
    }).catch(()=>null);
    if (res && res.ok) {
      const data = await res.json();
      const encoded = String(data.content || '').replace(/\n/g,'');
      if (encoded) return Buffer.from(encoded, 'base64');
    }
    await sleep(2000);
  }
  throw new Error('Timed out waiting for encrypted Vercel email code');
}

const browser = await chromium.launch({headless:true});
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(deviceUrl, {waitUntil:'domcontentloaded', timeout:120000});
await sleep(1500);
await snapshot(page, 'device-start');

let emailInput = page.locator('input[type="email"]:visible').first();
if (await emailInput.count() === 0) emailInput = page.locator('input:visible').first();
if (await emailInput.count() === 0) throw new Error('Vercel email input not found');
await emailInput.fill(email);

let sent = false;
for (const rx of [/continue with email/i,/continue/i,/email/i]) {
  const b = page.getByRole('button').filter({hasText:rx}).first();
  if (await b.count() && await b.isVisible().catch(()=>false)) {
    await b.click();
    sent = true;
    break;
  }
}
if (!sent) await emailInput.press('Enter');

for (let i=0;i<30;i++) {
  const visibleInputs = page.locator('input:visible');
  if ((await visibleInputs.count()) >= 6) break;
  await sleep(500);
}
await snapshot(page, 'device-code-screen');

const encrypted = await fetchEncryptedCode();
const privateKey = fs.readFileSync('auth-private.pem');
const code = privateDecrypt({
  key: privateKey,
  oaepHash: 'sha256',
  padding: constants.RSA_PKCS1_OAEP_PADDING
}, encrypted).toString('utf8').trim();

if (!/^\d{6}$/.test(code)) throw new Error('Decrypted Vercel code is not six digits');

let inputs = page.locator('input:visible');
let count = await inputs.count();
if (count >= 6) {
  const start = count - 6;
  for (let i=0;i<6;i++) await inputs.nth(start+i).fill(code[i]);
} else if (count > 0) {
  await inputs.last().fill(code);
} else {
  throw new Error('Vercel verification code inputs disappeared');
}
await sleep(1500);

// Some Vercel login screens auto-submit; others require Enter/Continue.
let body = await page.locator('body').innerText().catch(()=>'');
if (/code|verification/i.test(body)) {
  const continueBtn = page.getByRole('button').filter({hasText:/verify|continue|log in|sign in|submit/i}).first();
  if (await continueBtn.count() && await continueBtn.isVisible().catch(()=>false)) {
    await continueBtn.click().catch(()=>{});
  } else {
    await page.keyboard.press('Enter').catch(()=>{});
  }
}
await sleep(3500);

for (let round=0; round<12; round++) {
  await snapshot(page, `device-after-code-${round}`);
  body = await page.locator('body').innerText().catch(()=>'');
  if (/success|authenticated|authorization complete|device authorized|you may close|logged in/i.test(body)) break;
  if (/invalid|expired|incorrect/i.test(body) && /code/i.test(body)) throw new Error(body);

  let clicked = false;
  for (const rx of [/authorize/i,/approve/i,/allow/i,/confirm/i,/continue/i,/accept/i,/grant/i]) {
    const btn = page.getByRole('button').filter({hasText:rx}).first();
    if (await btn.count() && await btn.isVisible().catch(()=>false)) {
      await btn.click();
      clicked = true;
      await sleep(2500);
      break;
    }
    const link = page.getByRole('link').filter({hasText:rx}).first();
    if (await link.count() && await link.isVisible().catch(()=>false)) {
      await link.click();
      clicked = true;
      await sleep(2500);
      break;
    }
  }
  if (!clicked) await sleep(1500);
}

await snapshot(page, 'device-final');
await context.storageState({path:'vercel-browser-state.json'});
await browser.close();
