const User = require("../models/model.user");

/**
 * Gets an existing user by clerkId or creates a new user document in MongoDB.
 */
async function getOrCreateUser(clerkId, clerkUserData = null) {
  if (!clerkId) return null;

  let user = await User.findOne({ clerkId });

  if (!user) {
    const shortId = clerkId.slice(-6);
    let baseUsername =
      clerkUserData?.username ||
      clerkUserData?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
      `user_${shortId}`;

    baseUsername = baseUsername
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_.]/g, "");

    // Ensure unique username
    let finalUsername = baseUsername || `user_${shortId}`;
    let existing = await User.findOne({ username: finalUsername });
    let counter = 1;
    while (existing) {
      finalUsername = `${baseUsername}_${counter}`;
      existing = await User.findOne({ username: finalUsername });
      counter++;
    }

    const defaultName =
      clerkUserData?.fullName ||
      clerkUserData?.firstName ||
      `User ${shortId}`;
    const defaultAvatar =
      clerkUserData?.imageUrl || `https://i.pravatar.cc/150?u=${clerkId}`;

    user = await User.create({
      clerkId,
      username: finalUsername,
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
