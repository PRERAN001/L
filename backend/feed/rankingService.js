// feed/rankingService.js
//
// V11 ranking — two-stage pipeline:
//
// Stage 1: Score
//   For each candidate, compute P(like), P(comment), P(view) using hand-tuned
//   logistic models over the full v11 feature vector.  Combine into a single
//   weighted engagement score.
//
// Stage 2: Diversity re-rank (MMR)
//   Maximal Marginal Relevance on the sorted list to push semantically similar
//   posts apart, so the user sees variety even when their interest vector
//   strongly aligns with a cluster of similar posts.

const { cosineSimilarity } = require("./featureService");

// ==========================================
// SIGMOID
// ==========================================
const sigmoid = (x) => 1 / (1 + Math.exp(-x));


// ==========================================
// FEATURE TRANSFORMS
// ==========================================

// Log-compress raw counts so a post with 1000 likes doesn't swamp everything
const logNorm = (x, scale = 1) =>
  Math.log10(Math.max(x, 0) + 1) * scale;

// Age decay — the same curve as before, now used as a feature value
const ageDecay = (ageHours) =>
  40 / Math.pow(Math.max(ageHours, 0) + 0.5, 0.6);

// Source encoding → [0,1] value
const sourceScore = (source) => {
  if (source === "following")  return 1.0;
  if (source === "trending")   return 0.6;
  if (source === "exploration") return 0.3;
  return 0;
};


// ==========================================
// P(LIKE) — logistic model
//
// Positive terms: user-interest alignment (simCurrent), social signal
//   (following/self), log-engagement, recency.
// The embedding similarity is the primary personalisation signal.
// ==========================================
const pLike = (f) => {
  const z =
    -1.5                           // bias (prior like-rate ≈ 18%)

    + 3.5  * f.simCurrent          // strongest signal: matches user taste
    + 1.5  * f.simShort            // recent-session interest boost
    + 0.8  * f.simLong             // stable long-term interest

    + 0.8  * (f.isFollowingAuthor ? 1 : 0)
    + 0.4  * (f.isSelf ? 1 : 0)

    + 0.6  * logNorm(f.likes,    1)
    + 0.4  * logNorm(f.comments, 1)

    + 0.003 * ageDecay(f.postAgeHours)

    + 0.5  * sourceScore(f.source)

    // Penalise gently if we have no user embedding yet (cold start)
    - 0.3  * (1 - f.hasEmbedding);

  return sigmoid(z);
};


// ==========================================
// P(COMMENT) — typically ~3× harder than a like
// ==========================================
const pComment = (f) => {
  const z =
    -2.5

    + 3.0  * f.simCurrent
    + 1.2  * f.simShort
    + 0.6  * f.simLong

    + 0.7  * (f.isFollowingAuthor ? 1 : 0)
    + 0.3  * (f.isSelf ? 1 : 0)

    + 0.5  * logNorm(f.likes,    1)
    + 0.7  * logNorm(f.comments, 1)   // comments beget comments

    + 0.002 * ageDecay(f.postAgeHours)

    + 0.4  * sourceScore(f.source);

  return sigmoid(z);
};


// ==========================================
// P(VIEW / long-watch) — easier threshold
// ==========================================
const pView = (f) => {
  const z =
    -0.8

    + 2.0  * f.simCurrent
    + 1.0  * f.simShort

    + 0.5  * (f.isFollowingAuthor ? 1 : 0)

    + 0.4  * logNorm(f.likes,    1)
    + 0.3  * logNorm(f.comments, 1)

    + 0.005 * ageDecay(f.postAgeHours)

    + 0.3  * sourceScore(f.source);

  return sigmoid(z);
};


// ==========================================
// COMBINED ENGAGEMENT SCORE
// Weights reflect the relative value of each action.
// ==========================================
const W_LIKE    = 1.0;
const W_COMMENT = 3.0;   // commenting is much more valuable
const W_VIEW    = 0.5;

