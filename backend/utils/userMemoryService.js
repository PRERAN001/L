// utils/userMemoryService.js
//
// On every interaction, this module:
//   1. Fetches the post embedding from MongoDB
//   2. Updates the user's short-term memory in Redis
//   3. Updates the user's long-term memory in Redis
//   4. Computes U_current = λ·U_long + (1-λ)·U_short
//   5. Stores U_current back in Redis for fast reads by the ranking pipeline
//
// All work is fire-and-forget — callers should NOT await the returned promise
// if latency matters (e.g. in response handlers).

const Post  = require("../models/model.post");
const { updateShortTermMemory, calculateShortTermMemory } = require("../redis/shortTermMemory");
const { updateLongTermMemory, getLongTermMemory }         = require("../redis/longTermMemory");
const { redis }                                           = require("../redis");

// Weight that controls how much the long-term vs short-term memory contributes
// to the blended user vector:  U_current = λ·U_long + (1-λ)·U_short
const LAMBDA = 0.7;


// ------------------------------------------------
// Cosine normalise a vector in-place, returns it
// ------------------------------------------------
const normalise = (vec) => {
  const norm = Math.sqrt(
    vec.reduce((sum, v) => sum + v * v, 0)
  );

  if (norm === 0) return vec;

  return vec.map((v) => v / norm);
};


// ------------------------------------------------
// Blend long + short term vectors
// ------------------------------------------------
const blendMemories = (uLong, uShort) => {
  if (!uLong && !uShort) return null;

  // If one side is missing, use the other as-is
  if (!uLong) return normalise([...uShort]);
  if (!uShort) return normalise([...uLong]);

  const dim = uLong.length;

  const blended = new Array(dim);

  for (let i = 0; i < dim; i++) {
    blended[i] =
      LAMBDA * uLong[i] +
      (1 - LAMBDA) * uShort[i];
  }

  return normalise(blended);
};


// ------------------------------------------------
// Redis key for the blended U_current vector
// ------------------------------------------------
const uCurrentKey = (userId) =>
  `user:${userId}:u_current`;


// ------------------------------------------------
// Main update — call after any meaningful event
// ------------------------------------------------
const updateUserMemory = async ({ userId, postId, eventType }) => {
  try {
    // 1. Load post embedding (embedding field is select:false — request explicitly)
    const post = await Post.findById(postId).select("embedding caption mediaType");

    if (!post) {
      console.warn(`[userMemory] Post ${postId} not found — skipping`);
      return;
    }

    const postEmbedding = post.embedding;

    if (!postEmbedding || postEmbedding.length === 0) {
      // Post embedding not yet generated (embedding service was down at write time)
      console.warn(
        `[userMemory] Post ${postId} has no embedding — memory not updated`
      );
      return;
    }

    // 2. Update short-term memory (recency-weighted sliding window)
    const uShort = await updateShortTermMemory({
      userId,
      postId,
      postEmbedding,
      eventType,
    });

    console.log(
      `[userMemory] ✓ U_short updated:`,
      uShort
        ? `[${uShort.slice(0, 5).map(v => v.toFixed(3)).join(', ')}...] (${uShort.length} dims)`
        : 'null (no interactions yet)'
    );

    // 3. Update long-term memory (slow EMA)
    const uLong = await updateLongTermMemory({
      userId,
      postEmbedding,
      eventType,
      timestamp: Date.now(),
    });

    // getLongTermMemory returns { embedding, updatedAt } — unwrap
    const longVec =
      uLong && Array.isArray(uLong)
        ? uLong
        : (await getLongTermMemory(userId))?.embedding ?? null;

    console.log(
      `[userMemory] ✓ U_long updated:`,
      longVec
        ? `[${longVec.slice(0, 5).map(v => v.toFixed(3)).join(', ')}...] (${longVec.length} dims)`
        : 'null (first interaction)'
    );

    // 4. Blend → U_current
    const uCurrent = blendMemories(longVec, uShort);

    if (!uCurrent) return;

    console.log(
      `[userMemory] ✓ U_current blended (λ=${LAMBDA}):`,
      `[${uCurrent.slice(0, 5).map(v => v.toFixed(3)).join(', ')}...] (${uCurrent.length} dims)`
    );

    // 5. Store U_current in Redis (TTL = 7 days)
    await redis.set(
      uCurrentKey(userId),
      JSON.stringify(uCurrent),
      { EX: 60 * 60 * 24 * 7 }
    );

    console.log(
      `[userMemory] ━━━ Memory update complete for user ${userId} after "${eventType}" on post ${postId} ━━━`
    );
  } catch (err) {
    console.error("[userMemory] updateUserMemory error:", err.message);
  }
};


// ------------------------------------------------
// Read U_current — used by featureService
// ------------------------------------------------
const getUserCurrentVector = async (userId) => {
  const key = uCurrentKey(userId);

  const data = await redis.get(key);

  if (!data) return null;

  return JSON.parse(data);
};


// ------------------------------------------------
// Read U_long — exposed for featureService
// ------------------------------------------------
const getUserLongVector = async (userId) => {
  const mem = await getLongTermMemory(userId);

  return mem?.embedding ?? null;
};


// ------------------------------------------------
// Read U_short — exposed for featureService
// ------------------------------------------------
const getUserShortVector = async (userId) => {
  const key = `user:${userId}:short_interactions`;

  const data = await redis.get(key);

  if (!data) return null;

  return calculateShortTermMemory(JSON.parse(data));
};


module.exports = {
  updateUserMemory,
  getUserCurrentVector,
  getUserLongVector,
  getUserShortVector,
  blendMemories,
  normalise,
  LAMBDA,
};
