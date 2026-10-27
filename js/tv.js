/* PLAYMODE · TV UI.
   TV = shared atmosphere, shared status and shared results. It never mirrors the phone UI and never shows
   anyone's private answers — only group status and aggregate counts. */

const tvc = document.getElementById('tvc');
const tvScreen = document.getElementById('tvScreen');
let tvConnPhase = null;            // local "Emma's iPhone is connecting…" (demo page only)
function tvConnecting(on) { tvConnPhase = on ? 'connecting' : null; renderTV(true); }

const tvTop = (right, showDots = true) => { const s = Store.get(), g = s.gameSession, t = OCCASION_THEMES[s.hostContext.occasion];
  const label = [s.selectedGame && ['ready', 'playing', 'finished'].includes(s.room && s.room.status) ? G[s.selectedGame].name : null, t ? t.label : null].filter(Boolean).join(' · ') || 'Room ' + roomCode();
  return `<div class="tvtop"><div>${LOGO()}<div class="gname">${label}</div></div>
  ${showDots && g ? `<div class="tvdots">${[1, 2, 3, 4, 5].map(i => `<i class="${i < g.round || (i === g.round && g.phase === 'reveal') ? 'done' : i === g.round ? 'on' : ''}"></i>`).join('')}</div>` : ''}<div>${right || ''}</div></div>`; };
const tav = id => `<span class="tav" style="background-image:url(${avURL(id)})"></span>`;
const ringSVG = (t, max = 10) => { const c = 2 * Math.PI * 44; return `<div class="ring ${t <= 3 ? 'warn' : ''}"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="rgba(6,27,53,.65)" stroke="rgba(255,255,255,.15)" stroke-width="7"/><circle id="ringArc" cx="50" cy="50" r="44" fill="none" stroke="${t <= 3 ? '#FF6077' : 'url(#rg)'}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - t / max)}" style="transition:stroke-dashoffset 1s linear"/><defs><linearGradient id="rg"><stop offset="0" stop-color="#38C7FF"/><stop offset="1" stop-color="#FF4F7B"/></linearGradient></defs></svg><b id="tvTimer">${t}</b></div>`; };
function strip() {
  const s = Store.get(), g = s.gameSession, rk = ranking(g), mx = Math.max(100, ...Object.values(g.scores)), anyScore = Object.values(g.scores).some(v => v > 0);
  return `<div class="strip tv-glass">${joinedPlayers(s).map(p => { const f = g.lock[p.id] !== undefined ? 'lock' : g.buzz[p.id] !== undefined ? 'buzz' : null, k = rk.findIndex(r => r.id === p.id) + 1;
    return `<div class="sp ${g.paused === p.id ? 'off' : ''}" style="--c:${p.color}">${tav(p.id)}${k === 1 && g.scores[p.id] > 0 ? `<img class="crown-mini" src="${IMG.crown}" alt="" style="border-radius:.4cqw">` : ''}
    ${f ? `<span class="flag ${f === 'lock' ? 'ok' : ''}">${f === 'lock' ? I('check') + 'In' : I('bolt') + 'Buzz'}</span>` : ''}
    <div><div class="nm">${p.name}</div><div class="sc">${g.scores[p.id]}</div><div class="bar"><i data-w="${g.scores[p.id] / mx * 100}"></i></div></div>${anyScore ? `<span class="rkb ${k === 1 ? 'r1' : ''}">#${k}</span>` : ''}</div>`; }).join('')}</div>`;
}
function lboard(g, prev) { const rk = ranking(g), mx = Math.max(100, rk[0].s);
  return `<div class="lb">${rk.map((r, i) => { const d = prev ? g.scores[r.id] - prev[r.id] : null; return `<div class="lbr ${i === 0 ? 'first' : ''}" style="--c:${r.c};animation:inUp .5s ${i * .08}s both"><span class="rk">${i + 1}</span>${tav(r.id)}<span class="nm">${r.n}</span><span class="barw"><i data-w="${r.s / mx * 100}"></i></span>${d !== null ? `<span class="dl ${d ? '' : 'z'}">+${d}</span>` : ''}<span class="sc">${r.s}</span></div>`; }).join('')}</div>`; }
const firstBuzz = g => { const o = Object.entries(g.buzz).sort((a, b) => a[1] - b[1]); return o[0] ? o[0][0] : null; };

