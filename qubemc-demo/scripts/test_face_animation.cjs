// Run against a built local server; recognition responses here are controlled UI fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5174';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  try {
    const page = await browser.newPage({ permissions: ['camera'] });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let mode = 'unknown', calls = 0, pending;
    const face = label => ({label, score: .9, box: [20,20,80,80]});
    // Never call real inference, speech, or Discord while exercising the UI.
    await page.route('**/api/**', r => r.abort());
    await page.route('**/api/face/status', r => r.fulfill({json:{ready:true,enrolled:{anne:1}}}));
    await page.route('**/api/face/recognize', async r => {
      calls++;
      if (mode === 'delayed') { pending = r; return; }
      await r.fulfill({json:{faces:mode==='multiple'?[face('unknown'),face('selina')]:mode==='unknown-group'?[face('unknown'),face('unknown')]:[face(mode)]}});
    });
    const open = () => page.goto(base + '/face-demo.html');
    const start = () => page.getByRole('button', {name:'Start camera',exact:true}).click();
    const frozen = async () => {
      await page.waitForFunction(()=>document.querySelector('#match-status').textContent==='Face recognized. Frame frozen.');
      assert.equal(await page.locator('#video').evaluate(v=>v.srcObject),null);
      assert.equal(await page.locator('#success-film').isVisible(),false);
      assert.equal(await page.locator('#success-film').getAttribute('src'),null);
    };
    const fullViewport = async () => {
      await page.locator('#success.is-playing').waitFor();
      assert.deepEqual(await page.locator('#success-film').evaluate(v=>{
        const r=v.getBoundingClientRect();return [r.x,r.y,r.width,r.height];
      }),[0,0,...Object.values(page.viewportSize())]);
      assert.equal(await page.locator('body').evaluate(b=>getComputedStyle(b).overflow),'hidden');
    };
    const returned = () => page.waitForURL(base + '/', {timeout:15000});

    await open();await start();
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('not recognized'));
    assert.equal(await page.locator('#success').isVisible(),false);
    await page.evaluate(()=>{window.cameraTracks=document.querySelector('#video').srcObject.getTracks();});
    mode='unknown-group';
    await page.waitForTimeout(1500);
    assert.ok(calls>=2,'group frame was analyzed');
    assert.equal(await page.locator('#success').isVisible(),false);
    mode='anne';await frozen();
    assert.equal(await page.getByRole('heading',{name:'Welcome, Anne'}).isVisible(),true);
    assert.ok(await page.evaluate(()=>window.cameraTracks.every(t=>t.readyState==='ended')));
    const frame=await page.locator('#canvas').evaluate(c=>c.toDataURL());
    const origin=await page.locator('#canvas').boundingBox();
    const afterMatch=calls;
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#canvas').evaluate(c=>c.toDataURL()),frame);
    assert.equal(await page.locator('#success-film').isVisible(),false);
    await fullViewport();
    assert.equal(await page.locator('#match-frame').evaluate(c=>c.toDataURL()),frame,'transition uses the recognized frame');
    const firstKeyframe=await page.locator('#match-frame').evaluate(c=>c.getAnimations()[0].effect.getKeyframes()[0]);
    for(const [property,value] of Object.entries({top:origin.y,left:origin.x,width:origin.width,height:origin.height}))
      assert.ok(Math.abs(parseFloat(firstKeyframe[property])-value)<.1,`expansion starts at the frame's ${property}`);
    await page.locator('#success-film').evaluate(v=>v.addEventListener('ended',()=>{
      sessionStorage.setItem('completedFilmDuration',String(v.duration));
    }));
    await page.locator('#success.is-revealed').waitFor();
    await page.waitForTimeout(450);
    assert.equal(await page.locator('#match-frame').evaluate(c=>getComputedStyle(c).opacity),'0');
    if(process.env.TEST_SCREENSHOT_DIR)await page.screenshot({path:require('node:path').join(process.env.TEST_SCREENSHOT_DIR,'cofloor-face-animation.png')});
    await returned();
    assert.equal(Math.round(Number(await page.evaluate(()=>sessionStorage.getItem('completedFilmDuration')))),5);
    assert.equal(calls,afterMatch,'matching stops all further scans');

    // Every trained identity, and a teammate among unknown faces, must complete the transition.
    for(const label of ['max','selina','multiple']){
      mode=label;await open();await start();await frozen();
      assert.equal(await page.locator('#match-title').textContent(),`Welcome, ${label==='max'?'Max':'Selina'}`);
      await fullViewport();await page.locator('#success.is-revealed').waitFor();await returned();
    }

    await open();mode='delayed';await start();
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='Camera started');
    for(let attempt=0;!pending&&attempt<200;attempt++) await page.waitForTimeout(30);
    assert.ok(pending,'camera issued the delayed recognition request');
    await page.getByRole('button',{name:'Stop camera',exact:true}).click();
    await pending.fulfill({json:{faces:[face('anne')]}}).catch(()=>{});
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('#success').isVisible(),false);
    assert.equal(await page.locator('#status').textContent(),'Camera stopped');

    await page.emulateMedia({reducedMotion:'reduce'});mode='anne';await start();
    await frozen();await returned();

    await page.emulateMedia({reducedMotion:'no-preference'});
    await open();
    await page.route('**/avatar-forge/success.*',r=>r.abort());
    await start();await frozen();await returned();
    await page.unroute('**/avatar-forge/success.*');

    // A rejected play() promise must also return, even without a media error event.
    await open();
    await page.locator('#success-film').evaluate(v=>{v.play=()=>Promise.reject(new Error('Playback unavailable'));});
    await start();await frozen();await returned();

    // A stalled request must not leave the visitor trapped in the overlay.
    await open();
    await page.route('**/avatar-forge/success.*',()=>{});
    await start();await frozen();await fullViewport();await returned();
    await page.unroute('**/avatar-forge/success.*');

    // Upload follows the same workflow, including the full mobile viewport.
    await page.setViewportSize({width:390,height:844});await open();
    const photo=await page.evaluate(()=>{
      const c=document.createElement('canvas');c.width=320;c.height=240;
      c.getContext('2d').fillRect(0,0,320,240);return c.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#upload').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});
    await frozen();await fullViewport();await returned();
    assert.deepEqual(errors,[]);
    console.log('PASS: unknown-only rejection, all three teammates and mixed groups, exact frame freeze, expansion from the recognized frame into full-screen video, crossfade, camera release, full desktop/mobile viewport, actual five-second playback and automatic main-page return, no repeated scans, stale response ignored, reduced motion, failed/rejected/stalled video, photo upload.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
