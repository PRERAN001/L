require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/model.user");
const Post = require("./models/model.post");
const FeedEvent = require("./models/model.feedEvent");
const { connectRedis, getRedisClient } = require("./redis/index");
const { getPostEmbedding } = require("./utils/embeddingClient");

// 100 High-Quality Unique Unsplash Image URLs
const samplePhotos = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1511765224389-37f0e77cf0eb?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1439853949127-fa647821eba0?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1510784722466-f2aa9c52fff6?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=81"
];

// Unique Captions List
const sampleCaptions = [
  "Breathtaking view from today's mountain hike! 🏞️✨",
  "Late night coding sessions & fresh coffee ☕💻",
  "Unforgettable weekend vibes with my favorite people 🎉",
  "Delicious homemade pizza makes every evening better 🍕🔥",
  "Chasing endless golden hour sunsets 🌅🧡",
  "Exploring hidden alleyways and vintage cafes in the city 🏙️🚶‍♂️",
  "Nature never fails to take my breath away 🌲🍃",
  "Stay curious, stay creative, and keep building 🚀",
  "Cozy Sunday morning reading with a warm cup of tea 📖☕",
  "Living in the moment and catching good memories ✨📸",
  "Golden hour hits different when you're by the beach 🌄🌊",
  "Work hard in silence, let your progress make the noise 💪💯",
  "Finding joy in the simple, quiet pleasures of life 🌻",
  "Never stop exploring new horizons and fresh perspectives 🗺️✨",
  "Good times, warm sunshine, and ocean waves 🏖️☀️",
  "Freshly brewed espresso to kickstart a productive week ☕⚡",
  "Architecture that speaks to the soul 🏛️💫",
  "A quiet walk in the forest is all the therapy I need 🍃🍂",
  "Tasting authentic street food in the heart of downtown 🌮😋",
  "Milestones achieved, on to the next big challenge! 🎯🏆",
  "The beauty of autumn colors in full bloom 🍁🍁",
  "Distant mountain tops covered in fresh snow 🏔️❄️",
  "Art is not what you see, but what you make others see 🎨🖌️",
  "Late night city lights and rainy street reflections 🌧️🌃",
  "Sweat now, shine later! Morning workout completed 🏋️‍♂️🔥",
  "Fresh bakery treats to sweeten the day 🥐🍰",
  "Surrounding myself with good energy and positive vibes ✨🌿",
  "Stargazing under a crystal clear night sky 🌌⭐",
  "Every sunset brings the promise of a new dawn 🌄",
  "A quick weekend getaway to recharge the mind 🚗💨",
  "Minimalist aesthetics & clean design inspiration 📐📱",
  "Fresh smoothie bowl to start the morning right 🍓🥣",
  "Road trips and endless playlists 🎵ädt",
  "Capturing candid moments that last forever 📷🤍",
  "Morning mist over the peaceful lake 🌫️⛵",
  "Chasing dreams and making them reality 💫🌟",
  "The aroma of fresh coffee in the early morning ☕☀️",
  "Exploring coastal trails with a sea breeze 🌊🌊",
  "Creative process in action - turning ideas into code 💻🔮",
  "Warm bonfire nights under the stars 🪵🔥",
  "Tacos & sunshine make the ultimate combo 🌮☀️",
  "Feast for the eyes and the stomach 🍲✨",
  "Fitness journey progress - consistency is key 💪📊",
  "Wandering through ancient cobblestone streets 🏰🌾",
  "Sun-kissed mornings & gentle ocean breezes 🌅🌴",
  "A bowl of hot ramen on a chilly evening 🍜❄️",
  "Dreaming big, working focused, staying humble 🚀✨",
  "Unwinding with a great book after a busy day 📚🛋️",
  "Nature's canvas is filled with vibrant colors 🎨🌸",
  "Finding peace away from the urban noise 🌿🏞️"
];

const sampleBios = [
  "Tech enthusiast & photo lover 📸",
  "Exploring the world one photo at a time 🌎",
  "Coffee, code, and good music ☕💻🎵",
  "Digital creator & designer 🎨",
  "Fitness & healthy living 💪",
  "Foodie on a mission 🍕🍩",
  "Living life in high resolution 📷",
  "Wanderlust ✈️ | Traveler 🏔️",
  "Building cool things on the web 🌐",
  "Passionate about storytelling & art ✨",
];

