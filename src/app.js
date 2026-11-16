import {Chess} from 'chess.js';
import {act, view, engine, NAMES, other, playerForColor} from './game.js';
import {pieceArt, scene, SYMBOLS, PIECE_NAMES, THEME_NAMES, ROLES} from './art.js';
import {createPreviewStore, PREVIEW_KEY} from './preview-store.js';

const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.hash.slice(1));
const api=params.get('api')||document.querySelector('meta[name="api-url"]').content;
const key=params.get('key')||'';
const live=Boolean(api||key);
const preview=live?null:createPreviewStore();
let player='gideon', snapshot=null, selected=null, legal=[], orientation='w', rotated=false, busy=false, toastTimer, promoting=null, offline=false;
let activeRead=null, connectionMessage='', lastStorageWarning='';
let activeSquare='e2';
let cachedGame, committedBoard, pendingBoard;
function boardFor(includePending=false){
  const game=snapshot?.game??null;
  if(cachedGame!==game){cachedGame=game;committedBoard=game?engine(game):new Chess();pendingBoard=null;}
  if(includePending&&game?.pending?.move)return pendingBoard??=engine(game,true);
  return committedBoard;
}
const chessForView=()=>boardFor(true);
const currentTurn=game=>playerForColor(game,boardFor().turn());
const themeForColor=color=>snapshot?.game?.themes?.[playerForColor(snapshot.game,color)]||(color==='w'?'dragons':'airfield');
const colorForPlayer=p=>snapshot?.game?.white===p?'w':'b';
function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function dialog(id){if(!$(id).open)$(id).showModal();}
function focusSelector(){
  const element=document.activeElement;
  if(element?.id)return `#${CSS.escape(element.id)}`;
  for(const key of ['square','action','player','theme'])if(element?.dataset?.[key])return `[data-${key}="${CSS.escape(element.dataset[key])}"]`;
  if(element?.matches('#email-form button[type="submit"]'))return '#email-form button[type="submit"]';
  return null;
}
function restoreFocus(selector){
  const active=document.activeElement,activeDialog=active?.closest('dialog');
  if(!selector||(active!==document.body&&!(activeDialog&&!activeDialog.open)))return;
  let target=document.querySelector(selector);
  const modal=document.querySelector('dialog[open]');
  const targetDialog=target?.closest('dialog');
  if(target?.disabled||!target?.isConnected||!target?.getClientRects().length||(targetDialog&&!targetDialog.open))target=null;
  if(modal){if(!target||!modal.contains(target))target=modal.querySelector('button:not(:disabled),input:not(:disabled)');}
  else target ||= document.querySelector('#turn-card .primary:not(:disabled)')||document.querySelector(`[data-square="${activeSquare}"]`);
  target?.focus({preventScroll:true});
}
function updateEmailButton(){$('email-form').querySelector('button[type="submit"]').disabled=busy||offline||!snapshot;}
function setBusy(value){busy=value;$('board').setAttribute('aria-busy',String(value));document.querySelectorAll('[data-action],.theme-choice,.promotion-choice,#resign-button,#confirm-resign').forEach(b=>b.disabled=value||offline);updateEmailButton();}
class RequestError extends Error {
  constructor(message,status,state){super(message);this.status=status;this.state=state;}
}
async function request(path, data, signal){
  if(!api||!key) throw new RequestError('Open your private player link to join.',401);
  let service;
  try {service=new URL(api);} catch {throw new RequestError('This player link has an invalid game address.',400);}
  if(service.protocol!=='https:' && !(service.protocol==='http:'&&['localhost','127.0.0.1'].includes(service.hostname))) throw new RequestError('The game service address must use HTTPS.',400);
  const controller=new AbortController(),abort=()=>controller.abort();
  if(signal?.aborted)abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(abort,12000);
  try {
    const result=await fetch(new URL(path,service),{method:data?'POST':'GET',headers:{Authorization:`Bearer ${key}`,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,cache:'no-store',redirect:'error',signal:controller.signal});
    const json=await result.json().catch(()=>null);
    if(!result.ok)throw new RequestError(json?.error||'The game service is unavailable.',result.status,json?.state);
    if(!validSnapshot(json))throw new Error('Unrecognized game response');
    return json;
  } finally {clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
function validSnapshot(data){return data&&Object.hasOwn(NAMES,data.player)&&Number.isSafeInteger(data.revision)&&Number.isFinite(data.serverNow)&&data.stats&&Array.isArray(data.history)&&(data.game===null||Array.isArray(data.game?.moves));}
function applySnapshot(data){
  if(live&&snapshot&&data.revision<snapshot.revision)return;
  const previous=snapshot?.game;
  const changed=!snapshot||snapshot.revision!==data.revision||snapshot.player!==data.player||snapshot.emailWarning!==data.emailWarning||offline||(!live&&lastStorageWarning!==preview.warning);
  snapshot=data;player=data.player;offline=false;
  if(!live)lastStorageWarning=preview.warning;
  updateEmailButton();
  if(!changed)return;
  if(!rotated) orientation=snapshot.game?(colorForPlayer(player)):'w';
  if(previous?.id!==data.game?.id||previous?.status!==data.game?.status||previous?.moves.length!==data.game?.moves.length||JSON.stringify(previous?.pending)!==JSON.stringify(data.game?.pending)){
    selected=null;legal=[];promoting=null;
    if($('promotion-dialog').open)$('promotion-dialog').close();
  }
  render();
}
function showConnectionError(error){
  connectionMessage=error instanceof RequestError?error.message:'Couldn’t reach the game. Try reconnecting.';
  offline=true;selected=null;legal=[];
  if($('promotion-dialog').open)$('promotion-dialog').close();
  if($('confirm-dialog').open)$('confirm-dialog').close();
  updateEmailButton();render();
}
function refresh(){
  if(busy||activeRead)return;
  const read={controller:new AbortController()};activeRead=read;
  return (async()=>{
    try {
      const data=live?await request('/api/state',undefined,read.controller.signal):view(preview.read(),player);
      if(activeRead===read&&!busy)applySnapshot(data);
    } catch(e){if(live&&activeRead===read&&!busy)showConnectionError(e);}
    finally{if(activeRead===read)activeRead=null;}
  })();
}
async function action(name,data={}){
  if(busy||offline||!snapshot)return false;
  const focus=focusSelector();
  if(live&&activeRead){activeRead.controller.abort();activeRead=null;}
  const revision=snapshot.revision;
  let reconcile=false;
  setBusy(true);selected=null;legal=[];renderBoard();
  try {
    if(live) applySnapshot(await request('/api/action',{action:name,revision,...data}));
    else {
      const actor=player;
      await preview.update(state=>{
        act(state,actor,name,{revision,...data});
      });
      applySnapshot(view(preview.read(),player));
    }
    if(name==='move')notify('Check your move, then select End turn.');
    if(name==='confirm')notify('Turn ended.');
    if(name==='change-move')notify('Choose a different move.');
    if(name==='email')notify(live?'Reminder email saved.':'Preview email saved. No email is sent in this preview.');
    return true;
  } catch(e){
    let message=e.message;
    if(!live)applySnapshot(view(preview.read(),player));
    else if(validSnapshot(e.state))applySnapshot(e.state);
    else {reconcile=true;showConnectionError(e);message='Couldn’t confirm that change. Check the game before trying again.';}
    notify(message);
    if(name==='email'){$('email-error').textContent=message;$('email-error').hidden=false;}
    return false;
  }
  finally{setBusy(false);renderTurn();restoreFocus(focus);if(reconcile)refresh();}
}
function canMove(){const game=snapshot?.game;return !busy&&!offline&&game?.status==='active'&&!game.pending&&currentTurn(game)===player;}
function renderBanner(){
  if(live){$('mode-banner').innerHTML=`<div class="connection ${offline?'sync-error':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11V7a6 6 0 0 1 12 0v4M4 11h16v11H4Z"/></svg><span>${offline?'Game disconnected':snapshot?`Private board for <strong>${NAMES[player]}</strong>`:'Opening private board…'}</span></div>${snapshot?'<span>Bookmark this player link.</span>':''}`;}
  else{$('mode-banner').innerHTML=`<div class="preview-label"><strong>Local preview</strong><small>${escape(preview.warning||'Try both players on this device. Online play and email need setup.')}</small></div><div class="role-switch" aria-label="Preview player">${['gideon','grandpa'].map(p=>`<button data-player="${p}" aria-pressed="${player===p}" class="${player===p?'active':''}">${NAMES[p]}</button>`).join('')}</div>`;document.querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>{if(busy||player===b.dataset.player)return;player=b.dataset.player;selected=null;legal=[];rotated=false;applySnapshot(view(preview.read(),player));});}
}
function renderPlayer(p,id){
  const game=snapshot?.game;const color=game?colorForPlayer(p):(p===player?'w':'b');
  const theme=game?.themes[p]||(color==='w'?'dragons':'airfield');
  const captured=game?boardFor().history({verbose:true}).filter(m=>m.color===color&&m.captured).map(m=>SYMBOLS[m.captured]).join(''):'';
  $(id).innerHTML=`<div class="avatar">${pieceArt('k',theme,color,false)}</div><div class="player-info"><div class="player-name">${NAMES[p]}${p===player?'<small>YOU</small>':''}</div><div class="player-detail"><span class="side-stone ${color==='b'?'black':''}" aria-hidden="true"></span>${game?.themes[p]?`${color==='w'?'White':'Black'} · ${THEME_NAMES[theme]}`:'Game not started'}</div></div><span class="captured" aria-label="Captured pieces">${captured}</span>`;
}
function renderBoard(){
  const chess=chessForView(),game=snapshot?.game;
  const files=orientation==='w'?'abcdefgh':'hgfedcba',ranks=orientation==='w'?'87654321':'12345678';
  const last=game?.pending?.move||game?.moves.at(-1),focus=document.activeElement?.dataset?.square,inCheck=chess.isCheck();
  let html='';
  for(const rank of ranks)for(const file of files){
    const square=file+rank,piece=chess.get(square),dark=(file.charCodeAt(0)-97+Number(rank))%2===1;
    const checked=inCheck&&piece?.type==='k'&&piece.color===chess.turn();
    const label=piece?`${square}, ${piece.color==='w'?'white':'black'} ${PIECE_NAMES[piece.type]}, ${ROLES[themeForColor(piece.color)][piece.type]}`:`${square}, empty`;
    const mark=last?.from===square?'last-move latest-from':last?.to===square?'last-move latest-to':'';
    const squareLabel=label+(mark?(last.from===square?', last move from here':', last move to here'):'')+(checked?', in check':'');
    html+=`<button type="button" class="square ${dark?'dark':''} ${piece?'occupied':''} ${mark} ${selected===square?'selected':''} ${legal.some(m=>m.to===square)?'legal':''} ${checked?'checked':''}" data-square="${square}" aria-label="${escape(squareLabel)}" aria-pressed="${selected===square}" tabindex="${square===activeSquare?'0':'-1'}" title="${escape(label)}">${piece?pieceArt(piece.type,themeForColor(piece.color),piece.color):''}</button>`;
  }
  $('board').innerHTML=html;
  $('file-labels').innerHTML=[...files].map(x=>`<span>${x}</span>`).join('');$('rank-labels').innerHTML=[...ranks].map(x=>`<span>${x}</span>`).join('');
  $('board').querySelectorAll('[data-square]').forEach(b=>{b.onclick=()=>selectSquare(b.dataset.square);b.onkeydown=e=>navigateBoard(e,b.dataset.square,files,ranks);});
  if(focus)$('board').querySelector(`[data-square="${focus}"]`)?.focus({preventScroll:true});
  document.querySelector('.board-stage').classList.toggle('awaiting',!game||game.status==='choosing');
}
function navigateBoard(e,square,files,ranks){
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(e.key==='Escape'){selected=null;legal=[];renderBoard();return;}
  if(!directions[e.key])return;e.preventDefault();
  const [dx,dy]=directions[e.key];let x=files.indexOf(square[0]),y=ranks.indexOf(square[1]);x=Math.max(0,Math.min(7,x+dx));y=Math.max(0,Math.min(7,y+dy));activeSquare=files[x]+ranks[y];
  $('board').querySelectorAll('button').forEach(b=>b.tabIndex=b.dataset.square===activeSquare?0:-1);$('board').querySelector(`[data-square="${activeSquare}"]`).focus();
}
function selectSquare(square){
  activeSquare=square;
  if(!canMove()){if(!offline&&snapshot?.game?.pending?.player===player)notify('Select Change move to choose a different move.');return;}
  const chess=chessForView(),piece=chess.get(square),possible=legal.filter(m=>m.to===square);
  if(selected&&possible.length){
    if(possible.some(m=>m.promotion)){promoting={from:selected,to:square};renderPromotion();dialog('promotion-dialog');}
    else action('move',{from:selected,to:square});return;
  }
  if(selected===square){selected=null;legal=[];}
  else if(piece?.color===chess.turn()){selected=square;legal=chess.moves({square,verbose:true});}
  else{if(selected)notify('Choose a highlighted square.');selected=null;legal=[];}
  renderBoard();
}
function renderPromotion(){
  const color=colorForPlayer(player),theme=snapshot.game.themes[player];
  $('promotion-options').innerHTML=['q','r','b','n'].map(type=>`<button class="promotion-choice" data-promote="${type}">${pieceArt(type,theme,color)}${PIECE_NAMES[type]}</button>`).join('');
  document.querySelectorAll('[data-promote]').forEach(b=>b.onclick=()=>{$('promotion-dialog').close();action('move',{...promoting,promotion:b.dataset.promote});promoting=null;});
}
function renderTurn(){
  const focus=focusSelector();
  const game=snapshot?.game,chess=chessForView();let html='',yourTurn=false;
  if(offline)html=`<span class="eyebrow">CONNECTION</span><h2>${snapshot?'Game disconnected':'Unable to open game'}</h2><p>${escape(connectionMessage)}</p><button class="primary" id="reconnect">Reconnect</button>`;
  else if(live&&!snapshot)html='<h2>Opening your board…</h2>';
  else if(!game){html=`<span class="eyebrow">NEW GAME</span><h2>Start a game</h2><p>The coin flip decides who moves first and chooses a theme.</p><button class="primary" data-action="start">Flip the coin</button>`;}
  else if(game.status==='choosing'){
    html=`<span class="eyebrow">COIN FLIP</span><h2>${game.white===player?'Choose your pieces':`Waiting for ${NAMES[game.white]}`}</h2><p>${NAMES[game.white]} won the coin flip and plays white.</p>${game.white===player?'<button class="primary" id="choose-theme">Choose a theme</button>':''}`;
  }else if(game.status==='over'){
    html=`<span class="eyebrow">GAME OVER</span><h2>${game.result.winner?`${NAMES[game.result.winner]} wins`:'Draw'}</h2><p>${escape(game.result.reason)}.</p><button class="primary" data-action="start">Play again · Flip the coin</button>`;
  }else if(game.pending){
    const own=game.pending.player===player,move=game.pending.move;
    html=`<span class="eyebrow">${own?'REVIEW YOUR MOVE':'WAITING'}</span><h2>${own?'End your turn?':`Waiting for ${NAMES[game.pending.player]}`}</h2><p>${own&&move?`${escape(move.from)} → ${escape(move.to)}${move.promotion?` · ${PIECE_NAMES[move.promotion]}`:''}. End your turn to lock in this move.`:'Their move will appear when they end their turn.'}</p>${own?'<div class="confirm-move-actions"><button class="primary" data-action="confirm">End turn</button><button class="secondary" data-action="change-move">Change move</button></div>':''}`;
  }else{
    const turn=currentTurn(game);yourTurn=turn===player;
    const last=game.moves.at(-1);
    html=`<span class="eyebrow">${chess.turn()==='w'?'WHITE':'BLACK'} TO MOVE</span><h2>${yourTurn?'Your turn':`Waiting for ${NAMES[turn]}`}</h2><p>${chess.isCheck()?(yourTurn?'Your king is in check.':`${NAMES[turn]} is in check.`):(yourTurn?(last?`${NAMES[last.player]} played ${escape(last.san)}.`:'White moves first.'):(live?'You’ll get an email when their move is ready.':`${NAMES[turn]} is next.`))}</p>`;
    if(game.drawOffer===other(player))html+=`<p>${NAMES[other(player)]} offered a draw.</p><div class="draw-options"><button class="primary" data-action="accept-draw">Accept</button><button class="secondary" data-action="decline-draw">Keep playing</button></div>`;
    else if(game.drawOffer===player)html+=`<p>Draw offered. Waiting for ${NAMES[other(player)]}.</p>`;
  }
  if(snapshot?.emailWarning)html+=`<p class="sync-error">${escape(snapshot.emailWarning)}</p>`;
  $('turn-card').innerHTML=html;$('turn-card').classList.toggle('your-turn',yourTurn);
  $('turn-card').classList.toggle('has-pending',!offline&&game?.pending?.player===player);
  $('turn-card').classList.toggle('is-offline',offline);
  $('reconnect')?.addEventListener('click',refresh);
  $('choose-theme')?.addEventListener('click',()=>dialog('theme-dialog'));
  $('game-actions').innerHTML=game?.status==='active'?`<button class="text-button" data-action="offer-draw" ${offline||game.pending||game.drawOffer?'disabled':''}>Offer a draw</button><button class="text-button resign-button" id="resign-button" ${offline||game.pending?'disabled':''}>Resign game</button>`:'';
  $('resign-button')?.addEventListener('click',()=>{$('resign-text').textContent=`${NAMES[other(player)]} wins if you resign.`;dialog('confirm-dialog');});
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
  const shouldChoose=!offline&&game?.status==='choosing'&&game.white===player;
  if(shouldChoose){$('theme-title').textContent=`${NAMES[player]} goes first`;$('theme-options').innerHTML=['dragons','airfield'].map(theme=>`<button class="theme-choice" data-theme="${theme}">${pieceArt(theme==='dragons'?'q':'r',theme,'w',false)}<strong>${theme==='dragons'?'Dragons':'U.S. airfield'}</strong></button>`).join('');document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>action('theme',{theme:b.dataset.theme}));dialog('theme-dialog');}
  else if($('theme-dialog').open)$('theme-dialog').close();
  $('board-tip').textContent=offline?'Reconnect to continue.':game?.pending?game.pending.player===player?'Check your move, then select End turn.':'Waiting for your opponent to end their turn.':canMove()?'Select a piece, then a highlighted square.':game?.status==='active'?'You can look around while you wait.':'';
  const announcement=[...$('turn-card').querySelectorAll('h2,p')].map(e=>e.textContent).join(' ');
  if($('turn-announcement').textContent!==announcement)$('turn-announcement').textContent=announcement;
  restoreFocus(focus);
}
function renderScore(){
  const stats=snapshot?.stats||{gideon:{wins:0,losses:0,draws:0},grandpa:{wins:0,losses:0,draws:0}};
  $('scoreboard').innerHTML=`<table class="score-table"><thead><tr><th scope="col">Player</th><th scope="col">Wins</th><th scope="col">Losses</th><th scope="col">Draws</th></tr></thead><tbody>${['gideon','grandpa'].map(p=>`<tr><td>${NAMES[p]}</td><td class="wins">${stats[p].wins}</td><td>${stats[p].losses}</td><td>${stats[p].draws}</td></tr>`).join('')}</tbody></table>`;
  const history=snapshot?.history||[];
  $('history-content').innerHTML=history.length?`<table class="history-table"><thead><tr><th>Date</th><th>Result</th><th>First move</th></tr></thead><tbody>${history.map(h=>`<tr><td>${escape(new Date(h.endedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))}</td><td><strong>${h.winner?`${NAMES[h.winner]} won`:'Draw'}</strong><small>${escape(h.reason)} · ${h.moveCount} moves</small></td><td>${NAMES[h.white]}<small>${THEME_NAMES[h.themes[h.white]]}</small></td></tr>`).join('')}</tbody></table>`:'<p>No completed games yet.</p>';
}
function renderMoves(){
  const game=snapshot?.game,moves=[...(game?.moves||[])],pending=game?.pending?.move;
  if(pending)moves.push({san:chessForView().history().at(-1),pending:true});
  $('move-total').textContent=`${game?.moves.length||0} played`;
  if(!moves.length){$('move-list').innerHTML='<p class="empty-moves">No moves yet.</p>';return;}
  const cell=(move,index)=>`<span class="move-cell${move?.pending?' is-pending':index===moves.length-1&&move?' is-latest':''}">${escape(move?.san||'')}${move?.pending?' <small>Pending</small>':''}</span>`;
  let html='';for(let i=0;i<moves.length;i+=2)html+=`<div class="move-row"><span>${i/2+1}.</span>${cell(moves[i],i)}${cell(moves[i+1],i+1)}</div>`;
  $('move-list').innerHTML=html;$('move-list').scrollTop=$('move-list').scrollHeight;
}
function render(){const focus=focusSelector();renderBanner();renderPlayer(other(player),'opponent');renderPlayer(player,'you');renderBoard();renderScore();renderMoves();renderTurn();restoreFocus(focus);}

const tabletLayout=window.matchMedia('(max-width: 900px)');
function positionTurnStatus(){
  const parent=document.querySelector(tabletLayout.matches?'.game-layout':'.game-sidebar');
  if($('turn-card').parentElement!==parent)parent.prepend($('turn-card'));
}
positionTurnStatus();
tabletLayout.addEventListener('change',positionTurnStatus);

$('scenery').innerHTML=scene;
$('piece-guide').innerHTML=['k','q','r','b','n','p'].map(t=>`<div class="guide-piece"><div class="guide-art">${pieceArt(t,'airfield','w',false)}${pieceArt(t,'dragons','w',false)}</div><h3>${SYMBOLS[t]} ${PIECE_NAMES[t]}</h3><p>${ROLES.airfield[t]}<br>${ROLES.dragons[t]}</p></div>`).join('');
$('guide-button').onclick=()=>dialog('guide-dialog');$('history-button').onclick=()=>dialog('history-dialog');
$('flip-board').onclick=()=>{rotated=true;orientation=orientation==='w'?'b':'w';renderBoard();};
$('settings-button').onclick=()=>{$('email-title').textContent=`${NAMES[player]}’s reminders`;$('reminder-email').value=snapshot?.email||'acegielski@gmail.com';$('email-mode').textContent=live?'Changing this address only changes your own reminders.':'Preview only: email delivery starts after online setup.';$('email-error').hidden=true;dialog('settings-dialog');};
$('email-form').onsubmit=async e=>{e.preventDefault();$('email-error').hidden=true;if(await action('email',{email:$('reminder-email').value.trim()}))$('settings-dialog').close();};
$('confirm-resign').onclick=()=>{$('confirm-dialog').close();action('resign');};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=e=>{e.preventDefault();$(b.dataset.close).close();});
$('theme-dialog').addEventListener('cancel',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
window.addEventListener('online',refresh);
window.addEventListener('offline',()=>{if(live&&!busy){activeRead?.controller.abort();activeRead=null;showConnectionError(new Error('Offline'));}});
window.addEventListener('storage',e=>{if(!live&&(e.key===PREVIEW_KEY||e.key===null))refresh();});
setInterval(()=>{if(!document.hidden)refresh();},5000);
render();refresh();
