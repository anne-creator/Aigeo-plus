// Canvas artwork adapted from Anne's supplied cofloor-deploy package.
// Drawing only: no demo timeline, host bridge, project mutations or network calls.
export function createTowerPainter(headcount) {
 const TOWER={w:1200,h:1080,x:288,front:440,side:142,top:176,fh:7.25,slant:57};
 const floorCells=Array.from({length:93},()=>[]);
 for(let i=0;i<headcount;i++)floorCells[i%93].push({phase:(i*17)%97});
    return function paintTower(canvas,time){
      if(!canvas)return;
      const c=canvas.getContext('2d'),{w,h,x,front,side,top,fh,slant}=TOWER,t=time;
      if(canvas.width!==w){canvas.width=w;canvas.height=h;}
      c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
      const poly=(pts,fill,stroke)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}};
      const line=(pts,color,width=1)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
      const glow=c.createRadialGradient(590,420,60,590,420,700);glow.addColorStop(0,'#113d52');glow.addColorStop(.5,'#0b2137');glow.addColorStop(1,'#050e1e');c.fillStyle=glow;c.fillRect(0,0,w,h);
      // Quiet city silhouettes establish the scale of the central headquarters.
      for(let i=0;i<21;i++){
        const bx=i*65-40,bh=70+(i*67)%210,by=850-bh;
        c.fillStyle=i%2?'#0c2032':'#0a1a2d';c.fillRect(bx,by,48,bh);
        c.fillStyle='#1d3e51';for(let yy=by+12;yy<840;yy+=17)for(let xx=bx+8;xx<bx+44;xx+=13)if((xx+yy+i)%5<2)c.fillRect(xx,yy,3,4);
        c.fillStyle='#264957';c.fillRect(bx+17,by-14,2,14);
      }
      // Perspective plaza and its restrained cyan transit traces.
      for(let i=-9;i<=9;i++){line([[600+i*90,800],[600+i*175,1080]],'#123346');line([[0,835+i*26],[1200,835+i*26]],'#102a3e');}
      poly([[155,908],[582,1055],[1030,876],[588,748]],'#071929','#284c60');
      poly([[195,891],[584,1022],[976,870],[588,754]],'#102b3e','#315668');
      for(let k=0;k<3;k++)line([[210+k*16,904+k*5],[585,1031+k*5],[976+k*9,881+k*4]],'#17606a',2);
      const base=top+93*fh;
      // Glass eastern facade; subtly moving lights are elevators and illustrative task traffic.
      poly([[x+front,top],[x+front+side,top-slant],[x+front+side,base-slant],[x+front,base]],'#0a263b','#376474');
      for(let row=0;row<93;row++){
        const y=top+row*fh;
        line([[x+front,y],[x+front+side,y-slant]],row%10===0?'#326273':'#1d4254');
        for(let j=0;j<6;j++){
          const xx=x+front+12+j*21,yy=y-(12+j*21)*slant/side;
          c.fillStyle=(row+j)%9===0?'#9a8860':(row+j)%3?'#30586c':'#426f80';c.fillRect(xx,yy+1,12,3);
        }
      }
      c.fillStyle='#102b40';c.fillRect(x,top,front,93*fh);
      const selected=89;
      // Exactly one small representation per unique employee in the company overview.
      // Distribution is a visual overview layout, not a claimed project assignment.
      for(let row=0;row<93;row++){
        const floor=92-row,y=top+row*fh,sel=floor===selected;
        c.fillStyle=row%10===0?'#39556a':row%2?'#153648':'#102d41';c.fillRect(x,y,front,fh-1);
        for(let j=0;j<11;j++){
          const cell=floorCells[floor][j],xx=x+14+j*38;
          c.fillStyle=(row+j)%7===0?'#6b654f':'#244758';c.fillRect(xx,y+.6,29,5.7);
          if(!cell)continue;
          const tick=Math.floor(t*2+cell.phase),moving=cell.phase%11===0;
          const dx=moving?Math.sin(t*.65+cell.phase)*10:0;
          c.fillStyle=cell.phase%6===0?'#d6b775':'#68adbc';c.fillRect(xx+18,y+1,7,2.5);
          c.fillStyle='#142632';c.fillRect(xx+16,y+4,12,1);
          c.fillStyle='#d8c8a7';c.fillRect(xx+9+dx,y+.7+(tick%3===0?.4:0),2,1.6);
          c.fillStyle=cell.phase%4===0?'#b9c1d0':'#72a5ac';c.fillRect(xx+8+dx,y+2.5,4,2.5);
          c.fillStyle='#abc8c4';c.fillRect(xx+11+dx,y+3+(tick%2)*.5,3,1);
        }
        if(row%10===0){c.font='12px monospace';c.fillStyle='#6a96aa';c.textAlign='right';c.fillText('F'+String(floor+1).padStart(2,'0'),x-22,y+4);}
        if(sel){
          c.shadowColor='#29ead1';c.shadowBlur=18;c.fillStyle='#43e6d1';c.fillRect(x-45,y,front+45,3);c.shadowBlur=0;
          poly([[x-45,y],[x-5,y-13],[x+front,y-13],[x+front,y]],'#1f6b75','#70ead7');
          line([[x+front,y],[x+front+side,y-slant]],'#71efde',3);
          c.fillStyle='#b5fff1';c.font='bold 20px monospace';c.textAlign='right';c.fillText('F'+String(floor+1).padStart(2,'0'),x-60,y+6);
        }
      }
      // Vertical mullions and six transparent express shafts.
      for(let j=0;j<=11;j++){const xx=x+8+j*38;c.fillStyle='#183749';c.fillRect(xx,top,2,93*fh);}
      for(let j=0;j<3;j++){
        const xx=x+front+side+12+j*15,yy=top-slant+(Math.sin(t*.18+j*2.1)+1)/2*(93*fh-32);
        c.fillStyle='#112f40';c.fillRect(xx,top-slant,9,93*fh);
        c.fillStyle='#254f60';c.fillRect(xx+3,top-slant,1,93*fh);
        c.shadowColor='#3de5d6';c.shadowBlur=10;c.fillStyle=j===1?'#e1bd77':'#59dfd2';c.fillRect(xx,yy,9,20);c.shadowBlur=0;
        c.fillStyle='#123846';c.fillRect(xx+2,yy+4,5,5);c.fillRect(xx+2,yy+11,5,5);
      }
      for(let j=0;j<4;j++){
        const xx=x+96+j*99,yy=top+((t*(17+j*3)+j*159)%(93*fh));
        c.fillStyle='#2b8d92';c.fillRect(xx,top,1,93*fh);
        const trail=c.createLinearGradient(0,yy-24,0,yy+4);trail.addColorStop(0,'#28e2cc00');trail.addColorStop(1,'#77e9de');c.fillStyle=trail;c.fillRect(xx-1,yy-24,3,26);
      }
      // Crown, rooftop gardens and local AI core.
      poly([[x-9,top],[x+side-9,top-slant],[x+front+side+8,top-slant],[x+front+8,top]],'#284b61','#79abb8');
      line([[x-9,top+4],[x+front+8,top+4],[x+front+side+8,top-slant+4]],'#54dccc',3);
      poly([[x+115,top-34],[x+197,top-67],[x+345,top-67],[x+263,top-34]],'#326178','#79adb9');
      poly([[x+115,top-34],[x+263,top-34],[x+263,top-8],[x+115,top-8]],'#173b50','#4a8496');
      poly([[x+263,top-34],[x+345,top-67],[x+345,top-41],[x+263,top-8]],'#244d62','#507a8d');
      c.fillStyle='#77efdb';c.font='bold 20px monospace';c.textAlign='center';c.fillText('COFLOOR',x+187,top-15);
      for(let j=0;j<6;j++){c.fillStyle='#2f6963';c.fillRect(x+35+j*18,top-16-j*4,10,9);c.fillStyle='#5a8e72';c.fillRect(x+37+j*18,top-19-j*4,6,5);}
      const coreX=x+284,coreY=top-81;
      c.shadowColor='#27d8d5';c.shadowBlur=23;c.fillStyle='#5df6df';c.fillRect(coreX-5,coreY-22,10,24);c.shadowBlur=0;
      line([[coreX,coreY-22],[coreX,coreY-64]],'#6d9fb3',2);
      const pulse=(t*.4)%1;c.globalAlpha=(1-pulse)*.45;c.strokeStyle='#65e6dd';c.lineWidth=2;c.beginPath();c.ellipse(coreX,coreY-27,20+pulse*70,7+pulse*23,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;
      // Lobby, illuminated entrance and activity at street level.
      poly([[x-16,base],[x+front+12,base],[x+front+12,base+38],[x-16,base+38]],'#234558','#5e8996');
      for(let j=0;j<14;j++){c.fillStyle=j>4&&j<9?'#7baeb3':'#254c5e';c.fillRect(x+j*32,base+4,23,29);}
      c.fillStyle='#172f42';c.fillRect(x+132,base+34,190,13);c.fillStyle='#60b4b9';c.fillRect(x+128,base+47,198,4);
      c.textAlign='left';
    }

}
    export function drawSprite(canvas,p,portrait,pose='idle',frame=0,facing=1,carry=false){
      if(canvas.width!==24||canvas.height!==38){canvas.width=24;canvas.height=38;}
      const c=canvas.getContext('2d');c.clearRect(0,0,24,38);c.imageSmoothingEnabled=false;c.save();
      if(facing<0){c.translate(24,0);c.scale(-1,1);}
      const source=p||{},n=Number(String(source.id||'5').replace(/\D/g,''))||5;
      const skin=source.skin||['#e6bd97','#bf825e','#d9a377','#8e5f49'][n%4],hair=source.hair||['#34282b','#503b2a','#222a36','#865635'][n%4],shirt=source.color||['#6089ca','#59b9ab','#a478bb','#8c9bb6'][n%4];
      function r(x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
      const ph=Math.floor(frame)%4,walking=pose==='walk',working=pose==='type'||pose==='read',stride=walking?[-2,0,2,0][ph]:0;
      r(4,35,16,2,'#04101c');r(7,28,4,7+stride,'#2b4057');r(13,28,4,7-stride,'#22364d');r(5,34+stride,6,2,'#0a1728');r(13,34-stride,7,2,'#0a1728');
      c.translate(0,walking?-(ph%2):working&&ph===2?-1:0);
      r(5,19,14,12,'#192a3e');r(6,19,12,10,shirt);r(4,21,3,8-stride,shirt);r(17,21,3,8+stride,shirt);r(4,27-stride,3,3,skin);r(18,27+stride,3,3,skin);r(9,16,6,5,skin);r(8,20,2,8,'#c4d8e5');r(15,20,1,8,'#344a61');
      r(5,5,14,13,'#142034');r(4,7,16,8,skin);r(6,4,13,13,skin);r(7,16,10,3,skin);r(7,4,11,3,hair);r(5,5,4,7,hair);r(3,6,3,6,hair);r(7,2,10,4,hair);r(9,1,7,2,hair);r(16,5,4,4,hair);
      if(n%3===0){r(2,10,4,10,hair);r(17,8,4,12,hair);}
      if(n%4===1){r(7,10,5,3,'#1e2b3a');r(14,10,5,3,'#1e2b3a');r(11,10,3,1,'#1e2b3a');r(8,11,2,1,'#b8d7e1');r(15,11,2,1,'#b8d7e1');}else{r(9,10,2,3,'#192432');r(16,10,2,3,'#192432');r(9,10,1,1,'#fbf1d6');r(16,10,1,1,'#fbf1d6');}
      r(12,14,3,1,'#805742');
      if(n%3===2){r(3,8,2,7,'#93adc9');r(19,8,2,7,'#93adc9');r(5,3,14,2,'#93adc9');}
      if(!walking&&Math.floor(frame+n)%23===0){r(9,10,2,3,skin);r(16,10,2,3,skin);r(9,12,2,1,'#302c2d');r(16,12,2,1,'#302c2d');}
      if(working){r(6,26,15,4,'#142c42');r(7,27,12,1,'#7babc5');r(6,24+(ph%2),4,3,skin);r(15,25-(ph%2),4,3,skin);if(pose==='read'){r(9,22,9,9,'#e2ddbc');r(10,24,6,1,'#758580');r(10,27,6,1,'#758580');}}
      if(carry){r(13,23,11,9,'#d0a04b');r(14,21,5,3,'#f8d788');r(14,24,9,7,'#f2c66c');r(13,27,3,3,skin);}
      c.restore();
    }
