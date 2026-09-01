const express = require("express");

const {
  startLive,
  getLiveStreams,
  endLive,
} = require("../controllers/live.controller");

const router = express.Router();

router.post("/", startLive);

router.get("/", getLiveStreams);

router.delete("/", endLive);

module.exports = router;