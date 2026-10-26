const $=id=>document.getElementById(id);
const video=$('video'),canvas=$('canvas'),ctx=canvas.getContext('2d');
const status=$('status'),results=$('results'),start=$('start'),stop=$('stop'),upload=$('upload');
const success=$('success'),film=$('success-film'),frozenFrame=$('match-frame');
const names={anne:'Anne',max:'Max',selina:'Selina',unknown:'Unknown'};
let stream=null,timer=null,request=null,generation=0,matched=false,phase='scanning',freezeTimer=null,filmTimer=null,frameTransition=null;
const name=label=>names[label]||label;
const trainedLabels=new Set(['anne','max','selina']);
function stopCamera(){
  clearTimeout(timer);timer=null;stream?.getTracks().forEach(track=>track.stop());
  stream=null;video.srcObject=null;start.disabled=false;stop.disabled=true;
}
function cancel(){
  generation++;request?.abort();request=null;stopCamera();
}
function reset(){
  cancel();matched=false;phase='scanning';clearTimeout(freezeTimer);clearTimeout(filmTimer);film.pause();film.removeAttribute('src');film.load();
  frameTransition?.cancel();frameTransition=null;frozenFrame.hidden=true;
  success.hidden=true;success.classList.remove('is-playing','is-revealed');document.body.classList.remove('celebrating');
  $('match-status').textContent='';film.hidden=true;start.disabled=false;upload.disabled=false;results.replaceChildren();
}
function finishAnimation(){
  if(!matched||phase!=='animation')return;
  phase='returning';clearTimeout(filmTimer);film.pause();
  $('match-status').textContent='Returning to the main page…';
  window.location.replace('/');
}
async function playAnimation(version){
  if(version!==generation||!matched||phase!=='frozen')return;
  phase='animation';
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){finishAnimation();return;}
  const rect=canvas.getBoundingClientRect();
  frozenFrame.width=canvas.width;frozenFrame.height=canvas.height;
  frozenFrame.getContext('2d').drawImage(canvas,0,0);frozenFrame.hidden=false;
  success.classList.add('is-playing');document.body.classList.add('celebrating');film.hidden=false;
  $('match-status').textContent='Face matched. Playing your welcome animation…';
  // Also return if loading stalls or the browser cannot play the supplied film.
  filmTimer=setTimeout(finishAnimation,12000);
  try{
    // Expand the actual recognized pixels from their original on-screen position.
    frameTransition=frozenFrame.animate([
      {top:`${rect.top}px`,left:`${rect.left}px`,width:`${rect.width}px`,height:`${rect.height}px`,borderRadius:'16px'},
      {top:'0px',left:'0px',width:'100vw',height:'100dvh',borderRadius:'0px'}
    ],{duration:700,easing:'cubic-bezier(.22,1,.36,1)'});
    await frameTransition.finished;
    if(version!==generation||phase!=='animation')return;
    film.src=film.canPlayType('video/webm; codecs=vp9')?'/avatar-forge/success.webm':'/avatar-forge/success.mp4';
    await film.play();
  }catch{if(version===generation)finishAnimation();}
}
function celebrate(face){
  if(matched)return;
  // The canvas still holds the exact submitted frame, including its match box.
  matched=true;phase='frozen';stopCamera();start.disabled=true;upload.disabled=true;
  $('match-title').textContent=`Welcome, ${name(face.label)}`;
  status.textContent=`${name(face.label)} matched by the local face service.`;
  success.hidden=false;film.hidden=true;
  $('match-status').textContent='Face recognized. Frame frozen.';
  const version=generation;
  freezeTimer=setTimeout(()=>playAnimation(version),1000);
}
film.addEventListener('ended',finishAnimation);
film.addEventListener('error',finishAnimation);
film.addEventListener('playing',()=>{if(matched&&phase==='animation')success.classList.add('is-revealed');});
async function health(){
  const version=generation;
  try{
    const r=await fetch('/api/face/status'),data=await r.json();
    if(!r.ok||!data.ready)throw Error(data.error||'No enrolled faces');
    if(version!==generation||matched)return;
    const count=Object.values(data.enrolled).reduce((a,b)=>a+b,0);
    status.textContent='Ready · '+Object.keys(data.enrolled).length+' teammates · '+count+' enrollment photos';
  }catch(e){if(version===generation&&!matched)status.textContent=e.message||'Face service unavailable';}
}
function show(data){
  results.replaceChildren();
  for(const face of data.faces){
    const [x,y,w,h]=face.box,unknown=face.label==='unknown',title=name(face.label)+' · '+face.score.toFixed(2);
    ctx.strokeStyle=unknown?'#efaa72':'#91e1c1';ctx.lineWidth=Math.max(3,canvas.width/180);ctx.strokeRect(x,y,w,h);
    ctx.font='bold '+Math.max(18,canvas.width/32)+'px system-ui';
    const top=Math.max(28,y);
    ctx.fillStyle=unknown?'#efaa72':'#91e1c1';ctx.fillRect(x,top-28,ctx.measureText(title).width+16,30);
    ctx.fillStyle='#10211b';ctx.fillText(title,x+8,top-6);
    const chip=document.createElement('div');chip.className='result'+(unknown?' unknown':'');chip.textContent=title;results.append(chip);
  }
  // Any trained teammate starts the same transition, including a group frame.
  const teammate=data.faces.find(face=>trainedLabels.has(face.label));
  if(teammate)celebrate(teammate);
  else status.textContent=data.faces.length?'Face not recognized — try a clearer view':'No face detected — face the camera and improve the light';
}
async function analyze(version){
  if(request||matched||version!==generation)return;
  const controller=new AbortController();request=controller;
  try{
    const r=await fetch('/api/face/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:canvas.toDataURL('image/jpeg',0.82)}),signal:controller.signal});
    const data=await r.json();if(!r.ok)throw Error(data.error||'Recognition failed');
    if(version===generation&&!matched)show(data);
  }catch(e){if(version===generation&&e.name!=='AbortError')status.textContent=e.message||'Recognition failed';}
  finally{if(request===controller)request=null;}
}
async function scan(version){
  if(!stream||matched||version!==generation)return;
  if(!request&&video.videoWidth){
    canvas.width=Math.min(video.videoWidth,960);canvas.height=Math.round(canvas.width*video.videoHeight/video.videoWidth);
    ctx.drawImage(video,0,0,canvas.width,canvas.height);await analyze(version);
  }
  if(stream&&!matched&&version===generation)timer=setTimeout(()=>scan(version),1200);
}
start.addEventListener('click',async()=>{
  reset();const version=generation;start.disabled=true;stop.disabled=false;
  try{
    const acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:960},facingMode:'user'},audio:false});
    if(version!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
    stream=acquired;video.srcObject=stream;await video.play();
    if(version!==generation)return;
    status.textContent='Camera started';void scan(version);
  }catch(e){if(version===generation){stopCamera();status.textContent='Camera unavailable: '+(e.message||e);}}
});
stop.addEventListener('click',()=>{cancel();status.textContent='Camera stopped';});
upload.addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;reset();const version=generation;
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();await new Promise((ok,fail)=>{image.onload=ok;image.onerror=fail;image.src=url;});
    if(version!==generation)return;
    canvas.width=Math.min(image.naturalWidth,960);canvas.height=Math.round(canvas.width*image.naturalHeight/image.naturalWidth);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);await analyze(version);
  }catch(e){if(version===generation)status.textContent='Could not read photo: '+(e.message||e);}
  finally{URL.revokeObjectURL(url);event.target.value='';}
});
window.addEventListener('beforeunload',()=>{cancel();clearTimeout(freezeTimer);clearTimeout(filmTimer);frameTransition?.cancel();film.pause();});void health();
