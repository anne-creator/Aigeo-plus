import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelMiddleware } from './model.mjs';
import { boardMiddleware } from './board.mjs';
import { nemoclawMiddleware } from './nemoclaw-discord.mjs';
import { faceMiddleware } from './face.mjs';
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' };
const server = createServer((req,res)=>modelMiddleware(req,res,()=>boardMiddleware(req,res,()=>nemoclawMiddleware(req,res,()=>faceMiddleware(req,res,async()=>{
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);return res.end();}
  try {
    const path = resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (path !== resolve(dist) && !path.startsWith(resolve(dist) + '/')) {res.writeHead(403);return res.end();}
    let file=path;try{if(!(await stat(file)).isFile())file=resolve(dist,'index.html');}catch{file=resolve(dist,'index.html');}
    const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('Build the frontend first: npm run build');}
})))));
server.listen(Number(process.env.PORT||5173),'127.0.0.1',()=>console.log(`CoFloor: http://127.0.0.1:${server.address().port}`));
