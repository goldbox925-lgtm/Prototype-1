/* PLAYMODE · Phone UI.
   Phone = personal control. Screens are derived from shared state (room status, my preferences, game phase)
   plus a small amount of local UI state (navigation outside a room, drafts, sheets). */

const UI = {
  me:'emma', role:'host',            // set by app.js from the URL
  screen:'home', hist:[], dir:'fade', // only used outside a room
  step:'intro',                       // host context: intro → occasion → time
  prefStep:'intro', draft:{vibe:null, interests:[]}, editingPrefs:false,
  connectOpen:false, conn:'idle', connErr:false,
  detail:null, pendingGame:null, ans:null, ansRound:0, submitting:false,
  sheet:null, modal:null, toast:null, code:'', codeErr:false, tvcode:'', tvcodeErr:false,
  gcat:'All', q:'', picking:null, readySent:false, discon:null, waitSince:0,
  controller:false,                   // ?role=player: a simple phone controller (starts at Join, no app navigation)
  seat:null, nameDraft:'', probing:false,
  myAns:{}, myPrefs:null, listenMark:null, listenLocal:0   // private: my answers / preferences never leave this phone except sealed for the TV
};
const app = document.getElementById('app');
const shared = () => Store.get();
const meP = () => UI.me ? shared().players.find(p => p.id === UI.me) : null;
const inRoom = () => !!(shared().room && meP() && meP().joined);
const isHost = () => inRoom() && shared().room.hostId === UI.me;
const hostName = () => { const s = shared(); return s.room ? person(s.room.hostId).n : 'the host'; };
const occTheme = () => OCCASION_THEMES[shared().hostContext.occasion];
const modeNote = () => LIVE ? '' : `<div class="mode-note">${I('warn', '', 'width:14px;height:14px;flex:none')}<span><b>Demo mode</b> · runs in this browser only. <a href="?setup">Set up live play</a></span></div>`;

/* ---------- small template helpers (reused from the original prototype) ---------- */
const avURL = id => IMG[person(id).avatar];
const AV = (id, cls = '') => `<span class="av ${cls}" style="background-image:url(${avURL(id)})" role="img" aria-label="${person(id).n}"></span>`;
const tile = (id, s = 56) => {
  const g = G[id];
  if (g.img) return `<span class="gt" style="--s:${s}px"><img src="${IMG[g.img]}" alt=""></span>`;
  return `<span class="gt gen" style="--s:${s}px;--c1:${g.gen[1]};--c2:${g.gen[2]}">${I(g.gen[0])}</span>`;
};
const catPill = g => `<span class="pill ${CATC[g.cat] || 'lav'}">${g.cat}</span>`;
const back = (act = 'back') => `<button class="icon-btn" data-act="${act}" aria-label="Back">${I('back')}</button>`;
const closeBtn = (act = 'leave') => `<button class="icon-btn" data-act="${act}" aria-label="Leave room">${I('x')}</button>`;
const dots = (n, of) => `<div class="pdots" aria-label="Step ${n} of ${of}">${Array.from({length:of}, (_, i) => `<i class="${i + 1 < n ? 'done' : i + 1 === n ? 'on' : ''}"></i>`).join('')}</div>`;
const pctRing = (p, size = 64) => { const c = 2 * Math.PI * 26; return `<span class="pct-ring" style="--size:${size}px"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" class="bg"/><circle cx="30" cy="30" r="26" class="fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}"/></svg><b>${p}<small>%</small></b></span>`; };
const navBar = () => { if (UI.controller) return '';
  const tab = UI.screen === 'games' || UI.screen === 'gdetails' ? 'games' : UI.screen === 'roomtab' || UI.screen === 'join' ? 'room' : 'home';
  const b = (id, ic, l) => `<button data-act="tab" data-tab="${id}" class="${tab === id ? 'on' : ''}" aria-current="${tab === id ? 'page' : 'false'}"><span class="nb">${I(ic)}</span>${l}</button>`;
  return `<nav class="nav glass" aria-label="Main">${b('home', 'home', 'Home')}${b('games', 'games', 'Games')}${b('room', 'room', 'Room')}</nav>`;
};
const ctxLine = () => { const s = shared(), h = s.hostContext, t = occTheme();
  return [t && t.label, h.availableMinutes && timeLabel(h.availableMinutes), joinedPlayers(s).length + ' players'].filter(Boolean).join(' · '); };

/* ---------- which screen am I on? ---------- */
function currentScreen() {
  const s = shared();
  if (!inRoom()) return UI.screen;
  const st = s.room.status, host = isHost(), myPrefs = s.playerPreferences[UI.me];
  const prefScreen = () => UI.prefStep === 'interests' ? 'interests' : UI.prefStep === 'vibe' || host || UI.editingPrefs ? 'vibe' : 'gmintro';
  switch (st) {
    case 'lobby': return host ? (UI.connectOpen ? 'connect' : 'room') : 'joined';
    case 'context': return host ? ({intro:'gmintro', occasion:'occasion', time:'time'}[UI.step] || 'gmintro') : 'waitHost';
    case 'collecting': return !myPrefs || UI.editingPrefs ? prefScreen() : 'sent';
    case 'matching': return 'matching';
    case 'matches': return UI.editingPrefs ? prefScreen() : 'matches';
    case 'details': return host ? 'details' : (s.tvState.fromNext ? 'nextMatch' : 'matches');
    case 'ready': return 'ready';
    case 'playing': {
      const g = s.gameSession;
      if (!g || g.phase === 'countdown') return 'ready';
      if (g.phase === 'intro') return 'listen';
      if (g.phase === 'listen') return g.lock[UI.me] !== undefined || (g.timer === 0) ? 'locked' : g.buzz[UI.me] !== undefined ? 'answer' : 'listen';
      if (g.phase === 'reveal') return 'result';
      return 'final';
    }
    case 'finished': return 'final';
    case 'nextMatch': return UI.editingPrefs ? prefScreen() : 'nextMatch';
  }
  return 'home';
}
const NAV_SCREENS = ['home', 'games', 'gdetails', 'join', 'roomtab'];

/* ---------- status line during gameplay: "Round 2/5 · 220 pts · 2nd" ---------- */
function gStatus() {
  const g = shared().gameSession, rk = ranking(g), pos = rk.findIndex(r => r.id === UI.me);
  return `<div class="gstatus glass"><button class="gx" data-act="gameMenu" aria-label="Game menu">${I('x')}</button>
    <span><b>Round ${g.round}/5</b> · ${g.scores[UI.me]} pts · ${ordinal(pos)}</span><span class="gname">${G[shared().selectedGame || 'firstnotes'].name}</span></div>`;
}

