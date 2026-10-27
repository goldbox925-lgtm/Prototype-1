/* PLAYMODE · Shared store.
   Shared state = what every device in the room agrees on. UI never mutates it directly; it dispatches actions.
   The reducer is deterministic (time values travel inside actions), so every tab applying the same actions
   ends up with the same state. Sync (js/sync.js) carries actions between tabs; it could be swapped for
   Supabase Realtime / Firebase / a WebSocket server without touching the screens. */

const DEMO_ROOM_CODE = '7316';       // the prototype room code (TV, QR, Join and host phone all show this)
const normalizeCode = v => String(v || '').replace(/\D/g, '').slice(0, 4);
/* The room code shown on the host phone, the TV, the QR label and checked by Join always comes from state.room. */
const roomCode = (s = Store.get()) => s.room ? s.room.code : null;
const roomIsOpen = (s = Store.get()) => !!(s.room && s.room.status !== 'closed');
const TV_PAIR_CODE = DEMO_ROOM_CODE;   // the TV shows one code: the room code 7316

function initialShared() {
  return {
    rev: 0, updatedAt: 0, log: [],
    lastEvent: null,            // {type:'join'|'left', id, at} — shown briefly on the TV
    room: null,                 // {code, hostId, status, tvConnected, statusAt}
    players: [],                // [{id, name, color, isHost, joined, ready}]
    hostContext: {occasion:null, availableMinutes:null},
    sessionTheme: null,         // derived from occasion (themes.js)
    playerPreferences: {},      // {id: {vibe, interests[]}} — private, the TV only reads counts
    recommendations: null,      // {top[], different[], exclude[], forGame}
    selectedGame: null,
    tvState: {themeIntroAt:0, fromNext:false},
    gameSession: null,
    roundStatus: null,          // 'active' | 'endedEarly' | 'complete' — ending a round never clears the room
    played: []
  };
}

/* status: lobby → context → collecting → matching → matches → details → ready → playing → finished → nextMatch */
const STATUS_FLOW = ['lobby', 'context', 'collecting', 'matching', 'matches', 'details', 'ready', 'playing', 'finished', 'nextMatch'];

const joinedPlayers = s => s.players.filter(p => p.joined);
const prefsCount = s => joinedPlayers(s).filter(p => s.playerPreferences[p.id]).length;
const allPrefsIn = s => joinedPlayers(s).length > 0 && prefsCount(s) === joinedPlayers(s).length;

function freshSession(players) {
  const z = () => Object.fromEntries(players.map(p => [p.id, 0]));
  return {game:'firstnotes', hold:false, endedEarly:false, round:1, phase:'countdown', count:3, timer:10, listenAt:0, buzz:{}, lock:{}, results:[], scores:z(), prevScores:z(), buzzSum:z(), paused:false};
}

/* Only real preference data counts ({sealed:true} placeholders mean "answered privately — the TV has it"). */
const openPrefs = prefs => Object.fromEntries(Object.entries(prefs || {}).filter(([, v]) => v && v.vibe));
function computeRecs(s, exclude, prefs) {
  const ps = joinedPlayers(s);
  const r = recommendGames(ps, prefs || openPrefs(s.playerPreferences), s.hostContext, exclude);
  return {top:r.top, different:r.different, exclude:exclude.slice()};
}

/* Scoring for one round (generic for any mix of real and simulated players). */
function scoreRound(gs, round) {
  const R = ROUNDS[round - 1], mul = R.double ? 2 : 1;
  const ids = Object.keys(gs.scores);
  const correct = ids.filter(id => gs.lock[id] === R.ok);
  const fastest = correct.slice().sort((a, b) => (gs.buzz[a] ?? 99) - (gs.buzz[b] ?? 99))[0];
  const per = {};
  ids.forEach(id => {
    const ok = gs.lock[id] === R.ok, fast = ok && id === fastest;
    per[id] = {pts: ok ? (100 + (fast ? 20 : 0)) * mul : 0, correct: ok, fast, ans: gs.lock[id] ?? null, t: gs.buzz[id] ?? null};
  });
  return {per, winner: fastest || null, winPts: fastest ? per[fastest].pts : 0, double: !!R.double};
}

