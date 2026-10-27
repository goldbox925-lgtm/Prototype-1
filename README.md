# PLAYMODE — TV + phone prototype

One shared **TV screen** (instructions, questions, timer, progress, results) and every guest's **phone as a private controller** (join, preferences, Buzz, answers). It runs as a static web app: no build step, no server of its own.

- `index.html` — the app (separate files, easiest to edit)
- `playmode-prototype.html` — the same app as **one self-contained file** (rebuild with `python3 scripts/build-single-file.py`)

## Two modes

| | **Demo mode** | **Live mode** |
|---|---|---|
| When | Supabase not configured, or `?demo` in the URL | `config.js` (or the in-app setup) holds a Supabase URL + publishable key |
| Devices | Tabs in **one browser** on one computer | **Any devices on any network** (computer/TV + phones) |
| Transport | BroadcastChannel + localStorage | Supabase Realtime Broadcast |
| Room code | `7316` | A fresh 4-digit code made by the TV, e.g. `4821` |
| Label | "Demo mode · this browser only" on the TV, phone and launcher | "Live" + connection status on the TV |

Demo mode needs no network at all, so you can always click through the TV and phone screens locally.

## Roles (URL)

| URL | What it is |
|---|---|
| `?role=tv` | The **TV**. Creates the room, shows the code and a real QR code, players joining/leaving, then every shared screen. Fills any screen at 16:9 (phone-size to 4K); full-screen button, keeps the screen awake. |
| `?role=player` | A **phone controller**. Opens straight on *Join a room* → enter the code or scan the QR → *Who's playing?* (pick a seat + your name) → play. Fills the phone screen (safe areas, no zoom). |
| *(no role)* | Live mode: a launcher ("This is the TV" / "Join on this phone" + live setup). Demo mode: the one-screen demo (phone + TV side by side + facilitator panel). |
| `?role=player&room=4821` | What the TV's QR code opens: the code is filled in automatically. |
| `?role=player&id=sophie` | Demo only: a phone fixed to one seat (multi-tab testing). |
| `?demo` | Force demo mode even when Supabase is configured. `?setup` opens the launcher. |

**Host:** the first phone that joins a TV's room becomes the host (chooses the occasion and time, starts the game, can add simulated players with *Demo: Add remaining players*). Up to 5 seats: Emma, Sophie, Liam, Jess, Alex (avatars); each player can type their own name.

## Live multi-device play (Supabase Realtime)

### 1. Create the Supabase project
1. Create a project at supabase.com (the free plan is enough). **No database tables are needed** — only Realtime Broadcast is used.
2. Realtime uses **public** channels (no sign-in). If your project only allows private channels, allow public access: *Project Settings → Realtime → Settings → turn off "Private channels only" / allow public access*.

### 2. Get the two public values
| Value | Where in the dashboard | Looks like |
|---|---|---|
| `SUPABASE_URL` | Project Settings → Data API (or API) → **Project URL** | `https://abcd1234.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → **Publishable key** (the legacy **anon** key also works) | `sb_publishable_…` |

> **Never** use a secret key (`sb_secret_…`) or the `service_role` key. They would be downloaded by every browser. The app, the setup panel and `scripts/make-config.sh` refuse them.

### 3. Put them in `config.js`
```js
window.PLAYMODE_CONFIG = {
  supabaseUrl: 'https://abcd1234.supabase.co',
  supabasePublishableKey: 'sb_publishable_xxxxxxxxxxxxxxxx'
};
```
- From environment variables in a build/deploy step: `SUPABASE_URL=… SUPABASE_PUBLISHABLE_KEY=… sh scripts/make-config.sh`
- Single-file version: the same two values sit at the top of the inlined `config.js` block in `playmode-prototype.html`, or rebuild it after editing `config.js`.
- Quick test without editing files: open `?setup`, paste the URL + publishable key (saved in that browser only). The TV's QR code then carries these **public** values to the phones, so phones that scan it need no setup.

### 4. Host it on HTTPS
Put the folder on any static HTTPS host (GitHub Pages, Netlify, Vercel…). HTTPS is needed so phones can open the QR link, use the camera scanner, and encrypt their answers (WebCrypto).

### 5. Play
1. On the computer/TV: open `https://…/?role=tv` → a room code + QR appears (press the full-screen button).
2. On each phone: scan the QR with the camera app, or open `https://…/?role=player` and type the code.
3. Pick a seat and a name → the name appears on the TV at once. The first phone is the host.

