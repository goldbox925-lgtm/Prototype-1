/* PLAYMODE · Game catalogue, people and preference options.
   Visual fields (img / gen / cat / rounds / scoring) are unchanged from the original prototype.
   Recommendation metadata: minPlayers, maxPlayers, duration (minutes), vibes (0–1), interests (0–1). */

const CATALOGUE = {
  firstnotes:  {name:'First Notes', d:'Guess the song from the first notes.', cat:'Music', img:'g_firstnotes', rounds:5, scoring:'Points', playable:true,
                minPlayers:4, maxPlayers:8, duration:10, socialIntensity:'high',
                vibes:{competitive:1.0, playful:0.8, chill:0.3, creative:0.2}, interests:{music:1.0, trivia:0.5}},
  grouptrivia: {name:'Group Trivia', d:'Fast questions, biggest score wins.', cat:'Trivia', img:'g_trivia', rounds:5, scoring:'Points',
                minPlayers:4, maxPlayers:10, duration:15, socialIntensity:'high',
                vibes:{competitive:1.0, playful:0.7, chill:0.4, creative:0.1}, interests:{trivia:1.0, music:0.3}},
  outoftheloop:{name:'Out of the Loop', d:'Find the player without the secret word.', cat:'Voting', gen:['eye', '#B79BFF', '#6A3DF5'], rounds:4, scoring:'Voting',
                minPlayers:5, maxPlayers:10, duration:20, socialIntensity:'high',
                vibes:{playful:0.9, competitive:0.6, chill:0.3, creative:0.3}, interests:{conversation:0.7, trivia:0.2}},
  memorydrop:  {name:'Memory Drop', d:'Remember the pattern before it disappears.', cat:'Memory', img:'g_memory', rounds:5, scoring:'Points',
                minPlayers:2, maxPlayers:6, duration:10, socialIntensity:'medium',
                vibes:{competitive:0.6, chill:0.6, playful:0.5, creative:0.2}, interests:{trivia:0.3}},
  truthspark:  {name:'Truth Spark', d:'Questions that spark real conversation.', cat:'Conversation', img:'g_truth', rounds:6, scoring:'No score',
                minPlayers:3, maxPlayers:8, duration:15, socialIntensity:'high',
                vibes:{chill:1.0, creative:0.5, playful:0.4, competitive:0.0}, interests:{conversation:1.0}},
  doodledash:  {name:'Doodle Dash', d:'Draw fast, guess faster.', cat:'Drawing', img:'g_doodle', rounds:5, scoring:'Points',
                minPlayers:2, maxPlayers:8, duration:15, socialIntensity:'high',
                vibes:{playful:1.0, competitive:0.8, creative:0.9, chill:0.3}, interests:{drawing:1.0, trivia:0.3, acting:0.2}},
  hottake:     {name:'Hot Take', d:'Share bold opinions — the group votes.', cat:'Conversation', img:'g_hottake', rounds:6, scoring:'Voting',
                minPlayers:3, maxPlayers:8, duration:15, socialIntensity:'high',
                vibes:{playful:0.9, competitive:0.4, chill:0.6, creative:0.4}, interests:{conversation:1.0}},
  actitout:    {name:'Act It Out', d:'Act, mime, guess — no words allowed.', cat:'Acting', img:'g_act', rounds:5, scoring:'Points',
                minPlayers:4, maxPlayers:12, duration:15, socialIntensity:'high',
                vibes:{playful:1.0, creative:0.8, competitive:0.5, chill:0.2}, interests:{acting:1.0, conversation:0.3}},
  popculture:  {name:'Pop Culture Trivia', d:'Celebs, shows and viral moments.', cat:'Trivia', gen:['star', '#FFD27A', '#FF7AB6'], rounds:5, scoring:'Points',
                minPlayers:3, maxPlayers:10, duration:12, socialIntensity:'medium',
                vibes:{competitive:0.8, playful:0.8, chill:0.4, creative:0.1}, interests:{trivia:0.9, music:0.4, conversation:0.2}},
  familytrivia:{name:'Family Trivia', d:'Questions every age can answer.', cat:'Trivia', gen:['house', '#FFD58A', '#FF9F43'], rounds:5, scoring:'Points',
                minPlayers:3, maxPlayers:10, duration:15, socialIntensity:'medium',
                vibes:{chill:0.7, playful:0.7, competitive:0.6, creative:0.1}, interests:{trivia:0.9}},
  finishthis:  {name:'Finish This!', d:'Complete the sentence — funniest wins.', cat:'Words', gen:['quote', '#7BE7C2', '#2FB7C2'], rounds:6, scoring:'Voting',
                minPlayers:3, maxPlayers:8, duration:15, socialIntensity:'high',
                vibes:{playful:1.0, creative:0.9, chill:0.5, competitive:0.3}, interests:{conversation:0.6, acting:0.3}},
  jukebox:     {name:'Jukebox', d:'Pick songs in turn — guess who chose it.', cat:'Music', gen:['headphones', '#8FE3FF', '#7A6BFF'], rounds:6, scoring:'Relaxed',
                minPlayers:2, maxPlayers:10, duration:20, socialIntensity:'medium',
                vibes:{chill:1.0, playful:0.6, competitive:0.2, creative:0.4}, interests:{music:1.0, conversation:0.4}},
  truthish:    {name:'Truth-ish', d:'Two truths and one fib — spot it.', cat:'Conversation', gen:['mask', '#D7B8FF', '#A06BFF'], rounds:5, scoring:'Voting',
                minPlayers:3, maxPlayers:8, duration:15, socialIntensity:'high',
                vibes:{playful:0.8, chill:0.7, creative:0.4, competitive:0.3}, interests:{conversation:0.9}}
};
const G = CATALOGUE;   // short alias used by the UI templates
const playersLabel = g => `${g.minPlayers}–${g.maxPlayers}`;
const CATC = {Music:'pink', Trivia:'amber', Voting:'violet', Memory:'violet', Conversation:'pink', Drawing:'cyan', Acting:'cyan', Words:'mint'};

