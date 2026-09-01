const express = require("express");

const {
  getProfile,
  updateProfile,
} = require("../controllers/profile.controller");

const router = express.Router();

router.get("/:username", getProfile);

router.patch("/", updateProfile);

module.exports = router;