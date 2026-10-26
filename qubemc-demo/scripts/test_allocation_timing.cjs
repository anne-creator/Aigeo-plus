const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{
 const fixture=JSON.parse(fs.readFileSync(process.env.TEST_RUN_FIXTURE,'utf8'));
 const browser=await chromium.launch({headless:true,...(process.env.TEST_CHROMIUM?{executablePath:process.env.TEST_CHROMIUM}:{})});
 try{
  for(const delay of [0,6500]){
   const page=await browser.newPage({reducedMotion:'no-preference'});const errors=[];let arrived=0;
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/model/status',r=>r.fulfill({json:{configured:true,harness:'nemoclaw',discord:'nemoclaw'}}));
   await page.route('**/api/model/plan-start',async r=>{
    const id=r.request().postDataJSON().runId;
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    arrived=Date.now();await r.fulfill({status:202,json:{status:'complete',runId:id,run:{...fixture,runId:id}}});
   });
   await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5174');
   await page.getByRole('button',{name:'Show dashboard',exact:true}).first().click();
   const started=Date.now();await page.getByRole('button',{name:'Start project',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.allocation-art')?.getAttribute('data-animation')==='playing');
   await page.waitForTimeout(4000);
   assert.equal(await page.locator('.app-shell').getAttribute('data-dashboard-stage'),'assigning');
   assert.ok(await page.locator('.allocation-art video').evaluate(v=>!v.paused&&v.currentTime>0));
   if(!delay)await page.getByRole('heading',{name:'Your team is ready'}).waitFor();
   await page.waitForFunction(()=>document.querySelector('.app-shell')?.getAttribute('data-dashboard-stage')!=='assigning');
   const revealed=Date.now();assert.ok(revealed-started>=4900);
   if(delay)assert.ok(revealed-arrived<1200,'slow results should reveal without another five-second wait');
   assert.deepEqual(errors,[]);console.log(JSON.stringify({delayMs:delay,allocationScreenMs:revealed-started,afterResultMs:revealed-arrived,normalMotion:true}));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
