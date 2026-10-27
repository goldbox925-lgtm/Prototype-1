/* PLAYMODE · First Notes (the fully playable demo game) + the room engine.
   The engine runs only on the authority tab (the host phone or the default demo page). It drives timers and
   simulates every player who does not have their own browser tab. Everything it does goes through store actions. */

/* Rounds: original placeholder tunes (MIDI notes), not real recordings. t = scripted buzz times for simulated players;
   others > 0 means that simulated player answers correctly. */
const ROUNDS = [
  {opts:[['Flowers', 'Miley Cyrus'], ['Levitating', 'Dua Lipa'], ['Good 4 U', 'Olivia Rodrigo'], ['Blinding Lights', 'The Weeknd']], ok:0,
   t:{Emma:1.8, Sophie:2.0, Liam:2.6, Jess:3.0, Alex:2.3}, others:{Sophie:100, Liam:100, Jess:0, Alex:100}, notes:[64, 67, 69, 71, 69, 67, 64, 62, 64, 67, 72, 71]},
  {opts:[['As It Was', 'Harry Styles'], ['Anti-Hero', 'Taylor Swift'], ['Espresso', 'Sabrina Carpenter'], ['Bad Habits', 'Ed Sheeran']], ok:2,
   t:{Emma:2.6, Sophie:1.4, Liam:2.5, Jess:2.9, Alex:2.2}, others:{Sophie:120, Liam:100, Jess:0, Alex:0}, notes:[60, 64, 67, 64, 65, 69, 72, 69, 67, 64, 62, 60]},
  {opts:[['Uptown Funk', 'Mark Ronson ft. Bruno Mars'], ['Shape of You', 'Ed Sheeran'], ['Dance Monkey', 'Tones and I'], ['Bad Guy', 'Billie Eilish']], ok:0,
   t:{Emma:2.3, Sophie:1.5, Liam:3.0, Jess:2.7, Alex:2.0}, others:{Sophie:120, Liam:0, Jess:100, Alex:100}, notes:[57, 57, 60, 62, 64, 62, 60, 57, 55, 57, 60, 62]},
  {opts:[['Dancing Queen', 'ABBA'], ['Mr. Brightside', 'The Killers'], ['Shake It Off', 'Taylor Swift'], ['Rolling in the Deep', 'Adele']], ok:1,
   t:{Emma:2.4, Sophie:2.2, Liam:3.1, Jess:1.5, Alex:2.8}, others:{Sophie:100, Liam:0, Jess:120, Alex:100}, notes:[62, 62, 66, 69, 71, 69, 66, 64, 62, 64, 66, 69]},
  {opts:[['Cruel Summer', 'Taylor Swift'], ['Houdini', 'Dua Lipa'], ['Vampire', 'Olivia Rodrigo'], ['Paint The Town Red', 'Doja Cat']], ok:0,
   t:{Emma:1.6, Sophie:2.0, Liam:2.4, Jess:3.2, Alex:2.6}, others:{Sophie:200, Liam:200, Jess:0, Alex:0}, double:true, notes:[69, 72, 76, 74, 72, 69, 67, 69, 72, 74, 76, 79]}];
const nameOf = id => seatName(id);   // scripted timings are keyed by seat, whatever name the player chose
/* Scripted answer for a simulated player: Emma (when simulated) is always right; others follow ROUNDS.others. */
function simAnswer(id, round) {
  const R = ROUNDS[round - 1];
  const correct = id === 'emma' ? true : (R.others[nameOf(id)] || 0) > 0;
  return correct ? R.ok : (R.ok + 1 + (id.length % 3)) % 4;
}

/* Vault: private player input, held ONLY on the authority device (the TV in live mode).
   Preferences feed the group match; answers stay sealed until the reveal. Kept per room on this device. */
