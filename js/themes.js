/* PLAYMODE · Occasion theme system — the single source of truth for occasion visuals.

   One choice on the host phone changes the atmosphere of the whole room:
   - Phone: rich themed background, glass surfaces, CTA, chips, progress, objects and particles (pre-game).
   - TV: a cinematic scene layer — gradient, glow zones, lighting, objects and particles.
   - Gameplay: setThemeIntensity('gameplay', 0.25) — the occasion stays only as a faint ambient layer.

   Flow: host taps an occasion → transitionToOccasionTheme(id) (instant, local) + dispatch SET_OCCASION
   + broadcast SESSION_THEME_CHANGED → every phone/TV tab renders the same theme from hostContext.occasion.
   A TV that connects or refreshes later renders the theme straight from the stored state. */

const THEME_ASSET = (occ, name) => (typeof THEME_SVGS !== 'undefined' && THEME_SVGS[occ + '/' + name]) || `assets/themes/${occ}/${name}.svg`;   // inlined in the single-file build

const OCCASION_THEMES = {
  'girls-night': {
    id: 'girls-night', label: 'Girls Night', tag: 'Laugh. Bond. Make memories.', img: 'o_girls',
    tvLine: 'Let’s find something the whole crew will love.', intensity: 0.95,
    phone: {
      background: 'linear-gradient(168deg,#FF4FA3 0%,#F05CC8 34%,#C467F0 68%,#8F6BFF 100%)',
      backgroundAlt: 'radial-gradient(70% 40% at 85% 6%,rgba(255,220,240,.65),transparent 70%),radial-gradient(60% 34% at 0% 62%,rgba(205,170,255,.55),transparent 70%),radial-gradient(80% 30% at 50% 108%,rgba(255,120,200,.6),transparent 70%)',
      surface: 'linear-gradient(150deg,rgba(255,255,255,.94),rgba(255,228,244,.86))',
      surfaceStrong: 'linear-gradient(135deg,#FFFFFF 0%,#FFE1F2 100%)',
      primary: '#FF2E8F', secondary: '#B98CFF', accent: '#FF7BC4', glow: 'rgba(255,120,205,.85)',
      text: '#FFFFFF', textMuted: 'rgba(255,240,250,.88)', ink: 'rgba(120,10,80,.45)'
    },
    tv: {
      background: 'linear-gradient(135deg,#FF4FA3 0%,#E85CD0 38%,#B46BFF 72%,#8C6BFF 100%)',
      backgroundAlt: 'radial-gradient(50% 60% at 50% 0%,rgba(255,235,248,.65),transparent 70%),radial-gradient(40% 50% at 10% 85%,rgba(255,150,210,.6),transparent 70%)',
      glow: 'rgba(255,140,215,.9)', ambientColor1: 'rgba(255,170,225,.85)', ambientColor2: 'rgba(190,150,255,.85)',
      shadow: 'rgba(120,10,90,.55)', lighting: 'glam', particleStyle: ['sparkle', 'glitter']
    },
    decorations: [
      {src: 'disco', anim: 'sway', phone: 'right:-18px;top:30px;width:76px', tv: 'right:1.5%;top:0;width:11.5cqw', hang: true},
      {src: 'heart-balloon', anim: 'float', phone: 'left:-18px;top:196px;width:66px;--r:-10deg', tv: 'left:2%;top:30%;width:8.5cqw;--r:-8deg'},
      {src: 'heart-balloon', anim: 'float2', tv: 'left:9%;top:44%;width:5.5cqw;--r:10deg;opacity:.85'},
      {src: 'cocktail', anim: 'bob', phone: 'right:-14px;bottom:118px;width:84px;--r:10deg', tv: 'right:2.5%;bottom:3%;width:10cqw;--r:8deg'},
      {src: 'cocktail', anim: 'bob2', tv: 'left:2%;bottom:3%;width:8.5cqw;--r:-10deg'},
      {src: 'sparkle', anim: 'twinkle', phone: 'left:22px;bottom:150px;width:26px', tv: 'left:16%;top:24%;width:2.6cqw'},
      {src: 'sparkle', anim: 'twinkle2', phone: 'right:64px;top:116px;width:18px', tv: 'right:18%;top:58%;width:2cqw'}
    ]
  },
  'date-night': {
    id: 'date-night', label: 'Date Night', tag: 'Fun games for two hearts.', img: 'o_date',
    tvLine: 'Let’s find something you’ll both enjoy.', intensity: 0.85,
    phone: {
      background: 'linear-gradient(168deg,#3B0A24 0%,#6E1538 38%,#A8294F 72%,#D8586F 100%)',
      backgroundAlt: 'radial-gradient(60% 34% at 90% 8%,rgba(255,170,120,.45),transparent 70%),radial-gradient(70% 36% at 0% 100%,rgba(255,110,150,.5),transparent 70%),radial-gradient(50% 24% at 20% 40%,rgba(255,190,140,.22),transparent 70%)',
      surface: 'linear-gradient(150deg,rgba(255,250,247,.95),rgba(255,226,226,.88))',
      surfaceStrong: 'linear-gradient(135deg,#FFFFFF 0%,#FFE4DD 100%)',
      primary: '#FF4F7E', secondary: '#FFB35C', accent: '#E8326F', glow: 'rgba(255,150,110,.75)',
      text: '#FFFFFF', textMuted: 'rgba(255,232,232,.86)', ink: 'rgba(40,0,15,.6)'
    },
    tv: {
      background: 'linear-gradient(135deg,#2E0719 0%,#5E1230 40%,#97244A 74%,#C9506B 100%)',
      backgroundAlt: 'radial-gradient(45% 55% at 22% 78%,rgba(255,170,110,.5),transparent 70%),radial-gradient(40% 50% at 80% 25%,rgba(255,110,150,.45),transparent 70%)',
      glow: 'rgba(255,160,120,.8)', ambientColor1: 'rgba(255,170,110,.7)', ambientColor2: 'rgba(255,90,140,.7)',
      shadow: 'rgba(40,0,15,.7)', lighting: 'candle', particleStyle: ['bokeh']
    },
    decorations: [
      {src: 'heart-glow', anim: 'pulse', phone: 'right:-24px;top:40px;width:96px;opacity:.55', tv: 'right:6%;top:9%;width:13cqw;opacity:.5;filter:blur(.15cqw)'},
      {src: 'candle', anim: 'flicker', phone: 'left:-8px;bottom:116px;width:46px', tv: 'left:3%;bottom:3%;width:5.5cqw'},
      {src: 'candle', anim: 'flicker2', phone: 'left:28px;bottom:104px;width:34px', tv: 'left:8.5%;bottom:3%;width:4cqw'},
      {src: 'wine-glass', anim: 'bob', phone: 'right:-14px;bottom:120px;width:80px;--r:8deg', tv: 'right:3%;bottom:3%;width:9cqw;--r:6deg'},
      {src: 'wine-glass', anim: 'bob2', tv: 'right:11%;bottom:3%;width:7.5cqw;--r:-6deg'},
      {src: 'rose', anim: 'sway', phone: 'left:-20px;top:186px;width:60px;--r:-18deg', tv: 'left:2%;top:26%;width:7cqw;--r:-14deg'}
    ]
  },
  'friends-night': {
    id: 'friends-night', label: 'Friends Night', tag: 'Good vibes with your crew.', img: 'o_friends',
    tvLine: 'Let’s find something everyone will enjoy.', intensity: 1,
    phone: {
      background: 'linear-gradient(168deg,#1236FF 0%,#3B4BFF 26%,#6A3BF0 55%,#B23BD8 80%,#FF4FA8 100%)',
      backgroundAlt: 'radial-gradient(60% 30% at 100% 4%,rgba(120,240,255,.6),transparent 70%),radial-gradient(70% 30% at 0% 46%,rgba(56,214,255,.35),transparent 70%),radial-gradient(80% 32% at 70% 104%,rgba(255,90,180,.75),transparent 70%)',
      surface: 'linear-gradient(150deg,rgba(255,255,255,.95),rgba(255,230,246,.87))',
      surfaceStrong: 'linear-gradient(135deg,#FFFFFF 0%,#FFE0F2 100%)',
      primary: '#FF3D9A', secondary: '#38D6FF', accent: '#7B5BFF', glow: 'rgba(56,214,255,.85)',
      text: '#FFFFFF', textMuted: 'rgba(232,240,255,.88)', ink: 'rgba(10,20,120,.5)'
    },
    tv: {
      background: 'linear-gradient(135deg,#0E2BFF 0%,#2E4BFF 30%,#5A36F0 60%,#9B34E0 85%,#E0459F 100%)',
      backgroundAlt: 'radial-gradient(40% 55% at 86% 18%,rgba(255,255,255,.35),transparent 70%),radial-gradient(45% 60% at 10% 90%,rgba(255,61,154,.55),transparent 70%),radial-gradient(40% 50% at 8% 15%,rgba(56,214,255,.5),transparent 70%)',
      glow: 'rgba(56,214,255,.95)', ambientColor1: 'rgba(56,214,255,.75)', ambientColor2: 'rgba(255,61,154,.75)',
      shadow: 'rgba(10,15,120,.6)', lighting: 'disco', particleStyle: ['confetti', 'notes', 'sparkle']
    },
    decorations: [
      {src: 'disco', anim: 'sway', phone: 'right:-20px;top:30px;width:82px', tv: 'right:1.2%;top:0;width:13cqw', hang: true, big: true},
      {src: 'drink', anim: 'bob', phone: 'right:-16px;bottom:118px;width:80px;--r:10deg', tv: 'right:3%;bottom:2.5%;width:9cqw;--r:8deg'},
      {src: 'pizza', anim: 'bob2', phone: 'left:-30px;top:400px;width:72px;--r:-22deg', tv: 'left:2.5%;bottom:3%;width:10cqw;--r:-14deg'},
      {src: 'drink', anim: 'bob2', tv: 'left:12%;bottom:2%;width:6.5cqw;--r:-6deg;opacity:.9'},
      {src: 'note-pink', anim: 'float', phone: 'left:18px;bottom:150px;width:34px;--r:-12deg', tv: 'left:4%;top:30%;width:5.5cqw;--r:-12deg'},
      {src: 'note', anim: 'float2', phone: 'right:70px;top:108px;width:24px;--r:10deg', tv: 'right:19%;top:62%;width:3.6cqw;--r:12deg'},
      {src: 'sparkle', anim: 'twinkle', phone: 'left:40px;top:120px;width:16px', tv: 'left:17%;top:20%;width:2.4cqw'}
    ]
  },
  'house-party': {
    id: 'house-party', label: 'House Party', tag: 'Bigger groups. Bigger fun.', img: 'o_party',
    tvLine: 'Let’s get the whole party playing.', intensity: 1,
    phone: {
      background: 'linear-gradient(168deg,#2A0E7A 0%,#5A1FD6 34%,#A21FD0 66%,#E02BB8 88%,#2EC8F0 120%)',
      backgroundAlt: 'radial-gradient(60% 30% at 100% 0%,rgba(46,232,255,.55),transparent 70%),radial-gradient(70% 30% at 0% 55%,rgba(255,46,200,.45),transparent 70%),radial-gradient(80% 30% at 50% 106%,rgba(46,232,255,.55),transparent 70%)',
      surface: 'linear-gradient(150deg,rgba(255,255,255,.95),rgba(240,226,255,.87))',
      surfaceStrong: 'linear-gradient(135deg,#FFFFFF 0%,#F1E2FF 100%)',
      primary: '#FF2EC8', secondary: '#2EE8FF', accent: '#9B4DFF', glow: 'rgba(255,46,200,.85)',
      text: '#FFFFFF', textMuted: 'rgba(240,230,255,.88)', ink: 'rgba(40,0,110,.6)'
    },
    tv: {
      background: 'linear-gradient(135deg,#1E0A66 0%,#4A17C8 34%,#9419CC 64%,#D822A8 84%,#1FB8E8 110%)',
      backgroundAlt: 'radial-gradient(40% 55% at 20% 20%,rgba(46,232,255,.5),transparent 70%),radial-gradient(40% 55% at 82% 28%,rgba(255,46,200,.5),transparent 70%),radial-gradient(60% 40% at 50% 105%,rgba(255,255,255,.25),transparent 70%)',
      glow: 'rgba(255,46,200,.95)', ambientColor1: 'rgba(46,232,255,.8)', ambientColor2: 'rgba(255,46,200,.8)',
      shadow: 'rgba(30,0,90,.65)', lighting: 'spotlights', particleStyle: ['confetti-heavy', 'sparkle']
    },
    decorations: [
      {src: 'disco', anim: 'sway', phone: 'right:-30px;top:30px;width:100px', tv: 'right:-1.5%;top:0;width:16cqw', hang: true, big: true},
      {src: 'disco', anim: 'sway2', tv: 'left:1.5%;top:12%;width:7cqw', hang: true},
      {src: 'party-cup', anim: 'bob', phone: 'left:-14px;bottom:118px;width:66px;--r:-10deg', tv: 'left:2.5%;bottom:3%;width:8cqw;--r:-10deg'},
      {src: 'party-cup', anim: 'bob2', tv: 'left:10.5%;bottom:2.5%;width:6cqw;--r:8deg'},
      {src: 'drink', anim: 'bob2', phone: 'right:-12px;bottom:126px;width:74px;--r:12deg', tv: 'right:3%;bottom:3%;width:8.5cqw;--r:8deg'},
      {src: 'note', anim: 'float', phone: 'left:12px;top:200px;width:30px', tv: 'left:4%;top:40%;width:4.5cqw;--r:-10deg'},
      {src: 'sparkle', anim: 'twinkle', phone: 'right:84px;top:118px;width:18px', tv: 'right:21%;top:62%;width:2.6cqw'}
    ]
  },
  'family-night': {
    id: 'family-night', label: 'Family Night', tag: 'Fun for all ages.', img: 'o_family',
    tvLine: 'Let’s find something every age can play.', intensity: 0.9,
    phone: {
      background: 'linear-gradient(168deg,#FF7A52 0%,#FF765F 26%,#FF8A86 50%,#F0609A 74%,#9B78F0 104%)',
      backgroundAlt: 'radial-gradient(60% 32% at 92% 6%,rgba(255,226,170,.6),transparent 70%),radial-gradient(70% 30% at 0% 60%,rgba(255,154,122,.45),transparent 70%),radial-gradient(80% 30% at 50% 108%,rgba(139,109,255,.55),transparent 70%)',
      surface: 'linear-gradient(150deg,rgba(255,252,246,.96),rgba(255,234,222,.9))',
      surfaceStrong: 'linear-gradient(135deg,#FFFFFF 0%,#FFE6DA 100%)',
      primary: '#FF765F', secondary: '#FF9A7A', accent: '#FF4F8B', purple: '#8B6DFF', glow: 'rgba(255,170,130,.85)',
      text: '#FFFFFF', textMuted: 'rgba(255,244,236,.92)', ink: 'rgba(120,30,20,.5)'
    },
    tv: {
      background: 'linear-gradient(135deg,#FF7448 0%,#FF765F 28%,#FF8A86 52%,#EE5C98 76%,#8B6DFF 104%)',
      backgroundAlt: 'radial-gradient(40% 60% at 88% 30%,rgba(255,226,170,.6),transparent 70%),radial-gradient(45% 55% at 12% 85%,rgba(255,154,122,.5),transparent 70%),radial-gradient(40% 50% at 50% 110%,rgba(139,109,255,.45),transparent 70%)',
      glow: 'rgba(255,190,150,.9)', ambientColor1: 'rgba(255,220,170,.8)', ambientColor2: 'rgba(255,79,139,.6)',
      shadow: 'rgba(120,30,20,.65)', lighting: 'lamp', particleStyle: ['motes', 'bokeh-soft', 'sparkle']
    },
    decorations: [
      {src: 'lamp', anim: 'glow', phone: 'right:-20px;top:36px;width:84px', tv: 'right:2%;top:14%;width:10cqw'},
      {src: 'house', anim: 'bob', phone: 'left:-18px;top:400px;width:64px;--r:-6deg', tv: 'left:2%;top:30%;width:8cqw;--r:-4deg'},
      {src: 'popcorn', anim: 'bob', phone: 'right:-12px;bottom:118px;width:76px;--r:8deg', tv: 'right:3%;bottom:3%;width:9cqw;--r:6deg'},
      {src: 'cushion', anim: 'bob2', phone: 'left:-22px;bottom:110px;width:86px;--r:-12deg', tv: 'left:2%;bottom:3%;width:11cqw;--r:-8deg'},
      {src: 'cushion', anim: 'bob', tv: 'left:11%;bottom:2%;width:7cqw;--r:10deg;filter:hue-rotate(250deg) saturate(.9)'}
    ]
  },
  'chill-night': {
    id: 'chill-night', label: 'Chill Night', tag: 'Relax and unwind together.', img: 'o_chill',
    tvLine: 'Let’s find something easy and relaxed.', intensity: 0.8,
    phone: {
      background: 'linear-gradient(172deg,#141A5C 0%,#28338E 34%,#4D4DC2 64%,#8278E6 88%,#A99BFF 104%)',
      backgroundAlt: 'radial-gradient(50% 26% at 86% 8%,rgba(230,225,255,.5),transparent 70%),radial-gradient(70% 30% at 0% 70%,rgba(111,224,255,.25),transparent 70%),radial-gradient(80% 30% at 50% 108%,rgba(200,180,255,.5),transparent 70%)',
      surface: 'linear-gradient(150deg,rgba(255,255,255,.95),rgba(232,228,255,.88))',
      surfaceStrong: 'linear-gradient(135deg,#FFFFFF 0%,#E7E2FF 100%)',
      primary: '#8C7BFF', secondary: '#6FE0FF', accent: '#B6A8FF', glow: 'rgba(170,160,255,.8)',
      text: '#FFFFFF', textMuted: 'rgba(225,228,255,.86)', ink: 'rgba(10,10,70,.6)'
    },
    tv: {
      background: 'linear-gradient(160deg,#121858 0%,#26318A 36%,#4A4CBE 66%,#7F76E2 88%,#A79AFF 100%)',
      backgroundAlt: 'radial-gradient(30% 45% at 84% 22%,rgba(230,225,255,.55),transparent 70%),radial-gradient(45% 55% at 15% 85%,rgba(111,224,255,.3),transparent 70%)',
      glow: 'rgba(190,180,255,.9)', ambientColor1: 'rgba(111,224,255,.45)', ambientColor2: 'rgba(170,150,255,.65)',
      shadow: 'rgba(10,10,70,.65)', lighting: 'moonbeam', particleStyle: ['stars']
    },
    decorations: [
      {src: 'moon', anim: 'glow', phone: 'right:-14px;top:40px;width:84px', tv: 'right:4%;top:10%;width:11cqw'},
      {src: 'cloud', anim: 'drift', phone: 'left:-30px;top:196px;width:96px;opacity:.75', tv: 'left:1%;top:26%;width:13cqw;opacity:.7'},
      {src: 'cloud', anim: 'drift2', tv: 'right:14%;top:30%;width:9cqw;opacity:.45'},
      {src: 'pillow', anim: 'bob', phone: 'left:-22px;bottom:112px;width:90px;--r:-10deg', tv: 'left:2%;bottom:3%;width:12cqw;--r:-6deg'},
      {src: 'pillow', anim: 'bob2', tv: 'left:12%;bottom:2%;width:8cqw;--r:8deg;filter:hue-rotate(-40deg)'},
      {src: 'mug', anim: 'bob', phone: 'right:-10px;bottom:120px;width:70px;--r:6deg', tv: 'right:3%;bottom:3%;width:8.5cqw;--r:4deg'},
      {src: 'star', anim: 'twinkle', phone: 'left:30px;top:120px;width:16px', tv: 'left:18%;top:16%;width:2.2cqw'},
      {src: 'star', anim: 'twinkle2', phone: 'right:90px;top:150px;width:12px', tv: 'right:24%;top:12%;width:1.6cqw'}
    ]
  }
};
/* Central colour object per occasion (camelCase keys), read by every screen through the --theme-* variables. */
const occasionThemes = {};
const OCCASION_KEY = id => id.replace(/-(\w)/g, (_, c) => c.toUpperCase());     // 'family-night' → 'familyNight'
const OCCASION_ORDER = ['girls-night', 'date-night', 'friends-night', 'house-party', 'family-night', 'chill-night'];
OCCASION_ORDER.forEach(id => { const p = OCCASION_THEMES[id].phone;
  occasionThemes[OCCASION_KEY(id)] = {id, primary:p.primary, secondary:p.secondary, accent:p.accent, purple:p.purple || p.accent, text:p.text}; });
