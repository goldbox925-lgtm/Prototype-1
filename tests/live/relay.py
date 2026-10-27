"""Local stand-in for Supabase Realtime Broadcast (test only).
Serves the app over HTTP and relays channel messages between separate browsers (contexts) with Server-Sent Events.
/config.js is replaced by a test config pointing at this server."""
import json, queue, sys, threading, time, os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
ROOT = sys.argv[1]; PORT = int(sys.argv[2])
subs = {}; lock = threading.Lock(); stats = {'sent': 0, 'bytes': 0, 'max': 0}
TEST_CFG = b"window.PLAYMODE_CONFIG = {supabaseUrl: 'http://127.0.0.1:%d', supabasePublishableKey: 'sb_publishable_TESTKEY_local'};" % PORT
class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path == '/config.js':
            self.send_response(200); self.send_header('Content-Type', 'application/javascript'); self.end_headers(); self.wfile.write(TEST_CFG); return
        if u.path == '/rt/stats':
            self.send_response(200); self.end_headers(); self.wfile.write(json.dumps(stats).encode()); return
        if u.path == '/rt/sub':
            topic = q['topic'][0]; cid = q['cid'][0]; qq = queue.Queue()
            with lock: subs.setdefault(topic, []).append((cid, qq))
            self.send_response(200); self.send_header('Content-Type', 'text/event-stream'); self.send_header('Cache-Control', 'no-cache'); self.end_headers()
            try:
                self.wfile.write(b': ok\n\n'); self.wfile.flush()
                while True:
                    try: m = qq.get(timeout=10)
                    except queue.Empty: m = None
                    self.wfile.write((('data: ' + m + '\n\n') if m else ': ping\n\n').encode()); self.wfile.flush()
            except Exception: pass
            finally:
                with lock: subs[topic] = [x for x in subs.get(topic, []) if x[1] is not qq]
            return
        return super().do_GET()
    def do_POST(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path == '/rt/send':
            n = int(self.headers.get('Content-Length', 0)); body = self.rfile.read(n).decode()
            topic = q['topic'][0]
            stats['sent'] += 1; stats['bytes'] += len(body); stats['max'] = max(stats['max'], len(body))
            with lock: targets = list(subs.get(topic, []))
            for cid, qq in targets: qq.put(body)
            self.send_response(200); self.end_headers(); self.wfile.write(b'ok'); return
        self.send_response(404); self.end_headers()
ThreadingHTTPServer.daemon_threads = True
ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
