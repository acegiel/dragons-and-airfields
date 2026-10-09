import { Chess } from 'chess.js';

export const PLAYERS = ['gideon', 'grandpa'];
export const NAMES = { gideon: 'Gideon', grandpa: 'Grandpa' };
export const UNDO_MS = 10000;
export const other = id => id === 'gideon' ? 'grandpa' : 'gideon';
export class GameError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const requireThat = (condition, message, status) => { if (!condition) throw new GameError(message, status); };
export function initialState(emails = {}) {
  return { revision: 0, game: null, history: [], emails: Object.fromEntries(PLAYERS.map(p => [p, emails[p] || 'acegielski@gmail.com'])) };
}
export function engine(game, includePending = false) {
  const chess = new Chess();
  for (const move of game?.moves || []) chess.move({from: move.from, to: move.to, ...(move.promotion ? {promotion: move.promotion} : {})});
  if (includePending && game?.pending) chess.move(game.pending.move);
  return chess;
}
export function playerForColor(game, color) { return color === 'w' ? game.white : other(game.white); }
export function turnPlayer(game) { return playerForColor(game, engine(game).turn()); }
function finish(state, winner, reason, now) {
  const game = state.game;
  game.status = 'over'; game.result = {winner, reason, endedAt: now}; game.drawOffer = null;
  state.history.push({id: game.id, white: game.white, themes: game.themes, startedAt: game.startedAt, moves: game.moves, ...game.result});
}
export function settle(state, now = Date.now()) {
  const game = state.game;
  if (!game?.pending || now < game.pending.readyAt) return null;
  const pending = game.pending;
  const chess = engine(game);
  const played = chess.move(pending.move);
  game.moves.push({from: played.from, to: played.to, san: played.san, ...(played.promotion ? {promotion: played.promotion} : {}), player: pending.player, at: pending.readyAt});
  game.pending = null;
  if (game.drawOffer && game.drawOffer !== pending.player) game.drawOffer = null;
  let reason = null;
  if (chess.isCheckmate()) finish(state, pending.player, reason = 'Checkmate', pending.readyAt);
  else if (chess.isStalemate()) finish(state, null, reason = 'Stalemate', pending.readyAt);
  else if (chess.isInsufficientMaterial()) finish(state, null, reason = 'Insufficient material', pending.readyAt);
  else if (chess.isThreefoldRepetition()) finish(state, null, reason = 'Threefold repetition', pending.readyAt);
  else if (chess.isDrawByFiftyMoves()) finish(state, null, reason = 'Fifty-move rule', pending.readyAt);
  state.revision++;
  // Only released moves that leave a playable turn produce reminders.
  return game.status === 'active' ? {id: `${game.id}-${game.moves.length}`, recipient: other(pending.player), mover: pending.player, san: played.san, gameId: game.id, createdAt: pending.readyAt} : null;
}
export function act(state, player, action, data = {}, now = Date.now(), randomBit = () => crypto.getRandomValues(new Uint8Array(1))[0] & 1) {
  requireThat(PLAYERS.includes(player), 'Invalid player.', 403);
  requireThat(Number.isInteger(data.revision) && data.revision === state.revision, 'The game changed. Refresh and try again.', 409);
  let game = state.game;
  if (action === 'start') {
    requireThat(!game || game.status === 'over', 'Finish the current game first.', 409);
    state.game = {id: crypto.randomUUID(), white: randomBit() ? 'grandpa' : 'gideon', status: 'choosing', themes: {}, moves: [], pending: null, drawOffer: null, result: null, startedAt: now};
  } else if (action === 'theme') {
    requireThat(game?.status === 'choosing', 'The theme has already been chosen.', 409);
    requireThat(game.white === player, 'The coin-flip winner chooses the theme.', 403);
    requireThat(['dragons', 'airfield'].includes(data.theme), 'Choose a theme.');
    game.themes = {[player]: data.theme, [other(player)]: data.theme === 'dragons' ? 'airfield' : 'dragons'};
    game.status = 'active';
  } else if (action === 'email') {
    requireThat(typeof data.email === 'string' && data.email.length < 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email), 'Enter a valid email address.');
    state.emails[player] = data.email.trim();
  } else {
    requireThat(game?.status === 'active', 'There is no active game.', 409);
    if (action === 'undo') {
      requireThat(game.pending && game.pending.player === player, 'Only your pending move can be undone.', 403);
      requireThat(now < game.pending.readyAt, 'The 10-second undo window has closed.', 409);
      game.pending = null;
    } else {
      requireThat(!game.pending, 'Wait for the undo window to close.', 409);
      if (action === 'move') {
        requireThat(turnPlayer(game) === player, 'It is not your turn.', 403);
        requireThat(/^[a-h][1-8]$/.test(data.from || '') && /^[a-h][1-8]$/.test(data.to || '') && (!data.promotion || ['q','r','b','n'].includes(data.promotion)), 'Invalid move.');
        const move = {from: data.from, to: data.to, ...(data.promotion ? {promotion: data.promotion} : {})};
        try { engine(game).move(move); } catch { throw new GameError('That move is not legal.'); }
        game.pending = {move, player, readyAt: now + UNDO_MS};
      } else if (action === 'resign') {
        finish(state, other(player), 'Resignation', now);
      } else if (action === 'offer-draw') {
        requireThat(!game.drawOffer, 'A draw has already been offered.', 409);
        game.drawOffer = player;
      } else if (action === 'accept-draw') {
        requireThat(game.drawOffer && game.drawOffer !== player, 'There is no draw offer to accept.', 409);
        finish(state, null, 'Agreed draw', now);
      } else if (action === 'decline-draw') {
        requireThat(game.drawOffer && game.drawOffer !== player, 'There is no draw offer to decline.', 409);
        game.drawOffer = null;
      } else { throw new GameError('Unknown action.'); }
    }
  }
  state.revision++;
  return state;
}
export function view(state, player, now = Date.now()) {
  const game = state.game ? structuredClone(state.game) : null;
  if (game?.pending && game.pending.player !== player) game.pending = {player: game.pending.player, readyAt: game.pending.readyAt};
  const stats = Object.fromEntries(PLAYERS.map(p => [p, {wins: 0, losses: 0, draws: 0}]));
  for (const result of state.history) for (const p of PLAYERS) {
    if (!result.winner) stats[p].draws++;
    else if (result.winner === p) stats[p].wins++;
    else stats[p].losses++;
  }
  return {revision: state.revision, game, history: state.history.map(({moves,...h}) => ({...h, moveCount: moves.length})).reverse(), stats, player, email: state.emails[player], serverNow: now};
}
