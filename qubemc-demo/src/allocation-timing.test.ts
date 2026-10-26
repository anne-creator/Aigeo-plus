import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForAllocationAnimation,MIN_ALLOCATION_ANIMATION_MS} from './allocation-timing';

test('fast result waits for the remaining presentation time',async()=>{
 assert.equal(MIN_ALLOCATION_ANIMATION_MS,5000);
 let done=false;const wait=waitForAllocationAnimation(0,new AbortController().signal,()=>4980).then(()=>{done=true;});
 await Promise.resolve();assert.equal(done,false);await wait;assert.equal(done,true);
});
test('slow result is not held for another five seconds',async()=>{
 await waitForAllocationAnimation(0,new AbortController().signal,()=>7000);
});
test('cancelling during the hold prevents stale results from appearing',async()=>{
 const controller=new AbortController();const wait=waitForAllocationAnimation(0,controller.signal,()=>0);
 controller.abort();await assert.rejects(wait,{name:'AbortError'});
 await assert.rejects(waitForAllocationAnimation(0,controller.signal,()=>9000),{name:'AbortError'});
});