const PHONE_THEME_DEFAULT = {primary: '#FF3F91', secondary: '#755BFF', accent: '#38C7FF', glow: 'rgba(255,63,145,.5)'};

/* sessionTheme is derived data stored in shared state so every device renders the same atmosphere. */
function deriveSessionTheme(occasion) {
  const t = OCCASION_THEMES[occasion];
  return t ? {occasion, intensity: t.intensity} : null;
}

/* ---------- central CSS variables ---------- */
function applyThemeVars(el, t) {
  const p = t ? t.phone : PHONE_THEME_DEFAULT, v = t && t.tv;
  const set = (k, val) => val ? el.style.setProperty(k, val) : el.style.removeProperty(k);
  set('--theme-primary', p.primary); set('--theme-secondary', p.secondary); set('--theme-accent', p.accent); set('--theme-glow', p.glow);
  set('--theme-bg', t && p.background); set('--theme-bg-alt', t && p.backgroundAlt);
  set('--theme-surface', t && p.surface); set('--theme-surface-strong', t && p.surfaceStrong);
  set('--theme-text', t && p.text); set('--theme-text-muted', t && p.textMuted); set('--theme-ink', t && p.ink);
  set('--theme-tv-bg', v && v.background); set('--theme-tv-bg-alt', v && v.backgroundAlt);
  set('--theme-tv-accent', v && p.secondary); set('--theme-tv-glow', v && v.glow);
  set('--theme-amb1', v && v.ambientColor1); set('--theme-amb2', v && v.ambientColor2);
  set('--theme-tv-shadow', v ? v.shadow : 'rgba(0,50,150,.45)');
  set('--theme-energy', t ? String(t.intensity) : null);
  set('--theme-purple', t && (p.purple || p.accent));
}

