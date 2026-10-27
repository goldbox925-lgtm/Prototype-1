/* PLAYMODE · Sync layer: one room, every device.

   Transport
   - LIVE: Supabase Realtime Broadcast, one public channel per room: "playmode-room-<code>" (event "msg").
   - DEMO: BroadcastChannel "playmode" + a localStorage "storage" event fallback (tabs in this browser only).

   Messages: {kind:'state', action, baseRev, state, auth}  a shared change (see Store in store.js)
             {kind:'hello'} / {kind:'snapshot', state}      a device that opens asks for the current room
             {kind:'presence', who} / {kind:'bye', who}     heartbeats → join / leave / offline status on the TV
             {kind:'sealed', data}                          private payload only the TV can read (Sealed below)

   Authority: one device runs the room (simulated players, timers, scoring, private inbox).
   LIVE: the TV that created the room.  DEMO: the first demo / host / TV tab (a localStorage lock). */

const SYNC_CHANNEL = 'playmode';
const STATE_KEY_BASE = 'playmode_state';   // demo: playmode_state · live: playmode_state_<code>
const MSG_KEY = 'playmode_msg';            // demo fallback transport
const ENGINE_KEY = 'playmode_engine';      // demo: which tab runs the room engine
let STATE_KEY = STATE_KEY_BASE;

const Sync = (() => {
  const tabId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let handlers = [], seen = new Set(), seq = 0, statusFns = [];
  let bc = null, room = null, channel = null, queue = [], status = LIVE ? 'idle' : 'local';
  const setStatus = s => { if (s === status) return; status = s; statusFns.forEach(f => { try { f(s); } catch (e) {} }); };

  function deliver(m) {
    if (!m || m.from === tabId || seen.has(m.id)) return;
    if (LIVE && m.room && room && m.room !== room) return;
    seen.add(m.id); if (seen.size > 1500) seen = new Set([...seen].slice(-700));
    handlers.forEach(h => { try { h(m); } catch (e) { console.error(e); } });
  }
  if (!LIVE) {
    try { bc = new BroadcastChannel(SYNC_CHANNEL); bc.onmessage = e => deliver(e.data); } catch (e) { bc = null; }
    window.addEventListener('storage', e => { if (e.key === MSG_KEY && e.newValue) { try { deliver(JSON.parse(e.newValue)); } catch (err) {} } });
  }

  /* LIVE: (re)connect to a room's channel. Resolves once subscribed. */
  async function connect(code) {
    if (!LIVE) { room = code; return true; }
    if (room === code && channel && status === 'live') return true;
    room = code; setStatus('connecting');
    const sb = await loadSupabase();
    if (channel) { try { await sb.removeChannel(channel); } catch (e) {} channel = null; }
    return new Promise(resolve => {
      let done = false;
      const ch = sb.channel('playmode-room-' + code, {config: {broadcast: {self: false, ack: false}}});
      ch.on('broadcast', {event: 'msg'}, msg => deliver(msg && msg.payload));
      ch.subscribe(st => {
        if (st === 'SUBSCRIBED') {
          channel = ch; setStatus('live');
          const q = queue; queue = []; q.forEach(m => ch.send({type: 'broadcast', event: 'msg', payload: m}));
          ch.send({type: 'broadcast', event: 'msg', payload: stamp({kind: 'hello'})});      // ask for the room after every (re)join
          if (!done) { done = true; resolve(true); }
        } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') {
          setStatus('offline');                                                          // supabase-js keeps retrying
          if (!done) { done = true; resolve(false); }
        }
      });
      setTimeout(() => { if (!done) { done = true; resolve(false); } }, 9000);
    });
  }
  const stamp = msg => ({...msg, from: tabId, id: tabId + ':' + (++seq), room});

  return {
    tabId, connect,
    get room() { return room; },
    get status() { return status; },
    onStatus(fn) { statusFns.push(fn); },
    send(msg) {
      const m = stamp(msg);
      if (LIVE) {
        if (channel && status === 'live') channel.send({type: 'broadcast', event: 'msg', payload: m}).catch(() => {});
        else if (room) { queue.push(m); if (queue.length > 60) queue = queue.filter(x => x.kind !== 'presence').slice(-60); }
        return;
      }
      if (bc) try { bc.postMessage(m); } catch (e) {}
      try { localStorage.setItem(MSG_KEY, JSON.stringify(m)); } catch (e) {}
    },
    on(fn) { handlers.push(fn); }
  };
})();

/* Presence: which people have a real device open (heartbeats). The TV shows join / leave / offline from this,
   and the engine simulates only seats that nobody is holding. */