/* ---------- which TV view? ---------- */
function tvView() {
  const s = Store.get(), r = s.room;
  if (!r || !r.tvConnected) return 'idle';
  const g = s.gameSession;
  switch (r.status) {
    case 'lobby': case 'context': return 'join';
    case 'collecting': return 'collect';
    case 'matching': return 'matching';
    case 'matches': return 'matches';
    case 'details': return s.tvState.fromNext ? 'next' : 'matches';
    case 'ready': return 'ready';
    case 'playing': return !g || g.phase === 'countdown' ? 'ready' : g.phase === 'intro' ? 'intro' : g.phase === 'listen' ? 'round' : g.phase === 'reveal' ? 'reveal' : 'winner';
    case 'finished': return 'winner';
    case 'nextMatch': return 'next';
  }
  return 'idle';
}
const GAME_VIEWS = ['intro', 'round', 'reveal', 'winner'];

const TVV = {
  idle: () => `<div class="disco-hang">${disco('tvd1', true)}</div><div class="tv-center tv-in" style="padding-top:8cqw">${LOGO('6.4cqw')}<div class="tv-p" style="font-size:2cqw;margin-top:1.4cqw">Play together. Feel closer.</div>
      <div class="tv-glass" style="margin-top:3cqw;padding:1.8cqw 3cqw;display:flex;align-items:center;gap:2.4cqw">
      ${tvConnPhase === 'connecting' ? `<span class="spin dark" style="width:2.6cqw;height:2.6cqw;border-width:.35cqw"></span><div style="text-align:left"><div style="font-size:2cqw;font-weight:600">${person(Store.get().room ? Store.get().room.hostId : 'emma').n}'s phone is connecting…</div><div class="tv-p" style="margin:0;font-size:1.4cqw">Keep the PLAYMODE app open</div></div>`
       : `<div style="text-align:left"><div class="tv-p" style="margin:0;font-size:1.4cqw">Host: open PLAYMODE → Create a Room → Connect TV</div><div style="font-size:2.2cqw;font-weight:600;margin-top:.3cqw">Living Room TV · Ready to connect</div></div><div style="text-align:left;border-left:1px solid rgba(16,32,74,.12);padding-left:2.4cqw"><div class="tv-p" style="margin:0;font-size:1.3cqw">Room code</div><div style="font-size:3cqw;font-weight:700;letter-spacing:.15em">${TV_PAIR_CODE}</div></div><div class="qrbox sm">${joinQR()}</div>`}
      </div>${tvConnPhase ? '' : `<div class="tv-chip" style="margin-top:2cqw">${I('wifi')}Not in a room yet · waiting for the host’s phone</div>`}</div>`,

  /* T1 · TV has joined Room 2048: code to join + who is in (joined players only) */
  join: () => { const s = Store.get(), jp = joinedPlayers(s), all = jp.length === CAST.length;
    const where = LIVE ? appBaseURL().replace(/^https?:\/\//, '').replace(/index\.html$/, '') : '';
    return `${tvTop(`<span class="tv-chip mint">${I('tv')}${LIVE ? 'Live room' : 'TV connected'}</span>`, false)}
    <div class="tv-center tv-in" style="padding-top:2.6cqw">
      <div class="tv-p" style="font-size:1.9cqw;margin:0;letter-spacing:.24em;font-weight:600">ROOM ${roomCode()}</div>
      <div class="tv-h neon" id="tvJoinH" style="font-size:${all ? 5.2 : 4.4}cqw;margin-top:.3cqw">${all ? 'Everyone’s here!' : 'Join the room'}</div>
      <div class="tv-glass" style="display:flex;align-items:center;gap:3cqw;padding:1.8cqw 3cqw;margin-top:1.8cqw">
        <div class="qrbox" data-join-url="${joinURL(roomCode())}">${joinQR()}</div><div style="text-align:left"><div class="tv-p" style="margin:0">Scan, or join on your phone with code</div><div class="tv-code">${roomCode()}</div><div class="tv-p" style="font-size:1.4cqw">${LIVE ? `${where}<br>→ Join a room` : 'PLAYMODE app → Join a Room'}</div></div></div>
      <div class="tv-av" style="margin-top:2.4cqw" id="tvAv">${tvJoinAv(s)}</div>
      <div class="tv-p" id="tvWait" style="margin-top:1.4cqw">${joinWaitText(s)}</div>${tvEventChip(s)}</div>`; },

  /* T2 · Preferences: group status only */
  collect: () => { const s = Store.get(), jp = joinedPlayers(s), got = prefsCount(s);
    return `${tvTop('', false)}<div class="tv-center tv-in" style="padding-top:3cqw">
      <div class="tv-p" style="font-size:2cqw;margin:0;letter-spacing:.06em">FIND YOUR GROUP MATCH</div>
      <div class="tv-h neon" style="font-size:4cqw;margin-top:.6cqw">Finding what works for everyone</div>
      <div class="tv-glass collect-card"><div class="cc-n"><b id="tvGot">${got}</b> of ${jp.length}</div><div class="cc-l">preferences received</div>
        <div class="cc-bar"><i id="tvGotBar" style="width:${got / jp.length * 100}%"></i></div></div>
      <div class="tv-av pref-av" id="tvPrefAv">${jp.map(p => { const ok = !!s.playerPreferences[p.id]; return `<div class="p ${ok ? 'rdy' : 'think'} ${p.online === false ? 'off' : ''}" data-p="${p.id}">${tav(p.id)}${p.name}<small>${ok ? '✓' : '<span class="dots3"><i></i><i></i><i></i></span>'}</small></div>`; }).join('')}</div>
      <div class="tv-chip" style="margin-top:1.6cqw">${I('lock')}Answers stay private on each phone</div></div>`; },

  /* T3 · Matching: anonymous aggregate chips converge → % → game */
  matching: () => { const s = Store.get(), ms = s.matchSignals;   // anonymous counts + the top game, published by the TV (answers stay sealed)
    const sig = ms ? ms.signals : groupSignals(joinedPlayers(s), openPrefs(s.playerPreferences));
    const r = ms && ms.top ? ms.top : (recommendGames(joinedPlayers(s), openPrefs(s.playerPreferences), s.hostContext, []).top[0] || {id:'firstnotes', score:0});
    const chips = sig.vibes.map(([k, n]) => ({l:vibeName(k), n, c:'v'})).concat(sig.interests.map(([k, n]) => ({l:interestName(k), n, c:k})));
    return `${tvTop('', false)}<div class="tv-center" style="padding:0">
      <div class="tv-p match-t tv-in">Finding your group match…</div>
      <div class="converge">${chips.map((c, i) => { const ang = (i / chips.length) * Math.PI * 2 - Math.PI / 2, x = Math.cos(ang) * 30, y = Math.sin(ang) * 15;
        return `<span class="cchip ${c.c}" style="--x:${x.toFixed(1)}cqw;--y:${y.toFixed(1)}cqw;--d:${(i * .12).toFixed(2)}s">${c.l} <b>×${c.n}</b></span>`; }).join('')}
        <div class="cring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="bg"/><circle cx="50" cy="50" r="44" class="fg" style="--p:${r ? r.score : 0}"/></svg>
          <div class="cpct"><b id="tvPct" data-to="${r ? r.score : 0}">0</b><small>%</small></div><div class="cgm">GROUP MATCH</div></div>
        ${r ? `<div class="cgame">${G[r.id].name.toUpperCase()}</div>` : ''}</div></div>`; },

  /* T4 · Best Matches */
  matches: () => matchesTV(false),
  next: () => matchesTV(true),

  /* T5 · Ready + countdown */
  ready: () => { const s = Store.get(), g = s.gameSession, jp = joinedPlayers(s), rdy = jp.filter(p => p.ready).length, cnt = g && g.phase === 'countdown' ? g.count : 0;
    const wait = jp.filter(p => !p.ready).map(p => p.name);
    return `${tvTop('', false)}<div class="tv-center tv-in">
      <div class="tv-h neon" style="font-size:7cqw">${G[s.selectedGame].name.toUpperCase()}</div><div class="tv-p" style="font-size:2.2cqw">5 rounds · +100 correct · +20 fastest</div>
      <div class="chain">${[['ear', 'Listen', '#FF4F7B'], ['bolt', 'Buzz', '#E8930C'], ['edit', 'Answer', '#1F9BE0'], ['star', 'Reveal', '#7A5CFF']].map((c, i) => `${i ? `<span class="arr">${I('arrow')}</span>` : ''}<div class="c tv-glass"><span class="ib2" style="background:${c[2]}33;color:${c[2]}">${I(c[0])}</span>${c[1]}</div>`).join('')}</div>
      <div style="margin-top:2.2cqw;height:13cqw;display:grid;place-items:center">${cnt ? `<div style="display:flex;align-items:center;gap:2cqw"><span class="tv-p" style="margin:0;font-size:2.6cqw;font-weight:600">Starts in</span><span class="count" key="${cnt}">${cnt}</span></div>`
        : `<div><div class="tv-av ready-av">${jp.map(p => `<div class="p ${p.ready ? 'rdy' : 'pending-soft'}">${tav(p.id)}${p.name}<small>${p.ready ? 'Ready ✓' : '…'}</small></div>`).join('')}</div>
           <span class="tv-chip ${rdy === jp.length ? 'mint' : ''}" style="margin-top:1.2cqw">${rdy === jp.length ? 'Everyone’s ready · ' + person(s.room.hostId).n + ' starts the game' : rdy + ' of ' + jp.length + ' ready · waiting for ' + wait.join(', ')}</span></div>`}</div></div>`; },

  intro: () => { const s = Store.get(), g = s.gameSession, R = ROUNDS[g.round - 1], rk = ranking(g);
    return `${tvTop(`<div class="tvround">Round ${g.round} of 5</div>`)}
    <div class="tv-center tv-in" style="padding-top:6cqw">${R.double ? `<div class="tv-h neon" style="font-size:8cqw">FINAL ROUND</div>
      <div style="display:flex;gap:1.4cqw;margin-top:1.6cqw"><span class="tv-chip amber">${I('flame')}Double points</span><span class="tv-chip pink">${rk[1].n} is ${rk[0].s - rk[1].s} pts behind ${rk[0].n}</span></div>`
      : `<div class="tv-p" style="font-size:2.4cqw;margin:0">Next up</div><div class="tv-h neon" style="font-size:8cqw">Round ${g.round} of 5</div>
      <div class="tv-p">${g.round === 1 ? 'Get ready to buzz' : rk[0].n + ' leads · ' + (rk[0].s - rk[1].s) + ' pts clear — get ready to buzz'}</div>`}</div>${strip()}`; },

  round: () => { const g = Store.get().gameSession;
    return `${tvTop(ringSVG(g.timer))}
    <div class="wave-panel tv-glass tv-in"><div class="tvwave ${g.paused ? 'still' : ''}">${Array.from({length:44}, (_, i) => `<i style="height:${18 + Math.abs(Math.sin(i * .55)) * 70 + (i * 13 % 12)}%;animation-delay:${(i * 97 % 900) / 1000}s"></i>`).join('')}</div>
      <div style="font-size:2cqw;font-weight:600;margin-top:1cqw" id="tvListen">${tvListenText(g)}</div></div>
    <div id="tvBuzzFirst">${buzzCallout(g)}</div>
    ${g.paused ? `<div class="pause-ban tv-glass"><span class="ib2">${I('wifioff')}</span><div><div style="font-size:2.2cqw;font-weight:700">One player lost connection</div><div class="tv-p" style="margin:.3cqw 0 0;font-size:1.5cqw">${person(g.paused === true ? 'emma' : g.paused).n} · game paused for a moment</div></div></div>` : ''}${strip()}`; },

  reveal: () => { const g = Store.get().gameSession, R = ROUNDS[g.round - 1], r = g.results[g.round - 1], win = r.winner, ok = R.opts[R.ok];
    return `${tvTop(`<div class="tvround">Round ${g.round} of 5</div>`)}<div class="tv-center" style="flex-direction:row;gap:4cqw;padding:7cqw 4cqw 0;align-items:center">
      <div style="display:flex;flex-direction:column;align-items:center;gap:1.2cqw" class="tv-in">
        ${win ? `<div class="winner-ph" style="background-image:url(${win === 'emma' ? IMG.emma_big : avURL(win)})"></div><div style="font-size:2.4cqw;font-weight:700">${person(win).n} <span style="color:#FFE66B">+${r.winPts}</span></div>` : `<div class="album"></div>`}
      </div>
      <div style="text-align:left;flex:1;max-width:54cqw">
        <div class="tv-h neon tv-in" style="font-size:${r.endedEarly ? 4.6 : 6}cqw">${r.endedEarly ? 'Round ' + g.round + ' ended early' : win ? 'Correct!' : 'Nobody got it!'}</div>
        ${r.endedEarly ? `<div class="tv-chip" style="margin:1cqw 0 1.4cqw">${I('flag')}Not scored · earlier scores kept</div>` : `
        <div class="tv-glass tv-in" style="display:inline-flex;align-items:center;gap:1.4cqw;padding:1cqw 1.8cqw 1cqw 1cqw;margin:1cqw 0 1.6cqw;animation-delay:.15s"><div class="album" style="width:5cqw;height:5cqw"></div><div><div style="font-size:2.4cqw;font-weight:700;letter-spacing:.02em">${ok[0].toUpperCase()}</div><div class="tv-p" style="margin:0;font-size:1.5cqw">${ok[1]}</div></div></div>`}
        ${lboard(g, g.prevScores)}${g.hold ? `<div class="tv-p" style="margin-top:1cqw;font-size:1.5cqw">${person(Store.get().room.hostId).n} decides what’s next</div>` : g.round < 5 ? `<div class="tv-p" style="margin-top:1cqw;font-size:1.5cqw">Next: Round ${g.round + 1}/5${g.round + 1 === 5 ? ' · Final round ×2' : ''}</div>` : ''}</div></div>`; },

  winner: () => { const s = Store.get(), g = s.gameSession; if (!g) return TVV.idle();
    const rk = ranking(g), w = rk[0], res = g.results.filter(Boolean), ts = res.map(r => r.per[w.id].t).filter(t => t !== null);
    return `${tvTop('', false)}<div class="tv-center" style="flex-direction:row;gap:5cqw;padding:7cqw 5cqw 0">
      <div class="tv-in" style="display:flex;flex-direction:column;align-items:center;gap:1cqw"><img src="${IMG.crown}" alt="" style="width:7cqw;border-radius:1.4cqw;margin-bottom:-2.4cqw;position:relative;z-index:2"><div class="winner-ph" style="width:17cqw;height:17cqw;background-image:url(${w.id === 'emma' ? IMG.emma_big : avURL(w.id)})"></div>
        <div class="tv-p" style="margin-top:.6cqw;letter-spacing:.2em;font-size:1.6cqw">WINNER</div><div class="tv-h neon" style="font-size:5cqw">${w.n.toUpperCase()}</div></div>
      <div style="flex:1;max-width:50cqw">${lboard(g)}
        <div class="stat-row" style="margin-top:1.6cqw">${[[w.s, 'Score'], [res.filter(r => r.per[w.id].correct).length + '/5', 'Correct'], [(ts.length ? Math.min(...ts).toFixed(1) : '–') + 's', 'Fastest buzz'], [joinedPlayers(s).length, 'Players']].map(x => `<div class="tv-glass"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div></div></div>`; }
};

