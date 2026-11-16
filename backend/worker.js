import {act, initialState, view, turnNotification, NAMES, PLAYERS} from '../src/game.js';

const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const token = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const EMAIL_TIMEOUT_MS=10000, DELIVERY_LEASE_MS=30000;

function discardObsoleteReminders(room) {
  const game=room.state.game, count=room.outbox.length;
  // A later turn for the same player must not revive an old reminder.
  const currentId=game?.status==='active'&&!game.pending?`${game.id}-${game.moves.length}`:null;
  room.outbox=room.outbox.filter(message=>message.id===currentId);
  const previousWarning=room.emailWarning;
  if(!room.outbox.some(message=>message.failed)) room.emailWarning=null;
  return count!==room.outbox.length||previousWarning!==room.emailWarning;
}
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
    const times = room.outbox.filter(m=>!m.failed).map(m=>m.nextAttempt).filter(Boolean);
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
          if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.action!=='string') return json({error:'Invalid request.'},400);
        }
        let output, actionError;
        await this.ctx.storage.transaction(async tx => {
          const room=await tx.get('room'), now=Date.now(), revision=room.state.revision;
          actionError=undefined;
          if(isAction) {
            try {
              act(room.state,player,data.action,data,now);
              if(data.action==='confirm') {
                const notification=turnNotification(room.state);
                if(notification)room.outbox.push({...notification,nextAttempt:now,attempts:0});
              }
            } catch(e) {actionError=e;}
          }
          const remindersChanged=discardObsoleteReminders(room);
          if(room.state.revision!==revision||remindersChanged) {
            await tx.put('room',room); await this.schedule(tx,room);
          }
          output={...view(room.state,player,now),emailWarning:room.emailWarning};
        });
        if(actionError) return json({error:actionError.message,state:output},actionError.status||400);
        return json(output);
      } catch(e) { console.error('Chess request failed:', e.message); return json({error:'The game could not be saved. Please try again.'},500); }
    });
  }
  async alarm() {
    const message=await this.exclusive(()=>this.ctx.storage.transaction(async tx=>{
      const room=await tx.get('room'); if(!room) return null;
      const now=Date.now();
      discardObsoleteReminders(room);
      const job=room.outbox.find(item=>!item.failed&&item.nextAttempt<=now);
      if(job) {
        // Persist before the network call so a restart can retry the same delivery.
        job.nextAttempt=now+DELIVERY_LEASE_MS;
        if(!job.body) {
          const link=`${this.env.PUBLIC_PAGE_URL.split('#')[0]}#${new URLSearchParams({api:this.env.API_URL,key:room.tokens[job.recipient]})}`;
          job.body=JSON.stringify({from:this.env.EMAIL_FROM,to:[room.state.emails[job.recipient]],subject:`${NAMES[job.recipient]}, it's your turn in Dragons & Airfields`,text:`${NAMES[job.mover]} played ${job.san}. Your move is ready.\n\nOpen your private board: ${link}\n\nThere is no time limit. Keep this link private; it gives access to your pieces.`});
        }
      }
      await tx.put('room',room); await this.schedule(tx,room);
      return job;
    }));
    if(!message) return;

    // Mail delivery cannot hold up moves, confirmations, or reads of the board.
    let failure;
    try {
      const response=await fetch('https://api.resend.com/emails',{
        method:'POST',headers:{'Authorization':`Bearer ${this.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`chess-${message.id}`},
        signal:AbortSignal.timeout(EMAIL_TIMEOUT_MS),body:message.body
      });
      if(!response.ok) failure={message:`Email service returned ${response.status}`,permanent:response.status>=400&&response.status<500&&response.status!==429};
    } catch(e) {failure={message:e.message};}

    await this.exclusive(()=>this.ctx.storage.transaction(async tx=>{
      const room=await tx.get('room');
      const job=room?.outbox.find(item=>item.id===message.id&&item.nextAttempt===message.nextAttempt);
      if(!job) return;
      if(!failure) {
        room.outbox=room.outbox.filter(item=>item.id!==job.id); room.emailWarning=null;
      } else {
        const now=Date.now();
        job.attempts++;
        if(failure.permanent||now-job.createdAt>20*60*60*1000) {
          job.failed=true; room.emailWarning='A turn email could not be delivered. Please check the reminder address and email service.';
        } else job.nextAttempt=now+Math.min(60000*2**Math.min(job.attempts-1,6),3600000);
      }
      await tx.put('room',room); await this.schedule(tx,room);
    }));
    if(failure) console.error('Turn email delivery deferred:',failure.message);
  }
}
