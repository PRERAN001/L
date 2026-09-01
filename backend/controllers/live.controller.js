const Live = require("../models/Live");
const User = require("../models/User");

const startLive = async (req, res) => {
  try {
    const { title, streamUrl } = req.body;

    const clerkId = req.auth.userId;

    const user = await User.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const live = await Live.create({
      user: user._id,
      title,
      streamUrl,
      isLive: true,
      startedAt: new Date(),
    });

    res.status(201).json(live);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to start live",
    });
  }
};

const getLiveStreams = async (req, res) => {
  try {
    const streams = await Live.find({
      isLive: true,
    })
      .populate("user", "username profileImage")
      .sort({ startedAt: -1 });

    res.json(streams);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to get live streams",
    });
  }
};

const endLive = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    const user = await User.findOne({ clerkId });

    const live = await Live.findOneAndUpdate(
      {
        user: user?._id,
        isLive: true,
      },
      {
        isLive: false,
        endedAt: new Date(),
      },
      {
        new: true,
      }
    );

    res.json(live);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to end live",
    });
  }
};

module.exports = {
  startLive,
  getLiveStreams,
  endLive,
};