const Live = require("../models/model.live");
const { getOrCreateUser } = require("../utils/userHelper");

const startLive = async (req, res) => {
  try {
    const { title, streamUrl } = req.body;
    const clerkId = req.auth?.userId;

    if (!clerkId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getOrCreateUser(clerkId);

    const live = await Live.create({
      user: user._id,
      title,
      streamUrl,
      isLive: true,
      startedAt: new Date(),
    });

    const populatedLive = await Live.findById(live._id).populate("user", "username profileImage");
    res.status(201).json(populatedLive);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to start live" });
  }
};

const getLiveStreams = async (req, res) => {
  try {
    const streams = await Live.find({ isLive: true })
      .populate("user", "username profileImage")
      .sort({ startedAt: -1 });

    res.json(streams);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get live streams" });
  }
};

const endLive = async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getOrCreateUser(clerkId);

    const live = await Live.findOneAndUpdate(
      {
        user: user._id,
        isLive: true,
      },
      {
        isLive: false,
        endedAt: new Date(),
      },
      { new: true }
    );

    res.json(live);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to end live" });
  }
};

module.exports = {
  startLive,
  getLiveStreams,
  endLive,
};