const Vault = (() => {
  let v = {prefs:{}, answers:{}};
  const key = () => 'playmode_vault_' + (roomCode() || 'demo');
  const save = () => { try { localStorage.setItem(key(), JSON.stringify(v)); } catch (e) {} };
  return {
    load() { try { v = JSON.parse(localStorage.getItem(key()) || 'null') || {prefs:{}, answers:{}}; } catch (e) { v = {prefs:{}, answers:{}}; } },
    clear(what) { if (!what || what === 'prefs') v.prefs = {}; if (!what || what === 'answers') v.answers = {}; save(); },
    setPrefs(id, p) { v.prefs[id] = {vibe:p.vibe, interests:(p.interests || []).slice(0, 6)}; save(); },
    prefs: () => v.prefs,
    setAnswer(round, id, ans) { (v.answers[round] = v.answers[round] || {})[id] = ans; save(); },
    answers: round => v.answers[round] || {}
  };
})();
/* Recommendations from everyone's real preferences: the private vault, plus any shared demo fixtures. */
function recsFromVault(s, exclude) { return computeRecs(s, exclude || [], {...openPrefs(s.playerPreferences), ...Vault.prefs()}); }

const Engine = (() => {
  let on = false, timers = [], done = new Set(), held = new Set(), tickIv = null;
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const once = (key, fn) => { if (done.has(key)) return; done.add(key); fn(); };
  const D = a => Store.dispatch(a);
  const S = () => Store.get();
  /* simulated = nobody holds the seat. A real player's seat is never auto-played, even while their phone is offline. */
  const isBot = id => { const p = S().players.find(x => x.id === id); return !(p && p.human) && !Presence.isHuman(id); };
  const clearAll = () => { timers.forEach(clearTimeout); timers = []; done = new Set(); if (tickIv) clearInterval(tickIv); tickIv = null; };

  /* Players are never auto-added: real tabs join with the code, simulated ones via "Demo: Add remaining players". */
  function onState(s, a) {
    if (!on || !Leader.isMe()) return;          // only the engine-leader tab simulates players and runs timers
    if (a && (a.type === 'RESET' || a.type === 'CREATE_ROOM' || a.type === 'LOAD' || a.type === 'CLOSE_ROOM')) { clearAll(); if (a.type !== 'LOAD') Vault.clear(); }
    if (a && a.type === 'START_GAME') Vault.clear('answers');
    if (!s.room) return;
    publishKey(s);
    const st = s.room.status, key = st + ':' + s.room.statusAt;
    if (st === 'collecting') {
      once('prefs:' + key, () => {
        CAST.map(p => p.id).filter(id => id !== HOST_ID).concat(HOST_ID).forEach((id, i) => later(() => {
          const now = S(); if (now.room.status !== 'collecting') return;
          const p = now.players.find(x => x.id === id);
          if (p && p.joined && isBot(id) && !held.has(id) && !now.playerPreferences[id]) { Vault.setPrefs(id, DEMO_PREFS[id]); D({type:'SUBMIT_PREFS', id, sealed:true}); }
        }, 1400 + i * 900));
      });
      if (allPrefsIn(s)) once('begin:' + key, () => later(() => D({type:'BEGIN_MATCHING'}), 1100));
    }
    if (st === 'matching') {
      once('signals:' + key, () => { const all = {...openPrefs(s.playerPreferences), ...Vault.prefs()}, r = recsFromVault(s);
        D({type:'MATCH_SIGNALS', signals:groupSignals(joinedPlayers(s), all), top:r.top[0] ? {id:r.top[0].id, score:r.top[0].score} : null}); });
      once('match:' + key, () => later(() => D({type:'SHOW_MATCHES', recommendations:recsFromVault(S())}), 5200));
    }
    if (st === 'ready') once('ready:' + key, () => {
      s.players.filter(p => p.joined && !p.isHost).forEach((p, i) => later(() => { if (isBot(p.id) && S().room.status === 'ready') D({type:'SET_READY', id:p.id}); }, 800 + i * 550));
    });
    if (a && a.type === 'BACK_TO_RECS' && tickIv) { clearInterval(tickIv); tickIv = null; }
    if (st === 'playing' && a) gameStep(s, a);
  }

  function gameStep(s, a) {
    const g = s.gameSession;
    if (a.type === 'START_GAME') {
      const live = () => { const st = S(), gg = st.gameSession; return st.room && st.room.status === 'playing' && gg && gg.phase === 'countdown'; };
      later(() => live() && D({type:'COUNTDOWN', n:2}), 1000);
      later(() => live() && D({type:'COUNTDOWN', n:1}), 2000);
      later(() => live() && D({type:'LISTEN_START', round:1}), 3000);
    }
    if (a.type === 'ROUND_INTRO' || (a.type === 'NEXT_ROUND' && g && g.phase === 'intro')) { const rr = g.round;
      later(() => { const gg = S().gameSession; if (S().room.status === 'playing' && gg && gg.phase === 'intro' && gg.round === rr) D({type:'LISTEN_START', round:rr}); }, ROUNDS[rr - 1].double ? 3400 : 2600); }
    if (a.type === 'END_ROUND_EARLY') { if (tickIv) { clearInterval(tickIv); tickIv = null; } }
    if (a.type === 'LISTEN_START') startRound(a.round, a.at);
    if (a.type === 'BUZZ' || a.type === 'LOCK' || a.type === 'TICK') checkRound(s);
    if (a.type === 'REVEAL' && !g.hold) {
      if (tickIv) { clearInterval(tickIv); tickIv = null; }
      const r = g.round;
      later(() => { const st = S(), gg = st.gameSession;            // never auto-advance a held / suspended game
        if (!gg || st.room.status !== 'playing' || gg.hold || gg.phase !== 'reveal' || gg.round !== r) return;
        if (r < 5) D({type:'ROUND_INTRO', round:r + 1}); else D({type:'FINISH'}); }, 3600);
    }
  }

  function startRound(round, listenAt) {
    if (tickIv) clearInterval(tickIv);
    tickIv = setInterval(() => { const g = S().gameSession; if (g && g.phase === 'listen' && !g.paused) D({type:'TICK'}); }, 1000);
    const R = ROUNDS[round - 1];
    const players = S().players.filter(p => p.joined);
    players.forEach(p => {
      const tb = R.t[nameOf(p.id)];
      let wasHeld = false;
      const doBuzz = () => {
        const g = S().gameSession;
        if (!g || g.phase !== 'listen' || g.round !== round || !isBot(p.id) || held.has(p.id)) return;
        if (g.paused) return later(doBuzz, 400);
        const el = (Date.now() - g.listenAt) / 1000;
        if (g.buzz[p.id] === undefined) D({type:'BUZZ', id:p.id, t:+Math.max(tb, el).toFixed(1)});
        later(() => botLock(p.id, round), 2200);
      };
      const tryBuzz = () => {
        const s = S(), g = s.gameSession;
        if (!g || g.phase !== 'listen' || g.round !== round || !isBot(p.id) || held.has(p.id)) return;
        if (g.paused) return later(tryBuzz, 400);
        const el = (Date.now() - g.listenAt) / 1000;
        // keep the script: a real player who is scripted to be faster gets the chance to buzz first
        const faster = players.filter(h => !isBot(h.id) && R.t[nameOf(h.id)] < tb);
        const waitFor = faster.some(h => g.buzz[h.id] === undefined);
        if (waitFor && el < 6) { wasHeld = true; return later(tryBuzz, 150); }
        // released after waiting: follow the scripted order (smaller gap → sooner)
        if (wasHeld) { const ref = Math.min(...faster.map(h => R.t[nameOf(h.id)]), tb); return later(doBuzz, 150 + (tb - ref) * 450); }
        doBuzz();
      };
      later(tryBuzz, tb * 1000);
    });
  }
  function botLock(id, round) {
    const g = S().gameSession;
    if (!g || g.phase !== 'listen' || g.round !== round || g.lock[id] !== undefined || !isBot(id) || held.has(id)) return;
    if (g.paused) return later(() => botLock(id, round), 400);
    Vault.setAnswer(round, id, simAnswer(id, round));
    D({type:'LOCK', id, sealed:true, t:g.buzz[id] ?? +((Date.now() - g.listenAt) / 1000).toFixed(1)});
  }
  /* the reveal opens the sealed answers: the TV passes them into the shared state only now */
  function reveal() { const g = S().gameSession; if (g && g.phase === 'listen') D({type:'REVEAL', answers:Vault.answers(g.round)}); }
  function checkRound(s) {
    const g = s.gameSession; if (!g || g.phase !== 'listen') return;
    const ids = s.players.filter(p => p.joined).map(p => p.id);
    const humans = ids.filter(id => !isBot(id));
    // once every real player has locked in, simulated players finish quickly (as in the original prototype)
    if (humans.length && humans.every(id => g.lock[id] !== undefined)) once('accel:' + g.round + ':' + g.listenAt, () => {
      if (tickIv) { clearInterval(tickIv); tickIv = null; }
      ids.filter(id => isBot(id) && !held.has(id)).forEach((id, i) => later(() => {
        const gg = S().gameSession; if (gg && gg.phase === 'listen' && gg.buzz[id] === undefined) D({type:'BUZZ', id, t:+((Date.now() - gg.listenAt) / 1000).toFixed(1)});
        botLock(id, g.round);
      }, 350 + i * 250));
    });
    const everyone = ids.filter(id => !held.has(id)).every(id => g.lock[id] !== undefined);
    if (everyone) once('reveal:' + g.round + ':' + g.listenAt, () => later(() => reveal(), 1400));
    if (g.timer === 0) once('reveal:' + g.round + ':' + g.listenAt, () => later(() => reveal(), 900));
  }

  /* the TV's public key goes into the room, so phones can seal private input for the TV only */
  let keyBusy = false;
  function publishKey(s) {
    if (keyBusy || !s.room) return;
    const k = Sealed.publicKey;
    if (k && s.room.key && s.room.key.kid === k.kid) return;
    keyBusy = true;
    Sealed.ensureKeys(s.room.code).then(jwk => { keyBusy = false; const r = S().room; if (jwk && r && (!r.key || r.key.kid !== jwk.kid)) D({type:'SET_ROOM_KEY', key:jwk}); }).catch(() => { keyBusy = false; });
  }
  /* private input from phones (only this device can read it) */
  function onSealed(m) {
    const s = S(); if (!s.room || !m || !m.id) return;
    if (m.t === 'prefs') {
      Vault.setPrefs(m.id, m);
      if (['matches', 'details', 'nextMatch'].includes(s.room.status)) D({type:'SET_RECS', recommendations:recsFromVault(s, s.recommendations ? s.recommendations.exclude : [])});
    }
    if (m.t === 'answer') Vault.setAnswer(m.round, m.id, m.ans);
  }
  /* join / leave / offline status for real players, from device heartbeats */
  /* watchdog: if a timer was lost (tab in the background, refresh at an awkward moment) the round still moves on */
  let phaseKey = '', phaseSince = 0;
  function watchdog() {
    if (!on || !Leader.isMe()) return;
    const s = S(), g = s.gameSession;
    if (!s.room || s.room.status !== 'playing' || !g || g.paused) { phaseKey = ''; return; }
    const k = g.round + g.phase + (g.phase === 'listen' ? g.timer : '') + (g.hold ? 'H' : '');
    if (k !== phaseKey) { phaseKey = k; phaseSince = Date.now(); return; }
    const idle = Date.now() - phaseSince;
    if (g.phase === 'reveal' && !g.hold && idle > 7000) { phaseKey = ''; g.round < 5 ? D({type:'ROUND_INTRO', round:g.round + 1}) : D({type:'FINISH'}); }
    else if ((g.phase === 'intro' || g.phase === 'countdown') && idle > 7000) { phaseKey = ''; D({type:'LISTEN_START', round:g.phase === 'countdown' ? 1 : g.round}); }
    else if (g.phase === 'listen' && idle > 3500) { phaseKey = ''; if (g.timer > 0) D({type:'TICK'}); else reveal(); }
  }
  let since = Date.now();
  function presenceTick() {
    if (!on || !Leader.isMe() || Date.now() - since < 10000) return;      // give phones a moment to check in after a TV refresh
    const s = S(); if (!s.room) return;
    s.players.filter(p => p.joined && p.human).forEach(p => { const live = Presence.isHuman(p.id); if ((p.online !== false) !== live) D({type:'PLAYER_STATUS', id:p.id, online:live}); });
  }

  /* a tab that becomes the engine (first load, refresh, or the old engine tab closed) picks up where the room is */
  function kick() {
    if (!on || !Leader.isMe()) return;
    clearAll(); Vault.load(); since = Date.now(); const s = S(); if (!s.room) return;
    onState(s, {type:'BOOT'});
    const g = s.gameSession; if (s.room.status !== 'playing' || !g) return;
    if (g.phase === 'countdown') later(() => D({type:'LISTEN_START', round:1}), 1200);
    if (g.phase === 'intro') later(() => D({type:'LISTEN_START', round:g.round}), 1200);
    if (g.phase === 'listen') startRound(g.round, g.listenAt);
    if (g.phase === 'reveal' && !g.hold) later(() => { const gg = S().gameSession; if (gg && !gg.hold && gg.phase === 'reveal') gg.round < 5 ? D({type:'ROUND_INTRO', round:gg.round + 1}) : D({type:'FINISH'}); }, 2500);
  }

  return {
    start() { on = true; Store.subscribe(onState); Sealed.on(m => { if (Leader.isMe()) onSealed(m); }); setInterval(presenceTick, 2000); setInterval(watchdog, 1000); },
    kick,
    get active() { return on; },
    hold(id, v) { v ? held.add(id) : held.delete(id); },
    clearHolds() { held.clear(); },
    reset() { clearAll(); held.clear(); }
  };
})();

