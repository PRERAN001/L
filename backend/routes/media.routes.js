const express = require("express");
const auth = require("../middleware/auth");

const {
  createPost,
} = require("../controllers/media.controller");

const router = express.Router();

router.post("/",auth, createPost);

module.exports = router;