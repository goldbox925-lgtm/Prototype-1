/* PLAYMODE · Live mode (Supabase Realtime) vs Demo mode.

   LIVE  — config.js (or the in-app setup panel) holds a Supabase project URL + PUBLISHABLE key.
           The TV creates a room with a short code; phones on any network join it. Transport: Supabase Realtime
           Broadcast on the public channel "playmode-room-<code>". No database tables are needed.
   DEMO  — no Supabase configured (or ?demo in the URL). Everything runs in this browser: tabs talk over
           BroadcastChannel/localStorage. Clearly labelled "Demo mode" on every screen.

   Security: only the publishable (anon) key ever goes to the browser. Secret / service_role keys are refused. */

const LiveConfig = (() => {
  const params = new URLSearchParams(location.search);
  const cfg = Object.assign({supabaseUrl:'', supabasePublishableKey:''}, window.PLAYMODE_CONFIG || {});
  let fromSetup = false;
  // a join link from a TV that was set up in-app carries the PUBLIC connection details (URL + publishable key)
  const sb = params.get('sb');
  if (sb && (!cfg.supabaseUrl || !cfg.supabasePublishableKey)) {
    try { const j = JSON.parse(decodeURIComponent(escape(atob(sb.replace(/-/g, '+').replace(/_/g, '/'))))); if (j.u && j.k && !checkKey(j.k)) localStorage.setItem('playmode_supabase', JSON.stringify({url:j.u, key:j.k})); } catch (e) {}
  }
  if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) {
    try { const s = JSON.parse(localStorage.getItem('playmode_supabase') || 'null'); if (s && s.url && s.key) { cfg.supabaseUrl = s.url; cfg.supabasePublishableKey = s.key; fromSetup = true; } } catch (e) {}
  }
  const keyProblem = checkKey(cfg.supabasePublishableKey);
  const urlOk = /^https?:\/\/[^\s/]+/i.test(cfg.supabaseUrl || '');
  const configured = !!(urlOk && cfg.supabasePublishableKey && !keyProblem);
  return {
    url: (cfg.supabaseUrl || '').replace(/\/+$/, ''), key: cfg.supabasePublishableKey || '',
    configured, keyProblem, fromSetup,
    live: configured && !params.has('demo'),
    save(url, key) {
      const p = checkKey(key); if (p) return p;
      if (!/^https?:\/\/[^\s/]+/i.test(url)) return 'url';
      try { localStorage.setItem('playmode_supabase', JSON.stringify({url:url.trim(), key:key.trim()})); } catch (e) {}
      return null;
    },
    clear() { try { localStorage.removeItem('playmode_supabase'); } catch (e) {} }
  };
})();
/* Refuse anything that is not a publishable / anon key. */
function checkKey(k) {
  if (!k) return null;
  if (/^sb_secret_/i.test(k)) return 'secret';
  if (/^eyJ/.test(k)) {
    try { const p = JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (p.role && p.role !== 'anon') return 'service'; } catch (e) { return 'format'; }
  }
  return null;
}
const LIVE = LiveConfig.live;
const MODE = LIVE ? 'live' : 'demo';

/* Supabase JS client: loaded from a CDN only in live mode (Demo mode needs no network at all).
   If window.supabase is already present (self-hosted copy, or a test double) it is used as is. */
const SUPABASE_CDNS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js'];
let _sbClient = null, _sbLoading = null;
function loadSupabase() {
  if (_sbClient) return Promise.resolve(_sbClient);
  if (_sbLoading) return _sbLoading;
  const make = () => {
    _sbClient = window.supabase.createClient(LiveConfig.url, LiveConfig.key, {
      auth: {persistSession:false, autoRefreshToken:false, detectSessionInUrl:false},
      realtime: {params: {eventsPerSecond: 40}}});
    return _sbClient;
  };
  _sbLoading = new Promise((resolve, reject) => {
    if (window.supabase && window.supabase.createClient) return resolve(make());
    let i = 0;
    const next = () => {
      if (i >= SUPABASE_CDNS.length) return reject(new Error('Could not load the Supabase client'));
      const s = document.createElement('script'); s.src = SUPABASE_CDNS[i++]; s.async = true;
      s.onload = () => window.supabase && window.supabase.createClient ? resolve(make()) : next();
      s.onerror = next; document.head.appendChild(s);
    };
    next();
  });
  return _sbLoading;
}

/* ---------- room codes, join links, QR ---------- */
function newRoomCode() {
  const r = new Uint32Array(1); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : (r[0] = Math.floor(Math.random() * 1e9));
  return String(1000 + r[0] % 9000);
}
function appBaseURL() { return location.href.split('#')[0].split('?')[0]; }
function joinURL(code) {
  let extra = LIVE ? '' : '&demo';
  if (LIVE && LiveConfig.fromSetup) extra = '&sb=' + btoa(unescape(encodeURIComponent(JSON.stringify({u:LiveConfig.url, k:LiveConfig.key})))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${appBaseURL()}?role=player&room=${encodeURIComponent(code)}${extra}`;
}

const _qrCache = {};
/* Real, scannable QR code (vendored encoder in js/vendor/qrcode.js), drawn in the PLAYMODE navy. */
function qrSVG(text) {
  if (_qrCache[text]) return _qrCache[text];
  if (typeof PMQR !== 'function') return typeof QR !== 'undefined' ? QR : '';
  const q = PMQR(text, 'M'), n = q.getModuleCount(), m = 2, N = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return (_qrCache[text] = `<svg viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" role="img" aria-label="QR code to join the room"><rect width="${N}" height="${N}" fill="#fff"/><path d="${d}" fill="#10204A"/></svg>`);
}
const joinQR = code => qrSVG(joinURL(code || (typeof roomCode === 'function' && roomCode()) || DEMO_ROOM_CODE));

/* One id per device (live: per browser; demo: per tab, so several local tabs act as different phones). */
const DEVICE_ID = (() => {
  const store = LIVE ? localStorage : sessionStorage, k = 'playmode_device';
  try { let v = store.getItem(k); if (!v) { v = Math.random().toString(36).slice(2, 10); store.setItem(k, v); } return v; } catch (e) { return Math.random().toString(36).slice(2, 10); }
})();

/* Player names are shown on every screen and travel to other devices: keep them short and plain text. */
const cleanName = v => String(v || '').replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
