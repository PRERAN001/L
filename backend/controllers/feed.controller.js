const Post = require("../models/model.post");
const User = require("../models/model.user");
const FeedEvent = require("../models/model.feedEvent");
const { getOrCreateUser } = require("../utils/userHelper");
const { getAuth } = require("@clerk/express");
const { redis } = require("../redis");
const { generateFollowingCandidates } = require("../feed/candidateService");
const { generateExplorationCandidates } = require("../feed/explorationService");
const { generateTrendingCandidates } = require("../feed/trendingService");
const { extractCandidateFeatures } = require("../feed/featureService");
const { rankCandidates } = require("../feed/rankingService");
const { updateUserMemory } = require("../utils/userMemoryService");

const FANOUT_THRESHOLD = 500;

// ==========================================
// DIVERSITY FILTER
// ==========================================
// Apply author diversity rules to the top-ranked posts:
// - No more than 2 consecutive posts from the same author
// - No more than 3 posts from the same author in the entire batch
// - Preserve ranking order as much as possible
const applyAuthorDiversity = (rankedCandidates, limit) => {
  const result = [];
  const authorCounts = new Map(); // authorId -> count
  let prevAuthorId = null;
  let prevAuthorStreak = 0;

  for (const candidate of rankedCandidates) {
    if (result.length >= limit) break;

    const authorId = candidate.post.user?._id
      ? candidate.post.user._id.toString()
      : candidate.post.user?.toString();

    if (!authorId) {
      // No author info — include it as-is
      result.push(candidate);
      prevAuthorId = null;
      prevAuthorStreak = 0;
      continue;
    }

    const currentCount = authorCounts.get(authorId) || 0;

    // Rule 1: No more than 3 posts from this author overall
    if (currentCount >= 3) {
      continue; // skip this post
    }

    // Rule 2: No more than 2 consecutive posts from the same author
    if (authorId === prevAuthorId) {
      prevAuthorStreak++;
      if (prevAuthorStreak >= 2) {
        continue; // skip — would make 3 in a row
      }
    } else {
      prevAuthorStreak = 0;
    }

    // Post passes both rules — include it
    result.push(candidate);
    authorCounts.set(authorId, currentCount + 1);
    prevAuthorId = authorId;
  }

  console.log(`[DEBUG] [feedController] Diversity filter: ${rankedCandidates.length} candidates → ${result.length} after author dedup (target: ${limit})`);

  return result;
};

const invalidateFeedCache = async (userId) => {
  if (redis && redis.isOpen && userId) {
    try {
      await redis.del(`feed:v2:photos:${userId}`);
      await redis.del(`reels:v2:${userId}`);
      await redis.del("reels:v2:anon");
    } catch (_) {}
  }
};

