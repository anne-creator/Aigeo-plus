import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {createServer as httpServer} from 'node:http';
const vite=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),server:{middlewareMode:true,watch:null,hmr:{server:httpServer()}},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});
try{
 const {project,company}=await vite.ssrLoadModule('/src/redbull-project.ts');
 assert.equal(project.document.content,await readFile(new URL('../data/projects/red-bull-x-launch/RED_BULL_X_LAUNCH_DEMO.md',import.meta.url),'utf8'));
 const {getBoardAdapter,configureRuntime}=await vite.ssrLoadModule('/src/redbull-agent.ts');
 globalThis.window={};assert.throws(()=>getBoardAdapter(),/not configured/);
 let received;
 window.cofloorBoardAgent={mode:'live',async *start(input){received=input;yield {id:'result',runId:input.runId,type:'progress',label:'Live'};}};
 for await(const e of getBoardAdapter().start({project,company,runId:'contract'},new AbortController().signal))assert.equal(e.id,'result');
 assert.equal(received.project.document.content,project.document.content);assert.equal(received.company.people.length,1000);
 console.log('Contract passed: original document, live adapter, no disconnected fallback.');
}finally{delete globalThis.window;await vite.close();}