function tvRecList(s, next) {          // the saved recommendations, in display order (never recomputed here)
  const R = s.recommendations; if (!next) return R.top;
  const played = s.played || [], all = R.top.concat(R.different), best = all.find(r => !played.includes(r.id)) || R.top[0];
  return [best].concat(R.top.filter(r => r !== best)).slice(0, 3);
}
function matchesTV(next) {
  const s = Store.get(), R = s.recommendations; if (!R || !R.top.length) return TVV.idle();
  const sel = s.room.status === 'details' ? s.selectedGame : null, host = person(s.room.hostId).n;
  return `${tvTop('', false)}<div class="tv-center tv-in" style="padding-top:5cqw">
    <div class="tv-p" style="margin:0;font-size:1.9cqw;letter-spacing:.08em">${next ? 'SAME GROUP · SAME PREFERENCES' : 'YOUR GROUP MATCH'}</div>
    <div class="tv-h neon" style="font-size:4.6cqw;margin-top:.4cqw">${next ? 'Next match' : 'Games that fit everyone'}</div>
    <div class="m-row">${tvRecList(s, next).map((r, i) => `<div class="m-card tv-glass ${i === 0 ? 'best' : ''} ${sel === r.id ? 'sel' : ''}" style="animation-delay:${i * .12}s">
      ${i === 0 ? `<span class="m-badge">${next ? 'NEXT MATCH' : 'BEST MATCH'}</span>` : ''}
      <span class="gt" style="--s:${i === 0 ? 7 : 5.4}cqw;border-radius:1.6cqw">${G[r.id].img ? `<img src="${IMG[G[r.id].img]}" alt="">` : I(G[r.id].gen[0])}</span>
      <div class="m-n">${G[r.id].name}</div><div class="m-p"><b>${r.score}%</b> group match</div>
      ${i === 0 ? `<div class="m-why">${r.reasons.map(x => `<div>${I('check')}${x}</div>`).join('')}</div>` : `<div class="m-why one"><div>${I('check')}${r.highlight || r.reasons[0] || ''}</div></div>`}</div>`).join('')}</div>
    <div class="tv-chip" style="margin-top:1.8cqw">${sel ? `${I('eye')}${host} is looking at ${G[sel].name}` : s.gameSession && s.gameSession.phase !== 'done' ? `${I('pause')}${G[s.gameSession.game || 'firstnotes'].name} paused · Round ${s.gameSession.round} of 5 · scores kept` : `${I('sparkle')}${host} picks the game`}</div></div>`;
}
let tvSeenJoined = new Set();
function tvJoinAv(s) {
  const h = joinedPlayers(s).map(p => `<div class="p ${p.online === false ? 'off' : 'rdy'} ${tvSeenJoined.has(p.id) ? '' : 'just'}" data-p="${p.id}">${tav(p.id)}${p.name}<small>${p.online === false ? 'Reconnecting…' : p.isHost ? 'Host ✓' : 'Joined ✓'}</small></div>`).join('');
  tvSeenJoined = new Set(joinedPlayers(s).map(p => p.id)); return h;
}
/* "Sophie left the room" — shown for a few seconds after someone leaves */
function tvEventChip(s) { const e = s.lastEvent; return e && e.type === 'left' && Date.now() - (e.at || 0) < 8000 ? `<div class="tv-chip" id="tvEvent" style="margin-top:1cqw">${I('door')}${e.name || person(e.id).baseName} left the room</div>` : ''; }
function joinWaitText(s) {
  if (!s.room.hostId) return 'Waiting for players… the first to join is the host'; const n = joinedPlayers(s).length; return s.room.status === 'context' ? `${person(s.room.hostId).n} is setting up tonight’s session…` : n === CAST.length ? `${n} players connected` : n === 1 ? 'Waiting for friends…' : `${n} players in · waiting for friends…`; }
