/* PLAYMODE · App shell: roles, wiring, facilitator panel, layout.
   index.html                       → demo: Emma's phone + TV side by side, other players simulated (film / usability tests)
   ?role=host&id=emma               → host phone only (runs the room engine)
   ?role=player&id=sophie|liam|jess → one player's phone
   ?role=tv                         → TV only (shared screen) */

const params = new URLSearchParams(location.search);
/* Roles: tv · player (phone controller) · demo (phone + TV + facilitator on one page) · host (demo host phone) · launch.
   LIVE mode offers tv / player / launch; the one-page demo is available with ?demo. */
let ROLE = params.get('role') || (params.has('setup') || LIVE ? 'launch' : 'demo');
if (LIVE && !['tv', 'player', 'launch'].includes(ROLE)) ROLE = ROLE === 'host' ? 'player' : 'launch';
if (!['tv', 'player', 'demo', 'host', 'launch'].includes(ROLE)) ROLE = 'demo';
const ROLE_ID = (params.get('id') || '').toLowerCase();
const HAS_PHONE = ['demo', 'host', 'player'].includes(ROLE), HAS_TV = ROLE === 'demo' || ROLE === 'tv';
const AUTHORITY = LIVE ? ROLE === 'tv' : ['demo', 'host', 'tv'].includes(ROLE);
document.body.classList.add('view-' + (ROLE === 'demo' ? 'demo' : ROLE === 'tv' ? 'tv' : ROLE === 'launch' ? 'launch' : 'phone'), 'mode-' + MODE);

UI.controller = ROLE === 'player';
UI.fixedSeat = !LIVE && !!person(ROLE_ID);            // demo multi-tab links: ?role=player&id=sophie
UI.me = UI.fixedSeat ? ROLE_ID : ROLE === 'player' ? null : (person(ROLE_ID) ? ROLE_ID : HOST_ID);
UI.role = ROLE === 'player' ? 'player' : 'host';
if (UI.controller) { UI.screen = 'join'; UI.code = normalizeCode(params.get('room') || ''); }
try { UI.myAns = JSON.parse(sessionStorage.getItem('playmode_myans') || '{}'); } catch (e) {}

/* LIVE rooms: open a room's channel and wait for the TV to answer with the room. */
const LiveRoom = (() => {
  let heard = false;
  Sync.on(m => { if (m.kind === 'snapshot' || (m.kind === 'state' && m.auth) || m.kind === 'presence') heard = true; });
  const waitFor = (test, ms) => new Promise(res => {
    if (test()) return res(true);
    const un = Store.subscribe(() => { if (test()) { un(); clearTimeout(t); res(true); } });
    const t = setTimeout(() => { un(); res(test()); }, ms);
  });
  return {
    async open(code) {
      Store.useRoom(code);
      const ok = await Sync.connect(code); if (!ok) return 'offline';
      const found = await waitFor(() => { const r = Store.get().room; return !!(r && r.code === code && heard); }, 4500);
      return found ? true : 'missing';
    },
    /* the TV picks a code nobody is using right now */
    async freshCode() {
      for (let i = 0; i < 4; i++) {
        const c = newRoomCode(); heard = false;
        if (!(await Sync.connect(c))) return c;
        await new Promise(r => setTimeout(r, 1200));
        if (!heard) return c;
      }
      return newRoomCode();
    }
  };
})();

