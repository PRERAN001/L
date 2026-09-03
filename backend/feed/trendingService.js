const Post = require("../models/model.post");
const { redis } = require("../redis/index");

const generateTrendingCandidates = async (limit = 40) => {
  console.log(`[DEBUG] [trendingService] Starting generateTrendingCandidates with limit: ${limit}`);
  const trendingKey = "trending:posts";

  let postIds = [];
  if (redis && redis.isOpen) {
    try {
      // Get highest-scoring post IDs
      postIds = await redis.zRange(
        trendingKey,
        0,
        limit - 1,
        {
          REV: true,
        }
      );
      console.log(`[DEBUG] [trendingService] Redis returned ${postIds.length} trending post IDs.`);
    } catch (err) {
      console.warn("Redis zRange error in generateTrendingCandidates:", err.message);
    }
  }

  if (!postIds || postIds.length === 0) {
    console.log("[DEBUG] [trendingService] No trending post IDs found in Redis sorted set.");
    return [];
  }

  // Get actual posts from MongoDB
  const posts = await Post.find({
    _id: {
      $in: postIds,
    },
  })
    .populate(
      "user",
      "username name profileImage"
    )
    .populate(
      "comments.user",
      "username name profileImage"
    );

  // MongoDB $in does NOT guarantee Redis order
  const postMap = new Map(
    posts.map((post) => [
      post._id.toString(),
      post,
    ])
  );

  const orderedPosts = postIds
    .map((id) => postMap.get(id))
    .filter(Boolean);

  console.log(`[DEBUG] [trendingService] Total trending candidates returned: ${orderedPosts.length}`);

  return orderedPosts.map((post) => ({
    post,
    source: "trending",
  }));
};

module.exports = {
  generateTrendingCandidates,
};