import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{ChessFamily} from '../backend/worker.js';
import {act} from '../src/game.js';

class MemoryStorage {
 constructor(){this.map=new Map();this.alarm=null;}
 async get(key){return this.map.has(key)?structuredClone(this.map.get(key)):undefined;}
 async put(key,value){this.map.set(key,structuredClone(value));}
 async setAlarm(time){this.alarm=time;}
 async deleteAlarm(){this.alarm=null;}
 async transaction(fn){return fn(this);}
}
async function household(){
 const storage=new MemoryStorage(),env={SETUP_SECRET:'test-secret',RESEND_API_KEY:'test-key',EMAIL_FROM:'Test <chess@example.com>',PUBLIC_PAGE_URL:'https://example.github.io/chess/',API_URL:'https://chess.example.com'};
 const family=new ChessFamily({storage},env);
 const setup=await family.fetch(new Request(env.API_URL+'/admin/setup',{method:'POST',headers:{Authorization:'Bearer test-secret'}}));
 assert.equal(setup.status,200);const{links}=await setup.json();
 const keys=Object.fromEntries(Object.entries(links).map(([p,l])=>[p,new URLSearchParams(new URL(l).hash.slice(1)).get('key')]));
 const request=(p,action,data={})=>family.fetch(new Request(env.API_URL+(action?'/api/action':'/api/state'),{method:action?'POST':'GET',headers:{Authorization:'Bearer '+keys[p],...(action?{'Content-Type':'application/json'}:{})},body:action?JSON.stringify({action,...data}):undefined}));
 const room=await storage.get('room');act(room.state,'gideon','start',{revision:0},Date.now(),()=>0);act(room.state,'gideon','theme',{revision:1,theme:'dragons'});await storage.put('room',room);
 return{storage,env,family,keys,request,links};
}
test('private authentication and CORS protect the family game',async()=>{
 const h=await household();const bad=await h.family.fetch(new Request(h.env.API_URL+'/api/state'));assert.equal(bad.status,401);
 const ok=await h.request('gideon');assert.equal((await ok.json()).player,'gideon');
 const denied=await worker.fetch(new Request(h.env.API_URL+'/api/state',{headers:{Origin:'https://bad.example'}}),h.env);assert.equal(denied.status,403);
 assert.notEqual(h.keys.gideon,h.keys.grandpa);assert.equal(h.keys.gideon.length,43);
});
test('concurrent actions allow exactly one move',async()=>{
 const h=await household();const results=await Promise.all([h.request('gideon','move',{revision:2,from:'e2',to:'e4'}),h.request('gideon','move',{revision:2,from:'d2',to:'d4'})]);
 assert.deepEqual(results.map(r=>r.status),[200,409]);
});
test('durable alarm commits after closing the page and sends one email',async()=>{
 const h=await household();await h.request('gideon','move',{revision:2,from:'e2',to:'e4'});
 const room=await h.storage.get('room');room.state.game.pending.readyAt=Date.now()-1;await h.storage.put('room',room);
 const originalFetch=globalThis.fetch,calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url,opts});return Response.json({id:'mock-mail'});};
 try{
  const restarted=new ChessFamily({storage:h.storage},h.env);await restarted.alarm();await restarted.alarm();
  assert.equal(calls.length,1);const email=JSON.parse(calls[0].opts.body);assert.deepEqual(email.to,['acegielski@gmail.com']);assert.match(email.text,/e4/);assert.match(email.text,new RegExp(h.keys.grandpa));assert.equal(calls[0].opts.headers['Idempotency-Key'].startsWith('chess-'),true);
  const final=await h.storage.get('room');assert.equal(final.state.game.moves.length,1);assert.equal(final.state.game.pending,null);assert.equal(final.outbox.length,0);
 }finally{globalThis.fetch=originalFetch;}
});
test('undone moves never enter the mail outbox',async()=>{
 const h=await household();await h.request('gideon','move',{revision:2,from:'e2',to:'e4'});await h.request('gideon','undo',{revision:3});await h.family.alarm();
 const room=await h.storage.get('room');assert.equal(room.state.game.moves.length,0);assert.equal(room.outbox.length,0);assert.equal(h.storage.alarm,null);
});
test('email failures retain an idempotent retry without losing the move',async()=>{
 const h=await household();await h.request('gideon','move',{revision:2,from:'e2',to:'e4'});const room=await h.storage.get('room');room.state.game.pending.readyAt=Date.now()-1;await h.storage.put('room',room);
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:503});
 try{await h.family.alarm();const final=await h.storage.get('room');assert.equal(final.state.game.moves.length,1);assert.equal(final.outbox.length,1);assert.equal(final.outbox[0].attempts,1);assert.ok(h.storage.alarm>Date.now());}finally{globalThis.fetch=originalFetch;}
});
