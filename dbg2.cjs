const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const p = await ctx.newPage();
 await p.goto('http://127.0.0.1:5172/pdftest.html'); await p.click('#multi'); await p.waitForSelector('[role=dialog] canvas'); await new Promise(r=>setTimeout(r,1000));
 console.log(await p.locator('[role=dialog] button').evaluateAll((bs) => bs.filter((x) => x.offsetParent !== null).map((x) => { const r = x.getBoundingClientRect(); return `${x.getAttribute('aria-label')}: ${Math.round(r.width)}x${Math.round(r.height)} right=${Math.round(r.right)}`; })));
 await p.screenshot({ path: 'phone-preview.png' }); await b.close(); })();
