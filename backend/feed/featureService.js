// feed/featureService.js
//
// V11: extends the v10 feature set with embedding-based user-affinity signals.
//
// Feature vector per candidate:
//   Classic:
//     likes, comments, postAgeHours, isFollowingAuthor, isSelf, mediaType, source
//   Embedding (new):
//     simLong    – cosine(U_long,  postEmbedding)
//     simShort   – cosine(U_short, postEmbedding)
//     simCurrent – cosine(U_current, postEmbedding)  [λ·long + (1-λ)·short]
//     hasEmbedding – 1 if the post has an embedding, 0 otherwise

const {
  getUserCurrentVector,
  getUserLongVector,
  getUserShortVector,
} = require("../utils/userMemoryService");


// ------------------------------------------------
// Cosine similarity between two equal-length vectors.
// Both vectors are assumed to be L2-normalised (which our embedding service
// and memory service guarantee), so this is just a dot product.
// Falls back to full computation when norms are needed for safety.
// ------------------------------------------------
const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);

  return denom === 0 ? 0 : dot / denom;
};


// ------------------------------------------------
// Load all three user memory vectors in one shot.
// Returns { uLong, uShort, uCurrent } — any may be null.
// ------------------------------------------------
const loadUserMemory = async (userId) => {
  const [uLong, uShort, uCurrent] = await Promise.all([
    getUserLongVector(userId),
    getUserShortVector(userId),
    getUserCurrentVector(userId),
  ]);

  console.log(`[featureService] 🧠 Memory loaded for user ${userId}:`);
  console.log(`  • U_long:    ${uLong ? `[${uLong.slice(0, 5).map(v => v.toFixed(3)).join(', ')}...] (384D)` : 'null (cold start)'}`);
  console.log(`  • U_short:   ${uShort ? `[${uShort.slice(0, 5).map(v => v.toFixed(3)).join(', ')}...] (384D)` : 'null (cold start)'}`);
  console.log(`  • U_current: ${uCurrent ? `[${uCurrent.slice(0, 5).map(v => v.toFixed(3)).join(', ')}...] (384D)` : 'null (cold start)'}`);

  return { uLong, uShort, uCurrent };
};


// ------------------------------------------------
// Extract features for a single candidate
// ------------------------------------------------
const buildCandidateFeatures = (
  { post, source },
  user,
  memory
) => {
  const now = Date.now();

  const postAgeMs   = now - new Date(post.createdAt).getTime();
  const postAgeHours = postAgeMs / (1000 * 60 * 60);

  const authorId = post.user?._id
    ? post.user._id.toString()
    : post.user?.toString();

  const isSelf = user?._id
    ? user._id.toString() === authorId
    : false;

  const isFollowingAuthor =
    isSelf ||
    (user?.following?.some(
      (uid) => uid.toString() === authorId
    ) || false);

  // ---- Embedding similarity ----
  const postEmb = post.embedding ?? null;
  const hasEmbedding = postEmb ? 1 : 0;

  const { uLong, uShort, uCurrent } = memory;

  const simLong    = cosineSimilarity(uLong,    postEmb);
  const simShort   = cosineSimilarity(uShort,   postEmb);
  const simCurrent = cosineSimilarity(uCurrent, postEmb);

  console.log(
    `[DEBUG] [featureService] Post ${post._id}: ` +
    `age=${postAgeHours.toFixed(1)}h, ` +
    `likes=${post.likes?.length || 0}, ` +
    `comments=${post.comments?.length || 0}, ` +
    `isFollowing=${isFollowingAuthor}, ` +
    `hasEmb=${hasEmbedding}, ` +
    `simLong=${simLong.toFixed(3)}, ` +
    `simShort=${simShort.toFixed(3)}, ` +
    `simCurrent=${simCurrent.toFixed(3)}, ` +
    `source=${source}`
  );

  return {
    post,
    features: {
      // --- classic ---
      likes:             post.likes?.length || 0,
      comments:          post.comments?.length || 0,
      postAgeHours,
      isFollowingAuthor,
      isSelf,
      mediaType:         post.mediaType,
      source,

      // --- embedding-based (v11) ---
      hasEmbedding,
      simLong,
      simShort,
      simCurrent,
    },
  };
};


// ------------------------------------------------
// Public API — async because it fetches user memory
// ------------------------------------------------
const extractCandidateFeatures = async (candidates, user) => {
  console.log(
    `[DEBUG] [featureService] Extracting features for ${candidates.length} candidates. User: ${user?._id}`
  );

  // Load all three memory vectors once — shared across all candidates
  const memory = user?._id
    ? await loadUserMemory(user._id.toString())
    : { uLong: null, uShort: null, uCurrent: null };

  // Candidates don't carry embedding by default (select:false on the schema).
  // We need to load them for all candidates in one batch query.
  const postIds = candidates
    .map((c) => c.post?._id)
    .filter(Boolean);

  // Bulk-fetch embeddings — avoids N+1
  const Post = require("../models/model.post");
  const embDocs = await Post.find(
    { _id: { $in: postIds } },
    { embedding: 1 }           // projection — only grab the embedding field
  );

  const embMap = new Map(
    embDocs
      .filter((d) => d.embedding?.length)
      .map((d) => [d._id.toString(), d.embedding])
  );

  // Attach embedding to each candidate's post (in-memory only — no DB write)
  const enriched = candidates.map((c) => {
    const id = c.post?._id?.toString();
    return {
      ...c,
      post: {
        ...c.post.toObject?.() ?? c.post,
        embedding: embMap.get(id) ?? null,
      },
    };
  });

  return enriched.map(
    (candidate) => buildCandidateFeatures(candidate, user, memory)
  );
};


// Kept for backwards compat — same function
const extractFeatures = (candidates, user) =>
  extractCandidateFeatures(candidates, user);


module.exports = {
  extractCandidateFeatures,
  extractFeatures,
  cosineSimilarity,
};
