const Post = require("../models/model.post");
const User = require("../models/model.user");
const { getOrCreateUser } = require("../utils/userHelper");
const { getAuth } = require("@clerk/express");
const { redis } = require("../redis");
const {generateFollowingCandidates} = require("../feed/candidateService")
const {generateExplorationCandidates} = require("../feed/explorationService")
const {generateTrendingCandidates} = require("../feed/trendingService")
const FANOUT_THRESHOLD = 500;

const invalidateFeedCache = async (userId) => {
  try {
    if (redis && redis.isOpen && userId) {
      await redis.del(`feed:${userId}`);
    }
  } catch (err) {
    console.warn("Redis cache invalidation warning:", err.message);
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

    const cursor = req.query.cursor;

   

    const [
      followingCandidates,
      trendingCandidates,
      explorationCandidates,
    ] = await Promise.all([
      generateFollowingCandidates({
        user,
        cursor,
        limit,
      }),

      generateTrendingCandidates(
        limit * 2
      ),

      generateExplorationCandidates({
        user,
        cursor,
        limit: limit * 2,
      }),
    ]);


    const allCandidates = [
      ...followingCandidates,
      ...trendingCandidates,
      ...explorationCandidates,
    ];


    const seen = new Set();

    const uniqueCandidates =
      allCandidates.filter((post) => {
        const postId = post._id.toString();

        if (seen.has(postId)) {
          return false;
        }

        seen.add(postId);

        return true;
      });

    // ==========================================
    // 6. TEMPORARY RANKING
    // ==========================================
    //
    // For now we simply rank by recency.
    //
    // Later:
    // candidate pool
    //      ↓
    // features
    //      ↓
    // ML ranking
    //

    uniqueCandidates.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

    // ==========================================
    // 7. TAKE TOP POSTS
    // ==========================================

    const postsToReturn =
      uniqueCandidates.slice(0, limit);

    // ==========================================
    // 8. FORMAT POSTS
    // ==========================================

    const formattedPosts =
      postsToReturn.map((post) => {
        const isLiked =
          post.likes?.some(
            (likeId) =>
              likeId.toString() ===
              user._id.toString()
          ) || false;

        return {
          _id: post._id,

          user: post.user,

          mediaUrl: post.mediaUrl,
          mediaType: post.mediaType,
          caption: post.caption,

          likesCount:
            post.likes?.length || 0,

          isLiked,

          commentsCount:
            post.comments?.length || 0,

          comments: (post.comments || []).map(
            (comment) => ({
              _id: comment._id,
              user: comment.user,
              text: comment.text,
              createdAt: comment.createdAt,
            })
          ),

          createdAt: post.createdAt,
        };
      });

    // ==========================================
    // 9. CREATE NEXT CURSOR
    // ==========================================

    let nextCursor = null;

    if (postsToReturn.length === limit) {
      const lastPost =
        postsToReturn[
          postsToReturn.length - 1
        ];

      nextCursor = new Date(
        lastPost.createdAt
      ).getTime();
    }

    // ==========================================
    // 10. RESPONSE
    // ==========================================

    res.json({
      posts: formattedPosts,

      nextCursor,

      hasMore:
        nextCursor !== null,
    });
  } catch (error) {
    console.error(
      "Get feed error:",
      error
    );

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
    }

    await post.save();

    //updateing the trending post score

    await redis.zIncrBy(
      "trending:posts",
      scoreChange,
      postId
    );

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
//update the score of the trending post  when comment is been addede

    await redis.zIncrBy(
      "trending:posts",
      3,
      postId
    );

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

module.exports = {
  getFeed,
  toggleLikePost,
  addComment,
  getComments,
};
