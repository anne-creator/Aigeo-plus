// Run against a built local server; recognition responses here are controlled UI fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  try {
    const page = await browser.newPage({ permissions: ['camera'] });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let mode = 'unknown', calls = 0, pending;
    const face = label => ({label, score: .9, box: [20,20,80,80]});
    await page.route('**/api/face/status', r => r.fulfill({json:{ready:true,enrolled:{anne:1}}}));
    await page.route('**/api/face/recognize', async r => {
      calls++;
      if (mode === 'delayed') { pending = r; return; }
      await r.fulfill({json:{faces:mode==='multiple'?[face('anne'),face('unknown')]:[face(mode)]}});
    });
    await page.goto((process.env.TEST_BASE_URL || 'http://127.0.0.1:5174') + '/face-demo.html');
    await page.getByRole('button', {name:'Start camera',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('not recognized'));
    assert.equal(await page.locator('#success').isVisible(),false);
    mode='multiple';
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Multiple faces'));
    assert.equal(await page.locator('#success').isVisible(),false);
    mode='anne';
    await page.getByRole('heading',{name:'Welcome, Anne'}).waitFor();
    assert.equal(await page.locator('#video').evaluate(v=>v.srcObject),null);
    await page.waitForFunction(()=>document.querySelector('#success-film').ended,{},{timeout:15000});
    assert.equal(await page.locator('#success-film').evaluate(v=>Math.round(v.duration)),5);
    const afterMatch=calls;await page.waitForTimeout(1500);assert.equal(calls,afterMatch);
    await page.getByRole('button',{name:'Scan again'}).click();
    mode='delayed';await page.getByRole('button',{name:'Start camera',exact:true}).click();
    for(let attempt=0;!pending&&attempt<200;attempt++) await page.waitForTimeout(30);
    assert.ok(pending,'camera issued the delayed recognition request');
    await page.getByRole('button',{name:'Stop camera',exact:true}).click();
    await pending.fulfill({json:{faces:[face('anne')]}}).catch(()=>{});
    await page.waitForTimeout(300);assert.equal(await page.locator('#success').isVisible(),false);
    assert.equal(await page.locator('#status').textContent(),'Camera stopped');
    await page.emulateMedia({reducedMotion:'reduce'});mode='anne';
    await page.getByRole('button',{name:'Start camera',exact:true}).click();
    await page.getByRole('heading',{name:'Welcome, Anne'}).waitFor();
    assert.equal(await page.locator('#success-film').isVisible(),false);
    assert.match(await page.locator('#match-status').textContent(),/Match complete/);
    await page.getByRole('button',{name:'Scan again'}).click();
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.route('**/avatar-forge/success.*',r=>r.abort());
    await page.getByRole('button',{name:'Start camera',exact:true}).click();
    await page.getByRole('heading',{name:'Welcome, Anne'}).waitFor();
    await page.waitForFunction(()=>document.querySelector('#match-status').textContent.startsWith('Match complete'));
    assert.equal(await page.getByRole('link',{name:'Continue to dashboard'}).isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: unknown/group rejection, real video playback, camera release, no repeated scans, stale response ignored, rescan, reduced motion, failed-video fallback.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
