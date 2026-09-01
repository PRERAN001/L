const express = require("express");
const auth = require("../middleware/auth");

const {
  startLive,
  getLiveStreams,
  endLive,
} = require("../controllers/live.controller");

const router = express.Router();

router.post("/",auth, startLive);

router.get("/",auth, getLiveStreams);

router.delete("/",auth, endLive);

module.exports = router;