const engagementScore = (f) => {
  const pl = pLike(f);
  const pc = pComment(f);
  const pv = pView(f);

  const score =
    W_LIKE    * pl +
    W_COMMENT * pc +
    W_VIEW    * pv;

  console.log(
    `[DEBUG] [rankingService] P(like)=${pl.toFixed(3)} ` +
    `P(comment)=${pc.toFixed(3)} P(view)=${pv.toFixed(3)} ` +
    `→ score=${score.toFixed(4)}`
  );

  return score;
};


// ==========================================
// EXPLORATION BOOST
// Give a small lift to new posts with low engagement to protect cold-start.
// ==========================================
const explorationBoost = (f) => {
  const isNew        = f.postAgeHours < 2;
  const hasLowSignal = f.likes < 5 && f.comments < 2;

  return isNew && hasLowSignal ? 0.15 : 0;
};


// ==========================================
// STAGE 1 — SCORE ALL CANDIDATES
// ==========================================
const scoreCandidates = (candidates) => {
  console.log(
    `[DEBUG] [rankingService] Scoring ${candidates.length} candidates (v11)`
  );

  return candidates.map((c) => {
    const base  = engagementScore(c.features);
    const boost = explorationBoost(c.features);

    // Small random jitter (±5% of score) to break ties and add feed variety
    const jitter = (Math.random() - 0.5) * 0.1 * base;

    const score = base + boost + jitter;

    console.log(
      `[DEBUG] [rankingService] Post ${c.post._id}: ` +
      `base=${base.toFixed(3)}, boost=${boost.toFixed(2)}, ` +
      `jitter=${jitter.toFixed(3)}, final=${score.toFixed(3)}`
    );

    return { ...c, score };
  });
};


// ==========================================
// STAGE 2 — MMR DIVERSITY RE-RANK
//
// Maximal Marginal Relevance:
//   MMR(d) = arg max [ λ·score(d) – (1-λ)·max_{s∈S} sim(d, s) ]
//
// where S is the set of already-selected documents.
// We use MMR_LAMBDA = 0.7 so relevance still dominates.
//
// When posts have no embedding we fall back to the plain sorted order.
// ==========================================
const MMR_LAMBDA = 0.7;

const mmrRerank = (scoredCandidates, limit) => {
  const pool     = [...scoredCandidates];   // mutable working copy
  const selected = [];

  while (selected.length < limit && pool.length > 0) {
    let bestIdx  = -1;
    let bestMmr  = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];

      // Relevance term
      const relevance = candidate.score;

      // Redundancy term — max cosine similarity to already-selected posts
      let maxSim = 0;

      if (selected.length > 0 && candidate.features.hasEmbedding) {
        const candEmb = candidate.post.embedding;

        for (const sel of selected) {
          if (!sel.features.hasEmbedding) continue;

          const sim = cosineSimilarity(candEmb, sel.post.embedding);
          if (sim > maxSim) maxSim = sim;
        }
      }

      const mmr =
        MMR_LAMBDA * relevance -
        (1 - MMR_LAMBDA) * maxSim;

      if (mmr > bestMmr) {
        bestMmr  = mmr;
        bestIdx  = i;
      }
    }

    if (bestIdx === -1) break;

    selected.push(pool[bestIdx]);
    pool.splice(bestIdx, 1);
  }

  console.log(
    `[DEBUG] [rankingService] MMR re-rank: ${scoredCandidates.length} → ${selected.length} posts`
  );

  return selected;
};


// ==========================================
// PUBLIC — rankCandidates
// Drop-in replacement for the old function; now returns MMR-diversified list.
// ==========================================
const rankCandidates = (candidates, limit = candidates.length) => {
  const scored      = scoreCandidates(candidates);
  const sorted      = scored.sort((a, b) => b.score - a.score);
  const diversified = mmrRerank(sorted, limit);

  console.log(
    `[DEBUG] [rankingService] Top post: ${diversified[0]?.post?._id} ` +
    `score=${diversified[0]?.score?.toFixed(3)}`
  );

  return diversified;
};


// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  rankCandidates,
  engagementScore,
  pLike,
  pComment,
  pView,
  mmrRerank,
  scoreCandidates,
};