function tvListenText(g) { const b = Object.keys(g.buzz).length; return g.paused ? '' : b ? `${b} buzzed · listen to the first notes…` : 'Listen to the first notes…'; }
function buzzCallout(g) { const f = firstBuzz(g); return f ? `<div class="buzz-call tv-glass" style="--c:${person(f).c}">${tav(f)}<span><b>${person(f).n}</b> buzzed first</span></div>` : ''; }

/* ---------- theme intro: one choice on the phone changes the whole room ---------- */
let introTimer = null;
function themeIntroHTML(t) { return `<div class="theme-intro"><div class="ti-k">TONIGHT IS</div><div class="ti-h">${t.label.toUpperCase()}</div><div class="ti-p">${t.tvLine}</div></div>`; }
function playThemeIntro(occasion) {
  const t = OCCASION_THEMES[occasion]; if (!t || !tvScreen) return;
  transitionToOccasionTheme(occasion, [tvScreen]);          // same theme the phone just switched to
  tvScreen.classList.remove('th-intro'); void tvScreen.offsetWidth; tvScreen.classList.add('th-intro');
  const ov = document.getElementById('tvIntro'); if (ov) ov.innerHTML = themeIntroHTML(t);
  clearTimeout(introTimer); introTimer = setTimeout(() => { if (ov) ov.innerHTML = ''; tvScreen.classList.remove('th-intro'); }, 1500);
}