/* ---------- wiring: store ⇄ sync ⇄ views ---------- */
let lastIntroAt = 0;
function maybeIntro(s, occasion) {
  if (!HAS_TV || !s.room || !s.room.tvConnected) return;
  if (Date.now() - lastIntroAt < 800) return;
  lastIntroAt = Date.now(); playThemeIntro(occasion);
}
Store.subscribe((s, a) => {
  if (a.type === 'CLOSE_ROOM') {            // confirmed close: every device drops the session and returns to its start screen
    try { localStorage.removeItem(STATE_KEY); localStorage.removeItem(MSG_KEY); localStorage.removeItem('playmode_me'); sessionStorage.removeItem('playmode_myans'); } catch (e) {}
    UI.myAns = {}; UI.myPrefs = null;
    if (HAS_PHONE) { resetLocalRoomUI(); UI.screen = UI.controller ? 'join' : 'home'; UI.hist = []; UI.discon = null; if (UI.controller && !UI.fixedSeat) { Presence.leave(); UI.me = null; } }
    if (HAS_TV) stopClip();
    if (ROLE === 'tv' && (!LIVE || Authority.isMe())) setTimeout(() => ensureTVRoom(true, LIVE ? Sync.room : DEMO_ROOM_CODE), 600);   // the TV keeps its room code open for the next group
  }
  if (HAS_PHONE) { if (['RESET', 'LOAD', 'CREATE_ROOM'].includes(a.type) && !inRoom()) { UI.connectOpen = false; } patchPhone(a); }
  if (HAS_TV) { patchTV(a); if (a.type === 'SET_OCCASION') maybeIntro(s, a.occasion); }
});
Sync.on(m => {
  if (m.kind === 'state') Store.receive(m);                                   // shared room change from another tab
  if (m.kind === 'hello' && Store.get().room && (Authority.isMe() || (!LIVE && Store.get().rev))) Sync.send({kind:'snapshot', state:Store.get(), auth:Authority.isMe()});   // a device just opened: send it the room
  if (m.kind === 'snapshot') Store.adopt(m.state, !!m.auth);
  if (m.kind === 'event' && m.type === 'SESSION_THEME_CHANGED' && HAS_TV) { renderTV(); maybeIntro(Store.get(), m.occasion); }
  if (m.kind === 'event' && m.type === 'TV_CONNECTING' && HAS_TV && typeof tvConnecting === 'function') tvConnecting(m.on);
});


/* ---------- facilitator panel (demo page) ---------- */
const STATES = [
  ['home', '01 Home'], ['room', '02 Room 2048 · waiting for players'], ['connect', '03 Connect TV'], ['connError', '03b Connection error (recovery)'],
  ['joining', '04 Players joining · TV join screen'], ['allHere', '05 Everyone’s here'], ['gmintro', '06 Find your group match'],
  ['occasion', '07 Host · Occasion'], ['time', '08 Host · Time (+ TV theme)'], ['vibe', '09 Vibe'], ['interests', '10 Interests'],
  ['sent', '11 Preferences sent · 4 of 5'], ['timeout', '11b Waiting for Jess (timeout)'], ['matching', '12 Finding your group match'],
  ['matches', '13 Best Matches · 91%'], ['details', '14 Game details'], ['ready', '15 Ready'], ['countdown', '16 Start · countdown'],
  ['listen', '17 Round 1/5 · Buzz'], ['answer', '18 Answer'], ['locked', '19 Answer locked · Look at the TV'], ['reveal', '20 TV reveal + leaderboard'],
  ['round2', '21 Round 2/5 · status line'], ['final', '22 Final round'], ['winner', '23 Winner / final result'], ['next', '24 Next Match'],
  ['join', '25 Join a room (code)'], ['joinErr', '25b Invalid room code'], ['games', '26 Browse games'], ['discon', '27 Player lost connection'], ['leave', '28 Leave room modal']];
const SCREEN_LABEL = {home:'Home', games:'Browse games', gdetails:'Game details (browse)', join:'Join a room', roomtab:'Room tab', room:'Room 2048', connect:'Connect TV', joined:'You’re in', waitHost:'Host is setting up',
  gmintro:'Find your group match', occasion:'Occasion', time:'Time', vibe:'Vibe', interests:'Interests', sent:'Preferences sent', matching:'Finding your group match',
  matches:'Best Matches', nextMatch:'Next Match', details:'Game details', ready:'Ready', listen:'Round · Buzz', answer:'Answer', locked:'Answer locked · Look at the TV', result:'Round result', final:'Final result'};
const TV_LABEL = {idle:'waiting for a phone', join:'join the room', collect:'preferences x of n', matching:'matching animation', matches:'best matches', next:'next match', ready:'ready', intro:'round intro', round:'active round', reveal:'reveal + leaderboard', winner:'winner'};

