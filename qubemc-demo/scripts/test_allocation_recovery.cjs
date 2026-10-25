// Browser regression with controlled transport failures and a representative saved-run fixture.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const fixture=JSON.parse(fs.readFileSync(process.env.TEST_RUN_FIXTURE,'utf8'));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const starts=[];let polls=0;
  await page.route('**/api/model/status',r=>r.fulfill({json:{configured:true,harness:'nemoclaw',discord:'nemoclaw'}}));
  await page.route('**/api/model/plan-start',r=>{
   starts.push(r.request().postDataJSON().runId);
   return starts.length===1?r.fulfill({status:502,contentType:'text/html',body:'Gateway response lost'}):r.fulfill({status:202,json:{runId:starts[0],status:'running'}});
  });
  await page.route('**/api/model/plan-status',r=>{
   const id=r.request().postDataJSON().runId;assert.equal(id,starts[0]);polls++;
   return r.fulfill({json:polls<4?{runId:id,status:'running'}:{runId:id,status:'complete',run:{...fixture,runId:id}}});
  });
  await page.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:5174');
  await page.getByRole('button',{name:'Show dashboard',exact:true}).first().click();
  await page.getByRole('button',{name:'Start project',exact:true}).click();
  await page.getByText(/unreadable response \(HTTP 502\)/).waitFor();
  const runId=new URL(page.url()).searchParams.get('run');assert.equal(runId,starts[0]);
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.waitForTimeout(500);assert.deepEqual(starts,[runId,runId]);
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('.app-shell')?.getAttribute('data-dashboard-stage')==='project',{}, {timeout:20000});
  assert.equal(new URL(page.url()).searchParams.get('run'),runId);assert.equal(starts.length,2);assert.ok(polls>=4);
  assert.deepEqual(errors,[]);
  console.log('PASS: lost/non-JSON acknowledgement -> actionable error -> Retry retains ID -> reload resumes polling -> completed project without another start.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
