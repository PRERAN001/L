const Story = require("../models/model.story");
const { getOrCreateUser } = require("../utils/userHelper");
const { getPostEmbedding } = require("../utils/embeddingClient");

const createStory = async (req, res) => {
  try {
    const { mediaUrl, mediaType = "image", caption = "" } = req.body;
    const clerkId = req.auth?.userId;

    if (!clerkId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getOrCreateUser(clerkId);

    const story = await Story.create({
      user: user._id,
      mediaUrl,
      mediaType,
      caption,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // ------------------------------------------------
    // Generate & store caption embedding (best-effort)
    // ------------------------------------------------
    (async () => {
      try {
        const embedding = await getPostEmbedding({ caption, mediaType });

        if (embedding) {
          await Story.updateOne(
            { _id: story._id },
            { $set: { embedding } }
          );
          console.log(
            `[DEBUG] [storyController] Embedding stored for story ${story._id} (${embedding.length} dims)`
          );
        }
      } catch (embErr) {
        console.warn("[storyController] Background embedding failed:", embErr.message);
      }
    })();

    const populatedStory = await Story.findById(story._id).populate("user", "username profileImage");
    res.status(201).json(populatedStory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create story" });
  }
};

const getStories = async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getOrCreateUser(clerkId);

    const userIds = [
      ...(user.following || []),
      user._id,
    ];

    let stories = await Story.find({
      user: { $in: userIds },
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "username profileImage")
      .sort({ createdAt: -1 });

    if (stories.length === 0) {
      stories = await Story.find({
        expiresAt: { $gt: new Date() },
      })
        .populate("user", "username profileImage")
        .sort({ createdAt: -1 });
    }

    res.json(stories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get stories" });
  }
};

module.exports = {
  createStory,
  getStories,
};