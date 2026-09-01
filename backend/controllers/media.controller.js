const Post = require("../models/model.post");
const { getOrCreateUser } = require("../utils/userHelper");
const { getAuth } = require("@clerk/express");
const createPost = async (req, res) => {
  try {
    const { mediaUrl, mediaType = "image", caption = "" } = req.body;
    const { userId, isAuthenticated } = getAuth(req);

    console.log("Authenticated:", isAuthenticated);
    console.log("Clerk user ID:", userId);


    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getOrCreateUser(userId);

    const post = await Post.create({
      user: user._id,
      mediaUrl,
      mediaType,
      caption,
    });

    const populatedPost = await Post.findById(post._id).populate("user", "username name profileImage");
    res.status(201).json(populatedPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create post" });
  }
};

module.exports = {
  createPost,
};