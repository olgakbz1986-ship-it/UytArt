import { chromium } from 'playwright-core';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto('http://localhost:3000/#/auth', { waitUntil: 'networkidle' });
// do OTP via API in page context so cookies land in this browser context
const res = await page.evaluate(async () => {
  const s = await fetch('/api/admin/login/start', { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: 'admin@starttechpro.ru' }) }).then(r=>r.json());
  if (!s.devCode) return { err: 'no devCode', s };
  const v = await fetch('/api/admin/login/verify', { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: 'admin@starttechpro.ru', code: s.devCode }) }).then(r=>r.json());
  return { ok: v.ok, profile: !!v.profile };
});
console.log('login:', JSON.stringify(res));
await page.goto('http://localhost:3000/#/admin', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log(await page.evaluate(() => document.body.innerText.slice(0, 200)));
// dump sidebar links
console.log(await page.evaluate(() => Array.from(document.querySelectorAll('aside a')).map(a => a.getAttribute('href')).join(' ')));
await ctx.storageState({ path: '/tmp/qf-state.json' });
await browser.close();
