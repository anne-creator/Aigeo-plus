const fs=require('fs'),path=require('path'),assert=require('assert');
let pw;try{pw=require('playwright')}catch{pw=require('/Users/selinahuang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
(async()=>{
 const browser=await pw.chromium.launch({headless:true,channel:'chrome',args:['--enable-webgl','--use-angle=metal']}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:8987/');await page.waitForFunction(()=>window.filmReady);await page.evaluate(()=>window.CoFloorAvatarForge.pause());
 const deterministic=await page.evaluate(()=>{const a=window.renderFrame(1.72);window.renderFrame(4.72);const b=window.renderFrame(1.72);return a===b});assert(deterministic,'Seeking must reproduce exactly the same frame');
 await page.locator('#replay').click();await page.waitForFunction(()=>window.CoFloorAvatarForge.currentTime>.3);assert(await page.evaluate(()=>window.CoFloorAvatarForge.playing));
 await page.locator('#play').click();const paused=await page.evaluate(()=>window.CoFloorAvatarForge.currentTime);await page.waitForTimeout(160);assert.strictEqual(await page.evaluate(()=>window.CoFloorAvatarForge.currentTime),paused);
 await page.locator('#seek').fill('2.92');assert.strictEqual(await page.evaluate(()=>window.CoFloorAvatarForge.currentTime),2.92);
 await page.locator('#sound').click();assert.strictEqual(await page.locator('#sound').getAttribute('aria-pressed'),'true');await page.locator('#sound').click();
 await page.evaluate(()=>{window.readyCount=0;window.addEventListener('cofloor:avatar-ready',()=>window.readyCount++);window.CoFloorAvatarForge.seek(4.8);window.CoFloorAvatarForge.play()});
 await page.waitForFunction(()=>window.CoFloorAvatarForge.currentTime===5);assert.strictEqual(await page.evaluate(()=>window.readyCount),1);assert.strictEqual(await page.evaluate(()=>window.CoFloorAvatarForge.playing),false);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile horizontal overflow');await page.screenshot({path:path.join(__dirname,'previews','mobile.png')});
 const reduced=await browser.newPage({reducedMotion:'reduce',viewport:{width:1440,height:950}});await reduced.goto('http://127.0.0.1:8987/');await reduced.waitForFunction(()=>window.filmReady);assert.strictEqual(await reduced.evaluate(()=>window.CoFloorAvatarForge.playing),false);assert.strictEqual(await reduced.evaluate(()=>window.CoFloorAvatarForge.currentTime),5);
 const report={passed:true,deterministicSeeking:true,replay:true,pause:true,seek:true,soundToggle:true,endEventOnce:true,mobileNoOverflow:true,reducedMotion:true,externalRequests:requests.filter(u=>!u.startsWith('http://127.0.0.1:8987/')&&!u.startsWith('data:')),errors,stats:await page.evaluate(()=>window.CoFloorAvatarForge.stats())};assert.strictEqual(report.externalRequests.length,0);assert.strictEqual(errors.length,0);
 fs.writeFileSync(path.join(__dirname,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
