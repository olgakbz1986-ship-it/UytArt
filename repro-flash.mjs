import { chromium } from 'playwright-core';
import fs from 'fs';

const cookieRaw = fs.readFileSync('/tmp/qf-cookies.txt', 'utf8');
// parse netscape cookie file
const cookies = [];
for (const line of cookieRaw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const p = t.split('\t');
  if (p.length < 7) continue;
  cookies.push({ name: p[5], value: p[6], domain: p[0].replace(/^\./,''), path: p[1] || '/', secure: p[3]==='TRUE', httpOnly: true, sameSite: 'Lax' });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addCookies(cookies.map(c => ({ ...c, domain: 'localhost', path: '/' })));
const page = await ctx.newPage();

// instrumentation: log every route render + hash changes
await page.addInitScript(() => {
  window.__log = [];
  window.addEventListener('hashchange', (e) => {
    window.__log.push({ ev: 'hashchange', from: e.oldURL, to: e.newURL, t: performance.now() });
  });
  // MutationObserver on #root subtree to catch content swaps
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          const txt = (n.textContent || '').slice(0, 40).replace(/\s+/g, ' ');
          window.__log.push({ ev: 'dom-add', tag: n.tagName, cls: (n.className||'').toString().slice(0,60), txt, t: performance.now() });
        }
      }
    }
  });
  document.addEventListener('DOMContentLoaded', () => obs.observe(document.getElementById('root'), { childList: true, subtree: true }));
});

await page.goto('http://localhost:3000/#/admin', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const segs = ['users','sellers','catalog','orders','finance','disputes','support','security','content','analytics','releases','settings','logs'];
let flashFound = null;
for (const s of segs) {
  // click the nav link in sidebar
  const link = page.locator(`aside a[href="#/admin/${s}"]`);
  if (!(await link.count())) { console.log('no link for', s); continue; }
  await page.evaluate(() => { window.__log.length = 0; });
  await link.click();
  // sample the main heading immediately and after settle
  const early = await page.evaluate(() => {
    const h = document.querySelector('main h3, main h2');
    return { title: h ? h.textContent.slice(0,50) : null, log: window.__log };
  });
  await page.waitForTimeout(1200);
  const late = await page.evaluate(() => {
    const h = document.querySelector('main h3, main h2');
    return h ? h.textContent.slice(0,50) : null;
  });
  const events = early.log.filter(e => e.ev !== 'dom-add').length;
  const domAdds = early.log.filter(e => e.ev === 'dom-add');
  console.log(`== ${s}: early="${early.title}" late="${late}" hashchanges=${events} domAdds=${domAdds.length}`);
  if (early.title && late && early.title !== late) {
    console.log('   >>> FLASH DETECTED during switch to', s);
    console.log('   dom adds:', JSON.stringify(domAdds.slice(0, 10), null, 1));
    flashFound = s;
  }
}
console.log('RESULT:', flashFound ? 'FLASH on ' + flashFound : 'no flash detected in this run');
await browser.close();
