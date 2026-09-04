const express = require("express");
const auth = require("../middleware/auth");
const {
  getFeed,
  getReels,
  toggleLikePost,
  getComments,
  addComment,
  sharePost,
} = require("../controllers/feed.controller");
const { recordEvents } = require("../controllers/feedEvent.controller");

const router = express.Router();

router.get("/", auth, getFeed);
router.get("/reels", auth, getReels);
router.post("/events", auth, recordEvents);
router.post("/:postId/like", auth, toggleLikePost);
router.post("/:postId/share", auth, sharePost);
router.get("/:postId/comments", auth, getComments);
router.post("/:postId/comments", auth, addComment);

module.exports = router;