import { useEffect, useRef, useState } from 'react';
import type { BoardState } from '../board-state';
import { company } from '../redbull-project';
import { NightCity } from '../NightCity';
import { planScene } from './model';
import { createSceneEngine } from './engine';
import { shouldEnterFloor } from './arrival';
import officeArt from './assets/office.jpg';
import './scene.css';
export function ProjectScene({state,playing,ambient,onSelect}:{state:BoardState;playing:boolean;ambient:boolean;onSelect:(id:string)=>void}) {
  const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<ReturnType<typeof createSceneEngine>|null>(null),previous=useRef<BoardState|null>(null);
  const [failed,setFailed]=useState(false),[artFailed,setArtFailed]=useState(false);
  const [entering,setEntering]=useState(false);
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const active=state.phase==='active'&&state.tasks.length>0;
  const scene=planScene(previous.current,state,company.people,ambient||artFailed);
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);media.addEventListener('change',change);return ()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{
    let disposed=false;
    try {engine.current=createSceneEngine(canvas.current!,company.people.length,()=>{if(!disposed)setArtFailed(true);},()=>{if(!disposed)setFailed(true);},value=>{if(!disposed)setEntering(value);});}
    catch {setFailed(true);return;}
    const image=new Image();image.onload=()=>{if(!disposed)engine.current?.setArt(image);};image.onerror=()=>{if(!disposed)engine.current?.setArt(null,true);};image.src=officeArt;
    return ()=>{disposed=true;image.onload=null;image.onerror=null;engine.current?.destroy();engine.current=null;};
  },[]);
  useEffect(()=>{engine.current?.apply(scene,shouldEnterFloor(previous.current,state)&&!failed);previous.current=state;},[state,ambient,artFailed]);
  useEffect(()=>engine.current?.setPlayback(playing,reduced),[playing,reduced]);
  return <>
    <div className={`workspace-background project-scene ${!playing||reduced?'is-still':''}`} data-scene-mode={active&&!entering?'floor':'building'} data-scene-transition={entering?'entering':'idle'} data-scene-motion={failed||scene.fallback?'ambient':'project'}>
      {failed?<><NightCity/>{active&&<div className="ambient-crowd" aria-hidden="true">{Array.from({length:6},(_,i)=><i key={i} style={{'--person':i} as React.CSSProperties}/>)}</div>}</>:<canvas ref={canvas} className="scene-canvas" role="img" aria-label={active?'Project office with assigned employee avatars. Decorative positions, not physical tracking.':'Company headquarters with 93 floors and 1,000 illustrative employee avatars.'} onClick={e=>{const id=engine.current?.pick(e.clientX,e.clientY);if(id)onSelect(id);}}/>}
    </div>
    <div className="scene-caption"><span>{entering?'ENTERING F90':active?'F90 · PROJECT FLOOR':'HQ · 93 FLOORS'}</span>{active&&!entering&&(failed||scene.fallback)&&<span className="ambient-label">Ambient motion</span>}</div>
  </>;
}
