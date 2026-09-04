const Post = require("../models/model.post");
const { redis } = require("../redis/index");

// cursor is a Unix timestamp (ms) — only return trending posts older than this.
// On the first page cursor is null, so everything is eligible.
const generateTrendingCandidates = async (limit = 40, cursor = null) => {
  console.log(`[DEBUG] [trendingService] Starting generateTrendingCandidates with limit: ${limit}, cursor: ${cursor}`);
  const trendingKey = "trending:posts";

  let postIds = [];
  if (redis && redis.isOpen) {
    try {
      // Fetch a larger pool from Redis so we have enough after cursor-filtering
      postIds = await redis.zRange(
        trendingKey,
        0,
        limit * 3 - 1,    // over-fetch — we'll trim after cursor filter
        {
          REV: true,
        }
      );
      console.log(`[DEBUG] [trendingService] Redis returned ${postIds.length} trending post IDs (pre-filter).`);
    } catch (err) {
      console.warn("Redis zRange error in generateTrendingCandidates:", err.message);
    }
  }

  if (!postIds || postIds.length === 0) {
    console.log("[DEBUG] [trendingService] No trending post IDs found in Redis.");
    return [];
  }

  // Build the MongoDB query — apply cursor filter so trending posts obey the
  // same time window as the other candidate sources.
  const query = { _id: { $in: postIds }, mediaType: { $ne: "video" } };
  if (cursor && !isNaN(Number(cursor))) {
    query.createdAt = { $lt: new Date(Number(cursor)) };
  }

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user", "username name profileImage")
    .populate("comments.user", "username name profileImage");

  // Restore Redis score order for posts that survived the cursor filter
  const postMap = new Map(
    posts.map((post) => [post._id.toString(), post])
  );

  const orderedPosts = postIds
    .map((id) => postMap.get(id))
    .filter(Boolean)
    .slice(0, limit);

  console.log(`[DEBUG] [trendingService] Total trending candidates returned: ${orderedPosts.length}`);

  return orderedPosts.map((post) => ({
    post,
    source: "trending",
  }));
};

module.exports = {
  generateTrendingCandidates,
};
