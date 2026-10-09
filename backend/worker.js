import {act, initialState, view, settle, turnPlayer, NAMES, PLAYERS} from '../src/game.js';

const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const token = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function equalSecret(a, b) {
  if (!a || !b) return false;
  const digest = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [aa,bb] = await Promise.all([digest(a),digest(b)]);
  let diff = 0; for (let i=0;i<aa.length;i++) diff |= aa[i]^bb[i]; return diff === 0;
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    let allowed; try { allowed = new URL(env.PUBLIC_PAGE_URL).origin; } catch { return json({error:'Set PUBLIC_PAGE_URL before deployment.'},503); }
    if (origin && origin !== allowed) return json({error:'This page is not allowed.'},403);
    const cors = {'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Vary':'Origin'};
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
    const id = env.FAMILY.idFromName('gideon-and-grandpa');
    const response = await env.FAMILY.get(id).fetch(request);
    const headers = new Headers(response.headers); for(const [k,v] of Object.entries(cors)) headers.set(k,v);
    return new Response(response.body,{status:response.status,headers});
  }
};

export class ChessFamily {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.queue = Promise.resolve(); }
  exclusive(fn) { const p=this.queue.then(fn); this.queue=p.catch(()=>{}); return p; }
  async schedule(tx, room) {
    const times = [room.state.game?.pending?.readyAt, ...room.outbox.filter(m=>!m.failed).map(m=>m.nextAttempt)].filter(Boolean);
    if(times.length) await tx.setAlarm(Math.max(Date.now()+1,Math.min(...times)));
    else await tx.deleteAlarm();
  }
  async fetch(request) {
    return this.exclusive(async () => {
      try {
        const url = new URL(request.url);
        const supplied = request.headers.get('Authorization')?.replace(/^Bearer /,'') || '';
        if(url.pathname === '/admin/setup' && request.method === 'POST') {
          if(!(await equalSecret(supplied,this.env.SETUP_SECRET))) return json({error:'Unauthorized.'},401);
          if(!this.env.RESEND_API_KEY || !this.env.EMAIL_FROM) return json({error:'Configure RESEND_API_KEY and EMAIL_FROM before setup.'},503);
          if(this.env.API_URL!==url.origin) return json({error:'API_URL must match the deployed service origin.'},503);
          let room = await this.ctx.storage.get('room');
          if(!room) {
            room = {state:initialState(),tokens:Object.fromEntries(PLAYERS.map(p=>[p,token()])),outbox:[],emailWarning:null};
            await this.ctx.storage.put('room',room);
          }
          const api = url.origin;
          return json({links:Object.fromEntries(PLAYERS.map(p=>[p,`${this.env.PUBLIC_PAGE_URL.split('#')[0]}#${new URLSearchParams({api,key:room.tokens[p]})}`]))});
        }
        const stored = await this.ctx.storage.get('room');
        if(!stored) return json({error:'The family game has not been set up yet.'},503);
        let player = null;
        for (const id of PLAYERS) if(await equalSecret(supplied,stored.tokens[id])) player=id;
        if(!player) return json({error:'Open your private player link to join.'},401);
        const isState = url.pathname==='/api/state' && request.method==='GET';
        const isAction = url.pathname==='/api/action' && request.method==='POST';
        if(!isState && !isAction) return json({error:'Not found.'},404);
        let data;
        if(isAction) {
          const text=await request.text(); if(text.length>4096) return json({error:'Request too large.'},413);
          try {data=JSON.parse(text);} catch {return json({error:'Invalid request.'},400);}
        }
        let output, actionError;
        await this.ctx.storage.transaction(async tx => {
          const room = await tx.get('room');
          const notification=settle(room.state);
          if(notification) room.outbox.push({...notification,nextAttempt:Date.now(),attempts:0});
          if(isAction) {try {act(room.state,player,data.action,data);} catch(e) {actionError=e;} }
          await tx.put('room',room); await this.schedule(tx,room);
          output={...view(room.state,player),emailWarning:room.emailWarning};
        });
        if(actionError) return json({error:actionError.message,state:output},actionError.status||400);
        return json(output);
      } catch(e) { console.error('Chess request failed:', e.message); return json({error:'The game could not be saved. Please try again.'},500); }
    });
  }
  async alarm() {
    return this.exclusive(async () => {
      let room;
      await this.ctx.storage.transaction(async tx => {
        room=await tx.get('room'); if(!room) return;
        const notification=settle(room.state);
        if(notification) room.outbox.push({...notification,nextAttempt:Date.now(),attempts:0});
        await tx.put('room',room); await this.schedule(tx,room);
      });
      if(!room) return;
      for (const message of [...room.outbox]) {
        if(message.failed || message.nextAttempt > Date.now()) continue;
        const game=room.state.game;
        // Do not send an obsolete reminder if the player already took their turn.
        if(game?.id!==message.gameId || game.status!=='active' || game.pending || turnPlayer(game)!==message.recipient) {
          room.outbox=room.outbox.filter(m=>m.id!==message.id); continue;
        }
        const link=`${this.env.PUBLIC_PAGE_URL.split('#')[0]}#${new URLSearchParams({api:this.env.API_URL,key:room.tokens[message.recipient]})}`;
        try {
          const response=await fetch('https://api.resend.com/emails',{
            method:'POST',headers:{'Authorization':`Bearer ${this.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`chess-${message.id}`},
            signal:AbortSignal.timeout(10000),
            body:JSON.stringify({from:this.env.EMAIL_FROM,to:[room.state.emails[message.recipient]],subject:`${NAMES[message.recipient]}, it's your turn in Dragons & Airfields`,text:`${NAMES[message.mover]} played ${message.san}. Your move is ready.\n\nOpen your private board: ${link}\n\nThere is no time limit. Keep this link private; it gives access to your pieces.`})
          });
          if(!response.ok) { const error=new Error(`Email service returned ${response.status}`); error.permanent=response.status>=400 && response.status<500 && response.status!==429; throw error; }
          room.outbox=room.outbox.filter(m=>m.id!==message.id); room.emailWarning=null;
        } catch(e) {
          const job=room.outbox.find(m=>m.id===message.id); if(!job) continue;
          job.attempts++;
          if(e.permanent || Date.now()-message.createdAt>20*60*60*1000) {job.failed=true; room.emailWarning='A turn email could not be delivered. Please check the reminder address and email service.';}
          else job.nextAttempt=Date.now()+Math.min(60000*2**Math.min(job.attempts-1,6),3600000);
          console.error('Turn email delivery deferred:', e.message);
        }
        await this.ctx.storage.transaction(async tx=>{await tx.put('room',room);await this.schedule(tx,room);});
      }
      await this.ctx.storage.transaction(async tx=>{await tx.put('room',room);await this.schedule(tx,room);});
    });
  }
}