function buildState(steps) {
  let st = initialShared(); const now = Date.now();
  steps.forEach(a => { st = reduce(st, Object.assign({at:now}, a)); });
  return st;
}
function roundsPlayed(n, extra = []) {
  const steps = baseSteps('ready').concat(CAST.filter(p => p.id !== HOST_ID).map(p => ({type:'SET_READY', id:p.id})).concat([{type:'START_GAME'}]));
  for (let r = 1; r <= n; r++) {
    steps.push({type:'LISTEN_START', round:r});
    CAST.forEach(p => { steps.push({type:'BUZZ', id:p.id, t:ROUNDS[r - 1].t[p.n]}); steps.push({type:'LOCK', id:p.id, ans:simAnswer(p.id, r)}); });
    steps.push({type:'REVEAL'});
  }
  return steps.concat(extra);
}
function baseSteps(upTo) {
  const order = ['room', 'tv', 'joined', 'context', 'occasion', 'time', 'prefs', 'matching', 'matches', 'details', 'ready'];
  const all = {
    room:[{type:'CREATE_ROOM', hostId:'emma'}], tv:[{type:'CONNECT_TV'}],
    joined:CAST.filter(p => p.id !== HOST_ID).map(p => ({type:'JOIN', id:p.id})),
    context:[{type:'START_MATCHING'}], occasion:[{type:'SET_OCCASION', occasion:'friends-night', at:0}], time:[{type:'SET_TIME', minutes:30}],
    prefs:CAST.map(p => ({type:'SUBMIT_PREFS', id:p.id, ...DEMO_PREFS[p.id]})), matching:[{type:'BEGIN_MATCHING'}], matches:[{type:'SHOW_MATCHES'}],
    details:[{type:'SELECT_GAME', game:'firstnotes'}], ready:[{type:'OPEN_READY', game:'firstnotes'}]};
  return order.slice(0, order.indexOf(upTo) + 1).flatMap(k => all[k]);
}
function jump(id) {
  stopClip(); if (HAS_TV) muteTVFx(30); Engine.reset(); resetLocalRoomUI(); UI.screen = 'home'; UI.hist = []; UI.discon = null; UI.toast = null;
  const load = st => Store.dispatch({type:'LOAD', state:st});
  const D = a => Store.dispatch(a);
  const prefsOf = ids => ids.map(i => ({type:'SUBMIT_PREFS', id:i, ...DEMO_PREFS[i]}));
  switch (id) {
    case 'home': load(initialShared()); break;
    case 'room': load(buildState(baseSteps('room'))); break;
    case 'connect': UI.connectOpen = true; load(buildState(baseSteps('room'))); break;
    case 'connError': UI.connectOpen = true; UI.connErr = true; load(buildState(baseSteps('room'))); break;
    case 'joining': load(buildState(baseSteps('tv'))); break;
    case 'allHere': load(buildState(baseSteps('joined'))); break;
    case 'gmintro': UI.step = 'intro'; load(buildState(baseSteps('context'))); break;
    case 'occasion': UI.step = 'occasion'; load(buildState(baseSteps('context'))); break;
    case 'time': UI.step = 'occasion'; load(buildState(baseSteps('context'))); setTimeout(() => { D({type:'SET_OCCASION', occasion:'friends-night'}); Sync.send({kind:'event', type:'SESSION_THEME_CHANGED', occasion:'friends-night'}); UI.step = 'time'; renderPhone(); }, 300); break;
    case 'vibe': UI.prefStep = 'vibe'; UI.waitSince = Date.now(); load(buildState(baseSteps('time'))); break;
    case 'interests': UI.prefStep = 'interests'; UI.draft = {vibe:'competitive', interests:[]}; UI.waitSince = Date.now(); load(buildState(baseSteps('time'))); break;
    case 'sent': UI.prefStep = 'done'; UI.waitSince = Date.now(); Engine.hold('jess', true); load(buildState(baseSteps('time').concat(prefsOf(['sophie', 'emma', 'liam', 'alex'])))); setTimeout(() => Engine.hold('jess', false), 50); setTimeout(() => { const s = Store.get(); if (s.room && s.room.status === 'collecting' && !s.playerPreferences.jess) D({type:'SUBMIT_PREFS', id:'jess', ...DEMO_PREFS.jess}); }, 3200); break;
    case 'timeout': UI.prefStep = 'done'; UI.waitSince = Date.now() - 8000; Engine.hold('jess', true); load(buildState(baseSteps('time').concat(prefsOf(['sophie', 'emma', 'liam', 'alex'])))); break;
    case 'matching': load(buildState(baseSteps('time').concat(prefsOf(CAST.map(p => p.id))))); setTimeout(() => D({type:'BEGIN_MATCHING'}), 50); break;
    case 'matches': load(buildState(baseSteps('matches'))); break;
    case 'details': load(buildState(baseSteps('details'))); break;
    case 'ready': load(buildState(baseSteps('details'))); setTimeout(() => D({type:'OPEN_READY', game:'firstnotes'}), 50); break;
    case 'countdown': load(buildState(baseSteps('ready').concat(CAST.filter(p => p.id !== HOST_ID).map(p => ({type:'SET_READY', id:p.id}))))); setTimeout(() => D({type:'START_GAME'}), 50); break;
    case 'listen': load(buildState(roundsPlayed(0))); setTimeout(() => D({type:'LISTEN_START', round:1}), 50); break;
    case 'answer': load(buildState(roundsPlayed(0))); setTimeout(() => { D({type:'LISTEN_START', round:1}); D({type:'BUZZ', id:'emma', t:1.8}); }, 50); break;
    case 'locked': load(buildState(roundsPlayed(0))); setTimeout(() => { D({type:'LISTEN_START', round:1}); D({type:'BUZZ', id:'emma', t:1.8}); D({type:'LOCK', id:'emma', ans:0, t:1.8}); }, 50); break;
    case 'reveal': { const st = buildState(roundsPlayed(0, [{type:'LISTEN_START', round:1}].concat(CAST.flatMap(p => [{type:'BUZZ', id:p.id, t:ROUNDS[0].t[p.n]}, {type:'LOCK', id:p.id, ans:simAnswer(p.id, 1)}])))); load(st); setTimeout(() => D({type:'REVEAL'}), 50); break; }
    case 'round2': load(buildState(roundsPlayed(1))); setTimeout(() => D({type:'ROUND_INTRO', round:2}), 50); break;
    case 'final': load(buildState(roundsPlayed(4))); setTimeout(() => D({type:'ROUND_INTRO', round:5}), 50); break;
    case 'winner': load(buildState(roundsPlayed(5, [{type:'FINISH'}]))); break;
    case 'next': load(buildState(roundsPlayed(5, [{type:'FINISH'}, {type:'TRY_ANOTHER'}]))); break;
    case 'join': load(initialShared()); UI.screen = 'join'; UI.hist = ['home']; UI.code = DEMO_ROOM_CODE.slice(0, 3); renderPhone(); break;
    case 'joinErr': load(initialShared()); UI.screen = 'join'; UI.hist = ['home']; UI.code = '2049'; UI.codeErr = 'bad'; renderPhone(); break;
    case 'games': load(initialShared()); UI.screen = 'games'; UI.hist = ['home']; renderPhone(); break;
    case 'discon': load(buildState(roundsPlayed(1))); setTimeout(() => { D({type:'LISTEN_START', round:2}); setTimeout(simulateDisconnect, 900); }, 50); break;
    case 'leave': load(buildState(roundsPlayed(1))); setTimeout(() => { D({type:'LISTEN_START', round:2}); UI.modal = 'leave'; renderPhone(); }, 50); break;
  }
  if (HAS_TV) renderTV(true);
}
/* Facilitator controls (prototype testing only) — all go through the shared store, so every tab follows. */
function facilitator(k) {
  const s = Store.get(), D = a => Store.dispatch(a);
  const completePrefs = () => joinedPlayers(Store.get()).filter(p => !Store.get().playerPreferences[p.id]).forEach(p => D({type:'SUBMIT_PREFS', id:p.id, ...DEMO_PREFS[p.id]}));
  switch (k) {
    case 'reset': jumpSel.value = 'home'; jump('home'); break;
    case 'create': stopClip(); resetLocalRoomUI(); UI.screen = 'home'; D({type:'CREATE_ROOM', hostId:'emma'}); break;
    case 'tv': if (!s.room) D({type:'CREATE_ROOM', hostId:'emma'}); UI.connectOpen = false; D({type:'CONNECT_TV'}); renderPhone(); break;
    case 'players': if (!s.room) D({type:'CREATE_ROOM', hostId:'emma'}); demoAddPlayers(); break;
    case 'prefs': {
      if (!s.room) return;
      if (s.room.status === 'lobby') D({type:'START_MATCHING'});
      if (!Store.get().hostContext.occasion) D({type:'SET_OCCASION', occasion:'friends-night'});
      if (Store.get().room.status === 'context') D({type:'SET_TIME', minutes:30});
      UI.prefStep = 'done'; UI.editingPrefs = false; completePrefs(); break; }
    case 'match': facilitator('prefs'); if (Store.get().room && Store.get().room.status === 'collecting') D({type:'BEGIN_MATCHING'}); break;
    case 'err': jumpSel.value = 'connError'; jump('connError'); break;
  }
  if (HAS_PHONE) renderPhone();
}
function simulateDisconnect() { const g = Store.get().gameSession; if (!g || g.phase !== 'listen' || UI.discon) return; UI.discon = 'lost'; Store.dispatch({type:'PAUSE', id:UI.me}); beep(220, .2); }

