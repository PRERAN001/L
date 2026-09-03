const Post = require("../models/model.post");
const User = require("../models/model.user");
const { redis } = require("../redis/index");

const FANOUT_THRESHOLD = 500;

const generateFollowingCandidates = async ({
  user,
  cursor,
  limit,
}) => {
  console.log(`[DEBUG] [candidateService] Starting generateFollowingCandidates. User ID: ${user._id}, cursor: ${cursor}, limit: ${limit}`);

  const candidateLimit = limit ? limit * 2 : 100;

  const feedKey = `feed:${user._id}`;

  let redisPostIds = [];

  if (redis && redis.isOpen) {
    try {
    // cursor is a timestamp string (ms) when paginating; null on first load
    if (!cursor || isNaN(Number(cursor)) || Number(cursor) < 1000000000000) {
        redisPostIds = await redis.zRange(
          feedKey,
          0,
          candidateLimit - 1,
          {
            REV: true,
          }
        );
      } else {
        redisPostIds = await redis.zRange(
          feedKey,
          `(${cursor}`,
          "-inf",
          {
            REV: true,
            BY: "SCORE",
            LIMIT: {
              offset: 0,
              count: candidateLimit,
            },
          }
        );
      }
      console.log(`[DEBUG] [candidateService] Redis returned ${redisPostIds.length} candidate post IDs.`);
    } catch (err) {
      console.warn(
        "Redis zRange warning in generateFollowingCandidates:",
        err.message
      );
    }
  }

  // ==========================================
  // 2. LARGE ACCOUNTS (FANOUT ON READ)
  // ==========================================

  const largeAccounts = await User.find({
    _id: {
      $in: user.following || [],
    },
    $expr: {
      $gte: [
        {
          $size: "$followers",
        },
        FANOUT_THRESHOLD,
      ],
    },
  }).select("_id");

  const largeAccountIds = largeAccounts.map(
    (account) => account._id
  );

  let largeAccountPosts = [];

  if (largeAccountIds.length > 0) {
    const query = {
      user: {
        $in: largeAccountIds,
      },
    };

    const tsMs = Number(cursor);
    if (cursor && !isNaN(tsMs) && tsMs > 1000000000000) {
      query.createdAt = {
        $lt: new Date(tsMs),
      };
    }

    largeAccountPosts = await Post.find(query)
      .sort({
        createdAt: -1,
      })
      .limit(candidateLimit)
      .populate(
        "user",
        "username name profileImage"
      )
      .populate(
        "comments.user",
        "username name profileImage"
      );
  }

  console.log(`[DEBUG] [candidateService] Found ${largeAccountPosts.length} posts from large accounts.`);

  // ==========================================
  // 3. DIRECT MONGODB POSTS (FOLLOWING + SELF)
  // ==========================================
  // Guarantees that user's own posts & followed user posts are candidate-ready

  const followingAndSelfIds = [
    ...(user.following || []),
    user._id,
  ];

  const dbQuery = {
    user: {
      $in: followingAndSelfIds,
    },
  };

  const tsMs2 = Number(cursor);
  if (cursor && !isNaN(tsMs2) && tsMs2 > 1000000000000) {
    dbQuery.createdAt = {
      $lt: new Date(tsMs2),
    };
  }

  const directFollowingPosts = await Post.find(dbQuery)
    .sort({
      createdAt: -1,
    })
    .limit(candidateLimit)
    .populate(
      "user",
      "username name profileImage"
    )
    .populate(
      "comments.user",
      "username name profileImage"
    );

  console.log(`[DEBUG] [candidateService] Found ${directFollowingPosts.length} direct following/self posts from MongoDB.`);

  // ==========================================
  // 4. GET REDIS POSTS FROM MONGODB
  // ==========================================

  let redisPosts = [];

  if (redisPostIds.length > 0) {
    redisPosts = await Post.find({
      _id: {
        $in: redisPostIds,
      },
    })
      .populate(
        "user",
        "username name profileImage"
      )
      .populate(
        "comments.user",
        "username name profileImage"
      );
  }

  // ==========================================
  // 5. RESTORE REDIS ORDER
  // ==========================================

  const postMap = new Map(
    redisPosts.map((post) => [
      post._id.toString(),
      post,
    ])
  );

  const orderedRedisPosts = redisPostIds
    .map((id) => postMap.get(id))
    .filter(Boolean);

  // ==========================================
  // 6. MERGE
  // ==========================================

  const allPosts = [
    ...orderedRedisPosts,
    ...directFollowingPosts,
    ...largeAccountPosts,
  ];

  // ==========================================
  // 7. REMOVE DUPLICATES
  // ==========================================

  const seen = new Set();

  const uniquePosts = allPosts.filter((post) => {
    if (!post || !post._id) return false;
    const id = post._id.toString();

    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });

  // ==========================================
  // 8. SORT
  // ==========================================

  uniquePosts.sort(
    (a, b) =>
      new Date(b.createdAt) -
      new Date(a.createdAt)
  );

  console.log(`[DEBUG] [candidateService] Total unique following candidates returned: ${uniquePosts.length}`);

  return uniquePosts.map((post) => ({
    post,
    source: "following",
  }));
};

module.exports = {
  generateFollowingCandidates,
};