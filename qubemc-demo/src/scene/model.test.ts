import test from 'node:test';
import assert from 'node:assert/strict';
import { planScene, nav, pathBetween } from './model.ts';
import { initialBoard } from '../board-state.ts';
import type { BoardState, BoardTask } from '../board-state.ts';
const directory=['manager','writer','designer','replacement'].map(id=>({id,name:id,role:id}));
const task=(id:string,ownerId:string,skill='copywriting'):BoardTask=>({id,ownerId,skill,title:id,status:'working',requirements:'brief',outputs:['draft'],dependencies:[],assignmentVersion:1,start:'09:00',end:'10:00',due:'10:00'});
const run=(tasks:BoardTask[]):BoardState=>({...initialBoard,phase:'active',runId:'run',projectOwnerId:'manager',tasks,leave:[]});
test('stays in building until a successful allocation, including setup failures',()=>{
 for(const phase of ['idle','planning'] as const)assert.equal(planScene(null,{...initialBoard,phase,error:'Failed'},directory).mode,'building');
 assert.equal(planScene(null,run([]),directory).mode,'building');
 assert.equal(planScene(null,run([task('copy','writer')]),directory).mode,'floor');
});
test('live IDs enter, unchanged snapshots do not replay assignments or invent deliveries',()=>{
 const state=run([task('copy','writer')]),input=JSON.stringify(state);
 const first=planScene(null,state,directory);
 assert.deepEqual(first.members.map(p=>p.id),['manager','writer']);
 assert.equal(first.moves[0].actorId,'writer');assert.equal(first.moves[0].kind,'assignment');
 assert.equal(planScene(state,structuredClone(state),directory).moves.length,0);
 assert.equal(JSON.stringify(state),input);
});
test('sick-leave owner leaves and PM receives escalation; replacement gets new handoff',()=>{
 const before=run([task('image','designer','graphic_design')]);
 const sick=structuredClone(before);sick.tasks[0].status='attention';sick.leave=[{employeeId:'designer',start:'13:00',end:'18:00'}];
 const scene=planScene(before,sick,directory);
 assert.equal(scene.fallback,false);assert.ok(scene.moves.some(m=>m.actorId==='designer'&&m.kind==='leave'));
 assert.ok(scene.moves.some(m=>m.actorId==='manager'&&m.kind==='escalation'));
 const replacement=structuredClone(sick);Object.assign(replacement.tasks[0],{ownerId:'replacement',assignmentVersion:2,status:'working'});
 const changed=planScene(sick,replacement,directory);
 assert.ok(changed.moves.some(m=>m.actorId==='replacement'&&m.key==='image:2:assign'));
 assert.ok(changed.members.find(p=>p.id==='designer')?.unavailable);
});
test('only actual completion delivers to dependency recipient; refresh and new run do not fabricate history',()=>{
 const before=run([task('copy','writer'),{...task('image','designer','graphic_design'),status:'ready',dependencies:['copy']}]);
 const after=structuredClone(before);after.tasks[0].status='done';
 assert.ok(planScene(before,after,directory).moves.some(m=>m.kind==='handoff'&&m.actorId==='writer'));
 assert.ok(!planScene(null,after,directory).moves.some(m=>m.kind==='handoff'));
 assert.ok(!planScene(before,{...after,runId:'new-run'},directory).moves.some(m=>m.kind==='handoff'));
});
test('unknown mappings, unknown IDs, manual ambient and runtime errors use decorative fallback without deliveries',()=>{
 for(const state of [run([task('x','writer','unknown_custom_skill')]),run([task('x','unknown-person')]),{...run([task('x','writer')]),error:'Transport failed'}]){
  const scene=planScene(null,state,directory);assert.equal(scene.mode,'floor');assert.equal(scene.fallback,true);assert.deepEqual(scene.moves,[]);
 }
 const manual=planScene(null,run([task('x','writer')]),directory,true);assert.equal(manual.fallback,true);assert.deepEqual(manual.moves,[]);
});
test('every seat and fallback corridor is reachable without teleporting across walls',()=>{
 for(const start of Object.keys(nav))for(const end of Object.keys(nav))if(start!==end){const path=pathBetween(start,end);assert.ok(path.length,`${start} to ${end}`);assert.equal(path.at(-1),end);}
 assert.deepEqual(pathBetween('missing','exit'),[]);
});
