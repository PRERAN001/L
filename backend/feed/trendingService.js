const Post = require("../models/model.post");
const { redis } = require("../utils/redis");

const generateTrendingCandidates = async (limit = 40) => {
  const trendingKey = "trending:posts";

  // Get highest-scoring post IDs
  const postIds = await redis.zRange(
    trendingKey,
    0,
    limit - 1,
    {
      REV: true,
    }
  );

  if (postIds.length === 0) {
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

  return orderedPosts;
};

module.exports = {
  generateTrendingCandidates,
};