/* ---------- scene builders ---------- */
function _rng(seed) { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
const STAR_PATH = 'M12 0C12.9 8.6 15.4 11.1 24 12 15.4 12.9 12.9 15.4 12 24 11.1 15.4 8.6 12.9 0 12 8.6 11.1 11.1 8.6 12 0Z';

function decorationsHTML(t, kind) {
  return t.decorations.filter(d => d[kind]).map((d, i) => {
    const inner = d.src === 'disco'
      ? `<span class="th-disco ${d.big ? 'big' : ''}">${disco('thd-' + kind + i, true)}</span>`
      : `<img src="${THEME_ASSET(t.id, d.src)}" alt="" draggable="false">`;
    return `<div class="deco ${d.hang ? 'hang' : ''}" style="${d[kind]};--d:${(0.08 + i * 0.07).toFixed(2)}s"><div class="deco-i a-${d.anim}">${inner}</div></div>`;
  }).join('');
}

function particlesHTML(t, kind) {
  const tv = kind === 'tv', rnd = _rng(tv ? 17 : 5), u = tv ? 'cqw' : 'px', k = tv ? 1 : 9;
  const cols = [t.phone.primary, t.phone.secondary, t.phone.accent, '#FFFFFF', '#FFE66B'];
  let h = '';
  (t.tv.particleStyle || []).forEach(style => {
    if (style === 'confetti' || style === 'confetti-heavy') {
      const n = (style === 'confetti-heavy' ? 46 : 32) * (tv ? 1 : .45);
      for (let i = 0; i < n; i++) { const w = (.45 + rnd() * .5) * k, c = cols[Math.floor(rnd() * cols.length)];
        h += `<i class="pt conf" style="left:${rnd() * 100}%;top:${-10 - rnd() * 10}%;width:${w.toFixed(2)}${u};height:${(w * .45).toFixed(2)}${u};background:${c};animation-duration:${(9 + rnd() * 9).toFixed(1)}s,${(1.6 + rnd() * 2).toFixed(1)}s;animation-delay:${(-rnd() * 18).toFixed(1)}s,${(-rnd() * 3).toFixed(1)}s"></i>`; }
    }
    if (style === 'notes') {
      for (let i = 0; i < (tv ? 8 : 4); i++) { const w = (1.6 + rnd() * 1.4) * k;
        h += `<i class="pt note" style="left:${(4 + rnd() * 92).toFixed(1)}%;top:${(60 + rnd() * 40).toFixed(1)}%;width:${w.toFixed(1)}${u};height:${w.toFixed(1)}${u};animation-duration:${(12 + rnd() * 8).toFixed(1)}s;animation-delay:${(-rnd() * 20).toFixed(1)}s"><img src="${THEME_ASSET(t.id, i % 2 ? 'note' : 'note-pink')}" alt=""></i>`; }
    }
    if (style === 'sparkle' || style === 'glitter' || style === 'stars') {
      const n = style === 'glitter' ? (tv ? 26 : 12) : style === 'stars' ? (tv ? 40 : 22) : (tv ? 14 : 7);
      for (let i = 0; i < n; i++) { const w = (style === 'stars' ? .35 + rnd() * .7 : style === 'glitter' ? .3 + rnd() * .5 : .9 + rnd() * 1.3) * k;
        const c = style === 'stars' ? '#FFFFFF' : cols[Math.floor(rnd() * 4)];
        h += `<i class="pt ${style === 'glitter' ? 'glit' : 'spk'} ${style === 'stars' ? 'starp' : ''}" style="left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 100).toFixed(1)}%;width:${w.toFixed(2)}${u};height:${w.toFixed(2)}${u};color:${c};animation-duration:${(2.4 + rnd() * 3).toFixed(1)}s;animation-delay:${(-rnd() * 5).toFixed(1)}s">${style === 'glitter' ? '' : `<svg viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="currentColor"/></svg>`}</i>`; }
    }
    if (style === 'bokeh' || style === 'bokeh-soft' || style === 'motes') {
      const n = style === 'motes' ? (tv ? 26 : 12) : (tv ? 18 : 9);
      for (let i = 0; i < n; i++) { const w = (style === 'motes' ? .25 + rnd() * .45 : 2 + rnd() * 6) * k;
        h += `<i class="pt ${style === 'motes' ? 'mote' : style === 'bokeh' ? 'bok warm' : 'bok soft'}" style="left:${(rnd() * 100).toFixed(1)}%;top:${(20 + rnd() * 85).toFixed(1)}%;width:${w.toFixed(2)}${u};height:${w.toFixed(2)}${u};animation-duration:${(10 + rnd() * 10).toFixed(1)}s;animation-delay:${(-rnd() * 20).toFixed(1)}s"></i>`; }
    }
  });
  return h;
}

function lightingHTML(t, kind) {
  const L = t.tv.lighting;
  let h = `<div class="glowz z1"></div><div class="glowz z2"></div><div class="glowz z3"></div>`;
  if (L === 'disco' || L === 'glam') h += `<div class="rays ${L}"></div><div class="refl">${Array.from({length: kind === 'tv' ? 30 : 14}, (_, i) => { const r = _rng(i * 7 + 3); return `<i style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 100).toFixed(1)}%;animation-delay:${(-r() * 3).toFixed(1)}s"></i>`; }).join('')}</div>`;
  if (L === 'spotlights') h += [t.phone.secondary, t.phone.primary, '#FFE66B', t.phone.accent, t.phone.secondary].map((c, i) => `<i class="spot" style="--c:${c};left:${(i * 22 - 4)}%;animation-delay:${-i * 1.3}s;animation-duration:${5 + i * .7}s"></i>`).join('') + `<div class="rays disco"></div>`;
  if (L === 'candle') h += `<div class="floorglow warm"></div><div class="vign"></div>`;
  if (L === 'lamp') h += `<div class="floorglow lampg"></div><div class="lampcone"></div>`;
  if (L === 'moonbeam') h += `<div class="moonbeam"></div><div class="vign soft"></div>`;
  return h;
}

