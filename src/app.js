import {Chess} from 'chess.js';
import {act, initialState, settle, view, engine, NAMES, other, playerForColor, turnPlayer, UNDO_MS} from './game.js';
import {pieceArt, scene, SYMBOLS, PIECE_NAMES, THEME_NAMES, ROLES} from './art.js';

const UNDO_SECONDS=UNDO_MS/1000;
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.hash.slice(1));
const api=params.get('api')||document.querySelector('meta[name="api-url"]').content;
const key=params.get('key')||'';
const live=Boolean(api||key);
let player='gideon', snapshot=null, demoState, selected=null, legal=[], orientation='w', rotated=false, busy=false, clockOffset=0, toastTimer, promoting=null, offline=false;
let activeSquare='e2';
const demoKey='dragons-airfields-preview-v1';
const now=()=>Date.now()+clockOffset;
try {demoState=JSON.parse(localStorage.getItem(demoKey))||initialState();} catch {demoState=initialState();}
const saveDemo=()=>{try{localStorage.setItem(demoKey,JSON.stringify(demoState));}catch{}};
const chessForView=()=>{
  if(!snapshot?.game) return new Chess();
  return engine(snapshot.game,Boolean(snapshot.game.pending?.move));
};
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
function setBusy(value){busy=value;document.querySelectorAll('[data-action],.theme-choice,.promotion-choice,#email-form button[type="submit"]').forEach(b=>b.disabled=value);}
async function request(path, data){
  if(!api||!key) throw new Error('Open the private link made during setup.');
  const service=new URL(api);
  if(service.protocol!=='https:' && !(service.protocol==='http:'&&['localhost','127.0.0.1'].includes(service.hostname))) throw new Error('The game service address must use HTTPS.');
  const result=await fetch(new URL(path,service),{method:data?'POST':'GET',headers:{Authorization:`Bearer ${key}`,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(12000)});
  const json=await result.json();
  if(!result.ok){if(json.state) applySnapshot(json.state);throw new Error(json.error||'Could not reach your game.');}
  return json;
}
function applySnapshot(data){
  const previous=snapshot?.game;
  const changed=!snapshot||snapshot.revision!==data.revision||snapshot.player!==data.player||offline;
  snapshot=data;player=data.player;clockOffset=data.serverNow-Date.now();offline=false;
  if(!changed)return;
  if(!rotated) orientation=snapshot.game?(colorForPlayer(player)):'w';
  if(previous?.moves.length!==data.game?.moves.length||previous?.pending?.readyAt!==data.game?.pending?.readyAt){selected=null;legal=[];}
  render();
}
async function refresh(){
  if(busy)return;
  try {
    if(live) applySnapshot(await request('/api/state'));
    else {settle(demoState);saveDemo();applySnapshot(view(demoState,player));}
  } catch(e){offline=true;renderBanner();if(!snapshot){$('turn-card').innerHTML=`<h2>Unable to open game</h2><p>${escape(e.message)}</p><button class="primary" id="retry-connection">Try again</button>`;$('retry-connection').onclick=refresh;}}
}
async function action(name,data={}){
  if(busy||!snapshot)return false;
  const focus=focusSelector();
  setBusy(true);selected=null;legal=[];
  try {
    if(live) applySnapshot(await request('/api/action',{action:name,revision:snapshot.revision,...data}));
    else {
      settle(demoState);act(demoState,player,name,{revision:snapshot.revision,...data});saveDemo();applySnapshot(view(demoState,player));
    }
    if(name==='move')notify(`Move saved. You have ${UNDO_SECONDS} seconds to undo.`);
    if(name==='undo')notify('Move undone.');
    if(name==='email')notify(live?'Reminder email saved.':'Preview email saved. No email is sent in this preview.');
    return true;
  } catch(e){notify(e.message);if(name==='email'){$('email-error').textContent=e.message;$('email-error').hidden=false;}if(!live)applySnapshot(view(demoState,player));return false;}
  finally{setBusy(false);renderTurn();restoreFocus(focus);}
}
function canMove(){const game=snapshot?.game;return !busy&&!offline&&game?.status==='active'&&!game.pending&&turnPlayer(game)===player;}
function renderBanner(){
  if(live){$('mode-banner').innerHTML=`<div class="connection ${offline?'sync-error':''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11V7a6 6 0 0 1 12 0v4M4 11h16v11H4Z"/></svg><span>${offline?'Connection lost. Reconnect to continue.':`Private board for <strong>${NAMES[player]}</strong>`}</span></div><span>${offline?'<button id="reconnect" class="text-button">Reconnect</button>':'Bookmark this player link.'}</span>`;if(offline)$('reconnect').onclick=refresh;}
  else{$('mode-banner').innerHTML=`<div class="preview-label"><strong>Local preview</strong><small>One device. Shared play and email require setup.</small></div><div class="role-switch" aria-label="Preview player">${['gideon','grandpa'].map(p=>`<button data-player="${p}" aria-pressed="${player===p}" class="${player===p?'active':''}">${NAMES[p]}</button>`).join('')}</div>`;document.querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>{player=b.dataset.player;selected=null;legal=[];rotated=false;applySnapshot(view(demoState,player));});}
}
function renderPlayer(p,id){
  const game=snapshot?.game;const color=game?colorForPlayer(p):(p===player?'w':'b');
  const theme=game?.themes[p]||(color==='w'?'dragons':'airfield');
  const captured=game?engine(game).history({verbose:true}).filter(m=>m.color===color&&m.captured).map(m=>SYMBOLS[m.captured]).join(''):'';
  $(id).innerHTML=`<div class="avatar">${pieceArt('k',theme,color,false)}</div><div class="player-info"><div class="player-name">${NAMES[p]}${p===player?'<small>YOU</small>':''}</div><div class="player-detail"><span class="side-stone ${color==='b'?'black':''}" aria-hidden="true"></span>${game?.themes[p]?`${color==='w'?'White':'Black'} · ${THEME_NAMES[theme]}`:'Game not started'}</div></div><span class="captured" aria-label="Captured pieces">${captured}</span>`;
}
function renderBoard(){
  const chess=chessForView(),game=snapshot?.game;
  const files=orientation==='w'?'abcdefgh':'hgfedcba',ranks=orientation==='w'?'87654321':'12345678';
  const last=game?.pending?.move||game?.moves.at(-1),focus=document.activeElement?.dataset?.square;
  let html='';
  for(const rank of ranks)for(const file of files){
    const square=file+rank,piece=chess.get(square),dark=(file.charCodeAt(0)-97+Number(rank))%2===1;
    const checked=piece?.type==='k'&&piece.color===chess.turn()&&chess.isCheck();
    const label=piece?`${square}, ${piece.color==='w'?'white':'black'} ${PIECE_NAMES[piece.type]}, ${ROLES[themeForColor(piece.color)][piece.type]}`:`${square}, empty`;
    html+=`<button type="button" class="square ${dark?'dark':''} ${piece?'occupied':''} ${last&&(last.from===square||last.to===square)?'last-move':''} ${selected===square?'selected':''} ${legal.some(m=>m.to===square)?'legal':''} ${checked?'checked':''}" data-square="${square}" aria-label="${escape(label)}" aria-pressed="${selected===square}" tabindex="${square===activeSquare?'0':'-1'}" title="${escape(label)}">${piece?pieceArt(piece.type,themeForColor(piece.color),piece.color):''}</button>`;
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
  if(!canMove()){if(snapshot?.game?.pending?.player===player)notify('Undo your saved move to choose a different one.');return;}
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
  if(!game){html=`<span class="eyebrow">NEW GAME</span><h2>Start a game</h2><p>The coin flip decides who moves first and chooses a theme.</p><button class="primary" data-action="start">Flip the coin</button>`;}
  else if(game.status==='choosing'){
    html=`<span class="eyebrow">COIN FLIP</span><h2>${game.white===player?'Choose your pieces':`Waiting for ${NAMES[game.white]}`}</h2><p>${NAMES[game.white]} won the coin flip and plays white.</p>${game.white===player?'<button class="primary" id="choose-theme">Choose a theme</button>':''}`;
  }else if(game.status==='over'){
    html=`<span class="eyebrow">GAME OVER</span><h2>${game.result.winner?`${NAMES[game.result.winner]} wins`:'Draw'}</h2><p>${escape(game.result.reason)}.</p><button class="primary" data-action="start">Play again · Flip the coin</button>`;
  }else if(game.pending){
    const own=game.pending.player===player,seconds=Math.max(0,Math.ceil((game.pending.readyAt-now())/1000));
    html=`<span class="eyebrow">${own?'UNDO AVAILABLE':'UNDO WINDOW'}</span><h2>${own?'Move saved':`Waiting for ${NAMES[game.pending.player]}`}</h2><p>${own?`You can undo for ${UNDO_SECONDS} seconds.`:`Their move will appear when the ${UNDO_SECONDS}-second undo window closes.`}</p>${own?`<div class="undo-row"><div class="undo-ring" id="undo-ring" style="--progress:${seconds/UNDO_SECONDS*100}%"><span id="undo-seconds">${seconds}</span></div><button class="secondary" data-action="undo" ${seconds===0?'disabled':''}>Undo move</button></div>`:''}`;
  }else{
    const turn=turnPlayer(game);yourTurn=turn===player;
    const last=game.moves.at(-1);
    html=`<span class="eyebrow">${chess.turn()==='w'?'WHITE':'BLACK'} TO MOVE</span><h2>${yourTurn?'Your turn':`Waiting for ${NAMES[turn]}`}</h2><p>${chess.isCheck()?(yourTurn?'Your king is in check.':`${NAMES[turn]} is in check.`):(yourTurn?(last?`${NAMES[last.player]} played ${escape(last.san)}.`:'White moves first.'):(live?'You’ll get an email when their move is ready.':`${NAMES[turn]} is next.`))}</p>`;
    if(game.drawOffer===other(player))html+=`<p>${NAMES[other(player)]} offered a draw.</p><div class="draw-options"><button class="primary" data-action="accept-draw">Accept</button><button class="secondary" data-action="decline-draw">Keep playing</button></div>`;
    else if(game.drawOffer===player)html+=`<p>Draw offered. Waiting for ${NAMES[other(player)]}.</p>`;
  }
  if(snapshot?.emailWarning)html+=`<p class="sync-error">${escape(snapshot.emailWarning)}</p>`;
  $('turn-card').innerHTML=html;$('turn-card').classList.toggle('your-turn',yourTurn);
  $('choose-theme')?.addEventListener('click',()=>dialog('theme-dialog'));
  $('game-actions').innerHTML=game?.status==='active'?`<button class="text-button" data-action="offer-draw" ${game.pending||game.drawOffer?'disabled':''}>Offer a draw</button><button class="text-button resign-button" id="resign-button" ${game.pending?'disabled':''}>Resign game</button>`:'';
  $('resign-button')?.addEventListener('click',()=>{$('resign-text').textContent=`${NAMES[other(player)]} wins if you resign.`;dialog('confirm-dialog');});
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
  const shouldChoose=game?.status==='choosing'&&game.white===player;
  if(shouldChoose){$('theme-title').textContent=`${NAMES[player]} goes first`;$('theme-options').innerHTML=['dragons','airfield'].map(theme=>`<button class="theme-choice" data-theme="${theme}">${pieceArt(theme==='dragons'?'q':'r',theme,'w',false)}<strong>${theme==='dragons'?'Dragons':'U.S. airfield'}</strong></button>`).join('');document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>action('theme',{theme:b.dataset.theme}));dialog('theme-dialog');}
  else if($('theme-dialog').open)$('theme-dialog').close();
  $('board-tip').textContent=game?.pending?'Waiting for the undo window to close.':canMove()?'Select a piece, then a highlighted square.':'';
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
  if(pending){const chess=engine(game);const m=chess.move(pending);moves.push({san:m.san,pending:true});}
  $('move-total').textContent=`${game?.moves.length||0} played`;
  if(!moves.length){$('move-list').innerHTML='<p class="empty-moves">No moves yet.</p>';return;}
  let html='';for(let i=0;i<moves.length;i+=2)html+=`<div class="move-row ${moves[i].pending||moves[i+1]?.pending?'pending-row':''}"><span>${i/2+1}.</span><span>${escape(moves[i].san)}${moves[i].pending?' *':''}</span><span>${escape(moves[i+1]?.san||'')}${moves[i+1]?.pending?' *':''}</span></div>`;
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
window.addEventListener('storage',e=>{if(!live&&e.key===demoKey){try{demoState=JSON.parse(e.newValue)||initialState();applySnapshot(view(demoState,player));}catch{}}});
setInterval(()=>{
  const pending=snapshot?.game?.pending;
  if(pending){const seconds=Math.max(0,Math.ceil((pending.readyAt-now())/1000));if($('undo-seconds'))$('undo-seconds').textContent=seconds;if($('undo-ring'))$('undo-ring').style.setProperty('--progress',`${seconds/UNDO_SECONDS*100}%`);if(seconds===0){document.querySelector('[data-action="undo"]')?.setAttribute('disabled','');refresh();}}
},250);
setInterval(()=>{if(!document.hidden)refresh();},5000);
renderBoard();renderScore();refresh();
