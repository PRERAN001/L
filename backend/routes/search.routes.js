const express = require("express");
const auth = require("../middleware/auth");

const {
  searchUsers,
} = require("../controllers/search.controller");

const router = express.Router();

router.get("/", auth,searchUsers);

module.exports = router;