const jumpSel = document.getElementById('jump');
function paintPanel(scr) {
  const now = document.getElementById('nowLabel'); if (!now) return;
  now.textContent = (SCREEN_LABEL[scr] || scr) + (HAS_TV ? ' · TV: ' + TV_LABEL[tvView()] : '') + (UI.modal ? ' + leave modal' : '') + (UI.discon ? ' + connection lost' : '');
  const g = Store.get().gameSession;
  document.getElementById('btnDiscon').disabled = !(g && g.phase === 'listen') || !!UI.discon;
}
if (jumpSel) {
  jumpSel.innerHTML = STATES.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('');
  jumpSel.addEventListener('change', () => { unlockAudio(); jump(jumpSel.value); });
  document.getElementById('btnDiscon').innerHTML = I('wifioff') + 'Simulate lost connection';
  document.getElementById('btnReset').innerHTML = I('refresh') + 'Reset';
  document.getElementById('btnDiscon').addEventListener('click', () => { unlockAudio(); simulateDisconnect(); renderPhone(); });
  document.getElementById('btnReset').addEventListener('click', () => { jumpSel.value = 'home'; jump('home'); });
  document.getElementById('facCode').textContent = DEMO_ROOM_CODE;
  const FAC = [['reset', 'Reset demo'], ['create', 'Create demo room'], ['tv', 'Connect TV'], ['players', 'Add remaining players'],
    ['prefs', 'Complete preferences'], ['match', 'Trigger matching'], ['err', 'Trigger connection error']];
  const fb = document.getElementById('facBtns');
  if (fb) { fb.innerHTML = FAC.map(([k, l]) => `<button class="pbtn" data-fac="${k}">${l}</button>`).join('');
    fb.addEventListener('click', e => { const b = e.target.closest('[data-fac]'); if (b) { unlockAudio(); facilitator(b.dataset.fac); } }); }
  document.getElementById('taskIc').innerHTML = I('target', '', 'width:14px;height:14px');
  document.getElementById('ctrlIc').innerHTML = I('edit', '', 'width:14px;height:14px');
  document.getElementById('tabsIc').innerHTML = I('link', '', 'width:14px;height:14px');
  const base = location.href.split('?')[0];
  document.getElementById('tabLinks').innerHTML = CAST.filter(p => p.id !== HOST_ID).map(p => ['player&id=' + p.id, p.n]).concat([['tv', 'TV only']])
    .map(([q, l]) => `<a class="pbtn" href="${base}?role=${q}" target="_blank" rel="noopener">${l}</a>`).join('');
}

