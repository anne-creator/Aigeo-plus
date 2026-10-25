import {render,frame,stats,DURATION} from './scene.js';
const $=id=>document.getElementById(id),seek=$('seek'),play=$('play'),sound=$('sound');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let current=reduced?DURATION:0,playing=!reduced,last=performance.now(),enabled=false,ended=false;
const audio=new Audio('./soundtrack.m4a');audio.preload='auto';audio.volume=.7;
function paint(){render(current);seek.value=current;$('time').textContent=`00:${Math.floor(current).toString().padStart(2,'0')} / 00:${DURATION.toString().padStart(2,'0')}`;play.textContent=playing?'暂停':current>=DURATION?'重播':'播放'}
function syncAudio(){if(enabled&&playing){audio.currentTime=current;audio.play().catch(()=>{enabled=false;sound.textContent='音效：关';sound.setAttribute('aria-pressed','false')})}else audio.pause()}
function start(){if(current>=DURATION)current=0;ended=false;playing=true;last=performance.now();syncAudio();paint()}
function pause(){playing=false;audio.pause();paint()}
function go(t){current=Math.max(0,Math.min(DURATION,Number(t)||0));last=performance.now();ended=false;syncAudio();paint()}
function replay(){current=0;start()}
play.addEventListener('click',()=>playing?pause():start());$('replay').addEventListener('click',replay);
seek.addEventListener('input',()=>go(seek.value));
sound.addEventListener('click',()=>{enabled=!enabled;sound.textContent=`音效：${enabled?'开':'关'}`;sound.setAttribute('aria-pressed',String(enabled));syncAudio()});
$('full').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.querySelector('.player').requestFullscreen().catch(()=>{})});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause()});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===document.body){e.preventDefault();playing?pause():start()}});
function tick(now){if(playing){current=Math.min(DURATION,current+(now-last)/1000);if(current>=DURATION){playing=false;audio.pause();if(!ended){ended=true;window.dispatchEvent(new CustomEvent('cofloor:avatar-ready',{detail:{employeeId:'CF-024',demo:true}}))}}paint()}last=now;requestAnimationFrame(tick)}
window.CoFloorAvatarForge={play:start,pause,replay,seek:go,get currentTime(){return current},get playing(){return playing},duration:DURATION,stats};
window.renderFrame=(t,q)=>{pause();current=Math.max(0,Math.min(DURATION,Number(t)||0));seek.value=current;return frame(current,q)};
window.filmReady=true;$('loading').hidden=true;paint();requestAnimationFrame(tick);
