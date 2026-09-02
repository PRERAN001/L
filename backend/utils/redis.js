const { createClient } = require("redis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const redisClient = createClient({
  url: REDIS_URL,
});

let isConnected = false;

redisClient.on("error", (err) => {
  console.error("[REDIS ERROR]", err.message);
});

redisClient.on("connect", () => {
  console.log("Redis connected successfully.");
  isConnected = true;
});

async function initRedis() {
  if (!isConnected && !redisClient.isOpen) {
    try {
      await redisClient.connect();
      isConnected = true;
    } catch (err) {
      console.error("Failed to connect to Redis:", err.message);
      isConnected = false;
    }
  }
  return isConnected;
}

// Initiate connection
initRedis();

/**
 * Get cached feed data for a user with specific cursor & limit.
 */
async function getCachedFeed(userId, cursor = "initial", limit = 20) {
  if (!isConnected || !redisClient.isOpen) return null;
  try {
    const key = `feed:${userId}:${cursor}:${limit}`;
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("Error reading feed cache from Redis:", err.message);
  }
  return null;
}

/**
 * Set feed data cache in Redis with TTL (default 60 seconds).
 */
async function setCachedFeed(userId, cursor = "initial", limit = 20, data, ttlSeconds = 60) {
  if (!isConnected || !redisClient.isOpen) return;
  try {
    const key = `feed:${userId}:${cursor}:${limit}`;
    await redisClient.set(key, JSON.stringify(data), { EX: ttlSeconds });
  } catch (err) {
    console.error("Error writing feed cache to Redis:", err.message);
  }
}

/**
 * Invalidate feed caches (e.g. on new post creation, likes, comments, or follow changes).
 */
async function invalidateFeedCache(userId = null) {
  if (!isConnected || !redisClient.isOpen) return;
  try {
    const pattern = userId ? `feed:${userId}:*` : `feed:*`;
    const keys = [];
    for await (const key of redisClient.scanIterator({ MATCH: pattern })) {
      keys.push(key);
    }
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`[REDIS] Invalidated ${keys.length} feed cache key(s).`);
    }
  } catch (err) {
    console.error("Error invalidating feed cache in Redis:", err.message);
  }
}

module.exports = {
  redisClient,
  initRedis,
  getCachedFeed,
  setCachedFeed,
  invalidateFeedCache,
};