function reduce(s, a) {
  s = JSON.parse(JSON.stringify(s));       // simple immutability for a prototype-size state
  const setStatus = st => { s.room.status = st; s.room.statusAt = a.at || 0; };
  switch (a.type) {
    case 'RESET': return initialShared();
    case 'LOAD': return a.state;

    /* ---------- room ---------- */
    /* a host phone (demo) or the TV (?role=tv, live mode) opens a room. A TV-created room has no host yet:
       the first person to join becomes the host. */
    case 'CREATE_ROOM': {
      const n = initialShared(), host = a.hostId || null;
      n.room = {code:a.code || DEMO_ROOM_CODE, hostId:host, status:'lobby', tvConnected:!!a.byTV, byTV:!!a.byTV, key:null, statusAt:a.at || 0};
      n.players = CAST.map(p => ({id:p.id, name:p.id === host && a.name ? cleanName(a.name) || p.n : p.n, color:p.c, isHost:p.id === host, joined:p.id === host, ready:false,
        human:p.id === host && !!a.human, device:p.id === host ? (a.device || null) : null, online:p.id === host ? true : null}));
      return n;
    }
    case 'SET_ROOM_KEY': if (s.room) s.room.key = a.key; return s;
    case 'PLAYER_STATUS': { const p = s.players.find(x => x.id === a.id); if (p && p.joined) p.online = !!a.online; return s; }
    case 'CONNECT_TV': if (s.room) s.room.tvConnected = true; return s;
    case 'DISCONNECT_TV': if (s.room) s.room.tvConnected = false; return s;
    /* a seat is taken by one device; a seat whose device went offline can be reclaimed (phone restarted) */
    case 'JOIN': { if (!s.room) return s; const p = s.players.find(x => x.id === a.id); if (!p) return s;
      if (p.joined && p.device && a.device && p.device !== a.device && p.online !== false) return s;
      p.joined = true; p.human = !!a.human; p.device = a.device || p.device || null; p.online = true;
      if (a.name !== undefined) p.name = cleanName(a.name) || person(a.id).baseName || p.name;
      if (!s.room.hostId) { s.room.hostId = p.id; p.isHost = true; }
      s.lastEvent = {type:'join', id:p.id, at:a.at || 0}; return s; }
    /* a player exits: they leave the room list, but their preferences and the group's recommendations stay */
    case 'LEAVE': { if (!s.room || a.id === s.room.hostId) return s; const p = s.players.find(x => x.id === a.id);
      if (p && p.joined) { p.joined = false; p.ready = false; p.device = null; p.online = null; s.lastEvent = {type:'left', id:p.id, name:p.name, at:a.at || 0}; p.name = person(p.id).baseName || p.name; } return s; }
    /* ONLY a confirmed "Close room" clears the whole session (players, preferences, recommendations, occasion, scores) */
    case 'CLOSE_ROOM': return initialShared();

    /* ---------- group match ---------- */
    case 'START_MATCHING': setStatus('context'); return s;
    case 'CANCEL_MATCHING': setStatus('lobby'); return s;
    case 'SET_OCCASION':
      s.hostContext.occasion = a.occasion;
      s.sessionTheme = deriveSessionTheme(a.occasion);
      s.tvState.themeIntroAt = a.at || 0;
      return s;
    case 'SET_TIME':
      s.hostContext.availableMinutes = a.minutes;
      if (s.room.status === 'context') setStatus('collecting');
      return s;
    /* sealed: the answers went privately to the TV; shared state only records THAT this person answered */
    case 'SUBMIT_PREFS':
      if (a.sealed) { s.playerPreferences[a.id] = {sealed:true}; return s; }
      s.playerPreferences[a.id] = {vibe:a.vibe, interests:a.interests.slice()};
      if (['matches', 'details', 'nextMatch'].includes(s.room.status)) s.recommendations = computeRecs(s, s.recommendations ? s.recommendations.exclude : []);
      return s;
    case 'SET_RECS': s.recommendations = a.recommendations; return s;
    case 'BEGIN_MATCHING': if (s.room.status === 'collecting') { s.matchSignals = null; setStatus('matching'); } return s;
    /* anonymous group counts for the TV animation (no one's individual answers) */
    case 'MATCH_SIGNALS': s.matchSignals = {signals:a.signals, top:a.top}; return s;
    case 'SHOW_MATCHES': s.recommendations = a.recommendations || computeRecs(s, []); setStatus('matches'); return s;
    case 'SELECT_GAME': s.tvState.fromNext = s.room.status === 'nextMatch'; s.selectedGame = a.game; setStatus('details'); return s;
    case 'BACK_TO_MATCHES': setStatus(s.tvState.fromNext ? 'nextMatch' : 'matches'); return s;

    /* ---------- ready + play ---------- */
    case 'OPEN_READY':
      s.selectedGame = a.game || s.selectedGame;
      s.players.forEach(p => p.ready = p.isHost);
      s.gameSession = null; setStatus('ready'); return s;
    case 'SET_READY': { const p = s.players.find(x => x.id === a.id); if (p) p.ready = true; return s; }
    case 'START_GAME': s.gameSession = freshSession(joinedPlayers(s)); s.gameSession.count = 3; s.roundStatus = 'active'; setStatus('playing'); return s;
    case 'COUNTDOWN': s.gameSession.count = a.n; return s;
    case 'ROUND_INTRO': { const g = s.gameSession; g.round = a.round; g.phase = 'intro'; g.hold = false; g.endedEarly = false; s.roundStatus = 'active'; g.buzz = {}; g.lock = {}; g.timer = 10; g.count = 0; return s; }
    case 'LISTEN_START': { const g = s.gameSession; g.round = a.round; g.phase = 'listen'; g.listenAt = a.at; g.timer = 10; g.buzz = {}; g.lock = {}; g.count = 0; return s; }
    case 'TICK': { const g = s.gameSession; if (g && g.phase === 'listen' && !g.paused) g.timer = Math.max(0, g.timer - 1); return s; }
    case 'BUZZ': { const g = s.gameSession; if (g && g.phase === 'listen' && g.buzz[a.id] === undefined) g.buzz[a.id] = a.t; return s; }
    case 'LOCK': { const g = s.gameSession; if (g && g.phase === 'listen' && g.lock[a.id] === undefined) { if (g.buzz[a.id] === undefined) g.buzz[a.id] = a.t ?? 9.9; g.lock[a.id] = a.sealed ? 'sealed' : a.ans; } return s; }
    case 'REVEAL': {
      const g = s.gameSession; if (!g || g.phase !== 'listen') return s;
      // sealed answers are opened only now, at the reveal (sent privately to the TV, which passes them in)
      Object.keys(g.lock).forEach(id => { if (g.lock[id] === 'sealed') g.lock[id] = a.answers && a.answers[id] !== undefined ? a.answers[id] : null; });
      g.prevScores = {...g.scores};
      const res = scoreRound(g, g.round);
      Object.entries(res.per).forEach(([id, r]) => { g.scores[id] += r.pts; g.buzzSum[id] += (r.t ?? 10); });
      g.results[g.round - 1] = res; g.phase = 'reveal'; s.roundStatus = 'complete'; return s;
    }
    /* host ends the round early: no points for this round, completed scores kept, room/preferences/recommendations untouched */
    case 'END_ROUND_EARLY': { const g = s.gameSession; if (!g || !['countdown', 'intro', 'listen'].includes(g.phase)) return s;
      g.prevScores = {...g.scores};
      g.results[g.round - 1] = {per:Object.fromEntries(Object.keys(g.scores).map(id => [id, {pts:0, correct:false, fast:false, ans:null, t:g.buzz[id] ?? null}])), winner:null, winPts:0, double:false, endedEarly:true};
      g.phase = 'reveal'; g.hold = true; g.endedEarly = true; g.paused = false; s.roundStatus = 'endedEarly'; return s; }
    /* back to the SAME recommendations; the game is kept (suspended) so the group can return to it with its scores */
    case 'BACK_TO_RECS': { const g = s.gameSession;
      if (g && ['countdown', 'intro', 'listen'].includes(g.phase)) s = reduce(s, {type:'END_ROUND_EARLY', at:a.at});
      if (s.gameSession && s.gameSession.phase === 'reveal') s.gameSession.hold = true;
      s.tvState.fromNext = false; setStatus('matches'); return s; }
    case 'RESUME_GAME': if (!s.gameSession) return s; s.selectedGame = s.gameSession.game || 'firstnotes';
      setStatus(s.gameSession.phase === 'done' ? 'finished' : 'playing'); return s;
    case 'NEXT_ROUND': { const g = s.gameSession; if (!g) return s; g.hold = false;
      return g.round < 5 ? reduce(s, {type:'ROUND_INTRO', round:g.round + 1, at:a.at}) : reduce(s, {type:'FINISH', at:a.at}); }
    case 'FINISH': s.gameSession.phase = 'done'; s.gameSession.hold = false; if (!s.played.includes(s.selectedGame)) s.played.push(s.selectedGame); setStatus('finished'); return s;
    case 'PAUSE': if (s.gameSession) s.gameSession.paused = a.id || true; return s;
    case 'RESUME': if (s.gameSession) s.gameSession.paused = false; return s;

    /* ---------- after the game ---------- */
    case 'TRY_ANOTHER': s.tvState.fromNext = true; setStatus('nextMatch'); return s;   // same saved recommendations, the played game is marked
    case 'PLAY_AGAIN': s.players.forEach(p => p.ready = p.isHost); s.gameSession = null; setStatus('ready'); return s;
  }
  return s;
}

