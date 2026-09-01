const Post = require("../models/Post");
const User = require("../models/User");

const getFeed = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const users = [
      ...user.following,
      user._id,
    ];

    const posts = await Post.find({
      user: {
        $in: users,
      },
    })
      .populate("user", "username profileImage")
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(posts);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to get feed",
    });
  }
};

module.exports = {
  getFeed,
};