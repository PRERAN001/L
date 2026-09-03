const express = require("express");
const auth = require("../middleware/auth");
const {
  getFeed,
  toggleLikePost,
  getComments,
  addComment,
} = require("../controllers/feed.controller");
const { recordEvents } = require("../controllers/feedEvent.controller");

const router = express.Router();

router.get("/", auth, getFeed);
router.post("/events", auth, recordEvents);       // batch event ingestion
router.post("/:postId/like", auth, toggleLikePost);
router.get("/:postId/comments", auth, getComments);
router.post("/:postId/comments", auth, addComment);

module.exports = router;