/* ---------- ranking helpers (read-only) ---------- */
function ranking(gs, sc) {
  sc = sc || gs.scores;
  return CAST.filter(p => sc[p.id] !== undefined).map(p => ({id:p.id, n:person(p.id).n, c:p.c, s:sc[p.id]}))
    .sort((a, b) => b.s - a.s || (gs.buzzSum[a.id] - gs.buzzSum[b.id]) || a.id.localeCompare(b.id));
}
const ordinal = i => ['1st', '2nd', '3rd', '4th', '5th', '6th'][i] || (i + 1) + 'th';

/* ---------- Store: the single source of truth for the room ----------
   Every change is an action with a unique id (aid), recorded in state.log.
   - The AUTHORITY device (TV in live mode) applies actions in arrival order and broadcasts the resulting state.
   - Every other device applies its own actions optimistically, then adopts the authority's state when it arrives,
     re-applying any of its own actions the authority hasn't seen yet (so nothing flickers or gets lost).
   - With no authority around (demo tabs only), devices reconcile peer-to-peer with revision numbers. */
const Store = (() => {
  let state = initialShared(), subs = [], pending = [], seq = 0;
  const notified = new Set();
  const persist = () => { try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {} };
  const notify = a => subs.forEach(fn => { try { fn(state, a); } catch (e) { console.error(e); } });
  const rev = () => state.rev || 0;
  const isAuth = () => typeof Authority !== 'undefined' && Authority.isMe();
  const step = (st, a) => { st = reduce(st, a); if (a.aid) { st.log = (st.log || []).concat(a.aid).slice(-60); } return st; };
  function adoptAuth(snap) {                                 // authority state + my not-yet-seen actions on top
    let st = JSON.parse(JSON.stringify(snap));
    const log = new Set(st.log || []), now = Date.now();
    pending = pending.filter(p => !log.has(p.a.aid) && now - p.t < 8000);
    pending.forEach(p => { st = step(st, p.a); });
    state = st; state.updatedAt = Date.now(); persist();
  }
  const notifyOnce = a => { if (a && a.aid && notified.has(a.aid)) return notify({type:'SYNC', of:a.type}); if (a && a.aid) { notified.add(a.aid); if (notified.size > 400) notified.clear(); } notify(a); };
  return {
    get: () => state,
    subscribe: fn => { subs.push(fn); return () => subs = subs.filter(f => f !== fn); },
    load() { try { const raw = localStorage.getItem(STATE_KEY); state = raw ? JSON.parse(raw) : initialShared(); } catch (e) { state = initialShared(); } return state; },
    dispatch(a) {
      if (a.at === undefined) a.at = Date.now();
      if (!a.aid) a.aid = (typeof Sync !== 'undefined' ? Sync.tabId : 'x') + '.' + (++seq);
      const base = rev();
      state = step(state, a); state.rev = base + 1; state.updatedAt = Date.now(); persist();
      if (!isAuth()) pending.push({a, t:Date.now()});
      if (typeof Sync !== 'undefined') Sync.send({kind:'state', action:a, baseRev:base, state, auth:isAuth()});
      notifyOnce(a);
    },
    /* a change from another device */
    receive(m) {
      const a = m.action || {type:'SYNC'};
      if (isAuth()) {
        if (m.auth) { adoptAuth(m.state); return notifyOnce(a); }     // two engines (rare, during a hand-over): take the newer one
        const base = rev();                                           // authority: apply in arrival order, then rebroadcast
        state = step(state, a); state.rev = base + 1; state.updatedAt = Date.now(); persist();
        if (typeof Sync !== 'undefined') Sync.send({kind:'state', action:a, baseRev:base, state, auth:true});
        return notifyOnce(a);
      }
      if (m.auth) { adoptAuth(m.state); return notifyOnce(a); }
      const local = rev();                                            // peer-to-peer (no authority yet)
      if (m.baseRev === local || (m.baseRev < local && !['LOAD', 'RESET', 'CREATE_ROOM', 'CLOSE_ROOM'].includes(a.type))) { state = step(state, a); state.rev = local + 1; }
      else state = JSON.parse(JSON.stringify(m.state));
      state.updatedAt = Date.now(); persist(); notifyOnce(a);
    },
    /* snapshot sent to a device that just opened */
    adopt(snap, fromAuth) {
      if (!snap) return;
      if (isAuth() && !fromAuth) return;
      if (!fromAuth && (snap.rev || 0) < rev()) return;
      adoptAuth(snap); notify({type:'SYNC'});
    },
    /* switch to another room's saved state (live mode keeps one state per room code) */
    useRoom(code) { STATE_KEY = LIVE && code ? STATE_KEY_BASE + '_' + code : STATE_KEY_BASE; pending = []; return this.load(); }
  };
})();
