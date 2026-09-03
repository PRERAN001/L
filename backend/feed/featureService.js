const extractCandidateFeatures = (
  candidates,
  user
) => {
  console.log(`[DEBUG] [featureService] Extracting candidate features for ${candidates.length} candidates. User ID: ${user?._id}`);
  return candidates.map(
    ({ post, source }) => {
      const now = Date.now();

      const postAgeMs =
        now -
        new Date(post.createdAt).getTime();

      const postAgeHours =
        postAgeMs /
        (1000 * 60 * 60);

      const authorId = post.user?._id
        ? post.user._id.toString()
        : post.user?.toString();

      const isSelf = user?._id
        ? user._id.toString() === authorId
        : false;

      const isFollowingAuthor =
        isSelf ||
        (user?.following?.some(
          (userId) =>
            userId.toString() === authorId
        ) || false);

      console.log(`[DEBUG] [featureService] Post ID: ${post._id}, Author: ${authorId}, isSelf: ${isSelf}, isFollowingAuthor: ${isFollowingAuthor}, Age (hrs): ${postAgeHours.toFixed(2)}, Likes: ${post.likes?.length || 0}, Comments: ${post.comments?.length || 0}, Source: ${source}`);

      return {
        post,
        features: {
          likes:
            post.likes?.length || 0,

          comments:
            post.comments?.length || 0,

          postAgeHours,

          isFollowingAuthor,

          isSelf,

          mediaType:
            post.mediaType,

          source,
        },
      };
    }
  );
};

const extractFeatures = (candidates, user) => {
  return extractCandidateFeatures(candidates, user);
};

module.exports = {
  extractCandidateFeatures,
  extractFeatures,
};