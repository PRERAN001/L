const Post = require("../models/model.post");

const generateExplorationCandidates = async ({
  user,
  cursor,
  limit = 40,
}) => {
  console.log(`[DEBUG] [explorationService] Starting generateExplorationCandidates. User ID: ${user._id}, cursor: ${cursor}, limit: ${limit}`);

  const excludedUserIds = [
    ...(user.following || []),
    user._id,
  ];

  const query = {
    user: {
      $nin: excludedUserIds,
    },
  };

  // cursor is a Unix timestamp (ms) number passed directly from the controller
  if (cursor && !isNaN(cursor)) {
    query.createdAt = {
      $lt: new Date(cursor),
    };
  }

  const posts = await Post.find(query)
    .sort({
      createdAt: -1,
    })
    .limit(limit)
    .populate(
      "user",
      "username name profileImage"
    )
    .populate(
      "comments.user",
      "username name profileImage"
    );

  console.log(`[DEBUG] [explorationService] Total exploration candidates returned: ${posts.length}`);

  return posts.map((post) => ({
    post,
    source: "exploration",
  }));
};

module.exports = {
  generateExplorationCandidates,
};