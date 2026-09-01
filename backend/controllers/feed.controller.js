const Post = require("../models/model.post");
const { getOrCreateUser } = require("../utils/userHelper");

const getFeed = async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getOrCreateUser(clerkId);

    const userIds = [
      ...(user.following || []),
      user._id,
    ];

    let posts = await Post.find({
      user: { $in: userIds },
    })
      .populate("user", "username name profileImage")
      .sort({ createdAt: -1 })
      .limit(30);

    // If feed from followed/own posts is empty, fetch general recent posts
    if (posts.length === 0) {
      posts = await Post.find()
        .populate("user", "username name profileImage")
        .sort({ createdAt: -1 })
        .limit(30);
    }

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get feed" });
  }
};

module.exports = {
  getFeed,
};