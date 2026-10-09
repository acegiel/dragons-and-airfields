import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const page=await readFile(new URL('../index.html',import.meta.url));
const port=Number(process.env.CHESS_PREVIEW_PORT||4173);
createServer((req,res)=>{if(!['/','/index.html','/favicon.ico'].includes(req.url.split('?')[0])){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(page);}).listen(port,'0.0.0.0',()=>console.log(`Chess preview: http://localhost:${port}`));
