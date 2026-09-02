const Post = require("../models/model.post");
const { getOrCreateUser } = require("../utils/userHelper");
const { getAuth } = require("@clerk/express");
// const { invalidateFeedCache } = require("../utils/redis");
const {redis}=require("./../redis/index")
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

    const followerCount = user.followers?.length || 0;

    const FANOUT_THRESHOLD = 500;

    if (followerCount < FANOUT_THRESHOLD) {
      const feedUsers = [...(user.followers || []), user._id];

      for (const feedUserId of feedUsers) {
        await redis.zAdd(`feed:${feedUserId}`, {
          score: post.createdAt.getTime(),
          value: post._id.toString(),
        });
      }
    } else {
      console.log(
        `Large account (${followerCount} followers): skipping fanout`
      );

      //we dont fanout here we do it while fetching feed
    }

    const populatedPost = await Post.findById(post._id)
      .populate("user", "username name profileImage");

    res.status(201).json(populatedPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create post" });
  }
};

module.exports = {
  createPost,
};