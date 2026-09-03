// services/feed/rankingService.js

// ==========================================
// 1. RECENCY SCORE
// ==========================================

const calculateRecencyScore = (postAgeHours) => {
  const age = Math.max(0, postAgeHours);
  // Softer decay: Age ≈ 0 -> ~46 pts, Age = 1h -> ~24 pts, Age = 24h -> ~4 pts
  // Using exponent 0.6 instead of 1.3 so recency doesn't completely bury engagement.
  const score = 40 / Math.pow(age + 0.5, 0.6);
  console.log(`[DEBUG] [rankingService] calculateRecencyScore: age = ${age.toFixed(2)} hrs -> score = ${score.toFixed(2)}`);
  return score;
};


// ==========================================
// 2. RELATIONSHIP SCORE
// ==========================================

const calculateRelationshipScore = (
  isFollowingAuthor,
  isSelf,
  postAgeHours = 0
) => {
  // Small nudge for followed/self — not enough to permanently pin own posts at #1.
  // Self posts get the same treatment as followed-user posts so the feed stays mixed.
  let score = 0;
  if (isSelf || isFollowingAuthor) {
    score = 10;
  }
  console.log(`[DEBUG] [rankingService] calculateRelationshipScore: isSelf = ${isSelf}, isFollowingAuthor = ${isFollowingAuthor}, age = ${postAgeHours.toFixed(2)} -> score = ${score}`);
  return score;
};


// ==========================================
// 3. SOURCE SCORE
// ==========================================

const calculateSourceScore = (source) => {
  let score = 0;
  if (source === "following") {
    score = 10;
  } else if (source === "trending") {
    score = 5;
  } else if (source === "exploration") {
    score = 2;
  }
  console.log(`[DEBUG] [rankingService] calculateSourceScore: source = ${source} -> score = ${score}`);
  return score;
};


// ==========================================
// 4. EXPLORATION SCORE
// ==========================================

const calculateExplorationScore = (features) => {
  const isNewPost =
    features.postAgeHours < 2;

  const hasLowEngagement =
    features.likes < 5 &&
    features.comments < 2;

  const score = (isNewPost && hasLowEngagement) ? 10 : 0;
  console.log(`[DEBUG] [rankingService] calculateExplorationScore: isNewPost = ${isNewPost}, hasLowEngagement = ${hasLowEngagement} -> score = ${score}`);
  return score;
};


// ==========================================
// 5. ENGAGEMENT SCORE (LOGARITHMIC)
// ==========================================

const calculateEngagementScore = (likes = 0, comments = 0) => {
  // Logarithmic scaling prevents high-like older posts from completely burying new posts.
  const score = Math.log10(likes + 1) * 20 + Math.log10(comments + 1) * 30;
  console.log(`[DEBUG] [rankingService] calculateEngagementScore: likes = ${likes}, comments = ${comments} -> score = ${score.toFixed(2)}`);
  return score;
};


// ==========================================
// 6. TOTAL POST SCORE
// ==========================================

const calculatePostScore = (features) => {

  const engagementScore =
    calculateEngagementScore(
      features.likes,
      features.comments
    );

  const recencyScore =
    calculateRecencyScore(
      features.postAgeHours
    );

  const relationshipScore =
    calculateRelationshipScore(
      features.isFollowingAuthor,
      features.isSelf,
      features.postAgeHours
    );

  const sourceScore =
    calculateSourceScore(
      features.source
    );

  const explorationScore =
    calculateExplorationScore(
      features
    );

  const totalScore =
    engagementScore +
    recencyScore +
    relationshipScore +
    sourceScore +
    explorationScore;

  console.log(`[DEBUG] [rankingService] calculatePostScore total = ${totalScore.toFixed(2)} (engagement: ${engagementScore.toFixed(2)}, recency: ${recencyScore.toFixed(2)}, relationship: ${relationshipScore}, source: ${sourceScore}, exploration: ${explorationScore})`);

  return totalScore;
};


// ==========================================
// 7. RANK CANDIDATES
// ==========================================

const rankCandidates = (candidates) => {
  console.log(`[DEBUG] [rankingService] Starting rankCandidates for ${candidates.length} candidates.`);

  const ranked = candidates
    .map((candidate) => {
      const score = calculatePostScore(candidate.features);

      // Add a small random jitter (±10% of the score, max ±8 pts) so that
      // posts with similar scores shuffle differently on each fetch.  This
      // prevents the feed from being identical every time while still keeping
      // genuinely high-scoring posts near the top.
      const jitter = (Math.random() - 0.5) * 2 * Math.min(score * 0.10, 8);

      return {
        ...candidate,
        score: score + jitter,
      };
    })

    .sort(
      (a, b) =>
        b.score - a.score
    );

  console.log(`[DEBUG] [rankingService] Completed rankCandidates. Top ranked post ID: ${ranked[0]?.post?._id} with score: ${ranked[0]?.score?.toFixed(2)}`);

  return ranked;
};


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  rankCandidates,
  calculatePostScore,
  calculateRecencyScore,
  calculateRelationshipScore,
  calculateSourceScore,
  calculateExplorationScore,
  calculateEngagementScore,
};