const User = require("../models/model.user");

/**
 * Gets an existing user by clerkId or creates a new user document in MongoDB.
 */
async function getOrCreateUser(clerkId) {
  if (!clerkId) return null;

  let user = await User.findOne({ clerkId });

  if (!user) {
    const shortId = clerkId.slice(-6);
    const defaultUsername = `user_${shortId}`;
    const defaultName = `User ${shortId}`;
    const defaultAvatar = `https://i.pravatar.cc/150?u=${clerkId}`;

    user = await User.create({
      clerkId,
      username: defaultUsername,
      name: defaultName,
      profileImage: defaultAvatar,
      bio: "Welcome to my profile!",
    });
  }

  return user;
}

module.exports = {
  getOrCreateUser,
};
