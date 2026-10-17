import { chromium } from 'playwright-core';
import fs from 'fs';
const cookieRaw = fs.readFileSync('/tmp/qf-cookies.txt', 'utf8');
const cookies = [];
for (const line of cookieRaw.split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const p = t.split('\t'); if (p.length < 7) continue;
  cookies.push({ name: p[5], value: p[6], domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' });
}
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addCookies(cookies);
const page = await ctx.newPage();
page.on('console', m => console.log('[browser]', m.text().slice(0,120)));
await page.goto('http://localhost:3000/#/admin', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
console.log(await page.evaluate(() => document.body.innerText.slice(0, 400)));
await browser.close();
