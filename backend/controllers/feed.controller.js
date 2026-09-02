const Post = require("../models/model.post");
const { getOrCreateUser } = require("../utils/userHelper");
const { getAuth } = require("@clerk/express");
const getFeed = async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user = await getOrCreateUser(userId);

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const cursor = req.query.cursor;
    const userIds = [...(user.following || []), user._id];

    const query = {
      user: { $in: userIds },
    };

    if (cursor) {
      query.createdAt = {
        $lt: new Date(cursor),
      };
    }

    const posts = await Post.find(query)
      .populate("user", "username name profileImage")
      .populate("comments.user", "username name profileImage")
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    const hasMore = posts.length > limit;

    const postsToReturn = hasMore ? posts.slice(0, limit) : posts;

    const formattedPosts = postsToReturn.map((post) => {
      const isLiked =
        post.likes?.some(
          (likeId) => likeId.toString() === user._id.toString(),
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

        comments: (post.comments || []).map((c) => ({
          _id: c._id,
          user: c.user,
          text: c.text,
          createdAt: c.createdAt,
        })),

        createdAt: post.createdAt,
      };
    });

    const nextCursor = hasMore
      ? postsToReturn[postsToReturn.length - 1].createdAt.toISOString()
      : null;

    // 10. Send response
    res.json({
      posts: formattedPosts,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("Get feed error:", error);

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
