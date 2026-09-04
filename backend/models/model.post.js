const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    mediaUrl: {
      type: String,
      required: true,
    },

    mediaType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },

    caption: {
      type: String,
      default: "",
    },

    // 384-dim sentence-transformer vector for content-based ranking.
    // Generated at post creation time; null if embedding service was unavailable.
    embedding: {
      type: [Number],
      default: undefined,
      select: false,          // excluded from normal queries — only loaded when needed
    },

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        text: {
          type: String,
          required: true,
        },
        embedding: {
          type: [Number],
          default: []
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

postSchema.index({ createdAt: -1 });

const post =mongoose.model("Post", postSchema);
module.exports = post;