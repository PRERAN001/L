const User = require("../models/model.user");
const { getOrCreateUser } = require("../utils/userHelper");

const searchUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const clerkId = req.auth?.userId;

    let currentUser = null;
    if (clerkId) {
      currentUser = await getOrCreateUser(clerkId);
    }

    const queryFilter = {
      $or: [
        {
          username: {
            $regex: q,
            $options: "i",
          },
        },
        {
          name: {
            $regex: q,
            $options: "i",
          },
        },
      ],
    };

    if (currentUser) {
      queryFilter._id = {
        $nin: [currentUser._id, ...(currentUser.blockedUsers || [])],
      };
    } else if (clerkId) {
      queryFilter.clerkId = { $ne: clerkId };
    }

    const users = await User.find(queryFilter)
      .select("username name profileImage followers following")
      .limit(20);

    const formattedUsers = users.map((u) => {
      const isFollowing = currentUser
        ? u.followers.some((fId) => fId.toString() === currentUser._id.toString())
        : false;
      return {
        _id: u._id,
        username: u.username,
        name: u.name,
        profileImage: u.profileImage,
        followersCount: u.followers?.length || 0,
        followingCount: u.following?.length || 0,
        isFollowing,
      };
    });

    res.json(formattedUsers);
  } catch (error) {
    console.error("Search error:", error);

    res.status(500).json({
      message: "Search failed",
    });
  }
};

module.exports = {
  searchUsers,
};