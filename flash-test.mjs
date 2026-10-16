import { chromium } from 'playwright-core';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: '/tmp/qf-state.json' });
const page = await ctx.newPage();

// instrument BEFORE app loads: record every distinct "main content" text snapshot with timestamp
await page.addInitScript(() => {
  window.__snaps = [];
  window.__navLog = [];
  const snap = (why) => {
    const main = document.querySelector('main');
    if (!main) return;
    const h = main.querySelector('h1,h2,h3,h4');
    window.__snaps.push({ t: Math.round(performance.now()), why, txt: (h ? h.textContent : main.textContent || '').replace(/\s+/g,' ').slice(0, 60) });
  };
  // poll every animation frame batch: use interval 50ms — enough to catch ~1s flashes
  setInterval(() => snap('poll'), 50);
  window.addEventListener('hashchange', () => { window.__navLog.push({ t: Math.round(performance.now()), hash: location.hash }); snap('hash'); });
});

await page.goto('http://localhost:3000/#/admin', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const segs = ['users','sellers','catalog','orders','finance','disputes','support','security','content','analytics','releases','settings','logs'];
let flashes = 0;
for (let round = 0; round < 2; round++) {
  for (const s of segs) {
    await page.evaluate(() => { window.__snaps.length = 0; window.__navLog.length = 0; });
    await page.click(`aside a[href="#/admin/${s}"]`);
    await page.waitForTimeout(1800);
    const { snaps, nav } = await page.evaluate(() => ({ snaps: window.__snaps, nav: window.__navLog }));
    // collapse consecutive duplicates
    const seq = [];
    for (const sn of snaps) { if (!seq.length || seq[seq.length-1].txt !== sn.txt) seq.push(sn); }
    const expected = nav[nav.length-1]?.hash || '';
    // a flash = an intermediate state that is not the final one and appears briefly
    if (seq.length >= 3 && seq[seq.length-1] && seq[0]) {
      const mid = seq.slice(1, -1).filter(x => x.txt !== seq[seq.length-1].txt && x.txt !== 'Loading… ');
      const realMid = mid.filter(x => !/^(Главная|Индекс здоровья)/.test('') && x.txt.length > 0 && !x.txt.startsWith('Loading'));
      if (realMid.length) {
        flashes++;
        console.log(`FLASH switching to ${s}: ` + seq.map(x=>`[${x.t}ms "${x.txt}"]`).join(' -> '));
      } else {
        console.log(`ok   ${s}: ` + seq.map(x=>`[${x.t}ms "${x.txt.slice(0,30)}"]`).join(' -> '));
      }
    } else {
      console.log(`ok   ${s}: ` + seq.map(x=>`[${x.t}ms "${x.txt.slice(0,30)}"]`).join(' -> '));
    }
  }
}
console.log('TOTAL FLASHES:', flashes);
await browser.close();
