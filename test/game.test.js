import {test} from 'node:test';
import assert from 'node:assert/strict';
import {act, initialState, settle, view, engine, turnPlayer, UNDO_MS} from '../src/game.js';

function action(s,p,a,d={},time=1000,bit=()=>0){return act(s,p,a,{revision:s.revision,...d},time,bit);}
function started(white='gideon',theme='dragons') {const s=initialState();action(s,'grandpa','start',{},1000,()=>white==='gideon'?0:1);action(s,white,'theme',{theme});return s;}
function move(s,p,from,to,time=1000,promotion){action(s,p,'move',{from,to,...(promotion?{promotion}:{})},time);return settle(s,time+UNDO_MS);}

test('coin flip picks first player; only that player chooses a theme',()=>{
 const s=initialState();action(s,'gideon','start',{},1000,()=>1);assert.equal(s.game.white,'grandpa');
 assert.throws(()=>action(s,'gideon','theme',{theme:'dragons'}),/winner chooses/);
 action(s,'grandpa','theme',{theme:'dragons'});assert.equal(s.game.themes.gideon,'airfield');assert.equal(turnPlayer(s.game),'grandpa');
 assert.throws(()=>action(s,'gideon','start'),/Finish/);
});
test('server prevents wrong turns and illegal moves',()=>{
 const s=started();assert.throws(()=>action(s,'grandpa','move',{from:'e7',to:'e5'}),/not your turn/);
 assert.throws(()=>action(s,'gideon','move',{from:'e2',to:'e5'}),/not legal/);assert.equal(s.game.moves.length,0);
});
test('pending moves are hidden from opponent and locked for 30 seconds',()=>{
 const s=started();action(s,'gideon','move',{from:'e2',to:'e4'},1000);
 assert.equal(view(s,'gideon').game.pending.move.to,'e4');assert.equal(view(s,'grandpa').game.pending.move,undefined);
 assert.equal(engine(s.game).get('e2').type,'p');assert.equal(settle(s,30999),null);
 assert.throws(()=>action(s,'grandpa','move',{from:'e7',to:'e5'},30000),/undo window/);
 assert.equal(settle(s,31000).recipient,'grandpa');assert.equal(engine(s.game).get('e4').type,'p');
 assert.equal(settle(s,31001),null);
});
test('undo before expiry restores the board and creates no reminder',()=>{
 const s=started();action(s,'gideon','move',{from:'e2',to:'e4'},1000);action(s,'gideon','undo',{},30999);
 assert.equal(s.game.pending,null);assert.equal(engine(s.game).turn(),'w');assert.equal(settle(s,50000),null);
});
test('opponent cannot undo; undo is rejected exactly at deadline',()=>{
 const s=started();action(s,'gideon','move',{from:'e2',to:'e4'},1000);
 assert.throws(()=>action(s,'grandpa','undo',{},2000),/Only your/);
 assert.throws(()=>action(s,'gideon','undo',{},31000),/closed/);
});
test('stale revisions reject concurrent writes',()=>{
 const s=started(),revision=s.revision;action(s,'gideon','move',{from:'e2',to:'e4'});
 assert.throws(()=>act(s,'gideon','move',{revision,from:'d2',to:'d4'}),/game changed/);
});
test('checkmate is finalized once after the undo window and updates shared history',()=>{
 const s=started();move(s,'gideon','f2','f3');move(s,'grandpa','e7','e5');move(s,'gideon','g2','g4');
 action(s,'grandpa','move',{from:'d8',to:'h4'});assert.equal(s.history.length,0);
 assert.equal(settle(s,31000),null);assert.equal(s.game.result.winner,'grandpa');assert.equal(s.game.result.reason,'Checkmate');
 assert.equal(view(s,'gideon').stats.gideon.losses,1);assert.equal(view(s,'grandpa').stats.grandpa.wins,1);
 settle(s,50000);assert.equal(s.history.length,1);action(s,'gideon','start');assert.equal(s.history.length,1);
});
test('repetition survives reconstruction from stored moves',()=>{
 const s=started();for(let i=0;i<2;i++){move(s,'gideon','g1','f3');move(s,'grandpa','g8','f6');move(s,'gideon','f3','g1');move(s,'grandpa','f6','g8');}
 assert.equal(s.game.result.reason,'Threefold repetition');assert.equal(view(s,'gideon').stats.grandpa.draws,1);
});
test('castling validates rook and king movement',()=>{
 const s=started();move(s,'gideon','e2','e4');move(s,'grandpa','e7','e5');move(s,'gideon','g1','f3');move(s,'grandpa','b8','c6');move(s,'gideon','f1','c4');move(s,'grandpa','g8','f6');move(s,'gideon','e1','g1');
 assert.equal(engine(s.game).get('f1').type,'r');assert.equal(engine(s.game).get('g1').type,'k');
});
test('en passant and promotion are supported',()=>{
 const s=started();move(s,'gideon','e2','e4');move(s,'grandpa','a7','a6');move(s,'gideon','e4','e5');move(s,'grandpa','d7','d5');move(s,'gideon','e5','d6');assert.equal(engine(s.game).get('d5'),undefined);
 const p=started();move(p,'gideon','a2','a4');move(p,'grandpa','h7','h5');move(p,'gideon','a4','a5');move(p,'grandpa','h5','h4');move(p,'gideon','a5','a6');move(p,'grandpa','h4','h3');move(p,'gideon','a6','b7');move(p,'grandpa','h3','g2');move(p,'gideon','b7','a8',1000,'n');assert.equal(engine(p.game).get('a8').type,'n');
});
test('draw agreement and resignation appear in shared statistics',()=>{
 const s=started();action(s,'gideon','offer-draw');assert.throws(()=>action(s,'gideon','accept-draw'),/no draw offer/);
 action(s,'grandpa','accept-draw');assert.equal(s.history[0].winner,null);assert.equal(view(s,'gideon').stats.gideon.draws,1);
 action(s,'grandpa','start');action(s,'gideon','theme',{theme:'airfield'});action(s,'grandpa','resign');assert.equal(view(s,'gideon').stats.gideon.wins,1);
});
test('email changes are validated and scoped to one player',()=>{
 const s=started();assert.throws(()=>action(s,'gideon','email',{email:'invalid'}),/valid email/);
 action(s,'gideon','email',{email:'gideon@example.com'});assert.equal(s.emails.grandpa,'acegielski@gmail.com');assert.equal(view(s,'grandpa').email,'acegielski@gmail.com');assert.equal(view(s,'gideon').emails,undefined);
});
