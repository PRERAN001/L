const mongoose = require("mongoose");

const liveSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      default: "",
    },

    streamUrl: {
      type: String,
      default: "",
    },

    viewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    isLive: {
      type: Boolean,
      default: false,
      index: true,
    },

    startedAt: Date,

    endedAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Live", liveSchema);