function buildThemeLayer(t, kind) {
  const p = kind === 'tv' ? 'tv' : 'ph';
  const el = document.createElement('div');
  el.className = `theme-layer ${p}-theme-layer L-${t.tv.lighting}`;
  el.dataset.occ = t.id;
  applyThemeVars(el, t);              // layer keeps its own colours, so a crossfade never repaints the outgoing theme
  el.innerHTML = `<div class="${p}-ambient"><div class="amb-bg"></div><div class="amb-alt"></div>${lightingHTML(t, kind)}<div class="amb-flash"></div></div>
    <div class="${p}-particles">${particlesHTML(t, kind)}</div>
    <div class="${p}-decorations">${decorationsHTML(t, kind)}</div>`;
  return el;
}

/* ---------- apply / transition ---------- */
function themeTargets() {
  return [document.getElementById('screenWrap'), document.getElementById('tvScreen')]
    .filter(el => el && el.offsetParent !== null);
}
/* Render `occasion` on one target (phone screen or TV). animate=false is used for first paint / refresh. */
function setTargetTheme(el, occasion, animate) {
  if (!el) return false;
  const id = OCCASION_THEMES[occasion] ? occasion : null;
  if (el._occ === id && el._themeInit) return false;
  const first = !el._themeInit; el._themeInit = true; el._occ = id;
  const t = OCCASION_THEMES[id], kind = el.id === 'tvScreen' ? 'tv' : 'phone';
  const doAnim = animate && !first;
  applyThemeVars(el, t);
  el.dataset.theme = id || '';
  el.classList.toggle('themed', !!t);
  const old = [...el.querySelectorAll(':scope > .theme-layer')];
  if (t) {
    const layer = buildThemeLayer(t, kind);
    layer.classList.add(doAnim ? 'th-enter' : 'th-instant');
    const anchor = kind === 'tv' ? el.querySelector('#tvc') : el.querySelector('#app');
    el.insertBefore(layer, anchor);
    if (doAnim) setTimeout(() => layer.classList.remove('th-enter'), 1600);
  }
  old.forEach(o => { if (doAnim) { o.classList.add('th-leave'); setTimeout(() => o.remove(), 750); } else o.remove(); });
  if (doAnim && t) { el.classList.remove('th-bloom'); void el.offsetWidth; el.classList.add('th-bloom'); clearTimeout(el._bloomT); el._bloomT = setTimeout(() => el.classList.remove('th-bloom'), 1300); }
  return true;
}
/* Called when the host picks an occasion: crossfade background, objects animate in, glow blooms — phone and TV. */
function transitionToOccasionTheme(themeId, targets) {
  (targets || themeTargets()).forEach(el => setTargetTheme(el, themeId, true));
}
/* 'pregame' = full atmosphere; 'gameplay' = faint ambient layer so the game is the dominant visual system. */
function setThemeIntensity(mode, value, el) {
  (el ? [el] : themeTargets()).forEach(t => {
    if (t.dataset.themeMode === mode) return;
    t.dataset.themeMode = mode;
    t.style.setProperty('--theme-intensity', value);
    t.classList.toggle('th-rich', true);            // themed surfaces on every screen, gameplay included
  });
}

/* ---------- TV view of the same themes (derived — OCCASION_THEMES stays the single source of truth) ---------- */
const TV_OCCASION_THEMES = Object.fromEntries(OCCASION_ORDER.map(id => { const t = OCCASION_THEMES[id]; return [id, {
  background: t.tv.background, backgroundAlt: t.tv.backgroundAlt,
  decorations: t.decorations.filter(d => d.tv).map(d => ({src: d.src, position: d.tv, anim: d.anim})),
  particles: t.tv.particleStyle, glow: t.tv.glow, lightBeams: t.tv.lighting,
  accent: t.phone.primary, secondaryAccent: t.phone.secondary
}]; }));
/* One TV component + one dynamic occasion theme: called by renderTV() from shared state (hostContext.occasion). */
function renderTVTheme(occasion, animate = true) {
  const tv = document.getElementById('tvScreen');
  return setTargetTheme(tv, occasion, animate);
}