/* ---------- render ---------- */
let lastTVKey = null, lastView = null, fxMuteUntil = 0;
function muteTVFx(ms) { fxMuteUntil = Date.now() + ms; }
function renderTV(force) {
  if (!tvc) return;
  const s = Store.get(), r = s.room, v = tvView(), g = s.gameSession;
  tvScreen.dataset.v = v;
  tvScreen.toggleAttribute('data-game', GAME_VIEWS.includes(v));
  // occasion theme: rendered from state (a late or refreshed TV gets it immediately); faint during gameplay
  renderTVTheme(r && r.tvConnected ? s.hostContext.occasion : null);   // hostContext.occasion → TV theme
  // the occasion stays the environment for the whole session — in the game it steps back a little so the game reads first
  setThemeIntensity(GAME_VIEWS.includes(v) ? 'gameplay' : 'pregame', GAME_VIEWS.includes(v) ? 0.92 : 1, tvScreen);
  const key = v + '|' + (g ? g.round + g.phase + (v === 'ready' ? g.count : '') + (v === 'round' ? !!g.paused : '') : '') + '|' + (s.room ? s.room.status : '') +
    (v === 'ready' ? joinedPlayers(s).filter(p => p.ready).length : '') + (v === 'matches' || v === 'next' ? s.selectedGame + JSON.stringify(s.recommendations && s.recommendations.top.map(r => r.score)) + (s.gameSession ? s.gameSession.phase + s.gameSession.round : '') : '') + (v === 'reveal' && g ? (g.hold ? 'H' : '') : '') +
    (v === 'idle' ? tvConnPhase + Sync.status : '') + (v === 'join' || v === 'collect' || v === 'ready' ? joinedPlayers(s).map(p => p.id + p.name + p.online + p.isHost).join(',') + JSON.stringify(s.lastEvent) : '') +
    (v === 'matching' ? !!s.matchSignals : '') + '|' + (s.hostContext.occasion || '');
  if (!force && key === lastTVKey) return;
  if (v === 'join' && s.lastEvent && s.lastEvent.type === 'left' && Date.now() - s.lastEvent.at < 8000) { clearTimeout(renderTV._ev); renderTV._ev = setTimeout(() => renderTV(true), 8100 - (Date.now() - s.lastEvent.at)); }
  const viewChanged = v !== lastView;
  lastTVKey = key; lastView = v;
  tvc.innerHTML = TVV[v]();
  requestAnimationFrame(() => requestAnimationFrame(() => tvc.querySelectorAll('[data-w]').forEach(b => b.style.width = b.dataset.w + '%')));
  if (v === 'matching') countUp();
  const fx = Date.now() > fxMuteUntil;
  if (viewChanged && v === 'round') playClip(ROUNDS[g.round - 1].notes);
  if (viewChanged && v !== 'round') stopClip();
  if (fx && viewChanged && v === 'reveal' && g.results[g.round - 1].winner) { confetti(); beep(784, .12); setTimeout(() => beep(1046, .16), 140); }
  if (fx && viewChanged && v === 'winner') { confetti(); setTimeout(confetti, 900); }
}
function countUp() {
  const el = document.getElementById('tvPct'); if (!el) return;
  const to = +el.dataset.to, t0 = performance.now() + 2600, dur = 1100;
  (function step(now) { const k = Math.max(0, Math.min(1, (now - t0) / dur)); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1 && document.body.contains(el)) requestAnimationFrame(step); })(performance.now());
}
/* small in-place updates so frequent events don't restart TV animations */
function patchTV(a) {
  const s = Store.get(), v = tvView(), g = s.gameSession;
  if (v === 'round' && ['TICK', 'BUZZ', 'LOCK'].includes(a.type) && lastView === 'round') {
    const t = document.getElementById('tvTimer'); if (t) t.textContent = g.timer;
    const arc = document.getElementById('ringArc'); if (arc) { const c = 2 * Math.PI * 44; arc.style.strokeDashoffset = c * (1 - g.timer / 10); arc.setAttribute('stroke', g.timer <= 3 ? '#FF6077' : 'url(#rg)'); arc.closest('.ring').classList.toggle('warn', g.timer <= 3); }
    const l = document.getElementById('tvListen'); if (l) l.textContent = tvListenText(g);
    const bf = document.getElementById('tvBuzzFirst'); if (bf && a.type === 'BUZZ' && Object.keys(g.buzz).length === 1) { bf.innerHTML = buzzCallout(g); beep(990, .06); }
    const st = tvc.querySelector('.strip'); if (st) { st.outerHTML = strip(); tvc.querySelectorAll('.strip [data-w]').forEach(b => { b.style.transition = 'none'; b.style.width = b.dataset.w + '%'; }); }
    return;
  }
  if (v === 'join' && a.type === 'JOIN' && lastView === 'join' && joinedPlayers(s).length < CAST.length) {
    const av = document.getElementById('tvAv'), w = document.getElementById('tvWait');   // in-place: only the new player animates in
    if (av && w) { av.innerHTML = tvJoinAv(s); w.textContent = joinWaitText(s); beep(880, .05); lastTVKey = null; return; }
  }
  if (v === 'collect' && a.type === 'SUBMIT_PREFS' && lastView === 'collect') {
    const jp = joinedPlayers(s), got = prefsCount(s);
    const n = document.getElementById('tvGot'); if (n) { n.textContent = got; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); }
    const bar = document.getElementById('tvGotBar'); if (bar) bar.style.width = (got / jp.length * 100) + '%';
    const p = tvc.querySelector(`#tvPrefAv .p[data-p="${a.id}"]`); if (p) { p.classList.remove('think'); p.classList.add('rdy'); p.querySelector('small').textContent = '✓'; }
    beep(880, .05); return;
  }
  renderTV();
}

