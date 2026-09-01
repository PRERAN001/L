require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { clerkMiddleware } = require("@clerk/express");

const mediaRoutes = require("./routes/media.routes");
const profileRoutes = require("./routes/profile.routes");
const feedRoutes = require("./routes/feed.routes");
const storyRoutes = require("./routes/story.routes");
const searchRoutes = require("./routes/search.routes");
const liveRoutes = require("./routes/live.routes");

const app = express();

app.use(cors());
app.use(express.json());

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

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");

    const PORT = process.env.PORT || 3000;
    const HOST = "0.0.0.0";
    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT} (Access via http://192.168.29.154:${PORT})`);
    });
  })
  .catch((error) => {
    console.error(error);
  });