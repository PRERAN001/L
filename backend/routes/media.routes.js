const express = require("express");

const {
  createPost,
} = require("../controllers/media.controller");

const router = express.Router();

router.post("/", createPost);

module.exports = router;