async function resetAndReSeed() {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/L";
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    // 1. DELETE ALL EXISTING POSTS & FEED EVENTS
    console.log("Deleting all existing Post documents...");
    const postDeleteResult = await Post.deleteMany({});
    console.log(`Deleted ${postDeleteResult.deletedCount} posts.`);

    console.log("Deleting all existing FeedEvent documents...");
    const eventDeleteResult = await FeedEvent.deleteMany({});
    console.log(`Deleted ${eventDeleteResult.deletedCount} feed events.`);

    // 2. RESET ALL USERS: SET FOLLOWING = [] AND FOLLOWERS = []
    console.log("Resetting following & followers to [] (0 following/followers) for ALL users...");
    await User.updateMany({}, { $set: { following: [], followers: [] } });

    // Ensure 50 users (user1 to user50) exist in MongoDB
    console.log("Ensuring 50 user accounts (user1 to user50) exist...");
    const userDocs = [];
    for (let i = 1; i <= 50; i++) {
      const username = `user${i}`;
      const clerkId = `clerk_user${i}`;
      const name = `User ${i}`;
      const bio = sampleBios[(i - 1) % sampleBios.length];
      const profileImage = `https://i.pravatar.cc/300?u=user${i}`;

      const user = await User.findOneAndUpdate(
        { username },
        {
          clerkId,
          username,
          name,
          bio,
          profileImage,
          following: [],
          followers: [],
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      userDocs.push(user);
    }
    console.log(`Successfully verified ${userDocs.length} users with 0 followers and 0 following.`);

    // 3. CREATE NEW POSTS (1 POST PER USER ACCOUNT = 50 POSTS TOTAL)
    console.log("Creating new posts for all 50 accounts with unique photos & unique captions...");
    const createdPosts = [];

    for (let i = 0; i < userDocs.length; i++) {
      const author = userDocs[i];
      const photoUrl = samplePhotos[i % samplePhotos.length];
      const caption = sampleCaptions[i % sampleCaptions.length] + (i >= sampleCaptions.length ? ` (#${i + 1})` : "");

      // Random creation date over the last 14 days
      const daysAgo = Math.floor(Math.random() * 14);
      const hoursAgo = Math.floor(Math.random() * 24);
      const createdAt = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000 + hoursAgo * 60 * 60 * 1000));

      const embedding = await getPostEmbedding({ caption, mediaType: "image" });

      const post = new Post({
        user: author._id,
        mediaUrl: photoUrl,
        mediaType: "image",
        caption,
        embedding: embedding || undefined,
        likes: [],
        comments: [],
        createdAt,
      });

      await post.save();
      createdPosts.push(post);
    }

    console.log(`Successfully posted ${createdPosts.length} new posts (1 post per user account)!`);

    // 4. CLEAR REDIS KEYS (IF REDIS IS CONNECTED)
    try {
      await connectRedis();
      const redis = getRedisClient();
      if (redis) {
        const keys = await redis.keys("feed:*");
        if (keys.length > 0) {
          await redis.del(...keys);
          console.log(`Cleared ${keys.length} feed cache keys in Redis.`);
        }
        await redis.del("trending:posts");
        console.log("Cleared trending:posts cache key in Redis.");
      }
    } catch (redisErr) {
      console.log("Redis cache clear step skipped (Redis not active or unreachable):", redisErr.message);
    }

    console.log("\n--- RESET & RE-SEED SUMMARY ---");
    console.log(`Total Accounts Reset: ${userDocs.length} (user1 to user50)`);
    console.log(`Following Count: 0 across all accounts`);
    console.log(`Followers Count: 0 across all accounts`);
    console.log(`New Posts Created: ${createdPosts.length} (1 unique post per account)`);
    console.log("---------------------------------\n");

  } catch (error) {
    console.error("Error during reset and re-seed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected. Done!");
    process.exit(0);
  }
}

resetAndReSeed();