/* The room always has exactly FIVE participants in total — Emma (host) + four players.
   One central list: every counter ("3 of 5", "5 players connected"), avatar row, score card and result reads from it.
   In multi-tab mode each person can be a real browser tab; otherwise they are simulated. */
const participants = [
  {id:'emma',   name:'Emma',   role:'host',   avatar:'a_Emma',   color:'#FF4F91'},
  {id:'sophie', name:'Sophie', role:'player', avatar:'a_Sophie', color:'#FFB84D'},
  {id:'liam',   name:'Liam',   role:'player', avatar:'a_Liam',   color:'#38C7FF'},
  {id:'jess',   name:'Jess',   role:'player', avatar:'a_Jess',   color:'#47D7A5'},
  {id:'alex',   name:'Alex',   role:'player', avatar:'a_Alex',   color:'#B98CFF'}];
const HOST_ID = participants.find(p => p.role === 'host').id;
const CAST = participants.map(p => ({id:p.id, n:p.name, c:p.color, avatar:p.avatar}));   // short form used by the templates
const ROOM_SIZE = CAST.length;
/* A seat (avatar, colour) plus the name its player chose — names come from the shared room state. */
const person = id => {
  const c = CAST.find(p => p.id === id); if (!c) return c;
  const st = typeof Store !== 'undefined' ? Store.get() : null;
  const pl = st && st.players && st.players.find(p => p.id === id);
  return {...c, baseName:c.n, n:(pl && pl.joined && pl.name) || c.n};
};
const seatName = id => (CAST.find(p => p.id === id) || {}).n;   // fixed seat name (scripted demo data is keyed by it)

/* Personal questions (every player, host included). */
const VIBES = [
  {id:'chill', name:'Chill', d:'Relaxed and low-key', img:'v_chill'},
  {id:'playful', name:'Playful', d:'Light, funny and energetic', img:'v_fun'},
  {id:'competitive', name:'Competitive', d:'Scores, speed and rivalry', img:'v_comp'},
  {id:'creative', name:'Creative', d:'Draw, act and imagine', img:'v_crea'}];
const INTERESTS = [
  {id:'music', name:'Music', ic:'music', c:'pink'}, {id:'trivia', name:'Trivia', ic:'star', c:'amber'},
  {id:'drawing', name:'Drawing', ic:'palette', c:'cyan'}, {id:'conversation', name:'Conversation', ic:'quote', c:'violet'},
  {id:'acting', name:'Acting', ic:'mask', c:'mint'}, {id:'surprise', name:'Surprise me', ic:'sparkle', c:'lav'}];
const vibeName = id => (VIBES.find(v => v.id === id) || {}).name || id;
const interestName = id => (INTERESTS.find(i => i.id === id) || {}).name || id;

/* Host context. */
const TIMES = [10, 20, 30, 45];
const timeLabel = t => t >= 45 ? '45+ min' : t + ' min';

/* Simulated answers for players without their own tab (the film's demo group). */
const DEMO_PREFS = {
  emma:{vibe:'competitive', interests:['music']},
  sophie:{vibe:'competitive', interests:['trivia', 'music']},
  liam:{vibe:'playful', interests:['trivia']},
  jess:{vibe:'competitive', interests:['music']},
  alex:{vibe:'playful', interests:['music', 'drawing']}};
