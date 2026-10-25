import { useEffect, useRef, useState } from 'react';
import type { BoardState } from '../board-state';
import { company } from '../redbull-project';
import { NightCity } from '../NightCity';
import { planScene } from './model';
import { createSceneEngine } from './engine';
import { shouldEnterFloor } from './arrival';
import officeArt from './assets/office.jpg';
import './scene.css';
export function ProjectScene({state,playing,ambient,onSelect,onReady,enterRunId}:{state:BoardState;playing:boolean;ambient:boolean;onSelect:(id:string)=>void;onReady?:(runId:string)=>void;enterRunId?:string}) {
  const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<ReturnType<typeof createSceneEngine>|null>(null),previous=useRef<BoardState|null>(null);
  const latest=useRef({state,onReady}), arrivalRun=useRef(''), handledEntry=useRef('');
  latest.current={state,onReady};
  const [failed,setFailed]=useState(false),[artFailed,setArtFailed]=useState(false);
  const [entering,setEntering]=useState(false);
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const active=state.phase==='active'&&state.tasks.length>0;
  const scene=planScene(previous.current,state,company.people,ambient||artFailed);
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);media.addEventListener('change',change);return ()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{
    let disposed=false;
    try {engine.current=createSceneEngine(canvas.current!,company.people.length,()=>{if(!disposed)setArtFailed(true);},()=>{if(!disposed)setFailed(true);},value=>{if(!disposed){setEntering(value);if(value)arrivalRun.current=latest.current.state.runId;else latest.current.onReady?.(arrivalRun.current);}});}
    catch {setFailed(true);return;}
    const image=new Image();image.onload=()=>{if(!disposed)engine.current?.setArt(image);};image.onerror=()=>{if(!disposed)engine.current?.setArt(null,true);};image.src=officeArt;
    return ()=>{disposed=true;image.onload=null;image.onerror=null;engine.current?.destroy();engine.current=null;};
  },[]);
  useEffect(()=>engine.current?.setPlayback(playing,reduced),[playing,reduced]);
  useEffect(()=>{
    const requestedEntry=active&&enterRunId===state.runId&&handledEntry.current!==state.runId;
    const enter=requestedEntry||shouldEnterFloor(previous.current,state);
    if(active)handledEntry.current=state.runId;
    engine.current?.apply(scene,enter&&!failed);
    previous.current=state;
    if(active&&(failed||!engine.current?.isEntering()))latest.current.onReady?.(state.runId);
  },[state,ambient,artFailed,failed,enterRunId]);
  return <>
    <div className={`workspace-background project-scene ${!playing||reduced?'is-still':''}`} data-scene-mode={active&&!entering?'floor':'building'} data-scene-transition={entering?'entering':'idle'} data-scene-motion={failed||scene.fallback?'ambient':'project'}>
      {failed?<><NightCity/>{active&&<div className="ambient-crowd" aria-hidden="true">{Array.from({length:6},(_,i)=><i key={i} style={{'--person':i} as React.CSSProperties}/>)}</div>}</>:<canvas ref={canvas} className="scene-canvas" role="img" aria-label={active?'Project office with assigned employee avatars. Decorative positions, not physical tracking.':'Company headquarters with 93 floors and 1,000 illustrative employee avatars.'} onClick={e=>{const id=engine.current?.pick(e.clientX,e.clientY);if(id)onSelect(id);}}/>}
    </div>
    <div className="scene-caption"><span>{entering?'ENTERING F90':active?'F90 · PROJECT FLOOR':'HQ · 93 FLOORS'}</span>{active&&!entering&&(failed||scene.fallback)&&<span className="ambient-label">Ambient motion</span>}</div>
  </>;
}
