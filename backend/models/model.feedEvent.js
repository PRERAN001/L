const mongoose = require("mongoose");

const feedEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },

    eventType: {
      type: String,
      enum: [
        "impression",
        "view",
        "like",
        "comment",
        "save",
        "share",
        "skip",
      ],
      required: true,
      index: true,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);


const FeedEvent= mongoose.model("FeedEvent", feedEventSchema);
module.exports = FeedEvent;