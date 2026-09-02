const Post = require("../models/model.post");
const { getOrCreateUser } = require("../utils/userHelper");
const { getAuth } = require("@clerk/express");


const FANOUT_THRESHOLD = 10000;

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

    const feedKey = `feed:${user._id}`;
//get posts from redis

    let redisPostIds;

    if (!cursor) {
      redisPostIds = await redis.zRange(
        feedKey,
        0,
        limit - 1,
        {
          REV: true,
        }
      );
    } else {
      redisPostIds = await redis.zRange(
        feedKey,
        `(${cursor}`,
        "-inf",
        {
          REV: true,
          BY: "SCORE",
          LIMIT: {
            offset: 0,
            count: limit,
          },
        }
      );
    }

//find large followers acc

    const largeAccounts = await User.find({
      _id: { $in: user.following || [] },

      $expr: {
        $gte: [
          { $size: "$followers" },
          FANOUT_THRESHOLD,
        ],
      },
    }).select("_id");

    const largeAccountIds = largeAccounts.map(
      (account) => account._id
    );



    let largeAccountPosts = [];

    if (largeAccountIds.length > 0) {
      const largeAccountQuery = {
        user: { $in: largeAccountIds },
      };

      // If cursor exists, only get posts older than cursor
      if (cursor) {
        largeAccountQuery.createdAt = {
          $lt: new Date(Number(cursor)),
        };
      }

      largeAccountPosts = await Post.find(
        largeAccountQuery
      )
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate(
          "user",
          "username name profileImage"
        )
        .populate(
          "comments.user",
          "username name profileImage"
        );
    }



    let redisPosts = [];

    if (redisPostIds.length > 0) {
      redisPosts = await Post.find({
        _id: { $in: redisPostIds },
      })
        .populate(
          "user",
          "username name profileImage"
        )
        .populate(
          "comments.user",
          "username name profileImage"
        );
    }



    const postMap = new Map(
      redisPosts.map((post) => [
        post._id.toString(),
        post,
      ])
    );

    const orderedRedisPosts = redisPostIds
      .map((id) => postMap.get(id))
      .filter(Boolean);

    const allPosts = [
      ...orderedRedisPosts,
      ...largeAccountPosts,
    ];


    allPosts.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );


    const uniquePosts = [];

    const seenPosts = new Set();

    for (const post of allPosts) {
      const postId = post._id.toString();

      if (!seenPosts.has(postId)) {
        seenPosts.add(postId);
        uniquePosts.push(post);
      }
    }



    const postsToReturn = uniquePosts.slice(
      0,
      limit
    );


    const formattedPosts = postsToReturn.map(
      (post) => {
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
      }
    );

    // ==========================================
    // 10. CREATE NEXT CURSOR
    // ==========================================

    let nextCursor = null;

    if (postsToReturn.length === limit) {
      const lastPost =
        postsToReturn[postsToReturn.length - 1];

      nextCursor = new Date(
        lastPost.createdAt
      ).getTime();
    }

    res.json({
      posts: formattedPosts,
      nextCursor,
      hasMore: nextCursor !== null,
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
    const { userId, isAuthenticated } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getOrCreateUser(userId);
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (!post.likes) post.likes = [];

    const alreadyLiked = post.likes.some(
      (likeId) => likeId.toString() === user._id.toString(),
    );

    if (alreadyLiked) {
      post.likes = post.likes.filter(
        (likeId) => likeId.toString() !== user._id.toString(),
      );
    } else {
      post.likes.push(user._id);
    }

    await post.save();

    // Invalidate feed cache after like toggle
    await invalidateFeedCache();

    res.json({
      isLiked: !alreadyLiked,
      likesCount: post.likes.length,
    });
  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({ message: "Failed to toggle like status" });
  }
};

const addComment = async (req, res) => {
  try {
    const { userId, isAuthenticated } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const user = await getOrCreateUser(userId);
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (!post.comments) post.comments = [];

    const newComment = {
      user: user._id,
      text: text.trim(),
      createdAt: new Date(),
    };

    post.comments.push(newComment);
    await post.save();

    const updatedPost = await Post.findById(postId).populate(
      "comments.user",
      "username name profileImage",
    );

    const addedComment = updatedPost.comments[updatedPost.comments.length - 1];

    // Invalidate feed cache after adding comment
    await invalidateFeedCache();

    res.status(201).json({
      comment: addedComment,
      commentsCount: updatedPost.comments.length,
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ message: "Failed to add comment" });
  }
};

const getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId).populate(
      "comments.user",
      "username name profileImage",
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