/* ---------- TV audio (placeholder tunes, played by whichever tab shows the TV) ---------- */
let audioCtx = null, sound = true, clipNodes = [];
function unlockAudio() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }
function playClip(notes) {
  if (!sound || !audioCtx) return; stopClip();
  const t0 = audioCtx.currentTime + .05, step = .28;
  notes.forEach((m, i) => {
    const f = 440 * Math.pow(2, (m - 69) / 12), o = audioCtx.createOscillator(), o2 = audioCtx.createOscillator(), gn = audioCtx.createGain();
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f / 2;
    const t = t0 + i * step;
    gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(.11, t + .03); gn.gain.exponentialRampToValueAtTime(.0001, t + step * .95);
    o.connect(gn); o2.connect(gn); gn.connect(audioCtx.destination); o.start(t); o2.start(t); o.stop(t + step); o2.stop(t + step);
    clipNodes.push(o, o2);
  });
}
function stopClip() { clipNodes.forEach(n => { try { n.stop(); } catch (e) {} }); clipNodes = []; }
function beep(f, d) {
  if (!sound || !audioCtx) return;
  const o = audioCtx.createOscillator(), gn = audioCtx.createGain(), t = audioCtx.currentTime;
  o.type = 'sine'; o.frequency.value = f; gn.gain.setValueAtTime(.12, t); gn.gain.exponentialRampToValueAtTime(.0001, t + d + .1);
  o.connect(gn); gn.connect(audioCtx.destination); o.start(t); o.stop(t + d + .12);
}