### What travels where
- **Channel:** one public Broadcast channel per room, `playmode-room-<code>`, event `msg`.
- **The TV runs the room:** timers, scoring, simulated players, matching. Phones send their actions; the TV applies them in order and broadcasts the room state; phones show it (and keep their own taps on screen until the TV confirms them).
- **Private until the reveal:** preferences and answers are **encrypted on the phone for the TV only** (RSA-OAEP with a key pair the TV creates per room). Other phones only learn *that* someone answered. The TV shows the answers only at the reveal; the group match shows only anonymous counts.
- **Join / leave / offline:** phones send a heartbeat every 3 s. The TV shows "*name* left the room" on leave and "Reconnecting…" when a phone goes quiet; the same phone gets its seat back when it returns.
- **Fair buzzing:** buzz times are measured on each phone from the moment that phone saw the round start, so device clocks and network delay don't decide who was first.
- **Refresh-safe:** refreshing the TV (same URL with `&room=`) resumes the room, players and scores; a second screen opened with the same URL just shows the room.

### Limits of this prototype
- The room lives on the TV device (no database). Closing the TV tab ends the room for everyone; reopening its URL on the same device resumes it.
- Public channels: anyone who knows a room's 4-digit code could join it. Fine for a prototype; add Supabase Auth + private channels for production.
- The Supabase JS client is loaded from jsDelivr (`@supabase/supabase-js@2`, falls back to unpkg) only in live mode. To self-host it, add the UMD file before `js/live.js`; the app uses an existing `window.supabase` if present.
- Free-plan Realtime quotas comfortably cover a few groups (the TV sends about one small state update per second during a round, ~2–7 KB).

## Code map
- `config.js` — live-play settings (public values only)
- `js/live.js` — demo vs live mode, key safety checks, Supabase loader, room codes, join links, QR
- `js/vendor/qrcode.js` — QR encoder (Kazuhiko Arase, MIT)
- `js/sync.js` — transport (Supabase / BroadcastChannel), presence, which device runs the room, encrypted private messages
- `js/store.js` — the shared room state and reducer
- `js/firstnotes.js` — First Notes rounds, the room engine (timers, simulated players), the TV's private vault
- `js/phone.js` — phone screens · `js/tv.js` — TV screens · `js/app.js` — roles, boot, launcher, facilitator panel
- `js/themes.js`, `js/theme-assets.js`, `assets/themes/` — occasion themes · `js/catalogue.js`, `js/recommend.js` — games and the group-match algorithm
- `scripts/build-single-file.py` — makes `playmode-prototype.html` · `scripts/make-config.sh` — writes `config.js` from env vars
- `tests/live/` — multi-device test: a TV and phones in separate browsers, connected through a **local stand-in** for Supabase Realtime (`relay.py` + `mock-supabase.js`). Run `python3 tests/live/live_test.py . index.html` (needs Python + Playwright). It does not contact a real Supabase project — do one manual run on real devices after setting up yours.

## Demo mode details (one browser)
- One-screen demo (`index.html` with no Supabase, or `?role=demo&demo`): Emma's phone + TV + facilitator controls (jump to any state, add players, complete preferences, trigger matching, connection error, reset).
- Multi-tab: open `?role=tv`, then `?role=player` (or `?role=player&id=sophie`) in other tabs of the **same browser**; they stay in sync.
- Five participants: Emma (host), Sophie, Liam, Jess, Alex. Room code `7316`.

## Occasion themes
`OCCASION_THEMES` in `js/themes.js` is the single source of truth (phone surfaces, TV scene, decorations, intensity), applied through `--theme-*` CSS variables on both the phone and the TV, and kept through the whole session including the game.