/* confetti (unchanged from the original prototype) */
function confetti() {
  const cv = document.getElementById('confetti'); if (!cv) return; const ctx = cv.getContext('2d');
  const W = cv.width = cv.clientWidth * devicePixelRatio, H = cv.height = cv.clientHeight * devicePixelRatio;
  const cols = ['#FF3F91', '#FF4F7B', '#755BFF', '#38C7FF', '#47D7A5', '#FFB84D', '#FFFFFF'];
  const bits = Array.from({length:150}, () => ({x:W * (.25 + Math.random() * .5), y:H * .4, vx:(Math.random() - .5) * W * .02, vy:-Math.random() * H * .03 - H * .008,
    r:(Math.random() * 5 + 4) * devicePixelRatio, c:cols[Math.floor(Math.random() * cols.length)], a:Math.random() * 6, va:(Math.random() - .5) * .3}));
  let frame = 0;
  (function step() {
    ctx.clearRect(0, 0, W, H);
    bits.forEach(b => { b.vy += H * .0009; b.x += b.vx; b.y += b.vy; b.a += b.va; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c; ctx.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2); ctx.restore(); });
    if (++frame < 160) requestAnimationFrame(step); else ctx.clearRect(0, 0, W, H);
  })();
}

/* ambient TV atmosphere from the original prototype: notes, bokeh, sparkles, flecks, hearts */
(function () {
  const box = document.getElementById('notes'); if (!box) return; let h = '', seed = 42;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const STAR = 'M12 0C12.9 8.6 15.4 11.1 24 12 15.4 12.9 12.9 15.4 12 24 11.1 15.4 8.6 12.9 0 12 8.6 11.1 11.1 8.6 12 0Z';
  [[6, 36, 3.6], [12, 68, 2.6], [88, 30, 3.2], [93, 60, 2.4], [30, 30, 2], [80, 16, 2.2]].forEach((n, i) => h += `<span style="left:${n[0]}%;top:${n[1]}%;width:${n[2]}cqw;height:${n[2]}cqw;animation-delay:${-i * 1.3}s">${I('music')}</span>`);
  const bok = ['rgba(255,255,255,.75)', 'rgba(190,245,255,.7)', 'rgba(150,225,255,.6)', 'rgba(255,190,225,.5)', 'rgba(205,190,255,.5)'];
  for (let k = 0; k < 16; k++) { const sz = 2 + rnd() * 9, x = rnd() * 100, y = rnd() * 100, c = bok[k % bok.length], ring = k % 4 === 0;
    h += `<i class="amb bk ${ring ? 'ring' : ''}" style="left:${x}%;top:${y}%;width:${sz}cqw;height:${sz}cqw;${ring ? `border-color:${c}` : `background:radial-gradient(circle,${c} 0%,${c.replace(/[\d.]+\)$/, '.18)')} 55%,transparent 72%)`};animation-duration:${12 + rnd() * 10}s;animation-delay:${-rnd() * 20}s"></i>`; }
  const sc = ['#FFFFFF', '#FFFFFF', '#DFFBFF', '#9FF3FF', '#FFC2E0', '#D9CCFF'];
  for (let k = 0; k < 18; k++) { const sz = .7 + rnd() * 1.5; h += `<i class="amb sk" style="left:${rnd() * 100}%;top:${rnd() * 92}%;width:${sz}cqw;height:${sz}cqw;color:${sc[k % sc.length]};animation-duration:${2.2 + rnd() * 2.6}s;animation-delay:${-rnd() * 4}s"><svg viewBox="0 0 24 24" width="100%" height="100%"><path d="${STAR}" fill="currentColor"/></svg></i>`; }
  for (let k = 0; k < 26; k++) { const sz = .25 + rnd() * .4; h += `<i class="amb dot" style="left:${rnd() * 100}%;top:${rnd() * 100}%;width:${sz}cqw;height:${sz}cqw;animation-duration:${2 + rnd() * 3}s;animation-delay:${-rnd() * 5}s"></i>`; }
  for (let k = 0; k < 12; k++) { const sz = .5 + rnd() * .8; h += `<i class="amb fleck" style="left:${rnd() * 100}%;top:${rnd() * 100}%;width:${sz}cqw;height:${sz}cqw;animation-duration:${9 + rnd() * 8}s,${2.5 + rnd() * 2}s;animation-delay:${-rnd() * 12}s,${-rnd() * 3}s"></i>`; }
  [[16, 46, 2, .55], [74, 84, 1.7, .5], [96, 44, 1.5, .45], [40, 6, 1.3, .45]].forEach((p, i) => h += `<i class="amb ht" style="left:${p[0]}%;top:${p[1]}%;width:${p[2]}cqw;height:${p[2]}cqw;color:#FF8FC0;opacity:${p[3]};animation-delay:${-i * 3}s">${I('heart', '', 'width:100%;height:100%;fill:currentColor;stroke:none')}</i>`);
  [[20, 18, 7], [82, 72, 6]].forEach((f, i) => h += `<i class="amb flare" style="left:${f[0]}%;top:${f[1]}%;width:${f[2]}cqw;height:${f[2]}cqw;animation-delay:${-i * 2.5}s"></i>`);
  box.innerHTML = h;
})();
