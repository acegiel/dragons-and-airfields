import {engine, initialState, PLAYERS} from './game.js';

export const PREVIEW_KEY='dragons-airfields-preview-v1';

function readSaved(raw){
  const state=JSON.parse(raw);
  const validPlayer=p=>PLAYERS.includes(p);
  const validTheme=t=>t==='dragons'||t==='airfield';
  const hasThemes=g=>PLAYERS.every(p=>validTheme(g.themes?.[p]))&&g.themes.gideon!==g.themes.grandpa;
  const hasMoves=g=>Array.isArray(g.moves)&&g.moves.every(m=>validPlayer(m?.player)&&typeof m.san==='string');
  if(!state||!Number.isSafeInteger(state.revision)||state.revision<0||!Array.isArray(state.history)||
    !PLAYERS.every(p=>typeof state.emails?.[p]==='string')||!state.history.every(h=>h&&validPlayer(h.white)&&
      (h.winner===null||validPlayer(h.winner))&&hasThemes(h)&&hasMoves(h)&&Number.isFinite(h.endedAt)))throw new Error('Invalid saved game');
  const game=state.game;
  if(game!==null){
    if(!game||!validPlayer(game.white)||!hasMoves(game)||typeof game.id!=='string'||
      !['choosing','active','over'].includes(game.status)||
      (game.status==='choosing'?!game.themes||game.moves.length!==0:!hasThemes(game))||
      (game.status==='over'&&(!game.result||(game.result.winner!==null&&!validPlayer(game.result.winner))))||
      (game.pending&&(game.status!=='active'||!validPlayer(game.pending.player)||!Number.isFinite(game.pending.readyAt)||!game.pending.move)))throw new Error('Invalid saved board');
    engine(game,Boolean(game.pending));
  }
  return state;
}

export function createPreviewStore({storage=()=>globalThis.localStorage,locks=globalThis.navigator?.locks}={}){
  let state=initialState(),rawSeen,warning='',unpersisted=false;
  function read(){
    try {
      const raw=storage().getItem(PREVIEW_KEY);
      if(raw!==rawSeen){
        rawSeen=raw;
        if(raw!==null){
          try {
            const saved=readSaved(raw);
            if(!unpersisted||saved.revision>state.revision){state=saved;warning='';unpersisted=false;}
          } catch {if(!unpersisted)warning='Saved preview could not be opened.';return state;}
        }
      }
      if(!unpersisted&&warning==='Progress can’t be saved in this browser.')warning='';
    } catch {warning='Progress can’t be saved in this browser.';}
    return state;
  }
  function update(fn){
    const run=()=>{
      read();const revision=state.revision;
      try{return fn(state);}
      finally{
        if(state.revision!==revision){
          try {
            const raw=JSON.stringify(state);
            storage().setItem(PREVIEW_KEY,raw);rawSeen=raw;warning='';unpersisted=false;
          } catch {warning='Progress can’t be saved in this browser.';unpersisted=true;}
        }
      }
    };
    return Promise.resolve().then(async()=>{
      if(!locks)return run();
      let started=false;
      try{return await locks.request(PREVIEW_KEY,()=>{started=true;return run();});}
      catch(error){if(started)throw error;return run();}
    });
  }
  return {read,update,get warning(){return warning;}};
}
