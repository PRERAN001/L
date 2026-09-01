const User = require("../models/User");

const searchUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "");

    const users = await User.find({
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
    })
      .select("username name profileImage")
      .limit(20);

    res.json(users);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Search failed",
    });
  }
};

module.exports = {
  searchUsers,
};