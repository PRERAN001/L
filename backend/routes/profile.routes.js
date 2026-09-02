const express = require("express");
const auth = require("../middleware/auth");

const {
  getMe,
  getProfile,
  toggleFollow,
  toggleBlock,
  updateProfile,
} = require("../controllers/profile.controller");

const router = express.Router();

router.get("/me", auth, getMe);
router.get("/:username", auth, getProfile);
router.post("/:username/follow", auth, toggleFollow);
router.post("/:username/block", auth, toggleBlock);
router.patch("/", auth, updateProfile);

module.exports = router;