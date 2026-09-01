require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const mediaRoutes = require("./routes/media.routes");
const profileRoutes = require("./routes/profile.routes");
const feedRoutes = require("./routes/feed.routes");
const storyRoutes = require("./routes/story.routes");
const searchRoutes = require("./routes/search.routes");
const liveRoutes = require("./routes/live.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/media", mediaRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/live", liveRoutes);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");

    app.listen(3000, () => {
      console.log("Server running on port 3000");
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error);
  });