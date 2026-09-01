const express = require("express");

const {
  getFeed,
} = require("../controllers/feed.controller");

const router = express.Router();

router.get("/", getFeed);

module.exports = router;