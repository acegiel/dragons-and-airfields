import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{ChessFamily} from '../backend/worker.js';
import {act} from '../src/game.js';

class MemoryStorage {
 constructor(){this.map=new Map();this.alarm=null;this.writes=0;}
 async get(key){return this.map.has(key)?structuredClone(this.map.get(key)):undefined;}
 async put(key,value){this.writes++;this.map.set(key,structuredClone(value));}
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
test('polling never confirms a pending move or schedules a release',async()=>{
 const h=await household();await h.request('gideon','move',{revision:2,from:'e2',to:'e4'});
 const alarm=h.storage.alarm,writes=h.storage.writes;
 const response=await h.request('grandpa'),state=await response.json();
 assert.equal(response.status,200);assert.equal(alarm,null);assert.equal(state.game.moves.length,0);assert.equal(state.game.pending.move,undefined);
 assert.equal(h.storage.alarm,alarm);assert.equal(h.storage.writes,writes);
});
test('confirmation queues one durable email even after closing the page',async()=>{
 const h=await household();await h.request('gideon','move',{revision:2,from:'e2',to:'e4'});
 assert.equal((await h.request('gideon','confirm',{revision:3})).status,200);
 const originalFetch=globalThis.fetch,calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url,opts});return Response.json({id:'mock-mail'});};
 try{
  const restarted=new ChessFamily({storage:h.storage},h.env);await restarted.alarm();await restarted.alarm();
  assert.equal(calls.length,1);const email=JSON.parse(calls[0].opts.body);assert.deepEqual(email.to,['acegielski@gmail.com']);assert.match(email.text,/e4/);assert.match(email.text,new RegExp(h.keys.grandpa));assert.equal(calls[0].opts.headers['Idempotency-Key'].startsWith('chess-'),true);
  const final=await h.storage.get('room');assert.equal(final.state.game.moves.length,1);assert.equal(final.state.game.pending,null);assert.equal(final.outbox.length,0);
 }finally{globalThis.fetch=originalFetch;}
});
test('changed moves never enter the mail outbox',async()=>{
 const h=await household();await h.request('gideon','move',{revision:2,from:'e2',to:'e4'});await h.request('gideon','change-move',{revision:3});await h.family.alarm();
 const room=await h.storage.get('room');assert.equal(room.state.game.moves.length,0);assert.equal(room.outbox.length,0);assert.equal(h.storage.alarm,null);
});
test('email failures retain an idempotent retry without losing the move',async()=>{
 const h=await household();await h.request('gideon','move',{revision:2,from:'e2',to:'e4'});assert.equal((await h.request('gideon','confirm',{revision:3})).status,200);
 const originalFetch=globalThis.fetch,calls=[];globalThis.fetch=async(url,opts)=>{calls.push(opts);return new Response('',{status:calls.length===1?503:200});};
 try {
  await h.family.alarm();const failed=await h.storage.get('room');
  assert.equal(failed.state.game.moves.length,1);assert.equal(failed.outbox.length,1);assert.equal(failed.outbox[0].attempts,1);assert.ok(h.storage.alarm>Date.now());
  const edit=await h.request('grandpa','email',{revision:4,email:'new@example.com'});assert.equal(edit.status,200);
  const retry=await h.storage.get('room');retry.outbox[0].nextAttempt=Date.now()-1;await h.storage.put('room',retry);
  await new ChessFamily({storage:h.storage},h.env).alarm();
  assert.equal(calls.length,2);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);assert.equal(calls[0].body,calls[1].body);
  const final=await h.storage.get('room');assert.equal(final.state.emails.grandpa,'new@example.com');assert.equal(final.outbox.length,0);assert.equal(h.storage.alarm,null);
 } finally {globalThis.fetch=originalFetch;}
});
test('a slow email does not block the next move or overwrite it later',async()=>{
 const h=await household();await h.request('gideon','move',{revision:2,from:'e2',to:'e4'});
 assert.equal((await h.request('gideon','confirm',{revision:3})).status,200);
 const originalFetch=globalThis.fetch;
 let started,finish,timer;
 const startedSending=new Promise(resolve=>{started=resolve;}),sending=new Promise(resolve=>{finish=resolve;});
 globalThis.fetch=()=>{started();return sending;};
 const alarm=h.family.alarm();
 try {
  await startedSending;
  const response=await Promise.race([
   h.request('grandpa','move',{revision:4,from:'e7',to:'e5'}),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Move waited for email delivery')),1000);})
  ]);
  assert.equal(response.status,200);
  const pending=(await response.json()).game.pending;assert.equal(pending.move.to,'e5');
  finish(new Response('',{status:503}));await alarm;
  const final=await h.storage.get('room');assert.deepEqual(final.state.game.pending,pending);assert.equal(final.outbox.length,0);assert.equal(h.storage.alarm,null);
 } finally {clearTimeout(timer);finish(new Response('',{status:200}));await alarm;globalThis.fetch=originalFetch;}
});

test('alarms and reloads never release an unconfirmed move, including legacy timers',async()=>{
 const h=await household();await h.request('gideon','move',{revision:2,from:'e2',to:'e4'});
 const room=await h.storage.get('room');room.state.game.pending.readyAt=Date.now()-86400000;await h.storage.put('room',room);
 const restarted=new ChessFamily({storage:h.storage},h.env);await restarted.alarm();
 const state=await (await h.request('gideon')).json();
 assert.equal(state.game.moves.length,0);assert.equal(state.game.pending.move.to,'e4');assert.equal(h.storage.alarm,null);
 assert.equal((await h.request('grandpa','confirm',{revision:3})).status,403);
 const results=await Promise.all([h.request('gideon','confirm',{revision:3}),h.request('gideon','confirm',{revision:3})]);
 assert.deepEqual(results.map(r=>r.status),[200,409]);
 const final=await h.storage.get('room');assert.equal(final.state.game.moves.length,1);assert.equal(final.outbox.length,1);
});
