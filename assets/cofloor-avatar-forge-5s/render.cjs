const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),{once}=require('events');
let pw;try{pw=require('playwright')}catch{pw=require('/Users/selinahuang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
(async()=>{
 const browser=await pw.chromium.launch({headless:true,channel:'chrome',args:['--enable-webgl','--use-angle=metal','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1920,height:1180},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:8987/');await page.waitForFunction(()=>window.filmReady,{},{timeout:60000});
 await page.evaluate(()=>window.CoFloorAvatarForge.pause());
 if(errors.length)throw Error(errors.join('\n'));
 const preview=process.argv.includes('--preview');
 if(preview){
  for(const t of [.11,.69,1.61,2.03,2.67,3.14,3.75,4.17,4.94]){const jpg=await page.evaluate(t=>window.renderFrame(t),t);fs.writeFileSync(path.join(__dirname,'previews',`frame-${t}.jpg`),Buffer.from(jpg,'base64'))}
  console.log(JSON.stringify({previews:true,stats:await page.evaluate(()=>window.CoFloorAvatarForge.stats()),errors}));await browser.close();return;
 }
 const fps=30,total=5*fps,output=path.join(__dirname,'CoFloor-Avatar-Forge-5s-Silent.mp4');
 const ff=spawn(process.env.FFMPEG||'ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output]);
 let ffErrors='';ff.stderr.on('data',d=>ffErrors+=d);ff.stdin.on('error',e=>console.error(e));const done=once(ff,'close');
 for(let i=0;i<total;i++){const jpg=await page.evaluate(t=>window.renderFrame(t,.94),i/fps);if(!ff.stdin.write(Buffer.from(jpg,'base64')))await once(ff.stdin,'drain');if(i%30===0)console.log(JSON.stringify({frame:i,total,percent:Math.round(i/total*100)}))}
 ff.stdin.end();const [code]=await done;await browser.close();if(code!==0||errors.length)throw Error(ffErrors+' '+errors.join('\n'));console.log(JSON.stringify({done:true,path:output}));
})().catch(e=>{console.error(e);process.exit(1)});
