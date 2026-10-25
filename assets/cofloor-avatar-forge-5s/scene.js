import * as THREE from './vendor/three.module.js';
export const DURATION=5;
const SPEED=3.6; // 18-second choreography compressed to 5 seconds.
const W=1920,H=1080,VW=1200,VH=900;
const canvas=document.getElementById('film'),ctx=canvas.getContext('2d',{alpha:false});
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(VW,VH);renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,VW/VH,.1,100);
scene.add(new THREE.HemisphereLight(0xd5fff4,0x17413e,2.4));
const key=new THREE.DirectionalLight(0xffeddc,4.2);key.position.set(-3,7,6);scene.add(key);
const rim=new THREE.DirectionalLight(0x64fddd,4);rim.position.set(3,4,-4);scene.add(rim);
const fill=new THREE.DirectionalLight(0x708bff,2.2);fill.position.set(-5,3,-1);scene.add(fill);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const ramp=(t,a,b)=>smooth((t-a)/(b-a));
const lerp=(a,b,t)=>a+(b-a)*t;
function random(i){const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)}
const v3=(x,y,z)=>new THREE.Vector3(x,y,z);
function standard(color,roughness=.4,metalness=.08){return new THREE.MeshStandardMaterial({color,roughness,metalness})}
function rounded(w,h,d,r=.08){
 const g=new THREE.BoxGeometry(w,h,d,6,6,6),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),q=v3(clamp(x,-w/2+r,w/2-r),clamp(y,-h/2+r,h/2-r),clamp(z,-d/2+r,d/2-r)),n=v3(x,y,z).sub(q).normalize().multiplyScalar(r).add(q);p.setXYZ(i,n.x,n.y,n.z)}
 g.computeVertexNormals();return g;
}
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#ffffff');g.addColorStop(.15,'#b5ffe5');g.addColorStop(.35,'#38eab670');g.addColorStop(1,'#38eab600');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)}
const glowMap=glowTexture();
function line(points,color=0x58e7bd,opacity=.5,loop=false){return new (loop?THREE.LineLoop:THREE.Line)(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}))}
function circle(radius,y,from=0,to=Math.PI*2,opacity=.5){return line(Array.from({length:161},(_,i)=>v3(Math.cos(lerp(from,to,i/160))*radius,y,Math.sin(lerp(from,to,i/160))*radius)),0x65f4cc,opacity)}
const stage=new THREE.Group();scene.add(stage);
const disc=new THREE.Mesh(new THREE.CylinderGeometry(2.05,2.18,.18,96),standard(0x132d2d,.3,.68));disc.position.y=-.16;stage.add(disc);
const discTop=new THREE.Mesh(new THREE.CylinderGeometry(1.87,1.87,.015,96),standard(0x071a1c,.3,.52));discTop.position.y=-.06;stage.add(discTop);
const rings=[];for(let i=0;i<4;i++){const o=circle(1.9+i*.18,-.04,0,i%2?Math.PI*1.5:Math.PI*2,i===0?.8:.25);stage.add(o);rings.push(o)}
for(let i=0;i<80;i++){const a=i/80*Math.PI*2,r1=2.3,r2=i%5===0?2.41:2.35;stage.add(line([v3(Math.cos(a)*r1,-.06,Math.sin(a)*r1),v3(Math.cos(a)*r2,-.06,Math.sin(a)*r2)],0x67dac2,i%5===0?.6:.2))}
const floorGrid=new THREE.GridHelper(20,40,0x134a43,0x0d2425);floorGrid.position.y=-.27;floorGrid.material.transparent=true;floorGrid.material.opacity=.35;stage.add(floorGrid);
const halo=new THREE.Mesh(new THREE.PlaneGeometry(7,7),new THREE.MeshBasicMaterial({map:glowMap,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending}));halo.rotation.x=-Math.PI/2;halo.position.y=-.045;stage.add(halo);
const orbit=new THREE.Group();scene.add(orbit);
for(let i=0;i<3;i++){const l=circle(1.9+i*.35,0,-Math.PI*.15,Math.PI*1.15,.25);l.rotation.x=Math.PI/2;l.rotation.z=i*.65;l.position.y=2.9;orbit.add(l)}
const scanRing=circle(1.64,1.5,0,Math.PI*2,.8);scene.add(scanRing);
const scanPlane=new THREE.Mesh(new THREE.PlaneGeometry(3.4,3.4),new THREE.MeshBasicMaterial({color:0x69ffd8,transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));scanPlane.rotation.x=-Math.PI/2;scene.add(scanPlane);
// A deterministic portrait plate, followed by a true 3D procedural face surface.
const texture=await new THREE.TextureLoader().loadAsync('./assets/employee.png');texture.colorSpace=THREE.SRGBColorSpace;
const portrait=new THREE.Mesh(new THREE.PlaneGeometry(4.7,4.7),new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:1,depthWrite:false}));portrait.position.set(0,2.9,-.06);scene.add(portrait);
// Feather only the display plate edges, keeping the generated source asset untouched.
const mask=document.createElement('canvas');mask.width=mask.height=256;const mx=mask.getContext('2d');mx.fillStyle='white';mx.fillRect(0,0,256,256);mx.globalCompositeOperation='multiply';
for(const [x1,y1,x2,y2] of [[0,0,256,0],[0,0,0,256]]){const g=mx.createLinearGradient(x1,y1,x2,y2);g.addColorStop(0,'black');g.addColorStop(.075,'white');g.addColorStop(.91,'white');g.addColorStop(1,'black');mx.fillStyle=g;mx.fillRect(0,0,256,256)}
portrait.material.alphaMap=new THREE.CanvasTexture(mask);
const faceRoot=new THREE.Group();faceRoot.position.y=3.29;scene.add(faceRoot);
const geo=new THREE.SphereGeometry(1,44,36),pos=geo.attributes.position;
function gauss(x,y,cx,cy,sx,sy){return Math.exp(-(((x-cx)/sx)**2)-(((y-cy)/sy)**2))}
for(let i=0;i<pos.count;i++){
 const px=pos.getX(i),py=pos.getY(i),pz=pos.getZ(i),y=py*1.25;
 const jaw=py<-.15?lerp(.68,1,smooth((py+1)/.85)):1;
 let x=px*.99*jaw,z=pz*.8;
 if(pz>0){const f=smooth(pz*3);z+=f*(.43*gauss(x,y,0,-.12,.16,.35)+.12*gauss(x,y,0,.1,.14,.65)-.16*gauss(x,y,-.4,.2,.24,.16)-.16*gauss(x,y,.4,.2,.24,.16)+.09*gauss(x,y,0,-.6,.38,.13)+.055*gauss(x,y,-.5,-.25,.28,.3)+.055*gauss(x,y,.5,-.25,.28,.3));}
 pos.setXYZ(i,x,y,z);
}
geo.computeVertexNormals();
const faceMat=new THREE.MeshPhongMaterial({color:0x1d6453,emissive:0x063a2d,emissiveIntensity:.2,shininess:85,transparent:true,opacity:0,side:THREE.DoubleSide});
const faceSolid=new THREE.Mesh(geo,faceMat);faceRoot.add(faceSolid);
const wireMat=new THREE.MeshBasicMaterial({color:0x7effd7,wireframe:true,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});const faceWire=new THREE.Mesh(geo,wireMat);faceWire.scale.setScalar(1.004);faceRoot.add(faceWire);
const vertexMat=new THREE.PointsMaterial({color:0xc5ffe9,size:.026,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});const facePoints=new THREE.Points(geo,vertexMat);faceRoot.add(facePoints);
const featureGroup=new THREE.Group();faceRoot.add(featureGroup);
function featureCurve(points,closed=false){const curve=new THREE.CatmullRomCurve3(points.map(p=>v3(...p)),closed);const l=line(curve.getPoints(50),0xbbffe5,.85);featureGroup.add(l);return l}
for(const s of [-1,1]){
 featureCurve([[s*.18,.2,.69],[s*.30,.29,.72],[s*.47,.29,.67],[s*.61,.2,.61],[s*.43,.12,.69],[s*.28,.13,.74]],true);
 featureCurve([[s*.18,.42,.76],[s*.36,.48,.73],[s*.56,.43,.64]]);
 const ear=new THREE.Mesh(new THREE.SphereGeometry(.2,12,12),wireMat);ear.position.set(s*.96,-.12,-.05);ear.scale.set(.5,1.6,.8);faceRoot.add(ear);
}
featureCurve([[-.27,-.59,.73],[0,-.54,.82],[.27,-.59,.73],[0,-.67,.79]],true);
featureCurve([[0,.38,.81],[0,.04,1.08],[0,-.2,1.2],[-.14,-.3,.97],[0,-.33,1.03],[.14,-.3,.97]]);
// Match the bob haircut and teal jacket from the portrait with an actual 3D game figurine.
const avatar=new THREE.Group();scene.add(avatar);const pieces=[];
const palettes={skin:0xe8b08e,skinLight:0xf2c1a2,hair:0x152527,hairLight:0x223639,teal:0x187979,tealLight:0x38a9a0,white:0xf3e9d6,pants:0x213a43,shoe:0xe9efe5,black:0x092123,gold:0xedca79};
function block(parent,name,w,h,d,x,y,z,color,r=.05){const mat=standard(color,.38,name.includes('hair')?.18:.06);mat.transparent=true;const m=new THREE.Mesh(rounded(w,h,d,Math.min(r,w*.35,h*.35,d*.35)),mat);m.position.set(x,y,z);m.name=name;parent.add(m);pieces.push(m);return m}
block(avatar,'left-trouser',.36,.7,.4,-.26,.65,0,palettes.pants,.05);
block(avatar,'right-trouser',.36,.7,.4,.26,.65,0,palettes.pants,.05);
for(const s of [-1,1]){
 block(avatar,'sneaker',.47,.27,.7,s*.27,.18,.12,palettes.shoe,.07);
 block(avatar,'sole',.49,.08,.72,s*.27,.065,.12,0x779b95,.025);
 block(avatar,'shoe-stripe',.37,.035,.04,s*.27,.23,.48,palettes.teal,.01);
 block(avatar,'cargo-pocket',.1,.25,.25,s*.46,.69,.03,0x294b53,.025);
}
block(avatar,'jacket-body',.95,1.04,.63,0,1.52,0,palettes.teal,.13);
block(avatar,'shirt',.42,.84,.08,0,1.57,.33,palettes.white,.035);
for(const s of [-1,1]){
 block(avatar,'jacket-lapel',.15,.91,.1,s*.29,1.57,.38,palettes.tealLight,.035);
 block(avatar,'jacket-hem',.34,.13,.13,s*.31,1.04,.32,0x105450,.03);
 block(avatar,'collar',.26,.2,.2,s*.28,2.02,.21,0x115353,.035).rotation.z=s*-.4;
}
block(avatar,'zip',.027,.74,.028,.245,1.52,.445,palettes.gold,.005);
block(avatar,'neck',.41,.38,.39,0,2.12,.015,palettes.skin,.08);
const head=new THREE.Group();head.position.y=2.94;avatar.add(head);
block(head,'hair-bob',1.65,1.6,1.27,0,.12,-.14,palettes.hair,.27);
block(head,'face',1.36,1.28,1.06,0,-.03,.14,palettes.skinLight,.26);
for(const s of [-1,1]){
 block(head,'ear',.17,.32,.22,s*.7,-.06,.18,palettes.skin,.07);
 block(head,'hair-side',.26,1.08,.88,s*.73,-.06,.08,palettes.hair,.08);
 block(head,'eye',.155,.205,.064,s*.3,.015,.678,0x0c2026,.045);
 block(head,'eye-glint',.043,.053,.014,s*.3-.025,.06,.717,0xeafff1,.012);
 block(head,'eyebrow',.24,.055,.055,s*.3,.255,.661,palettes.hair,.016).rotation.z=s*-.08;
 block(head,'cheek',.19,.075,.02,s*.42,-.205,.66,0xe1a28e,.015);
}
block(head,'nose',.14,.16,.15,0,-.15,.7,0xe4ab89,.05);
block(head,'smile',.22,.035,.028,0,-.355,.672,0x905c50,.01);
for(const s of [-1,1])block(head,'smile-corner',.035,.055,.03,s*.12,-.335,.672,0x905c50,.01);
for(let i=0;i<7;i++){
 const x=-.62+i*.205,y=.48+(.14+i*.035)*Math.sin((i+1)*.45);
 block(head,'hair-fringe',.29,.42+(i<3?.15:0),.33,x,y,.54,i%3===0?palettes.hairLight:palettes.hair,.065).rotation.z=-.18;
}
for(let i=0;i<5;i++)block(head,'hair-crown',.36,.16,.68,-.55+i*.27,.89-Math.abs(i-2)*.047,-.1,i%2?palettes.hair:palettes.hairLight,.045);
const leftArm=new THREE.Group(),rightArm=new THREE.Group();leftArm.position.set(-.57,1.92,0);rightArm.position.set(.57,1.92,0);avatar.add(leftArm,rightArm);
for(const [arm,s] of [[leftArm,-1],[rightArm,1]]){
 block(arm,'sleeve',.32,.68,.46,s*.07,-.28,0,palettes.teal,.09);
 block(arm,'cuff',.3,.13,.41,s*.08,-.66,0,0x104b48,.04);
 block(arm,'hand',.29,.3,.31,s*.08,-.87,.025,palettes.skinLight,.09);
 block(arm,'sleeve-patch',.075,.22,.24,s*.25,-.19,.035,palettes.tealLight,.025);
}
leftArm.rotation.z=-.12;rightArm.rotation.z=.12;
const badgeCanvas=document.createElement('canvas');badgeCanvas.width=128;badgeCanvas.height=128;const bx=badgeCanvas.getContext('2d');bx.fillStyle='#eaf5df';bx.fillRect(0,0,128,128);bx.fillStyle='#13534b';bx.font='bold 52px sans-serif';bx.textAlign='center';bx.fillText('CF',64,81);const badgeTex=new THREE.CanvasTexture(badgeCanvas);badgeTex.colorSpace=THREE.SRGBColorSpace;
const badge=block(avatar,'badge',.19,.23,.035,-.3,1.77,.45,0xffffff,.015);badge.material.map=badgeTex;
// Preserve transforms so seeking and replaying always produce exactly the same frame.
for(const m of pieces){m.userData.rest=m.position.clone();m.userData.rot=m.rotation.clone()}
avatar.updateMatrixWorld(true);
const N=3400,particlePos=new Float32Array(N*3),particleColors=new Float32Array(N*3),targets=[],sources=[];
for(let i=0;i<N;i++){
 const m=pieces[i%pieces.length],a=m.geometry.attributes.position,j=Math.floor(random(i+18)*a.count),p=v3(a.getX(j),a.getY(j),a.getZ(j));m.localToWorld(p);targets.push(p);
 const j2=Math.floor(random(i+58)*pos.count);sources.push(v3(pos.getX(j2),pos.getY(j2)+3.29,pos.getZ(j2)));
 const c=new THREE.Color(i%5?0x77ffcf:0xe0fff3);particleColors[i*3]=c.r;particleColors[i*3+1]=c.g;particleColors[i*3+2]=c.b;
}
const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePos,3));particleGeo.setAttribute('color',new THREE.BufferAttribute(particleColors,3));
const particles=new THREE.Points(particleGeo,new THREE.PointsMaterial({size:.052,map:glowMap,transparent:true,opacity:1,vertexColors:true,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(particles);
const ambientPositions=new Float32Array(240*3);for(let i=0;i<240;i++){ambientPositions[i*3]=(random(i+300)-.5)*12;ambientPositions[i*3+1]=random(i+600)*7;ambientPositions[i*3+2]=(random(i+900)-.5)*7}
const ambientGeo=new THREE.BufferGeometry();ambientGeo.setAttribute('position',new THREE.BufferAttribute(ambientPositions,3));const ambient=new THREE.Points(ambientGeo,new THREE.PointsMaterial({color:0x79d8c8,size:.015,transparent:true,opacity:.45,depthWrite:false}));scene.add(ambient);
const burstRings=[];for(let i=0;i<3;i++){const r=circle(1,1.4,0,Math.PI*2,.8);scene.add(r);burstRings.push(r)}
function sceneAt(t){
 const zoom=ramp(t,7.5,11.6),reveal=ramp(t,11.8,13.4);
 camera.position.set(lerp(0,5.2,zoom),lerp(3.1,4.3,zoom),lerp(8.6,9.8,zoom));camera.lookAt(0,lerp(2.9,1.95,zoom),0);
 portrait.visible=t<5.8;portrait.material.opacity=1-ramp(t,4.1,5.8);portrait.position.z=-.06-ramp(t,4.4,6)*.5;
 const faceOn=ramp(t,1.6,3.6),faceOff=1-ramp(t,7.7,9.2);
 faceRoot.visible=t<9.3;faceRoot.rotation.y=ramp(t,4.4,7.8)*.9;faceRoot.position.y=3.29+ramp(t,4.4,7)*.05;faceRoot.position.z=ramp(t,4.1,6)*.4;
 faceRoot.scale.setScalar(1+ramp(t,4.7,6.5)*.12);
 faceMat.opacity=ramp(t,4.4,5.8)*faceOff;wireMat.opacity=faceOn*faceOff*lerp(.11,.32,ramp(t,4,5.3));vertexMat.opacity=faceOn*faceOff*.23;
 featureGroup.visible=t>2.2;featureGroup.traverse(o=>{if(o.material&&o!==featureGroup)o.material.opacity=faceOn*faceOff*.8});
 const assemble=ramp(t,9,12.6);
 avatar.visible=t>=9;avatar.rotation.y=lerp(-.65,0,ramp(t,9,12.5)) + ramp(t,12.5,16.5)*Math.PI*2 - ramp(t,16.5,18)*.1;
 avatar.position.y=Math.sin(t*1.6)*.025*reveal;
 head.rotation.z=Math.sin(t*1.5)*.025*reveal;
 const wave=ramp(t,16.4,17.2);rightArm.rotation.z=.12+wave*1.9+Math.sin(t*8)*.12*wave;rightArm.rotation.x=-wave*.2;leftArm.rotation.z=-.12;
 for(let i=0;i<pieces.length;i++){
  const m=pieces[i],r=m.userData.rest;let worldY=targets[i]?.y||1;
  // Assembly starts at the shoes and climbs to the hair.
  m.position.copy(r);m.rotation.copy(m.userData.rot);
  const p=ramp(t,9.1+worldY*.5,10.7+worldY*.5);
  m.scale.setScalar(Math.max(.0001,p));m.position.x+=(random(i+101)-.5)*(1-p)*2;m.position.y+=(1-p)*.6;m.position.z+=(random(i+102)-.5)*(1-p)*2;
  m.material.opacity=p;
 }
 for(let i=0;i<N;i++){
  const a=sources[i],b=targets[i],r=random(i+77),p=ramp(t,8.2+r*.7,11.1+r*1.5),burst=Math.sin(p*Math.PI),angle=i*2.39996+p*6;
  let x=lerp(a.x,b.x,p)+Math.cos(angle)*burst*(1.8+r*1.8),y=lerp(a.y,b.y,p)+burst*(r-.3)*2.4,z=lerp(a.z,b.z,p)+Math.sin(angle)*burst*(1.5+r*1.5);
  const rot=avatar.rotation.y*ramp(t,9.7,12.6);const xx=x*Math.cos(rot)+z*Math.sin(rot);z=-x*Math.sin(rot)+z*Math.cos(rot);x=xx;
  particlePos[i*3]=x;particlePos[i*3+1]=y;particlePos[i*3+2]=z;
 }
 particleGeo.attributes.position.needsUpdate=true;particles.visible=t>7.6&&t<13;particles.material.opacity=ramp(t,7.6,8.2)*(1-ramp(t,11.8,13));
 scanRing.visible=t>4&&t<12.8;scanRing.position.y=t<8?lerp(4.9,1.7,((t-4)%3)/3):lerp(.15,4.2,ramp(t,8.5,12.6));scanRing.material.opacity=t<8?.5:.7;
 scanPlane.visible=scanRing.visible;scanPlane.position.y=scanRing.position.y;scanPlane.material.opacity=t<8?.03:.045;
 orbit.visible=t>3&&t<9.5;orbit.rotation.y=t*.13;orbit.children.forEach((o,i)=>{o.material.opacity=ramp(t,3,5)*(1-ramp(t,8,9.5))*(.2+i*.07)});
 rings.forEach((r,i)=>{r.rotation.y=t*(i%2?-.2:.15)});
 const stageOpacity=ramp(t,4.2,6.5);stage.visible=t>4.2;stage.traverse(o=>{if(o.material){o.material.transparent=true;o.material.opacity=o===floorGrid?.25*stageOpacity:o===halo?.13*stageOpacity:((o.type==='Line')?.45*stageOpacity:stageOpacity)}});
 burstRings.forEach((r,i)=>{const p=(t-12.15-i*.18)/1.5;r.visible=p>0&&p<1;r.scale.setScalar(1+clamp(p)*3);r.position.y=.04;r.material.opacity=(1-clamp(p))*.8});
 ambient.rotation.y=t*.025;
 renderer.render(scene,camera);
}
const C={white:'#e6fff1',muted:'#7b9b94',green:'#9bf7ca',line:'#22423c',dim:'#36594f'};
function text(str,x,y,size=20,color=C.white,weight=400,font='sans-serif'){ctx.font=`${weight} ${size}px ${font==='mono'?'"SFMono-Regular",Consolas,monospace':'"Helvetica Neue","PingFang SC",sans-serif'}`;ctx.fillStyle=color;ctx.fillText(str,x,y)}
function line2(x1,y1,x2,y2,color=C.line,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function dot(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()}
function spaced(str,x,y,size,color,spacing=3){ctx.font=`500 ${size}px "Helvetica Neue",sans-serif`;ctx.fillStyle=color;for(const c of str){ctx.fillText(c,x,y);x+=ctx.measureText(c).width+spacing}}
function cross(x,y,size=6,alpha=.5){ctx.globalAlpha=alpha;line2(x-size,y,x+size,y,C.green);line2(x,y-size,x,y+size,C.green);ctx.globalAlpha=1}
const phases=[
 {start:0,end:4.5,tag:'01 / FACE CAPTURE',title:['It starts','with you.'],sub:'扫描真实面孔，捕捉独特的你。',detail:'FACIAL LANDMARKS',action:'面部扫描',label:'CAPTURE'},
 {start:4.5,end:8.4,tag:'02 / SPATIAL RECONSTRUCTION',title:['Beyond','the surface.'],sub:'轮廓浮现，构建三维数字形态。',detail:'DEPTH RECONSTRUCTION',action:'3D 建模',label:'RECONSTRUCT'},
 {start:8.4,end:12.8,tag:'03 / AVATAR SYNTHESIS',title:['A thousand','little details.'],sub:'粒子聚合，你的游戏角色逐渐成型。',detail:'VOXEL SYNTHESIS',action:'角色生成',label:'SYNTHESIZE'},
 {start:12.8,end:18,tag:'04 / READY TO JOIN',title:['Your world.','Your character.'],sub:'让另一个你，进入 CoFloor。',detail:'AVATAR COMPLETE',action:'准备入场',label:'READY'}
];
function project(x,y,z){const p=v3(x,y,z).project(camera);return{x:660+(p.x*.5+.5)*VW,y:95+(-p.y*.5+.5)*VH}}
function drawScan(t){
 const a=(1-ramp(t,4.5,5.5))*ramp(t,.1,.7);if(a<=0)return;ctx.save();ctx.globalAlpha=a;
 const x=966,y=204,w=560,h=620;
 ctx.strokeStyle='#61d8ad';ctx.lineWidth=2;
 for(const [cx,cy,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){ctx.beginPath();ctx.moveTo(cx,cy+sy*26);ctx.lineTo(cx,cy);ctx.lineTo(cx+sx*26,cy);ctx.stroke()}
 const sy=y+55+(h-110)*(.5-.5*Math.cos(t*2.7));
 const g=ctx.createLinearGradient(0,sy-65,0,sy+10);g.addColorStop(0,'#82ffbd00');g.addColorStop(.9,'#82ffbd18');g.addColorStop(1,'#bfffe750');ctx.fillStyle=g;ctx.fillRect(x+5,sy-65,w-10,75);
 ctx.shadowColor='#90ffd5';ctx.shadowBlur=20;line2(x-12,sy,x+w+12,sy,'#b1ffe0',2);ctx.shadowBlur=0;
 text('LIVE CAPTURE',x,182,14,C.green,500,'mono');dot(x+w-8,177,4,C.green);
 text('SUBJECT / CF—024',x,853,13,C.muted,400,'mono');text(`${Math.floor(clamp(t/4.5)*100).toString().padStart(2,'0')}%`,x+w-42,853,14,C.green,500,'mono');
 ctx.restore();
}
function drawAnnotations(t){
 const a=ramp(t,5,5.7)*(1-ramp(t,7.8,8.4));if(a>0){ctx.save();ctx.globalAlpha=a;for(const [label,p,ex,ey] of [['TOPOLOGY',[.65,3.8,.3],1530,302],['DEPTH FIELD',[.1,3.1,1.05],1565,520],['MESH SOLVED',[-.45,2.6,.6],930,738]]){const q=project(...p);dot(q.x,q.y,3,C.green);line2(q.x,q.y,ex-20,ey-8,'#649b87');line2(ex-20,ey-8,ex+130,ey-8,'#649b87');text(label,ex,ey-20,13,C.green,400,'mono')}ctx.restore()}
 const b=ramp(t,13,13.8);if(b>0){ctx.save();ctx.globalAlpha=b;roundRect(1510,320,225,68,8,'#0b2420d9','#2f5d4d');dot(1533,344,4,C.green);text('AVATAR CREATED',1547,350,14,C.green,500,'mono');text('COFLOOR / EMPLOYEE 024',1533,372,10,C.muted,400,'mono');ctx.restore()}
}
function drawHUD(t){
 text('cofloor',104,96,36,C.white,650);dot(241,89,5,C.green);line2(273,66,273,100,C.line);spaced('AVATAR FORGE',299,89,13,C.muted,3);
 text('HUMAN → DIGITAL',1550,87,13,C.muted,400,'mono');dot(1783,81,4,C.green);
 line2(104,126,1816,126,C.line);
 let index=phases.findIndex(p=>t<p.end);if(index<0)index=3;const p=phases[index];
 const a=index===0?1:ramp(t,p.start,p.start+.45);ctx.save();ctx.globalAlpha=a;
 spaced(p.tag,108,290,12,C.green,2);
 const fs=index===3?69:index===2?68:86;
 text(p.title[0],101,403,fs,C.white,500);text(p.title[1],101,403+fs*1.09,fs,C.white,500);
 text(p.sub,108,588,21,'#8caf9f');
 line2(108,637,438,637,C.line);text(p.detail,108,672,11,C.muted,500,'mono');
 const percent=Math.floor(clamp((t-p.start)/(p.end-p.start))*100);
 text(index===3?'READY':`${String(percent).padStart(2,'0')}%`,105,741,index===3?43:56,C.green,400,'mono');
 if(index<3){for(let i=0;i<40;i++){ctx.fillStyle=i<percent/100*40?C.green:'#19342b';ctx.fillRect(109+i*8.1,768,4,13)}}else{text('身份成型 · 随时加入项目',108,783,16,C.muted)}
 ctx.restore();
 // One consistent four-stage timeline, rather than separate screens.
 line2(104,920,1816,920,C.line);
 for(let i=0;i<4;i++){
  const x=108+i*431,active=i===index,done=i<index;
  text(done?'✓':`0${i+1}`,x,970,16,active||done?C.green:C.dim,500,'mono');text(phases[i].action,x+41,971,18,active?C.white:C.muted,active?500:400);text(phases[i].label,x+41,998,10,active?C.green:C.dim,400,'mono');
  ctx.fillStyle='#163127';ctx.fillRect(x,1040,376,2);ctx.fillStyle=active||done?C.green:C.dim;ctx.fillRect(x,1040,376*(done?1:active?clamp((t-p.start)/(p.end-p.start)):0),2);
 }
 text('CONCEPT DEMO',104,875,10,'#4f7564',400,'mono');
}
export function render(t){
 t=clamp(Number(t)||0,0,DURATION)*SPEED;sceneAt(t);
 ctx.fillStyle='#030b0d';ctx.fillRect(0,0,W,H);
 const bg=ctx.createRadialGradient(1260,500,30,1260,500,770);bg.addColorStop(0,'#123e32');bg.addColorStop(.42,'#09271f');bg.addColorStop(1,'#030b0d');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 const top=ctx.createLinearGradient(0,0,0,H);top.addColorStop(0,'#04121600');top.addColorStop(1,'#00090966');ctx.fillStyle=top;ctx.fillRect(0,0,W,H);
 // Fine static drafting field gives the stage depth without competing with the character.
 for(let x=680;x<1830;x+=80)for(let y=185;y<900;y+=80){ctx.fillStyle='#43654d30';ctx.fillRect(x,y,1,1)}
 ctx.save();ctx.beginPath();ctx.rect(660,128,1200,774);ctx.clip();
 ctx.drawImage(renderer.domElement,660,95,VW,VH);
 // Soft bloom is a separate blend pass; geometry remains crisp and fully three-dimensional.
 ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.13;ctx.filter='blur(11px)';ctx.drawImage(renderer.domElement,660,95,VW,VH);ctx.restore();ctx.restore();
 drawScan(t);drawAnnotations(t);
 const flash=Math.exp(-(((t-12.6)/.19)**2))*.13;ctx.fillStyle=`rgba(166,255,211,${flash})`;ctx.fillRect(0,0,W,H);
 drawHUD(t);
 cross(608,178,6,.3);cross(1808,867,6,.3);
}
export function frame(t,quality=.93){render(t);return canvas.toDataURL('image/jpeg',quality).split(',')[1]}
export function stats(){return {pieces:pieces.length,particles:N,faceVertices:pos.count,duration:DURATION,renderer:renderer.info.render}}
export {canvas};
