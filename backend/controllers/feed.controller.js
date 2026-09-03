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
  // Do not delete the fanout sorted set feed:${userId} as it stores feed post IDs!
  return;
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

    // cursor is a Unix timestamp (ms) string; absent on page 1
    const rawCursor = req.query.cursor;
    let timestampCursor = null;
    if (rawCursor) {
      const parsed = parseInt(rawCursor, 10);
      // Only treat as a timestamp cursor (not an old page-number cursor)
      if (!isNaN(parsed) && parsed > 1000000000000) {
        timestampCursor = parsed;
      }
    }

    console.log(`[DEBUG] [feedController] getFeed called for user: ${user._id} (${user.username}), limit: ${limit}, cursor: ${rawCursor || 'none'} (timestampCursor: ${timestampCursor})`);

    // Fetch a healthy pool of candidates; on subsequent pages we pass the
    // timestamp cursor so services skip already-seen posts.
    const candidatePoolLimit = limit * 5;

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
        candidatePoolLimit
      ),

      generateExplorationCandidates({
        user,
        cursor: timestampCursor,
        limit: candidatePoolLimit,
      }),
    ]);

    console.log(`[DEBUG] [feedController] Candidates fetched - Following: ${followingCandidates.length}, Trending: ${trendingCandidates.length}, Exploration: ${explorationCandidates.length}`);

    const allCandidates = [
      ...followingCandidates,
      ...trendingCandidates,
      ...explorationCandidates,
    ];

    const seen = new Set();

    const uniqueCandidates =
      allCandidates.filter((candidate) => {
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

    console.log(`[DEBUG] [feedController] Total unique candidates before scoring: ${uniqueCandidates.length}`);

    const candidatesWithFeatures = extractCandidateFeatures(
      uniqueCandidates,
      user
    );

    const rankedCandidates = rankCandidates(
      candidatesWithFeatures
    );

    // ==========================================
    // APPLY AUTHOR DIVERSITY
    // ==========================================
    // Apply diversity rules to prevent author spam while preserving ranking.
    const diverseCandidates = applyAuthorDiversity(rankedCandidates, limit);

    // Take the top `limit` posts from the diverse pool for this page.
    // Deeper pages are handled by advancing the timestamp cursor so candidate
    // services return a fresh, non-overlapping batch from the DB.
    const postsToReturn = diverseCandidates
      .slice(0, limit)
      .map((candidate) => candidate.post);

    console.log(`[DEBUG] [feedController] Returning ${postsToReturn.length} ranked posts (cursor: ${timestampCursor}, total candidates: ${rankedCandidates.length}).`);
    postsToReturn.forEach((p, idx) => {
      console.log(`[DEBUG] [feedController] Feed Post #${idx + 1}: ID ${p._id}, Author: ${p.user?.username || p.user}, CreatedAt: ${p.createdAt}`);
    });

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

    // Use the createdAt timestamp of the oldest returned post as the next
    // cursor.  Candidate services will fetch posts *older than* this timestamp,
    // giving a non-overlapping, ever-deepening feed.
    const hasMore = postsToReturn.length === limit;
    const oldestPost = postsToReturn[postsToReturn.length - 1];
    const nextCursor = hasMore && oldestPost
      ? new Date(oldestPost.createdAt).getTime().toString()
      : null;

    console.log(`[DEBUG] [feedController] Next cursor: ${nextCursor}, hasMore: ${hasMore}`);

    // ==========================================
    // 10. RESPONSE
    // ==========================================

    res.json({
      posts: formattedPosts,

      nextCursor,

      hasMore,
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

      // Record like event for analytics (fire-and-forget)
      FeedEvent.create({
        user: user._id,
        post: postId,
        eventType: "like",
        timestamp: new Date(),
      }).catch((err) => console.error("[FeedEvent] Like event error:", err.message));
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

module.exports = {
  getFeed,
  toggleLikePost,
  addComment,
  getComments,
};
