import { createTowerPainter, drawSprite } from './art.mjs';
import { nav, pathBetween } from './model';
import type { Member, Point, Pose, Scene } from './model';
import { arrivalDuration, towerArrival } from './arrival';

type Actor={member:Member;x:number;y:number;node:string;queue:string[];pose:Pose;arrival:Pose;carry:boolean;dwell:number;phase:number;facing:number;sprite:HTMLCanvasElement};
export function createSceneEngine(canvas:HTMLCanvasElement,headcount:number,onFallback:()=>void,onUnavailable:()=>void,onArrival:(entering:boolean)=>void=()=>{}) {
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
  const towerCanvas=document.createElement('canvas'),paintTower=createTowerPainter(headcount);
  let scene:Scene={mode:'building',runId:'',members:[],moves:[],fallback:false},playing=true,reduced=false,hidden=document.hidden,disposed=false,unavailable=false;
  let frame=0,last=0,painted=0,time=0,image:HTMLImageElement|null=null,artFailed=false;
  let arrival:number|null=null;
  const actors=new Map<string,Actor>(),seen=new Set<string>();
  let area={x:0,y:0,w:1,h:1};
  function route(a:Actor,targets:string[],pose:Pose,carry=false,interrupt=false){
    if(interrupt)a.queue=[];
    let from=a.queue.at(-1)??a.node;
    const queue=a.queue.length?[...a.queue]:Math.hypot(a.x-nav[from][0],a.y-nav[from][1])>.05?[from]:[];
    for(const target of targets){const path=pathBetween(from,target);if(from!==target&&!path.length){ambient(a);return;}queue.push(...path);from=target;}
    a.queue=queue;a.arrival=pose;a.carry=carry;a.pose=queue.length?'walk':pose;
  }
  function ambient(a:Actor){
    // Decorative corridor travel never signals a delivery or changes project data.
    const stops=['upper','left','center','right','lower','lowerLeft','lowerRight','brief'];
    const target=stops[(Math.floor(time/6)+a.phase)%stops.length];
    a.queue=pathBetween(a.node,target);a.arrival='read';a.carry=false;
  }
  function finishArrival(){if(arrival!==null){arrival=null;onArrival(false);}}
  function apply(next:Scene,enter=false){
    if(next.runId!==scene.runId||next.mode!=='floor')finishArrival();
    if(enter&&next.mode==='floor'&&playing&&!reduced&&!hidden){arrival=0;onArrival(true);}
    if(next.runId!==scene.runId||next.mode!==scene.mode){actors.clear();seen.clear();}
    const wasAmbient=scene.fallback;
    scene=next;
    for(const member of next.members){
      let actor=actors.get(member.id);
      if(!actor){const node=member.unavailable?'exit':next.fallback?member.home:'exit',pt=nav[node];actor={member,x:pt[0],y:pt[1],node,queue:[],pose:member.pose,arrival:member.pose,carry:false,dwell:2+actors.size,phase:actors.size*3,facing:1,sprite:document.createElement('canvas')};actors.set(member.id,actor);}
      actor.member=member;
      if(next.fallback||artFailed){actor.queue=[];actor.pose=member.unavailable?'away':'read';actor.arrival=actor.pose;actor.carry=false;actor.dwell=0;}
      else if(wasAmbient){route(actor,[member.unavailable?'exit':member.home],member.pose,false,true);}
      else if(!actor.queue.length){actor.pose=member.pose;actor.arrival=member.pose;}
    }
    for(const id of actors.keys())if(!next.members.some(p=>p.id===id))actors.delete(id);
    if(!next.fallback&&!artFailed)for(const move of next.moves){
      if(seen.has(move.key))continue;
      const actor=actors.get(move.actorId);if(actor)route(actor,move.via,move.pose,move.carry,move.kind==='leave');
      seen.add(move.key);
    }
    if(reduced)settle();
    render();schedule();
  }
  function settle(){for(const a of actors.values()){const end=a.member.unavailable?'exit':a.member.home;[a.x,a.y]=nav[end];a.node=end;a.queue=[];a.pose=a.member.pose;a.arrival=a.member.pose;a.carry=false;}}
  function move(a:Actor,dt:number){
    if(a.member.unavailable&&!a.queue.length){a.pose='away';return;}
    if(!a.queue.length){a.pose=a.arrival;a.carry=false;a.dwell-=dt;if(a.dwell<=0){
      if(scene.fallback||artFailed)ambient(a);
      else if(a.node!==a.member.home)route(a,[a.member.home],a.member.pose);
      a.dwell=5+a.phase%6;
    }return;}
    const next=a.queue[0],pt=nav[next],dx=pt[0]-a.x,dy=pt[1]-a.y,dist=Math.hypot(dx*1.5,dy),step=11*dt;
    a.facing=dx<0?-1:dx>0?1:a.facing;a.pose='walk';
    if(dist<=step){[a.x,a.y]=pt;a.node=next;a.queue.shift();if(!a.queue.length){a.pose=a.arrival;a.dwell=4;}}
    else {a.x+=dx*step/dist;a.y+=dy*step/dist;}
  }
  function drawFloor(w:number,h:number){
    const scale=Math.min(w/1536,h/1024),sw=1536*scale,sh=1024*scale,x=(w-sw)/2,y=w<600?82:(h-sh)/2;
    area={x,y,w:sw,h:sh};
    if(image)ctx!.drawImage(image,x,y,sw,sh);
    else {
      // Missing office art still has a usable corridor and walking actors.
      ctx!.fillStyle='#0d263f';ctx!.fillRect(x,y,sw,sh);ctx!.strokeStyle='#244660';
      for(let col=0;col<16;col++){ctx!.beginPath();ctx!.moveTo(x+col*sw/15,y);ctx!.lineTo(x+col*sw/15,y+sh);ctx!.stroke();}
      for(let row=0;row<11;row++){ctx!.beginPath();ctx!.moveTo(x,y+row*sh/10);ctx!.lineTo(x+sw,y+row*sh/10);ctx!.stroke();}
    }
    for(const a of [...actors.values()].sort((a,b)=>a.y-b.y)){
      if(a.pose==='away')continue;
      const px=x+a.x/100*sw,py=y+a.y/100*sh;
      if(a.carry&&!scene.fallback&&!artFailed&&a.queue.length){ctx!.beginPath();ctx!.strokeStyle='#7ae8d288';ctx!.lineWidth=1;ctx!.setLineDash([3,6]);ctx!.moveTo(px,py);for(const node of a.queue)ctx!.lineTo(x+nav[node][0]/100*sw,y+nav[node][1]/100*sh);ctx!.stroke();ctx!.setLineDash([]);}
      drawSprite(a.sprite,{id:a.member.id},false,a.pose,Math.floor(time*7+a.phase),a.facing,a.carry);
      const size=Math.max(12,sw*.028);ctx!.imageSmoothingEnabled=false;ctx!.drawImage(a.sprite,px-size/2,py-size*38/24,size,size*38/24);
      ctx!.imageSmoothingEnabled=true;ctx!.textAlign='center';ctx!.font=`500 ${Math.max(8,sw*.009)}px system-ui`;ctx!.fillStyle='#f0f7ff';ctx!.shadowColor='#000';ctx!.shadowBlur=4;ctx!.fillText(a.member.name.split(' ')[0],px,py+12);ctx!.shadowBlur=0;
    }
  }
  function paintFrame(){
    if(disposed||unavailable)return;
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
    if(!w||!h)return;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx!.setTransform(dpr,0,0,dpr,0,0);ctx!.fillStyle='#041020';ctx!.fillRect(0,0,w,h);
    if(scene.mode==='building'||arrival!==null){
      paintTower(towerCanvas,time);const scale=Math.min(w/1200,h/1080);
      ctx!.save();
      if(arrival!==null){const camera=towerArrival(w,h,arrival);ctx!.translate(camera.x,camera.y);ctx!.scale(camera.scale,camera.scale);ctx!.translate(-camera.x,-camera.y);ctx!.filter=`brightness(${camera.brightness})`;}
      ctx!.drawImage(towerCanvas,(w-1200*scale)/2,(w<600?82:(h-1080*scale)/2),1200*scale,1080*scale);
      ctx!.restore();
    }
    else drawFloor(w,h);
  }
  function fail(){if(unavailable||disposed)return;unavailable=true;finishArrival();stop();onUnavailable();}
  function render(){try{paintFrame();}catch{fail();}}
  canvas.addEventListener('contextlost',fail);
  function tick(now:number){
    frame=0;if(disposed||unavailable||!playing||reduced||hidden)return;
    const dt=last?Math.min(.08,(now-last)/1000):0;last=now;time+=dt;
    if(arrival!==null){arrival+=dt;if(arrival>=arrivalDuration)finishArrival();}
    else if(scene.mode==='floor')actors.forEach(a=>move(a,dt));
    if(now-painted>1000/24){painted=now;render();}
    schedule();
  }
  function schedule(){if(!frame&&!disposed&&!unavailable&&playing&&!reduced&&!hidden)frame=requestAnimationFrame(tick);}
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
  const resize=new ResizeObserver(()=>render());resize.observe(canvas);
  function visibility(){hidden=document.hidden;stop();if(hidden)finishArrival();else{render();schedule();}}
  document.addEventListener('visibilitychange',visibility);
  return {
    apply,
    setPlayback(value:boolean,reduce:boolean){playing=value;reduced=reduce;stop();if(!playing||reduced)finishArrival();if(reduced)settle();render();schedule();},
    setArt(value:HTMLImageElement|null,failed=false){image=value;artFailed=failed;if(failed){onFallback();for(const a of actors.values()){a.queue=[];a.carry=false;a.dwell=0;}}render();},
    pick(clientX:number,clientY:number){if(scene.mode!=='floor'||arrival!==null)return null;const r=canvas.getBoundingClientRect(),x=(clientX-r.left-area.x)/area.w*100,y=(clientY-r.top-area.y)/area.h*100;return [...actors.values()].filter(a=>a.pose!=='away'&&Math.abs(a.x-x)<3&&y<a.y+2&&y>a.y-7).sort((a,b)=>b.y-a.y)[0]?.member.id??null;},
    destroy(){disposed=true;stop();resize.disconnect();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('contextlost',fail);image=null;actors.clear();},
  };
}
