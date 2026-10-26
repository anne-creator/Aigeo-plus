import test from 'node:test';
import assert from 'node:assert/strict';
import {allocationCacheKey} from './allocation-cache.mjs';
test('document, staffing facts, date and selector changes invalidate cached choices',()=>{
 const facts={document:'brief',employees:[{id:'A',skill:4}],bookings:[],day:'2026-10-26',selector:'d1'};
 const key=allocationCacheKey(facts);
 for(const changed of [{document:'new brief'},{employees:[{id:'A',skill:2}]},{bookings:[{id:'A',start:'13:00'}]},{day:'2026-10-27'},{selector:'llm'}])assert.notEqual(allocationCacheKey({...facts,...changed}),key);
 assert.equal(allocationCacheKey(structuredClone(facts)),key);
});
