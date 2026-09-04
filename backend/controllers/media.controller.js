const Post = require("../models/model.post");
const { getOrCreateUser } = require("../utils/userHelper");
const { getAuth } = require("@clerk/express");
const { redis } = require("../redis");
const { getPostEmbedding } = require("../utils/embeddingClient");

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
    console.log(`[DEBUG] [mediaController] Post created successfully. ID: ${post._id}, Author User ID: ${user._id}, CreatedAt: ${post.createdAt}`);

    // ------------------------------------------------
    // Generate & store caption embedding (best-effort)
    // ------------------------------------------------
    // Done *after* the post is saved so the response isn't blocked.
    // We fire it in the background and update the document silently.
    (async () => {
      try {
        const embedding = await getPostEmbedding({ caption, mediaType });

        if (embedding) {
          await Post.updateOne(
            { _id: post._id },
            { $set: { embedding } }
          );
          console.log(
            `[DEBUG] [mediaController] Embedding stored for post ${post._id} (${embedding.length} dims)`
          );
        }
      } catch (embErr) {
        console.warn("[mediaController] Background embedding failed:", embErr.message);
      }
    })();
    //add post to the trending list
    if (redis && redis.isOpen) {
      try {
        await redis.zAdd("trending:posts", {
          score: 0,
          value: post._id.toString(),
        });
      } catch (redisErr) {
        console.warn("Redis zAdd trending warning:", redisErr.message);
      }
    }

    // FANOUT ON WRITE: Push post ID to followers' Redis feed sorted sets
    const followerCount = user.followers?.length || 0;
    const FANOUT_THRESHOLD = 500;

    if (followerCount < FANOUT_THRESHOLD) {
      const feedUsers = [...(user.followers || []), user._id];

      if (redis && redis.isOpen) {
        try {
          for (const feedUserId of feedUsers) {
            await redis.zAdd(`feed:${feedUserId}`, {
              score: post.createdAt.getTime(),
              value: post._id.toString(),
            });
          }
          console.log(`[REDIS FANOUT] Post ${post._id} fanned out to ${feedUsers.length} feed(s).`);
        } catch (redisErr) {
          console.warn("Redis zAdd fanout warning:", redisErr.message);
        }
      }
    } else {
      console.log(
        `Large account (${followerCount} followers): skipping fanout on write, using fanout on read`
      );
    }

    const populatedPost = await Post.findById(post._id).populate(
      "user",
      "username name profileImage"
    );

    res.status(201).json(populatedPost);

    // Invalidate this user's cached feed + reels so the next load includes the
    // new post. Fire-and-forget — the response is already sent.
    if (redis && redis.isOpen) {
      redis.del(`feed:v2:photos:${user._id}`).catch(() => {});
      if (mediaType === "video") {
        redis.del(`reels:v2:${user._id}`).catch(() => {});
        redis.del("reels:v2:anon").catch(() => {});
      }
    }
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ message: "Failed to create post" });
  }
};

module.exports = {
  createPost,
};