const getFeed = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user = await getOrCreateUser(userId);

    const limit = Math.min(
      parseInt(req.query.limit) || 20,
      50
    );

    const rawCursor = req.query.cursor;
    let offset = 0;
    let timestampCursor = null;

    if (rawCursor) {
      const parsed = parseInt(rawCursor, 10);
      if (!isNaN(parsed)) {
        if (parsed > 1000000000000) {
          timestampCursor = parsed;
        } else {
          offset = Math.max(0, parsed);
        }
      }
    }

    console.log(`[DEBUG] [feedController] getFeed for user: ${user._id}, limit: ${limit}, rawCursor: ${rawCursor}, offset: ${offset}, tsCursor: ${timestampCursor}`);

    const feedCacheKey = `feed:v2:photos:${user._id}`;
    if (!rawCursor && redis && redis.isOpen) {
      try {
        const cached = await redis.get(feedCacheKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (cacheErr) {}
    }

    const candidatePoolLimit = Math.min(limit * 3, 60);

    const [
      followingCandidates,
      trendingCandidates,
      explorationCandidates,
    ] = await Promise.all([
      generateFollowingCandidates({
        user,
        cursor: timestampCursor ? String(timestampCursor) : null,
        limit: candidatePoolLimit,
      }),

      generateTrendingCandidates(
        candidatePoolLimit,
        timestampCursor
      ),

      generateExplorationCandidates({
        user,
        cursor: timestampCursor,
        limit: candidatePoolLimit,
      }),
    ]);

    let selfCandidates = [];
    if (!rawCursor) {
      const selfPosts = await Post.find({ user: user._id, mediaType: { $ne: "video" } })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user", "username name profileImage")
        .populate("comments.user", "username name profileImage");

      selfCandidates = selfPosts.map((post) => ({
        post,
        source: "following",
      }));
    }

    let allCandidates = [
      ...selfCandidates,
      ...followingCandidates,
      ...trendingCandidates,
      ...explorationCandidates,
    ];

    const seen = new Set();
    let uniqueCandidates = allCandidates.filter((candidate) => {
      if (!candidate || !candidate.post || !candidate.post._id) {
        return false;
      }
      const postId = candidate.post._id.toString();
      if (seen.has(postId)) {
        return false;
      }
      seen.add(postId);
      return true;
    });

    if (uniqueCandidates.length < limit) {
      const totalPhotos = await Post.countDocuments({ mediaType: { $ne: "video" } });
      const safeSkip = offset % Math.max(1, totalPhotos);
      const fallbackPosts = await Post.find({ mediaType: { $ne: "video" } })
        .sort({ createdAt: -1 })
        .skip(safeSkip)
        .limit(limit * 2)
        .populate("user", "username name profileImage")
        .populate("comments.user", "username name profileImage");

      for (const p of fallbackPosts) {
        const pId = p._id.toString();
        if (!seen.has(pId)) {
          seen.add(pId);
          uniqueCandidates.push({ post: p, source: "exploration" });
        }
      }
    }

    const candidatesWithFeatures = await extractCandidateFeatures(
      uniqueCandidates,
      user
    );

    const rankedCandidates = rankCandidates(
      candidatesWithFeatures,
      limit
    );

    const diverseCandidates = applyAuthorDiversity(rankedCandidates, limit);

    let postsToReturn = diverseCandidates
      .slice(0, limit)
      .map((candidate) => candidate.post);

    if (postsToReturn.length === 0) {
      const fallback = await Post.find({ mediaType: { $ne: "video" } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("user", "username name profileImage")
        .populate("comments.user", "username name profileImage");
      postsToReturn = fallback;
    }

    const formattedPosts = postsToReturn.map((post) => {
      const isLiked = post.likes?.some(
        (likeId) => likeId.toString() === user._id.toString()
      ) || false;

      return {
        _id: post._id,
        user: post.user,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        caption: post.caption,
        likesCount: post.likes?.length || 0,
        isLiked,
        commentsCount: post.comments?.length || 0,
        comments: (post.comments || []).map((comment) => ({
          _id: comment._id,
          user: comment.user,
          text: comment.text,
          createdAt: comment.createdAt,
        })),
        createdAt: post.createdAt,
      };
    });

    const nextOffset = offset + formattedPosts.length;
    const nextCursor = String(nextOffset);
    const hasMore = true;

    res.json({
      posts: formattedPosts,
      nextCursor,
      hasMore,
    });

    if (!rawCursor && redis && redis.isOpen) {
      const payload = JSON.stringify({ posts: formattedPosts, nextCursor, hasMore });
      redis.setEx(feedCacheKey, 90, payload).catch(() => {});
    }
  } catch (error) {
    console.error("Get feed error:", error);
    res.status(500).json({
      message: "Failed to get feed",
    });
  }
};

const toggleLikePost = async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user = await getOrCreateUser(userId);
    const { postId } = req.params;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    if (!post.likes) {
      post.likes = [];
    }

    const alreadyLiked = post.likes.some(
      (likeId) =>
        likeId &&
        likeId.toString() === user._id.toString()
    );

    let scoreChange;

    if (alreadyLiked) {
      // Unlike
      post.likes = post.likes.filter(
        (likeId) =>
          likeId &&
          likeId.toString() !== user._id.toString()
      );

      scoreChange = -1;
    } else {
      // Like
      post.likes.push(user._id);

      scoreChange = 1;

      // Record like event for analytics (fire-and-forget)
      FeedEvent.create({
        user: user._id,
        post: postId,
        eventType: "like",
        timestamp: new Date(),
      }).catch((err) => console.error("[FeedEvent] Like event error:", err.message));

      // Update user memory with this positive signal (fire-and-forget)
      updateUserMemory({
        userId: user._id.toString(),
        postId,
        eventType: "like",
      });
    }

    await post.save();

    //updateing the trending post score
    if (redis && redis.isOpen) {
      try {
        await redis.zIncrBy(
          "trending:posts",
          scoreChange,
          postId
        );
      } catch (redisErr) {
        console.warn("Redis zIncrBy warning on like:", redisErr.message);
      }
    }

    await invalidateFeedCache(user._id);

    res.json({
      isLiked: !alreadyLiked,
      likesCount: post.likes.length,
    });
  } catch (error) {
    console.error("Toggle like error:", error);

    res.status(500).json({
      message: "Failed to toggle like status",
    });
  }
};

const addComment = async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        message: "Comment text is required",
      });
    }

    const user = await getOrCreateUser(userId);
    const { postId } = req.params;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    if (!post.comments) {
      post.comments = [];
    }

    const newComment = {
      user: user._id,
      text: text.trim(),
      createdAt: new Date(),
    };

    post.comments.push(newComment);

    await post.save();

    // Record comment event for analytics (fire-and-forget)
    FeedEvent.create({
      user: user._id,
      post: postId,
      eventType: "comment",
      timestamp: new Date(),
    }).catch((err) => console.error("[FeedEvent] Comment event error:", err.message));

    // Update user memory — commenting is a strong engagement signal (fire-and-forget)
    updateUserMemory({
      userId: user._id.toString(),
      postId,
      eventType: "comment",
    });

    //update the score of the trending post when comment is added
    if (redis && redis.isOpen) {
      try {
        await redis.zIncrBy(
          "trending:posts",
          3,
          postId
        );
      } catch (redisErr) {
        console.warn("Redis zIncrBy warning on comment:", redisErr.message);
      }
    }

    const updatedPost = await Post.findById(postId)
      .populate(
        "comments.user",
        "username name profileImage"
      );

    const addedComment =
      updatedPost.comments[
        updatedPost.comments.length - 1
      ];

    await invalidateFeedCache(user._id);

    res.status(201).json({
      comment: addedComment,
      commentsCount: updatedPost.comments.length,
    });
  } catch (error) {
    console.error("Add comment error:", error);

    res.status(500).json({
      message: "Failed to add comment",
    });
  }
};

const getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId).populate(
      "comments.user",
      "username name profileImage"
    );

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json({
      commentsCount: post.comments?.length || 0,
      comments: post.comments || [],
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
};

const getReels = async (req, res) => {
  try {
    let user = null;
    try {
      const { userId } = getAuth(req);
      if (userId) user = await getOrCreateUser(userId);
    } catch (_) {}

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const rawCursor = req.query.cursor;
    let offset = 0;
    let timestampCursor = null;

    if (rawCursor) {
      const parsed = parseInt(rawCursor, 10);
      if (!isNaN(parsed)) {
        if (parsed > 1000000000000) {
          timestampCursor = parsed;
        } else {
          offset = Math.max(0, parsed);
        }
      }
    }

    const cacheKey = user ? `reels:v2:${user._id}` : "reels:v2:anon";
    if (!rawCursor && redis && redis.isOpen) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (_) {}
    }

    const totalVideos = await Post.countDocuments({ mediaType: "video" });
    const safeSkip = totalVideos > 0 ? offset % totalVideos : 0;
    const poolLimit = Math.min(limit * 3, 60);

    const query = { mediaType: "video" };
    if (timestampCursor) {
      query.createdAt = { $lt: new Date(timestampCursor) };
    }

    let videoPosts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(timestampCursor ? 0 : safeSkip)
      .limit(poolLimit)
      .populate("user", "username name profileImage")
      .populate("comments.user", "username name profileImage");

    if (videoPosts.length === 0 && totalVideos > 0) {
      videoPosts = await Post.find({ mediaType: "video" })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("user", "username name profileImage")
        .populate("comments.user", "username name profileImage");
    }

    let rankedPosts;
    if (user && videoPosts.length > 0) {
      const candidates = videoPosts.map((post) => ({
        post,
        source: "trending",
      }));

      try {
        const candidatesWithFeatures = await extractCandidateFeatures(
          candidates,
          user
        );
        const ranked = rankCandidates(candidatesWithFeatures, limit);
        rankedPosts = ranked.map((c) => c.post);
      } catch (rankErr) {
        rankedPosts = videoPosts.slice(0, limit);
      }
    } else {
      rankedPosts = videoPosts.slice(0, limit);
    }

    const reels = rankedPosts.map((post) => {
      const isLiked = user
        ? post.likes?.some((id) => id.toString() === user._id.toString())
        : false;

      return {
        id: post._id.toString(),
        _id: post._id.toString(),
        video: post.mediaUrl,
        mediaUrl: post.mediaUrl,
        username: post.user?.username || post.user?.name || "user",
        profileImage: post.user?.profileImage || "https://i.pravatar.cc/150?img=12",
        caption: post.caption || "",
        likes: post.likes?.length || 0,
        isLiked,
        commentsCount: post.comments?.length || 0,
        createdAt: post.createdAt,
      };
    });

    const nextOffset = offset + reels.length;
    const nextCursor = String(nextOffset);
    const hasMore = true;

    res.json({
      reels,
      nextCursor,
      hasMore,
    });

    if (redis && redis.isOpen && !rawCursor) {
      redis.setEx(cacheKey, 90, JSON.stringify({ reels, nextCursor, hasMore })).catch(() => {});
    }
  } catch (error) {
    console.error("Get reels error:", error);
    res.status(500).json({ message: "Failed to fetch reels" });
  }
};

const sharePost = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getOrCreateUser(userId);
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    FeedEvent.create({
      user: user._id,
      post: postId,
      eventType: "share",
      timestamp: new Date(),
    }).catch((err) => console.error("[FeedEvent] Share event error:", err.message));

    updateUserMemory({
      userId: user._id.toString(),
      postId,
      eventType: "share",
    });

    if (redis && redis.isOpen) {
      try {
        await redis.zIncrBy("trending:posts", 5, postId);
      } catch (_) {}
    }

    await invalidateFeedCache(user._id);

    res.json({ success: true, message: "Post shared" });
  } catch (error) {
    console.error("Share post error:", error);
    res.status(500).json({ message: "Failed to share post" });
  }
};

module.exports = {
  getFeed,
  getReels,
  toggleLikePost,
  addComment,
  getComments,
  sharePost,
};
