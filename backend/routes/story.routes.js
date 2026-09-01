const express = require("express");

const {
  createStory,
  getStories,
} = require("../controllers/story.controller");

const router = express.Router();

router.post("/", createStory);

router.get("/", getStories);

module.exports = router;