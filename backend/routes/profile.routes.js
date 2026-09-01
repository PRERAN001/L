const express = require("express");
const auth = require("../middleware/auth");

const {
  getMe,
  getProfile,
  updateProfile,
} = require("../controllers/profile.controller");

const router = express.Router();

router.get("/me", auth, getMe);
router.get("/:username", auth, getProfile);
router.patch("/", auth, updateProfile);

module.exports = router;