/* ---------- role badge for phone-only / TV-only pages ---------- */
const badge = document.getElementById('roleBadge');
function paintBadge() {
  if (!badge) return;
  const live = LIVE ? `<span class="rb-mode live">Live</span>` : `<span class="rb-mode">Demo mode</span>`;
  badge.innerHTML = ROLE === 'tv' || ROLE === 'launch' ? '' : UI.me && person(UI.me)
    ? `${AV(UI.me, 'xs')}<span>${person(UI.me).n}’s phone${isHost() ? ' · host' : ''}</span>${live}` : `<span>Phone · not in a room yet</span>${live}`;
}

/* ---------- decor + layout (from the original prototype) ---------- */
document.getElementById('topLogo').innerHTML = LOGO('40px');
document.getElementById('topChips').innerHTML = [['tv', 'One shared experience', 'Phone + TV'], ['sparkle', 'Group match', 'A game that fits everyone'], ['heart', 'For every occasion', 'The room sets the mood'], ['room', 'Inclusive fun', 'Easy to join, all ages']]
  .map(c => `<div class="chip-top"><span class="ico">${I(c[0])}</span><div><b>${c[1]}</b><span>${c[2]}</span></div></div>`).join('');
(function decor() {
  const bg = document.getElementById('pageBg'); let h = '';
  for (let i = 0; i < 18; i++) { const s = 20 + (i * 37 % 90); h += `<i style="left:${(i * 53) % 100}%;top:${(i * 29) % 100}%;width:${s}px;height:${s}px;opacity:${.25 + (i % 4) * .12}"></i>`; }
  [[4, 40, 60], [96, 30, 44], [62, 88, 50], [30, 6, 34], [86, 70, 70]].forEach(p => h += `<b style="left:${p[0]}%;top:${p[1]}%;width:${p[2]}px;height:${p[2]}px">${I('heart', '', 'width:100%;height:100%;fill:currentColor;stroke:none')}</b>`);
  bg.innerHTML = h;
  let k = '';
  [[300, -60, 160, 'rgba(232,222,255,.8)'], [-50, 600, 180, 'rgba(255,226,238,.8)'], [280, 520, 90, 'rgba(255,255,255,.6)'], [30, 200, 60, 'rgba(255,255,255,.5)']].forEach(b => k += `<span class="bokeh" style="left:${b[0]}px;top:${b[1]}px;width:${b[2]}px;height:${b[2]}px;background:radial-gradient(circle,${b[3]},transparent 70%)"></span>`);
  document.getElementById('bokeh').innerHTML = k;
})();
/* phone-only pages on a real phone: the app fills the screen (no device frame). On a computer: the framed phone. */
const NATIVE_PHONE = () => ROLE !== 'demo' && HAS_PHONE && (window.matchMedia('(max-width: 600px)').matches || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900));
function fitPhone() {
  const box = document.getElementById('phoneScale'), ph = document.getElementById('phone');
  if (!box || !HAS_PHONE) return;
  document.body.classList.toggle('native', NATIVE_PHONE());
  if (NATIVE_PHONE()) { ph.style.transform = 'none'; box.style.width = ''; box.style.height = ''; return; }
  const narrow = window.innerWidth < 1100 || ROLE !== 'demo';
  const top = box.getBoundingClientRect().top + window.scrollY, byH = (window.innerHeight - Math.min(top, 110) - 14) / 872, byW = (window.innerWidth - 32) / 418;
  const s = Math.min(1, ROLE !== 'demo' ? Math.min(byW, (window.innerHeight - 70) / 872) : narrow ? byW : Math.max(.6, byH));
  ph.style.transform = `scale(${s})`; box.style.width = 418 * s + 'px'; box.style.height = 872 * s + 'px';
}
window.addEventListener('resize', fitPhone);
window.addEventListener('orientationchange', () => setTimeout(fitPhone, 200));
const soundBtn = document.getElementById('soundBtn');
function paintSound() { if (!soundBtn) return; soundBtn.innerHTML = I(sound ? 'vol' : 'mute'); soundBtn.setAttribute('aria-label', sound ? 'Mute TV sound' : 'Turn TV sound on'); }
if (soundBtn) soundBtn.addEventListener('click', e => { e.stopPropagation(); unlockAudio(); sound = !sound; if (!sound) stopClip(); paintSound(); });
document.addEventListener('pointerdown', unlockAudio, {once:true});

