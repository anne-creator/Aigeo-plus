import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardReducer,initialBoard,restoreBoard,validateTasks,columns} from './board-state.ts';
import type {BoardRun,BoardState,BoardEvent} from './board-state.ts';
const ids=new Set(['EMP-0254','EMP-0308','EMP-0350']);
const run=():BoardRun=>({version:3,runId:'run1',source:'live',phase:'in_project',projectOwnerId:'EMP-0308',enteredAt:1000,channelId:'redbull-project',injection:{status:'waiting'},leave:[],reservations:[],messages:[],activity:['Assigned'],tasks:[
 {id:'write',title:'Write post',ownerId:'EMP-0254',due:'2 PM',start:'2026-10-26T13:00:00-07:00',end:'2026-10-26T14:00:00-07:00',skill:'social_copy',assignmentVersion:1,status:'ready',requirements:'Write a launch post',outputs:['post'],dependencies:[]},
 {id:'design',title:'Design image',ownerId:'EMP-0350',due:'3 PM',start:'2026-10-26T13:00:00-07:00',end:'2026-10-26T15:00:00-07:00',skill:'graphic_design',assignmentVersion:1,status:'ready',requirements:'Create launch image',outputs:['image'],dependencies:[]},
]});
const start=(id='run1')=>boardReducer(initialBoard,{type:'start',runId:id});
const emit=(s:BoardState,event:BoardEvent)=>boardReducer(s,{type:'event',event,employeeIds:ids});
const snapshot=(s:BoardState,value=run(),id='snapshot')=>emit(s,{id,runId:value.runId,type:'snapshot',run:value});
test('live allocation immediately enters project; dynamic tasks and attention counts',()=>{let s=snapshot(start());assert.equal(s.phase,'active');assert.equal(s.projectOwnerId,'EMP-0308');const r=run();r.tasks[1].status='attention';r.tasks[1].blockedReason='Sick leave';s=snapshot(s,r,'sick');assert.deepEqual(columns.map(c=>s.tasks.filter(t=>t.status===c.status).length),[1,0,1,0]);});
test('invalid employees or dependencies never replace valid tasks',()=>{const s=snapshot(start()),r=run();r.tasks[0].ownerId='wrong';const bad=snapshot(s,r,'bad');assert.ok(bad.error);assert.deepEqual(bad.tasks,s.tasks);const cycle=run().tasks;cycle[0].dependencies=['design'];cycle[1].dependencies=['write'];assert.throws(()=>validateTasks(cycle,ids));});
test('duplicate and previous-run snapshots cannot affect reset allocation',()=>{const s=snapshot(start());assert.equal(snapshot(s),s);const fresh=start('run2');assert.equal(snapshot(fresh),fresh);assert.equal(fresh.tasks.length,0);});
test('saved state preserves event status, never old v2 reference state',()=>{for(const status of ['waiting','received','analyzed'] as const){const r=run();r.injection.status=status;const s=snapshot(start(),r);const restored=restoreBoard(JSON.stringify(s),ids);assert.equal(restored.injection?.status,status);assert.equal(restored.operation,'idle');}assert.deepEqual(restoreBoard('{"version":2}',ids),initialBoard);assert.ok(restoreBoard(JSON.stringify(start()),ids).error);});
test('model errors do not create fixture allocations',()=>{const s=emit(start(),{id:'error',runId:'run1',type:'failed',message:'Model disconnected'});assert.equal(s.tasks.length,0);assert.equal(s.error,'Model disconnected');assert.equal(s.operation,'idle');});
