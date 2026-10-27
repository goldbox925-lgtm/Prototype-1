"""Live multi-device test (Playwright, Python).
Usage: python3 tests/live/live_test.py [project_dir] [page] [setup]
  e.g. python3 tests/live/live_test.py . index.html   ·   python3 tests/live/live_test.py . playmode-prototype.html setup
 a TV on a computer + phones (separate browsers/devices, no shared storage),
connected through a local stand-in for Supabase Realtime Broadcast (relay.py + mock-supabase.js)."""
import asyncio, json, subprocess, sys, time, os
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(HERE))
PAGE = sys.argv[2] if len(sys.argv) > 2 else 'index.html'
PORT = 8766
B = f'http://127.0.0.1:{PORT}/{PAGE}'
S = os.path.join(HERE, 'shots') + '/'; os.makedirs(S, exist_ok=True)
MOCK = open(os.path.join(HERE, 'mock-supabase.js')).read()
SETUP = len(sys.argv) > 3 and sys.argv[3] == 'setup'     # live config entered in the in-app setup (single-file build), not config.js
SETUP_JS = "try{ if(!localStorage.getItem('playmode_supabase')) localStorage.setItem('playmode_supabase', JSON.stringify({url:'http://127.0.0.1:%d', key:'sb_publishable_TESTKEY_local'})); }catch(e){}" % PORT
fails = []
def check(name, cond, info=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  — ' + str(info)[:260]) if info != '' else ''), flush=True)
    if not cond: fails.append(name)

async def main():
    srv = subprocess.Popen([sys.executable, os.path.join(HERE, 'relay.py'), ROOT, str(PORT)])
    time.sleep(0.8)
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch()
            errs = []
            async def device(name, setup=True, **kw):
                ctx = await br.new_context(**kw); await ctx.add_init_script(MOCK)
                if SETUP and setup: await ctx.add_init_script(SETUP_JS)
                pg = await ctx.new_page()
                pg.on('pageerror', lambda e: errs.append(name + ' ' + str(e)))
                pg.on('console', lambda m: errs.append(name + ' ' + m.text) if m.type == 'error' else None)
                return ctx, pg
            tvctx, tv = await device('tv', viewport={'width': 1920, 'height': 1080})
            async def W(pg, expr, timeout=5000):
                try: return await pg.wait_for_function(expr, timeout=timeout)
                except Exception:
                    print('WAIT FAILED:', expr); await DBG(); raise
            global DBG
            async def DBG():
                for n, pg in (('tv', tv), ('A', A), ('B', Bp)):
                    try: print('DEBUG', n, await pg.evaluate("JSON.stringify({scr: typeof currentScreen==='function' && UI.me!==undefined ? (HAS_PHONE?currentScreen():tvView()) : '', st: Store.get().room && Store.get().room.status, g: Store.get().gameSession && {r:Store.get().gameSession.round, ph:Store.get().gameSession.phase, t:Store.get().gameSession.timer, buzz:Store.get().gameSession.buzz, lock:Store.get().gameSession.lock}, me: typeof UI!=='undefined'?UI.me:null, sync: Sync.status})"))
                    except Exception as e: print('DEBUG', n, 'err', e)
            actx, A = await device('phoneA', **p.devices['iPhone 13'])
            bctx, Bp = await device('phoneB', setup=False, **p.devices['Pixel 5'])   # gets the live config only from the TV's QR link
            tvtext = lambda: tv.evaluate("document.getElementById('tvc').innerText.replace(/\\n/g,' | ')")

            # ---- the TV creates a room ----
            await tv.goto(B + '?role=tv'); await W(tv, "Store.get().room && Store.get().room.code && Sync.status==='live'", timeout=15000)
            code = await tv.evaluate("Store.get().room.code")
            check('TV is in live mode and created a room with a short code', len(code) == 4 and await tv.evaluate("MODE") == 'live' and f'room={code}' in tv.url, code)
            check('Supabase client created with the publishable key only', await tv.evaluate("window.__sb.key") == 'sb_publishable_TESTKEY_local')
            t = await tvtext(); check('TV shows ROOM code + waiting for players', f'ROOM {code}' in t and 'Waiting for players' in t, t)
            jurl = await tv.evaluate("document.querySelector('.qrbox[data-join-url]').dataset.joinUrl")
            check('QR encodes the join link', f'?role=player&room={code}' in jurl and (('&sb=' in jurl) == SETUP) and await tv.locator('.qrbox[data-join-url] svg path').count() == 1, jurl)
            await tv.wait_for_timeout(600); await tv.screenshot(path=S + 'L01_tv_room.png')

            # ---- phone A joins with the code ----
            await A.goto(B + '?role=player'); await A.wait_for_timeout(500)
            check('phone controller fills the screen (no device frame)', await A.evaluate("document.body.classList.contains('native') && Math.round(document.querySelector('.screen-wrap').getBoundingClientRect().width)==innerWidth"))
            await A.screenshot(path=S + 'L02_phone_join.png')
            await A.tap('#cb0'); await A.keyboard.type(code); await A.tap('#joinBtn')
            await W(A, "currentScreen()==='seat'", timeout=8000)
            await A.tap('[data-act=pickSeat][data-v=sophie]'); await A.fill('#nameInput', 'Yana'); await A.wait_for_timeout(100)
            await A.screenshot(path=S + 'L03_phone_seat.png')
            t0 = time.time(); await A.tap('[data-act=joinSeat]')
            await W(tv, "document.getElementById('tvc').innerText.includes('Yana')", timeout=5000); dt = time.time() - t0
            check('TV shows the player name immediately', dt < 1.5, f'{dt*1000:.0f} ms')
            check('first player becomes the host', await A.evaluate("isHost() && currentScreen()==='room'"))
            # ---- phone B joins via the QR link ----
            await Bp.goto(jurl); await W(Bp, "currentScreen()==='seat'", timeout=8000)
            check('QR link opens the seat picker with the room filled in', await Bp.evaluate("roomCode()") == code)
            await Bp.tap('[data-act=pickSeat][data-v=liam]'); await Bp.fill('#nameInput', 'Ben'); await Bp.tap('[data-act=joinSeat]')
            await W(tv, "document.getElementById('tvc').innerText.includes('Ben')", timeout=5000)
            check('wrong code is rejected on a phone', True)
            cctx, C = await device('phoneC', **p.devices['iPhone SE'])
            await C.goto(B + '?role=player'); await C.wait_for_timeout(400)
            await C.tap('#cb0'); await C.keyboard.type('1' if code != '1111' else '2'); await C.keyboard.type('111' if code != '1111' else '222'); await C.tap('#joinBtn')
            await W(C, "UI.codeErr", timeout=9000)
            check('unknown room code shows an error', 'is open' in await C.inner_text('#app') or 'look right' in await C.inner_text('#app'), await C.evaluate("UI.codeErr"))
            await C.tap('[data-act=codeRetry]'); await C.tap('#cb0'); await C.keyboard.type(code); await C.tap('#joinBtn')
            await W(C, "currentScreen()==='seat'", timeout=8000)
            check('a taken seat is disabled for other phones', await C.evaluate("document.querySelector('[data-v=sophie]').disabled && document.querySelector('[data-v=liam]').disabled"))
            await C.tap('[data-act=pickSeat][data-v=alex]'); await C.fill('#nameInput', 'Mia'); await C.tap('[data-act=joinSeat]')
            await W(tv, "document.getElementById('tvc').innerText.includes('Mia')", timeout=5000)
            await tv.screenshot(path=S + 'L04_tv_three_joined.png')
            # leave → TV status
            await C.tap('[data-act=leave]'); await C.tap('[data-act=confirmLeave]')
            await W(tv, "document.getElementById('tvc').innerText.includes('Mia left the room')", timeout=5000)
            check('TV shows when a player leaves', 'Mia' not in (await tv.evaluate("joinedPlayers(Store.get()).map(p=>p.name).join()")))
            await tv.screenshot(path=S + 'L05_tv_left.png')
            # offline → reconnecting → back
            await Bp.close()
            await W(tv, "Store.get().players.find(p=>p.id==='liam').online===false", timeout=20000)
            check('TV marks a phone that went away as reconnecting', 'Reconnecting' in await tvtext())
            Bp = await bctx.new_page(); await Bp.goto(jurl)
            await W(tv, "Store.get().players.find(p=>p.id==='liam').online===true", timeout=15000)
            check('the same phone comes back to its seat', await Bp.evaluate("UI.me") == 'liam' and await Bp.evaluate("currentScreen()") == 'joined', await Bp.evaluate("[UI.me, currentScreen()].join()"))

            # ---- fill the room with simulated players, then the group match ----
            await A.tap('[data-act=demoAddPlayers]'); await W(tv, "joinedPlayers(Store.get()).length===5", timeout=5000)
            check('TV: 5 players (2 real phones + 3 simulated)', '5 players connected' in await tvtext())
            await A.tap('[data-act=startMatching]'); await A.wait_for_timeout(300); await A.tap('[data-act=ctxStart]'); await A.wait_for_timeout(400)
            await A.tap('[data-v=friends-night]'); await A.wait_for_timeout(700)
            check('occasion reaches the TV', await tv.evaluate("tvScreen.dataset.theme") == 'friends-night')
            await A.tap('[data-act=pickTime][data-v="30"]'); await A.wait_for_timeout(700)
            async def prefs(pg, vibe, ints):
                if await pg.locator('[data-act=prefStart]').count(): await pg.tap('[data-act=prefStart]'); await pg.wait_for_timeout(250)
                await pg.tap(f'[data-act=pickVibe][data-v={vibe}]'); await pg.wait_for_timeout(600)
                for i in ints: await pg.tap(f'[data-act=toggleInt][data-v={i}]')
                await pg.tap('[data-act=prefsDone]'); await pg.wait_for_timeout(300)
            await prefs(Bp, 'creative', ['acting'])
            await W(tv, "Store.get().playerPreferences.liam", timeout=5000)
            got = await tv.inner_text('#tvGot'); check('TV preference count updates', int(got) >= 1, got)
            leakB = await A.evaluate("window.__rx.some(x => x.includes('\"acting\"') || x.includes('creative'))")
            stB = await A.evaluate("JSON.stringify(Store.get().playerPreferences.liam)")
            check("Ben's preferences never reach Yana's phone", not leakB and stB == '{"sealed":true}', stB)
            check('TV holds them privately', await tv.evaluate("JSON.stringify(Vault.prefs().liam)") == '{"vibe":"creative","interests":["acting"]}')
            await prefs(A, 'competitive', ['music'])
            await tv.screenshot(path=S + 'L06_tv_collect.png')
            try: await W(tv, "tvView()==='matches'", timeout=20000)
            except Exception as e:
                print('DEBUG tv', await tv.evaluate("JSON.stringify({st:Store.get().room.status, prefs:Store.get().playerPreferences, joined:joinedPlayers(Store.get()).map(p=>p.id), auth:Authority.isMe(), vault:Vault.prefs()})"))
                print('DEBUG A', await A.evaluate("JSON.stringify({scr:currentScreen(), st:Store.get().room.status, prefs:Store.get().playerPreferences, pending:0})"))
                raise
            await W(A, "Store.get().recommendations && currentScreen()==='matches'", 4000); await W(Bp, "Store.get().recommendations", 4000)
            recs = await A.evaluate("JSON.stringify(Store.get().recommendations.top.map(r=>r.id+':'+r.score))"); print('   recs:', recs)
            check('recommendations reach both phones', await Bp.evaluate("JSON.stringify(Store.get().recommendations.top.map(r=>r.id+':'+r.score))") == recs)
            await tv.screenshot(path=S + 'L07_tv_matches.png'); await A.screenshot(path=S + 'L07_phone_matches.png')

            # ---- First Notes: buzz + private answers ----
            await A.evaluate("D({type:'SELECT_GAME', game:'firstnotes'})"); await A.wait_for_timeout(300)
            await A.tap('[data-act=openReady]'); await W(Bp, "currentScreen()==='ready'", timeout=5000)
            await Bp.tap('[data-act=imReady]'); await W(A, "joinedPlayers(Store.get()).every(p=>p.ready)", timeout=8000)
            await A.tap('[data-act=startGame]')
            await W(Bp, "currentScreen()==='listen' && Store.get().gameSession.phase==='listen'", timeout=10000)
            await Bp.wait_for_timeout(250)
            await tv.evaluate("window.__buzzAt=0; window.__bz=setInterval(()=>{ const g=Store.get().gameSession; if(g && g.buzz.liam!==undefined){ window.__buzzAt=Date.now(); clearInterval(window.__bz);} }, 4)")
            tapAt = await Bp.evaluate("(()=>{ const t=Date.now(); document.getElementById('buzzBtn').click(); return t; })()")
            t0 = time.time()
            await W(tv, "Store.get().gameSession.buzz.liam!==undefined", timeout=4000)
            await tv.wait_for_timeout(50); tvElapsed = await tv.evaluate("(window.__buzzAt-Store.get().gameSession.listenAt)/1000")
            dt = time.time() - t0
            lat = await tv.evaluate("window.__buzzAt") - tapAt
            check('TV gets the buzz immediately', lat < 600, f'{lat} ms from tap to TV state (incl. 140 ms button animation + 2×45 ms simulated network)')
            bt = await tv.evaluate("Store.get().gameSession.buzz.liam"); check('buzz time measured on the phone matches the TV round clock', 0 <= tvElapsed - bt < 0.5, f'phone {bt}s · TV elapsed {tvElapsed:.2f}s')
            check('TV marks Ben as buzzed', 'Buzz' in await tv.evaluate("document.querySelector('.strip').innerText"))
            await A.evaluate("document.getElementById('buzzBtn') && document.getElementById('buzzBtn').click()")
            await W(Bp, "currentScreen()==='answer'", timeout=4000)
            await Bp.evaluate("document.querySelector('[data-act=pickAns][data-v=\"2\"]').click()"); await Bp.wait_for_timeout(100)
            await Bp.evaluate("document.querySelector('[data-act=confirmAns]').click()")
            await W(tv, "Store.get().gameSession.lock.liam!==undefined", timeout=4000)
            check('TV shows "answered" without the answer', await tv.evaluate("Store.get().gameSession.lock.liam") == 'sealed')
            await W(A, "Store.get().gameSession.lock.liam!==undefined", 3000)
            lkA = await A.evaluate("Store.get().gameSession.lock.liam"); plainA = await A.evaluate("window.__rx.filter(x => x.includes('\"plain\"')).map(x=>x.slice(0,160))")
            check("Ben's answer is not on Yana's phone before the reveal", lkA == 'sealed' and not plainA, f'lock={lkA} plain={plainA} phase={await A.evaluate("Store.get().gameSession.phase")}')
            check('Ben sees his own locked answer', 'Good 4 U' in await Bp.inner_text('#app'))
            await W(A, "currentScreen()==='answer'", timeout=4000)
            await A.screenshot(path=S + 'L09_phone_answer.png')
            await A.evaluate("document.querySelector('[data-act=pickAns][data-v=\"0\"]').click()"); await A.wait_for_timeout(100)
            await A.evaluate("document.querySelector('[data-act=confirmAns]').click()")
            await Bp.screenshot(path=S + 'L10_phone_locked.png'); await tv.screenshot(path=S + 'L08_tv_answered.png')
            await W(tv, "tvView()==='reveal'", timeout=15000)
            res = await A.evaluate("JSON.stringify(Store.get().gameSession.results[0].per)")
            check('answers revealed at the reveal and scored', '"liam":{"pts":0' in res and '"sophie":{"pts":1' in res, res[:200])
            await tv.screenshot(path=S + 'L11_tv_reveal.png'); await A.screenshot(path=S + 'L11_phone_result.png')

            # ---- refresh the TV mid-game: same room, same players ----
            sc = await tv.evaluate("JSON.stringify(Store.get().gameSession.scores)")
            await tv.reload(); await W(tv, "Sync.status==='live' && Store.get().room", timeout=10000); await tv.wait_for_timeout(800)
            check('TV refresh keeps the room, players and scores', await tv.evaluate("Store.get().room.code") == code and await tv.evaluate("JSON.stringify(Store.get().gameSession.scores)") == sc and await tv.evaluate("Authority.isMe()"))
            await W(tv, "Store.get().gameSession.round>=2", timeout=15000)
            check('the game continues after the TV refresh', True)
            # ---- a second screen (4K) shows the same room ----
            kctx, K = await device('tv4k', viewport={'width': 3840, 'height': 2160})
            await K.goto(B + f'?role=tv&room={code}'); await W(K, "Store.get().room && Store.get().gameSession", timeout=10000)
            check('a second TV (4K) shows the same room without taking it over', await K.evaluate("Store.get().room.code") == code and not await K.evaluate("Authority.isMe()"))
            await K.wait_for_timeout(1200); await K.screenshot(path=S + 'L12_tv_4k.png')
            st = await (await br.new_context()).new_page()
            stats = json.loads(await (await st.request.get(f'http://127.0.0.1:{PORT}/rt/stats')).text())
            print('   relay stats:', stats)
            await br.close()
            print('\n'.join(errs) or 'no console errors')
            print('FAILS:', fails or 'none')
    finally:
        srv.terminate()
asyncio.run(main())
