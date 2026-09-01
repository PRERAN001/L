const User = require("../models/model.user");
const Post = require("../models/model.post");
const { getOrCreateUser } = require("../utils/userHelper");
const { getAuth } = require("@clerk/express");
const getMe = async (req, res) => {
  try {
    const { userId, isAuthenticated } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getOrCreateUser(userId);
    const posts = await Post.find({ user: user._id }).sort({ createdAt: -1 });

    res.json({
      user: {
        _id: user._id,
        clerkId: user.clerkId,
        username: user.username,
        name: user.name,
        bio: user.bio,
        profileImage: user.profileImage,
        followersCount: user.followers?.length || 0,
        followingCount: user.following?.length || 0,
      },
      posts: posts.map((post) => ({
        id: post._id,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        caption: post.caption,
        likesCount: post.likes?.length || 0,
        createdAt: post.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get profile" });
  }
};

const getProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username }).select("-followers -following");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const posts = await Post.find({ user: user._id }).sort({ createdAt: -1 });

    res.json({
      user,
      posts: posts.map((post) => ({
        id: post._id,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        caption: post.caption,
        likesCount: post.likes?.length || 0,
        createdAt: post.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get profile" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { userId, isAuthenticated } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { username, name, bio, profileImage } = req.body;

    const updateFields = {};
    if (username !== undefined) updateFields.username = username;
    if (name !== undefined) updateFields.name = name;
    if (bio !== undefined) updateFields.bio = bio;
    if (profileImage !== undefined) updateFields.profileImage = profileImage;

    const user = await User.findOneAndUpdate(
      { userId },
      { $set: updateFields },
      { new: true, runValidators: true, upsert: true }
    );

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

module.exports = {
  getMe,
  getProfile,
  updateProfile,
};