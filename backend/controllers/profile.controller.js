const User = require("../models/model.user");
const Post = require("../models/model.post");
const { getOrCreateUser } = require("../utils/userHelper");
const { getAuth } = require("@clerk/express");
const { invalidateFeedCache } = require("../utils/redis");
const { redis } = require("../redis/index");
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
    const { userId } = getAuth(req);

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let isFollowing = false;
    let isBlocked = false;

    if (userId) {
      const currentUser = await getOrCreateUser(userId);
      if (currentUser) {
        isFollowing = user.followers?.some(
          (fId) => fId.toString() === currentUser._id.toString(),
        );
        isBlocked =
          currentUser.blockedUsers?.some(
            (bId) => bId.toString() === user._id.toString(),
          ) || false;
      }
    }

    const posts = isBlocked
      ? []
      : await Post.find({ user: user._id }).sort({ createdAt: -1 });

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
        isFollowing,
        isBlocked,
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

const toggleFollow = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { username } = req.params;
    const currentUser = await getOrCreateUser(userId);
    const targetUser = await User.findOne({ username });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser._id.equals(currentUser._id)) {
      return res.status(400).json({ message: "Cannot follow yourself" });
    }

    const isFollowing = targetUser.followers?.some(
      (fId) => fId.toString() === currentUser._id.toString(),
    );

    if (isFollowing) {
  // Unfollow

  targetUser.followers = (targetUser.followers || []).filter(
    (fId) => fId.toString() !== currentUser._id.toString()
  );

  currentUser.following = (currentUser.following || []).filter(
    (fId) => fId.toString() !== targetUser._id.toString()
  );

  // Remove target user's posts from current user's feed
  const postsToRemove = await Post.find({
    user: targetUser._id,
  }).select("_id");

  for (const post of postsToRemove) {
    await redis.zRem(
      `feed:${currentUser._id}`,
      post._id.toString()
    );
  }

} else {
  // Follow

  if (!targetUser.followers) {
    targetUser.followers = [];
  }

  if (!currentUser.following) {
    currentUser.following = [];
  }

  targetUser.followers.push(currentUser._id);
  currentUser.following.push(targetUser._id);

  // Backfill recent posts
  const recentPosts = await Post.find({
    user: targetUser._id,
  })
    .sort({ createdAt: -1 })
    .limit(20);

  for (const post of recentPosts) {
    await redis.zAdd(`feed:${currentUser._id}`, {
      score: post.createdAt.getTime(),
      value: post._id.toString(),
    });
  }
}

    await Promise.all([targetUser.save(), currentUser.save()]);

    await invalidateFeedCache(currentUser._id.toString());

    res.json({
      isFollowing: !isFollowing,
      followersCount: targetUser.followers.length,
      followingCount: targetUser.following.length,
    });
  } catch (error) {
    console.error("Toggle follow error:", error);
    res.status(500).json({ message: "Failed to toggle follow status" });
  }
};

const toggleBlock = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { username } = req.params;
    const currentUser = await getOrCreateUser(userId);
    const targetUser = await User.findOne({ username });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser._id.equals(currentUser._id)) {
      return res.status(400).json({ message: "Cannot block yourself" });
    }

    if (!currentUser.blockedUsers) currentUser.blockedUsers = [];

    const isBlocked = currentUser.blockedUsers.some(
      (bId) => bId.toString() === targetUser._id.toString(),
    );

    if (isBlocked) {
      // Unblock
      currentUser.blockedUsers = currentUser.blockedUsers.filter(
        (bId) => bId.toString() !== targetUser._id.toString(),
      );
    } else {
      // Block (also unfollow both ways)
      currentUser.blockedUsers.push(targetUser._id);

      targetUser.followers = (targetUser.followers || []).filter(
        (fId) => fId.toString() !== currentUser._id.toString(),
      );
      currentUser.following = (currentUser.following || []).filter(
        (fId) => fId.toString() !== targetUser._id.toString(),
      );

      currentUser.followers = (currentUser.followers || []).filter(
        (fId) => fId.toString() !== targetUser._id.toString(),
      );
      targetUser.following = (targetUser.following || []).filter(
        (fId) => fId.toString() !== currentUser._id.toString(),
      );
    }

    await Promise.all([currentUser.save(), targetUser.save()]);

    await invalidateFeedCache(currentUser._id.toString());

    res.json({
      isBlocked: !isBlocked,
      isFollowing: false,
      followersCount: targetUser.followers.length,
      followingCount: targetUser.following.length,
    });
  } catch (error) {
    console.error("Toggle block error:", error);
    res.status(500).json({ message: "Failed to toggle block status" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { username, name, bio, profileImage } = req.body;

    const updateFields = {};
    if (username !== undefined && username.trim()) {
      const cleanUsername = username
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, "");

      const existingUser = await User.findOne({
        username: cleanUsername,
        clerkId: { $ne: userId },
      });

      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }
      updateFields.username = cleanUsername;
    }

    if (name !== undefined) updateFields.name = name;
    if (bio !== undefined) updateFields.bio = bio;
    if (profileImage !== undefined) updateFields.profileImage = profileImage;

    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      { $set: updateFields },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

module.exports = {
  getMe,
  getProfile,
  toggleFollow,
  toggleBlock,
  updateProfile,
};
