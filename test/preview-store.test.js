import {test} from 'node:test';
import assert from 'node:assert/strict';
import {act,settle} from '../src/game.js';
import {createPreviewStore,PREVIEW_KEY} from '../src/preview-store.js';

function tabs(raw=null){
  let writes=0,queue=Promise.resolve();
  const storage={getItem:()=>raw,setItem:(key,value)=>{assert.equal(key,PREVIEW_KEY);raw=value;writes++;}};
  const locks={request:(_name,run)=>{const next=queue.then(run);queue=next.catch(()=>{});return next;}};
  const open=()=>createPreviewStore({storage:()=>storage,locks});
  return {open,get writes(){return writes;},get raw(){return raw;}};
}

test('preview tabs reload before edits and idle polling never rewrites the game',async()=>{
  const browser=tabs(),a=browser.open(),b=browser.open();
  b.read();
  await a.update(state=>act(state,'gideon','start',{revision:0},1000,()=>0));
  await a.update(state=>act(state,'gideon','theme',{revision:1,theme:'dragons'},1000));
  const move=(store,to)=>store.update(state=>act(state,'gideon','move',{revision:2,from:'e2',to},1000));
  const result=await Promise.allSettled([move(a,'e4'),move(b,'e3')]);
  assert.equal(result[0].status,'fulfilled');
  assert.match(result[1].reason.message,/game changed/);
  assert.equal(b.read().game.pending.move.to,'e4');
  await b.update(state=>settle(state,10999));
  assert.equal(browser.writes,3);
  await Promise.all([a.update(state=>settle(state,11000)),b.update(state=>settle(state,11000))]);
  assert.equal(browser.writes,4);
  assert.equal(JSON.parse(browser.raw).game.moves.length,1);
});

test('a corrupt saved board does not crash the page or get overwritten by a read',async()=>{
  const browser=tabs('{"revision":7,"game":{}}'),store=browser.open();
  assert.equal(store.read().game,null);
  assert.match(store.warning,/could not be opened/);
  await store.update(state=>settle(state));
  assert.equal(browser.writes,0);
  await store.update(state=>act(state,'gideon','start',{revision:0}));
  assert.equal(store.warning,'');
  assert.equal(browser.open().read().game.status,'choosing');
});

test('preview remains playable and reports unsaved progress when storage is blocked',async()=>{
  const store=createPreviewStore({storage:()=>{throw new Error('Storage blocked');}});
  await store.update(state=>act(state,'gideon','start',{revision:0}));
  assert.equal(store.read().game.status,'choosing');
  assert.match(store.warning,/can’t be saved/);
});