/* ---------- launcher: choose this device's role (and set up live play) ---------- */
function renderLauncher() {
  const el = document.createElement('div'); el.id = 'launcher';
  const base = appBaseURL(), q = LIVE ? '' : '&demo';
  const host = LiveConfig.url ? LiveConfig.url.replace(/^https?:\/\//, '') : '';
  el.innerHTML = `<div class="ln-card glass">
    <div class="ln-logo">${LOGO('46px')}</div><div class="ln-tag">One TV for everyone · every phone a controller</div>
    <div class="ln-mode ${LIVE ? 'live' : ''}">${LIVE ? `${I('wifi')}<span><b>Live mode</b> · Supabase Realtime · ${host}</span>` : `${I('warn')}<span><b>Demo mode</b> · Supabase isn’t configured, so screens only talk to other tabs in this browser.</span>`}</div>
    <div class="ln-roles">
      <a class="ln-role tv" href="${base}?role=tv${q}"><span class="ib cyang">${I('tv')}</span><b>This is the TV</b><small>Creates the room, shows the code + QR, questions, timer and results</small></a>
      <a class="ln-role ph" href="${base}?role=player${q}"><span class="ib pinkg">${I('room')}</span><b>Join on this phone</b><small>Enter the code from the TV · buzz and answer privately</small></a>
    </div>
    <a class="ln-demo" href="${base}?role=demo&demo">${I('play', '', 'width:14px;height:14px')}Open the one-screen demo (phone + TV side by side, simulated players)</a>
    <details class="ln-setup" ${LiveConfig.configured ? '' : 'open'}><summary>${I('edit', '', 'width:14px;height:14px')}Live play setup (Supabase)</summary>
      <p>Use your project’s <b>Project URL</b> and <b>publishable key</b> (<code>sb_publishable_…</code> or the legacy <code>anon</code> key). Never paste a secret or <code>service_role</code> key — it is refused. Saved in this browser only; for a shared deployment put the values in <code>config.js</code> (see README).</p>
      <label>Project URL<input id="lnUrl" placeholder="https://your-project.supabase.co" value="${LiveConfig.url}"></label>
      <label>Publishable key<input id="lnKey" placeholder="sb_publishable_…" value="${LiveConfig.fromSetup ? LiveConfig.key : ''}"></label>
      <div class="ln-err" id="lnErr">${LiveConfig.keyProblem ? 'The configured key is not a publishable key and was ignored.' : ''}</div>
      <div class="ln-btns"><button class="btn btn-primary sm" id="lnSave">Save &amp; use live mode</button>${LiveConfig.fromSetup ? '<button class="btn btn-glass sm" id="lnClear">Remove</button>' : ''}</div>
    </details></div>`;
  document.body.appendChild(el);
  const err = m => document.getElementById('lnErr').textContent = m;
  document.getElementById('lnSave').addEventListener('click', () => {
    const r = LiveConfig.save(document.getElementById('lnUrl').value, document.getElementById('lnKey').value);
    if (r === 'secret' || r === 'service') return err('That is a SECRET key. Only the publishable (anon) key may be used in a browser.');
    if (r === 'url') return err('Enter the Project URL, e.g. https://abcd.supabase.co');
    if (r === 'format') return err('That key doesn’t look like a Supabase key.');
    location.href = base + '?role=launch';
  });
  const cl = document.getElementById('lnClear'); if (cl) cl.addEventListener('click', () => { LiveConfig.clear(); location.href = base; });
}

/* ---------- TV extras: full screen, keep the screen awake, live status ---------- */
if (HAS_TV) {                      // a clear label on the TV: Demo mode vs Live (and its connection state)
  const mb = document.createElement('div'); mb.className = 'tv-modebadge'; mb.id = 'tvModeBadge';
  document.getElementById('tvScreen').appendChild(mb);
  const paint = () => { mb.className = 'tv-modebadge ' + (LIVE ? Sync.status : 'demo');
    mb.innerHTML = LIVE ? (Sync.status === 'live' ? '<i></i>Live' : Sync.status === 'connecting' || Sync.status === 'idle' ? '<i></i>Connecting…' : '<i></i>Reconnecting…') : '<i></i>Demo mode · this browser only'; };
  paint(); Sync.onStatus(paint);
}
if (ROLE === 'tv') {
  const fs = document.createElement('button'); fs.className = 'tv-fs'; fs.setAttribute('aria-label', 'Full screen'); fs.innerHTML = I('tv');
  fs.addEventListener('click', () => { const d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {}); else if (document.exitFullscreen) document.exitFullscreen(); });
  document.getElementById('tvScreen').appendChild(fs);
  let lock = null; const wake = async () => { try { if ('wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => lock = null); } } catch (e) {} };
  document.addEventListener('pointerdown', wake); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });
  let idle; const showCursor = () => { document.body.classList.remove('hide-cursor'); clearTimeout(idle); idle = setTimeout(() => document.body.classList.add('hide-cursor'), 3000); };
  document.addEventListener('mousemove', showCursor); showCursor();
}

/* ---------- start: load shared state → render this role → stay subscribed ---------- */
async function boot() {
  if (ROLE === 'launch') return renderLauncher();
  if (!LIVE) {                                              // DEMO: this browser only
    Store.useRoom(null);
    if (AUTHORITY) {
      Engine.start();
      Authority.claim(() => Engine.kick());
      const st = Store.get(), recent = st.room && st.updatedAt && Date.now() - st.updatedAt < 30 * 60 * 1000;
      if (!recent && Authority.isMe() && ROLE !== 'tv') Store.dispatch({type:'RESET'});
      if (ROLE === 'tv') ensureTVRoom(!recent);
    }
    Sync.send({kind:'hello'});
  } else if (ROLE === 'tv') {                               // LIVE TV: create (or resume) the room
    Engine.start();
    Authority.claim(() => Engine.kick());                   // live: authority = the TV that owns this room
    let code = normalizeCode(params.get('room') || '');
    if (code && Authority.ownsRoom(code)) { Store.useRoom(code); Authority.ownRoom(code); await Sync.connect(code); ensureTVRoom(false, code); }
    else if (code) { Store.useRoom(code); renderTV(true); await Sync.connect(code); }          // a second screen showing someone else's room
    else {
      renderTV(true);
      code = await LiveRoom.freshCode();
      history.replaceState(null, '', `?role=tv&room=${code}`);
      Store.useRoom(code); Authority.ownRoom(code); await Sync.connect(code);
      ensureTVRoom(true, code);
    }
    Sync.onStatus(() => renderTV(true));
  } else if (ROLE === 'player') {                           // LIVE phone: join by code / QR link
    Sync.onStatus(() => renderPhone());
    if (UI.code.length === 4) setTimeout(() => joinRoom(UI.code), 50);
  }
  restoreSeat();
  if (UI.me) Presence.announce(UI.me);
  if (ROLE === 'tv') Presence.announce('tv');
  fitPhone(); paintSound();
  if (HAS_PHONE) renderPhone();
  if (HAS_TV) renderTV(true);
}
/* The TV opens the room (no host yet — the first phone to join becomes the host). */
function ensureTVRoom(fresh, code) {
  const s = Store.get(), c = code || DEMO_ROOM_CODE;
  if (fresh || !roomIsOpen(s) || s.room.code !== c) Store.dispatch({type:'CREATE_ROOM', code:c, byTV:true});
  else if (!s.room.tvConnected) Store.dispatch({type:'CONNECT_TV'});
}
/* a phone that refreshes keeps its seat */
function restoreSeat() {
  if (!UI.controller || UI.fixedSeat) return;
  try { const m = JSON.parse(localStorage.getItem('playmode_me') || 'null'); const s = Store.get();
    if (m && m.mode === MODE && s.room && m.room === s.room.code) { const p = s.players.find(x => x.id === m.id); if (p && p.joined && p.device === DEVICE_ID) UI.me = m.id; } } catch (e) {}
}
boot();