const Presence = (() => {
  const seen = {}, BEAT = LIVE ? 3000 : 1500, TIMEOUT = LIVE ? 9500 : 4000;
  let me = null, iv = null;
  Sync.on(m => { if (m.kind === 'presence' && m.who) seen[m.who] = Date.now(); if (m.kind === 'bye') delete seen[m.who]; });
  const beat = () => { if (me) Sync.send({kind: 'presence', who: me}); };
  window.addEventListener('pagehide', () => { if (me && me !== 'tv') Sync.send({kind: 'bye', who: me}); });
  return {
    announce(id) { if (me === id) return; me = id; beat(); if (!iv) iv = setInterval(beat, BEAT); },
    leave() { if (me && me !== 'tv') Sync.send({kind: 'bye', who: me}); me = null; },
    get me() { return me; },
    isHuman(id) { return id === me || !!(seen[id] && Date.now() - seen[id] < TIMEOUT); }
  };
})();

/* Authority: exactly one device runs the room engine. */
const Authority = (() => {
  let candidate = false, me = false, onGain = null, liveRoom = null;
  const read = () => { try { return JSON.parse(localStorage.getItem(ENGINE_KEY) || 'null'); } catch (e) { return null; } };
  function tick() {
    if (!candidate || LIVE) return;
    const l = read(), now = Date.now();
    if (!l || l.tab === Sync.tabId || now - l.t > 3500) { try { localStorage.setItem(ENGINE_KEY, JSON.stringify({tab: Sync.tabId, t: now})); } catch (e) {} }
    const was = me; me = (read() || {}).tab === Sync.tabId;
    if (me && !was && onGain) onGain();
  }
  return {
    /* DEMO: compete for the local engine lock. */
    claim(cb) { candidate = true; onGain = cb; if (LIVE) return; tick(); setInterval(tick, 1000);
      window.addEventListener('beforeunload', () => { if (me) try { localStorage.removeItem(ENGINE_KEY); } catch (e) {} }); },
    /* LIVE: the TV that created this room (remembered on that device, so a refresh keeps the room). */
    ownRoom(code) { liveRoom = code; try { localStorage.setItem('playmode_tvroom_' + code, String(Date.now())); } catch (e) {} const was = me; me = true; if (!was && onGain) onGain(); },
    ownsRoom(code) { try { return !!localStorage.getItem('playmode_tvroom_' + code); } catch (e) { return false; } },
    isMe: () => me
  };
})();
const Leader = Authority;   // older name used by the engine

/* Sealed: private player input (preferences, answers) is encrypted for the TV only (RSA-OAEP, WebCrypto).
   Other phones relay ciphertext they cannot read; the TV shows answers only at the reveal. */
const Sealed = (() => {
  let priv = null, pubJwk = null, handlers = [], keyRoom = null;
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const subtle = window.crypto && window.crypto.subtle;
  const ALG = {name: 'RSA-OAEP', hash: 'SHA-256'};
  async function ensureKeys(code) {                         // TV / authority: one key pair per room, kept on this device
    if (!subtle) return null;
    if (pubJwk && keyRoom === code) return pubJwk;
    const k = 'playmode_key_' + (code || 'demo');
    try {
      const saved = JSON.parse(localStorage.getItem(k) || 'null');
      if (saved) { priv = await subtle.importKey('jwk', saved.priv, ALG, false, ['decrypt']); pubJwk = saved.pub; keyRoom = code; return pubJwk; }
    } catch (e) {}
    const kp = await subtle.generateKey({...ALG, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1])}, true, ['encrypt', 'decrypt']);
    priv = kp.privateKey; pubJwk = await subtle.exportKey('jwk', kp.publicKey); pubJwk.kid = Math.random().toString(36).slice(2, 8); keyRoom = code;
    try { localStorage.setItem(k, JSON.stringify({pub: pubJwk, priv: await subtle.exportKey('jwk', kp.privateKey)})); } catch (e) {}
    return pubJwk;
  }
  const deliverLocal = obj => setTimeout(() => handlers.forEach(h => { try { h(obj); } catch (e) { console.error(e); } }), 0);
  Sync.on(async m => {
    if (m.kind !== 'sealed' || !Authority.isMe()) return;
    try {
      if (m.data && priv) deliverLocal(JSON.parse(new TextDecoder().decode(await subtle.decrypt(ALG, priv, unb64(m.data)))));
      else if (m.plain) deliverLocal(m.plain);
    } catch (e) { console.warn('Sealed message could not be opened (old room key?)', e); }
  });
  return {
    ensureKeys,
    get publicKey() { return pubJwk; },
    on(fn) { handlers.push(fn); },
    /* phone → TV. Waits briefly for the TV's key; without WebCrypto (insecure page) it falls back to plain text. */
    async send(obj) {
      if (Authority.isMe()) return deliverLocal(obj);
      let jwk = null;
      for (let i = 0; i < 20 && !(jwk = (Store.get().room || {}).key); i++) await new Promise(r => setTimeout(r, 100));
      if (jwk && subtle) {
        try {
          const pub = await subtle.importKey('jwk', jwk, ALG, false, ['encrypt']);
          return Sync.send({kind: 'sealed', kid: jwk.kid, data: b64(await subtle.encrypt(ALG, pub, new TextEncoder().encode(JSON.stringify(obj))))});
        } catch (e) { console.warn('encrypt failed', e); }
      }
      Sync.send({kind: 'sealed', plain: obj});
    }
  };
})();
