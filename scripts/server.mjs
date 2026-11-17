import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {refreshOne} from './refresh.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));const port=Number(process.env.PORT||4173);
const cache=new Map();const pending=new Map();const TTL={housing:300000,alerts:300000,ocean:21600000,erfen:86400000,exposure:86400000};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json; charset=utf-8','.csv':'text/csv; charset=utf-8','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 try{const url=new URL(req.url,'http://localhost');if(req.method!=='GET'){res.writeHead(405);return res.end('Method not allowed');}
  if(url.pathname==='/api/status'){res.setHeader('Content-Type',types['.json']);return res.end(JSON.stringify({local:true,version:1}));}
  if(url.pathname.startsWith('/api/')){const name=url.pathname.slice(5);if(!Object.hasOwn(TTL,name)){res.writeHead(404);return res.end();}const old=cache.get(name);let data;
   if(old&&Date.now()-old.at<TTL[name])data=old.value;
   else{if(!pending.has(name))pending.set(name,refreshOne(name).then(value=>{cache.set(name,{at:Date.now(),value});return value;}).finally(()=>pending.delete(name)));data=await pending.get(name);}
   res.setHeader('Content-Type',types['.json']);res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(data));
  }
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
  if(relative.split('/').some(part=>part==='..'||part.startsWith('.'))){res.writeHead(404);return res.end('Not found');}
  if(!/^(index\.html|styles\.css|app\.mjs|(?:data|assets|src)\/[a-zA-Z0-9_.\/-]+)$/.test(relative)){res.writeHead(404);return res.end('Not found');}
  const target=path.resolve(root,relative);if(!target.startsWith(root)){res.writeHead(403);return res.end();}const body=await fs.readFile(target);res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(body);
 }catch(e){const missing=e.code==='ENOENT';res.writeHead(missing?404:502,{'Content-Type':types['.json']});res.end(JSON.stringify({error:missing?'Archivo no encontrado':e.message}));}
});
server.listen(port,'127.0.0.1',()=>console.log(`SENTINELA · Local: http://127.0.0.1:${port}`));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>process.exit(0)));
