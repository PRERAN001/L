const Story = require("../models/Story");
const User = require("../models/User");

const createStory = async (req, res) => {
  try {
    const { mediaUrl, mediaType } = req.body;

    const clerkId = req.auth.userId;

    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const story = await Story.create({
      user: user._id,
      mediaUrl,
      mediaType,

      expiresAt: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ),
    });

    res.status(201).json(story);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create story",
    });
  }
};

const getStories = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const users = [
      ...user.following,
      user._id,
    ];

    const stories = await Story.find({
      user: {
        $in: users,
      },

      expiresAt: {
        $gt: new Date(),
      },
    })
      .populate("user", "username profileImage")
      .sort({ createdAt: -1 });

    res.json(stories);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to get stories",
    });
  }
};

module.exports = {
  createStory,
  getStories,
};