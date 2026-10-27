/* Test double for supabase-js (only the Realtime Broadcast surface PLAYMODE uses), relayed by relay.py. */
(function () {
  const LAT = 45;                                           // simulated network latency per hop (ms)
  window.__rx = [];                                         // raw payloads this device received (privacy checks)
  class Ch {
    constructor(name, cfg) { this.name = name; this.cfg = cfg || {}; this.h = []; this.cid = Math.random().toString(36).slice(2); }
    on(type, filter, cb) { if (type === 'broadcast') this.h.push({event: filter.event, cb}); return this; }
    subscribe(cb) {
      this.es = new EventSource('/rt/sub?topic=' + encodeURIComponent(this.name) + '&cid=' + this.cid);
      this.es.onopen = () => setTimeout(() => cb('SUBSCRIBED'), 20);
      this.es.onerror = () => cb('CHANNEL_ERROR');
      this.es.onmessage = e => {
        const m = JSON.parse(e.data); const self = this.cfg.config && this.cfg.config.broadcast && this.cfg.config.broadcast.self;
        if (m.cid === this.cid && !self) return;
        window.__rx.push(JSON.stringify(m.payload));
        setTimeout(() => this.h.filter(x => x.event === m.event).forEach(x => x.cb({type: 'broadcast', event: m.event, payload: m.payload})), LAT);
      };
      return this;
    }
    send(msg) { return new Promise(res => setTimeout(() => fetch('/rt/send?topic=' + encodeURIComponent(this.name), {method: 'POST', body: JSON.stringify({cid: this.cid, event: msg.event, payload: msg.payload})}).then(() => res('ok'), () => res('error')), LAT)); }
    close() { if (this.es) this.es.close(); }
  }
  window.supabase = {createClient(url, key, opts) { window.__sb = {url, key, opts}; return {channel: (n, c) => new Ch(n, c), removeChannel: ch => { ch.close(); return Promise.resolve('ok'); }}; }};
})();
