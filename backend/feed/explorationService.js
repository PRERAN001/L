const Post = require("../models/model.post");

const generateExplorationCandidates = async ({
  user,
  cursor,
  limit = 40,
}) => {


  const excludedUserIds = [
    ...(user.following || []),
    user._id,
  ];



  const query = {
    user: {
      $nin: excludedUserIds,
    },
  };


  if (cursor) {
    query.createdAt = {
      $lt: new Date(Number(cursor)),
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

  return posts;
};

module.exports = {
  generateExplorationCandidates,
};