/* ================= SCREENS ================= */
const SCREENS = {

/* 1 · Home: one obvious main action */
home: () => `<div class="scr nav-on">
  <div class="body" style="padding-top:6px">
    <div class="home-top">${LOGO('34px')}<div class="tl">Play together. Feel closer.</div></div>
    <button class="create-card glassin" data-act="createRoom">
      <span class="cc-art"><img src="${IMG.h_find}" alt=""></span>
      <span class="cc-txt"><span class="hi">Hi, ${person(UI.me).n}! 👋</span><span class="t">Create a Room</span><span class="d">Friends join on their phones. PLAYMODE finds a game that fits the whole group.</span></span>
      <span class="cc-go">${I('arrow')}</span></button>
    <button class="row-card glass act stagger-1" data-act="go" data-to="join">
      <span class="gt" style="--s:50px"><img src="${IMG.h_join}" alt=""></span>
      <span><span class="t">Join a Room</span><br><span class="d">Enter the code on the TV</span></span>${I('chev', 'chev')}</button>
    <button class="browse-link" data-act="tab" data-tab="games">${I('search', '', 'width:16px;height:16px')}Browse all games</button>
    <div class="how-strip">${[['plus', 'Create'], ['room', 'Join'], ['sparkle', 'Match'], ['tv', 'Play']].map((x, i) => `${i ? `<span class="hs-arr">${I('arrow')}</span>` : ''}<span class="hs"><span class="hs-ic">${I(x[0])}</span>${x[1]}</span>`).join('')}</div>
    <div class="how-cap">Phones for quick personal moves. The TV for everyone.</div>
  </div>${navBar()}</div>`,

/* 2 · Browse (for people who already know what they want) */
games: () => {
  const cats = ['All', 'Music', 'Trivia', 'Conversation', 'Drawing', 'Acting', 'Voting'];
  const q = UI.q.toLowerCase();
  const list = Object.keys(G).filter(id => (UI.gcat === 'All' || G[id].cat === UI.gcat) && (!q || (G[id].name + ' ' + G[id].cat + ' ' + G[id].d).toLowerCase().includes(q)));
  return `<div class="scr nav-on">
  <div class="hdr"><span class="spacer"></span><div class="mid" style="font-size:18px;font-weight:700">Browse games</div><span class="spacer"></span></div>
  <button class="match-promo" data-act="createRoom"><span class="ib pinkg">${I('sparkle')}</span><span><span class="t">Not sure what to play?</span><span class="t2">Find your group match</span><span class="d">PLAYMODE combines everyone's preferences to suggest games that fit the whole group.</span></span>${I('chev', 'chev')}</button>
  <div class="search glass">${I('search')}<input id="search" placeholder="Search games…" value="${UI.q.replace(/"/g, '&quot;')}" aria-label="Search games"></div>
  <div class="cats">${cats.map(c => `<button class="cat ${UI.gcat === c ? 'on' : ''}" data-act="cat" data-v="${c}">${c}</button>`).join('')}</div>
  <div class="body"><div class="rec-list" style="margin-top:0">${list.length ? list.map(id => { const g = G[id]; return `<button class="rec glass" data-act="gdetails" data-g="${id}">${tile(id, 50)}<span style="flex:1;min-width:0"><span class="t">${g.name} ${catPill(g)}</span><span class="meta" style="display:block;margin-top:3px">${playersLabel(g)} players · ${g.duration} min</span></span>${I('chev', 'chev')}</button>`; }).join('')
    : `<div class="sub">No games match “${UI.q}”. Try “music” or “trivia”.</div>`}</div></div>${navBar()}</div>`; },

/* 3 · Game details from Browse (no group match yet) */
gdetails: () => detailsScreen(UI.detail, null, true),

/* 4 · Join a room — two methods: 1) enter room code  2) scan QR code */
join: () => {
  const c = UI.code, full = c.length === 4, busy = UI.probing;
  const err = {bad:['That code doesn’t look right', 'Check the 4-digit code shown on the TV and try again.'],
    missing:[`No room ${c} is open`, 'Check the code on the TV. The TV screen must stay open to keep the room running.'],
    offline:['Can’t reach the live service', 'Check your internet connection and try again.'],
    notv:['That room isn’t open yet', 'Open the TV screen first (?role=tv) — it creates the room and shows the code.']}[UI.codeErr];
  return `<div class="scr ${UI.controller ? 'no-nav' : 'nav-on'}">
  <div class="hdr">${UI.controller ? '<span class="spacer"></span>' : back()}<div class="mid">Join a room</div><span class="spacer"></span></div>
  <div class="body">
    ${UI.controller ? `<div class="ctl-brand">${LOGO('30px')}</div>` : ''}
    <div class="big-ic" style="background:radial-gradient(circle at 35% 30%,#fff,#E6DEFF 72%);color:var(--violet);box-shadow:0 0 0 10px rgba(117,91,255,.08)">${I('keypad')}</div>
    <h1>Join a room</h1><div class="sub">Use the code or the QR code on the TV.</div>
    <div class="join-m"><span class="jm-n">1</span>Enter room code</div>
    <div class="code-boxes ${UI.codeErr ? 'shake' : ''}" id="codeBoxes">${[0, 1, 2, 3].map(i => `<input class="cb glass ${UI.codeErr ? 'bad' : full ? 'ok' : i === c.length ? 'cur' : ''}" id="cb${i}" data-i="${i}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="${i ? 'off' : 'one-time-code'}" aria-label="Room code digit ${i + 1}" value="${c[i] || ''}" ${busy ? 'disabled' : ''}>`).join('')}</div>
    ${err ? `<div class="err-card glassin">${I('x', '', 'color:var(--err);width:22px;height:22px;flex:none')}<div><b>${err[0]}</b><span>${err[1]}</span></div></div>`
      : `<div class="helper" id="codeHelper">${busy ? 'Finding the room…' : codeHelperText(c)}</div>`}
    <div class="join-or"><span>or</span></div>
    <div class="join-m"><span class="jm-n">2</span>Scan QR code</div>
    <button class="row-card glass" data-act="go" data-to="qrscan"><span class="ib soft">${I('qr')}</span><span><span class="t">Scan QR code instead</span><br><span class="d">${LIVE ? 'Or open your camera app and point it at the TV' : 'Point your camera at the QR on the TV'}</span></span>${I('chev', 'chev')}</button>
    ${modeNote()}
  </div>
  <div class="foot">${UI.codeErr ? `<button class="btn btn-primary" data-act="codeRetry">${I('refresh')}Try again</button>` : `<button class="btn btn-primary" id="joinBtn" data-act="joinRoom" ${full && !busy ? '' : 'disabled'}>${busy ? '<span class="spin"></span>Finding room…' : full ? 'Join room ' + c : 'Join'}</button>`}</div>${navBar()}</div>`; },

/* 4b · QR. Live: the phone's own camera (BarcodeDetector where available — or the camera app opens the join link).
   Demo: a simulated scanner with a "Simulate successful scan" button. */
qrscan: () => LIVE ? `<div class="scr no-nav qr-scr">
  <div class="hdr">${back()}<div class="mid">Scan QR code</div><span class="spacer"></span></div>
  <div class="body" style="text-align:center">
    <div class="sub" style="margin-top:2px">${'BarcodeDetector' in window ? 'Point your camera at the QR code on the TV.' : 'Open your phone’s camera app and point it at the QR code on the TV — it opens PLAYMODE with the room filled in.'}</div>
    <div class="cam">${'BarcodeDetector' in window ? '<video id="qrVideo" playsinline muted autoplay></video>' : `<div class="cam-qr">${I('qr', '', 'width:100%;height:100%;color:#10204A')}</div>`}<i class="cam-c tl"></i><i class="cam-c tr"></i><i class="cam-c bl"></i><i class="cam-c br"></i><i class="cam-line"></i></div>
    <div class="helper" id="qrMsg">${'BarcodeDetector' in window ? 'Looking for a code…' : 'No in-app scanner on this browser'}</div>
  </div>
  <div class="foot col"><button class="btn btn-primary" data-act="back">${I('keypad')}Enter the code instead</button></div></div>`
  : `<div class="scr no-nav qr-scr">
  <div class="hdr">${back()}<div class="mid">Scan QR code</div><span class="spacer"></span></div>
  <div class="body" style="text-align:center">
    <div class="sub" style="margin-top:2px">Point your camera at the QR code on the TV.</div>
    <div class="cam"><div class="cam-qr">${joinQR()}</div><i class="cam-c tl"></i><i class="cam-c tr"></i><i class="cam-c bl"></i><i class="cam-c br"></i><i class="cam-line"></i></div>
    <div class="helper">Room ${roomCode() || DEMO_ROOM_CODE} · Living Room TV · demo scanner</div>
  </div>
  <div class="foot col"><button class="btn btn-primary" data-act="qrSuccess">${I('check')}Simulate successful scan</button>
    <button class="btn-quiet" data-act="back">Enter the code instead</button></div></div>`,

/* 4c · Who's playing? Pick a seat (avatar) and the name everyone sees on the TV. */
seat: () => {
  const s = shared(), free = id => { const p = s.players.find(x => x.id === id); return !(p && p.joined && p.device && p.device !== DEVICE_ID && p.online !== false); };
  const pick = UI.seat && free(UI.seat) ? UI.seat : null, firstHost = s.room && !s.room.hostId;
  return `<div class="scr no-nav">
  <div class="hdr">${back('seatBack')}<div class="mid">Room ${roomCode() || ''}</div><span class="spacer"></span></div>
  <div class="body">
    <h1>Who’s playing?</h1><div class="sub">Pick your seat. Your name appears on the TV.</div>
    <div class="seat-grid" role="radiogroup">${CAST.map(c => { const p = s.players.find(x => x.id === c.id) || {}, ok = free(c.id), sel = pick === c.id;
      return `<button class="seat glass selectable ${sel ? 'sel' : ''}" role="radio" aria-checked="${sel}" data-act="pickSeat" data-v="${c.id}" ${ok ? '' : 'disabled'}>${AV(c.id)}<span class="snm">${p.joined ? person(c.id).n : c.n}</span><small>${!ok ? 'Taken' : p.joined ? (p.human ? 'Reconnect' : 'Simulated') : p.isHost ? 'Host' : 'Free'}</small>${sel ? `<span class="chk">${I('check')}</span>` : ''}</button>`; }).join('')}</div>
    <label class="name-field"><span>Your name <small>(optional)</small></span><input id="nameInput" maxlength="14" autocomplete="nickname" enterkeyhint="go" placeholder="${pick ? seatName(pick) : 'e.g. Sam'}" value="${UI.nameDraft.replace(/"/g, '')}"></label>
    ${firstHost ? `<div class="host-note">${I('crown', '', 'width:16px;height:16px')}You’re first — you’ll be the host: you choose the occasion and start the game.</div>` : ''}
  </div>
  <div class="foot"><button class="btn btn-primary" data-act="joinSeat" ${pick ? '' : 'disabled'}>${pick ? `Join as ${cleanName(UI.nameDraft) || seatName(pick)}` : 'Pick a seat'}</button></div></div>`; },

/* 5 · Room tab (outside a room) */
roomtab: () => `<div class="scr nav-on">
  <div class="hdr"><span class="spacer"></span><div class="mid" style="font-size:18px;font-weight:700">Room</div><span class="spacer"></span></div>
  <div class="body" style="text-align:center">
    <div class="big-ic" style="background:radial-gradient(circle at 35% 30%,#fff,#DDF0FF 72%);color:var(--cyan);box-shadow:0 0 0 10px rgba(56,199,255,.1)">${I('room')}</div>
    <h1>You're not in a room yet</h1><div class="sub">Create one for your group, or join with the code on the TV.</div>
    <div class="stagger" style="display:flex;flex-direction:column;gap:10px;margin-top:20px;text-align:left">
      <button class="row-card glass" data-act="createRoom"><span class="ib pinkg">${I('plus')}</span><span><span class="t">Create a Room</span><br><span class="d">You'll connect the TV next</span></span>${I('chev', 'chev')}</button>
      <button class="row-card glass" data-act="go" data-to="join"><span class="ib violetg">${I('keypad')}</span><span><span class="t">Join a Room</span><br><span class="d">Enter a code or scan QR</span></span>${I('chev', 'chev')}</button></div>
  </div>${navBar()}</div>`,

/* 6 · Room 2048 (host) — the room exists before the TV is connected */
room: () => {
  const s = shared(), jp = joinedPlayers(s), n = jp.length, tv = s.room.tvConnected;
  return `<div class="scr no-nav">
  <div class="hdr">${closeBtn()}<div class="mid">Your room</div><button class="icon-btn" data-act="sheet" data-s="roomhelp" aria-label="How friends join">${I('help')}</button></div>
  <div class="body">
    <div class="code-card glass glassin"><div><div class="lbl">Room created</div><div class="code-big">${roomCode()}</div><div class="small" style="margin-top:4px">${tv ? 'Friends join with this code<br>or the QR on the TV.' : 'Waiting for players.<br>Show the code on the TV.'}</div></div><div class="qr">${joinQR()}</div></div>
    ${tv ? `<div class="tvok glassin">${I('tv', '', 'color:#1FB585')}<span>TV connected<small>Living Room TV · showing the room code</small></span><span class="dev-dot" style="margin-left:auto"></span></div>`
         : `<button class="tv-cta glassin" data-act="openConnect"><span class="ib cyang">${I('tv')}</span><span><span class="t">Connect Living Room TV</span><span class="d">Only the host connects the TV. Friends just join the room.</span></span>${I('chev', 'chev')}</button>`}
    <div class="sec-t" style="margin-top:16px"><span id="pcount">${n} ${n === 1 ? 'player' : 'players'} joined</span><a data-act="toast" data-msg="Invite link copied">${I('plus', '', 'width:14px;height:14px;vertical-align:-2px')} Invite</a></div>
    <div class="pl-list">${CAST.map(p => { const pl = s.players.find(x => x.id === p.id); return `<div class="pl glass ${pl.joined ? '' : 'waiting'}" data-p="${p.id}">${AV(p.id)}<span class="nm">${person(p.id).n}${pl.isHost ? `<small>${pl.id === UI.me ? 'You · ' : ''}Host</small>` : pl.id === UI.me ? '<small>You</small>' : ''}</span>
      <span class="rd ${pl.joined && pl.online !== false ? 'ok' : ''}">${!pl.joined ? '<span class="spin dark"></span>Waiting…' : pl.online === false ? 'Offline' : I('check') + 'Joined'}</span></div>`; }).join('')}</div>
  </div>
  <div class="foot col">
    ${!tv ? `<button class="btn btn-primary" data-act="openConnect">${I('tv')}Connect Living Room TV</button>`
          : `<button class="btn btn-primary" data-act="startMatching" ${n >= 2 ? '' : 'disabled'}>${I('sparkle')}${n >= 2 ? 'Find our group match' : 'Waiting for players…'}</button>`}
    ${UI.pendingGame && tv ? `<button class="btn btn-glass" data-act="playPending" ${n >= 2 ? '' : 'disabled'}>Skip the match · play ${G[UI.pendingGame].name}</button>` : ''}
    ${n < CAST.length ? `<button class="demo-ctl" data-act="demoAddPlayers" title="Prototype-only control">${I('plus', '', 'width:14px;height:14px')}Demo: Add remaining players</button>`
      : `<div class="foot-note">${tv ? 'Everyone answers 2 quick questions · about 10 seconds' : 'Connect the TV so everyone can see the room'}</div>`}
  </div></div>`; },

/* 7 · Connect TV: detected TV is the clear fastest path */
connect: () => {
  const busy = UI.conn === 'connecting', ok = shared().room.tvConnected;
  if (UI.connErr) return `<div class="scr no-nav">
  <div class="hdr">${back('closeConnect')}<div class="mid">Connect TV</div><span class="spacer"></span></div>
  <div class="body shake"><div class="big-ic warn">${I('warn')}</div><h1>Can't connect to the TV</h1><div class="sub">Your room is still open — friends can keep joining.</div>
    <div class="tips glass"><div>${I('wifi', '', 'color:var(--violet)')}<span>Check that the TV is on and on the same Wi-Fi.</span></div>
    <div>${I('shield', '', 'color:#1FB585')}<span><b>Room ${roomCode()} is safe.</b><br><span class="small">Nothing is lost.</span></span></div></div></div>
  <div class="foot col"><button class="btn btn-primary" data-act="connectTV">${I('refresh')}Try again</button><button class="btn btn-glass" data-act="sheet" data-s="tvcode">${I('keypad')}Enter TV code</button></div></div>`;
  return `<div class="scr no-nav">
  <div class="hdr">${back('closeConnect')}<div class="mid">Connect TV</div><span class="spacer"></span></div>
  <div class="body"><h1 style="margin-top:6px">Show the room on the TV</h1><div class="sub">The TV becomes everyone's shared screen.</div>
    <div class="tv-found glass glassin ${ok ? 'done' : ''}"><div class="tvf-ic">${I('tv')}<span class="pulse"></span></div>
      <div class="t">Living Room TV</div><div class="d"><span class="dev-dot"></span>${ok ? 'Connected' : 'Nearby · Ready to connect'}</div>
      <button class="btn ${ok ? 'btn-mint' : 'btn-primary'}" data-act="connectTV" ${busy || ok ? 'disabled' : ''} style="width:100%;flex:none;margin-top:14px">${busy ? '<span class="spin"></span>Connecting…' : ok ? I('check') + 'TV connected' : 'Connect'}</button></div>
    <div class="other-ways"><div class="ow-t">Other ways to connect</div>
      <button data-act="sheet" data-s="tvcode">${I('keypad')}Enter TV code</button><button data-act="sheet" data-s="qr">${I('qr')}Scan QR</button></div>
  </div>
  <div class="foot col"><button class="btn-quiet" data-act="sheet" data-s="help">${I('help', '', 'width:16px;height:16px;vertical-align:-3px')} Need help?</button></div></div>`; },

/* 8 · Player: you're in */
joined: () => { const s = shared(), n = joinedPlayers(s).length;
  return `<div class="scr no-nav">
  <div class="hdr">${closeBtn()}<div class="mid">Room ${roomCode()}</div><span class="spacer"></span></div>
  <div class="body" style="text-align:center">
    <div class="you-in glassin">${AV(UI.me, 'big')}<span class="ok-dot">${I('check')}</span></div>
    <h1 style="margin-top:12px">You're in!</h1><div class="sub">${hostName()} is the host and connects the TV.<br>You'll play from your phone.</div>
    <div class="mini-board glass" style="margin-top:18px;text-align:left">${s.players.filter(p => p.joined).map(p => `<div class="mb-row">${AV(p.id, 'xs')}${p.name}${p.isHost ? ' <span class="small">· Host</span>' : ''}${p.id === UI.me ? ' <span class="small">· You</span>' : ''}<span class="s" style="color:#169E70">${I('check', '', 'width:16px;height:16px')}</span></div>`).join('')}</div>
    <div class="status-line"><span class="dot"></span>${n} players in the room · waiting for ${hostName()}</div>
  </div></div>`; },

/* Player: host is setting the occasion/time */
waitHost: () => { const t = occTheme();
  return `<div class="scr no-nav">
  <div class="hdr">${closeBtn()}<div class="mid">Room ${roomCode()}</div><span class="spacer"></span></div>
  <div class="gp-center">
    ${t ? `<div class="occ-mini glassin"><img src="${IMG[t.img]}" alt=""><span>${t.label}</span></div>` : `<div class="big-ic" style="background:radial-gradient(circle at 35% 30%,#fff,#FFE3F0 72%);color:var(--pink)">${I('sparkle')}</div>`}
    <h1>${hostName()} is setting up tonight's session</h1>
    <div class="sub" style="margin-top:0">${t ? 'Occasion: ' + t.label + ' · next, how much time you have.' : 'Choosing the occasion and how much time you have.'}<br>Then everyone answers 2 quick questions.</div>
    <div class="typing"><i></i><i></i><i></i></div>
  </div></div>`; },

/* 9 · Find your group match — explains why the questions exist */
gmintro: () => { const host = isHost(), n = joinedPlayers(shared()).length;
  return `<div class="scr no-nav">
  <div class="hdr">${host ? back('ctxBack') : closeBtn()}<div class="mid">Find your group match</div><span class="spacer"></span></div>
  <div class="body" style="text-align:center">
    <div class="gm-art glassin">${shared().players.filter(p => p.joined).map((p, i) => `<span class="gm-av" style="--i:${i}">${AV(p.id, 'sm')}</span>`).join('')}<span class="gm-core">${I('sparkle')}</span></div>
    <h1 style="margin-top:4px">Find your group match</h1>
    <div class="gm-points">
      <div><span class="num n1">2</span><span><b>Everyone answers 2 quick questions</b><br>Your answers stay private on your phone.</span></div>
      <div><span class="num n2">${I('sparkle', '', 'width:13px;height:13px')}</span><span><b>PLAYMODE finds activities that fit the whole group</b><br>Combined from all ${n} players — no one has to guess.</span></div>
      ${host ? `<div><span class="num n3">${I('home', '', 'width:13px;height:13px')}</span><span><b>First, you set the occasion and time</b><br>The occasion sets the mood on the TV.</span></div>` : ''}
    </div>
  </div>
  <div class="foot"><button class="btn btn-primary" data-act="${host ? 'ctxStart' : 'prefStart'}">Start${I('arrow')}</button></div></div>`; },

/* 10 · Occasion (host) — image cards preserved, auto-advance */
occasion: () => { const cur = shared().hostContext.occasion, pk = UI.picking;
  return `<div class="scr no-nav">
  <div class="hdr">${back('ctxBack')}<div class="mid">${dots(1, 2)}</div><span class="spacer"></span></div>
  <div class="body"><div class="step">Shared context · 1 of 2</div><h1>What's the occasion?</h1><div class="sub">Sets the mood on the TV for everyone.</div>
    <div class="occ-grid stagger ${pk ? 'picking' : ''}" role="radiogroup">${OCCASION_ORDER.map(id => { const o = OCCASION_THEMES[id], sel = pk ? pk === id : cur === id;
      return `<button class="occ selectable ${sel ? 'sel' : ''} ${pk === id ? 'picked' : ''}" role="radio" aria-checked="${sel}" data-act="pickOcc" data-v="${id}" style="--oc:${o.phone.primary}">
      <img src="${IMG[o.img]}" alt=""><span class="lab">${o.label}<small>${o.tag}</small></span>${sel ? `<span class="chk">${I('check')}</span>` : ''}</button>`; }).join('')}</div>
  </div></div>`; },

/* 11 · Time (host) */
time: () => { const cur = shared().hostContext.availableMinutes, pk = UI.picking;
  return `<div class="scr no-nav">
  <div class="hdr">${back('ctxBack')}<div class="mid">${dots(2, 2)}</div><span class="spacer"></span></div>
  <div class="body"><div class="step">Shared context · 2 of 2</div><h1>How much time do you have?</h1><div class="sub">We'll only suggest games that fit. ${joinedPlayers(shared()).length} players joined — no need to count.</div>
    <div class="opt-list stagger ${pk ? 'picking' : ''}" role="radiogroup">${TIMES.map(t => { const sel = pk ? +pk === t : cur === t;
      return `<button class="opt glass selectable ${sel ? 'sel' : ''} ${+pk === t ? 'picked' : ''}" role="radio" aria-checked="${sel}" data-act="pickTime" data-v="${t}">${I('clock')}${timeLabel(t)}${sel ? `<span class="chk">${I('check')}</span>` : ''}</button>`; }).join('')}</div>
  </div></div>`; },

/* 12 · Vibe (everyone) */
vibe: () => { const pk = UI.picking, cur = UI.draft.vibe;
  return `<div class="scr no-nav">
  <div class="hdr">${UI.editingPrefs ? back('cancelEdit') : `<span class="spacer"></span>`}<div class="mid">${dots(1, 2)}</div><span class="spacer"></span></div>
  <div class="body"><div class="step">Just for you · 1 of 2</div><h1>What are you in the mood for?</h1><div class="sub">Only you see your answer.</div>
    <div class="vibe-grid stagger ${pk ? 'picking' : ''}" role="radiogroup">${VIBES.map(v => { const sel = pk ? pk === v.id : cur === v.id;
      return `<button class="vibe glass selectable ${sel ? 'sel' : ''} ${pk === v.id ? 'picked' : ''}" role="radio" aria-checked="${sel}" data-act="pickVibe" data-v="${v.id}">
      <img src="${IMG[v.img]}" alt=""><span class="t">${v.name}</span><span class="d">${v.d}</span>${sel ? `<span class="chk">${I('check')}</span>` : ''}</button>`; }).join('')}</div>
  </div></div>`; },

/* 13 · Interests (everyone, multi-select + Done) */
interests: () => { const sel = UI.draft.interests;
  return `<div class="scr no-nav">
  <div class="hdr">${back('prefBack')}<div class="mid">${dots(2, 2)}</div><span class="spacer"></span></div>
  <div class="body"><div class="step">Just for you · 2 of 2</div><h1>What sounds good?</h1><div class="sub">Pick as many as you like.</div>
    <div class="int-grid stagger">${INTERESTS.map(i => { const on = sel.includes(i.id);
      return `<button class="int glass selectable ${on ? 'sel' : ''}" role="checkbox" aria-checked="${on}" data-act="toggleInt" data-v="${i.id}"><span class="ii ${i.c}">${I(i.ic)}</span>${i.name}${on ? `<span class="chk">${I('check')}</span>` : ''}</button>`; }).join('')}</div>
    <div class="status-line" style="${sel.length ? '' : 'color:var(--muted)'}">${sel.length ? `<span class="dot"></span>${sel.length} selected` : 'Pick at least one'}</div>
  </div>
  <div class="foot"><button class="btn btn-primary" data-act="prefsDone" ${sel.length ? '' : 'disabled'}>${I('check')}Done</button></div></div>`; },

/* 14 · Preferences sent / waiting for the group */
sent: () => { const s = shared(), jp = joinedPlayers(s), got = prefsCount(s), missing = jp.filter(p => !s.playerPreferences[p.id]);
  const showOpts = isHost() && missing.length && Date.now() - UI.waitSince > 7000;
  return `<div class="scr no-nav">
  <div class="hdr">${closeBtn()}<div class="mid">Group match</div><span class="spacer"></span></div>
  <div class="gp-center">
    <div class="locked-ic small-ic">${I('check')}</div>
    <h1 style="margin-top:6px">Preferences sent ✓</h1>
    <div class="sub" style="margin-top:0">${missing.length ? 'Waiting for the rest of the group…' : 'Everyone has answered!'}</div>
    <div class="got-count"><b id="gotN">${got}</b> of ${jp.length} preferences received</div>
    <div class="got-bar"><i style="width:${got / jp.length * 100}%"></i></div>
    <div class="got-av">${jp.map(p => { const ok = !!s.playerPreferences[p.id]; return `<span class="ga ${ok ? 'ok' : 'wait'}">${AV(p.id, 'sm')}<small>${p.name} ${ok ? '✓' : '…'}</small></span>`; }).join('')}</div>
    ${showOpts ? `<div class="wait-card glass glassin"><b>${missing.length} of ${jp.length} still answering</b><span>Waiting for ${missing.map(p => p.name).join(', ')}</span>
      <div class="foot" style="padding:10px 0 0"><button class="btn btn-glass sm" data-act="toast" data-msg="We'll keep waiting">Wait</button><button class="btn btn-primary sm" data-act="continueNow">Continue with current responses</button></div></div>` : ''}
  </div></div>`; },

/* 15 · Finding your group match */
matching: () => `<div class="scr no-nav">
  <div class="gp-center">
    <div class="phone-converge">${['competitive', 'music', 'trivia', 'playful'].map((k, i) => `<i style="--i:${i}"></i>`).join('')}<span class="pc-core">${LOGO_SMALL_O}</span></div>
    <h1>Finding your group match…</h1>
    <div class="sub" style="margin-top:0">Combining ${prefsCount(shared())} sets of preferences.<br>Look at the TV.</div>
  </div></div>`,

/* 16 · Best Matches (host chooses; players see the same list) */
matches: () => matchesScreen(false),
nextMatch: () => matchesScreen(true),

/* 17 · Game details (inside a room) */
details: () => detailsScreen(shared().selectedGame, (shared().recommendations.top.concat(shared().recommendations.different)).find(r => r.id === shared().selectedGame), false),

/* 18 · Ready */
ready: () => {
  const s = shared(), g = s.gameSession, jp = joinedPlayers(s), rdy = jp.filter(p => p.ready), all = rdy.length === jp.length;
  const me = meP(), host = isHost(), counting = g && g.phase === 'countdown';
  const wait = jp.filter(p => !p.ready).map(p => p.name);
  return `<div class="scr no-nav">
  <div class="hdr">${counting ? '<span class="spacer"></span>' : closeBtn()}<div class="mid">${G[s.selectedGame].name}</div><span class="spacer"></span></div>
  <div class="body">
    <div class="rules-hero">${tile(s.selectedGame, 64)}</div>
    <div class="chain-ph glass">${[['ear', 'Listen'], ['bolt', 'Buzz'], ['edit', 'Answer'], ['tv', 'Reveal']].map((r, i) => `${i ? `<span class="arr">${I('arrow')}</span>` : ''}<span class="cs"><span class="num n${i + 1}">${I(r[0], '', 'width:13px;height:13px')}</span>${r[1]}</span>`).join('')}</div>
    <div class="score-pre"><span class="pill mint">+100 correct</span><span class="pill pink">${I('bolt')}+20 fastest</span><span class="pill glassy">5 rounds</span></div>
    <div class="ready-list glass">${jp.map(p => `<div class="rl ${p.ready ? 'ok' : ''}">${AV(p.id, 'xs')}<span>${p.name}${p.id === UI.me ? ' <small>(you)</small>' : ''}</span><b>${p.ready ? I('check', '', 'width:14px;height:14px;stroke-width:3') + 'Ready' : '<span class="spin dark"></span>'}</b></div>`).join('')}</div>
    <div class="ready-state ${all ? 'ok' : ''}">${counting ? `Starting in ${g.count}… look at the TV` : all ? `${I('check', '', 'width:16px;height:16px;stroke-width:3')}Everyone's ready` : `${rdy.length} of ${jp.length} ready · Waiting for ${wait.join(', ')}`}</div>
  </div>
  <div class="foot">${counting ? `<button class="btn btn-mint" disabled style="opacity:1">${I('tv')}Look at the TV</button>`
    : host ? `<button class="btn btn-primary" data-act="startGame" ${all ? '' : 'disabled'}>${all ? I('play') + 'Start Game' : 'Waiting for everyone…'}</button>`
    : me.ready ? `<button class="btn btn-mint" disabled style="opacity:1">${I('check')}Ready — ${hostName()} starts the game</button>` : `<button class="btn btn-primary" data-act="imReady">I'm ready</button>`}</div></div>`; },

/* 19 · Round x/5 · BUZZ */
listen: () => {
  const s = shared(), g = s.gameSession, R = ROUNDS[g.round - 1], live = g.phase === 'listen', rk = ranking(g), pos = rk.findIndex(r => r.id === UI.me);
  const gap = pos > 0 ? rk[pos - 1].s - g.scores[UI.me] : 0;
  return `<div class="scr no-nav game">${gStatus()}
  ${R.double ? `<div class="final-ban glassin">${I('flame', '', 'color:var(--coral)')}<span>Final round · <b>${pos === 0 ? "You're 1st" : "You're " + ordinal(pos)}</b>${pos ? ' · ' + gap + ' pts behind' : ''}</span><span class="x2" style="margin-left:auto">×2 points</span></div>` : ''}
  <div class="gp-center">
    <div class="wave ${live ? '' : 'still'}">${Array.from({length:24}, (_, i) => `<i style="animation-delay:${(i * 73 % 500) / 1000}s;height:${30 + (i * 37 % 60)}%"></i>`).join('')}</div>
    <div class="listen-l">${live ? 'Listen carefully…' : `Round ${g.round} of 5 — get ready…`}</div>
    <div class="buzz-wrap ${live ? 'live' : ''}"><button class="buzz" id="buzzBtn" data-act="buzz" ${live && !g.paused ? '' : 'disabled'} aria-label="Buzz">BUZZ</button></div>
    <span class="timer-chip glass">${I('clock', '', 'width:15px;height:15px')}<span id="pTimer">${live ? g.timer + 's' : '—'}</span></span>
    <div class="small">${live ? 'Tap BUZZ as soon as you know it' : 'The song plays on the TV'}</div>
  </div></div>`; },

/* 20 · Answer */
answer: () => {
  const s = shared(), g = s.gameSession, R = ROUNDS[g.round - 1];
  const order = Object.entries(g.buzz).sort((a, b) => a[1] - b[1]), first = order[0] && order[0][0];
  if (UI.ansRound !== g.round) { UI.ans = null; UI.ansRound = g.round; }
  return `<div class="scr no-nav game">${gStatus()}
  <div class="body" style="padding-top:8px">
    <div style="display:flex;justify-content:center"><span class="buzzed-badge ${first === UI.me ? 'first' : 'second'} glassin">${I('bolt', '', 'width:16px;height:16px')}${first === UI.me ? 'You buzzed first!' : person(first).n + ' buzzed first — you can still score'}</span></div>
    <div class="small" style="text-align:center;margin-top:6px">Your buzz: ${(g.buzz[UI.me] || 0).toFixed(1)} sec · <span id="pTimer">${g.timer}s</span> left</div>
    <h1 style="margin-top:14px">Which song is it?</h1>
    <div class="ans-list" role="radiogroup">${R.opts.map((o, i) => `<button class="ans glass selectable ${UI.ans === i ? 'sel' : ''}" role="radio" aria-checked="${UI.ans === i}" data-act="pickAns" data-v="${i}" ${UI.submitting ? 'disabled' : ''}><span class="L">${UI.ans === i ? I('check', '', 'width:15px;height:15px;stroke-width:3') : 'ABCD'[i]}</span><span><span class="t">${o[0]}</span><br><span class="a">${o[1]}</span></span>${UI.ans === i ? '<span class="sel-tag">Selected</span>' : ''}</button>`).join('')}</div>
  </div>
  <div class="foot"><button class="btn btn-primary" data-act="confirmAns" ${UI.ans === null || UI.submitting ? 'disabled' : ''}>${UI.submitting ? '<span class="spin"></span>Locking in…' : UI.ans === null ? 'Select an answer' : 'Confirm answer'}</button></div></div>`; },

/* 21 · Answer locked · LOOK AT THE TV (eyes down → eyes up) */
locked: () => {
  const s = shared(), g = s.gameSession, R = ROUNDS[g.round - 1], lk = g.lock[UI.me], mine = lk === 'sealed' ? UI.myAns[g.round] : lk;
  const n = Object.keys(g.lock).length, tot = joinedPlayers(s).length;
  return `<div class="scr no-nav game">${gStatus()}
  <div class="gp-center" style="gap:6px">
    ${mine === undefined ? `<div class="big-ic warn" style="margin:0">${I('clock')}</div><h1>Time's up</h1><div class="sub" style="margin-top:0">No answer this round — next one is yours.</div>`
      : `<div class="locked-row"><span class="locked-ic sm">${I('check')}</span><span><b>Answer locked</b><small>Your answer: ${mine !== undefined && mine !== null && R.opts[mine] ? R.opts[mine][0] : 'locked in'} · only you can see it</small></span></div>`}
    <div class="ans-count"><span id="lockN">${n}</span> of ${tot} answered</div>
    <button class="look-tv" data-act="lookTV"><span class="lt-ic">${I('tv')}</span><span class="lt-t">LOOK AT<br>THE TV</span><span class="lt-d">The reveal happens on the shared screen</span></button>
  </div></div>`; },

/* 22 · Round result (also shown when a round was ended early — completed scores are kept) */
result: () => {
  const s = shared(), g = s.gameSession, res = g.results[g.round - 1], r = res.per[UI.me], rk = ranking(g), pos = rk.findIndex(x => x.id === UI.me);
  const prevRk = ranking(g, g.prevScores), prevPos = prevRk.findIndex(x => x.id === UI.me);
  const lead = pos === 0 ? rk[0].s - rk[1].s : rk[pos - 1].s - g.scores[UI.me];
  const R = ROUNDS[g.round - 1], host = isHost();
  return `<div class="scr no-nav game">${gStatus()}
  <div class="gp-center">
    ${res.endedEarly ? `<div class="res-big glassin" style="font-size:30px">Round ${g.round} ended early</div><div class="sub" style="margin-top:0">This round isn’t scored. Earlier scores are kept.</div>`
    : `<div class="res-big ${r.pts ? 'good' : 'bad'} glassin">${r.pts ? 'Correct!' : r.ans === null ? 'No answer' : 'Not quite'}</div>
    ${r.pts ? `<div class="pts">+${r.pts}</div><div class="breakdown"><span class="pill mint">Correct +${100 * (R.double ? 2 : 1)}</span>${r.fast ? `<span class="pill pink">${I('bolt')}Fastest +${20 * (R.double ? 2 : 1)}</span>` : ''}</div>`
      : `<div class="sub" style="margin-top:0">It was <b>${R.opts[R.ok][0]}</b>. You're still in it.</div>`}`}
    <button class="pos-card glass" style="margin-top:14px" data-act="lookTV"><span class="pos-num ${pos === 0 ? 'p1' : ''}">${pos + 1}</span><span style="flex:1"><b style="font-size:16px">You're ${ordinal(pos)}${prevPos > pos ? ' ↑' : ''}</b><br><span class="small">${pos === 0 ? (lead ? lead + ' pts ahead of ' + rk[1].n : 'Tied for the lead') : lead + ' pts behind ' + rk[pos - 1].n}</span></span><span style="font-weight:700;font-size:18px">${g.scores[UI.me]}</span></button>
    <div class="small" style="margin-top:6px">${g.hold ? (host ? 'You decide what happens next' : hostName() + ' decides what happens next') : g.round < 5 ? 'Leaderboard is on the TV · next round starting…' : 'Final scores on the TV…'}</div>
  </div>
  ${g.hold && host ? `<div class="foot col"><button class="btn btn-primary" data-act="nextRound">${I('play')}${g.round < 5 ? 'Next round · ' + (g.round + 1) + ' of 5' : 'See final results'}</button>
    <button class="btn btn-glass" data-act="backToRecs">${I('sparkle')}Back to recommendations</button></div>` : ''}</div>`; },

/* 23 · Final result */
final: () => {
  const s = shared(), g = s.gameSession, rk = ranking(g), pos = rk.findIndex(r => r.id === UI.me), host = isHost();
  const res = g.results.filter(Boolean).map(r => r.per[UI.me]);
  const correct = res.filter(r => r.correct).length, ts = res.filter(r => r.t !== null && r.ans !== null).map(r => r.t);
  let best = 0, cur = 0; res.forEach(r => { cur = r.correct ? cur + 1 : 0; best = Math.max(best, cur); });
  return `<div class="scr no-nav">
  <div class="hdr"><span class="spacer"></span><div class="mid">${G[s.selectedGame].name} · Final</div><span class="spacer"></span></div>
  <div class="body" style="text-align:center">
    ${pos === 0 ? `<div class="crown-img glassin"><img src="${IMG.crown}" alt=""></div><div class="res-big good" style="font-size:36px;margin-top:6px">You won!</div>`
      : `<div class="small" style="margin-top:4px;font-weight:600">Winner · ${rk[0].n} ${AV(rk[0].id, 'xs')}</div><div class="pos-num" style="margin:8px auto 0;width:64px;height:64px;font-size:28px">${pos + 1}</div><div class="res-big" style="margin-top:6px;font-size:28px">You finished ${ordinal(pos)}</div>`}
    <div class="sub" style="margin-top:2px">${g.scores[UI.me]} points · ${pos === 0 ? 'by ' + (rk[0].s - rk[1].s) + ' pts over ' + rk[1].n : rk[0].n + ' won with ' + rk[0].s}</div>
    <div class="stats" style="margin-top:12px"><div class="glass"><b>${correct}/5</b><span>Correct</span></div><div class="glass"><b>${ts.length ? Math.min(...ts).toFixed(1) : '–'}s</b><span>Fastest buzz</span></div><div class="glass"><b>${best}</b><span>Best streak</span></div></div>
    <div class="mini-board glass" style="margin-top:10px;text-align:left">${rk.map((r, i) => `<div class="mb-row ${r.id === UI.me ? 'me' : ''}"><span class="r">${i + 1}</span>${AV(r.id, 'xs')}${r.n}${r.id === UI.me ? ' (you)' : ''}<span class="s">${r.s}</span></div>`).join('')}</div>
  </div>
  <div class="foot col">${host ? `<button class="btn btn-primary" data-act="tryAnother">${I('sparkle')}Try another recommended game</button>
    <div style="display:flex;gap:10px"><button class="btn btn-glass" data-act="playAgain" style="font-size:14px">${I('refresh')}Play ${G[s.selectedGame].name} again</button><button class="btn btn-glass" data-act="homeEnd" style="flex:0 0 108px;font-size:14px">Home</button></div>`
    : `<div class="status-line" style="margin:0 0 6px"><span class="dot"></span>${hostName()} chooses what's next</div><button class="btn btn-glass" data-act="leaveNow">Leave room</button>`}</div></div>`; }
};

function codeHelperText(c) { return c.length >= 4 ? 'Ready to join' : (4 - c.length) + ' digit' + (4 - c.length === 1 ? '' : 's') + ' to go'; }

/* Game details: name, group match, description, duration, players, category, scoring preview, one CTA. */
function detailsScreen(id, rec, browsing) {
  const g = G[id], s = shared(), tv = s.room && s.room.tvConnected;
  const cta = browsing
    ? `<button class="btn btn-primary" data-act="playWithRoom" data-g="${id}">${I('plus')}Play with a room</button>`
    : !g.playable ? `<button class="btn btn-primary" data-act="selectGame" data-g="${id}">${I('play')}Play ${G[id].name}</button>`
    : tv ? `<button class="btn btn-primary" data-act="openReady">${I('tv')}Start on Living Room TV</button>` : `<button class="btn btn-primary" data-act="openConnect">${I('tv')}Connect the TV to start</button>`;
  return `<div class="scr ${browsing ? 'nav-on' : 'no-nav'}">
  <div class="hero"><img src="${IMG.hero}" alt=""><div class="hb">${back(browsing ? 'back' : 'backToMatches')}<span class="spacer"></span></div></div>
  <div class="det-card glass enter-up">${tile(id, 60)}<div style="flex:1;min-width:0"><h2>${g.name}</h2><div class="tags">${catPill(g)}<span class="pill glassy">${I('user')}${playersLabel(g)} players</span><span class="pill glassy">${I('clock')}~${g.duration} min</span></div></div>${rec ? pctRing(rec.score, 58) : ''}</div>
  <div class="body" style="padding-top:0">
    ${rec ? `<div class="match-line">${I('sparkle', '', 'width:15px;height:15px')}<b>${rec.score}% group match</b><span>· ${rec.reasons.slice(0, 2).join(' · ')}</span></div>` : ''}
    <div class="blk glass"><p style="color:var(--ink);font-size:14.5px">${g.d}${id === 'firstnotes' ? ' Five rounds — fastest correct answer gets a bonus.' : ''}</p></div>
    <div class="blk glass"><h3>${I('trophy', '', 'width:16px;height:16px;color:var(--amber)')}Scoring</h3><div class="score-tbl">
      <div><span>Correct answer</span><b class="plus">+100</b></div><div><span>Fastest correct buzz</span><b class="plus">+20</b></div><div><span>Final round</span><b>×2</b></div></div></div>
    ${!browsing && !g.playable ? `<p class="small" style="text-align:center;margin-top:10px">In this prototype only First Notes is playable.</p>` : ''}
    ${browsing ? `<p class="small" style="text-align:center;margin-top:10px">Not sure? “Create a Room” finds a game that fits your whole group.</p>` : ''}
  </div>
  <div class="foot">${cta}</div>${browsing ? navBar() : ''}</div>`;
}

/* Best Matches / Next Match */
function recDisplay(s, next) {       // display order only — the saved recommendations never change here
  const R = s.recommendations, played = s.played || [], all = R.top.concat(R.different);
  if (!next) return {best:R.top[0], others:R.top.slice(1), different:R.different};
  const best = all.find(r => !played.includes(r.id)) || R.top[0];
  return {best, others:R.top.filter(r => r !== best), different:R.different.filter(r => r !== best)};
}
function matchesScreen(next) {
  const s = shared(), R = s.recommendations, host = isHost(), played = s.played || [];
  if (!R || !R.top.length) return `<div class="scr no-nav"><div class="gp-center"><h1>No games fit yet</h1><div class="sub">Try more time or update preferences.</div></div></div>`;
  const {best, others, different} = recDisplay(s, next), g = s.gameSession, paused = g && g.phase !== 'done' && s.room.status === 'matches';
  const row = (r, small) => `<button class="rec glass ${small ? 'diff' : ''}" ${host ? `data-act="selectGame" data-g="${r.id}"` : 'disabled'}>${tile(r.id, small ? 46 : 52)}
    <span style="flex:1;min-width:0"><span class="t">${G[r.id].name} ${catPill(G[r.id])}${played.includes(r.id) ? '<span class="pill mint">Played ✓</span>' : ''}</span><span class="meta" style="display:block">${r.highlight || r.reasons[0] || ''}</span></span><span class="pct-s">${r.score}%</span></button>`;
  return `<div class="scr no-nav">
  <div class="hdr">${closeBtn()}<div class="mid">${next ? 'Next match' : 'Your group match'}</div><span class="spacer"></span></div>
  <div class="body">
    ${paused ? `<div class="resume-card glass glassin">${tile(g.game || 'firstnotes', 44)}<span style="flex:1;min-width:0"><b>${G[g.game || 'firstnotes'].name} is paused</b><span>Round ${g.round} of 5 · ${joinedPlayers(s).length} players · scores kept</span></span>
      ${host ? `<button class="btn btn-primary sm" data-act="resumeGame">${I('play')}Return</button>` : ''}</div>` : ''}
    <div class="ctx">${I('sparkle', '', 'width:16px;height:16px;flex:none')}<span>${next ? 'Same group, same preferences · ' : 'Based on '}${ctxLine()}</span></div>
    <div class="best-card glass glassin" ${host ? `data-act="selectGame" data-g="${best.id}" role="button" tabindex="0"` : ''}>
      <div class="bc-top">${tile(best.id, 64)}<div style="flex:1;min-width:0"><div class="bc-k">${next ? 'NEXT MATCH' : 'BEST MATCH'}</div><div class="bc-n">${G[best.id].name}</div><div class="bc-m">${G[best.id].cat} · ${G[best.id].duration} min</div></div>${pctRing(best.score, 70)}</div>
      <div class="bc-why"><div class="bw-h">${best.score}% GROUP MATCH · Why this works</div>${best.reasons.map(r => `<div class="bw">${I('check', '', 'width:14px;height:14px;stroke-width:3')}${r}</div>`).join('')}</div>
      ${host ? `<div class="bc-cta">See game ${I('arrow', '', 'width:16px;height:16px')}</div>` : `<div class="bc-cta wait">${hostName()} is picking the game</div>`}
    </div>
    ${others.length ? `<div class="sec-t">Also a great fit</div><div class="rec-list" style="margin-top:0">${others.map(r => row(r)).join('')}</div>` : ''}
    ${different.length ? `<div class="sec-t">Want something different?</div><div class="rec-list" style="margin-top:0">${different.map(r => row(r, true)).join('')}</div>` : ''}
    ${next ? `<button class="btn-quiet" style="width:100%;margin-top:8px" data-act="updatePrefs">${I('edit', '', 'width:15px;height:15px;vertical-align:-2px')} Update my preferences</button>` : ''}
  </div></div>`;
}

/* ---------- overlays: sheets, modal, toast, disconnect ---------- */
function overlays() {
  let h = '';
  const sh = UI.sheet;
  if (sh) {
    const wrap = inner => `<div class="overlay"><div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${inner}</div></div>`;
    if (sh === 'help') h += wrap(`<h2>Connecting to your TV</h2><div class="sub">Three quick checks</div><ul class="how" style="padding:4px 4px 12px">${['Turn on the TV and open the PLAYMODE app', 'Phone and TV on the same Wi-Fi', 'Still stuck? Use the TV code on screen'].map((t, i) => `<li><span class="num n${i + 1}">${i + 1}</span>${t}</li>`).join('')}</ul><div class="foot" style="padding:0"><button class="btn btn-primary" data-act="closeSheet">Got it</button></div>`);
    if (sh === 'roomhelp') h += wrap(`<h2>How friends join</h2><div class="sub">Open PLAYMODE → Join a Room → enter <b>${roomCode()}</b>, or scan the QR on the TV. No account needed. Only you, the host, connect the TV.</div><div class="foot" style="padding:0"><button class="btn btn-primary" data-act="closeSheet">Got it</button></div>`);
    if (sh === 'tvcode') { const c = UI.tvcode; h += wrap(`<h2>Enter TV code</h2><div class="sub">The 4-digit code is on your TV screen.</div>
      <div class="code-boxes ${UI.tvcodeErr ? 'shake' : ''}" id="tvBoxes" style="margin-top:4px">${[0, 1, 2, 3].map(i => `<span class="cb glass ${UI.tvcodeErr ? 'bad' : i === c.length ? 'cur' : ''}">${c[i] || ''}</span>`).join('')}<input id="tvInput" inputmode="numeric" maxlength="4" value="${c}" aria-label="TV code"></div>
      <div class="helper" style="${UI.tvcodeErr ? 'color:var(--err);font-weight:600' : ''}" id="tvHelper">${UI.tvcodeErr ? "That code doesn't match — check the TV and try again." : 'Hint: it changes every time the TV restarts.'}</div>
      <div class="foot" style="padding:14px 0 0"><button class="btn btn-primary" id="tvJoinBtn" data-act="tvcodeGo" ${c.length === 4 ? '' : 'disabled'}>Connect</button></div>`); }
    if (sh === 'qr') h += wrap(`<h2>Scan the TV</h2><div class="sub">Point your camera at the QR code on the TV.</div><div class="cam sm"><div class="cam-qr">${joinQR()}</div><i class="cam-c tl"></i><i class="cam-c tr"></i><i class="cam-c bl"></i><i class="cam-c br"></i><i class="cam-line"></i></div><div class="foot col" style="padding:12px 0 0"><button class="btn btn-primary" data-act="qrTV">${I('check')}Simulate successful scan</button><button class="btn btn-glass" data-act="closeSheet">Cancel</button></div>`);
  }
  const modal = (ic, title, sub, btns) => `<div class="modal-wrap"><div class="scrim" data-act="stay"></div><div class="modal" role="alertdialog" aria-modal="true">
    <div class="mi">${ic}</div><h2>${title}</h2><div class="sub">${sub}</div><div class="foot col" style="padding:0">${btns}</div></div></div>`;
  if (UI.modal === 'leave') h += isHost()
    ? modal(I('door'), 'Close this room?', 'Everyone will be disconnected and the TV returns to the start.', `<button class="btn btn-glass" data-act="stay">Stay in room</button><button class="btn btn-primary" data-act="closeAsk">Close room</button>`)
    : modal(I('door'), 'Leave this room?', 'You can rejoin with the code on the TV. The group keeps its recommendations.', `<button class="btn btn-glass" data-act="stay">Stay in room</button><button class="btn btn-primary" data-act="confirmLeave">Leave room</button>`);
  if (UI.modal === 'close2') h += modal(I('warn'), 'Close the room for everyone?', `All ${joinedPlayers(shared()).length} players are disconnected. Preferences, recommendations and scores are deleted. This can’t be undone.`,
    `<button class="btn btn-glass" data-act="stay">Cancel · stay in room</button><button class="btn btn-danger" data-act="closeConfirm">Yes, close room</button>`);
  if (UI.modal === 'soon' && UI.soonGame) h += modal(`<span class="soon-art">${tile(UI.soonGame, 56)}</span>`, 'Coming soon', 'This game is not available in the prototype yet. Try First Notes to continue the experience.',
    `<button class="btn btn-primary" data-act="soonPlayFN">${I('play')}Play First Notes</button><button class="btn btn-glass" data-act="soonBack">Back to recommendations</button>`);
  if (UI.modal === 'gmenu') { const g = shared().gameSession, live = g && ['countdown', 'intro', 'listen'].includes(g.phase);
    h += modal(I('pause'), 'Game menu', `Round ${g ? g.round : 1} of 5 · scores, players and recommendations are kept.`,
      `<button class="btn btn-glass" data-act="stay">${I('play')}Keep playing</button>
       ${live ? `<button class="btn btn-glass" data-act="endRound">${I('flag')}End this round early</button>` : ''}
       <button class="btn btn-glass" data-act="backToRecs">${I('sparkle')}Back to recommendations</button>
       <button class="btn-quiet danger" data-act="leave">Close room…</button>`); }
  if (UI.discon) {
    const d = UI.discon;
    h += `<div class="full-ov">${d === 'back' ? `<div class="big-ic ok">${I('check', '', 'stroke-width:3')}</div><h1>You're back ✓</h1><div class="sub">The round continues — nothing was restarted.</div>`
      : `<div class="big-ic warn">${I('wifioff')}</div><h1>Connection lost</h1><div class="sub">Your score is saved · the TV is paused for you.</div>
      <div class="foot col" style="width:100%;margin-top:26px"><button class="btn btn-primary" data-act="reconnect" ${d === 'trying' ? 'disabled' : ''}>${d === 'trying' ? '<span class="spin"></span>Reconnecting…' : I('refresh') + 'Reconnect'}</button></div>`}</div>`;
  }
  if (UI.toast) h += `<div class="toast ${UI.toast.ok ? 'ok' : ''}" role="status">${I(UI.toast.ok ? 'check' : 'sparkle', '', 'width:18px;height:18px')}${UI.toast.m}</div>`;
  return h;
}

/* ================= RENDER ================= */
let lastScreen = null, sentTimer = null, lastHTML = '';
const GAME_SCREENS = ['listen', 'answer', 'locked', 'result', 'final'];
function trackListen() {            // when did THIS phone see the round start? (for buzz times without clock sync)
  const g = shared().gameSession; if (!g || g.phase !== 'listen') return;
  const mark = g.round + ':' + g.listenAt;
  if (UI.listenMark !== mark) { UI.listenMark = mark; UI.listenLocal = performance.now() - Math.max(0, 10 - g.timer) * 1000; }
}
function renderPhone(force) {
  if (!app) return;
  trackListen();
  // my seat was taken by another phone at the same moment → choose again
  if (UI.controller && UI.joinCheck && UI.me && Date.now() - UI.joinCheck < 15000) {
    const p = shared().players.find(x => x.id === UI.me);
    if (p && p.joined && p.device && p.device !== DEVICE_ID) { UI.joinCheck = 0; UI.me = null; UI.screen = 'seat'; UI.seat = null; toast('That seat was just taken — pick another'); }
  }
  const scr = currentScreen();
  // occasion theme: full atmosphere before the game, faint ambient layer during gameplay
  const wrap = document.getElementById('screenWrap'), st = shared().sessionTheme, inGame = GAME_SCREENS.includes(scr);
  setTargetTheme(wrap, inRoom() && st ? st.occasion : null, true);
  setThemeIntensity(inGame ? 'gameplay' : 'pregame', inGame ? 0.95 : 1, wrap);
  wrap.dataset.scr = scr;
  const ae = document.activeElement, keep = ae && ae.tagName === 'INPUT' && app.contains(ae) ? [ae.id, ae.selectionStart] : null;
  const fn = SCREENS[scr] || SCREENS.home;
  const scrollEl = app.querySelector('.body'), scroll = scrollEl && lastScreen === scr ? scrollEl.scrollTop : 0;
  if (document.body.classList.contains('native') && (window.scrollY || document.documentElement.scrollTop)) window.scrollTo(0, 0);
  ['screenWrap', 'app'].forEach(id => { const el = document.getElementById(id); if (el && el.scrollTop) el.scrollTop = 0; });
  const html = fn() + overlays();
  if (!force && html === lastHTML && lastScreen === scr) { if (typeof paintBadge === 'function') paintBadge(); return; }   // nothing changed: keep the DOM (taps in progress survive)
  lastHTML = html;
  app.innerHTML = html;
  if (keep) { const el = document.getElementById(keep[0]); if (el) { el.focus({preventScroll:true}); try { el.setSelectionRange(keep[1], keep[1]); } catch (e) {} } }
  const node = app.querySelector('.scr');
  if (lastScreen !== scr && node) node.classList.add('enter-' + (UI.dir || 'fwd'));
  if (lastScreen === scr && node) node.classList.add('settled');   // re-render of the same screen: don't replay entrance animations
  const b = app.querySelector('.body'); if (b && scroll) b.scrollTop = scroll;
  lastScreen = scr; UI.dir = 'fwd';
  document.getElementById('statusbar').classList.toggle('light', scr === 'details' || scr === 'gdetails');
  bindInputs();
  if (scr === 'qrscan' && LIVE) setTimeout(startQRScan, 50); else stopQRScan();
  const ni = document.getElementById('nameInput');
  if (ni) { ni.addEventListener('input', () => { UI.nameDraft = ni.value; const b = document.querySelector('[data-act=joinSeat]'); if (b && UI.seat) b.textContent = 'Join as ' + (cleanName(ni.value) || seatName(UI.seat)); });
    ni.addEventListener('keydown', e => { if (e.key === 'Enter' && UI.seat) document.querySelector('[data-act=joinSeat]').click(); }); }
  if (scr === 'sent' && isHost() && !sentTimer) sentTimer = setTimeout(() => { sentTimer = null; if (currentScreen() === 'sent') renderPhone(); }, Math.max(300, 7100 - (Date.now() - UI.waitSince)));
  if (typeof paintPanel === 'function') paintPanel(scr);
  if (typeof paintBadge === 'function') paintBadge();
}
function go(screen, dir = 'fwd') { if (screen !== UI.screen) UI.hist.push(UI.screen); UI.dir = dir; UI.screen = screen; UI.sheet = null; renderPhone(); }
function goBack() { UI.screen = UI.hist.pop() || 'home'; UI.dir = 'back'; UI.sheet = null; renderPhone(); }
let toastTimer;
function toast(m, ok) { UI.toast = {m, ok}; renderPhone(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { UI.toast = null; renderPhone(); }, 2200); }

function fillAfterError(digits) {      // first keystroke after an error starts a fresh attempt
  const boxes = [0, 1, 2, 3].map(i => document.getElementById('cb' + i));
  if (!boxes[0]) return;
  boxes.forEach(b => b.value = ''); digits.slice(0, 4).split('').forEach((d, k) => boxes[k].value = d);
  UI.code = digits.slice(0, 4); const f = boxes[Math.min(3, UI.code.length)]; f.focus();
  const jb = document.getElementById('joinBtn'); if (jb) { jb.disabled = UI.code.length !== 4; jb.textContent = UI.code.length === 4 ? 'Join room ' + UI.code : 'Join'; }
  const hp = document.getElementById('codeHelper'); if (hp) hp.textContent = codeHelperText(UI.code);
}
function bindInputs() {
  const boxes = [0, 1, 2, 3].map(i => document.getElementById('cb' + i)).filter(Boolean);
  if (boxes.length === 4) {
    const sync = () => {
      UI.code = boxes.map(x => x.value).join('');
      const full = UI.code.length === 4;
      boxes.forEach((x, i) => { x.classList.toggle('ok', full); x.classList.toggle('cur', !full && i === UI.code.length); x.classList.remove('bad'); });
      const jb = document.getElementById('joinBtn'); if (jb) { jb.disabled = !full; jb.textContent = full ? 'Join room ' + UI.code : 'Join'; }
      const hp = document.getElementById('codeHelper'); if (hp) hp.textContent = codeHelperText(UI.code);
    };
    const fill = (from, digits) => {        // typing, autofill or pasting several digits spreads them across the boxes
      digits.split('').forEach((d, k) => { if (boxes[from + k]) boxes[from + k].value = d; });
      sync(); const next = boxes[Math.min(3, from + digits.length)]; next.focus(); next.select();
    };
    boxes.forEach((x, i) => {
      x.addEventListener('focus', () => x.select());
      x.addEventListener('input', () => {
        if (UI.codeErr) { const keep = x.value.replace(/\D/g, ''); UI.codeErr = false; UI.code = ''; renderPhone(); return fillAfterError(keep); }
        const d = x.value.replace(/\D/g, '');
        x.value = ''; if (d) fill(i, d.slice(0, 4 - i)); else sync();
      });
      x.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !x.value && i > 0) { e.preventDefault(); boxes[i - 1].value = ''; boxes[i - 1].focus(); sync(); }
        else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); boxes[i - 1].focus(); }
        else if (e.key === 'ArrowRight' && i < 3) { e.preventDefault(); boxes[i + 1].focus(); }
        else if (e.key === 'Enter' && UI.code.length === 4) joinRoom();
      });
      x.addEventListener('paste', e => { const t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, ''); if (t) { e.preventDefault(); boxes.forEach(b => b.value = ''); fill(0, t.slice(0, 4)); if (UI.code.length === 4) setTimeout(joinRoom, 150); } });
    });
    if (!UI.codeErr && document.activeElement.tagName !== 'INPUT') { const f = boxes[Math.min(3, UI.code.length)]; setTimeout(() => f.focus({preventScroll:true}), 60); }
  }
  const ti = document.getElementById('tvInput');
  if (ti) {
    ti.addEventListener('input', () => {
      UI.tvcode = ti.value.replace(/\D/g, '').slice(0, 4); ti.value = UI.tvcode; UI.tvcodeErr = false;
      document.querySelectorAll('#tvBoxes .cb').forEach((b, i) => { b.textContent = UI.tvcode[i] || ''; b.classList.remove('bad'); b.classList.toggle('cur', i === UI.tvcode.length); });
      document.getElementById('tvJoinBtn').disabled = UI.tvcode.length !== 4;
    });
    setTimeout(() => ti.focus({preventScroll:true}), 400);
  }
  const si = document.getElementById('search');
  if (si) si.addEventListener('input', () => { UI.q = si.value; const pos = si.selectionStart; renderPhone(); const n = document.getElementById('search'); n.focus(); n.setSelectionRange(pos, pos); });
}

/* Light-touch live patches so frequent updates don't restart animations */
function patchPhone(a) {
  trackListen();
  if (a && a.type === 'SYNC' && a.of) a = {type:a.of};          // the TV confirmed something this phone already shows
  const scr = currentScreen();
  if (scr !== lastScreen) return renderPhone();
  const g = shared().gameSession;
  if (a.type === 'TICK' && g) { const p = document.getElementById('pTimer'); if (p) { p.textContent = (g.phase === 'listen' ? g.timer + 's' : '—'); return; } }
  if ((a.type === 'LOCK' || a.type === 'BUZZ') && scr === 'locked') { const l = document.getElementById('lockN'); if (l) { l.textContent = Object.keys(g.lock).length; return; } }
  if ((a.type === 'LOCK' || a.type === 'BUZZ') && (scr === 'listen' || scr === 'answer')) return; // nothing visible changes
  renderPhone();
}

/* ================= ACTIONS ================= */
const D = a => Store.dispatch(a);
function pickThen(value, fn) {        // single-select: selected state for ~350 ms, then continue automatically
  if (UI.picking) return;
  UI.picking = String(value); renderPhone(); beep(660, .05);
  setTimeout(() => { UI.picking = null; fn(); }, 380);
}
/* Join by code or QR.
   LIVE: the code is checked against the real room on the TV (over Supabase) → then "Who's playing?".
   DEMO: 7316 is the local demo room. On the demo page / host phone it opens the room if needed (Emma = host). */
async function joinRoom(code) {
  const ci = [0, 1, 2, 3].map(i => document.getElementById('cb' + i));
  if (code === undefined) code = ci[0] ? ci.map(x => x.value).join('') : UI.code;
  code = normalizeCode(code); UI.code = code;
  if (code.length !== 4) { UI.codeErr = 'bad'; renderPhone(); beep(220, .15); return; }
  if (LIVE) {
    UI.probing = true; UI.codeErr = false; renderPhone();
    const found = await LiveRoom.open(code);
    UI.probing = false;
    if (found !== true) { UI.codeErr = found === 'offline' ? 'offline' : 'missing'; renderPhone(); beep(220, .15); return; }
    return enterSeatPicker();
  }
  let st = shared();
  const valid = code === DEMO_ROOM_CODE || (st.room && code === st.room.code);
  if (!valid) { UI.codeErr = 'bad'; renderPhone(); beep(220, .15); return; }
  if (!roomIsOpen(st)) {
    if (UI.controller) { UI.codeErr = 'notv'; renderPhone(); beep(220, .15); return; }
    D({type:'CREATE_ROOM', hostId:HOST_ID, human:true, device:DEVICE_ID}); D({type:'CONNECT_TV'}); resetLocalRoomUI();
  }
  if (UI.controller && !UI.fixedSeat) return enterSeatPicker();
  st = shared();
  const me = st.players.find(p => p.id === UI.me);
  UI.hist = []; UI.codeErr = false; UI.code = ''; UI.screen = 'home';
  if (me && !me.joined) D({type:'JOIN', id:UI.me, human:true, device:DEVICE_ID}); else renderPhone();      // never duplicates a player
  toast('Joined room ' + st.room.code, true);
}
/* Demo page / host phone: open a room — or, if the TV already opened one with no host yet, take it over as host. */
function createRoomFromPhone() {
  const s = shared();
  if (LIVE) { toast('Open the TV screen to create a live room'); return; }
  if (s.room && s.room.byTV && !s.room.hostId && roomIsOpen(s)) { D({type:'JOIN', id:UI.me, human:true, device:DEVICE_ID}); return; }
  D({type:'CREATE_ROOM', hostId:UI.me, human:true, device:DEVICE_ID});
}
function enterSeatPicker() {
  const s = shared(), mine = s.players.find(p => p.joined && p.device === DEVICE_ID && p.human && (!UI.me || p.id === UI.me));
  if (mine) return takeSeat(mine.id, mine.name);                    // this phone already holds a seat (refresh / rejoin)
  UI.hist = ['join']; UI.screen = 'seat'; UI.dir = 'fwd'; UI.codeErr = false;
  if (!UI.seat) { const f = CAST.find(c => { const p = s.players.find(x => x.id === c.id); return !(p && p.joined); }); UI.seat = f ? f.id : null; }
  renderPhone();
}
function takeSeat(id, name) {
  UI.me = id; UI.hist = []; UI.screen = 'home'; UI.code = '';
  Presence.announce(id);
  rememberMe();
  const p = shared().players.find(x => x.id === id);
  if (!(p && p.joined && p.device === DEVICE_ID)) D({type:'JOIN', id, name:name || seatName(id), human:true, device:DEVICE_ID});
  else renderPhone();
  toast(`Joined room ${roomCode()} as ${cleanName(name) || seatName(id)}`, true);
  UI.joinCheck = Date.now();
}
function rememberMe() { try { localStorage.setItem('playmode_me', JSON.stringify({room:roomCode(), id:UI.me, mode:MODE})); } catch (e) {} }

/* QR scanning with the phone camera (live mode, browsers with BarcodeDetector) */
let qrStream = null, qrTimer = null;
function stopQRScan() { if (qrTimer) clearInterval(qrTimer); qrTimer = null; if (qrStream) qrStream.getTracks().forEach(t => t.stop()); qrStream = null; }
async function startQRScan() {
  const v = document.getElementById('qrVideo'); if (!v || qrStream || !('BarcodeDetector' in window)) return;
  try {
    qrStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
    v.srcObject = qrStream; await v.play();
    const det = new BarcodeDetector({formats:['qr_code']});
    qrTimer = setInterval(async () => {
      try { const codes = await det.detect(v); const raw = codes[0] && codes[0].rawValue; if (!raw) return;
        let code = null; try { code = new URL(raw).searchParams.get('room'); } catch (e) { code = normalizeCode(raw); }
        if (code && normalizeCode(code).length === 4) { stopQRScan(); beep(990, .08); UI.screen = 'join'; joinRoom(normalizeCode(code)); }
      } catch (e) {}
    }, 300);
  } catch (e) { const m = document.getElementById('qrMsg'); if (m) m.textContent = 'Camera not available — use your camera app or enter the code.'; stopQRScan(); }
}
function connectTV() {          // always succeeds in the main flow (the error state is facilitator-only)
  if (UI.conn === 'connecting') return;
  UI.conn = 'connecting'; UI.connErr = false; renderPhone();
  if (typeof tvConnecting === 'function') tvConnecting(true);
  Sync.send({kind:'event', type:'TV_CONNECTING', on:true});
  setTimeout(() => {
    UI.conn = 'idle'; if (typeof tvConnecting === 'function') tvConnecting(false);
    Sync.send({kind:'event', type:'TV_CONNECTING', on:false});
    D({type:'CONNECT_TV'}); beep(880, .08); setTimeout(() => beep(1175, .12), 110);
    setTimeout(() => { UI.connectOpen = false; renderPhone(); }, 900);
  }, 1100);
}
/* Prototype-only: add every player who hasn't joined yet (real tabs that already joined are untouched — no duplicates). */
function demoAddPlayers() {
  const s = shared(); if (!s.room) return;
  s.players.filter(p => !p.joined).forEach((p, i) => setTimeout(() => {
    const st = shared(), q = st.room && st.players.find(x => x.id === p.id);
    if (q && !q.joined) { D({type:'JOIN', id:p.id}); beep(760 + i * 90, .05); }
  }, 250 * i));
}
/* Only a confirmed "Close room" clears the whole session — on every tab (see app.js) and in storage. */
function closeRoomConfirmed() {
  D({type:'CLOSE_ROOM'});
  resetLocalRoomUI(); UI.screen = 'home'; UI.hist = []; UI.dir = 'fade'; renderPhone(); toast('Room closed · everyone disconnected');
}
function resetLocalRoomUI() {
  Object.assign(UI, {step:'intro', prefStep:'intro', draft:{vibe:null, interests:[]}, editingPrefs:false, connectOpen:false, conn:'idle', connErr:false, ans:null, ansRound:0, submitting:false, sheet:null, modal:null, picking:null, waitSince:0});
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!app || !b || !app.contains(b) || !b.dataset.act) return;
  if (b.disabled) return;
  unlockAudio();
  const a = b.dataset.act, d = b.dataset, s = shared();
  switch (a) {
    case 'back': goBack(); break;
    case 'go': if (d.to === 'join') { UI.code = ''; UI.codeErr = false; } go(d.to); break;
    case 'tab': UI.hist = d.tab === 'home' ? [] : ['home']; UI.dir = 'fade'; UI.screen = d.tab === 'home' ? 'home' : d.tab === 'games' ? 'games' : 'roomtab'; renderPhone(); break;
    case 'cat': UI.gcat = d.v; renderPhone(); break;
    case 'gdetails': UI.detail = d.g; go('gdetails'); break;
    case 'playWithRoom': UI.pendingGame = G[d.g].playable ? d.g : null; if (!G[d.g].playable) toast('Only First Notes is playable — your group can still find a match'); resetLocalRoomUI(); createRoomFromPhone(); break;
    case 'createRoom': UI.pendingGame = null; resetLocalRoomUI(); createRoomFromPhone(); break;
    case 'openConnect': UI.connectOpen = true; UI.connErr = false; UI.dir = 'fwd'; renderPhone(); break;
    case 'closeConnect': UI.connectOpen = false; UI.connErr = false; UI.dir = 'back'; renderPhone(); break;
    case 'connectTV': connectTV(); break;
    case 'startMatching': if (!s.room || !s.room.tvConnected) { UI.connectOpen = true; renderPhone(); break; } UI.step = 'intro'; D({type:'START_MATCHING'}); break;
    case 'demoAddPlayers': demoAddPlayers(); break;
    case 'playPending': D({type:'OPEN_READY', game:UI.pendingGame}); break;
    case 'ctxStart': UI.step = 'occasion'; UI.dir = 'fwd'; renderPhone(); break;
    case 'ctxBack': UI.dir = 'back';
      if (UI.step === 'time') UI.step = 'occasion'; else if (UI.step === 'occasion') UI.step = 'intro';
      else D({type:'CANCEL_MATCHING'});
      renderPhone(); break;
    case 'pickOcc': {   // selected-card payoff + theme transition start immediately (phone and TV), auto-advance after ~380 ms
      if (UI.picking) break;
      pickThen(d.v, () => { UI.step = 'time'; UI.dir = 'fwd'; renderPhone(); });
      transitionToOccasionTheme(d.v, [document.getElementById('screenWrap')]);
      D({type:'SET_OCCASION', occasion:d.v});
      Sync.send({kind:'event', type:'SESSION_THEME_CHANGED', occasion:d.v});
      break; }
    case 'pickTime': pickThen(d.v, () => { UI.prefStep = 'vibe'; UI.waitSince = Date.now(); UI.dir = 'fwd'; D({type:'SET_TIME', minutes:+d.v}); }); break;
    case 'prefStart': UI.prefStep = 'vibe'; UI.dir = 'fwd'; renderPhone(); break;
    case 'pickVibe': pickThen(d.v, () => { UI.draft.vibe = d.v; UI.prefStep = 'interests'; UI.dir = 'fwd'; renderPhone(); }); break;
    case 'prefBack': UI.prefStep = 'vibe'; UI.dir = 'back'; renderPhone(); break;
    case 'toggleInt': {
      let L = UI.draft.interests.slice();
      if (d.v === 'surprise') L = L.includes('surprise') ? [] : ['surprise'];
      else { L = L.filter(x => x !== 'surprise'); L = L.includes(d.v) ? L.filter(x => x !== d.v) : L.concat(d.v); }
      UI.draft.interests = L; renderPhone(); break; }
    case 'prefsDone': {
      const edit = UI.editingPrefs; UI.editingPrefs = false; UI.prefStep = 'done'; UI.waitSince = UI.waitSince || Date.now(); UI.dir = 'fwd';
      UI.myPrefs = {vibe:UI.draft.vibe, interests:UI.draft.interests.slice()};
      // private: the choices go sealed to the TV only; the room just learns that I answered
      Sealed.send({t:'prefs', id:UI.me, vibe:UI.myPrefs.vibe, interests:UI.myPrefs.interests}).then(() => D({type:'SUBMIT_PREFS', id:UI.me, sealed:true}));
      beep(880, .06); if (edit) toast('Preferences updated — scores recalculated', true); break; }
    case 'updatePrefs': { const p = UI.myPrefs || (s.playerPreferences[UI.me] && s.playerPreferences[UI.me].vibe ? s.playerPreferences[UI.me] : null); UI.draft = p ? {vibe:p.vibe, interests:p.interests.slice()} : {vibe:null, interests:[]}; UI.editingPrefs = true; UI.prefStep = 'vibe'; renderPhone(); break; }
    case 'cancelEdit': UI.editingPrefs = false; UI.dir = 'back'; renderPhone(); break;
    case 'continueNow': D({type:'BEGIN_MATCHING'}); break;
    case 'selectGame': if (!G[d.g].playable) { UI.modal = 'soon'; UI.soonGame = d.g; renderPhone(); break; } D({type:'SELECT_GAME', game:d.g}); break;
    case 'backToMatches': D({type:'BACK_TO_MATCHES'}); break;
    case 'openReady': D({type:'OPEN_READY', game:s.selectedGame}); break;
    case 'imReady': D({type:'SET_READY', id:UI.me}); beep(660, .08); break;
    case 'startGame': D({type:'START_GAME'}); beep(523, .1); break;
    case 'buzz': {
      const g = s.gameSession; if (!g || g.phase !== 'listen' || g.buzz[UI.me] !== undefined) break;
      const btn = document.getElementById('buzzBtn'); if (btn) btn.classList.add('pressed');
      // buzz time is measured on this phone from when it saw the round start (device clocks are never compared)
      const t = +Math.max(0.1, (performance.now() - UI.listenLocal) / 1000).toFixed(1);
      beep(990, .07); setTimeout(() => D({type:'BUZZ', id:UI.me, t}), 140); break; }
    case 'pickAns': if (!UI.submitting) { UI.ans = +d.v; renderPhone(); } break;
    case 'confirmAns': {
      if (UI.ans === null || UI.submitting) break;
      UI.submitting = true; renderPhone();
      const ans = UI.ans, round = shared().gameSession.round;
      UI.myAns[round] = ans; try { sessionStorage.setItem('playmode_myans', JSON.stringify(UI.myAns)); } catch (e) {}
      // private until the reveal: the answer is sealed for the TV; other phones only see "answered"
      Sealed.send({t:'answer', id:UI.me, round, ans}).then(() => {
        UI.submitting = false; const g = shared().gameSession;
        if (g && g.phase === 'listen' && g.round === round) D({type:'LOCK', id:UI.me, sealed:true, t:g.buzz[UI.me]}); else renderPhone(); });
      break; }
    case 'lookTV': { const f = document.getElementById('tvFrame'); if (f) { f.classList.add('attn'); f.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(() => f.classList.remove('attn'), 1600); } else toast('Look up — the reveal is on the TV'); break; }
    case 'tryAnother': D({type:'TRY_ANOTHER'}); break;
    case 'playAgain': D({type:'PLAY_AGAIN'}); break;
    case 'homeEnd': UI.modal = 'leave'; renderPhone(); break;
    case 'confirmLeave': case 'leaveNow': {
      UI.modal = null; stopClip();
      if (isHost()) { closeRoomConfirmed(); break; }
      D({type:'LEAVE', id:UI.me}); resetLocalRoomUI(); UI.screen = UI.controller ? 'join' : 'home'; UI.hist = []; UI.dir = 'fade';
      if (UI.controller && !UI.fixedSeat) { Presence.leave(); UI.me = null; try { localStorage.removeItem('playmode_me'); } catch (e) {} }
      renderPhone(); toast('You left the room'); break; }
    case 'closeConfirm': UI.modal = null; stopClip(); closeRoomConfirmed(); break;
    case 'leave': UI.modal = isHost() ? 'leave' : 'leave'; renderPhone(); break;
    case 'stay': UI.modal = null; renderPhone(); break;
    case 'sheet': UI.sheet = d.s; if (d.s === 'tvcode') { UI.tvcode = ''; UI.tvcodeErr = false; } renderPhone();
      break;
    case 'closeSheet': UI.sheet = null; renderPhone(); break;
    case 'qrTV': UI.sheet = null; connectTV(); break;
    case 'tvcodeGo': if (normalizeCode(UI.tvcode) !== TV_PAIR_CODE) { UI.tvcodeErr = true; renderPhone(); beep(220, .15); } else { UI.sheet = null; connectTV(); } break;
    case 'toast': toast(d.msg, true); break;
    case 'codeRetry': UI.code = ''; UI.codeErr = false; renderPhone(); setTimeout(() => { const c = document.getElementById('cb0'); if (c) c.focus(); }, 50); break;
    case 'qrSuccess': beep(990, .08); UI.screen = 'join'; joinRoom(roomCode() || DEMO_ROOM_CODE); break;
    case 'pickSeat': UI.seat = d.v; renderPhone(); break;
    case 'seatBack': UI.screen = 'join'; UI.dir = 'back'; UI.seat = null; renderPhone(); break;
    case 'joinSeat': { if (!UI.seat) break; const n = cleanName((document.getElementById('nameInput') || {}).value || UI.nameDraft); takeSeat(UI.seat, n || seatName(UI.seat)); break; }
    case 'joinRoom': joinRoom(); break;
    case 'soonPlayFN': UI.modal = null; D({type:'OPEN_READY', game:'firstnotes'}); break;
    case 'soonBack': UI.modal = null; UI.soonGame = null; renderPhone(); break;
    case 'gameMenu': UI.modal = isHost() ? 'gmenu' : 'leave'; renderPhone(); break;
    case 'endRound': UI.modal = null; D({type:'END_ROUND_EARLY'}); break;
    case 'backToRecs': UI.modal = null; D({type:'BACK_TO_RECS'}); break;
    case 'resumeGame': D({type:'RESUME_GAME'}); break;
    case 'nextRound': D({type:'NEXT_ROUND'}); break;
    case 'closeAsk': UI.modal = 'close2'; renderPhone(); break;
    case 'reconnect': UI.discon = 'trying'; renderPhone(); setTimeout(() => { UI.discon = 'back'; renderPhone(); D({type:'RESUME'}); setTimeout(() => { UI.discon = null; renderPhone(); }, 1400); }, 1300); break;
  }
});
document.addEventListener('keydown', e => {
  if (!app) return;
  if ((e.key === ' ' || e.key === 'Enter') && currentScreen() === 'listen' && document.activeElement.tagName !== 'BUTTON' && document.activeElement.tagName !== 'SELECT') { const b = document.getElementById('buzzBtn'); if (b && !b.disabled) { e.preventDefault(); b.click(); } }
  if (e.key === 'Escape') { if (UI.modal) { UI.modal = null; renderPhone(); } else if (UI.sheet) { UI.sheet = null; renderPhone(); } }
});
