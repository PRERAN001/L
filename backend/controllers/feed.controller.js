const Post = require("../models/model.post");
const { getOrCreateUser } = require("../utils/userHelper");
const { getAuth } = require("@clerk/express");

const getFeed = async (req, res) => {
  try {
    const { userId, isAuthenticated } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getOrCreateUser(userId);

    const userIds = [
      ...(user.following || []),
      user._id,
    ];

    let posts = await Post.find({
      user: { $in: userIds },
    })
      .populate("user", "username name profileImage")
      .populate("comments.user", "username name profileImage")
      .sort({ createdAt: -1 })
      .limit(30);

    // If feed from followed/own posts is empty, fetch general recent posts
    if (posts.length === 0) {
      posts = await Post.find()
        .populate("user", "username name profileImage")
        .populate("comments.user", "username name profileImage")
        .sort({ createdAt: -1 })
        .limit(30);
    }

    const formattedPosts = posts.map((post) => {
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
        comments: (post.comments || []).map((c) => ({
          _id: c._id,
          user: c.user,
          text: c.text,
          createdAt: c.createdAt,
        })),
        createdAt: post.createdAt,
      };
    });

    res.json(formattedPosts);
  } catch (error) {
    console.error("Get feed error:", error);
    res.status(500).json({ message: "Failed to get feed" });
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
      (likeId) => likeId.toString() === user._id.toString()
    );

    if (alreadyLiked) {
      post.likes = post.likes.filter(
        (likeId) => likeId.toString() !== user._id.toString()
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
      "username name profileImage"
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