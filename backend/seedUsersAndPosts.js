require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/model.user");
const Post = require("./models/model.post");

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
];

const sampleCaptions = [
  "Breathtaking view from today's trip! 🏞️✨",
  "Late night coding sessions & coffee ☕💻",
  "Weekend vibes with good friends! 🎉",
  "Delicious food makes every day better 🍕🔥",
  "Chasing sunsets 🌅🧡",
  "Exploring new places in the city 🏙️🚶‍♂️",
  "Nature never fails to impress 🌲🍃",
  "Stay creative and keep building 🚀",
  "Cozy moments at home 📖☕",
  "Live in the moment ✨📸",
  "Golden hour magic 🌄",
  "Work hard, play harder 💪💯",
  "Simple pleasures of life 🌻",
  "Never stop exploring 🗺️✨",
  "Good times & tan lines 🏖️☀️",
];

const sampleComments = [
  "Awesome shot! 🔥",
  "Love this so much! ❤️",
  "Where was this taken? Looks amazing!",
  "So cool! 😎",
  "Great capture 📸✨",
  "Super aesthetic!",
  "Stunning view! 😍",
  "Nice setup 💻🚀",
  "Vibes on point ✨",
  "Need to visit this place soon!",
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

function getRandomItems(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/L";
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    console.log("Connected to MongoDB.");

    // Create 50 Users (user1 to user50)
    console.log("Creating 50 users (user1 to user50)...");
    const createdUsers = [];

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
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      createdUsers.push(user);
    }

    console.log(`Successfully created/updated ${createdUsers.length} users.`);

    // Establish follower / following connections between users
    console.log("Establishing follow relationships among users...");
    for (let i = 0; i < createdUsers.length; i++) {
      const user = createdUsers[i];
      // Select 5 to 15 random users to follow
      const otherUsers = createdUsers.filter((u) => u._id.toString() !== user._id.toString());
      const followCount = Math.floor(Math.random() * 11) + 5; // 5 to 15
      const usersToFollow = getRandomItems(otherUsers, followCount);

      const followingIds = usersToFollow.map((u) => u._id);
      user.following = followingIds;
      await user.save();

      // Also add this user to followers array of those users
      for (const followedUser of usersToFollow) {
        if (!followedUser.followers.includes(user._id)) {
          followedUser.followers.push(user._id);
          await followedUser.save();
        }
      }
    }
    console.log("Follow relationships updated.");

    // Create Posts for feed testing
    console.log("Creating posts with photos, captions, likes, and comments...");
    // Optionally clean up existing posts from these mock users if desired, or just create new ones
    // Let's create ~75 posts distributed among the users
    const totalPostsToCreate = 75;
    const createdPosts = [];

    for (let i = 0; i < totalPostsToCreate; i++) {
      const author = getRandomItem(createdUsers);
      const photoUrl = samplePhotos[i % samplePhotos.length];
      const caption = getRandomItem(sampleCaptions);

      // Random likes from 3 to 25 users
      const likeCount = Math.floor(Math.random() * 23) + 3;
      const likers = getRandomItems(createdUsers, likeCount).map((u) => u._id);

      // Random comments from 1 to 6 users
      const commentCount = Math.floor(Math.random() * 6) + 1;
      const commenters = getRandomItems(createdUsers, commentCount);
      const comments = commenters.map((commenter) => ({
        user: commenter._id,
        text: getRandomItem(sampleComments),
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 10 * 24 * 60 * 60 * 1000)), // within last 10 days
      }));

      // Random creation date over the last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const hoursAgo = Math.floor(Math.random() * 24);
      const createdAt = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000 + hoursAgo * 60 * 60 * 1000));

      const post = new Post({
        user: author._id,
        mediaUrl: photoUrl,
        mediaType: "image",
        caption,
        likes: likers,
        comments,
        createdAt,
      });

      await post.save();
      createdPosts.push(post);
    }

    console.log(`Successfully created ${createdPosts.length} posts with photos!`);
    console.log("\n--- SEED SUMMARY ---");
    console.log(`Users created: ${createdUsers.length} (user1 to user50)`);
    console.log(`Posts created: ${createdPosts.length}`);
    console.log("Follow network: Active across all users");
    console.log("--------------------\n");

  } catch (error) {
    console.error("Error during seeding:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected. Done!");
    process.exit(0);
  }
}

seed();
