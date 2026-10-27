/* PLAYMODE · Group recommendation engine (deterministic, explainable).

   playerFit  = 0.55 × vibeFit + 0.45 × interestFit
                vibeFit     = game.vibes[player.vibe]
                interestFit = openness + (1 − openness) × bestInterestMatch   (not picking ≠ disliking)
   groupMatch = 0.75 × average(playerFit)
              + 0.15 × overlap          share of players with fit ≥ 0.70
              + 0.10 × timeFit          1 if the game fits the host's minutes
              − dissatisfaction         0.6 × Σ max(0, 0.45 − fit), capped at 0.25
              − 0.15 × spread           best fit − worst fit (rewards games that suit everyone evenly)
   Games outside min/max players are filtered out. Score is shown as a %. */

const RECO_WEIGHTS = {
  vibe: 0.55, interest: 0.45, openness: 0.35, extraInterest: 0.1, neutralInterest: 0.6,
  avg: 0.75, overlap: 0.15, time: 0.10, strongFit: 0.70,
  floor: 0.45, penalty: 0.6, penaltyCap: 0.25, spread: 0.15,
  vibeReasonMin: 0.7, interestReasonMin: 0.7
};

function playerFit(game, pref, W = RECO_WEIGHTS) {
  const vibeFit = game.vibes[pref.vibe] ?? 0;
  const picks = (pref.interests || []).filter(i => i !== 'surprise');
  let interestFit;
  if (!picks.length) interestFit = W.neutralInterest;
  else {
    const s = picks.map(i => game.interests[i] ?? 0).sort((a, b) => b - a);
    const best = Math.min(1, s[0] + W.extraInterest * s.slice(1).filter(x => x >= 0.5).length);
    interestFit = W.openness + (1 - W.openness) * best;
  }
  return W.vibe * vibeFit + W.interest * interestFit;
}

/* Aggregate, anonymous group signals (safe to show on the shared TV). */
function groupSignals(players, prefs) {
  const vibes = {}, interests = {};
  players.forEach(p => {
    const pr = prefs[p.id]; if (!pr) return;
    vibes[pr.vibe] = (vibes[pr.vibe] || 0) + 1;
    (pr.interests || []).filter(i => i !== 'surprise').forEach(i => interests[i] = (interests[i] || 0) + 1);
  });
  const sort = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
  return {vibes: sort(vibes), interests: sort(interests)};
}

function calculateGroupMatch(game, players, prefs, hostContext, W = RECO_WEIGHTS) {
  const ps = players.filter(p => prefs[p.id]);
  const n = players.length;
  if (n < game.minPlayers || n > game.maxPlayers) return {eligible:false, score:0, reasons:[`Needs ${game.minPlayers}–${game.maxPlayers} players`]};
  if (!ps.length) return {eligible:true, score:0, reasons:[]};
  const fits = ps.map(p => playerFit(game, prefs[p.id], W));
  const avg = fits.reduce((a, b) => a + b, 0) / fits.length;
  const overlap = fits.filter(f => f >= W.strongFit).length / fits.length;
  const minutes = hostContext.availableMinutes || 30;
  const timeFit = game.duration <= minutes ? 1 : 0;
  const dissatisfaction = Math.min(W.penaltyCap, fits.reduce((a, f) => a + Math.max(0, W.floor - f), 0) * W.penalty);
  const spread = Math.max(...fits) - Math.min(...fits);
  const raw = W.avg * avg + W.overlap * overlap + W.time * timeFit - dissatisfaction - W.spread * spread;
  const score = Math.round(Math.max(0, Math.min(1, raw)) * 100);

  // Reasons come from the same inputs as the score.
  const sig = groupSignals(ps, prefs), reasons = [];
  const topVibe = sig.vibes[0], topInt = sig.interests[0];
  let highlight = null;
  const goodVibe = sig.vibes.find(([v]) => (game.vibes[v] ?? 0) >= W.vibeReasonMin);
  if (goodVibe) reasons.push(goodVibe === topVibe && goodVibe[1] > 1 ? `${vibeName(goodVibe[0])} is your strongest shared vibe` : `${goodVibe[1]} of ${ps.length} chose ${vibeName(goodVibe[0])}`);
  const goodInt = sig.interests.find(([i]) => (game.interests[i] ?? 0) >= W.interestReasonMin);
  if (goodInt) { reasons.push(goodInt === topInt && goodInt[1] > 1 ? `${interestName(goodInt[0])} is a top group interest` : `${goodInt[1]} of ${ps.length} picked ${interestName(goodInt[0])}`); highlight = reasons[reasons.length - 1]; }
  reasons.push(`Fits ${n} players`);
  reasons.push(timeFit ? `Fits your ${minutes >= 45 ? '45+' : minutes} min session` : `Takes about ${game.duration} min`);
  return {eligible:true, score, reasons, highlight: highlight || reasons[0], timeFit:!!timeFit,
    detail:{avg:+avg.toFixed(3), overlap:+overlap.toFixed(2), dissatisfaction:+dissatisfaction.toFixed(3), spread:+spread.toFixed(2), fits:fits.map(f => +f.toFixed(2))}};
}

/* Sorted results: genuine top 3 first; "Want something different?" = best of other categories. */
function recommendGames(players, prefs, hostContext, exclude = []) {
  const all = Object.keys(CATALOGUE).filter(id => !exclude.includes(id))
    .map(id => ({id, cat:CATALOGUE[id].cat, ...calculateGroupMatch(CATALOGUE[id], players, prefs, hostContext)}))
    .filter(r => r.eligible).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const top = all.slice(0, 3);
  const cats = new Set(top.map(t => t.cat));
  const different = [];
  for (const r of all.slice(3)) { if (different.length === 2) break; if (!cats.has(r.cat)) { different.push(r); cats.add(r.cat); } }
  return {top, different, all};
}
