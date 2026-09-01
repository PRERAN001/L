const Post = require("../models/Post");
const User = require("../models/User");

const createPost = async (req, res) => {
  try {
    const { mediaUrl, mediaType, caption } = req.body;

    const clerkId = req.auth.userId;

    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const post = await Post.create({
      user: user._id,
      mediaUrl,
      mediaType,
      caption,
    });

    res.status(201).json(post);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create post",
    });
  }
};

module.exports = {
  createPost,
};