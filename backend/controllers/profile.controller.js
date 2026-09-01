const User = require("../models/User");

const getProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({
      username,
    }).select("-followers -following");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to get profile",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    const {
      username,
      name,
      bio,
      profileImage,
    } = req.body;

    const user = await User.findOneAndUpdate(
      { clerkId },
      {
        username,
        name,
        bio,
        profileImage,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to update profile",
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
};