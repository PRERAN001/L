require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");
const { connectRedis } = require("./redis/index");
const mediaRoutes = require("./routes/media.routes");
const profileRoutes = require("./routes/profile.routes");
const feedRoutes = require("./routes/feed.routes");
const storyRoutes = require("./routes/story.routes");
const searchRoutes = require("./routes/search.routes");
const liveRoutes = require("./routes/live.routes");

const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "upload")));

// Clerk
app.use(clerkMiddleware({
  publishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
}));

app.use("/api/media", mediaRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/live", liveRoutes);

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI).then(()=>{
      console.log("mongo db connected")
    });

    await connectRedis();

    app.listen(3000, () => {
      console.log("Server running on port 3000");
    });

  } catch (error) {
    console.error("Server startup error:", error);
  }
};

startServer();

