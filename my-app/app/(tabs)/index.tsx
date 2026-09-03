import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import { useRouter, useFocusEffect } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { useFeedTracker } from "@/hooks/useFeedTracker";

export default function HomeScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination State
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Comments Modal State
  const [activePostForComments, setActivePostForComments] = useState<any | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // ─── Feed event tracking ─────────────────────────────────────────────────
  const { onPostViewable, onPostHidden, recordEngagement, resetTracking } =
    useFeedTracker();

  // scrollY and per-post layout positions — used to determine viewport visibility
  const scrollY = useRef(0);
  const scrollViewHeight = useRef(0);
  // postLayouts: postId -> { y: number; height: number }
  const postLayouts = useRef<Record<string, { y: number; height: number }>>({});

  // Called on every scroll event — checks which posts entered/left the viewport
  const checkViewability = useCallback(() => {
    const top = scrollY.current;
    const bottom = top + scrollViewHeight.current;
    Object.entries(postLayouts.current).forEach(([postId, layout]) => {
      const postTop = layout.y;
      const postBottom = layout.y + layout.height;
      // A post is "visible" when at least 50% of it overlaps with the viewport
      const overlap = Math.min(postBottom, bottom) - Math.max(postTop, top);
      const isVisible = overlap >= layout.height * 0.5;
      if (isVisible) {
        onPostViewable(postId);
      } else {
        onPostHidden(postId);
      }
    });
  }, [onPostViewable, onPostHidden]);

  // ─── Stable refs so fetchFeedData never gets a new identity just because ──
  // Clerk re-issued the user/getToken object between renders.
  const getTokenRef = useRef(getToken);
  const userRef = useRef(user);
  getTokenRef.current = getToken;
  userRef.current = user;

  const fetchFeedData = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      const [feedData, storiesData] = await Promise.allSettled([
        apiFetch("/feed", {}, token),
        apiFetch("/stories", {}, token),
      ]);

      if (feedData.status === "fulfilled" && feedData.value) {
        const response = feedData.value;
        const fetchedPosts = Array.isArray(response)
          ? response
          : Array.isArray(response.posts)
          ? response.posts
          : [];

        if (fetchedPosts.length > 0) {
          const mapped = fetchedPosts.map((item: any) => ({
            id: item._id || item.id,
            username: item.user?.username || item.user?.name || "user",
            profileImage:
              item.user?.profileImage || "https://i.pravatar.cc/150?img=12",
            postImage: item.mediaUrl,
            likes: item.likesCount ?? item.likes?.length ?? 0,
            isLiked: item.isLiked || false,
            caption: item.caption || "",
            commentsCount: item.commentsCount ?? item.comments?.length ?? 0,
            comments: item.comments || [],
            time: item.createdAt
              ? new Date(item.createdAt).toLocaleDateString()
              : "Just now",
          }));
          setPosts(mapped);
          resetTracking();           // clear stale view timers for the old batch
          postLayouts.current = {};  // reset layout cache
          setNextCursor(response.nextCursor || null);
          setHasMore(response.hasMore ?? false);
        } else {
          setPosts([]);
          resetTracking();
          postLayouts.current = {};
          setNextCursor(null);
          setHasMore(false);
        }
      } else {
        setNextCursor(null);
        setHasMore(false);
      }

      const responseStories =
        storiesData.status === "fulfilled"
          ? Array.isArray(storiesData.value)
          ? storiesData.value
          : Array.isArray(storiesData.value?.stories)
          ? storiesData.value.stories
          : []
          : [];

      const mappedStories = responseStories.map((item: any) => ({
        id: item._id || item.id,
        username: item.user?.username || "user",
        image:
          item.user?.profileImage ||
          item.mediaUrl ||
          "https://i.pravatar.cc/150?img=12",
        own: false,
      }));

      setStories([
        {
          id: "me",
          username: "Your Story",
          image: userRef.current?.imageUrl || "https://i.pravatar.cc/150?img=12",
          own: true,
        },
        ...mappedStories,
      ]);
    } catch (err) {
      console.log("Error loading feed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // Empty dep array: refs always hold the latest values — no stale closure risk,
  // and useFocusEffect won't re-fire just because Clerk re-issued user/getToken.
  }, []);

  const fetchMorePosts = useCallback(async () => {
    if (!nextCursor || !hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const token = await getTokenRef.current();
      const res = await apiFetch(
        `/feed?cursor=${encodeURIComponent(nextCursor)}`,
        {},
        token
      );

      if (res) {
        const fetchedPosts = Array.isArray(res)
          ? res
          : Array.isArray(res.posts)
          ? res.posts
          : [];

        if (fetchedPosts.length > 0) {
          const mappedNew = fetchedPosts.map((item: any) => ({
            id: item._id || item.id,
            username: item.user?.username || item.user?.name || "user",
            profileImage:
              item.user?.profileImage || "https://i.pravatar.cc/150?img=12",
            postImage: item.mediaUrl,
            likes: item.likesCount ?? item.likes?.length ?? 0,
            isLiked: item.isLiked || false,
            caption: item.caption || "",
            commentsCount: item.commentsCount ?? item.comments?.length ?? 0,
            comments: item.comments || [],
            time: item.createdAt
              ? new Date(item.createdAt).toLocaleDateString()
              : "Just now",
          }));

          setPosts((prevPosts) => {
            const existingIds = new Set(prevPosts.map((p: any) => p.id));
            const uniqueNew = mappedNew.filter((p: any) => !existingIds.has(p.id));
            return [...prevPosts, ...uniqueNew];
          });

          setNextCursor(res.nextCursor || null);
          setHasMore(res.hasMore ?? false);
        } else {
          setHasMore(false);
          setNextCursor(null);
        }
      }
    } catch (err) {
      console.log("Error loading more feed posts:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, hasMore, loadingMore]);

  const handleScroll = useCallback(
    (event: any) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;

      scrollY.current = contentOffset.y;
      scrollViewHeight.current = layoutMeasurement.height;
      checkViewability();

      const isCloseToBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 300;
      if (isCloseToBottom && hasMore && !loadingMore && nextCursor) {
        fetchMorePosts();
      }
    },
    [hasMore, loadingMore, nextCursor, fetchMorePosts, checkViewability]
  );

  useFocusEffect(
    useCallback(() => {
      fetchFeedData();
    }, [fetchFeedData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeedData();
  };

  // LIKE TOGGLE HANDLER
  const handleLikeToggle = async (postId: string) => {
    // Track like engagement event (also suppresses skip for this post)
    recordEngagement(postId, "like");

    setPosts((prevPosts) =>
      prevPosts.map((p) => {
        if (p.id === postId) {
          const newIsLiked = !p.isLiked;
          return {
            ...p,
            isLiked: newIsLiked,
            likes: newIsLiked ? p.likes + 1 : Math.max(0, p.likes - 1),
          };
        }
        return p;
      })
    );

    try {
      const token = await getToken();
      await apiFetch(`/feed/${postId}/like`, { method: "POST" }, token);
    } catch (err) {
      console.log("Error toggling like:", err);
    }
  };

  // OPEN COMMENTS MODAL
  const handleOpenComments = async (post: any) => {
    setActivePostForComments(post);
    setCommentsList(post.comments || []);
    setLoadingComments(true);

    try {
      const token = await getToken();
      const res = await apiFetch(`/feed/${post.id}/comments`, {}, token);
      if (res && Array.isArray(res.comments)) {
        setCommentsList(res.comments);
      }
    } catch (err) {
      console.log("Error fetching comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  // ADD COMMENT HANDLER
  const handleAddComment = async () => {
    if (!commentInput.trim() || !activePostForComments) return;

    // Track comment engagement event (also suppresses skip for this post)
    recordEngagement(activePostForComments.id, "comment");

    const textToSend = commentInput.trim();
    setCommentInput("");

    try {
      setSubmittingComment(true);
      const token = await getToken();
      const res = await apiFetch(
        `/feed/${activePostForComments.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ text: textToSend }),
        },
        token
      );

      if (res && res.comment) {
        setCommentsList((prev) => [...prev, res.comment]);
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.id === activePostForComments.id
              ? { ...p, commentsCount: (p.commentsCount || 0) + 1 }
              : p
          )
        );
      } else {
        const mockNewComment = {
          _id: Date.now().toString(),
          user: {
            username: user?.username || "you",
            name: user?.fullName || "You",
            profileImage: user?.imageUrl,
          },
          text: textToSend,
          createdAt: new Date().toISOString(),
        };
        setCommentsList((prev) => [...prev, mockNewComment]);
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.id === activePostForComments.id
              ? { ...p, commentsCount: p.commentsCount + 1 }
              : p
          )
        );
      }
    } catch (err) {
      console.log("Error adding comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      {/* HEADER */}
      <View
        style={{ borderBottomColor: colors.border }}
        className="flex-row items-center justify-between px-4 py-3 border-b"
      >
        <Text style={{ color: colors.text }} className="text-3xl font-bold tracking-tight">
          Instagram
        </Text>

        <View className="flex-row items-center gap-5">
          <Pressable onPress={onRefresh}>
            <Ionicons name="reload-outline" size={25} color={colors.text} />
          </Pressable>

          <Pressable>
            <Ionicons name="heart-outline" size={27} color={colors.text} />
          </Pressable>

          <Pressable>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={26}
              color={colors.text}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onLayout={(e: LayoutChangeEvent) => {
          scrollViewHeight.current = e.nativeEvent.layout.height;
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
      >
        {/* STORIES */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ borderBottomColor: colors.border }}
          className="border-b"
          contentContainerClassName="px-3 py-4 gap-4"
        >
          {stories.map((story) => (
            <Pressable key={story.id} className="items-center">
              <View
                className={`rounded-full p-[2px] ${
                  story.own
                    ? isDark ? "bg-slate-700" : "bg-gray-300"
                    : "bg-gradient-to-r from-pink-500 to-orange-400"
                }`}
              >
                <View
                  style={{ backgroundColor: colors.background }}
                  className="rounded-full p-[2px]"
                >
                  <Image
                    source={{ uri: story.image }}
                    className="w-[64px] h-[64px] rounded-full"
                  />
                </View>
              </View>

              <Text
                numberOfLines={1}
                style={{ color: colors.text }}
                className="text-xs mt-1 w-[70px] text-center"
              >
                {story.username}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.subtext }} className="mt-2 text-sm">
              Loading feed...
            </Text>
          </View>
        ) : posts.length > 0 ? (
          /* POSTS */
          <>
            {posts.map((post) => (
              <View
                key={post.id}
                style={{ borderBottomColor: colors.border }}
                className="border-b pb-5"
                onLayout={(e: LayoutChangeEvent) => {
                  // Store this post's Y offset and height so handleScroll
                  // can work out whether it's inside the viewport.
                  postLayouts.current[post.id] = {
                    y: e.nativeEvent.layout.y,
                    height: e.nativeEvent.layout.height,
                  };
                }}
              >
                {/* POST HEADER */}
                <View className="flex-row items-center justify-between px-4 py-3">
                  <Pressable
                    onPress={() => router.push(`/user/${post.username}`)}
                    className="flex-row items-center gap-3"
                  >
                    <Image
                      source={{ uri: post.profileImage }}
                      className="w-9 h-9 rounded-full bg-gray-200"
                    />
                    <Text
                      style={{ color: colors.text }}
                      className="font-bold text-sm"
                    >
                      {post.username}
                    </Text>
                  </Pressable>

                  <Pressable>
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={20}
                      color={colors.subtext}
                    />
                  </Pressable>
                </View>

                {/* POST MEDIA */}
                <View className="w-full aspect-square bg-gray-900">
                  <Image
                    source={{ uri: post.postImage }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>

                {/* POST ACTIONS */}
                <View className="flex-row items-center justify-between px-4 pt-3">
                  <View className="flex-row items-center gap-4">
                    <Pressable onPress={() => handleLikeToggle(post.id)}>
                      <Ionicons
                        name={post.isLiked ? "heart" : "heart-outline"}
                        size={27}
                        color={post.isLiked ? "#ef4444" : colors.text}
                      />
                    </Pressable>

                    <Pressable onPress={() => handleOpenComments(post)}>
                      <Ionicons
                        name="chatbubble-outline"
                        size={25}
                        color={colors.text}
                      />
                    </Pressable>

                    <Pressable>
                      <Ionicons
                        name="paper-plane-outline"
                        size={24}
                        color={colors.text}
                      />
                    </Pressable>
                  </View>

                  <Pressable>
                    <Ionicons
                      name="bookmark-outline"
                      size={25}
                      color={colors.text}
                    />
                  </Pressable>
                </View>

                {/* LIKES & CAPTION */}
                <View className="px-4 mt-2">
                  <Text style={{ color: colors.text }} className="font-bold text-sm">
                    {post.likes.toLocaleString()} likes
                  </Text>

                  {post.caption ? (
                    <Text style={{ color: colors.text }} className="text-sm mt-1">
                      <Text className="font-bold">{post.username} </Text>
                      {post.caption}
                    </Text>
                  ) : null}

                  {post.commentsCount > 0 && (
                    <Pressable
                      onPress={() => handleOpenComments(post)}
                      className="mt-1"
                    >
                      <Text style={{ color: colors.subtext }} className="text-xs">
                        View all {post.commentsCount} comments
                      </Text>
                    </Pressable>
                  )}

                  <Text
                    style={{ color: colors.subtext }}
                    className="text-[11px] mt-1 uppercase"
                  >
                    {post.time}
                  </Text>
                </View>
              </View>
            ))}

            {loadingMore && (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </>
        ) : (
          <View className="py-20 items-center justify-center px-4">
            <Ionicons name="images-outline" size={48} color={colors.subtext} />
            <Text style={{ color: colors.text }} className="mt-3 font-bold text-lg">
              No posts in feed yet
            </Text>
            <Text style={{ color: colors.subtext }} className="mt-1 text-sm text-center">
              Share a post or follow others to see photos here.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* COMMENTS MODAL */}
      <Modal
        visible={activePostForComments !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setActivePostForComments(null)}
      >
        <SafeAreaView
          style={{ backgroundColor: colors.modalBg }}
          className="flex-1"
        >
          {/* MODAL HEADER */}
          <View
            style={{ borderBottomColor: colors.border }}
            className="flex-row items-center justify-between px-4 py-3 border-b"
          >
            <Pressable
              onPress={() => setActivePostForComments(null)}
              className="p-1"
            >
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.text }} className="font-bold text-lg">
              Comments
            </Text>
            <View className="w-6" />
          </View>

          {/* COMMENTS LIST */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            <ScrollView className="flex-1 px-4 py-3">
              {loadingComments ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : commentsList.length > 0 ? (
                commentsList.map((c: any, index: number) => (
                  <View key={c._id || index} className="flex-row gap-3 mb-4">
                    <Image
                      source={{
                        uri:
                          c.user?.profileImage ||
                          "https://i.pravatar.cc/150?img=12",
                      }}
                      className="w-9 h-9 rounded-full bg-gray-200"
                    />
                    <View className="flex-1">
                      <Text
                        style={{ color: colors.text }}
                        className="text-sm font-semibold"
                      >
                        {c.user?.username || c.user?.name || "User"}{" "}
                        <Text
                          style={{ color: colors.text }}
                          className="font-normal"
                        >
                          {c.text}
                        </Text>
                      </Text>
                      <Text
                        style={{ color: colors.subtext }}
                        className="text-[11px] mt-1"
                      >
                        {c.createdAt
                          ? new Date(c.createdAt).toLocaleDateString()
                          : "Just now"}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View className="py-16 items-center">
                  <Text style={{ color: colors.subtext }} className="text-sm">
                    No comments yet. Start the conversation!
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* INPUT */}
            <View
              style={{
                borderTopColor: colors.border,
                backgroundColor: colors.modalBg,
              }}
              className="flex-row items-center px-4 py-3 border-t gap-3"
            >
              <TextInput
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.subtext}
                style={{
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                }}
                className="flex-1 px-4 py-2.5 rounded-full border text-sm"
              />
              <Pressable
                onPress={handleAddComment}
                disabled={!commentInput.trim() || submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={{
                      color: commentInput.trim() ? "#3B82F6" : colors.subtext,
                    }}
                    className="font-bold text-sm"
                  >
                    Post
                  </Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}