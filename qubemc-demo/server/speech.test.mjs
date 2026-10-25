import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createSpeechMiddleware,SPEECH_URL} from './speech.mjs';

const wav=Buffer.alloc(46);wav.write('RIFF');wav.write('WAVE',8);
async function invoke(middleware,body={text:'Hello Anne.'},headers={},method='POST') {
  const req=Readable.from([Buffer.from(typeof body==='string'?body:JSON.stringify(body))]);
  Object.assign(req,{url:'/api/speech',method,headers:{host:'localhost:5173','content-type':'application/json',...headers}});
  const res=new EventEmitter();res.writeHead=(status,h)=>{res.status=status;res.headers=h;};res.end=data=>{res.data=data;res.writableEnded=true;};
  await middleware(req,res,()=>{throw Error('Unexpected next');});return res;
}
test('speech calls only the pinned local Qwen endpoint with Ryan and returns WAV',async()=>{
  const middleware=createSpeechMiddleware({request:async(url,options)=>{
    assert.equal(url,SPEECH_URL);assert.equal(options.redirect,'error');assert.deepEqual(JSON.parse(options.body),{model:'tts-1',input:'Hello Anne.',voice:'Ryan',response_format:'wav'});
    return new Response(wav,{headers:{'content-type':'audio/wav'}});
  }});
  const result=await invoke(middleware);assert.equal(result.status,200);assert.equal(result.headers['Content-Type'],'audio/wav');assert.deepEqual(result.data,wav);
});
test('invalid origin, method, JSON and excessive input fail before inference',async()=>{
  const middleware=createSpeechMiddleware({request:()=>{throw Error('must not call');}});
  assert.equal((await invoke(middleware,{}, {origin:'https://foreign.test'})).status,403);
  assert.equal((await invoke(middleware,{}, {},'GET')).status,405);
  assert.equal((await invoke(middleware,{}, {'content-type':'text/plain'})).status,415);
  for(const body of ['{',{},null,{text:''},{text:'x'.repeat(8001)}])assert.equal((await invoke(middleware,body)).status,400);
  assert.equal((await invoke(middleware,{text:'x'.repeat(33000)})).status,413);
});
test('timeout aborts inference and malformed/failed upstream responses expose no upstream content',async()=>{
  const middleware=createSpeechMiddleware({timeout:5,request:async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('secret upstream failure'))))});
  const result=await invoke(middleware);assert.equal(result.status,504);assert.doesNotMatch(result.data,/secret/);
  for(const response of [new Response('not WAV'),new Response('secret',{status:500})]) {
    const res=await invoke(createSpeechMiddleware({request:async()=>response}));assert.equal(res.status,502);assert.doesNotMatch(res.data,/secret/);
  }
});
