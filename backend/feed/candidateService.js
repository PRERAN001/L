const Post = require("../models/model.post");
const User = require("../models/model.user");
const { redis } = require("../utils/redis");

const FANOUT_THRESHOLD = 500;

const generateFollowingCandidates = async ({
  user,
  cursor,
  limit,
}) => {
  const candidateLimit = limit * 2;

  const feedKey = `feed:${user._id}`;
    //fetching the feed from the redis  section 1

  let redisPostIds = [];

  if (!cursor) {
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

  // ==========================================
  // 3. POSTS FROM LARGE ACCOUNTS
  // ==========================================

  let largeAccountPosts = [];

  if (largeAccountIds.length > 0) {
    const query = {
      user: {
        $in: largeAccountIds,
      },
    };

    if (cursor) {
      query.createdAt = {
        $lt: new Date(Number(cursor)),
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
    ...largeAccountPosts,
  ];

  // ==========================================
  // 7. REMOVE DUPLICATES
  // ==========================================

  const seen = new Set();

  const uniquePosts = allPosts.filter((post) => {
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

  return uniquePosts;
};

module.exports = {
  generateFollowingCandidates,
};