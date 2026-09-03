require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const User = require("./models/model.user");
const Post = require("./models/model.post");
const FeedEvent = require("./models/model.feedEvent");

async function seedFeedEvents() {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/L";
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    console.log("Connected to MongoDB.");

    // 1. DELETE ALL EXISTING FEED EVENTS
    console.log("Deleting all existing FeedEvent documents from MongoDB...");
    const deleteResult = await FeedEvent.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing FeedEvent documents.`);

    // 2. FETCH USERS AND POSTS
    let users = await User.find({});
    let posts = await Post.find({});

    console.log(`Found ${users.length} users and ${posts.length} posts in MongoDB.`);

    if (users.length === 0 || posts.length === 0) {
      console.log("No users or posts found. Please run seedUsersAndPosts.js first!");
      return;
    }

    // 3. GENERATE SYNTHETIC MULTI-OBJECTIVE FEED EVENTS
    const eventsToCreate = [];
    const csvRows = [
      "userId,postId,likes,comments,postAgeHours,isFollowing,source,like,comment,share,view"
    ];

    const now = Date.now();

    for (const user of users) {
      const followingSet = new Set(
        (user.following || []).map((id) => id.toString())
      );

      for (const post of posts) {
        const isSelf = post.user.toString() === user._id.toString();
        const isFollowing = isSelf || followingSet.has(post.user.toString()) ? 1 : 0;

        let source = "exploration";
        if (isFollowing) {
          source = "following";
        } else if (Math.random() < 0.3) {
          source = "trending";
        }

        const likes = post.likes?.length || 0;
        const comments = post.comments?.length || 0;
        const postAgeMs = now - new Date(post.createdAt).getTime();
        const postAgeHours = Math.max(0.1, postAgeMs / (1000 * 60 * 60));

        // Base probability of engagement
        let probFactor = 0.15;
        if (isFollowing) probFactor += 0.35;
        if (postAgeHours < 24) probFactor += 0.25;
        if (likes > 10) probFactor += 0.15;

        // 75% chance user encounters this post in feed
        if (Math.random() > 0.75) continue;

        const eventTime = new Date(
          new Date(post.createdAt).getTime() + Math.random() * Math.max(1000, now - new Date(post.createdAt).getTime())
        );

        // Always record impression event in DB
        eventsToCreate.push({
          user: user._id,
          post: post._id,
          eventType: "impression",
          timestamp: eventTime,
        });

        // Determine 4 multi-objective outcome labels for this user-post interaction
        const isViewed = Math.random() < Math.min(0.95, probFactor + 0.2);
        const isLiked = isViewed && Math.random() < Math.min(0.85, probFactor + 0.1);
        const isCommented = isLiked && Math.random() < 0.35;
        const isShared = isViewed && Math.random() < 0.20;

        const targetLike = isLiked ? 1 : 0;
        const targetComment = isCommented ? 1 : 0;
        const targetShare = isShared ? 1 : 0;
        const targetView = isViewed ? 1 : 0;

        // Record granular events into MongoDB for telemetry tracking
        if (isViewed) {
          eventsToCreate.push({
            user: user._id,
            post: post._id,
            eventType: "view",
            timestamp: new Date(eventTime.getTime() + 2000),
          });
        }
        if (isLiked) {
          eventsToCreate.push({
            user: user._id,
            post: post._id,
            eventType: "like",
            timestamp: new Date(eventTime.getTime() + 5000),
          });
        }
        if (isCommented) {
          eventsToCreate.push({
            user: user._id,
            post: post._id,
            eventType: "comment",
            timestamp: new Date(eventTime.getTime() + 15000),
          });
        }
        if (isShared) {
          eventsToCreate.push({
            user: user._id,
            post: post._id,
            eventType: "share",
            timestamp: new Date(eventTime.getTime() + 25000),
          });
        }
        if (!isViewed && !isLiked) {
          eventsToCreate.push({
            user: user._id,
            post: post._id,
            eventType: "skip",
            timestamp: new Date(eventTime.getTime() + 1000),
          });
        }

        // Add Multi-Objective ML Session Row to CSV
        csvRows.push(
          `${user._id.toString()},${post._id.toString()},${likes},${comments},${postAgeHours.toFixed(2)},${isFollowing},${source},${targetLike},${targetComment},${targetShare},${targetView}`
        );
      }
    }

    console.log(`Inserting ${eventsToCreate.length} new FeedEvent documents into MongoDB...`);
    await FeedEvent.insertMany(eventsToCreate, { ordered: false });
    console.log("MongoDB FeedEvent documents inserted successfully!");

    // 4. EXPORT TO ml/data/events.csv
    const mlDataDir = path.join(__dirname, "..", "ml", "data");
    if (!fs.existsSync(mlDataDir)) {
      fs.mkdirSync(mlDataDir, { recursive: true });
    }

    const csvPath = path.join(mlDataDir, "events.csv");
    fs.writeFileSync(csvPath, csvRows.join("\n"));
    console.log(`Exported Multi-Objective dataset to ${csvPath} (${csvRows.length - 1} records).`);

    // SUMMARY BREAKDOWN
    const breakdown = {};
    for (const e of eventsToCreate) {
      breakdown[e.eventType] = (breakdown[e.eventType] || 0) + 1;
    }

    console.log("\n--- MULTI-OBJECTIVE FEED EVENT SEED SUMMARY ---");
    console.log(`Total DB Events Inserted: ${eventsToCreate.length}`);
    console.log("Event Type Breakdown:", breakdown);
    console.log(`Total ML Training Samples (CSV): ${csvRows.length - 1}`);
    console.log("CSV Dataset Path:", csvPath);
    console.log("------------------------------------------------\n");

  } catch (error) {
    console.error("Error seeding feed events:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected. Done!");
    process.exit(0);
  }
}

seedFeedEvents();
