require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const User = require("./models/model.user");
const Post = require("./models/model.post");
const { getPostEmbedding } = require("./utils/embeddingClient");

const VID_DIR = "C:\\Users\\prera\\Downloads\\vid";
const UPLOAD_VIDEOS_DIR = path.join(__dirname, "upload", "videos");
const BASE_URL = process.env.EXPO_PUBLIC_API_URL 
  ? process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, "")
  : "http://192.168.29.154:3000";

async function uploadToCloudinary(filePath, fileName) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: "video/mp4" });
    const formData = new FormData();
    formData.append("file", blob, fileName);
    formData.append("upload_preset", "blog_upload");
    formData.append("resource_type", "video");

    console.log(`[Cloudinary] Uploading ${fileName}...`);
    const response = await fetch(
      "https://api.cloudinary.com/v1_1/dxn29vjxu/video/upload",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();
    if (response.ok && data.secure_url) {
      console.log(`[Cloudinary] Success: ${data.secure_url}`);
      return data.secure_url;
    } else {
      console.warn(`[Cloudinary] Error for ${fileName}:`, data.error?.message || data);
      return null;
    }
  } catch (err) {
    console.warn(`[Cloudinary] Failed to upload ${fileName}:`, err.message);
    return null;
  }
}

async function uploadReels() {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/L";
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    // 1. DELETE EXISTING DUMMY REELS (mediaType === "video")
    console.log("Removing all existing dummy reel posts (mediaType = 'video')...");
    const deleteResult = await Post.deleteMany({ mediaType: "video" });
    console.log(`Deleted ${deleteResult.deletedCount} existing dummy video reels.`);

    // 2. FETCH ALL USERS
    const users = await User.find({});
    if (users.length === 0) {
      console.error("No users found in database. Run seeder first!");
      return;
    }
    console.log(`Found ${users.length} user accounts to distribute video reels to.`);

    // 3. READ VIDEO FILES FROM DOWNLOADS DIR
    if (!fs.existsSync(VID_DIR)) {
      console.error(`Directory not found: ${VID_DIR}`);
      return;
    }

    const files = fs.readdirSync(VID_DIR).filter(f => f.endsWith(".mp4"));
    console.log(`Found ${files.length} video files in ${VID_DIR}.`);

    if (files.length === 0) {
      console.error("No .mp4 video files found.");
      return;
    }

    // Ensure upload/videos directory exists
    if (!fs.existsSync(UPLOAD_VIDEOS_DIR)) {
      fs.mkdirSync(UPLOAD_VIDEOS_DIR, { recursive: true });
    }

    const createdReels = [];

    for (let i = 0; i < files.length; i++) {
      const fileName = files[i];
      const sourcePath = path.join(VID_DIR, fileName);

      // Copy file to backend/upload/videos for static serving fallback
      const sanitizedFilename = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const targetPath = path.join(UPLOAD_VIDEOS_DIR, sanitizedFilename);
      fs.copyFileSync(sourcePath, targetPath);

      const localMediaUrl = `${BASE_URL}/uploads/videos/${encodeURIComponent(sanitizedFilename)}`;

      // Try Cloudinary upload first
      const cloudinaryUrl = await uploadToCloudinary(sourcePath, fileName);
      const mediaUrl = cloudinaryUrl || localMediaUrl;

      // Assign to a random user account among the available users
      const randomUser = users[Math.floor(Math.random() * users.length)];

      // Caption is the exact file name
      const caption = fileName;

      // Generate embedding vector
      const embedding = await getPostEmbedding({ caption, mediaType: "video" });

      const post = new Post({
        user: randomUser._id,
        mediaUrl,
        mediaType: "video",
        caption,
        embedding: embedding || undefined,
        likes: [],
        comments: [],
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)), // within last 7 days
      });

      await post.save();
      createdReels.push(post);

      console.log(`[REEL ${i + 1}/${files.length}] Created reel "${caption}" for user ${randomUser.username} -> ${mediaUrl}`);
    }

    console.log("\n=======================================================");
    console.log(`SUCCESSFULLY CREATED ${createdReels.length} NEW VIDEO REELS!`);
    console.log(`All dummy reels were removed.`);
    console.log(`Videos distributed across random user accounts.`);
    console.log("=======================================================\n");

  } catch (error) {
    console.error("Error creating video reels:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected. Done!");
    process.exit(0);
  }
}

uploadReels();
